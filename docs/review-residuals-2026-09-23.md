# Review residuals — 2026-09-23

Low and remaining medium items from `docs/CODE_REVIEW_2026-09-23.md` on draft #5, after drafts #6, #7, and #8. This branch starts from `main` at `fe2ea71`. It does not merge or reimplement those drafts, and it does not deploy.

## Landed here

- Astro 7.3.4, `@astrojs/sitemap` 3.7.4, and `@astrojs/check` 0.9.10. `npm run check`, `npm run build`, `npm run seo:audit` (17 pages), and `npm run seo:integrity` passed with Astro 7's default `compressHTML`. The critical AVIF advisory below Astro 7.2.8 is no longer in `npm audit`. `npm audit fix` (without `--force`) cleared the in-range advisories that remained after that bump. Direct `js-yaml` is still declared as `^4.2.0`; the lock resolved 4.3.2 because Astro 7 depends on that range.
- The public last-updated date lives in `src/site-revision.mjs`. Pages, the sitemap finalizer, the Worker `Last-Modified` header, and both SEO audits import it. `public/_headers` is rendered from that pin. The Worker still returns 410 for `/_headers`, and the file still does not set CSP or HSTS.
- `/apply/` no longer says the team will follow up when applications open. The form already stores a submission on the public board. The Autumn 2026 “opens in September 2026” line is unchanged.
- `npm run test:applications` covers `validateSubmission` and the existing `website` honeypot check. Body-byte counting and the `lbs_hp` field rename stay in draft #8.

## Still a person

- Zahra chooses the security contact. Steps are in [security-contact-decision.md](security-contact-decision.md). `security.txt` is unchanged. No email address was added.
- A person re-enables the SEO workflow in the GitHub UI. Steps are in [seo-workflow-reenable.md](seo-workflow-reenable.md). The workflow file was not enabled from here.
- `sharp` 0.35.4 is the only remaining `npm audit` finding (high). The measurement and the reason the images were not rewritten are in [sharp-upgrade-decision.md](sharp-upgrade-decision.md).
- Draft #6 still owns removing applicant emails from `GET /api/applications`. Draft #7 still owns Turnstile, the rate-limit binding, and deleting Worker `lbsailab`. Draft #8 still owns the body-byte cap, the `lbs_hp` honeypot, migration `0003`, and the Astro 6.4.8 lock on its own branch. This pull request does not replace those.
- HSTS stays without `includeSubDomains`. Product hosts such as `briefd.lbsailab.com` are not routes on this Worker. Adding the flag would cover hosts this repo does not serve.
- Do not merge #1, #3, or #4.

`npm run build` also rewrote hero AVIF/JPEG bytes and Open Graph PNGs in this environment. Those files were restored and are not part of this change.
