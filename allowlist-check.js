/**
 * Allowlist check: verifies the current user's email is in allowed_emails.
 * Returns { allowed: boolean, isAdmin: boolean }.
 * Must be called after Supabase auth (session exists).
 */
(function() {
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
