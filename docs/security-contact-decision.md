# Security contact decision

Zahra chooses the private vulnerability contact. This note does not add an email address, and it does not change `public/.well-known/security.txt`.

## What is true today

`SECURITY.md` tells people to contact the repository owner privately and not to open a public issue.

`.github/ISSUE_TEMPLATE/config.yml` already links GitHub private vulnerability reporting:

`https://github.com/makriman/LBSAILAB/security/advisories/new`

`public/.well-known/security.txt` sets both `Contact` and `Policy` to `https://lbsailab.com/contact/`. `Expires` is `2027-06-16T00:00:00.000Z`.

`src/pages/contact.astro` does not collect a vulnerability report. It points at the Data Science & AI Initiative site and says a dedicated AI Lab inbox is not set up.

The mentor `mailto:` in `src/utils/site.ts` is for mentoring interest. It is not a security inbox. Do not copy it into `security.txt`.

`scripts/audit-seo.mjs` (`auditSecurityTxt`) requires the contact-page URL in `security.txt` and fails the build audit if the file contains `mailto:` or an `@london.edu` address. `scripts/audit-live-seo.mjs` checks the same contact-page URL on the live file. A later edit has to update those audits in the same change.

## Decision

Pick one. Do not invent an address in the repository before this choice.

1. **Mailbox.** Zahra names the mailbox. A later change sets `Contact` to that `mailto:` and points `Policy` at `SECURITY.md` or another page she names. Update `auditSecurityTxt` and the live SEO check so they allow that contact and still reject every other address.
2. **GitHub private advisories only.** Leave email out of the repo. A later change sets `Contact` to `https://github.com/makriman/LBSAILAB/security/advisories/new`. Update the same audits, which currently require the contact-page URL.

Until one of those lands, leave `security.txt` pointed at the contact page. The contact page is not a vulnerability inbox, and a guessed personal address would be worse.

## After the choice

1. Edit `public/.well-known/security.txt` and the two SEO audits together.
2. Keep `Expires` in the future. It is independent of the site last-updated pin in `src/site-revision.mjs`.
3. Do not deploy from the pull request that only updates the file. A person publishes the Worker when they are ready for the new contact to be live.
