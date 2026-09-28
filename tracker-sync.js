/**
 * Safe cloud saving for the Drama / Art BGE trackers.
 *
 * - A failed load blocks saving, so an empty screen can never overwrite real data.
 * - Saves are grouped (rapid taps become one write) and sent one at a time.
 * - Each write only lands if the cloud copy is unchanged since this device last saw it.
 *   If another device saved first, the two sets of changes are merged cell by cell
 *   (this device wins only where both changed the same cell) and the save is retried.
 * - Unsaved work is kept in this browser until the cloud confirms it, and is merged
 *   back in on the next load if the tab was closed first.
 */
(function(root) {
  'use strict';

  function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
  function clone(v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); }

  function deepEqual(a, b) {
    if (a === b) return true;
    if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    if (Array.isArray(a)) {
      if (a.length !== b.length) return false;
      for (var i = 0; i < a.length; i++) if (!deepEqual(a[i], b[i])) return false;
      return true;
    }
    var ka = Object.keys(a), kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    for (var j = 0; j < ka.length; j++) {
      if (!Object.prototype.hasOwnProperty.call(b, ka[j]) || !deepEqual(a[ka[j]], b[ka[j]])) return false;
    }
    return true;
  }

  function isIdList(arr) {
    return Array.isArray(arr) && arr.length > 0 && arr.every(function(x) { return isObj(x) && x.id != null; });
  }

  // Pupil lists: merge by pupil id so a pupil added on each device is kept.
  function mergeIdLists(base, local, remote) {
    function byId(list) { var m = {}; (list || []).forEach(function(x) { m[x.id] = x; }); return m; }
    var b = byId(Array.isArray(base) ? base : []), l = byId(local), r = byId(remote);
    var out = [];
    local.forEach(function(item) {
      var id = item.id, inB = id in b;
      if (id in r) out.push(merge3(b[id], item, r[id]));
      else if (!inB || !deepEqual(item, b[id])) out.push(clone(item)); // added here, or edited here
    });
    remote.forEach(function(item) {
      var id = item.id;
      if (id in l) return;
      if (!(id in b) || !deepEqual(item, b[id])) out.push(clone(item)); // added there, or edited there
    });
    return out;
  }

  /** Three-way merge: keep every change made on either side since base. */
  function merge3(base, local, remote) {
    if (deepEqual(local, base)) return clone(remote);
    if (deepEqual(remote, base) || deepEqual(local, remote)) return clone(local);
    if (isObj(local) && isObj(remote)) {
      var b = isObj(base) ? base : {};
      var out = {};
      var keys = Object.keys(local).concat(Object.keys(remote).filter(function(k) { return !(k in local); }));
      keys.forEach(function(k) {
        var inL = k in local, inR = k in remote, inB = k in b;
        if (inL && inR) { out[k] = merge3(b[k], local[k], remote[k]); return; }
        if (inL) { if (!inB || !deepEqual(local[k], b[k])) out[k] = clone(local[k]); return; }
        if (!inB || !deepEqual(remote[k], b[k])) out[k] = clone(remote[k]);
      });
      return out;
    }
    if ((isIdList(local) || isIdList(remote)) && Array.isArray(local) && Array.isArray(remote)) {
      return mergeIdLists(base, local, remote);
    }
    return clone(local);
  }

  function replaceContents(target, source) {
    Object.keys(target).forEach(function(k) { delete target[k]; });
    Object.keys(source || {}).forEach(function(k) { target[k] = source[k]; });
  }

  var BACKUP_MAX_AGE_MS = 21 * 24 * 60 * 60 * 1000;
  var RETRY_DELAYS = [3000, 10000, 30000, 60000];

  /**
   * options: { dataType, state, onStatus(status, detail), onRemoteChange(), debounceMs }
   * status: 'loading' | 'saved' | 'pending' | 'saving' | 'retrying' | 'offline' | 'load-failed' | 'signed-out' | 'local'
   */
  function create(options) {
    var dataType = options.dataType;
    var S = options.state;
    var onStatus = options.onStatus || function() {};
    var onRemoteChange = options.onRemoteChange || function() {};
    var debounceMs = options.debounceMs == null ? 800 : options.debounceMs;

    var loaded = false, local = false, userId = null;
    var base = null, baseUpdatedAt = null;
    var dirty = false, inFlight = null, timer = null, retryTimer = null, retryCount = 0;
    var waiters = [];
    var status = 'loading';

    function setStatus(s, detail) { status = s; onStatus(s, detail); }
    function backupKey() { return userId ? 'tracker-unsaved:' + userId + ':' + dataType : null; }

    function writeBackup() {
      var key = backupKey();
      if (!key || !dirty) return;
      try {
        localStorage.setItem(key, JSON.stringify({ at: Date.now(), baseUpdatedAt: baseUpdatedAt, base: base, local: S }));
      } catch (e) { /* storage full or blocked: keep going */ }
    }
    function clearBackup() {
      var key = backupKey();
      if (key) try { localStorage.removeItem(key); } catch (e) { /* storage full or blocked: keep going */ }
    }

    function settleWaiters() {
      var w = waiters; waiters = [];
      w.forEach(function(fn) { fn(); });
    }

    function load() {
      setStatus('loading');
      if (!root.DataService || typeof root.DataService.getWithVersion !== 'function') {
        loaded = false;
        setStatus('load-failed', 'Save service unavailable');
        return Promise.resolve({ ok: false });
      }
      return root.DataService.getWithVersion(dataType).then(function(res) {
        local = !!res.local;
        userId = res.userId || null;
        base = res.data ? clone(res.data) : null;
        baseUpdatedAt = res.updatedAt || null;
        if (res.data) Object.assign(S, clone(res.data));
        loaded = true;
        var recovered = recoverBackup();
        setStatus(local ? 'local' : (recovered ? 'pending' : 'saved'));
        if (recovered) scheduleSave(0);
        return { ok: true, recovered: recovered };
      }).catch(function(err) {
        loaded = false;
        setStatus(err && err.code === 'no-session' ? 'signed-out' : 'load-failed', err && err.message);
        return { ok: false, error: err };
      });
    }

    // Unsaved edits from a tab that closed before the cloud confirmed them.
    function recoverBackup() {
      var key = backupKey();
      if (!key) return false;
      var raw = null;
      try { raw = localStorage.getItem(key); } catch (e) { /* storage full or blocked: keep going */ }
      if (!raw) return false;
      var bak = null;
      try { bak = JSON.parse(raw); } catch (e) { /* storage full or blocked: keep going */ }
      if (!bak || !bak.local || !bak.at || Date.now() - bak.at > BACKUP_MAX_AGE_MS) { clearBackup(); return false; }
      if (deepEqual(bak.local, bak.base)) { clearBackup(); return false; }
      var merged = merge3(bak.base, bak.local, clone(S));
      if (deepEqual(merged, S)) { clearBackup(); return false; }
      replaceContents(S, merged);
      dirty = true;
      return true;
    }

    function canSave() {
      if (!loaded) return false;
      if (root.TrackerReadonlyView && root.TrackerReadonlyView.isActive()) return false;
      return true;
    }

    function scheduleSave(delay) {
      if (timer) clearTimeout(timer);
      timer = setTimeout(function() { timer = null; run(); }, delay == null ? debounceMs : delay);
    }

    /** Mark the tracker changed. Resolves once this change has been written (or the attempt fails). */
    function save() {
      if (!canSave()) return Promise.resolve();
      dirty = true;
      if (status !== 'offline' && status !== 'retrying') setStatus('pending');
      var p = new Promise(function(resolve) { waiters.push(resolve); });
      if (retryTimer) return p; // a retry is already scheduled
      scheduleSave();
      return p;
    }

    function run() {
      if (inFlight || !dirty || !canSave()) { if (!dirty) settleWaiters(); return inFlight || Promise.resolve(); }
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        writeBackup();
        setStatus('offline');
        settleWaiters();
        return Promise.resolve();
      }
      dirty = false;
      var payload = clone(S);
      writeBackupOf(payload);
      setStatus('saving');
      inFlight = write(payload, 0).then(function() {
        inFlight = null;
        retryCount = 0;
        if (dirty) { setStatus('pending'); scheduleSave(); }
        else { clearBackup(); setStatus(local ? 'local' : 'saved'); settleWaiters(); }
      }, function(err) {
        inFlight = null;
        dirty = true;
        writeBackup();
        var delay = RETRY_DELAYS[Math.min(retryCount, RETRY_DELAYS.length - 1)];
        retryCount++;
        setStatus(navigator.onLine === false ? 'offline' : 'retrying', err && err.message);
        settleWaiters();
        if (retryTimer) clearTimeout(retryTimer);
        retryTimer = setTimeout(function() { retryTimer = null; run(); }, delay);
      });
      return inFlight;
    }

    function writeBackupOf(payload) {
      var key = backupKey();
      if (!key) return;
      try {
        localStorage.setItem(key, JSON.stringify({ at: Date.now(), baseUpdatedAt: baseUpdatedAt, base: base, local: payload }));
      } catch (e) { /* storage full or blocked: keep going */ }
    }

    function write(payload, attempt) {
      return root.DataService.setIfUnchanged(dataType, payload, baseUpdatedAt).then(function(res) {
        base = payload;
        baseUpdatedAt = res.updatedAt || baseUpdatedAt;
      }, function(err) {
        if (!err || err.code !== 'conflict' || attempt >= 3) throw err;
        return mergeRemote().then(function() { return write(clone(S), attempt + 1); });
      });
    }

    // Another device saved: fold its changes into ours, keeping ours where both changed.
    function mergeRemote() {
      return root.DataService.getWithVersion(dataType).then(function(res) {
        if (!res.data) { base = null; baseUpdatedAt = null; return; } // row gone: write ours as new
        var remote = res.data;
        var merged = merge3(base, clone(S), remote);
        var changedHere = !deepEqual(merged, S);
        replaceContents(S, merged);
        base = clone(remote);
        baseUpdatedAt = res.updatedAt || null;
        if (changedHere) onRemoteChange();
      });
    }

    /** Pick up saves from other devices, e.g. when an iPad wakes. */
    function refresh() {
      if (!loaded || local || inFlight || !root.DataService) return Promise.resolve();
      return root.DataService.getWithVersion(dataType).then(function(res) {
        if (inFlight || !res.data || res.updatedAt === baseUpdatedAt) return;
        var merged = merge3(base, clone(S), res.data);
        var changedHere = !deepEqual(merged, S);
        replaceContents(S, merged);
        base = clone(res.data);
        baseUpdatedAt = res.updatedAt || null;
        if (!deepEqual(S, base)) { dirty = true; scheduleSave(0); }
        if (changedHere) onRemoteChange();
      }).catch(function() {});
    }

    /** Save now. Resolves { ok } once the cloud has everything, or the attempt failed. */
    function flush() {
      if (!canSave()) return Promise.resolve({ ok: false });
      if (timer) { clearTimeout(timer); timer = null; }
      if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
      function done() { return { ok: !dirty && !inFlight && (status === 'saved' || status === 'local') }; }
      var tries = 0;
      function step() {
        if (inFlight) return inFlight.then(step);
        if (!dirty) return Promise.resolve(done());
        if (tries++ > 0 && (status === 'retrying' || status === 'offline')) return Promise.resolve(done());
        return run().then(step);
      }
      return step();
    }

    function hasUnsaved() { return dirty || !!inFlight; }

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', function() {
        if (document.visibilityState === 'hidden') { writeBackup(); if (dirty) run(); }
        else refresh();
      });
      root.addEventListener('pagehide', function() { writeBackup(); });
      root.addEventListener('online', function() { if (dirty) { retryCount = 0; run(); } });
      root.addEventListener('beforeunload', function(e) {
        if (!hasUnsaved()) return;
        writeBackup();
        e.preventDefault();
        e.returnValue = '';
      });
    }

    return {
      load: load,
      save: save,
      flush: flush,
      refresh: refresh,
      hasUnsaved: hasUnsaved,
      isLoaded: function() { return loaded; },
      status: function() { return status; }
    };
  }

  root.TrackerSync = { create: create, merge3: merge3, deepEqual: deepEqual };
})(typeof window !== 'undefined' ? window : globalThis);
