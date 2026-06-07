# LBS AI Lab

Static Astro website for LBS AI Lab, where London Business School participants learn to build AI products for LBS workflows and iterate from feedback.

Live: [https://lbsailab.com](https://lbsailab.com)

## Mission

LBS AI Lab was created to help the LBS student community get more involved in AI solution development at the School. The site presents the Lab, its batch model, Spring 2026 Batch teams, mentors, and the Autumn 2026 application flow.

## What This Repository Contains

Static Astro site for the London Business School AI Lab and Data Science & AI Initiative, including batch pages, team profiles, mentors, application flows, and a Cloudflare Worker-backed public submissions board.

## Highlights

- Batch, team, mentor, application, contact, and about pages
- Spring 2026 Batch presentation with Google DeepMind partnership assets
- Secure application form endpoint writing public opt-in submissions to Markdown
- Static headers, redirects, robots, sitemap, and Open Graph metadata

## Tech Stack

- Astro 6 with TypeScript
- Astro Content Collections
- Fontsource local fonts
- Cloudflare Workers
- GitHub Contents API for opt-in application submissions

## Getting Started

```bash
npm install
npm run dev
```

## Quality Checks

```bash
npm run check
npm run build
```

## Deployment

Build the static site, then deploy the existing Worker:

```bash
npm run build
wrangler deploy
```

Worker deployments need a repository-scoped `GITHUB_TOKEN` secret for public submissions.

```sh
npx wrangler secret put GITHUB_TOKEN
```

A fine-grained GitHub token is enough. Scope it to this repository and grant `Contents: Read and write`. The Worker uses GitHub's Contents API to update the Markdown file on `main`.

Optional Worker variables:

```sh
npx wrangler secret put GITHUB_REPO
npx wrangler secret put GITHUB_BRANCH
npx wrangler secret put GITHUB_SUBMISSIONS_PATH
```

Defaults are `makriman/LBSAILAB`, `main`, and `data/application-submissions.md`.

## Content

Primary content lives in:

- `src/content/teams/`
- `src/content/batches/`
- `src/data/people.json`
- `src/data/mentors.json`

Participant names and emails are rendered publicly on team pages for direct product inquiries.

## Contributing

Contributions are welcome. The best contributions are specific, tested, and grounded in the product mission. Good places to help include documentation, accessibility, tests, bug reports, UI polish, data validation, and safer AI behavior.

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

## Security

Please do not open public issues for secrets, auth bypasses, data exposure, provider key leaks, or abuse vectors. Follow [SECURITY.md](SECURITY.md).

## Code of Conduct

This project follows [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md). Be direct, kind, and useful.

## License

MIT. See [LICENSE](LICENSE).
