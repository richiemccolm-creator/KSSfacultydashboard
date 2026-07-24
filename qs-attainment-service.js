/**
 * QS Attainment Dashboard service: yearly snapshots in Supabase.
 * Managers save/replace; all authenticated faculty can load for SIP review.
 */
(function () {
  function useSupabase() {
    return window.supabase && window.supabase.auth && window.supabase.auth.getSession;
  }

  function getSession() {
    if (!window.supabase) return Promise.resolve(null);
    return window.supabase.auth.getSession().then(function (r) {
      return (r && r.data && r.data.session) || null;
    });
  }

  /** Normalise "25-26" or "2025-26" → "2025-26" */
  function toSchoolYear(sessionOrYear) {
    var s = String(sessionOrYear || '').trim();
    var m = s.match(/^(\d{2})-(\d{2})$/);
    if (m) return '20' + m[1] + '-' + m[2];
    m = s.match(/^(20\d{2})-(\d{2})$/);
    if (m) return m[1] + '-' + m[2];
    m = s.match(/^(20\d{2})[-–\/](20)?(\d{2})$/);
    if (m) return m[1] + '-' + m[3];
    return s || guessCurrentSchoolYear();
  }

  function toSessionLabel(schoolYear) {
    var s = String(schoolYear || '').trim();
    var m = s.match(/^20(\d{2})-(\d{2})$/);
    if (m) return m[1] + '-' + m[2];
    return s;
  }

  function guessCurrentSchoolYear() {
    var d = new Date();
    var year = d.getFullYear();
    var month = d.getMonth();
    if (month >= 7) return year + '-' + String(year + 1).slice(-2);
    return (year - 1) + '-' + String(year).slice(-2);
  }

  function canManage() {
    if (window.__authGuardCanManageSchool || window.__authGuardIsAdmin) return true;
    try {
      if (window.SptStore && window.SptStore.ensure && window.SptStore.getRole) {
        var role = window.SptStore.getRole(window.SptStore.ensure());
        if (role && (role.canImport || role.canSetup)) return true;
      }
    } catch (e) {}
    return false;
  }

  function ensureCanManage() {
    if (canManage()) return Promise.resolve(true);
    if (typeof window.checkAllowlist === 'function') {
      return window.checkAllowlist().then(function (r) {
        if (r && (r.canManageSchool || r.isAdmin)) {
          window.__authGuardCanManageSchool = true;
          window.__authGuardIsAdmin = !!r.isAdmin;
          return true;
        }
        return false;
      }).catch(function () { return false; });
    }
    return Promise.resolve(false);
  }

  window.QsAttainmentService = {
    toSchoolYear: toSchoolYear,
    toSessionLabel: toSessionLabel,
    guessCurrentSchoolYear: guessCurrentSchoolYear,
    canManage: canManage,
    ensureCanManage: ensureCanManage,

    listSnapshots: function () {
      return new Promise(function (resolve, reject) {
        if (!useSupabase()) {
          resolve([]);
          return;
        }
        getSession().then(function (session) {
          if (!session) {
            reject(new Error('Not authenticated'));
            return;
          }
          window.supabase
            .from('qs_attainment_snapshots')
            .select('id, school_year, session_label, metadata, uploaded_by, created_at, updated_at')
            .order('school_year', { ascending: false })
            .then(function (r) {
              if (r.error) {
                reject(r.error);
                return;
              }
              resolve(r.data || []);
            });
        }).catch(reject);
      });
    },

    getSnapshot: function (schoolYear) {
      var year = toSchoolYear(schoolYear);
      return new Promise(function (resolve, reject) {
        if (!useSupabase()) {
          resolve(null);
          return;
        }
        getSession().then(function (session) {
          if (!session) {
            reject(new Error('Not authenticated'));
            return;
          }
          window.supabase
            .from('qs_attainment_snapshots')
            .select('id, school_year, session_label, data, metadata, uploaded_by, created_at, updated_at')
            .eq('school_year', year)
            .maybeSingle()
            .then(function (r) {
              if (r.error) {
                reject(r.error);
                return;
              }
              resolve(r.data || null);
            });
        }).catch(reject);
      });
    },

    /**
     * Upsert one snapshot per school year.
     * payload: { school_year|session, data, metadata }
     */
    saveSnapshot: function (payload) {
      return new Promise(function (resolve, reject) {
        if (!useSupabase()) {
          reject(new Error('Supabase required'));
          return;
        }
        ensureCanManage().then(function (ok) {
          if (!ok) {
            reject(new Error('Only faculty heads and admins can save attainment data'));
            return;
          }
          getSession().then(function (session) {
            if (!session) {
              reject(new Error('Not authenticated'));
              return;
            }
            var schoolYear = toSchoolYear(payload.school_year || payload.session);
            if (!schoolYear) {
              reject(new Error('Exam session / school year is required before saving'));
              return;
            }
            var data = payload.data || {};
            var meta = payload.metadata || {};
            var rows = data.rows || [];
            var comps = data.comps || [];
            var row = {
              school_year: schoolYear,
              session_label: toSessionLabel(schoolYear),
              uploaded_by: session.user.id,
              data: data,
              metadata: Object.assign(
                {
                  pupil_count: rows.length,
                  component_count: comps.length,
                  filename: data.filename || '',
                  pre_results: !!data.preResults,
                  saved_at: new Date().toISOString()
                },
                meta
              )
            };
            window.supabase
              .from('qs_attainment_snapshots')
              .upsert(row, { onConflict: 'school_year' })
              .select()
              .then(function (r) {
                if (r.error) {
                  reject(r.error);
                  return;
                }
                resolve((r.data && r.data[0]) || row);
              });
          }).catch(reject);
        }).catch(reject);
      });
    },

    deleteSnapshot: function (schoolYear) {
      var year = toSchoolYear(schoolYear);
      return new Promise(function (resolve, reject) {
        if (!useSupabase()) {
          reject(new Error('Supabase required'));
          return;
        }
        ensureCanManage().then(function (ok) {
          if (!ok) {
            reject(new Error('Only faculty heads and admins can delete attainment data'));
            return;
          }
          getSession().then(function (session) {
            if (!session) {
              reject(new Error('Not authenticated'));
              return;
            }
            window.supabase
              .from('qs_attainment_snapshots')
              .delete()
              .eq('school_year', year)
              .then(function (r) {
                if (r.error) reject(r.error);
                else resolve();
              });
          }).catch(reject);
        }).catch(reject);
      });
    }
  };
})();
