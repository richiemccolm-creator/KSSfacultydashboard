/**
 * My Week
 * Teacher planner stays on this device (myweek.*).
 * School work (school=1) loads Supabase itself and syncs one bundle,
 * schoolworkV1, to the signed-in account.
 *
 * INTEGRATION INTO FACULTY HUB
 * Keep these sources separate so the hub can replace each one
 * without rewriting the page:
 *
 * 1. Personal tasks     Store.getTasks / saveTasks
 *                       The teacher's own list. Completion, notes, priority.
 * 2. Faculty events     Store.getFacultyEvents / saveFacultyEvents
 *                       Read-only. Future source: Faculty Calendar.
 *                       Never included in task progress.
 * 3. Timetable          getTimetable() falls back to MyWeekSeed.timetable.
 *                       Future source: faculty timetable.
 *                       Inject with MyWeek.setTimetable(table).
 * 4. Linked hub tasks   type "linked", linkedArea + linkedId.
 *                       Opening one dispatches "facultyHubNavigate"
 *                       with detail { area, id }. The hub should listen
 *                       and route to Attainment, Lesson Planner, and so on.
 * 5. Teacher routines   Store.getRoutines / saveRoutines
 *                       Personal habits for the week. Not compliance.
 * 6. Weekly focus       Store.getFocuses / saveFocuses
 *                       One intention per weekStart (Monday ISO date).
 *
 * UI code calls Store, not localStorage.
 * The only direct localStorage read is the tiny boot script in index.html,
 * so compact cards are correct before first paint.
 *
 * Replace Store's read/write later with Faculty Hub or Supabase.
 * The public surface is window.MyWeek.
 */
(function () {
  "use strict";

  var schoolWork = document.documentElement.classList.contains("is-school-work");
  var storePrefix = schoolWork ? "schoolwork." : "myweek.";

  var KEYS = {
    tasks: storePrefix + "tasks",
    focus: storePrefix + "focus",
    routines: storePrefix + "routines",
    settings: storePrefix + "settings",
    faculty: storePrefix + "faculty",
    timetable: storePrefix + "timetable",
    meta: storePrefix + "meta"
  };

  var DEFAULT_SETTINGS = {
    defaultWeek: "current",
    showRoutines: true,
    compact: false,
    carryDismissed: {}
  };

  var TERMS = [
    { name: "Term 1", start: "2026-08-17", end: "2026-10-09" },
    { name: "Term 2", start: "2026-10-26", end: "2026-12-18" },
    { name: "Term 3", start: "2027-01-06", end: "2027-04-02" },
    { name: "Term 4", start: "2027-04-19", end: "2027-06-25" }
  ];

  var DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  var DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  var DAY_LETTER = ["M", "T", "W", "T", "F"];
  var DAY_KEYS = ["monday", "tuesday", "wednesday", "thursday", "friday"];
  var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  var MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var RING_C = 2 * Math.PI * 15.5;

  var memory = {};

  var state = {
    weekStart: null,
    editingFocus: false,
    focusDraft: "",
    menuTaskId: null,
    menuMode: "root",
    menuConfirm: false,
    menuAnchor: null,
    carryChoices: {},
    carryExpanded: false,
    progress: null,
    toastTimer: null,
    lastFocus: null,
    sheetKind: null,
    sheetDate: null,
    addingPlan: false
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function read(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (raw != null) return JSON.parse(raw);
    } catch (err) {
      /* fall through to session memory */
    }
    if (Object.prototype.hasOwnProperty.call(memory, key)) return clone(memory[key]);
    return clone(fallback);
  }

  function write(key, value) {
    memory[key] = clone(value);
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      /* private mode: the session copy still works */
    }
  }

  /**
   * All persistence goes through Store.
   * Swap read/write when the hub replaces local storage.
   */
  var Store = {
    getTasks: function () { return read(KEYS.tasks, []); },
    saveTasks: function (tasks) { write(KEYS.tasks, tasks); queueSchoolCloud(); },
    getFocuses: function () { return read(KEYS.focus, []); },
    saveFocuses: function (rows) { write(KEYS.focus, rows); queueSchoolCloud(); },
    getRoutines: function () { return read(KEYS.routines, []); },
    saveRoutines: function (rows) { write(KEYS.routines, rows); },
    getPlan: function () { return read("schoolwork.plplan", []); },
    savePlan: function (items) { write("schoolwork.plplan", items); queueSchoolCloud(); },
    getFacultyEvents: function () { return read(KEYS.faculty, []); },
    saveFacultyEvents: function (rows) { write(KEYS.faculty, rows); },
    getTimetable: function () { return read(KEYS.timetable, null); },
    saveTimetable: function (table) { write(KEYS.timetable, table); },
    getMeta: function () { return read(KEYS.meta, {}); },
    saveMeta: function (meta) { write(KEYS.meta, meta); queueSchoolCloud(); },
    getSettings: function () {
      var saved = read(KEYS.settings, {});
      var merged = Object.assign({}, DEFAULT_SETTINGS, saved);
      merged.carryDismissed = Object.assign({}, saved.carryDismissed || {});
      return merged;
    },
    saveSettings: function (settings) { write(KEYS.settings, settings); queueSchoolCloud(); }
  };

  var SCHOOL_CLOUD_KEY = "schoolworkV1";
  var schoolCloudTimer = null;
  var applyingSchoolCloud = false;
  var schoolCloudWarned = false;

  function usableCloudApi(api) {
    if (!api || !api.get || !api.set || !api.isUsingCloud) return null;
    try {
      if (!api.isUsingCloud()) return null;
    } catch (err) {
      return null;
    }
    return api;
  }

  function schoolCloudApi() {
    var own = usableCloudApi(window.DataService);
    if (own) return own;
    try {
      if (window.parent && window.parent !== window) return usableCloudApi(window.parent.DataService);
    } catch (err) {
      /* the page is not inside the hub */
    }
    return null;
  }

  function warnSchoolCloud() {
    if (schoolCloudWarned) return;
    schoolCloudWarned = true;
    toast("Could not save to your account. This list is only on this device.");
  }

  function schoolBundle() {
    return {
      version: 1,
      tasks: Store.getTasks(),
      focus: Store.getFocuses(),
      plan: Store.getPlan(),
      settings: Store.getSettings(),
      meta: Store.getMeta()
    };
  }

  function applySchoolBundle(bundle) {
    if (!bundle || typeof bundle !== "object") return;
    applyingSchoolCloud = true;
    try {
      if (Array.isArray(bundle.tasks)) Store.saveTasks(bundle.tasks);
      if (Array.isArray(bundle.focus)) Store.saveFocuses(bundle.focus);
      if (Array.isArray(bundle.plan)) Store.savePlan(bundle.plan);
      if (bundle.settings && typeof bundle.settings === "object") Store.saveSettings(bundle.settings);
      if (bundle.meta && typeof bundle.meta === "object") Store.saveMeta(bundle.meta);
    } finally {
      applyingSchoolCloud = false;
    }
  }

  function queueSchoolCloud() {
    if (!schoolWork || applyingSchoolCloud) return;
    var api = schoolCloudApi();
    if (!api) {
      warnSchoolCloud();
      return;
    }
    clearTimeout(schoolCloudTimer);
    schoolCloudTimer = setTimeout(function () {
      api.set(SCHOOL_CLOUD_KEY, schoolBundle()).then(function () {
        schoolCloudWarned = false;
      }).catch(function () {
        warnSchoolCloud();
      });
    }, 400);
  }

  function migrateSchoolWork() {
    if (!schoolWork) return Promise.resolve(false);
    var api = schoolCloudApi();
    if (!api) return Promise.resolve(false);
    return api.get(SCHOOL_CLOUD_KEY).then(function (cloud) {
      if (cloud && typeof cloud === "object" && cloud.version) {
        applySchoolBundle(cloud);
        applySettings(Store.getSettings());
        return true;
      }
      var local = schoolBundle();
      var hasLocal = (local.tasks && local.tasks.length) || (local.focus && local.focus.length) || (local.plan && local.plan.length);
      if (!hasLocal) return false;
      return api.set(SCHOOL_CLOUD_KEY, local).then(function () { return false; }).catch(function () {
        warnSchoolCloud();
        return false;
      });
    }).catch(function () {
      warnSchoolCloud();
      return false;
    });
  }

  var Dates = {
    parse: function (iso) {
      var parts = String(iso).split("-").map(Number);
      return new Date(parts[0], parts[1] - 1, parts[2]);
    },
    iso: function (date) {
      var pad = function (n) { return String(n).padStart(2, "0"); };
      return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());
    },
    addDays: function (date, n) {
      return new Date(date.getFullYear(), date.getMonth(), date.getDate() + n);
    },
    diffDays: function (a, b) {
      var utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
      var utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
      return Math.round((utcB - utcA) / 86400000);
    },
    schoolMonday: function (date) {
      var d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      var day = d.getDay();
      if (day === 0) return this.addDays(d, 1);
      if (day === 6) return this.addDays(d, 2);
      return this.addDays(d, 1 - day);
    },
    schoolToday: function (date) {
      var d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      var day = d.getDay();
      if (day === 0) return this.addDays(d, 1);
      if (day === 6) return this.addDays(d, 2);
      return d;
    },
    nextSchoolDay: function (date) {
      var d = this.addDays(date, 1);
      while (d.getDay() === 0 || d.getDay() === 6) d = this.addDays(d, 1);
      return d;
    },
    weekdayIndex: function (date) {
      var day = date.getDay();
      if (day < 1 || day > 5) return 0;
      return day - 1;
    },
    weekDays: function (monday) {
      var self = this;
      return [0, 1, 2, 3, 4].map(function (n) { return self.addDays(monday, n); });
    }
  };

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function uid(prefix) {
    return prefix + "_" + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
  }

  function nowStamp() {
    var d = new Date();
    var pad = function (n) { return String(n).padStart(2, "0"); };
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + "T" + pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds());
  }

  function motionOK() {
    return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function formatRange(monday, friday) {
    var y1 = monday.getFullYear();
    var y2 = friday.getFullYear();
    var m1 = MONTHS[monday.getMonth()];
    var m2 = MONTHS[friday.getMonth()];
    if (y1 !== y2) return monday.getDate() + " " + m1 + " " + y1 + " – " + friday.getDate() + " " + m2 + " " + y2;
    if (monday.getMonth() === friday.getMonth()) return monday.getDate() + " – " + friday.getDate() + " " + m1;
    return monday.getDate() + " " + m1 + " – " + friday.getDate() + " " + m2;
  }

  function formatHeading(date) {
    return DAY_NAMES[date.getDay() - 1] + " " + date.getDate() + " " + MONTHS[date.getMonth()];
  }

  function formatShort(date) {
    return date.getDate() + " " + MONTHS_SHORT[date.getMonth()];
  }

  function termLabel(monday) {
    var iso = Dates.iso(monday);
    var i;
    for (i = 0; i < TERMS.length; i += 1) {
      if (iso >= TERMS[i].start && iso <= TERMS[i].end) {
        var week = Math.floor(Dates.diffDays(Dates.parse(TERMS[i].start), monday) / 7) + 1;
        return TERMS[i].name + " · Week " + week;
      }
    }
    for (i = 0; i < TERMS.length - 1; i += 1) {
      if (iso > TERMS[i].end && iso < TERMS[i + 1].start) return "Holiday week";
    }
    return "";
  }

  function calendarTodayISO() {
    var now = new Date();
    return Dates.iso(new Date(now.getFullYear(), now.getMonth(), now.getDate()));
  }

  var Icons = {
    plus: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    check: '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.2 4.2L19 7.5"/></svg>',
    more: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="currentColor"><circle cx="6" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="18" cy="12" r="1.4"/></svg>',
    chevronLeft: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M14 6l-6 6 6 6"/></svg>',
    chevronRight: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M10 6l6 6-6 6"/></svg>'
  };

  function getTimetable() {
    var stored = Store.getTimetable();
    if (stored && stored.monday) return stored;
    return clone(window.MyWeekSeed.timetable);
  }

  function countable(task) {
    return task.type === "personal" || task.type === "linked";
  }

  function typeRank(task) {
    if (task.type === "faculty") return 1;
    return 0;
  }

  function sortTasks(list) {
    return list.slice().sort(function (a, b) {
      var af = typeRank(a);
      var bf = typeRank(b);
      if (af !== bf) return af - bf;
      if (a.createdAt === b.createdAt) return a.id < b.id ? -1 : 1;
      return a.createdAt < b.createdAt ? -1 : 1;
    });
  }

  function tasksOn(iso) {
    var own = Store.getTasks().filter(function (task) { return task.date === iso; });
    return sortTasks(own);
  }

  function progressOf(list) {
    var own = list.filter(countable);
    var done = own.filter(function (task) { return task.completed; }).length;
    return {
      done: done,
      total: own.length,
      remaining: own.length - done,
      pct: own.length ? Math.round((done / own.length) * 100) : null
    };
  }

  var hubCalendarCache = null;

  function readHubCalendar() {
    var raw = null;
    try {
      if (window.parent && window.parent !== window && typeof window.parent.calGetEvents === "function") {
        raw = window.parent.calGetEvents();
      }
    } catch (err) {
      raw = null;
    }
    if (!Array.isArray(raw) || !raw.length) {
      try {
        var stored = JSON.parse(localStorage.getItem("academicCalendarEvents") || "null");
        if (Array.isArray(stored) && stored.length) raw = stored;
      } catch (err2) {
        raw = null;
      }
    }
    if (!Array.isArray(raw) || !raw.length) raw = window.ACADEMIC_CALENDAR_DEFAULT_EVENTS || [];
    var seen = {};
    return raw.map(function (event) {
      if (!event || !event.title || !event.date) return null;
      var date = String(event.date).slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
      var title = String(event.title).trim();
      if (!title) return null;
      var key = date + "\n" + title;
      if (seen[key]) return null;
      seen[key] = true;
      return { id: String(event.id || key), date: date, title: title, category: event.category || "" };
    }).filter(Boolean);
  }

  function eventsOn(iso) {
    if (schoolWork) {
      if (!hubCalendarCache) hubCalendarCache = readHubCalendar();
      return hubCalendarCache.filter(function (event) { return event.date === iso; });
    }
    return Store.getFacultyEvents().filter(function (event) { return event.date === iso; });
  }

  function weekStats() {
    var days = Dates.weekDays(state.weekStart).map(function (date) {
      var iso = Dates.iso(date);
      var tasks = tasksOn(iso);
      return {
        date: date,
        iso: iso,
        tasks: tasks,
        progress: progressOf(tasks),
        events: eventsOn(iso)
      };
    });
    var done = days.reduce(function (sum, day) { return sum + day.progress.done; }, 0);
    var total = days.reduce(function (sum, day) { return sum + day.progress.total; }, 0);
    return {
      days: days,
      overall: {
        done: done,
        total: total,
        remaining: total - done,
        pct: total ? Math.round((done / total) * 100) : null
      }
    };
  }

  function focusFor(iso) {
    var row = Store.getFocuses().find(function (item) { return item.weekStart === iso; });
    return row ? row.focus : "";
  }

  function saveFocus(iso, text) {
    markCustom();
    var rows = Store.getFocuses().filter(function (item) { return item.weekStart !== iso; });
    if (text) rows.push({ weekStart: iso, focus: text });
    Store.saveFocuses(rows);
  }

  function updateTask(id, mutator) {
    var tasks = Store.getTasks();
    var index = tasks.findIndex(function (task) { return task.id === id; });
    if (index < 0) return null;
    markCustom();
    mutator(tasks[index]);
    Store.saveTasks(tasks);
    return tasks[index];
  }

  function previousUnfinished() {
    var prev = Dates.addDays(state.weekStart, -7);
    var days = Dates.weekDays(prev).map(function (date) { return Dates.iso(date); });
    return Store.getTasks().filter(function (task) {
      return task.type === "personal" && !task.completed && days.indexOf(task.date) !== -1;
    });
  }

  function carryVisible() {
    var key = Dates.iso(state.weekStart);
    if (Store.getSettings().carryDismissed[key]) return [];
    return previousUnfinished();
  }

  function ensureWeekRoutines(monday) {
    var iso = Dates.iso(monday);
    var all = Store.getRoutines();
    var have = {};
    all.forEach(function (row) {
      if (row.weekStart === iso) have[row.id] = true;
    });
    var changed = false;
    window.MyWeekSeed.routineTemplates.forEach(function (tpl) {
      if (have[tpl.id]) return;
      changed = true;
      all.push({
        id: tpl.id,
        title: tpl.title,
        weekStart: iso,
        completion: { monday: false, tuesday: false, wednesday: false, thursday: false, friday: false }
      });
    });
    if (changed) Store.saveRoutines(all);
  }

  function dashOffset(pct) {
    var value = pct == null ? 0 : pct;
    return (RING_C * (1 - value / 100)).toFixed(2);
  }

  function ringSVG(pct, fromPct) {
    var from = dashOffset(!motionOK() || fromPct == null ? pct : fromPct);
    var to = dashOffset(pct);
    return '<svg viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--track)" stroke-width="2.5"></circle><circle class="ring-value" data-kind="ring" data-target="' + to + '" cx="18" cy="18" r="15.5" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-dasharray="' + RING_C.toFixed(2) + '" style="stroke-dashoffset:' + from + '" transform="rotate(-90 18 18)"></circle></svg>';
  }

  function taskHTML(task) {
    if (task.type === "faculty") {
      return '<li class="task is-faculty"><span class="check-spacer" aria-hidden="true"></span><div class="task-body"><p class="task-title">' + esc(task.title) + '</p><p class="task-meta"><span class="tag">Faculty</span></p>' + (task.notes ? '<p class="task-notes">' + esc(task.notes) + '</p>' : "") + '</div><span class="check-spacer" aria-hidden="true"></span></li>';
    }
    var done = !!task.completed;
    var typeLabel = task.type === "linked" ? "Linked" : "My task";
    var priorityMark = schoolWork
      ? '<span class="priority-pill' + (task.priority === "important" ? " is-important" : "") + '">' + (task.priority === "important" ? "Important" : "Normal") + '</span>'
      : (task.priority === "important" ? '<span class="tag tag-hot">Important</span>' : "");
    var bodyInner = '<p class="task-title">' + esc(task.title) + '</p>' +
      '<p class="task-meta"><span class="tag">' + typeLabel + '</span>' + subjectChip(subjectOf(task)) + priorityMark + '</p>' +
      (task.notes ? '<p class="task-notes">' + esc(task.notes) + '</p>' : "");
    var title;
    if (schoolWork) {
      title = '<button type="button" class="task-open" data-action="open-task" data-id="' + esc(task.id) + '" aria-label="Open ' + esc(task.title) + '">' + bodyInner + '</button>';
    } else if (task.type === "linked") {
      title = '<button type="button" class="task-link" data-action="open-linked" data-id="' + esc(task.id) + '"><span class="task-title">' + esc(task.title) + '</span></button>' +
        '<p class="task-meta"><span class="tag">' + typeLabel + '</span>' + subjectChip(subjectOf(task)) + priorityMark + '</p>' +
        (task.notes ? '<p class="task-notes">' + esc(task.notes) + '</p>' : "");
    } else {
      title = bodyInner;
    }
    var classes = "task" + (done ? " is-done" : "") + (task.priority === "important" ? " is-important" : "");
    return '<li class="' + classes + '">' +
      '<button type="button" class="check" data-action="toggle-task" data-id="' + esc(task.id) + '" aria-pressed="' + (done ? "true" : "false") + '" aria-label="' + (done ? "Mark not done: " : "Mark done: ") + esc(task.title) + '"><span class="box">' + (done ? Icons.check : "") + '</span></button>' +
      '<div class="task-body">' + title +
      '</div>' +
      '<button type="button" class="icon-btn" data-action="open-menu" data-id="' + esc(task.id) + '" aria-haspopup="menu" aria-expanded="false" aria-label="Actions for ' + esc(task.title) + '">' + Icons.more + '</button>' +
      '</li>';
  }

  function subjectKey(value) {
    var text = String(value || "").toUpperCase();
    if (text.indexOf("PHOTO") !== -1) return "photo";
    if (/\bART\b/.test(text) || /ART\d/.test(text) || /\dART/.test(text)) return "art";
    if (text.indexOf("DRAMA") !== -1 || text.indexOf("DRA") !== -1) return "drama";
    return "";
  }

  function subjectOf(task) {
    var code = String(task.linkedId || "");
    if (!code) {
      var match = String(task.title || "").match(/\b\d(?:DRA|ART|PHOTO)\w*/i);
      if (match) code = match[0];
    }
    return subjectKey(code);
  }

  function subjectChip(key) {
    if (!key) return "";
    var label = key === "photo" ? "Photography" : key === "art" ? "Art" : "Drama";
    return '<span class="chip-subject chip-' + key + '">' + label + '</span>';
  }

  function facultyTone(title) {
    var text = String(title || "").toLowerCase();
    if (text.indexOf("photo") !== -1) return "photo";
    if (/\bart\b/.test(text)) return "art";
    if (text.indexOf("drama") !== -1) return "drama";
    return "navy";
  }

  /* Same category colours as the Faculty Hub home Key dates. */
  function facultyCalendarTone(event) {
    var cat = String((event && event.category) || "").toLowerCase();
    var title = String((event && event.title) || "");
    if (cat === "reporting" || /\breports?\b|\breporting\b|working grades|tracking entry/i.test(title)) return "report";
    if (cat === "assessment" || cat === "exam" || /assessment|exam/i.test(title)) return "assess";
    if (cat === "inset" || /inset/i.test(title)) return "inset";
    if (cat === "holiday") return "holiday";
    if (cat === "meeting" || /meeting|ped pod|sgm/i.test(title)) return "meet";
    if (cat === "faculty-deadline" && /\bdm\b|\bmod\b/i.test(title) && !/report|deadline|qa\b/i.test(title)) return "meet";
    if (cat === "deadline" || cat === "faculty-deadline" || /report|reporting|deadline|qa\b/i.test(title)) return "report";
    if (/\bdm\b|\bmod\b/i.test(title)) return "meet";
    if (cat === "training" || cat === "cpd") return "plan";
    return "plan";
  }

  function applySettings(settings) {
    document.documentElement.dataset.compact = settings.compact ? "true" : "false";
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", "#f4f6fb");
  }

  function renderHeader() {
    var friday = Dates.addDays(state.weekStart, 4);
    var term = termLabel(state.weekStart);
    var onCurrent = Dates.iso(state.weekStart) === Dates.iso(Dates.schoolMonday(new Date()));
    var meta = Store.getMeta();
    var sample = meta.sample !== false && !meta.customized && meta.anchorWeek === Dates.iso(state.weekStart);
    var line = formatRange(state.weekStart, friday) + (term ? " · " + term : "") + (sample ? " · Sample" : "");
    var pageName = document.documentElement.classList.contains("is-school-work") ? "School work" : "My Week";
    document.getElementById("mast").innerHTML =
      '<div><h1>' + pageName + '</h1><p class="week-range">' + esc(line) + '</p></div><div class="mast-actions">' +
      '<button type="button" class="btn" data-action="prev-week" aria-label="Previous week">' + Icons.chevronLeft + ' Previous week</button>' +
      '<button type="button" class="btn" data-action="today" aria-pressed="' + (onCurrent ? "true" : "false") + '">Today</button>' +
      '<button type="button" class="btn" data-action="next-week" aria-label="Next week">Next week ' + Icons.chevronRight + '</button>' +
      '<button type="button" class="btn solid" data-action="quick-add" aria-keyshortcuts="Q">' + Icons.plus + ' Quick Add</button>' +
      '<button type="button" class="btn" data-action="settings">Settings</button></div>';
    document.title = pageName + " · " + formatRange(state.weekStart, friday);
  }

  function renderFocus() {
    var iso = Dates.iso(state.weekStart);
    var root = document.getElementById("focus");
    if (state.editingFocus) {
      root.innerHTML =
        '<form id="focus-form" class="focus-editor"><label class="field-label" for="focus-input" id="focus-heading">This week\'s focus</label>' +
        '<textarea id="focus-input" maxlength="180" rows="3">' + esc(state.focusDraft) + '</textarea>' +
        '<div class="focus-actions"><button type="submit" class="btn solid">Save</button>' +
        '<button type="button" class="btn" data-action="cancel-focus">Cancel</button></div></form>';
      return;
    }
    var text = focusFor(iso);
    var support = text === "Make questioning more deliberate."
      ? '<p class="focus-support">Be more intentional with questions, give pupils longer thinking time and make evaluation visible.</p>'
      : "";
    var body = text
      ? '<blockquote class="focus-quote"><p class="focus-text">' + esc(text) + '</p></blockquote>' + support
      : '<div class="empty"><p>Nothing written for this week yet.</p></div>';
    root.innerHTML =
      '<div class="panel-head"><h2 id="focus-heading">This week\'s focus</h2>' +
      '<button type="button" class="btn" data-action="edit-focus">Edit</button></div>' + body;
  }

  function renderOverview(stats) {
    var today = calendarTodayISO();
    var days = stats.days.map(function (day) {
      var prev = state.progress && Object.prototype.hasOwnProperty.call(state.progress.days, day.iso)
        ? state.progress.days[day.iso]
        : null;
      var from = !motionOK() || prev == null ? (day.progress.pct == null ? 0 : day.progress.pct) : prev;
      var to = day.progress.pct == null ? 0 : day.progress.pct;
      var label = day.progress.pct == null ? "None" : day.progress.pct + "%";
      var spoken = day.progress.total
        ? DAY_NAMES[day.date.getDay() - 1] + ", " + day.progress.pct + " percent, " + day.progress.done + " of " + day.progress.total + " done"
        : DAY_NAMES[day.date.getDay() - 1] + ", no tasks";
      return '<button type="button" class="ov-day' + (day.iso === today ? " is-today" : "") + '" data-action="jump-day" data-date="' + day.iso + '" aria-label="' + esc(spoken) + '">' +
        '<span class="ov-name">' + DAY_SHORT[day.date.getDay() - 1] + '</span>' +
        '<span class="ov-track" aria-hidden="true"><span class="ov-fill" data-kind="bar" data-target="' + to + '" style="height:' + from + '%"></span></span>' +
        '<span class="ov-pct">' + label + '</span></button>';
    }).join("");

    var fromOverall = !motionOK() || !state.progress ? stats.overall.pct : state.progress.overall;
    var center = stats.overall.pct == null ? "–" : stats.overall.pct + "%";
    var meta = stats.overall.total
      ? '<span><strong>' + stats.overall.done + ' done</strong></span><span>' + stats.overall.remaining + ' remaining</span>'
      : '<span>Nothing listed yet.</span>';

    document.getElementById("overview").innerHTML =
      '<div class="panel-head"><h2 id="progress-heading">Week at a glance</h2></div>' +
      '<div class="overview-grid"><div class="ov-days">' + days + '</div>' +
      '<div class="ring-block"><div class="ring">' + ringSVG(stats.overall.pct, fromOverall) +
      '<div class="ring-center">' + center + '</div></div><div class="ring-meta">' + meta + '</div></div></div>';
  }

  function renderFaculty() {
    if (schoolWork) hubCalendarCache = null;
    var days = Dates.weekDays(state.weekStart);
    var any = days.some(function (date) { return eventsOn(Dates.iso(date)).length; });
    var body;
    if (!any) {
      body = '<p class="empty-line">Nothing listed from the faculty this week.</p>';
    } else {
      body = '<ul class="faculty-list">' + days.map(function (date) {
        var items = eventsOn(Dates.iso(date));
        if (!items.length) {
          return '<li class="faculty-row"><span class="faculty-dow">' + DAY_SHORT[date.getDay() - 1] + '</span><span class="dot dot-none" aria-hidden="true"></span><span class="faculty-empty">No faculty deadlines</span></li>';
        }
        return items.map(function (event, index) {
          var tone = schoolWork ? facultyCalendarTone(event) : facultyTone(event.title);
          var day = index === 0 ? DAY_SHORT[date.getDay() - 1] : "";
          var title = esc(event.title);
          if (schoolWork) {
            return '<li><button type="button" class="faculty-row" data-action="open-calendar" aria-label="Open ' + title + ' in the academic calendar"><span class="faculty-dow">' + day + '</span><span class="dot dot-' + tone + '" aria-hidden="true"></span><span>' + title + '</span></button></li>';
          }
          return '<li class="faculty-row"><span class="faculty-dow">' + day + '</span><span class="dot dot-' + tone + '" aria-hidden="true"></span><span>' + title + '</span></li>';
        }).join("");
      }).join("") + '</ul>';
    }
    var calendarLink = schoolWork
      ? '<button type="button" class="btn" data-action="open-calendar">Calendar</button>'
      : "";
    document.getElementById("faculty").innerHTML =
      '<div class="panel-head"><h2 id="faculty-heading">Faculty this week</h2>' + calendarLink + '</div>' + body;
  }

  function renderCarry() {
    var root = document.getElementById("carry");
    var items = carryVisible();
    if (!items.length) {
      root.hidden = true;
      root.innerHTML = "";
      return;
    }
    root.hidden = false;
    var noun = items.length === 1 ? "thing was" : "things were";
    var bulk = items.length === 1 ? "Move it to this week" : items.length === 2 ? "Move both to this week" : "Move all to this week";
    var names = items.map(function (task) { return esc(task.title); }).join(". ") + ".";
    var list = items.map(function (task) {
      var was = DAY_NAMES[Dates.parse(task.date).getDay() - 1];
      var picks = DAY_SHORT.map(function (label, index) {
        var on = state.carryChoices[task.id] === index;
        return '<button type="button" class="btn" data-action="carry-pick" data-id="' + esc(task.id) + '" data-day="' + index + '" aria-pressed="' + (on ? "true" : "false") + '" aria-label="Move ' + esc(task.title) + ' to ' + DAY_NAMES[index] + '">' + label + '</button>';
      }).join("");
      return '<li class="carry-item"><div><p class="carry-title">' + esc(task.title) + '</p><p class="carry-was">Was on ' + was + '</p></div><div class="day-picks" role="group" aria-label="Choose a day for ' + esc(task.title) + '">' + picks + '</div></li>';
    }).join("");
    var detail = state.carryExpanded
      ? '<p class="carry-hint">Choose a day under a task, then move selected.</p><ul class="carry-list">' + list + '</ul>'
      : "";
    root.innerHTML =
      '<h2 class="visually-hidden" id="carry-heading">Unfinished from last week</h2>' +
      '<p class="carry-lead">' + items.length + ' ' + noun + ' left unfinished last week.</p>' +
      '<p class="carry-names">' + names + '</p>' +
      '<div class="carry-actions">' +
      '<button type="button" class="btn" data-action="carry-all">' + bulk + '</button>' +
      '<button type="button" class="btn" data-action="carry-expand" aria-expanded="' + (state.carryExpanded ? "true" : "false") + '">' + (state.carryExpanded ? "Hide days" : "Choose days") + '</button>' +
      (state.carryExpanded ? '<button type="button" class="btn" data-action="carry-selected">Move selected</button>' : "") +
      '<button type="button" class="btn" data-action="carry-dismiss">Not now</button></div>' +
      '<div class="carry-detail">' + detail + '</div>';
  }

  function renderDays(stats) {
    var today = calendarTodayISO();
    document.getElementById("days").innerHTML = '<div class="day-grid">' + stats.days.map(function (day) {
      var prev = state.progress && Object.prototype.hasOwnProperty.call(state.progress.days, day.iso)
        ? state.progress.days[day.iso]
        : null;
      var name = DAY_NAMES[day.date.getDay() - 1];
      var spoken = day.progress.total
        ? name + " " + formatShort(day.date) + ". " + day.progress.pct + " percent, " + day.progress.done + " of " + day.progress.total + " done. Open the day."
        : name + " " + formatShort(day.date) + ". No tasks yet. Open the day.";
      var own = day.tasks.filter(countable);
      var middle;
      if (!day.tasks.length) {
        var emptyCopy = schoolWork
          ? '<p>No tasks yet.</p>'
          : '<p>Nothing on your list yet.</p><p>Enjoy it while it lasts.</p>';
        var emptyLabel = schoolWork ? "Add task" : "Add something";
        middle = '<div class="empty">' + emptyCopy + '<button type="button" class="add-task" data-action="add-day" data-date="' + day.iso + '">' + Icons.plus + ' ' + emptyLabel + '</button></div>';
      } else {
        var tally = own.length ? "Tasks (" + day.progress.done + "/" + day.progress.total + ")" : "Tasks";
        var count = own.length ? '<p class="day-count">' + day.progress.done + ' done · ' + day.progress.remaining + ' remaining</p>' : "";
        middle = '<p class="task-kicker">' + tally + '</p><ul class="task-list">' + day.tasks.map(taskHTML).join("") + '</ul><div class="day-foot">' + count +
          '<button type="button" class="add-task" data-action="add-day" data-date="' + day.iso + '">' + Icons.plus + ' Add task</button></div>';
      }
      var pctText = day.progress.pct == null ? "–" : day.progress.pct + "%";
      var cardDate = day.date.getDate() + " " + MONTHS[day.date.getMonth()];
      return '<article class="day-card' + (day.iso === today ? " is-today" : "") + '" id="day-' + day.iso + '">' +
        '<div class="day-head"><button type="button" class="day-open" data-action="open-day" data-date="' + day.iso + '" aria-label="' + esc(spoken) + '">' +
        '<span class="day-name">' + name + '</span><span class="day-date">' + esc(cardDate) + '</span>' +
        (day.iso === today ? '<span class="today-mark">Today</span>' : "") + '</button>' +
        '<div class="mini-ring" aria-hidden="true">' + ringSVG(day.progress.pct, prev) + '<strong>' + pctText + '</strong></div></div>' +
        middle + '</article>';
    }).join("") + '</div>';
  }

  function renderLearningPlan() {
    var root = document.getElementById("routines");
    root.hidden = false;
    var items = Store.getPlan().slice().sort(function (a, b) {
      if (!!a.done !== !!b.done) return a.done ? 1 : -1;
      return a.createdAt < b.createdAt ? -1 : 1;
    });
    var body;
    if (state.addingPlan) {
      body = '<form id="plan-form" class="pl-form"><label class="field-label" for="plan-input">What are you working on?</label>' +
        '<input id="plan-input" type="text" maxlength="140" required>' +
        '<div class="focus-actions"><button type="submit" class="btn solid">Add</button>' +
        '<button type="button" class="btn" data-action="cancel-plan">Cancel</button></div></form>';
    } else if (!items.length) {
      body = '<div class="empty"><p>Nothing on your plan yet.</p></div>' +
        '<button type="button" class="add-task" data-action="add-plan">' + Icons.plus + ' Add to plan</button>';
    } else {
      var list = items.map(function (item) {
        var done = !!item.done;
        return '<li class="pl-item' + (done ? " is-done" : "") + '">' +
          '<button type="button" class="check" data-action="toggle-plan" data-id="' + esc(item.id) + '" aria-pressed="' + (done ? "true" : "false") + '" aria-label="' + (done ? "Mark not done: " : "Mark done: ") + esc(item.title) + '"><span class="box">' + (done ? Icons.check : "") + '</span></button>' +
          '<div><p class="pl-title">' + esc(item.title) + '</p>' +
          '<button type="button" class="pl-remove" data-action="delete-plan" data-id="' + esc(item.id) + '">Remove</button></div></li>';
      }).join("");
      body = '<ul class="pl-list">' + list + '</ul>' +
        '<button type="button" class="add-task" data-action="add-plan">' + Icons.plus + ' Add to plan</button>';
    }
    root.innerHTML =
      '<div class="panel-head"><h2 id="routines-heading">My Professional Learning Plan</h2></div>' + body;
    if (state.addingPlan) {
      var input = document.getElementById("plan-input");
      if (input) input.focus();
    }
  }

  function addPlanItem(title) {
    var text = String(title || "").trim();
    if (!text) return;
    var items = Store.getPlan();
    items.push({ id: uid("plan"), title: text, done: false, createdAt: new Date().toISOString() });
    Store.savePlan(items);
    state.addingPlan = false;
    renderLearningPlan();
    toast("Added to your plan.");
  }

  function togglePlan(id) {
    var items = Store.getPlan();
    var item = items.find(function (row) { return row.id === id; });
    if (!item) return;
    item.done = !item.done;
    Store.savePlan(items);
    renderLearningPlan();
    var next = document.querySelector('[data-action="toggle-plan"][data-id="' + CSS.escape(id) + '"]');
    if (next) next.focus();
  }

  function deletePlan(id, button) {
    if (button.dataset.confirm !== "yes") {
      button.dataset.confirm = "yes";
      button.textContent = "Confirm";
      return;
    }
    Store.savePlan(Store.getPlan().filter(function (item) { return item.id !== id; }));
    renderLearningPlan();
    toast("Removed from your plan.");
  }

  function renderRoutines() {
    if (schoolWork) {
      renderLearningPlan();
      return;
    }
    var root = document.getElementById("routines");
    if (!Store.getSettings().showRoutines) {
      root.hidden = true;
      root.innerHTML = "";
      return;
    }
    root.hidden = false;
    ensureWeekRoutines(state.weekStart);
    var iso = Dates.iso(state.weekStart);
    var order = window.MyWeekSeed.routineTemplates.map(function (tpl) { return tpl.id; });
    var rows = Store.getRoutines().filter(function (row) { return row.weekStart === iso; });
    rows.sort(function (a, b) { return order.indexOf(a.id) - order.indexOf(b.id); });
    var head = DAY_LETTER.map(function (letter, index) {
      return '<span title="' + DAY_NAMES[index] + '">' + letter + '</span>';
    }).join("");
    var body = rows.map(function (row) {
      var done = DAY_KEYS.filter(function (key) { return row.completion[key]; }).length;
      var cells = DAY_KEYS.map(function (key, index) {
        var on = !!row.completion[key];
        return '<button type="button" class="cell-btn" data-action="toggle-routine" data-id="' + esc(row.id) + '" data-day="' + key + '" aria-pressed="' + (on ? "true" : "false") + '" aria-label="' + esc(row.title) + ', ' + DAY_NAMES[index] + ', ' + (on ? "done" : "not done") + '"><span class="box">' + (on ? Icons.check : "") + '</span></button>';
      }).join("");
      return '<div class="routine"><span class="routine-title" title="' + esc(row.title) + '">' + esc(row.title) + '</span><span class="routine-days">' + cells + '</span><span class="routine-count">' + done + '/5</span></div>';
    }).join("");
    root.innerHTML =
      '<div class="panel-head"><h2 id="routines-heading">My routines</h2></div>' +
      '<div class="routines-board"><div class="routines-head" aria-hidden="true"><span class="routine-title"></span><span class="routine-days">' + head + '</span><span class="routine-count">Done</span></div>' + body + '</div>';
  }

  function paintTargets(root) {
    if (!root) return;
    root.querySelectorAll("[data-target]").forEach(function (el) {
      var target = el.getAttribute("data-target");
      if (el.dataset.kind === "bar") el.style.height = target + "%";
      if (el.dataset.kind === "ring") el.style.strokeDashoffset = target;
    });
  }

  function dayBody(iso) {
    var date = Dates.parse(iso);
    var key = DAY_KEYS[date.getDay() - 1];
    var periods = getTimetable()[key] || [];
    var periodHTML = periods.map(function (period) {
      if (period.planStatus === "free") {
        return '<li class="period is-free"><span class="period-name">' + esc(period.period) + '</span><div><p class="lesson-title">Free</p></div></li>';
      }
      var plan = period.planStatus === "attached" ? "Plan attached" : period.planStatus === "resources" ? "Resources attached" : "No lesson plan";
      var tone = subjectKey(period.classCode || period.subject || "");
      return '<li class="period"><span class="period-name">' + esc(period.period) + '</span><div>' +
        '<p class="lesson-code">' + esc(period.classCode) + '</p>' +
        '<p class="lesson-title">' + esc(period.lessonTitle || "") + '</p>' +
        '<div class="lesson-meta">' + subjectChip(tone) + '<span class="tag">' + plan + '</span></div></div></li>';
    }).join("");
    var tasks = tasksOn(iso);
    var progress = progressOf(tasks);
    var list = tasks.length
      ? '<ul class="task-list">' + tasks.map(taskHTML).join("") + '</ul>'
      : '<div class="empty"><p>Nothing on your list yet.</p><p>Enjoy it while it lasts.</p></div>';
    var count = progress.total ? '<p class="day-count">' + progress.done + ' done · ' + progress.remaining + ' remaining</p>' : "";
    return '<div class="sheet-block"><h3>My timetable</h3><ul class="period-list">' + periodHTML + '</ul></div>' +
      '<div class="sheet-block"><h3>My tasks</h3>' + count + list +
      '<button type="button" class="add-task" data-action="add-day" data-date="' + iso + '">' + Icons.plus + ' Add task</button></div>';
  }

  function syncSheet(focusSelector) {
    if (!sheet().open || state.sheetKind !== "day" || !state.sheetDate) return;
    document.getElementById("sheet-body").innerHTML = dayBody(state.sheetDate);
    if (focusSelector) {
      var el = document.getElementById("sheet-body").querySelector(focusSelector);
      if (el) el.focus();
    }
  }

  function refreshSurfaces(focus) {
    if (schoolWork) hubCalendarCache = null;
    var stats = weekStats();
    renderOverview(stats);
    renderDays(stats);
    syncSheet(focus && focus.sheet);
    var days = {};
    stats.days.forEach(function (day) { days[day.iso] = day.progress.pct; });
    state.progress = { overall: stats.overall.pct, days: days };
    window.requestAnimationFrame(function () {
      paintTargets(document.getElementById("overview"));
      paintTargets(document.getElementById("days"));
    });
    if (focus && focus.page) {
      var pageEl = document.querySelector("#days " + focus.page);
      if (pageEl) pageEl.focus();
    }
    emitChange("tasks");
  }

  function renderAll() {
    applySettings(Store.getSettings());
    renderHeader();
    renderFocus();
    renderFaculty();
    renderCarry();
    renderRoutines();
    refreshSurfaces();
  }

  function sheet() {
    return document.getElementById("sheet");
  }

  function menuElement() {
    return document.getElementById("menu");
  }

  function menuOpen() {
    try { return menuElement().matches(":popover-open"); }
    catch (err) { return false; }
  }

  function openSheet(title, html, ready) {
    var dialog = sheet();
    if (!dialog.open) state.lastFocus = document.activeElement;
    document.getElementById("sheet-title").textContent = title;
    document.getElementById("sheet-body").innerHTML = html;
    if (!dialog.open) dialog.showModal();
    if (ready) ready();
  }

  function closeSheet() {
    var dialog = sheet();
    if (dialog.open) dialog.close();
  }

  function closeMenu() {
    var menu = menuElement();
    if (menuOpen()) {
      try { menu.hidePopover(); } catch (err) { /* already closed */ }
    }
    state.menuTaskId = null;
    state.menuMode = "root";
    state.menuConfirm = false;
    state.menuAnchor = null;
  }

  function placeMenu(anchor) {
    var menu = menuElement();
    var rect = anchor.getBoundingClientRect();
    menu.style.right = "auto";
    menu.style.bottom = "auto";
    var width = menu.offsetWidth;
    var height = menu.offsetHeight;
    var top = rect.bottom + 4;
    if (top + height > window.innerHeight - 8) top = Math.max(8, rect.top - height - 4);
    var left = rect.right - width;
    if (left < 8) left = 8;
    if (left + width > window.innerWidth - 8) left = Math.max(8, window.innerWidth - width - 8);
    menu.style.top = top + "px";
    menu.style.left = left + "px";
  }

  function renderMenu() {
    var task = Store.getTasks().find(function (item) { return item.id === state.menuTaskId; });
    var menu = menuElement();
    if (!task) {
      menu.innerHTML = "";
      return;
    }
    if (state.menuMode === "move") {
      var current = Dates.weekdayIndex(Dates.parse(task.date));
      var days = DAY_SHORT.map(function (label, index) {
        var disabled = index === current ? " disabled" : "";
        return '<button type="button" role="menuitem" data-action="move-task" data-id="' + esc(task.id) + '" data-day="' + index + '"' + disabled + '>' + label + '</button>';
      }).join("");
      menu.innerHTML = '<button type="button" data-action="menu-back">Back</button><div class="menu-days">' + days + '</div>';
      return;
    }
    var importantLabel = task.priority === "important" ? "Clear importance" : "Mark important";
    var noteLabel = task.notes ? "Edit note" : "Add note";
    var delLabel = state.menuConfirm ? "Confirm delete" : "Delete";
    menu.innerHTML =
      '<button type="button" role="menuitem" data-action="edit-task" data-id="' + esc(task.id) + '">Edit</button>' +
      '<button type="button" role="menuitem" data-action="note-task" data-id="' + esc(task.id) + '">' + noteLabel + '</button>' +
      '<button type="button" role="menuitem" data-action="important-task" data-id="' + esc(task.id) + '">' + importantLabel + '</button>' +
      '<button type="button" role="menuitem" data-action="menu-move">Move to another day</button>' +
      '<button type="button" role="menuitem" data-action="duplicate-task" data-id="' + esc(task.id) + '">Duplicate</button>' +
      '<button type="button" role="menuitem" data-action="carry-task" data-id="' + esc(task.id) + '">Carry to next week</button>' +
      '<button type="button" role="menuitem" class="menu-danger" data-action="delete-task" data-id="' + esc(task.id) + '">' + delLabel + '</button>';
  }

  function openMenu(id, anchor) {
    closeMenu();
    state.menuTaskId = id;
    state.menuMode = "root";
    state.menuConfirm = false;
    state.menuAnchor = anchor;
    renderMenu();
    var menu = menuElement();
    state.menuOpenedAt = Date.now();
    try { menu.showPopover(); }
    catch (err) { menu.style.display = "block"; }
    placeMenu(anchor);
    anchor.setAttribute("aria-expanded", "true");
    var first = menu.querySelector("button");
    if (first) first.focus();
  }

  function onOpenMenu(id, anchor) {
    if (state.menuTaskId === id && menuOpen()) {
      closeMenu();
      anchor.focus();
      return;
    }
    openMenu(id, anchor);
  }

  function areaOptions(selected) {
    var areas = window.MyWeekSeed.linkedAreas;
    return Object.keys(areas).map(function (key) {
      return '<option value="' + esc(key) + '"' + (key === selected ? " selected" : "") + '>' + esc(areas[key]) + '</option>';
    }).join("");
  }

  function classList() {
    return window.MyWeekSeed.classCodes.map(function (code) {
      return '<option value="' + esc(code) + '"></option>';
    }).join("");
  }

  function chip(name, value, label, checked) {
    return '<label class="chip"><input type="radio" name="' + name + '" value="' + value + '"' + (checked ? " checked" : "") + '><span>' + label + '</span></label>';
  }

  function openQuickAdd(presetIso) {
    closeMenu();
    state.sheetKind = "quick";
    state.sheetDate = null;
    var today = Dates.iso(Dates.schoolToday(new Date()));
    var tomorrow = Dates.iso(Dates.nextSchoolDay(Dates.parse(today)));
    var friday = Dates.iso(Dates.addDays(state.weekStart, 4));
    var when = "today";
    var dateValue = presetIso || today;
    if (presetIso) {
      if (presetIso === today) when = "today";
      else if (presetIso === tomorrow) when = "tomorrow";
      else if (presetIso === friday) when = "week";
      else when = "date";
    }
    openSheet("Quick add",
      '<form id="quick-form" novalidate>' +
      '<label class="field"><span class="field-label">What do you need to remember?</span>' +
      '<input name="title" type="text" maxlength="140" autocomplete="off" aria-describedby="title-error">' +
      '<p class="form-error" id="title-error" role="alert" hidden></p></label>' +
      '<fieldset><legend>When?</legend><div class="choices">' +
      chip("when", "today", "Today", when === "today") +
      chip("when", "tomorrow", "Tomorrow", when === "tomorrow") +
      chip("when", "week", "This week", when === "week") +
      chip("when", "date", "Choose date", when === "date") +
      '</div><div class="choose-date"><label class="field"><span class="field-label">Date</span>' +
      '<input name="date" type="date" value="' + esc(dateValue) + '"></label></div>' +
      '<p class="hint" id="when-preview"></p></fieldset>' +
      '<fieldset><legend>Type</legend><div class="choices">' +
      chip("type", "personal", "My task", true) +
      chip("type", "linked", "Linked task", false) +
      '</div></fieldset>' +
      '<div class="linked-fields"><label class="field"><span class="field-label">Opens in</span><select name="linkedArea">' + areaOptions("attainment") + '</select></label>' +
      '<label class="field"><span class="field-label">Class or record</span>' +
      '<input name="linkedId" type="text" list="class-codes" maxlength="24" autocomplete="off" aria-describedby="link-error">' +
      '<datalist id="class-codes">' + classList() + '</datalist>' +
      '<p class="form-error" id="link-error" role="alert" hidden></p></label></div>' +
      '<fieldset><legend>Priority</legend><div class="choices">' +
      chip("priority", "normal", "Normal", true) +
      chip("priority", "important", "Important", false) +
      '</div></fieldset>' +
      '<div class="form-actions"><button type="submit" class="btn solid">Add task</button>' +
      '<button type="button" class="btn" data-action="close-sheet">Cancel</button></div>' +
      '<p class="hint">Esc closes this panel.</p></form>',
      function () {
        var form = document.getElementById("quick-form");
        updateWhenPreview(form);
        form.elements.title.focus();
      });
  }

  function resolveWhen(form) {
    var when = form.elements.when.value;
    var today = Dates.schoolToday(new Date());
    if (when === "today") return { date: today };
    if (when === "tomorrow") return { date: Dates.nextSchoolDay(today) };
    if (when === "week") return { date: Dates.addDays(state.weekStart, 4) };
    var value = form.elements.date.value;
    if (!value) return { error: "Choose a date." };
    var date = Dates.parse(value);
    if (date.getDay() === 0 || date.getDay() === 6) {
      return { error: "Choose a weekday. This planner runs Monday to Friday." };
    }
    return { date: date };
  }

  function updateWhenPreview(form) {
    var el = document.getElementById("when-preview");
    if (!el || !form) return;
    var result = resolveWhen(form);
    el.textContent = result.error ? result.error : "Adds to " + formatHeading(result.date) + ".";
  }

  function showFieldError(id, input, message) {
    var el = document.getElementById(id);
    if (el) {
      el.hidden = false;
      el.textContent = message;
    }
    if (input) {
      input.setAttribute("aria-invalid", "true");
      input.focus();
    }
  }

  function submitQuickAdd(form) {
    var title = form.elements.title.value.trim();
    var titleError = document.getElementById("title-error");
    var linkError = document.getElementById("link-error");
    if (titleError) titleError.hidden = true;
    if (linkError) linkError.hidden = true;
    if (!title) {
      showFieldError("title-error", form.elements.title, "Write what you need to remember.");
      return;
    }
    form.elements.title.removeAttribute("aria-invalid");
    var when = resolveWhen(form);
    if (when.error) {
      updateWhenPreview(form);
      if (form.elements.when.value === "date") form.elements.date.focus();
      return;
    }
    var type = form.elements.type.value;
    var linkedArea = "";
    var linkedId = "";
    if (type === "linked") {
      linkedArea = form.elements.linkedArea.value;
      linkedId = form.elements.linkedId.value.trim();
      if (!linkedId) {
        showFieldError("link-error", form.elements.linkedId, "Add the class or record this links to.");
        return;
      }
    }
    var task = {
      id: uid("task"),
      title: title,
      date: Dates.iso(when.date),
      type: type,
      completed: false,
      priority: form.elements.priority.value === "important" ? "important" : "normal",
      linkedArea: linkedArea,
      linkedId: linkedId,
      notes: "",
      createdAt: nowStamp()
    };
    var tasks = Store.getTasks();
    tasks.push(task);
    markCustom();
    Store.saveTasks(tasks);
    closeSheet();
    toast("Added to " + formatHeading(when.date) + ".");
    var inWeek = Dates.iso(Dates.schoolMonday(when.date)) === Dates.iso(state.weekStart);
    if (!inWeek) setWeek(when.date, { silent: true });
    else refreshSurfaces();
  }

  function openEdit(id, focusNotes) {
    var task = Store.getTasks().find(function (item) { return item.id === id; });
    if (!task || task.type === "faculty") return;
    closeMenu();
    state.sheetKind = "edit";
    state.sheetDate = null;
    if (schoolWork) {
      openSheet(task.title,
        '<form id="edit-form" class="task-detail" novalidate data-id="' + esc(task.id) + '">' +
        '<label class="field"><span class="field-label">Task</span>' +
        '<input name="title" type="text" maxlength="140" autocomplete="off" value="' + esc(task.title) + '" aria-describedby="edit-title-error">' +
        '<p class="form-error" id="edit-title-error" role="alert" hidden></p></label>' +
        '<label class="field"><span class="field-label">Notes</span>' +
        '<textarea name="notes" id="task-notes" maxlength="500" rows="6" placeholder="Add notes">' + esc(task.notes || "") + '</textarea></label>' +
        '<label class="field"><span class="field-label">When</span>' +
        '<input name="date" type="date" value="' + esc(task.date) + '" aria-describedby="edit-date-error">' +
        '<p class="form-error" id="edit-date-error" role="alert" hidden></p></label>' +
        '<fieldset><legend>Priority</legend><div class="choices">' +
        chip("priority", "normal", "Normal", task.priority !== "important") +
        chip("priority", "important", "Important", task.priority === "important") +
        '</div></fieldset>' +
        '<fieldset><legend>Type</legend><div class="choices">' +
        chip("type", "personal", "My task", task.type !== "linked") +
        chip("type", "linked", "Linked task", task.type === "linked") +
        '</div></fieldset>' +
        '<div class="linked-fields"><label class="field"><span class="field-label">Opens in</span><select name="linkedArea">' + areaOptions(task.linkedArea || "attainment") + '</select></label>' +
        '<label class="field"><span class="field-label">Class or record</span>' +
        '<input name="linkedId" type="text" list="class-codes" maxlength="24" autocomplete="off" value="' + esc(task.linkedId || "") + '" aria-describedby="edit-link-error">' +
        '<datalist id="class-codes">' + classList() + '</datalist>' +
        '<p class="form-error" id="edit-link-error" role="alert" hidden></p></label></div>' +
        '<div class="form-actions"><button type="submit" class="btn solid">Save</button>' +
        '<button type="button" class="btn" data-action="close-sheet">Cancel</button>' +
        '<button type="button" class="btn" data-action="delete-from-edit" data-id="' + esc(task.id) + '">Delete</button></div></form>',
        function () {
          var form = document.getElementById("edit-form");
          if (focusNotes || !String(task.notes || "").trim()) form.elements.notes.focus();
          else form.elements.title.focus();
        });
      return;
    }
    openSheet("Edit task",
      '<form id="edit-form" novalidate data-id="' + esc(task.id) + '">' +
      '<label class="field"><span class="field-label">What do you need to remember?</span>' +
      '<input name="title" type="text" maxlength="140" autocomplete="off" value="' + esc(task.title) + '" aria-describedby="edit-title-error">' +
      '<p class="form-error" id="edit-title-error" hidden></p></label>' +
      '<label class="field"><span class="field-label">Day</span>' +
      '<input name="date" type="date" value="' + esc(task.date) + '" aria-describedby="edit-date-error">' +
      '<p class="form-error" id="edit-date-error" hidden></p></label>' +
      '<fieldset><legend>Type</legend><div class="choices">' +
      chip("type", "personal", "My task", task.type !== "linked") +
      chip("type", "linked", "Linked task", task.type === "linked") +
      '</div></fieldset>' +
      '<div class="linked-fields"><label class="field"><span class="field-label">Opens in</span><select name="linkedArea">' + areaOptions(task.linkedArea || "attainment") + '</select></label>' +
      '<label class="field"><span class="field-label">Class or record</span>' +
      '<input name="linkedId" type="text" list="class-codes" maxlength="24" autocomplete="off" value="' + esc(task.linkedId || "") + '" aria-describedby="edit-link-error">' +
      '<datalist id="class-codes">' + classList() + '</datalist>' +
      '<p class="form-error" id="edit-link-error" hidden></p></label></div>' +
      '<fieldset><legend>Priority</legend><div class="choices">' +
      chip("priority", "normal", "Normal", task.priority !== "important") +
      chip("priority", "important", "Important", task.priority === "important") +
      '</div></fieldset>' +
      '<label class="field"><span class="field-label">Note</span>' +
      '<textarea name="notes" id="task-notes" maxlength="500">' + esc(task.notes || "") + '</textarea></label>' +
      '<div class="form-actions"><button type="submit" class="btn solid">Save task</button>' +
      '<button type="button" class="btn" data-action="close-sheet">Cancel</button>' +
      '<button type="button" class="btn" data-action="delete-from-edit" data-id="' + esc(task.id) + '">Delete</button></div></form>',
      function () {
        var form = document.getElementById("edit-form");
        if (focusNotes) form.elements.notes.focus();
        else form.elements.title.focus();
      });
  }

  function submitEdit(form) {
    var id = form.getAttribute("data-id");
    var title = form.elements.title.value.trim();
    if (!title) {
      showFieldError("edit-title-error", form.elements.title, "Write what you need to remember.");
      return;
    }
    var dateValue = form.elements.date.value;
    if (!dateValue) {
      showFieldError("edit-date-error", form.elements.date, "Choose a weekday.");
      return;
    }
    var date = Dates.parse(dateValue);
    if (date.getDay() === 0 || date.getDay() === 6) {
      showFieldError("edit-date-error", form.elements.date, "Choose a weekday. This planner runs Monday to Friday.");
      return;
    }
    var type = form.elements.type.value === "linked" ? "linked" : "personal";
    var linkedArea = "";
    var linkedId = "";
    if (type === "linked") {
      linkedArea = form.elements.linkedArea.value;
      linkedId = form.elements.linkedId.value.trim();
      if (!linkedId) {
        showFieldError("edit-link-error", form.elements.linkedId, "Add the class or record this links to.");
        return;
      }
    }
    updateTask(id, function (task) {
      task.title = title;
      task.date = Dates.iso(date);
      task.type = type;
      task.priority = form.elements.priority.value === "important" ? "important" : "normal";
      task.linkedArea = linkedArea;
      task.linkedId = linkedId;
      task.notes = form.elements.notes.value.trim();
    });
    closeSheet();
    toast("Task saved.");
    var inWeek = Dates.iso(Dates.schoolMonday(date)) === Dates.iso(state.weekStart);
    if (!inWeek) setWeek(date, { silent: true });
    else refreshSurfaces();
  }

  function openDay(iso) {
    closeMenu();
    state.sheetKind = "day";
    state.sheetDate = iso;
    openSheet(formatHeading(Dates.parse(iso)), dayBody(iso));
  }

  function openFacultyCalendar() {
    document.dispatchEvent(new CustomEvent("facultyHubNavigate", {
      detail: { panel: "academic-calendar" }
    }));
  }

  function openLinked(id) {
    var task = Store.getTasks().find(function (item) { return item.id === id; });
    if (!task) return;
    closeMenu();
    state.sheetKind = "linked";
    state.sheetDate = null;
    var areas = window.MyWeekSeed.linkedAreas;
    var areaName = areas[task.linkedArea] || task.linkedArea || "Faculty Hub";
    document.dispatchEvent(new CustomEvent("facultyHubNavigate", {
      detail: { area: task.linkedArea, id: task.linkedId }
    }));
    openSheet("Linked task",
      '<div class="linked-open"><p>' + esc(task.title) + '</p>' +
      '<p>This task will open:</p>' +
      '<p class="linked-area">' + esc(areaName) + '</p>' +
      '<p class="linked-id">' + esc(task.linkedId || "") + '</p></div>');
  }

  function openSettings() {
    closeMenu();
    state.sheetKind = "settings";
    state.sheetDate = null;
    var settings = Store.getSettings();
    openSheet("Settings",
      '<fieldset><legend>Default week</legend><div class="choices">' +
      '<button type="button" class="btn" aria-pressed="true">Current week</button></div>' +
      '<p class="hint">The planner opens on the current school week.</p></fieldset>' +
      (schoolWork ? "" : '<div class="setting"><p id="lab-routines">Show routines</p>' +
      '<button type="button" class="switch" role="switch" aria-checked="' + (settings.showRoutines ? "true" : "false") + '" aria-labelledby="lab-routines" data-action="toggle-routines">' + (settings.showRoutines ? "On" : "Off") + '</button></div>') +
      '<div class="setting"><p id="lab-compact">Compact daily cards</p>' +
      '<button type="button" class="switch" role="switch" aria-checked="' + (settings.compact ? "true" : "false") + '" aria-labelledby="lab-compact" data-action="toggle-compact">' + (settings.compact ? "On" : "Off") + '</button></div>' +
      '<p class="settings-note">Press Q for Quick Add. Esc closes a panel.</p>');
  }

  function toggleRoutines() {
    var settings = Store.getSettings();
    settings.showRoutines = !settings.showRoutines;
    Store.saveSettings(settings);
    renderRoutines();
    var btn = document.querySelector('[data-action="toggle-routines"]');
    if (btn) {
      btn.setAttribute("aria-checked", settings.showRoutines ? "true" : "false");
      btn.textContent = settings.showRoutines ? "On" : "Off";
    }
  }

  function toggleCompact() {
    var settings = Store.getSettings();
    settings.compact = !settings.compact;
    Store.saveSettings(settings);
    applySettings(settings);
    var btn = document.querySelector('[data-action="toggle-compact"]');
    if (btn) {
      btn.setAttribute("aria-checked", settings.compact ? "true" : "false");
      btn.textContent = settings.compact ? "On" : "Off";
    }
  }

  function toggleRoutine(id, dayKey, button) {
    var iso = Dates.iso(state.weekStart);
    var rows = Store.getRoutines();
    var row = rows.find(function (item) { return item.id === id && item.weekStart === iso; });
    if (!row) return;
    row.completion[dayKey] = !row.completion[dayKey];
    markCustom();
    Store.saveRoutines(rows);
    renderRoutines();
    var next = document.querySelector('[data-action="toggle-routine"][data-id="' + CSS.escape(id) + '"][data-day="' + dayKey + '"]');
    if (next) next.focus();
    else if (button) button.focus();
  }

  function toggleTask(id, fromSheet) {
    var task = updateTask(id, function (item) { item.completed = !item.completed; });
    if (!task) return;
    var selector = '[data-action="toggle-task"][data-id="' + CSS.escape(id) + '"]';
    refreshSurfaces(fromSheet ? { sheet: selector } : { page: selector });
    renderCarry();
  }

  function deleteTask(id) {
    if (!state.menuConfirm) {
      state.menuConfirm = true;
      renderMenu();
      var btn = menuElement().querySelector('[data-action="delete-task"]');
      if (btn) btn.focus();
      return;
    }
    markCustom();
    Store.saveTasks(Store.getTasks().filter(function (task) { return task.id !== id; }));
    closeMenu();
    toast("Task deleted.");
    refreshSurfaces();
    renderCarry();
  }

  function moveTask(id, dayIndex) {
    var date = Dates.addDays(state.weekStart, dayIndex);
    updateTask(id, function (task) { task.date = Dates.iso(date); });
    closeMenu();
    toast("Moved to " + formatHeading(date) + ".");
    refreshSurfaces();
  }

  function carryOne(id) {
    var task = Store.getTasks().find(function (item) { return item.id === id; });
    if (!task) return;
    var next = Dates.addDays(Dates.parse(task.date), 7);
    updateTask(id, function (item) { item.date = Dates.iso(next); });
    closeMenu();
    toast("Carried to " + formatHeading(next) + ".");
    refreshSurfaces();
    renderCarry();
  }

  function duplicateTask(id) {
    var task = Store.getTasks().find(function (item) { return item.id === id; });
    if (!task) return;
    var copy = Object.assign({}, task, { id: uid("task"), completed: false, createdAt: nowStamp() });
    var tasks = Store.getTasks();
    tasks.push(copy);
    markCustom();
    Store.saveTasks(tasks);
    closeMenu();
    toast("Duplicated.");
    refreshSurfaces();
  }

  function toggleImportant(id) {
    updateTask(id, function (task) {
      task.priority = task.priority === "important" ? "normal" : "important";
    });
    closeMenu();
    refreshSurfaces();
  }

  function moveAllCarry() {
    var items = previousUnfinished();
    if (!items.length) return;
    var tasks = Store.getTasks();
    items.forEach(function (item) {
      var task = tasks.find(function (row) { return row.id === item.id; });
      if (!task) return;
      var index = Dates.weekdayIndex(Dates.parse(task.date));
      task.date = Dates.iso(Dates.addDays(state.weekStart, index));
    });
    markCustom();
    Store.saveTasks(tasks);
    state.carryChoices = {};
    toast(items.length === 2 ? "Moved both to this week." : "Moved " + items.length + " to this week.");
    refreshSurfaces();
    renderCarry();
  }

  function moveSelectedCarry() {
    var ids = Object.keys(state.carryChoices);
    if (!ids.length) {
      toast("Choose a day under a task first.");
      return;
    }
    var tasks = Store.getTasks();
    var count = 0;
    ids.forEach(function (id) {
      var task = tasks.find(function (row) { return row.id === id; });
      if (!task || state.carryChoices[id] == null) return;
      task.date = Dates.iso(Dates.addDays(state.weekStart, Number(state.carryChoices[id])));
      count += 1;
      delete state.carryChoices[id];
    });
    markCustom();
    Store.saveTasks(tasks);
    toast(count === 1 ? "Moved 1 task." : "Moved " + count + " tasks.");
    refreshSurfaces();
    renderCarry();
  }

  function dismissCarry() {
    var settings = Store.getSettings();
    settings.carryDismissed[Dates.iso(state.weekStart)] = true;
    Store.saveSettings(settings);
    state.carryChoices = {};
    renderCarry();
  }

  function pickCarry(id, day) {
    if (state.carryChoices[id] === day) delete state.carryChoices[id];
    else state.carryChoices[id] = day;
    renderCarry();
  }

  function jumpDay(iso) {
    var el = document.getElementById("day-" + iso);
    if (!el) return;
    el.scrollIntoView({ behavior: motionOK() ? "smooth" : "auto", block: "nearest" });
    el.classList.add("is-flash");
    window.setTimeout(function () { el.classList.remove("is-flash"); }, 700);
  }

  function toast(message) {
    var el = document.getElementById("status");
    el.hidden = false;
    el.textContent = message;
    window.clearTimeout(state.toastTimer);
    state.toastTimer = window.setTimeout(function () { el.hidden = true; }, 3200);
  }

  function announce(message) {
    var el = document.getElementById("live");
    el.textContent = "";
    window.setTimeout(function () { el.textContent = message; }, 30);
  }

  function markCustom() {
    var meta = Store.getMeta();
    if (meta.customized) return;
    meta.customized = true;
    meta.sample = false;
    Store.saveMeta(meta);
    if (state.weekStart) renderHeader();
  }

  function emitChange(reason) {
    document.dispatchEvent(new CustomEvent("myweek:change", { detail: { reason: reason || "update" } }));
  }

  function setWeek(date, options) {
    var base = date instanceof Date ? date : Dates.parse(date);
    state.weekStart = Dates.schoolMonday(base);
    state.editingFocus = false;
    state.carryExpanded = false;
    state.carryChoices = {};
    state.progress = null;
    closeMenu();
    renderAll();
    if (!options || !options.silent) {
      announce("Showing " + formatRange(state.weekStart, Dates.addDays(state.weekStart, 4)) + ".");
    }
  }

  function refresh() {
    applySettings(Store.getSettings());
    renderAll();
  }

  function isTyping(el) {
    if (!el || !el.tagName) return false;
    var tag = el.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
  }

  function onClick(event) {
    var inMenu = event.target.closest("#menu");
    var actionEl = event.target.closest("[data-action]");
    if (!inMenu && menuOpen() && (!actionEl || actionEl.dataset.action !== "open-menu")) closeMenu();
    if (!actionEl) return;
    var action = actionEl.dataset.action;
    var id = actionEl.dataset.id || "";
    var fromSheet = !!event.target.closest("#sheet-body");
    switch (action) {
      case "prev-week":
        setWeek(Dates.addDays(state.weekStart, -7));
        break;
      case "next-week":
        setWeek(Dates.addDays(state.weekStart, 7));
        break;
      case "today":
        setWeek(new Date());
        break;
      case "settings":
        openSettings();
        break;
      case "quick-add":
        openQuickAdd();
        break;
      case "close-sheet":
        closeSheet();
        break;
      case "edit-focus":
        state.editingFocus = true;
        state.focusDraft = focusFor(Dates.iso(state.weekStart));
        renderFocus();
        document.getElementById("focus-input").focus();
        break;
      case "cancel-focus":
        state.editingFocus = false;
        renderFocus();
        break;
      case "jump-day":
        jumpDay(actionEl.dataset.date);
        break;
      case "open-day":
        openDay(actionEl.dataset.date);
        break;
      case "add-day":
        openQuickAdd(actionEl.dataset.date);
        break;
      case "toggle-task":
        toggleTask(id, fromSheet);
        break;
      case "open-menu":
        onOpenMenu(id, actionEl);
        break;
      case "open-task":
        openEdit(id, false);
        break;
      case "open-linked":
        openLinked(id);
        break;
      case "open-calendar":
        openFacultyCalendar();
        break;
      case "edit-task":
        openEdit(id, false);
        break;
      case "note-task":
        openEdit(id, true);
        break;
      case "important-task":
        toggleImportant(id);
        break;
      case "menu-move":
        state.menuMode = "move";
        renderMenu();
        if (state.menuAnchor) placeMenu(state.menuAnchor);
        break;
      case "menu-back":
        state.menuMode = "root";
        state.menuConfirm = false;
        renderMenu();
        if (state.menuAnchor) placeMenu(state.menuAnchor);
        menuElement().querySelector("button").focus();
        break;
      case "move-task":
        moveTask(id, Number(actionEl.dataset.day));
        break;
      case "duplicate-task":
        duplicateTask(id);
        break;
      case "carry-task":
        carryOne(id);
        break;
      case "delete-task":
        deleteTask(id);
        break;
      case "delete-from-edit":
        if (actionEl.dataset.confirm !== "yes") {
          actionEl.dataset.confirm = "yes";
          actionEl.textContent = "Confirm delete";
          return;
        }
        markCustom();
        Store.saveTasks(Store.getTasks().filter(function (task) { return task.id !== id; }));
        closeSheet();
        toast("Task deleted.");
        refreshSurfaces();
        renderCarry();
        break;
      case "toggle-routines":
        toggleRoutines();
        break;
      case "toggle-compact":
        toggleCompact();
        break;
      case "toggle-routine":
        toggleRoutine(id, actionEl.dataset.day, actionEl);
        break;
      case "add-plan":
        state.addingPlan = true;
        renderLearningPlan();
        break;
      case "cancel-plan":
        state.addingPlan = false;
        renderLearningPlan();
        break;
      case "toggle-plan":
        togglePlan(id);
        break;
      case "delete-plan":
        deletePlan(id, actionEl);
        break;
      case "carry-all":
        moveAllCarry();
        break;
      case "carry-expand":
        state.carryExpanded = !state.carryExpanded;
        renderCarry();
        var expandBtn = document.querySelector('[data-action="carry-expand"]');
        if (expandBtn) expandBtn.focus();
        break;
      case "carry-selected":
        moveSelectedCarry();
        break;
      case "carry-dismiss":
        dismissCarry();
        break;
      case "carry-pick":
        pickCarry(id, Number(actionEl.dataset.day));
        break;
      default:
        break;
    }
  }

  function onKeydown(event) {
    if (event.key === "Escape" && menuOpen()) {
      event.preventDefault();
      event.stopPropagation();
      var back = state.menuAnchor;
      closeMenu();
      if (back && typeof back.focus === "function") back.focus();
      return;
    }
    if (event.key === "Escape" && state.editingFocus && !sheet().open) {
      state.editingFocus = false;
      renderFocus();
      return;
    }
    if ((event.key === "q" || event.key === "Q") && !event.metaKey && !event.ctrlKey && !event.altKey) {
      if (isTyping(event.target) || sheet().open || menuOpen()) return;
      event.preventDefault();
      openQuickAdd();
      return;
    }
    if (event.target && event.target.getAttribute && event.target.getAttribute("role") === "radio") {
      if (event.key !== "ArrowRight" && event.key !== "ArrowLeft" && event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      var radios = Array.prototype.slice.call(event.target.parentElement.querySelectorAll("[role='radio']"));
      var index = radios.indexOf(event.target);
      if (index < 0) return;
      event.preventDefault();
      var dir = (event.key === "ArrowRight" || event.key === "ArrowDown") ? 1 : -1;
      var next = radios[(index + dir + radios.length) % radios.length];
      next.click();
      next.focus();
    }
  }

  function materialiseTasks(monday) {
    return window.MyWeekSeed.tasks.map(function (task) {
      var date = Dates.addDays(monday, task.weekOffset * 7 + task.dayIndex);
      return {
        id: task.id,
        title: task.title,
        date: Dates.iso(date),
        type: task.type,
        completed: !!task.completed,
        priority: task.priority || "normal",
        linkedArea: task.linkedArea || "",
        linkedId: task.linkedId || "",
        notes: task.notes || "",
        createdAt: Dates.iso(date) + (task.createdAt || "T08:00:00")
      };
    });
  }

  function materialiseFocus(monday) {
    return window.MyWeekSeed.focuses.map(function (row) {
      return {
        weekStart: Dates.iso(Dates.addDays(monday, row.weekOffset * 7)),
        focus: row.focus
      };
    });
  }

  function materialiseRoutines(monday) {
    var out = [];
    window.MyWeekSeed.routines.forEach(function (week) {
      var start = Dates.iso(Dates.addDays(monday, week.weekOffset * 7));
      window.MyWeekSeed.routineTemplates.forEach(function (tpl) {
        var flags = week.items[tpl.id] || [false, false, false, false, false];
        var completion = {};
        DAY_KEYS.forEach(function (name, index) { completion[name] = !!flags[index]; });
        out.push({ id: tpl.id, title: tpl.title, weekStart: start, completion: completion });
      });
    });
    return out;
  }

  function materialiseFaculty(monday) {
    return window.MyWeekSeed.facultyEvents.map(function (event) {
      return {
        id: event.id,
        date: Dates.iso(Dates.addDays(monday, event.dayIndex)),
        title: event.title,
        category: "faculty"
      };
    });
  }

  function initData() {
    if (schoolWork) return;
    var meta = Store.getMeta();
    if (meta.seeded) return;
    if (Store.getTasks().length) {
      Store.saveMeta({ seeded: true });
      return;
    }
    var monday = Dates.schoolMonday(new Date());
    Store.saveTasks(materialiseTasks(monday));
    Store.saveFocuses(materialiseFocus(monday));
    Store.saveRoutines(materialiseRoutines(monday));
    Store.saveFacultyEvents(materialiseFaculty(monday));
    Store.saveMeta({ seeded: true, anchorWeek: Dates.iso(monday) });
  }

  function init() {
    initData();
    applySettings(Store.getSettings());
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKeydown, true);
    document.addEventListener("submit", function (event) {
      if (event.target.id === "quick-form") {
        event.preventDefault();
        submitQuickAdd(event.target);
      } else if (event.target.id === "edit-form") {
        event.preventDefault();
        submitEdit(event.target);
      } else if (event.target.id === "focus-form") {
        event.preventDefault();
        var focusInput = document.getElementById("focus-input");
        var text = (focusInput ? focusInput.value : state.focusDraft).trim();
        saveFocus(Dates.iso(state.weekStart), text);
        state.editingFocus = false;
        renderFocus();
        toast(text ? "Focus saved." : "Focus cleared.");
      } else if (event.target.id === "plan-form") {
        event.preventDefault();
        var planInput = document.getElementById("plan-input");
        addPlanItem(planInput ? planInput.value : "");
      }
    });
    document.addEventListener("input", function (event) {
      if (event.target.id === "focus-input") state.focusDraft = event.target.value;
      if (event.target.name === "title" || event.target.name === "linkedId") {
        event.target.removeAttribute("aria-invalid");
        var errId = event.target.getAttribute("aria-describedby");
        var err = errId ? document.getElementById(errId) : null;
        if (err) err.hidden = true;
      }
    });
    document.addEventListener("change", function (event) {
      if (event.target.form && event.target.form.id === "quick-form" && (event.target.name === "when" || event.target.name === "date")) {
        updateWhenPreview(event.target.form);
      }
    });
    sheet().addEventListener("click", function (event) {
      if (event.target === sheet()) closeSheet();
    });
    sheet().addEventListener("close", function () {
      state.sheetKind = null;
      state.sheetDate = null;
      var back = state.lastFocus;
      state.lastFocus = null;
      if (back && document.contains(back) && typeof back.focus === "function") back.focus();
    });
    window.addEventListener("resize", function () {
      if (menuOpen()) closeMenu();
    });
    document.addEventListener("scroll", function () {
      if (menuOpen() && Date.now() - (state.menuOpenedAt || 0) > 400) closeMenu();
    }, true);

    window.MyWeek = {
      refresh: refresh,
      setWeek: function (date) { setWeek(date); },
      addTask: function (task) {
        var title = String((task && task.title) || "").trim();
        if (!title) return null;
        var today = Dates.iso(Dates.schoolToday(new Date()));
        var next = {
          id: (task && task.id) || uid("task"),
          title: title,
          date: (task && task.date) || today,
          type: (task && task.type) || "personal",
          completed: !!(task && task.completed),
          priority: task && task.priority === "important" ? "important" : "normal",
          linkedArea: (task && task.linkedArea) || "",
          linkedId: (task && task.linkedId) || "",
          notes: (task && task.notes) || "",
          createdAt: (task && task.createdAt) || nowStamp()
        };
        var tasks = Store.getTasks();
        tasks.push(next);
        markCustom();
        Store.saveTasks(tasks);
        refresh();
        return next;
      },
      getCurrentWeek: function () {
        var friday = Dates.addDays(state.weekStart, 4);
        return {
          start: Dates.iso(state.weekStart),
          end: Dates.iso(friday),
          days: Dates.weekDays(state.weekStart).map(function (date) { return Dates.iso(date); })
        };
      },
      exportData: function () {
        return {
          tasks: Store.getTasks(),
          focuses: Store.getFocuses(),
          routines: Store.getRoutines(),
          settings: Store.getSettings(),
          facultyEvents: Store.getFacultyEvents(),
          timetable: getTimetable(),
          exportedAt: nowStamp()
        };
      },
      /**
       * Future Faculty Calendar feed. Replaces the seeded events.
       * Events stay read-only in the UI.
       */
      setFacultyEvents: function (events) {
        Store.saveFacultyEvents(events || []);
        refresh();
      },
      /**
       * Future timetable feed. Keys are monday … friday.
       * Each lesson: period, classCode, subject, lessonTitle, planStatus.
       */
      setTimetable: function (table) {
        Store.saveTimetable(table || null);
        refresh();
      },
      sync: migrateSchoolWork
    };

    window.addEventListener("storage", function (event) {
      var schoolKeys = [KEYS.tasks, KEYS.focus, KEYS.settings, KEYS.meta, "schoolwork.plplan"];
      if (event.key === KEYS.tasks || (schoolWork && (event.key === "academicCalendarEvents" || schoolKeys.indexOf(event.key) !== -1))) {
        if (schoolWork && event.key === "academicCalendarEvents") renderFaculty();
        if (schoolWork) applySettings(Store.getSettings());
        refreshSurfaces();
      }
    });

    setWeek(new Date(), { silent: true });
    migrateSchoolWork().then(function (pulled) {
      if (pulled) refresh();
    });
  }

  init();
})();
