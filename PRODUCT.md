# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Faculty heads and school managers are the primary users of Class Management. They open it to create classes and pupil lists for Art and Drama teachers so those teachers never do that setup themselves.

[Inferred from Faculty Hub copy] The wider Faculty Hub is also used by Art, Drama, and Photography teachers for day-to-day tracking, planning, and teaching workflows. Class Management itself stays a head/admin job.

## Product Purpose

Faculty Hub is the signed-in workplace for Knightswood Secondary School’s Art & Drama faculty. It exists so staff can run classes, tracking, planning, and faculty operations from one place instead of scattered files and tracker pages.

Class Management’s job is narrower: the faculty head builds each teacher’s BGE class list, then sends it to that teacher’s Art or Drama tracker. Success is a teacher opening their tracker and already seeing the right classes and pupils.

## Positioning

Class lists are an administrative act, not a teacher chore. The faculty head is the source of truth; the tracker is the place teaching happens. Neighbouring school systems can store classes. This product’s claim is that teachers do not set up their own Art and Drama BGE lists.

## Operating Context

Staff sign in through the Faculty Hub allowlist. Class Management is used at the start of a session and when groups change: load classes from the faculty timetable, add or paste pupil names, save a draft, then send to the live tracker. It also runs inside Faculty Hub as an embed (`class_management.html?embed=1`).

Work is organised by academic year and subject (Art or Drama). BGE years in this flow are S1–S3. Transfer and promote exist for moving a live class between teachers or up a year. Teachers then work in the Art or Drama tracker, not in Class Management.

## Capabilities and Constraints

Confirmed in the live app:

- Faculty heads/admins only for Class Management.
- Per-teacher Art and Drama workspaces: add class codes, paste names, import a spreadsheet grouped by teacher email, load unique S1–S3 Art/Drama classes from the faculty timetable, save a cloud draft, send to the tracker with a diff, load existing tracker pupils back into the list.
- Move or promote live tracker classes.
- Preserve existing page IDs, Supabase RPCs, and tracker/roster save-push contracts. Do not introduce a new framework or rebuild the data layer.
- Do not fabricate pupil names, class codes, attainment claims, or school evidence.

[Inferred from the implementation brief] The repo is independent HTML/CSS/JS pages plus Supabase, not a single-page app framework.

Undecided: whether Photography class lists should ever follow the same faculty-head setup path as Art and Drama.

## Brand Commitments

- Product name: Faculty Hub.
- School: Knightswood Secondary School.
- Faculty: Art & Drama (Expressive Arts). Photography is a third subject in the hub.
- Logo: `faculty-hub-logo.png`.
- Voice: professional staff English. UI copy must not use em dashes.
- Binding from the product owner: keep Faculty Hub identity (navy, Art terracotta, Drama blue, General Sans). Visual expansion belongs in design work, not here.

## Evidence on Hand

Real operational data and assets only: staff lists, faculty timetable (`faculty-timetable-data.js`), class and pupil records in Supabase, tracker class state, and `faculty-hub-logo.png`. Internal improvement-plan and HGIOS material exists in the hub for school use.

There are no marketing testimonials, press quotes, or external case studies. Future work must not invent them.

## Product Principles

1. Teachers teach; faculty heads administer class lists.
2. The tracker the teacher sees is the live list; a draft is not that list until it is sent.
3. Subject (Art vs Drama) is part of the job, not a badge.
4. Preserve working contracts: RPCs, IDs, and tracker behaviour outrank visual novelty.
5. School data is evidence, not decoration. Do not invent pupils, results, or claims.

## Accessibility & Inclusion

No formal compliance target was confirmed. The surface is staff-facing. Future work should remain keyboard-usable and must not treat accessibility as optional chrome, but must not claim a WCAG level that has not been agreed.
