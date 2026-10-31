/**
 * N5 Creative Industries assessment tracker.
 * Views: overview (class register), marking grid, pupils and one pupil's
 * record, follow-ups, settings and data. Rows come from CiAssessService;
 * progress and readiness from CiAssessCore.
 */
/* global CiAssessService, CiAssessCore, CI_ASSESS_UNITS */
(function () {
  var YEAR = '2026-27';
  var YEAR_LABEL = '2026–27';
  var S = CiAssessCore.STATUS;
  var ORDER = CI_ASSESS_UNITS.ORDER;
  var VIEWS = [
    ['overview', 'Overview'],
    ['grid', 'Marking grid'],
    ['pupils', 'Pupils'],
    ['followups', 'Follow-ups'],
    ['settings', 'Settings and data']
  ];
  var KEY_STATUS = { '1': 'd', '2': 'r', '3': 'm', '4': 'x', '0': 'n' };
  var TICK = '<svg class="cia-tick-svg" viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7"/></svg>';

  var state = {
    ready: false,
    view: 'overview',
    pupilId: null,
    unit: 'u1',
    classFilter: '',
    search: '',
    followFilter: 'open',
    settings: { school_year: YEAR, intro_variant: 'UK' },
    pupils: [],
    marks: {},
    followups: [],
    units: CI_ASSESS_UNITS.forVariant('UK'),
    sync: '',
    syncKind: 'busy',
    notice: '',
    error: '',
    pop: null,
    pendingImport: null
  };
  var els = {};
  var noticeTimer = null;

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /** The mark shown in a grid cell; a drawn tick for achieved, so it never turns into an emoji. */
  function glyph(k) {
    return k === 'm' ? TICK : esc(S[k].glyph);
  }

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function todayISO() {
    var d = new Date();
    var m = d.getMonth() + 1;
    var day = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
  }

  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function shortDate(iso) {
    var p = String(iso || '').slice(0, 10).split('-');
    if (p.length !== 3) return '';
    return Number(p[2]) + ' ' + MONTHS[Number(p[1]) - 1];
  }

  function sortedPupils() {
    return state.pupils.slice().sort(function (a, b) {
      return a.name.localeCompare(b.name, 'en-GB');
    });
  }

  function shownPupils() {
    var q = state.search.trim().toLowerCase();
    return sortedPupils().filter(function (p) {
      if (state.classFilter && p.class_code !== state.classFilter) return false;
      if (!q) return true;
      return (p.name + ' ' + p.class_code + ' ' + p.team).toLowerCase().indexOf(q) !== -1;
    });
  }

  function classCodes() {
    var seen = {};
    state.pupils.forEach(function (p) { if (p.class_code) seen[p.class_code] = true; });
    return Object.keys(seen).sort();
  }

  function pupil(id) {
    for (var i = 0; i < state.pupils.length; i++) if (state.pupils[i].id === id) return state.pupils[i];
    return null;
  }

  function mark(pupilId, code) {
    return state.marks[CiAssessCore.markKey(pupilId, code)] || null;
  }

  function criterion(code) {
    var u = state.units[code.split('.')[0]];
    for (var i = 0; i < u.criteria.length; i++) if (u.criteria[i].code === code) return u.criteria[i];
    return null;
  }

  function checkpoint(code) {
    var u = state.units[code.split('.')[0]];
    for (var i = 0; i < u.checkpoints.length; i++) if (u.checkpoints[i].code === code) return u.checkpoints[i];
    return null;
  }

  function canWrite() {
    return CiAssessService.me().canWrite;
  }

  function plural(n, one, many) {
    return n + ' ' + (n === 1 ? one : (many || one + 's'));
  }

  function byLine(m) {
    if (!m || !m.updated_at) return '';
    var who = m.updated_by_name ? 'by ' + m.updated_by_name + ', ' : '';
    return who + shortDate(m.updated_at);
  }

  /** The most recent evidence location used for a criterion, to offer for the next pupil. */
  function lastRef(code) {
    var best = null;
    Object.keys(state.marks).forEach(function (k) {
      var m = state.marks[k];
      if (m.code !== code || !m.evidence_ref) return;
      if (!best || String(m.updated_at || '') > String(best.updated_at || '')) best = m;
    });
    return best ? { ref: best.evidence_ref, type: best.evidence_type } : null;
  }

  // ---------------------------------------------------------------------------
  // Saving
  // ---------------------------------------------------------------------------

  function persist() {
    var marks = Object.keys(state.marks).map(function (k) { return state.marks[k]; });
    CiAssessService.cache(YEAR, {
      settings: state.settings,
      pupils: state.pupils,
      marks: marks,
      followups: state.followups
    });
  }

  function setSync() {
    var mode = CiAssessService.mode();
    var pending = CiAssessService.pending();
    if (pending) {
      state.sync = plural(pending, 'change') + ' waiting to send';
      state.syncKind = 'warn';
    } else if (mode === 'cloud') {
      state.sync = 'Saved to the Faculty Hub';
      state.syncKind = 'ok';
    } else {
      state.sync = 'Saved on this device only';
      state.syncKind = 'warn';
    }
    if (els.sync) {
      els.sync.textContent = state.sync;
      els.sync.setAttribute('data-kind', state.syncKind);
    }
  }

  function say(msg) {
    state.notice = msg;
    if (els.notice) {
      els.notice.textContent = msg;
      els.notice.hidden = !msg;
    }
    clearTimeout(noticeTimer);
    if (msg) noticeTimer = setTimeout(function () { say(''); }, 6000);
  }

  function failed(err) {
    say(CiAssessService.formatError(err));
    setSync();
  }

  function after(promise) {
    persist();
    setSync();
    return Promise.resolve(promise).then(setSync).catch(failed);
  }

  function stamp(row) {
    row.updated_at = new Date().toISOString();
    row.updated_by_name = CiAssessService.me().name || '';
    return row;
  }

  /**
   * Records decisions. A sign-off that no longer holds (a criterion is no
   * longer achieved, a checkpoint no longer verified) is removed with it.
   */
  function saveMarks(rows) {
    var removed = [];
    rows.forEach(function (r) {
      var row = stamp({
        pupil_id: r.pupil_id,
        code: r.code,
        kind: r.kind,
        status: r.status,
        evidence_type: r.evidence_type || '',
        evidence_ref: r.evidence_ref || '',
        note: r.note || '',
        assessed_on: r.assessed_on || null,
        signed_by: r.signed_by || ''
      });
      state.marks[CiAssessCore.markKey(row.pupil_id, row.code)] = row;
    });
    var touched = {};
    rows.forEach(function (r) { touched[r.pupil_id + '|' + r.code.split('.')[0]] = r; });
    var deletes = [];
    Object.keys(touched).forEach(function (k) {
      var parts = k.split('|');
      var unit = state.units[parts[1]];
      var so = mark(parts[0], parts[1] + '.signoff');
      if (!so || so.status !== 'm') return;
      if (!CiAssessCore.unitProgress(unit, state.marks, parts[0]).ready) {
        delete state.marks[CiAssessCore.markKey(parts[0], parts[1] + '.signoff')];
        deletes.push([parts[0], parts[1] + '.signoff']);
        removed.push((pupil(parts[0]) || {}).name + ' (' + unit.short + ')');
      }
    });
    var payload = rows.map(function (r) {
      var m = mark(r.pupil_id, r.code);
      return {
        pupil_id: m.pupil_id, code: m.code, kind: m.kind, status: m.status,
        evidence_type: m.evidence_type, evidence_ref: m.evidence_ref, note: m.note,
        assessed_on: m.assessed_on, signed_by: m.signed_by
      };
    });
    var work = CiAssessService.upsertMarks(payload).then(function () {
      return Promise.all(deletes.map(function (d) { return CiAssessService.deleteMark(d[0], d[1]); }));
    });
    if (removed.length) {
      say('Sign-off removed for ' + removed.join(', ') + ', because the unit is no longer complete.');
    }
    render();
    return after(work);
  }

  function clearMark(pupilId, code) {
    var m = mark(pupilId, code);
    if (!m) return Promise.resolve();
    var kind = m.kind;
    if (kind === 'signoff') {
      delete state.marks[CiAssessCore.markKey(pupilId, code)];
      render();
      return after(CiAssessService.deleteMark(pupilId, code));
    }
    return saveMarks([{ pupil_id: pupilId, code: code, kind: kind, status: 'n' }]);
  }

  // ---------------------------------------------------------------------------
  // Loading and live updates
  // ---------------------------------------------------------------------------

  function applySnapshot(snap) {
    snap = snap || {};
    state.settings = snap.settings || { school_year: YEAR, intro_variant: 'UK' };
    state.units = CI_ASSESS_UNITS.forVariant(state.settings.intro_variant);
    state.pupils = (snap.pupils || []).slice();
    state.marks = CiAssessCore.indexMarks(snap.marks || []);
    state.followups = (snap.followups || []).slice();
  }

  function onLive(evt) {
    if (evt.type !== 'change') {
      setSync();
      if (evt.type === 'error') say(evt.message);
      return;
    }
    var row = evt.row || {};
    var old = evt.old || {};
    var gone = evt.event === 'DELETE';
    if (evt.table === 'marks') {
      var key = CiAssessCore.markKey(gone ? old.pupil_id : row.pupil_id, gone ? old.code : row.code);
      if (gone) delete state.marks[key];
      else state.marks[key] = row;
    } else if (evt.table === 'pupils') {
      state.pupils = state.pupils.filter(function (p) { return p.id !== (gone ? old.id : row.id); });
      if (!gone) state.pupils.push(row);
      if (gone && state.pupilId === old.id) { state.pupilId = null; state.view = 'pupils'; }
    } else if (evt.table === 'followups') {
      state.followups = state.followups.filter(function (f) { return f.id !== (gone ? old.id : row.id); });
      if (!gone) state.followups.push(row);
    } else if (evt.table === 'settings' && !gone) {
      state.settings = row;
      state.units = CI_ASSESS_UNITS.forVariant(row.intro_variant);
    }
    persist();
    render();
  }

  function start() {
    els.root = $('#cia-root');
    els.sync = $('#cia-sync');
    els.notice = $('#cia-notice');
    els.banner = $('#cia-banner');
    els.view = $('#cia-view');
    els.tabs = $('#cia-tabs');
    els.finding = $('#cia-finding');
    els.scope = $('#cia-scope');
    els.dialog = $('#cia-dialog');
    els.pop = $('#cia-pop');

    readHash();
    CiAssessService.init(YEAR).then(function (r) {
      showBanner(r);
      return CiAssessService.load(YEAR);
    }).then(function (snap) {
      applySnapshot(snap);
      state.ready = true;
      CiAssessService.subscribe(YEAR, onLive);
      setSync();
      render();
    }).catch(function (err) {
      state.ready = true;
      state.error = CiAssessService.formatError(err);
      render();
    });

    document.addEventListener('click', onClick);
    document.addEventListener('input', onInput);
    document.addEventListener('change', onChange);
    document.addEventListener('keydown', onKey);
    window.addEventListener('hashchange', function () { readHash(); render(); });
    window.addEventListener('resize', function () { if (state.pop) placePop(); });
    document.documentElement.classList.remove('cia-embed-pending');
  }

  function showBanner(r) {
    var msg = '';
    if (r.mode === 'local' && r.reason === 'no-migration') {
      msg = 'This tracker is saving on this device only. Run the ci_assessment migration in Supabase (#26 in DEPLOYMENT.md) to share it across devices and colleagues.';
    } else if (r.mode === 'local' && (r.reason === 'no-cloud' || r.reason === 'signed-out')) {
      msg = 'You are not signed in, so this tracker is saving on this device only.';
    } else if (r.mode === 'local' && r.reason) {
      msg = 'Could not reach the Faculty Hub (' + r.reason + '). Saving on this device only.';
    } else if (r.reason === 'offline') {
      msg = 'You are offline. Changes are kept on this device and sent when you reconnect.';
    }
    els.banner.textContent = msg;
    els.banner.hidden = !msg;
  }

  function readHash() {
    var h = String(window.location.hash || '').replace(/^#/, '').split('/');
    var known = VIEWS.some(function (v) { return v[0] === h[0]; }) || h[0] === 'pupil';
    if (!known) return;
    state.view = h[0];
    if (h[0] === 'grid' && /^u[1-4]$/.test(h[1] || '')) state.unit = h[1];
    if (h[0] === 'pupil') state.pupilId = h[1] || null;
  }

  function go(view, arg) {
    closePop();
    state.view = view;
    if (view === 'pupil') state.pupilId = arg;
    if (view === 'grid' && arg) state.unit = arg;
    var hash = '#' + view + (view === 'pupil' ? '/' + arg : view === 'grid' ? '/' + state.unit : '');
    if (window.location.hash !== hash) {
      try { history.replaceState(null, '', hash); } catch (e) { window.location.hash = hash; }
    }
    render();
    window.scrollTo(0, 0);
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  function summary() {
    return CiAssessCore.classSummary(state.units, ORDER, state.pupils, state.marks, state.followups, todayISO());
  }

  function render() {
    if (!els.view) return;
    var sum = summary();
    var unitCode = state.units.u1.code;
    els.scope.textContent = 'N5 Skills for Work · ' + YEAR_LABEL + ' · ' + plural(state.pupils.length, 'pupil') +
      ' · Introduction unit ' + unitCode;
    els.finding.innerHTML = findingLine(sum);
    var openCount = sum.openFollowups;
    els.tabs.innerHTML = VIEWS.map(function (v) {
      var active = state.view === v[0] || (v[0] === 'pupils' && state.view === 'pupil');
      var count = v[0] === 'followups' && openCount ? ' <span class="cia-count">' + openCount + '</span>' : '';
      return '<a class="cia-tab" href="#' + v[0] + '" data-go="' + v[0] + '"' + (active ? ' aria-current="page"' : '') + '>' +
        esc(v[1]) + count + '</a>';
    }).join('');

    if (!state.ready) {
      els.view.innerHTML = '<div class="cia-loading">Loading the tracker…</div>';
      return;
    }
    if (state.error) {
      els.view.innerHTML = '<section class="cia-card cia-empty"><h2>The tracker could not load</h2><p>' + esc(state.error) +
        '</p><button type="button" class="cia-btn" data-act="reload">Try again</button></section>';
      return;
    }

    var keep = keepPlace();
    var html;
    if (state.view === 'grid') html = renderGrid();
    else if (state.view === 'pupils') html = renderPupils();
    else if (state.view === 'pupil') html = renderPupil();
    else if (state.view === 'followups') html = renderFollowups();
    else if (state.view === 'settings') html = renderSettings();
    else html = renderOverview(sum);
    els.view.innerHTML = html;
    restorePlace(keep);
  }

  function keepPlace() {
    var a = document.activeElement;
    var scroller = $('.cia-grid-scroll');
    return {
      id: a && a.id,
      cell: a && a.getAttribute && a.getAttribute('data-cell'),
      caret: a && typeof a.selectionStart === 'number' ? a.selectionStart : null,
      left: scroller ? scroller.scrollLeft : 0,
      top: scroller ? scroller.scrollTop : 0
    };
  }

  function restorePlace(k) {
    var scroller = $('.cia-grid-scroll');
    if (scroller) { scroller.scrollLeft = k.left; scroller.scrollTop = k.top; }
    var el = k.cell ? $('[data-cell="' + k.cell + '"]') : k.id ? document.getElementById(k.id) : null;
    if (el && !state.pop && !(els.dialog && els.dialog.open)) {
      el.focus({ preventScroll: true });
      if (k.caret != null && el.setSelectionRange) {
        try { el.setSelectionRange(k.caret, k.caret); } catch (e) { /* not a text field */ }
      }
    }
  }

  function findingLine(sum) {
    if (!state.ready || state.error) return '';
    if (!state.pupils.length) return 'Add your class list to start recording evidence against the SQA performance criteria.';
    var parts = [];
    if (sum.ready.length) {
      var names = sum.ready.slice(0, 2).map(function (r) {
        return '<strong>' + esc(r.pupil.name) + '</strong> (' + esc(state.units[r.unitId].short) + ')';
      });
      var more = sum.ready.length > 2 ? ' and ' + (sum.ready.length - 2) + ' more' : '';
      parts.push((sum.ready.length === 1 ? 'Ready to sign off: ' : plural(sum.ready.length, 'unit sign-off') + ' ready: ') + names.join(', ') + more + '.');
    }
    if (sum.toAssessTotal) {
      var top = sum.toAssess[0];
      var c = criterion(top.code);
      parts.push(plural(sum.toAssessTotal, 'decision') + ' waiting to be assessed, most in ' +
        esc(state.units[top.code.split('.')[0]].short) + ' ' + esc(c ? c.label : '') + '.');
    }
    if (sum.overdue) parts.push(plural(sum.overdue, 'follow-up') + ' overdue.');
    if (!parts.length) {
      return sum.passes === state.pupils.length
        ? 'Every pupil has passed all four units.'
        : 'Nothing is waiting on you. ' + sum.met + ' of ' + sum.possible + ' criteria are achieved across the class.';
    }
    return parts.join(' ');
  }

  function btn(label, act, cls, extra) {
    return '<button type="button" class="cia-btn' + (cls ? ' ' + cls : '') + '" data-act="' + act + '"' + (extra || '') + '>' + label + '</button>';
  }

  function writeAttr() {
    return canWrite() ? '' : ' disabled';
  }

  // --- Overview -------------------------------------------------------------

  function renderOverview(sum) {
    if (!state.pupils.length) {
      return '<section class="cia-card cia-empty"><h2>No pupils yet</h2>' +
        '<p>Paste your class list, or bring in the data from the offline Assessment Studio in Settings and data.</p>' +
        '<div class="cia-row-actions">' + btn('Add pupils', 'add-pupils', 'cia-btn-primary', writeAttr()) + btn('Settings and data', 'go-settings') + '</div></section>';
    }
    var figures = '<section class="cia-figures" aria-label="Class figures">' +
      figure('Criteria achieved', sum.met + '<span class="cia-of"> of ' + sum.possible + '</span>', sum.pct.toFixed(1) + '% across the class') +
      figure('Ready to sign off', String(sum.ready.length), sum.ready.length === 1 ? 'unit waiting for an assessor' : 'units waiting for an assessor') +
      figure('Units signed off', sum.signed + '<span class="cia-of"> of ' + sum.unitSlots + '</span>', '4 units per pupil') +
      figure('Course passes', sum.passes + '<span class="cia-of"> of ' + sum.pupils + '</span>', 'all four units signed off') +
      '</section>';
    return figures + '<div class="cia-split">' + renderRegister() + '<div class="cia-side">' + renderQueue(sum) + renderUnitBars() + '</div></div>';
  }

  function figure(label, value, foot) {
    return '<div class="cia-figure"><div class="cia-figure-label">' + esc(label) + '</div><div class="cia-figure-value">' + value +
      '</div><div class="cia-figure-foot">' + esc(foot) + '</div></div>';
  }

  /** One segment per performance criterion, grouped by unit: the whole course at a glance. */
  function strip(p) {
    return '<span class="cia-strip" aria-hidden="true">' + ORDER.map(function (id) {
      var u = state.units[id];
      var prog = CiAssessCore.unitProgress(u, state.marks, p.id);
      return '<span class="cia-strip-unit' + (prog.signed ? ' is-passed' : '') + '">' + u.criteria.map(function (c) {
        return '<i class="s-' + CiAssessCore.statusOf(state.marks, p.id, c.code) + '"></i>';
      }).join('') + '</span>';
    }).join('') + '</span>';
  }

  function stripLabel(p) {
    var pp = CiAssessCore.pupilProgress(state.units, ORDER, state.marks, p.id);
    return ORDER.map(function (id) {
      var u = pp.units[id];
      return state.units[id].short + ' ' + (u.signed ? 'passed' : u.achieved + ' of ' + u.total);
    }).join(', ');
  }

  function renderRegister() {
    var list = sortedPupils();
    var rows = list.map(function (p) {
      var pp = CiAssessCore.pupilProgress(state.units, ORDER, state.marks, p.id);
      var sub = [p.class_code, p.team].filter(Boolean).join(' · ');
      return '<tr>' +
        '<th scope="row"><a class="cia-name" href="#pupil/' + esc(p.id) + '" data-pupil="' + esc(p.id) + '">' + esc(p.name) + '</a>' +
        (sub ? '<span class="cia-sub">' + esc(sub) + '</span>' : '') + '</th>' +
        '<td class="cia-strip-cell" title="' + esc(stripLabel(p)) + '">' + strip(p) + '<span class="cia-sr">' + esc(stripLabel(p)) + '</span></td>' +
        '<td class="cia-num">' + pp.met + '<span class="cia-of">/' + pp.total + '</span></td>' +
        '<td class="cia-num">' + (pp.coursePassed ? '<span class="cia-pill is-pass">Passed</span>' : pp.passed + '<span class="cia-of">/4</span>') + '</td>' +
        '</tr>';
    }).join('');
    var heads = ORDER.map(function (id) {
      return '<span style="flex:' + state.units[id].criteria.length + '" title="' + esc(state.units[id].name) + '">' + esc(state.units[id].tag) + '</span>';
    }).join('');
    return '<section class="cia-card cia-register"><header class="cia-card-head"><div><h2>Class register</h2>' +
      '<p>Each mark is one performance criterion. Open a pupil to assess or review their evidence.</p></div>' +
      legend() + '</header>' +
      '<div class="cia-table-wrap"><table class="cia-table"><thead><tr><th scope="col">Pupil</th>' +
      '<th scope="col" class="cia-strip-head"><span class="cia-strip-heads">' + heads + '</span></th>' +
      '<th scope="col" class="cia-num">Criteria</th><th scope="col" class="cia-num">Units</th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table></div></section>';
  }

  function legend() {
    return '<ul class="cia-legend" aria-label="Key">' + ['m', 'r', 'x', 'd', 'n'].map(function (k) {
      return '<li><i class="s-' + k + '"></i>' + esc(S[k].label) + '</li>';
    }).join('') + '</ul>';
  }

  function renderQueue(sum) {
    var items = [];
    sum.ready.slice(0, 5).forEach(function (r) {
      var u = state.units[r.unitId];
      items.push('<li class="cia-q"><div><a class="cia-name" href="#pupil/' + esc(r.pupil.id) + '" data-pupil="' + esc(r.pupil.id) + '">' + esc(r.pupil.name) + '</a>' +
        '<span class="cia-sub">' + esc(u.short) + ' · all evidence confirmed</span></div>' +
        btn('Sign off', 'signoff', 'cia-btn-sm', ' data-pupil-id="' + esc(r.pupil.id) + '" data-unit="' + r.unitId + '"' + writeAttr()) + '</li>');
    });
    sum.toAssess.slice(0, 4).forEach(function (a) {
      var c = criterion(a.code);
      var uid = a.code.split('.')[0];
      items.push('<li class="cia-q"><div><span class="cia-q-title">' + esc(state.units[uid].short) + ' ' + esc(c.label) + ' · ' + plural(a.count, 'pupil') + ' to assess</span>' +
        '<span class="cia-sub cia-clip">' + esc(c.text) + '</span></div>' +
        btn('Mark', 'go-grid', 'cia-btn-sm', ' data-unit="' + uid + '"') + '</li>');
    });
    if (sum.overdue) {
      items.push('<li class="cia-q"><div><span class="cia-q-title is-late">' + plural(sum.overdue, 'follow-up') + ' overdue</span>' +
        '<span class="cia-sub">Missing evidence and pupil conversations</span></div>' + btn('Open', 'go-followups', 'cia-btn-sm') + '</li>');
    }
    var more = sum.ready.length > 5 ? '<p class="cia-more">' + (sum.ready.length - 5) + ' more ready to sign off in Pupils.</p>' : '';
    return '<section class="cia-card"><header class="cia-card-head"><div><h2>Waiting on you</h2></div></header>' +
      (items.length ? '<ul class="cia-queue">' + items.join('') + '</ul>' + more
        : '<p class="cia-quiet">Nothing is waiting. Decisions marked “To assess” and units ready for sign-off appear here.</p>') +
      '</section>';
  }

  function renderUnitBars() {
    var list = state.pupils;
    return '<section class="cia-card"><header class="cia-card-head"><div><h2>Units</h2></div></header><ul class="cia-units">' +
      ORDER.map(function (id) {
        var u = state.units[id];
        var p = CiAssessCore.unitClassProgress(u, list, state.marks);
        var pct = p.total ? Math.round(p.achieved / p.total * 100) : 0;
        return '<li><a href="#grid/' + id + '" data-act="go-grid" data-unit="' + id + '" class="cia-unit-link">' +
          '<span class="cia-unit-name">' + esc(u.short) + ' <span class="cia-sub-inline">' + esc(u.code) + '</span></span>' +
          '<span class="cia-unit-pct">' + pct + '%</span></a>' +
          '<span class="cia-meter"><span style="width:' + pct + '%"></span></span>' +
          '<span class="cia-sub">' + p.signed + ' signed off' + (p.ready ? ' · ' + p.ready + ' ready' : '') + '</span></li>';
      }).join('') + '</ul></section>';
  }

  // --- Marking grid ---------------------------------------------------------

  function filterBar(placeholder) {
    var codes = classCodes();
    var classes = codes.length > 1
      ? '<label class="cia-field-inline"><span class="cia-sr">Class</span><select id="cia-class" class="cia-input cia-input-sm">' +
        '<option value="">All classes</option>' + codes.map(function (c) {
          return '<option' + (c === state.classFilter ? ' selected' : '') + '>' + esc(c) + '</option>';
        }).join('') + '</select></label>'
      : '';
    return classes + '<label class="cia-field-inline"><span class="cia-sr">Search pupils</span>' +
      '<input id="cia-search" class="cia-input cia-input-sm" type="search" placeholder="' + esc(placeholder) + '" value="' + esc(state.search) + '"></label>';
  }

  function renderGrid() {
    var u = state.units[state.unit];
    var list = shownPupils();
    var seg = '<div class="cia-seg" role="tablist" aria-label="Unit">' + ORDER.map(function (id) {
      var on = id === state.unit;
      return '<button type="button" role="tab" class="cia-seg-btn" data-act="unit" data-unit="' + id + '" aria-selected="' + on + '">' +
        esc(state.units[id].short) + '</button>';
    }).join('') + '</div>';
    var toolbar = '<div class="cia-toolbar">' + seg + '<div class="cia-toolbar-end">' + filterBar('Find a pupil') + '</div></div>';

    var head = '<header class="cia-card-head"><div><h2>' + esc(u.name) + ' <span class="cia-sub-inline">' + esc(u.code) + '</span></h2>' +
      '<p>' + u.criteria.length + ' performance criteria in ' + u.outcomes.length + ' outcomes, then ' + u.checkpoints.length +
      ' evidence checkpoints. Select a cell to record a decision.<span class="cia-keys-hint"> On a keyboard, move with the arrow keys and type 1 to 4.</span></p></div>' +
      '<a class="cia-link" href="' + esc(u.source) + '" target="_blank" rel="noopener">Unit specification</a></header>';

    if (!list.length) {
      return toolbar + '<section class="cia-card">' + head + '<div class="cia-empty-inner"><p>' +
        (state.pupils.length ? 'No pupils match that search.' : 'Add your class list to begin marking.') + '</p>' +
        (state.pupils.length ? '' : btn('Add pupils', 'add-pupils', 'cia-btn-primary', writeAttr())) + '</div></section>';
    }

    var groupRow = '<tr><th scope="col" class="cia-fix" rowspan="2">Pupil</th>' + u.outcomes.map(function (o, i) {
      return '<th scope="colgroup" colspan="' + o.pc.length + '" class="cia-grp" title="' + esc(o.name) + '">Outcome ' + (i + 1) + '</th>';
    }).join('') + '<th scope="colgroup" colspan="' + u.checkpoints.length + '" class="cia-grp cia-grp-check">Evidence checkpoints</th>' +
      '<th scope="col" rowspan="2" class="cia-num">Criteria</th><th scope="col" rowspan="2">Unit</th></tr>';
    var labelRow = '<tr>' + u.criteria.map(function (c, i) {
      var first = i === 0 || u.criteria[i - 1].outcome !== c.outcome;
      return '<th scope="col" class="cia-colhead' + (first ? ' is-first' : '') + '"><button type="button" class="cia-colbtn" data-act="bulk" data-code="' + c.code + '" title="' + esc(c.text) + '"' + writeAttr() + '>' + esc(c.label) + '</button></th>';
    }).join('') + u.checkpoints.map(function (c, i) {
      return '<th scope="col" class="cia-colhead cia-check-head' + (i === 0 ? ' is-first' : '') + '" title="' + esc(c.text) + '">' + esc(c.short) + '</th>';
    }).join('') + '</tr>';

    var body = list.map(function (p, r) {
      var prog = CiAssessCore.unitProgress(u, state.marks, p.id);
      var cells = u.criteria.map(function (c, i) {
        var st = CiAssessCore.statusOf(state.marks, p.id, c.code);
        var first = i === 0 || u.criteria[i - 1].outcome !== c.outcome;
        return '<td' + (first ? ' class="is-first"' : '') + '><button type="button" class="cia-cell s-' + st + '" data-cell="' + r + ':' + i + '" data-pupil-id="' + esc(p.id) + '" data-code="' + c.code + '"' +
          ' aria-label="' + esc(p.name + ', ' + c.label + ', ' + S[st].label) + '">' + glyph(st) + '</button></td>';
      }).join('');
      var base = u.criteria.length;
      var checks = u.checkpoints.map(function (c, i) {
        var done = CiAssessCore.statusOf(state.marks, p.id, c.code) === 'm';
        return '<td' + (i === 0 ? ' class="is-first"' : '') + '><button type="button" class="cia-cell cia-check' + (done ? ' is-done' : '') + '" data-cell="' + r + ':' + (base + i) + '" data-pupil-id="' + esc(p.id) + '" data-code="' + c.code + '"' +
          ' aria-label="' + esc(p.name + ', ' + c.short + ', ' + (done ? 'verified' : 'outstanding')) + '">' + (done ? TICK : '') + '</button></td>';
      }).join('');
      var unitCell = prog.signed ? '<span class="cia-pill is-pass">Passed</span>'
        : prog.ready ? btn('Sign off', 'signoff', 'cia-btn-sm', ' data-pupil-id="' + esc(p.id) + '" data-unit="' + u.id + '"' + writeAttr())
          : '<span class="cia-dash">–</span>';
      var sub = p.team || p.class_code;
      return '<tr><th scope="row" class="cia-fix"><a class="cia-name" href="#pupil/' + esc(p.id) + '" data-pupil="' + esc(p.id) + '">' + esc(p.name) + '</a>' +
        (sub ? '<span class="cia-sub">' + esc(sub) + '</span>' : '') + '</th>' + cells + checks +
        '<td class="cia-num">' + prog.achieved + '<span class="cia-of">/' + prog.total + '</span></td><td class="cia-unit-cell">' + unitCell + '</td></tr>';
    }).join('');

    return toolbar + '<section class="cia-card cia-grid-card">' + head +
      '<div class="cia-grid-scroll"><table class="cia-grid"><thead>' + groupRow + labelRow + '</thead><tbody>' + body + '</tbody></table></div>' +
      '<footer class="cia-card-foot">' + legend() + '<span class="cia-sub">A unit can be signed off once every criterion is achieved and every checkpoint verified.</span></footer></section>';
  }

  // --- Pupils ---------------------------------------------------------------

  function renderPupils() {
    var list = shownPupils();
    var rows = list.map(function (p) {
      var pp = CiAssessCore.pupilProgress(state.units, ORDER, state.marks, p.id);
      var open = state.followups.filter(function (f) { return f.pupil_id === p.id && !f.done_at; }).length;
      return '<tr><th scope="row"><a class="cia-name" href="#pupil/' + esc(p.id) + '" data-pupil="' + esc(p.id) + '">' + esc(p.name) + '</a></th>' +
        '<td>' + (esc([p.class_code, p.team].filter(Boolean).join(' · ')) || '<span class="cia-dash">–</span>') + '</td>' +
        '<td class="cia-progress-cell"><span class="cia-meter cia-meter-thin"><span style="width:' + pp.pct + '%"></span></span></td>' +
        '<td class="cia-num">' + pp.met + '<span class="cia-of">/' + pp.total + '</span></td>' +
        '<td class="cia-num">' + pp.passed + '<span class="cia-of">/4</span></td>' +
        '<td class="cia-num">' + (open || '<span class="cia-dash">–</span>') + '</td>' +
        '<td>' + (pp.coursePassed ? '<span class="cia-pill is-pass">Course passed</span>' : '<span class="cia-pill">Working towards</span>') + '</td></tr>';
    }).join('');
    return '<div class="cia-toolbar"><p class="cia-count-line">' + list.length + ' of ' + plural(state.pupils.length, 'pupil') + '</p>' +
      '<div class="cia-toolbar-end">' + filterBar('Search pupils') + btn('Add pupils', 'add-pupils', 'cia-btn-primary', writeAttr()) + '</div></div>' +
      '<section class="cia-card">' + (list.length
        ? '<div class="cia-table-wrap"><table class="cia-table"><thead><tr><th scope="col">Candidate</th><th scope="col">Class and team</th>' +
          '<th scope="col"><span class="cia-sr">Progress</span></th><th scope="col" class="cia-num">Criteria</th><th scope="col" class="cia-num">Units passed</th>' +
          '<th scope="col" class="cia-num">Follow-ups</th><th scope="col">Course</th></tr></thead><tbody>' + rows + '</tbody></table></div>'
        : '<div class="cia-empty-inner"><p>' + (state.pupils.length ? 'No pupils match that search.' : 'Your class list is empty.') + '</p></div>') +
      '</section>';
  }

  function renderPupil() {
    var p = pupil(state.pupilId);
    if (!p) return renderPupils();
    var pp = CiAssessCore.pupilProgress(state.units, ORDER, state.marks, p.id);
    var meta = [p.class_code || 'No class set', p.team].filter(Boolean).join(' · ');
    var head = '<div class="cia-person-head"><div>' +
      '<a class="cia-back" href="#pupils" data-go="pupils">All pupils</a>' +
      '<h2 class="cia-person-name">' + esc(p.name) + '</h2>' +
      '<p class="cia-sub">' + esc(meta) + ' · ' + pp.met + ' of ' + pp.total + ' criteria · ' + pp.passed + ' of 4 units passed</p></div>' +
      '<div class="cia-row-actions">' + btn('Add follow-up', 'add-followup', '', ' data-pupil-id="' + esc(p.id) + '"' + writeAttr()) +
      btn('Edit details', 'edit-pupil', '', writeAttr()) + btn('Print record', 'print-pupil') + '</div></div>';

    var units = ORDER.map(function (id) {
      var u = state.units[id];
      var prog = pp.units[id];
      var status = prog.signed ? '<span class="cia-pill is-pass">Passed</span>'
        : prog.ready ? '<span class="cia-pill is-ready">Ready to sign off</span>'
          : '<span class="cia-pill">In progress</span>';
      var outcomes = u.outcomes.map(function (o, oi) {
        var rows = u.criteria.filter(function (c) { return c.outcome === oi + 1; }).map(function (c) {
          var m = mark(p.id, c.code);
          var st = (m && m.status) || 'n';
          var ev = m ? [m.evidence_type, m.evidence_ref, m.assessed_on ? shortDate(m.assessed_on) : ''].filter(Boolean).join(' · ') : '';
          return '<li class="cia-crit"><span class="cia-crit-label">' + esc(c.label) + '</span><div class="cia-crit-body"><p>' + esc(c.text) + '</p>' +
            (ev ? '<p class="cia-sub">' + esc(ev) + '</p>' : '') +
            (m && m.note ? '<p class="cia-crit-note">' + esc(m.note) + '</p>' : '') +
            (m && st !== 'n' ? '<p class="cia-sub">Recorded ' + esc(byLine(m)) + '</p>' : '') + '</div>' +
            '<span class="cia-pill s-' + st + '">' + esc(S[st].label) + '</span>' +
            btn('Assess', 'assess', 'cia-btn-sm', ' data-pupil-id="' + esc(p.id) + '" data-code="' + c.code + '"' + writeAttr()) + '</li>';
        }).join('');
        return '<div class="cia-outcome"><h4>Outcome ' + (oi + 1) + ': ' + esc(o.name) + '</h4><ul class="cia-crits">' + rows + '</ul></div>';
      }).join('');
      var checks = u.checkpoints.map(function (c) {
        var m = mark(p.id, c.code);
        var done = m && m.status === 'm';
        return '<li class="cia-crit"><span class="cia-tick' + (done ? ' is-done' : '') + '" aria-hidden="true">' + (done ? TICK : '') + '</span>' +
          '<div class="cia-crit-body"><p>' + esc(c.text) + '</p><p class="cia-sub">' +
          (done ? esc([m.evidence_ref, m.assessed_on ? shortDate(m.assessed_on) : ''].filter(Boolean).join(' · ')) + ' · verified ' + esc(byLine(m)) : 'Not verified yet') + '</p></div>' +
          btn(done ? 'Change' : 'Verify', 'check', 'cia-btn-sm', ' data-pupil-id="' + esc(p.id) + '" data-code="' + c.code + '"' + writeAttr()) + '</li>';
      }).join('');
      var outstanding = (prog.total - prog.achieved) + ' criteria and ' + (prog.checkTotal - prog.checks) + ' checkpoints still to confirm.';
      var decision = prog.signed
        ? '<p>Signed off as a pass on ' + esc(shortDate(prog.signoff.assessed_on)) + ' by ' + esc(prog.signoff.signed_by || 'the assessor') + '.</p>' +
          btn('Withdraw sign-off', 'revoke', 'cia-btn-sm cia-btn-danger', ' data-pupil-id="' + esc(p.id) + '" data-unit="' + id + '"' + writeAttr())
        : prog.ready
          ? '<p>Every criterion is achieved and every checkpoint verified. Record your judgement as assessor.</p>' +
            btn('Sign off unit as a pass', 'signoff', 'cia-btn-primary cia-btn-sm', ' data-pupil-id="' + esc(p.id) + '" data-unit="' + id + '"' + writeAttr())
          : '<p>' + outstanding + '</p>';
      return '<section class="cia-card cia-unit-card"><header class="cia-card-head"><div><h3>' + esc(u.name) + ' <span class="cia-sub-inline">' + esc(u.code) + '</span></h3>' +
        '<p>' + prog.achieved + ' of ' + prog.total + ' criteria achieved · ' + prog.checks + ' of ' + prog.checkTotal + ' checkpoints verified</p></div>' + status + '</header>' +
        outcomes + '<div class="cia-outcome"><h4>Evidence checkpoints</h4><ul class="cia-crits">' + checks + '</ul></div>' +
        '<div class="cia-decision"><h4>Assessor decision</h4>' + decision + '</div></section>';
    }).join('');

    var follow = state.followups.filter(function (f) { return f.pupil_id === p.id && !f.done_at; });
    var notes = '<section class="cia-card"><header class="cia-card-head"><div><h3>Assessor notes</h3>' +
      '<p>Learner conversations, support, assessment arrangements. Saved when you click away.</p></div></header>' +
      '<div class="cia-pad"><label class="cia-sr" for="cia-notes">Assessor notes</label><textarea id="cia-notes" class="cia-input" rows="4" data-pupil-id="' + esc(p.id) + '"' + writeAttr() + '>' + esc(p.notes || '') + '</textarea>' +
      (follow.length ? '<p class="cia-sub">Open follow-ups: ' + follow.map(function (f) { return esc(f.title); }).join('; ') + '</p>' : '') + '</div></section>';

    return head + units + notes;
  }

  // --- Follow-ups -----------------------------------------------------------

  function renderFollowups() {
    var today = todayISO();
    var list = state.followups.filter(function (f) {
      return state.followFilter === 'all' || (state.followFilter === 'open' ? !f.done_at : !!f.done_at);
    }).sort(function (a, b) {
      return (a.done_at ? 1 : 0) - (b.done_at ? 1 : 0) || String(a.due_on || '9999').localeCompare(String(b.due_on || '9999'));
    });
    var seg = '<div class="cia-seg" role="tablist" aria-label="Show">' + [['open', 'Open'], ['done', 'Done'], ['all', 'All']].map(function (f) {
      return '<button type="button" role="tab" class="cia-seg-btn" data-act="follow-filter" data-filter="' + f[0] + '" aria-selected="' + (state.followFilter === f[0]) + '">' + f[1] + '</button>';
    }).join('') + '</div>';
    var rows = list.map(function (f) {
      var p = f.pupil_id ? pupil(f.pupil_id) : null;
      var late = f.due_on && !f.done_at && f.due_on < today;
      return '<li class="cia-follow' + (f.done_at ? ' is-done' : '') + '">' +
        '<button type="button" class="cia-tick-btn' + (f.done_at ? ' is-done' : '') + '" data-act="toggle-follow" data-id="' + esc(f.id) + '" aria-label="' + (f.done_at ? 'Reopen ' : 'Mark done: ') + esc(f.title) + '"' + writeAttr() + '>' + (f.done_at ? TICK : '') + '</button>' +
        '<div class="cia-follow-body"><p class="cia-follow-title">' + esc(f.title) + '</p>' +
        '<p class="cia-sub">' + (p ? '<a class="cia-name" href="#pupil/' + esc(p.id) + '" data-pupil="' + esc(p.id) + '">' + esc(p.name) + '</a>' : 'Whole class') +
        (f.created_by_name ? ' · added by ' + esc(f.created_by_name) : '') + '</p>' +
        (f.note ? '<p class="cia-follow-note">' + esc(f.note) + '</p>' : '') + '</div>' +
        '<span class="cia-follow-due' + (late ? ' is-late' : '') + '">' + (f.due_on ? (late ? 'Overdue, ' : 'Due ') + esc(shortDate(f.due_on)) : '<span class="cia-dash">No date</span>') + '</span>' +
        btn('Delete', 'del-follow', 'cia-btn-sm cia-btn-quiet', ' data-id="' + esc(f.id) + '"' + writeAttr()) + '</li>';
    }).join('');
    return '<div class="cia-toolbar">' + seg + '<div class="cia-toolbar-end">' + btn('New follow-up', 'add-followup', 'cia-btn-primary', writeAttr()) + '</div></div>' +
      '<section class="cia-card">' + (rows ? '<ul class="cia-follows">' + rows + '</ul>'
        : '<div class="cia-empty-inner"><p>' + (state.followFilter === 'open' ? 'No open follow-ups. Use them for missing evidence, reassessments and pupil conversations.' : 'Nothing here.') + '</p></div>') +
      '</section>';
  }

  // --- Settings and data ----------------------------------------------------

  function renderSettings() {
    var mode = CiAssessService.mode();
    var where = mode === 'cloud'
      ? 'Saved to the Faculty Hub. Every change shows on any device you sign in on, and colleagues see it live. Each decision records who made it and when.'
      : 'Saved in this browser only. Run migration #26 in DEPLOYMENT.md (supabase/migrations/20261031150000_ci_assessment.sql) to share it across devices.';
    var imp = state.pendingImport;
    var importBox = imp
      ? '<div class="cia-import-preview"><p>This backup holds <strong>' + plural(imp.pupils.length, 'pupil') + '</strong>, ' + plural(imp.marks.length, 'recorded decision') +
        ' and ' + plural(imp.followups.length, 'follow-up') + '. They will be added alongside the pupils already here.</p>' +
        '<div class="cia-row-actions">' + btn('Add them to the tracker', 'confirm-import', 'cia-btn-primary', writeAttr()) + btn('Cancel', 'cancel-import') + '</div></div>'
      : '<label class="cia-field"><span>Assessment Studio backup (.json)</span><input type="file" id="cia-import" accept=".json,application/json"' + writeAttr() + '>' +
        '<small>From the offline app, use Settings and backup, then Download JSON backup.</small></label>';
    return '<div class="cia-settings">' +
      '<section class="cia-card"><header class="cia-card-head"><div><h2>Course</h2><p>Choose the Introduction unit your pupils are entered for.</p></div></header><div class="cia-pad">' +
      '<label class="cia-field"><span>Introduction unit</span><select id="cia-intro" class="cia-input"' + writeAttr() + '>' +
      '<option value="UK"' + (state.settings.intro_variant !== 'SCOT' ? ' selected' : '') + '>J17V 75 · An Introduction (UK)</option>' +
      '<option value="SCOT"' + (state.settings.intro_variant === 'SCOT' ? ' selected' : '') + '>H6MV 75 · An Introduction – Scotland</option></select>' +
      '<small>The two have separate unit codes. Check the centre’s entries before signing off.</small></label>' +
      '<p class="cia-links">' + ORDER.map(function (id) {
        return '<a class="cia-link" href="' + esc(state.units[id].source) + '" target="_blank" rel="noopener">' + esc(state.units[id].code) + ' specification</a>';
      }).join('') + '</p></div></section>' +
      '<section class="cia-card"><header class="cia-card-head"><div><h2>Where this is saved</h2></div></header><div class="cia-pad"><p>' + esc(where) + '</p>' +
      '<p class="cia-sub">Session ' + YEAR_LABEL + ' · ' + plural(state.pupils.length, 'pupil') + ' · ' + plural(Object.keys(state.marks).length, 'recorded decision') + '</p></div></section>' +
      '<section class="cia-card"><header class="cia-card-head"><div><h2>Bring in the offline Assessment Studio</h2><p>Move pupils and decisions from the single-file app into this tracker.</p></div></header><div class="cia-pad">' + importBox + '</div></section>' +
      '<section class="cia-card"><header class="cia-card-head"><div><h2>Exports</h2><p>Spreadsheets for verification and reporting. They contain pupil names, so keep them in school storage.</p></div></header><div class="cia-pad cia-row-actions">' +
      btn('Class summary (CSV)', 'export-summary') + btn('Evidence register (CSV)', 'export-evidence') + btn('Add pupils', 'add-pupils', '', writeAttr()) + '</div></section>' +
      '</div>';
  }

  // ---------------------------------------------------------------------------
  // The marking popover (a bottom sheet on a phone)
  // ---------------------------------------------------------------------------

  function openPop(pupilId, code, anchor) {
    if (!canWrite()) return;
    var p = pupil(pupilId);
    var isCheck = code.indexOf('.check.') !== -1;
    var item = isCheck ? checkpoint(code) : criterion(code);
    if (!p || !item) return;
    var m = mark(pupilId, code) || {};
    var hint = !m.evidence_ref ? lastRef(code) : null;
    var u = state.units[code.split('.')[0]];
    state.pop = { pupilId: pupilId, code: code, anchor: anchor, isCheck: isCheck, status: isCheck ? (m.status === 'm' ? 'm' : 'n') : (m.status || 'n') };

    var statuses = isCheck
      ? [['m', 'Verified'], ['n', 'Outstanding']]
      : CiAssessCore.STATUS_ORDER.map(function (k) { return [k, S[k].label]; });
    var types = CI_ASSESS_UNITS.EVIDENCE_TYPES;
    var selType = m.evidence_type || (hint && hint.type) || '';
    els.pop.innerHTML =
      '<div class="cia-pop-head"><div><p class="cia-sub">' + esc(p.name) + ' · ' + esc(u.short) + ' ' + esc(isCheck ? 'checkpoint' : item.label) + '</p>' +
      '<p class="cia-pop-title">' + esc(item.text) + '</p></div>' +
      '<button type="button" class="cia-x" data-act="close-pop" aria-label="Close">×</button></div>' +
      '<div class="cia-pop-status" role="radiogroup" aria-label="Decision">' + statuses.map(function (s) {
        return '<button type="button" role="radio" class="cia-status s-' + s[0] + '" data-act="pop-status" data-status="' + s[0] + '" aria-checked="' + (state.pop.status === s[0]) + '">' +
          (isCheck ? '' : '<span class="cia-status-glyph" aria-hidden="true">' + (s[0] === 'n' ? '\u00b7' : glyph(s[0])) + '</span>') + esc(s[1]) + '</button>';
      }).join('') + '</div>' +
      '<div class="cia-pop-fields">' +
      (isCheck ? '' : '<label class="cia-field"><span>Evidence type</span><select id="cia-pop-type" class="cia-input">' +
        '<option value="">Choose…</option>' + types.map(function (t) {
          return '<option' + (t === selType ? ' selected' : '') + '>' + esc(t) + '</option>';
        }).join('') + '</select></label>') +
      '<label class="cia-field"><span>Date</span><input id="cia-pop-date" class="cia-input" type="date" value="' + esc(m.assessed_on || todayISO()) + '"></label>' +
      '<label class="cia-field cia-field-wide"><span>Where the evidence is</span><input id="cia-pop-ref" class="cia-input" value="' + esc(m.evidence_ref || (hint ? hint.ref : '')) + '" placeholder="OneNote, Unit 3, Viral pitch">' +
      (hint ? '<small>Filled in from the last pupil you marked against this.</small>' : '') + '</label>' +
      (isCheck ? '' : '<label class="cia-field cia-field-wide"><span>What you saw</span><textarea id="cia-pop-note" class="cia-input" rows="2" placeholder="What did the pupil show? What needs improving?">' + esc(m.note || '') + '</textarea></label>') +
      '</div><p class="cia-pop-error" id="cia-pop-error" role="alert" hidden></p>' +
      '<div class="cia-pop-foot">' + (m.updated_at ? '<span class="cia-sub">Last recorded ' + esc(byLine(m)) + '</span>' : '<span></span>') +
      '<div class="cia-row-actions">' + (state.view === 'grid' ? btn('Save and next pupil', 'pop-save-next') : '') + btn('Save', 'pop-save', 'cia-btn-primary') + '</div></div>';
    els.pop.hidden = false;
    placePop();
    var first = $('.cia-status[aria-checked="true"]', els.pop) || $('.cia-status', els.pop);
    if (first) first.focus();
  }

  function placePop() {
    var pop = els.pop;
    var a = state.pop && state.pop.anchor;
    pop.classList.remove('is-sheet');
    if (window.innerWidth < 640 || !a || !document.body.contains(a)) {
      pop.classList.add('is-sheet');
      pop.style.left = '';
      pop.style.top = '';
      return;
    }
    var r = a.getBoundingClientRect();
    var w = pop.offsetWidth;
    var h = pop.offsetHeight;
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var left = Math.min(Math.max(12, r.left + r.width / 2 - w / 2), vw - w - 12);
    var top;
    if (r.bottom + 8 + h <= vh - 12) top = r.bottom + 8;
    else if (r.top - 8 - h >= 12) top = r.top - h - 8;
    else {
      // No room above or below: sit beside the cell so it stays visible.
      top = Math.min(Math.max(12, r.top + r.height / 2 - h / 2), Math.max(12, vh - h - 12));
      left = r.right + 10 + w <= vw - 12 ? r.right + 10 : Math.max(12, r.left - w - 10);
    }
    pop.style.left = left + window.scrollX + 'px';
    pop.style.top = top + window.scrollY + 'px';
  }

  function closePop(refocus) {
    if (!state.pop) return;
    var pop = state.pop;
    state.pop = null;
    els.pop.hidden = true;
    els.pop.innerHTML = '';
    if (refocus) {
      var cell = $('.cia-cell[data-pupil-id="' + pop.pupilId + '"][data-code="' + pop.code + '"]');
      if (cell) cell.focus();
    }
  }

  function savePop(next) {
    var pop = state.pop;
    if (!pop) return;
    var ref = ($('#cia-pop-ref') || {}).value || '';
    var note = ($('#cia-pop-note') || {}).value || '';
    var type = ($('#cia-pop-type') || {}).value || '';
    var date = ($('#cia-pop-date') || {}).value || todayISO();
    var problem = pop.isCheck
      ? (pop.status === 'm' && !ref.trim() ? 'Add where the evidence or assessor record is before verifying.' : '')
      : CiAssessCore.markProblem(pop.status, ref, note);
    if (problem) {
      var e = $('#cia-pop-error');
      e.textContent = problem;
      e.hidden = false;
      $('#cia-pop-ref').focus();
      return;
    }
    var nextCell = null;
    if (next) {
      var cell = $('.cia-cell[data-pupil-id="' + pop.pupilId + '"][data-code="' + pop.code + '"]');
      var at = cell ? cell.getAttribute('data-cell').split(':') : null;
      if (at) nextCell = (Number(at[0]) + 1) + ':' + at[1];
    }
    closePop();
    if (pop.status === 'n' && !ref.trim() && !note.trim()) {
      clearMark(pop.pupilId, pop.code);
    } else {
      saveMarks([{
        pupil_id: pop.pupilId, code: pop.code, kind: pop.isCheck ? 'check' : 'pc', status: pop.status,
        evidence_type: type, evidence_ref: ref.trim(), note: note.trim(), assessed_on: date
      }]);
    }
    var target = nextCell && $('[data-cell="' + nextCell + '"]');
    if (target) {
      target.focus();
      openPop(target.getAttribute('data-pupil-id'), target.getAttribute('data-code'), target);
    } else {
      var back = $('.cia-cell[data-pupil-id="' + pop.pupilId + '"][data-code="' + pop.code + '"]');
      if (back) back.focus();
    }
  }

  /** Typing 1 to 4 on a focused grid cell records the decision straight away. */
  function quickMark(cell, status) {
    if (!canWrite()) return;
    var pupilId = cell.getAttribute('data-pupil-id');
    var code = cell.getAttribute('data-code');
    var isCheck = code.indexOf('.check.') !== -1;
    var m = mark(pupilId, code) || {};
    if (isCheck) {
      if (status === 'n') return clearMark(pupilId, code);
      if (!m.evidence_ref) return openPop(pupilId, code, cell);
      return saveMarks([{ pupil_id: pupilId, code: code, kind: 'check', status: 'm', evidence_ref: m.evidence_ref, assessed_on: todayISO() }]);
    }
    if (status === 'n') return clearMark(pupilId, code);
    var ref = m.evidence_ref || '';
    var type = m.evidence_type || '';
    if (status === 'm' && !ref && !m.note) {
      var hint = lastRef(code);
      if (!hint) {
        openPop(pupilId, code, cell);
        state.pop.status = 'm';
        Array.prototype.forEach.call(els.pop.querySelectorAll('.cia-status'), function (b) {
          b.setAttribute('aria-checked', String(b.getAttribute('data-status') === 'm'));
        });
        return;
      }
      ref = hint.ref;
      type = type || hint.type;
    }
    saveMarks([{
      pupil_id: pupilId, code: code, kind: 'pc', status: status,
      evidence_type: type, evidence_ref: ref, note: m.note || '', assessed_on: m.assessed_on || todayISO()
    }]);
  }

  // ---------------------------------------------------------------------------
  // Dialogs
  // ---------------------------------------------------------------------------

  function openDialog(title, body, foot, onOpen) {
    var d = els.dialog;
    d.innerHTML = '<form method="dialog" class="cia-dialog-form" novalidate><header class="cia-dialog-head"><h2>' + esc(title) + '</h2>' +
      '<button type="button" class="cia-x" data-act="close-dialog" aria-label="Close">×</button></header>' +
      '<div class="cia-dialog-body">' + body + '<p class="cia-pop-error" id="cia-dialog-error" role="alert" hidden></p></div>' +
      '<footer class="cia-dialog-foot">' + foot + '</footer></form>';
    // Enter in a field means the dialog's main action, never "close without saving".
    d.querySelector('form').addEventListener('submit', function (e) {
      e.preventDefault();
      var primary = d.querySelector('.cia-dialog-foot .cia-btn-primary, .cia-dialog-foot .cia-btn-solid');
      if (primary) primary.click();
    });
    if (typeof d.showModal === 'function') d.showModal();
    else d.setAttribute('open', '');
    if (onOpen) onOpen(d);
  }

  function closeDialog() {
    var d = els.dialog;
    if (d.open && typeof d.close === 'function') d.close();
    d.removeAttribute('open');
    d.innerHTML = '';
  }

  function dialogError(msg) {
    var e = $('#cia-dialog-error');
    if (!e) return;
    e.textContent = msg;
    e.hidden = !msg;
  }

  function addPupilsDialog() {
    openDialog('Add pupils',
      '<label class="cia-field"><span>Paste your class list</span><textarea id="cia-list" class="cia-input" rows="9" placeholder="Ava Brown, 5ciC, Team A&#10;Ben Cole, 5ciC, Team B"></textarea>' +
      '<small>One pupil per line. Class and project team are optional, separated by commas or tabs. A header row is skipped, and so is anyone already in the class.</small></label>',
      btn('Cancel', 'close-dialog') + btn('Add pupils', 'confirm-add', 'cia-btn-primary'),
      function () { $('#cia-list').focus(); });
  }

  function confirmAdd() {
    var parsed = CiAssessCore.parseClassList($('#cia-list').value, state.pupils);
    if (!parsed.rows.length) {
      dialogError(parsed.skipped ? 'Everyone on that list is already in the tracker.' : 'Paste at least one name.');
      return;
    }
    var rows = parsed.rows.map(function (r) {
      return { id: CiAssessService.uid(), school_year: YEAR, name: r.name, class_code: r.class_code, team: r.team, notes: '' };
    });
    state.pupils = state.pupils.concat(rows);
    closeDialog();
    say(plural(rows.length, 'pupil') + ' added' + (parsed.skipped ? ', ' + parsed.skipped + ' already here' : '') + '.');
    render();
    after(CiAssessService.upsertPupils(rows));
  }

  function editPupilDialog() {
    var p = pupil(state.pupilId);
    if (!p) return;
    openDialog('Edit pupil',
      '<div class="cia-form-grid"><label class="cia-field cia-field-wide"><span>Name</span><input id="cia-p-name" class="cia-input" value="' + esc(p.name) + '" maxlength="140"></label>' +
      '<label class="cia-field"><span>Class</span><input id="cia-p-class" class="cia-input" value="' + esc(p.class_code) + '" maxlength="70"></label>' +
      '<label class="cia-field"><span>Project team</span><input id="cia-p-team" class="cia-input" value="' + esc(p.team) + '" maxlength="70"></label></div>',
      '<span class="cia-foot-start">' + btn('Remove pupil', 'delete-pupil', 'cia-btn-danger') + '</span>' + btn('Cancel', 'close-dialog') + btn('Save', 'save-pupil', 'cia-btn-primary'));
  }

  function savePupil() {
    var p = pupil(state.pupilId);
    var name = $('#cia-p-name').value.trim();
    if (!name) { dialogError('Enter a name.'); return; }
    p.name = name;
    p.class_code = $('#cia-p-class').value.trim();
    p.team = $('#cia-p-team').value.trim();
    closeDialog();
    render();
    after(CiAssessService.upsertPupils([pupilRow(p)]));
  }

  function pupilRow(p) {
    return { id: p.id, school_year: YEAR, name: p.name, class_code: p.class_code || '', team: p.team || '', notes: p.notes || '' };
  }

  function deletePupil() {
    var p = pupil(state.pupilId);
    if (!p) return;
    var count = Object.keys(state.marks).filter(function (k) { return k.indexOf(p.id + '|') === 0; }).length;
    openDialog('Remove ' + p.name + '?',
      '<p>This removes ' + esc(p.name) + ' and ' + plural(count, 'recorded decision') + ' for everyone, on every device. It cannot be undone.</p>' +
      '<p class="cia-sub">Export the evidence register first if you need a record.</p>',
      btn('Keep pupil', 'close-dialog') + btn('Remove pupil', 'confirm-delete-pupil', 'cia-btn-danger cia-btn-solid'));
  }

  function confirmDeletePupil() {
    var id = state.pupilId;
    state.pupils = state.pupils.filter(function (p) { return p.id !== id; });
    Object.keys(state.marks).forEach(function (k) { if (k.indexOf(id + '|') === 0) delete state.marks[k]; });
    state.followups = state.followups.filter(function (f) { return f.pupil_id !== id; });
    closeDialog();
    go('pupils');
    after(CiAssessService.deletePupil(id));
  }

  function signoffDialog(pupilId, unitId) {
    var p = pupil(pupilId);
    var u = state.units[unitId];
    if (!p || !CiAssessCore.unitProgress(u, state.marks, pupilId).ready) return;
    openDialog('Sign off ' + u.short,
      '<p>You are confirming that <strong>' + esc(p.name) + '</strong> has met every assessment requirement for <strong>' + esc(u.name) + '</strong> (' + esc(u.code) + ').</p>' +
      '<p class="cia-sub">Check the folio, observation checklists, authenticity and verification arrangements before you confirm.</p>' +
      '<div class="cia-form-grid"><label class="cia-field"><span>Assessor</span><input id="cia-so-by" class="cia-input" value="' + esc(CiAssessService.me().name || '') + '" maxlength="120"></label>' +
      '<label class="cia-field"><span>Date</span><input id="cia-so-date" class="cia-input" type="date" value="' + todayISO() + '"></label></div>',
      btn('Cancel', 'close-dialog') + btn('Confirm pass', 'confirm-signoff', 'cia-btn-primary', ' data-pupil-id="' + esc(pupilId) + '" data-unit="' + unitId + '"'));
  }

  function confirmSignoff(pupilId, unitId) {
    var by = $('#cia-so-by').value.trim();
    if (!by) { dialogError('Enter the assessor’s name.'); return; }
    var date = $('#cia-so-date').value || todayISO();
    closeDialog();
    saveMarks([{ pupil_id: pupilId, code: unitId + '.signoff', kind: 'signoff', status: 'm', signed_by: by, assessed_on: date }]);
    say((pupil(pupilId) || {}).name + ' passed ' + state.units[unitId].short + '.');
  }

  function revokeDialog(pupilId, unitId) {
    var p = pupil(pupilId);
    openDialog('Withdraw sign-off?',
      '<p>This withdraws ' + esc(p.name) + '’s pass for ' + esc(state.units[unitId].name) + '. The evidence stays recorded.</p>',
      btn('Keep sign-off', 'close-dialog') + btn('Withdraw', 'confirm-revoke', 'cia-btn-danger cia-btn-solid', ' data-pupil-id="' + esc(pupilId) + '" data-unit="' + unitId + '"'));
  }

  function followupDialog(pupilId) {
    var options = sortedPupils().map(function (p) {
      return '<option value="' + esc(p.id) + '"' + (p.id === pupilId ? ' selected' : '') + '>' + esc(p.name) + '</option>';
    }).join('');
    openDialog('New follow-up',
      '<div class="cia-form-grid"><label class="cia-field cia-field-wide"><span>What needs done?</span><input id="cia-f-title" class="cia-input" maxlength="200" placeholder="Finish the audience-feedback evaluation"></label>' +
      '<label class="cia-field"><span>Pupil</span><select id="cia-f-pupil" class="cia-input"><option value="">Whole class</option>' + options + '</select></label>' +
      '<label class="cia-field"><span>Due</span><input id="cia-f-due" class="cia-input" type="date"></label>' +
      '<label class="cia-field cia-field-wide"><span>Notes</span><textarea id="cia-f-note" class="cia-input" rows="3" maxlength="2000"></textarea></label></div>',
      btn('Cancel', 'close-dialog') + btn('Add follow-up', 'save-followup', 'cia-btn-primary'),
      function () { $('#cia-f-title').focus(); });
  }

  function saveFollowup() {
    var title = $('#cia-f-title').value.trim();
    if (!title) { dialogError('Say what needs done.'); return; }
    var row = {
      id: CiAssessService.uid(),
      school_year: YEAR,
      pupil_id: $('#cia-f-pupil').value || null,
      title: title,
      note: $('#cia-f-note').value.trim(),
      due_on: $('#cia-f-due').value || null,
      done_at: null
    };
    state.followups.push(Object.assign({ created_by_name: CiAssessService.me().name, created_at: new Date().toISOString() }, row));
    closeDialog();
    render();
    after(CiAssessService.upsertFollowup(row));
  }

  function followupRow(f) {
    return { id: f.id, school_year: YEAR, pupil_id: f.pupil_id || null, title: f.title, note: f.note || '', due_on: f.due_on || null, done_at: f.done_at || null };
  }

  /** Set one criterion for every pupil on screen, for whole-class evidence. */
  function bulkDialog(code) {
    var c = criterion(code);
    var list = shownPupils();
    var hint = lastRef(code);
    openDialog(state.units[code.split('.')[0]].short + ' ' + c.label + ' for the class',
      '<p>' + esc(c.text) + '</p>' +
      '<div class="cia-form-grid"><label class="cia-field"><span>Decision</span><select id="cia-b-status" class="cia-input">' +
      ['m', 'r', 'd', 'x'].map(function (k) { return '<option value="' + k + '">' + esc(S[k].label) + '</option>'; }).join('') + '</select></label>' +
      '<label class="cia-field"><span>Evidence type</span><select id="cia-b-type" class="cia-input"><option value="">Choose…</option>' +
      CI_ASSESS_UNITS.EVIDENCE_TYPES.map(function (t) { return '<option' + (hint && hint.type === t ? ' selected' : '') + '>' + esc(t) + '</option>'; }).join('') + '</select></label>' +
      '<label class="cia-field cia-field-wide"><span>Where the evidence is</span><input id="cia-b-ref" class="cia-input" value="' + esc(hint ? hint.ref : '') + '"></label>' +
      '<label class="cia-check-label cia-field-wide"><input type="checkbox" id="cia-b-only" checked> Only pupils not assessed yet on ' + esc(c.label) + '</label></div>' +
      '<p class="cia-sub">Applies to the ' + plural(list.length, 'pupil') + ' shown in the grid.</p>',
      btn('Cancel', 'close-dialog') + btn('Apply', 'confirm-bulk', 'cia-btn-primary', ' data-code="' + code + '"'));
  }

  function confirmBulk(code) {
    var status = $('#cia-b-status').value;
    var ref = $('#cia-b-ref').value.trim();
    var type = $('#cia-b-type').value;
    var only = $('#cia-b-only').checked;
    var problem = CiAssessCore.markProblem(status, ref, '');
    if (problem) { dialogError(problem); return; }
    var rows = shownPupils().filter(function (p) {
      return !only || CiAssessCore.statusOf(state.marks, p.id, code) === 'n';
    }).map(function (p) {
      var m = mark(p.id, code) || {};
      return { pupil_id: p.id, code: code, kind: 'pc', status: status, evidence_type: type, evidence_ref: ref, note: m.note || '', assessed_on: todayISO() };
    });
    closeDialog();
    if (!rows.length) { say('Everyone shown already has a decision on that criterion.'); return; }
    saveMarks(rows);
    say(criterion(code).label + ' recorded for ' + plural(rows.length, 'pupil') + '.');
  }

  // ---------------------------------------------------------------------------
  // Import, export, print
  // ---------------------------------------------------------------------------

  function readImport(file) {
    if (!file) return;
    file.text().then(function (txt) {
      var data;
      try { data = JSON.parse(txt); } catch (e) { throw new Error('That file is not valid JSON.'); }
      state.pendingImport = CiAssessCore.fromOfflineBackup(data, YEAR, CiAssessService.uid);
      render();
    }).catch(function (err) { say(err.message); });
  }

  function confirmImport() {
    var imp = state.pendingImport;
    if (!imp) return;
    state.pendingImport = null;
    var wasEmpty = !state.pupils.length;
    state.pupils = state.pupils.concat(imp.pupils);
    imp.followups.forEach(function (f) { state.followups.push(Object.assign({ created_by_name: CiAssessService.me().name }, f)); });
    imp.marks.forEach(function (m) { state.marks[CiAssessCore.markKey(m.pupil_id, m.code)] = stamp(Object.assign({}, m)); });
    var work = CiAssessService.upsertPupils(imp.pupils).then(function () {
      return imp.marks.length ? CiAssessService.upsertMarks(imp.marks) : null;
    }).then(function () {
      return Promise.all(imp.followups.map(function (f) { return CiAssessService.upsertFollowup(f); }));
    });
    if (imp.intro_variant !== state.settings.intro_variant && wasEmpty) {
      setIntro(imp.intro_variant);
    }
    say(plural(imp.pupils.length, 'pupil') + ' and ' + plural(imp.marks.length, 'decision') + ' brought in.');
    render();
    after(work);
  }

  function setIntro(variant) {
    state.settings = { school_year: YEAR, intro_variant: variant };
    state.units = CI_ASSESS_UNITS.forVariant(variant);
    render();
    after(CiAssessService.saveSettings({ school_year: YEAR, intro_variant: variant }));
  }

  function download(text, name) {
    var blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
  }

  function exportSummary() {
    var head = ['Pupil', 'Class', 'Team', 'Criteria achieved', 'Criteria total'];
    ORDER.forEach(function (id) {
      var s = state.units[id].short;
      head.push(s + ' criteria', s + ' checkpoints', s + ' decision');
    });
    head.push('Course result');
    var rows = sortedPupils().map(function (p) {
      var pp = CiAssessCore.pupilProgress(state.units, ORDER, state.marks, p.id);
      var row = [p.name, p.class_code, p.team, pp.met, pp.total];
      ORDER.forEach(function (id) {
        var u = pp.units[id];
        row.push(u.achieved + '/' + u.total, u.checks + '/' + u.checkTotal, u.signed ? 'Pass' : u.ready ? 'Ready to sign off' : 'Working towards');
      });
      row.push(pp.coursePassed ? 'Pass' : 'Working towards');
      return row;
    });
    download(CiAssessCore.makeCsv([head].concat(rows)), 'CI_Class_Summary_' + todayISO() + '.csv');
  }

  function exportEvidence() {
    var head = ['Pupil', 'Class', 'Team', 'Unit code', 'Unit', 'Outcome', 'Criterion', 'Performance criterion', 'Decision', 'Evidence type', 'Evidence location', 'Assessor note', 'Assessed on', 'Recorded by', 'Recorded at'];
    var rows = [];
    sortedPupils().forEach(function (p) {
      ORDER.forEach(function (id) {
        var u = state.units[id];
        u.criteria.forEach(function (c) {
          var m = mark(p.id, c.code) || {};
          rows.push([p.name, p.class_code, p.team, u.code, u.name, c.outcome, c.label, c.text, S[m.status || 'n'].label,
            m.evidence_type || '', m.evidence_ref || '', m.note || '', m.assessed_on || '', m.updated_by_name || '', m.updated_at || '']);
        });
      });
    });
    download(CiAssessCore.makeCsv([head].concat(rows)), 'CI_Evidence_Register_' + todayISO() + '.csv');
  }

  function printPupil() {
    var p = pupil(state.pupilId);
    if (!p) return;
    $('#cia-print').innerHTML = ORDER.map(function (id) {
      var u = state.units[id];
      var prog = CiAssessCore.unitProgress(u, state.marks, p.id);
      return '<section class="cia-print-page"><h1>Creative Industries assessment record</h1>' +
        '<p><strong>' + esc(p.name) + '</strong> · ' + esc(p.class_code) + ' · Session ' + YEAR_LABEL + ' · ' + esc(u.name) + ' (' + esc(u.code) + ')</p>' +
        '<table><thead><tr><th>PC</th><th>Performance criterion</th><th>Decision</th><th>Evidence and comments</th></tr></thead><tbody>' +
        u.criteria.map(function (c) {
          var m = mark(p.id, c.code) || {};
          return '<tr><td>' + esc(c.label) + '</td><td>' + esc(c.text) + '</td><td>' + esc(S[m.status || 'n'].label) + '</td><td>' +
            esc([m.evidence_ref, m.note, m.assessed_on].filter(Boolean).join(' / ')) + '</td></tr>';
        }).join('') + '</tbody></table><h2>Evidence checkpoints</h2><table><tbody>' +
        u.checkpoints.map(function (c) {
          var m = mark(p.id, c.code) || {};
          return '<tr><td>' + (m.status === 'm' ? 'Verified' : 'Outstanding') + '</td><td>' + esc(c.text) + '</td><td>' + esc(m.evidence_ref || '') + '</td></tr>';
        }).join('') + '</tbody></table>' +
        '<p>Unit result: ' + (prog.signed ? 'Pass, signed off ' + esc(prog.signoff.assessed_on) + ' by ' + esc(prog.signoff.signed_by) : 'Not signed off') +
        '. Assessor signature: ____________________</p></section>';
    }).join('');
    window.print();
  }

  // ---------------------------------------------------------------------------
  // Events
  // ---------------------------------------------------------------------------

  function onClick(e) {
    var t = e.target.closest('[data-act],[data-go],[data-pupil],.cia-cell');
    if (!t) {
      if (state.pop && !e.target.closest('#cia-pop')) closePop();
      return;
    }
    if (t.classList.contains('cia-cell')) {
      openPop(t.getAttribute('data-pupil-id'), t.getAttribute('data-code'), t);
      return;
    }
    if (t.hasAttribute('data-go')) { e.preventDefault(); go(t.getAttribute('data-go')); return; }
    if (t.hasAttribute('data-pupil') && !t.hasAttribute('data-act')) { e.preventDefault(); go('pupil', t.getAttribute('data-pupil')); return; }

    var act = t.getAttribute('data-act');
    var pid = t.getAttribute('data-pupil-id');
    var unit = t.getAttribute('data-unit');
    var code = t.getAttribute('data-code');
    if (act !== 'close-pop' && act.indexOf('pop-') !== 0 && state.pop) closePop();
    switch (act) {
      case 'reload': window.location.reload(); break;
      case 'add-pupils': addPupilsDialog(); break;
      case 'confirm-add': confirmAdd(); break;
      case 'go-settings': go('settings'); break;
      case 'go-followups': go('followups'); break;
      case 'go-grid': e.preventDefault(); go('grid', unit); break;
      case 'unit': state.unit = unit; go('grid', unit); break;
      case 'assess': openPop(pid, code, t); break;
      case 'check': openPop(pid, code, t); break;
      case 'bulk': bulkDialog(code); break;
      case 'confirm-bulk': confirmBulk(code); break;
      case 'close-pop': closePop(true); break;
      case 'pop-status':
        state.pop.status = t.getAttribute('data-status');
        Array.prototype.forEach.call(els.pop.querySelectorAll('.cia-status'), function (b) {
          b.setAttribute('aria-checked', String(b === t));
        });
        break;
      case 'pop-save': savePop(false); break;
      case 'pop-save-next': savePop(true); break;
      case 'close-dialog': closeDialog(); break;
      case 'signoff': signoffDialog(pid, unit); break;
      case 'confirm-signoff': confirmSignoff(pid, unit); break;
      case 'revoke': revokeDialog(pid, unit); break;
      case 'confirm-revoke': closeDialog(); clearMark(pid, unit + '.signoff'); break;
      case 'edit-pupil': editPupilDialog(); break;
      case 'save-pupil': savePupil(); break;
      case 'delete-pupil': deletePupil(); break;
      case 'confirm-delete-pupil': confirmDeletePupil(); break;
      case 'add-followup': followupDialog(pid || null); break;
      case 'save-followup': saveFollowup(); break;
      case 'follow-filter': state.followFilter = t.getAttribute('data-filter'); render(); break;
      case 'toggle-follow': toggleFollow(t.getAttribute('data-id')); break;
      case 'del-follow': deleteFollow(t.getAttribute('data-id')); break;
      case 'confirm-import': confirmImport(); break;
      case 'cancel-import': state.pendingImport = null; render(); break;
      case 'export-summary': exportSummary(); break;
      case 'export-evidence': exportEvidence(); break;
      case 'print-pupil': printPupil(); break;
    }
  }

  function toggleFollow(id) {
    var f = state.followups.filter(function (x) { return x.id === id; })[0];
    if (!f) return;
    f.done_at = f.done_at ? null : new Date().toISOString();
    render();
    after(CiAssessService.upsertFollowup(followupRow(f)));
  }

  function deleteFollow(id) {
    var f = state.followups.filter(function (x) { return x.id === id; })[0];
    if (!f) return;
    state.followups = state.followups.filter(function (x) { return x.id !== id; });
    render();
    say('Follow-up deleted: ' + f.title);
    after(CiAssessService.deleteFollowup(id));
  }

  function onInput(e) {
    if (e.target.id === 'cia-search') { state.search = e.target.value; render(); }
  }

  function onChange(e) {
    var id = e.target.id;
    if (id === 'cia-class') { state.classFilter = e.target.value; render(); }
    else if (id === 'cia-intro') setIntro(e.target.value === 'SCOT' ? 'SCOT' : 'UK');
    else if (id === 'cia-import') readImport(e.target.files && e.target.files[0]);
    else if (id === 'cia-notes') {
      var p = pupil(e.target.getAttribute('data-pupil-id'));
      if (!p || p.notes === e.target.value) return;
      p.notes = e.target.value;
      say('Notes saved.');
      after(CiAssessService.upsertPupils([pupilRow(p)]));
    }
  }

  function onKey(e) {
    if (e.key === 'Escape' && state.pop) { e.preventDefault(); closePop(true); return; }
    if (state.pop && e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); savePop(false); return; }
    var cell = e.target.closest && e.target.closest('.cia-cell');
    if (!cell || state.pop) return;
    var at = cell.getAttribute('data-cell').split(':').map(Number);
    var move = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[e.key];
    if (move) {
      var target = $('[data-cell="' + (at[0] + move[0]) + ':' + (at[1] + move[1]) + '"]');
      if (target) { e.preventDefault(); target.focus(); target.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
      return;
    }
    if (KEY_STATUS[e.key] || e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault();
      quickMark(cell, KEY_STATUS[e.key] || 'n');
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
