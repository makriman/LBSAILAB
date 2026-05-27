# LBS AI Lab

A content-driven Astro website for London Business School students building AI products with real users.

Live: [https://lbsailab.com](https://lbsailab.com)

## Mission

LBS AI Lab exists to teach the loop after the prototype: choosing real user problems, shipping quickly, testing with students and alumni, and improving from feedback. The site turns that mission into a fast public home for cohorts, teams, mentors, and applications.

## What This Repository Contains

Static Astro site for the London Business School AI Lab and Data Science & AI Initiative, including cohort pages, team profiles, mentors, application flows, and a Cloudflare Worker-backed public submissions board.

## Highlights

- Cohort, team, mentor, application, contact, and about pages.
- Cohort 01 presentation with Google DeepMind partnership assets.
- Secure application form endpoint writing public opt-in submissions to Markdown.
- Static headers, redirects, robots, sitemap, and Open Graph metadata.

## Tech Stack

- Astro 6 with TypeScript
- Astro Content Collections
- Fontsource local fonts
- Cloudflare Pages / Workers
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

## Repository Notes

- Worker deployments need a repository-scoped GITHUB_TOKEN secret for public submissions.
- Application submissions are public only when the applicant opts in.

## Contributing

Contributions are welcome. The best contributions are specific, tested, and grounded in the product mission. Good places to help include documentation, accessibility, tests, bug reports, UI polish, data validation, and safer AI behavior.

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

## Security

Please do not open public issues for secrets, auth bypasses, data exposure, provider key leaks, or abuse vectors. Follow [SECURITY.md](SECURITY.md).

## Code of Conduct

This project follows [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md). Be direct, kind, and useful.

## License

MIT. See [LICENSE](LICENSE).
