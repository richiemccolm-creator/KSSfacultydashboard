/**
 * Faculty DM / MOD Planner 2026–27
 */
(function () {
  var GCS = ['Progress', 'Wellbeing', 'Inclusion'];
  var GC_COLORS = {
    Progress: 'var(--drama-600)',
    Wellbeing: 'var(--art-600)',
    Inclusion: 'var(--photo-600)'
  };
  var ICON = {
    plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
    save: '<svg viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>',
    print: '<svg viewBox="0 0 24 24"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>',
    copy: '<svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
    trash: '<svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>'
  };

  var state = {
    data: null,
    selectedId: null,
    filters: { term: 'all', type: 'all', gc: 'all', qi: 'all' },
    canManage: false,
    sync: 'Loading…',
    syncKind: 'busy',
    error: '',
    saveTimer: null,
    motionPlayed: false
  };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function parseISO(s) {
    var p = String(s || '').split('-');
    if (p.length < 3) return null;
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  }

  function toISO(d) {
    var m = d.getMonth() + 1;
    var day = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
  }

  function todayISO() {
    return toISO(new Date());
  }

  function daysBetween(a, b) {
    var da = parseISO(a);
    var db = parseISO(b);
    if (!da || !db) return 0;
    return Math.round((db - da) / 86400000);
  }

  function formatLong(iso) {
    var d = parseISO(iso);
    if (!d) return iso || '';
    return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  }

  function pinCode(m) {
    if (!m) return '';
    if (m.id === 'mod-3-prelim') return 'MOD 3P';
    if (m.id === 'mod-3-interim') return 'MOD 3C';
    return m.code || '';
  }

  function meetings() {
    return (state.data && state.data.meetings) || [];
  }

  function ganttRange() {
    var g = (state.data && state.data.gantt) || {};
    return { start: g.start || '2026-08-10', end: g.end || '2027-06-25' };
  }

  function terms() {
    return (state.data && state.data.terms) || [];
  }

  function termForDate(iso) {
    var list = terms();
    for (var i = 0; i < list.length; i++) {
      if (iso >= list[i].start && iso <= list[i].end) return list[i].id;
    }
    return '';
  }

  function findMeeting(id) {
    var list = meetings();
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return list[i];
    }
    return null;
  }

  function sortedMeetings() {
    return meetings().slice().sort(function (a, b) {
      return String(a.date).localeCompare(String(b.date));
    });
  }

  function nextMeeting() {
    var today = todayISO();
    var list = sortedMeetings();
    for (var i = 0; i < list.length; i++) {
      if (list[i].date >= today && list[i].status !== 'actions-closed') return list[i];
    }
    return null;
  }

  function uniqueQi() {
    var seen = {};
    var out = [];
    meetings().forEach(function (m) {
      (m.qiRefs || []).forEach(function (q) {
        if (!seen[q]) { seen[q] = true; out.push(q); }
      });
    });
    out.sort();
    return out;
  }

  function passesFilters(m) {
    var f = state.filters;
    if (f.term !== 'all' && m.term !== f.term) return false;
    if (f.type !== 'all' && m.type !== f.type) return false;
    if (f.gc !== 'all' && (m.grandChallenges || []).indexOf(f.gc) === -1) return false;
    if (f.qi !== 'all' && (m.qiRefs || []).indexOf(f.qi) === -1) return false;
    return true;
  }

  function barBackground(m) {
    var gcs = m.grandChallenges || [];
    if (!gcs.length) return 'var(--navy-600)';
    if (gcs.length === 1) return GC_COLORS[gcs[0]] || 'var(--navy-600)';
    var stops = gcs.map(function (g, i) {
      var start = Math.round((i / gcs.length) * 100);
      var end = Math.round(((i + 1) / gcs.length) * 100);
      return (GC_COLORS[g] || 'var(--navy-600)') + ' ' + start + '% ' + end + '%';
    });
    return 'linear-gradient(90deg, ' + stops.join(', ') + ')';
  }

  function setSync(text, kind) {
    state.sync = text;
    state.syncKind = kind || '';
    var el = document.getElementById('dmp-sync');
    if (!el) return;
    el.textContent = text;
    el.className = 'dmp-sync' + (kind ? ' ' + kind : '');
  }

  function showBanner(msg) {
    state.error = msg || '';
    var el = document.getElementById('dmp-banner');
    if (!el) return;
    if (!msg) { el.hidden = true; el.textContent = ''; return; }
    el.hidden = false;
    el.textContent = msg;
  }

  function scheduleSave() {
    if (!state.canManage) return;
    if (state.saveTimer) clearTimeout(state.saveTimer);
    setSync('Unsaved changes', 'busy');
    state.saveTimer = setTimeout(saveNow, 800);
  }

  function saveNow() {
    if (!state.canManage || !state.data) return Promise.resolve();
    if (state.saveTimer) { clearTimeout(state.saveTimer); state.saveTimer = null; }
    setSync('Saving…', 'busy');
    return window.DmPlannerService.savePlanner(state.data).then(function () {
      setSync('Saved', 'ok');
      showBanner('');
    }).catch(function (err) {
      var msg = window.DmPlannerService.formatError(err);
      setSync('Save failed', 'err');
      showBanner(msg);
    });
  }

  function iconBtn(cls, icon, label, extra) {
    return '<button type="button" class="dmp-btn ' + cls + '" ' + (extra || '') + '>' + icon + esc(label) + '</button>';
  }

  function renderFilters() {
    var qi = uniqueQi();
    var f = state.filters;
    function sel(name, label, opts) {
      var html = '<div class="dmp-filter"><label class="dmp-sr" for="dmp-f-' + name + '">' + esc(label) + '</label><select id="dmp-f-' + name + '" data-filter="' + name + '" aria-label="' + esc(label) + '">';
      opts.forEach(function (o) {
        html += '<option value="' + esc(o.v) + '"' + (f[name] === o.v ? ' selected' : '') + '>' + esc(o.l) + '</option>';
      });
      return html + '</select></div>';
    }
    var qiOpts = [{ v: 'all', l: 'All QI' }].concat(qi.map(function (q) { return { v: q, l: q }; }));
    document.getElementById('dmp-filters').innerHTML =
      sel('term', 'Term', [{ v: 'all', l: 'All terms' }, { v: 'T1', l: 'Term 1' }, { v: 'T2', l: 'Term 2' }, { v: 'T3', l: 'Term 3' }, { v: 'T4', l: 'Term 4' }]) +
      sel('type', 'Type', [{ v: 'all', l: 'Meetings and moderation' }, { v: 'DM', l: 'Meetings' }, { v: 'MOD', l: 'Moderation' }]) +
      sel('gc', 'Grand Challenge', [{ v: 'all', l: 'All challenges' }].concat(GCS.map(function (g) { return { v: g, l: g }; }))) +
      sel('qi', 'QI', qiOpts);
  }

  function renderActions() {
    var html = '';
    if (state.canManage) {
      html += iconBtn('dmp-btn-primary', ICON.plus, 'Add meeting', 'data-act="add"');
      html += iconBtn('', ICON.save, 'Save now', 'data-act="save"');
    }
    html += iconBtn('', ICON.print, 'Print pack', 'data-act="print"');
    var minutesHref = window.DMP_EMBED ? 'faculty-hub.html?panel=embed-department-meetings' : 'department_meetings.html';
    var minutesTarget = window.DMP_EMBED ? ' target="_top"' : '';
    html += '<a class="dmp-btn" href="' + minutesHref + '"' + minutesTarget + '>Minutes</a>';
    document.getElementById('dmp-toolbar-actions').innerHTML = html;
  }

  function renderLegend() {
    var today = todayISO();
    var jumps = terms().map(function (t) {
      var on = today >= t.start && today <= t.end;
      return '<button type="button" class="dmp-btn dmp-btn-ghost' + (on ? ' is-on' : '') + '" data-act="jump-term" data-term="' + esc(t.id) + '">' + esc(t.label) + '</button>';
    }).join('');
    document.getElementById('dmp-legend').innerHTML =
      '<span class="dmp-legend-item"><span class="dmp-swatch progress"></span>Progress</span>' +
      '<span class="dmp-legend-item"><span class="dmp-swatch wellbeing"></span>Wellbeing</span>' +
      '<span class="dmp-legend-item"><span class="dmp-swatch inclusion"></span>Inclusion</span>' +
      '<span class="dmp-legend-item"><span class="dmp-swatch mod"></span>Moderation</span>' +
      '<span class="dmp-term-jumps">' + jumps + '</span>';
  }

  function jumpToTerm(termId) {
    var t = terms().filter(function (x) { return x.id === termId; })[0];
    if (!t) return;
    var scroller = document.getElementById('dmp-gantt-scroll');
    var gantt = document.querySelector('.dmp-gantt');
    if (!scroller || !gantt) return;
    var range = ganttRange();
    var label = 132;
    var track = Math.max(1, gantt.scrollWidth - label);
    scroller.scrollLeft = Math.max(0, (pct(t.start, range) / 100) * track - 48);
  }

  function monthColumns(start, end) {
    var months = [];
    var d = parseISO(start);
    var last = parseISO(end);
    if (!d || !last) return months;
    d.setDate(1);
    while (d <= last) {
      var key = d.getFullYear() + '-' + (d.getMonth() + 1);
      var monthStart = toISO(d);
      var next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      var monthEnd = toISO(new Date(next - 86400000));
      if (monthStart < start) monthStart = start;
      if (monthEnd > end) monthEnd = end;
      months.push({
        key: key,
        label: d.toLocaleDateString('en-GB', { month: 'short' }),
        start: monthStart,
        end: monthEnd,
        span: Math.max(1, daysBetween(monthStart, monthEnd) + 1)
      });
      d = next;
    }
    return months;
  }

  function pct(iso, range) {
    var total = Math.max(1, daysBetween(range.start, range.end));
    var n = daysBetween(range.start, iso);
    return Math.max(0, Math.min(100, (n / total) * 100));
  }

  function renderGantt() {
    var range = ganttRange();
    var months = monthColumns(range.start, range.end);
    var monthCols = months.map(function (m) { return m.span + 'fr'; }).join(' ');
    var termHtml = terms().map(function (t) {
      var left = pct(t.start, range);
      var width = Math.max(0.8, pct(t.end, range) - left);
      return '<div class="dmp-term-band ' + esc(t.id) + '" style="position:absolute;left:' + left + '%;width:' + width + '%;top:0;bottom:0"></div>';
    }).join('');

    var monthCells = months.map(function (m) {
      return '<div class="dmp-month">' + esc(m.label) + '</div>';
    }).join('');

    var next = nextMeeting();
    var lanes = [
      { id: 'DM', label: 'Meetings' },
      { id: 'MOD', label: 'Moderation' }
    ];
    var laneHtml = lanes.map(function (lane) {
      var items = sortedMeetings().filter(function (m) { return m.type === lane.id && passesFilters(m); });
      var bars = items.map(function (m, i) {
        var leftPct = pct(m.date, range);
        var code = pinCode(m);
        var cls = 'dmp-bar' +
          (m.type === 'MOD' ? ' is-mod' : '') +
          (i % 2 === 1 ? ' is-stagger' : '') +
          (state.selectedId === m.id ? ' is-selected' : '') +
          (next && next.id === m.id ? ' is-next' : '');
        var bg = m.type === 'MOD' ? 'var(--navy-800)' : barBackground(m);
        return '<button type="button" class="' + cls + '" data-meeting="' + esc(m.id) + '" data-date="' + esc(m.date) + '" style="left:' + leftPct + '%;background:' + bg + '" title="' + esc(code + ' · ' + formatLong(m.date) + ' · ' + m.title) + '">' +
          '<span class="dmp-bar-code">' + esc(code) + '</span>' +
          '</button>';
      }).join('');
      if (!items.length) bars = '<div class="dmp-empty-lane">No ' + esc(lane.label.toLowerCase()) + ' in this filter.</div>';
      return '<div class="dmp-lane' + (lane.id === 'MOD' ? ' is-mod' : '') + '">' +
        '<div class="dmp-lane-label">' + esc(lane.label) + '<span class="dmp-lane-count">' + items.length + '</span></div>' +
        '<div class="dmp-lane-track">' + bars + '</div></div>';
    }).join('');

    var today = todayISO();
    var todayMark = '';
    if (today >= range.start && today <= range.end) {
      todayMark = '<div class="dmp-today" style="left:calc(var(--dmp-label-w) + (100% - var(--dmp-label-w)) * ' + (pct(today, range) / 100) + ')"></div>';
    }

    document.getElementById('dmp-gantt').innerHTML =
      '<div class="dmp-gantt">' +
        todayMark +
        '<div class="dmp-months" style="grid-template-columns:' + monthCols + '">' + monthCells + '</div>' +
        '<div class="dmp-terms">' + termHtml + '</div>' +
        '<div class="dmp-lanes" style="position:relative">' + laneHtml + '</div>' +
      '</div>';
    playPinMotion();
  }

  function playPinMotion() {
    if (state.motionPlayed || !window.gsap) return;
    var pins = document.querySelectorAll('.dmp-bar');
    if (!pins.length) return;
    state.motionPlayed = true;
    window.gsap.fromTo(pins, { opacity: 0, filter: 'blur(8px)' }, {
      opacity: 1,
      filter: 'blur(0px)',
      duration: 0.45,
      stagger: 0.03,
      ease: 'power3.out'
    });
    var todayEl = document.querySelector('.dmp-today');
    if (todayEl) {
      window.gsap.from(todayEl, { scaleY: 0, transformOrigin: 'top', duration: 0.55, ease: 'power3.out' });
    }
  }

  function renderNext() {
    var el = document.getElementById('dmp-next');
    if (!el) return;
    var n = nextMeeting();
    if (!n) {
      el.innerHTML = '<p class="dmp-next-title">DM Planner 2026–27</p>';
      return;
    }
    el.innerHTML =
      '<p class="dmp-next-title">' + esc(pinCode(n)) + '</p>' +
      '<span class="dmp-next-meta">' + esc(formatLong(n.date)) + ' · ' + esc(n.title) + '</span>' +
      '<button type="button" class="dmp-btn" data-meeting="' + esc(n.id) + '">Open</button>';
  }

  function field(id, label, value, multiline) {
    var ro = state.canManage ? '' : ' readonly';
    if (multiline) {
      return '<div class="dmp-field"><label for="' + id + '">' + esc(label) + '</label><textarea id="' + id + '" data-field="' + id.replace('dmp-', '') + '"' + ro + '>' + esc(value) + '</textarea></div>';
    }
    return '<div class="dmp-field"><label for="' + id + '">' + esc(label) + '</label><input id="' + id + '" data-field="' + id.replace('dmp-', '') + '" value="' + esc(value) + '"' + ro + '></div>';
  }

  function renderDoc() {
    var stage = document.getElementById('dmp-stage');
    var root = document.getElementById('dmp-doc');
    var m = findMeeting(state.selectedId);
    if (!m) {
      stage.classList.remove('has-doc');
      root.innerHTML = '<div class="dmp-doc-empty">Select a pin on the year to open the agenda, preparation, and working notes.</div>';
      return;
    }
    stage.classList.add('has-doc');
    var pills = (m.grandChallenges || []).map(function (g) {
      return '<span class="dmp-pill gc-' + esc(g) + '">' + esc(g) + '</span>';
    }).concat((m.qiRefs || []).map(function (q) {
      return '<span class="dmp-pill">' + esc(q) + '</span>';
    })).join('');

    var gcChecks = GCS.map(function (g) {
      var on = (m.grandChallenges || []).indexOf(g) !== -1;
      return '<label><input type="checkbox" data-gc="' + esc(g) + '"' + (on ? ' checked' : '') + (state.canManage ? '' : ' disabled') + '> ' + esc(g) + '</label>';
    }).join('');

    var typeDisabled = state.canManage ? '' : ' disabled';
    var html =
      '<div class="dmp-doc-head">' +
        '<button type="button" class="dmp-doc-close" data-act="close">Close</button>' +
        '<h2>' + esc(pinCode(m)) + '</h2>' +
        '<p class="dmp-doc-sub">' + esc(formatLong(m.date)) + (m.term ? ' · ' + esc(m.term) : '') + '</p>' +
      '</div>' +
      '<div class="dmp-doc-body">' +
        '<div class="dmp-pills">' + pills + '</div>' +
        '<div class="dmp-grid2">' +
          field('dmp-code', 'Meeting', m.code || '') +
          '<div class="dmp-field"><label for="dmp-type">Type</label><select id="dmp-type" data-field="type"' + typeDisabled + '>' +
            '<option value="DM"' + (m.type === 'DM' ? ' selected' : '') + '>Department meeting</option>' +
            '<option value="MOD"' + (m.type === 'MOD' ? ' selected' : '') + '>Moderation</option>' +
          '</select></div>' +
        '</div>' +
        '<div class="dmp-grid2">' +
          '<div class="dmp-field"><label for="dmp-date">Date</label><input id="dmp-date" type="date" data-field="date" value="' + esc(m.date) + '"' + (state.canManage ? '' : ' readonly') + '></div>' +
          '<div class="dmp-field"><label for="dmp-term">Term</label><select id="dmp-term" data-field="term"' + typeDisabled + '>' +
            ['T1', 'T2', 'T3', 'T4'].map(function (t) {
              return '<option value="' + t + '"' + (m.term === t ? ' selected' : '') + '>' + t + '</option>';
            }).join('') +
          '</select></div>' +
        '</div>' +
        field('dmp-title', 'Focus / title', m.title || '') +
        '<div class="dmp-grid2">' +
          field('dmp-lead', 'Lead', m.lead || '') +
          field('dmp-targetDate', 'Target date', m.targetDate || '') +
        '</div>' +
        '<div class="dmp-field"><span class="dmp-label">Grand Challenge</span><div class="dmp-check">' + gcChecks + '</div></div>' +
        field('dmp-qiRefs', 'QI refs', (m.qiRefs || []).join(' / ')) +
        field('dmp-reminders', 'Reminders', m.reminders || '', true) +
        '<h3 class="dmp-section-title">Plan</h3>' +
        field('dmp-agenda', 'Agenda items', m.agenda || '', true) +
        field('dmp-collegialActivity', 'Collegial working', m.collegialActivity || '', true) +
        field('dmp-preparation', 'Preparation required', m.preparation || '', true) +
        field('dmp-intendedOutcomes', 'Intended outcomes', m.intendedOutcomes || '', true) +
        field('dmp-trackingEntered', 'Tracking entered at this DM', m.trackingEntered || '', true) +
        '<h3 class="dmp-section-title">After the meeting</h3>' +
        '<div class="dmp-field"><label for="dmp-status">Status</label><select id="dmp-status" data-field="status"' + typeDisabled + '>' +
          '<option value="upcoming"' + (m.status === 'upcoming' ? ' selected' : '') + '>Upcoming</option>' +
          '<option value="held"' + (m.status === 'held' ? ' selected' : '') + '>Held</option>' +
          '<option value="actions-closed"' + (m.status === 'actions-closed' ? ' selected' : '') + '>Actions closed</option>' +
        '</select></div>' +
        field('dmp-actionsAgreed', 'Actions agreed', m.actionsAgreed || '', true) +
        field('dmp-notes', 'Working notes', m.notes || '', true) +
        '<div class="dmp-doc-actions">' +
          (state.canManage ? iconBtn('', ICON.copy, 'Duplicate', 'data-act="duplicate"') + iconBtn('', ICON.trash, 'Delete', 'data-act="delete"') : '') +
          iconBtn('', ICON.print, 'Print this meeting', 'data-act="print-one"') +
        '</div>' +
      '</div>';
    root.innerHTML = html;
  }

  function renderAll() {
    renderFilters();
    renderActions();
    renderLegend();
    renderNext();
    renderGantt();
    renderDoc();
  }

  function applyField(m, key, value) {
    if (key === 'qiRefs') {
      m.qiRefs = String(value).split(/[/,]/).map(function (s) { return s.trim(); }).filter(Boolean);
      return;
    }
    if (key === 'date') {
      m.date = value;
      var inferred = termForDate(value);
      if (inferred) m.term = inferred;
      return;
    }
    m[key] = value;
  }

  function blankMeeting() {
    var d = todayISO();
    return {
      id: 'm-' + Date.now(),
      type: 'DM',
      code: 'DM',
      date: d,
      dateLabel: formatLong(d),
      term: termForDate(d) || 'T1',
      title: 'New meeting',
      grandChallenges: ['Progress'],
      qiRefs: [],
      reminders: '',
      agenda: '',
      collegialActivity: '',
      preparation: '',
      intendedOutcomes: '',
      actionsAgreed: '',
      lead: 'Faculty Head',
      targetDate: '',
      trackingEntered: '',
      notes: '',
      status: 'upcoming'
    };
  }

  function addMeeting() {
    var m = blankMeeting();
    state.data.meetings.push(m);
    state.selectedId = m.id;
    renderAll();
    scheduleSave();
  }

  function duplicateMeeting() {
    var src = findMeeting(state.selectedId);
    if (!src) return;
    var copy = JSON.parse(JSON.stringify(src));
    copy.id = 'm-' + Date.now();
    copy.code = (src.code || 'DM') + ' copy';
    copy.title = (src.title || 'Meeting') + ' (copy)';
    var d = parseISO(src.date);
    if (d) { d.setDate(d.getDate() + 7); copy.date = toISO(d); copy.term = termForDate(copy.date) || src.term; }
    state.data.meetings.push(copy);
    state.selectedId = copy.id;
    renderAll();
    scheduleSave();
  }

  function deleteMeeting() {
    var m = findMeeting(state.selectedId);
    if (!m) return;
    if (!window.confirm('Delete ' + m.code + '? This cannot be undone.')) return;
    state.data.meetings = meetings().filter(function (x) { return x.id !== m.id; });
    state.selectedId = null;
    renderAll();
    scheduleSave();
  }

  function printMeeting(m) {
    var area = document.getElementById('dmp-print');
    if (!m) {
      var rows = sortedMeetings().map(function (x) {
        return '<p><strong>' + esc(x.code) + '</strong> · ' + esc(formatLong(x.date)) + ' · ' + esc(x.title) + '</p>';
      }).join('');
      area.innerHTML = '<h1>DM Planner 2026–27</h1>' + rows;
    } else {
      function block(label, val) {
        if (!String(val || '').trim()) return '';
        return '<h2>' + esc(label) + '</h2><pre>' + esc(val) + '</pre>';
      }
      area.innerHTML =
        '<h1>' + esc(m.code) + ' · ' + esc(m.title) + '</h1>' +
        '<p>' + esc(formatLong(m.date)) + ' · ' + esc(m.term || '') + ' · ' + esc((m.grandChallenges || []).join(', ')) + '</p>' +
        block('Reminders', m.reminders) +
        block('Agenda', m.agenda) +
        block('Collegial working', m.collegialActivity) +
        block('Preparation', m.preparation) +
        block('Intended outcomes', m.intendedOutcomes) +
        block('Tracking entered', m.trackingEntered) +
        block('Actions agreed', m.actionsAgreed) +
        block('Working notes', m.notes);
    }
    window.print();
  }

  function onClick(e) {
    var act = e.target.closest('[data-act]');
    if (act) {
      var a = act.getAttribute('data-act');
      if (a === 'add') addMeeting();
      else if (a === 'save') saveNow();
      else if (a === 'print') printMeeting(findMeeting(state.selectedId));
      else if (a === 'print-one') printMeeting(findMeeting(state.selectedId));
      else if (a === 'duplicate') duplicateMeeting();
      else if (a === 'delete') deleteMeeting();
      else if (a === 'close') { state.selectedId = null; renderAll(); }
      else if (a === 'jump-term') jumpToTerm(act.getAttribute('data-term'));
      return;
    }
    var bar = e.target.closest('[data-meeting]');
    if (bar) {
      state.selectedId = bar.getAttribute('data-meeting');
      renderAll();
    }
  }

  function onChange(e) {
    var filter = e.target.getAttribute('data-filter');
    if (filter) {
      state.filters[filter] = e.target.value;
      renderGantt();
      return;
    }
    if (!state.canManage) return;
    var m = findMeeting(state.selectedId);
    if (!m) return;
    var gc = e.target.getAttribute('data-gc');
    if (gc) {
      var set = m.grandChallenges || [];
      if (e.target.checked) {
        if (set.indexOf(gc) === -1) set.push(gc);
      } else {
        set = set.filter(function (x) { return x !== gc; });
      }
      m.grandChallenges = set;
      renderGantt();
      renderNext();
      scheduleSave();
      return;
    }
    var fieldName = e.target.getAttribute('data-field');
    if (!fieldName) return;
    applyField(m, fieldName, e.target.value);
    if (fieldName === 'date' || fieldName === 'type' || fieldName === 'code' || fieldName === 'title' || fieldName === 'term') {
      renderGantt();
      renderNext();
      var head = document.querySelector('.dmp-doc-head h2');
      if (head) head.textContent = m.code;
      var sub = document.querySelector('.dmp-doc-sub');
      if (sub) sub.textContent = formatLong(m.date) + (m.term ? ' · ' + m.term : '');
      var termSel = document.getElementById('dmp-term');
      if (termSel && m.term) termSel.value = m.term;
    }
    scheduleSave();
  }

  function onKey(e) {
    if (e.key === 'Escape' && state.selectedId) {
      state.selectedId = null;
      renderAll();
    }
  }

  function bootEmbed() {
    if (window.DMP_EMBED || document.documentElement.getAttribute('data-fh-embed') === '1') {
      document.body.classList.add('dmp-embed');
      document.documentElement.classList.remove('dmp-embed-pending');
    } else {
      document.documentElement.classList.remove('dmp-embed-pending');
    }
  }

  function start() {
    bootEmbed();
    state.canManage = !!(window.DmPlannerService && window.DmPlannerService.canManage());
    if (window.DmPlannerService && window.DmPlannerService.ensureCanManage) {
      window.DmPlannerService.ensureCanManage().then(function (ok) {
        if (ok !== state.canManage) {
          state.canManage = !!ok;
          renderAll();
        }
      });
    }
    window.DmPlannerService.loadPlanner().then(function (data) {
      state.data = data;
      setSync(state.canManage ? 'Ready to edit' : 'View only', 'ok');
      renderAll();
      var n = nextMeeting();
      if (n) {
        var scroller = document.getElementById('dmp-gantt-scroll');
        var btn = document.querySelector('[data-meeting="' + n.id + '"]');
        if (scroller && btn) {
          try { btn.scrollIntoView({ inline: 'center', block: 'nearest' }); } catch (e) {}
        }
      }
    }).catch(function (err) {
      state.data = window.DmPlannerService.cloneSeed();
      setSync('Offline seed', 'err');
      showBanner(window.DmPlannerService.formatError(err));
      renderAll();
    });
  }

  document.addEventListener('click', onClick);
  document.addEventListener('change', onChange);
  document.addEventListener('input', function (e) {
    if (e.target && e.target.getAttribute('data-field') && e.target.tagName !== 'SELECT') onChange(e);
  });
  document.addEventListener('keydown', onKey);

  function waitAuth() {
    if (window.__authReady) { start(); return; }
    window.addEventListener('auth-guard-ready', start, { once: true });
    setTimeout(function () {
      if (!state.data) start();
    }, 2500);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', waitAuth);
  else waitAuth();
})();
