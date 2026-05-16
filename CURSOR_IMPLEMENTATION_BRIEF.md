# Faculty Hub — Cursor Implementation Brief

> **How to use this file.** Paste this whole document into a Cursor chat at the start of a session, then work phase by phase. Each phase is self-contained and ends in a working state — do not skip ahead. Tell Cursor to **stop at the end of each phase** and report what it changed so you can verify before moving on.

---

## 0. Context Cursor needs before touching anything

You are working in the repo `Curriculum Design and Report Builder` — a static-HTML + Supabase faculty hub used by Art and Drama teachers in a secondary school. The codebase is plain HTML / CSS / vanilla JS (no framework), plus Supabase RPCs for data. Pages are independent `.html` documents loaded as iframes or via full-page navigation.

A prior audit identified four root problems. Your job in this brief is to fix them:

1. **Five competing navigation shells** (faculty-hub.html, faculty_head_hub.html, the `fh_*.html` group, the trackers, the tracking_monitoring_hub) cause "double sidebar" bugs and a stitched-together feel.
2. **Class Management is buried** under three layers of chrome and has a broken legacy file (`class_management_hub.html` is six concatenated HTML documents).
3. **Bulk class upload exists but is hidden**. The plumbing in `class_management_hub_v2_app.js` lines 661–846 and `data-service.js` lines 677–747 works — it just needs to be promoted, broadened to CSV, and given a preview step.
4. **No shared design system** — every file redefines colours, fonts, buttons. Subject accent colours (Art, Drama, Photography) are defined but barely used.

### Working rules (non-negotiable)

- **Do not rewrite working logic.** Touch only what each step asks you to touch.
- **Preserve all Supabase calls and RPC names.** The data layer (`data-service.js`, `supabase-init.js`, migrations) is correct — wrap or surface it, do not rebuild it.
- **No new frameworks.** No React, no Vue, no build step. Plain HTML/CSS/JS with `<script type="module">` if needed.
- **No new dependencies beyond what's already in `package.json`.** PapaParse for CSV is OK (it's already loaded on some pages) — if it isn't, add it via CDN, not npm.
- **Every commit must leave the app in a working state.** End each phase by hard-reloading `index.html` and confirming you can log in and reach the main hub.
- **Stop and report at the end of each phase.** Do not chain phases together in one go.

---

## 1. The design system (build this first — every later phase depends on it)

### 1.1 Create `design-tokens.css` in the repo root

This is the single source of truth for colour, type, space, shadow and motion. Every page will link to it before its own stylesheet.

```css
/* design-tokens.css
   The ONE source of truth for visual style.
   No other file should redefine these values. */

:root {
  /* ---------- BRAND PALETTE ---------- */
  --navy-900:#0f1a30;     /* darkest — sidebar bg */
  --navy-800:#152340;
  --navy-700:#1e2d4a;     /* legacy --navy */
  --navy-600:#2a3f62;
  --navy-500:#3a527c;
  --navy-400:#5a6a85;     /* muted ink */
  --navy-200:#c9d2e0;     /* hairline on dark */
  --navy-100:#e2e8f0;     /* hairline on light */
  --navy-050:#f4f6fb;     /* app bg */

  /* ---------- SUBJECT ACCENTS (use these liberally) ---------- */
  --art-600:#b85820;      /* primary */
  --art-500:#c0622a;
  --art-100:#fbe9dd;      /* tint for cards / row stripes */
  --art-050:#fdf5ef;

  --drama-600:#2f64bf;
  --drama-500:#4a7fd4;
  --drama-100:#dfeaf9;
  --drama-050:#eef4fc;

  --photo-600:#7547d6;
  --photo-500:#8b5cf6;
  --photo-100:#ebe2fb;
  --photo-050:#f5f0fd;

  /* ---------- SEMANTIC ---------- */
  --success-600:#15803d;
  --success-100:#dcfce7;
  --warning-600:#b45309;
  --warning-100:#fef3c7;
  --danger-600:#b91c1c;
  --danger-100:#fee2e2;
  --info-600:#0369a1;
  --info-100:#dbeafe;

  /* ---------- NEUTRAL INK ---------- */
  --ink-900:#0b1220;      /* body text */
  --ink-700:#1f2937;
  --ink-500:#475569;      /* secondary text — AA on white */
  --ink-400:#64748b;
  --ink-300:#94a3b8;      /* placeholders */
  --bg:#ffffff;
  --bg-muted:var(--navy-050);
  --bg-elev:#ffffff;

  /* ---------- TYPE ---------- */
  --font-sans:"Inter","General Sans",ui-sans-serif,system-ui,sans-serif;
  --font-display:"General Sans","Inter",sans-serif;
  --font-mono:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;

  --fs-xs:0.75rem;   /* 12 */
  --fs-sm:0.875rem;  /* 14 — table density */
  --fs-base:1rem;    /* 16 — body */
  --fs-md:1.125rem;  /* 18 */
  --fs-lg:1.25rem;   /* 20 */
  --fs-xl:1.5rem;    /* 24 */
  --fs-2xl:1.875rem; /* 30 */
  --fs-3xl:2.25rem;  /* 36 — page hero */

  --lh-tight:1.2;
  --lh-snug:1.35;
  --lh-normal:1.55;

  /* ---------- SPACING (4px scale) ---------- */
  --sp-1:0.25rem; --sp-2:0.5rem;  --sp-3:0.75rem;
  --sp-4:1rem;    --sp-5:1.25rem; --sp-6:1.5rem;
  --sp-8:2rem;    --sp-10:2.5rem; --sp-12:3rem;
  --sp-16:4rem;

  /* ---------- RADIUS ---------- */
  --r-sm:6px; --r-md:10px; --r-lg:14px; --r-xl:20px; --r-pill:9999px;

  /* ---------- SHADOW ---------- */
  --sh-sm:0 1px 2px rgba(15,26,48,.06);
  --sh-md:0 4px 12px rgba(15,26,48,.08);
  --sh-lg:0 12px 32px rgba(15,26,48,.12);
  --sh-ring:0 0 0 3px rgba(74,127,212,.35);  /* focus ring */

  /* ---------- MOTION ---------- */
  --ease:cubic-bezier(.2,.7,.2,1);
  --t-fast:120ms;
  --t-base:200ms;
  --t-slow:320ms;

  /* ---------- LAYOUT ---------- */
  --shell-sidebar-w:240px;
  --shell-topbar-h:64px;
  --max-content:1280px;
}

/* ---------- ELEMENT RESETS (light-touch — don't break legacy pages) ---------- */
html { color-scheme:light; }
body {
  font-family:var(--font-sans);
  color:var(--ink-900);
  background:var(--bg-muted);
  font-size:var(--fs-base);
  line-height:var(--lh-normal);
  -webkit-font-smoothing:antialiased;
}
* { box-sizing:border-box; }

/* ---------- REUSABLE PRIMITIVES ---------- */
.btn {
  display:inline-flex; align-items:center; gap:var(--sp-2);
  padding:var(--sp-2) var(--sp-4);
  border:1px solid var(--navy-100);
  border-radius:var(--r-md);
  background:var(--bg);
  color:var(--ink-900);
  font:500 var(--fs-sm)/1 var(--font-sans);
  cursor:pointer;
  transition:transform var(--t-fast) var(--ease), box-shadow var(--t-fast) var(--ease), background var(--t-fast) var(--ease);
}
.btn:hover { box-shadow:var(--sh-sm); transform:translateY(-1px); }
.btn:focus-visible { outline:none; box-shadow:var(--sh-ring); }

.btn-primary { background:var(--navy-700); color:#fff; border-color:transparent; }
.btn-primary:hover { background:var(--navy-600); }
.btn-art { background:var(--art-600); color:#fff; border-color:transparent; }
.btn-drama { background:var(--drama-600); color:#fff; border-color:transparent; }
.btn-ghost { background:transparent; border-color:transparent; }
.btn-danger { background:var(--danger-600); color:#fff; border-color:transparent; }

.card {
  background:var(--bg-elev);
  border:1px solid var(--navy-100);
  border-radius:var(--r-lg);
  padding:var(--sp-6);
  box-shadow:var(--sh-sm);
}

.badge {
  display:inline-flex; align-items:center; gap:var(--sp-1);
  padding:2px var(--sp-2);
  border-radius:var(--r-pill);
  font:600 var(--fs-xs)/1.4 var(--font-sans);
  background:var(--navy-050); color:var(--navy-700);
}
.badge-art    { background:var(--art-100);    color:var(--art-600); }
.badge-drama  { background:var(--drama-100);  color:var(--drama-600); }
.badge-photo  { background:var(--photo-100);  color:var(--photo-600); }
.badge-success{ background:var(--success-100);color:var(--success-600); }
.badge-warning{ background:var(--warning-100);color:var(--warning-600); }
.badge-danger { background:var(--danger-100); color:var(--danger-600); }

.table {
  width:100%;
  border-collapse:separate;
  border-spacing:0;
  font-size:var(--fs-sm);
}
.table th {
  text-align:left;
  font:600 var(--fs-xs)/1.4 var(--font-sans);
  text-transform:uppercase;
  letter-spacing:.04em;
  color:var(--ink-500);
  padding:var(--sp-3) var(--sp-4);
  background:var(--bg-muted);
  border-bottom:1px solid var(--navy-100);
}
.table td {
  padding:var(--sp-3) var(--sp-4);
  border-bottom:1px solid var(--navy-100);
  vertical-align:middle;
}
.table tr:hover td { background:var(--navy-050); }
.table tr.row-art    td:first-child { box-shadow:inset 3px 0 0 var(--art-500); }
.table tr.row-drama  td:first-child { box-shadow:inset 3px 0 0 var(--drama-500); }
.table tr.row-photo  td:first-child { box-shadow:inset 3px 0 0 var(--photo-500); }

/* ---------- A11Y ---------- */
:focus-visible { outline:2px solid var(--drama-500); outline-offset:2px; }
.sr-only {
  position:absolute; width:1px; height:1px; padding:0;
  margin:-1px; overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; border:0;
}
```

### 1.2 Action

- **Create** `design-tokens.css` at the repo root with the contents above.
- **Do not** modify any page yet. The next phase wires it in.

**Stop and report.**

---

## 2. The unified shell

Right now five different sidebars coexist. We collapse them into one. Approach: a single `<faculty-shell>` web component (a custom element — no framework needed) that every page mounts inside. The component reads `data-active` to highlight the current nav item.

### 2.1 Information architecture (the only sidebar that should exist after this phase)

```
LOGO  Faculty Hub
────────────────────────────
DASHBOARDS
  •  Overview                 → faculty-hub.html
  •  Tracking & Monitoring    → tracking_monitoring_hub.html

TRACKERS
  •  Art Tracker              → art-tracker.html
  •  Drama Tracker            → drama-tracker.html

PLANNING
  •  Quality Calendar         → Quality_Calendar_Planner_v2.html
  •  Curriculum Units         → (link curriculum-units.js host page)
  •  Teacher Planner          → teacher_planner.html
  •  Teacher Tasks            → teacher_tasks.html

OPERATIONS
  •  Class Management         → class_management.html  (NEW canonical page — see Phase 3)
  •  Announcements            → fh_announcements.html
  •  Department Meetings      → fh_department_meetings.html
  •  Purchase Orders          → purchase_orders.html
  •  Class Visits             → class-visit-feedback.html

ADMIN (faculty heads only — feature-flagged via existing role check)
  •  Staff                    → fh_staff.html
  •  Calendar Manager         → fh_calendar.html
  •  Settings                 → (hide for now if no page exists)
────────────────────────────
[User avatar]  Richie · Logout
```

### 2.2 Create `faculty-shell.js`

Drop-in custom element that renders the sidebar + topbar and yields a `<main>` slot for page content. Mount via `<faculty-shell active="class-management">...page content...</faculty-shell>`.

```js
// faculty-shell.js — one shell to rule them all.
// Usage:
//   <link rel="stylesheet" href="design-tokens.css">
//   <link rel="stylesheet" href="faculty-shell.css">
//   <script src="faculty-shell.js" type="module"></script>
//   <faculty-shell active="class-management" page-title="Class Management">
//     <!-- page content here -->
//   </faculty-shell>

const NAV = [
  { group: "Dashboards", items: [
    { id:"overview",   label:"Overview",              href:"faculty-hub.html",                icon:"home" },
    { id:"tracking",   label:"Tracking & Monitoring", href:"tracking_monitoring_hub.html",    icon:"chart" },
  ]},
  { group: "Trackers", items: [
    { id:"art",        label:"Art Tracker",   href:"art-tracker.html",   icon:"palette", accent:"art" },
    { id:"drama",      label:"Drama Tracker", href:"drama-tracker.html", icon:"masks",   accent:"drama" },
  ]},
  { group: "Planning", items: [
    { id:"qc",         label:"Quality Calendar", href:"Quality_Calendar_Planner_v2.html",  icon:"calendar" },
    { id:"units",      label:"Curriculum Units", href:"curriculum_units.html",             icon:"book"     },
    { id:"planner",    label:"Teacher Planner",  href:"teacher_planner.html",              icon:"grid"     },
    { id:"tasks",      label:"Teacher Tasks",    href:"teacher_tasks.html",                icon:"check"    },
  ]},
  { group: "Operations", items: [
    { id:"class-management", label:"Class Management", href:"class_management.html",       icon:"users"    },
    { id:"announcements",    label:"Announcements",    href:"fh_announcements.html",       icon:"megaphone"},
    { id:"meetings",         label:"Department Meetings", href:"fh_department_meetings.html", icon:"chat" },
    { id:"purchase",         label:"Purchase Orders",  href:"purchase_orders.html",        icon:"cart"     },
    { id:"visits",           label:"Class Visits",     href:"class-visit-feedback.html",   icon:"eye"      },
  ]},
  { group: "Admin", role:"faculty_head", items: [
    { id:"staff",     label:"Staff",            href:"fh_staff.html",   icon:"team"      },
    { id:"calendar",  label:"Calendar Manager", href:"fh_calendar.html",icon:"calendar2" },
  ]},
];

// Minimal inline icons — keep dependency-free. Replace with lucide if it's already in repo.
const ICONS = {
  home:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/></svg>',
  chart:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M7 14l4-4 4 3 5-7"/></svg>',
  palette:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="8" cy="10" r="1"/><circle cx="12" cy="7" r="1"/><circle cx="16" cy="10" r="1"/><circle cx="15" cy="15" r="1"/></svg>',
  masks:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5c0 6 3 11 7 11s7-5 7-11"/><path d="M9 9h.01M15 9h.01"/></svg>',
  calendar:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/></svg>',
  book:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h11a3 3 0 013 3v13H7a3 3 0 01-3-3z"/><path d="M4 17h14"/></svg>',
  grid:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>',
  check:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12l5 5L20 6"/></svg>',
  users:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2"/><path d="M3 20c0-3 3-5 6-5s6 2 6 5"/><path d="M15 20c0-2 2-3 4-3s4 1 4 3"/></svg>',
  megaphone:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11v2l13 5V6L3 11z"/><path d="M16 8a3 3 0 010 8"/></svg>',
  chat:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 11-3-6l3-1-1 4a8 8 0 011 3z"/></svg>',
  cart:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4h2l3 12h12l2-8H6"/><circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/></svg>',
  eye:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  team:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3"/><path d="M5 21c0-4 3-6 7-6s7 2 7 6"/></svg>',
  calendar2:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4M8 14h2M14 14h2"/></svg>',
};

class FacultyShell extends HTMLElement {
  connectedCallback() {
    const active = this.getAttribute("active") || "";
    const title  = this.getAttribute("page-title") || "";
    const subtitle = this.getAttribute("subtitle") || "";

    // Pull stashed user info from window or supabase session if available.
    const user = window.__facultyUser || { name: "", initials: "" , role: "" };
    const isAdmin = (user.role === "faculty_head" || user.role === "admin");

    // Move existing children into a doc fragment so we can re-mount them inside <main>.
    const slot = document.createDocumentFragment();
    while (this.firstChild) slot.appendChild(this.firstChild);

    this.innerHTML = `
      <div class="fs-root">
        <aside class="fs-sidebar" aria-label="Primary">
          <a class="fs-brand" href="faculty-hub.html">
            <span class="fs-brand-mark" aria-hidden="true"></span>
            <span class="fs-brand-name">Faculty Hub</span>
          </a>
          <nav class="fs-nav">
            ${NAV.filter(g => !g.role || isAdmin).map(group => `
              <div class="fs-nav-group">
                <div class="fs-nav-label">${group.group}</div>
                ${group.items.map(item => `
                  <a class="fs-nav-item ${item.id===active?'is-active':''} ${item.accent?'accent-'+item.accent:''}"
                     href="${item.href}" data-id="${item.id}">
                    <span class="fs-nav-icon">${ICONS[item.icon]||''}</span>
                    <span class="fs-nav-text">${item.label}</span>
                  </a>
                `).join("")}
              </div>
            `).join("")}
          </nav>
          <div class="fs-user">
            <div class="fs-user-avatar">${user.initials||"·"}</div>
            <div class="fs-user-meta">
              <div class="fs-user-name">${user.name||""}</div>
              <button class="fs-user-logout" data-action="logout">Sign out</button>
            </div>
          </div>
        </aside>
        <div class="fs-main-wrap">
          <header class="fs-topbar">
            <div class="fs-topbar-titles">
              <h1 class="fs-topbar-title">${title}</h1>
              ${subtitle?`<p class="fs-topbar-sub">${subtitle}</p>`:""}
            </div>
            <div class="fs-topbar-actions">
              <slot name="topbar-actions"></slot>
            </div>
          </header>
          <main class="fs-main" id="fs-main"></main>
        </div>
      </div>
    `;
    this.querySelector("#fs-main").appendChild(slot);

    // Wire logout
    this.querySelector('[data-action="logout"]')?.addEventListener("click", () => {
      window.dispatchEvent(new CustomEvent("faculty-shell:logout"));
    });
  }
}
customElements.define("faculty-shell", FacultyShell);
```

### 2.3 Create `faculty-shell.css`

```css
/* faculty-shell.css — depends on design-tokens.css */

.fs-root { display:grid; grid-template-columns: var(--shell-sidebar-w) 1fr; min-height:100vh; }

/* ----- Sidebar ----- */
.fs-sidebar {
  background:linear-gradient(180deg, var(--navy-900) 0%, var(--navy-800) 100%);
  color:#fff;
  display:flex; flex-direction:column;
  padding:var(--sp-5) var(--sp-3) var(--sp-4);
  position:sticky; top:0; height:100vh;
  border-right:1px solid var(--navy-800);
}
.fs-brand {
  display:flex; align-items:center; gap:var(--sp-3);
  padding:var(--sp-2) var(--sp-3);
  color:#fff; text-decoration:none;
  margin-bottom:var(--sp-4);
}
.fs-brand-mark {
  width:28px; height:28px; border-radius:8px;
  background:linear-gradient(135deg, var(--art-500), var(--drama-500));
  box-shadow:var(--sh-md);
}
.fs-brand-name { font:600 var(--fs-md)/1 var(--font-display); letter-spacing:-.01em; }

.fs-nav { flex:1; overflow:auto; }
.fs-nav-group { margin-bottom:var(--sp-5); }
.fs-nav-label {
  font:600 var(--fs-xs)/1 var(--font-sans);
  text-transform:uppercase; letter-spacing:.08em;
  color:rgba(255,255,255,.45);
  padding:0 var(--sp-3); margin-bottom:var(--sp-2);
}
.fs-nav-item {
  display:flex; align-items:center; gap:var(--sp-3);
  padding:var(--sp-2) var(--sp-3);
  color:rgba(255,255,255,.82);
  text-decoration:none;
  border-radius:var(--r-md);
  font:500 var(--fs-sm)/1 var(--font-sans);
  transition:background var(--t-fast) var(--ease), color var(--t-fast) var(--ease);
  position:relative;
}
.fs-nav-item:hover { background:rgba(255,255,255,.06); color:#fff; }
.fs-nav-item.is-active {
  background:rgba(255,255,255,.10);
  color:#fff;
}
.fs-nav-item.is-active::before {
  content:""; position:absolute; left:-12px; top:6px; bottom:6px; width:3px;
  background:var(--drama-500); border-radius:2px;
}
.fs-nav-item.accent-art.is-active::before    { background:var(--art-500); }
.fs-nav-item.accent-drama.is-active::before  { background:var(--drama-500); }
.fs-nav-item.accent-photo.is-active::before  { background:var(--photo-500); }
.fs-nav-icon { display:flex; width:18px; opacity:.85; }

/* ----- User block ----- */
.fs-user {
  display:flex; align-items:center; gap:var(--sp-3);
  padding:var(--sp-3); border-top:1px solid rgba(255,255,255,.08); margin-top:var(--sp-3);
}
.fs-user-avatar {
  width:36px; height:36px; border-radius:50%;
  background:linear-gradient(135deg, var(--drama-500), var(--art-500));
  display:flex; align-items:center; justify-content:center;
  font:600 var(--fs-sm)/1 var(--font-sans); color:#fff;
}
.fs-user-meta { flex:1; min-width:0; }
.fs-user-name { font:600 var(--fs-sm)/1.2 var(--font-sans); color:#fff; }
.fs-user-logout {
  background:none; border:none; color:rgba(255,255,255,.55);
  font:500 var(--fs-xs)/1.4 var(--font-sans); cursor:pointer; padding:0;
}
.fs-user-logout:hover { color:#fff; }

/* ----- Main column ----- */
.fs-main-wrap { display:flex; flex-direction:column; min-width:0; }
.fs-topbar {
  display:flex; align-items:center; justify-content:space-between; gap:var(--sp-4);
  height:var(--shell-topbar-h);
  padding:0 var(--sp-8);
  background:var(--bg); border-bottom:1px solid var(--navy-100);
  position:sticky; top:0; z-index:5;
}
.fs-topbar-title { font:600 var(--fs-xl)/1.2 var(--font-display); color:var(--ink-900); margin:0; }
.fs-topbar-sub   { margin:2px 0 0; font:400 var(--fs-sm)/1.2 var(--font-sans); color:var(--ink-500); }
.fs-topbar-actions { display:flex; gap:var(--sp-2); }

.fs-main {
  padding:var(--sp-8);
  max-width:var(--max-content);
  width:100%;
}

/* ----- Mobile: collapse sidebar to drawer (basic) ----- */
@media (max-width: 880px) {
  .fs-root { grid-template-columns: 1fr; }
  .fs-sidebar { position:fixed; transform:translateX(-100%); transition:transform var(--t-base) var(--ease); z-index:20; }
  .fs-sidebar.is-open { transform:translateX(0); }
}
```

### 2.4 Migrate pages onto the shell — page by page, in this order

For each page below, **the operation is the same**:

1. Open the file.
2. **Delete** the page's existing sidebar markup (everything matching `.sidebar`, `.fh-sidebar`, `.dash-sidebar`, `.sb-*`, brand block, nav block).
3. **Delete** the page's existing topbar/header chrome.
4. **Delete** any `:root` block in the page's `<style>` — those tokens now come from `design-tokens.css`.
5. Add to `<head>` immediately above the page's own stylesheet:
   ```html
   <link rel="stylesheet" href="design-tokens.css">
   <link rel="stylesheet" href="faculty-shell.css">
   <script type="module" src="faculty-shell.js"></script>
   ```
6. Wrap the page's main content in:
   ```html
   <faculty-shell active="ID_FROM_TABLE_BELOW" page-title="HUMAN TITLE" subtitle="OPTIONAL_SUBTITLE">
     <!-- existing content stays here -->
   </faculty-shell>
   ```
7. Remove any `@import url(...)` for fonts that are NOT Inter or General Sans — those two are the only families allowed.

Pages to migrate, in this exact order (start with the simplest):

| File | `active` value | `page-title` |
|---|---|---|
| `fh_announcements.html` | `announcements` | Announcements |
| `fh_department_meetings.html` | `meetings` | Department Meetings |
| `fh_procurement.html` (delete if `purchase_orders.html` supersedes it — check links first) | `purchase` | Purchase Orders |
| `purchase_orders.html` | `purchase` | Purchase Orders |
| `fh_calendar.html` | `calendar` | Calendar Manager |
| `fh_staff.html` | `staff` | Staff |
| `fh_tracking.html` (likely redirect to `tracking_monitoring_hub.html` — verify) | `tracking` | Tracking & Monitoring |
| `tracking_monitoring_hub.html` | `tracking` | Tracking & Monitoring |
| `class-visit-feedback.html` | `visits` | Class Visits |
| `teacher_planner.html` | `planner` | Teacher Planner |
| `teacher_tasks.html` | `tasks` | Teacher Tasks |
| `Quality_Calendar_Planner_v2.html` | `qc` | Quality Calendar |
| `art-tracker.html` | `art` | Art Tracker |
| `drama-tracker-v2 (5).html` | `drama` | Drama Tracker (also: rename file to `drama-tracker.html` and update every reference) |
| `faculty-hub.html` | `overview` | Overview |
| `faculty_dashboard.html` | — | (decide: merge into faculty-hub or keep as the data tab. If kept, give it `active="overview"` too.) |
| `faculty_head_hub.html` | — | **DELETE** at end of Phase 2 — all of its links re-routed via the unified shell. |

### 2.5 Delete legacy chrome files

Once every page above is migrated and verified working:

- **Delete** `fh-shell.js`
- **Delete** `fh-shell.css`
- **Delete** `embed-chrome.js` (no longer needed — there are no nested iframes after Phase 3)
- **Delete** `faculty_head_hub.html`

Search the repo for any remaining string references to `fh-shell`, `embed-chrome`, or `faculty_head_hub.html` and remove them.

**Stop and report.** Confirm: every page loads, only one sidebar appears anywhere, the active item highlights correctly, the sidebar links navigate without ever showing a second sidebar.

---

## 3. Class Management — rebuild the page from scratch

The current implementation is split across:

- `class_management_hub.html` — **broken legacy file (six concatenated HTML documents). Delete in step 3.6.**
- `class_management_hub_v2.html` — live thin shell.
- `class_management_hub_v2_app.js` — live SPA with all the logic.
- `fh_class_management.html` — the wrapper that iframes the v2 page.

We replace the lot with one canonical file: `class_management.html`. The JS logic from `class_management_hub_v2_app.js` is **mostly reused** — we keep all the parse/upload/RPC functions and rebuild only the UI layer around them.

### 3.1 Design intent for the new page

A faculty head landing on this page should immediately see:

1. **What's the state of my classes right now?** — small stat tiles top of page.
2. **The single primary action is uploading a spreadsheet.** — large drop zone, takes ~⅓ of the viewport.
3. **The current class roster, browsable and searchable.** — table below, with subject filter.
4. **Manual add is available but secondary** — opens a side drawer, not a competing column.

Layout sketch:

```
┌─────────────────────────────────────────────────────────────┐
│ Stat tiles:  [78 classes]  [12 teachers]  [Last import 3d]  │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐    │
│  │  ⬆  Upload classes                                   │    │
│  │  Drop a CSV or XLSX here, or browse…                 │    │
│  │  [ Browse file ]    Download template ▾              │    │
│  └─────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────┤
│  All classes      [Search…]  [Subject ▾] [Year ▾] [+ Add]   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ ▍S1 Art A         S1    Mr Smith       Art      ⋯   │    │
│  │ ▍S1 Drama A       S1    Ms Jones       Drama    ⋯   │    │
│  │ …                                                   │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

The left rule on each row is tinted by subject — that's where the "colourful" feel comes from without being garish.

### 3.2 Build `class_management.html`

Create this file. It's the canonical class management page from now on. Body skeleton:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Class Management · Faculty Hub</title>
  <link rel="stylesheet" href="design-tokens.css">
  <link rel="stylesheet" href="faculty-shell.css">
  <link rel="stylesheet" href="class_management.css">
  <script src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/papaparse@5.4.1/papaparse.min.js"></script>
  <script src="supabase-init.js"></script>
  <script src="config.js"></script>
  <script src="data-service.js"></script>
  <script src="auth-guard.js"></script>
  <script type="module" src="faculty-shell.js"></script>
  <script type="module" src="class_management.js" defer></script>
</head>
<body>
  <faculty-shell active="class-management" page-title="Class Management" subtitle="Add, import and assign classes to the Art and Drama trackers">

    <!-- Stat strip -->
    <section class="cm-stats" id="cm-stats" aria-label="Summary">
      <!-- populated by class_management.js -->
    </section>

    <!-- Upload zone -->
    <section class="cm-upload card" aria-labelledby="cm-upload-title">
      <header class="cm-upload-head">
        <div>
          <h2 id="cm-upload-title">Upload classes</h2>
          <p>Drop a CSV or XLSX file, or browse. Each row routes to the Art or Drama tracker based on its subject.</p>
        </div>
        <div class="cm-upload-actions">
          <button class="btn" data-action="download-template-csv">Template (CSV)</button>
          <button class="btn" data-action="download-template-xlsx">Template (XLSX)</button>
        </div>
      </header>
      <label class="cm-drop" id="cm-drop">
        <input type="file" id="cm-file" accept=".csv,.xlsx" hidden>
        <div class="cm-drop-icon">⬆</div>
        <div class="cm-drop-text">
          <strong>Drop your file here</strong>
          <span>or <u>browse</u> — CSV or XLSX, up to 5 MB</span>
        </div>
      </label>
      <div class="cm-required-columns">
        <strong>Required columns:</strong>
        <code>subject</code><code>year_level</code><code>class_name</code><code>teacher_email</code>
        <span class="cm-required-optional"><strong>Optional:</strong>
        <code>class_code</code><code>pupil_name</code><code>teacher_name</code></span>
      </div>
    </section>

    <!-- Roster -->
    <section class="cm-roster card" aria-labelledby="cm-roster-title">
      <header class="cm-roster-head">
        <h2 id="cm-roster-title">All classes</h2>
        <div class="cm-filters">
          <input type="search" id="cm-search" placeholder="Search class, teacher…" aria-label="Search">
          <select id="cm-filter-subject" aria-label="Subject">
            <option value="">All subjects</option>
            <option value="art">Art</option>
            <option value="drama">Drama</option>
            <option value="photography">Photography</option>
          </select>
          <select id="cm-filter-year" aria-label="Year">
            <option value="">All years</option>
            <option>S1</option><option>S2</option><option>S3</option>
            <option>S4</option><option>S5</option><option>S6</option>
          </select>
          <button class="btn btn-primary" data-action="open-add">+ Add manually</button>
        </div>
      </header>
      <div class="cm-table-wrap">
        <table class="table" id="cm-table">
          <thead>
            <tr><th>Class</th><th>Year</th><th>Teacher</th><th>Subject</th><th>Code</th><th class="cm-actions-col">Actions</th></tr>
          </thead>
          <tbody id="cm-table-body"></tbody>
        </table>
      </div>
    </section>

    <!-- Drawers + modals are appended by JS -->
  </faculty-shell>
</body>
</html>
```

### 3.3 `class_management.css`

```css
/* class_management.css — depends on design-tokens.css and faculty-shell.css */

/* ----- Stats ----- */
.cm-stats {
  display:grid; gap:var(--sp-4);
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  margin-bottom:var(--sp-6);
}
.cm-stat {
  background:var(--bg-elev); border:1px solid var(--navy-100); border-radius:var(--r-lg);
  padding:var(--sp-5);
  display:flex; flex-direction:column; gap:var(--sp-1);
  position:relative; overflow:hidden;
}
.cm-stat::after {
  content:""; position:absolute; right:-20px; top:-20px; width:80px; height:80px;
  border-radius:50%; background:var(--accent-100, var(--navy-050)); opacity:.6;
}
.cm-stat-label { font:600 var(--fs-xs)/1 var(--font-sans); color:var(--ink-500); text-transform:uppercase; letter-spacing:.06em; }
.cm-stat-value { font:700 var(--fs-3xl)/1 var(--font-display); color:var(--ink-900); }
.cm-stat-sub   { font:var(--fs-sm)/1.4 var(--font-sans); color:var(--ink-500); }
.cm-stat.art    { --accent-100:var(--art-100);   }
.cm-stat.drama  { --accent-100:var(--drama-100); }
.cm-stat.photo  { --accent-100:var(--photo-100); }

/* ----- Upload card ----- */
.cm-upload { margin-bottom:var(--sp-6); }
.cm-upload-head {
  display:flex; align-items:flex-start; justify-content:space-between; gap:var(--sp-4);
  margin-bottom:var(--sp-4);
}
.cm-upload-head h2 { font:600 var(--fs-lg)/1.2 var(--font-display); margin:0 0 4px; }
.cm-upload-head p  { margin:0; color:var(--ink-500); font-size:var(--fs-sm); }
.cm-upload-actions { display:flex; gap:var(--sp-2); }

.cm-drop {
  display:flex; flex-direction:column; align-items:center; justify-content:center;
  gap:var(--sp-3);
  border:2px dashed var(--navy-100);
  border-radius:var(--r-lg);
  padding:var(--sp-12) var(--sp-6);
  background:linear-gradient(180deg, var(--navy-050), transparent);
  cursor:pointer;
  transition:border-color var(--t-base) var(--ease), background var(--t-base) var(--ease);
  text-align:center;
}
.cm-drop:hover { border-color:var(--drama-500); background:var(--drama-050); }
.cm-drop.is-dragover { border-color:var(--drama-600); background:var(--drama-100); }
.cm-drop-icon {
  width:56px; height:56px; border-radius:50%;
  background:linear-gradient(135deg, var(--drama-500), var(--art-500)); color:#fff;
  display:flex; align-items:center; justify-content:center; font-size:24px;
  box-shadow:var(--sh-md);
}
.cm-drop-text strong { display:block; font:600 var(--fs-md)/1.3 var(--font-display); color:var(--ink-900); }
.cm-drop-text span   { color:var(--ink-500); }

.cm-required-columns {
  margin-top:var(--sp-4);
  font-size:var(--fs-xs); color:var(--ink-500);
  display:flex; flex-wrap:wrap; gap:var(--sp-2) var(--sp-3); align-items:center;
}
.cm-required-columns code {
  background:var(--navy-050); border:1px solid var(--navy-100);
  border-radius:var(--r-sm); padding:2px 6px; font-family:var(--font-mono); color:var(--ink-700);
}
.cm-required-optional { margin-left:var(--sp-3); border-left:1px solid var(--navy-100); padding-left:var(--sp-3); }

/* ----- Roster ----- */
.cm-roster { padding:0; overflow:hidden; }
.cm-roster-head {
  display:flex; align-items:center; justify-content:space-between; gap:var(--sp-4);
  padding:var(--sp-5); border-bottom:1px solid var(--navy-100);
}
.cm-roster-head h2 { margin:0; font:600 var(--fs-lg)/1.2 var(--font-display); }
.cm-filters { display:flex; gap:var(--sp-2); align-items:center; flex-wrap:wrap; }
.cm-filters input, .cm-filters select {
  height:36px; padding:0 var(--sp-3); border:1px solid var(--navy-100);
  border-radius:var(--r-md); font:var(--fs-sm)/1 var(--font-sans); background:var(--bg);
}
.cm-filters input { min-width:240px; }
.cm-table-wrap { overflow:auto; }
.cm-actions-col { width:80px; text-align:right; }
.cm-row-action {
  background:none; border:none; padding:6px; cursor:pointer; color:var(--ink-500); border-radius:var(--r-sm);
}
.cm-row-action:hover { background:var(--navy-050); color:var(--ink-900); }

/* ----- Preview modal ----- */
.cm-modal {
  position:fixed; inset:0; z-index:50;
  background:rgba(15,26,48,.45);
  display:flex; align-items:center; justify-content:center;
  padding:var(--sp-8);
  animation:cm-fade var(--t-base) var(--ease);
}
@keyframes cm-fade { from{opacity:0} to{opacity:1} }
.cm-modal-card {
  background:var(--bg); border-radius:var(--r-xl); box-shadow:var(--sh-lg);
  width:100%; max-width:980px; max-height:90vh;
  display:flex; flex-direction:column;
}
.cm-modal-head { padding:var(--sp-5) var(--sp-6); border-bottom:1px solid var(--navy-100); display:flex; justify-content:space-between; align-items:center; }
.cm-modal-body { padding:var(--sp-5) var(--sp-6); overflow:auto; flex:1; }
.cm-modal-foot { padding:var(--sp-4) var(--sp-6); border-top:1px solid var(--navy-100); display:flex; justify-content:flex-end; gap:var(--sp-2); }

.cm-preview-tabs { display:flex; gap:var(--sp-4); margin-bottom:var(--sp-4); border-bottom:1px solid var(--navy-100); }
.cm-preview-tab { background:none; border:none; padding:var(--sp-3) 0; color:var(--ink-500); font-weight:600; cursor:pointer; border-bottom:2px solid transparent; }
.cm-preview-tab.is-active { color:var(--ink-900); border-bottom-color:var(--drama-500); }

/* ----- Drawer for manual add ----- */
.cm-drawer {
  position:fixed; top:0; right:0; bottom:0; width:480px; max-width:100%;
  background:var(--bg); box-shadow:var(--sh-lg); z-index:60;
  transform:translateX(100%); transition:transform var(--t-base) var(--ease);
  display:flex; flex-direction:column;
}
.cm-drawer.is-open { transform:translateX(0); }
.cm-drawer-head { padding:var(--sp-5); border-bottom:1px solid var(--navy-100); display:flex; justify-content:space-between; align-items:center; }
.cm-drawer-body { padding:var(--sp-5); overflow:auto; flex:1; display:flex; flex-direction:column; gap:var(--sp-4); }
.cm-drawer-foot { padding:var(--sp-4) var(--sp-5); border-top:1px solid var(--navy-100); display:flex; gap:var(--sp-2); justify-content:flex-end; }
.cm-field { display:flex; flex-direction:column; gap:var(--sp-1); }
.cm-field label { font:600 var(--fs-xs)/1 var(--font-sans); text-transform:uppercase; letter-spacing:.05em; color:var(--ink-500); }
.cm-field input, .cm-field select {
  height:40px; padding:0 var(--sp-3); border:1px solid var(--navy-100);
  border-radius:var(--r-md); font:var(--fs-sm)/1 var(--font-sans);
}

/* ----- Toast ----- */
.cm-toast {
  position:fixed; bottom:var(--sp-6); left:50%; transform:translateX(-50%);
  background:var(--ink-900); color:#fff; padding:var(--sp-3) var(--sp-5);
  border-radius:var(--r-pill); box-shadow:var(--sh-lg);
  font:500 var(--fs-sm)/1.4 var(--font-sans);
  display:flex; gap:var(--sp-3); align-items:center;
  z-index:80;
  animation:cm-pop var(--t-base) var(--ease);
}
@keyframes cm-pop { from{opacity:0; transform:translateX(-50%) translateY(8px)} to{opacity:1; transform:translateX(-50%) translateY(0)} }
.cm-toast.is-success { background:var(--success-600); }
.cm-toast.is-error   { background:var(--danger-600); }
```

### 3.4 `class_management.js` — the wiring

Reuse the parse/import functions from `class_management_hub_v2_app.js`. Move them into this new file as named exports (no longer inside an IIFE). Then add the new flow:

```js
// class_management.js — the new canonical class management UI.
// Reuses parse + RPC functions from the previous class_management_hub_v2_app.js.

import {
  parseCsvRows, parseXlsxRows, normalizeRow,
  fuzzyMatchTeacherEmail,
  downloadTemplate,        // returns Blob; pass format: 'csv' | 'xlsx'
  runBulkImport,           // calls DataService.bulkUpsertPupilsAndEnrollments
  fetchAllClasses, fetchTeachers, addClassManual, deleteClass,
} from "./class_management_core.js";

// (Put the existing parse/RPC helpers in class_management_core.js — straight extraction
//  from class_management_hub_v2_app.js lines 661–846 and 137–600. Keep behaviour identical.)

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

let state = {
  classes: [],          // [{id, class_name, year_level, subject, teacher_name, teacher_email, class_code}]
  teachers: [],
  filter: { q:"", subject:"", year:"" },
  parsed: null,         // { rows: [...], headers: [...] }
  unmatched: [],        // rows with no teacher email match
};

// ---------- BOOT ----------
document.addEventListener("DOMContentLoaded", async () => {
  await refresh();
  wireUploadZone();
  wireFilters();
  wireTemplates();
  wireDrawer();
});

async function refresh() {
  const [classes, teachers] = await Promise.all([fetchAllClasses(), fetchTeachers()]);
  state.classes = classes; state.teachers = teachers;
  renderStats(); renderTable();
}

// ---------- STATS ----------
function renderStats() {
  const total = state.classes.length;
  const byArt = state.classes.filter(c => c.subject === "art").length;
  const byDrama = state.classes.filter(c => c.subject === "drama").length;
  const byPhoto = state.classes.filter(c => c.subject === "photography").length;
  const teacherCount = new Set(state.classes.map(c => c.teacher_email)).size;
  $("#cm-stats").innerHTML = `
    <div class="cm-stat"><span class="cm-stat-label">Classes</span><span class="cm-stat-value">${total}</span><span class="cm-stat-sub">${teacherCount} teachers</span></div>
    <div class="cm-stat art"><span class="cm-stat-label">Art</span><span class="cm-stat-value">${byArt}</span><span class="cm-stat-sub">routes to Art Tracker</span></div>
    <div class="cm-stat drama"><span class="cm-stat-label">Drama</span><span class="cm-stat-value">${byDrama}</span><span class="cm-stat-sub">routes to Drama Tracker</span></div>
    ${byPhoto ? `<div class="cm-stat photo"><span class="cm-stat-label">Photography</span><span class="cm-stat-value">${byPhoto}</span><span class="cm-stat-sub">routes to Photo Tracker</span></div>` : ""}
  `;
}

// ---------- TABLE ----------
function renderTable() {
  const { q, subject, year } = state.filter;
  const rows = state.classes
    .filter(c => !subject || c.subject === subject)
    .filter(c => !year || c.year_level === year)
    .filter(c => !q || [c.class_name, c.teacher_name, c.teacher_email, c.class_code].some(v => (v||"").toLowerCase().includes(q.toLowerCase())));
  $("#cm-table-body").innerHTML = rows.map(r => `
    <tr class="row-${r.subject}">
      <td><strong>${escape(r.class_name)}</strong></td>
      <td>${r.year_level}</td>
      <td>${escape(r.teacher_name || "")}<div class="cm-meta">${escape(r.teacher_email||"")}</div></td>
      <td><span class="badge badge-${r.subject}">${cap(r.subject)}</span></td>
      <td><code>${escape(r.class_code||"")}</code></td>
      <td class="cm-actions-col">
        <button class="cm-row-action" data-id="${r.id}" data-action="delete" aria-label="Delete class">×</button>
      </td>
    </tr>
  `).join("") || `<tr><td colspan="6" class="cm-empty">No classes yet — upload a file to get started.</td></tr>`;
  $$("[data-action=delete]", $("#cm-table-body")).forEach(b => {
    b.addEventListener("click", async () => {
      if (!confirm("Delete this class?")) return;
      await deleteClass(b.dataset.id);
      toast("Class removed", "success");
      refresh();
    });
  });
}

// ---------- UPLOAD ----------
function wireUploadZone() {
  const drop = $("#cm-drop"); const file = $("#cm-file");
  drop.addEventListener("click", () => file.click());
  ["dragenter","dragover"].forEach(e => drop.addEventListener(e, ev => { ev.preventDefault(); drop.classList.add("is-dragover"); }));
  ["dragleave","drop"].forEach(e => drop.addEventListener(e, ev => { ev.preventDefault(); drop.classList.remove("is-dragover"); }));
  drop.addEventListener("drop", ev => handleFile(ev.dataTransfer.files[0]));
  file.addEventListener("change", () => handleFile(file.files[0]));
}

async function handleFile(file) {
  if (!file) return;
  const name = file.name.toLowerCase();
  let rows;
  try {
    if (name.endsWith(".csv")) rows = await parseCsvRows(file);
    else if (name.endsWith(".xlsx")) rows = await parseXlsxRows(file);
    else return toast("Only CSV and XLSX files are supported", "error");
  } catch (err) {
    return toast("Could not read file: " + err.message, "error");
  }
  // Normalize + match teachers
  const norm = rows.map(normalizeRow).filter(r => r.subject && r.class_name);
  const unmatched = [];
  for (const r of norm) {
    if (!state.teachers.some(t => t.email.toLowerCase() === (r.teacher_email||"").toLowerCase())) {
      r._suggestion = fuzzyMatchTeacherEmail(r.teacher_email, state.teachers);
      unmatched.push(r);
    }
  }
  state.parsed = { rows: norm };
  state.unmatched = unmatched;
  openPreview();
}

function openPreview() {
  const m = document.createElement("div");
  m.className = "cm-modal";
  m.innerHTML = `
    <div class="cm-modal-card" role="dialog" aria-modal="true" aria-labelledby="cm-preview-title">
      <header class="cm-modal-head">
        <h2 id="cm-preview-title">Review import — ${state.parsed.rows.length} rows</h2>
        <button class="btn btn-ghost" data-action="close">Cancel</button>
      </header>
      <div class="cm-modal-body">
        <div class="cm-preview-tabs">
          <button class="cm-preview-tab is-active" data-tab="all">All rows (${state.parsed.rows.length})</button>
          <button class="cm-preview-tab" data-tab="unmatched">Unmatched teachers (${state.unmatched.length})</button>
          <button class="cm-preview-tab" data-tab="routing">Routing</button>
        </div>
        <div class="cm-preview-pane" id="cm-pane"></div>
      </div>
      <footer class="cm-modal-foot">
        <button class="btn" data-action="close">Cancel</button>
        <button class="btn btn-primary" data-action="commit" ${state.unmatched.length ? "disabled" : ""}>Import ${state.parsed.rows.length} rows</button>
      </footer>
    </div>`;
  document.body.appendChild(m);
  renderPreviewTab("all", m);
  m.addEventListener("click", e => {
    if (e.target === m || e.target.dataset.action === "close") m.remove();
    if (e.target.classList?.contains("cm-preview-tab")) {
      m.querySelectorAll(".cm-preview-tab").forEach(t => t.classList.toggle("is-active", t === e.target));
      renderPreviewTab(e.target.dataset.tab, m);
    }
    if (e.target.dataset.action === "commit") commitImport(m);
  });
}

function renderPreviewTab(tab, m) {
  const pane = m.querySelector("#cm-pane");
  if (tab === "all") {
    pane.innerHTML = `<table class="table"><thead><tr><th>Class</th><th>Year</th><th>Subject</th><th>Teacher</th><th>Status</th></tr></thead><tbody>${
      state.parsed.rows.map(r => `<tr class="row-${r.subject}">
        <td>${escape(r.class_name)}</td><td>${r.year_level}</td>
        <td><span class="badge badge-${r.subject}">${cap(r.subject)}</span></td>
        <td>${escape(r.teacher_email||"")}</td>
        <td>${state.unmatched.includes(r) ? `<span class="badge badge-warning">Teacher not found</span>` : `<span class="badge badge-success">Ready</span>`}</td>
      </tr>`).join("")
    }</tbody></table>`;
  } else if (tab === "unmatched") {
    pane.innerHTML = state.unmatched.length === 0
      ? `<p class="cm-empty">All teachers matched. 🎉</p>`
      : `<p>These rows reference emails that don't match a staff account. Fix below, then commit.</p>
         <table class="table"><thead><tr><th>Class</th><th>Email in file</th><th>Closest match</th><th></th></tr></thead><tbody>${
        state.unmatched.map((r,i) => `<tr>
          <td>${escape(r.class_name)}</td>
          <td><code>${escape(r.teacher_email||"")}</code></td>
          <td>${r._suggestion ? `<code>${escape(r._suggestion.email)}</code> <span class="cm-meta">${escape(r._suggestion.name||"")}</span>` : "<em>No suggestion</em>"}</td>
          <td><button class="btn" data-fix="${i}" ${!r._suggestion?"disabled":""}>Use suggestion</button></td>
        </tr>`).join("")
      }</tbody></table>`;
    pane.querySelectorAll("[data-fix]").forEach(b => b.addEventListener("click", () => {
      const r = state.unmatched[+b.dataset.fix];
      r.teacher_email = r._suggestion.email;
      r.teacher_name  = r._suggestion.name;
      state.unmatched = state.unmatched.filter(x => x !== r);
      openPreview(); m.remove();
    }));
  } else if (tab === "routing") {
    const counts = state.parsed.rows.reduce((a,r)=>{ a[r.subject]=(a[r.subject]||0)+1; return a; }, {});
    pane.innerHTML = `<div class="cm-routing">
      <div class="cm-route art"><span class="badge badge-art">Art Tracker</span><strong>${counts.art||0} rows</strong></div>
      <div class="cm-route drama"><span class="badge badge-drama">Drama Tracker</span><strong>${counts.drama||0} rows</strong></div>
      ${counts.photography?`<div class="cm-route photo"><span class="badge badge-photo">Photography</span><strong>${counts.photography} rows</strong></div>`:""}
    </div>`;
  }
}

async function commitImport(m) {
  m.querySelector('[data-action="commit"]').disabled = true;
  try {
    const result = await runBulkImport(state.parsed.rows);
    m.remove();
    toast(`Imported ${result.created} new + ${result.updated} updated rows`, "success");
    refresh();
  } catch (err) {
    toast("Import failed: " + err.message, "error");
    m.querySelector('[data-action="commit"]').disabled = false;
  }
}

// ---------- TEMPLATES ----------
function wireTemplates() {
  document.querySelector('[data-action="download-template-csv"]').addEventListener("click", () => downloadTemplate("csv"));
  document.querySelector('[data-action="download-template-xlsx"]').addEventListener("click", () => downloadTemplate("xlsx"));
}

// ---------- FILTERS ----------
function wireFilters() {
  $("#cm-search").addEventListener("input", e => { state.filter.q = e.target.value; renderTable(); });
  $("#cm-filter-subject").addEventListener("change", e => { state.filter.subject = e.target.value; renderTable(); });
  $("#cm-filter-year").addEventListener("change", e => { state.filter.year = e.target.value; renderTable(); });
}

// ---------- MANUAL ADD DRAWER ----------
function wireDrawer() { /* build the drawer with the fields in cm-field, call addClassManual on save */ }

// ---------- UTIL ----------
function escape(s){ return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
function cap(s){ return s ? s[0].toUpperCase()+s.slice(1) : s; }
function toast(msg, kind="success"){ const t=document.createElement("div"); t.className=`cm-toast is-${kind}`; t.textContent=msg; document.body.appendChild(t); setTimeout(()=>t.remove(),2800); }
```

### 3.5 Move shared logic into `class_management_core.js`

Extract the parse / RPC / template-build helpers from the old `class_management_hub_v2_app.js` into a new file `class_management_core.js`. Keep their behaviour byte-identical — only change the export style (named exports instead of inside an IIFE). Specifically extract these functions:

- `parseXlsxRows(file)`
- A new `parseCsvRows(file)` — use PapaParse, return same row shape as `parseXlsxRows`
- `normalizeRow(row)` — column-name normalisation (already exists, extract it)
- `fuzzyMatchTeacherEmail(email, teachers)` — new; Levenshtein on local-part, return `{email, name}` of best match if distance ≤ 2, else `null`
- `downloadTemplate(format)` — returns CSV or XLSX with the headers exactly as in `class_management_hub_v2_app.js` line 829–832
- `runBulkImport(rows)` — wraps `DataService.bulkUpsertPupilsAndEnrollments(...)` and returns `{created, updated, conflicts}`
- `fetchAllClasses()`, `fetchTeachers()`, `addClassManual(row)`, `deleteClass(id)` — wrappers around existing `DataService` methods

### 3.6 Delete the old class management implementation

Once `class_management.html` is verified working (upload a CSV, see the preview, commit, see rows appear and route to the right tracker):

- **Delete** `class_management_hub.html` (the broken six-doc file)
- **Delete** `class_management_hub_v2.html`
- **Delete** `class_management_hub_v2_app.js`
- **Delete** `fh_class_management.html`
- Search the repo for any remaining string references to those four filenames and replace with `class_management.html`.

**Stop and report.** Confirm: a CSV file with three rows uploads, previews, commits, and the rows appear in both the new class management table AND inside the Art Tracker / Drama Tracker when opened by the matching teacher.

---

## 4. Subject-colour rollout (the "make it colourful" pass)

The accent colours exist as tokens (Phase 1) but aren't yet visible. Surface them in these specific places.

### 4.1 Tracker tiles on the main hub (`faculty-hub.html`)

Replace the existing tracker entry cards with this pattern:

```html
<a class="tracker-tile tracker-tile--art" href="art-tracker.html">
  <div class="tracker-tile__icon">🎨</div>
  <h3>Art Tracker</h3>
  <p>Pupil progress, levels and reports for Art & Design.</p>
  <span class="tracker-tile__stat">Last updated 2 days ago</span>
</a>
<a class="tracker-tile tracker-tile--drama" href="drama-tracker.html">
  <div class="tracker-tile__icon">🎭</div>
  <h3>Drama Tracker</h3>
  <p>Pupil progress, levels and reports for Drama.</p>
  <span class="tracker-tile__stat">12 classes assigned to you</span>
</a>
```

CSS (append to `faculty-hub.css`):

```css
.tracker-tile {
  display:block; text-decoration:none; color:inherit;
  padding:var(--sp-6);
  border-radius:var(--r-lg);
  border:1px solid var(--navy-100);
  background:var(--bg-elev);
  position:relative; overflow:hidden;
  transition:transform var(--t-base) var(--ease), box-shadow var(--t-base) var(--ease);
}
.tracker-tile:hover { transform:translateY(-3px); box-shadow:var(--sh-md); }
.tracker-tile::before {
  content:""; position:absolute; left:0; top:0; bottom:0; width:6px;
  background:var(--tile-accent, var(--navy-700));
}
.tracker-tile--art   { --tile-accent:var(--art-500);   background:linear-gradient(135deg, var(--bg-elev) 60%, var(--art-050)); }
.tracker-tile--drama { --tile-accent:var(--drama-500); background:linear-gradient(135deg, var(--bg-elev) 60%, var(--drama-050)); }
.tracker-tile h3 { font:600 var(--fs-xl)/1.2 var(--font-display); margin:var(--sp-3) 0 var(--sp-1); }
.tracker-tile p  { color:var(--ink-500); margin:0 0 var(--sp-3); font-size:var(--fs-sm); }
.tracker-tile__icon { width:40px; height:40px; border-radius:var(--r-md); display:flex; align-items:center; justify-content:center; background:var(--tile-accent); color:#fff; font-size:20px; }
.tracker-tile__stat { font:600 var(--fs-xs)/1 var(--font-sans); color:var(--tile-accent); text-transform:uppercase; letter-spacing:.06em; }
```

### 4.2 Tracker page heroes (`art-tracker.html`, `drama-tracker.html`)

Add a hero band at the top of each tracker:

- Art: gradient `linear-gradient(135deg, var(--art-600), var(--art-500))`, white text.
- Drama: gradient `linear-gradient(135deg, var(--drama-600), var(--drama-500))`, white text.

Single CSS class `.tracker-hero` plus `.tracker-hero--art` / `--drama`. Re-use shared structure across both files.

### 4.3 Badges everywhere

Anywhere a subject name appears in the UI (lists, tables, dropdown selections, toasts), wrap it in `<span class="badge badge-art|badge-drama|badge-photo">`. This is already specified in `design-tokens.css`. The class management table from Phase 3 uses these; replicate the pattern in:

- `tracking_monitoring_hub.html`
- `triangulation_evidence.html`
- Anywhere `fh_staff.html` lists subject taught
- Announcement cards that target a subject

### 4.4 Row stripes by subject

Any table that lists items across subjects (class management, tracking_monitoring_hub, anything in fh_staff) should add a class `row-art` / `row-drama` / `row-photo` to each row. The CSS in design-tokens.css renders a 3px inset coloured rule on the first cell. This is the cheapest "I can scan this" win.

**Stop and report.**

---

## 5. Typography + density pass

This is the polish layer. Touch every page once.

### 5.1 Replace font imports

Across the entire repo, find every `<link rel="stylesheet" href="https://fonts.googleapis.com/...">` and every `<link rel="stylesheet" href="https://api.fontshare.com/...">`. Replace with **exactly one** import in each page:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<link href="https://api.fontshare.com/v2/css?f[]=general-sans@500,600,700&display=swap" rel="stylesheet">
```

Delete any imports of DM Sans, Sora, Nunito, IBM Plex Sans, or anything else. The trackers will lose their DM Sans / Sora — that's correct; they now use the unified type system.

### 5.2 Page hero pattern (used by every page that needs one)

Within `<faculty-shell>`, the top of `<main>` may optionally render a hero band. Add this pattern in `faculty-shell.css`:

```css
.page-hero {
  margin:calc(-1 * var(--sp-8)) calc(-1 * var(--sp-8)) var(--sp-6);
  padding:var(--sp-8);
  background:linear-gradient(135deg, var(--navy-800), var(--navy-700));
  color:#fff;
  border-radius:0 0 var(--r-xl) var(--r-xl);
}
.page-hero h1 { font:700 var(--fs-3xl)/1.1 var(--font-display); margin:0 0 var(--sp-2); }
.page-hero p  { margin:0; color:rgba(255,255,255,.78); font-size:var(--fs-md); max-width:64ch; }
.page-hero--art   { background:linear-gradient(135deg, var(--art-600), var(--art-500)); }
.page-hero--drama { background:linear-gradient(135deg, var(--drama-600), var(--drama-500)); }
```

Tracker pages get the subject-tinted hero. Operations pages get the default navy.

### 5.3 Accessibility audit

For each migrated page:

1. Tab through the page with the keyboard. Every interactive control must show a visible focus ring (the `:focus-visible` rule in `design-tokens.css` handles this — just don't override it).
2. Verify the page passes `axe-core` for "colour-contrast" and "landmark-one-main". Cursor: run an axe-core check via npm if practical, otherwise manually verify with browser devtools' contrast picker on:
   - Topbar subtitle (`.fs-topbar-sub`) on white → must be ≥ 4.5:1.
   - Stat label (`.cm-stat-label`) on white → must be ≥ 4.5:1.
   - Sidebar nav text (rgba white on navy gradient) → must be ≥ 4.5:1.

If any fail, darken the offending token in `design-tokens.css` (e.g. `--ink-500` → `#3f4a5c`).

**Stop and report.**

---

## 6. Final cleanup

### 6.1 Files that should no longer exist

After all phases, run a final pass and confirm these are deleted:

- `class_management_hub.html` (broken)
- `class_management_hub_v2.html`
- `class_management_hub_v2_app.js`
- `fh_class_management.html`
- `fh_shell.js` / `fh-shell.js`
- `fh_shell.css` / `fh-shell.css`
- `embed-chrome.js`
- `faculty_head_hub.html`

### 6.2 Files that should be renamed

- `drama-tracker-v2 (5).html` → `drama-tracker.html`. Update every reference in the repo (grep for `drama-tracker-v2`).

### 6.3 Files that should exist

- `design-tokens.css`
- `faculty-shell.css`
- `faculty-shell.js`
- `class_management.html`
- `class_management.css`
- `class_management.js`
- `class_management_core.js`

### 6.4 Linting / quick smoke test

Run from repo root:

```bash
npx eslint . --ext .js --max-warnings 0
npx playwright test e2e/smoke.spec.js
```

If `smoke.spec.js` references any of the deleted pages, update it to use the new canonical names.

### 6.5 Commit message template

Use this for the final commit:

```
refactor(ui): unified shell, redesigned class management, shared design system

- Introduce design-tokens.css as single source of truth (palette, type, space, motion).
- Replace 5 navigation systems with one <faculty-shell> custom element.
- Rebuild Class Management as canonical class_management.html with CSV + XLSX
  upload, preview step with fuzzy teacher-email matching, and per-row subject
  routing to Art and Drama trackers.
- Delete broken legacy class_management_hub.html (six concatenated documents).
- Delete orphan faculty_head_hub.html and fold its routes into the unified nav.
- Surface subject accent colours (art / drama / photo) across tracker tiles,
  tracker page heroes, table row rules, and badges.
- Standardise typography on Inter + General Sans only; remove DM Sans, Sora,
  Nunito, IBM Plex Sans imports.

No data layer changes. All Supabase RPCs preserved.
```

---

## 7. Verification checklist (run after every phase, not just at the end)

- [ ] Every page has exactly one sidebar.
- [ ] Every page has exactly one topbar.
- [ ] Clicking any sidebar item never causes a second sidebar to appear.
- [ ] The active sidebar item is highlighted on every page.
- [ ] Page background is `var(--bg-muted)` on every page (one colour, not four).
- [ ] Body font is Inter or General Sans on every page (not DM Sans, not Sora, not Nunito).
- [ ] Class Management uses one drop zone as its primary action.
- [ ] CSV upload works.
- [ ] XLSX upload works.
- [ ] Preview shows row-level status before commit.
- [ ] Unmatched teacher emails surface inline with a "Use suggestion" button.
- [ ] After commit, Art rows appear in the Art Tracker for the matched teacher.
- [ ] After commit, Drama rows appear in the Drama Tracker for the matched teacher.
- [ ] Subject badges appear wherever subjects are listed.
- [ ] Tracker tiles on the main hub are visually distinct (Art = orange tint, Drama = blue tint).
- [ ] No broken links remain. (Grep for `faculty_head_hub`, `class_management_hub`, `fh-shell` should return zero results.)
- [ ] Lighthouse Accessibility ≥ 95 on the main hub.
- [ ] Keyboard tab order on Class Management is sensible (upload → search → filters → table).

---

## 8. What NOT to do

- Do **not** introduce React, Vue, or any build step. Keep it static HTML + vanilla JS.
- Do **not** change the Supabase schema. The migrations are correct; the column names in the import (`subject`, `year_level`, `class_name`, `teacher_email`, etc.) must remain exactly as they are.
- Do **not** change `data-service.js` function signatures. You may add new wrappers in `class_management_core.js`, but the existing exported functions must keep their names and parameter shapes.
- Do **not** rewrite the trackers' internal logic. They already work. Only swap their chrome for `<faculty-shell>` and replace their font imports.
- Do **not** chain phases. Stop after each phase and let the user verify.

---

## 9. If anything is ambiguous

Stop and ask. Do not invent. The audit (Faculty_Hub_Audit_Report.docx in the repo root) has the supporting detail behind every decision here — refer to it if you're unsure why a step is required.
