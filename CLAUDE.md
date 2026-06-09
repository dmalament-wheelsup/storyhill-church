# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single self-contained `index.html` (HTML + CSS + vanilla JS, no dependencies, no build step) that lists Storyhill community groups. It is hosted as a static file and embedded in Squarespace via an `<iframe>`. There is **no backend** — data, mail, and maps all come from third-party endpoints called directly from the browser.

To work on it, open `index.html` in a browser. There are no build, lint, or test commands. Note that loading from `file://` blocks the Google Sheet fetch (see below) and most Maps key restrictions are domain-scoped, so realistic testing happens on the deployed host, not locally.

## Architecture

Everything lives in `index.html` in one `<script>` tag. Flow: `start()` → `loadGroups()` fetches + parses the sheet → `renderTags()`/`renderCards()` paint the DOM. A single `state` object holds groups, active tag filters, current view, and the lazily-created map + markers.

The three external integrations are the load-bearing parts:

- **Data — Google Sheets via gviz.** `loadSheetViaScript()` injects a `<script>` tag pointing at the sheet's `gviz/tq?tqx=out:json&headers=0` endpoint, *not* `fetch()`. This is deliberate: the CSV endpoint doesn't reliably send CORS headers and `fetch` from `file://` is blocked, but a `<script>` tag sidesteps both. gviz calls back into `google.visualization.Query.setResponse`, which the code stubs to resolve a promise.
- **The sheet has NO header row** and column meaning is positional: A=name/leader, B=time, C=coordinates, D=location (used as the card title), E=description, F=comma-separated tags. `loadGroups()` maps these by index — changing column order means editing the index mapping in `loadGroups()`. Rows are dropped unless they have a `location` (column D).
- **Mail — FormSubmit.co.** The contact form POSTs to `https://formsubmit.co/ajax/<CONTACT_EMAIL>`. No backend, no account. The very first submission to a new email triggers a one-time confirmation link that must be clicked before forwarding works. The hidden `_honey`, `_captcha`, `_subject`, `_template` inputs are FormSubmit control fields.
- **Maps — Google Maps JS API.** Loaded lazily the first time the user opens Map view (`ensureMap()` → `loadMapsApi()`), not on page load. Requires a browser API key restricted to the host domain.

## Configuration

All knobs are in the `CONFIG` object at the top of the `<script>` (~line 557): `SHEET_ID`, `CONTACT_EMAIL`, `GOOGLE_MAPS_API_KEY`, `MAP_DEFAULT_CENTER`, `MAP_DEFAULT_ZOOM`. Theme colors/fonts are CSS custom properties in `:root` at the top of `<style>`, sampled from the live storyhill.org so the embed matches the parent site.

## Conventions

- All sheet-derived text is escaped with `escapeHtml()` before being interpolated into template-literal HTML — keep this when adding any field that renders sheet content.
- Card markup is generated once by `cardHtml()` and reused for both the grid and the map overlay; contact buttons are wired through event delegation on `document.body`, so dynamically-inserted cards work without rebinding.
- Tag filtering is AND, not OR: a group must match *every* active tag (`filteredGroups()`).
