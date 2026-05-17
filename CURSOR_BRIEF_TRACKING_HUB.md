# Tracking & Monitoring Hub — Cursor Implementation Brief

> **Scope:** rebuild `tracking_monitoring_hub.html` only. Do not touch the trackers, the data service, the school-management schema, or any other page in this pass.
> **Working rule:** the data layer is correct. `DataService.getAllForMonitoring()` already returns the right rows. The job is to replace the UI layer with a proper analytics dashboard.

---

## 0. Context Cursor needs before starting

You are rebuilding one file: `/Users/richardmccolm/Downloads/Curriculum Design and Report Builder/tracking_monitoring_hub.html`.

The page currently exists and loads data correctly, but the UI is dense and table-heavy, with no proper visualisations and no teacher → class → pupil drill path. We are replacing the UI but keeping the data plumbing.

### What you must NOT change

- `data-service.js` — the data layer is correct.
- The Supabase schema and migrations.
- `art-tracker.html`, `drama-tracker.html` — out of scope.
- Other pages — out of scope.
- The auth gate (`__authGuardCanViewSchoolWideTracking || __authGuardIsAdmin`) — keep it as-is.

### What you CAN change

- The entire `<body>` of `tracking_monitoring_hub.html` — markup, styles, render functions.
- You may add Chart.js as a dependency (CDN, no npm).
- You may add small helper files alongside the hub (`tracking_hub.css`, `tracking_hub.js`, `tracking_hub_charts.js`) if it helps keep code organised, but the simplest acceptable solution is to keep everything inside `tracking_monitoring_hub.html`.

---

## 1. Data — what you have to work with

### 1.1 What `getAllForMonitoring()` returns

```js
[
  {
    user_id: "uuid",
    email: "a.smith@school.com",
    teacherName: "Mr A. Smith",
    data_type: "art-v2",          // or "drama-v3", "moderation-data", "plannerLessons", "plannerTimetable", "plannerWeekNotes"
    data: { /* full tracker JSON blob */ }
  },
  ...
]
```

One row per teacher per `data_type`. Filter to `data_type in ('art-v2','drama-v3')` for the tracking views. Keep the others available for future enrichment (see Section 5.4).

### 1.2 Tracker JSON shape (the `data` field for art-v2 / drama-v3)

```js
{
  pupils:   { s1: { "1A1": [{id, name}, ...], "1B": [...] }, s2: {...}, s3: {...} },
  scores:   { s1: { pupilId: { tp1: { creating:3, presenting:2, evaluating:3,
                                       effort:4, behaviour:3, homelearning:2,
                                       notes:"…" }, tp2: {...} } } },
  profiles: { s1: { pupilId: { teacherNotes:"…", pupilReflection:"…", lastUpdated:"2026-05-10" } } }
}
```

### 1.3 Hard facts about the data

| Thing | Value | Notes |
|---|---|---|
| Year groups | `s1`, `s2`, `s3` only | BGE. No S4–S6 in trackers. |
| Tracking points | 6 per year group | `tp1` through `tp6`. Pulled from `window.CURRICULUM_TPS[subject][yg]`. |
| Dimensions | `creating, presenting, evaluating, effort, behaviour, homelearning` | Same 6 for both subjects. |
| Score scale | `1–4` plus `0` (N/A) plus `null` (not entered) | 1 = "Working on Targets", 4 = "Above Expectations". |
| Legacy art shim | Old art used a single `progress` value | `migrateLegacyArtScores()` in art-tracker.html fans it out to creating/presenting/evaluating. The hub already tolerates this — keep tolerating it. |
| Pupil identity | `{ id, name }` only | No gender, SCN, DOB, attendance. Cross-class identity is `name|yg|class` lowercased. |
| Timestamps | None per score | You can plot TP-axis (TP1→TP6), not calendar time. |

### 1.4 The at-risk rule (canonical — use this everywhere)

```js
// Per pupil, per dimension: average across all TPs (ignoring 0/N/A and null)
// "Low" dimension = average <= 2.5
// "At risk" pupil = >= 2 low dimensions
// Severity:  low_count >= 4 -> high
//            low_count == 3 -> medium
//            low_count == 2 -> low
function getRiskForPupil(pupilScores) {
  const dims = ['creating','presenting','evaluating','effort','behaviour','homelearning'];
  const avgs = {};
  dims.forEach(d => {
    const vals = [];
    Object.values(pupilScores || {}).forEach(tp => {
      const v = tp && tp[d];
      if (typeof v === 'number' && v > 0) vals.push(v);
    });
    avgs[d] = vals.length ? vals.reduce((a,b)=>a+b,0)/vals.length : null;
  });
  const lowCount = dims.filter(d => avgs[d] != null && avgs[d] <= 2.5).length;
  return {
    avgs,
    lowCount,
    isAtRisk: lowCount >= 2,
    severity: lowCount >= 4 ? 'high' : lowCount === 3 ? 'medium' : lowCount === 2 ? 'low' : null,
  };
}
```

The legacy hub uses TWO different at-risk rules. Replace both with this one.

### 1.5 The score-band rule (used for cell colours)

```js
function bandFromValue(v) {
  if (v == null || v === 0) return 'unknown';
  if (v < 2.5) return 'concern';
  if (v < 3.25) return 'secure';
  return 'strong';
}
```

---

## 2. Design system for this page

Add these tokens to the top of the page's `<style>` block. They drive every chart, badge, table cell, and chip.

```css
:root {
  /* Subject accents */
  --art-600:#b85820;  --art-500:#c0622a;  --art-100:#fbe9dd;  --art-050:#fdf5ef;
  --drama-600:#2f64bf; --drama-500:#4a7fd4; --drama-100:#dfeaf9; --drama-050:#eef4fc;
  --photo-600:#7547d6; --photo-500:#8b5cf6; --photo-100:#ebe2fb; --photo-050:#f5f0fd;

  /* Score bands — used for cell fills, chips, risk dots */
  --band-concern-bg:#fee2e2; --band-concern-fg:#b91c1c;
  --band-secure-bg:#fef3c7;  --band-secure-fg:#b45309;
  --band-strong-bg:#dcfce7;  --band-strong-fg:#166534;
  --band-elite-bg:#c8f0d4;   --band-elite-fg:#166534;   /* used for the rare "4" */
  --band-unknown-bg:#f1f4f9; --band-unknown-fg:#94a3b8;

  /* Risk severity */
  --sev-high-bg:#fee2e2;  --sev-high-fg:#b91c1c;
  --sev-med-bg:#fef3c7;   --sev-med-fg:#b45309;
  --sev-low-bg:#fff7ed;   --sev-low-fg:#9a3412;

  /* Neutrals */
  --navy-900:#0f1a30; --navy-700:#1e2d4a;
  --ink-900:#0b1220; --ink-500:#475569; --ink-300:#94a3b8;
  --bg:#ffffff; --bg-muted:#f4f6fb; --hairline:#e2e8f0;

  --r-sm:6px; --r-md:10px; --r-lg:14px;
  --sh-sm:0 1px 2px rgba(15,26,48,.06);
  --sh-md:0 4px 12px rgba(15,26,48,.08);

  --font-sans:"Inter","General Sans",ui-sans-serif,system-ui,sans-serif;
  --font-display:"General Sans","Inter",sans-serif;
}
```

Use existing Inter + General Sans imports already on the page. Remove any other font imports.

### 2.1 Reusable primitives — write these once, use everywhere

- `.kpi-card` — stat tile with optional left accent bar (subject or severity).
- `.score-cell` — small chip showing a single 1/2/3/4 or "—". Background = `--band-{state}-bg`, text = `--band-{state}-fg`.
- `.risk-chip` — pill: high / medium / low.
- `.subject-chip` — pill: Art / Drama / Photography. Always coloured.
- `.spark` — 60×16 px inline SVG line, coloured by overall pupil band.
- `.coverage-strip` — 6 little 9×9 squares, one per TP; filled green when scored, light when not, half-tone for partial.
- `.row-art` / `.row-drama` — table row class. Adds a 3 px inset coloured rule on the first cell (subject identity).

---

## 3. Information architecture

Three nested levels, with the deepest being a per-pupil profile drawer.

```
TRACKING & MONITORING (header + global filters)
├── TAB 1 · Overview
├── TAB 2 · Teachers & classes        (the drill path the user asked for)
├── TAB 3 · Pupils at risk
├── TAB 4 · Pupil profile (drawer)    (opens from any pupil click)
└── TAB 5 · Pivot                     (keep the existing pivot — power users)
```

Only Tabs 1–3 are visible by default. Tab 4 is a slide-in drawer triggered by clicking a pupil anywhere. Tab 5 is collapsed under a "More views" menu, off by default, to remove visual noise.

### 3.1 Global filters (top of page, sticky)

Replace the 11-dropdown wall. Use four controls only:

| Control | Behaviour |
|---|---|
| Year group | Single-select: All / S1 / S2 / S3 |
| Subject | Pill toggles: All · Art · Drama (with subject colour when active) |
| Tracking point | Single-select: All / TP1–TP6 |
| Search | Free text — matches pupil name, teacher name, class name |

The remaining filters (`riskBand`, `attainmentBand`, etc.) move into per-tab controls where they're contextually relevant.

---

## 4. Tab specifications

### 4.1 Tab 1 — Overview

The infographic dashboard the user asked for.

**Row 1: four KPI cards.**

| Card | Number | Subtitle |
|---|---|---|
| Pupils | total filtered pupil count | "X art · Y drama · Z dual" with a 3-segment progress bar |
| At risk | count of `isAtRisk` pupils | two coloured chips: "N high", "M medium" |
| Average score | mean of all numeric scores | trend arrow vs previous TP, e.g. `↑ +0.18 vs TP3` |
| Coverage | % of (pupil × TP × dim) cells filled | thin progress bar; subtitle "N pupils ungraded this TP" |

KPI cards must be clickable. Clicking "At risk" filters to Tab 3 with `isAtRisk=true`. Clicking "Pupils" jumps to Tab 2.

**Row 2: two charts side-by-side.**

- **Left (wider, 1.4fr):** Line chart — average score by TP, two lines (art orange, drama blue). Y-axis 1–4. Use Chart.js. Make points clickable: click drills into Tab 2 filtered to that subject + TP. Render data via `Chart.js` v4 from the CDN.
- **Right (1fr):** Radar chart — faculty average across the 6 dimensions. Two overlaid polygons: art (orange) and drama (blue), low opacity fills. Use Chart.js radar type.

**Row 3: "Pupils needing attention" strip.**

- 4-column grid of pupil cards (or 3 on narrower screens).
- Each card: avatar (initials on coloured chip — subject colour), name, "Year · Class · Subject(s)", and a 6-cell strip showing the 6 dimension averages with band-coloured backgrounds.
- Left accent bar matches severity (red for high, amber for medium).
- Show top 4–8 by lowCount descending. "View all 23 →" link on the right side of the row header.

**Row 4: "Teachers & classes" summary.**

Just the table from Tab 2, but limited to top 5 rows by pupil count. "See full breakdown" link jumps to Tab 2.

### 4.2 Tab 2 — Teachers & classes (the main drill path)

This is the screen the user explicitly asked for: click a teacher, see their classes, click a class, see every pupil's results across every TP.

**Header:** "Teachers & classes" + search box ("Find teacher…").

**Table columns:**

| Column | Content | Renders |
|---|---|---|
| Teacher | Avatar (initials, coloured by primary subject) + name + email | Click toggles inline expansion (the class breakdown) |
| Subjects | Subject chips | Art / Drama / Both |
| Classes | Count of unique classes | Plain number |
| Pupils | Count of unique pupils | Plain number |
| Avg score | 1–4 average across all pupils, all TPs, all dims | Thin progress bar + number (e.g. `▰▰▰▱ 3.05`) |
| At risk | Count of at-risk pupils | Severity-coloured chip |
| Coverage | 6-square strip showing which TPs are scored | Each square: dark green = ≥80% pupils scored that TP, light green = 1–79%, blank = 0 |

**Inline expansion on click of a teacher row:**

Expansion row spans the full table. Inside it, a list of that teacher's classes:

```
↳ Ms B. Jones · S2 Drama A · 24 pupils · click any pupil to open profile
[mini-table: pupil | TP1 | TP2 | TP3 | TP4 | TP5 | TP6 | trend (sparkline) | status]
```

The mini-table:
- One row per pupil in that class.
- TP cells: small score chips (`.score-cell`) — 1/2/3/4 or "—" if not scored. Background uses `bandFromValue` for the **average across the 6 dimensions for that pupil at that TP** (not raw score per dim — that's too much data per cell).
- Trend column: 60×16 SVG sparkline of that pupil's overall average across TP1–TP6. Stroke colour = pupil's overall band.
- Status column: severity chip from `getRiskForPupil`.
- Clicking a pupil row opens the **profile drawer (Tab 4)**.

A teacher can teach multiple classes — show each class as its own mini-table inside the expansion, separated by a thin rule + the class header line.

### 4.3 Tab 3 — Pupils at risk

- Filter chips at top: "All / S1 / S2 / S3", "All / Art / Drama", "All / High / Medium / Low".
- Grid of larger pupil cards (3 columns on desktop). Each card includes:
  - Avatar + name + year + class + subject(s) + severity chip
  - 6-cell dimension strip (creating · presenting · evaluating · effort · behaviour · HL) with band colours and the average number inside
  - Mini sparkline of overall trend
  - Two actions: "View profile" (opens drawer), "Generate parent letter" (links to the existing letter generator with the pupil pre-loaded — `letter_generator.html?pupilId=…`)
- Sort selector top-right: "Severity (high first)" / "Name" / "Class" / "Trajectory (worsening first)"

### 4.4 Tab 4 — Pupil profile (slide-in drawer)

Opens from the right when any pupil is clicked. Width: 560 px on desktop, full-screen on mobile.

**Header:**
- Avatar + Name + Year/Class + subject chip(s) + severity chip
- Close button (×)
- "Generate parent letter" button (top-right)

**Body sections (vertical stack):**

1. **At-a-glance:** 3 stat tiles in a row — Overall avg, Risk dimensions count, Last update date.
2. **Radar chart:** pupil's 6-dimension averages overlaid against the class average (two polygons). Tooltip shows exact numbers.
3. **Per-dimension TP trajectory:** small line chart (Chart.js) with 6 lines, one per dimension. Same y-axis 1–4. Legend coloured per dimension. This is the "full results across all tracking periods" the user asked for.
4. **TP scores table:** rows = TPs, columns = the 6 dimensions, cells coloured by band. Below each TP row: the teacher's note for that TP (if any), in italic muted text.
5. **Profile text:** "Teacher notes" and "Pupil reflection" from `data.profiles[yg][pid]`. Show "last updated" date next to each.
6. **Cross-subject panel (only if pupil appears in both Art and Drama):** mini repeat of section 2's radar but split into two — one art, one drama — for comparison.

### 4.5 Tab 5 — Pivot (kept, but hidden behind "More views")

Keep the existing pivot table function. Move it behind a "More views ▾" menu in the page header so it doesn't dominate the page for everyday use.

---

## 5. Implementation specifics

### 5.1 File structure (recommended split)

```
tracking_monitoring_hub.html       — markup shell, loads CSS + JS + Chart.js
tracking_hub.css                   — all the styles
tracking_hub.js                    — data prep, filtering, render functions
tracking_hub_charts.js             — Chart.js helpers (line, radar, mini-line)
```

If keeping everything inline in one HTML file is easier for your workflow, that's acceptable. The brief refers to logical sections, not files.

### 5.2 Dependencies (add to `<head>`)

```html
<link rel="stylesheet" href="design-tokens.css">           <!-- if exists -->
<link rel="stylesheet" href="tracking_hub.css">
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.js"></script>
```

Chart.js 4.x via cdn.jsdelivr.net. No other new deps.

### 5.3 Data preparation pipeline (run once after load, recompute on filter change)

```js
// Pseudocode for the prep pipeline
const raw = await DataService.getAllForMonitoring();
const trackerRows = raw.filter(r => r.data_type === 'art-v2' || r.data_type === 'drama-v3');

// 1. Normalize to fact rows (one per pupil × subject × TP × dim)
const facts = buildFactRows(trackerRows);
// shape: { pupilKey, name, yg, cls, subject, teacherName, teacherEmail, tp, dim, score }

// 2. Build pupil rollups (one per pupil × subject)
const pupils = buildPupilRollups(facts);
// shape: { pupilKey, name, yg, cls, subject, teacherName,
//          tpAverages: {tp1: avg, tp2: avg, ...},
//          dimAverages: {creating: avg, ...},
//          risk: getRiskForPupil(scoresBlock) }

// 3. Build cross-subject pupil index (a pupil can appear in both art and drama)
const pupilCrossIndex = indexByNameYgCls(pupils);

// 4. Build teacher rollups (one per teacher)
const teachers = buildTeacherRollups(pupils);
// shape: { teacherName, teacherEmail, subjects:[], classes:[...],
//          pupilCount, atRiskCount, avgScore, coverage:[6 bools] }
```

You already have `buildFactRows` and `buildPupilRollup` in the legacy file (lines 414–710 of the current `tracking_monitoring_hub.html`). Lift and adapt them — don't rewrite from scratch.

### 5.4 Optional enrichment from other data types (nice-to-have)

The data service already returns `moderation-data`, `plannerLessons`, `plannerTimetable`, `plannerWeekNotes`. The current hub throws these away. Two easy wins:

- **Moderation badge per TP:** if `moderation-data.entries` has a `completed` entry for a unit matching a TP id, show a small `<i class="ti ti-shield-check">` badge next to that TP in the class breakdown.
- **Lesson count per class per TP:** count `plannerLessons.lessons` filtered to that class + that TP's date window. Show as a tiny "12 lessons" subtitle under the class name in Tab 2.

If they take more than 30 min to add, skip them for v1 and document them as a follow-up.

### 5.5 Chart.js specifics

```js
// Line chart (Overview · Average by TP)
new Chart(ctx, {
  type: 'line',
  data: {
    labels: ['TP1','TP2','TP3','TP4','TP5','TP6'],
    datasets: [
      { label:'Art',   data:[2.4,2.6,2.7,2.85,2.95,3.05], borderColor:'#c0622a',
        backgroundColor:'#c0622a20', tension:0.3, pointRadius:5, pointHoverRadius:7 },
      { label:'Drama', data:[2.5,2.7,2.65,2.85,2.92,3.10], borderColor:'#4a7fd4',
        backgroundColor:'#4a7fd420', tension:0.3, pointRadius:5, pointHoverRadius:7 },
    ]
  },
  options: {
    responsive: true, maintainAspectRatio: false,
    scales: { y: { min: 1, max: 4, ticks: { stepSize: 1 } } },
    plugins: { legend: { position: 'bottom' } },
    onClick: (e, els) => { if (els[0]) drillTo({ subject: ..., tp: ... }); }
  }
});

// Radar chart (Overview · Dimension profile)
new Chart(ctx2, {
  type: 'radar',
  data: {
    labels: ['Creating','Presenting','Evaluating','Effort','Behaviour','Home L.'],
    datasets: [
      { label:'Art',   data:[2.9,3.1,3.0,3.2,3.3,2.8], borderColor:'#c0622a', backgroundColor:'#c0622a25' },
      { label:'Drama', data:[3.0,3.0,2.8,3.1,3.4,2.7], borderColor:'#4a7fd4', backgroundColor:'#4a7fd425' },
    ]
  },
  options: {
    scales: { r: { min: 1, max: 4, ticks: { stepSize: 1 } } },
    plugins: { legend: { position: 'bottom' } }
  }
});
```

### 5.6 Performance — soft rules

- Compute `facts`, `pupils`, `teachers` once on load. Cache them in module scope.
- Filter changes mutate a derived view, not the source data.
- For tables ≥ 500 rows, render with `<table>` but wrap in a scrollable container with `max-height: 60vh`. Do not virtualise unless rows ≥ 2,000.
- The drawer body fetches nothing new — all data comes from the cached `pupils` rollup. Render the radar + line chart on drawer open, destroy them on close.

### 5.7 Accessibility

- Every interactive cell (KPI card, score chip, teacher row, pupil card) must be focusable (`tabindex="0"`) and respond to Enter/Space.
- All Chart.js canvases must have a sibling `<table class="sr-only">` containing the same data (or use the chartjs-plugin-a11y if you'd rather — not required).
- Cell colours must keep contrast ≥ 4.5:1 against their fill. The `--band-*` tokens are tuned for this.
- The drawer must trap focus while open and return focus to the trigger on close.

---

## 6. The drill path the user explicitly asked for

To make this unambiguous, here's the exact click sequence the new hub must support:

```
1. Open hub  → Tab 1 (Overview) appears with KPIs, charts, attention strip, top teachers.
2. Click "Teachers & classes" tab OR click "See full breakdown" on the overview teachers strip.
3. Tab 2 renders the teacher list.
4. Click Ms B. Jones row → row expands inline showing her three classes.
5. Click S2 Drama A's class header → expansion focuses on that class with all 24 pupils, TP1–TP6 scores, sparkline, status.
6. Click pupil "Alex Thompson" → profile drawer slides in from the right with:
     • At-a-glance tiles
     • Pupil-vs-class radar (6 dimensions)
     • 6-line trajectory chart (one line per dimension across TP1→TP6)
     • TP-by-dimension grid table
     • Teacher notes + pupil reflection
     • Cross-subject panel (if Alex is also in Art)
     • "Generate parent letter" button
7. Close drawer → state returns to Tab 2 with Ms B. Jones expansion still open.
```

Tabs 1, 2, 3 use the SAME pupil-card / score-cell / risk-chip primitives so clicking around feels consistent.

---

## 7. Build order

Do not chain — stop and report after each step.

1. **Lift the data prep.** Refactor `buildFactRows`, `buildPupilRollup` from the existing file into clean functions. Add `buildTeacherRollups`. Unit-test against a known JSON blob.
2. **Build the design tokens + primitives.** `.kpi-card`, `.score-cell`, `.risk-chip`, `.subject-chip`, `.spark`, `.coverage-strip`. Render a static gallery of them at the bottom of the page during development; remove before commit.
3. **Replace global filters.** Strip the 11-dropdown block. Add the 4-control sticky filter bar. Wire to the recompute pipeline.
4. **Build Tab 1 (Overview).** KPI cards + Chart.js line + Chart.js radar + attention strip + top-5 teacher rows.
5. **Build Tab 2 (Teachers & classes).** Table + inline expansion + per-class mini-table.
6. **Build Tab 3 (Pupils at risk).** Grid of pupil cards with sort + filter chips.
7. **Build Tab 4 (Profile drawer).** Two Chart.js charts + the dim grid + notes panel.
8. **Move pivot under "More views ▾".** Don't delete it.
9. **Accessibility pass.** Tab order, focus rings, contrast spot-check, sr-only tables for charts.
10. **Delete dead code.** Remove the old render functions, old SVG line chart, old multi-grid filter block.

**Verification at the end:**

- [ ] Click any pupil from any tab opens the profile drawer.
- [ ] Profile drawer shows radar, trajectory line chart, dim grid, notes.
- [ ] Teacher row expansion shows class table with TP1–TP6 cells + sparkline.
- [ ] At-risk count on Overview KPI === count on Tab 3.
- [ ] Average on Overview KPI === recomputed mean from the fact rows.
- [ ] Filters update all tabs simultaneously.
- [ ] Page is readable on a 1280 px laptop and on a 768 px iPad (drawer goes fullscreen below 768 px).
- [ ] No JS errors on load for an empty or one-teacher account.
- [ ] Audit log still receives `monitoring_viewed_all_pupil_data` exactly once per load.

---

## 8. If you're tempted to do more

Do not. Stick to this file. The trackers, the schema, the other pages are out of scope.

If you discover the data layer is wrong (e.g. a field is missing), stop and report. Do not patch the data service from inside this work.

If a Chart.js chart looks bad with real data, prefer adjusting axis limits/ticks over swapping chart types. The chart types specified above were chosen against the actual data shape and should be kept.
