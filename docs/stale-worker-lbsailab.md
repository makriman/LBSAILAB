# Stale Worker teardown: `lbsailab`

Runbook for Zahra. This file is instructions only. Do not run `wrangler delete`,
do not click **Delete** from an agent session, and do not change the live
Worker `ailab` while following it.

## Which Worker is which

| Worker name | Host                                                                                                | Action                                        |
| ----------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| `ailab`     | `https://lbsailab.com`, `https://www.lbsailab.com`, and `https://ailab.zahra-moghadasi.workers.dev` | Keep. This is the Worker in `wrangler.jsonc`. |
| `lbsailab`  | `https://lbsailab.zahra-moghadasi.workers.dev`                                                      | Disable, then delete, after the checks below. |

`wrangler.jsonc` has `"name": "ailab"` and `account_id`
`7734f000a1b41206ff95d798c7b5da80`. The workers.dev subdomain is
`zahra-moghadasi`.

`npx wrangler delete` in this repository deletes `ailab`, the live site.
Do not run it. Delete `lbsailab` from the dashboard only, after the name on
the screen is exactly `lbsailab`.

## 1. Confirm you are looking at the stale Worker

1. Log in to the Cloudflare account that owns `lbsailab.com`
   (`7734f000a1b41206ff95d798c7b5da80`).
2. Open **Workers & Pages**.
3. You should see both `ailab` and `lbsailab`. Open `lbsailab` only.
4. Confirm the workers.dev route shown for that Worker is
   `lbsailab.zahra-moghadasi.workers.dev`.
5. From your own machine, request
   `https://lbsailab.zahra-moghadasi.workers.dev/api/applications`.
   The stale Worker is the old GitHub Contents handler. Expect an empty
   application list and a GitHub API error, not the current D1 board.
6. Request `https://ailab.zahra-moghadasi.workers.dev/api/applications` and
   `https://lbsailab.com/api/applications`. Those are the live Worker. Leave
   them alone.

If the host you are about to delete serves the current site, stop.

## 2. Remove `GITHUB_TOKEN`, then delete the Worker

On Worker `lbsailab` (not `ailab`):

1. Open **Settings** → **Variables and Secrets** (or **Bindings**).
2. If `GITHUB_TOKEN` is listed, delete that binding. Do not copy the value
   into `ailab`, into git, or into a chat.
3. Check for any other secret that existed only for the GitHub Contents
   handler. Remove those from `lbsailab` as well. Leave D1 and the custom
   domains on `ailab`.
4. Return to the Worker overview and delete Worker `lbsailab`. In the current
   dashboard that is **Settings** → **Delete** (or the Worker menu →
   **Delete**). The confirmation must show the name `lbsailab`.
5. After it is gone, request
   `https://lbsailab.zahra-moghadasi.workers.dev/api/applications` again.
   It should no longer return the old handler. A deleted workers.dev host
   fails DNS or returns a Cloudflare “worker not found” response. It must
   not be the live site.

Deleting the Worker removes the binding from Cloudflare. It does not revoke
the token at GitHub. Do step 3 even if you already deleted the Worker and
can no longer see the binding.

## 3. Revoke the GitHub token

The live Worker stores submissions in D1. It does not need a GitHub token.
Do not create a replacement `GITHUB_TOKEN` on `ailab`.

1. GitHub → **Settings** → **Developer settings** → **Personal access tokens**.
   Check both fine-grained and classic tokens.
2. Revoke the token that was placed in the `lbsailab` Worker. If you cannot
   tell which one it was, revoke every token whose only job was that Worker’s
   GitHub Contents API. Sign out other sessions that used it.
3. Repo **Settings** → **Secrets and variables** → **Actions**. If a person
   added a secret named `GITHUB_TOKEN`, delete that secret after the token is
   revoked. The automatic Actions token is not a secret you can delete; leave
   it.
4. If a token value was ever committed, pasted into an issue, or stored in a
   log, treat it as exposed and revoke it even after the binding is gone.
   Do not paste the token into a new issue to confirm.

## 4. Point duplicate-origin checks away from the dead host

Do this only after step 2 shows the stale host is gone. While that host is
still up, these checks are what notice it is still serving pages.

Three copies currently default to
`https://lbsailab.zahra-moghadasi.workers.dev`:

- `.github/workflows/seo.yml`, environment variable `SEO_DUPLICATE_ORIGINS`
- the fallback in `scripts/monitor-seo.mjs`
- the fallback in `scripts/audit-live-seo.mjs`

`ailab` still has `workers_dev` enabled, so the host that should keep
redirecting to `https://lbsailab.com` is
`https://ailab.zahra-moghadasi.workers.dev`. Change all three copies to that
URL in one commit.

Do not set the workflow variable to an empty string and leave the script
fallbacks in place. An empty variable is falsy, and both scripts then use
the hardcoded stale host again.

If you later turn `workers_dev` off for `ailab`, set both script fallbacks
to `""` and remove `SEO_DUPLICATE_ORIGINS` from the workflow in that same
commit. The duplicate check then has nothing to probe.

The SEO GitHub Action is disabled for inactivity. Do not re-enable it as
part of this teardown. Draft pull request #6 adds a live check that fails
while production `GET /api/applications` still returns email. Re-enable the
workflow only after #6 is reviewed, merged, and `ailab` is deployed by a
person, and after this origin change is on `main`.

## 5. Do not merge pull requests #1, #3, or #4

Close them without merging. They were opened against older
`wrangler.jsonc` files and conflict with the live Worker name.

- **#1** (`cloudflare/workers-autoconfig`) adds an early Workers autoconfig,
  including a `wrangler.jsonc` whose name is `lbs-ai-lab`. Merging it
  overwrites the current `ailab` config (D1, routes, observability) and can
  change the build and deploy commands Cloudflare uses.
- **#3** (`update_worker_name_to_lbsailab`) renames the Worker to `lbsailab`.
  That is the stale Worker. `main` is already `ailab`. Merging #3 points this
  repo back at the Worker you just deleted, or recreates that name on the
  next deploy.
- **#4** (`update_worker_name_to_ailab`) renames `lbsailab` to `ailab` on top
  of an old config that does not contain today’s D1 binding, custom domains,
  or observability. The live name is already `ailab` on `main`. Merging #4
  drops that config or conflicts with it.

Closing them does not delete a Worker. Deletion is step 2, in the dashboard,
on `lbsailab` only.
