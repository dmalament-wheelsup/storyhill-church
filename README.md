# Storyhill Community Groups Page

A single-file static page (`index.html`) that lists Storyhill community groups from a Google Sheet, with card view, map view, tag filtering, and a contact form. Designed to be embedded in Squarespace via an iframe.

> **New to the project?** Start with [`ARCHITECTURE.md`](./ARCHITECTURE.md) — it
> covers every service, account, and secret, with diagrams. This README is the
> quick overview + the Squarespace embed snippet.

## How it works

- Reads the Google Sheet directly using its public gviz endpoint (`gviz/tq?tqx=out:json&headers=0`), loaded via a `<script>` tag to sidestep CORS. No API key, no backend. The sheet must remain set to "Anyone with the link can view".
- The sheet has **no header row** — data starts at row 1. Columns: A=name (card title), B=time, C=coordinates, D=location (card subtitle), E=description, F=tags, G=contact email(s). Column B is free text (e.g. "Tuesday mornings", "Wed 9:30 AM") and also drives the time-of-day / day-of-week filters. Column G is a comma/semicolon-separated list of the group's leader email(s) and is **not displayed** — it's used only as the contact-form recipients.
- Contact-form submissions POST to a small **Cloudflare Worker** (`worker/`) that validates them and sends the email via [Resend](https://resend.com). This keeps the mail API key server-side and lets each group route to its own recipients (column G). `grow@storyhill.org` is always copied. See [`worker/README.md`](./worker/README.md).
- The map uses the Google Maps JavaScript API and requires a browser API key (public by design, restricted by HTTP referrer to the hosting domain).

## Setup

> This project is **already set up and live** (see `ARCHITECTURE.md` §3 for the
> deployed URLs/accounts). The steps below are how it was wired and how to
> reproduce it — you don't need to redo them for routine changes.

### 1. Google Maps API key

1. Go to https://console.cloud.google.com/google/maps-apis/credentials (Google Cloud project under `storyhillchurch@gmail.com`).
2. Create a new API key.
3. Restrict it: under **Application restrictions** choose "HTTP referrers" and add the hosting domains (`storyhill.org/*`, `dmalament-wheelsup.github.io/*`). Under **API restrictions** restrict to "Maps JavaScript API".
4. Set it as `GOOGLE_MAPS_API_KEY` in the `CONFIG` block near the top of the `<script>` in `index.html`.

### 2. Contact-form mailer (Cloudflare Worker + Resend)

The contact form is handled by the Worker in [`worker/`](./worker/) — deploy and
configuration steps are in [`worker/README.md`](./worker/README.md). In short:
verify the `storyhill.org` sending domain in Resend, set the `RESEND_API_KEY`
secret, `wrangler deploy`, then set `CONTACT_ENDPOINT` in the `CONFIG` block to
the deployed Worker URL. `grow@storyhill.org` is always copied on every message.

### 3. Host the page

Hosted on **GitHub Pages** from this repo (`dmalament-wheelsup/storyhill-church`,
`main` branch root) at `https://dmalament-wheelsup.github.io/storyhill-church/`.
Any static host works the same way (Cloudflare Pages, Netlify, Vercel); push to
`main` and Pages redeploys automatically.

### 4. Embed in Squarespace

In your Squarespace page editor, add a **Code Block** and paste the iframe **plus** the small listener script below. The page measures its own content and tells the parent how tall to make the iframe, so there are no nested scrollbars and no trailing whitespace — the embed flows as one continuous page.

```html
<iframe
  id="cg-iframe"
  src="https://dmalament-wheelsup.github.io/storyhill-church/index.html"
  style="width:100%; border:0; display:block;"
  loading="lazy"
  title="Community Groups"
  allow="geolocation"
  scrolling="no"
  referrerpolicy="strict-origin-when-cross-origin">
</iframe>
<script>
(function () {
  var iframe = document.getElementById('cg-iframe');
  var lockY = 0, locked = false;
  function sendViewport() {
    var r = iframe.getBoundingClientRect();
    var offsetTop = Math.max(0, -r.top);
    var viewportHeight = Math.max(0, Math.min(window.innerHeight, r.bottom) - Math.max(0, r.top));
    iframe.contentWindow.postMessage(
      { type: 'storyhill:viewport', offsetTop: offsetTop, viewportHeight: viewportHeight }, '*');
  }
  function setLock(on) {
    if (on === locked) return;
    locked = on;
    if (on) {
      lockY = window.scrollY;
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
    } else {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
      window.scrollTo(0, lockY);
    }
  }
  window.addEventListener('message', function (e) {
    var d = e.data || {};
    if (d.type === 'storyhill:height' && typeof d.height === 'number') {
      iframe.style.height = d.height + 'px';
    } else if (d.type === 'storyhill:request-viewport') {
      sendViewport();
    } else if (d.type === 'storyhill:scroll-lock') {
      setLock(!!d.locked);
    }
  });
  window.addEventListener('scroll', sendViewport, { passive: true });
  window.addEventListener('resize', sendViewport);
})();
</script>
```

**Don't** set a fixed `height`/`min-height` on the iframe and **do** keep `scrolling="no"` — the listener sets the height for you. Note this is the newer Squarespace **Code Block** (`website.components.code`), which runs embedded scripts on the published (logged-out) page; while editing, scripts are disabled, so verify on the live page.

#### How the parent ↔ iframe protocol works

All messages are `postMessage` payloads with a `type` field:

- `storyhill:height` `{ height }` — iframe → parent. Sent whenever content height changes (load, filter toggles, card/map view switch, responsive reflow, font load). Parent sets `iframe.style.height`.
- `storyhill:request-viewport` — iframe → parent, sent when a modal opens. Parent replies with…
- `storyhill:viewport` `{ offsetTop, viewportHeight }` — parent → iframe. Describes which slice of the (auto-sized) iframe is currently on screen, so the modal can be centered where the user can actually see it rather than across the full content height.
- `storyhill:scroll-lock` `{ locked }` — iframe → parent. Sent on modal open/close so the parent can freeze/restore its own page scroll (the iframe also locks its own scroll). Without this, the page behind the modal would scroll.

When the page is opened directly (not framed) all of this is skipped and it behaves as a normal standalone page.

## Customizing

All knobs live in the `CONFIG` block at the top of the `<script>` tag:

```js
SHEET_ID                — the Google Sheet ID (already set)
CONTACT_ENDPOINT        — the Cloudflare Worker URL the contact form POSTs to
CONTACT_EMAIL           — shown in the fallback "email us directly" message
GOOGLE_MAPS_API_KEY     — your browser-restricted Maps API key
MAP_DEFAULT_CENTER/ZOOM — where the map opens before fitting markers
```

Colors and fonts are CSS variables at the top of `<style>` — `--teal`, `--lime`, `--font-serif`, `--font-sans` — pulled from storyhill.org so the embedded page matches your live site.
