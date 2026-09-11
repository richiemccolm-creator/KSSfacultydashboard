/**
 * Faculty DM / MOD Planner — one JSON document per school year.
 * School managers write; all authenticated faculty can load.
 */
(function () {
  var LOCAL_KEY = 'dmPlanner26_27';
  var DEFAULT_YEAR = '2026-27';

  function useSupabase() {
    return window.supabase && window.supabase.auth && window.supabase.auth.getSession;
  }

  function getSession() {
    if (!window.supabase) return Promise.resolve(null);
    return window.supabase.auth.getSession().then(function (r) {
      return (r && r.data && r.data.session) || null;
    });
  }

  function schoolYear() {
    return DEFAULT_YEAR;
  }

  function canManage() {
    return !!(window.__authGuardCanManageSchool || window.__authGuardIsAdmin);
  }

  function ensureCanManage() {
    if (canManage()) return Promise.resolve(true);
    if (typeof window.checkAllowlist !== 'function') return Promise.resolve(false);
    return window.checkAllowlist().then(function (r) {
      if (r && (r.canManageSchool || r.isAdmin || r.isFacultyHead)) {
        window.__authGuardCanManageSchool = true;
        if (r.isAdmin) window.__authGuardIsAdmin = true;
        return true;
      }
      return false;
    }).catch(function () {
      return false;
    });
  }

  function formatError(err) {
    if (!err) return 'Unknown error';
    var msg = err.message || String(err);
    if (err.code === '42501' || /policy|permission|denied/i.test(msg)) {
      return 'Permission denied. Sign in with a faculty head account and run migration 20260911080000_dm_planner.sql in Supabase.';
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
    } catch (e) { /* ignore quota */ }
  }

  function cloneSeed() {
    var seed = window.DM_PLANNER_SEED;
    if (!seed) return { version: 1, schoolYear: DEFAULT_YEAR, meetings: [] };
    return JSON.parse(JSON.stringify(seed));
  }

  function hasMeetings(data) {
    return !!(data && Array.isArray(data.meetings) && data.meetings.length);
  }

  window.DmPlannerService = {
    LOCAL_KEY: LOCAL_KEY,
    DEFAULT_YEAR: DEFAULT_YEAR,
    isCloudEnabled: function () { return !!useSupabase(); },
    getSchoolYear: schoolYear,
    canManage: canManage,
    ensureCanManage: ensureCanManage,
    formatError: formatError,
    cloneSeed: cloneSeed,

    loadPlanner: function (year) {
      year = year || schoolYear();
      return new Promise(function (resolve, reject) {
        var finish = function (data) {
          if (!hasMeetings(data)) resolve(cloneSeed());
          else resolve(data);
        };
        if (!useSupabase()) {
          finish(loadLocal());
          return;
        }
        getSession().then(function (session) {
          if (!session) {
            reject(new Error('Not authenticated'));
            return;
          }
          window.supabase.from('dm_planner')
            .select('id, school_year, data, updated_at, created_at')
            .eq('school_year', year)
            .maybeSingle()
            .then(function (r) {
              if (r.error) {
                reject(r.error);
                return;
              }
              if (!r.data || !r.data.data) {
                finish(loadLocal());
                return;
              }
              var data = r.data.data;
              if (typeof data === 'object') attachCloudMeta(data, r.data);
              if (!hasMeetings(data)) finish(loadLocal());
              else resolve(data);
            });
        }).catch(reject);
      });
    },

    savePlanner: function (data, year) {
      year = year || schoolYear();
      data = data || {};
      data.lastUpdated = new Date().toISOString();
      saveLocal(data);
      return new Promise(function (resolve, reject) {
        if (!useSupabase()) {
          resolve(null);
          return;
        }
        ensureCanManage().then(function (ok) {
          if (!ok) {
            reject(new Error('Only faculty heads and admins can save the DM planner'));
            return;
          }
          getSession().then(function (session) {
            if (!session) {
              reject(new Error('Not authenticated'));
              return;
            }
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
              ? window.supabase.from('dm_planner').update(row).eq('id', cloudId)
              : window.supabase.from('dm_planner').upsert(row, { onConflict: 'school_year' });
            q.select('id, school_year, updated_at')
              .maybeSingle()
              .then(function (r) {
                if (r.error) {
                  reject(r.error);
                  return;
                }
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
      });
    }
  };
})();
