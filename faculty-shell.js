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
    { id:"tracking",   label:"Tracking & Monitoring", href:"tracking_monitoring_landing.html", icon:"chart" },
  ]},
  { group: "Trackers", items: [
    { id:"art",        label:"Art Tracker",   href:"art-tracker.html",   icon:"palette", accent:"art" },
    { id:"drama",      label:"Drama Tracker", href:"drama-tracker.html", icon:"masks",   accent:"drama" },
  ]},
  { group: "Planning", items: [
    { id:"qc",         label:"Quality Calendar", href:"Quality_Calendar_Planner_v2.html",  icon:"calendar" },
    { id:"units",      label:"Curriculum Units", href:"curriculum_units.html",              icon:"book"     },
    { id:"planner",    label:"Teacher Planner",  href:"teacher_planner.html",               icon:"grid"     },
    { id:"tasks",      label:"Teacher Tasks",    href:"teacher_tasks.html",                 icon:"check"    },
  ]},
  { group: "Operations", items: [
    { id:"class-management", label:"Class Management", href:"class_management.html",        icon:"users"    },
    { id:"policies",         label:"School Policies",  href:"policies.html",                icon:"doc"      },
    { id:"announcements",    label:"Announcements",    href:"fh_announcements.html",        icon:"megaphone"},
    { id:"meetings",         label:"Department Meetings", href:"fh_department_meetings.html", icon:"chat" },
    { id:"purchase",         label:"Purchase Orders",  href:"purchase_orders.html",         icon:"cart"     },
    { id:"visits",           label:"Class Visits",     href:"class-visit-feedback.html",    icon:"eye"      },
  ]},
  { group: "Admin", role:"faculty_head", items: [
    { id:"staff",     label:"Staff",            href:"fh_staff.html",    icon:"team"      },
    { id:"calendar",  label:"Calendar Manager", href:"fh_calendar.html", icon:"calendar2" },
  ]},
];

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
  doc:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/></svg>',
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

    const user = window.__facultyUser || { name: "", initials: "", role: "" };
    const isAdmin = (user.role === "faculty_head" || user.role === "admin");

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

    this.querySelector('[data-action="logout"]')?.addEventListener("click", () => {
      window.dispatchEvent(new CustomEvent("faculty-shell:logout"));
    });
  }
}
customElements.define("faculty-shell", FacultyShell);
