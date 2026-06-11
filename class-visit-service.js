/**
 * Class Visit Feedback service: CRUD for saved class visits in Supabase.
 * All authenticated faculty can view; authors and school managers can edit/delete.
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

  function schoolYearFromDate(dateStr) {
    if (window.getCurrentSchoolYear && !dateStr) return window.getCurrentSchoolYear();
    if (!dateStr) {
      var d = new Date();
      var year = d.getFullYear();
      var month = d.getMonth();
      if (month >= 7) return year + '-' + String(year + 1).slice(-2);
      return (year - 1) + '-' + String(year).slice(-2);
    }
    var parts = String(dateStr).slice(0, 10).split('-');
    if (parts.length < 3) return window.getCurrentSchoolYear ? window.getCurrentSchoolYear() : '';
    var y = parseInt(parts[0], 10);
    var m = parseInt(parts[1], 10) - 1;
    if (isNaN(y) || isNaN(m)) return window.getCurrentSchoolYear ? window.getCurrentSchoolYear() : '';
    if (m >= 7) return y + '-' + String(y + 1).slice(-2);
    return (y - 1) + '-' + String(y).slice(-2);
  }

  window.ClassVisitService = {
    schoolYearFromDate: schoolYearFromDate,

    getVisits: function(schoolYear) {
      return new Promise(function(resolve, reject) {
        if (!useSupabase()) { resolve([]); return; }
        getSession().then(function(session) {
          if (!session) { reject(new Error('Not authenticated')); return; }
          var q = window.supabase.from('class_visits')
            .select('id, school_year, saved_by, data, metadata, created_at, updated_at');
          if (schoolYear) q = q.eq('school_year', schoolYear);
          q.order('created_at', { ascending: false })
            .then(function(r) {
              if (r.error) { reject(r.error); return; }
              resolve(r.data || []);
            });
        }).catch(reject);
      });
    },

    /** Most recent in-progress draft for the signed-in user (cross-device resume). */
    getMyDraft: function() {
      return new Promise(function(resolve, reject) {
        if (!useSupabase()) { resolve(null); return; }
        getSession().then(function(session) {
          if (!session) { resolve(null); return; }
          window.supabase.from('class_visits')
            .select('id, school_year, saved_by, data, metadata, created_at, updated_at')
            .eq('saved_by', session.user.id)
            .eq('metadata->>status', 'draft')
            .order('updated_at', { ascending: false })
            .limit(1)
            .then(function(r) {
              if (r.error) { reject(r.error); return; }
              resolve(r.data && r.data[0] ? r.data[0] : null);
            });
        }).catch(reject);
      });
    },

    saveVisit: function(payload) {
      return new Promise(function(resolve, reject) {
        if (!useSupabase()) { reject(new Error('Supabase required')); return; }
        getSession().then(function(session) {
          if (!session) { reject(new Error('Not authenticated')); return; }
          var data = payload.data || {};
          var row = {
            school_year: payload.school_year || schoolYearFromDate(data.date),
            data: data,
            metadata: payload.metadata || {}
          };
          var q;
          if (payload.id) {
            q = window.supabase.from('class_visits').update(row).eq('id', payload.id);
          } else {
            row.saved_by = session.user.id;
            q = window.supabase.from('class_visits').insert(row);
          }
          q.select().then(function(r) {
            if (r.error) { reject(r.error); return; }
            resolve(r.data && r.data[0] ? r.data[0] : row);
          });
        }).catch(reject);
      });
    },

    deleteVisit: function(id) {
      return new Promise(function(resolve, reject) {
        if (!useSupabase()) { reject(new Error('Supabase required')); return; }
        getSession().then(function(session) {
          if (!session) { reject(new Error('Not authenticated')); return; }
          window.supabase.from('class_visits')
            .delete()
            .eq('id', id)
            .then(function(r) {
              if (r.error) reject(r.error);
              else resolve();
            });
        }).catch(reject);
      });
    }
  };
})();
