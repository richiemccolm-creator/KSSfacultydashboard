/**
 * Data service: reads/writes app data to Supabase instead of localStorage.
 * Falls back to localStorage when Supabase is not configured (e.g. local dev).
 * All data is scoped to the authenticated user via RLS.
 */
(function() {
  var DATA_TYPES = [
    'drama-v3', 'art-v2', 'academicCalendarEvents', 'bge_drama_reports_v1',
    'bge_art_reports_v1', 'bge_drama_tracker_export_v1', 'bge_art_tracker_export_v1',
    'dipSelfEvaluation', 'moderation-data',
    'plannerTimetable', 'plannerLessons', 'plannerWeekNotes', 'lessonPlanTemplates', 'plannerSchemesOfWork',
    'clplProgress', 'teacherTasksV1'
  ];

  function useSupabase() {
    return window.supabase && window.supabase.auth && window.supabase.auth.getSession;
  }
  function getSessionWithRetry(options) {
    var opts = options || {};
    var retries = opts.retries == null ? 1 : opts.retries;
    var delayMs = opts.delayMs == null ? 180 : opts.delayMs;
    function attempt(remaining, resolve) {
      window.supabase.auth.getSession().then(function(_a) {
        var session = _a && _a.data ? _a.data.session : null;
        if (session || remaining <= 0) {
          resolve(session || null);
          return;
        }
        setTimeout(function() { attempt(remaining - 1, resolve); }, delayMs);
      }).catch(function() {
        resolve(null);
      });
    }
    return new Promise(function(resolve) {
      if (!useSupabase()) { resolve(null); return; }
      attempt(retries, resolve);
    });
  }
  // null = unknown, true = priority columns available, false = legacy schema.
  var announcementsPrioritySchemaKnown = null;
  var announcementsFeaturedBannerSchemaKnown = null;
  function localTodayYMD() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function mapAnnouncementsList(rows) {
    var today = localTodayYMD();
    return (rows || []).filter(function(a) {
      var exp = a && a.expires_at ? String(a.expires_at).slice(0, 10) : '';
      return !exp || exp >= today;
    }).map(function(a) {
      return {
        id: a.id,
        title: a.title,
        body: a.body,
        expires_at: a.expires_at,
        created_at: a.created_at,
        priority: a.priority || 'none',
        highlight_priority: !!a.highlight_priority,
        featured_banner: !!a.featured_banner
      };
    });
  }
  function isAnnouncementsPrioritySchemaError(err) {
    if (!err) return false;
    var msg = String(err.message || err.details || '');
    return err.code === '42703' || /priority|highlight_priority/i.test(msg);
  }
  function isAnnouncementsFeaturedBannerSchemaError(err) {
    if (!err) return false;
    var msg = String(err.message || err.details || '');
    return err.code === '42703' || /featured_banner/i.test(msg);
  }
  function canUseAnnouncementsPriorityColumns() {
    if (announcementsPrioritySchemaKnown != null) {
      return Promise.resolve(announcementsPrioritySchemaKnown);
    }
    if (!useSupabase()) {
      announcementsPrioritySchemaKnown = false;
      return Promise.resolve(false);
    }
    return window.supabase.from('announcements')
      .select('priority, highlight_priority')
      .limit(1)
      .then(function(r) {
        if (r && r.error) {
          announcementsPrioritySchemaKnown = !isAnnouncementsPrioritySchemaError(r.error);
          return announcementsPrioritySchemaKnown;
        }
        announcementsPrioritySchemaKnown = true;
        return true;
      })
      .catch(function() {
        announcementsPrioritySchemaKnown = false;
        return false;
      });
  }
  function canUseAnnouncementsFeaturedBannerColumn() {
    if (announcementsFeaturedBannerSchemaKnown != null) {
      return Promise.resolve(announcementsFeaturedBannerSchemaKnown);
    }
    if (!useSupabase()) {
      announcementsFeaturedBannerSchemaKnown = false;
      return Promise.resolve(false);
    }
    return window.supabase.from('announcements')
      .select('featured_banner')
      .limit(1)
      .then(function(r) {
        if (r && r.error) {
          announcementsFeaturedBannerSchemaKnown = !isAnnouncementsFeaturedBannerSchemaError(r.error);
          return announcementsFeaturedBannerSchemaKnown;
        }
        announcementsFeaturedBannerSchemaKnown = true;
        return true;
      })
      .catch(function() {
        announcementsFeaturedBannerSchemaKnown = false;
        return false;
      });
  }
  function clearOtherFeaturedBanners(exceptId) {
    if (!useSupabase()) return Promise.resolve();
    return canUseAnnouncementsFeaturedBannerColumn().then(function(canUse) {
      if (!canUse) return;
      var q = window.supabase.from('announcements').update({ featured_banner: false }).eq('featured_banner', true);
      if (exceptId) q = q.neq('id', exceptId);
      return q.then(function(r) {
        if (r && r.error) throw r.error;
      });
    });
  }
  function ensureSessionForMutations() {
    return getSessionWithRetry({ retries: 4, delayMs: 250 }).then(function(session) {
      if (!session) throw new Error('Not authenticated');
      return session;
    });
  }
  function normalizeTrackerSubject(subject) {
    var value = String(subject == null ? '' : subject).trim().toLowerCase();
    if (!value) return null;
    if (value === 'art' || value === 'art & design' || value === 'art and design') return 'art';
    if (value === 'drama') return 'drama';
    if (value === 'photography' || value === 'photo') return 'photography';
    return null;
  }
  function currentAcademicYearLabel() {
    var now = new Date();
    var startYear = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
    return startYear + '-' + (startYear + 1);
  }
  function isMissingRpcError(err) {
    if (!err) return false;
    var code = String(err.code || '');
    var msg = String(err.message || err.details || '').toLowerCase();
    return code === '42883' || msg.indexOf('does not exist') !== -1 || msg.indexOf('could not find the function') !== -1;
  }
  function parseYearLevelNumber(value) {
    var raw = String(value == null ? '' : value).trim();
    var match = /^s?([1-6])$/i.exec(raw);
    if (!match) return null;
    return Number(match[1]);
  }

  window.DataService = {
    isUsingCloud: function() {
      return useSupabase();
    },
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
        getSessionWithRetry().then(function(session) {
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

    /** School-wide tracking viewers: read another user's pupil_data row (RLS enforced). */
    getForUser: function(userId, dataType) {
      return new Promise(function(resolve, reject) {
        if (!userId || !dataType) {
          resolve(null);
          return;
        }
        if (!useSupabase()) {
          resolve(null);
          return;
        }
        getSessionWithRetry().then(function(session) {
          if (!session) {
            reject(new Error('Not authenticated'));
            return;
          }
          window.supabase.from('pupil_data')
            .select('data, user_id')
            .eq('user_id', userId)
            .eq('data_type', dataType)
            .maybeSingle()
            .then(function(r) {
              if (r.error) {
                reject(r.error);
                return;
              }
              if (r.data && r.data.data) {
                window.supabase.from('audit_log').insert({
                  actor_id: session.user.id,
                  actor_email: session.user.email,
                  action: 'monitoring_viewed_user_tracker',
                  target_type: 'pupil_data'
                }).then(function() {});
              }
              resolve(r.data && r.data.data ? r.data.data : null);
            });
        });
      });
    },

    /** School managers: write another user's tracker blob (class transfer / promote). */
    setForUser: function(userId, dataType, data) {
      if (!userId || !dataType) {
        return Promise.reject(new Error('user_id and data_type are required'));
      }
      if (!useSupabase()) {
        return Promise.reject(new Error('Supabase required'));
      }
      return ensureSessionForMutations().then(function() {
        return window.supabase.rpc('admin_upsert_pupil_data_for_user', {
          p_user_id: userId,
          p_data_type: dataType,
          p_data: data || {}
        }).then(function(r) {
          if (r.error) throw r.error;
          return r.data || {};
        }).catch(function(err) {
          if (!isMissingRpcError(err)) throw err;
          return window.supabase.from('pupil_data')
            .upsert({ user_id: userId, data_type: dataType, data: data || {} }, { onConflict: 'user_id,data_type' })
            .then(function(fb) {
              if (fb.error) throw fb.error;
              return { user_id: userId, data_type: dataType, ok: true };
            });
        });
      });
    },

    getProfileByUserId: function(userId) {
      return new Promise(function(resolve) {
        if (!userId || !useSupabase()) {
          resolve(null);
          return;
        }
        window.supabase.from('profiles')
          .select('id, email, display_name')
          .eq('id', userId)
          .maybeSingle()
          .then(function(r) {
            if (r.error || !r.data) resolve(null);
            else resolve(r.data);
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
        window.supabase.auth.getSession()
          .then(function(_a) {
            var session = _a && _a.data && _a.data.session;
            if (!session) throw new Error('Not authenticated');
            var payload = { user_id: session.user.id, data_type: dataType, data: data };
            return window.supabase.from('pupil_data')
              .upsert(payload, { onConflict: 'user_id,data_type' });
          })
          .then(function(r) {
            if (r && r.error) throw r.error;
            resolve();
          })
          .catch(reject);
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
        getSessionWithRetry().then(function(session) {
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
          'moderation-data': all['moderation-data'],
          'plannerTimetable': all['plannerTimetable'],
          'plannerLessons': all['plannerLessons'],
          'plannerWeekNotes': all['plannerWeekNotes'],
          'lessonPlanTemplates': all['lessonPlanTemplates'],
          'plannerSchemesOfWork': all['plannerSchemesOfWork'],
          'clplProgress': all['clplProgress'],
          'teacherTasksV1': all['teacherTasksV1']
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

    /**
     * Monitoring hub + admin dashboard: returns tracker/planner payloads with teacher metadata.
     * Access is enforced by Supabase RLS policies.
     */
    getAllForMonitoring: function() {
      return new Promise(function(resolve, reject) {
        if (!useSupabase()) { resolve([]); return; }
        window.supabase.auth.getSession().then(function(_a) {
          var session = _a.data.session;
          if (!session) { reject(new Error('Not authenticated')); return; }
          var adminDataTypes = ['drama-v3', 'art-v2', 'moderation-data', 'plannerTimetable', 'plannerLessons', 'plannerWeekNotes'];
          window.supabase.from('pupil_data')
            .select('user_id, data_type, data')
            .in('data_type', adminDataTypes)
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
              if (!r1.error && (r1.data || []).length > 0) {
                window.supabase.from('audit_log').insert({
                  actor_id: session.user.id,
                  actor_email: session.user.email,
                  action: 'monitoring_viewed_all_pupil_data',
                  target_type: 'pupil_data'
                }).then(function() {});
              }
              resolve(out);
            });
          });
        });
      });
    },

    /** Backward compatible alias used by the existing Faculty Dashboard. */
    getAllForAdmin: function() {
      return this.getAllForMonitoring();
    },

    /** Admin only: returns staff list with planner, moderation, and tracker data grouped by user. Includes all profiles. */
    getStaffListWithWorkForAdmin: function() {
      return new Promise(function(resolve, reject) {
        if (!useSupabase()) { resolve([]); return; }
        window.supabase.auth.getSession().then(function(_a) {
          var session = _a.data.session;
          if (!session) { reject(new Error('Not authenticated')); return; }
          Promise.all([
            window.supabase.from('profiles').select('id, email, display_name'),
            window.supabase.from('pupil_data')
              .select('user_id, data_type, data')
              .in('data_type', ['drama-v3', 'art-v2', 'moderation-data', 'plannerTimetable', 'plannerLessons', 'plannerWeekNotes'])
          ]).then(function(results) {
            if (results[1].error) {
              reject(results[1].error);
              return;
            }
            var profilesRows = results[0].error ? [] : (results[0].data || []);
            var profiles = profilesRows.reduce(function(acc, p) {
              acc[p.id] = p;
              return acc;
            }, {});
            var rows = results[1].data || [];
            var byUser = {};
            Object.keys(profiles).forEach(function(id) {
              var p = profiles[id];
              byUser[id] = {
                user_id: id,
                teacherName: p.display_name || p.email || 'Unknown',
                email: p.email || '',
                drama: null,
                art: null,
                moderation: null,
                planner: { timetable: null, lessons: null, weekNotes: null }
              };
            });
            rows.forEach(function(r) {
              if (!byUser[r.user_id]) {
                byUser[r.user_id] = {
                  user_id: r.user_id,
                  teacherName: 'Unknown',
                  email: '',
                  drama: null,
                  art: null,
                  moderation: null,
                  planner: { timetable: null, lessons: null, weekNotes: null }
                };
              }
              var u = byUser[r.user_id];
              if (r.data_type === 'drama-v3') u.drama = r.data;
              else if (r.data_type === 'art-v2') u.art = r.data;
              else if (r.data_type === 'moderation-data') u.moderation = r.data;
              else if (r.data_type === 'plannerTimetable') u.planner.timetable = r.data;
              else if (r.data_type === 'plannerLessons') u.planner.lessons = r.data;
              else if (r.data_type === 'plannerWeekNotes') u.planner.weekNotes = r.data;
            });
            resolve(Object.values(byUser).sort(function(a, b) { return (a.teacherName || '').localeCompare(b.teacherName || ''); }));
          }).catch(reject);
        });
      });
    },

    getSharedCalendarEvents: function() {
      return new Promise(function(resolve, reject) {
        if (!useSupabase()) { resolve([]); return; }
        window.supabase.from('shared_calendar_events')
          .select('id, title, date, category, description, created_at')
          .order('date')
          .then(function(r) {
            if (r.error) { resolve([]); return; }
            resolve((r.data || []).map(function(e) {
              return {
                id: e.id,
                title: e.title,
                date: e.date,
                category: e.category,
                description: e.description || '',
                created_at: e.created_at || null,
                source: 'shared'
              };
            }));
          });
      });
    },

    getNotificationReads: function() {
      var localKey = 'facultyHubNotificationReads';
      return new Promise(function(resolve) {
        if (!useSupabase()) {
          try {
            var raw = localStorage.getItem(localKey);
            resolve(raw ? JSON.parse(raw) : []);
          } catch (e) {
            resolve([]);
          }
          return;
        }
        getSessionWithRetry({ retries: 4, delayMs: 250 }).then(function(session) {
          if (!session) { resolve([]); return; }
          window.supabase.from('notification_reads')
            .select('item_type, item_id, read_at')
            .then(function(r) {
              if (r.error) { resolve([]); return; }
              resolve(r.data || []);
            });
        }).catch(function() { resolve([]); });
      });
    },

    markNotificationsRead: function(items) {
      var list = Array.isArray(items) ? items : [];
      if (!list.length) return Promise.resolve([]);
      var localKey = 'facultyHubNotificationReads';
      var now = new Date().toISOString();
      var normalized = list.map(function(item) {
        return {
          item_type: String(item.item_type || '').trim(),
          item_id: String(item.item_id || '').trim(),
          read_at: now
        };
      }).filter(function(item) {
        var t = item.item_type;
        return (
          t === 'announcement' ||
          t === 'calendar_event' ||
          t === 'calendar_request_pending' ||
          t === 'calendar_request_approved' ||
          t === 'calendar_request_rejected'
        ) && item.item_id;
      });
      if (!normalized.length) return Promise.resolve([]);

      if (!useSupabase()) {
        try {
          var existing = [];
          try {
            var raw = localStorage.getItem(localKey);
            existing = raw ? JSON.parse(raw) : [];
          } catch (e) { existing = []; }
          var byKey = {};
          (existing || []).forEach(function(row) {
            var key = String(row.item_type || '') + ':' + String(row.item_id || '');
            if (key !== ':') byKey[key] = row;
          });
          normalized.forEach(function(row) {
            byKey[row.item_type + ':' + row.item_id] = row;
          });
          localStorage.setItem(localKey, JSON.stringify(Object.keys(byKey).map(function(k) { return byKey[k]; })));
        } catch (e) {}
        return Promise.resolve(normalized);
      }

      return ensureSessionForMutations().then(function(session) {
        var rows = normalized.map(function(item) {
          return {
            user_id: session.user.id,
            item_type: item.item_type,
            item_id: item.item_id,
            read_at: item.read_at
          };
        });
        return window.supabase.from('notification_reads')
          .upsert(rows, { onConflict: 'user_id,item_type,item_id' })
          .then(function(r) {
            if (r.error) throw r.error;
            return normalized;
          });
      });
    },

    setSharedCalendarEvents: function(events) {
      if (!useSupabase()) return Promise.reject(new Error('Supabase required'));
      var rows = (events || []).map(function(e) {
        var desc = e.description;
        if (desc == null || String(desc).trim() === '') desc = null;
        else desc = String(desc).trim();
        return {
          title: e.title || '',
          date: e.date || '',
          category: e.category || 'general',
          description: desc
        };
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
    },

    getAnnouncements: function() {
      return new Promise(function(resolve) {
        if (!useSupabase()) { resolve([]); return; }
        getSessionWithRetry({ retries: 4, delayMs: 250 }).then(function(session) {
          if (!session) { resolve([]); return; }
          Promise.all([
            canUseAnnouncementsPriorityColumns(),
            canUseAnnouncementsFeaturedBannerColumn()
          ]).then(function(flags) {
            var canUsePriority = flags[0];
            var canUseFeatured = flags[1];
            var fields = ['id', 'title', 'body', 'expires_at', 'created_at'];
            if (canUsePriority) fields.push('priority', 'highlight_priority');
            if (canUseFeatured) fields.push('featured_banner');
            window.supabase.from('announcements')
              .select(fields.join(', '))
              .order('created_at', { ascending: false })
              .then(function(r) {
                if (!r.error) {
                  resolve(mapAnnouncementsList(r.data || []));
                  return;
                }
                if (canUseFeatured && isAnnouncementsFeaturedBannerSchemaError(r.error)) {
                  announcementsFeaturedBannerSchemaKnown = false;
                  canUseFeatured = false;
                }
                if (canUsePriority && isAnnouncementsPrioritySchemaError(r.error)) {
                  announcementsPrioritySchemaKnown = false;
                  canUsePriority = false;
                }
                var retryFields = ['id', 'title', 'body', 'expires_at', 'created_at'];
                if (canUsePriority) retryFields.push('priority', 'highlight_priority');
                if (canUseFeatured) retryFields.push('featured_banner');
                window.supabase.from('announcements')
                  .select(retryFields.join(', '))
                  .order('created_at', { ascending: false })
                  .then(function(retry) {
                    if (retry.error) { resolve([]); return; }
                    var rows = (retry.data || []).map(function(a) {
                      return Object.assign({}, a, {
                        priority: a.priority || 'none',
                        highlight_priority: !!a.highlight_priority,
                        featured_banner: !!a.featured_banner
                      });
                    });
                    resolve(mapAnnouncementsList(rows));
                  });
              });
          });
        }).catch(function() {
          resolve([]);
        });
      });
    },

    createAnnouncement: function(obj) {
      if (!useSupabase()) return Promise.reject(new Error('Supabase required'));
      var priority = String(obj.priority || 'none').toLowerCase();
      if (['none', 'low', 'medium', 'high'].indexOf(priority) === -1) priority = 'none';
      var featuredBanner = !!obj.featured_banner;
      var baseRow = {
        title: (obj.title || '').trim(),
        body: (obj.body || '').trim() || null,
        expires_at: obj.expires_at || null
      };
      return ensureSessionForMutations().then(function() {
        return Promise.all([
          canUseAnnouncementsPriorityColumns(),
          canUseAnnouncementsFeaturedBannerColumn()
        ]).then(function(flags) {
          var canUsePriority = flags[0];
          var canUseFeatured = flags[1];
          var row = Object.assign({}, baseRow);
          if (canUsePriority) {
            row.priority = priority;
            row.highlight_priority = !!obj.highlight_priority;
          }
          if (canUseFeatured) row.featured_banner = featuredBanner;
          var prep = featuredBanner && canUseFeatured ? clearOtherFeaturedBanners(null) : Promise.resolve();
          return prep.then(function() {
            return window.supabase.from('announcements').insert(row).then(function(r) {
              if (!r.error) { return; }
              if (canUseFeatured && isAnnouncementsFeaturedBannerSchemaError(r.error)) {
                announcementsFeaturedBannerSchemaKnown = false;
                delete row.featured_banner;
                return window.supabase.from('announcements').insert(row).then(function(rFb) {
                  if (rFb.error) throw rFb.error;
                });
              }
              if (canUsePriority && isAnnouncementsPrioritySchemaError(r.error)) {
                announcementsPrioritySchemaKnown = false;
                delete row.priority;
                delete row.highlight_priority;
                return window.supabase.from('announcements').insert(baseRow).then(function(r2) {
                  if (r2.error) throw r2.error;
                });
              }
              throw r.error;
            });
          });
        });
      });
    },

    updateAnnouncement: function(id, obj) {
      if (!useSupabase()) return Promise.reject(new Error('Supabase required'));
      var priority = String(obj.priority || 'none').toLowerCase();
      if (['none', 'low', 'medium', 'high'].indexOf(priority) === -1) priority = 'none';
      var featuredBanner = !!obj.featured_banner;
      var baseRow = {
        title: (obj.title || '').trim(),
        body: (obj.body || '').trim() || null,
        expires_at: obj.expires_at || null
      };
      return ensureSessionForMutations().then(function() {
        return Promise.all([
          canUseAnnouncementsPriorityColumns(),
          canUseAnnouncementsFeaturedBannerColumn()
        ]).then(function(flags) {
          var canUsePriority = flags[0];
          var canUseFeatured = flags[1];
          var row = Object.assign({}, baseRow);
          if (canUsePriority) {
            row.priority = priority;
            row.highlight_priority = !!obj.highlight_priority;
          }
          if (canUseFeatured) row.featured_banner = featuredBanner;
          var prep = featuredBanner && canUseFeatured ? clearOtherFeaturedBanners(id) : Promise.resolve();
          return prep.then(function() {
            return window.supabase.from('announcements').update(row).eq('id', id).then(function(r) {
              if (!r.error) { return; }
              if (canUseFeatured && isAnnouncementsFeaturedBannerSchemaError(r.error)) {
                announcementsFeaturedBannerSchemaKnown = false;
                delete row.featured_banner;
                return window.supabase.from('announcements').update(row).eq('id', id).then(function(rFb) {
                  if (rFb.error) throw rFb.error;
                });
              }
              if (canUsePriority && isAnnouncementsPrioritySchemaError(r.error)) {
                announcementsPrioritySchemaKnown = false;
                delete row.priority;
                delete row.highlight_priority;
                return window.supabase.from('announcements').update(baseRow).eq('id', id).then(function(r2) {
                  if (r2.error) throw r2.error;
                });
              }
              throw r.error;
            });
          });
        });
      });
    },

    deleteAnnouncement: function(id) {
      if (!useSupabase()) return Promise.reject(new Error('Supabase required'));
      return ensureSessionForMutations().then(function() {
        return window.supabase.from('announcements').delete().eq('id', id).then(function(r) {
          if (r.error) throw r.error;
        });
      });
    },

    getAnnouncementsSchemaSupport: function() {
      if (!useSupabase()) return Promise.resolve({ priorityColumns: false, featuredBannerColumn: false });
      return Promise.all([
        canUseAnnouncementsPriorityColumns(),
        canUseAnnouncementsFeaturedBannerColumn()
      ]).then(function(flags) {
        return { priorityColumns: !!flags[0], featuredBannerColumn: !!flags[1] };
      });
    },

    listDepartmentMeetings: function() {
      return new Promise(function(resolve) {
        if (!useSupabase()) {
          resolve([]);
          return;
        }
        window.supabase.from('department_meetings')
          .select('id, meeting_date, title, status, agenda_rows, minutes_recording_status, minutes_last_updated_by, minutes_updated_at, created_at, updated_at')
          .order('meeting_date', { ascending: false })
          .then(function(r) {
            if (r.error) {
              resolve([]);
              return;
            }
            resolve(r.data || []);
          });
      });
    },

    getDepartmentMeeting: function(id) {
      return new Promise(function(resolve, reject) {
        if (!useSupabase()) {
          resolve(null);
          return;
        }
        window.supabase.from('department_meetings')
          .select('id, meeting_date, title, status, agenda_rows, minutes_recording_status, minutes_last_updated_by, minutes_updated_at, created_at, updated_at')
          .eq('id', id)
          .maybeSingle()
          .then(function(r) {
            if (r.error) {
              reject(r.error);
              return;
            }
            resolve(r.data || null);
          });
      });
    },

    createDepartmentMeeting: function(obj) {
      if (!useSupabase()) return Promise.reject(new Error('Supabase required'));
      var row = {
        meeting_date: obj.meeting_date,
        title: (obj.title != null ? String(obj.title) : '').trim(),
        status: obj.status === 'published' ? 'published' : 'draft',
        agenda_rows: Array.isArray(obj.agenda_rows) ? obj.agenda_rows : []
      };
      return window.supabase.from('department_meetings').insert(row).select('id').single().then(function(r) {
        if (r.error) throw r.error;
        return r.data;
      });
    },

    updateDepartmentMeeting: function(id, obj) {
      if (!useSupabase()) return Promise.reject(new Error('Supabase required'));
      var row = {};
      if (obj.meeting_date != null) row.meeting_date = obj.meeting_date;
      if (obj.title != null) row.title = String(obj.title).trim();
      if (obj.status != null) row.status = obj.status === 'published' ? 'published' : 'draft';
      if (obj.agenda_rows != null) row.agenda_rows = Array.isArray(obj.agenda_rows) ? obj.agenda_rows : [];
      var expectTs = obj.expected_updated_at != null ? String(obj.expected_updated_at).trim() : '';
      var q = window.supabase.from('department_meetings').update(row).eq('id', id);
      if (expectTs) q = q.eq('updated_at', expectTs);
      return q.select('id, updated_at').maybeSingle().then(function(r) {
        if (r.error) throw r.error;
        if (expectTs && !r.data) {
          throw new Error('This meeting was changed elsewhere. Refresh the meeting list and try again.');
        }
        return r.data;
      });
    },

    deleteDepartmentMeeting: function(id) {
      if (!useSupabase()) return Promise.reject(new Error('Supabase required'));
      return window.supabase.from('department_meetings').delete().eq('id', id).then(function(r) {
        if (r.error) throw r.error;
      });
    },

    /**
     * Faculty Head only (is_admin): merge minutes/action_items into a published meeting. Agenda columns unchanged in DB.
     * @param {string} meetingId
     * @param {Array<{minutes?: string, action_items?: string}>} minuteRows - same length as agenda rows
     * @param {boolean} markComplete - set minutes_recording_status to 'complete'
     * @param {string|null} [expectedUpdatedAt] - row updated_at from last fetch; detects conflicts
     */
    patchDepartmentMeetingMinutes: function(meetingId, minuteRows, markComplete, expectedUpdatedAt) {
      if (!useSupabase()) return Promise.reject(new Error('Supabase required'));
      var payload = (minuteRows || []).map(function(r) {
        return {
          minutes: r.minutes != null ? String(r.minutes) : '',
          action_items: r.action_items != null ? String(r.action_items) : ''
        };
      });
      var body = {
        p_meeting_id: meetingId,
        p_minutes: payload,
        p_complete: !!markComplete
      };
      if (expectedUpdatedAt != null && String(expectedUpdatedAt).trim() !== '') {
        body.p_expected_updated_at = expectedUpdatedAt;
      }
      return window.supabase.rpc('patch_department_meeting_minutes', body).then(function(r) {
        if (r.error) throw r.error;
      });
    },

    detectExistingClassConflicts: function(rows, academicYearLabel) {
      if (!useSupabase()) return Promise.reject(new Error('Supabase required'));
      if (!academicYearLabel || !String(academicYearLabel).trim()) {
        return Promise.reject(new Error('Academic year label is required'));
      }
      return ensureSessionForMutations().then(function() {
        return window.supabase.rpc('detect_existing_class_conflicts', {
          p_rows: Array.isArray(rows) ? rows : [],
          p_academic_year_label: String(academicYearLabel).trim()
        }).then(function(r) {
          if (r.error) throw r.error;
          return r.data || [];
        });
      });
    },

    bulkUpsertPupilsAndEnrollments: function(options) {
      if (!useSupabase()) return Promise.reject(new Error('Supabase required'));
      var opts = options || {};
      var rows = Array.isArray(opts.rows) ? opts.rows : [];
      var academicYearLabel = String(opts.academicYearLabel || '').trim();
      var mode = String(opts.mode || 'add_only').trim() || 'add_only';
      var overrideConflicts = !!opts.overrideConflicts;
      if (!academicYearLabel) return Promise.reject(new Error('Academic year label is required'));
      return ensureSessionForMutations().then(function() {
        return window.supabase.rpc('bulk_upsert_pupils_and_enrollments', {
          p_rows: rows,
          p_academic_year_label: academicYearLabel,
          p_mode: mode,
          p_override_conflicts: overrideConflicts
        }).then(function(r) {
          if (r.error) throw r.error;
          return r.data || {};
        });
      });
    },

    assignClassesToTeachers: function(assignments, academicYearLabel, overrideConflicts) {
      if (!useSupabase()) return Promise.reject(new Error('Supabase required'));
      var rows = Array.isArray(assignments) ? assignments : [];
      var yearLabel = String(academicYearLabel || '').trim();
      if (!yearLabel) return Promise.reject(new Error('Academic year label is required'));
      return ensureSessionForMutations().then(function() {
        return window.supabase.rpc('assign_classes_to_teachers', {
          p_assignments: rows,
          p_academic_year_label: yearLabel,
          p_override_conflicts: !!overrideConflicts
        }).then(function(r) {
          if (r.error) throw r.error;
          return r.data || {};
        });
      });
    },

    normalizeTrackerSubject: function(subject) {
      return normalizeTrackerSubject(subject);
    },

    listAcademicYears: function() {
      if (!useSupabase()) return Promise.resolve([]);
      return getSessionWithRetry({ retries: 4, delayMs: 250 }).then(function(session) {
        if (!session) throw new Error('Not authenticated');
        return window.supabase.from('academic_years')
          .select('id, label')
          .order('label', { ascending: false })
          .then(function(r) {
            if (r.error) throw r.error;
            return Array.isArray(r.data) ? r.data : [];
          });
      });
    },

    listTeachingStaffForClassLoaderDetailed: function() {
      if (!useSupabase()) {
        return Promise.resolve({
          rows: [],
          diagnostics: { source: 'local_mode', total: 0, fallback_steps: [] }
        });
      }
      var self = this;
      return getSessionWithRetry({ retries: 4, delayMs: 250 }).then(function(session) {
        if (!session) throw new Error('Not authenticated');
        var diagnostics = {
          source: 'none',
          total: 0,
          rpc_used: false,
          fallback_steps: [],
          fallback_used: false,
          source_counts: { rpc: 0, staff_work: 0, monitoring: 0, profiles: 0 }
        };
        function addRows(target, rows, mapper, stepName) {
          (rows || []).forEach(function(row) {
            var mapped = mapper(row);
            if (!mapped || !mapped.teacher_id) return;
            var key = String(mapped.teacher_id).trim();
            if (!key) return;
            if (!target[key]) target[key] = mapped;
            if (!target[key].display_name && mapped.display_name) target[key].display_name = mapped.display_name;
            if (!target[key].email && mapped.email) target[key].email = mapped.email;
          });
          diagnostics.fallback_steps.push(stepName + ':' + Number((rows || []).length));
          if (diagnostics.source_counts && diagnostics.source_counts[stepName] != null) {
            diagnostics.source_counts[stepName] += Number((rows || []).length);
          }
        }
        function sortedRows(byUser) {
          return Object.keys(byUser).map(function(key) { return byUser[key]; })
            .sort(function(a, b) {
              var aa = String(a.display_name || a.email || '').toLowerCase();
              var bb = String(b.display_name || b.email || '').toLowerCase();
              return aa.localeCompare(bb);
            });
        }
        var byUser = {};
        return window.supabase.rpc('list_teaching_staff_for_class_loader').then(function(r) {
          if (r.error) throw r.error;
          diagnostics.rpc_used = true;
          addRows(byUser, r.data || [], function(row) {
            return {
              teacher_id: row.teacher_id,
              email: row.email || '',
              display_name: row.display_name || row.email || 'Unknown',
              role: row.role || 'teacher'
            };
          }, 'rpc');
          if (Object.keys(byUser).length > 0) {
            diagnostics.source = 'rpc';
            diagnostics.total = Object.keys(byUser).length;
            return { rows: sortedRows(byUser), diagnostics: diagnostics };
          }
          return null;
        }).catch(function(err) {
          diagnostics.fallback_steps.push('rpc_error:' + String(err && err.code || 'unknown'));
          diagnostics.fallback_used = true;
          return null;
        }).then(function(found) {
          if (found) return found;
          diagnostics.fallback_used = true;
          return self.getStaffListWithWorkForAdmin().catch(function() { return []; }).then(function(rows) {
            addRows(byUser, rows || [], function(row) {
              return {
                teacher_id: row.user_id,
                email: row.email || '',
                display_name: row.teacherName || row.email || 'Unknown',
                role: row.role || row.user_role || 'teacher'
              };
            }, 'staff_work');
          });
        }).then(function(found) {
          if (found) return found;
          if (Object.keys(byUser).length > 0) return null;
          diagnostics.fallback_used = true;
          return self.getAllForMonitoring().catch(function() { return []; }).then(function(rows) {
            addRows(byUser, rows || [], function(row) {
              return {
                teacher_id: row.user_id,
                email: row.email || '',
                display_name: row.teacherName || row.email || 'Unknown',
                role: row.role || row.user_role || 'teacher'
              };
            }, 'monitoring');
          });
        }).then(function(found) {
          if (found) return found;
          if (Object.keys(byUser).length > 0) return null;
          diagnostics.fallback_used = true;
          return window.supabase.from('profiles')
            .select('id, email, display_name')
            .then(function(r) {
              if (r.error) return;
              addRows(byUser, r.data || [], function(row) {
                return {
                  teacher_id: row.id,
                  email: row.email || '',
                  display_name: row.display_name || row.email || 'Unknown',
                  role: row.role || row.user_role || 'teacher'
                };
              }, 'profiles');
            }).catch(function() {});
        }).then(function(found) {
          if (found) return found;
          var total = Object.keys(byUser).length;
          diagnostics.total = total;
          if (total > 0) {
            if (diagnostics.fallback_steps.join(',').indexOf('staff_work') !== -1) diagnostics.source = 'fallback_staff_work';
            else if (diagnostics.fallback_steps.join(',').indexOf('monitoring') !== -1) diagnostics.source = 'fallback_monitoring';
            else if (diagnostics.fallback_steps.join(',').indexOf('profiles') !== -1) diagnostics.source = 'fallback_profiles';
            else diagnostics.source = 'fallback_unknown';
          } else {
            diagnostics.source = 'empty';
          }
          return { rows: sortedRows(byUser), diagnostics: diagnostics };
        });
      });
    },

    listTeachingStaffForClassLoader: function() {
      return this.listTeachingStaffForClassLoaderDetailed().then(function(payload) {
        return payload && Array.isArray(payload.rows) ? payload.rows : [];
      });
    },

    listTeacherSubjectClassesForLoader: function(options) {
      if (!useSupabase()) return Promise.resolve([]);
      var opts = options || {};
      var teacherId = String(opts.teacherId || '').trim();
      var subject = normalizeTrackerSubject(opts.subject);
      var academicYearLabel = String(opts.academicYearLabel || '').trim();
      if (!teacherId) return Promise.reject(new Error('Teacher is required'));
      if (!subject) return Promise.reject(new Error('Subject must be Art, Drama, or Photography'));
      if (!academicYearLabel) return Promise.reject(new Error('Academic year label is required'));
      return getSessionWithRetry({ retries: 4, delayMs: 250 }).then(function(session) {
        if (!session) throw new Error('Not authenticated');
        function fallbackList() {
          return window.supabase.from('academic_years')
            .select('id, label')
            .eq('label', academicYearLabel)
            .maybeSingle()
            .then(function(yearRes) {
              if (yearRes.error) throw yearRes.error;
              if (!yearRes.data || !yearRes.data.id) return [];
              return window.supabase.from('class_teacher_assignments')
                .select('class_id')
                .eq('teacher_id', teacherId)
                .eq('assignment_role', 'primary')
                .then(function(assignRes) {
                  if (assignRes.error) throw assignRes.error;
                  var classIds = Array.from(new Set((assignRes.data || []).map(function(item) { return item.class_id; }).filter(Boolean)));
                  if (!classIds.length) return [];
                  return window.supabase.from('classes')
                    .select('id, subject, class_code, class_name, year_level_id')
                    .in('id', classIds)
                    .eq('academic_year_id', yearRes.data.id)
                    .eq('subject', subject)
                    .order('year_level_id', { ascending: true })
                    .order('class_code', { ascending: true })
                    .then(function(classRes) {
                      if (classRes.error) throw classRes.error;
                      return (classRes.data || []).map(function(row) {
                        return {
                          class_id: row.id,
                          subject: row.subject,
                          academic_year_label: academicYearLabel,
                          year_level: row.year_level_id,
                          year_level_label: 'S' + row.year_level_id,
                          class_code: row.class_code,
                          class_name: row.class_name
                        };
                      });
                    });
                });
            });
        }
        if (subject === 'photography') {
          return fallbackList();
        }
        return window.supabase.rpc('list_teacher_subject_classes_for_loader', {
          p_teacher_id: teacherId,
          p_subject: subject,
          p_academic_year_label: academicYearLabel
        }).then(function(r) {
          if (r.error) throw r.error;
          return Array.isArray(r.data) ? r.data : [];
        }).catch(function(err) {
          if (!isMissingRpcError(err)) return fallbackList();
          return fallbackList();
        });
      });
    },

    upsertTeacherSubjectClassesForLoader: function(options) {
      if (!useSupabase()) return Promise.reject(new Error('Supabase required'));
      var opts = options || {};
      var teacherId = String(opts.teacherId || '').trim();
      var subject = normalizeTrackerSubject(opts.subject);
      var academicYearLabel = String(opts.academicYearLabel || '').trim();
      var classes = Array.isArray(opts.classes) ? opts.classes : [];
      var replaceExisting = !!opts.replaceExisting;
      if (!teacherId) return Promise.reject(new Error('Teacher is required'));
      if (!subject) return Promise.reject(new Error('Subject must be Art, Drama, or Photography'));
      if (!academicYearLabel) return Promise.reject(new Error('Academic year label is required'));
      return ensureSessionForMutations().then(function() {
        if (subject === 'photography') {
          return Promise.reject({ code: 'RPC_BYPASS', message: 'Bypass RPC for photography subject' });
        }
        return window.supabase.rpc('upsert_teacher_subject_classes_for_loader', {
          p_teacher_id: teacherId,
          p_subject: subject,
          p_academic_year_label: academicYearLabel,
          p_classes: classes,
          p_replace_existing: replaceExisting
        }).then(function(r) {
          if (r.error) throw r.error;
          return r.data || {};
        }).catch(function(err) {
          if (!isMissingRpcError(err) && String(err && err.code || '') !== 'RPC_BYPASS') throw err;
          return ensureSessionForMutations().then(function(session) {
            var result = {
              teacher_id: teacherId,
              subject: subject,
              academic_year_label: academicYearLabel,
              replace_existing: replaceExisting,
              inserted_classes: 0,
              updated_classes: 0,
              assigned_classes: 0,
              reassigned_classes: 0,
              removed_existing_assignments: 0,
              skipped_rows: 0,
              conflicts: []
            };
            return window.supabase.from('profiles').select('id').eq('id', teacherId).maybeSingle()
              .then(function(teacherRes) {
                if (teacherRes.error) throw teacherRes.error;
                if (!teacherRes.data || !teacherRes.data.id) throw new Error('Teacher account not found');
                return window.supabase.from('academic_years').select('id').eq('label', academicYearLabel).maybeSingle();
              })
              .then(function(yearRes) {
                if (yearRes.error) throw yearRes.error;
                if (yearRes.data && yearRes.data.id) return yearRes.data.id;
                return window.supabase.from('academic_years')
                  .insert({ label: academicYearLabel, status: 'active' })
                  .select('id')
                  .single()
                  .then(function(insertYearRes) {
                    if (insertYearRes.error) throw insertYearRes.error;
                    return insertYearRes.data.id;
                  });
              })
              .then(function(yearId) {
                if (replaceExisting) {
                  return window.supabase.from('class_teacher_assignments')
                    .select('class_id')
                    .eq('teacher_id', teacherId)
                    .eq('assignment_role', 'primary')
                    .then(function(assignRes) {
                      if (assignRes.error) throw assignRes.error;
                      var classIds = Array.from(new Set((assignRes.data || []).map(function(item) { return item.class_id; }).filter(Boolean)));
                      if (!classIds.length) return yearId;
                      return window.supabase.from('classes')
                        .select('id')
                        .in('id', classIds)
                        .eq('academic_year_id', yearId)
                        .eq('subject', subject)
                        .then(function(classRes) {
                          if (classRes.error) throw classRes.error;
                          var idsToDelete = (classRes.data || []).map(function(item) { return item.id; }).filter(Boolean);
                          if (!idsToDelete.length) return yearId;
                          result.removed_existing_assignments = idsToDelete.length;
                          return window.supabase.from('class_teacher_assignments')
                            .delete()
                            .eq('teacher_id', teacherId)
                            .eq('assignment_role', 'primary')
                            .in('class_id', idsToDelete)
                            .then(function(deleteRes) {
                              if (deleteRes.error) throw deleteRes.error;
                              return yearId;
                            });
                        });
                    });
                }
                return yearId;
              })
              .then(function(yearId) {
                return classes.reduce(function(chain, row) {
                  return chain.then(function() {
                    var yearLevel = parseYearLevelNumber(row && row.year_level);
                    var classCode = String(row && row.class_code || '').trim();
                    var className = String(row && row.class_name || classCode).trim();
                    if (!yearLevel || !classCode || !className) {
                      result.skipped_rows += 1;
                      result.conflicts.push({ type: 'invalid_row', row: row });
                      return;
                    }
                    return window.supabase.from('classes')
                      .select('id')
                      .eq('academic_year_id', yearId)
                      .eq('subject', subject)
                      .eq('class_code', classCode)
                      .maybeSingle()
                      .then(function(existingClassRes) {
                        if (existingClassRes.error) throw existingClassRes.error;
                        if (existingClassRes.data && existingClassRes.data.id) {
                          var classId = existingClassRes.data.id;
                          return window.supabase.from('classes')
                            .update({ year_level_id: yearLevel, class_name: className })
                            .eq('id', classId)
                            .then(function(updateClassRes) {
                              if (updateClassRes.error) throw updateClassRes.error;
                              result.updated_classes += 1;
                              return classId;
                            });
                        }
                        return window.supabase.from('classes')
                          .insert({
                            academic_year_id: yearId,
                            year_level_id: yearLevel,
                            subject: subject,
                            class_code: classCode,
                            class_name: className,
                            source: 'manual_teacher_loader',
                            created_by: session.user.id
                          })
                          .select('id')
                          .single()
                          .then(function(insertClassRes) {
                            if (insertClassRes.error) throw insertClassRes.error;
                            result.inserted_classes += 1;
                            return insertClassRes.data.id;
                          });
                      })
                      .then(function(classId) {
                        return window.supabase.from('class_teacher_assignments')
                          .select('teacher_id')
                          .eq('class_id', classId)
                          .eq('assignment_role', 'primary')
                          .maybeSingle()
                          .then(function(assignmentRes) {
                            if (assignmentRes.error) throw assignmentRes.error;
                            if (!assignmentRes.data || !assignmentRes.data.teacher_id) {
                              return window.supabase.from('class_teacher_assignments')
                                .insert({
                                  class_id: classId,
                                  teacher_id: teacherId,
                                  assignment_role: 'primary',
                                  created_by: session.user.id
                                })
                                .then(function(insertAssignRes) {
                                  if (insertAssignRes.error) throw insertAssignRes.error;
                                  result.assigned_classes += 1;
                                });
                            }
                            if (assignmentRes.data.teacher_id !== teacherId) {
                              if (!replaceExisting) {
                                result.conflicts.push({
                                  type: 'teacher_mismatch',
                                  subject: subject,
                                  class_code: classCode,
                                  year_level: yearLevel
                                });
                                return;
                              }
                              return window.supabase.from('class_teacher_assignments')
                                .update({ teacher_id: teacherId, created_by: session.user.id })
                                .eq('class_id', classId)
                                .eq('assignment_role', 'primary')
                                .then(function(updateAssignRes) {
                                  if (updateAssignRes.error) throw updateAssignRes.error;
                                  result.reassigned_classes += 1;
                                });
                            }
                          });
                      });
                  });
                }, Promise.resolve()).then(function() {
                  return result;
                });
              });
          });
        });
      });
    },

    listMyAssignedClassesForTracker: function(options) {
      if (!useSupabase()) return Promise.resolve([]);
      var opts = options || {};
      var subject = normalizeTrackerSubject(opts.subject);
      var academicYearLabel = String(opts.academicYearLabel || '').trim() || currentAcademicYearLabel();
      if (!subject) return Promise.reject(new Error('Subject must be Art, Drama, or Photography'));
      return getSessionWithRetry({ retries: 4, delayMs: 250 }).then(function(session) {
        if (!session) throw new Error('Not authenticated');
        return window.supabase.rpc('list_my_assigned_classes_for_tracker', {
          p_subject: subject,
          p_academic_year_label: academicYearLabel
        }).then(function(r) {
          if (r.error) throw r.error;
          return Array.isArray(r.data) ? r.data : [];
        }).catch(function(err) {
          if (!isMissingRpcError(err)) throw err;
          return window.supabase.from('academic_years')
            .select('id')
            .eq('label', academicYearLabel)
            .maybeSingle()
            .then(function(yearRes) {
              if (yearRes.error) throw yearRes.error;
              if (!yearRes.data || !yearRes.data.id) return [];
              return window.supabase.from('class_teacher_assignments')
                .select('class_id')
                .eq('teacher_id', session.user.id)
                .eq('assignment_role', 'primary')
                .then(function(assignRes) {
                  if (assignRes.error) throw assignRes.error;
                  var classIds = Array.from(new Set((assignRes.data || []).map(function(item) { return item.class_id; }).filter(Boolean)));
                  if (!classIds.length) return [];
                  return window.supabase.from('classes')
                    .select('id, subject, class_code, class_name, year_level_id')
                    .in('id', classIds)
                    .eq('academic_year_id', yearRes.data.id)
                    .eq('subject', subject)
                    .order('year_level_id', { ascending: true })
                    .order('class_code', { ascending: true })
                    .then(function(classRes) {
                      if (classRes.error) throw classRes.error;
                      return (classRes.data || []).map(function(row) {
                        return {
                          class_id: row.id,
                          subject: row.subject,
                          academic_year_label: academicYearLabel,
                          year_level: row.year_level_id,
                          year_level_label: 'S' + row.year_level_id,
                          class_code: row.class_code,
                          class_name: row.class_name
                        };
                      });
                    });
                });
            });
        });
      });
    },

    previewPromotionRun: function(options) {
      if (!useSupabase()) return Promise.reject(new Error('Supabase required'));
      var opts = options || {};
      var fromYear = String(opts.fromAcademicYearLabel || '').trim();
      var toYear = String(opts.toAcademicYearLabel || '').trim();
      var fromLevel = Number(opts.fromYearLevel);
      var toLevel = Number(opts.toYearLevel);
      var reassignments = Array.isArray(opts.teacherReassignments) ? opts.teacherReassignments : [];
      if (!fromYear || !toYear) return Promise.reject(new Error('From/To academic year labels are required'));
      if (!fromLevel || !toLevel) return Promise.reject(new Error('From/To year levels are required'));
      return ensureSessionForMutations().then(function() {
        return window.supabase.rpc('preview_promotion_run', {
          p_from_academic_year_label: fromYear,
          p_to_academic_year_label: toYear,
          p_from_year_level: fromLevel,
          p_to_year_level: toLevel,
          p_teacher_reassignments: reassignments
        }).then(function(r) {
          if (r.error) throw r.error;
          return r.data || {};
        });
      });
    },

    commitPromotionRun: function(options) {
      if (!useSupabase()) return Promise.reject(new Error('Supabase required'));
      var opts = options || {};
      var fromYear = String(opts.fromAcademicYearLabel || '').trim();
      var toYear = String(opts.toAcademicYearLabel || '').trim();
      var fromLevel = Number(opts.fromYearLevel);
      var toLevel = Number(opts.toYearLevel);
      var reassignments = Array.isArray(opts.teacherReassignments) ? opts.teacherReassignments : [];
      var overrideConflicts = !!opts.overrideConflicts;
      if (!fromYear || !toYear) return Promise.reject(new Error('From/To academic year labels are required'));
      if (!fromLevel || !toLevel) return Promise.reject(new Error('From/To year levels are required'));
      return ensureSessionForMutations().then(function() {
        return window.supabase.rpc('commit_promotion_run', {
          p_from_academic_year_label: fromYear,
          p_to_academic_year_label: toYear,
          p_from_year_level: fromLevel,
          p_to_year_level: toLevel,
          p_teacher_reassignments: reassignments,
          p_override_conflicts: overrideConflicts
        }).then(function(r) {
          if (r.error) throw r.error;
          return r.data || {};
        });
      });
    },

    /** Whether admin has set a shared Tracking Hub password (RPC). */
    getTrackingHubPasswordStatus: function() {
      return new Promise(function(resolve, reject) {
        if (!useSupabase()) { resolve(false); return; }
        window.supabase.rpc('tracking_hub_password_is_enabled').then(function(r) {
          if (r.error) { reject(r.error); return; }
          resolve(!!r.data);
        });
      });
    },

    /** Verify shared Tracking Hub password for the current session. */
    verifyTrackingHubPassword: function(password) {
      return new Promise(function(resolve, reject) {
        if (!useSupabase()) { resolve(true); return; }
        window.supabase.rpc('verify_tracking_hub_password', {
          p_password: password || ''
        }).then(function(r) {
          if (r.error) { reject(r.error); return; }
          resolve(!!r.data);
        });
      });
    },

    /** Admin only: set or clear (empty string) the shared Tracking Hub password. */
    setTrackingHubPassword: function(password) {
      return ensureSessionForMutations().then(function() {
        if (!useSupabase()) return Promise.reject(new Error('Supabase required'));
        return window.supabase.rpc('set_tracking_hub_password', {
          p_password: password == null ? '' : String(password)
        }).then(function(r) {
          if (r.error) throw r.error;
          if (typeof window.clearTrackingHubUnlock === 'function') {
            window.clearTrackingHubUnlock();
          }
          return true;
        });
      });
    }
  };
})();
