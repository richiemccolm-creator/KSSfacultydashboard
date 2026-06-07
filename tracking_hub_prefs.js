/**
 * Tracking Hub — Phase 3: URL state persistence + filter presets (localStorage)
 */
(function(global) {
  'use strict';

  var TH = null;
  var URL_PENDING = null;
  var SYNC_TIMER = null;
  var PRESET_KEY = 'trackingHubPresets';

  function $(id) { return document.getElementById(id); }

  function getStorageKey() {
    var email = (TH.HUB.currentUserEmail || 'anonymous').toLowerCase();
    return PRESET_KEY + ':' + email;
  }

  function readPresets() {
    try {
      var raw = localStorage.getItem(getStorageKey());
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function writePresets(list) {
    try {
      localStorage.setItem(getStorageKey(), JSON.stringify(list || []));
    } catch (e) { /* ignore quota */ }
  }

  function splitList(val) {
    if (!val) return [];
    return String(val).split(',').map(function(s) { return s.trim(); }).filter(Boolean);
  }

  function joinList(arr) {
    return (arr || []).filter(Boolean).join(',');
  }

  function parseUrlState() {
    var params = new URLSearchParams(global.location.search || '');
    var state = {
      tab: params.get('tab') || '',
      yearGroups: splitList(params.get('yg')),
      classes: splitList(params.get('cls')),
      teachers: splitList(params.get('teacher')),
      subjects: splitList(params.get('subject')),
      trackingPeriods: splitList(params.get('tp')),
      riskBands: splitList(params.get('risk')),
      searchText: params.get('q') || ''
    };
    var hasFilters = state.yearGroups.length || state.classes.length || state.teachers.length ||
      state.subjects.length || state.trackingPeriods.length || state.riskBands.length || state.searchText;
    if (!state.tab && !hasFilters) return null;
    return state;
  }

  function filtersFromState(state) {
    if (!state) return null;
    return {
      yearGroups: state.yearGroups || [],
      classes: state.classes || [],
      teachers: state.teachers || [],
      subjects: state.subjects || [],
      trackingPeriods: state.trackingPeriods || [],
      riskBands: state.riskBands || [],
      searchText: state.searchText || ''
    };
  }

  function applyFiltersToHub(filters) {
    if (!filters) return;
    TH.FILTER_STATE.yearGroups = filters.yearGroups || [];
    TH.FILTER_STATE.classes = filters.classes || [];
    TH.FILTER_STATE.teachers = filters.teachers || [];
    TH.FILTER_STATE.subjects = filters.subjects || [];
    TH.FILTER_STATE.trackingPeriods = filters.trackingPeriods || [];
    TH.FILTER_STATE.riskBands = filters.riskBands || [];
    TH.FILTER_STATE.searchText = filters.searchText || '';
    var hidden = $('flt-searchText');
    if (hidden) hidden.value = TH.FILTER_STATE.searchText;
  }

  function applyUrlState(state) {
    if (!state) return;
    if (state.tab && ['overview', 'at-risk', 'classes', 'pupils', 'pivot'].indexOf(state.tab) >= 0) {
      if (state.tab === 'pivot' && TH.HUB.roleScoped) {
        TH.setView('overview');
      } else {
        TH.setView(state.tab);
      }
    }
    var filters = filtersFromState(state);
    if (filters) {
      applyFiltersToHub(filters);
      if (typeof TH.hydrateFilterControls === 'function') TH.hydrateFilterControls();
      TH.recalcFilteredState();
    }
  }

  function buildUrlParams() {
    var params = new URLSearchParams(global.location.search || '');
    var embed = params.get('embed');
    var next = new URLSearchParams();
    if (embed === '1' || embed === 'true') next.set('embed', embed);

    var view = TH.getActiveView();
    if (view && view !== 'overview') next.set('tab', view);

    var fs = TH.FILTER_STATE;
    if (fs.yearGroups && fs.yearGroups.length) next.set('yg', joinList(fs.yearGroups));
    if (fs.classes && fs.classes.length) next.set('cls', joinList(fs.classes));
    if (fs.teachers && fs.teachers.length) next.set('teacher', joinList(fs.teachers));
    if (fs.subjects && fs.subjects.length) next.set('subject', joinList(fs.subjects));
    if (fs.trackingPeriods && fs.trackingPeriods.length) next.set('tp', joinList(fs.trackingPeriods));
    if (fs.riskBands && fs.riskBands.length) next.set('risk', joinList(fs.riskBands));
    if (fs.searchText) next.set('q', fs.searchText);

    return next;
  }

  function syncToUrl() {
    if (SYNC_TIMER) clearTimeout(SYNC_TIMER);
    SYNC_TIMER = setTimeout(function() {
      try {
        var next = buildUrlParams();
        var qs = next.toString();
        var path = global.location.pathname + (qs ? '?' + qs : '');
        global.history.replaceState(null, '', path);
      } catch (e) { /* ignore */ }
    }, 120);
  }

  function refreshPresetSelect() {
    var sel = $('th-preset-select');
    if (!sel) return;
    var presets = readPresets();
    sel.innerHTML = '<option value="">Saved views…</option>' +
      presets.map(function(p) {
        return '<option value="' + TH.safeText(p.id) + '">' + TH.safeText(p.name) + '</option>';
      }).join('');
  }

  function savePreset(name) {
    var label = String(name || '').trim();
    if (!label) {
      TH.toast('Name your view first');
      return;
    }
    var presets = readPresets();
    var id = 'p_' + Date.now();
    presets.unshift({
      id: id,
      name: label,
      tab: TH.getActiveView(),
      filters: {
        yearGroups: (TH.FILTER_STATE.yearGroups || []).slice(),
        classes: (TH.FILTER_STATE.classes || []).slice(),
        teachers: (TH.FILTER_STATE.teachers || []).slice(),
        subjects: (TH.FILTER_STATE.subjects || []).slice(),
        trackingPeriods: (TH.FILTER_STATE.trackingPeriods || []).slice(),
        riskBands: (TH.FILTER_STATE.riskBands || []).slice(),
        searchText: TH.FILTER_STATE.searchText || ''
      },
      savedAt: new Date().toISOString()
    });
    if (presets.length > 12) presets = presets.slice(0, 12);
    writePresets(presets);
    refreshPresetSelect();
    var sel = $('th-preset-select');
    if (sel) sel.value = id;
    TH.toast('View saved');
  }

  function loadPreset(id) {
    var presets = readPresets();
    var preset = presets.find(function(p) { return p.id === id; });
    if (!preset) return;
    applyFiltersToHub(preset.filters || {});
    if (typeof TH.hydrateFilterControls === 'function') TH.hydrateFilterControls();
    if (preset.tab) {
      if (preset.tab === 'pivot' && TH.HUB.roleScoped) TH.setView('overview');
      else TH.setView(preset.tab);
    } else {
      TH.recalcFilteredState();
    }
    syncToUrl();
    TH.toast('Loaded “' + preset.name + '”');
  }

  function deletePreset(id) {
    var presets = readPresets().filter(function(p) { return p.id !== id; });
    writePresets(presets);
    refreshPresetSelect();
    TH.toast('View removed');
  }

  function bindEvents() {
    var saveBtn = $('th-preset-save');
    if (saveBtn) {
      saveBtn.addEventListener('click', function() {
        var input = $('th-preset-name');
        savePreset(input ? input.value : '');
        if (input) input.value = '';
      });
    }

    var sel = $('th-preset-select');
    if (sel) {
      sel.addEventListener('change', function() {
        if (!sel.value) return;
        loadPreset(sel.value);
      });
    }

    var delBtn = $('th-preset-delete');
    if (delBtn) {
      delBtn.addEventListener('click', function() {
        var selEl = $('th-preset-select');
        if (!selEl || !selEl.value) {
          TH.toast('Select a saved view to delete');
          return;
        }
        deletePreset(selEl.value);
        selEl.value = '';
      });
    }

    var printBtn = $('th-print-btn');
    if (printBtn) {
      printBtn.addEventListener('click', function() {
        if (TH.getActiveView() !== 'overview') TH.setView('overview');
        setTimeout(function() { global.print(); }, 150);
      });
    }
  }

  function init(hubApi) {
    TH = hubApi;
    URL_PENDING = parseUrlState();
    if (URL_PENDING && URL_PENDING.tab) {
      if (URL_PENDING.tab === 'pivot') {
        /* defer until role scope known */
      } else {
        TH.setView(URL_PENDING.tab);
      }
    }
    bindEvents();
    refreshPresetSelect();
  }

  function applyPendingUrlState() {
    if (!URL_PENDING) {
      TH.recalcFilteredState();
      return;
    }
    applyUrlState(URL_PENDING);
    URL_PENDING = null;
    syncToUrl();
  }

  global.TrackingHubPrefs = {
    init: init,
    syncToUrl: syncToUrl,
    applyPendingUrlState: applyPendingUrlState,
    refreshPresetSelect: refreshPresetSelect
  };
})(window);
