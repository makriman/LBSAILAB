# LBS AI Lab

Static Astro website for LBS AI Lab, the AI venture lab for future operators and founders at London Business School.

The site is built as a fast, content-driven institutional platform for the Data Science & AI Initiative, with cohort, team, mentor, and application pages generated from Astro Content Collections.

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

## Cloudflare Pages

Use these deployment settings:

- Build command: `npm run build`
- Build output directory: `dist`
- Node version: `20` or `22`

Static headers, redirects, robots, sitemap, and Open Graph metadata are included.

## Content

Primary content lives in:

- `src/content/teams/`
- `src/content/cohorts/`
- `src/data/people.json`
- `src/data/mentors.json`

Participant emails are stored in source content for internal use, but public rendering is disabled unless `showEmailPublicly` is explicitly set to `true`.
