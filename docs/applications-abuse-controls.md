# Application form abuse controls

`POST /api/applications` stores an opt-in Autumn interest submission in D1.
This document is the human setup for the code in `src/worker.ts` and
`src/pages/apply.astro`. Do not deploy this change until the Turnstile keys
below exist on the live Worker `ailab`.

The public list is still `GET /api/applications`. This change does not remove
email addresses from that response. That stays in draft pull request #6 until
a person reviews it, merges it, and deploys `ailab`.

## What the Worker does

Order for `POST /api/applications`:

1. Reject a `Content-Length` above 8192 bytes, then stop reading the body once
   8192 bytes have arrived. Missing or lying `Content-Length` headers do not
   bypass the cap. Response: `413` with
   `{"error":"Please submit the form again."}`.
2. Reject a body that is not a JSON object. Response: `400` with the same
   message.
3. If `website` is non-empty, return `202` with `{"ok":true}` and do not write.
   That field is the hidden honeypot. Browsers sometimes autofill a field named
   `website` even with `autocomplete="off"`, which would silently drop a real
   submission, so the input uses `autocomplete="nope"`. The `202` is kept so
   the existing SEO honeypot probe still passes. It is not a rate limit.
4. Ask the `APPLICATIONS_RATE_LIMITER` binding for this client IP. See the
   limits below. Response when the local counter is exhausted: `429` with
   `Retry-After: 60` and
   `{"error":"Too many submissions from this network. Please wait a minute and try again."}`.
5. Validate name, `@london.edu` email, course, idea, and consent. Response:
   `400` with the existing field message. Invalid forms do not call Turnstile.
6. Verify `cf-turnstile-response` with Cloudflare Siteverify. Missing, forged,
   expired, or reused tokens get `403` with
   `{"error":"Please complete the security check and try again."}`.
   If the secret is missing or Siteverify cannot be reached, the Worker
   refuses the write with `503` and
   `{"error":"Applications are temporarily unavailable. Please try again."}`.
7. Insert the row. Success is `201`.

`GET /api/turnstile` returns the public site key as `{"siteKey":"..."}` so the
apply page can render the widget. If the site key is missing, that GET is
`503` and the form tells the visitor that applications are unavailable.

The apply page loads `https://challenges.cloudflare.com/turnstile/v0/api.js`
and renders the widget explicitly. The Worker CSP allows that host in
`script-src`, `connect-src`, and `frame-src`.

## Rate limit binding is not global

`wrangler.jsonc` defines:

| Setting        | Value                                                              |
| -------------- | ------------------------------------------------------------------ |
| Binding name   | `APPLICATIONS_RATE_LIMITER`                                        |
| `namespace_id` | `81024023`                                                         |
| Limit          | 30 calls                                                           |
| Period         | 60 seconds                                                         |
| Key            | `applications:` plus `CF-Connecting-IP`, or `applications:unknown` |

This is the [Workers Rate Limiting binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/).
Isolates in the same Cloudflare location share the counter. It is not an
in-memory `Map`, and it is not a worldwide counter. Cloudflare keeps a
separate counter per location. An attacker who spreads requests across
locations gets a fresh budget in each one. The same is true of the dashboard
rule below: `cf.colo.id` is added automatically, and standard plans have no
global rate-limit counter.

Do not add a module-level counter and treat it as protection. Use the binding
plus the dashboard rule.

Campus and mobile networks share one IP. The key is the client IP because the
form has no account id. Thirty writes a minute per IP per location is a flood
backstop, not a per-student quota. Turnstile is what stops scripted submits
that stay under that number.

`namespace_id` must be unique on the Cloudflare account unless two Workers
should share one counter. If deploy reports that `81024023` is already in
use, pick a new positive integer in `wrangler.jsonc` and do not reuse some
other Worker’s namespace.

The binding does not run in `astro dev`. It is active in `wrangler dev` and
after a real deploy of this config.

## Turnstile keys, before any deploy

1. In the Cloudflare dashboard, open the account in `wrangler.jsonc`
   (`account_id` `7734f000a1b41206ff95d798c7b5da80`).
2. Go to **Turnstile** → **Add widget**.
3. Widget name: `LBS AI Lab applications`.
4. Widget mode: **Managed**.
5. Hostnames: `lbsailab.com` and `www.lbsailab.com`. Add
   `ailab.zahra-moghadasi.workers.dev` only if that URL should accept
   submissions. Do not add `lbsailab.zahra-moghadasi.workers.dev`.
6. Create the widget and copy the site key and the secret key.
7. From this repository, run `npx wrangler whoami` and confirm the account
   is the one in `wrangler.jsonc`. `npx wrangler secret put` writes to the
   Worker named in that file. The name must be `ailab`. Do not run it from a
   checkout whose name is `lbsailab`.
8. Store both keys as secrets on `ailab`:

   ```sh
   npx wrangler secret put TURNSTILE_SITE_KEY
   npx wrangler secret put TURNSTILE_SECRET_KEY
   ```

   Paste the site key at the first prompt and the secret key at the second.
   Do not commit either value. Do not use the test keys in
   `.dev.vars.example`.

Until both secrets are present, a deploy of this code fail-closes real
submissions (`503` on the widget config, `403` or `503` on POST). Setting the
secrets later takes effect on the next request. You do not need another code
deploy just to attach the keys, but you should set them before the intentional
deploy so the form does not go offline.

## Dashboard rate limiting rule

Add this on the zone `lbsailab.com`, not as a second in-Worker counter.
Dashboard path: **Security** → **Security rules** → **Create rule** →
**Rate limiting rules**.

The expression fields you are allowed to use depend on the zone plan. Save
the variant that the dashboard actually accepts.

### Free

Expression fields are Path and Verified Bot only. Counting period and block
duration are 10 seconds. Characteristic is IP only. One rule is allowed.

- Rule name: `Limit application API`
- Match expression: `http.request.uri.path eq "/api/applications"`
- Characteristic: **IP**
- Requests: `20`
- Period: `10 seconds`
- Action: **Block**
- Duration: `10 seconds`

This also counts `GET /api/applications` (the public board). Twenty requests
in ten seconds is still above a person refreshing the page. It will not stop
a flood that stays under 20 requests per 10 seconds per IP per data center.

### Pro

Host and URI are available. Method is not. Characteristic is still IP.
Period can be one minute.

- Rule name: `Limit application API`
- Match expression: `(http.host in {"lbsailab.com" "www.lbsailab.com"} and http.request.uri.path eq "/api/applications")`
- Characteristic: **IP**
- Requests: `60`
- Period: `1 minute`
- Action: **Block**
- Duration: `1 minute`

GET and POST both count. Sixty a minute per IP per data center covers the
board load plus a submission without blocking a normal visit.

### Business and above

Method is available, and **IP with NAT support** (`cf.unique_visitor_id`) is
the right characteristic for a shared campus network.

- Rule name: `Limit application submissions`
- Match expression:

  ```txt
  (http.host in {"lbsailab.com" "www.lbsailab.com"} and http.request.uri.path eq "/api/applications" and http.request.method eq "POST")
  ```

- Characteristic: **IP with NAT support**
- Requests: `30`
- Period: `1 minute`
- Action: **Block**
- Duration: `1 minute`

If the Block action offers a custom response, set status `429`, content type
`application/json`, and body:

```json
{
  "error": "Too many submissions from this network. Please wait a minute and try again."
}
```

If the plan does not offer a custom body, the edge block is Cloudflare’s
default error page. The Worker’s own `429` is the one the form can read when
the request reaches the Worker.

Do not add `cf.colo.id` yourself in the dashboard. Cloudflare adds it. Do not
expect this rule to be a global budget.

## Local check

```sh
cp .dev.vars.example .dev.vars
npm run db:migrate:local
npm run build
npx wrangler dev
```

Open the local apply page, confirm the widget renders, and submit once.
`.dev.vars` is gitignored. The example file uses Cloudflare’s published
always-pass test keys, which Siteverify answers with hostname `example.com`.
The Worker accepts that hostname only when the request host is local.

## Deploy

A person deploys `ailab` after the secrets and the dashboard rule are in
place:

```sh
npm run build
npx wrangler deploy
```

Do not `wrangler deploy` from an agent checkout, and do not let Workers Builds
deploy the pull request branch. If a build starts for that branch, cancel it.
An accidental deploy fail-closes the form until the Turnstile secrets exist,
and it attaches the rate-limit binding.
