/**
 * DIP Mission Tracker 25-26 — faculty-wide cloud persistence (one row per school year).
 */
(function() {
  var LOCAL_KEY = 'dipTracker25_26';

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

  function formatError(err) {
    if (!err) return 'Unknown error';
    var msg = err.message || String(err);
    if (err.code === '42501' || /policy|permission|denied/i.test(msg)) {
      return 'Permission denied. Sign in with your faculty account and run migration 20260527200000_dip_tracker.sql in Supabase.';
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

  function loadLocal() {
    try {
      var raw = localStorage.getItem(LOCAL_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function saveLocal(data) {
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(data));
    } catch (e) { /* ignore */ }
  }

  var SHEET_IDS = ['gc1m1', 'gc1m2', 'gc2m1', 'gc2m2', 'gc3m1', 'gc3m2'];
  var EDITABLE_KEYS = ['dataArea', 'research', 'resources', 'qiQuestions'];
  var TERM_KEYS = ['t1', 't2', 't3', 't4'];

  function cellFilled(val) {
    return val != null && String(val).trim().length > 0;
  }

  function rowCompletion(row) {
    var total = 0;
    var filled = 0;
    EDITABLE_KEYS.forEach(function(k) {
      total++;
      if (cellFilled(row[k])) filled++;
    });
    TERM_KEYS.forEach(function(tk) {
      var t = row.terms && row.terms[tk] ? row.terms[tk] : {};
      total += 2;
      if (cellFilled(t.measure)) filled++;
      if (cellFilled(t.progress)) filled++;
    });
    return { total: total, filled: filled };
  }

  function computeCompletion(data) {
    if (!data || !data.sheets) return { percent: 0, filled: 0, total: 0 };
    var total = 0;
    var filled = 0;
    SHEET_IDS.forEach(function(sid) {
      var sheet = data.sheets[sid];
      if (!sheet) return;
      (sheet.commitments || []).forEach(function(row) {
        var r = rowCompletion(row);
        total += r.total;
        filled += r.filled;
      });
    });
    return {
      percent: total ? Math.round((filled / total) * 100) : 0,
      filled: filled,
      total: total
    };
  }

  window.DipTrackerService = {
    LOCAL_KEY: LOCAL_KEY,
    isCloudEnabled: function() { return !!useSupabase(); },
    getSchoolYear: schoolYear,
    formatError: formatError,
    computeCompletion: computeCompletion,

    loadTracker: function(year) {
      year = year || schoolYear();
      return new Promise(function(resolve, reject) {
        if (!useSupabase()) {
          resolve(loadLocal());
          return;
        }
        getSession().then(function(session) {
          if (!session) { reject(new Error('Not authenticated')); return; }
          window.supabase.from('dip_tracker')
            .select('id, school_year, data, updated_at, created_at')
            .eq('school_year', year)
            .maybeSingle()
            .then(function(r) {
              if (r.error) { reject(r.error); return; }
              if (!r.data || !r.data.data) {
                resolve(loadLocal());
                return;
              }
              var data = r.data.data;
              if (typeof data === 'object') attachCloudMeta(data, r.data);
              resolve(data);
            });
        }).catch(reject);
      });
    },

    saveTracker: function(data, year) {
      year = year || schoolYear();
      data = data || {};
      data.lastUpdated = data.lastUpdated || new Date().toISOString();
      saveLocal(data);
      return new Promise(function(resolve, reject) {
        if (!useSupabase()) { resolve(null); return; }
        getSession().then(function(session) {
          if (!session) { reject(new Error('Not authenticated')); return; }
          var cloudId = data._cloudId;
          var payload = Object.assign({}, data);
          delete payload._cloudId;
          delete payload._cloudUpdatedAt;
          delete payload._cloudSchoolYear;
          var row = {
            school_year: year,
            data: payload,
            updated_by: session.user.id
          };
          var q = cloudId
            ? window.supabase.from('dip_tracker').update(row).eq('id', cloudId)
            : window.supabase.from('dip_tracker').upsert(row, { onConflict: 'school_year' });
          q.select('id, school_year, updated_at')
            .maybeSingle()
            .then(function(r) {
              if (r.error) { reject(r.error); return; }
              if (r.data && r.data.id) {
                data._cloudId = r.data.id;
                data._cloudUpdatedAt = r.data.updated_at;
                data._cloudSchoolYear = r.data.school_year;
                saveLocal(data);
              }
              resolve(r.data || null);
            });
        }).catch(reject);
      });
    }
  };
})();
