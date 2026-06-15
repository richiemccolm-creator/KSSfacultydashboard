/**
 * Senior Phase — Faculty Hub cloud sync (shared workbook in Supabase).
 */
(function(global) {
  'use strict';

  var WORKBOOK_ID = 'default';
  var DEBOUNCE_MS = 900;
  var pushTimer = null;
  var pendingDb = null;
  var status = 'idle';
  var statusMessage = null;
  var hydrating = false;
  var syncReady = false;

  function hubMode() {
    return !!(global.SptConfig && !global.SptConfig.useSeedData);
  }

  function supabaseReady() {
    return !!(global.window && global.window.supabase && global.window.supabase.auth);
  }

  function setStatus(next, message) {
    status = next || 'idle';
    statusMessage = message || null;
    if (typeof global.SptSyncOnStatus === 'function') {
      global.SptSyncOnStatus(status, statusMessage);
    }
  }

  function getSession() {
    if (!supabaseReady()) return Promise.resolve(null);
    var retries = 4;
    var delayMs = 250;
    function attempt(remaining) {
      return global.window.supabase.auth.getSession().then(function(res) {
        var session = res && res.data ? res.data.session : null;
        if (session || remaining <= 0) return session;
        return new Promise(function(resolve) {
          setTimeout(function() { resolve(attempt(remaining - 1)); }, delayMs);
        });
      }).catch(function() { return null; });
    }
    return attempt(retries);
  }

  function snapshotForCloud(db) {
    var copy = JSON.parse(JSON.stringify(db || {}));
    delete copy.simulated_teacher_id;
    return copy;
  }

  function cloudTimestamp(row) {
    if (!row) return '';
    return String(row.updated_at || '').trim();
  }

  function localTimestamp(db) {
    return String((db && db.updated_at) || '').trim();
  }

  function isEffectivelyEmpty(db) {
    if (!db) return true;
    return !(db.teachers && db.teachers.length) &&
      !(db.classes && db.classes.length) &&
      !(db.pupils && db.pupils.length) &&
      !(db.pupil_tracking_data && db.pupil_tracking_data.length);
  }

  function remoteHasContent(data) {
    if (!data || typeof data !== 'object') return false;
    return (data.teachers && data.teachers.length) ||
      (data.classes && data.classes.length) ||
      (data.pupils && data.pupils.length) ||
      (data.pupil_tracking_data && data.pupil_tracking_data.length);
  }

  function fetchRemote() {
    return getSession().then(function(session) {
      if (!session) return { session: null, row: null };
      return global.window.supabase.from('senior_phase_workbook')
        .select('id, data, updated_at, updated_by')
        .eq('id', WORKBOOK_ID)
        .maybeSingle()
        .then(function(res) {
          if (res.error) throw res.error;
          return { session: session, row: res.data || null };
        });
    });
  }

  function pushRemote(db) {
    return getSession().then(function(session) {
      if (!session) {
        setStatus('offline', 'Not signed in');
        return false;
      }
      setStatus('syncing');
      var payload = {
        id: WORKBOOK_ID,
        data: snapshotForCloud(db),
        updated_at: new Date().toISOString(),
        updated_by: session.user.id
      };
      return global.window.supabase.from('senior_phase_workbook')
        .upsert(payload, { onConflict: 'id' })
        .then(function(res) {
          if (res.error) throw res.error;
          setStatus('synced');
          return true;
        });
    }).catch(function(err) {
      setStatus('error', err && err.message ? err.message : String(err));
      return false;
    });
  }

  function schedulePush(db) {
    if (!hubMode() || !supabaseReady() || !global.SptStore || !syncReady) return;
    pendingDb = db;
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(function() {
      pushTimer = null;
      var toPush = pendingDb;
      pendingDb = null;
      if (!toPush) return;
      pushRemote(toPush);
    }, DEBOUNCE_MS);
  }

  function flushPush(db) {
    if (!hubMode() || !supabaseReady()) return Promise.resolve(false);
    if (pushTimer) {
      clearTimeout(pushTimer);
      pushTimer = null;
    }
    pendingDb = null;
    return pushRemote(db || global.SptStore.load());
  }

  function hydrate(callback) {
    if (!hubMode() || !supabaseReady() || !global.SptStore) {
      setStatus('offline');
      syncReady = true;
      if (callback) callback('offline', null, false);
      return Promise.resolve(false);
    }
    if (hydrating) return Promise.resolve(false);
    hydrating = true;
    syncReady = false;
    setStatus('loading');
    return fetchRemote().then(function(result) {
      if (!result.session) {
        setStatus('offline', 'Sign in to Faculty Hub to sync across devices');
        hydrating = false;
        syncReady = true;
        if (callback) callback('offline', statusMessage, false);
        return false;
      }
      var local = global.SptStore.load();
      var remote = result.row;
      var remoteData = remote && remote.data && typeof remote.data === 'object' ? remote.data : null;
      var remoteTs = cloudTimestamp(remote);
      var localTs = localTimestamp(local);
      var changed = false;

      if (remoteData && remoteHasContent(remoteData)) {
        if (isEffectivelyEmpty(local) || !localTs || remoteTs > localTs) {
          global.SptStore.importCloudSnapshot(remoteData);
          changed = true;
        } else if (localTs > remoteTs) {
          return pushRemote(local).then(function() {
            hydrating = false;
            syncReady = true;
            if (callback) callback(status, statusMessage, false);
            return false;
          });
        } else {
          setStatus('synced');
        }
      } else if (local && (local.teachers || []).length + (local.classes || []).length + (local.pupils || []).length) {
        return pushRemote(local).then(function() {
          hydrating = false;
          syncReady = true;
          if (callback) callback(status, statusMessage, false);
          return false;
        });
      } else {
        setStatus('synced');
      }

      hydrating = false;
      syncReady = true;
      if (callback) callback(status, statusMessage, changed);
      return changed;
    }).catch(function(err) {
      setStatus('error', err && err.message ? err.message : String(err));
      hydrating = false;
      syncReady = true;
      if (callback) callback('error', statusMessage, false);
      return false;
    });
  }

  global.SptSync = {
    hubMode: hubMode,
    supabaseReady: supabaseReady,
    getStatus: function() { return { status: status, message: statusMessage }; },
    schedulePush: schedulePush,
    flushPush: flushPush,
    hydrate: hydrate,
    pushRemote: pushRemote
  };
})(typeof window !== 'undefined' ? window : global);
