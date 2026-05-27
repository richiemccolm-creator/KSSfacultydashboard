/**
 * Auth guard: protects pages by checking for valid Supabase session and allowlist.
 * Include allowlist-check.js before this script.
 */
(function() {
  window.__authReady = false;
  window.__authGuardIsAdmin = false;
  window.__authGuardRole = 'teacher';
  window.__authGuardIsFacultyHead = false;
  window.__authGuardCanManageSchool = false;
  window.__authGuardCanViewSchoolWideTracking = false;
  function markAuthReady() {
    window.__authReady = true;
    try {
      window.dispatchEvent(new CustomEvent('auth-guard-ready'));
    } catch (e) {}
  }
  var path = window.location.pathname;
  if (path === '/' || path === '/index.html') path = 'faculty-hub.html';
  var redirect = encodeURIComponent(path + window.location.search);
  var loginBase = (typeof window.__authGuardLoginPath === 'string' && window.__authGuardLoginPath)
    ? window.__authGuardLoginPath
    : 'login.html';
  var loginUrl = loginBase + (redirect && redirect !== '/' ? '?redirect=' + redirect : '');

  if (typeof window.supabase === 'undefined' || window.supabase === null) {
    console.error('Auth guard: Supabase client not loaded. Include config.js and Supabase JS before auth-guard.js');
    window.location.replace(loginUrl);
    return;
  }

  window.supabase.auth.getSession().then(function(_a) {
    var session = _a.data.session;
    if (!session) {
      window.location.replace(loginUrl);
      return;
    }
    if (typeof window.checkAllowlist === 'function') {
      window.checkAllowlist().then(function(r) {
        if (!r.allowed) {
          window.supabase.auth.signOut();
          window.location.replace(loginUrl + (loginUrl.indexOf('?') >= 0 ? '&' : '?') + 'error=access_denied');
        } else {
          window.__authGuardIsAdmin = r.isAdmin;
          window.__authGuardRole = r.role || (r.isAdmin ? 'admin' : 'teacher');
          window.__authGuardIsFacultyHead = !!r.isFacultyHead;
          window.__authGuardCanManageSchool = !!r.canManageSchool || !!r.isAdmin;
          window.__authGuardCanViewSchoolWideTracking = !!r.canViewSchoolWideTracking || !!r.isAdmin;
          markAuthReady();
        }
      }).catch(function() {
        window.location.replace(loginUrl);
      });
      return;
    }
    markAuthReady();
  }).catch(function() {
    window.location.replace(loginUrl);
  });
})();
