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

## Application Form / GitHub Markdown

The Apply page submits to `/api/applications`. The Cloudflare Worker writes each
public opt-in submission to a Markdown file in this open GitHub repo, then reads
the same file back for the public submissions board.

The submissions file is:

```text
data/application-submissions.md
```

Required Worker secret:

```sh
npx wrangler secret put GITHUB_TOKEN
```

A fine-grained GitHub token is enough. Scope it to this repository and grant
`Contents: Read and write`. The Worker uses GitHub's Contents API to update the
Markdown file on `main`.

Optional Worker variables:

```sh
npx wrangler secret put GITHUB_REPO
npx wrangler secret put GITHUB_BRANCH
npx wrangler secret put GITHUB_SUBMISSIONS_PATH
```

Defaults are `makriman/LBSAILAB`, `main`, and
`data/application-submissions.md`.

Static headers, redirects, robots, sitemap, and Open Graph metadata are included.

## Content

Primary content lives in:

- `src/content/teams/`
- `src/content/cohorts/`
- `src/data/people.json`
- `src/data/mentors.json`

Participant names and emails are rendered publicly on team pages for direct product inquiries.
