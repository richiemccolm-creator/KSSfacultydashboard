# Cursor Brief — Academic Year Rollover for the Drama & Art Trackers

**Purpose:** Explain what is actually going on with tracker data, and give Cursor a precise, safe set of tasks to make the 25‑26 → 26‑27 rollover work. Read the whole "The issue" section before writing any code.

**Applies to both trackers.** `drama-tracker.html` (`data_type = 'drama-v3'`) and `art-tracker.html` (`data_type = 'art-v2'`) are structurally identical: same in‑memory shape `S`, same `pupils[yg][className]` layout, same shared helpers (`tracker-promote-archive.js`, `class_management_tracker.js`, `data-service.js`). Anything below that mentions `drama-v3` applies equally to `art-v2`. Do not fork the logic per subject — the subject is already parameterised (`dataTypeForSubject(subject)` in `class_management_tracker.js`).

---

## The issue (read this first)

There is **not** one tangled data model. There are **two parallel models**, and they don't share a pupil identity. That mismatch — not "class name tangled with tracking data" — is what makes the data feel mixed up and makes rollover fragile.

### Model A — the tracker blob (what the trackers actually use)

Each teacher's entire tracker is stored as **one JSONB document** in Supabase table `pupil_data`, one row per `(user_id, data_type)`. Inside that document (`S`):

```
S.pupils[yg][className]      → [ { id, name }, ... ]      // id is a LOCAL throwaway id (uid())
S.scores[yg][pupilId][tpId][dimension]                    // TP1–TP6 × Progress/Effort/Behaviour/Home Learning
S.profiles[yg][pupilId]                                    // profile + trackingHistory snapshots
S.archived[yg][className]                                  // promoted/retired classes, kept read-only
```

- `yg` is `s1` / `s2` / `s3` (a top-level bucket, **not** a field on the pupil).
- **Scores are keyed to `pupilId`, not to the class name.** So renaming a class is safe — scores follow the pupil. (This corrects a common assumption: class renaming is *not* the risky part.)
- **The class is identified by its name string** (`className`). Renaming = moving the object to a new key.
- The whole blob is scoped to one teacher (the row's `user_id`). "A new teacher takes over a class" = moving that class object from one teacher's `pupil_data` row into another's.

### The one real weakness in Model A

**`pupilId` is not stable across years.** When a class is promoted (`promoteClass` / `promoteHandoverToState`), the code **mints a brand-new `uid()` for every pupil** in the new year group and copies the previous year's scores in as a frozen snapshot under `profiles[yg][newId].trackingHistory[fromYg]`. History is preserved by **copying a snapshot**, not by a shared key. So a pupil has no single identifier that survives S1 → S2 → S3.

### Model B — the normalised roster schema (already exists server-side)

The class-management side already uses a proper relational schema — essentially the "ideal" model:

- Tables: `academic_years`, `classes`, `class_teacher_assignments`, and pupils with real UUIDs + `external_id` (accessed via RPCs).
- A full rollover pipeline **already exists** as Postgres functions: `preview_promotion_run`, `commit_promotion_run`, `bulk_upsert_pupils_and_enrollments`, `assign_classes_to_teachers`, `detect_existing_class_conflicts`, `list_my_assigned_classes_for_tracker`.

### Why it feels "mixed up"

1. **Two identities per child.** The roster has a real pupil UUID / `external_id`; the tracker mints a local `uid()`. The same pupil exists in both, unlinked. The bridge (`syncRosterClass` → `upsert_teacher_subject_classes_for_loader`) only syncs the *class label*, not pupil identity.
2. **The live schema is undocumented.** `supabase/migrations/` only contains `pupil_data`, `profiles`, `class_visits`, calendar/purchase tables. **None** of the `academic_years` / `classes` / promotion‑RPC objects are in migrations — they were created directly in the Supabase SQL editor. So the repo does not describe the database that is actually running.

---

## Guardrails — do NOT do these

- **Do not write a migration that creates `academic_years`, `classes`, `class_teacher_assignments`, or any `*_promotion_run` function from scratch.** They already exist in the live DB. Recreating them risks clobbering live data. Capture the real schema first (Task 1).
- **Do not change the `pupil_data` shape or the `S` structure** without a migration path for existing blobs — every teacher already has live data in the old shape.
- **Do not rekey `scores` to class name.** They are correctly keyed to `pupilId`. Leave that.
- **Do not fork drama vs art logic.** Keep the subject parameterised.

---

## Rollover = three operations (and where each already lives)

| Operation | Tracker (Model A) | Roster (Model B) |
|---|---|---|
| (a) Promote pupils S1→S2, S2→S3 | `TrackerPromoteArchive.promoteClass` / `ClassManagementTracker.promoteAndAssign` | `preview_promotion_run` + `commit_promotion_run` |
| (b) Reassign a class to a new teacher | `transferClass` / `promoteAndAssign` with `toUserId ≠ fromUserId` | `assign_classes_to_teachers` |
| (c) Drop pupils not continuing (e.g. not taking Drama into S3) | **not implemented** — must add | exclude from the promotion run |

Preserving S1 history (requirement 1) already happens: promotion snapshots the prior year into `trackingHistory` and archives the source class into `S.archived`. Do not rebuild that — reuse it.

---

## Tasks for Cursor (in order)

### Task 1 — Capture the live schema (blocking; do this before any SQL)
The repo doesn't document the live DB. Run this in the Supabase SQL editor and commit the output as `supabase/migrations/<timestamp>_capture_existing_schema.sql` (as documentation of what already exists — guard every object with `IF NOT EXISTS` / `CREATE OR REPLACE` so it is safe to re-run):

```sql
select table_name, column_name, data_type, is_nullable
from information_schema.columns
where table_schema='public' order by table_name, ordinal_position;

select routine_name, data_type as returns
from information_schema.routines
where routine_schema='public' order by routine_name;
```

Also dump the definitions of the promotion RPCs (`preview_promotion_run`, `commit_promotion_run`, `bulk_upsert_pupils_and_enrollments`, `assign_classes_to_teachers`, `detect_existing_class_conflicts`) with `pg_get_functiondef` so their real signatures are known before wiring anything to them.

### Task 2 — Add the "not continuing" drop rule (requirement 2)
Non-continuing pupils must be **excluded from promotion**, but their prior-year history must remain in the archive. Implement in the tracker path:

- In `class_management_tracker.js` `promoteAndAssign` / `tracker-promote-archive.js` `promoteClass`, add an optional `excludePupilIds` (or `continuingPupilIds`) option.
- Filter the handover pupil list **before** building `newPupils`, so excluded pupils are never created in the target year group.
- Still archive the **full** source class (including excluded pupils) so S1–S2 scores are retained in `S.archived`.
- Excluded pupils simply do not appear in the new S2/S3 class. No inactive tag needed (per current decision).

### Task 3 — Handle the teacher takeover
For a class changing teacher (e.g. "1A 25‑26" becomes an S2 class under a new teacher), use `promoteAndAssign` / `transferClass` with `toUserId` = the new teacher's `user_id`. Confirm the source teacher's copy is archived (not left as a live duplicate) and `syncRosterClass` updates the roster label under the new academic year.

### Task 4 — Verify history survives (requirement 1)
After a test promotion, assert that each promoted pupil in the new year group has `profiles[yg][newId].trackingHistory[fromYg]` populated with the prior scores, and that the source class exists under `S.archived[fromYg]`.

### Task 5 (optional, larger) — Stable pupil identity
The root fix for "no key survives rollover": have the tracker adopt the roster's pupil UUID / `external_id` instead of minting a local `uid()`, so one identity spans S1→S3 and links Model A to Model B. Only attempt this after Tasks 1–4 and once the schema dump confirms how roster pupils are exposed to the tracker. Requires a data-migration to map existing local ids → roster UUIDs; do not do it blind.

---

## Acceptance criteria
- Promotion excludes non-continuing pupils from the new class but keeps their history in `S.archived`.
- Promoted pupils carry a `trackingHistory` snapshot of the prior year.
- A class can move to a new teacher with the source archived, no live duplicate.
- Drama (`drama-v3`) and Art (`art-v2`) both work through the same code path.
- No migration recreates already-live tables/functions; the live schema is captured as documentation.
