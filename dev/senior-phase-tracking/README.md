# Senior Phase Tracking System (development preview)

Standalone module — **not** connected to Faculty Hub. Data in browser `localStorage` (`spt-dev-v2`).

## Open

```bash
npx serve . -l 4173
```

**http://localhost:4173/dev/senior-phase-tracking/index.html**

Use a local server so CSS and CSV import work correctly.

## New in v5

- **Mark setup panel** — at the top of each class sheet: set **Paper total** and **Scaled to** per component (Written, Practical, S3 exam)
- **N5 Drama defaults** — Written 60 → 40 (70%), Practical /60 (30%); staff can adjust e.g. if essay section was not completed
- **Exam mark entry** — enter raw marks per pupil; **%** and **grade (A–F)** columns update automatically

## New in v4

- **S3 entry baseline** — S3 exam, effort, behaviour, HL, progress, CfE level for N5 pupils (admin editable, teachers read-only)
- **Prior entry columns** — prior exam grade and pathway (incl. Crashed / withdrew) for Higher/AH courses
- **Evidence Bank scoped** — N3/N4 pupils, Creative Industries, Film & Screen only; official SQA unit codes
- **Course grid** — level-aware columns: S3 baseline, unit evidence, or exam/prelim per pupil
- **Setup → baseline** tab for Faculty Head bulk entry

## New in v2

- **Setup / Cohort** — add teachers, classes, pupils, enrolments, prior exam results
- **Alerts** — unified concern register: **Open** (red, newest first) → **Ongoing** (amber) → **Resolved** (green, archived at bottom for review)
- **Teacher flags** — pick a category (attendance, effort, behaviour, deadlines, attainment, level change, etc.) and describe the concern; faculty head is alerted
- **Concern updates** — feedback loop for teachers and faculty head; see new actions on flags and add follow-up notes
- **Close concern** — faculty head marks **Resolved** or **No further action required** from the intervention trail to remove the flag from tracking
- **S3 baseline risk** — risk colour activates from S3 entry baseline on N5/N4 course sheets (exam, effort, behaviour, CfE level)
- **Intervention trail** — chronological record of support actions; add follow-up notes from the Interventions page or pupil profile
- **Attendance** — score 1–4 per tracking period (3 TPs per year) on course pages
- **Prelim marks** — per-course components (e.g. Higher Drama written + practical); enter raw marks inline on the course grid; weighted % and grade update automatically
- **Prior attainment** — previous results including “Crashed / withdrew”

## Roles (simulated)

| Role | Setup | Flag | Take action on alerts | Concern updates | Add intervention notes | Import |
|------|-------|------|----------------------|-----------------|------------------------|--------|
| Faculty Head | Yes | Yes | Yes | Yes (teacher follow-ups) | Yes | Yes |
| Class Teacher | No | Yes (own classes) | No | Yes (FH actions on your flags) | Yes (own pupils) | No |
| Read Only | No | No | No | No | View only | No |

## Reset

**Reset development data** reloads sample pupils (includes open, ongoing, and resolved flags for testing Alerts).
