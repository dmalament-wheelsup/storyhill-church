# Storyhill Community Groups Page

A single-file static page (`index.html`) that lists Storyhill community groups from a Google Sheet, with card view, map view, tag filtering, and a contact form. Designed to be embedded in Squarespace via an iframe.

## How it works

- Reads the Google Sheet directly using its public gviz endpoint (`gviz/tq?tqx=out:json`), loaded via a `<script>` tag to sidestep CORS. No API key, no backend. The sheet must remain set to "Anyone with the link can view".
- The sheet has **no header row** — data starts at row 1. Columns: A=name (card title), B=time, C=coordinates, D=location (card subtitle), E=description, F=tags. Column B is free text (e.g. "Tuesday mornings", "Wed 9:30 AM") and also drives the time-of-day / day-of-week filters.
- Form submissions are forwarded to your email through [FormSubmit.co](https://formsubmit.co) — also no backend, no signup. The first submission you receive will be a one-time confirmation email; click the link inside to activate forwarding for all future messages.
- The map uses the Google Maps JavaScript API and requires a browser API key.

## Setup

### 1. Get a Google Maps API key

1. Go to https://console.cloud.google.com/google/maps-apis/credentials
2. Create a new API key.
3. Restrict it: under **Application restrictions** choose "HTTP referrers" and add the domain you'll host this on (e.g. `*.netlify.app/*`, `storyhill.org/*`). Under **API restrictions** restrict to "Maps JavaScript API".
4. Open `index.html` and replace `YOUR_GOOGLE_MAPS_API_KEY` (in the `CONFIG` block near the top of the `<script>`) with the key.

### 2. Activate FormSubmit

The first time someone submits the contact form, FormSubmit will email `david.malament@gmail.com` a confirmation link. Click it once and submissions will start flowing through.

### 3. Host the page

Pick any static host. Easiest options:

- **Netlify Drop**: drag `index.html` onto https://app.netlify.com/drop — get a URL instantly.
- **GitHub Pages**: push this repo to GitHub, enable Pages on the `main` branch root. URL will be `https://<user>.github.io/<repo>/`.
- **Cloudflare Pages**, **Vercel**, etc. — all work the same way.

### 4. Embed in Squarespace

In your Squarespace page editor, add a **Code Block** and paste:

```html
<iframe
  src="https://YOUR-HOST/index.html"
  style="width:100%; min-height:1200px; border:0;"
  loading="lazy"
  title="Community Groups">
</iframe>
```

The page is responsive, but iframes don't auto-size. `min-height:1200px` is a safe default for the card grid; bump it up if you have many groups.

## Customizing

All knobs live in the `CONFIG` block at the top of the `<script>` tag:

```js
SHEET_ID                — the Google Sheet ID (already set)
CONTACT_EMAIL           — where contact-form submissions go
GOOGLE_MAPS_API_KEY     — your browser-restricted Maps API key
MAP_DEFAULT_CENTER/ZOOM — where the map opens before fitting markers
```

Colors and fonts are CSS variables at the top of `<style>` — `--teal`, `--lime`, `--font-serif`, `--font-sans` — pulled from storyhill.org so the embedded page matches your live site.
