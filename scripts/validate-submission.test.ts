// Byte-counting for POST bodies and the lbs_hp honeypot rename are in draft
// #8. These tests cover validateSubmission and the website honeypot check
// that is already on main. They do not treat a missing Content-Length as safe.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { asString, validateSubmission } from "../src/validate-submission.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workerSource = readFileSync(path.join(root, "src", "worker.ts"), "utf8");

const validBody = {
  name: "Ada Lovelace",
  lbs_email: "Ada@london.edu",
  course_name: "MBA",
  build_interest: "A workflow assistant",
  public_consent: "yes",
};

test("validateSubmission accepts a trimmed LBS email and required consent", () => {
  assert.deepEqual(validateSubmission(validBody), {
    name: "Ada Lovelace",
    email: "ada@london.edu",
    course: "MBA",
    idea: "A workflow assistant",
  });
});

test("validateSubmission rejects a non-LBS email and missing fields", () => {
  assert.deepEqual(
    validateSubmission({ ...validBody, lbs_email: "ada@example.com" }),
    {
      error: "Please use your LBS email address.",
    },
  );
  assert.deepEqual(validateSubmission({ ...validBody, name: "  " }), {
    error: "Please enter your name.",
  });
  assert.deepEqual(validateSubmission({ ...validBody, course_name: "" }), {
    error: "Please enter your course.",
  });
  assert.deepEqual(validateSubmission({ ...validBody, build_interest: "" }), {
    error: "Please share what you would like to build.",
  });
  assert.deepEqual(validateSubmission({ ...validBody, public_consent: "no" }), {
    error:
      "Please confirm that your name, course, and idea can be shown to other LBS builders.",
  });
});

test("validateSubmission slices name, course, and idea, and rejects an email the slice would break", () => {
  const local = "e".repeat(169);
  const exact = validateSubmission({
    ...validBody,
    name: "n".repeat(121),
    lbs_email: `${local}@london.edu`,
    course_name: "c".repeat(81),
    build_interest: "i".repeat(901),
  });

  assert.ok(!("error" in exact));
  if ("error" in exact) return;

  assert.equal(exact.name.length, 120);
  assert.equal(exact.course.length, 80);
  assert.equal(exact.idea.length, 900);
  assert.equal(exact.email.length, 180);
  assert.equal(exact.email, `${local}@london.edu`);

  assert.deepEqual(
    validateSubmission({
      ...validBody,
      lbs_email: `${"e".repeat(170)}@london.edu`,
    }),
    { error: "Please use your LBS email address." },
  );
});

test("the Worker honeypot is a non-empty website field checked before validation", () => {
  assert.equal(asString(" https://example.com "), "https://example.com");
  assert.equal(asString("   "), "");
  assert.equal(asString(undefined), "");

  const handlerStart = workerSource.indexOf(
    "async function handleCreateApplication",
  );
  const honeypotCheck = workerSource.indexOf(
    "if (asString(body.website))",
    handlerStart,
  );
  const validationCheck = workerSource.indexOf(
    "validateSubmission(body)",
    handlerStart,
  );

  assert.ok(honeypotCheck > handlerStart);
  assert.ok(validationCheck > honeypotCheck);
});
