# Senior Phase Tracking System (development preview)

Standalone module — **not** connected to Faculty Hub. Data in browser `localStorage` (`spt-dev-v2`).

## Open

```bash
npx serve . -l 4173
```

**http://localhost:4173/dev/senior-phase-tracking/index.html**

Use a local server so CSS and CSV import work correctly.

## New in v2

- **Setup / Cohort** — add teachers, classes, pupils, enrolments, prior exam results
- **Alerts** — open teacher concern flags; resolve by linking or creating an intervention
- **Teacher flags** — staff flag with comment; flagged pupils sort to top; Faculty Head resolves only
- **Attendance** — score 1–4 per tracking period (3 TPs per year) on course pages
- **Prelim marks** — per-course components (e.g. Higher Drama written + practical); enter raw marks inline on the course grid; weighted % and grade update automatically
- **Prior attainment** — previous results including “Crashed / withdrew”

## Roles (simulated)

| Role | Setup | Flag | Resolve flags | Import |
|------|-------|------|---------------|--------|
| Faculty Head | Yes | Yes | Yes | Yes |
| Class Teacher | No | Yes (own classes) | No | No |
| Read Only | No | No | No | No |

## Reset

**Reset development data** reloads sample pupils (includes 2 open flags for testing Alerts).
