/**
 * Faculty Head Hub access control — faculty head / admin only.
 */
(function () {
  'use strict';

  function canManage() {
    return (
      !!window.__authGuardCanManageSchool ||
      !!window.__authGuardIsAdmin ||
      !!window.__authGuardIsFacultyHead
    );
  }

  function enforceAccess() {
    if (canManage()) return;
    window.location.replace('faculty-hub.html');
  }

  function onReady() {
    enforceAccess();
  }

  window.fhCanManage = canManage;
  window.fhEnforceAccess = enforceAccess;

  window.addEventListener('auth-guard-ready', onReady);

  (function waitForAuth() {
    var attempts = 0;
    function tick() {
      if (window.__authReady || attempts >= 24) {
        onReady();
        return;
      }
      attempts += 1;
      setTimeout(tick, 250);
    }
    tick();
  })();
})();
