/**
 * Announcement notes — the faculty head's private jottings for the next
 * round of announcements, kept on the Announcements page (My notes tab).
 * The Sunday-night announcements agent reads the waiting ones and sets
 * used_at on each note it turns into an announcement.
 *
 * Table: public.announcement_notes (see supabase/migrations/20261101130000_announcement_notes.sql).
 * Only the owner can read or change a note (RLS).
 */
(function () {
  'use strict';

  var TABLE = 'announcement_notes';
  var MAX_TEXT = 2000;
  var COLUMNS = 'id, body, mention_from, used_at, used_in, created_at, updated_at';
  // Used notes stay listed for this long so you can see what went out.
  var USED_DAYS = 60;

  function client() {
    if (window.supabase && typeof window.supabase.from === 'function') return window.supabase;
    return null;
  }

  function session() {
    var db = client();
    if (!db || !db.auth) return Promise.reject(new Error('Sign in to the Faculty Hub to use your notes.'));
    return db.auth.getSession().then(function (r) {
      var s = r && r.data ? r.data.session : null;
      if (!s || !s.user) throw new Error('Sign in to the Faculty Hub to use your notes.');
      return { db: db, user: s.user };
    });
  }

  function friendlyError(err, fallback) {
    var msg = String((err && (err.message || err.details)) || '');
    var code = String((err && err.code) || '');
    if (/announcement_notes|does not exist|PGRST20[25]|42P01/i.test(msg + ' ' + code)) {
      var e = new Error('Notes are not set up yet. Run the announcement_notes migration in Supabase.');
      e.notSetUp = true;
      return e;
    }
    if (/row-level security|permission|42501/i.test(msg + ' ' + code)) {
      return new Error('You don\'t have permission to do that.');
    }
    if (/check constraint|23514/i.test(msg + ' ' + code)) {
      return new Error('A note needs some text, up to ' + MAX_TEXT + ' characters.');
    }
    return err instanceof Error && msg ? err : new Error(fallback);
  }

  function normalise(row) {
    return {
      id: row.id,
      body: String(row.body || ''),
      mentionFrom: row.mention_from || '',
      usedAt: row.used_at || '',
      usedIn: Array.isArray(row.used_in) ? row.used_in : [],
      createdAt: row.created_at || '',
      updatedAt: row.updated_at || row.created_at || ''
    };
  }

  function cleanBody(body) {
    var text = String(body || '').trim();
    if (!text) throw new Error('Write something first.');
    if (text.length > MAX_TEXT) throw new Error('Keep a note to ' + MAX_TEXT + ' characters.');
    return text;
  }

  function one(res, fallback) {
    if (res && res.error) throw friendlyError(res.error, fallback);
    return normalise((res && res.data) || {});
  }

  /** Waiting notes (oldest first, as they were written) and notes used in the last USED_DAYS days (newest first). */
  function list() {
    return session().then(function (s) {
      var since = new Date(Date.now() - USED_DAYS * 864e5).toISOString();
      return Promise.all([
        s.db.from(TABLE).select(COLUMNS).eq('owner_id', s.user.id).is('used_at', null)
          .order('created_at', { ascending: true }).limit(200),
        s.db.from(TABLE).select(COLUMNS).eq('owner_id', s.user.id).gte('used_at', since)
          .order('used_at', { ascending: false }).limit(100)
      ]).then(function (r) {
        if (r[0].error) throw friendlyError(r[0].error, 'Could not load your notes.');
        if (r[1].error) throw friendlyError(r[1].error, 'Could not load your notes.');
        return { waiting: (r[0].data || []).map(normalise), used: (r[1].data || []).map(normalise) };
      });
    });
  }

  function add(body, mentionFrom) {
    return session().then(function (s) {
      var row = { body: cleanBody(body), mention_from: mentionFrom || null };
      return s.db.from(TABLE).insert(row).select(COLUMNS).single();
    }).then(function (res) { return one(res, 'Could not save the note.'); });
  }

  function update(id, body, mentionFrom) {
    return session().then(function (s) {
      var row = { body: cleanBody(body), mention_from: mentionFrom || null };
      return s.db.from(TABLE).update(row).eq('id', id).select(COLUMNS).single();
    }).then(function (res) { return one(res, 'Could not save the note.'); });
  }

  /** Tick a note off by hand (used = true) or put it back on the waiting list. */
  function setUsed(id, used) {
    return session().then(function (s) {
      return s.db.from(TABLE).update({ used_at: used ? new Date().toISOString() : null }).eq('id', id).select(COLUMNS).single();
    }).then(function (res) { return one(res, 'Could not update the note.'); });
  }

  function remove(id) {
    return session().then(function (s) {
      return s.db.from(TABLE).delete().eq('id', id);
    }).then(function (res) {
      if (res && res.error) throw friendlyError(res.error, 'Could not delete the note.');
    });
  }

  // ---- Sunday announcements agent ----------------------------------------
  // Settings and run log: 20261101140000_announcement_agent.sql.
  // The agent itself: supabase/functions/weekly-announcements.

  var AGENT_FN = 'weekly-announcements';

  function agentError(err, fallback) {
    var msg = String((err && (err.message || err.details)) || '');
    var code = String((err && err.code) || '');
    if (/announcement_agent|does not exist|PGRST20[25]|42P01/i.test(msg + ' ' + code)) {
      var e = new Error('The Sunday agent is not set up yet. Run the announcement_agent migration in Supabase.');
      e.notSetUp = true;
      return e;
    }
    return friendlyError(err, fallback);
  }

  /** { settings: {enabled, publishTime, tone} | null, lastRun: {...} | null } */
  function getAgent() {
    return session().then(function (s) {
      return Promise.all([
        s.db.from('announcement_agent_settings').select('enabled, publish_time, tone').eq('owner_id', s.user.id).maybeSingle(),
        s.db.from('announcement_agent_runs')
          .select('week_of, status, summary, scheduled_count, draft_count, error, created_at, finished_at')
          .eq('owner_id', s.user.id).order('created_at', { ascending: false }).limit(1)
      ]).then(function (r) {
        if (r[0].error) throw agentError(r[0].error, 'Could not load the Sunday agent settings.');
        if (r[1].error) throw agentError(r[1].error, 'Could not load the Sunday agent settings.');
        var st = r[0].data;
        var run = (r[1].data || [])[0] || null;
        return {
          settings: st ? { enabled: !!st.enabled, publishTime: String(st.publish_time || '07:30').slice(0, 5), tone: st.tone || 'friendly' } : null,
          lastRun: run ? {
            weekOf: run.week_of,
            status: run.status,
            summary: run.summary || '',
            scheduled: run.scheduled_count || 0,
            drafts: run.draft_count || 0,
            error: run.error || '',
            createdAt: run.created_at,
            finishedAt: run.finished_at || ''
          } : null
        };
      });
    });
  }

  function saveAgent(settings) {
    // Update the row if there is one, otherwise create it. (An upsert would also
    // write owner_id, which the table only lets you set when inserting.)
    var fields = {
      enabled: !!settings.enabled,
      publish_time: settings.publishTime || '07:30',
      tone: settings.tone || 'friendly'
    };
    var fail = function (res) {
      if (res && res.error) throw agentError(res.error, 'Could not save the Sunday agent settings.');
      return res;
    };
    return session().then(function (s) {
      return s.db.from('announcement_agent_settings').update(fields).eq('owner_id', s.user.id).select('owner_id')
        .then(fail)
        .then(function (res) {
          if (res.data && res.data.length) return;
          return s.db.from('announcement_agent_settings').insert(fields).then(fail);
        });
    });
  }

  /** Ask the agent what it would write for next week. Saves nothing. */
  function previewAgent(settings) {
    return session().then(function (s) {
      if (!s.db.functions || typeof s.db.functions.invoke !== 'function') throw new Error('This page cannot reach the agent. Refresh and try again.');
      return s.db.functions.invoke(AGENT_FN, {
        body: { preview: true, publish_time: settings.publishTime, tone: settings.tone }
      });
    }).then(function (res) {
      if (!res.error) {
        if (res.data && res.data.error) throw new Error(res.data.error);
        return res.data;
      }
      // Errors from the function arrive as a Response; read its message if there is one.
      var ctx = res.error.context;
      var status = ctx && ctx.status;
      if (status === 404) throw new Error('The weekly-announcements function is not deployed yet.');
      if (ctx && typeof ctx.json === 'function') {
        return ctx.json().then(function (j) {
          throw new Error((j && j.error) || res.error.message || 'The preview failed.');
        }, function () {
          throw new Error(res.error.message || 'The preview failed.');
        });
      }
      throw new Error(res.error.message || 'The preview failed.');
    });
  }

  window.AnnouncementNotes = {
    MAX_TEXT: MAX_TEXT,
    USED_DAYS: USED_DAYS,
    list: list,
    add: add,
    update: update,
    setUsed: setUsed,
    remove: remove,
    getAgent: getAgent,
    saveAgent: saveAgent,
    previewAgent: previewAgent
  };
})();
