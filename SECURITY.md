# Security Policy

Security matters for this project because public repositories often connect to real users, provider APIs, deployment systems, or operational data.

## Reporting a Vulnerability

Please do not open a public GitHub issue for security problems.

If you find a vulnerability, contact the repository owner privately with:

- A short summary.
- Steps to reproduce.
- The affected route, API, package, or workflow.
- Screenshots or logs with secrets removed.
- The impact you believe it may have.

If you are unsure whether something is security-sensitive, report it privately first.

Zahra still needs to choose the private security contact. Do not put a personal email address in this repository as a guess. `public/.well-known/security.txt` is unchanged until that choice is made. The contact page is not a vulnerability inbox. `.github/ISSUE_TEMPLATE/config.yml` already links GitHub private vulnerability reporting, which is one option she can confirm. See [docs/review-followups-2026-09-23.md](docs/review-followups-2026-09-23.md).

## Report Privately

- Exposed API keys, OAuth secrets, database URLs, or tokens.
- Authentication or authorization bypasses.
- Cross-user data exposure.
- Prompt or tool behavior that leaks private data.
- Unsafe file, network, or database access.
- Admin route bypasses.
- Production data leaks.

## Secrets and Data

- Never commit env files, provider keys, tokens, database dumps, or production user data.
- Keep model provider keys and integration credentials outside client bundles.
- Avoid logging personal data, private content, or raw secrets.

## Supported Versions

Security fixes target the current default branch unless maintainers announce a release policy.
