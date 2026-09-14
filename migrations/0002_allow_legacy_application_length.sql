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
      AND email LIKE '%_@london.edu'
    ),
  course TEXT NOT NULL CHECK (length(course) BETWEEN 1 AND 80),
  idea TEXT NOT NULL CHECK (length(idea) BETWEEN 1 AND 10000)
);

INSERT INTO applications_next (id, submitted_at, name, email, course, idea)
SELECT id, submitted_at, name, email, course, idea
FROM applications;

DROP TABLE applications;

ALTER TABLE applications_next RENAME TO applications;

CREATE INDEX applications_submitted_at_idx
  ON applications (submitted_at DESC, id ASC);
