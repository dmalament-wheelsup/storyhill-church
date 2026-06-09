# Contact-form mailer (Cloudflare Worker)

This Worker receives contact-form submissions from the community-groups page
and sends them as email via [Resend](https://resend.com). It exists so the
email API key never ships to the browser, and so messages can go to each
group's own recipients (column G of the sheet) without the per-address
confirmation step the old FormSubmit setup required.

```
Browser (index.html)  ──POST JSON──▶  Worker  ──▶  Resend  ──▶  group's email(s)
```

## One-time setup

You already have a Cloudflare account, so this is just: install the CLI, set a
Resend key, and deploy.

### 1. Resend: get an API key and verify your sending domain

1. Create a [Resend](https://resend.com) account.
2. **Domains → Add Domain** → enter `storyhill.org` and add the DNS records it
   gives you (SPF/DKIM) at your DNS host. Wait for it to show **Verified**.
   - This is what lets you send *from* `@storyhill.org` to *any* recipient with
     no per-address confirmation.
3. **API Keys → Create API Key** (sending permission). Copy it — you'll paste it
   in step 4.

> Can't verify the domain yet? For testing only, Resend lets you send from
> `onboarding@resend.dev` to your own verified email. Set `MAIL_FROM` to that
> temporarily, but switch to your domain before go-live.

### 2. Install Wrangler and log in

```sh
npm install -g wrangler
wrangler login
```

### 3. Configure `wrangler.toml`

Edit the `[vars]` in `wrangler.toml`:

- `MAIL_FROM` — the verified sender, e.g. `Storyhill Groups <groups@storyhill.org>`
- `ALLOWED_ORIGINS` — the sites allowed to call the Worker. Keep both your
  Squarespace site and the GitHub Pages host, comma-separated, **no trailing
  slash**.
- `ALWAYS_TO` — copied on **every** message in addition to the group's
  column-G recipients, and the sole recipient when a group lists none. Defaults
  to `grow@storyhill.org`, so the office is always in the loop.

### 4. Add the Resend key as a secret and deploy

```sh
cd worker
wrangler secret put RESEND_API_KEY      # paste the key from step 1
wrangler deploy
```

Wrangler prints the Worker URL, e.g. `https://storyhill-contact.<you>.workers.dev`.

### 5. Point the page at the Worker

In `index.html`, set `CONFIG.CONTACT_ENDPOINT` to that URL, commit, and push.
(GitHub Pages redeploys automatically.)

## Test it

```sh
curl -i -X POST https://storyhill-contact.<you>.workers.dev \
  -H 'Origin: https://www.storyhill.org' \
  -H 'Content-Type: application/json' \
  -d '{"recipients":["you@example.com"],"group":"Test","name":"Tester","email":"tester@example.com","message":"hello"}'
```

Expect `{"success":true}` and an email at the recipient. A request with a
different `Origin` should get `403`.

## How it protects itself

- **Origin allowlist** — only `ALLOWED_ORIGINS` may POST; others get 403, and
  CORS headers are only returned to allowed origins.
- **Honeypot** — submissions with the hidden `_honey` field filled are silently
  dropped (bots fill it; humans never see it).
- **Validation** — name/email/message required, recipient emails are
  re-validated server-side, message length capped, recipients de-duped and
  capped.
- The visitor's address is set as `reply_to`, so leaders just hit Reply.

If spam ever becomes a problem, add [Cloudflare Turnstile](https://developers.cloudflare.com/turnstile/)
(free) — a token field on the form, verified in the Worker.

## Local dev

```sh
cd worker
wrangler dev        # runs the Worker locally; set secrets via `.dev.vars`
```

Create `worker/.dev.vars` (git-ignored) for local secrets:

```
RESEND_API_KEY=your-key
```
