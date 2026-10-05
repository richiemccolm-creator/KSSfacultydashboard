/**
 * NPA tracker page: Photography and Art & Design strands for the same class, side by side. Data rules and spreadsheet reading are in npa-tracker-core.js;
 * cloud saving (merging edits from other devices) is tracker-sync.js.
 *
 * Pupil data handling:
 * - Saved only to this teacher's own pupil_data row (row level security: owner, plus admins read).
 * - An imported spreadsheet is read in this browser. The file is never uploaded; only the fields
 *   shown in the import preview are saved, and only after the teacher confirms.
 * - All text is put on the page as text (never as HTML), so nothing in a spreadsheet can run.
 */
/* global NpaTracker, TrackerSync, XLSX */
(function() {
  'use strict';

  var DATA_TYPE = 'npa-v1';
  var XLSX_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
  var MAX_FILE_BYTES = 5 * 1024 * 1024;
  var PREFS_KEY = 'npa-tracker-prefs';
  var STATUS_LABEL = { done: 'Complete', started: 'In progress', '': 'Not started' };

  var S = {};
  var SYNC = TrackerSync.create({ dataType: DATA_TYPE, state: S, onStatus: renderSaveStatus, onRemoteChange: render });
  var prefs = readPrefs();

  // ── small helpers ─────────────────────────────────────────
  function h(tag, props) {
    var el = document.createElement(tag);
    Object.keys(props || {}).forEach(function(k) {
      var v = props[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'text') el.textContent = v;
      else if (k === 'class') el.className = v;
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    });
    for (var i = 2; i < arguments.length; i++) append(el, arguments[i]);
    return el;
  }
  function append(el, c) {
    if (c === null || c === undefined || c === false) return;
    if (Array.isArray(c)) { c.forEach(function(x) { append(el, x); }); return; }
    el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  }
  function $(id) { return document.getElementById(id); }
  function uid(prefix) {
    var r = (window.crypto && crypto.randomUUID) ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
    return prefix + '-' + Date.now().toString(36) + r;
  }
  function readPrefs() {
    try { return JSON.parse(localStorage.getItem(PREFS_KEY)) || {}; } catch (e) { return {}; }
  }
  function writePrefs() {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch (e) { /* storage blocked: prefs are a convenience */ }
  }
  var toastTimer = null;
  function toast(msg, ms) {
    var t = $('npa-toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function() { t.classList.remove('show'); }, ms || 2600);
  }
  function blocked() {
    if (SYNC.isLoaded()) return false;
    toast('Your tracker has not loaded, so this change would not be saved. Tap Retry at the top.', 4000);
    return true;
  }
  function save() { return SYNC.save(); }

  function currentClass() {
    var cls = S.classes || [];
    return cls.find(function(c) { return c.id === prefs.classId; }) || cls[0] || null;
  }
  // View: 'dashboard' (who is off track), 'overview' (both strands, one row per pupil) or a strand id ('photo' / 'art').
  function currentView() {
    var v = prefs.view;
    if (v === 'dashboard') return v;
    return (S.courses || []).some(function(c) { return c.id === v; }) ? v : 'overview';
  }
  function strandName(course) {
    var def = NpaTracker.COURSES.find(function(c) { return c.id === course.id; });
    return def ? def.short : course.name;
  }
  function unitPref(courseId) { return (prefs.units && prefs.units[courseId]) || ''; }
  function setUnitPref(courseId, unitId) {
    prefs.units = prefs.units || {};
    prefs.units[courseId] = unitId;
    writePrefs();
  }
  function visibleUnits(course) {
    var id = unitPref(course.id);
    if (id && course.units.some(function(u) { return u.id === id; })) {
      return course.units.filter(function(u) { return u.id === id; });
    }
    return course.units;
  }
  function findTask(taskId) {
    var courses = S.courses || [];
    for (var c = 0; c < courses.length; c++) {
      for (var i = 0; i < courses[c].units.length; i++) {
        var unit = courses[c].units[i];
        var t = unit.tasks.find(function(x) { return x.id === taskId; });
        if (t) return { course: courses[c], unit: unit, task: t };
      }
    }
    return null;
  }
  function openDialog(d) {
    document.body.appendChild(d);
    d.addEventListener('close', function() { d.remove(); });
    d.setAttribute('tabindex', '-1');
    d.showModal();
    d.focus();   // start on the dialog, not its close button; callers can focus a field after this
    return d;
  }
  function dialog(title, body, actions) {
    var d = h('dialog', { class: 'npa-dialog' },
      h('form', { method: 'dialog', class: 'npa-dialog-inner' },
        h('header', { class: 'npa-dialog-head' },
          h('h2', { text: title }),
          h('button', { class: 'npa-icon-btn', value: 'close', 'aria-label': 'Close', text: '×' })),
        h('div', { class: 'npa-dialog-body' }, body),
        actions ? h('footer', { class: 'npa-dialog-foot' }, actions) : null));
    return d;
  }

  // ── save status ───────────────────────────────────────────
  var SAVE_STATUS = {
    loading: ['Loading…', 'muted'],
    saved: ['Saved', 'ok'],
    pending: ['Saving…', 'muted'],
    saving: ['Saving…', 'muted'],
    retrying: ['Not saved, retrying', 'warn'],
    offline: ['Offline, kept on this device', 'warn'],
    'load-failed': ['Not loaded', 'bad'],
    'signed-out': ['Signed out', 'bad'],
    local: ['Saved on this device only', 'warn']
  };
  function renderSaveStatus(status) {
    var cfg = SAVE_STATUS[status] || SAVE_STATUS.saved;
    var el = $('npa-save');
    if (el) { el.textContent = cfg[0]; el.className = 'npa-save npa-save--' + cfg[1]; }
    var banner = $('npa-banner');
    banner.textContent = '';
    banner.hidden = true;
    if (status === 'load-failed') {
      banner.hidden = false;
      append(banner, [h('span', { text: 'Your tracker didn’t load, so nothing you change here will be saved.' }),
        h('button', { type: 'button', class: 'npa-btn npa-btn--primary', text: 'Retry', onclick: start })]);
    } else if (status === 'signed-out') {
      banner.hidden = false;
      append(banner, [h('span', { text: 'You’re signed out, so your tracker can’t load or save.' }),
        h('a', { class: 'npa-btn npa-btn--primary', href: 'login.html?redirect=' + encodeURIComponent('photo-tracker.html'), target: '_top', text: 'Sign in again' })]);
    }
  }

  // ── main render ───────────────────────────────────────────
  function render() {
    NpaTracker.ensureShape(S);
    renderToolbar();
    var main = $('npa-main');
    main.textContent = '';
    var cls = currentClass();
    if (!cls) { main.dataset.subject = ''; main.appendChild(renderEmpty()); return; }
    var view = currentView();
    main.dataset.subject = view === 'photo' || view === 'art' ? view : '';
    main.appendChild(renderViewTabs(view));
    if (!cls.pupils.length) { main.appendChild(renderNoPupils(cls)); return; }
    if (view === 'dashboard') { main.appendChild(renderDashboard(cls)); return; }
    if (view === 'overview') { main.appendChild(renderOverview(cls)); return; }
    var course = NpaTracker.getCourse(S, view);
    main.appendChild(renderUnitChips(course));
    main.appendChild(renderGrid(cls, course));
  }

  function renderToolbar() {
    var sel = $('npa-class');
    sel.textContent = '';
    var cls = currentClass();
    (S.classes || []).forEach(function(c) {
      sel.appendChild(h('option', { value: c.id, selected: cls && c.id === cls.id, text: c.name }));
    });
    ['npa-class', 'npa-class-menu', 'npa-import'].forEach(function(id) { $(id).hidden = !cls; });
  }

  function renderEmpty() {
    return h('section', { class: 'npa-empty' },
      h('h2', { text: 'Set up your NPA class' }),
      h('p', { text: 'Photography and Art & Design are tracked together for the same pupils. Bring in your existing tracking spreadsheet, or start an empty class and add pupils yourself.' }),
      h('div', { class: 'npa-empty-actions' },
        h('button', { type: 'button', class: 'npa-btn npa-btn--primary', text: 'Import tracking spreadsheet', onclick: pickFile }),
        h('button', { type: 'button', class: 'npa-btn npa-btn--ghost', text: 'Start an empty class', onclick: newClass })),
      privacyNote());
  }

  function privacyNote() {
    return h('details', { class: 'npa-privacy' },
      h('summary', { text: 'How pupil data is kept safe' }),
      h('ul', null,
        h('li', { text: 'Your spreadsheet is read on this device. The file itself is never uploaded or stored.' }),
        h('li', { text: 'You see exactly what will be saved before anything is saved: first names, task progress, short notes, strengths and areas for development. Everything else in the file is ignored.' }),
        h('li', { text: 'Tracker data is saved to your own Faculty Hub account, which only you can open (admins can view it, as with the Drama and Art trackers). You need to be signed in on an approved school account.' }),
        h('li', { text: 'Once imported, you can delete the spreadsheet from your Downloads and email.' })));
  }

  function renderViewTabs(view) {
    var wrap = h('div', { class: 'npa-views', role: 'tablist', 'aria-label': 'Strand' });
    function tab(id, label) {
      var on = view === id;
      wrap.appendChild(h('button', {
        type: 'button', role: 'tab', 'aria-selected': on ? 'true' : 'false', class: 'npa-view' + (on ? ' is-on' : ''), text: label,
        onclick: function() { prefs.view = id; writePrefs(); render(); }
      }));
    }
    tab('dashboard', 'Dashboard');
    tab('overview', 'Overview');
    S.courses.forEach(function(c) { tab(c.id, strandName(c)); });
    return wrap;
  }

  function renderNoPupils(cls) {
    return h('div', { class: 'npa-empty npa-empty--small' },
      h('p', { text: 'No pupils in ' + cls.name + ' yet.' }),
      h('div', { class: 'npa-empty-actions' },
        h('button', { type: 'button', class: 'npa-btn npa-btn--primary', text: 'Add pupils', onclick: addPupils }),
        h('button', { type: 'button', class: 'npa-btn', text: 'Import tracking spreadsheet', onclick: pickFile })));
  }

  function progressBar(pr) {
    var pct = pr.total ? Math.round(100 * pr.done / pr.total) : 0;
    return h('div', { class: 'npa-prog', title: pr.done + ' of ' + pr.total + ' complete, ' + pr.started + ' in progress' },
      h('span', { class: 'npa-prog-bar' }, h('span', { style: 'width:' + pct + '%' })),
      h('span', { class: 'npa-prog-num', text: pr.done + '/' + pr.total }));
  }

  function pupilNameCell(p) {
    return h('th', { scope: 'row', class: 'npa-name-col' },
      h('button', { type: 'button', class: 'npa-pupil-btn', text: p.name, onclick: function() { openPupil(p.id); } }),
      (p.strengths || p.development) ? h('span', { class: 'npa-comment-dot', title: 'Has strengths / areas for development', 'aria-hidden': 'true' }) : null);
  }

  // Both strands at once: each pupil's progress per unit, with a total per strand.
  function renderOverview(cls) {
    var courses = S.courses;
    var head1 = h('tr', null, h('th', { class: 'npa-name-col', rowspan: 2, scope: 'col', text: 'Pupil' }));
    var head2 = h('tr');
    courses.forEach(function(c) {
      var units = c.units.filter(function(u) { return u.tasks.length; });
      head1.appendChild(h('th', { colspan: units.length + 1, scope: 'colgroup', class: 'npa-unit-head npa-strand-head', text: strandName(c) }));
      units.forEach(function(u, i) {
        head2.appendChild(h('th', { scope: 'col', class: 'npa-task-head npa-sum-head' + (i === 0 ? ' npa-unit-start' : ''), title: u.name }, h('span', { text: u.name })));
      });
      head2.appendChild(h('th', { scope: 'col', class: 'npa-task-head npa-sum-head npa-prog-col' + (units.length ? '' : ' npa-unit-start'), text: 'Total' }));
    });

    var body = h('tbody');
    cls.pupils.forEach(function(p) {
      var tr = h('tr', null, pupilNameCell(p));
      courses.forEach(function(c) {
        var units = c.units.filter(function(u) { return u.tasks.length; });
        units.forEach(function(u, i) {
          var pr = NpaTracker.pupilProgress(p, u.tasks);
          var kind = pr.done === pr.total ? 'all' : (pr.done || pr.started) ? 'some' : 'none';
          var pct = pr.total ? Math.round(100 * pr.done / pr.total) : 0;
          var label = p.name + ', ' + u.name + ': ' + pr.done + ' of ' + pr.total + ' complete' + (pr.started ? ', ' + pr.started + ' in progress' : '');
          tr.appendChild(h('td', { class: 'npa-cell' + (i === 0 ? ' npa-unit-start' : '') },
            h('button', {
              type: 'button', class: 'npa-sum npa-sum--' + kind, 'aria-label': label + '. Open unit', title: label,
              onclick: function() { prefs.view = c.id; setUnitPref(c.id, u.id); render(); }
            }, h('span', { class: 'npa-sum-num', text: pr.done + '/' + pr.total }),
              h('span', { class: 'npa-sum-bar', 'aria-hidden': 'true' }, h('span', { style: 'width:' + pct + '%' })))));
        });
        tr.appendChild(h('td', { class: 'npa-prog-col' + (units.length ? '' : ' npa-unit-start') }, progressBar(NpaTracker.pupilProgress(p, NpaTracker.allTasks(S, c.id)))));
      });
      body.appendChild(tr);
    });

    var frag = document.createDocumentFragment();
    frag.appendChild(h('div', { class: 'npa-table-wrap' },
      h('table', { class: 'npa-table' }, h('thead', null, head1, head2), body)));
    frag.appendChild(h('p', { class: 'npa-legend' },
      'Tasks complete in each unit. Tap a number to open that unit, or a name for the pupil\u2019s record.'));
    return frag;
  }

  // ── off-track dashboard (rules in NpaTracker.analyse) ─────
  var DASH_STATUS = { off: 'Off track', watch: 'Watch', on: 'On track' };
  function todayISO() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function openUnit(courseId, unitId) { prefs.view = courseId; setUnitPref(courseId, unitId || ''); render(); }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }
  function listJoin(items) {
    return items.length < 2 ? items.join('') : items.slice(0, -1).join(', ') + ' and ' + items[items.length - 1];
  }

  function renderDashboard(cls) {
    var today = todayISO();
    var m = NpaTracker.classMetrics(S, cls, today);
    var r = m.analysis;
    var frag = document.createDocumentFragment();

    frag.appendChild(h('div', { class: 'npa-dash-bar' },
      h('h2', { class: 'npa-dash-title', text: cls.name }),
      h('p', { class: 'npa-dash-sub', text: plural(m.pupils, 'pupil') + ' · checked ' + NpaTracker.shortDate(today) }),
      h('details', { class: 'npa-rules' },
        h('summary', { text: 'How pupils are flagged' }),
        h('p', { text: 'Off track: a unit’s due date has passed and the pupil still has tasks to finish in it, or they show two warning signs.' }),
        h('p', { text: 'Watch: one warning sign. The warning signs are being ' + NpaTracker.BEHIND_POINTS + ' or more percentage points behind the class median in a strand, and having nothing recorded in a unit that at least half the class has started.' }),
        h('p', { text: 'Start with these pupils lists the off-track pupils furthest behind, ranked by overdue work, units not started and the gap to the class.' }))));

    frag.appendChild(renderMetricCards(m));
    frag.appendChild(renderUnitChart(m));
    frag.appendChild(renderSpotlight(r));
    frag.appendChild(renderDeadlines(r));
    frag.appendChild(renderPupilFlags(r));
    return frag;
  }

  function pctOf(n, total) { return total ? Math.round(100 * n / total) : 0; }

  // Four key numbers. Each card: label, value, one line of context, and where it makes sense a link onward.
  function renderMetricCards(m) {
    function card(label, value, detail, action, status) {
      return h('article', { class: 'npa-metric' },
        h('h3', { class: 'npa-metric-label' }, status ? h('span', { class: 'npa-flag-dot npa-flag-dot--' + status, 'aria-hidden': 'true' }) : null, label),
        h('p', { class: 'npa-metric-value', text: value }),
        h('p', { class: 'npa-metric-detail', text: detail }),
        action ? h('button', { type: 'button', class: 'npa-text-btn npa-metric-link', text: action[0], onclick: action[1] }) : null);
    }
    var strandPcts = S.courses.map(function(c) {
      var st = m.strands[c.id];
      return strandName(c) + ' ' + pctOf(st.done, st.total) + '%';
    }).join(' · ');
    var hasDates = m.units.some(function(u) { return u.due; });
    var nd = m.nextDeadline;
    function showFlagged() { prefs.dashAll = false; writePrefs(); render(); var el = $('npa-flags-title'); if (el) el.scrollIntoView({ block: 'start' }); }

    return h('section', { class: 'npa-metrics', 'aria-label': 'Key numbers' },
      card('Off track', String(m.counts.off),
        [m.counts.watch ? m.counts.watch + ' to watch' : null, m.counts.on + ' on track'].filter(Boolean).join(' · '),
        m.counts.off || m.counts.watch ? ['See who', showFlagged] : null, m.counts.off ? 'off' : null),
      card('Tasks complete', pctOf(m.tasks.done, m.tasks.total) + '%',
        strandPcts, null),
      card('Overdue tasks', String(m.overdueTasks),
        !hasDates ? 'No unit due dates set yet' : m.overdueTasks ? 'Across ' + plural(m.overduePupils, 'pupil') : 'Nothing overdue',
        !hasDates ? ['Set due dates', editDueDates] : null, m.overdueTasks ? 'off' : null),
      card('Next deadline', nd ? NpaTracker.shortDate(nd.due) : 'None',
        nd ? nd.unit.name + ', ' + (nd.days === 0 ? 'today' : 'in ' + plural(nd.days, 'day')) + ' · ' + nd.finished + ' of ' + nd.total + ' finished'
          : hasDates ? 'All set deadlines have passed' : 'Add due dates to see what is coming up',
        nd ? ['Open ' + nd.unit.name, function() { openUnit(nd.course.id, nd.unit.id); }] : ['Set due dates', editDueDates]));
  }

  // Class progress through every unit: one 100% bar per unit, complete then in progress, the rest is not started.
  var CHART_STATES = [
    { key: 'done', label: 'Complete' },
    { key: 'started', label: 'In progress' },
    { key: 'none', label: 'Not started' }
  ];
  function renderUnitChart(m) {
    var asTable = prefs.chartTable === true;
    var sec = h('section', { class: 'npa-panel npa-chart', 'aria-labelledby': 'npa-chart-title' },
      h('div', { class: 'npa-panel-head' },
        h('div', null,
          h('h3', { id: 'npa-chart-title', text: 'Progress by unit' }),
          h('p', { class: 'npa-meta', text: 'Share of the class’s tasks in each unit' })),
        h('div', { class: 'npa-chart-tools' },
          asTable ? null : h('ul', { class: 'npa-legend-keys', 'aria-label': 'Key' }, CHART_STATES.map(function(st) {
            return h('li', null, h('span', { class: 'npa-key npa-key--' + st.key, 'aria-hidden': 'true' }), st.label);
          })),
          h('button', { type: 'button', class: 'npa-btn npa-btn--ghost npa-btn--small', text: asTable ? 'Show chart' : 'Show table',
            onclick: function() { prefs.chartTable = !asTable; writePrefs(); render(); } }))));
    if (!m.pupils || !m.units.length) {
      sec.appendChild(h('p', { class: 'npa-empty-line', text: 'Progress appears here once the class has pupils and units with tasks.' }));
      return sec;
    }
    sec.appendChild(asTable ? unitTable(m) : unitBars(m));
    return sec;
  }

  function dueText(u) {
    if (!u.due) return 'No due date';
    return (u.late ? 'Overdue since ' : 'Due ') + NpaTracker.shortDate(u.due);
  }

  function unitBars(m) {
    var wrap = h('div', { class: 'npa-bars' });
    var tip = h('div', { class: 'npa-tip', role: 'tooltip', hidden: true });
    function showTip(seg, u, st, n) {
      tip.textContent = '';
      append(tip, [
        h('strong', { text: n + ' of ' + u.total + ' tasks (' + pctOf(n, u.total) + '%)' }),
        h('span', { class: 'npa-tip-row' }, h('span', { class: 'npa-tip-key npa-key--' + st.key, 'aria-hidden': 'true' }), st.label + ' · ' + u.unit.name)]);
      tip.hidden = false;
      var b = seg.getBoundingClientRect(), w = wrap.getBoundingClientRect();
      var x = Math.min(Math.max(b.left + b.width / 2 - w.left, 80), w.width - 80);
      tip.style.left = x + 'px';
      tip.style.top = (b.top - w.top - 8) + 'px';
    }
    function hideTip() { tip.hidden = true; }

    S.courses.forEach(function(c) {
      var rows = m.units.filter(function(u) { return u.course === c; });
      if (!rows.length) return;
      wrap.appendChild(h('h4', { class: 'npa-bars-group', text: strandName(c) }));
      rows.forEach(function(u) {
        var counts = { done: u.done, started: u.started, none: u.total - u.done - u.started };
        var track = h('div', { class: 'npa-bar-track' });
        CHART_STATES.forEach(function(st) {
          var n = counts[st.key];
          if (!n) return;
          var label = st.label + ': ' + n + ' of ' + u.total + ' tasks in ' + u.unit.name;
          var seg = h('span', { class: 'npa-seg npa-seg--' + st.key, style: 'flex-grow:' + n, tabindex: '0', role: 'img', 'aria-label': label });
          seg.addEventListener('pointerenter', function() { showTip(seg, u, st, n); });
          seg.addEventListener('pointerleave', hideTip);
          seg.addEventListener('focus', function() { showTip(seg, u, st, n); });
          seg.addEventListener('blur', hideTip);
          track.appendChild(seg);
        });
        wrap.appendChild(h('div', { class: 'npa-bar-row' + (u.late ? ' is-late' : '') },
          h('div', { class: 'npa-bar-label' },
            h('button', { type: 'button', class: 'npa-text-btn npa-text-btn--strong', text: u.unit.name, onclick: function() { openUnit(c.id, u.unit.id); } }),
            h('span', { class: 'npa-meta npa-bar-due', text: dueText(u) })),
          track,
          h('span', { class: 'npa-bar-value', text: pctOf(u.done, u.total) + '%' })));
      });
    });
    wrap.appendChild(tip);
    return wrap;
  }

  function unitTable(m) {
    return h('div', { class: 'npa-rows-wrap' }, h('table', { class: 'npa-rows' },
      h('caption', { class: 'sr-only', text: 'Progress by unit, counted in pupil tasks' }),
      h('thead', null, h('tr', null,
        ['Unit', 'Strand', 'Complete', 'In progress', 'Not started', 'Due'].map(function(t, i) {
          return h('th', { scope: 'col', class: i >= 2 && i <= 4 ? 'npa-num' : null, text: t });
        }))),
      h('tbody', null, m.units.map(function(u) {
        var none = u.total - u.done - u.started;
        return h('tr', { class: u.late ? 'is-late' : null },
          h('th', { scope: 'row' }, h('button', { type: 'button', class: 'npa-text-btn npa-text-btn--strong', text: u.unit.name, onclick: function() { openUnit(u.course.id, u.unit.id); } })),
          h('td', { text: strandName(u.course) }),
          h('td', { class: 'npa-num', text: u.done + ' (' + pctOf(u.done, u.total) + '%)' }),
          h('td', { class: 'npa-num', text: u.started + ' (' + pctOf(u.started, u.total) + '%)' }),
          h('td', { class: 'npa-num', text: none + ' (' + pctOf(none, u.total) + '%)' }),
          h('td', { class: 'npa-when', text: dueText(u) }));
      }))));
  }

  // The few pupils furthest behind, in priority order, with the work to chase first.
  function renderSpotlight(r) {
    if (!r.spotlight.length) return document.createDocumentFragment();
    var UNITS = 3;
    var sec = h('section', { class: 'npa-panel npa-spot', 'aria-labelledby': 'npa-spot-title' },
      h('div', { class: 'npa-panel-head' }, h('h3', { id: 'npa-spot-title', text: 'Start with these pupils' })));
    sec.appendChild(h('ol', { class: 'npa-spot-list' }, r.spotlight.map(function(x, i) {
      var p = x.pupil;
      var strands = x.strandsBehind.map(function(id) { return strandName(NpaTracker.getCourse(S, id)); });
      var facts = [
        x.overdueTasks ? plural(x.overdueTasks, 'overdue task') : null,
        x.missingUnits ? plural(x.missingUnits, 'unit') + ' not started' : null,
        x.maxGap ? x.maxGap + ' points behind the class median' : null
      ].filter(Boolean);
      return h('li', { class: 'npa-spot-row' },
        h('span', { class: 'npa-spot-rank', 'aria-hidden': 'true', text: String(i + 1) }),
        h('div', { class: 'npa-spot-who' },
          h('button', { type: 'button', class: 'npa-spot-name', text: p.name, onclick: function() { openPupil(p.id); } }),
          strands.length ? h('p', { class: 'npa-meta', text: 'Behind in ' + listJoin(strands) }) : null,
          h('p', { class: 'npa-spot-facts', text: facts.length ? listJoin(facts) + '.' : '' }),
          p.strengths ? h('p', { class: 'npa-spot-note' }, h('span', { text: 'Strength ' }), p.strengths) : null,
          p.development ? h('p', { class: 'npa-spot-note' }, h('span', { text: 'Area for development ' }), p.development) : null),
        x.catchUp.length ? h('div', { class: 'npa-spot-catch' },
          h('h4', { text: 'Catch up first' }),
          h('ul', null, groupCatchUp(x.catchUp).slice(0, UNITS).map(function(g) {
            var meta = plural(g.tasks.length, 'task') + ', ' + (g.kind === 'overdue' ? 'due ' + NpaTracker.shortDate(g.due) : 'not started');
            return h('li', { class: 'npa-catch-unit' + (g.kind === 'overdue' ? ' is-overdue' : '') },
              h('div', { class: 'npa-catch-head' },
                h('span', { class: 'npa-catch-name', text: g.unitName }),
                h('span', { class: 'npa-catch-meta', text: meta })),
              h('p', { class: 'npa-catch-tasks' }, g.tasks.map(function(c, k) {
                var label = c.name === g.unitName ? 'Mark progress' : c.name;
                return [k ? h('span', { class: 'npa-sep', 'aria-hidden': 'true', text: ' \u00b7 ' }) : null,
                  h('button', { type: 'button', class: 'npa-text-btn npa-catch-task' + (c.status === 'started' ? ' is-started' : ''),
                    title: c.status === 'started' ? 'In progress' + (c.note ? ': ' + c.note : '') : 'Not started',
                    text: label, onclick: function() { openCell(p.id, c.taskId); } })];
              })));
          })),
          groupCatchUp(x.catchUp).length > UNITS ? h('button', { type: 'button', class: 'npa-text-btn npa-more', text: 'See everything in ' + p.name + '\u2019s record', onclick: function() { openPupil(p.id); } }) : null) : null);
    })));
    return sec;
  }

  // Catch-up tasks grouped by unit, keeping the order analyse() gives (overdue, earliest first).
  function groupCatchUp(items) {
    var groups = [], byUnit = {};
    items.forEach(function(c) {
      var g = byUnit[c.unitId];
      if (!g) { g = byUnit[c.unitId] = { unitName: c.unitName, kind: c.kind, due: c.due, tasks: [] }; groups.push(g); }
      g.tasks.push(c);
    });
    return groups;
  }

  function renderDeadlines(r) {
    var sec = h('section', { class: 'npa-panel', 'aria-labelledby': 'npa-dl-title' },
      h('div', { class: 'npa-panel-head' },
        h('h3', { id: 'npa-dl-title', text: 'Unit deadlines' }),
        h('button', { type: 'button', class: 'npa-btn npa-btn--ghost', text: r.deadlines.length ? 'Edit dates' : 'Set due dates', onclick: editDueDates })));
    if (!r.deadlines.length) {
      sec.appendChild(h('p', { class: 'npa-empty-line', text: 'No due dates yet. Add one to each unit and pupils with work left once it passes are flagged here.' }));
      return sec;
    }
    sec.appendChild(h('table', { class: 'npa-rows' },
      h('thead', null, h('tr', null,
        h('th', { scope: 'col', text: 'Unit' }), h('th', { scope: 'col', text: 'Due' }), h('th', { scope: 'col', text: 'Pupils finished' }))),
      h('tbody', null, r.deadlines.map(function(d) {
        var when = d.days < 0 ? NpaTracker.shortDate(d.due) + ', ' + plural(-d.days, 'day') + ' ago'
          : d.days === 0 ? 'Today' : NpaTracker.shortDate(d.due) + ', in ' + plural(d.days, 'day');
        var late = d.days < 0 && d.finished < d.total;
        return h('tr', { class: late ? 'is-late' : null },
          h('td', null,
            h('button', { type: 'button', class: 'npa-text-btn npa-text-btn--strong', text: d.unit.name, onclick: function() { openUnit(d.course.id, d.unit.id); } }),
            h('span', { class: 'npa-meta', text: strandName(d.course) })),
          h('td', { class: 'npa-when', text: when }),
          h('td', null, progressBar({ done: d.finished, started: 0, total: d.total })));
      }))));
    return sec;
  }

  function renderPupilFlags(r) {
    var showAll = prefs.dashAll === true;
    var flagged = r.pupils.filter(function(x) { return x.status !== 'on'; });
    var list = showAll ? r.pupils : flagged;
    var sec = h('section', { class: 'npa-panel', 'aria-labelledby': 'npa-flags-title' },
      h('div', { class: 'npa-panel-head' },
        h('h3', { id: 'npa-flags-title', text: 'Pupils' }),
        h('div', { class: 'npa-subtabs', role: 'group', 'aria-label': 'Show' },
          [[false, 'Needs attention', flagged.length], [true, 'Everyone', r.pupils.length]].map(function(o) {
            var on = showAll === o[0];
            return h('button', { type: 'button', class: 'npa-subtab' + (on ? ' is-on' : ''), 'aria-pressed': on ? 'true' : 'false',
              onclick: function() { prefs.dashAll = o[0]; writePrefs(); render(); } }, o[1], h('span', { class: 'npa-count', text: String(o[2]) }));
          }))));
    if (!list.length) {
      sec.appendChild(h('p', { class: 'npa-empty-line', text: 'Nobody needs attention right now.' }));
      return sec;
    }
    sec.appendChild(h('table', { class: 'npa-rows npa-rows--flags' },
      h('thead', null, h('tr', null,
        h('th', { scope: 'col', text: 'Pupil' }), h('th', { scope: 'col', text: 'Why' }),
        S.courses.map(function(c) { return h('th', { scope: 'col', class: 'npa-num-col', text: strandName(c) }); }))),
      h('tbody', null, list.map(function(x) {
        return h('tr', null,
          h('th', { scope: 'row' },
            h('button', { type: 'button', class: 'npa-text-btn npa-text-btn--strong', text: x.pupil.name, onclick: function() { openPupil(x.pupil.id); } }),
            h('span', { class: 'npa-flag npa-flag--' + x.status, text: DASH_STATUS[x.status] })),
          h('td', null, x.reasons.length ? h('ul', { class: 'npa-why' }, x.reasons.map(function(re) {
            return h('li', { class: re.kind === 'overdue' ? 'is-overdue' : null },
              h('button', { type: 'button', class: 'npa-text-btn', text: re.text, onclick: function() { openUnit(re.courseId, re.unitId); } }));
          })) : h('span', { class: 'npa-meta', text: 'Nothing flagged' })),
          S.courses.map(function(c) {
            return h('td', { class: 'npa-num-col', 'data-label': strandName(c) }, progressBar(x.strands[c.id]));
          }));
      }))));
    return sec;
  }

  function editDueDates() {
    if (blocked()) return;
    var body = h('div', { class: 'npa-due-list' });
    S.courses.forEach(function(c) {
      var units = c.units.filter(function(u) { return u.tasks.length; });
      if (!units.length) return;
      body.appendChild(h('h3', { class: 'npa-section-title', text: strandName(c) }));
      units.forEach(function(u) {
        var input = h('input', { type: 'date', 'aria-label': u.name + ' due date' });
        input.value = NpaTracker.isDate(u.due) ? u.due : '';
        input.addEventListener('change', function() {
          if (blocked()) return;
          if (NpaTracker.isDate(input.value)) u.due = input.value; else delete u.due;
          save(); render();
        });
        body.appendChild(h('label', { class: 'npa-due-row' }, h('span', { text: u.name }), input));
      });
    });
    openDialog(dialog('Unit due dates', [
      h('p', { class: 'npa-dialog-sub', text: 'When a date has passed, pupils with tasks still to finish in that unit are flagged as off track. Leave a date blank to skip a unit. Changes save as you go.' }),
      body
    ], [h('button', { value: 'close', class: 'npa-btn npa-btn--primary', text: 'Done' })]));
  }

  function renderUnitChips(course) {
    var wrap = h('div', { class: 'npa-subtabs npa-subtabs--units', role: 'tablist', 'aria-label': 'Show unit' });
    var cur = unitPref(course.id);
    function chip(id, label) {
      var on = cur === id;
      wrap.appendChild(h('button', {
        type: 'button', role: 'tab', 'aria-selected': on ? 'true' : 'false', class: 'npa-subtab' + (on ? ' is-on' : ''), text: label,
        onclick: function() { setUnitPref(course.id, id); render(); }
      }));
    }
    chip('', 'All units');
    course.units.forEach(function(u) { chip(u.id, u.name); });
    return wrap;
  }

  // Column headings sit under their unit, so "Photographing People Research" reads as "Research".
  function shortTaskName(task, unit) {
    if (task.length > unit.length + 1 && task.toLowerCase().indexOf(unit.toLowerCase() + ' ') === 0) {
      var rest = task.slice(unit.length + 1);
      return rest.charAt(0).toUpperCase() + rest.slice(1);
    }
    return task;
  }

  function renderGrid(cls, course) {
    var units = visibleUnits(course);
    var oneUnit = !!unitPref(course.id) && units.length === 1;
    var shown = units.filter(function(u) { return u.tasks.length; });
    var tasks = [];
    shown.forEach(function(u) { u.tasks.forEach(function(t) { tasks.push(t); }); });
    var strandTasks = NpaTracker.allTasks(S, course.id);
    var frag = document.createDocumentFragment();

    var emptyUnits = units.filter(function(u) { return !u.tasks.length; });
    if (emptyUnits.length) {
      frag.appendChild(h('p', { class: 'npa-hint' },
        emptyUnits.map(function(u) { return u.name; }).join(', ') + (emptyUnits.length > 1 ? ' have' : ' has') + ' no tasks yet. ',
        h('button', { type: 'button', class: 'npa-link', text: 'Add tasks', onclick: editCourse })));
    }
    if (!tasks.length) return frag;

    var head1 = h('tr', null, h('th', { class: 'npa-name-col', rowspan: 2, scope: 'col', text: 'Pupil' }));
    var head2 = h('tr');
    shown.forEach(function(u) {
      head1.appendChild(h('th', { colspan: u.tasks.length, scope: 'colgroup', class: 'npa-unit-head', text: u.name }));
      u.tasks.forEach(function(t, i) {
        head2.appendChild(h('th', { scope: 'col', class: 'npa-task-head' + (i === 0 ? ' npa-unit-start' : ''), title: t.name }, h('span', { text: shortTaskName(t.name, u.name) })));
      });
    });
    head1.appendChild(h('th', { rowspan: 2, scope: 'col', class: 'npa-prog-col', text: oneUnit ? 'Unit' : strandName(course) }));

    var body = h('tbody');
    cls.pupils.forEach(function(p) {
      var tr = h('tr', null, pupilNameCell(p));
      shown.forEach(function(u) {
        u.tasks.forEach(function(t, i) {
          var w = p.work[t.id] || {};
          var s = w.s || '';
          var label = p.name + ', ' + t.name + ': ' + STATUS_LABEL[s] + (w.n ? '. Note: ' + w.n : '');
          tr.appendChild(h('td', { class: 'npa-cell' + (i === 0 ? ' npa-unit-start' : '') },
            h('button', {
              type: 'button', class: 'npa-mark npa-mark--' + (s || 'none') + (w.n ? ' has-note' : ''),
              'aria-label': label, title: label,
              onclick: function() { openCell(p.id, t.id); }
            }, s === 'done' ? '\u2713' : '')));
        });
      });
      tr.appendChild(h('td', { class: 'npa-prog-col' }, progressBar(NpaTracker.pupilProgress(p, oneUnit ? tasks : strandTasks))));
      body.appendChild(tr);
    });

    var foot = h('tr', null, h('th', { scope: 'row', class: 'npa-name-col', text: 'Complete' }));
    shown.forEach(function(u) {
      u.tasks.forEach(function(t, i) {
        var n = cls.pupils.filter(function(p) { return p.work[t.id] && p.work[t.id].s === 'done'; }).length;
        foot.appendChild(h('td', { class: 'npa-foot-cell' + (i === 0 ? ' npa-unit-start' : ''), text: n + '/' + cls.pupils.length }));
      });
    });
    foot.appendChild(h('td'));

    frag.appendChild(h('div', { class: 'npa-table-wrap' },
      h('table', { class: 'npa-table' }, h('thead', null, head1, head2), body, h('tfoot', null, foot))));
    frag.appendChild(h('p', { class: 'npa-legend' },
      h('span', { class: 'npa-mark npa-mark--done', 'aria-hidden': 'true', text: '\u2713' }), ' Complete ',
      h('span', { class: 'npa-mark npa-mark--started', 'aria-hidden': 'true' }), ' In progress ',
      h('span', { class: 'npa-mark npa-mark--none has-note', 'aria-hidden': 'true' }), ' Has a note \u00b7 Tap a pupil\u2019s name for their strengths and what\u2019s left to do.'));
    return frag;
  }

  // ── marking a task ────────────────────────────────────────
  function openCell(pupilId, taskId) {
    var cls = currentClass();
    var found = findTask(taskId);
    if (!cls || !found) return;
    var idx = cls.pupils.findIndex(function(p) { return p.id === pupilId; });
    var p = cls.pupils[idx];
    var w = p.work[taskId] || {};

    var note = h('textarea', { rows: 3, maxlength: 500, placeholder: 'e.g. To finish writing up', 'aria-label': 'Note' });
    note.value = w.n || '';
    var statusBtns = h('div', { class: 'npa-status-btns', role: 'group', 'aria-label': 'Progress' });
    function paint(cur) {
      Array.prototype.forEach.call(statusBtns.children, function(b) {
        b.setAttribute('aria-pressed', b.dataset.s === cur ? 'true' : 'false');
      });
    }
    function set(s) {
      if (blocked()) return;
      // An "in progress" note says what is left to do, so it no longer applies once complete.
      var was = p.work[taskId] && p.work[taskId].s;
      if (s === 'done' && was === 'started') note.value = '';
      var n = NpaTracker.cleanText(note.value);
      if (!s && !n) delete p.work[taskId];
      else p.work[taskId] = n ? { s: s, n: n } : { s: s };
      paint(s);
      save();
      render();
    }
    [['', 'Not started'], ['started', 'In progress'], ['done', 'Complete']].forEach(function(o) {
      statusBtns.appendChild(h('button', {
        type: 'button', 'data-s': o[0], class: 'npa-status npa-status--' + (o[0] || 'none'), text: o[1],
        onclick: function() { set(o[0]); if (o[0] === 'done' && !note.value.trim()) d.close(); }
      }));
    });
    paint(w.s || '');
    note.addEventListener('change', function() {
      var cur = (p.work[taskId] && p.work[taskId].s) || (note.value.trim() ? 'started' : '');
      set(cur);
    });

    function go(step) {
      note.dispatchEvent(new Event('change'));
      var next = cls.pupils[idx + step];
      d.close();
      if (next) openCell(next.id, taskId);
    }
    var d = dialog(p.name, [
      h('p', { class: 'npa-dialog-sub', text: [strandName(found.course), found.unit.name, found.task.name === found.unit.name ? null : found.task.name].filter(Boolean).join(' \u00b7 ') }),
      statusBtns,
      h('label', { class: 'npa-field' }, h('span', { text: 'Note (optional)' }), note)
    ], [
      h('button', { type: 'button', class: 'npa-btn', text: '← Previous pupil', disabled: idx === 0, onclick: function() { go(-1); } }),
      h('button', { type: 'button', class: 'npa-btn', text: 'Next pupil →', disabled: idx === cls.pupils.length - 1, onclick: function() { go(1); } }),
      h('button', { value: 'close', class: 'npa-btn npa-btn--primary', text: 'Done' })
    ]);
    d.addEventListener('close', function() { if (note.isConnected) note.dispatchEvent(new Event('change')); }, { once: true });
    openDialog(d);
  }

  // ── pupil details ─────────────────────────────────────────
  function openPupil(pupilId) {
    var cls = currentClass();
    var p = cls && cls.pupils.find(function(x) { return x.id === pupilId; });
    if (!p) return;
    var name = h('input', { type: 'text', maxlength: 80, 'aria-label': 'Name' });
    name.value = p.name;
    var str = h('textarea', { rows: 2, maxlength: 500 });
    str.value = p.strengths;
    var dev = h('textarea', { rows: 2, maxlength: 500 });
    dev.value = p.development;
    function commit() {
      if (blocked()) return;
      var nm = NpaTracker.cleanText(name.value).slice(0, 80);
      if (nm) p.name = nm;
      p.strengths = NpaTracker.cleanText(str.value);
      p.development = NpaTracker.cleanText(dev.value);
      save();
      render();
    }
    [name, str, dev].forEach(function(el) { el.addEventListener('change', commit); });

    var todo = h('div', { class: 'npa-todo' });
    S.courses.forEach(function(c) {
      var units = c.units.filter(function(u) { return u.tasks.length; });
      if (!units.length) return;
      var total = NpaTracker.pupilProgress(p, NpaTracker.allTasks(S, c.id));
      todo.appendChild(h('h4', { class: 'npa-todo-strand' }, strandName(c), h('span', { class: 'npa-todo-count', text: total.done + '/' + total.total + ' complete' })));
      units.forEach(function(u) {
        var pr = NpaTracker.pupilProgress(p, u.tasks);
        var left = u.tasks.filter(function(t) { return !(p.work[t.id] && p.work[t.id].s === 'done'); });
        todo.appendChild(h('div', { class: 'npa-todo-unit' },
          h('h3', null, u.name, h('span', { class: 'npa-todo-count', text: pr.done + '/' + pr.total + ' complete' })),
          left.length ? h('ul', null, left.map(function(t) {
            var w = p.work[t.id] || {};
            return h('li', { class: 'npa-todo-item npa-todo-item--' + (w.s || 'none') },
              h('button', { type: 'button', class: 'npa-link', text: t.name, onclick: function() { d.close(); openCell(p.id, t.id); } }),
              h('span', { class: 'npa-todo-status', text: STATUS_LABEL[w.s || ''] + (w.n ? ': ' + w.n : '') }));
          })) : h('p', { class: 'npa-todo-done', text: 'All tasks complete' })));
      });
    });

    var d = dialog(p.name, [
      h('label', { class: 'npa-field' }, h('span', { text: 'Name' }), name),
      h('label', { class: 'npa-field' }, h('span', { text: 'Strengths' }), str),
      h('label', { class: 'npa-field' }, h('span', { text: 'Areas for development' }), dev),
      h('h3', { class: 'npa-section-title', text: 'Still to do' }),
      todo
    ], [
      h('button', { type: 'button', class: 'npa-btn npa-btn--danger', text: 'Remove pupil', onclick: function() {
        if (blocked()) return;
        if (!confirm('Remove ' + p.name + ' and all of their tracking from ' + cls.name + '?')) return;
        cls.pupils = cls.pupils.filter(function(x) { return x.id !== p.id; });
        save();
        d.close();
        render();
        toast(p.name + ' removed');
      } }),
      h('button', { value: 'close', class: 'npa-btn npa-btn--primary', text: 'Done' })
    ]);
    openDialog(d);
  }

  // ── classes and pupils ────────────────────────────────────
  function askText(title, label, value, okLabel, cb) {
    var input = h('input', { type: 'text', maxlength: 80, required: true });
    input.value = value || '';
    var d = dialog(title, h('label', { class: 'npa-field' }, h('span', { text: label }), input), [
      h('button', { value: 'close', class: 'npa-btn', text: 'Cancel', formnovalidate: true }),
      h('button', { value: 'ok', class: 'npa-btn npa-btn--primary', text: okLabel })
    ]);
    d.addEventListener('close', function() {
      var v = NpaTracker.cleanText(input.value).slice(0, 80);
      if (d.returnValue === 'ok' && v) cb(v);
    });
    openDialog(d);
    input.select();
  }

  function newClass() {
    if (blocked()) return;
    askText('New class', 'Class name', 'NPA ' + defaultCohort(), 'Create class', function(name) {
      var cls = { id: uid('c'), name: name, pupils: [] };
      S.classes.push(cls);
      prefs.classId = cls.id; writePrefs();
      save();
      render();
    });
  }
  function defaultCohort() {
    var now = new Date();
    var y = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
    return y + '–' + String(y + 2).slice(2);
  }

  function addPupils() {
    var cls = currentClass();
    if (!cls || blocked()) return;
    var ta = h('textarea', { rows: 8, placeholder: 'One name per line', 'aria-label': 'Pupil names' });
    var d = dialog('Add pupils to ' + cls.name, [
      h('p', { class: 'npa-dialog-sub', text: 'First names are enough. Pupils already in the class are skipped.' }), ta
    ], [
      h('button', { value: 'close', class: 'npa-btn', text: 'Cancel' }),
      h('button', { value: 'ok', class: 'npa-btn npa-btn--primary', text: 'Add' })
    ]);
    d.addEventListener('close', function() {
      if (d.returnValue !== 'ok') return;
      var have = {};
      cls.pupils.forEach(function(p) { have[NpaTracker.norm(p.name)] = true; });
      var added = 0;
      ta.value.split(/\n/).forEach(function(line) {
        var nm = NpaTracker.cleanText(line).slice(0, 80);
        if (!nm || have[NpaTracker.norm(nm)]) return;
        have[NpaTracker.norm(nm)] = true;
        cls.pupils.push({ id: uid('p'), name: nm, strengths: '', development: '', work: {} });
        added++;
      });
      if (!added) return;
      save();
      render();
      toast(added + ' pupil' + (added === 1 ? '' : 's') + ' added');
    });
    openDialog(d);
    ta.focus();
  }

  // Dropdown under the Class button: setup and housekeeping actions that are not needed every lesson.
  function classMenu(e) {
    var btn = e && e.currentTarget || $('npa-class-menu');
    var cls = currentClass();
    if (!cls) return;
    var open = document.querySelector('.npa-menu-pop');
    if (open) { open.remove(); return; }
    function item(label, fn, danger) {
      return h('button', { type: 'button', role: 'menuitem', class: 'npa-menu-item' + (danger ? ' is-danger' : ''), text: label,
        onclick: function() { close(); fn(); } });
    }
    var pop = h('div', { class: 'npa-menu-pop', role: 'menu', 'aria-label': 'Class' },
      item('Add pupils', addPupils),
      item('Units and tasks', editCourse),
      item('Unit due dates', editDueDates),
      h('hr'),
      item('Rename class', function() {
        if (blocked()) return;
        askText('Rename class', 'Class name', cls.name, 'Rename', function(v) { cls.name = v; save(); render(); });
      }),
      item('New class', newClass),
      h('hr'),
      item('Delete class', function() {
        if (blocked()) return;
        if (!confirm('Delete ' + cls.name + ' and all ' + cls.pupils.length + ' pupils\u2019 tracking? This can\u2019t be undone.')) return;
        S.classes = S.classes.filter(function(c) { return c.id !== cls.id; });
        save();
        render();
        toast(cls.name + ' deleted');
      }, true));
    function close() {
      pop.remove();
      btn.setAttribute('aria-expanded', 'false');
      document.removeEventListener('pointerdown', outside, true);
      document.removeEventListener('keydown', onKey, true);
    }
    function outside(ev) { if (!pop.contains(ev.target) && ev.target !== btn) close(); }
    function onKey(ev) {
      var items = Array.prototype.slice.call(pop.querySelectorAll('.npa-menu-item'));
      var at = items.indexOf(document.activeElement);
      if (ev.key === 'Escape') { ev.preventDefault(); close(); btn.focus(); }
      else if (ev.key === 'ArrowDown') { ev.preventDefault(); items[(at + 1) % items.length].focus(); }
      else if (ev.key === 'ArrowUp') { ev.preventDefault(); items[(at - 1 + items.length) % items.length].focus(); }
    }
    document.body.appendChild(pop);
    var r = btn.getBoundingClientRect();
    pop.style.top = (r.bottom + window.scrollY + 6) + 'px';
    pop.style.left = Math.max(8, Math.min(r.right - pop.offsetWidth, window.innerWidth - pop.offsetWidth - 8)) + 'px';
    btn.setAttribute('aria-expanded', 'true');
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('keydown', onKey, true);
    pop.querySelector('.npa-menu-item').focus();
  }

  // ── units and tasks ───────────────────────────────────────
  function editCourse() {
    if (blocked()) return;
    var body = h('div', { class: 'npa-course' });
    function used(taskId) {
      return S.classes.some(function(c) { return c.pupils.some(function(p) { return p.work[taskId]; }); });
    }
    function nameInput(obj, label) {
      var i = h('input', { type: 'text', maxlength: 120, 'aria-label': label });
      i.value = obj.name;
      i.addEventListener('change', function() {
        var v = NpaTracker.cleanText(i.value).slice(0, 120);
        if (v) { obj.name = v; save(); render(); } else i.value = obj.name;
      });
      return i;
    }
    function paint() {
      body.textContent = '';
      var view = currentView();
      S.courses.forEach(function(course) {
        if (view !== 'overview' && view !== 'dashboard' && course.id !== view) return;
        body.appendChild(h('h3', { class: 'npa-section-title', text: strandName(course) }));
        var unitsWrap = h('div');
        body.appendChild(unitsWrap);
        course.units.forEach(function(u, ui) {
          var list = h('ol', { class: 'npa-course-tasks' });
          u.tasks.forEach(function(t, ti) {
            list.appendChild(h('li', null, nameInput(t, 'Task name'),
              h('button', { type: 'button', class: 'npa-icon-btn', 'aria-label': 'Remove ' + t.name, text: '\u00d7', onclick: function() {
                if (used(t.id) && !confirm('Pupils have progress recorded for \u201c' + t.name + '\u201d. Remove the task and that progress?')) return;
                S.classes.forEach(function(c) { c.pupils.forEach(function(p) { delete p.work[t.id]; }); });
                u.tasks.splice(ti, 1); save(); paint(); render();
              } })));
          });
          var unitBox = h('fieldset', { class: 'npa-course-unit' },
            h('legend', { class: 'sr-only', text: u.name }),
            h('div', { class: 'npa-course-unit-head' }, nameInput(u, 'Unit name'),
              h('button', { type: 'button', class: 'npa-icon-btn', 'aria-label': 'Remove unit ' + u.name, text: '\u00d7', onclick: function() {
                if (u.tasks.some(function(t) { return used(t.id); })) { toast('Remove this unit\u2019s tasks first: pupils have progress recorded in them.', 3500); return; }
                course.units.splice(ui, 1); save(); paint(); render();
              } })),
            list,
            h('button', { type: 'button', class: 'npa-link', text: '+ Add task', onclick: function() {
              u.tasks.push({ id: uid('t'), name: 'New task' }); save(); paint(); render();
              var box = body.querySelector('[data-unit="' + u.id + '"]');
              var inputs = box ? box.querySelectorAll('.npa-course-tasks input') : [];
              if (inputs.length) { inputs[inputs.length - 1].focus(); inputs[inputs.length - 1].select(); }
            } }));
          unitBox.dataset.unit = u.id;
          unitsWrap.appendChild(unitBox);
        });
        body.appendChild(h('button', { type: 'button', class: 'npa-btn', text: '+ Add unit to ' + strandName(course), onclick: function() {
          course.units.push({ id: uid('u'), name: 'New unit', tasks: [] }); save(); paint(); render();
        } }));
      });
    }
    paint();
    openDialog(dialog('Units and tasks', [
      h('p', { class: 'npa-dialog-sub', text: 'Shared by all your NPA classes. Changes save as you go.' }), body
    ], [h('button', { value: 'close', class: 'npa-btn npa-btn--primary', text: 'Done' })]));
  }

  // ── importing a spreadsheet (read on this device only) ────
  var xlsxPromise = null;
  function loadXlsx() {
    if (window.XLSX) return Promise.resolve();
    if (!xlsxPromise) {
      xlsxPromise = new Promise(function(resolve, reject) {
        var s = document.createElement('script');
        s.src = XLSX_SRC;
        s.crossOrigin = 'anonymous';
        s.referrerPolicy = 'no-referrer';
        s.onload = function() { resolve(); };
        s.onerror = function() { xlsxPromise = null; reject(new Error('Could not load the spreadsheet reader. Check your connection and try again.')); };
        document.head.appendChild(s);
      });
    }
    return xlsxPromise;
  }

  function pickFile() {
    if (blocked()) return;
    var input = $('npa-file');
    input.value = '';
    input.click();
  }

  function onFile(e) {
    var file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) { toast('Choose an Excel (.xlsx) or CSV file.', 3500); return; }
    if (file.size > MAX_FILE_BYTES) { toast('That file is too large to be a tracking spreadsheet (over 5 MB).', 3500); return; }
    toast('Reading ' + file.name + ' on this device…');
    Promise.all([loadXlsx(), file.arrayBuffer()]).then(function(r) {
      var wb = XLSX.read(r[1], { type: 'array', cellFormula: false, cellHTML: false, cellStyles: false, bookVBA: false });
      var sheets = wb.SheetNames.map(function(name) {
        return { name: name, rows: XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: null, raw: false, blankrows: true }) };
      });
      var parsed = NpaTracker.parseWorkbook(sheets);
      if (!parsed) {
        toast('No \u201cNPA Photography\u201d or \u201cNPA Art and Design\u201d heading found in column A of any sheet, so nothing was imported.', 5000);
        return;
      }
      if (!parsed.pupilNames.length) { toast('Found the NPA headings, but no pupils under them.', 4000); return; }
      previewImport(parsed, file.name);
    }).catch(function(err) {
      toast((err && err.message) || 'That file could not be read.', 4000);
    });
  }

  function previewImport(parsed, fileName) {
    var existing = currentClass();
    var targetSel = h('select', { 'aria-label': 'Import into' });
    (S.classes || []).forEach(function(c) {
      targetSel.appendChild(h('option', { value: c.id, selected: existing && c.id === existing.id, text: 'Add to ' + c.name }));
    });
    targetSel.appendChild(h('option', { value: '', selected: !existing, text: 'New class…' }));
    var newName = h('input', { type: 'text', maxlength: 80, 'aria-label': 'New class name' });
    newName.value = 'NPA ' + defaultCohort();
    var newWrap = h('label', { class: 'npa-field' }, h('span', { text: 'New class name' }), newName);
    var summary = h('div', { class: 'npa-import-summary', 'aria-live': 'polite' });

    function target() { return targetSel.value ? { classId: targetSel.value } : { className: newName.value }; }
    function dryRun() {
      var copy = JSON.parse(JSON.stringify(S));
      var n = 0;
      return NpaTracker.applyImport(copy, parsed, target(), function(p) { return p + '-preview' + (++n); });
    }
    function paint() {
      newWrap.hidden = !!targetSel.value;
      var st = dryRun();
      summary.textContent = '';
      var lines = [
        st.pupilsAdded + ' new pupil' + (st.pupilsAdded === 1 ? '' : 's') + (st.pupilsMatched ? ', ' + st.pupilsMatched + ' already in the class' : ''),
        st.cellsFilled + ' task results to add (' + parsed.sections.map(function(sec) {
          return ((st.byCourse[sec.courseId] || {}).cellsFilled || 0) + ' ' + strandName({ id: sec.courseId, name: sec.courseName });
        }).join(', ') + ')' + (st.cellsKept ? ' (' + st.cellsKept + ' left as they are, because the tracker already has a result)' : ''),
        st.commentsFilled ? st.commentsFilled + ' strengths / areas for development to add' : null,
        (st.unitsAdded || st.tasksAdded) ? 'New in your strands: ' + st.unitsAdded + ' unit(s), ' + st.tasksAdded + ' task(s)' : null
      ].filter(Boolean);
      summary.appendChild(h('ul', null, lines.map(function(l) { return h('li', { text: l }); })));
    }
    targetSel.addEventListener('change', paint);
    newName.addEventListener('input', paint);

    // Per pupil, per strand: how many complete / in progress.
    var counts = {};
    parsed.sections.forEach(function(sec) {
      sec.pupils.forEach(function(p) {
        var k = NpaTracker.norm(p.name);
        var row = counts[k] || (counts[k] = {});
        var c = row[sec.courseId] || (row[sec.courseId] = { done: 0, started: 0 });
        Object.keys(p.cells).forEach(function(col) { c[p.cells[col].s === 'done' ? 'done' : 'started']++; });
      });
    });
    var table = h('table', { class: 'npa-preview' },
      h('thead', null, h('tr', null,
        h('th', { scope: 'col', text: 'Pupil' }),
        parsed.sections.map(function(sec) { return h('th', { scope: 'col', text: strandName({ id: sec.courseId, name: sec.courseName }) }); }),
        h('th', { scope: 'col', text: 'Strengths / development' }))),
      h('tbody', null, parsed.pupilNames.map(function(name) {
        var k = NpaTracker.norm(name);
        var cm = parsed.comments[k] || {};
        return h('tr', null,
          h('th', { scope: 'row', text: name }),
          parsed.sections.map(function(sec) {
            var c = (counts[k] || {})[sec.courseId];
            return h('td', { text: c ? c.done + ' complete' + (c.started ? ', ' + c.started + ' in progress' : '') : 'Not listed' });
          }),
          h('td', { class: 'npa-preview-comment', text: [cm.strengths, cm.development].filter(Boolean).join(' \u00b7 ') || 'None' }));
      })));
    var warnings = [];
    parsed.sections.forEach(function(sec) {
      sec.warnings.forEach(function(w) { warnings.push(strandName({ id: sec.courseId, name: sec.courseName }) + ': ' + w); });
    });

    var d = dialog('Check before importing', [
      h('p', { class: 'npa-dialog-sub', text: fileName + ' \u00b7 read on this device, not uploaded' }),
      parsed.sections.map(function(sec) {
        return h('p', { class: 'npa-dialog-sub' }, h('strong', { text: sec.courseName + ': ' }),
          sec.units.map(function(u) { return u.name + ' (' + u.tasks.length + ' task' + (u.tasks.length === 1 ? '' : 's') + ')'; }).join(', '));
      }),
      h('label', { class: 'npa-field' }, h('span', { text: 'Import into' }), targetSel),
      newWrap,
      summary,
      warnings.length ? h('ul', { class: 'npa-warnings' }, warnings.map(function(w) { return h('li', { text: w }); })) : null,
      h('p', { class: 'npa-dialog-sub', text: '\u201cX\u201d becomes Complete. Any other text becomes In progress, with the text kept as a note. Each pupil is added once, with both strands. Nothing already in your tracker is overwritten.' }),
      h('div', { class: 'npa-preview-wrap' }, table)
    ], [
      h('button', { value: 'close', class: 'npa-btn', text: 'Cancel' }),
      h('button', { value: 'import', class: 'npa-btn npa-btn--primary', text: 'Import ' + parsed.pupilNames.length + ' pupils' })
    ]);
    d.addEventListener('close', function() {
      if (d.returnValue !== 'import' || blocked()) return;
      var st = NpaTracker.applyImport(S, parsed, target(), uid);
      prefs.classId = st.classId; prefs.view = 'overview'; writePrefs();
      render();
      SYNC.save();
      SYNC.flush().then(function(r) {
        toast(r.ok ? 'Imported and saved. You can now delete the spreadsheet from your device.' : 'Imported. Saving is still in progress and your changes are kept on this device.', 5000);
      });
    });
    paint();
    openDialog(d);
  }

  // ── start ─────────────────────────────────────────────────
  function start() {
    SYNC.load().then(function() { render(); });
  }

  document.addEventListener('DOMContentLoaded', function() {
    $('npa-class').addEventListener('change', function(e) { prefs.classId = e.target.value; writePrefs(); render(); });
    $('npa-import').addEventListener('click', pickFile);
    $('npa-class-menu').addEventListener('click', classMenu);
    $('npa-file').addEventListener('change', onFile);
    render();
    start();
  });
})();
