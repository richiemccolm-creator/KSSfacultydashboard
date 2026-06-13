/**
 * FIP 26–27 Action Plan Timeline — tickable checklist with term filters and cloud save.
 */
(function(global) {
  'use strict';

  var STORAGE_KEY = 'dipActionPlan2627';
  var SAVE_MS = 400;

  var TERM_LABELS = {
    t1: 'Term 1 (Aug–Oct)',
    t2: 'Term 2 (Nov–Dec)',
    t3: 'Term 3 (Jan–Mar)',
    t4: 'Term 4 (Apr–Jun)'
  };

  var CHALLENGE_LABELS = {
    wellbeing: 'Wellbeing',
    progress: 'Progress',
    inclusion: 'Inclusion'
  };

  var state = {
    data: null,
    filter: 'all',
    termTab: 'all',
    saveTimer: null,
    bound: false
  };

  function seedSource() {
    return global.DIP_ACTION_PLAN_SEED_2627 || { version: 1, seedVersion: 0, schoolYear: '2026-27', items: [] };
  }

  function uid() {
    return 'custom_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
  }

  function currentTerm() {
    var m = new Date().getMonth();
    if (m >= 7 && m <= 9) return 't1';
    if (m >= 10 && m <= 11) return 't2';
    if (m >= 0 && m <= 2) return 't3';
    return 't4';
  }

  function normalizeItem(raw, source) {
    return {
      id: raw.id || uid(),
      challenge: raw.challenge || 'progress',
      mission: raw.mission || '',
      sprint: raw.sprint || '',
      text: raw.text || '',
      dueDate: raw.dueDate || '',
      dueLabel: raw.dueLabel || '',
      term: raw.term || 't4',
      done: !!raw.done,
      doneAt: raw.doneAt || null,
      notes: raw.notes || '',
      source: source || raw.source || 'seed',
      order: raw.order != null ? raw.order : 999
    };
  }

  function seedItems() {
    var s = seedSource();
    return (s.items || []).map(function(it) {
      var copy = normalizeItem(it, 'seed');
      copy.done = false;
      copy.doneAt = null;
      copy.notes = '';
      return copy;
    });
  }

  function mergeSeed(existing) {
    var seed = seedSource();
    var out = existing && typeof existing === 'object' ? existing : { version: 1, schoolYear: '2026-27', seedVersion: 0, items: [] };
    if (!Array.isArray(out.items)) out.items = [];

    if (out.items.length === 0) {
      out.seedVersion = seed.seedVersion || 1;
      out.items = seedItems();
      return out;
    }

    if ((out.seedVersion || 0) < (seed.seedVersion || 1)) {
      var byId = {};
      out.items.forEach(function(it) { byId[it.id] = it; });
      seed.items.forEach(function(raw) {
        if (!byId[raw.id]) {
          out.items.push(normalizeItem(raw, 'seed'));
        }
      });
      out.items.sort(function(a, b) { return (a.order || 0) - (b.order || 0); });
      out.seedVersion = seed.seedVersion || 1;
    }
    return out;
  }

  function loadStore() {
    if (global.DataService && typeof global.DataService.get === 'function') {
      return global.DataService.get(STORAGE_KEY).catch(function() { return null; });
    }
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return Promise.resolve(raw ? JSON.parse(raw) : null);
    } catch (e) {
      return Promise.resolve(null);
    }
  }

  function saveStore() {
    if (!state.data) return;
    var payload = state.data;
    if (global.DataService && typeof global.DataService.set === 'function') {
      global.DataService.set(STORAGE_KEY, payload).catch(function() {
        if (typeof global.backupToast === 'function') global.backupToast('Action plan save failed — sign in to sync');
      });
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (e) { /* ignore */ }
  }

  function scheduleSave() {
    if (state.saveTimer) clearTimeout(state.saveTimer);
    state.saveTimer = setTimeout(saveStore, SAVE_MS);
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function isOverdue(item) {
    if (item.done || !item.dueDate) return false;
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var due = new Date(item.dueDate + 'T23:59:59');
    return due < today;
  }

  function matchesFilter(item) {
    var f = state.filter;
    if (f === 'all') return true;
    if (f === 'this-term') return item.term === currentTerm();
    if (f === 'overdue') return isOverdue(item);
    if (f === 'wellbeing' || f === 'progress' || f === 'inclusion') return item.challenge === f;
    return true;
  }

  function matchesTermTab(item) {
    if (state.termTab === 'all') return true;
    return item.term === state.termTab;
  }

  function visibleItems() {
    if (!state.data || !state.data.items) return [];
    return state.data.items
      .filter(function(it) { return matchesFilter(it) && matchesTermTab(it); })
      .sort(function(a, b) {
        if (a.done !== b.done) return a.done ? 1 : -1;
        var da = a.dueDate || '9999';
        var db = b.dueDate || '9999';
        if (da !== db) return da.localeCompare(db);
        return (a.order || 0) - (b.order || 0);
      });
  }

  function stats() {
    var items = state.data && state.data.items ? state.data.items : [];
    var done = items.filter(function(it) { return it.done; }).length;
    var overdue = items.filter(function(it) { return isOverdue(it); }).length;
    var thisTerm = items.filter(function(it) { return it.term === currentTerm() && !it.done; }).length;
    return { total: items.length, done: done, overdue: overdue, thisTermPending: thisTerm };
  }

  function renderSummary() {
    var el = document.getElementById('dip2627-action-summary');
    if (!el || !state.data) return;
    var s = stats();
    var pct = s.total ? Math.round((s.done / s.total) * 100) : 0;
    el.innerHTML =
      '<div class="dip-ap-stats">' +
        '<span class="dip-ap-stat-main"><strong>' + s.done + '</strong> / ' + s.total + ' complete</span>' +
        (s.overdue ? '<span class="dip-ap-stat-warn">' + s.overdue + ' overdue</span>' : '') +
        '<span class="dip-ap-stat-muted">' + s.thisTermPending + ' pending this term</span>' +
      '</div>' +
      '<div class="dip-ap-progress-bar" role="progressbar" aria-valuenow="' + pct + '" aria-valuemin="0" aria-valuemax="100">' +
        '<div class="dip-ap-progress-fill" style="width:' + pct + '%"></div>' +
      '</div>';
  }

  function renderFilters() {
    var wrap = document.getElementById('dip2627-action-filters');
    if (!wrap) return;
    var filters = [
      { id: 'all', label: 'All' },
      { id: 'this-term', label: 'This term' },
      { id: 'wellbeing', label: 'Wellbeing' },
      { id: 'progress', label: 'Progress' },
      { id: 'inclusion', label: 'Inclusion' },
      { id: 'overdue', label: 'Overdue' }
    ];
    wrap.innerHTML = filters.map(function(f) {
      return '<button type="button" class="dip-ap-filter' + (state.filter === f.id ? ' active' : '') + '" data-filter="' + f.id + '">' + f.label + '</button>';
    }).join('');
  }

  function renderTermTabs() {
    var wrap = document.getElementById('dip2627-action-terms');
    if (!wrap) return;
    var tabs = [{ id: 'all', label: 'All terms' }];
    Object.keys(TERM_LABELS).forEach(function(k) {
      tabs.push({ id: k, label: TERM_LABELS[k] });
    });
    wrap.innerHTML = tabs.map(function(t) {
      return '<button type="button" class="dip-ap-term' + (state.termTab === t.id ? ' active' : '') + '" data-term="' + t.id + '">' + t.label + '</button>';
    }).join('');
  }

  function renderList() {
    var el = document.getElementById('dip2627-action-list');
    if (!el) return;
    var items = visibleItems();
    if (!items.length) {
      el.innerHTML = '<div class="dip-ap-empty">No actions match this filter. Try All or a different term.</div>';
      return;
    }
    el.innerHTML = items.map(function(it) {
      var overdue = isOverdue(it);
      var rowCls = 'dip-ap-row' + (it.done ? ' done' : '') + (overdue ? ' overdue' : '');
      var notesId = 'dip-ap-notes-' + it.id;
      var hasNotes = !!(it.notes && it.notes.trim());
      return (
        '<div class="' + rowCls + '" data-id="' + esc(it.id) + '">' +
          '<label class="dip-ap-check-wrap">' +
            '<input type="checkbox" class="dip-ap-check" data-id="' + esc(it.id) + '"' + (it.done ? ' checked' : '') + ' aria-label="Mark complete">' +
            '<span class="dip-ap-check-ui"></span>' +
          '</label>' +
          '<div class="dip-ap-body">' +
            '<div class="dip-ap-text">' + esc(it.text) + '</div>' +
            '<div class="dip-ap-meta">' +
              '<span class="dip-ap-pill dip-ap-pill-' + esc(it.challenge) + '">' + esc(CHALLENGE_LABELS[it.challenge] || it.challenge) + '</span>' +
              (it.sprint ? '<span class="dip-ap-sprint">' + esc(it.sprint) + '</span>' : '') +
              (it.dueLabel ? '<span class="dip-ap-due' + (overdue ? ' warn' : '') + '">' + esc(it.dueLabel) + '</span>' : '') +
              (it.source === 'custom' ? '<span class="dip-ap-custom-tag">Custom</span>' : '') +
            '</div>' +
            '<div class="dip-ap-notes-wrap' + (hasNotes ? ' has-notes' : '') + '">' +
              '<button type="button" class="dip-ap-notes-toggle" data-id="' + esc(it.id) + '">' + (hasNotes ? 'Edit notes' : 'Add notes') + '</button>' +
              '<textarea id="' + notesId + '" class="dip-ap-notes" data-id="' + esc(it.id) + '" placeholder="Evidence, meeting notes, next steps…" style="display:' + (hasNotes ? 'block' : 'none') + '">' + esc(it.notes) + '</textarea>' +
            '</div>' +
          '</div>' +
          (it.source === 'custom'
            ? '<button type="button" class="dip-ap-delete" data-id="' + esc(it.id) + '" title="Remove custom action">×</button>'
            : '') +
        '</div>'
      );
    }).join('');
  }

  function renderAll() {
    renderSummary();
    renderFilters();
    renderTermTabs();
    renderList();
  }

  function findItem(id) {
    if (!state.data || !state.data.items) return null;
    for (var i = 0; i < state.data.items.length; i++) {
      if (state.data.items[i].id === id) return state.data.items[i];
    }
    return null;
  }

  function toggleItem(id, done) {
    var it = findItem(id);
    if (!it) return;
    it.done = !!done;
    it.doneAt = it.done ? new Date().toISOString().slice(0, 10) : null;
    scheduleSave();
    renderAll();
  }

  function updateNotes(id, notes) {
    var it = findItem(id);
    if (!it) return;
    it.notes = notes;
    scheduleSave();
  }

  function addCustomAction() {
    var textEl = document.getElementById('dip2627-action-new-text');
    var termEl = document.getElementById('dip2627-action-new-term');
    var challengeEl = document.getElementById('dip2627-action-new-challenge');
    var dueEl = document.getElementById('dip2627-action-new-due');
    if (!textEl || !state.data) return;
    var text = (textEl.value || '').trim();
    if (!text) {
      if (typeof global.backupToast === 'function') global.backupToast('Enter an action description.');
      return;
    }
    var term = termEl ? termEl.value : currentTerm();
    var challenge = challengeEl ? challengeEl.value : 'progress';
    var dueDate = dueEl ? dueEl.value : '';
    var dueLabel = dueDate ? dueDate : (TERM_LABELS[term] || term);
    state.data.items.push(normalizeItem({
      id: uid(),
      challenge: challenge,
      mission: 'Custom',
      sprint: 'Faculty action',
      text: text,
      dueDate: dueDate,
      dueLabel: dueLabel,
      term: term,
      order: 9000 + state.data.items.length
    }, 'custom'));
    textEl.value = '';
    if (dueEl) dueEl.value = '';
    scheduleSave();
    renderAll();
    if (typeof global.backupToast === 'function') global.backupToast('Custom action added.');
  }

  function deleteCustom(id) {
    var it = findItem(id);
    if (!it || it.source !== 'custom') return;
    if (!confirm('Remove this custom action?')) return;
    state.data.items = state.data.items.filter(function(x) { return x.id !== id; });
    scheduleSave();
    renderAll();
  }

  function bindEvents() {
    if (state.bound) return;
    var section = document.getElementById('dip2627-action-plan-section');
    if (!section) return;
    state.bound = true;

    section.addEventListener('click', function(e) {
      var t = e.target;
      if (t.classList.contains('dip-ap-filter')) {
        state.filter = t.getAttribute('data-filter') || 'all';
        renderAll();
        return;
      }
      if (t.classList.contains('dip-ap-term')) {
        state.termTab = t.getAttribute('data-term') || 'all';
        renderAll();
        return;
      }
      if (t.classList.contains('dip-ap-notes-toggle')) {
        var nid = t.getAttribute('data-id');
        var ta = document.getElementById('dip-ap-notes-' + nid);
        if (ta) {
          var show = ta.style.display === 'none';
          ta.style.display = show ? 'block' : 'none';
          if (show) ta.focus();
        }
        return;
      }
      if (t.classList.contains('dip-ap-delete')) {
        deleteCustom(t.getAttribute('data-id'));
      }
    });

    section.addEventListener('change', function(e) {
      if (e.target.classList.contains('dip-ap-check')) {
        toggleItem(e.target.getAttribute('data-id'), e.target.checked);
      }
    });

    section.addEventListener('input', function(e) {
      if (e.target.classList.contains('dip-ap-notes')) {
        updateNotes(e.target.getAttribute('data-id'), e.target.value);
      }
    });

    var addBtn = document.getElementById('dip2627-action-add-btn');
    if (addBtn) {
      addBtn.addEventListener('click', addCustomAction);
    }
  }

  function applyUrlDefaults() {
    try {
      var params = new URLSearchParams(global.location.search);
      if (params.get('view') === 'actions' || params.get('panel') === 'dip-action-plan-2627') {
        state.filter = 'this-term';
        state.termTab = currentTerm();
      }
    } catch (e) { /* ignore */ }
  }

  function initActionPlan2627() {
    var section = document.getElementById('dip2627-action-plan-section');
    if (!section) return Promise.resolve();

    applyUrlDefaults();
    bindEvents();

    return loadStore().then(function(stored) {
      state.data = mergeSeed(stored);
      var termEl = document.getElementById('dip2627-action-new-term');
      if (termEl) termEl.value = currentTerm();
      renderAll();
      if (stored && (stored.seedVersion || 0) < (seedSource().seedVersion || 1)) {
        scheduleSave();
      } else if (!stored || !stored.items || !stored.items.length) {
        scheduleSave();
      }
    });
  }

  function getExportHtml() {
    if (!state.data || !state.data.items) return '';
    var items = state.data.items.slice().sort(function(a, b) { return (a.order || 0) - (b.order || 0); });
    var s = stats();
    var html = '<h2 style="font-size:1rem;color:#92400e;margin:1.5rem 0 .75rem;border-bottom:1px solid #f59e0b">Action Plan Timeline (' + s.done + ' / ' + s.total + ' complete)</h2>';
    html += '<p style="font-size:.75rem;color:#718096;margin-bottom:.75rem">Faculty Improvement Plan 2026–27 — tickable actions</p>';
    var lastTerm = '';
    items.forEach(function(it) {
      if (it.term !== lastTerm) {
        lastTerm = it.term;
        html += '<h3 style="font-size:.85rem;margin:1rem 0 .35rem;color:#1e2d4a">' + esc(TERM_LABELS[it.term] || it.term) + '</h3>';
      }
      var mark = it.done ? '☑' : '☐';
      html += '<p style="font-size:.8rem;margin:.25rem 0;line-height:1.5">' + mark + ' ' + esc(it.text);
      if (it.dueLabel) html += ' <em style="color:#64748b">(' + esc(it.dueLabel) + ')</em>';
      html += '</p>';
      if (it.notes && it.notes.trim()) {
        html += '<p style="font-size:.75rem;color:#475569;margin:0 0 .35rem 1.25rem;padding-left:.5rem;border-left:2px solid #cbd5e0">' + esc(it.notes).replace(/\n/g, '<br>') + '</p>';
      }
    });
    return html;
  }

  function getPayloadForBackup() {
    return state.data ? JSON.parse(JSON.stringify(state.data)) : null;
  }

  global.initActionPlan2627 = initActionPlan2627;
  global.renderActionPlan2627 = renderAll;
  global.dipActionPlan2627ExportHtml = getExportHtml;
  global.dipActionPlan2627GetData = getPayloadForBackup;

})(window);
