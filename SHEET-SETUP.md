# Hardening the Community Groups sheet

The page reads its data straight from a Google Sheet. These steps make the
sheet hard to break for non-technical staff — labeled columns, dropdowns so
the time/day filters always match, and protection so the structure can't be
reordered by accident. **No app or backend required.** Everything here is done
in Google Sheets itself.

> One small code change is involved (Step 1) so the page can skip a header row.
> Everything after that is sheet-only.

---

## The columns (what each one means)

Data lives in columns **A–F**. Order matters — the page maps columns by
position.

| Col | Meaning | Example | Notes |
|-----|---------|---------|-------|
| **A** | Group name (card title) | `The Wanderers` | Required. A row with no name is ignored. |
| **B** | Meeting time | `Tuesdays at 7:00 PM` | Drives the day + time-of-day filters. **Format matters — see below.** |
| **C** | Coordinates | `35.503, -80.845` | `lat, lng`. Used to place the map dot. Optional (no dot if blank). |
| **D** | Location | `Davidson` | The subtitle under the title. A town/area name is fine. |
| **E** | Description | `Young families, over dinner.` | Free text. |
| **F** | Tags | `young families, dinner` | Comma-separated. Each becomes a filter chip. |

### Why column B format matters

The filters read column B as free text and look for **a day name** and **a
time of day**. To make a group show up under the right filters, include both:

- a day word — `Monday`, `Tuesday`, … `Sunday` (plurals like `Tuesdays` are fine)
- a clear clock time — `7:00 PM`, `9:30 AM`, `noon`

So `Tuesdays at 7:00 PM` is ideal: it matches the **Tuesday** filter and the
**Evening** filter automatically. The time-of-day buckets are:

| Filter | Clock range |
|--------|-------------|
| Morning | 5:00 AM – 11:59 AM |
| Afternoon | 12:00 PM – 4:59 PM |
| Evening | 5:00 PM – 4:59 AM |

You can also just write the words (`Tuesday mornings`) and it still works —
but a real clock time is safer and shows nicely on the card.

### Coordinates (column C)

These are intentionally **approximate, hand-placed** points — not real
addresses (that protects member privacy). To set one:

1. Open [Google Maps](https://maps.google.com).
2. Click roughly where the group meets (e.g. the north side of town).
3. Click the little lat/lng readout that pops up at the bottom to copy it.
4. Paste it into column C as `lat, lng`.

For several groups in the same town, click slightly different spots so their
dots spread out on the map.

---

## Step 1 — Add a labeled header row

Right now the sheet has **no header row** (data starts on row 1), which makes
it easy to forget what each column is. Add one:

1. Insert a row at the very top.
2. Put these labels in **A1–F1**:

   | A1 | B1 | C1 | D1 | E1 | F1 |
   |----|----|----|----|----|----|
   | Group Name | Meeting Time | Coordinates (lat, lng) | Location | Description | Tags |

3. **Make the page skip the header row** (one-time code change): in
   `index.html`, find this line:

   ```js
   s.src = `https://docs.google.com/spreadsheets/d/${CONFIG.SHEET_ID}/gviz/tq?tqx=out:json&headers=0`;
   ```

   and change `headers=0` to **`headers=1`**. That tells Google to treat row 1
   as headers and leave it out of the data. (Ask whoever maintains the page to
   make this change and redeploy — without it, the header row would show up as
   a broken group card.)

> If you'd rather not touch the code, skip the header row and keep data
> starting on row 1 — Steps 2–4 still work. The header is purely for staff
> clarity.

## Step 2 — Freeze the header row

So it stays visible while scrolling:

- **View → Freeze → 1 row.**

## Step 3 — Add dropdowns so the filters always match

This is the big one — it stops typos and inconsistent wording in the
filter-driving columns.

### Column B — meeting time

Free-typing times is where mismatches creep in. Two good options:

- **Simplest:** add a dropdown of the exact phrasings you want staff to use.
  Select column B (B2 down), then **Data → Data validation → Add rule →
  Dropdown**, and add items like:

  ```
  Sundays at 9:00 AM
  Sundays at 11:00 AM
  Sundays at 6:00 PM
  Mondays at 7:00 PM
  Tuesdays at 7:00 PM
  Wednesdays at 6:30 PM
  Thursdays at 7:00 PM
  Fridays at 7:00 PM
  Saturdays at 8:00 AM
  ```

  (Edit to match your real meeting times. The point is consistent, filter-safe
  phrasing — each has a day word and a clock time.)

- **More flexible:** keep B as free text but set validation to **warn** (not
  reject) so staff can add a one-off time, while still being nudged toward the
  standard format.

### Column F — tags

To keep tag chips consistent (so you don't end up with both `young families`
and `Young Families`):

- Decide your tag vocabulary, then either add a dropdown on column F, or keep a
  reference list of approved tags on a second tab and point staff to it.
- Tags are comma-separated within a single cell, e.g. `young families, dinner`.

## Step 4 — Protect the structure

So columns can't be reordered or the header deleted by accident:

1. **Data → Protect sheets and ranges.**
2. Protect the **header row (row 1)** — set it to "Only you" or show a warning
   on edit. This keeps the labels and column order intact.
3. Optionally protect the whole sheet with **"Show a warning when editing"**
   (rather than restricting) — staff can still edit, but get a heads-up before
   changing anything, which discourages accidental column drag/delete.

## Step 5 — Keep sharing set correctly

The page can only read the sheet if it's publicly viewable:

- **Share → General access → "Anyone with the link" → Viewer.**

If this ever gets set back to "Restricted," the page goes blank. Leave it on
Viewer.

---

## Quick reference: what breaks the page, and the fix

| Symptom | Likely cause | Fix |
|--------|--------------|-----|
| Page is blank / "Could not load groups" | Sheet sharing set to Restricted | Set to "Anyone with the link – Viewer" (Step 5) |
| A group shows under no day/time filter | Column B missing a day word or clock time | Use the `Day + clock time` format, e.g. `Tuesdays at 7:00 PM` |
| A group has no map dot | Column C blank or not `lat, lng` | Add coordinates (see Coordinates section) |
| Fields show in the wrong place on the card | Columns got reordered | Restore A–F order (Step 4 prevents this) |
| A weird blank/"header" card appears | Header row present but page still on `headers=0` | Apply the `headers=1` change in Step 1 |
| Duplicate-looking tag chips | Same tag typed two ways | Standardize tag wording (Step 3, column F) |
