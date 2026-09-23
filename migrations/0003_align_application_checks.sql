-- Align stored application checks with Worker validateSubmission.
-- Do not edit 0001 or 0002. Wrangler records this file once.
--
-- Worker limits for new rows:
--   name 1-120, email 1-180 and /^[^@\s]+@london\.edu$/, course 1-80, idea 1-900.
-- 0002 left idea at 1-10000 and email at LIKE '%_@london.edu' so legacy rows
-- could stay. This file tightens new storage to the Worker caps.
--
-- A human applies it. Do not run `npm run db:migrate:remote` from an agent.
-- Export the D1 database first. If any current row has idea length over 900,
-- or an email the CHECK below rejects, the preflight INSERT fails and this
-- script stops before DROP TABLE applications. Leave those rows for a person
-- to decide. The Worker still slices new ideas to 900 and rejects other emails.
--
-- SQLite has no REGEXP here. The email CHECK matches the Worker rule for one
-- @london.edu address with no ASCII whitespace in the local part. The Worker
-- regex remains the gate on POST /api/applications.

DROP TABLE IF EXISTS _migration_0003_preflight;

CREATE TABLE _migration_0003_preflight (
  ok INTEGER PRIMARY KEY CHECK (ok = 1)
);

INSERT INTO _migration_0003_preflight (ok)
SELECT CASE
  WHEN EXISTS (
    SELECT 1
    FROM applications
    WHERE length(idea) > 900
      OR length(idea) < 1
      OR NOT (
        length(email) BETWEEN 1 AND 180
        AND email = lower(trim(email))
        AND instr(email, '@') = length(email) - length('london.edu')
        AND substr(email, instr(email, '@')) = '@london.edu'
        AND length(email) > length('@london.edu')
        AND instr(substr(email, 1, instr(email, '@') - 1), ' ') = 0
        AND instr(substr(email, 1, instr(email, '@') - 1), char(9)) = 0
        AND instr(substr(email, 1, instr(email, '@') - 1), char(10)) = 0
        AND instr(substr(email, 1, instr(email, '@') - 1), char(11)) = 0
        AND instr(substr(email, 1, instr(email, '@') - 1), char(12)) = 0
        AND instr(substr(email, 1, instr(email, '@') - 1), char(13)) = 0
      )
  )
  THEN 0
  ELSE 1
END;

DROP TABLE _migration_0003_preflight;

CREATE TABLE applications_next (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  submitted_at TEXT NOT NULL
    CHECK (
      length(submitted_at) >= 20
      AND submitted_at GLOB '????-??-??T??:??:??*Z'
    ),
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  email TEXT NOT NULL COLLATE NOCASE
    CHECK (
      length(email) BETWEEN 1 AND 180
      AND email = lower(trim(email))
      AND instr(email, '@') = length(email) - length('london.edu')
      AND substr(email, instr(email, '@')) = '@london.edu'
      AND length(email) > length('@london.edu')
      AND instr(substr(email, 1, instr(email, '@') - 1), ' ') = 0
      AND instr(substr(email, 1, instr(email, '@') - 1), char(9)) = 0
      AND instr(substr(email, 1, instr(email, '@') - 1), char(10)) = 0
      AND instr(substr(email, 1, instr(email, '@') - 1), char(11)) = 0
      AND instr(substr(email, 1, instr(email, '@') - 1), char(12)) = 0
      AND instr(substr(email, 1, instr(email, '@') - 1), char(13)) = 0
    ),
  course TEXT NOT NULL CHECK (length(course) BETWEEN 1 AND 80),
  idea TEXT NOT NULL CHECK (length(idea) BETWEEN 1 AND 900)
);

INSERT INTO applications_next (id, submitted_at, name, email, course, idea)
SELECT id, submitted_at, name, email, course, idea
FROM applications;

DROP TABLE applications;

ALTER TABLE applications_next RENAME TO applications;

CREATE INDEX applications_submitted_at_idx
  ON applications (submitted_at DESC, id ASC);
