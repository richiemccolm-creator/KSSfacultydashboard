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

    getAllForAdmin: function() {
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
                  action: 'admin_viewed_all_pupil_data',
                  target_type: 'pupil_data'
                }).then(function() {});
              }
              resolve(out);
            });
          });
        });
      });
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
            if (results[0].error || results[1].error) {
              reject(results[0].error || results[1].error);
              return;
            }
            var profiles = (results[0].data || []).reduce(function(acc, p) {
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
          .select('id, title, date, category, description')
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
                source: 'shared'
              };
            }));
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
      return new Promise(function(resolve, reject) {
        if (!useSupabase()) { resolve([]); return; }
        window.supabase.from('announcements')
          .select('id, title, body, expires_at, created_at, priority, highlight_priority')
          .order('created_at', { ascending: false })
          .then(function(r) {
            if (r.error) { resolve([]); return; }
            var today = new Date().toISOString().slice(0, 10);
            var list = (r.data || []).filter(function(a) {
              return !a.expires_at || a.expires_at >= today;
            }).map(function(a) {
              return {
                id: a.id,
                title: a.title,
                body: a.body,
                expires_at: a.expires_at,
                created_at: a.created_at,
                priority: a.priority || 'none',
                highlight_priority: !!a.highlight_priority
              };
            });
            resolve(list);
          });
      });
    },

    createAnnouncement: function(obj) {
      if (!useSupabase()) return Promise.reject(new Error('Supabase required'));
      var priority = String(obj.priority || 'none').toLowerCase();
      if (['none', 'low', 'medium', 'high'].indexOf(priority) === -1) priority = 'none';
      var row = {
        title: (obj.title || '').trim(),
        body: (obj.body || '').trim() || null,
        expires_at: obj.expires_at || null,
        priority: priority,
        highlight_priority: !!obj.highlight_priority
      };
      return window.supabase.from('announcements').insert(row).then(function(r) {
        if (r.error) throw r.error;
      });
    },

    updateAnnouncement: function(id, obj) {
      if (!useSupabase()) return Promise.reject(new Error('Supabase required'));
      var priority = String(obj.priority || 'none').toLowerCase();
      if (['none', 'low', 'medium', 'high'].indexOf(priority) === -1) priority = 'none';
      var row = {
        title: (obj.title || '').trim(),
        body: (obj.body || '').trim() || null,
        expires_at: obj.expires_at || null,
        priority: priority,
        highlight_priority: !!obj.highlight_priority
      };
      return window.supabase.from('announcements').update(row).eq('id', id).then(function(r) {
        if (r.error) throw r.error;
      });
    },

    deleteAnnouncement: function(id) {
      if (!useSupabase()) return Promise.reject(new Error('Supabase required'));
      return window.supabase.from('announcements').delete().eq('id', id).then(function(r) {
        if (r.error) throw r.error;
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
    }
  };
})();
