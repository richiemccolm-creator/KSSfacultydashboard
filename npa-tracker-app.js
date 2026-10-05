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
  // View: 'overview' (both strands, one row per pupil) or a strand id ('photo' / 'art').
  function currentView() {
    var v = prefs.view;
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
    d.showModal();
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
    retrying: ['Not saved — retrying', 'warn'],
    offline: ['Offline — kept on this device', 'warn'],
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
    if (!cls) { main.appendChild(renderEmpty()); return; }
    var view = currentView();
    main.appendChild(renderViewTabs(view));
    if (!cls.pupils.length) { main.appendChild(renderNoPupils(cls)); return; }
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
    ['npa-class', 'npa-add-pupil', 'npa-class-menu'].forEach(function(id) { $(id).hidden = !cls; });
  }

  function renderEmpty() {
    return h('section', { class: 'npa-empty' },
      h('h2', { text: 'Set up your NPA class' }),
      h('p', { text: 'Photography and Art & Design are tracked together for the same pupils. Bring in your existing tracking spreadsheet, or start an empty class and add pupils yourself.' }),
      h('div', { class: 'npa-empty-actions' },
        h('button', { type: 'button', class: 'npa-btn npa-btn--primary', text: 'Import tracking spreadsheet', onclick: pickFile }),
        h('button', { type: 'button', class: 'npa-btn', text: 'Start an empty class', onclick: newClass })));
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
          var label = p.name + ', ' + u.name + ': ' + pr.done + ' of ' + pr.total + ' complete' + (pr.started ? ', ' + pr.started + ' in progress' : '');
          tr.appendChild(h('td', { class: 'npa-cell' + (i === 0 ? ' npa-unit-start' : '') },
            h('button', {
              type: 'button', class: 'npa-sum npa-sum--' + kind, 'aria-label': label + '. Open unit', title: label,
              onclick: function() { prefs.view = c.id; setUnitPref(c.id, u.id); render(); }
            }, pr.done + '/' + pr.total)));
        });
        tr.appendChild(h('td', { class: 'npa-prog-col' + (units.length ? '' : ' npa-unit-start') }, progressBar(NpaTracker.pupilProgress(p, NpaTracker.allTasks(S, c.id)))));
      });
      body.appendChild(tr);
    });

    var frag = document.createDocumentFragment();
    frag.appendChild(h('div', { class: 'npa-table-wrap' },
      h('table', { class: 'npa-table' }, h('thead', null, head1, head2), body)));
    frag.appendChild(h('p', { class: 'npa-legend' },
      h('span', { class: 'npa-sum npa-sum--all', 'aria-hidden': 'true', text: '3/3' }), ' Unit complete ',
      h('span', { class: 'npa-sum npa-sum--some', 'aria-hidden': 'true', text: '1/3' }), ' Under way \u00b7 Tap a number to open that unit, or a pupil\u2019s name for their strengths and what\u2019s left to do.'));
    return frag;
  }

  function renderUnitChips(course) {
    var wrap = h('div', { class: 'npa-chips', role: 'tablist', 'aria-label': 'Show unit' });
    var cur = unitPref(course.id);
    function chip(id, label) {
      var on = cur === id;
      wrap.appendChild(h('button', {
        type: 'button', role: 'tab', 'aria-selected': on ? 'true' : 'false', class: 'npa-chip' + (on ? ' is-on' : ''), text: label,
        onclick: function() { setUnitPref(course.id, id); render(); }
      }));
    }
    chip('', 'All units');
    course.units.forEach(function(u) { chip(u.id, u.name); });
    return wrap;
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
        head2.appendChild(h('th', { scope: 'col', class: 'npa-task-head' + (i === 0 ? ' npa-unit-start' : ''), title: t.name }, h('span', { text: t.name })));
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
            }, s === 'done' ? '\u2713' : s === 'started' ? '\u2022\u2022\u2022' : '')));
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
      h('span', { class: 'npa-mark npa-mark--started', 'aria-hidden': 'true', text: '\u2022\u2022\u2022' }), ' In progress ',
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

  function classMenu() {
    var cls = currentClass();
    if (!cls) return;
    var d = dialog(cls.name, h('div', { class: 'npa-menu' },
      h('button', { type: 'button', class: 'npa-btn', text: 'Rename class', onclick: function() {
        d.close();
        if (blocked()) return;
        askText('Rename class', 'Class name', cls.name, 'Rename', function(v) { cls.name = v; save(); render(); });
      } }),
      h('button', { type: 'button', class: 'npa-btn', text: 'New class', onclick: function() { d.close(); newClass(); } }),
      h('button', { type: 'button', class: 'npa-btn npa-btn--danger', text: 'Delete class', onclick: function() {
        d.close();
        if (blocked()) return;
        if (!confirm('Delete ' + cls.name + ' and all ' + cls.pupils.length + ' pupils’ tracking? This can’t be undone.')) return;
        S.classes = S.classes.filter(function(c) { return c.id !== cls.id; });
        save();
        render();
        toast(cls.name + ' deleted');
      } })));
    openDialog(d);
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
        if (view !== 'overview' && course.id !== view) return;
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
    openDialog(dialog('Units & tasks', [
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
          h('td', { class: 'npa-preview-comment', text: [cm.strengths, cm.development].filter(Boolean).join(' \u00b7 ') || '\u2014' }));
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
    $('npa-course').addEventListener('click', editCourse);
    $('npa-add-pupil').addEventListener('click', addPupils);
    $('npa-class-menu').addEventListener('click', classMenu);
    $('npa-file').addEventListener('change', onFile);
    $('npa-privacy-slot').appendChild(privacyNote());
    render();
    start();
  });
})();
