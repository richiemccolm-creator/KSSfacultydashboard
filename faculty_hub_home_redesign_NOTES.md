# Faculty Hub — Home page redesign v3 · build notes for Cursor

Target file: `faculty-hub.html`
Mockup to match: `faculty_hub_home_redesign.html` (v3 — hero restored, no emoji, dates surfaced)
Scope: replace the markup inside `<div id="home" class="panel active">` (currently starts around line 1955 and ends around line 2084).

## Design rules

- **No emoji anywhere.** Use Tabler line icons (`<i class="ti ti-…"></i>`) — the same icon set already used in `tracking_hub_overview_redesign.html`. Icons are small (13px), grey (`#475569` or `#94a3b8`), and used sparingly — as a section marker, never as decoration.
- **Restrained colour.** White cards on grey background. Accent colour appears only in status chips (red `#b91c1c` / amber `#b45309` / green `#166534` / blue `#2f64bf`) and a single 3px coloured rail on left-edge items where status matters. No gradient hero. No coloured tile backgrounds.
- **Type scale**: section headings 12px / 500 weight; body 11px; captions 9–10px. Numbers 18–22px / 500 weight (not bold).
- **Borders**: `0.5px solid #e2e8f0`. Radius 8–10px. Card padding `10–14px`.

## Section order — priority of information

The page now leads with **announcements** and **key dates** because that's what staff need to see first.

### 1. Hero strip (restored — but calmer than v1)
- Navy gradient (`#1e2d4a` → `#2a3f62` → `#3a5489`) with two soft radial accents (amber top-right and blue bottom-right). Both glows kept at ~18% alpha so they read as warmth, not decoration.
- Left side: uppercase eyebrow with date + week, 22px greeting, then a one-sentence summary with the key numbers (3 priority tasks, 2 deadlines) styled in `#fbbf24` bold. Below that, three buttons — `Start tracking` (solid amber), `Timetable` and `Quick add` (translucent ghost).
- Right side: school name eyebrow, large 26px live clock, weather row (`ti-cloud` icon + temp + city), and a small "P1 in 47 min" countdown pill.
- Hero radius 12px, padding 18×22. Sits above everything else.

### 2. Announcements + Key dates (1.4fr 1fr two-column row) — TOP OF PAGE
This is the new headline section. Everything else is below.

**Announcements card**:
- Header: `<i class="ti ti-speakerphone">` · title · red "2 new" pill on left; "View all →" on right.
- Each announcement is a row with a 3px coloured left rail (red `#b91c1c` for pinned/urgent, amber `#b45309` for action-required, grey `#cbd5e0` for FYI).
- Inside each row: a small status pill ("Pinned", "Action required") + grey timestamp, then a 12px/500 headline, then a 10px grey summary line. Two-line clamp on summary.
- Show 3 items by default. "View all" goes to `fh_announcements.html`.

**Key dates card**:
- Header: `<i class="ti ti-calendar-event">` · title · "Calendar →" on right.
- Each item: a 40px-wide date block on the left (day-of-week uppercase eyebrow / big day-number / month abbrev), title + caption in the middle, "in N days" countdown on the right.
- Deadline rows get a peach background tint `#fef9f4`, peach-coloured date block, and a small amber `DEADLINE` pill next to the title.
- Show 5–6 upcoming entries. Wire to the existing academic calendar source. Sort by date ascending. Filter to: events touching this user's subjects/classes + faculty-wide + tracking-period deadlines.

### 3. Summary strip (4 tiles with thin coloured top accents)
- Today's classes / Tasks / Tracking due / Pupils to watch.
- Each tile: 9px uppercase grey label + Tabler icon top-right (coloured to match the tile accent), big number, one caption line. The Tracking tile has a 5px progress bar (62%). The Tasks tile has the two status pills (`3 overdue`, `4 today`).
- 2px coloured top border on each card — blue `#4a7fd4`, amber `#b45309`, green `#166534`, red `#b91c1c` — so the row scans by status colour without feeling busy.

### 4. Today's timetable + My tasks + Tracking progress (1.5fr 1fr 1fr)

**Today's timetable**:
- Compact list, one row per period. Each row has: time (42px wide, grey), a tiny 3×18 vertical pill in the subject colour, then class title and caption, with an optional status word on the right (`All tracked` green / `Tracking due` amber / `Class visit` blue).
- The currently-live period gets a soft green background extending edge-to-edge (`background:#f8fbf8` and a green time label), and the subject rail gets a soft green glow ring. A small `NOW` pill sits beside the title.
- Free periods/PPA are italic grey rows.

**My tasks**:
- Identical to v1's task list but icons swapped to Tabler (`ti-square` for unchecked, `ti-square-check-filled` for checked). Background tints stay: overdue rows `#fef2f2`, due-today `#fffbeb`, future rows plain.

**Tracking progress + Pupils to watch (merged)**:
- Top portion: one row per class with a horizontal progress bar (`x/y · NN%`), colour-coded by completion.
- Bottom portion (divided by a hairline): "Pupils to watch" — 3 compact rows with a 18px initials avatar, name and class, and a small score with up/down arrow.

### 5. The week ahead (full-width 5-column grid)
- Mon–Fri, each day card 90px tall. Today's column has a soft blue tint and "Today" eyebrow. The deadline day (any day with a deadline) has a peach tint, "Deadlines" eyebrow, and bullet items in amber/red.
- Each card lists 0–3 events as 9px grey lines (no pills, just text).

### 6. Jump to (minimal)
- Six small flat tiles in one row: just a Tabler icon + a 11px label. No gradients, no captions, no colour blocks. Border-only.

## What changed from v1 → v3

- Hero is **back** but calmer — softer glows, no over-the-top decoration, weather/time/countdown kept because they earn their space.
- All emoji (drama mask, palette, camera, megaphone, etc.) — replaced with Tabler line icons or removed.
- The pinned-announcement "spotlight" navy card — folded into the standard Announcements list with a red rail.
- The colourful gradient quick-link tiles with captions — replaced with a minimal flat tile row.
- The "Faculty pulse" birthdays/kudos section — removed entirely.
- The progress rings on tracking pulse — replaced with simple horizontal bars.
- Summary tiles regained a subtle 2px coloured top accent (status-coded) so the page has rhythm without noise.

## Data wiring (unchanged from v1 except where noted)

- `homeAnnouncements`: each item now needs `{ priority: 'pinned' | 'action' | 'fyi', author, timeAgo, title, summary }`.
- `homeKeyDates`: NEW feed. `{ date, dayOfWeek, monthAbbrev, title, caption, isDeadline, daysUntil }` — sourced from academic calendar + tracking-period closing dates + report deadlines.
- `homeTimetable`: same shape as v1 but drop the emoji field — derive subject colour from class code or subject name.
- `homeTracking`: `{ classCode, tracked, total }`. Pull % and status colour client-side.
- `homeWatchlist`: 3 entries max in the merged card. Same shape as v1.
- `homeWeekAhead`: 5 days with 0–3 short event labels each. Mark `isToday` and `isDeadlineDay` for tinting.
- Tasks continue to come from `teacher-tasks-home.js`.

## Build order

1. Add Tabler icons stylesheet if not already loaded.
2. Replace `#home > .staff-home-shell` markup with the six sections in order.
3. Add the `homeKeyDates` feed — this is the only new backend hook.
4. Reuse all other existing JS loaders.
5. Verify mobile: at `<= 900px`, the 1.4fr/1fr row stacks, the 3-up row stacks, the 5-day week-ahead becomes a 2-column grid that scrolls.
