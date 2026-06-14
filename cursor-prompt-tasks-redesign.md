# Cursor Prompt — My Tasks Redesign

## What I want you to do

Redesign `teacher_tasks.html` and `teacher-tasks.css` to look like a modern SaaS product (think Linear, Notion, Asana). The page is a Kanban task manager for school staff.

**Only modify `teacher_tasks.html` and `teacher-tasks.css`. Do not touch any JS files.**

---

## HARD RULES — read these first

1. Do NOT change any element IDs (e.g. `kpiTotal`, `taskBoard`, `taskDrawer`, `drawerSave`) — JavaScript depends on them
2. Do NOT remove any HTML elements — only add extra wrapper divs or spans where instructed
3. Do NOT change any `data-` attributes
4. Do NOT modify any `.js` files
5. Board columns and task cards are rendered by JavaScript — check `teacher-tasks-ui.js` to confirm the exact class names it applies, then style those classes in CSS
6. Check what CSS class the JS adds when opening the drawer (likely `is-open`) and use that for the open state

---

## HTML changes — `teacher_tasks.html`

### 1. KPI cards
Each card currently only has a value and a label. Add a `.kpi-sub` subtitle to each:

```html
<!-- kpi-card--total -->
<div class="kpi-value" id="kpiTotal">0</div>
<div class="kpi-label">Total Tasks</div>
<div class="kpi-sub">All active tasks</div>

<!-- kpi-card--today -->
<div class="kpi-value" id="kpiDueToday">0</div>
<div class="kpi-label">Due Today</div>
<div class="kpi-sub">Needs attention</div>

<!-- kpi-card--week -->
<div class="kpi-value" id="kpiThisWeek">0</div>
<div class="kpi-label">This Week</div>
<div class="kpi-sub">Due in the next 7 days</div>

<!-- kpi-card--completed -->
<div class="kpi-value" id="kpiCompleted">0</div>
<div class="kpi-label">Completed</div>
<div class="kpi-sub">This term</div>
```

### 2. Toolbar
Restructure the toolbar into a single visible horizontal row. Move priority and status filters out of the hidden `tasks-toolbar-extra` div and into the main row:

```html
<section class="tasks-toolbar" id="tasksToolbar" aria-label="Search and filters">
  <div class="tasks-toolbar-row">
    <div class="tasks-search-wrap">
      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
      <input type="search" class="tasks-search" id="filterSearch" placeholder="Search tasks…" aria-label="Search tasks">
    </div>
    <select class="tasks-select" id="filterPriority" aria-label="Filter by priority">
      <option value="all">All Priorities</option>
      <option value="high">High</option>
      <option value="normal">Medium</option>
      <option value="low">Low</option>
    </select>
    <select class="tasks-select" id="filterStatus" aria-label="Filter by status">
      <option value="all">All Statuses</option>
      <option value="todo">To Do</option>
      <option value="in_progress">In Progress</option>
      <option value="waiting">Waiting</option>
      <option value="completed">Completed</option>
    </select>
    <button type="button" class="btn-filter-toggle" id="btnFilterMore" aria-expanded="false">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/></svg>
      Filters
    </button>
    <select class="tasks-select tasks-select--sort" id="filterSort" aria-label="Sort tasks">
      <option value="due">Sort: Due Date</option>
      <option value="priority">Sort: Priority</option>
      <option value="updated">Sort: Recently Updated</option>
      <option value="title">Sort: Title A–Z</option>
    </select>
  </div>
  <!-- Keep tasks-toolbar-extra for bucket, category, due date filters -->
  <div class="tasks-toolbar-extra" id="toolbarExtra">
    <span class="toolbar-field-label">Bucket</span>
    <select class="tasks-select" id="filterBucket" aria-label="Filter by bucket">
      <option value="all">All buckets</option>
    </select>
    <span class="toolbar-field-label">Category</span>
    <select class="tasks-select" id="filterCategory" aria-label="Filter by category">
      <option value="all">All categories</option>
    </select>
    <span class="toolbar-field-label">Due date</span>
    <select class="tasks-select" id="filterDue" aria-label="Filter by due date">
      <option value="all">Any</option>
      <option value="has">Has due date</option>
      <option value="none">No due date</option>
    </select>
  </div>
</section>
```

### 3. Secondary controls
Wrap the view tabs and buckets section so they are less prominent:
```html
<div class="tasks-secondary-controls">
  <!-- move tasks-view-tabs nav here -->
  <!-- move tasks-buckets section here -->
</div>
```

---

## CSS — completely rewrite `teacher-tasks.css`

Keep all existing class names. Replace all rules with the following design system.

### Design tokens
```css
:root {
  --font: 'Inter', sans-serif;
  --bg: #f8f9fb;
  --surface: #ffffff;
  --border: #e5e7eb;
  --border-light: #f3f4f6;
  --text-primary: #111827;
  --text-secondary: #6b7280;
  --text-muted: #9ca3af;
  --blue: #3b82f6;
  --blue-light: #eff6ff;
  --red: #ef4444;
  --red-light: #fef2f2;
  --amber: #f59e0b;
  --amber-light: #fffbeb;
  --green: #22c55e;
  --green-light: #f0fdf4;
  --purple: #8b5cf6;
  --radius-sm: 6px;
  --radius: 10px;
  --radius-lg: 14px;
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
  --shadow: 0 4px 12px rgba(0,0,0,0.08);
  --shadow-lg: 0 8px 24px rgba(0,0,0,0.10);
}
```

### Page
```css
body.tasks-body {
  background: var(--bg);
  font-family: var(--font);
  color: var(--text-primary);
  margin: 0;
  min-height: 100vh;
}

main.tasks-workspace {
  max-width: 1600px;
  margin: 0 auto;
  padding: 0 32px 64px;
}
```

### Header
```css
.tasks-hero {
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  position: sticky;
  top: 0;
  z-index: 100;
}

.tasks-hero-shell {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 32px;
  height: 64px;
  max-width: 1600px;
  margin: 0 auto;
}

.tasks-hero-start {
  display: flex;
  align-items: center;
  gap: 16px;
}

.tasks-logo-img { width: 32px; height: 32px; border-radius: var(--radius-sm); }

.tasks-nav { display: flex; gap: 4px; }

.tasks-nav-link {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
  text-decoration: none;
  padding: 6px 10px;
  border-radius: var(--radius-sm);
  transition: background 0.15s, color 0.15s;
}
.tasks-nav-link:hover { background: var(--border-light); color: var(--text-primary); }
.tasks-nav-link svg { width: 15px; height: 15px; stroke: currentColor; fill: none; stroke-width: 2; }

.tasks-hero-divider { width: 1px; height: 24px; background: var(--border); }

.tasks-hero-identity { display: flex; align-items: center; gap: 10px; }

.tasks-hero-icon {
  width: 36px; height: 36px;
  background: var(--blue-light);
  color: var(--blue);
  border-radius: var(--radius-sm);
  display: flex; align-items: center; justify-content: center;
}
.tasks-hero-icon svg { width: 18px; height: 18px; stroke: currentColor; fill: none; stroke-width: 2; }

.tasks-hero-title { font-size: 16px; font-weight: 700; margin: 0; }
.tasks-hero-subtitle { font-size: 12px; color: var(--text-muted); margin: 0; }

.btn-add-task-primary {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--blue);
  color: #fff;
  border: none;
  border-radius: var(--radius-sm);
  padding: 9px 18px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, transform 0.15s;
}
.btn-add-task-primary:hover { background: #2563eb; transform: translateY(-1px); }
.btn-add-task-primary svg { width: 16px; height: 16px; stroke: currentColor; fill: none; stroke-width: 2.5; }
```

### KPI cards
```css
.tasks-kpi {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  padding: 28px 0 20px;
}

.kpi-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 24px;
  display: flex;
  align-items: flex-start;
  gap: 16px;
  box-shadow: var(--shadow-sm);
  transition: transform 0.15s, box-shadow 0.15s;
}
.kpi-card:hover { transform: translateY(-2px); box-shadow: var(--shadow); }

.kpi-icon {
  width: 44px; height: 44px;
  border-radius: var(--radius);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.kpi-icon svg { width: 20px; height: 20px; stroke: currentColor; fill: none; stroke-width: 2; }

.kpi-icon--total   { background: var(--blue-light);  color: var(--blue); }
.kpi-icon--today   { background: var(--red-light);   color: var(--red); }
.kpi-icon--week    { background: var(--amber-light); color: var(--amber); }
.kpi-icon--completed { background: var(--green-light); color: var(--green); }

.kpi-content { display: flex; flex-direction: column; gap: 2px; }
.kpi-value { font-size: 32px; font-weight: 700; line-height: 1; color: var(--text-primary); }
.kpi-label { font-size: 14px; font-weight: 600; color: var(--text-primary); margin-top: 4px; }
.kpi-sub   { font-size: 12px; color: var(--text-muted); }
```

### Toolbar
```css
.tasks-toolbar {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 14px 16px;
  margin-bottom: 20px;
  box-shadow: var(--shadow-sm);
}

.tasks-toolbar-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.tasks-search-wrap {
  flex: 1;
  min-width: 200px;
  position: relative;
}
.tasks-search-wrap svg {
  position: absolute; left: 10px; top: 50%; transform: translateY(-50%);
  width: 16px; height: 16px; stroke: var(--text-muted); fill: none; stroke-width: 2;
}
.tasks-search {
  width: 100%;
  padding: 9px 12px 9px 34px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: 13px;
  color: var(--text-primary);
  background: var(--bg);
  box-sizing: border-box;
}
.tasks-search:focus { outline: 2px solid var(--blue); border-color: transparent; }

.tasks-select {
  height: 38px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: 13px;
  padding: 0 12px;
  background: var(--surface);
  color: var(--text-primary);
  cursor: pointer;
}
.tasks-select--sort { min-width: 150px; }

.btn-filter-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 38px;
  padding: 0 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
  white-space: nowrap;
}
.btn-filter-toggle svg { width: 14px; height: 14px; stroke: currentColor; fill: none; stroke-width: 2; }
.btn-filter-toggle:hover { background: var(--border-light); color: var(--text-primary); }

.tasks-toolbar-extra {
  display: none;
  align-items: center;
  gap: 10px;
  padding-top: 12px;
  flex-wrap: wrap;
}
.tasks-toolbar-extra.is-open { display: flex; }
.toolbar-field-label { font-size: 12px; font-weight: 600; color: var(--text-secondary); }
```

### Secondary controls (view tabs + buckets)
```css
.tasks-secondary-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}

.tasks-view-tabs { display: flex; gap: 4px; }
.tasks-view-tab {
  font-size: 13px; font-weight: 500;
  padding: 6px 14px;
  border-radius: var(--radius-sm);
  border: 1px solid transparent;
  background: none;
  color: var(--text-secondary);
  cursor: pointer;
}
.tasks-view-tab.is-active {
  background: var(--surface);
  border-color: var(--border);
  color: var(--text-primary);
  font-weight: 600;
  box-shadow: var(--shadow-sm);
}
```

### Kanban board
```css
.tasks-board {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  align-items: start;
  margin-bottom: 32px;
}

/* Column — JS renders these; check teacher-tasks-ui.js for exact class name */
.board-col {
  background: var(--border-light);
  border-radius: var(--radius-lg);
  padding: 12px;
  min-height: 200px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.board-col-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 4px 10px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 4px;
}

.board-col-title {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  display: flex;
  align-items: center;
  gap: 8px;
}

/* Colour dot before title */
.board-col-title::before {
  content: '';
  width: 8px; height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.board-col--todo .board-col-title::before       { background: var(--blue); }
.board-col--in-progress .board-col-title::before { background: var(--amber); }
.board-col--waiting .board-col-title::before     { background: var(--purple); }
.board-col--completed .board-col-title::before   { background: var(--green); }

.board-col-count {
  background: var(--border);
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 700;
  border-radius: 20px;
  padding: 2px 8px;
}

.board-col-body {
  overflow-y: auto;
  max-height: 580px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-right: 2px;
}

.board-col-add {
  font-size: 13px;
  color: var(--text-muted);
  padding: 8px 4px;
  text-align: center;
  border-radius: var(--radius-sm);
  border: none;
  background: none;
  width: 100%;
  cursor: pointer;
}
.board-col-add:hover { background: rgba(59,130,246,0.06); color: var(--blue); }
```

### Task cards
```css
.task-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-left: 3px solid transparent;
  border-radius: var(--radius);
  padding: 14px;
  box-shadow: var(--shadow-sm);
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.15s;
}
.task-card:hover { transform: translateY(-1px); box-shadow: var(--shadow); }

.task-card--high   { border-left-color: var(--red); }
.task-card--normal { border-left-color: var(--amber); }
.task-card--low    { border-left-color: var(--blue); }

.task-card-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 8px;
  line-height: 1.4;
}

.task-card-due {
  font-size: 12px;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 8px;
}
.task-card-due svg { width: 12px; height: 12px; stroke: currentColor; fill: none; stroke-width: 2; }

.task-card-footer {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
  font-size: 12px;
  color: var(--text-muted);
  flex-wrap: wrap;
}
.task-card-footer svg { width: 12px; height: 12px; stroke: currentColor; fill: none; stroke-width: 2; }

/* Priority badges */
.priority-pill {
  display: inline-flex;
  align-items: center;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 20px;
}
.priority-pill--high   { background: var(--red-light);   color: var(--red); }
.priority-pill--normal { background: var(--amber-light); color: var(--amber); }
.priority-pill--low    { background: var(--blue-light);  color: var(--blue); }
```

### Task detail drawer
```css
.task-drawer {
  position: fixed;
  right: 0; top: 0;
  height: 100vh;
  width: 420px;
  background: var(--surface);
  border-left: 1px solid var(--border);
  box-shadow: var(--shadow-lg);
  z-index: 200;
  display: flex;
  flex-direction: column;
  transform: translateX(100%);
  transition: transform 0.25s ease;
}
.task-drawer.is-open { transform: translateX(0); }

.task-drawer-head {
  padding: 20px 24px 16px;
  border-bottom: 1px solid var(--border);
}
.task-drawer-head-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.task-drawer-title-input {
  font-size: 18px;
  font-weight: 700;
  border: none;
  outline: none;
  width: 100%;
  color: var(--text-primary);
  padding: 0;
  background: transparent;
}

.task-drawer-close {
  width: 32px; height: 32px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--border-light);
  font-size: 18px;
  color: var(--text-secondary);
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.task-drawer-close:hover { background: var(--border); color: var(--text-primary); }

.task-drawer-tabs {
  display: flex;
  border-bottom: 1px solid var(--border);
  padding: 0 24px;
}
.task-drawer-tab {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
  padding: 12px 4px;
  margin-right: 20px;
  border: none;
  border-bottom: 2px solid transparent;
  background: none;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
}
.task-drawer-tab.is-active {
  color: var(--blue);
  font-weight: 600;
  border-bottom-color: var(--blue);
}

.task-drawer-body { flex: 1; overflow-y: auto; padding: 20px 24px; }

.task-drawer-panel { display: none; }
.task-drawer-panel.is-active { display: block; }

.task-drawer-foot {
  padding: 16px 24px;
  border-top: 1px solid var(--border);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

/* Form elements inside drawer */
.form-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 16px; }
.form-group { margin-bottom: 16px; }
.form-label {
  display: block;
  font-size: 11px;
  font-weight: 700;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 6px;
}
.form-input, .form-select, .form-textarea {
  width: 100%;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 9px 12px;
  font-size: 14px;
  color: var(--text-primary);
  background: var(--surface);
  box-sizing: border-box;
  font-family: var(--font);
}
.form-input:focus, .form-select:focus, .form-textarea:focus {
  outline: 2px solid var(--blue);
  border-color: transparent;
}
.form-textarea { resize: vertical; min-height: 100px; }

.btn-attachment-add {
  font-size: 13px;
  color: var(--blue);
  border: 1px dashed var(--border);
  border-radius: var(--radius-sm);
  padding: 8px 14px;
  background: none;
  cursor: pointer;
  width: 100%;
  text-align: left;
  margin-top: 8px;
}
.btn-attachment-add:hover { background: var(--blue-light); border-color: var(--blue); }

.btn-drawer-delete {
  font-size: 14px;
  font-weight: 500;
  color: var(--red);
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
}
.btn-drawer-delete:hover { text-decoration: underline; }

.btn-drawer-save {
  background: var(--blue);
  color: #fff;
  border: none;
  border-radius: var(--radius-sm);
  padding: 10px 24px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}
.btn-drawer-save:hover { background: #2563eb; }

.task-drawer-backdrop {
  display: none;
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.3);
  z-index: 199;
}
.task-drawer-backdrop.is-visible { display: block; }
```

### Overdue section
```css
.tasks-overdue {
  background: #fff8f8;
  border: 1px solid #fee2e2;
  border-radius: var(--radius-lg);
  padding: 20px 24px;
  margin-top: 8px;
}

.tasks-overdue-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.tasks-overdue-header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}
.tasks-overdue-header-left svg {
  width: 18px; height: 18px;
  stroke: var(--red); fill: none; stroke-width: 2;
}
.tasks-overdue-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--red);
  margin: 0;
}
.tasks-overdue-view-all {
  font-size: 13px;
  font-weight: 500;
  color: var(--red);
  background: none;
  border: none;
  cursor: pointer;
  text-decoration: none;
}
.tasks-overdue-view-all:hover { text-decoration: underline; }

.tasks-overdue-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 12px;
}

/* Overdue cards inherit .task-card styles — add overdue-specific overrides */
.task-card--overdue {
  background: #fff;
  border-left-color: var(--red);
}
.task-card-overdue-badge {
  font-size: 11px;
  font-weight: 600;
  color: var(--red);
  margin-top: 4px;
}
```

### Checklist (inside drawer)
```css
.checklist-progress-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.checklist-progress-bar {
  height: 6px;
  background: var(--border-light);
  border-radius: 3px;
  margin-bottom: 16px;
  overflow: hidden;
}
.checklist-progress-fill {
  height: 100%;
  background: var(--green);
  border-radius: 3px;
  transition: width 0.3s ease;
}
.checklist-progress-pct { font-size: 13px; font-weight: 600; color: var(--text-secondary); }

.checklist-rows { display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px; }

.btn-checklist-add {
  font-size: 13px;
  color: var(--blue);
  background: none;
  border: 1px dashed var(--border);
  border-radius: var(--radius-sm);
  padding: 8px 14px;
  cursor: pointer;
  width: 100%;
  text-align: left;
}
.btn-checklist-add:hover { background: var(--blue-light); border-color: var(--blue); }
```

### Toast
```css
.tasks-toast {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%) translateY(20px);
  background: #1f2937;
  color: #fff;
  font-size: 14px;
  font-weight: 500;
  padding: 12px 20px;
  border-radius: var(--radius);
  box-shadow: var(--shadow-lg);
  opacity: 0;
  transition: opacity 0.2s, transform 0.2s;
  pointer-events: none;
  z-index: 9999;
}
.tasks-toast.is-visible { opacity: 1; transform: translateX(-50%) translateY(0); }
```

### Responsive
```css
@media (max-width: 1024px) {
  .tasks-board { grid-template-columns: repeat(2, 1fr); }
  .tasks-kpi   { grid-template-columns: repeat(2, 1fr); }
  .task-drawer { width: 100vw; }
}

@media (max-width: 640px) {
  main.tasks-workspace { padding: 0 16px 48px; }
  .tasks-board { grid-template-columns: 1fr; }
  .tasks-kpi   { grid-template-columns: repeat(2, 1fr); }
  .tasks-hero-shell { padding: 0 16px; }
}
```

---

## Final checklist before you finish

- [ ] Open the page in a browser and check it renders without JS errors
- [ ] Confirm the board columns, task cards, and drawer still open/close correctly
- [ ] Confirm the KPI numbers still update dynamically
- [ ] Confirm the search and filter selects still work
- [ ] Check layout on a narrower window (iPad simulation ~1024px)
- [ ] Make sure the "Add Task" button and "Save Changes" button are clearly visible and styled
