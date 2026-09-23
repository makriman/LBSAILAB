# Code review — 2026-09-23

Review of `main` at `fe2ea71` (`Move application submissions to Cloudflare D1`). Documentation only. No production deploy, no remote D1 call, no merge.

Scope: architecture, Worker form → D1, XSS/CSP/headers, correctness, dependency and CI hygiene, Worker-name drift, content/ops risk, maintainability.

Public checks were read-only HTTP GETs against `https://lbsailab.com` and the two `workers.dev` hostnames below. Response bodies for `/api/applications` were reduced to status, keys, and row count. No names, emails, or ideas are copied here.

## Architecture

Static Astro site. `astro.config.mjs` sets `output: "static"` and `site: "https://lbsailab.com"`. Wrangler (`wrangler.jsonc`) runs `src/worker.ts` first (`assets.run_worker_first: true`), then serves `./dist` through the `ASSETS` binding.

The Worker owns:

- apex canonicalization (`www` → `https://lbsailab.com`, trailing slash, legacy paths)
- security headers
- `GET`/`POST /api/applications` (D1)
- `POST /api/vitals` (sanitized `console.log` only)
- IndexNow and site-verification responses

Pages, content collections, and JSON-LD live under `src/pages`, `src/content`, and `src/data`. Spring 2026 team routes are real pages. `src/content/batches/autumn-2026.json` has no route; Autumn is a section on `/batches/#autumn-2026` plus `/apply/`.

What is in good shape:

- D1 writes use `prepare` / `bind` (`src/worker.ts`, `handleCreateApplication`). That is not string-built SQL.
- The apply board renders with `textContent` (`src/pages/apply.astro`). Submission text is not assigned to `innerHTML`.
- Security headers on the live apex response match `SECURITY_HEADERS` in `src/worker.ts`: CSP with hashed inline scripts, `script-src-attr 'none'`, `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `nosniff`, COOP, and HSTS `max-age=31536000`.
- `www.lbsailab.com` returns 301 to `https://lbsailab.com/`.
- `/api/*` responses set `X-Robots-Tag: noindex, nofollow` and `Cache-Control: no-store`. `public/robots.txt` disallows `/api/`.
- `.gitignore` ignores `.env`. No env file is committed.
- GitHub collaborators on this repo are human accounts only (`makriman`, `kostis-christodoulou`, `alecondorelli`, `zaramogadasi`). `cursoragent` is not a collaborator.

## Findings

Severity is for this lander as it is deployed, not a generic score.

### 1. High — two Workers still serve `/api/applications`

`wrangler.jsonc` names the Worker `ailab`. A read-only GET on 2026-09-23:

| Host | `GET /api/applications` |
| --- | --- |
| `https://lbsailab.com` | HTTP 200, body keys `applications`, 8 rows, each row includes `email` |
| `https://ailab.zahra-moghadasi.workers.dev` | same 200 shape and the same payload size (6407 bytes) |
| `https://lbsailab.zahra-moghadasi.workers.dev` | HTTP 200, keys `applications` and `error`, 0 rows |

The third host returned a GitHub rate-limit message (`API rate limit exceeded for <ip>…`) and an empty list. That string is not produced by current `handleListApplications`. Current code returns either `{ applications }` or, on failure, HTTP 503 with a fixed “temporarily unavailable” error (`src/worker.ts`).

The previous Worker (`git show 5ef5a25:src/worker.ts`) stored submissions through the GitHub Contents API (`GITHUB_TOKEN`, default repo `makriman/LBSAILAB`, default path `data/application-submissions.md`) and on failure did:

```ts
return json({ error: errorMessage(error), applications: [] }, 200);
```

`githubError` forwarded `message` from the GitHub JSON body. `data/application-submissions.md` is not on `main`. The old host is still executing that handler. Page GETs on both `workers.dev` hosts 301 to the apex, because `canonicalRedirectResponse` skips only `/api/` (`src/worker.ts`).

`workers_dev: true` keeps the `workers.dev` host public. `.github/workflows/seo.yml` still sets `SEO_DUPLICATE_ORIGINS` to the old host only.

Open pull requests make a mistaken merge worse:

- [#4](https://github.com/makriman/LBSAILAB/pull/4) (`update_worker_name_to_ailab`) is `CONFLICTING`. `main` is already `"name": "ailab"`.
- [#3](https://github.com/makriman/LBSAILAB/pull/3) renames the Worker to `lbsailab` from an older base name `lbs-ai-lab`.
- [#1](https://github.com/makriman/LBSAILAB/pull/1) is Cloudflare autoconfig. Its `wrangler.jsonc` uses `"name": "lbs-ai-lab"` and `main` `@astrojs/cloudflare/entrypoints/server`. The PR body links a Cloudflare build under account `a1e5e542dc1d5fe5a5c6b2a10d755a81`, which is not the `account_id` in the current `wrangler.jsonc`.

**Next action (founder / Zahra):** confirm which Worker owns the custom domains (live apex matches `ailab` / D1). Disable or delete the stale `lbsailab` Worker. If `GITHUB_TOKEN` is still bound there, remove it and rotate the token. Do not merge #1, #3, or #4. Point `SEO_DUPLICATE_ORIGINS` at the host that should remain, after the stale Worker is gone.

### 2. High — public applicant emails, no proof of inbox, no abuse limit

`GET /api/applications` is unauthenticated and returns `submittedAt`, `name`, `email`, `course`, and `idea` for up to 500 rows (`APPLICATIONS_QUERY_LIMIT`, `handleListApplications`). Production currently has 8 rows, all `@london.edu`. `robots` noindex does not stop a client that requests the URL.

The page copy says the public board shows name, course, and idea (`src/pages/apply.astro` consent label). The Connect control builds `mailto:${application.email}` from that JSON. Email is therefore published, and the checkbox text does not say so.

There is no mail proof. `validateSubmission` accepts any string matching `/^[^@\s]+@london\.edu$/`. Anyone can store another person’s LBS address. The checkbox is `required` in the form and `public_consent === "yes"` is required on the server, so the “opt in publicly if you want” line is not optional. Every accepted row is public. There is no second, private interest list.

Other gaps on the same route:

- No rate limit, Turnstile, or origin allowlist in `src/worker.ts`.
- No unique constraint on `email` (`migrations/0001_create_applications.sql`). Repeats and flooding are allowed. The board shows the latest 500, so new rows bury older ones.
- Inserts are not bound to a batch id. Autumn copy and Spring pages share one table.

The browser UI is safer than the API: `textContent` avoids stored XSS, and `Content-Type: application/json` is not a simple CORS request. Non-browser clients ignore both.

**Next action:** decide whether the public board stays. If it stays, name the email in the consent text (separate copy change; do not sneak it into a refactor), require a confirmation step for `@london.edu` before the row is public, and add a rate limit. If it should not be public, stop returning `email` from the GET and stop listing rows until that decision is deployed by a human. This review does not change the API.

### 3. High — SEO workflow is off, and the D1 commit never ran in Actions

GitHub reports workflow `SEO` (`.github/workflows/seo.yml`) as `disabled_inactivity`. The last run is the 2026-08-16 schedule, on commit `5ef5a25`. `gh run list --commit fe2ea71` is empty. The commit that moved submissions to D1 was not built or audited by Actions.

Scheduled production checks (live SEO, PageSpeed, CrUX, IndexNow) have not run since 16 August 2026. A new push does not turn a `disabled_inactivity` workflow back on.

Earlier red schedules (for example run `31463669616` on 2026-08-11) failed in `scripts/audit-live-seo.mjs` because `https://www.london.edu/.../website-privacy-policy` returned HTTP 599. That URL is built in `src/components/layout/Footer.astro` from `LBS_URL`. The failure is an external-link gate, not a bad path in this repo. It will flake again after the workflow is re-enabled.

**Next action:** a human re-enables the SEO workflow and lets it run on current `main`. Do not treat `fe2ea71` as CI-green.

### 4. Medium — the body-size cap trusts `Content-Length`

`handleCreateApplication` and `handleVitals` reject the request only when `Number(Content-Length)` is greater than the cap (`src/worker.ts`). A missing header becomes `0`. A non-numeric header becomes `NaN`, and `NaN > limit` is false. `request.json()` runs either way. `scripts/audit-seo.mjs` (`auditApplicationsApiHygiene`) only checks that the header comparison appears before `request.json()` in the source.

**Next action:** when this handler is next edited, measure the bytes actually read (or stream with a hard stop) and reject oversize bodies. Add a behavioral check. Do not keep the string-presence test as the only guard.

### 5. Medium — honeypot success is indistinguishable from a saved application

If `website` is non-empty, the Worker returns `{ ok: true }` with HTTP 202 and does not insert (`handleCreateApplication`). The form treats any `response.ok` as saved (`src/pages/apply.astro` submit handler) and tells the person the idea will appear on the board.

The field is named `website` (a common autofill name), hidden with CSS, with `autocomplete="off"`. A browser that fills it drops the application and shows success.

`scripts/audit-live-seo.mjs` (`auditApplicationsApiNoindex`) posts a honeypot using `email`, `course`, `idea`, and `consent: true`. The Worker reads `lbs_email`, `course_name`, `build_interest`, and `public_consent === "yes"`. The live check never reaches validation because `website` returns 202 first. It does not prove a real submission would be stored.

**Next action:** return a response the form can tell apart from HTTP 201, or ignore autofill on a non-`website` honeypot name. Teach the client to require 201 before it claims the row was saved.

### 6. Medium — SQL checks, Worker limits, and migration 0002 disagree

| Rule | Worker `validateSubmission` | `migrations/0001_create_applications.sql` | `migrations/0002_allow_legacy_application_length.sql` |
| --- | --- | --- | --- |
| Idea length | slice to 900 | `CHECK` 1–900 | `CHECK` 1–10000 |
| Email | `/^[^@\s]+@london\.edu$/` | `LIKE '%_@london.edu'` plus lowercase/trim | same weaker `LIKE` |

0002 rebuilds the table with `CREATE TABLE applications_next`, `INSERT`, `DROP TABLE applications`, `RENAME`. Wrangler runs a migration file once, but this shape is a data-loss window if a later edit rewrites history or a human re-applies it by hand. The filename says “legacy length”; the effect is a wider cap than the Worker allows. Nothing on `main` inserts an idea longer than 900.

**Next action:** do not edit 0001 or 0002 in place. If the cap should be 900, add a new migration only when a human will apply it, and keep the Worker slice and the `CHECK` the same. Prefer the Worker regex over the SQL `LIKE` if a future migration tightens `email`.

### 7. Medium — lockfile is inside published Astro and build-tool advisories

`npm audit --package-lock-only` on 2026-09-23: 1 critical, 7 high, 5 moderate, 1 low. Direct packages:

- `astro` locked at 6.4.7 (`package.json` allows `^6.3.7`). npm marks critical [GHSA-26w7-cxv4-gfx2](https://github.com/advisories/GHSA-26w7-cxv4-gfx2) (AVIF image-optimization RCE, range `<7.2.8`) and [GHSA-vj59-8hwv-xxmv](https://github.com/advisories/GHSA-vj59-8hwv-xxmv) (authorization bypass, range `>=6.4.7 <6.4.8`). Live HTML says `Astro v6.4.7`.
- `js-yaml` 4.2.x (high, merge-key CPU). Used by `scripts/generate-og-images.mjs` at build time.
- `sharp` (high, libvips / libheif). Build-time image pipeline. Audit’s fixed version is a semver-major bump.

This site’s production request path is the custom Worker plus static files, not Astro SSR and not the Astro image endpoint. Those Astro advisories are real for `astro dev` / a future SSR adapter. They are not evidence of remote code execution on `lbsailab.com` today. [#1](https://github.com/makriman/LBSAILAB/pull/1) would switch `main` to the Astro Cloudflare server entry and would change that assumption.

**Next action:** plan an Astro upgrade on a branch a human reviews. Do not deploy it from an agent. Re-run `npm run check` and `npm run build` after the bump. Do not merge #1 as an “upgrade”.

### 8. Medium — no private security contact, and `security.txt` points at the public contact page

`SECURITY.md` says to contact the repository owner privately and not to open a public issue. `.github/ISSUE_TEMPLATE/config.yml` links GitHub private vulnerability reporting. `public/.well-known/security.txt` sets `Contact` and `Policy` to `https://lbsailab.com/contact/`.

`src/pages/contact.astro` does not collect a report. It links to the DSAI site and says the dedicated AI Lab inbox is not set up. `MENTOR_APPLICATION_URL` in `src/utils/site.ts` is a `mailto:` to two LBS addresses for mentoring, which is a different purpose.

**Next action:** Zahra decides the private contact (mailbox or GitHub advisory only) and updates `security.txt` in a later change. Do not put a new personal address in the repo without that decision.

### 9. Low — header and “last updated” policy are copied in several places

`public/_headers` repeats cache and robots rules and does not include the CSP or HSTS the Worker sets. The Worker returns 410 for `/_headers` and `/_redirects` (`GONE_PATHS`). Editing `public/_headers` does not change live responses.

`2026-06-16` is hard-coded as the SEO last-modified date in `astro.config.mjs`, `src/worker.ts` (`SITE_UPDATED_AT`), `src/utils/seo.ts`, `public/_headers`, and the SEO scripts. Live `Last-Modified` on `/` is still `Tue, 16 Jun 2026`. That is consistent with the pin, and it is easy to update one copy and fail `scripts/audit-seo.mjs`.

HSTS has no `includeSubDomains`. Team product hosts (`briefd.lbsailab.com` and the other hosts listed in `scripts/audit-live-seo.mjs`) are not routes in `wrangler.jsonc`. This Worker cannot set their headers.

### 10. Content / ops — Autumn 2026 CTA is stale relative to 23 September 2026

Not changed in this pull request.

- `src/components/sections/ApplyCTA.astro` default body: “Autumn 2026 Batch opens in September 2026”.
- `/batches/#autumn-2026` and `/apply/` use the same line.
- `/apply/` also says the team will follow up “when applications open”, while the form already writes to the public D1 board.
- `src/pages/sitemap.astro` lists Spring team pages and does not link the Autumn section. `autumn-2026.json` does not create `/batches/autumn-2026/`.
- `src/content/batches/spring-2026.json` has `status: "past"` and `endsAt: "2026-06-05"`. The homepage still leads with that batch, which matches a park-as-company lander. It is not, by itself, a defect.

**Next action:** founder decides the Autumn line (open, closed, or date moved). A later copy change should update the CTA, `/apply/`, and `/batches/` together so the audits that compare visible strings stay honest.

## Maintainability

- There is no unit test for `validateSubmission`, redirects, or header selection. `scripts/audit-seo.mjs` is a large source-and-dist gate. It is valuable and it can pass while the size cap and the honeypot payload are wrong (findings 4 and 5).
- `worker-configuration.d.ts` is generated (`wrangler types`, about 15k lines) and committed. Regenerate it when bindings change; do not hand-edit it.
- `package.json` `deploy` runs `wrangler deploy --keep-vars`. Agents must not run it. See `AGENTS.md`.
- README still documents `wrangler deploy` and `npm run db:migrate:remote` for humans. That is accurate for founders. It is the wrong path for an agent.

## Out of scope on purpose

- No Autumn marketing rewrite.
- No dependency bump.
- No migration, Worker, or workflow edit.
- No production Cloudflare or D1 admin call. Dashboard rate-limit rules, if any, were not visible from the repo.
