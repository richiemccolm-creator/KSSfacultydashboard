/**
 * Staff chat panel — a "Chat" button in the corner of the Faculty Hub with an
 * unread badge, opening a panel with my chats, a conversation view and "New chat".
 * Data and live updates come from StaffChat (staff-chat-service.js).
 * The button stays hidden until the chat tables exist and someone is signed in.
 */
/* global StaffChat */
(function() {
  var state = {
    ready: false,
    open: false,
    view: 'list',          // 'list' | 'new' | 'chat' | 'add'
    meId: '',
    chats: [],
    query: '',
    chat: null,            // the open chat (from the list)
    messages: [],
    more: false,
    members: [],
    people: null,
    chosen: {},
    groupName: '',
    drafts: {},
    error: ''
  };
  var els = {};
  var stopLive = null;
  var listTimer = null;
  var loadingList = null;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /** Escaped text with web links made clickable. */
  function richText(s) {
    return esc(s).replace(/\bhttps?:\/\/[^\s<]+[^\s<.,;:!?)"'\]]/g, function(url) {
      return '<a href="' + url + '" target="_blank" rel="noopener noreferrer">' + url + '</a>';
    });
  }

  function initials(name) {
    var parts = String(name || '?').replace(/[^\p{L}\s.'-]/gu, ' ').trim().split(/[\s.]+/).filter(Boolean);
    if (!parts.length) return '?';
    return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
  }

  function dayKey(d) {
    return d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate();
  }

  function timeLabel(iso) {
    var d = new Date(iso);
    return isNaN(d) ? '' : d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }

  function dayLabel(iso) {
    var d = new Date(iso);
    if (isNaN(d)) return '';
    var now = new Date();
    var yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    if (dayKey(d) === dayKey(now)) return 'Today';
    if (dayKey(d) === dayKey(yesterday)) return 'Yesterday';
    var opts = { weekday: 'short', day: 'numeric', month: 'short' };
    if (d.getFullYear() !== now.getFullYear()) opts.year = 'numeric';
    return d.toLocaleDateString('en-GB', opts);
  }

  /** Short time for the chat list: 14:05, Yesterday, Tue 3 Nov. */
  function listWhen(iso) {
    var d = new Date(iso);
    if (isNaN(d)) return '';
    return dayKey(d) === dayKey(new Date()) ? timeLabel(iso) : dayLabel(iso);
  }

  function totalUnread() {
    return state.chats.reduce(function(sum, c) { return sum + c.unread; }, 0);
  }

  function panelVisible() {
    return state.open && document.visibilityState !== 'hidden';
  }

  /* ── Shell ── */

  function build() {
    var launcher = document.createElement('button');
    launcher.type = 'button';
    launcher.className = 'staff-chat-launcher';
    launcher.hidden = true;
    launcher.setAttribute('aria-haspopup', 'dialog');
    launcher.setAttribute('aria-expanded', 'false');
    launcher.innerHTML = '<i class="ti ti-messages" aria-hidden="true"></i><span class="staff-chat-launcher-label">Chat</span>' +
      '<span class="staff-chat-badge" data-badge hidden></span>';
    launcher.addEventListener('click', function() { state.open ? close() : open(); });

    var panel = document.createElement('section');
    panel.className = 'staff-chat-panel';
    panel.hidden = true;
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Staff chat');
    panel.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        if (state.view === 'list') close();
        else goBack();
      }
    });

    document.body.appendChild(panel);
    document.body.appendChild(launcher);
    els.launcher = launcher;
    els.panel = panel;
  }

  function updateBadge() {
    var n = totalUnread();
    var badge = els.launcher.querySelector('[data-badge]');
    badge.hidden = n === 0;
    badge.textContent = n > 99 ? '99+' : String(n);
    els.launcher.setAttribute('aria-label', n ? 'Chat, ' + n + ' unread' : 'Chat');
    els.launcher.classList.toggle('has-unread', n > 0);
  }

  /** Phones: the panel fills the screen, so keep the page behind it still. */
  function isPhone() {
    return window.matchMedia && window.matchMedia('(max-width:600px)').matches;
  }

  /**
   * Keep the panel inside the part of the screen the on-screen keyboard leaves
   * visible (iOS Safari doesn't shrink fixed elements when the keyboard opens).
   */
  function syncViewport() {
    var vv = window.visualViewport;
    if (!vv || !els.panel) return;
    var kb = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
    var style = els.panel.style;
    style.setProperty('--chat-vh', Math.round(vv.height) + 'px');
    style.setProperty('--chat-top', Math.round(vv.offsetTop) + 'px');
    style.setProperty('--chat-kb', kb + 'px');
    els.panel.classList.toggle('has-keyboard', kb > 80);
    var ta = els.panel.querySelector('.staff-chat-textarea');
    if (ta) autosize(ta);
    var box = els.panel.querySelector('[data-messages]');
    if (box && state.stickToBottom) box.scrollTop = box.scrollHeight;
  }

  function watchViewport(on) {
    var vv = window.visualViewport;
    if (!vv) return;
    vv[on ? 'addEventListener' : 'removeEventListener']('resize', syncViewport);
    vv[on ? 'addEventListener' : 'removeEventListener']('scroll', syncViewport);
    if (on) syncViewport();
  }

  function open(chatId) {
    state.open = true;
    els.panel.hidden = false;
    watchViewport(true);
    document.documentElement.classList.toggle('staff-chat-locked', isPhone());
    els.launcher.setAttribute('aria-expanded', 'true');
    els.launcher.classList.add('is-open');
    if (chatId) openChat(chatId);
    else { goList(); refreshList(); }
  }

  function close() {
    state.open = false;
    els.panel.hidden = true;
    watchViewport(false);
    document.documentElement.classList.remove('staff-chat-locked');
    els.launcher.setAttribute('aria-expanded', 'false');
    els.launcher.classList.remove('is-open');
    saveDraft();
    els.launcher.focus();
  }

  function head(title, sub, opts) {
    opts = opts || {};
    return '<header class="staff-chat-head">' +
      (opts.back ? '<button type="button" class="staff-chat-icon" data-back aria-label="Back to chats"><i class="ti ti-arrow-left" aria-hidden="true"></i></button>' : '') +
      (opts.avatar || '') +
      '<div class="staff-chat-head-text"><h2 class="staff-chat-title">' + esc(title) + '</h2>' +
        (sub ? '<div class="staff-chat-sub">' + sub + '</div>' : '') + '</div>' +
      (opts.actions || '') +
      '<button type="button" class="staff-chat-icon" data-close aria-label="Close chat"><i class="ti ti-x" aria-hidden="true"></i></button>' +
    '</header>';
  }

  function bindHead() {
    var closeBtn = els.panel.querySelector('[data-close]');
    if (closeBtn) closeBtn.addEventListener('click', close);
    var back = els.panel.querySelector('[data-back]');
    if (back) back.addEventListener('click', goBack);
  }

  /** Back from "Add people" returns to the chat; everything else returns to the list. */
  function goBack() {
    if (state.view === 'add' && state.chat) openChat(state.chat.id);
    else goList();
  }

  function avatarHtml(name, isGroup) {
    return '<span class="staff-chat-avatar' + (isGroup ? ' is-group' : '') + '" aria-hidden="true">' +
      (isGroup ? '<i class="ti ti-users"></i>' : esc(initials(name))) + '</span>';
  }

  /* ── Chat list ── */

  function goList() {
    saveDraft();
    state.view = 'list';
    state.chat = null;
    state.messages = [];
    state.error = '';
    paintList();
  }

  function paintList() {
    if (state.view !== 'list' || !state.open) return;
    var q = state.query.trim().toLowerCase();
    var chats = state.chats.filter(function(c) { return !q || c.title.toLowerCase().indexOf(q) >= 0; });
    var body;
    if (!state.chats.length) {
      body = '<div class="staff-chat-empty"><i class="ti ti-messages" aria-hidden="true"></i>' +
        '<p>No chats yet.</p><p>Start one with a colleague or a group.</p></div>';
    } else if (!chats.length) {
      body = '<div class="staff-chat-empty"><p>No chats match that name.</p></div>';
    } else {
      body = '<ul class="staff-chat-list">' + chats.map(function(c) {
        var who = c.lastSenderId === state.meId ? 'You: ' : (c.kind === 'group' && c.lastSenderName ? c.lastSenderName.split(' ')[0] + ': ' : '');
        var preview = c.lastBody ? who + c.lastBody : (c.kind === 'group' ? c.memberCount + ' people' : '');
        return '<li><button type="button" class="staff-chat-row' + (c.unread ? ' is-unread' : '') + '" data-chat="' + esc(c.id) + '">' +
          avatarHtml(c.title, c.kind === 'group') +
          '<span class="staff-chat-row-text">' +
            '<span class="staff-chat-row-top"><span class="staff-chat-row-name">' + esc(c.title) + '</span>' +
              '<span class="staff-chat-row-when">' + esc(listWhen(c.lastMessageAt)) + '</span></span>' +
            '<span class="staff-chat-row-bottom"><span class="staff-chat-row-preview">' + esc(preview) + '</span>' +
              (c.unread ? '<span class="staff-chat-row-badge" aria-label="' + c.unread + ' unread">' + (c.unread > 99 ? '99+' : c.unread) + '</span>' : '') +
            '</span>' +
          '</span>' +
        '</button></li>';
      }).join('') + '</ul>';
    }
    els.panel.innerHTML =
      head('Chat', '', {
        actions: '<button type="button" class="staff-chat-new" data-new><i class="ti ti-edit" aria-hidden="true"></i> New chat</button>'
      }) +
      (state.chats.length > 5
        ? '<div class="staff-chat-search"><input type="search" class="staff-chat-input" data-search placeholder="Search chats" aria-label="Search chats" value="' + esc(state.query) + '"></div>'
        : '') +
      '<div class="staff-chat-scroll">' + body + '</div>';
    bindHead();
    els.panel.querySelector('[data-new]').addEventListener('click', goNew);
    var search = els.panel.querySelector('[data-search]');
    if (search) {
      search.addEventListener('input', function() {
        state.query = search.value;
        paintList();
        var again = els.panel.querySelector('[data-search]');
        again.focus();
        again.setSelectionRange(again.value.length, again.value.length);
      });
    }
    els.panel.querySelectorAll('[data-chat]').forEach(function(btn) {
      btn.addEventListener('click', function() { openChat(btn.getAttribute('data-chat')); });
    });
  }

  function refreshList() {
    if (loadingList) return loadingList;
    loadingList = StaffChat.list().then(function(chats) {
      state.chats = chats;
      // Anything already open counts as read.
      if (state.chat && panelVisible()) {
        state.chats.forEach(function(c) { if (c.id === state.chat.id) c.unread = 0; });
      }
      updateBadge();
      paintList();
    }).catch(function(err) {
      if (window.console && err) console.info('[chat]', err.message || err);
    }).then(function() { loadingList = null; });
    return loadingList;
  }

  function refreshListSoon() {
    clearTimeout(listTimer);
    listTimer = setTimeout(refreshList, 400);
  }

  /* ── Picking colleagues (new chat / add people) ── */

  function loadPeople() {
    if (state.people) return Promise.resolve(state.people);
    return StaffChat.directory().then(function(people) {
      state.people = people;
      return people;
    });
  }

  function goNew() {
    state.view = 'new';
    state.chosen = {};
    state.groupName = '';
    state.error = '';
    state.peopleQuery = '';
    paintPicker();
    loadPeople().then(paintPicker).catch(function(err) { state.error = err.message; paintPicker(); });
  }

  function goAdd() {
    state.view = 'add';
    state.chosen = {};
    state.error = '';
    state.peopleQuery = '';
    paintPicker();
    loadPeople().then(paintPicker).catch(function(err) { state.error = err.message; paintPicker(); });
  }

  function paintPeople() {
    var holder = els.panel.querySelector('[data-people]');
    if (!holder) return;
    var q = (state.peopleQuery || '').trim().toLowerCase();
    var inChat = {};
    if (state.view === 'add') state.members.forEach(function(m) { inChat[m.id] = true; });
    if (!state.people) { holder.innerHTML = '<p class="staff-chat-muted">Loading staff…</p>'; return; }
    var matches = state.people.filter(function(p) {
      return !inChat[p.id] && (!q || p.name.toLowerCase().indexOf(q) >= 0);
    });
    holder.innerHTML = matches.length
      ? matches.map(function(p) {
          var on = !!state.chosen[p.id];
          return '<label class="staff-chat-person' + (on ? ' is-on' : '') + '"><input type="checkbox" value="' + esc(p.id) + '"' + (on ? ' checked' : '') + '>' +
            avatarHtml(p.name) + '<span>' + esc(p.name) + '</span></label>';
        }).join('')
      : '<p class="staff-chat-muted">' + (q ? 'No one matches that name.' : 'No colleagues to add.') + '</p>';
    holder.querySelectorAll('input[type=checkbox]').forEach(function(box) {
      box.addEventListener('change', function() {
        if (box.checked) state.chosen[box.value] = true;
        else delete state.chosen[box.value];
        paintPickerFoot();
        box.closest('.staff-chat-person').classList.toggle('is-on', box.checked);
      });
    });
  }

  function paintPickerFoot() {
    var foot = els.panel.querySelector('[data-picker-foot]');
    if (!foot) return;
    var ids = Object.keys(state.chosen);
    var nameMap = {};
    (state.people || []).forEach(function(p) { nameMap[p.id] = p.name; });
    var isAdd = state.view === 'add';
    var group = !isAdd && ids.length > 1;
    var label = isAdd
      ? (ids.length ? 'Add ' + ids.length : 'Add')
      : (group ? 'Start group' : 'Start chat');
    foot.innerHTML =
      (ids.length
        ? '<div class="staff-chat-chips">' + ids.map(function(id) {
            return '<span class="staff-chat-chip">' + esc(nameMap[id] || 'Colleague') +
              '<button type="button" data-unchoose="' + esc(id) + '" aria-label="Remove ' + esc(nameMap[id] || 'colleague') + '"><i class="ti ti-x" aria-hidden="true"></i></button></span>';
          }).join('') + '</div>'
        : '<p class="staff-chat-muted">' + (isAdd ? 'Choose who to add.' : 'Choose one colleague, or several for a group.') + '</p>') +
      (group
        ? '<label class="staff-chat-label" for="staffChatGroupName">Group name</label>' +
          '<input id="staffChatGroupName" class="staff-chat-input" data-group-name maxlength="' + StaffChat.MAX_TITLE + '" placeholder="e.g. S2 Drama team" value="' + esc(state.groupName) + '">'
        : '') +
      (state.error ? '<p class="staff-chat-error" role="alert">' + esc(state.error) + '</p>' : '') +
      '<button type="button" class="staff-chat-primary" data-start' + (ids.length ? '' : ' disabled') + '>' + label + '</button>';
    foot.querySelectorAll('[data-unchoose]').forEach(function(b) {
      b.addEventListener('click', function() {
        delete state.chosen[b.getAttribute('data-unchoose')];
        paintPeople();
        paintPickerFoot();
      });
    });
    var nameInput = foot.querySelector('[data-group-name]');
    if (nameInput) nameInput.addEventListener('input', function() { state.groupName = nameInput.value; });
    foot.querySelector('[data-start]').addEventListener('click', startFromPicker);
  }

  function paintPicker() {
    var isAdd = state.view === 'add';
    els.panel.innerHTML =
      head(isAdd ? 'Add people' : 'New chat', isAdd ? esc(state.chat ? state.chat.title : '') : '', { back: true }) +
      '<div class="staff-chat-search"><input type="search" class="staff-chat-input" data-people-search placeholder="Search staff" aria-label="Search staff" value="' + esc(state.peopleQuery || '') + '"></div>' +
      '<div class="staff-chat-scroll staff-chat-people" data-people></div>' +
      '<div class="staff-chat-picker-foot" data-picker-foot></div>';
    bindHead();
    var search = els.panel.querySelector('[data-people-search]');
    search.addEventListener('input', function() { state.peopleQuery = search.value; paintPeople(); });
    paintPeople();
    paintPickerFoot();
    if (!(window.matchMedia && window.matchMedia('(pointer:coarse)').matches)) search.focus();
  }

  function startFromPicker() {
    var ids = Object.keys(state.chosen);
    if (!ids.length) return;
    var btn = els.panel.querySelector('[data-start]');
    btn.disabled = true;
    state.error = '';
    var job;
    if (state.view === 'add') {
      var chatId = state.chat.id;
      job = StaffChat.addMembers(chatId, ids).then(function() { return chatId; });
    } else if (ids.length === 1) {
      job = StaffChat.openDirect(ids[0]);
    } else {
      job = StaffChat.createGroup(state.groupName, ids);
    }
    job.then(function(chatId) {
      return refreshList().then(function() { openChat(chatId); });
    }).catch(function(err) {
      state.error = err.message;
      paintPickerFoot();
    });
  }

  /* ── Conversation ── */

  function findChat(id) {
    for (var i = 0; i < state.chats.length; i++) if (state.chats[i].id === id) return state.chats[i];
    return null;
  }

  function chatTitleFromMembers(members) {
    var others = members.filter(function(m) { return m.id !== state.meId; });
    return others.length ? others[0].name : 'Chat';
  }

  function openChat(chatId) {
    saveDraft();
    var known = findChat(chatId);
    state.view = 'chat';
    state.chat = known || { id: chatId, kind: 'direct', title: '', memberCount: 0 };
    state.messages = [];
    state.members = [];
    state.more = false;
    state.loadingChat = true;
    state.error = '';
    paintChat();
    Promise.all([StaffChat.messages(chatId), StaffChat.members(chatId)]).then(function(r) {
      if (!state.chat || state.chat.id !== chatId) return;
      state.messages = r[0].messages;
      state.more = r[0].more;
      state.members = r[1];
      state.chat.memberCount = r[1].length;
      if (!state.chat.title) {
        state.chat.kind = r[1].length > 2 ? 'group' : 'direct';
        state.chat.title = chatTitleFromMembers(r[1]);
      }
      state.loadingChat = false;
      paintChat();
      markOpenRead();
    }).catch(function(err) {
      state.loadingChat = false;
      state.error = err.message;
      paintChat();
    });
  }

  function markOpenRead() {
    if (!state.chat || !panelVisible() || state.view !== 'chat') return;
    var c = findChat(state.chat.id);
    var hadUnread = c && c.unread;
    if (c) c.unread = 0;
    updateBadge();
    StaffChat.markRead(state.chat.id).catch(function() {});
    if (hadUnread) paintList();
  }

  function memberName(id) {
    for (var i = 0; i < state.members.length; i++) if (state.members[i].id === id) return state.members[i].name;
    return '';
  }

  /** "Seen" / "Seen by 3" under my latest message. */
  function seenLabel() {
    var mine = state.messages[state.messages.length - 1];
    if (!mine || mine.senderId !== state.meId || mine.pending || mine.failed) return '';
    var readers = state.members.filter(function(m) {
      return m.id !== state.meId && m.lastReadAt && m.lastReadAt >= mine.createdAt;
    });
    if (!readers.length) return '';
    if (state.chat.kind !== 'group') return 'Seen';
    var others = state.members.length - 1;
    return readers.length >= others ? 'Seen by everyone' : 'Seen by ' + readers.map(function(m) { return m.name.split(' ')[0]; }).join(', ');
  }

  function messagesHtml() {
    if (state.loadingChat) return '<p class="staff-chat-muted staff-chat-center">Loading…</p>';
    if (!state.messages.length) {
      return '<div class="staff-chat-empty"><p>No messages yet.</p><p>Say hello.</p></div>';
    }
    var html = state.more ? '<button type="button" class="staff-chat-earlier" data-earlier>Show earlier messages</button>' : '';
    var lastDay = '';
    var prev = null;
    state.messages.forEach(function(m, i) {
      var day = dayLabel(m.createdAt);
      if (day !== lastDay) {
        html += '<div class="staff-chat-day"><span>' + esc(day) + '</span></div>';
        lastDay = day;
        prev = null;
      }
      var mine = m.senderId === state.meId;
      var next = state.messages[i + 1];
      var startsRun = !prev || prev.senderId !== m.senderId || (new Date(m.createdAt) - new Date(prev.createdAt)) > 5 * 60000;
      var endsRun = !next || next.senderId !== m.senderId || dayLabel(next.createdAt) !== day ||
        (new Date(next.createdAt) - new Date(m.createdAt)) > 5 * 60000;
      html += '<div class="staff-chat-msg' + (mine ? ' is-mine' : '') + (startsRun ? ' starts-run' : '') + (m.pending ? ' is-pending' : '') + (m.failed ? ' is-failed' : '') + '">' +
        (!mine && state.chat.kind === 'group' && startsRun ? '<div class="staff-chat-msg-name">' + esc(memberName(m.senderId) || m.senderName) + '</div>' : '') +
        '<div class="staff-chat-bubble">' + richText(m.body) + '</div>' +
        (endsRun || m.failed
          ? '<div class="staff-chat-msg-meta">' + (m.failed ? 'Not sent · <button type="button" data-retry="' + esc(m.id) + '">Try again</button>' : (m.pending ? 'Sending…' : esc(timeLabel(m.createdAt)))) + '</div>'
          : '') +
      '</div>';
      prev = m;
    });
    var seen = seenLabel();
    if (seen) html += '<div class="staff-chat-seen"><i class="ti ti-checks" aria-hidden="true"></i> ' + esc(seen) + '</div>';
    return html;
  }

  function paintMessages(keepScroll) {
    var box = els.panel.querySelector('[data-messages]');
    if (!box) return;
    var nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
    var fromBottom = box.scrollHeight - box.scrollTop;
    box.innerHTML = messagesHtml();
    if (keepScroll) box.scrollTop = box.scrollHeight - fromBottom;
    else if (nearBottom || keepScroll === false) box.scrollTop = box.scrollHeight;
    if (!box._watched) {
      box._watched = true;
      box.addEventListener('scroll', function() {
        state.stickToBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
      }, { passive: true });
    }
    state.stickToBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
    var earlier = box.querySelector('[data-earlier]');
    if (earlier) earlier.addEventListener('click', loadEarlier);
    box.querySelectorAll('[data-retry]').forEach(function(b) {
      b.addEventListener('click', function() { retry(b.getAttribute('data-retry')); });
    });
  }

  function paintChat() {
    var c = state.chat;
    var sub = c.kind === 'group'
      ? '<button type="button" class="staff-chat-sub-link" data-members>' + (c.memberCount ? c.memberCount + ' people' : 'Group') + '</button>'
      : '';
    var actions = c.kind === 'group'
      ? '<button type="button" class="staff-chat-icon" data-add aria-label="Add people"><i class="ti ti-user-plus" aria-hidden="true"></i></button>' +
        '<button type="button" class="staff-chat-icon" data-leave aria-label="Leave group"><i class="ti ti-logout" aria-hidden="true"></i></button>'
      : '';
    els.panel.innerHTML =
      head(c.title || 'Chat', sub, { back: true, avatar: avatarHtml(c.title, c.kind === 'group'), actions: actions }) +
      '<div class="staff-chat-members" data-member-list hidden></div>' +
      '<div class="staff-chat-scroll staff-chat-messages" data-messages aria-live="polite"></div>' +
      (state.error ? '<p class="staff-chat-error" role="alert">' + esc(state.error) + '</p>' : '') +
      '<form class="staff-chat-compose" data-compose>' +
        '<textarea class="staff-chat-textarea" rows="1" enterkeyhint="send" autocapitalize="sentences" maxlength="' + StaffChat.MAX_TEXT + '" placeholder="Message' + (c.title ? ' ' + esc(c.kind === 'group' ? c.title : c.title.split(' ')[0]) : '') + '" aria-label="Message"></textarea>' +
        '<button type="submit" class="staff-chat-send" aria-label="Send"><i class="ti ti-send" aria-hidden="true"></i></button>' +
      '</form>';
    bindHead();
    paintMessages(false);

    var form = els.panel.querySelector('[data-compose]');
    var ta = form.querySelector('textarea');
    ta.value = state.drafts[c.id] || '';
    autosize(ta);
    // Measure again once the panel has its final size (it can still be settling as it opens).
    requestAnimationFrame(function() { autosize(ta); });
    ta.addEventListener('input', function() { autosize(ta); });
    ta.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        submit();
      }
    });
    form.addEventListener('submit', function(e) { e.preventDefault(); submit(); });
    // On touch screens, opening a chat shouldn't throw the keyboard up over the messages.
    if (!state.loadingChat && !(window.matchMedia && window.matchMedia('(pointer:coarse)').matches)) ta.focus();

    var add = els.panel.querySelector('[data-add]');
    if (add) add.addEventListener('click', goAdd);
    var leaveBtn = els.panel.querySelector('[data-leave]');
    if (leaveBtn) leaveBtn.addEventListener('click', leaveGroup);
    var membersBtn = els.panel.querySelector('[data-members]');
    if (membersBtn) {
      membersBtn.addEventListener('click', function() {
        var list = els.panel.querySelector('[data-member-list]');
        list.hidden = !list.hidden;
        list.innerHTML = state.members.map(function(m) {
          return '<span class="staff-chat-chip">' + esc(m.id === state.meId ? 'You' : m.name) + '</span>';
        }).join('');
      });
    }
  }

  function autosize(ta) {
    // Measure from zero: iPad Safari gives a textarea a multi-line height at 'auto', even with rows="1".
    ta.style.height = '0px';
    var border = ta.offsetHeight - ta.clientHeight;
    ta.style.height = Math.min(ta.scrollHeight + border, 140) + 'px';
  }

  function saveDraft() {
    if (state.view !== 'chat' || !state.chat || !els.panel) return;
    var ta = els.panel.querySelector('.staff-chat-textarea');
    if (ta) state.drafts[state.chat.id] = ta.value;
  }

  function submit() {
    var ta = els.panel.querySelector('.staff-chat-textarea');
    var body = ta.value.trim();
    if (!body || !state.chat) return;
    ta.value = '';
    state.drafts[state.chat.id] = '';
    autosize(ta);
    sendBody(state.chat.id, body);
  }

  function sendBody(chatId, body) {
    var temp = { id: 'tmp-' + Date.now() + '-' + Math.random().toString(36).slice(2), chatId: chatId, senderId: state.meId, body: body, createdAt: new Date().toISOString(), pending: true };
    state.messages.push(temp);
    paintMessages(false);
    StaffChat.send(chatId, body).then(function(msg) {
      var i = state.messages.indexOf(temp);
      var dupe = state.messages.some(function(m) { return m.id === msg.id; });
      if (i >= 0) {
        if (dupe) state.messages.splice(i, 1);
        else state.messages[i] = msg;
      }
      if (state.chat && state.chat.id === chatId) paintMessages();
      refreshListSoon();
    }).catch(function(err) {
      temp.pending = false;
      temp.failed = true;
      temp.error = err.message;
      if (state.chat && state.chat.id === chatId) paintMessages();
    });
  }

  function retry(id) {
    var i = -1;
    state.messages.forEach(function(m, j) { if (m.id === id) i = j; });
    if (i < 0) return;
    var m = state.messages.splice(i, 1)[0];
    sendBody(m.chatId, m.body);
  }

  function loadEarlier() {
    var first = state.messages.filter(function(m) { return !m.pending && !m.failed; })[0];
    if (!first || !state.chat) return;
    var chatId = state.chat.id;
    StaffChat.messages(chatId, first.createdAt).then(function(r) {
      if (!state.chat || state.chat.id !== chatId) return;
      state.messages = r.messages.concat(state.messages);
      state.more = r.more;
      paintMessages(true);
    }).catch(function() {});
  }

  function leaveGroup() {
    if (!state.chat || !confirm('Leave "' + state.chat.title + '"? You won\'t see its messages any more.')) return;
    var chatId = state.chat.id;
    StaffChat.leave(chatId).then(function() {
      state.chats = state.chats.filter(function(c) { return c.id !== chatId; });
      updateBadge();
      goList();
      refreshList();
    }).catch(function(err) { alert(err.message); });
  }

  /* ── Live updates ── */

  function onMessage(msg) {
    var openHere = state.view === 'chat' && state.chat && state.chat.id === msg.chatId;
    if (openHere) {
      var exists = state.messages.some(function(m) { return m.id === msg.id; });
      if (!exists && msg.senderId === state.meId) {
        // My own message from another tab, or the echo of one still sending here.
        var pending = state.messages.filter(function(m) { return m.pending && m.body === msg.body; })[0];
        if (pending) { state.messages[state.messages.indexOf(pending)] = msg; exists = true; paintMessages(); }
      }
      if (!exists) {
        state.messages.push(msg);
        paintMessages();
      }
      if (msg.senderId !== state.meId) markOpenRead();
    }
    var c = findChat(msg.chatId);
    if (c) {
      c.lastBody = msg.body;
      c.lastSenderId = msg.senderId;
      c.lastSenderName = msg.senderName;
      c.lastMessageAt = msg.createdAt;
      if (msg.senderId !== state.meId && !(openHere && panelVisible())) c.unread += 1;
      state.chats.sort(function(a, b) { return a.lastMessageAt < b.lastMessageAt ? 1 : -1; });
      updateBadge();
      paintList();
    } else {
      // A chat I've just been added to, or a first message in a new one-to-one.
      refreshListSoon();
    }
    if (msg.senderId !== state.meId && !(openHere && panelVisible())) nudge();
  }

  function onRead(r) {
    if (r.event === 'INSERT' && r.userId === state.meId) refreshListSoon();
    if (!state.chat || state.chat.id !== r.chatId) return;
    var found = false;
    state.members.forEach(function(m) {
      if (m.id === r.userId) { m.lastReadAt = r.lastReadAt; found = true; }
    });
    if (!found) {
      StaffChat.members(r.chatId).then(function(list) {
        if (state.chat && state.chat.id === r.chatId) { state.members = list; state.chat.memberCount = list.length; }
      }).catch(function() {});
    }
    if (state.view === 'chat') paintMessages();
  }

  /** A gentle pulse on the button when something new arrives. */
  function nudge() {
    els.launcher.classList.remove('is-nudged');
    void els.launcher.offsetWidth;
    els.launcher.classList.add('is-nudged');
  }

  function startLive() {
    if (stopLive) stopLive();
    var wasDown = false;
    stopLive = StaffChat.subscribe({
      message: onMessage,
      read: onRead,
      status: function(s) {
        if (s === 'SUBSCRIBED') {
          if (wasDown) {
            // Catch up on anything missed while the connection was down.
            refreshList();
            if (state.view === 'chat' && state.chat) openChat(state.chat.id);
          }
          wasDown = false;
        } else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT' || s === 'CLOSED') {
          wasDown = true;
        }
      }
    });
  }

  function init() {
    if (state.ready || !window.StaffChat || !document.body) return;
    StaffChat.me().then(function(id) {
      state.meId = id;
      return StaffChat.list();
    }).then(function(chats) {
      if (state.ready) return;
      state.ready = true;
      state.chats = chats;
      build();
      els.launcher.hidden = false;
      updateBadge();
      startLive();
      document.addEventListener('visibilitychange', function() {
        if (document.visibilityState === 'visible') {
          refreshList();
          markOpenRead();
        }
      });
    }).catch(function(err) {
      // Not signed in, or the chat tables aren't set up yet: show nothing.
      if (window.console && err) console.info('[chat]', err.message || err);
    });
  }

  window.StaffChatPanel = {
    init: init,
    open: function(chatId) { if (state.ready) open(chatId); },
    /** Open (or start) a one-to-one chat with a colleague by user id. */
    openWith: function(userId) {
      if (!state.ready) return Promise.resolve();
      return StaffChat.openDirect(userId).then(function(chatId) { open(chatId); });
    }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
  // The session can arrive after the page loads (sign-in redirect).
  if (window.supabase && window.supabase.auth && typeof window.supabase.auth.onAuthStateChange === 'function') {
    window.supabase.auth.onAuthStateChange(function(event) {
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') init();
    });
  }
})();
