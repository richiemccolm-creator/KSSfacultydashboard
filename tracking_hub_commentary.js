/**
 * Tracking Hub — Phase 5: class progress commentary (localStorage)
 */
(function(global) {
  'use strict';

  var STORAGE_KEY = 'trackingHubClassCommentary';

  function storageKey() {
    var email = (global.TrackingHub && global.TrackingHub.HUB.currentUserEmail) || 'default';
    return STORAGE_KEY + ':' + String(email).toLowerCase();
  }

  function readAll() {
    try {
      var raw = localStorage.getItem(storageKey());
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function writeAll(map) {
    try {
      localStorage.setItem(storageKey(), JSON.stringify(map || {}));
    } catch (e) { /* ignore */ }
  }

  function entryKey(teacher, yg, cls, subject) {
    return [teacher, yg, cls, subject].join('|');
  }

  function get(teacher, yg, cls, subject) {
    var all = readAll();
    return all[entryKey(teacher, yg, cls, subject)] || '';
  }

  function set(teacher, yg, cls, subject, text) {
    var all = readAll();
    var key = entryKey(teacher, yg, cls, subject);
    if (!String(text || '').trim()) delete all[key];
    else all[key] = String(text).trim();
    writeAll(all);
  }

  function renderEditor(teacher, yg, cls, subject) {
    var val = get(teacher, yg, cls, subject);
    return '<div class="th-class-commentary">' +
      '<label class="th-class-commentary-label">Progress commentary</label>' +
      '<textarea class="th-class-commentary-input" rows="2" placeholder="Narrative for this class…" ' +
      'data-commentary-teacher="' + escapeAttr(teacher) + '" data-commentary-yg="' + escapeAttr(yg) + '" ' +
      'data-commentary-cls="' + escapeAttr(cls) + '" data-commentary-subject="' + escapeAttr(subject) + '">' +
      escapeHtml(val) + '</textarea></div>';
  }

  function escapeHtml(v) {
    return String(v || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function escapeAttr(v) {
    return String(v || '').replace(/"/g, '&quot;');
  }

  function bindDelegation() {
    var body = document.getElementById('classes-teacher-body');
    if (!body || body._commentaryBound) return;
    body._commentaryBound = true;
    body.addEventListener('change', function(ev) {
      var ta = ev.target.closest('.th-class-commentary-input');
      if (!ta) return;
      set(
        ta.getAttribute('data-commentary-teacher'),
        ta.getAttribute('data-commentary-yg'),
        ta.getAttribute('data-commentary-cls'),
        ta.getAttribute('data-commentary-subject'),
        ta.value
      );
    });
  }

  function init() {
    bindDelegation();
  }

  global.TrackingHubCommentary = {
    init: init,
    get: get,
    set: set,
    renderEditor: renderEditor
  };
})(window);
