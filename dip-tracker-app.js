/**
 * Art & Drama DIP Mission Tracker 25-26 — browse UX (hub → mission list → commitment detail).
 */
(function() {
  'use strict';

  var SHEETS = [
    { id: 'gc1m1', short: 'GC1 M1', label: 'Attendance', challenge: 1, mission: 1,
      challengeTitle: 'Inclusive education — meeting the needs of all learners' },
    { id: 'gc1m2', short: 'GC1 M2', label: 'Behaviour & UNCRC', challenge: 1, mission: 2,
      challengeTitle: 'Inclusive education — meeting the needs of all learners' },
    { id: 'gc2m1', short: 'GC2 M1', label: 'L&T Policy', challenge: 2, mission: 1,
      challengeTitle: 'High-quality learning, teaching & assessment' },
    { id: 'gc2m2', short: 'GC2 M2', label: 'Curriculum Challenge', challenge: 2, mission: 2,
      challengeTitle: 'High-quality learning, teaching & assessment' },
    { id: 'gc3m1', short: 'GC3 M1', label: 'Literacy & Numeracy BGE', challenge: 3, mission: 1,
      challengeTitle: 'Raising attainment and achievement for all learners' },
    { id: 'gc3m2', short: 'GC3 M2', label: 'Senior Phase', challenge: 3, mission: 2,
      challengeTitle: 'Raising attainment and achievement for all learners' }
  ];

  var CHALLENGE_GROUPS = [
    { num: 1, title: 'Challenge 1 — Inclusive education' },
    { num: 2, title: 'Challenge 2 — Learning, teaching & assessment' },
    { num: 3, title: 'Challenge 3 — Raising attainment' }
  ];

  var HUB_LINKS = {
    gc1m1: [
      { label: 'Improvement Plan', panel: 'dip-main' },
      { label: 'Tracking Hub', panel: 'embed-tracking-monitoring-hub' }
    ],
    gc1m2: [
      { label: 'Improvement Plan', panel: 'dip-main' },
      { label: 'Class Visits', panel: 'embed-class-visit' }
    ],
    gc2m1: [
      { label: 'Learning & Teaching', panel: 'embed-learning-teaching' },
      { label: 'Teacher Planner', panel: 'embed-teacher-planner' },
      { label: 'Moderation', panel: 'ad-moderation' }
    ],
    gc2m2: [
      { label: 'Curriculum (Drama S1)', panel: 'drama-s1' },
      { label: 'Tracking Hub', panel: 'embed-tracking-monitoring-hub' },
      { label: 'Dept Meetings', panel: 'embed-department-meetings' }
    ],
    gc3m1: [
      { label: 'Art Tracker', panel: 'ad-tracker' },
      { label: 'Drama Tracker', panel: 'drama-tracker' },
      { label: 'Report Builders', panel: 'ad-report-builder' }
    ],
    gc3m2: [
      { label: 'Senior Phase Tracker', panel: 'embed-senior-phase-tracker' },
      { label: 'Faculty Dashboard', panel: 'embed-faculty-dashboard' }
    ]
  };

  var EDITABLE_LABELS = {
    dataArea: 'Data identifying area of improvement',
    research: 'Research evidence (EEF / HGIOS etc.)',
    resources: 'Resources required',
    qiQuestions: 'QI / challenge question(s)'
  };

  var GREY_KEYS = ['commitment', 'subject', 'lead', 'successMeasure'];
  var EDITABLE_KEYS = ['dataArea', 'research', 'resources', 'qiQuestions'];
  var TERM_KEYS = ['t1', 't2', 't3', 't4'];
  var TERM_LABELS = { t1: 'Term 1', t2: 'Term 2', t3: 'Term 3', t4: 'Term 4' };

  var state = {
    data: null,
    view: 'hub',
    activeSheet: 'gc1m1',
    activeCommitmentIndex: 0,
    activeTerm: 't1',
    saveTimer: null,
    dirty: false
  };

  function sheetMeta(sid) {
    for (var i = 0; i < SHEETS.length; i++) {
      if (SHEETS[i].id === sid) return SHEETS[i];
    }
    return null;
  }

  function seed() {
    return window.DIP_TRACKER_SEED || { version: 1, schoolYear: '2025-26', sheets: {} };
  }

  function emptyData() {
    return { version: 1, schoolYear: '2025-26', sheets: {}, lastUpdated: null };
  }

  function mergeWithSeed(saved) {
    var s = seed();
    var out = saved && typeof saved === 'object' ? JSON.parse(JSON.stringify(saved)) : emptyData();
    if (!out.sheets) out.sheets = {};
    out.version = s.version || 1;
    out.schoolYear = out.schoolYear || s.schoolYear || '2025-26';
    Object.keys(s.sheets || {}).forEach(function(sid) {
      var seedSheet = s.sheets[sid];
      var savedSheet = out.sheets[sid] || {};
      var byId = {};
      (savedSheet.commitments || []).forEach(function(c) {
        if (c && c.id) byId[c.id] = c;
      });
      var merged = [];
      (seedSheet.commitments || []).forEach(function(sc, idx) {
        var id = sc.id || (sid + '-' + (idx + 1));
        var existing = byId[id] || {};
        var row = { id: id };
        GREY_KEYS.forEach(function(k) {
          row[k] = sc[k] != null ? sc[k] : (existing[k] || '');
        });
        EDITABLE_KEYS.forEach(function(k) {
          row[k] = existing[k] != null && String(existing[k]).trim()
            ? existing[k]
            : (sc[k] || '');
        });
        row.terms = {};
        TERM_KEYS.forEach(function(tk) {
          var st = sc.terms && sc.terms[tk] ? sc.terms[tk] : {};
          var ex = existing.terms && existing.terms[tk] ? existing.terms[tk] : {};
          row.terms[tk] = {
            measure: ex.measure != null && String(ex.measure).trim() ? ex.measure : (st.measure || ''),
            progress: ex.progress != null && String(ex.progress).trim() ? ex.progress : (st.progress || '')
          };
        });
        merged.push(row);
      });
      out.sheets[sid] = {
        challenge: seedSheet.challenge || savedSheet.challenge || '',
        mission: seedSheet.mission || savedSheet.mission || '',
        commitments: merged
      };
    });
    return out;
  }

  function cellFilled(val) {
    return val != null && String(val).trim().length > 0;
  }

  function rowCompletion(row) {
    var total = 0;
    var filled = 0;
    EDITABLE_KEYS.forEach(function(k) {
      total++;
      if (cellFilled(row[k])) filled++;
    });
    TERM_KEYS.forEach(function(tk) {
      var t = row.terms && row.terms[tk] ? row.terms[tk] : {};
      total += 2;
      if (cellFilled(t.measure)) filled++;
      if (cellFilled(t.progress)) filled++;
    });
    return { total: total, filled: filled, percent: 0 };
  }

  function sheetCompletion(sheet) {
    var total = 0;
    var filled = 0;
    (sheet.commitments || []).forEach(function(row) {
      var r = rowCompletion(row);
      total += r.total;
      filled += r.filled;
    });
    return total ? Math.round((filled / total) * 100) : 0;
  }

  function overallCompletion(data) {
    var total = 0;
    var filled = 0;
    SHEETS.forEach(function(sh) {
      var sheet = data.sheets && data.sheets[sh.id];
      if (!sheet) return;
      (sheet.commitments || []).forEach(function(row) {
        var r = rowCompletion(row);
        total += r.total;
        filled += r.filled;
      });
    });
    return {
      percent: total ? Math.round((filled / total) * 100) : 0,
      filled: filled,
      total: total
    };
  }

  function getCurrentTermHeuristic() {
    var m = new Date().getMonth();
    if (m >= 7 || m <= 9) return 't1';
    if (m <= 12 || m === 0) return 't2';
    if (m <= 2) return 't3';
    return 't4';
  }

  function truncate(str, len) {
    str = String(str || '').trim();
    if (!str) return '';
    return str.length <= len ? str : str.slice(0, len - 1) + '…';
  }

  function commitmentSnippet(row) {
    var t4 = row.terms && row.terms.t4 ? row.terms.t4.progress : '';
    if (cellFilled(t4)) return truncate(t4, 140);
    if (cellFilled(row.dataArea)) return truncate(row.dataArea, 140);
    if (cellFilled(row.research)) return truncate(row.research, 140);
    return 'Tap to add evidence and term progress';
  }

  function navigate(view, sid, commitmentIndex) {
    state.view = view;
    if (sid) state.activeSheet = sid;
    if (commitmentIndex != null) state.activeCommitmentIndex = commitmentIndex;
    if (view === 'detail') {
      state.activeTerm = getCurrentTermHeuristic();
    }
    renderApp();
  }

  function setSyncStatus(msg, ok) {
    var el = document.getElementById('dip-sync-status');
    if (!el) return;
    el.textContent = msg || '';
    el.className = 'dip-sync-status' + (ok === true ? ' ok' : ok === false ? ' err' : '');
  }

  function scheduleSave() {
    state.dirty = true;
    clearTimeout(state.saveTimer);
    state.saveTimer = setTimeout(doSave, 900);
    setSyncStatus('Saving…');
  }

  function doSave() {
    if (!state.data || !window.DipTrackerService) return;
    state.data.lastUpdated = new Date().toISOString();
    DipTrackerService.saveTracker(state.data)
      .then(function() {
        state.dirty = false;
        setSyncStatus('Saved ' + new Date().toLocaleTimeString(), true);
        updateProgressUI();
        notifyParent();
      })
      .catch(function(err) {
        setSyncStatus(DipTrackerService.formatError(err), false);
      });
  }

  function notifyParent() {
    if (!window.DIP_EMBED || !window.parent || window.parent === window) return;
    try {
      var c = overallCompletion(state.data);
      window.parent.postMessage({
        type: 'dip-tracker-updated',
        percent: c.percent,
        filled: c.filled,
        total: c.total
      }, window.location.origin);
    } catch (e) { /* ignore */ }
  }

  function openHubPanel(panel) {
    if (window.DIP_EMBED && window.parent && window.parent !== window) {
      try {
        window.parent.postMessage({ type: 'dip-tracker-navigate', panel: panel }, window.location.origin);
      } catch (e) { /* ignore */ }
    }
  }

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function subjectClass(subj) {
    var s = String(subj || '').toLowerCase();
    if (s === 'art') return 'art';
    if (s === 'drama') return 'drama';
    return '';
  }

  function renderHubLinks(sid) {
    return (HUB_LINKS[sid] || []).map(function(l) {
      return '<button type="button" class="dip-hub-link" data-panel="' + escapeHtml(l.panel) + '">' + escapeHtml(l.label) + '</button>';
    }).join('');
  }

  function renderHub() {
    var blocks = CHALLENGE_GROUPS.map(function(cg) {
      var tiles = SHEETS.filter(function(sh) { return sh.challenge === cg.num; }).map(function(sh) {
        var sheet = state.data.sheets[sh.id];
        var pct = sheet ? sheetCompletion(sheet) : 0;
        var missionText = sheet ? sheet.mission.replace(/^Mission \d+:\s*/i, '') : sh.label;
        return (
          '<button type="button" class="dip-mission-tile" data-nav="mission" data-sheet="' + sh.id + '">' +
          '<div class="dip-mission-tile-code">' + escapeHtml(sh.short) + '</div>' +
          '<div class="dip-mission-tile-title">' + escapeHtml(missionText) + '</div>' +
          '<div class="dip-mission-tile-meta">' +
          '<span>' + escapeHtml(sh.label) + '</span>' +
          '<div class="dip-completion-ring" style="--pct:' + pct + '"><span>' + pct + '%</span></div>' +
          '</div></button>'
        );
      }).join('');
      return (
        '<section class="dip-challenge-block">' +
        '<h2>' + escapeHtml(cg.title) + '</h2>' +
        '<div class="dip-mission-grid">' + tiles + '</div></section>'
      );
    }).join('');
    return '<div class="dip-view-hub"><p style="margin:0 0 20px;color:var(--dip-muted);font-size:14px;">Choose a mission sheet to review commitments and term progress.</p>' + blocks + '</div>';
  }

  function renderMissionList(sid) {
    var sheet = state.data.sheets[sid];
    var meta = sheetMeta(sid);
    if (!sheet) return '<p>No data for this mission.</p>';
    var missionText = sheet.mission.replace(/^Mission \d+:\s*/i, '');
    var cards = (sheet.commitments || []).map(function(row, ri) {
      var rc = rowCompletion(row);
      var chipCls = rc.filled === rc.total && rc.total > 0 ? 'dip-completion-chip done' : 'dip-completion-chip';
      return (
        '<button type="button" class="dip-commitment-card" data-nav="detail" data-sheet="' + sid + '" data-index="' + ri + '">' +
        '<div class="dip-commitment-card-inner">' +
        '<div class="dip-commitment-card-head">' +
        '<span class="dip-commitment-num">' + (ri + 1) + '</span>' +
        '<div style="flex:1;min-width:0">' +
        '<h3>' + escapeHtml(row.commitment) + '</h3>' +
        '<div class="dip-commitment-meta">' +
        '<span class="dip-subject-tag ' + subjectClass(row.subject) + '">' + escapeHtml(row.subject) + '</span>' +
        '<strong>Lead:</strong> ' + escapeHtml(row.lead) +
        '</div>' +
        '<p class="dip-commitment-snippet">' + escapeHtml(commitmentSnippet(row)) + '</p>' +
        '</div>' +
        '<span class="' + chipCls + '">' + rc.filled + '/' + rc.total + '</span>' +
        '</div></div></button>'
      );
    }).join('');

    return (
      '<div class="dip-view-mission">' +
      '<div class="dip-sheet-banner">' +
      '<p class="dip-challenge-label">' + escapeHtml(sheet.challenge.replace(/^Challenge \d+:\s*/i, '')) + '</p>' +
      '<h2>' + escapeHtml(missionText) + '</h2>' +
      '<p class="dip-mission-line">' + escapeHtml(meta ? meta.short + ' · ' + meta.label : '') + '</p>' +
      '<div class="dip-hub-links">' + renderHubLinks(sid) + '</div>' +
      '</div>' +
      '<div class="dip-commitment-list">' + cards + '</div></div>'
    );
  }

  function renderReadonlyBlock(row) {
    return (
      '<div class="dip-dip-readonly">' +
      '<div class="dip-field"><div class="dip-field-label">Commitment (from DIP)</div><div class="dip-field-value">' + escapeHtml(row.commitment) + '</div></div>' +
      '<div class="dip-field"><div class="dip-field-label">Subject</div><div class="dip-field-value"><span class="dip-subject-tag ' + subjectClass(row.subject) + '">' + escapeHtml(row.subject) + '</span></div></div>' +
      '<div class="dip-field"><div class="dip-field-label">Lead staff</div><div class="dip-field-value">' + escapeHtml(row.lead) + '</div></div>' +
      '<div class="dip-field"><div class="dip-field-label">Success measure (from DIP)</div><div class="dip-field-value">' + escapeHtml(row.successMeasure) + '</div></div>' +
      '</div>'
    );
  }

  function renderCommitmentDetail(sid, index) {
    var sheet = state.data.sheets[sid];
    if (!sheet || !sheet.commitments[index]) return '<p>Commitment not found.</p>';
    var row = sheet.commitments[index];
    var total = sheet.commitments.length;

    var editableHtml = EDITABLE_KEYS.map(function(k) {
      var tall = k === 'dataArea' || k === 'qiQuestions';
      return (
        '<div class="dip-detail-section">' +
        '<div class="dip-field-label">' + escapeHtml(EDITABLE_LABELS[k]) + '</div>' +
        '<textarea class="' + (tall ? 'dip-textarea-tall' : '') + '" data-sheet="' + sid + '" data-row="' + index + '" data-field="' + k + '">' + escapeHtml(row[k]) + '</textarea>' +
        '</div>'
      );
    }).join('');

    var termPanels = TERM_KEYS.map(function(tk) {
      var t = row.terms && row.terms[tk] ? row.terms[tk] : {};
      var active = tk === state.activeTerm ? ' active' : '';
      return (
        '<div class="dip-term-panel' + active + '" data-term-panel="' + tk + '">' +
        '<div class="dip-detail-section">' +
        '<div class="dip-field-label">' + TERM_LABELS[tk] + ' — measure of impact</div>' +
        '<textarea data-sheet="' + sid + '" data-row="' + index + '" data-field="terms.' + tk + '.measure">' + escapeHtml(t.measure) + '</textarea>' +
        '</div>' +
        '<div class="dip-detail-section">' +
        '<div class="dip-field-label">' + TERM_LABELS[tk] + ' — progress (evaluative comment)</div>' +
        '<textarea class="dip-textarea-tall" data-sheet="' + sid + '" data-row="' + index + '" data-field="terms.' + tk + '.progress">' + escapeHtml(t.progress) + '</textarea>' +
        '</div></div>'
      );
    }).join('');

    var termTabs = TERM_KEYS.map(function(tk) {
      var cls = tk === state.activeTerm ? 'dip-term-tab active' : 'dip-term-tab';
      return '<button type="button" class="' + cls + '" data-term="' + tk + '">' + TERM_LABELS[tk] + '</button>';
    }).join('');

    var prevDisabled = index <= 0 ? ' disabled' : '';
    var nextDisabled = index >= total - 1 ? ' disabled' : '';

    return (
      '<div class="dip-detail">' +
      renderReadonlyBlock(row) +
      '<h3 style="margin:0 0 16px;font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--dip-muted)">Collaborative evidence</h3>' +
      editableHtml +
      '<h3 style="margin:24px 0 12px;font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--dip-muted)">Term progress</h3>' +
      '<div class="dip-term-tabs">' + termTabs + '</div>' +
      termPanels +
      '<nav class="dip-detail-nav" aria-label="Commitment navigation">' +
      '<div class="dip-nav-group">' +
      '<button type="button" class="dip-btn" data-nav="mission" data-sheet="' + sid + '">← Back to list</button>' +
      '</div>' +
      '<span class="dip-nav-pos">Commitment ' + (index + 1) + ' of ' + total + '</span>' +
      '<div class="dip-nav-group">' +
      '<button type="button" class="dip-btn" data-nav="prev"' + prevDisabled + '>Previous</button>' +
      '<button type="button" class="dip-btn" data-nav="next"' + nextDisabled + '>Next</button>' +
      '</div></nav></div>'
    );
  }

  function renderPrintArea(sid) {
    var sheet = state.data.sheets[sid];
    if (!sheet) return '';
    var meta = sheetMeta(sid);
    var html = '<h1 style="font-size:18px">' + escapeHtml(meta ? meta.short + ': ' + meta.label : sid) + '</h1>';
    html += '<p><strong>' + escapeHtml(sheet.challenge) + '</strong><br>' + escapeHtml(sheet.mission) + '</p>';
    (sheet.commitments || []).forEach(function(row, i) {
      html += '<div class="dip-print-commitment"><h3>Commitment ' + (i + 1) + ': ' + escapeHtml(row.commitment) + '</h3>';
      html += '<div class="dip-print-block"><strong>Subject / Lead / Success measure</strong>' + escapeHtml(row.subject) + ' · ' + escapeHtml(row.lead) + ' · ' + escapeHtml(row.successMeasure) + '</div>';
      EDITABLE_KEYS.forEach(function(k) {
        html += '<div class="dip-print-block"><strong>' + escapeHtml(EDITABLE_LABELS[k]) + '</strong>' + escapeHtml(row[k]).replace(/\n/g, '<br>') + '</div>';
      });
      TERM_KEYS.forEach(function(tk) {
        var t = row.terms && row.terms[tk] ? row.terms[tk] : {};
        html += '<div class="dip-print-block"><strong>' + TERM_LABELS[tk] + ' measure</strong>' + escapeHtml(t.measure).replace(/\n/g, '<br>') + '</div>';
        html += '<div class="dip-print-block"><strong>' + TERM_LABELS[tk] + ' progress</strong>' + escapeHtml(t.progress).replace(/\n/g, '<br>') + '</div>';
      });
      html += '</div>';
    });
    return html;
  }

  function renderBreadcrumbItems() {
    var items = ['<li><button type="button" data-nav="hub">All missions</button></li>'];
    if (state.view === 'mission' || state.view === 'detail') {
      var meta = sheetMeta(state.activeSheet);
      var label = meta ? meta.short + ' · ' + meta.label : state.activeSheet;
      if (state.view === 'mission') {
        items.push('<li><span class="dip-bc-current">' + escapeHtml(label) + '</span></li>');
      } else {
        items.push('<li><button type="button" data-nav="mission" data-sheet="' + state.activeSheet + '">' + escapeHtml(label) + '</button></li>');
        items.push('<li><span class="dip-bc-current">Commitment ' + (state.activeCommitmentIndex + 1) + '</span></li>');
      }
    }
    return items.join('');
  }

  function renderMissionSelect() {
    if (state.view === 'hub') return '';
    var opts = SHEETS.map(function(sh) {
      var sel = sh.id === state.activeSheet ? ' selected' : '';
      return '<option value="' + sh.id + '"' + sel + '>' + escapeHtml(sh.short + ' · ' + sh.label) + '</option>';
    }).join('');
    return '<select class="dip-mission-select" id="dip-mission-select" aria-label="Switch mission">' + opts + '</select>';
  }

  function renderApp() {
    var root = document.getElementById('dip-app-root');
    if (!root || !state.data) return;

    var content = '';
    if (state.view === 'hub') content = renderHub();
    else if (state.view === 'mission') content = renderMissionList(state.activeSheet);
    else if (state.view === 'detail') content = renderCommitmentDetail(state.activeSheet, state.activeCommitmentIndex);

    root.innerHTML = content;

    var bc = document.getElementById('dip-breadcrumb');
    if (bc) bc.innerHTML = renderBreadcrumbItems();

    var selWrap = document.getElementById('dip-mission-select-wrap');
    if (selWrap) selWrap.innerHTML = renderMissionSelect();

    var printArea = document.getElementById('dip-print-area');
    if (printArea) {
      var printSid = state.view === 'hub' ? 'gc1m1' : state.activeSheet;
      printArea.innerHTML = renderPrintArea(printSid);
    }

    bindContentEvents();
    updateProgressUI();
  }

  function updateProgressUI() {
    if (!state.data) return;
    var c = overallCompletion(state.data);
    var fill = document.getElementById('dip-progress-fill');
    var label = document.getElementById('dip-progress-label');
    if (fill) fill.style.width = c.percent + '%';
    if (label) label.textContent = 'Collaborative fields: ' + c.percent + '% (' + c.filled + ' / ' + c.total + ')';
  }

  function setField(sid, rowIndex, field, value) {
    var sheet = state.data.sheets[sid];
    if (!sheet || !sheet.commitments[rowIndex]) return;
    var row = sheet.commitments[rowIndex];
    if (field.indexOf('terms.') === 0) {
      var parts = field.split('.');
      var tk = parts[1];
      var sub = parts[2];
      if (!row.terms) row.terms = {};
      if (!row.terms[tk]) row.terms[tk] = { measure: '', progress: '' };
      row.terms[tk][sub] = value;
    } else {
      row[field] = value;
    }
  }

  function bindContentEvents() {
    var root = document.getElementById('dip-app-root');
    if (!root) return;

    root.querySelectorAll('textarea').forEach(function(ta) {
      ta.addEventListener('input', function() {
        setField(ta.getAttribute('data-sheet'), parseInt(ta.getAttribute('data-row'), 10), ta.getAttribute('data-field'), ta.value);
        scheduleSave();
      });
    });

    root.querySelectorAll('.dip-hub-link').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        openHubPanel(btn.getAttribute('data-panel'));
      });
    });

    root.querySelectorAll('[data-term]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        state.activeTerm = btn.getAttribute('data-term');
        root.querySelectorAll('.dip-term-tab').forEach(function(t) {
          t.classList.toggle('active', t.getAttribute('data-term') === state.activeTerm);
        });
        root.querySelectorAll('.dip-term-panel').forEach(function(p) {
          p.classList.toggle('active', p.getAttribute('data-term-panel') === state.activeTerm);
        });
      });
    });
  }

  function handleNavClick(el) {
    var nav = el.getAttribute('data-nav');
    if (nav === 'hub') { navigate('hub'); return; }
    if (nav === 'mission') {
      navigate('mission', el.getAttribute('data-sheet') || state.activeSheet);
      return;
    }
    if (nav === 'detail') {
      navigate('detail', el.getAttribute('data-sheet'), parseInt(el.getAttribute('data-index'), 10));
      return;
    }
    if (nav === 'prev' && state.activeCommitmentIndex > 0) {
      navigate('detail', state.activeSheet, state.activeCommitmentIndex - 1);
      return;
    }
    if (nav === 'next') {
      var sheet = state.data.sheets[state.activeSheet];
      if (sheet && state.activeCommitmentIndex < sheet.commitments.length - 1) {
        navigate('detail', state.activeSheet, state.activeCommitmentIndex + 1);
      }
    }
  }

  function bindGlobalEvents() {
    var root = document.getElementById('dip-app-root');
    if (root) {
      root.addEventListener('click', function(e) {
        var navEl = e.target.closest('[data-nav]');
        if (navEl && !navEl.disabled) {
          handleNavClick(navEl);
        }
      });
    }

    var bc = document.getElementById('dip-breadcrumb');
    if (bc) {
      bc.addEventListener('click', function(e) {
        var btn = e.target.closest('button[data-nav]');
        if (btn) handleNavClick(btn);
      });
    }

    document.addEventListener('change', function(e) {
      if (e.target && e.target.id === 'dip-mission-select') {
        var sid = e.target.value;
        if (state.view === 'detail') navigate('detail', sid, 0);
        else navigate('mission', sid);
      }
    });

    document.getElementById('dip-save-now').addEventListener('click', function() {
      clearTimeout(state.saveTimer);
      doSave();
    });

    var importBtn = document.getElementById('dip-import-seed');
    if (importBtn) {
      importBtn.addEventListener('click', function() {
        if (!confirm('Merge grey DIP fields from the master seed and fill empty collaborative cells from the v2 spreadsheet export? Your existing edits are kept.')) return;
        state.data = mergeWithSeed(state.data);
        renderApp();
        scheduleSave();
      });
    }

    var printBtn = document.getElementById('dip-print');
    if (printBtn) {
      printBtn.addEventListener('click', function() {
        var printArea = document.getElementById('dip-print-area');
        if (printArea) {
          printArea.innerHTML = renderPrintArea(state.view === 'hub' ? state.activeSheet : state.activeSheet);
        }
        window.print();
      });
    }

    document.addEventListener('keydown', function(e) {
      if (state.view !== 'detail') return;
      if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;
      if (e.key === 'ArrowLeft') {
        var prev = document.querySelector('[data-nav="prev"]');
        if (prev && !prev.disabled) handleNavClick(prev);
      }
      if (e.key === 'ArrowRight') {
        var next = document.querySelector('[data-nav="next"]');
        if (next && !next.disabled) handleNavClick(next);
      }
    });

    window.addEventListener('message', function(ev) {
      if (!ev.data || ev.data.type !== 'dip-tracker-refresh') return;
      loadData().then(function() {
        renderApp();
      });
    });
  }

  function applyEmbedChrome() {
    if (!window.DIP_EMBED) return;
    document.body.classList.add('dip-embed');
    document.documentElement.classList.remove('dip-embed-pending');
  }

  function showMgmtBanner() {
    var can = !!(window.__authGuardCanManageSchool || window.__authGuardIsAdmin || window.__authGuardIsFacultyHead);
    var el = document.getElementById('dip-mgmt-banner');
    if (el && can) {
      el.classList.add('visible');
      el.textContent = 'Faculty Head view: track mission completion across all six sheets. Cloud sync is shared for the whole faculty.';
    }
  }

  function loadData() {
    setSyncStatus('Loading…');
    return DipTrackerService.loadTracker()
      .then(function(raw) {
        state.data = mergeWithSeed(raw);
        if (!raw || !raw.sheets || !Object.keys(raw.sheets).length) {
          return DipTrackerService.saveTracker(state.data).catch(function() { /* optional */ });
        }
      })
      .then(function() {
        setSyncStatus('Ready', true);
      })
      .catch(function(err) {
        state.data = mergeWithSeed(null);
        setSyncStatus(DipTrackerService.formatError(err), false);
      });
  }

  function buildSummaryText(maxLen) {
    maxLen = maxLen || 400;
    var parts = [];
    SHEETS.forEach(function(sh) {
      var sheet = state.data.sheets[sh.id];
      if (!sheet) return;
      var pct = sheetCompletion(sheet);
      parts.push(sh.short + ' ' + pct + '%');
      (sheet.commitments || []).slice(0, 1).forEach(function(row) {
        var t4 = row.terms && row.terms.t4 ? row.terms.t4.progress : '';
        if (cellFilled(t4)) parts.push(t4.slice(0, 120));
      });
    });
    var s = parts.join(' · ');
    return s.length <= maxLen ? s : s.slice(0, maxLen - 1) + '…';
  }

  window.DipTrackerApp = {
    getData: function() { return state.data; },
    getCompletion: function() { return state.data ? overallCompletion(state.data) : { percent: 0, filled: 0, total: 0 }; },
    getSheetCompletion: function(sid) {
      var sheet = state.data && state.data.sheets ? state.data.sheets[sid] : null;
      return sheet ? sheetCompletion(sheet) : 0;
    },
    buildSummaryText: function(max) {
      if (!state.data) return '';
      return buildSummaryText(max);
    }
  };

  function init() {
    applyEmbedChrome();
    showMgmtBanner();
    bindGlobalEvents();
    loadData().then(function() {
      state.view = 'hub';
      renderApp();
      notifyParent();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
