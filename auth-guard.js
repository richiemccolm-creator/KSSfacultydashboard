/**
 * Auth guard: protects pages by checking for valid Supabase session and allowlist.
 * Include allowlist-check.js before this script.
 */
(function() {
  if (typeof window.supabase === 'undefined' || window.supabase === null) {
    console.error('Auth guard: Supabase client not loaded. Include config.js and Supabase JS before auth-guard.js');
    return;
  }
  var path = window.location.pathname;
  if (path === '/' || path === '/index.html') path = 'expressive_arts_faculty%20(10).html';
  var redirect = encodeURIComponent(path + window.location.search);
  var loginUrl = 'login.html' + (redirect && redirect !== '/' ? '?redirect=' + redirect : '');
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
        }
      });
    }
  });
})();
