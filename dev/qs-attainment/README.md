# QS Attainment — DEV sandbox

Safe testbed for SQA / component-marks experiments. **Production** lives at `qs-attainment-dashboard.html` (Faculty Hub iframe) and already includes the promoted import / Over Time / SIMD fixes.

## Open

Open from the repo root (so auth / Supabase scripts resolve):

[`../../qs-attainment-dashboard-DEV.html`](../../qs-attainment-dashboard-DEV.html)

## Test flow

1. Drop your faculty QS workbook for the **new** session (component national averages can be blank; history sheet optional).
2. When prompted, choose **OK** to bring forward historical component marks from Hub — or later use **Hub history…** / Data → **Bring forward hub history…**.
3. Drop the **QS Component Marks Report** (e.g. `SQA Component Marks Aug 2026.xlsx`) — Art, Drama and Photography pupil marks are imported for the session year (25-26 from an Aug 2026 filename).
4. Drop the SQA **Assessment and Component Marks** tables workbook (e.g. `assessment-marks-tables-2026.xlsx`) to fill national means.
5. Check **Components** and **Over Time** — prior years plus **25-26** (cohort + national bars) should appear.

## Safety

- **Save to Hub is disabled** in this DEV build so you cannot overwrite live hub snapshots.
- Hub **read** (open year / bring forward history) still works when signed in.
- Download snapshot still works for a local copy.
- Production file: `qs-attainment-dashboard.html` (Hub: `qs-attainment-dashboard.html?embed=1`)
