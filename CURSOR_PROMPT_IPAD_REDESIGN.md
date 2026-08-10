# Cursor Prompt: iPad App UX Redesign for Teacher Planner

**Copy this entire prompt and paste it into Cursor**

---

## Full Prompt to Copy/Paste

```
I need to redesign the Teacher Planner to be iPad-friendly (one-screen experience, no excessive scrolling).

## Key Changes Required:

### PART 1: TODAY VIEW - Remove Weekly Overview Grid
File: teacher_planner.html
Action: Delete lines 3370-3378 (the entire "Weekly overview" panel section)

Current code to DELETE (find and remove):
```html
<section class="today-panel today-week-panel">
  <header class="today-panel-header">
    <div><h2>Weekly overview</h2></div>
    <button type="button" id="todayViewFullWeek" class="today-panel-link">View full timetable</button>
  </header>
  <div class="today-week-scroll">
    <div class="today-week-grid" role="grid" aria-label="Weekly timetable overview">[...]</div>
  </div>
</section>
```

Why: This section duplicates the Week view and forces scrolling on iPad. Deleting it frees ~250px of vertical space.

### PART 2: Add iPad Breakpoint to CSS
File: teacher-planner-redesign.css

Action: Add this entire @media block at the end of the file (before the closing brace if there is one, or just append it):

```css
/* ───────────────────────────────────────────
   iPad/Tablet Optimizations (768px - 1023px)
   ─────────────────────────────────────────── */

@media (max-width: 1023px) {

  /* ───── CONTENT PADDING ───── */
  .planner-redesign .content {
    padding: 0.5rem 1rem 1rem;  /* Reduce from 1rem 1.35rem 2rem */
  }

  /* ───── TODAY DASHBOARD ───── */

  /* Compress hero section */
  .planner-redesign #panel-today .today-hero {
    padding: 14px 20px;  /* Reduce from 26px 32px */
    grid-template-columns: 1fr;  /* Stack to single column */
    gap: 12px;  /* Reduce from 24px */
    min-height: auto;
  }

  /* Hide time panel on hero (room/school shown in topbar) */
  .planner-redesign #panel-today .today-hero-meta {
    display: none;
  }

  /* Reduce heading size */
  .planner-redesign #panel-today .today-heading {
    font-size: clamp(1.5rem, 2.5vw, 1.8rem);  /* Reduce from clamp(2rem, 3vw, 2.8rem) */
  }

  .planner-redesign #panel-today .today-summary {
    font-size: 0.95rem;  /* Reduce from 1.05rem */
  }

  /* Compact action buttons */
  .planner-redesign #panel-today .today-action {
    min-height: 36px;  /* Reduce from 42px */
    padding: 0.4rem 0.9rem;  /* Reduce from 0.55rem 1rem */
    font-size: 0.78rem;  /* Reduce from 0.84rem */
  }

  /* ───── METRICS GRID ───── */

  /* Change from 4 columns to 2x2 */
  .planner-redesign #panel-today .today-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;  /* Reduce from 14px */
  }

  .planner-redesign #panel-today .today-metric-card {
    min-height: 76px;  /* Reduce from 96px */
    padding: 0.75rem 0.9rem;  /* Reduce from 1.05rem 1.15rem */
  }

  .planner-redesign #panel-today .today-metric-label {
    font-size: 0.75rem;  /* Reduce from 0.78rem */
  }

  .planner-redesign #panel-today .today-metric-value {
    font-size: 1.5rem;  /* Reduce from 2rem */
  }

  /* ───── DASHBOARD GRID ───── */

  /* Stack main + sidebar vertically */
  .planner-redesign #panel-today .today-dashboard-grid {
    grid-template-columns: 1fr;
    gap: 8px;  /* Reduce from 16px */
  }

  /* Make sidebar 2-column */
  .planner-redesign #panel-today .today-sidebar {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  .planner-redesign #panel-today .today-progress-panel {
    grid-column: 1 / -1;
  }

  .planner-redesign #panel-today .today-notes-panel {
    grid-column: 1 / -1;
  }

  /* ───── LESSONS LIST ───── */

  /* Multi-column lessons display */
  .planner-redesign #panel-today .today-lessons-list {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 6px;
  }

  .planner-redesign #panel-today .today-lesson-item {
    grid-template-columns: auto 1fr;  /* Simplify from 3-column */
    gap: 8px;  /* Reduce from 10px */
    padding: 0.45rem 0.6rem;  /* Reduce from 0.55rem 0.7rem */
  }

  .planner-redesign #panel-today .today-lesson-period {
    width: 1.9rem;
    height: 1.9rem;
    font-size: 0.65rem;
  }

  .planner-redesign #panel-today .today-lesson-class {
    font-size: 0.78rem;
  }

  .planner-redesign #panel-today .today-lesson-title {
    font-size: 0.75rem;
  }

  .planner-redesign #panel-today .today-lesson-unit {
    font-size: 0.65rem;
  }

  /* Compact lesson actions */
  .planner-redesign #panel-today .today-lesson-side {
    width: auto;
    flex-direction: row;
    align-items: center;
    gap: 0.2rem;
  }

  .planner-redesign #panel-today .today-lesson-status {
    font-size: 0.6rem;
    min-height: 1.3rem;
    padding: 0.1rem 0.3rem;
  }

  .planner-redesign #panel-today .today-lesson-action {
    min-height: 30px;
    padding: 0.25rem 0.45rem;
    font-size: 0.65rem;
  }

  /* ───── PANEL HEADERS ───── */

  .planner-redesign #panel-today .today-panel-header {
    gap: 0.5rem;
    margin-bottom: 0.65rem;
  }

  .planner-redesign #panel-today .today-panel-header h2 {
    font-size: 1rem;
  }

  /* ───── PROGRESS PANEL ───── */

  .planner-redesign #panel-today .today-progress-layout {
    grid-template-columns: 1fr;
    justify-items: center;
    gap: 12px;
  }

  .planner-redesign #panel-today .today-progress-ring {
    width: 80px;
    height: 80px;
  }

  .planner-redesign #panel-today .today-progress-ring-inner {
    width: 60px;
    height: 60px;
  }

  .planner-redesign #panel-today .today-progress-ring-inner strong {
    font-size: 1rem;
  }

  /* ───── NOTES PANEL ───── */

  .planner-redesign #panel-today .today-note-card textarea {
    min-height: 4rem;
    font-size: 0.82rem;
  }

  /* ───── WEEK DASHBOARD ───── */

  /* Compress hero section */
  .planner-redesign #panel-week .week-hero {
    padding: 12px 16px;  /* Reduce from 14px 22px */
    grid-template-columns: 1fr;  /* Stack on iPad */
    gap: 8px;  /* Reduce from 12px */
  }

  /* Hide time panel */
  .planner-redesign #panel-week .week-hero-meta {
    display: none;
  }

  .planner-redesign #panel-week .week-heading {
    font-size: clamp(1.4rem, 2.5vw, 1.75rem);  /* Reduce from clamp(2rem+) */
  }

  .planner-redesign #panel-week .week-summary {
    font-size: 0.88rem;
  }

  .planner-redesign #panel-week .week-action {
    min-height: 34px;
    padding: 0.35rem 0.75rem;
    font-size: 0.75rem;
  }

  /* ───── WEEK DASHBOARD GRID ───── */

  /* Stack vertically */
  .planner-redesign #panel-week .week-dashboard-grid {
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .planner-redesign #panel-week .week-sidebar {
    gap: 8px;
  }

  /* ───── WEEK TIMETABLE ───── */

  /* Show 3-day view on iPad (Mon-Wed visible, scroll for Thu-Fri) */
  .planner-redesign #panel-week .week-timetable-grid {
    grid-template-columns: 60px repeat(3, minmax(130px, 1fr));
    min-width: auto;  /* Fit container instead of forcing scroll */
    gap: 0;
  }

  /* Reduce cell sizes */
  .planner-redesign #panel-week .week-grid-corner {
    min-height: 56px;
    padding: 8px;
    font-size: 0.65rem;
  }

  .planner-redesign #panel-week .week-day-header {
    min-height: 56px;
    padding: 8px;
    font-size: 0.65rem;
  }

  .planner-redesign #panel-week .week-period-cell {
    min-height: 80px;
    padding: 8px;
    font-size: 0.75rem;
  }

  .planner-redesign #panel-week .week-lesson-cell {
    min-height: 80px;
    padding: 6px;
  }

  .planner-redesign #panel-week .week-lesson-class {
    font-size: 0.75rem;
  }

  .planner-redesign #panel-week .week-lesson-title {
    font-size: 0.7rem;
  }

  /* ───── MODAL DIALOGS ───── */

  .planner-redesign .modal {
    max-width: min(90vw, 500px);  /* Use more screen width */
  }

  .planner-redesign .modal-wide-lesson {
    max-width: min(95vw, 700px);
  }

  .planner-redesign .modal-header {
    padding: 1rem 1.25rem;
  }

  .planner-redesign .modal-body {
    padding: 1rem;
  }

  .planner-redesign .modal-footer {
    padding: 0.8rem 1.25rem;
    gap: 0.5rem;
  }

  /* ───── FORM ELEMENTS ───── */

  .planner-redesign .form-label {
    font-size: 0.65rem;
    margin-bottom: 0.25rem;
  }

  .planner-redesign .form-group {
    margin-bottom: 0.75rem;
  }

  .planner-redesign .btn-primary,
  .planner-redesign .btn-secondary {
    min-height: 40px;
    padding: 0.5rem 1rem;
    font-size: 0.78rem;
  }

  /* ───── TABS ───── */

  .planner-redesign .tab-btn.planner-tab {
    padding: 0.6rem 0.8rem;
    font-size: 0.8rem;
    min-height: 40px;
  }

}

/* ───── Small Tablet (600px - 767px) ───── */

@media (max-width: 767px) {

  .planner-redesign #panel-today .today-sidebar {
    grid-template-columns: 1fr;
  }

  .planner-redesign #panel-today .today-lessons-list {
    grid-template-columns: 1fr;
  }

  .planner-redesign #panel-week .week-timetable-grid {
    grid-template-columns: 50px repeat(2, 1fr);  /* Show only 2 days */
  }

}
```

## Summary of Changes

**TODAY VIEW:**
1. Delete the "Weekly overview" grid panel (8 lines)
2. Hero: compressed padding, stack to 1 column, hide time panel
3. Metrics: 2x2 grid instead of 4 columns
4. Dashboard: stack main + sidebar vertically
5. Sidebar: 2-column card layout
6. Lessons: multi-column grid (2 across on iPad)

**WEEK VIEW:**
1. Hero: compressed, stack to 1 column, hide time panel
2. Timetable: show 3-day view (Mon-Wed) instead of full 5-day
3. Dashboard: stack sidebar below vertically
4. Cells: smaller fonts, reduced padding

## Result

✅ Today view: Everything fits on iPad screen without scroll
✅ Week view: No horizontal scroll on timetable (shows 3 days, can scroll to see Thu-Fri)
✅ One-screen iPad app experience
✅ No changes to HTML structure (except deleting 8 lines)
✅ No JavaScript changes needed

## Testing on iPad

After applying these changes, test on actual iPad in portrait orientation:
- [ ] Hero + metrics + all today's lessons visible without scrolling
- [ ] No horizontal scroll on main content
- [ ] Sidebar below main content, optionally scrollable
- [ ] Week view timetable shows 3 days without horizontal scroll
- [ ] All buttons are tap-friendly (44px+ minimum)
- [ ] Modals fit within screen with padding

Let me know if you need clarification on any changes.
```

---

## End of Prompt

---

## How to Use This

1. **Copy the entire code block above** (from the triple backticks)
2. **Paste into Cursor chat**
3. **Cursor will implement the changes**

---

## What Cursor Will Do

Cursor should:
1. ✅ Delete lines 3370-3378 from `teacher_planner.html`
2. ✅ Add the @media CSS block to `teacher-planner-redesign.css`
3. ✅ Verify no syntax errors
4. ✅ Apply all iPad optimizations

---

## If You Want to Do It Manually

If Cursor doesn't implement perfectly, here are the two files to edit:

### File 1: teacher_planner.html
- Find lines ~3370-3378
- Delete this section:
```html
<section class="today-panel today-week-panel">
  <header class="today-panel-header">
    <div><h2>Weekly overview</h2></div>
    <button type="button" id="todayViewFullWeek" class="today-panel-link">View full timetable</button>
  </header>
  <div class="today-week-scroll">
    <div class="today-week-grid" role="grid" aria-label="Weekly timetable overview">[...]</div>
  </div>
</section>
```

### File 2: teacher-planner-redesign.css
- Go to end of file
- Paste the entire `@media (max-width: 1023px)` block

Done!
