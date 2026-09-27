---
name: My Week
description: The teacher's weekly control centre inside the Faculty Hub.
colors:
  navy-900: "#0f1a30"
  navy-800: "#152340"
  navy-700: "#1e2d4a"
  navy-600: "#2a3f62"
  navy-500: "#3a527c"
  navy-400: "#5a6a85"
  navy-200: "#c9d2e0"
  navy-100: "#e2e8f0"
  navy-050: "#f4f6fb"
  art-600: "#b85820"
  art-100: "#fbe9dd"
  drama-600: "#2f64bf"
  drama-500: "#4a7fd4"
  drama-100: "#dfeaf9"
  photo-600: "#7547d6"
  photo-100: "#ebe2fb"
  ink-900: "#0b1220"
  ink-700: "#1f2937"
  ink-500: "#475569"
  ink-400: "#64748b"
  danger-600: "#b91c1c"
  danger-100: "#fee2e2"
  white: "#ffffff"
typography:
  display:
    fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.6rem"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.05rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.2rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: "normal"
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "normal"
rounded:
  sm: "6px"
  md: "10px"
  lg: "14px"
spacing:
  3: "0.75rem"
  4: "1rem"
  6: "1.5rem"
components:
  button-primary:
    backgroundColor: "{colors.navy-700}"
    textColor: "{colors.white}"
    rounded: "{rounded.md}"
    padding: "0 0.85rem"
    height: "44px"
    typography: "{typography.label}"
  button-ghost:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink-700}"
    rounded: "{rounded.md}"
    padding: "0 0.85rem"
    height: "44px"
    typography: "{typography.label}"
  card:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink-900}"
    rounded: "{rounded.lg}"
    padding: "0.9rem 1rem 1rem"
  chip-art:
    backgroundColor: "{colors.art-100}"
    textColor: "{colors.art-600}"
    rounded: "{rounded.sm}"
    padding: "0.05rem 0.35rem"
    typography: "{typography.label}"
  chip-drama:
    backgroundColor: "{colors.drama-100}"
    textColor: "{colors.drama-600}"
    rounded: "{rounded.sm}"
    padding: "0.05rem 0.35rem"
    typography: "{typography.label}"
  chip-photo:
    backgroundColor: "{colors.photo-100}"
    textColor: "{colors.photo-600}"
    rounded: "{rounded.sm}"
    padding: "0.05rem 0.35rem"
    typography: "{typography.label}"
---

# Design System: My Week

## Overview

**My Week: the teacher's weekly control centre inside the Faculty Hub.**

This screen is not a separate product. It uses the Faculty Hub system in `design-tokens.css` and the repo `DESIGN.md`: navy shell, pale page, white cards, Manrope for titles, Inter for UI. Subject colour appears only when a task or faculty item is specifically Art, Drama, or Photography.

The standalone page wraps the module in a preview sidebar so it can be judged inside the hub. That sidebar is not part of My Week state. The module is `.my-week-module`. Inside the Teacher Planner it is the My Week tab, loaded with `?embed=1`, which hides that preview shell. The planner's lesson Week tab stays separate.

Progress means tasks completed. It is not a teacher score, a rating, or a compliance measure. Routines belong to the individual teacher.

**Key Characteristics:**

- Knightswood navy sidebar, `navy-050` page, white cards
- One filled action on the week view: Quick Add (`navy-700`)
- Four summary cards, then five day columns
- Subject chips only from class codes such as `5DRA1`, `4ART2`, and `5PHOTO1`
- Personal tasks, faculty events, timetable, linked hub tasks, routines, and weekly focus stay separate

## Colors

Roles match the Faculty Hub. This file does not invent a second palette.

### Primary

- **Knightswood Navy** (`navy-900` to `navy-050`): Sidebar (`navy-900`), active nav (`navy-600`), primary button (`navy-700`), page wash (`navy-050`), hairlines (`navy-100`), week bars and rings (`navy-700` on a `navy-100` track).

### Secondary

- **Stage Blue** (`drama-600` / `drama-100`): Drama chips, and the keyboard focus ring. Not a general accent.

### Tertiary

- **Kiln Terracotta** (`art-600` / `art-100`): Art chips and an Art faculty dot.
- **Studio Violet** (`photo-600` / `photo-100`): Photography chips and a Photography faculty dot.

### Neutral

- **Ink** (`ink-900` body, `ink-500` secondary, `ink-400` dates and empty days)
- **Paper** (`white` cards, sheet, and secondary buttons)
- **Danger** (`danger-600` / `danger-100`): delete and form errors only

### Named Rules

**The Subject Is The Job Rule.** Terracotta, Stage Blue, and Studio Violet name the subject of a task or deadline. The week overview stays navy. A low percentage is not red, and a finished day is not green.

**The One Voice Rule.** Quick Add is the filled action on this screen. Week navigation, Edit, Add task, and Settings stay white with a `navy-100` border.

## Typography

**Display Font:** Manrope, self-hosted in `my-week/fonts`, then ui-sans-serif
**Body Font:** Inter, self-hosted, then ui-sans-serif

No serif, no handwriting, and no second display face. Caveat stays out of this screen.

### Hierarchy

- **Display** (700, 1.6rem): "My Week".
- **Headline** (700, 1.05rem): Card titles such as This week's focus, Week at a glance, Faculty this week, My routines, and the day names.
- **Title** (700, 1.2rem): The focus sentence and the side-sheet title.
- **Body** (400, 0.9375rem): Supporting copy. Task titles sit slightly smaller, about 0.86rem.
- **Label** (500–600, 0.65–0.8125rem): Buttons, chips, dates, and the task-type labels My task, Faculty, and Linked.

## Layout

The preview shell is a fixed 248px sidebar. The module is capped at 1280px with 1.5rem page padding.

The summary row is four cards: focus, week at a glance, faculty, routines. Below that, unfinished tasks from last week stay in their own card until the teacher moves or dismisses them. Then Monday to Friday sit in one row.

At about 1100px the summary becomes two by two. At about 1080px the days become three plus two. Below 860px the sidebar slides off-canvas behind a Menu button. Below 720px the days stack and the sheet becomes full width. The page does not scroll sideways as a spreadsheet.

iPad landscape and desktop are the primary scene. Touch targets for week controls, task checks, Add task, and sheet actions are 44px. The routine matrix is denser so the five days stay in view.

## Elevation & Depth

Cards rest with a 1px `navy-100` border and `0 1px 2px rgba(15, 26, 48, 0.06)`. Hover on a secondary button may lift 1px. The side sheet and task menu use `0 12px 32px rgba(15, 26, 48, 0.12)`. There is no paper grain, no desk, and no binding.

## Shapes

Cards are 14px. Buttons and the active nav item are 10px. Chips and inputs are 6px. Rings are circles because they are rings. Corners are even.

## Components

### Sidebar

Preview only. Brand reads KSS, Faculty Hub, Art · Drama · Photography. Idle items are white at about 68% opacity. My Week is `navy-600` with solid white text and icon. The footer names Knightswood Secondary School and the Faculty of Creative Arts.

### Week header

Manrope title, then the date range and term on one Inter line. Previous week, Today, and Next week are secondary. Quick Add is the navy fill.

### Focus

A navy vertical rule sits beside the focus sentence. Edit stays a secondary button. The sentence is stored per week. A short supporting line appears only for the sample sentence, and it is not a stored field.

### Week at a glance

Five vertical navy bars and one SVG ring. The ring sits beside the bars when the card is wide enough, and under them when it is not, so the day percentages stay readable. The ring and the day rings share the navy stroke. Counts read "done" and "remaining". They are not a score.

### Faculty this week

Read-only. A dot is terracotta, blue, or violet only when the event title names Art, Drama, or Photography. Other items use navy. An empty Friday says "No faculty deadlines" and has no dot. These events are not part of task totals.

### Routines

A personal matrix, Monday to Friday, with an n/5 count. Checks are navy. There is no red, amber, or green.

### Day cards

White card, day and full date, a small navy ring, then tasks. Completed titles keep a muted strike and stay readable. Chips: My task, Faculty, and Linked are quiet navy-tinted labels. Subject chips use the subject palette and only appear when a class code supports them.

### Sheet

One dialog for Quick Add, edit, day detail, settings, and linked-task information. On a wide screen it is a right-hand white drawer. On a phone it is full width. Day detail lists the timetable, then the same task rows. There is no theme picker. Settings keeps the current week, show routines, and compact cards.

### Named Rules

**The Module Boundary Rule.** Personal tasks, faculty events, timetable, linked hub tasks, routines, and weekly focus are injected separately. The preview sidebar does not own any of them. Opening a linked task dispatches `facultyHubNavigate` with `{ area, id }`.

## Do's and Don'ts

### Do

- **Do** keep navy as the interface colour and subject colour as context.
- **Do** use Manrope for titles and Inter for tasks, chips, and controls.
- **Do** leave Quick Add as the filled action on the week view.
- **Do** keep the preview shell removable from `.my-week-module`.
- **Do** treat progress as a count of the teacher's own tasks.

### Don't

- **Don't** bring back the paper diary: grain, punch holes, serif titles, lime highlighter, or crooked corners.
- **Don't** colour a day ring by percentage, or call the ring productivity.
- **Don't** invent a subject chip when the task has no class code.
- **Don't** mix faculty calendar items into personal task completion.
- **Don't** add a second theme. This screen inherits the Faculty Hub.

## School work variant (`?school=1`)

School work is the same module run as the faculty-wide task sheet in the hub. It reads as a week-planner sheet, and the week leads.

- **Order:** header; a top row with the one-line focus strip on the left and the Week at a glance tile on the right; the carry-forward row (only when something is unfinished); the five days; then a margin row with the Quality calendar (2.4fr) and My Professional Learning Plan (1fr). The summary row and the Faculty this week card are not shown.
- **Week at a glance** is a dark navy tile: five bars and the week ring in a pale blue fill, today's bar white, holiday days hatched and labelled Closed. It is a count of the teacher's own tasks, not a score.
- **Faculty dates live in the day.** Academic calendar items sit at the top of the day they fall on, as tinted rows that open the calendar. Holidays mark the whole day instead.
- **Day cards are navy tiles** matching the glance tile: white titles, white-outlined ticks that fill pale blue (#9ec0f0) when done, soft white dividers and a dashed add line. Today is a lighter navy (navy-700) with a pale-blue top edge and a pale-blue Today pill. A holiday is a hatched slate tile with a dashed edge. Subject, QI and faculty-date chips stay light so they read as pills on the navy. The day sheet and Quick Add stay light.
- **One count per day card.** "1 of 3 done" or "All done". The percentages live only in the glance tile.
- **Add task is the next blank line** of a list (dashed rule, no box), in days and in the plan.
- **Colour:** navy for every action. Burnt red (`--important`, #a33a26) is the one warm colour: the Important pill, the Important choice in Quick Add, and the carry-forward edge. Subject colour stays on Art, Drama and Photography chips only.
- **Quality calendar:** condensed to three dense columns under the week. Each row leads with its QI code in the hub's QI colours (1.3 navy, 2.3 teal, 3.1 violet, 3.2 amber), with a round + to add it. The card is a bold deep-teal tile (#0b4f4a), the partner of the navy glance tile, with white text. On it the QI colours switch to light versions (1.3 #c9d4ea, 2.3 #8fe3d6, 3.1 #cfb8ff, 3.2 #ffc98a) for the codes, a 5px band across the top split by how many items each QI has that month, a legend naming each code, and a meter beside the count of items on the teacher's list. Items already added show their day, or Done.
- **Faculty dates are tinted by type:** reporting and assessment warm red, meetings mauve, INSET and planning blue.
- **Page wash:** a soft blue-grey gradient behind the header, fading into the navy-050 page.
