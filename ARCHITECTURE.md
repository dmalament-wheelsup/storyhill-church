# Storyhill Community Groups — Architecture & Onboarding

> **Read this first if you're new to the project.** It explains every moving
> part, which external accounts and services are involved, what secrets exist
> (and where), and how a change flows from a spreadsheet edit to a live page.
>
> Companion docs:
> - [`README.md`](./README.md) — quick "what is this / how do I run it" overview.
> - [`CLAUDE.md`](./CLAUDE.md) — code-level conventions and gotchas.
> - [`SHEET-SETUP.md`](./SHEET-SETUP.md) — staff guide for maintaining the Google Sheet.
> - [`worker/README.md`](./worker/README.md) — deploy/operate the email Worker.

---

## 1. What this is, in one paragraph

A **single self-contained `index.html`** (HTML + CSS + vanilla JS, no build
step, no framework, no dependencies) that lists Storyhill community groups. It
is hosted as a static file on **GitHub Pages** and **embedded as an `<iframe>`
in a Squarespace page**. There is **no application backend of our own** except
one tiny Cloudflare Worker whose only job is to send contact-form email. All
data, maps, and mail come from third-party services called directly from the
browser.

The design goal throughout: **as little infrastructure as possible.** Staff
edit a Google Sheet; everything else is static hosting and managed services.

---

## 2. System architecture

### 2.1 The big picture

```
                          ┌───────────────────────────────────────────┐
                          │                VISITOR'S BROWSER            │
                          │                                             │
  ┌────────────────┐      │   ┌─────────────────────────────────────┐  │
  │  Squarespace   │      │   │  Squarespace page (parent document) │  │
  │  (storyhill.org)│─────┼──▶│  www.storyhill.org/community-group… │  │
  │  hosts the     │ HTML │   │                                     │  │
  │  parent page   │      │   │   ┌───────────────────────────────┐ │  │
  └────────────────┘      │   │   │  <iframe> src = GitHub Pages  │ │  │
                          │   │   │                               │ │  │
                          │   │   │   index.html (our whole app)  │ │  │
                          │   │   │   card view · map · filters · │ │  │
                          │   │   │   contact form                │ │  │
                          │   │   └───────────────────────────────┘ │  │
                          │   │        ▲  postMessage (height,       │  │
                          │   │        │  scroll-lock, viewport)     │  │
                          │   └────────┼────────────────────────────┘  │
                          └────────────┼───────────────────────────────┘
                                       │
        the iframe's JS makes these calls directly from the browser:
                                       │
        ┌──────────────────┬──────────┴───────────┬────────────────────┐
        ▼                  ▼                      ▼                     ▼
┌───────────────┐  ┌───────────────┐   ┌────────────────────┐  ┌──────────────┐
│ Google Sheets │  │ Google Maps   │   │ Cloudflare Worker  │  │ (that Worker │
│ gviz JSON     │  │ JavaScript API│   │ storyhill-contact  │  │  then calls) │
│ (read groups) │  │ (map + pins)  │   │ (contact form POST)│  │   Resend     │
│               │  │               │   │                    │──▶│  (send mail) │
│ <script> tag  │  │ lazy-loaded   │   │ validates, allow-  │  │              │
│ sidesteps CORS│  │ on Map view   │   │ lists origin, adds │  │  ──▶ inbox   │
└───────────────┘  └───────────────┘   │ grow@ always-CC    │  └──────────────┘
        ▲                              └────────────────────┘
        │                                       ▲
   staff edit                            key kept server-side
   the sheet                             (never in the browser)
```

### 2.2 Request flow, step by step

**On page load:**
1. Squarespace serves the parent page. Its Code Block contains an `<iframe>`
   pointing at the GitHub Pages URL, plus a small listener script (see §6).
2. The browser loads `index.html` from **GitHub Pages** inside the iframe.
3. `index.html`'s JS injects a `<script>` tag at the **Google Sheets gviz**
   endpoint and reads the groups (no API key, no `fetch`, no CORS — see §4.1).
4. Cards render. The iframe measures its own height and `postMessage`s it to
   the Squarespace parent so the iframe auto-sizes (no nested scrollbars).

**When the visitor opens Map view:**
5. The **Google Maps JavaScript API** is lazy-loaded (only now, not on first
   paint) using the in-page browser API key, and pins are dropped from the
   sheet's coordinates.

**When the visitor submits the contact form:**
6. The iframe POSTs JSON to the **Cloudflare Worker**
   (`storyhill-contact.storyhillchurch.workers.dev`).
7. The Worker validates input, checks the request `Origin` against its
   allowlist, drops honeypot spam, adds `grow@storyhill.org` as an always-CC,
   and calls **Resend** to send the email.
8. Resend delivers to the group's leader(s) (from sheet column G) **plus**
   `grow@storyhill.org`. The visitor's address is the `reply_to`.

### 2.3 Why a Worker exists at all

The page is otherwise backend-free. The Worker exists for exactly one reason:
**per-group contact routing without leaking a mail API key to the browser.**
Column G of the sheet lists each group's leader email(s), and messages must go
to those addresses. The previous approach (FormSubmit) required each
destination address to click a confirmation link before it could receive mail —
unworkable when group leaders rotate. Moving the send server-side (Worker +
Resend) removes that friction and keeps the Resend API key off the client.

---

## 3. External services & accounts

**All accounts below are owned by `storyhillchurch@gmail.com`.** Use that login
to administer any of them.

| Service | Purpose | Account / owner | Console |
|---|---|---|---|
| **GitHub** | Source repo + GitHub Pages static hosting for `index.html` | repo: `dmalament-wheelsup/storyhill-church` | github.com |
| **Squarespace** | Hosts `storyhill.org`; embeds the page via an iframe Code Block | Storyhill's Squarespace account | squarespace.com |
| **Google Sheets** | The data source — one row per community group | `storyhillchurch@gmail.com` | sheets.google.com |
| **Google Maps Platform** | Maps JavaScript API for the map view | `storyhillchurch@gmail.com` (Google Cloud project) | console.cloud.google.com |
| **Cloudflare Workers** | Hosts the `storyhill-contact` mailer Worker | `storyhillchurch@gmail.com` | dash.cloudflare.com |
| **Resend** | Transactional email provider the Worker sends through | `storyhillchurch@gmail.com` | resend.com |

### Key IDs and URLs (non-secret)

| Thing | Value |
|---|---|
| GitHub repo | `github.com/dmalament-wheelsup/storyhill-church` |
| GitHub Pages host (iframe `src`) | `https://dmalament-wheelsup.github.io/storyhill-church/` |
| Google Sheet ID | `1TwdOUR_qHWvLOxoVM8W4FbL8i4gvgcMJ42HVjROxJkg` |
| Cloudflare Worker URL | `https://storyhill-contact.storyhillchurch.workers.dev` |
| Always-CC / office address | `grow@storyhill.org` |
| Mail "from" (verified in Resend) | `groups@storyhill.org` |
| Squarespace embed page | `www.storyhill.org/community-group…` |

> **DNS note:** `storyhill.org`'s domain/DNS is managed wherever the church's
> nameservers live (likely Squarespace or a registrar). Resend's sending-domain
> verification (SPF/DKIM records) was added there — see §5.

---

## 4. The three browser-side integrations (load-bearing)

### 4.1 Data — Google Sheets via gviz

- The sheet is read through its **gviz JSON endpoint**:
  `https://docs.google.com/spreadsheets/d/<SHEET_ID>/gviz/tq?tqx=out:json&headers=0`
- It is loaded by **injecting a `<script>` tag**, *not* `fetch()`. This is
  deliberate: the CSV endpoint doesn't reliably send CORS headers, and `fetch`
  from `file://` is blocked. A `<script>` tag sidesteps both. gviz calls back
  into `google.visualization.Query.setResponse`, which the code stubs to
  resolve a promise.
- **The sheet has NO header row.** Column meaning is **positional**:

  | Col | Meaning | Renders as |
  |---|---|---|
  | A | Group name | Card **title** (row dropped if blank) |
  | B | Meeting time (free text, e.g. "Thursday Evening") | Card meta + drives day/time filters |
  | C | Coordinates `lat, lng` | Map pin (optional) |
  | D | Location / town | Card **subtitle** (clickable → map if C present) |
  | E | Description | Card body |
  | F | Tags (comma-separated) | Filter chips |
  | G | Contact email(s) (comma/semicolon-separated) | **Not displayed** — used as contact-form recipients |

- If a header row is ever added, flip the URL from `headers=0` to `headers=1`
  (see `SHEET-SETUP.md`) so the header isn't rendered as a broken card.
- **The sheet must stay shared "Anyone with the link → Viewer."** If it's set
  to Restricted, the page goes blank.

### 4.2 Maps — Google Maps JavaScript API

- Lazy-loaded the first time Map view opens (not on page load), keeping initial
  load light.
- Uses the in-page **browser API key** (`CONFIG.GOOGLE_MAPS_API_KEY`). This key
  is *meant* to be public but must be **restricted by HTTP referrer** to the
  hosting domain(s) in the Google Cloud console, so it can't be abused
  elsewhere. See §7 on why an in-page key is not a "leaked secret."

### 4.3 Mail — Cloudflare Worker + Resend

- The contact form POSTs JSON to `CONFIG.CONTACT_ENDPOINT` (the Worker).
- The **Worker** (`worker/src/index.js`) enforces the security-relevant rules
  server-side so the page can't bypass them:
  - **Origin allowlist** (`ALLOWED_ORIGINS`) — only our hosts may POST; fails closed.
  - **Honeypot** — a hidden `_honey` field; if filled (bots), silently "succeed."
  - **Validation** — name/email/message required, emails re-validated, length capped.
  - **Always-CC** (`ALWAYS_TO`) — `grow@storyhill.org` is added to every message
    and is the sole recipient when a group's column G is empty.
  - Sends via **Resend** with the visitor as `reply_to`.

---

## 5. Secrets & configuration

**No secret values are stored in this document or in the repo.** This is the
inventory of *what* exists and *where* it lives.

### 5.1 Secrets (never committed, never in the browser)

| Secret | Where it lives | Set / rotate via |
|---|---|---|
| `RESEND_API_KEY` | Cloudflare Worker **secret** (encrypted, server-side only) | `cd worker && npx wrangler secret put RESEND_API_KEY` |

That is the **only** true secret in the system. It never appears in
`index.html`, the repo, or any client response — it lives only inside the
Worker's runtime. For local Worker development it goes in `worker/.dev.vars`
(git-ignored).

### 5.2 Worker configuration (non-secret, in `worker/wrangler.toml`)

| Var | Meaning | Current value |
|---|---|---|
| `MAIL_FROM` | Verified Resend sender | `Storyhill Groups <groups@storyhill.org>` |
| `ALLOWED_ORIGINS` | Origins allowed to POST (comma-sep, no trailing slash) | `https://www.storyhill.org,https://dmalament-wheelsup.github.io` |
| `ALWAYS_TO` | Address CC'd on every message; sole recipient if column G empty | `grow@storyhill.org` |

> **Origin note:** the request `Origin` the Worker sees comes from the **iframe's**
> host (GitHub Pages), not the Squarespace parent. Both are in the allowlist so
> curl tests (which spoof `storyhill.org`) and real submissions both pass.

### 5.3 In-page config (`CONFIG` block in `index.html`, ~line 667)

| Key | Meaning |
|---|---|
| `SHEET_ID` | Google Sheet to read (`1TwdOUR_…Jkg`) |
| `CONTACT_ENDPOINT` | Worker URL (`https://storyhill-contact.storyhillchurch.workers.dev`) |
| `CONTACT_EMAIL` | Shown in the fallback "email us directly" message (`grow@storyhill.org`) |
| `GOOGLE_MAPS_API_KEY` | Browser Maps key — **public by design**, restricted by referrer |
| `MAP_DEFAULT_CENTER` / `MAP_DEFAULT_ZOOM` | Initial map camera |

### 5.4 Resend setup (one-time, in the Resend dashboard)

- The **sending domain `storyhill.org` must be verified** in Resend (SPF/DKIM
  DNS records added at the church's DNS host). This is what lets the Worker
  send *from* `@storyhill.org` to any recipient without per-address
  confirmation. If mail suddenly stops, re-check the domain still shows
  **Verified** in Resend.

---

## 6. Iframe embedding (Squarespace ↔ GitHub Pages)

The page lives on GitHub Pages but is *seen* inside Squarespace via an iframe.
Two documents on two origins coordinate over a small `postMessage` protocol:

- **Height auto-sizing:** the iframe measures its **body** height and posts
  `storyhill:height` to the parent, which resizes the iframe so there are no
  nested scrollbars or trailing whitespace. (Measuring `document.body`, never
  `documentElement`, is critical — the latter reflects the parent-applied
  iframe height and would ratchet upward forever. See `CLAUDE.md`.)
- **Modal centering:** the parent posts its visible viewport band back
  (`storyhill:viewport`) so modals center on the visitor's screen, not the tall
  iframe.
- **Scroll lock:** opening a modal posts `storyhill:scroll-lock` so the
  Squarespace page behind it can't scroll.

All of it **no-ops when not embedded** (`window.parent === window`), so the page
still works standalone. The **matching parent-side snippet** (the iframe tag +
listener) lives in `README.md` and is pasted into a Squarespace **Code Block** —
if you change the message shapes, update both sides.

---

## 7. Security model & privacy

- **The Maps key in `index.html` is not a leaked secret.** Browser Maps keys
  are designed to be public; the protection is an **HTTP-referrer restriction**
  in Google Cloud tying the key to our domain(s). Keep that restriction in
  place. The *real* secret (`RESEND_API_KEY`) is server-side only.
- **Coordinates are intentionally approximate.** Column C holds hand-placed,
  privacy-preserving points (e.g. "north side of Davidson"), **not** real member
  addresses. Never put real home addresses on the public site.
- **Column G is technically public.** Because the sheet is publicly readable,
  addresses in column G are discoverable by anyone who finds the sheet, even
  though the page never displays them. Prefer forwarding aliases (e.g.
  `wanderers@storyhill.org`) over personal inboxes. See `SHEET-SETUP.md`.
- **Worker defenses:** origin allowlist (fails closed), honeypot, server-side
  validation, and the always-CC rule are all enforced in the Worker so a
  crafted client request can't bypass them.
- **All sheet-derived text is HTML-escaped** (`escapeHtml()`) before being
  interpolated into the DOM — preserve this when adding any field that renders
  sheet content.

---

## 8. Deploying changes

### 8.1 Change the page (`index.html`)

1. Edit `index.html` locally (open it in a browser to preview — note that
   loading from `file://` blocks the sheet fetch and most Maps key restrictions
   are domain-scoped, so realistic testing happens on the deployed host).
2. Commit and push to `main`.
3. **GitHub Pages redeploys automatically** (~1–2 min). Hard-refresh the
   Squarespace embed to see it.

### 8.2 Change the data (groups)

Just edit the **Google Sheet** — no deploy. The page reads it live on each load.
See `SHEET-SETUP.md` for the safe way to maintain it (dropdowns, protection,
column-format rules).

### 8.3 Change the Worker (`worker/`)

```sh
cd worker
# edit src/index.js and/or wrangler.toml [vars]
npx wrangler deploy            # redeploys code + vars
# secrets are separate and apply live without a redeploy:
npx wrangler secret put RESEND_API_KEY
```

- **`[vars]` in `wrangler.toml`** only take effect on `deploy`.
- **Secrets** (`wrangler secret put`) apply immediately, no redeploy needed.
- Confirm which Cloudflare account you're deploying to first:
  `npx wrangler whoami` (must be the `storyhillchurch@gmail.com` account).

### 8.4 Change the embed (Squarespace)

Edit the **Code Block** on the Squarespace page (iframe tag + listener). The
canonical snippet is in `README.md`. Keep its `postMessage` handling in sync
with the page's protocol.

---

## 9. Verifying end-to-end

**Worker/mail path (curl):**
```sh
curl -i -X POST https://storyhill-contact.storyhillchurch.workers.dev \
  -H 'Origin: https://www.storyhill.org' \
  -H 'Content-Type: application/json' \
  -d '{"recipients":["you@example.com"],"group":"Test","name":"Tester","email":"tester@example.com","message":"hello"}'
```
Expect `HTTP/2 200` + `{"success":true}` and an email arriving. A request with a
disallowed `Origin` should get `403`. **A 200 only proves Resend accepted it —
confirm the email actually lands** (that's the domain-verification proof).

**Full UI path:** submit the contact form from the **real Squarespace embed**
(not curl). This is the only test that proves the iframe's live origin is on the
Worker's allowlist — curl can't, because it spoofs the origin header.

---

## 10. Troubleshooting quick reference

| Symptom | Likely cause | Where to look |
|---|---|---|
| Page blank / "Could not load groups" | Sheet set to Restricted, or wrong `SHEET_ID` | Sheet sharing (§4.1); `CONFIG.SHEET_ID` |
| A group missing from day/time filters | Column B lacks a day word or clock time | `SHEET-SETUP.md` column-B format |
| A weird blank "header" card appears | Header row added but page still `headers=0` | Flip to `headers=1` (§4.1) |
| Map is blank / key error | Maps key referrer restriction doesn't include the host | Google Cloud console |
| Contact form fails in the browser (403) | Iframe's origin not in `ALLOWED_ORIGINS` | `worker/wrangler.toml`, then `wrangler deploy` |
| Form returns 502 / "delivery failed" | Resend domain not verified, or `MAIL_FROM` mismatch | Resend dashboard; `npx wrangler tail` |
| Nested scrollbars / whitespace in embed | Parent listener snippet missing/stale | Squarespace Code Block vs `README.md` |
| Mail stopped after working | `RESEND_API_KEY` rotated/expired, or domain un-verified | `wrangler secret list`; Resend dashboard |

---

## 11. Repository layout

```
storyhill-church/
├── index.html          # The entire app (HTML + CSS + JS). CONFIG at ~line 667.
├── ARCHITECTURE.md     # ← this file (start here)
├── README.md           # Quick overview + the Squarespace embed snippet
├── CLAUDE.md           # Code-level conventions & gotchas
├── SHEET-SETUP.md      # Staff guide for maintaining the Google Sheet
├── .gitignore
└── worker/             # Cloudflare Worker (contact-form mailer)
    ├── src/index.js    # Worker code: validate → allowlist → always-CC → Resend
    ├── wrangler.toml   # Non-secret vars (MAIL_FROM, ALLOWED_ORIGINS, ALWAYS_TO)
    ├── README.md       # Worker deploy/operate guide
    └── .dev.vars       # (git-ignored) local secrets for `wrangler dev`
```

---

## 12. Onboarding checklist for a new developer

1. Read this file top to bottom, then skim `CLAUDE.md`.
2. Get invited to the `storyhillchurch@gmail.com`-owned accounts you need:
   GitHub repo, Cloudflare, Resend, Google (Sheet + Cloud/Maps).
3. Clone the repo. Open `index.html` in a browser to see the shell (the sheet
   fetch won't work from `file://` — that's expected).
4. Install Wrangler (`npm i -g wrangler`), `wrangler login` **into the Storyhill
   Cloudflare account**, and `npx wrangler whoami` to confirm.
5. Run the curl test in §9 to see the mail path work.
6. Make a trivial page change, push to `main`, and watch GitHub Pages redeploy
   into the Squarespace embed.
7. When in doubt about data, edit the Google Sheet — it's live, no deploy.
