/**
 * Faculty focus of the week.
 * One shared sentence per school week (Monday), set by a faculty head or admin,
 * shown at the top of every teacher's School work and on the Faculty Hub home.
 *
 * Table: public.faculty_weekly_focus (see supabase/migrations/20260927190000_faculty_weekly_focus.sql).
 * Everyone signed in reads; only public.is_school_manager() writes (RLS).
 *
 * A local cache keeps the last known focus per week so pages paint at once and
 * still show it offline. Any read failure (including the table not existing yet)
 * falls back to that cache, never to an error on the page.
 */
(function () {
  'use strict';

  var TABLE = 'faculty_weekly_focus';
  var CACHE_KEY = 'facultyFocus.cache.v1';

  function client() {
    if (window.supabase && typeof window.supabase.from === 'function') return window.supabase;
    try {
      if (window.parent && window.parent !== window && window.parent.supabase && typeof window.parent.supabase.from === 'function') {
        return window.parent.supabase;
      }
    } catch (err) {
      /* not inside the hub */
    }
    return null;
  }

  function flagsOn(win) {
    return !!(win && (win.__authGuardCanManageSchool || win.__authGuardIsAdmin || win.__authGuardIsFacultyHead));
  }

  function canEdit() {
    if (flagsOn(window)) return true;
    try {
      if (window.parent && window.parent !== window && flagsOn(window.parent)) return true;
    } catch (err) {
      /* not inside the hub */
    }
    return false;
  }

  function pad(n) { return String(n).padStart(2, '0'); }

  /* The school week a date belongs to: Monday, or next Monday at the weekend. */
  function mondayISO(date) {
    var d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    var day = d.getDay();
    var shift = day === 0 ? 1 : day === 6 ? 2 : 1 - day;
    d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + shift);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function readCache() {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}') || {}; }
    catch (err) { return {}; }
  }

  function writeCache(weekStart, row) {
    try {
      var cache = readCache();
      cache[weekStart] = row;
      var keys = Object.keys(cache).sort();
      while (keys.length > 20) delete cache[keys.shift()];
      localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch (err) {
      /* private mode: no cache */
    }
  }

  function normalise(row) {
    if (!row || !row.focus) return null;
    return {
      weekStart: row.week_start,
      focus: String(row.focus),
      setByName: row.set_by_name ? String(row.set_by_name) : '',
      updatedAt: row.updated_at || ''
    };
  }

  /** Last known focus for the week: a row, null (known to be unset) or undefined (never loaded). */
  function cached(weekStart) {
    var cache = readCache();
    return Object.prototype.hasOwnProperty.call(cache, weekStart) ? cache[weekStart] : undefined;
  }

  /** Resolves the week's focus row or null. Never rejects. */
  function get(weekStart) {
    var db = client();
    if (!db) return Promise.resolve(cached(weekStart) || null);
    return Promise.resolve(
      db.from(TABLE).select('week_start, focus, set_by_name, updated_at').eq('week_start', weekStart).maybeSingle()
    ).then(function (r) {
      if (r && r.error) throw r.error;
      var row = normalise(r && r.data);
      writeCache(weekStart, row);
      return row;
    }).catch(function () {
      return cached(weekStart) || null;
    });
  }

  function displayName(db, user) {
    var fallback = String(user.email || '').split('@')[0] || '';
    return Promise.resolve(
      db.from('profiles').select('display_name').eq('id', user.id).maybeSingle()
    ).then(function (r) {
      return (r && r.data && r.data.display_name) || fallback;
    }).catch(function () { return fallback; });
  }

  /** Save (or clear, with empty text) the week's focus. Rejects with a readable message. */
  function set(weekStart, text) {
    var db = client();
    var clean = String(text || '').trim().slice(0, 180);
    if (!db || !db.auth) return Promise.reject(new Error('Sign in to the Faculty Hub to set the faculty focus.'));
    return db.auth.getSession().then(function (r) {
      var session = r && r.data ? r.data.session : null;
      if (!session || !session.user) throw new Error('Sign in to the Faculty Hub to set the faculty focus.');
      if (!clean) {
        return Promise.resolve(db.from(TABLE).delete().eq('week_start', weekStart)).then(function (res) {
          if (res && res.error) throw res.error;
          writeCache(weekStart, null);
          return null;
        });
      }
      return displayName(db, session.user).then(function (name) {
        var payload = { week_start: weekStart, focus: clean, set_by: session.user.id, set_by_name: name };
        return Promise.resolve(
          db.from(TABLE).upsert(payload, { onConflict: 'week_start' }).select('week_start, focus, set_by_name, updated_at').maybeSingle()
        ).then(function (res) {
          if (res && res.error) throw res.error;
          var row = normalise(res && res.data) || normalise(payload);
          writeCache(weekStart, row);
          return row;
        });
      });
    }).catch(function (err) {
      var msg = String((err && (err.message || err.details)) || '');
      if (/faculty_weekly_focus|does not exist|PGRST205|42P01/i.test(msg + ' ' + (err && err.code))) {
        throw new Error('The faculty focus table is not set up yet. Run the faculty_weekly_focus migration in Supabase.');
      }
      if (/row-level security|permission|42501/i.test(msg + ' ' + (err && err.code))) {
        throw new Error('Only faculty heads and admins can set the faculty focus.');
      }
      throw err instanceof Error ? err : new Error(msg || 'Could not save the faculty focus.');
    });
  }

  window.FacultyFocus = {
    get: get,
    set: set,
    cached: cached,
    canEdit: canEdit,
    mondayISO: mondayISO
  };
})();
