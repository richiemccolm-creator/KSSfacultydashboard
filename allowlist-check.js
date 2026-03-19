/**
 * Allowlist check: verifies the current user's email is in allowed_emails.
 * Returns { allowed: boolean, isAdmin: boolean }.
 * Must be called after Supabase auth (session exists).
 */
(function() {
  window.clearSupabaseAuth = function() {
    try {
      var keys = [];
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf('sb-') === 0) keys.push(k);
      }
      keys.forEach(function(k) { localStorage.removeItem(k); });
    } catch (e) {}
  };

  window.doSignOut = function() {
    var go = function() {
      window.clearSupabaseAuth();
      window.location.href = 'login.html';
    };
    if (window.supabase && window.supabase.auth) {
      window.supabase.auth.signOut().then(go).catch(go);
    } else {
      go();
    }
  };

  window.checkAllowlist = function() {
    return new Promise(function(resolve) {
      if (!window.supabase || !window.supabase.auth) {
        resolve({ allowed: false, isAdmin: false });
        return;
      }
      window.supabase.auth.getSession().then(function(r) {
        var session = r.data.session;
        if (!session || !session.user || !session.user.email) {
          resolve({ allowed: false, isAdmin: false });
          return;
        }
        var email = session.user.email;
        window.supabase.from('allowed_emails')
          .select('email, is_admin')
          .eq('email', email)
          .maybeSingle()
          .then(function(res) {
            if (res.error || !res.data) {
              resolve({ allowed: false, isAdmin: false });
              return;
            }
            resolve({
              allowed: true,
              isAdmin: !!res.data.is_admin
            });
          });
      });
    });
  };
})();
