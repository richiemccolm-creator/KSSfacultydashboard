/**
 * Staff chat — live one-to-one and group conversations between staff.
 *
 * Tables: public.staff_chats, staff_chat_members, staff_chat_messages
 * (see supabase/migrations/20261031120000_staff_chat.sql). Only members can read a
 * chat (RLS). Chats are started, joined and left through RPCs; the sender's name is
 * stamped by a trigger. New messages and read receipts arrive over Supabase Realtime.
 * Colleague names come from staff_postit_directory() (no emails).
 */
(function () {
  'use strict';

  var MAX_TEXT = 2000;
  var MAX_TITLE = 60;
  var PAGE = 60;

  function client() {
    if (window.supabase && typeof window.supabase.from === 'function') return window.supabase;
    return null;
  }

  function session() {
    var db = client();
    if (!db || !db.auth) return Promise.reject(new Error('Sign in to the Faculty Hub to use chat.'));
    return db.auth.getSession().then(function (r) {
      var s = r && r.data ? r.data.session : null;
      if (!s || !s.user) throw new Error('Sign in to the Faculty Hub to use chat.');
      return { db: db, user: s.user };
    });
  }

  function friendlyError(err, fallback) {
    var msg = String((err && (err.message || err.details)) || '');
    var code = String((err && err.code) || '');
    if (/staff_chat|staff_postit_directory|does not exist|PGRST20[25]|42P01|42883/i.test(msg + ' ' + code)) {
      return new Error('Chat is not set up yet. Run the staff_chat migration in Supabase.');
    }
    if (/row-level security|permission|42501/i.test(msg + ' ' + code)) {
      return new Error('You don\'t have permission to do that.');
    }
    if (code === 'P0001' && msg) return new Error(msg);
    return err instanceof Error && msg ? err : new Error(fallback);
  }

  function rpc(name, args, fallback) {
    return session().then(function (s) {
      return Promise.resolve(s.db.rpc(name, args || {})).then(function (res) {
        if (res && res.error) throw friendlyError(res.error, fallback);
        return res ? res.data : null;
      });
    });
  }

  function normaliseMessage(row) {
    return {
      id: row.id,
      chatId: row.chat_id,
      senderId: row.sender_id,
      senderName: row.sender_name ? String(row.sender_name) : 'A colleague',
      body: String(row.body || ''),
      createdAt: row.created_at || ''
    };
  }

  function normaliseChat(row) {
    return {
      id: row.id,
      kind: row.kind === 'group' ? 'group' : 'direct',
      title: String(row.title || 'Colleague'),
      otherId: row.other_id || '',
      memberCount: row.member_count || 0,
      lastMessageAt: row.last_message_at || '',
      lastBody: row.last_body ? String(row.last_body) : '',
      lastSenderId: row.last_sender_id || '',
      lastSenderName: row.last_sender_name ? String(row.last_sender_name) : '',
      unread: row.unread || 0
    };
  }

  /** The signed-in user's id. */
  function me() {
    return session().then(function (s) { return s.user.id; });
  }

  /** My chats, most recent first, each with an unread count. */
  function list() {
    return rpc('staff_chat_list', {}, 'Could not load your chats.').then(function (rows) {
      return (rows || []).map(normaliseChat);
    });
  }

  /** Messages in a chat, oldest first. Pass before (ISO time) to load an earlier page. */
  function messages(chatId, before) {
    return session().then(function (s) {
      var q = s.db.from('staff_chat_messages')
        .select('id, chat_id, sender_id, sender_name, body, created_at')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: false })
        .limit(PAGE);
      if (before) q = q.lt('created_at', before);
      return Promise.resolve(q).then(function (res) {
        if (res && res.error) throw friendlyError(res.error, 'Could not load the messages.');
        var rows = ((res && res.data) || []).map(normaliseMessage).reverse();
        return { messages: rows, more: rows.length === PAGE };
      });
    });
  }

  /** Members of a chat: [{ id, name, lastReadAt }]. */
  function members(chatId) {
    return rpc('staff_chat_members_of', { p_chat: chatId }, 'Could not load who is in this chat.').then(function (rows) {
      return (rows || []).map(function (r) {
        return { id: r.user_id, name: String(r.display_name || 'Colleague'), lastReadAt: r.last_read_at || '' };
      });
    });
  }

  /** Colleagues I can chat with: [{ id, name }], sorted by name. */
  function directory() {
    return rpc('staff_postit_directory', {}, 'Could not load the staff list.').then(function (rows) {
      return (rows || [])
        .filter(function (r) { return r && r.id; })
        .map(function (r) { return { id: r.id, name: String(r.display_name || 'Unnamed') }; });
    });
  }

  function send(chatId, body) {
    body = String(body || '').trim();
    if (!body) return Promise.reject(new Error('Write a message first.'));
    if (body.length > MAX_TEXT) return Promise.reject(new Error('Keep it to ' + MAX_TEXT + ' characters.'));
    return session().then(function (s) {
      return Promise.resolve(
        s.db.from('staff_chat_messages')
          .insert({ chat_id: chatId, sender_id: s.user.id, body: body })
          .select('id, chat_id, sender_id, sender_name, body, created_at')
          .single()
      ).then(function (res) {
        if (res && res.error) throw friendlyError(res.error, 'Could not send the message.');
        return normaliseMessage(res.data);
      });
    });
  }

  function openDirect(otherId) {
    return rpc('staff_chat_open_direct', { p_other: otherId }, 'Could not open the chat.');
  }

  function createGroup(title, memberIds) {
    title = String(title || '').trim();
    if (!title) return Promise.reject(new Error('Give the group a name.'));
    if (title.length > MAX_TITLE) return Promise.reject(new Error('Keep the name to ' + MAX_TITLE + ' characters.'));
    if (!memberIds || !memberIds.length) return Promise.reject(new Error('Choose who is in the group.'));
    return rpc('staff_chat_create_group', { p_title: title, p_members: memberIds }, 'Could not start the group.');
  }

  function addMembers(chatId, memberIds) {
    return rpc('staff_chat_add_members', { p_chat: chatId, p_members: memberIds }, 'Could not add them.');
  }

  function leave(chatId) {
    return rpc('staff_chat_leave', { p_chat: chatId }, 'Could not leave the group.');
  }

  function markRead(chatId) {
    return rpc('staff_chat_mark_read', { p_chat: chatId }, 'Could not update the chat.');
  }

  /**
   * Listen for new messages and read receipts in any of my chats.
   * handlers: { message(msg), read({ chatId, userId, lastReadAt }), status(state) }.
   * RLS means only changes in my chats arrive. Returns a function that stops listening.
   */
  function subscribe(handlers) {
    handlers = handlers || {};
    var channel = null;
    var stopped = false;
    session().then(function (s) {
      if (stopped || typeof s.db.channel !== 'function') return;
      channel = s.db.channel('staff-chat-' + s.user.id)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'staff_chat_messages' }, function (payload) {
          if (payload && payload.new && handlers.message) handlers.message(normaliseMessage(payload.new));
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'staff_chat_members' }, function (payload) {
          var row = payload && payload.new;
          if (row && row.chat_id && handlers.read) {
            handlers.read({ chatId: row.chat_id, userId: row.user_id, lastReadAt: row.last_read_at || '', event: payload.eventType });
          }
        })
        .subscribe(function (state) {
          if (handlers.status) handlers.status(state);
        });
    }).catch(function () {});
    return function () {
      stopped = true;
      if (channel) {
        var gone = channel;
        channel = null;
        Promise.resolve().then(function () { return client().removeChannel(gone); }).catch(function () {});
      }
    };
  }

  window.StaffChat = {
    MAX_TEXT: MAX_TEXT,
    MAX_TITLE: MAX_TITLE,
    me: me,
    list: list,
    messages: messages,
    members: members,
    directory: directory,
    send: send,
    openDirect: openDirect,
    createGroup: createGroup,
    addMembers: addMembers,
    leave: leave,
    markRead: markRead,
    subscribe: subscribe
  };
})();
