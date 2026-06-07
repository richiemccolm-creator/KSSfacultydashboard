/**
 * Tracking Hub — Phase 5: session snapshots for year-on-year comparison
 */
(function(global) {
  'use strict';

  var TH = null;
  var STORAGE_KEY = 'trackingHubSnapshots';
  var ACTIVE_SNAPSHOT = '';

  function storageKey() {
    var email = (TH && TH.HUB && TH.HUB.currentUserEmail) || 'default';
    return STORAGE_KEY + ':' + String(email).toLowerCase();
  }

  function readAll() {
    try {
      var raw = localStorage.getItem(storageKey());
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function writeAll(list) {
    try {
      localStorage.setItem(storageKey(), JSON.stringify(list || []));
    } catch (e) { /* ignore */ }
  }

  function currentSessionLabel() {
    var d = new Date();
    var y = d.getFullYear();
    var m = d.getMonth();
    var start = m >= 7 ? y : y - 1;
    return start + '–' + String(start + 1).slice(-2);
  }

  function buildSnapshot(label) {
    var rows = TH.HUB.filteredRows || [];
    var pupilKeys = new Set(rows.map(function(r) { return r.pupilKey; }));
    var atRisk = new Set();
    rows.forEach(function(r) {
      if (r.isAtRisk) atRisk.add(r.pupilKey + '|' + r.subject);
    });
    var avg = TH.avg(rows.map(function(r) { return r.scoreAvg; }));
    return {
      id: 'snap_' + Date.now(),
      label: label || currentSessionLabel(),
      savedAt: new Date().toISOString(),
      pupils: pupilKeys.size,
      atRisk: atRisk.size,
      avgScore: avg,
      rowCount: rows.length
    };
  }

  function saveSnapshot(label) {
    var snap = buildSnapshot(label);
    var list = readAll();
    list = list.filter(function(s) { return s.label !== snap.label; });
    list.unshift(snap);
    if (list.length > 6) list = list.slice(0, 6);
    writeAll(list);
    refreshSelect();
    renderCompareBanner();
    TH.toast('Snapshot saved: ' + snap.label);
    return snap;
  }

  function getActive() {
    if (!ACTIVE_SNAPSHOT) return null;
    return readAll().find(function(s) { return s.id === ACTIVE_SNAPSHOT; }) || null;
  }

  function refreshSelect() {
    var sel = document.getElementById('th-snapshot-select');
    if (!sel) return;
    var list = readAll();
    sel.innerHTML = '<option value="">Compare snapshot…</option>' +
      list.map(function(s) {
        return '<option value="' + s.id + '">' + TH.safeText(s.label) + ' (' + TH.safeText(s.savedAt.slice(0, 10)) + ')</option>';
      }).join('');
    if (ACTIVE_SNAPSHOT) sel.value = ACTIVE_SNAPSHOT;
  }

  function renderCompareBanner() {
    var el = document.getElementById('th-snapshot-banner');
    if (!el) return;
    var snap = getActive();
    if (!snap || !TH.HUB.lastSync) {
      el.classList.add('is-hidden');
      el.textContent = '';
      return;
    }
    var rows = TH.HUB.filteredRows || [];
    var pupilKeys = new Set(rows.map(function(r) { return r.pupilKey; }));
    var atRisk = new Set();
    rows.forEach(function(r) { if (r.isAtRisk) atRisk.add(r.pupilKey + '|' + r.subject); });
    var avg = TH.avg(rows.map(function(r) { return r.scoreAvg; }));
    var dPupils = pupilKeys.size - snap.pupils;
    var dRisk = atRisk.size - snap.atRisk;
    var dAvg = avg != null && snap.avgScore != null ? avg - snap.avgScore : null;
    el.classList.remove('is-hidden');
    el.innerHTML = '<i class="ti ti-history" aria-hidden="true"></i> vs <strong>' + TH.safeText(snap.label) +
      '</strong>: pupils ' + fmtDelta(dPupils) + ', at risk ' + fmtDelta(dRisk) +
      (dAvg != null ? ', avg ' + (dAvg >= 0 ? '+' : '') + dAvg.toFixed(2) : '');
  }

  function fmtDelta(n) {
    if (!n) return '±0';
    return (n > 0 ? '+' : '') + n;
  }

  function bindEvents() {
    var saveBtn = document.getElementById('th-snapshot-save');
    if (saveBtn) {
      saveBtn.addEventListener('click', function() {
        var labelInput = document.getElementById('th-snapshot-label');
        saveSnapshot(labelInput ? labelInput.value.trim() : '');
        if (labelInput) labelInput.value = '';
      });
    }
    var sel = document.getElementById('th-snapshot-select');
    if (sel) {
      sel.addEventListener('change', function() {
        ACTIVE_SNAPSHOT = sel.value || '';
        renderCompareBanner();
      });
    }
  }

  function init(hubApi) {
    TH = hubApi;
    bindEvents();
    refreshSelect();
    renderCompareBanner();
  }

  function onDataRefresh() {
    refreshSelect();
    renderCompareBanner();
  }

  global.TrackingHubSnapshot = {
    init: init,
    saveSnapshot: saveSnapshot,
    onDataRefresh: onDataRefresh,
    currentSessionLabel: currentSessionLabel
  };
})(window);
