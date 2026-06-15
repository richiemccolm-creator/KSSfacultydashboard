/**
 * Faculty Hub staff bridge — load signed-up teachers from Supabase profiles.
 */
(function(global) {
  'use strict';

  function parseDisplayName(displayName, email) {
    var raw = String(displayName || '').trim();
    if (!raw) raw = String(email || '').split('@')[0] || 'Teacher';
    var parts = raw.split(/\s+/).filter(Boolean);
    if (parts.length === 1) {
      return { first_name: parts[0], surname: '' };
    }
    return {
      first_name: parts.slice(0, -1).join(' '),
      surname: parts[parts.length - 1]
    };
  }

  function localTeacherId(hubUserId) {
    return 't-hub-' + String(hubUserId || '').replace(/-/g, '').slice(0, 16);
  }

  function staffRowToTeacher(row) {
    var names = parseDisplayName(row.display_name, row.email);
    var roleLabel = 'Class Teacher';
    if (row.role === 'admin' || row.role === 'faculty_head') roleLabel = 'Faculty Head';
    return {
      id: localTeacherId(row.teacher_id),
      hub_user_id: row.teacher_id,
      first_name: names.first_name,
      surname: names.surname,
      email: row.email || '',
      role: roleLabel,
      active_status: true,
      source: 'hub'
    };
  }

  function hubAvailable() {
    return !!(global.window && global.window.supabase && global.window.supabase.auth);
  }

  function loadCurrentHubUser() {
    if (!hubAvailable()) return Promise.resolve(null);
    return global.window.supabase.auth.getSession().then(function(res) {
      var session = res && res.data ? res.data.session : null;
      if (!session || !session.user) return null;
      var userId = session.user.id;
      return global.window.supabase.from('profiles')
        .select('id, email, display_name')
        .eq('id', userId)
        .maybeSingle()
        .then(function(r) {
          var profile = r && r.data ? r.data : {};
          return {
            teacher_id: userId,
            email: profile.email || session.user.email || '',
            display_name: profile.display_name || profile.email || session.user.email || 'You',
            role: 'teacher'
          };
        })
        .catch(function() {
          return {
            teacher_id: userId,
            email: session.user.email || '',
            display_name: session.user.email || 'You',
            role: 'teacher'
          };
        });
    }).catch(function() { return null; });
  }

  function loadHubStaff() {
    if (!hubAvailable()) {
      return Promise.resolve({ rows: [], status: 'offline', error: null, currentUser: null });
    }
    if (!global.DataService || !global.DataService.listTeachingStaffForClassLoaderDetailed) {
      return loadCurrentHubUser().then(function(currentUser) {
        return { rows: [], status: 'offline', error: 'Data service unavailable', currentUser: currentUser };
      });
    }
    return Promise.all([
      global.DataService.listTeachingStaffForClassLoaderDetailed(),
      loadCurrentHubUser()
    ]).then(function(results) {
      var payload = results[0] || {};
      return {
        rows: payload.rows || [],
        status: 'ready',
        error: null,
        diagnostics: payload.diagnostics || null,
        currentUser: results[1] || null
      };
    }).catch(function(err) {
      return loadCurrentHubUser().then(function(currentUser) {
        return {
          rows: [],
          status: 'error',
          error: err && err.message ? err.message : String(err),
          currentUser: currentUser
        };
      });
    });
  }

  function findLocalTeacher(db, hubRow) {
    return (db.teachers || []).find(function(t) {
      if (hubRow.teacher_id && t.hub_user_id === hubRow.teacher_id) return true;
      if (hubRow.email && t.email && String(t.email).toLowerCase() === String(hubRow.email).toLowerCase()) return true;
      return false;
    }) || null;
  }

  function syncStaffRows(db, rows) {
    if (!global.SptStore) return { added: 0, updated: 0, total: 0 };
    var added = 0;
    var updated = 0;
    (rows || []).forEach(function(row) {
      if (!row || !row.teacher_id) return;
      var existing = findLocalTeacher(db, row);
      var mapped = staffRowToTeacher(row);
      if (existing) {
        global.SptStore.updateRecord(db, 'teachers', existing.id, {
          first_name: mapped.first_name,
          surname: mapped.surname,
          email: mapped.email || existing.email,
          hub_user_id: mapped.hub_user_id,
          source: 'hub',
          active_status: true
        }, 'hub_teacher_update');
        updated++;
      } else {
        global.SptStore.insertRecord(db, 'teachers', mapped, 'hub_teacher_sync');
        added++;
      }
    });
    return { added: added, updated: updated, total: (rows || []).length };
  }

  function ensureHubTeacher(db, hubRow) {
    if (!hubRow || !hubRow.teacher_id) return null;
    var existing = findLocalTeacher(db, hubRow);
    if (existing) return existing;
    return global.SptStore.insertRecord(db, 'teachers', staffRowToTeacher(hubRow), 'hub_teacher_add');
  }

  function teacherIdForHubUser(db, hubUserId) {
    var t = (db.teachers || []).find(function(x) { return x.hub_user_id === hubUserId; });
    return t ? t.id : null;
  }

  global.SptHubStaff = {
    parseDisplayName: parseDisplayName,
    staffRowToTeacher: staffRowToTeacher,
    hubAvailable: hubAvailable,
    loadCurrentHubUser: loadCurrentHubUser,
    loadHubStaff: loadHubStaff,
    findLocalTeacher: findLocalTeacher,
    syncStaffRows: syncStaffRows,
    ensureHubTeacher: ensureHubTeacher,
    teacherIdForHubUser: teacherIdForHubUser
  };
})(typeof window !== 'undefined' ? window : global);
