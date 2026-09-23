# Review follow-ups — 2026-09-23

Notes for the medium findings in `docs/CODE_REVIEW_2026-09-23.md` on draft PR #5, after draft PRs #6 and #7. This change does not deploy, does not merge those drafts, and does not edit Autumn 2026 marketing copy.

## Fixed in this branch

- `POST /api/applications` and `POST /api/vitals` count bytes read. A missing or non-numeric `Content-Length` no longer skips the cap, and a header smaller than the body no longer raises it. Oversize application posts return HTTP 413. Oversize vitals posts still return HTTP 204 and are not logged.
- The apply form honeypot field is `lbs_hp`, not `website`, so browser autofill is less likely to fill it. The Worker still treats a non-empty `website` value as a honeypot for older clients. A honeypot returns HTTP 202. The form tells the person the idea was saved only after HTTP 201.
- The live SEO probe posts `lbs_email`, `course_name`, `build_interest`, and `public_consent`. The honeypot probe also sends `lbs_hp` and `website`, and uses an address that is not `@london.edu`, so it does not insert if neither honeypot is honored. A second post, with the real field names and no honeypot, expects HTTP 400.

## Human steps

### Migration 0003

`migrations/0003_align_application_checks.sql` is only a file. Nothing in this pull request runs remote D1. Do not edit `0001` or `0002`.

The Worker already slices a new idea to 900 characters and accepts an email only when it matches `/^[^@\s]+@london\.edu$/`. Migration 0002 still allows an idea up to 10000 characters and a weaker `LIKE '%_@london.edu'` check. 0003 rebuilds the table so storage matches those Worker limits. SQLite on D1 has no `REGEXP` function, so the email `CHECK` is the ASCII-whitespace form of that rule. The Worker regex is still what `POST /api/applications` enforces.

Before applying it:

1. Export `ailab-applications` from the Cloudflare dashboard or with `npx wrangler d1 export`.
2. Look for rows that would fail the new checks: idea length over 900, or an email that is not a single lowercase `local-part@london.edu` without spaces.
3. If any row would fail, stop. The script's preflight `INSERT` fails its `CHECK` and does not reach `DROP TABLE applications`. Decide what to do with those rows separately. New posts are still limited by the Worker.
4. From a reviewed checkout, a person runs `npm run db:migrate:remote`.

An agent must not run that command.

### Dependencies a person still has to confirm

`npm audit fix` plus Astro 6.4.8 and js-yaml 4.3.2 are in this branch. After that, `npm audit` reports 3 remaining issues: critical `astro`, high direct `sharp`, and low `esbuild` pulled in by Astro 6. Transitive `devalue`, `js-yaml`, `nanoid`, `postcss`, `svgo`, `fast-uri`, `smol-toml`, and `yaml` advisories from the 2026-09-23 review are cleared without a major bump.

Still open, and left for a person to confirm:

- Astro 7. This lock clears the 6.4.7 authorization-bypass advisory ([GHSA-vj59-8hwv-xxmv](https://github.com/advisories/GHSA-vj59-8hwv-xxmv), fixed in 6.4.8). It does not clear the critical AVIF image-optimization advisory ([GHSA-26w7-cxv4-gfx2](https://github.com/advisories/GHSA-26w7-cxv4-gfx2), affected below 7.2.8), the Astro XSS advisories that require 7.x, or Astro's `esbuild` 0.27.x dev-server advisory (low, Windows). Latest Astro at the time of this note is 7.3.4. `npm audit fix --force` would install that major. This site's production path is the custom Worker plus static files, not Astro's image endpoint. Do not take the Astro 7 major in an unattended bump. Do not merge pull request #1 as that upgrade.
- Direct `sharp` stays on 0.34.5. `sharp` 0.35.4 clears the libvips and libheif advisories and is outside `"^0.34.5"`. 0.35 changes lossy AVIF quality to SSIMULACRA2 metrics, so `quality: 58` in `scripts/optimize-images.mjs` would not mean the same thing and would rewrite committed hero images. Confirm that before bumping. Wrangler's own dependency tree already has a separate `sharp` 0.35.4; that is not the package the image script imports.
- `js-yaml` 4.3.2 clears the 4.x merge-key advisories. js-yaml 5 is a later major and is not required for those advisories.

### security.txt

Zahra chooses the private contact. Do not invent a personal email.

`public/.well-known/security.txt` still points `Contact` and `Policy` at `https://lbsailab.com/contact/`. That page does not collect a vulnerability report. It stays as-is until she decides. The two existing choices are a mailbox she names, or GitHub private vulnerability reporting, which `.github/ISSUE_TEMPLATE/config.yml` already links. Update `security.txt` in a later change after that decision. `scripts/audit-seo.mjs` currently requires the contact-page URL and rejects an email address in the file.

### Other founder-gated notes

These are not changed here:

- Draft #6 stops publishing applicant emails. Draft #7 adds Turnstile, a rate-limit binding, and the stale `lbsailab` Worker runbook. Do not treat this pull request as either of those.
- Do not merge #1, #3, or #4. Do not delete Worker `lbsailab` from an agent. Do not enable the inactive SEO workflow from an agent.
- `public/_headers` does not set the CSP or HSTS the Worker sets. Editing that file does not change live responses. The Worker returns 410 for `/_headers`.
- `2026-06-16` is still the pinned SEO last-modified date in several files. Change them together when a person wants a new date, or `scripts/audit-seo.mjs` fails.
- HSTS has no `includeSubDomains`. Team product hosts are not routes on this Worker.
- Autumn 2026 calls to action stay as they are until a person rewrites them on the CTA, `/apply/`, and `/batches/` together.

## Workers Builds

Workers Builds has deployed other branches of this repo to production Worker `ailab`. If a build starts for this branch, cancel it. Do not let it deploy.
