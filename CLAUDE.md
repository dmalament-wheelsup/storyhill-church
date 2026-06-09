# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single self-contained `index.html` (HTML + CSS + vanilla JS, no dependencies, no build step) that lists Storyhill community groups. It is hosted as a static file and embedded in Squarespace via an `<iframe>`. There is **no backend** — data, mail, and maps all come from third-party endpoints called directly from the browser.

To work on it, open `index.html` in a browser. There are no build, lint, or test commands. Note that loading from `file://` blocks the Google Sheet fetch (see below) and most Maps key restrictions are domain-scoped, so realistic testing happens on the deployed host, not locally.

## Architecture

Everything lives in `index.html` in one `<script>` tag. Flow: `start()` → `loadGroups()` fetches + parses the sheet → `renderTags()`/`renderWhen()`/`renderCards()` paint the DOM. A single `state` object holds groups, active tag filters, active time/day filters, current view, and the lazily-created map + markers.

The three external integrations are the load-bearing parts:

- **Data — Google Sheets via gviz.** `loadSheetViaScript()` injects a `<script>` tag pointing at the sheet's `gviz/tq?tqx=out:json&headers=0` endpoint, *not* `fetch()`. This is deliberate: the CSV endpoint doesn't reliably send CORS headers and `fetch` from `file://` is blocked, but a `<script>` tag sidesteps both. gviz calls back into `google.visualization.Query.setResponse`, which the code stubs to resolve a promise.
- **The sheet has NO header row** and column meaning is positional: A=name (the card **title**), B=time (free text, e.g. "Tuesday mornings" / "Wed 9:30 AM"), C=coordinates, D=location (the card **subtitle**), E=description, F=comma-separated tags. `loadGroups()` maps these by index — changing column order means editing the index mapping in `loadGroups()`. Rows are dropped unless they have a `name` (column A).
- **Mail — FormSubmit.co.** The contact form POSTs to `https://formsubmit.co/ajax/<CONTACT_EMAIL>`. No backend, no account. The very first submission to a new email triggers a one-time confirmation link that must be clicked before forwarding works. The hidden `_honey`, `_captcha`, `_subject`, `_template` inputs are FormSubmit control fields.
- **Maps — Google Maps JS API.** Loaded lazily the first time the user opens Map view (`ensureMap()` → `loadMapsApi()`), not on page load. Requires a browser API key restricted to the host domain.

## Configuration

All knobs are in the `CONFIG` object at the top of the `<script>` (~line 620): `SHEET_ID`, `CONTACT_EMAIL`, `GOOGLE_MAPS_API_KEY`, `MAP_DEFAULT_CENTER`, `MAP_DEFAULT_ZOOM`. Theme colors/fonts are CSS custom properties in `:root` at the top of `<style>`, sampled from the live storyhill.org so the embed matches the parent site.

## Conventions

- All sheet-derived text is escaped with `escapeHtml()` before being interpolated into template-literal HTML — keep this when adding any field that renders sheet content.
- Card markup is generated once by `cardHtml()` and reused for both the grid and the map overlay; the contact button and the location link are wired through event delegation on `document.body`, so dynamically-inserted cards work without rebinding.
- The location subtitle (column D) renders as a clickable button **only when the group has coordinates** — clicking it calls `showGroupOnMap()`, which switches to map view and zooms to that group's marker. Groups without coords render the location as plain static text. `setView('map')` returns the `ensureMap()` promise so the zoom runs only after the lazily-loaded map exists.
- Two filter rows feed `filteredGroups()`: the **tag** row (column F) and a **time/day** row matched against the free-text column B. Semantics differ — tags are **AND** (must match *every* active tag), while the time/day filters are **OR** within themselves (match *any* selected), and the two rows are **AND**ed together.
- Time/day matching (`matchesWhen()`) is heuristic on free text: day filters match the day name as a word stem (`Tuesday` → "Tuesdays"); period filters (Morning/Afternoon/Evening) match the literal word if present, else bucket the first parsed clock time (`parseClockMinutes()`, which also understands "noon"/"midnight"). Groups whose column B has no recognizable day/time simply won't match a time/day filter.
- Day buttons render both a full and a 3-letter label (`label-full`/`label-abbr`); CSS swaps to the abbreviation below the 540px breakpoint so all seven fit one row. The `data-when` attribute always holds the full day name — the filter logic depends on it, so don't drive matching off the visible text.
