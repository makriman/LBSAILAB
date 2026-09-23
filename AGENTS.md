# AGENTS.md

Instructions for Cursor Cloud Agents working in this repository.

## What this repo is

Public lander for LBS AI Lab (`https://lbsailab.com`). It presents the Lab, the Spring 2026 Batch, mentors, and an Autumn 2026 interest form. Office use is park-as-company and light program operations. It is not an application platform to extend on your own.

## Stack

- Astro 6 static site (`output: "static"` in `astro.config.mjs`)
- Custom Cloudflare Worker entry `src/worker.ts` (Wrangler name `ailab`)
- Custom domains `lbsailab.com` and `www.lbsailab.com`
- D1 database `ailab-applications`, binding `APPLICATIONS_DB`, SQL in `migrations/`
- Node `>=22.12.0`. Quality commands:

```bash
npm run check
npm run build
```

`npm run build` also runs image, typecheck, and sitemap steps. It does not deploy.

## Deploy and data are founder-gated

Deploy and remote data changes are Zahra / founder actions. Agents do not deploy.

- Do not run `wrangler deploy`, `npm run deploy`, or `npm run db:migrate:remote`.
- Do not run `wrangler d1 execute`, remote migrations, or anything that writes production D1.
- Do not change Cloudflare routes, secrets, custom domains, or Worker bindings.
- Do not re-enable, edit, or trigger production GitHub Actions except when a human asked for that specific workflow change.
- `package.json` contains `deploy` and `db:migrate:remote` for humans. Those scripts are not agent tasks.

Local D1 (`npm run db:migrate:local`) is allowed only when the task is explicitly about the local database.

## Secrets and access

- Do not commit `.env` files, tokens, database dumps, or submission exports.
- `account_id` and `database_id` in `wrangler.jsonc` identify Zahra’s Cloudflare account and the production D1 database. Do not copy them into another account, Worker, or a new config.
- The IndexNow key in `src/worker.ts` and `public/` is a public verification file, not a deploy credential. Do not treat it as an API token to reuse elsewhere.
- Do not invite `cursoragent` or any other bot as a GitHub collaborator.
- Do not merge pull requests.
- Review and documentation work lands as a **draft** pull request.

## Content boundaries

- Do not rewrite Autumn 2026 calls to action, dates, or “applications open” copy unless a human explicitly asks, or a documented bug/security fix cannot be correct without that copy change.
- Participant and mentor emails in `src/content/teams/`, `src/data/people.json`, and `src/data/mentors.json` are existing public contact data. Do not add new personal emails, and do not paste submission records into docs, issues, or logs.

## D1 migrations

Migrations in `migrations/` have already been aimed at production. Treat them as append-only history.

- Do not edit a migration that may already have run.
- Do not `DROP TABLE` the live `applications` table to “fix” a column.
- A new migration needs a human to apply it remotely. Say so in the pull request. Do not apply it yourself.
- Keep Worker validation and SQL `CHECK` constraints aligned. Today they are not: see `docs/CODE_REVIEW_2026-09-23.md`.

## How to change code

- Prefer a findings note over a drive-by refactor.
- The Worker is the security boundary for `/api/applications` and response headers. `public/_headers` and `public/_redirects` are not served (the Worker returns 410 for those paths).
- Header and redirect behavior is locked by `scripts/audit-seo.mjs`. A header change that is not reflected there will fail `npm run build`.
- Do not add a second Worker name. `wrangler.jsonc` says `ailab`. Open pull requests that rename the Worker are stale and must not be merged.
