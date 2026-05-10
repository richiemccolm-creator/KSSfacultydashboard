/**
 * Allowlist check: verifies the current user's email is in allowed_emails.
 * Returns { allowed, isAdmin, role, isFacultyHead, canManageSchool }.
 * Must be called after Supabase auth (session exists).
 */
(function() {
  var roleColumnSupported = null;

  function mapAllowlistResult(row) {
    var role = String((row && row.role) || '').trim().toLowerCase();
    if (!role) role = row && row.is_admin ? 'admin' : 'teacher';
    var isAdmin = !!(row && row.is_admin) || role === 'admin';
    var isFacultyHead = role === 'faculty_head';
    return {
      allowed: true,
      isAdmin: isAdmin,
      role: role,
      isFacultyHead: isFacultyHead,
      canManageSchool: isAdmin || isFacultyHead
    };
  }

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
      window.location.replace('login.html?signout=1');
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
        resolve({ allowed: false, isAdmin: false, role: 'teacher', isFacultyHead: false, canManageSchool: false });
        return;
      }
      window.supabase.auth.getSession().then(function(r) {
        var session = r.data.session;
        if (!session || !session.user || !session.user.email) {
          resolve({ allowed: false, isAdmin: false, role: 'teacher', isFacultyHead: false, canManageSchool: false });
          return;
        }
        var email = session.user.email;
        var fields = roleColumnSupported === false ? 'email, is_admin' : 'email, is_admin, role';
        window.supabase.from('allowed_emails')
          .select(fields)
          .eq('email', email)
          .maybeSingle()
          .then(function(res) {
            if (!res.error && res.data) {
              if (roleColumnSupported == null) roleColumnSupported = true;
              resolve(mapAllowlistResult(res.data));
              return;
            }
            var errMsg = String(res && res.error && (res.error.message || res.error.details) || '');
            if (roleColumnSupported === false || !/role/i.test(errMsg)) {
              resolve({ allowed: false, isAdmin: false, role: 'teacher', isFacultyHead: false, canManageSchool: false });
              return;
            }
            roleColumnSupported = false;
            window.supabase.from('allowed_emails')
              .select('email, is_admin')
              .eq('email', email)
              .maybeSingle()
              .then(function(legacyRes) {
                if (legacyRes.error || !legacyRes.data) {
                  resolve({ allowed: false, isAdmin: false, role: 'teacher', isFacultyHead: false, canManageSchool: false });
                  return;
                }
                resolve(mapAllowlistResult(legacyRes.data));
              });
          });
      });
    });
  };
})();
