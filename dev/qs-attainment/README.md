# QS Attainment — DEV sandbox

Safe testbed for SQA / component-marks experiments. **Production** lives at `qs-attainment-dashboard.html` (Faculty Hub iframe) and already includes the promoted import / Over Time / SIMD fixes.

## Open

Open from the repo root (so auth / Supabase scripts resolve):

[`../../qs-attainment-dashboard-DEV.html`](../../qs-attainment-dashboard-DEV.html)

## Test flow

1. Drop your faculty QS workbook for the **new** session (component national averages can be blank; history sheet optional).
2. When prompted, choose **OK** to bring forward historical component marks **and awarded grades** from Hub — or later use **Hub history…**. Over Time then matches each year’s official results (not mark estimates).
3. Drop the **QS Component Marks Report** (e.g. `SQA Component Marks Aug 2026.xlsx`) — Art, Drama and Photography pupil marks are imported for the session year (25-26 from an Aug 2026 filename).
4. Drop the SQA **Assessment and Component Marks** tables workbook (e.g. `assessment-marks-tables-2026.xlsx`) to fill national means **for the active exam session only** — prior years keep nationals from Component Marks Combined / Hub history.
5. Check **Components** and **Over Time** — prior years plus **25-26** should match the saved Hub year chips for grade %. Then **Save to Hub** (production) so awards stay with the session.

## Calculation notes (post-audit)

- A / A–C rates exclude DNA (band 9) from the denominator — Overview and Over Time aligned.
- School-rank Highest / Equal / Lowest % use **all comparable** pupils (middle included).
- Pre-results review Q&A shows “awaiting awarded grades” instead of fake 100% match.
- Pre-results exits only when ≥80% of non-NPA rows have awarded bands.
- Hub `histAwards` round-trip through Save / open year / HTML snapshot.

## Safety

- **Save to Hub is disabled** in this DEV build so you cannot overwrite live hub snapshots.
- Hub **read** (open year / bring forward history) still works when signed in.
- Download snapshot still works for a local copy.
- Production file: `qs-attainment-dashboard.html` (Hub: `qs-attainment-dashboard.html?embed=1`)
