import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { renderPublicHeaders } from "./public-headers.mjs";
import { SITE_LAST_MODIFIED } from "../src/site-revision.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("public/_headers matches the shared last-modified pin", () => {
  const committed = readFileSync(path.join(root, "public", "_headers"), "utf8");
  const rendered = renderPublicHeaders();

  assert.equal(committed, rendered);
  assert.equal(SITE_LAST_MODIFIED, "Tue, 16 Jun 2026 00:00:00 GMT");
  assert.equal(committed.split("Last-Modified:").length - 1, 13);
  assert.doesNotMatch(committed, /Strict-Transport-Security/);
  assert.doesNotMatch(committed, /Content-Security-Policy/);
});
