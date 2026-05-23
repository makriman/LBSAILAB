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
Google directly. Cloudflare Worker secrets hold the Google credentials, and the
Worker writes to / reads from a Google Sheet.

Create a Google Sheet with a tab named `Submissions` and this header row:

```text
submitted_at | name | email | course | idea | public_consent | source
```

Required Worker environment values:

```sh
npx wrangler secret put GOOGLE_SHEET_ID
npx wrangler secret put GOOGLE_SERVICE_ACCOUNT_EMAIL
npx wrangler secret put GOOGLE_PRIVATE_KEY
```

Optional:

```sh
npx wrangler secret put GOOGLE_SHEET_NAME
```

To get the values:

1. Create or choose a Google Cloud project.
2. Enable the Google Sheets API.
3. Create a service account.
4. Create a JSON key for that service account.
5. Copy `client_email` into `GOOGLE_SERVICE_ACCOUNT_EMAIL`.
6. Copy `private_key` into `GOOGLE_PRIVATE_KEY`.
7. Copy the spreadsheet ID from the sheet URL into `GOOGLE_SHEET_ID`.
8. Share the Google Sheet with the service account `client_email` as Editor.

Static headers, redirects, robots, sitemap, and Open Graph metadata are included.

## Content

Primary content lives in:

- `src/content/teams/`
- `src/content/cohorts/`
- `src/data/people.json`
- `src/data/mentors.json`

Participant names and emails are rendered publicly on team pages for direct product inquiries.
