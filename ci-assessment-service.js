/**
 * N5 Creative Industries assessment — Supabase store.
 *
 * Every pupil, decision and follow-up is its own row, so marking on an iPad
 * and a classroom PC at once never overwrites anything. Writes that fail
 * because the device is offline wait in a queue on this device and are sent
 * when the connection returns. Until migration 20261031150000_ci_assessment.sql
 * is run, the tracker works on this device only.
 */
(function () {
  var QUEUE_KEY = 'ciAssessQueue';
  var CACHE_PREFIX = 'ciAssessCache:';
  var TABLES = {
    pupils: 'ci_assess_pupils',
    marks: 'ci_assess_marks',
    followups: 'ci_assess_followups',
    settings: 'ci_assess_settings'
  };
  var KEYS = {
    pupils: 'id',
    marks: 'pupil_id,code',
    followups: 'id',
    settings: 'school_year'
  };

  var mode = 'local';
  var modeReason = '';
  var me = { id: null, name: '', canWrite: true };
  var flushing = false;
  var listeners = [];
  var channel = null;

  function db() {
    return window.supabase && window.supabase.from ? window.supabase : null;
  }

  function uid() {
    if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  function isMissingTable(err) {
    if (!err) return false;
    var msg = String(err.message || '');
    return err.code === '42P01' || err.code === 'PGRST205' || /does not exist|schema cache/i.test(msg);
  }

  function isOffline(err) {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
    var msg = String((err && err.message) || err || '');
    return /Failed to fetch|NetworkError|Load failed|network/i.test(msg);
  }

  function formatError(err) {
    if (!err) return 'Something went wrong';
    var msg = err.message || String(err);
    if (err.code === '42501' || /policy|permission|denied/i.test(msg)) {
      return 'Your account can view this tracker but not change it.';
    }
    return msg;
  }

  function readJson(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      return false;
    }
  }

  function emit(evt) {
    listeners.forEach(function (fn) {
      try { fn(evt); } catch (e) { /* listener errors stay local */ }
    });
  }

  function queue() {
    return readJson(QUEUE_KEY, []);
  }

  function setQueue(q) {
    writeJson(QUEUE_KEY, q);
    emit({ type: 'queue', pending: q.length });
  }

  function run(op) {
    var s = db();
    var t = s.from(TABLES[op.table]);
    if (op.action === 'delete') {
      var q = t.delete();
      Object.keys(op.match).forEach(function (k) { q = q.eq(k, op.match[k]); });
      return q.then(function (r) { if (r.error) throw r.error; return null; });
    }
    var rows = Array.isArray(op.rows) ? op.rows : [op.rows];
    return t.upsert(rows, { onConflict: KEYS[op.table] })
      .select()
      .then(function (r) {
        if (r.error) throw r.error;
        return r.data || [];
      });
  }

  function flush() {
    if (mode !== 'cloud' || flushing) return Promise.resolve();
    var q = queue();
    if (!q.length) return Promise.resolve();
    flushing = true;
    var next = function () {
      var current = queue();
      if (!current.length) {
        flushing = false;
        emit({ type: 'synced' });
        return Promise.resolve();
      }
      return run(current[0]).then(function () {
        setQueue(queue().slice(1));
        return next();
      }).catch(function (err) {
        flushing = false;
        if (isOffline(err)) return;
        // A write the server refuses will never succeed; drop it and say so.
        setQueue(queue().slice(1));
        emit({ type: 'error', message: formatError(err) });
        return next();
      });
    };
    return next();
  }

  function write(op) {
    if (mode !== 'cloud') return Promise.resolve(null);
    if (queue().length) {
      setQueue(queue().concat([op]));
      return flush().then(function () { return null; });
    }
    return run(op).catch(function (err) {
      if (isOffline(err)) {
        setQueue(queue().concat([op]));
        emit({ type: 'offline' });
        return null;
      }
      throw err;
    });
  }

  function loadMe(session) {
    var s = db();
    me.id = session.user.id;
    me.name = (session.user.user_metadata && session.user.user_metadata.full_name) ||
      String(session.user.email || '').split('@')[0];
    me.canWrite = String(window.__authGuardRole || '').toLowerCase() !== 'read_only';
    return s.from('profiles').select('display_name').eq('id', me.id).maybeSingle()
      .then(function (r) {
        var dn = r && r.data && r.data.display_name && String(r.data.display_name).trim();
        if (dn) me.name = dn;
      })
      .catch(function () {});
  }

  function init(year) {
    var s = db();
    if (!s || !s.auth) {
      mode = 'local';
      modeReason = 'no-cloud';
      return Promise.resolve({ mode: mode, reason: modeReason });
    }
    return s.auth.getSession().then(function (r) {
      var session = r && r.data && r.data.session;
      if (!session) {
        mode = 'local';
        modeReason = 'signed-out';
        return { mode: mode, reason: modeReason };
      }
      return loadMe(session).then(function () {
        return s.from(TABLES.settings).select('school_year').eq('school_year', year).limit(1);
      }).then(function (probe) {
        if (probe.error && isMissingTable(probe.error)) {
          mode = 'local';
          modeReason = 'no-migration';
        } else if (probe.error && isOffline(probe.error)) {
          mode = 'cloud';
          modeReason = 'offline';
        } else if (probe.error) {
          mode = 'local';
          modeReason = formatError(probe.error);
        } else {
          mode = 'cloud';
          modeReason = '';
        }
        return { mode: mode, reason: modeReason };
      });
    }).catch(function (err) {
      mode = isOffline(err) ? 'cloud' : 'local';
      modeReason = isOffline(err) ? 'offline' : formatError(err);
      return { mode: mode, reason: modeReason };
    });
  }

  function load(year) {
    var cached = readJson(CACHE_PREFIX + year, null);
    if (mode !== 'cloud') return Promise.resolve(cached || null);
    var s = db();
    return flush().then(function () {
      return Promise.all([
        s.from(TABLES.settings).select('*').eq('school_year', year).maybeSingle(),
        s.from(TABLES.pupils).select('*').eq('school_year', year).order('name'),
        s.from(TABLES.followups).select('*').eq('school_year', year).order('created_at')
      ]);
    }).then(function (res) {
      for (var i = 0; i < res.length; i++) if (res[i].error) throw res[i].error;
      var pupils = res[1].data || [];
      var ids = pupils.map(function (p) { return p.id; });
      var fetchMarks = ids.length
        ? fetchAllMarks(ids)
        : Promise.resolve([]);
      return fetchMarks.then(function (marks) {
        return {
          settings: res[0].data || { school_year: year, intro_variant: 'UK' },
          pupils: pupils,
          marks: marks,
          followups: res[2].data || []
        };
      });
    }).catch(function (err) {
      if (isOffline(err) && cached) {
        emit({ type: 'offline' });
        return cached;
      }
      throw err;
    });
  }

  // A class of 20 has up to 1,500 decision rows; read them in pages.
  function fetchAllMarks(ids) {
    var s = db();
    var out = [];
    var pageSize = 1000;
    var page = function (from) {
      return s.from(TABLES.marks).select('*').in('pupil_id', ids)
        .order('pupil_id').order('code')
        .range(from, from + pageSize - 1)
        .then(function (r) {
          if (r.error) throw r.error;
          out = out.concat(r.data || []);
          if ((r.data || []).length === pageSize) return page(from + pageSize);
          return out;
        });
    };
    return page(0);
  }

  function cache(year, snapshot) {
    return writeJson(CACHE_PREFIX + year, snapshot);
  }

  function subscribe(year, fn) {
    listeners.push(fn);
    if (mode !== 'cloud' || channel || !db().channel) return;
    var forward = function (table) {
      return function (payload) {
        emit({ type: 'change', table: table, event: payload.eventType, row: payload.new, old: payload.old });
      };
    };
    channel = db().channel('ci-assess-' + year)
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLES.pupils, filter: 'school_year=eq.' + year }, forward('pupils'))
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLES.marks }, forward('marks'))
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLES.followups, filter: 'school_year=eq.' + year }, forward('followups'))
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLES.settings, filter: 'school_year=eq.' + year }, forward('settings'))
      .subscribe();
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('online', function () { flush(); });
    setInterval(function () { if (queue().length) flush(); }, 30000);
  }

  window.CiAssessService = {
    init: init,
    load: load,
    cache: cache,
    subscribe: subscribe,
    flush: flush,
    uid: uid,
    formatError: formatError,
    mode: function () { return mode; },
    modeReason: function () { return modeReason; },
    me: function () { return me; },
    pending: function () { return queue().length; },

    upsertPupils: function (rows) { return write({ table: 'pupils', action: 'upsert', rows: rows }); },
    deletePupil: function (id) { return write({ table: 'pupils', action: 'delete', match: { id: id } }); },
    upsertMarks: function (rows) { return write({ table: 'marks', action: 'upsert', rows: rows }); },
    deleteMark: function (pupilId, code) { return write({ table: 'marks', action: 'delete', match: { pupil_id: pupilId, code: code } }); },
    upsertFollowup: function (row) { return write({ table: 'followups', action: 'upsert', rows: row }); },
    deleteFollowup: function (id) { return write({ table: 'followups', action: 'delete', match: { id: id } }); },
    saveSettings: function (row) { return write({ table: 'settings', action: 'upsert', rows: row }); }
  };
})();
