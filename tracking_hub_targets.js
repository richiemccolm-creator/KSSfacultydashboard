/**
 * Tracking Hub — Phase 5: faculty + per-class target scores
 */
(function(global) {
  'use strict';

  var TH = null;
  var STORAGE_KEY = 'trackingHubTargets';
  var STATE = { faculty: 3, classes: {} };

  function storageKey() {
    var email = (TH && TH.HUB && TH.HUB.currentUserEmail) || 'default';
    return STORAGE_KEY + ':' + email.toLowerCase();
  }

  function load() {
    try {
      var raw = localStorage.getItem(storageKey());
      if (raw) {
        var parsed = JSON.parse(raw);
        STATE.faculty = typeof parsed.faculty === 'number' ? parsed.faculty : 3;
        STATE.classes = parsed.classes || {};
      }
    } catch (e) { /* ignore */ }
  }

  function save() {
    try {
      localStorage.setItem(storageKey(), JSON.stringify(STATE));
    } catch (e) { /* ignore */ }
  }

  function classKey(yg, cls, subject) {
    return [yg || '', cls || '', subject || ''].join('|').toLowerCase();
  }

  function getFacultyTarget() {
    return STATE.faculty;
  }

  function getClassTarget(yg, cls, subject) {
    var key = classKey(yg, cls, subject);
    if (STATE.classes[key] != null) return STATE.classes[key];
    return STATE.faculty;
  }

  function setFacultyTarget(val) {
    var n = Number(val);
    if (!n || n < 1 || n > 4) return;
    STATE.faculty = Math.round(n * 100) / 100;
    save();
    syncUi();
    if (TH && TH.recalcFilteredState) TH.recalcFilteredState();
  }

  function setClassTarget(yg, cls, subject, val) {
    var n = Number(val);
    var key = classKey(yg, cls, subject);
    if (!val && val !== 0) {
      delete STATE.classes[key];
    } else if (n >= 1 && n <= 4) {
      STATE.classes[key] = Math.round(n * 100) / 100;
    }
    save();
  }

  function syncUi() {
    var input = document.getElementById('th-faculty-target');
    var chip = document.getElementById('th-target-chip');
    if (input) input.value = String(STATE.faculty);
    if (chip) chip.textContent = 'Target ' + STATE.faculty.toFixed(2);
  }

  function bindEvents() {
    var input = document.getElementById('th-faculty-target');
    if (input) {
      input.addEventListener('change', function() { setFacultyTarget(input.value); });
    }
    var reset = document.getElementById('th-target-reset');
    if (reset) {
      reset.addEventListener('click', function() {
        STATE.faculty = 3;
        STATE.classes = {};
        save();
        syncUi();
        if (TH && TH.recalcFilteredState) TH.recalcFilteredState();
        if (global.TrackingHubTabs) global.TrackingHubTabs.renderClasses();
        TH.toast('Targets reset to 3.00');
      });
    }
  }

  function init(hubApi) {
    TH = hubApi;
    load();
    bindEvents();
    syncUi();
  }

  function refreshStorage() {
    load();
    syncUi();
  }

  global.TrackingHubTargets = {
    init: init,
    refreshStorage: refreshStorage,
    getFacultyTarget: getFacultyTarget,
    getClassTarget: getClassTarget,
    setFacultyTarget: setFacultyTarget,
    setClassTarget: setClassTarget
  };
})(window);
