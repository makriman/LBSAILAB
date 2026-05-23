# LBS AI Lab

Static Astro website for LBS AI Lab, where London Business School students learn to build AI products, test with real users, and iterate from feedback.

The site is built as a fast, content-driven institutional platform for the Data Science & AI Initiative, with cohort, team, mentor, and application pages generated from Astro Content Collections. Cohort 01 is presented in partnership with Google DeepMind.

## Stack

- Astro
- TypeScript
- Native `.astro` components
- Astro Content Collections
- Static output for Cloudflare Pages
- Local font packages via Fontsource

## Local Development

```sh
npm install
npm run dev
```

The local site runs at `http://localhost:4321/` by default.

## Production Build

```sh
npm run check
npm run build
```

The static build is written to `dist/`.

## Cloudflare Workers

Use these deployment settings:

- Build command: `npm run build`
- Build output directory: `dist`
- Node version: `20` or `22`

If the Cloudflare project uses a Wrangler deploy command, use:

- Deploy command: `npx wrangler versions upload`

The `wrangler.jsonc` file points Wrangler at the generated `dist/` assets.
It also deploys `src/worker.ts`, which powers the secure application form API.

## Application Form / Google Sheets

The Apply page submits to `/api/applications`. The browser never talks to
Google directly. A Cloudflare Worker proxies to a Google Apps Script web app
attached to the submissions Sheet, so no Google Cloud project or service account
is required.

The current submissions Sheet is:

```text
https://docs.google.com/spreadsheets/d/18lPwCDSqAzJmeki2uEp_N15OAS9gqvbUXoDquWgo7Zk/edit
```

The Apps Script will create a tab named `Submissions` if it does not already
exist. The header row is:

```text
submitted_at | name | email | course | idea | public_consent | source
```

### Apps Script Setup

Generate a shared token:

```sh
openssl rand -hex 32
```

Use the CLI route:

```sh
npx @google/clasp login
cd apps-script/lbs-ai-lab-applications
npx @google/clasp create --type sheets --title "LBS AI Lab Applications API" --parentId 18lPwCDSqAzJmeki2uEp_N15OAS9gqvbUXoDquWgo7Zk
npx @google/clasp push
npx @google/clasp open
```

In the opened Apps Script project:

1. Go to Project Settings.
2. Add Script Property `APPS_SCRIPT_TOKEN` with the generated token.
3. Deploy as a Web app.
4. Execute as: `Me`.
5. Who has access: `Anyone`.
6. Copy the Web app URL.

Then configure Cloudflare Worker secrets:

```sh
npx wrangler secret put APPS_SCRIPT_URL
npx wrangler secret put APPS_SCRIPT_TOKEN
```

Use the same token in Apps Script and Cloudflare. The Apps Script URL is not
called from the browser directly; it is only called by the Worker.

Static headers, redirects, robots, sitemap, and Open Graph metadata are included.

## Content

Primary content lives in:

- `src/content/teams/`
- `src/content/cohorts/`
- `src/data/people.json`
- `src/data/mentors.json`

Participant names and emails are rendered publicly on team pages for direct product inquiries.
