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
  var hydratedOnce = false;
  var hydrateWaiters = [];

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
      !(db.enrolments && db.enrolments.length) &&
      !(db.pupil_tracking_data && db.pupil_tracking_data.length);
  }

  function remoteHasContent(data) {
    if (!data || typeof data !== 'object') return false;
    return (data.teachers && data.teachers.length) ||
      (data.classes && data.classes.length) ||
      (data.pupils && data.pupils.length) ||
      (data.enrolments && data.enrolments.length) ||
      (data.pupil_tracking_data && data.pupil_tracking_data.length);
  }

  function cohortScore(db) {
    if (!db) return 0;
    var activeEnrol = (db.enrolments || []).filter(function(e) {
      return e && e.active_status !== false;
    }).length;
    return (db.classes || []).length * 100 +
      (db.pupils || []).length * 50 +
      activeEnrol * 50 +
      (db.teachers || []).length * 5 +
      (db.pupil_tracking_data || []).length * 2;
  }

  function localWouldClobberRemote(local, remoteData) {
    if (!remoteData || !local) return false;
    var rClasses = (remoteData.classes || []).length;
    var lClasses = (local.classes || []).length;
    if (rClasses > 0 && lClasses === 0) return true;
    var rPupils = (remoteData.pupils || []).length;
    var lPupils = (local.pupils || []).length;
    if (rPupils > 0 && lPupils === 0) return true;
    var rEnrol = (remoteData.enrolments || []).filter(function(e) {
      return e && e.active_status !== false;
    }).length;
    var lEnrol = (local.enrolments || []).filter(function(e) {
      return e && e.active_status !== false;
    }).length;
    if (rEnrol > 0 && lEnrol === 0) return true;
    return false;
  }

  function shouldImportRemote(local, remoteData, localTs, remoteTs) {
    if (!remoteData || !remoteHasContent(remoteData)) return false;
    if (isEffectivelyEmpty(local)) return true;
    if (localWouldClobberRemote(local, remoteData)) return true;
    var localScore = cohortScore(local);
    var remoteScore = cohortScore(remoteData);
    if (remoteScore > localScore) return true;
    if (localScore > remoteScore) return false;
    if (!localTs && remoteTs) return true;
    if (localTs && !remoteTs) return false;
    return remoteTs > localTs;
  }

  function shouldPushLocal(local, remoteData, localTs, remoteTs) {
    if (!local || isEffectivelyEmpty(local)) return false;
    if (!remoteData || !remoteHasContent(remoteData)) return true;
    if (localWouldClobberRemote(local, remoteData)) return false;
    var localScore = cohortScore(local);
    var remoteScore = cohortScore(remoteData);
    if (localScore > remoteScore) return true;
    if (localScore < remoteScore) return false;
    if (!remoteTs) return true;
    if (!localTs) return false;
    return localTs > remoteTs;
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

  function flushPendingPush() {
    if (!pendingDb || !syncReady) return Promise.resolve(false);
    if (pushTimer) {
      clearTimeout(pushTimer);
      pushTimer = null;
    }
    var toPush = pendingDb;
    pendingDb = null;
    return pushRemote(toPush);
  }

  function schedulePush(db) {
    if (!hubMode() || !supabaseReady() || !global.SptStore) return;
    pendingDb = db;
    if (!syncReady) return;
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(function() {
      pushTimer = null;
      flushPendingPush();
    }, DEBOUNCE_MS);
  }

  function flushPush(db) {
    if (!hubMode() || !supabaseReady()) return Promise.resolve(false);
    if (pushTimer) {
      clearTimeout(pushTimer);
      pushTimer = null;
    }
    pendingDb = db || pendingDb || global.SptStore.load();
    return flushPendingPush();
  }

  function finishHydrate(callback, changed, message) {
    hydrating = false;
    syncReady = true;
    hydratedOnce = true;
    if (message) setStatus(status, message);
    if (pendingDb && syncReady) {
      schedulePush(pendingDb);
    }
    if (callback) callback(status, statusMessage, changed);
    var waiters = hydrateWaiters.slice();
    hydrateWaiters = [];
    waiters.forEach(function(fn) { fn(); });
  }

  function hydrate(callback) {
    if (!hubMode() || !supabaseReady() || !global.SptStore) {
      setStatus('offline');
      finishHydrate(callback, false);
      return Promise.resolve(false);
    }
    if (hydrating) return Promise.resolve(false);
    hydrating = true;
    syncReady = false;
    setStatus('loading');
    return fetchRemote().then(function(result) {
      if (!result.session) {
        setStatus('offline', 'Sign in to Faculty Hub to sync across devices');
        finishHydrate(callback, false);
        return false;
      }
      var local = global.SptStore.load();
      var remote = result.row;
      var remoteData = remote && remote.data && typeof remote.data === 'object' ? remote.data : null;
      var remoteTs = cloudTimestamp(remote);
      var localTs = localTimestamp(local);
      var changed = false;

      if (remoteData && remoteHasContent(remoteData)) {
        if (shouldImportRemote(local, remoteData, localTs, remoteTs)) {
          global.SptStore.importCloudSnapshot(remoteData, { cloudUpdatedAt: remoteTs });
          changed = true;
          if (localWouldClobberRemote(local, remoteData)) {
            setStatus('synced', 'Loaded cloud setup — your device was missing classes or pupils.');
          } else {
            setStatus('synced', changed ? 'Loaded latest workbook from cloud.' : null);
          }
        } else if (shouldPushLocal(local, remoteData, localTs, remoteTs)) {
          return pushRemote(local).then(function() {
            finishHydrate(callback, false);
            return false;
          });
        } else {
          setStatus('synced');
        }
      } else if (local && cohortScore(local) > 0) {
        return pushRemote(local).then(function() {
          finishHydrate(callback, false);
          return false;
        });
      } else {
        setStatus('synced');
      }

      finishHydrate(callback, changed);
      return changed;
    }).catch(function(err) {
      setStatus('error', err && err.message ? err.message : String(err));
      finishHydrate(callback, false);
      return false;
    });
  }

  function whenHydrated(callback) {
    if (hydratedOnce && syncReady) {
      if (callback) callback();
      return Promise.resolve();
    }
    return new Promise(function(resolve) {
      hydrateWaiters.push(function() {
        if (callback) callback();
        resolve();
      });
      if (!hydrating) {
        hydrate(function() {});
      }
    });
  }

  if (typeof global.window !== 'undefined') {
    global.window.addEventListener('pagehide', function() {
      if (!hubMode() || !syncReady || !pendingDb) return;
      flushPush(pendingDb);
    });
  }

  global.SptSync = {
    hubMode: hubMode,
    supabaseReady: supabaseReady,
    isReady: function() { return syncReady; },
    whenHydrated: whenHydrated,
    getStatus: function() { return { status: status, message: statusMessage }; },
    schedulePush: schedulePush,
    flushPush: flushPush,
    hydrate: hydrate,
    pushRemote: pushRemote
  };
})(typeof window !== 'undefined' ? window : global);
