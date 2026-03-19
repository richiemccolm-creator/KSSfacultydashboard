/**
 * Data service: reads/writes app data to Supabase instead of localStorage.
 * Falls back to localStorage when Supabase is not configured (e.g. local dev).
 * All data is scoped to the authenticated user via RLS.
 */
(function() {
  var DATA_TYPES = [
    'drama-v3', 'art-v2', 'academicCalendarEvents', 'bge_drama_reports_v1',
    'bge_art_reports_v1', 'bge_drama_tracker_export_v1', 'bge_art_tracker_export_v1',
    'dipSelfEvaluation', 'moderation-data'
  ];

  function useSupabase() {
    return window.supabase && window.supabase.auth && window.supabase.auth.getSession;
  }

  function getUserId() {
    if (!window.supabase) return null;
    var session = window.supabase.auth.getSession();
    if (session && session.then) return null;
    return (window.supabase.auth.session && window.supabase.auth.session()) ? window.supabase.auth.user().id : null;
  }

  window.DataService = {
    get: function(dataType) {
      return new Promise(function(resolve) {
        if (!useSupabase()) {
          try {
            var raw = localStorage.getItem(dataType);
            resolve(raw ? JSON.parse(raw) : null);
          } catch (e) {
            resolve(null);
          }
          return;
        }
        window.supabase.auth.getSession().then(function(_a) {
          var session = _a.data.session;
          if (!session) {
            resolve(null);
            return;
          }
          window.supabase.from('pupil_data')
            .select('data')
            .eq('user_id', session.user.id)
            .eq('data_type', dataType)
            .maybeSingle()
            .then(function(r) {
              if (r.error) {
                resolve(null);
                return;
              }
              resolve(r.data && r.data.data ? r.data.data : null);
            });
        });
      });
    },

    set: function(dataType, data) {
      return new Promise(function(resolve, reject) {
        if (!useSupabase()) {
          try {
            localStorage.setItem(dataType, typeof data === 'string' ? data : JSON.stringify(data));
            resolve();
          } catch (e) {
            reject(e);
          }
          return;
        }
        window.supabase.auth.getSession().then(function(_a) {
          var session = _a.data.session;
          if (!session) {
            reject(new Error('Not authenticated'));
            return;
          }
          var payload = { user_id: session.user.id, data_type: dataType, data: data };
          window.supabase.from('pupil_data')
            .upsert(payload, { onConflict: 'user_id,data_type' })
            .then(function(r) {
              if (r.error) reject(r.error);
              else resolve();
            });
        });
      });
    },

    getAll: function() {
      return new Promise(function(resolve) {
        if (!useSupabase()) {
          var out = {};
          DATA_TYPES.forEach(function(k) {
            try {
              var v = localStorage.getItem(k);
              if (v) out[k] = JSON.parse(v);
            } catch (e) {}
          });
          resolve(out);
          return;
        }
        window.supabase.auth.getSession().then(function(_a) {
          var session = _a.data.session;
          if (!session) {
            resolve({});
            return;
          }
          window.supabase.from('pupil_data')
            .select('data_type, data')
            .eq('user_id', session.user.id)
            .then(function(r) {
              var out = {};
              if (!r.error && r.data) {
                r.data.forEach(function(row) {
                  out[row.data_type] = row.data;
                });
              }
              resolve(out);
            });
        });
      });
    },

    exportAll: function() {
      return this.getAll().then(function(all) {
        return {
          version: 1,
          exportDate: new Date().toISOString(),
          source: 'Expressive Arts Faculty',
          'drama-v3': all['drama-v3'],
          'art-v2': all['art-v2'],
          'academicCalendarEvents': all['academicCalendarEvents'],
          'bge_drama_reports_v1': all['bge_drama_reports_v1'],
          'bge_art_reports_v1': all['bge_art_reports_v1'],
          'bge_drama_tracker_export_v1': all['bge_drama_tracker_export_v1'],
          'bge_art_tracker_export_v1': all['bge_art_tracker_export_v1'],
          'dipSelfEvaluation': all['dipSelfEvaluation'],
          'moderation-data': all['moderation-data']
        };
      });
    },

    importAll: function(data) {
      var self = this;
      var keys = Object.keys(data).filter(function(k) {
        return DATA_TYPES.indexOf(k) !== -1 && data[k] !== undefined;
      });
      if (keys.length === 0) return Promise.resolve();
      return Promise.all(keys.map(function(k) {
        return self.set(k, data[k]);
      }));
    },

    deleteAll: function() {
      return new Promise(function(resolve, reject) {
        if (!useSupabase()) {
          DATA_TYPES.forEach(function(k) { localStorage.removeItem(k); });
          resolve();
          return;
        }
        window.supabase.auth.getSession().then(function(_a) {
          var session = _a.data.session;
          if (!session) {
            reject(new Error('Not authenticated'));
            return;
          }
          window.supabase.from('pupil_data')
            .delete()
            .eq('user_id', session.user.id)
            .then(function(r) {
              if (r.error) reject(r.error);
              else resolve();
            });
        });
      });
    },

    getAllForAdmin: function() {
      return new Promise(function(resolve, reject) {
        if (!useSupabase()) { resolve([]); return; }
        window.supabase.auth.getSession().then(function(_a) {
          var session = _a.data.session;
          if (!session) { reject(new Error('Not authenticated')); return; }
          window.supabase.from('pupil_data')
            .select('user_id, data_type, data')
            .in('data_type', ['drama-v3', 'art-v2'])
            .then(function(r1) {
              if (r1.error) { reject(r1.error); return; }
              window.supabase.from('profiles')
            .select('id, email, display_name')
            .then(function(r2) {
              var profiles = {};
              if (!r2.error && r2.data) r2.data.forEach(function(p) { profiles[p.id] = p; });
              var out = (r1.data || []).map(function(row) {
                var p = profiles[row.user_id] || {};
                return {
                  user_id: row.user_id,
                  email: p.email,
                  teacherName: p.display_name || p.email || 'Unknown',
                  data_type: row.data_type,
                  data: row.data
                };
              });
              resolve(out);
            });
          });
        });
      });
    },

    getSharedCalendarEvents: function() {
      return new Promise(function(resolve, reject) {
        if (!useSupabase()) { resolve([]); return; }
        window.supabase.from('shared_calendar_events')
          .select('id, title, date, category')
          .order('date')
          .then(function(r) {
            if (r.error) { resolve([]); return; }
            resolve((r.data || []).map(function(e) { return { id: e.id, title: e.title, date: e.date, category: e.category, source: 'shared' }; }));
          });
      });
    },

    setSharedCalendarEvents: function(events) {
      if (!useSupabase()) return Promise.reject(new Error('Supabase required'));
      var rows = (events || []).map(function(e) {
        return { title: e.title || '', date: e.date || '', category: e.category || 'general' };
      });
      return window.supabase.from('shared_calendar_events').delete().neq('id', '00000000-0000-0000-0000-000000000000')
        .then(function() {
          if (rows.length === 0) return;
          return window.supabase.from('shared_calendar_events').insert(rows);
        })
        .then(function(r) {
          if (r && r.error) throw r.error;
        });
    },

    getCalendarMerged: function() {
      var self = this;
      return Promise.all([
        self.getSharedCalendarEvents(),
        self.get('academicCalendarEvents')
      ]).then(function(res) {
        var shared = res[0] || [];
        var personal = res[1];
        if (!Array.isArray(personal)) personal = [];
        var personalTagged = personal.map(function(e) { return Object.assign({}, e, { source: 'personal' }); });
        var combined = shared.concat(personalTagged);
        combined.sort(function(a, b) { return (a.date || '').localeCompare(b.date || ''); });
        return combined;
      });
    }
  };
})();
