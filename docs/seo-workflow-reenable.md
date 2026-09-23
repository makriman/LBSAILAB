# Re-enable the SEO workflow

The SEO GitHub Action is off because of inactivity. Re-enabling it is a GitHub setting. Do not edit `.github/workflows/seo.yml` to “turn it on,” and do not enable it from an agent session.

Checked 2026-09-23:

- Workflow `SEO` (id `296611786`, path `.github/workflows/seo.yml`) is `disabled_inactivity`.
- The last run is schedule [31929567550](https://github.com/makriman/LBSAILAB/actions/runs/31929567550) on 2026-08-16, commit `5ef5a25`.
- `gh run list --commit fe2ea71` is empty. The D1 submissions commit was not built or audited by Actions.
- A `disabled_inactivity` workflow does not start again on the next push.

## Steps for a person with Actions admin

1. Open the repository on GitHub, then Actions, then the SEO workflow.
2. Choose **Enable workflow**. That is the inactivity switch. It is not a line in the YAML.
3. Run the workflow once with **Run workflow** (`workflow_dispatch`) on `main`, after the commits you want audited are on `main`.
4. Confirm a later push to `main` starts the workflow on its own. Pull requests only run `npm run seo:ci`. Push to `main` also runs `npm run seo:live` and `npm run seo:perf`. The schedule and manual runs also run `npm run seo:production` and IndexNow.

Enabling the workflow builds and audits. It does not deploy the Worker and it does not migrate D1.

## Known failure from the last red schedule

Schedule run [31463669616](https://github.com/makriman/LBSAILAB/actions/runs/31463669616) on 2026-08-11 failed in the production SEO suite:

`https://www.london.edu/about/london-business-school/policies-and-legislation/website-privacy-policy` returned HTTP 599.

That URL is the Privacy link in `src/components/layout/Footer.astro`, built from `LBS_URL` in `src/utils/site.ts`. The path in this repo is the one the footer already publishes. The 599 came from the external host. The same check can fail again after the workflow is enabled. Do not delete the external-link gate in the same change as the re-enable unless a person decides HTTP 599 should be ignored.

## Still founder-gated, and not changed here

- `SEO_DUPLICATE_ORIGINS` in `.github/workflows/seo.yml` is still `https://lbsailab.zahra-moghadasi.workers.dev`. That is the stale Worker. Draft #7 documents teardown. Change the origin after that Worker is gone, not in this pull request.
- Live and production jobs read `BING_SITE_VERIFICATION_TOKEN`, `GOOGLE_SITE_VERIFICATION_FILE`, `CRUX_API_KEY`, and `PAGESPEED_API_KEY`. A missing secret fails the step that needs it.
- Do not merge pull requests #1, #3, or #4 as part of turning the workflow back on.
