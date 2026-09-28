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

  window.fhCanManage = canManage;
  window.fhEnforceAccess = enforceAccess;

  // Only decide once sign-in has finished. auth-guard.js sends anyone who is
  // signed out or not allowlisted to the login page itself, so a slow
  // connection must never be read as "not a faculty head".
  if (window.__authReady) enforceAccess();
  else window.addEventListener('auth-guard-ready', enforceAccess);
})();
