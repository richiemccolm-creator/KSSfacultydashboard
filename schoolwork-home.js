/**
 * Hub home: the School work week strip.
 * Monday to Friday of the teacher's School work list, with a tick and an
 * add line per day. It reads and writes the same store as School work
 * (schoolwork.* in this browser, schoolworkV1 on the account), so a task
 * added here shows in School work and the other way round.
 *
 * The account merge mirrors my-week/app.js (runSchoolSync): rows merge by id,
 * newest updatedAt wins, deletions win over older edits. Keep the two in step.
 */
(function () {
  'use strict';

  var K = {
    tasks: 'schoolwork.tasks',
    focus: 'schoolwork.focus',
    plan: 'schoolwork.plplan',
    settings: 'schoolwork.settings',
    meta: 'schoolwork.meta',
    deleted: 'schoolwork.deleted',
    seen: 'schoolwork.cloudSeen'
  };
  var CLOUD_KEY = 'schoolworkV1';
  var DELETED_KEEP_DAYS = 120;
  var PULL_EVERY_MS = 120000;
  var MAX_ROWS = 5;
  var DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  var MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var TERMS = [
    { name: 'Term 1', start: '2026-08-17', end: '2026-10-09' },
    { name: 'Term 2', start: '2026-10-26', end: '2026-12-18' },
    { name: 'Term 3', start: '2027-01-06', end: '2027-04-02' },
    { name: 'Term 4', start: '2027-04-19', end: '2027-06-25' }
  ];

  var weekOffset = 0;
  var syncChain = Promise.resolve();
  var lastPullAt = 0;
  var bound = false;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function read(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (raw != null) return JSON.parse(raw);
    } catch (e) {}
    return fallback;
  }
  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  }
  function pad(n) { return String(n).padStart(2, '0'); }
  function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parse(s) { var p = String(s).split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); }
  function addDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
  function schoolMonday(date) {
    var d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    var day = d.getDay();
    if (day === 0) return addDays(d, 1);
    if (day === 6) return addDays(d, 2);
    return addDays(d, 1 - day);
  }
  function uid() {
    return 'task_' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
  }
  function nowStamp() {
    var d = new Date();
    return iso(d) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
  }

  function termLabel(monday) {
    var m = iso(monday);
    for (var i = 0; i < TERMS.length; i++) {
      if (m >= TERMS[i].start && m <= TERMS[i].end) {
        var week = Math.floor((monday - schoolMonday(parse(TERMS[i].start))) / (7 * 86400000)) + 1;
        return TERMS[i].name + ' · Week ' + week;
      }
    }
    return '';
  }

  function holidayOn(dayIso) {
    var events = read('academicCalendarEvents', null);
    if (!Array.isArray(events) || !events.length) events = window.ACADEMIC_CALENDAR_DEFAULT_EVENTS || [];
    for (var i = 0; i < events.length; i++) {
      var ev = events[i];
      if (!ev || String(ev.date || '').slice(0, 10) !== dayIso) continue;
      var title = String(ev.title || '');
      if (String(ev.category || '').toLowerCase() === 'holiday' || /^holiday\b/i.test(title)) {
        return title.replace(/^holiday\s*[–\-:·]?\s*/i, '').trim() || 'Holiday';
      }
    }
    return '';
  }

  /* ---- Store, stamped the way School work stamps it ---- */

  function saveTasks(next) {
    var before = read(K.tasks, []);
    var now = new Date().toISOString();
    var old = {};
    before.forEach(function (row) { old[row.id] = row; });
    var kept = {};
    next.forEach(function (row) {
      kept[row.id] = true;
      var prev = old[row.id];
      if (!prev || rowContent(prev) !== rowContent(row)) row.updatedAt = now;
      else if (prev.updatedAt) row.updatedAt = prev.updatedAt;
    });
    var gone = before.filter(function (row) { return !kept[row.id]; });
    if (gone.length) {
      var deleted = read(K.deleted, {});
      gone.forEach(function (row) { deleted['task:' + row.id] = now; });
      write(K.deleted, pruneDeleted(deleted));
    }
    write(K.tasks, next);
    var meta = read(K.meta, {});
    if (!meta.customized) {
      meta.customized = true;
      meta.sample = false;
      write(K.meta, meta);
    }
    queueSync();
  }

  function rowContent(row) {
    var copy = Object.assign({}, row);
    delete copy.updatedAt;
    return JSON.stringify(copy);
  }

  /* ---- Account sync (same merge as my-week/app.js) ---- */

  function byId(row) { return row.id; }
  function byWeek(row) { return row.weekStart; }

  function pruneDeleted(map) {
    var cutoff = new Date(Date.now() - DELETED_KEEP_DAYS * 86400000).toISOString();
    var out = {};
    Object.keys(map || {}).forEach(function (key) { if (map[key] >= cutoff) out[key] = map[key]; });
    return out;
  }
  function mergeDeleted(a, b) {
    var out = Object.assign({}, a || {});
    Object.keys(b || {}).forEach(function (key) { if (!out[key] || b[key] > out[key]) out[key] = b[key]; });
    return pruneDeleted(out);
  }
  function mergeRows(kind, cloudRows, localRows, keyOf, deleted) {
    var order = [];
    var pick = {};
    function consider(row) {
      if (!row) return;
      var key = keyOf(row);
      if (key == null) return;
      if (!Object.prototype.hasOwnProperty.call(pick, key)) { order.push(key); pick[key] = row; }
      else if ((row.updatedAt || '') > (pick[key].updatedAt || '')) pick[key] = row;
    }
    (cloudRows || []).forEach(consider);
    (localRows || []).forEach(consider);
    return order.map(function (key) { return pick[key]; }).filter(function (row) {
      var gone = deleted[kind + ':' + keyOf(row)];
      return !gone || gone < (row.updatedAt || '');
    });
  }
  function localBundle() {
    return {
      version: 2,
      tasks: read(K.tasks, []),
      focus: read(K.focus, []),
      plan: read(K.plan, []),
      settings: read(K.settings, {}),
      meta: read(K.meta, {}),
      deleted: read(K.deleted, {})
    };
  }
  function mergeBundles(local, cloud) {
    var deleted = mergeDeleted(cloud.deleted, local.deleted);
    var settings = Object.assign({}, cloud.settings || {}, local.settings || {});
    settings.carryDismissed = Object.assign({}, (cloud.settings || {}).carryDismissed, (local.settings || {}).carryDismissed);
    return {
      version: 2,
      tasks: mergeRows('task', cloud.tasks, local.tasks, byId, deleted),
      focus: mergeRows('focus', cloud.focus, local.focus, byWeek, deleted),
      plan: mergeRows('plan', cloud.plan, local.plan, byId, deleted),
      settings: settings,
      meta: Object.assign({}, cloud.meta || {}, local.meta || {}),
      deleted: deleted
    };
  }
  function stableText(value) {
    if (Array.isArray(value)) return '[' + value.map(stableText).join(',') + ']';
    if (value && typeof value === 'object') {
      return '{' + Object.keys(value).sort().map(function (key) {
        return JSON.stringify(key) + ':' + stableText(value[key]);
      }).join(',') + '}';
    }
    return JSON.stringify(value === undefined ? null : value);
  }
  function sortedRows(rows, keyOf) {
    return (rows || []).slice().sort(function (a, b) {
      var ka = String(keyOf(a)), kb = String(keyOf(b));
      return ka < kb ? -1 : ka > kb ? 1 : 0;
    });
  }
  function canonical(b) {
    return stableText({
      tasks: sortedRows(b.tasks, byId),
      focus: sortedRows(b.focus, byWeek),
      plan: sortedRows(b.plan, byId),
      settings: b.settings || {},
      meta: b.meta || {},
      deleted: b.deleted || {}
    });
  }
  function applyBundle(b) {
    write(K.tasks, b.tasks);
    write(K.focus, b.focus);
    write(K.plan, b.plan);
    write(K.settings, b.settings);
    write(K.meta, b.meta);
    write(K.deleted, b.deleted);
  }
  function cloudApi() {
    var api = window.DataService;
    if (!api || !api.get || !api.set || !api.isUsingCloud) return null;
    try { return api.isUsingCloud() ? api : null; } catch (e) { return null; }
  }

  function runSync() {
    var api = cloudApi();
    if (!api) return Promise.resolve(false);
    lastPullAt = Date.now();
    return api.get(CLOUD_KEY).then(function (cloud) {
      var local = localBundle();
      if (!(cloud && typeof cloud === 'object' && cloud.version)) {
        /* Once this browser has seen an account copy, null means "could not read". */
        if (read(K.seen, false) || !local.tasks.length) return false;
        return api.set(CLOUD_KEY, local).then(function () { write(K.seen, true); return false; });
      }
      write(K.seen, true);
      var merged = mergeBundles(local, cloud);
      var text = canonical(merged);
      var changed = text !== canonical(local);
      if (changed) applyBundle(merged);
      if (text === canonical(cloud)) return changed;
      return api.set(CLOUD_KEY, merged).then(function () { return changed; });
    }).catch(function () { return false; });
  }

  function sync() {
    syncChain = syncChain.then(runSync, runSync).then(function (changed) {
      if (changed) render();
    });
    return syncChain;
  }
  var syncTimer = null;
  function queueSync() {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(sync, 400);
  }
  function pull() {
    if (document.visibilityState === 'hidden') return;
    if (Date.now() - lastPullAt < 10000) return;
    sync();
  }

  /* ---- View ---- */

  function openSchoolWork() {
    if (typeof window.showPanel === 'function') window.showPanel('embed-operations');
  }

  function render() {
    var el = document.getElementById('homeSchoolWeek');
    if (!el) return;
    var focusedAdd = document.activeElement && document.activeElement.closest &&
      document.activeElement.closest('.home-sw-add') ? document.activeElement.getAttribute('data-date') : null;
    var monday = addDays(schoolMonday(new Date()), weekOffset * 7);
    var todayIso = iso(new Date());
    var tasks = read(K.tasks, []).filter(function (t) { return t && t.type !== 'faculty'; });
    var term = termLabel(monday);
    var friday = addDays(monday, 4);
    var range = monday.getDate() + (monday.getMonth() !== friday.getMonth() ? ' ' + MONTHS_SHORT[monday.getMonth()] : '') +
      '–' + friday.getDate() + ' ' + MONTHS_SHORT[friday.getMonth()];
    var weekName = weekOffset === 0 ? 'This week' : weekOffset === 1 ? 'Next week' : weekOffset === -1 ? 'Last week' : 'Week of ' + monday.getDate() + ' ' + MONTHS_SHORT[monday.getMonth()];

    var days = [0, 1, 2, 3, 4].map(function (n) {
      var date = addDays(monday, n);
      var dayIso = iso(date);
      var holiday = holidayOn(dayIso);
      var list = tasks.filter(function (t) { return t.date === dayIso; }).sort(function (a, b) {
        if (!!a.completed !== !!b.completed) return a.completed ? 1 : -1;
        if ((a.priority === 'important') !== (b.priority === 'important')) return a.priority === 'important' ? -1 : 1;
        return 0;
      });
      var shown = list.slice(0, MAX_ROWS);
      var rows = shown.map(function (t) {
        return '<li class="home-sw-task' + (t.completed ? ' is-done' : '') + '">' +
          '<button type="button" class="home-sw-tick" data-sw-toggle="' + esc(t.id) + '" aria-pressed="' + (t.completed ? 'true' : 'false') + '" aria-label="' + esc((t.completed ? 'Mark not done: ' : 'Mark done: ') + t.title) + '">' +
          '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7"/></svg></button>' +
          '<span class="home-sw-title">' + (t.priority === 'important' ? '<span class="home-sw-imp" title="Important">!</span>' : '') + esc(t.title) + '</span></li>';
      }).join('');
      if (list.length > MAX_ROWS) {
        rows += '<li class="home-sw-more"><button type="button" data-sw-open>+' + (list.length - MAX_ROWS) + ' more</button></li>';
      }
      var done = list.filter(function (t) { return t.completed; }).length;
      var count = list.length ? (done === list.length ? 'All done' : done + ' of ' + list.length) : '';
      return '<div class="home-sw-day' + (dayIso === todayIso ? ' is-today' : '') + (holiday ? ' is-holiday' : '') + '">' +
        '<div class="home-sw-day-head"><span class="home-sw-day-name">' + DAY_SHORT[n] + ' <span>' + date.getDate() + '</span></span>' +
        (holiday ? '<span class="home-sw-closed">' + esc(holiday) + '</span>' : count ? '<span class="home-sw-count">' + count + '</span>' : '') + '</div>' +
        '<ul class="home-sw-list">' + rows + '</ul>' +
        (holiday && !list.length ? '' :
          '<input type="text" class="home-sw-add" data-date="' + dayIso + '" maxlength="200" placeholder="Add task…" aria-label="Add a task for ' + DAY_SHORT[n] + ' ' + date.getDate() + ' ' + MONTHS_SHORT[date.getMonth()] + '">') +
        '</div>';
    }).join('');

    el.innerHTML =
      '<div class="home-sw-head">' +
        '<div class="home-sw-heading"><h2 class="home-panel-title" id="homeSchoolWeekTitle">School work</h2>' +
        '<p class="home-sw-sub">' + esc(weekName) + ' · ' + esc(range) + (term ? ' · ' + esc(term) : '') + '</p></div>' +
        '<div class="home-sw-actions">' +
          '<button type="button" class="home-sw-nav" data-sw-week="-1" aria-label="Previous week"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg></button>' +
          (weekOffset !== 0 ? '<button type="button" class="home-sw-nav home-sw-now" data-sw-week="0">This week</button>' : '') +
          '<button type="button" class="home-sw-nav" data-sw-week="1" aria-label="Next week"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg></button>' +
          '<button type="button" class="home-sw-open" data-sw-open>Open School work</button>' +
        '</div>' +
      '</div>' +
      '<div class="home-sw-days">' + days + '</div>';

    if (focusedAdd) {
      var again = el.querySelector('.home-sw-add[data-date="' + focusedAdd + '"]');
      if (again) again.focus();
    }
  }

  function bind(el) {
    if (bound) return;
    bound = true;
    el.addEventListener('click', function (ev) {
      var t = ev.target.closest('[data-sw-toggle]');
      if (t) {
        var id = t.getAttribute('data-sw-toggle');
        var tasks = read(K.tasks, []);
        tasks.forEach(function (row) { if (row.id === id) row.completed = !row.completed; });
        saveTasks(tasks);
        render();
        var back = el.querySelector('[data-sw-toggle="' + CSS.escape(id) + '"]');
        if (back) back.focus();
        return;
      }
      var w = ev.target.closest('[data-sw-week]');
      if (w) {
        var step = Number(w.getAttribute('data-sw-week'));
        weekOffset = step === 0 ? 0 : weekOffset + step;
        render();
        return;
      }
      if (ev.target.closest('[data-sw-open]')) openSchoolWork();
    });
    el.addEventListener('keydown', function (ev) {
      var input = ev.target.closest('.home-sw-add');
      if (!input) return;
      if (ev.key === 'Escape') { input.value = ''; input.blur(); return; }
      if (ev.key !== 'Enter' || ev.isComposing) return;
      ev.preventDefault();
      var title = input.value.trim();
      if (!title) return;
      var tasks = read(K.tasks, []);
      tasks.push({
        id: uid(),
        title: title,
        date: input.getAttribute('data-date'),
        type: 'personal',
        completed: false,
        priority: 'normal',
        linkedArea: '',
        linkedId: '',
        notes: '',
        createdAt: nowStamp()
      });
      saveTasks(tasks);
      input.value = '';
      render();
    });
  }

  function init() {
    var el = document.getElementById('homeSchoolWeek');
    if (!el) return;
    var first = !bound;
    bind(el);
    render();
    if (first) sync();
    else pull();
  }

  /* School work (the iframe) writes the same keys; storage events keep the strip in step. */
  window.addEventListener('storage', function (ev) {
    if (ev.key === K.tasks || ev.key === 'academicCalendarEvents') render();
  });
  document.addEventListener('visibilitychange', pull);
  window.addEventListener('focus', pull);
  window.setInterval(pull, PULL_EVERY_MS);

  window.SchoolWorkHome = { render: init };
})();
