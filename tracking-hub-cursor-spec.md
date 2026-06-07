# Faculty Tracking & Monitoring Hub — Cursor Build Spec
**Knightswood Secondary — Expressive Arts Faculty**
**Prepared for: Cursor AI | Author: Richie McColm**

---

## 1. Overview

A single-page application (SPA) embedded within the Faculty Hub (existing Vercel + Supabase project). This module provides a comprehensive tracking and monitoring dashboard across Art & Design, Drama, and Photography for S1–S6. It is used by the Faculty Head and class teachers to monitor pupil progress, identify at-risk learners, and analyse attainment trends across tracking points.

---

## 2. Tech Stack

- **Framework:** React (existing Faculty Hub stack)
- **Backend/Auth:** Supabase (existing project)
- **Styling:** Tailwind CSS
- **Charts:** Recharts
- **Table:** TanStack Table (React Table v8) — for the full pupil grid
- **Icons:** Lucide React
- **Fonts:** DM Sans (body), Plus Jakarta Sans (headings) — Google Fonts
- **Colour palette:** Dark navy (#0F1B2D) sidebar; white content area; gold accent (#C9A84C); red (#EF4444), amber (#F59E0B), green (#22C55E) for risk bands

---

## 3. Layout

### Shell
```
┌─────────────────┬──────────────────────────────────────────────┐
│   Sidebar Nav   │              Main Content Area               │
│   (240px, dark) │         (fluid, white/light grey bg)         │
└─────────────────┴──────────────────────────────────────────────┘
```

### Sidebar items (existing Faculty Hub nav, add):
- Dashboard (home)
- **Tracking & Monitoring** ← this module
- Pupils
- Classes
- Subjects
- Assessments
- Reports
- Insights
- Settings

### Top of content area
- Page title: "Tracking & Monitoring"
- Subtitle: "Faculty overview across Art and Drama. Use global filters to explore performance, spot trends, and support pupil progress."
- Top-right actions: Refresh | Print | Save | Load from cloud
- School badge: Knightswood Secondary (dropdown if multi-school)

---

## 4. Navigation Tabs

Six tabs within the Tracking & Monitoring module:

| Tab | Description |
|-----|-------------|
| **Overview** | KPI cards, charts, at-risk panel |
| **At Risk** | Full at-risk pupil list with actions |
| **Classes** | Class-level summary cards and table |
| **Pupil List** | Full Excel-style spreadsheet grid |
| **Pivot** | Cross-tab heatmap analysis |
| **Profile** | Individual pupil profile view |

---

## 5. Global Filters (persistent across all tabs)

Displayed as a filter bar below the tab row.

```
[All year groups ▾] [All classes ▾] [All subjects ▾] [All tracking points ▾] [All risk bands ▾] [🔍 Search pupils, classes, teachers...] [Apply Filters] [Reset]
```

**Advanced filters (expandable panel):**
- Teacher (multi-select)
- Show only: Declining trend | Missing data | Flagged for review
- Score range slider (e.g. 1.0–4.0)
- Date range (tracking point date)
- Save current filter as a named preset

**Filter state:** Persisted in URL query params so filters survive refresh/sharing.

---

## 6. Tab: Overview

### KPI Cards (row of 4)
Each card has: icon, label, large value, sub-label, coloured progress bar.

| Card | Value | Sub-info |
|------|-------|----------|
| Pupils | Count | "X Art · Y Drama" |
| At Risk | Count (red if high) | "X high · Y medium" |
| Average Score | X.XX / 4 | "Across current filtered rows" |
| Coverage | XX% | "X rows without score" |

### Chart Row (3 charts + attention panel)

**1. Average Score by Tracking Point** (line chart, Recharts)
- X axis: Baseline, TP1, TP2, TP3, Latest
- Y axis: 0–4
- Line: Average score (solid blue)
- Line: Target (dashed, configurable — default 3.00)
- Tooltip: shows score + number of pupils at that point
- Click any point → filters Pupil List to that tracking point

**2. Dimension Profile** (horizontal bar chart)
- Dimensions: Creating, Performing, Responding, Analysing, Evaluating
- Each bar coloured by score (red < 2.5, amber 2.5–3.0, green > 3.0)
- Dashed vertical line at target (3.00)
- Hover tooltip with score + % of pupils above target

**3. Risk Breakdown** (donut chart)
- Segments: High (red), Medium (amber), Low (yellow), Secure (green)
- Centre label: total pupils
- Legend with counts + percentages
- Click segment → filters Pupil List to that risk band

**4. Pupils Needing Attention** (panel, right column)
- Top 5 at-risk pupils (sorted by score ascending)
- Each row: avatar initials | Name | Year · Subject | Risk badge | Score
- "View all at risk →" link to At Risk tab

---

## 7. Tab: At Risk

### Layout
Full-width list, grouped by risk band (High → Medium → Low).

### Per-pupil row
```
[Avatar] [Name]           [Year · Class · Teacher]    [Subject]  [Score: 1.45]  [HIGH]  [📋 Note] [🚩 Flag] [👁 View]
```

### Features
- Filter by: Risk band, Subject, Year, Teacher
- Sort by: Score (asc/desc), Name, Year
- "Flag for pastoral review" toggle (saves to Supabase)
- "Add note" button → opens inline text field, saves note with timestamp
- Export filtered list as CSV
- Bulk actions: select multiple → "Flag all" | "Export selected"

---

## 8. Tab: Classes

### Summary Cards View (default)
Grid of cards — one per class. Each card shows:
- Class code (e.g. S3A-Drama)
- Teacher name + avatar initials
- Subject tag
- Pupil count
- Average score (with colour coding)
- Risk count (High: X, Medium: Y)
- Coverage %
- Mini sparkline of average score trend across TPs
- Click → drills to filtered Pupil List for that class

### Table View (toggle)
Sortable, filterable table with columns:
`Class | Subject | Year | Teacher | Pupils | Avg Score | High Risk | Med Risk | Coverage | Last Updated`

- Sort on any column
- Click class name → drill to Pupil List filtered by class
- Click teacher → drill to all classes taught by that teacher

---

## 9. Tab: Pupil List (Spreadsheet / Grid View)

This is the full Excel-style view. Built with **TanStack Table v8**.

### Columns (horizontal scroll)
| Column | Notes |
|--------|-------|
| # | Row number |
| Name | Sortable, clickable → opens Profile |
| Year Group | |
| Class | |
| Teacher | |
| Subject | |
| Baseline | Score + colour cell |
| TP1 | Score + colour cell |
| TP2 | Score + colour cell |
| TP3 | Score + colour cell |
| Latest | Score + colour cell |
| Trend | ↑ ↓ → icon based on Baseline→Latest delta |
| Risk Band | Colour badge |
| Coverage | % bar |
| Notes | 📝 icon if note exists |
| Flagged | 🚩 if flagged |

### Cell colour coding
- Score < 2.0 → red background (light)
- Score 2.0–2.9 → amber background
- Score 3.0–3.4 → light green
- Score ≥ 3.5 → green

### Features
- **Sticky first column** (Name) on horizontal scroll
- **Sticky header row** on vertical scroll
- **Column visibility toggle** — hide/show columns
- **Sort** on any column (click header)
- **Filter** inline (below header row, per column) OR via global filter bar
- **Row click** → opens Pupil Profile drawer (right-side panel, doesn't navigate away)
- **CSV Export** — exports current filtered/sorted view
- **Pagination** — 25/50/100 rows per page selector
- **Row count** displayed top-right ("Showing 47 of 331 pupils")

---

## 10. Tab: Pivot

Cross-tabulation analysis view.

### Heatmap: Class × Tracking Point
- Rows: classes
- Columns: Baseline, TP1, TP2, TP3, Latest
- Cells: average score, colour-coded
- Hover: tooltip with score + pupil count

### Heatmap: Year Group × Subject
- Quick view of how each year group performs across subjects

### Teacher Overview table
- One row per teacher
- Columns: Teacher | Subjects | Classes | Pupils | Avg Score | At Risk Count | Coverage
- (Faculty Head view only — can be toggled off in Settings)

---

## 11. Tab / Drawer: Pupil Profile

Opened as a right-side drawer (slides in from right, 480px wide) when a pupil row is clicked anywhere in the app.

### Sections

**Header**
- Large avatar initials (coloured by risk)
- Name, Year, Class, Teacher, Subject
- Risk badge + current score

**Score Trend Chart**
- Line chart: Baseline → TP1 → TP2 → TP3 → Latest
- Shows pupil line vs class average line vs target
- Recharts, small height (~150px)

**Dimension Breakdown**
- Radar/spider chart OR horizontal bars
- Creating, Performing, Responding, Analysing, Evaluating scores

**Tracking Point History Table**
- Simple table: TP | Score | Date | Teacher | Change (delta)

**Notes & Flags**
- Chronological list of notes (timestamp + author)
- Add note text field + submit
- Flagged status toggle

**Related Pupils**
- "Others in this class" mini list (top 3 by risk)
- "Others at this risk level in this subject" mini list

---

## 12. Data Sources & Supabase Schema

### Tables needed (extend existing schema):

**`pupils`**
- id, name, year_group, created_at

**`classes`**
- id, code, subject, year_group, teacher_id

**`class_enrolments`**
- pupil_id, class_id, session_year

**`tracking_points`**
- id, class_id, label (Baseline/TP1/TP2/TP3/Latest), date

**`scores`**
- id, pupil_id, tracking_point_id, score (float 1.0–4.0), dimension (nullable — for dimension breakdown), created_at

**`pupil_flags`**
- id, pupil_id, flagged_by, flagged_at, note, resolved

**`pupil_notes`**
- id, pupil_id, body, author_id, created_at

**`risk_bands`** (computed, not stored — derived from latest score)
- High: score < 2.0
- Medium: 2.0–2.5
- Low: 2.5–3.0
- Secure: ≥ 3.0

---

## 13. Data Loading

- On mount: fetch all pupils, enrolments, classes, tracking points, scores for current session
- Apply filters client-side (fast, no re-fetch needed) using React state + TanStack Table filtering
- "Refresh" button re-fetches from Supabase
- "Load from cloud" — alternative for bulk CSV import from school MIS (parse with PapaParse)
- "Save" — saves current filter preset + view state to Supabase user preferences
- **Last updated** timestamp displayed in footer
- **Data quality** indicator: flags if any class has >10% missing scores

---

## 14. Permissions / Role Gating

- **Faculty Head (Richie):** sees all classes, all teachers, all tabs including Pivot teacher overview
- **Class Teacher:** sees only their own classes in Pupil List and Classes tab; At Risk filtered to their classes; cannot see other teachers' data
- Role stored in Supabase `profiles.role` field (existing auth)

---

## 15. Responsive / Device Notes

- Primary use: desktop/laptop browser (school network)
- Secondary: iPad (teachers may use in class)
- Mobile: not a priority, but sidebar should collapse to hamburger on narrow viewports
- Print view: Overview tab only, optimised for A4 landscape

---

## 16. Component File Structure (suggested)

```
/src
  /components
    /tracking
      TrackingHub.jsx          ← parent, handles tab routing + global filter state
      GlobalFilterBar.jsx
      OverviewTab.jsx
      AtRiskTab.jsx
      ClassesTab.jsx
      PupilListTab.jsx         ← TanStack Table grid
      PivotTab.jsx
      PupilProfileDrawer.jsx
      /charts
        ScoreTrendChart.jsx
        DimensionProfileChart.jsx
        RiskBreakdownDonut.jsx
        MiniSparkline.jsx
      /cards
        KpiCard.jsx
        ClassCard.jsx
        AtRiskRow.jsx
```

---

## 17. Stretch Features (phase 2)

- **Automated email digest** — weekly at-risk summary to each teacher (Supabase Edge Function + Resend)
- **Target setting** — per-class configurable target line on charts
- **Progress commentary** — teacher adds a narrative comment per tracking point per class
- **SQA grade mapping** — convert 1–4 internal score to estimated grade (N4 pass, N5 A/B/C, etc.)
- **Historical sessions** — toggle between 2025–26 and 2024–25 data for trend analysis
- **Parent-facing view** — read-only score summary (if parent portal ever implemented)

---

*Spec version 1.0 — June 2026*
*Richie McColm, Faculty Head, Expressive Arts, Knightswood Secondary*
