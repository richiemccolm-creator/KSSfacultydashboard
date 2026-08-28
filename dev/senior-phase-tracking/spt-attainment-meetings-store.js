/**
 * Attainment Meetings persistence.
 *
 * Seed/dev (?dev_seed=1): localStorage key <STORAGE_KEY>-meetings
 * Live hub: dedicated Supabase tables (not senior_phase_workbook,
 * not SptStore, not SptSync).
 */
(function(global) {
  'use strict';

  var STORE_VERSION = 1;
  var DEBOUNCE_MS = 500;
  var TABLES = {
    cycles: 'spt_attainment_review_cycles',
    classReviews: 'spt_attainment_class_reviews',
    pupilReviews: 'spt_attainment_pupil_reviews',
    actions: 'spt_attainment_actions'
  };

  var memory = null;
  var syncedActionIds = {};
  var lastSent = { cycles: {}, classReviews: {}, pupilReviews: {}, actions: {} };
  var pushTimer = null;
  var pendingPush = false;
  var hydrating = false;
  var hydratedOnce = false;
  var ready = false;
  var hydrateWaiters = [];
  var status = 'idle';
  var statusMessage = null;

  function hubMode() {
    return !!(global.SptConfig && !global.SptConfig.useSeedData);
  }

  function storageKey() {
    var base = (global.SptConfig && global.SptConfig.STORAGE_KEY) || 'spt-hub-v1';
    return base + '-meetings';
  }

  function supabaseReady() {
    return !!(global.window && global.window.supabase && global.window.supabase.from);
  }

  function emptyStore() {
    return {
      version: STORE_VERSION,
      review_cycles: [],
      class_reviews: [],
      pupil_reviews: [],
      actions: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }

  function cloneStore(store) {
    return JSON.parse(JSON.stringify(store || emptyStore()));
  }

  function rememberActionIds(store) {
    syncedActionIds = {};
    (store.actions || []).forEach(function(a) {
      if (a && a.id) syncedActionIds[a.id] = true;
    });
  }

  function fingerprintRow(row) {
    return JSON.stringify(row);
  }

  function markSent(kind, rows) {
    rows.forEach(function(row) {
      if (row && row.id) lastSent[kind][row.id] = fingerprintRow(row);
    });
  }

  function dirtyRows(kind, recs, toRowFn) {
    var out = [];
    (recs || []).forEach(function(rec) {
      if (!rec || !rec.id) return;
      var row = toRowFn(rec);
      if (lastSent[kind][row.id] !== fingerprintRow(row)) out.push(row);
    });
    return out;
  }

  function rememberSentFromStore(store, userId) {
    lastSent = { cycles: {}, classReviews: {}, pupilReviews: {}, actions: {} };
    markSent('cycles', (store.review_cycles || []).map(function(r) { return cycleToRow(r, userId); }));
    markSent('classReviews', (store.class_reviews || []).map(classReviewToRow));
    markSent('pupilReviews', (store.pupil_reviews || []).map(pupilReviewToRow));
    markSent('actions', (store.actions || []).map(function(r) { return actionToRow(r, userId); }));
    rememberActionIds(store);
  }

  function loadLocal() {
    try {
      var raw = localStorage.getItem(storageKey());
      if (!raw) return emptyStore();
      var data = JSON.parse(raw);
      if (!data || typeof data !== 'object') return emptyStore();
      data.review_cycles = data.review_cycles || [];
      data.class_reviews = data.class_reviews || [];
      data.pupil_reviews = data.pupil_reviews || [];
      data.actions = data.actions || [];
      data.version = STORE_VERSION;
      return data;
    } catch (e) {
      return emptyStore();
    }
  }

  function saveLocal(store) {
    store.updated_at = new Date().toISOString();
    store.version = STORE_VERSION;
    localStorage.setItem(storageKey(), JSON.stringify(store));
    memory = store;
    return store;
  }

  function asText(v) {
    if (v == null || v === '') return null;
    return String(v);
  }

  function asUuid(v) {
    if (!v) return null;
    var s = String(v);
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s) ? s : null;
  }

  function asTime(v) {
    if (!v) return null;
    return String(v);
  }

  function cycleToRow(rec, userId) {
    return {
      id: rec.id,
      title: rec.title || '',
      year_group: rec.year_group || '',
      tracking_point_id: asText(rec.tracking_point_id),
      tracking_point_label: asText(rec.tracking_point_label),
      session: asText(rec.session),
      status: rec.status || 'open',
      created_by_role: asText(rec.created_by_role),
      created_by_teacher_id: asText(rec.created_by_teacher_id),
      created_by_label: asText(rec.created_by_label),
      created_by_user_id: asUuid(rec.created_by_user_id) || userId || null,
      created_at: rec.created_at || new Date().toISOString(),
      updated_at: rec.updated_at || new Date().toISOString()
    };
  }

  function classReviewToRow(rec) {
    return {
      id: rec.id,
      review_cycle_id: rec.review_cycle_id,
      class_id: rec.class_id,
      teacher_id: asText(rec.teacher_id),
      teacher_hub_user_id: asUuid(rec.teacher_hub_user_id),
      started_at: asTime(rec.started_at),
      completed_at: asTime(rec.completed_at),
      status: rec.status || 'not_started',
      meeting_notes: rec.meeting_notes || '',
      created_at: rec.created_at || new Date().toISOString(),
      updated_at: rec.updated_at || new Date().toISOString()
    };
  }

  function pupilReviewToRow(rec) {
    return {
      id: rec.id,
      class_review_id: rec.class_review_id,
      enrolment_id: rec.enrolment_id,
      pupil_id: asText(rec.pupil_id),
      discussion_status: rec.discussion_status || 'suggested',
      reviewed: !!rec.reviewed,
      reviewed_at: asTime(rec.reviewed_at),
      notes: rec.notes || '',
      created_at: rec.created_at || new Date().toISOString(),
      updated_at: rec.updated_at || new Date().toISOString()
    };
  }

  function actionToRow(rec, userId) {
    return {
      id: rec.id,
      class_review_id: rec.class_review_id,
      enrolment_id: asText(rec.enrolment_id),
      pupil_id: asText(rec.pupil_id),
      owner_type: rec.owner_type || 'teacher',
      owner_id: asText(rec.owner_id),
      action_text: rec.action_text || '',
      review_point_id: asText(rec.review_point_id),
      review_date: asText(rec.review_date),
      status: rec.status || 'open',
      completed_at: asTime(rec.completed_at),
      created_by_role: asText(rec.created_by_role),
      created_by_teacher_id: asText(rec.created_by_teacher_id),
      created_by_label: asText(rec.created_by_label),
      created_by_user_id: asUuid(rec.created_by_user_id) || userId || null,
      created_at: rec.created_at || new Date().toISOString(),
      updated_at: rec.updated_at || new Date().toISOString()
    };
  }

  function rowToEntity(row) {
    return row && typeof row === 'object' ? Object.assign({}, row) : null;
  }

  function mergeById(localArr, remoteArr) {
    var map = {};
    (remoteArr || []).forEach(function(r) {
      if (r && r.id) map[r.id] = r;
    });
    (localArr || []).forEach(function(r) {
      if (!r || !r.id) return;
      var other = map[r.id];
      if (!other) {
        map[r.id] = r;
        return;
      }
      map[r.id] = String(r.updated_at || '') >= String(other.updated_at || '') ? r : other;
    });
    return Object.keys(map).map(function(k) { return map[k]; });
  }

  function mergeStores(local, remote) {
    var out = emptyStore();
    out.review_cycles = mergeById(local.review_cycles, remote.review_cycles);
    out.class_reviews = mergeById(local.class_reviews, remote.class_reviews);
    out.pupil_reviews = mergeById(local.pupil_reviews, remote.pupil_reviews);
    out.actions = mergeById(local.actions, remote.actions);
    out.created_at = local.created_at || remote.created_at || out.created_at;
    out.updated_at = new Date().toISOString();
    return out;
  }

  function setStatus(next, message) {
    status = next || 'idle';
    statusMessage = message || null;
  }

  function finishReady() {
    ready = true;
    hydratedOnce = true;
    hydrating = false;
    var waiters = hydrateWaiters.slice();
    hydrateWaiters = [];
    waiters.forEach(function(fn) { fn(); });
  }

  function getSession() {
    if (!supabaseReady() || !global.window.supabase.auth) return Promise.resolve(null);
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

  function selectAll(table) {
    return global.window.supabase.from(table).select('*').then(function(res) {
      if (res.error) throw res.error;
      return (res.data || []).map(rowToEntity).filter(Boolean);
    });
  }

  function upsertRows(table, rows) {
    if (!rows.length) return Promise.resolve();
    return global.window.supabase.from(table).upsert(rows, { onConflict: 'id' }).then(function(res) {
      if (res.error) throw res.error;
    });
  }

  function deleteActionIds(ids) {
    if (!ids.length) return Promise.resolve();
    return global.window.supabase.from(TABLES.actions).delete().in('id', ids).then(function(res) {
      if (res.error) throw res.error;
    });
  }

  function fetchRemoteStore() {
    return Promise.all([
      selectAll(TABLES.cycles),
      selectAll(TABLES.classReviews),
      selectAll(TABLES.pupilReviews),
      selectAll(TABLES.actions)
    ]).then(function(parts) {
      var store = emptyStore();
      store.review_cycles = parts[0];
      store.class_reviews = parts[1];
      store.pupil_reviews = parts[2];
      store.actions = parts[3];
      return store;
    });
  }

  function pushRemote(store) {
    if (!hubMode() || !supabaseReady()) {
      setStatus('offline');
      return Promise.resolve(false);
    }
    setStatus('syncing');
    return getSession().then(function(session) {
      if (!session) {
        setStatus('offline', 'Not signed in');
        return false;
      }
      var userId = session.user && session.user.id ? session.user.id : null;
      var cycles = dirtyRows('cycles', store.review_cycles, function(r) { return cycleToRow(r, userId); });
      var classReviews = dirtyRows('classReviews', store.class_reviews, classReviewToRow);
      var pupilReviews = dirtyRows('pupilReviews', store.pupil_reviews, pupilReviewToRow);
      var actions = dirtyRows('actions', store.actions, function(r) { return actionToRow(r, userId); });
      var currentActionIds = {};
      (store.actions || []).forEach(function(a) { if (a && a.id) currentActionIds[a.id] = true; });
      var removed = Object.keys(syncedActionIds).filter(function(id) { return !currentActionIds[id]; });
      return upsertRows(TABLES.cycles, cycles)
        .then(function() { return upsertRows(TABLES.classReviews, classReviews); })
        .then(function() { return upsertRows(TABLES.pupilReviews, pupilReviews); })
        .then(function() { return upsertRows(TABLES.actions, actions); })
        .then(function() { return deleteActionIds(removed); })
        .then(function() {
          markSent('cycles', cycles);
          markSent('classReviews', classReviews);
          markSent('pupilReviews', pupilReviews);
          markSent('actions', actions);
          rememberActionIds(store);
          setStatus('synced');
          return true;
        });
    }).catch(function(err) {
      setStatus('error', err && err.message ? err.message : String(err));
      return false;
    });
  }

  function flushPush() {
    if (!pendingPush || !memory) return Promise.resolve(false);
    if (pushTimer) {
      clearTimeout(pushTimer);
      pushTimer = null;
    }
    pendingPush = false;
    return pushRemote(memory);
  }

  function schedulePush() {
    if (!hubMode() || !supabaseReady()) return;
    pendingPush = true;
    if (!ready) return;
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(function() {
      pushTimer = null;
      flushPush();
    }, DEBOUNCE_MS);
  }

  function hydrate(callback) {
    if (!hubMode()) {
      memory = loadLocal();
      rememberActionIds(memory);
      setStatus('local');
      finishReady();
      if (callback) callback(status, statusMessage, false);
      return Promise.resolve(false);
    }
    if (hydrating) {
      return whenReady(function() {
        if (callback) callback(status, statusMessage, false);
      }).then(function() { return false; });
    }
    if (hydratedOnce && ready) {
      if (callback) callback(status, statusMessage, false);
      return Promise.resolve(false);
    }
    if (!supabaseReady()) {
      if (!memory) memory = emptyStore();
      setStatus('offline');
      finishReady();
      if (callback) callback(status, statusMessage, false);
      return Promise.resolve(false);
    }
    hydrating = true;
    ready = false;
    setStatus('loading');
    return getSession().then(function(session) {
      if (!session) {
        if (!memory) memory = emptyStore();
        setStatus('offline', 'Sign in to Faculty Hub to share meetings');
        finishReady();
        if (callback) callback(status, statusMessage, false);
        return false;
      }
      return fetchRemoteStore().then(function(remote) {
        var local = memory || emptyStore();
        var hasLocal = (local.review_cycles && local.review_cycles.length) ||
          (local.class_reviews && local.class_reviews.length) ||
          (local.actions && local.actions.length);
        if (hasLocal) memory = mergeStores(local, remote);
        else memory = remote;
        var userId = session.user && session.user.id ? session.user.id : null;
        rememberSentFromStore(memory, userId);
        setStatus('synced');
        finishReady();
        if (pendingPush) schedulePush();
        if (callback) callback(status, statusMessage, true);
        return true;
      });
    }).catch(function(err) {
      if (!memory) memory = emptyStore();
      var msg = err && err.message ? err.message : String(err);
      if (err && (err.code === 'PGRST205' || /spt_attainment_review_cycles/i.test(msg))) {
        msg = 'Attainment meeting tables are not on this project yet. Apply supabase/migrations/20260828200000_spt_attainment_meetings.sql';
      }
      setStatus('error', msg);
      finishReady();
      if (callback) callback(status, statusMessage, false);
      return false;
    });
  }

  function whenReady(callback) {
    if (ready) {
      if (callback) callback();
      return Promise.resolve();
    }
    return new Promise(function(resolve) {
      hydrateWaiters.push(function() {
        if (callback) callback();
        resolve();
      });
      if (!hydrating) hydrate(function() {});
    });
  }

  function load() {
    if (!hubMode()) {
      memory = loadLocal();
      return memory;
    }
    if (!memory) memory = emptyStore();
    return memory;
  }

  function save(store) {
    store = store || emptyStore();
    store.updated_at = new Date().toISOString();
    store.version = STORE_VERSION;
    if (!hubMode()) return saveLocal(store);
    memory = store;
    schedulePush();
    return store;
  }

  if (!hubMode()) {
    memory = loadLocal();
    ready = true;
    hydratedOnce = true;
    setStatus('local');
  } else {
    memory = emptyStore();
  }

  if (typeof global.window !== 'undefined') {
    global.window.addEventListener('pagehide', function() {
      if (hubMode() && pendingPush) flushPush();
    });
  }

  global.SptAttainmentMeetingStore = {
    STORE_VERSION: STORE_VERSION,
    TABLES: TABLES,
    hubMode: hubMode,
    mode: function() { return hubMode() ? 'hub' : 'local'; },
    load: load,
    save: save,
    hydrate: hydrate,
    whenReady: whenReady,
    flush: flushPush,
    isReady: function() { return ready; },
    getStatus: function() { return { status: status, message: statusMessage }; }
  };
})(typeof window !== 'undefined' ? window : global);
