import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workerSource = readFileSync(path.join(root, "src", "worker.ts"), "utf8");
const migrationSource = readFileSync(
  path.join(root, "migrations", "0003_align_application_checks.sql"),
  "utf8",
);

const submittedAt = "2026-09-23T12:00:00.000Z";

function freshDatabase(): DatabaseSync {
  const database = new DatabaseSync(":memory:");

  for (const file of [
    "0001_create_applications.sql",
    "0002_allow_legacy_application_length.sql",
  ]) {
    database.exec(readFileSync(path.join(root, "migrations", file), "utf8"));
  }

  return database;
}

function insertApplication(
  database: DatabaseSync,
  idea: string,
  email = "ada@london.edu",
): void {
  database
    .prepare(
      `INSERT INTO applications (submitted_at, name, email, course, idea)
       VALUES (?, 'Ada', ?, 'MBA', ?)`,
    )
    .run(submittedAt, email, idea);
}

test("Worker slice caps and migration 0003 use the same field lengths", () => {
  for (const [name, limit] of [
    ["APPLICATION_NAME_MAX_LENGTH", "120"],
    ["APPLICATION_EMAIL_MAX_LENGTH", "180"],
    ["APPLICATION_COURSE_MAX_LENGTH", "80"],
    ["APPLICATION_IDEA_MAX_LENGTH", "900"],
  ]) {
    assert.match(workerSource, new RegExp(`const ${name} = ${limit};`));
  }

  assert.match(workerSource, /\/\^\[\^@\\s\]\+@london\\\.edu\$\//);
  assert.match(migrationSource, /length\(idea\) BETWEEN 1 AND 900/);
  assert.match(migrationSource, /length\(name\) BETWEEN 1 AND 120/);
  assert.match(migrationSource, /length\(course\) BETWEEN 1 AND 80/);
  assert.match(migrationSource, /length\(email\) BETWEEN 1 AND 180/);
  assert.doesNotMatch(
    readFileSync(
      path.join(root, "migrations", "0002_allow_legacy_application_length.sql"),
      "utf8",
    ),
    /BETWEEN 1 AND 900/,
  );
});

test("0003 aborts before drop when a legacy idea is longer than 900", () => {
  const database = freshDatabase();
  const legacyIdea = "x".repeat(5000);

  insertApplication(database, legacyIdea);
  assert.throws(() => database.exec(migrationSource));

  const row = database.prepare("SELECT idea FROM applications").get() as {
    idea: string;
  };

  assert.equal(row.idea, legacyIdea);
});

test("0003 keeps Worker-sized rows and rejects looser emails and ideas", () => {
  const database = freshDatabase();

  insertApplication(database, "y".repeat(900));
  database.exec(migrationSource);

  const inserted = database
    .prepare(
      `INSERT INTO applications (submitted_at, name, email, course, idea)
       VALUES (?, 'Grace', 'grace@london.edu', 'MiM', 'A short idea')`,
    )
    .run(submittedAt);
  const nextRow = database
    .prepare("SELECT id, email FROM applications WHERE email = ?")
    .get("grace@london.edu") as { id: number; email: string };

  assert.equal(nextRow.email, "grace@london.edu");
  assert.equal(nextRow.id, Number(inserted.lastInsertRowid));
  assert.ok(nextRow.id > 1);

  assert.throws(() => insertApplication(database, "z".repeat(901)));
  assert.throws(() => insertApplication(database, "idea", "a@b@london.edu"));
  assert.throws(() => insertApplication(database, "idea", "a b@london.edu"));
  assert.throws(() =>
    insertApplication(database, "idea", "person@example.com"),
  );
});
