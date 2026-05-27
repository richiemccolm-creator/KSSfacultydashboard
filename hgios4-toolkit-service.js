/**
 * HGIOS 4 Toolkit service — cloud persistence (Faculty Head / admin, one row per school year).
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

  function canManageToolkit() {
    return !!(window.__authGuardCanManageSchool || window.__authGuardIsAdmin);
  }

  function formatError(err) {
    if (!err) return 'Unknown error';
    var msg = err.message || String(err);
    if (err.code === '42501' || /policy|permission|denied/i.test(msg)) {
      return 'Permission denied. Sign in as Faculty Head or admin, and run migration 20260527120000_hgios4_toolkit_management_rls.sql if cloud sync is new.';
    }
    return msg;
  }

  function attachCloudMeta(data, row) {
    if (!data || typeof data !== 'object' || !row) return data;
    data._cloudId = row.id;
    data._cloudUpdatedAt = row.updated_at;
    data._cloudSchoolYear = row.school_year;
    return data;
  }

  window.Hgios4ToolkitService = {
    isCloudEnabled: function() {
      return !!useSupabase();
    },

    canManage: canManageToolkit,

    getSchoolYear: schoolYear,

    formatError: formatError,

    listToolkitYears: function() {
      return new Promise(function(resolve, reject) {
        if (!useSupabase()) { resolve([]); return; }
        getSession().then(function(session) {
          if (!session) { reject(new Error('Not authenticated')); return; }
          window.supabase.from('hgios4_toolkit')
            .select('school_year, updated_at')
            .order('school_year', { ascending: false })
            .then(function(r) {
              if (r.error) { reject(r.error); return; }
              resolve(r.data || []);
            });
        }).catch(reject);
      });
    },

    loadToolkit: function(year) {
      year = year || schoolYear();
      return new Promise(function(resolve, reject) {
        if (!useSupabase()) { resolve(null); return; }
        getSession().then(function(session) {
          if (!session) { reject(new Error('Not authenticated')); return; }
          window.supabase.from('hgios4_toolkit')
            .select('id, school_year, data, updated_at, created_at')
            .eq('school_year', year)
            .maybeSingle()
            .then(function(r) {
              if (r.error) { reject(r.error); return; }
              if (!r.data || !r.data.data) { resolve(null); return; }
              var data = r.data.data;
              if (typeof data === 'object') attachCloudMeta(data, r.data);
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
          delete payload._cloudSchoolYear;
          payload.lastUpdated = payload.lastUpdated || new Date().toISOString();
          var row = {
            school_year: year,
            data: payload,
            updated_by: session.user.id
          };
          var q = cloudId
            ? window.supabase.from('hgios4_toolkit').update(row).eq('id', cloudId)
            : window.supabase.from('hgios4_toolkit').upsert(row, { onConflict: 'school_year' });
          q.select('id, school_year, updated_at')
            .maybeSingle()
            .then(function(r) {
              if (r.error) { reject(r.error); return; }
              resolve(r.data || null);
            });
        }).catch(reject);
      });
    }
  };
})();
