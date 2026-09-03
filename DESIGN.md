---
name: Faculty Hub
description: Quiet ops console for Knightswood Secondary’s Art and Drama faculty.
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
  art-500: "#c0622a"
  art-100: "#fbe9dd"
  art-050: "#fdf5ef"
  drama-600: "#2f64bf"
  drama-500: "#4a7fd4"
  drama-100: "#dfeaf9"
  drama-050: "#eef4fc"
  photo-600: "#7547d6"
  photo-500: "#8b5cf6"
  photo-100: "#ebe2fb"
  photo-050: "#f5f0fd"
  ink-900: "#0b1220"
  ink-700: "#1f2937"
  ink-500: "#475569"
  ink-400: "#64748b"
  success-600: "#15803d"
  success-100: "#dcfce7"
  warning-600: "#b45309"
  warning-100: "#fef3c7"
  danger-600: "#b91c1c"
  danger-100: "#fee2e2"
  white: "#ffffff"
typography:
  display:
    fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.25rem, 2vw, 1.6rem)"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.2rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.05rem"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "normal"
  handwriting:
    fontFamily: "Caveat, Segoe Script, Bradley Hand, cursive"
    fontSize: "1.05rem"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "0.01em"
rounded:
  sm: "6px"
  md: "10px"
  lg: "14px"
  xl: "20px"
  pill: "9999px"
spacing:
  2: "0.5rem"
  3: "0.75rem"
  4: "1rem"
  6: "1.5rem"
  8: "2rem"
  12: "3rem"
components:
  button-primary:
    backgroundColor: "{colors.navy-700}"
    textColor: "{colors.white}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
    typography: "{typography.label}"
  button-primary-hover:
    backgroundColor: "{colors.navy-600}"
    textColor: "{colors.white}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-900}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
    typography: "{typography.label}"
  button-art:
    backgroundColor: "{colors.art-600}"
    textColor: "{colors.white}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
  button-drama:
    backgroundColor: "{colors.drama-600}"
    textColor: "{colors.white}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
  card:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink-900}"
    rounded: "{rounded.lg}"
    padding: "1.5rem"
  chip-art:
    backgroundColor: "{colors.art-100}"
    textColor: "{colors.art-600}"
    rounded: "{rounded.sm}"
    padding: "0.18rem 0.5rem"
    typography: "{typography.label}"
  chip-drama:
    backgroundColor: "{colors.drama-100}"
    textColor: "{colors.drama-600}"
    rounded: "{rounded.sm}"
    padding: "0.18rem 0.5rem"
    typography: "{typography.label}"
  input:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink-900}"
    rounded: "{rounded.sm}"
    padding: "0.55rem 0.7rem"
    typography: "{typography.body}"
---

# Design System: Faculty Hub

## Overview

**Creative North Star: "The Faculty Register"**

Faculty Hub is a staff register that happens to live in a browser. Lists, years, and subjects are the design. Screens should feel like a well-kept mark book: readable names, obvious next action, no poster chrome.

The live shell is Knightswood Navy. Art and Drama are not accents sprinkled for personality. They are the job. Kiln Terracotta appears when the work is Art. Stage Blue appears when the work is Drama. Studio Violet is Photography. New screens stay quiet and operational: dense enough for August setup, one filled action per view, subject colour only while you are in that subject.

Typography is owned in `design-tokens.css`. Manrope is the heading face. Inter is the body and UI face. Do not add marketing slabs, hover-only actions, or landing-page motion.

**Key Characteristics:**
- Navy shell, paper content, subject colour as context
- Manrope for titles, Inter for UI copy
- One filled action per view
- Flat surfaces until hover, sticky dock, or modal
- 10px to 14px corners, not pills except chips and tab pills already shipped
- Real school data only; no stock photography of pupils

## Colors

A dark school navy holds the building. Subject colours name the room you are in.

### Primary
- **Knightswood Navy** (`navy-900` to `navy-050`): Sidebar, command docks, primary buttons (`navy-700`), hairlines (`navy-100`), page wash (`navy-050`). The register’s furniture.

### Secondary
- **Kiln Terracotta** (`art-600`): Art workspaces, Art chips, Art filled buttons. Use only while the task is Art.
- **Stage Blue** (`drama-600`): Drama workspaces, Drama chips, default focus ring. Use only while the task is Drama.

### Tertiary
- **Studio Violet** (`photo-600`): Photography only. Do not borrow it for Art or Drama screens.

### Neutral
- **Ink** (`ink-900` body, `ink-500` secondary, `ink-400` meta)
- **Paper** (`white` elevated surfaces)
- **Success / Warning / Danger** for live, unsaved, and destructive states only

### Named Rules
**The Subject Is The Job Rule.** Terracotta and Stage Blue are not brand sprinkles. They appear when the faculty head or teacher is in that subject. Overview screens stay navy and paper.

**The One Voice Rule.** On any given screen, at most one filled colour besides navy: Art or Drama or Photography, never two competing fills.

## Typography

**Display Font:** Manrope (ui-sans-serif, system-ui)
**Body Font:** Inter (ui-sans-serif, system-ui)
**Label/Mono Font:** Inter for labels; system ui-monospace for codes and pasted lists only
**Handwriting Font:** Caveat — only for Teacher Planner sticky notes (next-lesson and private notes; material metaphor, not UI chrome)

**Character:** A contemporary staff pair. Manrope carries titles and key numbers. Inter carries navigation, forms, tables, and metadata. Tight tracking on titles, tabular numbers on counts, no display serif. Caveat appears only when a surface must read as handwritten paper.

Tokens live in `design-tokens.css`: `--font-heading`, `--font-body`, `--font-hand`, weights 400–800.

### Hierarchy
- **Display** (700, clamp 1.25rem to 1.6rem, 1.15): Page titles. Wide measure, two lines maximum.
- **Headline** (700, 1.2rem, 1.25): Section titles such as Teachers or Classes.
- **Title** (600, 1.05rem, 1.35): Card names, modal titles.
- **Body** (400, 0.9375rem, 1.5): Instructions and empty states. Prefer short operational sentences.
- **Label** (500, 0.8125rem): Buttons, field labels, chips. Field labels are sentence case, not kicker eyebrows.
- **Handwriting** (600, ~1.05–1.1rem): Sticky notes in Edit Lesson only (next lesson and private).

### Named Rules
**The Two-Face Rule.** Manrope is for headings, branding, and prominent statistics. Inter is for body, navigation, buttons, forms, tables, and metadata. Do not introduce a third UI family for chrome. Caveat is exempt only for the Edit Lesson sticky-note controls.

**The Two-Line Title Rule.** Page titles stay wide and short. Never trap a heading in a narrow column that stacks into a poster.

## Layout

Operate density: sidebar 240–252px navy, content max 1280px, page padding 1.5rem (embed 1.25rem). Group controls tightly; separate chapters with 2rem, not marketing 8rem voids.

Overview: search and filters stick; the teacher list is a dense equal-span grid (`minmax(268px, 1fr)`, `grid-auto-flow: dense`). Workspace: a sticky navy command dock, then a two-column split (classes | pupils) collapsing to one column below 860px. Years S1–S3 stack vertically and stay readable. Touch targets 44px on small screens.

Default filter and default action should answer one question: who still needs work, and what to do next.

## Elevation & Depth

Flat by default. Paper sits on the navy-050 wash with a 1px `navy-100` hairline or no border. Shadows are navy-tinted and appear for state, not decoration.

### Shadow Vocabulary
- **Rest / hover tick** (`0 1px 2px rgba(15,26,48,.06)`): Buttons and cards on hover.
- **Raised** (`0 4px 12px rgba(15,26,48,.08)`): Sticky toolbars.
- **Modal** (`0 12px 32px rgba(15,26,48,.12)`): Dialogs and the navy command dock.
- **Focus** (`0 0 0 3px` Drama 500 at 35%, or the active subject): Keyboard only.

### Named Rules
**The Flat-By-Default Rule.** Surfaces are flat at rest. Shadows appear for hover, sticky docks, and modals.

## Shapes

Gently curved staff controls: 6px fields, 10px buttons, 14px cards, pill only for chips and already-shipped tab strips. No hard offset neo-brutal shadows. No left colour rails on new cards (subject is named in type and fill, not a 3px stripe unless a table row already uses it).

## Components

### Buttons
Refined and restrained. 10px corners, 0.5rem 1rem padding, 500 / 0.875rem.

- **Primary:** Navy 700, white type. One per view. Hover Navy 600, 1px lift.
- **Subject fills:** Art 600 or Drama 600 only inside that subject, white type.
- **Ghost:** Transparent, ink text. Secondary actions (Import, Save draft, Open tracker).
- **Focus:** 3px subject-tinted ring, no grey outline.
- **Disabled:** 45% opacity, no lift.

### Chips
Small rounded (6px) subject or status marks. Art 100 / Art 600, Drama 100 / Drama 600. Selected filters sit on white with a light shadow. Counts are a quieter numeral beside a stable label, not a rewritten title.

### Cards / Containers
14px corners, white on navy-050. Small shadow only on hover. Internal padding 1.5rem. Teacher cards are articles with a name control and separate Art / Drama actions, never a button wrapping buttons.

### Inputs / Fields
White fill, navy-100 border, 6px radius. Focus: white fill, navy-200 or subject ring. Placeholders Navy 400.

### Navigation
Navy sidebar, white at 68% for idle items, solid white when active. Active item Navy 600 fill. Faculty Hub logo is `faculty-hub-logo.png`. In-page tabs may be a white pill strip; hide them while a teacher workspace is open.

### Command dock (signature)
Sticky navy-800 bar in Class Management workspace: teacher, subject toggle, status line, Save ghost, Send filled white. Status language is operational: `Draft · not on tracker`, `On tracker`, `On tracker · unsaved changes`.

## Do's and Don'ts

### Do:
- **Do** keep Faculty Hub identity: Knightswood Navy, Kiln Terracotta, Stage Blue, Manrope headings, Inter UI.
- **Do** use Caveat only on Teacher Planner sticky notes (next lesson and private).
- **Do** put one filled action on a view (Load timetable, Send to tracker).
- **Do** treat Art and Drama as the job: wash, chips, and filled subject controls only in context.
- **Do** write staff English with no em dashes in UI copy.
- **Do** keep skip links, 44px targets, visible focus, and respect reduced motion.

### Don't:
- **Don't** introduce extra UI font families beyond Manrope and Inter (Caveat sticky notes are the only exception).
- **Don't** add gradient slabs, glass for its own sake, GSAP stagger, or hover-only actions.
- **Don't** show stock photos of pupils or invent school evidence.
- **Don't** offer three equal primary buttons for the same job.
- **Don't** nest buttons inside buttons, or clip class names in expanding year columns.
- **Don't** claim a WCAG level that has not been agreed.
