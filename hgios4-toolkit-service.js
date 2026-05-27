/**
 * HGIOS 4 Toolkit service — cloud persistence (admin-only, one record per school year).
 */
(function() {
  function useSupabase() {
    return window.supabase && window.supabase.auth && window.supabase.auth.getSession;
  }

  function getSession() {
    if (!window.supabase) return Promise.resolve(null);
    return window.supabase.auth.getSession().then(function(_a) {
      return _a && _a.data && _a.data.session || null;
    });
  }

  function schoolYear() {
    if (typeof window.getCurrentSchoolYear === 'function') return window.getCurrentSchoolYear();
    var d = new Date();
    var y = d.getFullYear();
    if (d.getMonth() >= 7) return y + '-' + String(y + 1).slice(-2);
    return (y - 1) + '-' + String(y).slice(-2);
  }

  window.Hgios4ToolkitService = {
    isCloudEnabled: function() {
      return !!useSupabase();
    },

    getSchoolYear: schoolYear,

    loadToolkit: function(year) {
      year = year || schoolYear();
      return new Promise(function(resolve, reject) {
        if (!useSupabase()) { resolve(null); return; }
        getSession().then(function(session) {
          if (!session) { reject(new Error('Not authenticated')); return; }
          window.supabase.from('hgios4_toolkit')
            .select('id, school_year, data, updated_at')
            .eq('school_year', year)
            .maybeSingle()
            .then(function(r) {
              if (r.error) { reject(r.error); return; }
              if (!r.data || !r.data.data) { resolve(null); return; }
              var data = r.data.data;
              if (typeof data === 'object') {
                data._cloudId = r.data.id;
                data._cloudUpdatedAt = r.data.updated_at;
              }
              resolve(data);
            });
        }).catch(reject);
      });
    },

    saveToolkit: function(data, year) {
      year = year || schoolYear();
      return new Promise(function(resolve, reject) {
        if (!useSupabase()) { reject(new Error('Supabase required')); return; }
        getSession().then(function(session) {
          if (!session) { reject(new Error('Not authenticated')); return; }
          var cloudId = data && data._cloudId;
          var payload = Object.assign({}, data || {});
          delete payload._cloudId;
          delete payload._cloudUpdatedAt;
          payload.lastUpdated = payload.lastUpdated || new Date().toISOString();
          var row = {
            school_year: year,
            data: payload,
            updated_by: session.user.id
          };
          var q = cloudId
            ? window.supabase.from('hgios4_toolkit').update(row).eq('id', cloudId)
            : window.supabase.from('hgios4_toolkit').upsert(row, { onConflict: 'school_year' });
          q.select('id, updated_at').then(function(r) {
            if (r.error) { reject(r.error); return; }
            var saved = r.data && r.data[0] ? r.data[0] : (r.data || null);
            resolve(saved);
          });
        }).catch(reject);
      });
    }
  };
})();
