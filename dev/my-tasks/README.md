# My Tasks — Development Preview

Standalone preview of the **redesigned My Tasks workspace**. Not connected to Faculty Hub or Supabase — data lives in browser `localStorage` (`my-tasks-dev-v1`).

Production [`teacher_tasks.html`](../../teacher_tasks.html) uses this design. This dev preview remains available for testing without sign-in.

## Open

Use a local server (required for CSS and scripts):

```bash
npx serve . -l 4173
```

Then open:

**http://localhost:4173/dev/my-tasks/index.html**

## What's included

- KPI summary cards (Total, Due Today, This Week, Completed)
- Search, filters, and sort bar (sticky)
- Kanban board: To Do · In Progress · Waiting · Completed
- Premium task cards with priority pills, checklists, metadata icons
- Right-side detail drawer (Details / Checklist / Notes)
- Drag-and-drop between columns
- Overdue strip at the bottom

## Sample data

On first visit, sample tasks load automatically (including one overdue item, one due today, and one completed).

Use **Load sample data** in the dev banner to reset, or **Clear data** to start empty.

## Applying to production

When you're happy with the preview, the redesigned files can replace:

- `teacher_tasks.html`
- `teacher-tasks-service.js`
- `teacher-tasks-ui.js`
- `teacher-tasks.css` (new)
- Minor updates to `faculty-hub.html` home quick-add

All of those changes are kept in this dev folder until you ask to apply them.
