/**
 * Art & Drama DIP Mission Tracker 25-26 — in-hub collaborative tracker (6 Excel sheets).
 */
(function() {
  'use strict';

  var SHEETS = [
    { id: 'gc1m1', short: 'GC1 M1', label: 'Attendance', challenge: 1, mission: 1 },
    { id: 'gc1m2', short: 'GC1 M2', label: 'Behaviour & UNCRC', challenge: 1, mission: 2 },
    { id: 'gc2m1', short: 'GC2 M1', label: 'L&T Policy', challenge: 2, mission: 1 },
    { id: 'gc2m2', short: 'GC2 M2', label: 'Curriculum Challenge', challenge: 2, mission: 2 },
    { id: 'gc3m1', short: 'GC3 M1', label: 'Literacy & Numeracy BGE', challenge: 3, mission: 1 },
    { id: 'gc3m2', short: 'GC3 M2', label: 'Senior Phase', challenge: 3, mission: 2 }
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

  var GREY_KEYS = ['commitment', 'subject', 'lead', 'successMeasure'];
  var EDITABLE_KEYS = ['dataArea', 'research', 'resources', 'qiQuestions'];
  var TERM_KEYS = ['t1', 't2', 't3', 't4'];

  var state = {
    data: null,
    activeSheet: 'gc1m1',
    saveTimer: null,
    dirty: false
  };

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
    return { total: total, filled: filled };
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

  function renderSheet(sid) {
    var sheet = state.data.sheets[sid];
    if (!sheet) return '<p>No data for this mission.</p>';
    var links = (HUB_LINKS[sid] || []).map(function(l) {
      return '<button type="button" class="dip-hub-link" data-panel="' + escapeHtml(l.panel) + '">' + escapeHtml(l.label) + '</button>';
    }).join('');

    var rows = (sheet.commitments || []).map(function(row, ri) {
      var termsHtml = TERM_KEYS.map(function(tk) {
        var t = row.terms && row.terms[tk] ? row.terms[tk] : {};
        var label = tk.replace('t', 'Term ');
        return (
          '<td><div class="dip-term-label">' + label + ' — Measure</div><textarea data-sheet="' + sid + '" data-row="' + ri + '" data-field="terms.' + tk + '.measure">' + escapeHtml(t.measure) + '</textarea></td>' +
          '<td><div class="dip-term-label">' + label + ' — Progress</div><textarea data-sheet="' + sid + '" data-row="' + ri + '" data-field="terms.' + tk + '.progress">' + escapeHtml(t.progress) + '</textarea></td>'
        );
      }).join('');

      return (
        '<tr data-row-index="' + ri + '">' +
        '<td class="dip-readonly">' + escapeHtml(row.commitment) + '</td>' +
        '<td class="dip-readonly"><span class="dip-subject-tag ' + subjectClass(row.subject) + '">' + escapeHtml(row.subject) + '</span></td>' +
        '<td class="dip-readonly">' + escapeHtml(row.lead) + '</td>' +
        '<td class="dip-readonly">' + escapeHtml(row.successMeasure) + '</td>' +
        '<td><textarea data-sheet="' + sid + '" data-row="' + ri + '" data-field="dataArea">' + escapeHtml(row.dataArea) + '</textarea></td>' +
        '<td><textarea data-sheet="' + sid + '" data-row="' + ri + '" data-field="research">' + escapeHtml(row.research) + '</textarea></td>' +
        '<td><textarea data-sheet="' + sid + '" data-row="' + ri + '" data-field="resources">' + escapeHtml(row.resources) + '</textarea></td>' +
        '<td><textarea data-sheet="' + sid + '" data-row="' + ri + '" data-field="qiQuestions">' + escapeHtml(row.qiQuestions) + '</textarea></td>' +
        termsHtml +
        '</tr>'
      );
    }).join('');

    return (
      '<div class="dip-sheet-banner">' +
      '<h2>' + escapeHtml(sheet.challenge) + '</h2>' +
      '<p><strong>' + escapeHtml(sheet.mission) + '</strong></p>' +
      '<div class="dip-hub-links">' + links + '</div>' +
      '</div>' +
      '<div class="dip-table-wrap">' +
      '<table class="dip-grid">' +
      '<thead><tr>' +
      '<th>Commitment (DIP)</th><th>Subject</th><th>Lead</th><th>Success measure (DIP)</th>' +
      '<th>Data / area for improvement</th><th>Research evidence</th><th>Resources</th><th>QI / challenge questions</th>' +
      '<th colspan="2" class="dip-term-group">Term 1</th>' +
      '<th colspan="2" class="dip-term-group">Term 2</th>' +
      '<th colspan="2" class="dip-term-group">Term 3</th>' +
      '<th colspan="2" class="dip-term-group">Term 4</th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table></div>'
    );
  }

  function renderTabs() {
    var html = SHEETS.map(function(sh) {
      var sheet = state.data.sheets[sh.id];
      var pct = sheet ? sheetCompletion(sheet) : 0;
      var cls = sh.id === state.activeSheet ? 'dip-tab active' : 'dip-tab';
      return '<button type="button" class="' + cls + '" data-sheet="' + sh.id + '">' +
        escapeHtml(sh.short + ' · ' + sh.label) +
        '<span class="dip-tab-pct">' + pct + '% complete</span></button>';
    }).join('');
    document.getElementById('dip-tabs').innerHTML = html;
  }

  function renderActiveSheet() {
    document.getElementById('dip-sheet-content').innerHTML = renderSheet(state.activeSheet);
    bindSheetEvents();
  }

  function updateProgressUI() {
    var c = overallCompletion(state.data);
    var fill = document.getElementById('dip-progress-fill');
    var label = document.getElementById('dip-progress-label');
    if (fill) fill.style.width = c.percent + '%';
    if (label) label.textContent = 'Collaborative fields: ' + c.percent + '% (' + c.filled + ' / ' + c.total + ')';
    renderTabs();
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

  function bindSheetEvents() {
    document.querySelectorAll('#dip-sheet-content textarea').forEach(function(ta) {
      ta.addEventListener('input', function() {
        var sid = ta.getAttribute('data-sheet');
        var ri = parseInt(ta.getAttribute('data-row'), 10);
        var field = ta.getAttribute('data-field');
        setField(sid, ri, field, ta.value);
        scheduleSave();
      });
    });
    document.querySelectorAll('#dip-sheet-content .dip-hub-link').forEach(function(btn) {
      btn.addEventListener('click', function() {
        openHubPanel(btn.getAttribute('data-panel'));
      });
    });
  }

  function bindGlobalEvents() {
    document.getElementById('dip-tabs').addEventListener('click', function(e) {
      var btn = e.target.closest('[data-sheet]');
      if (!btn) return;
      state.activeSheet = btn.getAttribute('data-sheet');
      renderTabs();
      renderActiveSheet();
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
        renderActiveSheet();
        updateProgressUI();
        scheduleSave();
      });
    }

    var printBtn = document.getElementById('dip-print');
    if (printBtn) printBtn.addEventListener('click', function() { window.print(); });

    window.addEventListener('message', function(ev) {
      if (!ev.data || ev.data.type !== 'dip-tracker-refresh') return;
      loadData().then(function() {
        renderTabs();
        renderActiveSheet();
        updateProgressUI();
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
          return DipTrackerService.saveTracker(state.data).catch(function() { /* first save optional */ });
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
      renderTabs();
      renderActiveSheet();
      updateProgressUI();
      notifyParent();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
