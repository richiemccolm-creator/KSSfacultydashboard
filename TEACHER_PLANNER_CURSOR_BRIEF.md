# Teacher Planner — Cursor Implementation Brief

## What this is

A redesign of `teacher_planner.html` inside the **Faculty Hub** web app for Knightswood Secondary School's Expressive Arts Faculty. The goal is to make the teacher planner look and feel like a native part of the Faculty Hub, and to make the personal timetable grid feel visually identical to the existing `Faculty_Timetable.html` (the shared whole-faculty timetable).

There is a working reference mockup at `teacher_planner_mockup.html` — that file is the visual target. It is fully self-contained with static mock data, tabs, and all sections working. The task is to take that design and merge it into the real `teacher_planner.html`, which has live Supabase data, auth guards, and all the real JavaScript logic already in place.

---

## Design system

### Fonts
- **UI / body text:** `Inter` (Google Fonts, weights 400 500 600 700)
- **Headings / display:** `Sora` (Google Fonts, weights 700 800) — used for page titles, stat numbers, scheme unit titles, lesson titles
- **General Sans** is used in the Faculty Hub sidebar — keep it there but don't extend it into the planner content

### Colour tokens (CSS custom properties)
These should be declared on `:root` and used throughout:

```css
:root {
  /* Core brand — from Faculty Timetable */
  --navy:        #1e2d4a;
  --navy-mid:    #253352;
  --navy-light:  #2a3f62;
  --navy-dark:   #16243c;   /* used in Faculty Hub sidebar */
  --white:       #ffffff;
  --off-white:   #f0f2f5;
  --border:      #d8e0ea;
  --muted:       #64748b;
  --text:        #1f2937;
  --text2:       #4a5568;
  --text3:       #94a3b8;

  /* Subject accents */
  --accent-drama:   #4a7fd4;   /* Faculty Hub blue for drama */
  --drama-ac:       #7c3aed;   /* timetable chip: purple for S5 CI */
  --drama-bg:       #ede9fe;
  --drama-dk:       #4c1d95;
  --art-ac:         #c0622a;
  --art-bg:         #fff4ed;
  --art-dk:         #7c2d12;
  --photo-ac:       #0d9488;
  --photo-bg:       #ccfbf1;
  --photo-dk:       #115e59;

  /* Year-group chip colours for the timetable grid */
  --s2-bg:#dceede; --s2-dk:#0a3b0c; --s2-ac:#2e7d32;
  --s4-bg:#fdeade; --s4-dk:#7a1a00; --s4-ac:#e8420a;
  --s5-bg:#ede9fe; --s5-dk:#4c1d95; --s5-ac:#7c3aed;
  --s5ah-bg:#ddeaf8; --s5ah-dk:#0a2d6b; --s5ah-ac:#1565c0;

  /* Timetable grid sizing */
  --cell-h:     3.3rem;
  --period-w:   3rem;

  /* Elevation */
  --shadow:    0 2px 8px rgba(0,0,0,.06);
  --shadow-lg: 0 6px 20px rgba(0,0,0,.1);
  --radius:    10px;
}
```

---

## Page layout

The teacher planner lives **inside the Faculty Hub** which wraps it with a fixed left sidebar. The planner page itself therefore only needs to provide:

```
┌────────────────────────────────────────────────────┐
│  TOPBAR  (white, sticky, 1px border-bottom)        │
├────────────────────────────────────────────────────┤
│  TAB BAR (white, 1px border-bottom, underline tabs)│
├────────────────────────────────────────────────────┤
│                                                    │
│  CONTENT AREA  (padding: 1.75rem 2rem)             │
│  Active panel shown here                           │
│                                                    │
└────────────────────────────────────────────────────┘
```

The Faculty Hub sidebar (252px wide, fixed left, dark navy) is injected by the Faculty Hub shell — the planner page does NOT need to re-render it. The main content area should have `margin-left: var(--sidebar-w)` applied by the outer shell, not by `teacher_planner.html` itself.

---

## Topbar

Match the Faculty Hub's `.topbar` pattern exactly:

```html
<header class="topbar">
  <div class="topbar-left">
    <!-- Logo (links back to faculty-hub.html) -->
    <a href="faculty-hub.html" class="topbar-logo-wrap">
      <img src="faculty-hub-logo.png" alt="Faculty Hub" class="topbar-logo-img">
    </a>
    <h1 class="topbar-heading">Teacher <span>Planner</span></h1>
  </div>
  <div class="topbar-meta">
    <!-- Populated dynamically once user is authenticated -->
    <span class="meta-badge teacher" id="topbarTeacherName">R. McColm</span>
    <span class="meta-badge" id="topbarRoom">Drama Studio</span>
    <span class="meta-badge">2025–26</span>
  </div>
</header>
```

CSS (matches Faculty Hub topbar):
```css
.topbar {
  background: var(--white);
  border-bottom: 1px solid var(--border);
  padding: 0.85rem 2rem;
  display: flex; align-items: center; justify-content: space-between;
  position: sticky; top: 0; z-index: 50;
  gap: 1rem;
}
.topbar-left { display: flex; align-items: center; gap: 0.85rem; }
.topbar-logo-wrap {
  display: flex; align-items: center;
  padding-right: 0.85rem;
  border-right: 1px solid var(--border);
  text-decoration: none;
}
.topbar-logo-img { height: 30px; width: auto; display: block; }
.topbar-heading { font-size: 1.06rem; font-weight: 700; color: var(--text); }
.topbar-heading span { color: var(--accent-drama); }
.topbar-meta { display: flex; gap: 0.45rem; align-items: center; flex-wrap: wrap; }
.meta-badge {
  font-size: 0.63rem; font-weight: 700; letter-spacing: 0.1em;
  text-transform: uppercase; padding: 0.24rem 0.6rem; border-radius: 3px;
  border: 1px solid var(--border); color: var(--muted); background: var(--off-white);
}
.meta-badge.teacher {
  background: #fdeade; border-color: rgba(232,66,10,.25); color: #7a1a00;
}
```

---

## Tab navigation

Immediately below the topbar. Six tabs:

| Tab label | Panel ID | Purpose |
|---|---|---|
| My Timetable | `panel-timetable` | Personal weekly timetable grid + quick stats |
| Week View | `panel-week` | Full week grid with lesson cards per period |
| Day View | `panel-day` | Vertical list of all periods for a chosen day |
| Month View | `panel-month` | Calendar month grid |
| Lesson Bank | `panel-bank` | Library of saved lesson plans, filterable |
| Schemes of Work | `panel-schemes` | Unit plans with lesson sequences |

CSS:
```css
.tabs-bar { background: var(--white); border-bottom: 1px solid var(--border); }
.tabs-inner {
  padding: 0 2rem; display: flex; gap: 0;
  overflow-x: auto; scrollbar-width: none;
}
.tabs-inner::-webkit-scrollbar { display: none; }
.tab-btn {
  padding: 0.75rem 1rem;
  font-size: 0.73rem; font-weight: 600; color: var(--muted);
  background: transparent; border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer; white-space: nowrap; transition: all 0.14s;
  margin-bottom: -1px;
}
.tab-btn:hover { color: var(--text); }
.tab-btn.active { color: var(--navy); border-bottom-color: var(--navy); }
```

---

## Panel: My Timetable

### Stat cards (top row)
Four summary cards before the timetable grid. Values come from the teacher's saved data:
- **Teaching periods / week** — count of slots in their timetable
- **Classes** — unique class groups
- **Lesson plans saved** — count from lesson bank
- **Schemes of work** — count of units

```css
.stat-row { display: flex; gap: 0.75rem; flex-wrap: wrap; margin-bottom: 1.5rem; }
.stat-card {
  background: var(--white); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 0.9rem 1.2rem;
  flex: 1; min-width: 130px; box-shadow: var(--shadow);
}
.stat-num {
  font-family: 'Sora', sans-serif;
  font-size: 1.55rem; font-weight: 800; color: var(--navy); line-height: 1;
  margin-bottom: 0.28rem;
}
.stat-label { font-size: 0.65rem; font-weight: 600; letter-spacing: 0.06em; color: var(--muted); text-transform: uppercase; }
```

### Timetable grid

**This is the key visual requirement.** The personal timetable grid must look and feel identical to `Faculty_Timetable.html`. The same CSS classes, same structure. Differences: it shows only one teacher's row (no teacher-label column), so the grid is just period-labels + Mon/Tue/Wed/Thu/Fri.

Grid columns: `var(--period-w) repeat(5, 1fr)`

Structure (built with JavaScript, same as Faculty Timetable):
```
[corner th] [MON th] [TUE th] [WED th] [THU th] [FRI th]
[period-sep — spans all 6 cols]
[P1 period-lbl] [mon cell] [tue cell] [wed cell] [thu cell] [fri cell]
[period-sep]
[P2 period-lbl] ...
... up to P7
```

Period labels: `position: sticky; left: 0` so they stay visible on horizontal scroll.

**Cell states:**
- `.na` — grey (`#eaeff5`), this period doesn't exist (e.g. Thu/Fri only have 6 periods)
- `.free` — white, teacher has no class; shows a faint dashed `+ plan lesson` prompt on hover
- `.busy` — has a class chip

**Class chip** (same as Faculty Timetable chip):
```html
<div class="class-chip" style="background:{s.bg}; border: 1.5px solid {s.ac}; color: {s.dk}">
  <span class="chip-cls">4draG</span>
  <span class="chip-lsn">Character Motivation</span>  <!-- if lesson plan exists -->
</div>
```

Chip CSS:
```css
.class-chip {
  border-radius: 7px; padding: 0.3rem 0.5rem;
  text-align: center; width: 100%; max-width: 128px;
  transition: transform 0.12s, box-shadow 0.12s; cursor: pointer;
}
.class-chip:hover {
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(0,0,0,.14);
  position: relative; z-index: 3;
}
.chip-cls { font-size: 0.76rem; font-weight: 700; display: block; font-family: 'Sora', sans-serif; }
.chip-lsn { font-size: 0.59rem; font-weight: 500; display: block; opacity: 0.72; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
```

**Class colour mapping** (by year group — the teacher's personal timetable uses these consistently):
```js
const CLASS_STYLE = {
  '2x': { bg: '#dceede', dk: '#0a3b0c', ac: '#2e7d32' },  // any S2 class
  '3x': { bg: '#d9f0ea', dk: '#00382a', ac: '#00796b' },  // any S3 class
  '4x': { bg: '#fdeade', dk: '#7a1a00', ac: '#e8420a' },  // any S4 class
  '5ci': { bg: '#ede9fe', dk: '#4c1d95', ac: '#7c3aed' }, // S5 CI
  '5AH': { bg: '#ddeaf8', dk: '#0a2d6b', ac: '#1565c0' }, // S5/6 AH
};
// Match by class code prefix (first digit = year)
```

---

## Panel: Week View

A CSS Grid showing the full working week. Rows = periods (P1–P7), columns = days (Mon–Fri).

### Header row
- Corner cell (navy-mid background)
- Day headers: day name (Mon/Tue/etc) + date number. Today's date gets highlighted: date number inside a gold/navy circle.

### Period rows
- Period label cell on left (navy-mid, sticky left)
- 5 day cells

### Lesson cards inside cells
Each cell that has a teaching slot shows a coloured lesson card (same colour scheme as timetable chip):
```html
<div class="wg-card" style="background:{s.bg}; border:1.5px solid {s.ac}">
  <div class="wg-card-cls" style="color:{s.dk}">4draG</div>
  <div class="wg-card-title" style="color:{s.dk}">Character Motivation</div>
  <div class="wg-card-status st-planned">planned</div>
</div>
```

Status badge classes:
- `.st-planned` — grey pill
- `.st-complete` — green pill
- `.st-draft` — amber pill

Free slots show a dashed empty box with "Free" label.

### Info bar
A gold-pale notification strip above the grid if there is a calendar event this week (e.g. assessment fortnight, school holiday):
```css
.info-bar {
  background: var(--gold-pale); border: 1px solid rgba(201,168,76,0.3);
  border-radius: 8px; padding: 0.58rem 1rem; margin-bottom: 1rem;
  font-size: 0.76rem; color: var(--navy);
  display: flex; align-items: center; gap: 0.55rem;
}
```
(gold-pale = `#f5edda`)

---

## Panel: Day View

A vertical list of all periods for the selected day. Navigation: prev/next day buttons + today button + date display.

Each **teaching slot** is a card:
```css
.day-card {
  background: var(--white); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 0.9rem 1.2rem;
  display: flex; gap: 0.9rem; align-items: flex-start;
  box-shadow: var(--shadow); cursor: pointer; transition: all 0.15s;
  border-left: 4px solid {s.ac};
}
```
Inside: a coloured period badge (square, rounded, navy background with period number), class label, lesson title, unit name, status badge.

**Free periods** use a dashed border card with a muted "Free period" label.

---

## Panel: Month View

A 7-column calendar grid (Mon–Sun). Header row = day name labels (navy background).

Each day cell:
- Day number (bold)
- If today: day number inside a navy circle, cell has gold outline
- Coloured dots (one per teaching slot, using the class's accent colour)
- A preview chip for the first lesson of the day (text + subject background colour)

---

## Panel: Lesson Bank

A filterable, searchable card grid of saved lesson plans.

**Filter bar** (top):
- Subject chips: All / Drama / Art / Photography (styled like Faculty Timetable filter buttons)
- Search text input
- `+ New lesson` primary button (right-aligned)

**Lesson cards** (auto-fill grid, min 275px per card):
- Coloured left border by subject
- Subject label (small caps, subject colour)
- Lesson title (Sora font, bold)
- Unit name
- Preview text (2–3 lines, truncated)
- Footer: subject tag chip + "Apply →" button

---

## Panel: Schemes of Work

Accordion-style list of unit plans. Each unit card:
- Coloured left border by subject (6px)
- Header: unit title, year/class meta, subject chip, lesson count, chevron (›)
- Expanded body: numbered list of lessons, each with a status badge

Status badges:
```css
.st-complete { background: #ecfdf5; color: #047857; }
.st-planned  { background: #f1f5f9; color: #475569; }
.st-draft    { background: #fff7ed; color: #c2410c; }
```

---

## Key implementation notes for Cursor

### 1. Don't rebuild what already works
`teacher_planner.html` already has:
- Supabase auth + data loading
- `planner-service.js` for CRUD operations
- Week/day/month navigation logic
- Lesson modal (create/edit/save)
- Lesson bank CRUD
- Schemes of work logic

The task is purely **CSS and layout restyling** plus **replacing the timetable grid renderer** with the Faculty Timetable grid style. Do not remove any existing JS functionality.

### 2. Timetable grid is the top priority
The current timetable grid uses a `<table>` with `<input>` cells. The redesign needs:
- A **display mode** (read-only) using the chip grid described above (for when a timetable has been saved)
- An **edit mode** (the existing table with inputs) that shows when the user clicks "Edit timetable"

### 3. Topbar vs. existing header
The existing `teacher_planner.html` has a `.planner-header` div with a logo link and title. Replace this entirely with the `.topbar` structure described above. The Faculty Hub logo image (`faculty-hub-logo.png`) is in the same directory.

### 4. CSS variable alignment
The existing planner uses `--accent: #0ea5e9` (sky blue). Replace references to `--accent` in the planner's CSS with the correct subject-specific accent (`--accent-drama`, `--art-ac`, etc.) or with `--navy` for neutral UI chrome (buttons, borders, tab underlines). Don't break existing component behaviour — just update the colours.

### 5. Responsive behaviour
- At ≤ 900px: reduce period column to `2.6rem`, content padding to `1rem`
- At ≤ 600px: hide the topbar meta badges, reduce stat card font sizes
- Week grid: horizontal scroll on mobile (`overflow-x: auto`)

### 6. Reference files
| File | Purpose |
|---|---|
| `teacher_planner_mockup.html` | **Visual target** — open this in a browser to see the intended design |
| `Faculty_Timetable.html` | Reference for timetable grid CSS/JS structure — copy it closely |
| `faculty-hub.html` | Reference for sidebar, topbar, section-card patterns |
| `teacher_planner.html` | The file to update — keep all existing JS logic intact |

---

## What the mockup does NOT include (to implement separately)

- The lesson create/edit modal (already exists in `teacher_planner.html` — just needs the restyled modal CSS from the existing planner applied consistently)
- Live Supabase data binding (the mockup uses hardcoded JS objects — the real file already has this wired up)
- Auth guard / login flow (already in `teacher_planner.html`, do not touch)
- The timetable setup/edit table (already exists — just needs styling to match the new design)
