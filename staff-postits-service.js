/**
 * Staff post-its — short notes one member of staff sends to a colleague.
 * They stick beside the Faculty Hub home banner until the colleague ticks "Got it".
 *
 * Table: public.staff_postits (see supabase/migrations/20261029120000_staff_postits.sql).
 * Only the sender and recipient can read a note (RLS). The sender's name is
 * stamped by a trigger; the recipient can only set seen_at / dismissed_at.
 * Colleague names come from the staff_postit_directory() RPC (no emails).
 */
(function () {
  'use strict';

  var TABLE = 'staff_postits';
  var COLORS = ['yellow', 'mint', 'sky', 'peach', 'rose'];
  var MAX_TEXT = 140;
  var MAX_RECIPIENTS = 60;
  var COLUMNS = 'id, sender_id, sender_name, recipient_id, body, color, show_from, created_at, seen_at, dismissed_at';

  function client() {
    if (window.supabase && typeof window.supabase.from === 'function') return window.supabase;
    return null;
  }

  function pad(n) { return String(n).padStart(2, '0'); }

  function todayISO() {
    var d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function session() {
    var db = client();
    if (!db || !db.auth) return Promise.reject(new Error('Sign in to the Faculty Hub to use post-its.'));
    return db.auth.getSession().then(function (r) {
      var s = r && r.data ? r.data.session : null;
      if (!s || !s.user) throw new Error('Sign in to the Faculty Hub to use post-its.');
      return { db: db, user: s.user };
    });
  }

  function friendlyError(err, fallback) {
    var msg = String((err && (err.message || err.details)) || '');
    var code = String((err && err.code) || '');
    if (/staff_postit|does not exist|PGRST20[25]|42P01|42883/i.test(msg + ' ' + code)) {
      return new Error('Post-its are not set up yet. Run the staff_postits migration in Supabase.');
    }
    if (/row-level security|permission|42501/i.test(msg + ' ' + code)) {
      return new Error('You don\'t have permission to do that.');
    }
    return err instanceof Error && msg ? err : new Error(fallback);
  }

  function normalise(row) {
    return {
      id: row.id,
      senderId: row.sender_id,
      senderName: row.sender_name ? String(row.sender_name) : 'A colleague',
      recipientId: row.recipient_id,
      body: String(row.body || ''),
      color: COLORS.indexOf(row.color) >= 0 ? row.color : 'yellow',
      showFrom: row.show_from || '',
      createdAt: row.created_at || '',
      seenAt: row.seen_at || '',
      dismissedAt: row.dismissed_at || ''
    };
  }

  function rows(res, fallback) {
    if (res && res.error) throw friendlyError(res.error, fallback);
    return ((res && res.data) || []).map(normalise);
  }

  /** Notes sent to me that are due today or earlier and not yet ticked off, newest first. */
  function inbox() {
    return session().then(function (s) {
      return Promise.resolve(
        s.db.from(TABLE).select(COLUMNS)
          .eq('recipient_id', s.user.id)
          .is('dismissed_at', null)
          .lte('show_from', todayISO())
          .order('created_at', { ascending: false })
          .limit(20)
      ).then(function (res) { return rows(res, 'Could not load your post-its.'); });
    });
  }

  /** Notes I have sent in the last 30 days, newest first. */
  function sent() {
    return session().then(function (s) {
      var since = new Date(Date.now() - 30 * 864e5).toISOString();
      return Promise.resolve(
        s.db.from(TABLE).select(COLUMNS)
          .eq('sender_id', s.user.id)
          .gte('created_at', since)
          .order('created_at', { ascending: false })
          .limit(30)
      ).then(function (res) { return rows(res, 'Could not load the post-its you sent.'); });
    });
  }

  /** Colleagues I can send to: [{ id, name }], sorted by name. */
  function directory() {
    return session().then(function (s) {
      return Promise.resolve(s.db.rpc('staff_postit_directory')).then(function (res) {
        if (res && res.error) throw friendlyError(res.error, 'Could not load the staff list.');
        return ((res && res.data) || [])
          .filter(function (r) { return r && r.id; })
          .map(function (r) { return { id: r.id, name: String(r.display_name || 'Unnamed') }; });
      });
    });
  }

  /** Send one note to each recipient. opts: { recipientIds, body, color, showFrom }. */
  function send(opts) {
    opts = opts || {};
    var body = String(opts.body || '').trim();
    var ids = (opts.recipientIds || []).filter(Boolean);
    if (!body) return Promise.reject(new Error('Write a note first.'));
    if (body.length > MAX_TEXT) return Promise.reject(new Error('Keep it to ' + MAX_TEXT + ' characters.'));
    if (!ids.length) return Promise.reject(new Error('Choose who it\'s for.'));
    if (ids.length > MAX_RECIPIENTS) return Promise.reject(new Error('Send to ' + MAX_RECIPIENTS + ' people or fewer at once.'));
    var color = COLORS.indexOf(opts.color) >= 0 ? opts.color : 'yellow';
    var showFrom = /^\d{4}-\d{2}-\d{2}$/.test(opts.showFrom || '') ? opts.showFrom : todayISO();
    return session().then(function (s) {
      var payload = ids.map(function (id) {
        return { sender_id: s.user.id, recipient_id: id, body: body, color: color, show_from: showFrom };
      });
      return Promise.resolve(s.db.from(TABLE).insert(payload)).then(function (res) {
        if (res && res.error) throw friendlyError(res.error, 'Could not send the post-it.');
        return ids.length;
      });
    });
  }

  function stamp(ids, column) {
    ids = (ids || []).filter(Boolean);
    if (!ids.length) return Promise.resolve();
    return session().then(function (s) {
      var patch = {};
      patch[column] = new Date().toISOString();
      var q = s.db.from(TABLE).update(patch).in('id', ids).eq('recipient_id', s.user.id);
      if (column === 'seen_at') q = q.is('seen_at', null);
      return Promise.resolve(q).then(function (res) {
        if (res && res.error) throw friendlyError(res.error, 'Could not update the post-it.');
      });
    });
  }

  /** Tell the senders these notes have been on screen. */
  function markSeen(ids) { return stamp(ids, 'seen_at'); }

  /** "Got it": take the note off my screen (also counts as seen). */
  function dismiss(id) {
    return stamp([id], 'dismissed_at').then(function () {
      return markSeen([id]).catch(function () {});
    });
  }

  /** Take back a note I sent. */
  function withdraw(id) {
    return session().then(function (s) {
      return Promise.resolve(s.db.from(TABLE).delete().eq('id', id).eq('sender_id', s.user.id)).then(function (res) {
        if (res && res.error) throw friendlyError(res.error, 'Could not withdraw the post-it.');
      });
    });
  }

  window.StaffPostits = {
    COLORS: COLORS.slice(),
    MAX_TEXT: MAX_TEXT,
    todayISO: todayISO,
    inbox: inbox,
    sent: sent,
    directory: directory,
    send: send,
    markSeen: markSeen,
    dismiss: dismiss,
    withdraw: withdraw
  };
})();
