/**
 * Home banner post-its — notes colleagues have stuck on my Faculty Hub home,
 * reaction slips for notes I sent, the "Send a post-it" dialog and the
 * "All post-its" history. Data lives in StaffPostits (staff-postits-service.js).
 * Shows up to two notes beside the banner; "+N more" opens the rest.
 */
/* global StaffPostits */
(function() {
  var SHOW_MAX = 2;
  var SLIPS_MAX = 3;
  var expanded = false;
  var loading = null;
  var dialog = null;
  var directoryPromise = null;

  var SWATCH = { yellow: '#fef08a', mint: '#bbf7d0', sky: '#bae6fd', peach: '#fed7aa', rose: '#fecdd3' };
  var REACTION_INFO = {
    like: { icon: 'ti-thumb-up', label: 'Like', past: 'liked' },
    love: { icon: 'ti-heart', label: 'Love', past: 'loved' }
  };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function root() {
    return document.getElementById('homeStaffPostits');
  }

  /** Colleague names by id, loaded once per page. */
  function names() {
    if (!directoryPromise) {
      directoryPromise = StaffPostits.directory().then(function(people) {
        var map = {};
        people.forEach(function(p) { map[p.id] = p.name; });
        return map;
      }).catch(function() {
        directoryPromise = null;
        return {};
      });
    }
    return directoryPromise;
  }

  function dayKey(d) {
    return d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate();
  }

  function whenLabel(iso, showFrom) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d)) return '';
    if (showFrom && showFrom > iso.slice(0, 10)) {
      var f = new Date(showFrom + 'T12:00:00');
      return f.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
    }
    var now = new Date();
    var yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    if (dayKey(d) === dayKey(now)) return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    if (dayKey(d) === dayKey(yesterday)) return 'Yesterday';
    return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  }

  function snippet(text, max) {
    text = String(text || '');
    return text.length > max ? text.slice(0, max - 1).trim() + '…' : text;
  }

  /* ── Reactions ── */

  function reactButtonsHtml(n) {
    if (!StaffPostits.reactionsReady()) return '';
    return '<span class="postit-reacts">' + Object.keys(REACTION_INFO).map(function(r) {
      var info = REACTION_INFO[r];
      var on = n.reaction === r;
      return '<button type="button" class="postit-react' + (on ? ' is-on' : '') + '" data-reaction="' + r +
        '" aria-pressed="' + on + '" aria-label="' + info.label + ' note from ' + esc(n.senderName) + '" title="' + info.label + '">' +
        '<i class="ti ' + info.icon + '" aria-hidden="true"></i></button>';
    }).join('') + '</span>';
  }

  /** Wire like/love buttons inside el; byId maps note id → note. */
  function bindReacts(el, byId) {
    el.querySelectorAll('.postit-react').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var holder = btn.closest('[data-postit-id]');
        var note = holder && byId[holder.getAttribute('data-postit-id')];
        if (!note) return;
        var before = note.reaction;
        var next = before === btn.getAttribute('data-reaction') ? '' : btn.getAttribute('data-reaction');
        note.reaction = next;
        holder.querySelectorAll('.postit-react').forEach(function(b) {
          var on = b.getAttribute('data-reaction') === next;
          b.classList.toggle('is-on', on);
          b.setAttribute('aria-pressed', String(on));
        });
        if (next) btn.classList.add('is-popping');
        setTimeout(function() { btn.classList.remove('is-popping'); }, 400);
        StaffPostits.react(note.id, next).catch(function(err) {
          note.reaction = before;
          holder.querySelectorAll('.postit-react').forEach(function(b) {
            var on = b.getAttribute('data-reaction') === before;
            b.classList.toggle('is-on', on);
            b.setAttribute('aria-pressed', String(on));
          });
          alert(err.message);
        });
      });
    });
  }

  function slipHtml(n, nameMap) {
    var info = REACTION_INFO[n.reaction];
    if (!info) return '';
    return (
      '<div class="postit-slip is-' + n.reaction + '" data-slip-id="' + esc(n.id) + '">' +
        '<i class="ti ' + info.icon + ' postit-slip-icon" aria-hidden="true"></i>' +
        '<div class="postit-slip-text"><strong>' + esc(nameMap[n.recipientId] || 'A colleague') + '</strong> ' + info.past +
          ' your note <span>“' + esc(snippet(n.body, 48)) + '”</span></div>' +
        '<button type="button" class="postit-slip-clear" aria-label="Clear" title="Clear"><i class="ti ti-x" aria-hidden="true"></i></button>' +
      '</div>'
    );
  }

  /* ── Banner notes ── */

  function noteHtml(n) {
    return (
      '<article class="postit color-' + esc(n.color) + '" data-postit-id="' + esc(n.id) + '">' +
        '<div class="postit-from"><span>From ' + esc(n.senderName) + '</span><span>' + esc(whenLabel(n.createdAt, n.showFrom)) + '</span></div>' +
        '<div class="postit-body">' + esc(n.body) + '</div>' +
        '<div class="postit-foot">' +
          '<button type="button" class="postit-got" aria-label="Got it: remove note from ' + esc(n.senderName) + '">' +
            '<i class="ti ti-check" aria-hidden="true"></i> Got it</button>' +
          reactButtonsHtml(n) +
        '</div>' +
      '</article>'
    );
  }

  function paint(el, notes, slips, nameMap) {
    var shown = expanded ? notes : notes.slice(0, SHOW_MAX);
    var extra = notes.length - shown.length;
    var slipsShown = slips.slice(0, SLIPS_MAX);
    var byId = {};
    notes.forEach(function(n) { byId[n.id] = n; });
    el.hidden = false;
    el.classList.toggle('is-empty', notes.length === 0 && slips.length === 0);
    el.innerHTML =
      (slipsShown.length
        ? '<div class="postit-slips">' + slipsShown.map(function(n) { return slipHtml(n, nameMap); }).join('') +
          (slips.length > SLIPS_MAX ? '<button type="button" class="postit-slips-more" data-slips-all>Clear all ' + slips.length + '</button>' : '') +
          '</div>'
        : '') +
      (shown.length ? '<div class="home-postits-notes">' + shown.map(noteHtml).join('') + '</div>' : '') +
      '<div class="home-postits-foot">' +
        (extra > 0
          ? '<button type="button" class="home-postits-link" data-postit-more>+' + extra + ' more note' + (extra === 1 ? '' : 's') + '</button>'
          : (expanded && notes.length > SHOW_MAX
            ? '<button type="button" class="home-postits-link" data-postit-less>Show fewer</button>'
            : '')) +
        '<button type="button" class="home-postits-link" data-postit-history>' +
          '<i class="ti ti-history" aria-hidden="true"></i> All post-its</button>' +
        '<button type="button" class="home-postits-link" data-postit-send>' +
          '<i class="ti ti-note" aria-hidden="true"></i> Send a post-it</button>' +
      '</div>';

    el.querySelectorAll('.postit').forEach(function(card) {
      var btn = card.querySelector('.postit-got');
      btn.addEventListener('click', function() {
        var id = card.getAttribute('data-postit-id');
        btn.disabled = true;
        card.classList.add('is-peeling');
        StaffPostits.dismiss(id).then(function() {
          setTimeout(function() { render(); }, 300);
        }).catch(function() {
          btn.disabled = false;
          card.classList.remove('is-peeling');
        });
      });
    });
    bindReacts(el, byId);

    el.querySelectorAll('.postit-slip-clear').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var slip = btn.closest('[data-slip-id]');
        var id = slip.getAttribute('data-slip-id');
        slip.classList.add('is-leaving');
        StaffPostits.clearReactions([id]).then(function() {
          setTimeout(function() { render(); }, 200);
        }).catch(function() { slip.classList.remove('is-leaving'); });
      });
    });
    var clearAll = el.querySelector('[data-slips-all]');
    if (clearAll) {
      clearAll.addEventListener('click', function() {
        StaffPostits.clearReactions(slips.map(function(n) { return n.id; })).then(render).catch(function() {});
      });
    }

    var more = el.querySelector('[data-postit-more]');
    if (more) more.addEventListener('click', function() { expanded = true; paint(el, notes, slips, nameMap); });
    var less = el.querySelector('[data-postit-less]');
    if (less) less.addEventListener('click', function() { expanded = false; paint(el, notes, slips, nameMap); });
    el.querySelector('[data-postit-send]').addEventListener('click', openSendDialog);
    el.querySelector('[data-postit-history]').addEventListener('click', openHistoryDialog);

    var unseen = shown.filter(function(n) { return !n.seenAt; }).map(function(n) { return n.id; });
    if (unseen.length && document.visibilityState !== 'hidden') {
      StaffPostits.markSeen(unseen).then(function() {
        notes.forEach(function(n) { if (unseen.indexOf(n.id) >= 0) n.seenAt = new Date().toISOString(); });
      }).catch(function() {});
    }
  }

  function render() {
    var el = root();
    if (!el || !window.StaffPostits) return Promise.resolve();
    if (loading) return loading;
    loading = StaffPostits.inbox().then(function(notes) {
      return StaffPostits.newReactions().catch(function() { return []; }).then(function(slips) {
        return (slips.length ? names() : Promise.resolve({})).then(function(nameMap) {
          paint(el, notes, slips, nameMap);
        });
      });
    }).catch(function(err) {
      // Not signed in, or the table isn't set up yet: keep the banner as it was.
      el.hidden = true;
      el.innerHTML = '';
      if (window.console && err) console.info('[post-its]', err.message || err);
    }).then(function() {
      loading = null;
    });
    return loading;
  }

  /* ── Dialog shell ── */

  function closeDialog() {
    if (!dialog) return;
    var opener = dialog._opener;
    var onClose = dialog._onClose;
    dialog.remove();
    dialog = null;
    document.removeEventListener('keydown', onKey);
    if (opener && document.body.contains(opener)) opener.focus();
    if (onClose) onClose();
  }

  function onKey(e) {
    if (e.key === 'Escape') closeDialog();
  }

  function openShell(html, opener, onClose) {
    dialog = document.createElement('div');
    dialog.className = 'postit-dialog-backdrop';
    dialog._opener = opener;
    dialog._onClose = onClose;
    dialog.innerHTML = html;
    document.body.appendChild(dialog);
    document.addEventListener('keydown', onKey);
    dialog.addEventListener('click', function(ev) {
      if (ev.target === dialog) closeDialog();
    });
    dialog.querySelectorAll('[data-close]').forEach(function(b) { b.addEventListener('click', closeDialog); });
    return dialog;
  }

  function dialogHead(id, title) {
    return '<div class="postit-dialog-head">' +
      '<h2 class="postit-dialog-title" id="' + id + '">' + title + '</h2>' +
      '<button type="button" class="postit-dialog-close" data-close aria-label="Close"><i class="ti ti-x" aria-hidden="true"></i></button>' +
    '</div>';
  }

  function sentStatus(n) {
    var reaction = REACTION_INFO[n.reaction]
      ? '<span class="postit-sent-reaction is-' + n.reaction + '" title="' + REACTION_INFO[n.reaction].past + '"><i class="ti ' +
        REACTION_INFO[n.reaction].icon + '" aria-hidden="true"></i><span class="visually-hidden">' + REACTION_INFO[n.reaction].past + '</span></span>'
      : '';
    var status;
    if (n.dismissedAt) status = '<span class="postit-sent-status is-seen"><i class="ti ti-checks" aria-hidden="true"></i> Got it</span>';
    else if (n.seenAt) status = '<span class="postit-sent-status is-seen"><i class="ti ti-eye" aria-hidden="true"></i> Seen</span>';
    else if (n.showFrom > StaffPostits.todayISO()) status = '<span class="postit-sent-status">Shows ' + esc(whenLabel(n.createdAt, n.showFrom)) + '</span>';
    else status = '<span class="postit-sent-status">Not seen yet</span>';
    return reaction + status;
  }

  function withdrawButtonHtml(n, name) {
    return n.dismissedAt ? '' : '<button type="button" class="postit-sent-withdraw" data-withdraw aria-label="Withdraw note to ' +
      esc(name) + '" title="Withdraw"><i class="ti ti-trash" aria-hidden="true"></i></button>';
  }

  function bindWithdraw(el, onDone) {
    el.querySelectorAll('[data-withdraw]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var id = btn.closest('[data-postit-id]').getAttribute('data-postit-id');
        if (!confirm('Withdraw this post-it? It will come off their screen.')) return;
        StaffPostits.withdraw(id).then(function() { onDone(id); }).catch(function(err) { alert(err.message); });
      });
    });
  }

  /* ── Send dialog ── */

  function colorButtonsHtml(active) {
    return StaffPostits.COLORS.map(function(c) {
      return '<button type="button" class="postit-color' + (c === active ? ' is-active' : '') + '" data-color="' + c +
        '" aria-label="' + c + '" aria-pressed="' + (c === active) + '"></button>';
    }).join('');
  }

  function renderSent(state) {
    var list = dialog.querySelector('[data-sent-list]');
    if (!state.sent) { list.innerHTML = '<p class="postit-sent-empty">Loading…</p>'; return; }
    if (!state.sent.length) { list.innerHTML = '<p class="postit-sent-empty">Notes you send show here, with whether they\'ve been seen.</p>'; return; }
    var nameMap = {};
    (state.people || []).forEach(function(p) { nameMap[p.id] = p.name; });
    list.innerHTML = '<ul class="postit-sent-list">' + state.sent.map(function(n) {
      var name = nameMap[n.recipientId] || 'Colleague';
      return '<li class="postit-sent-item" data-postit-id="' + esc(n.id) + '">' +
        '<span class="postit-sent-swatch" style="background:' + SWATCH[n.color] + '"></span>' +
        '<div class="postit-sent-text"><strong>' + esc(name) + '</strong><span>' + esc(n.body) + '</span></div>' +
        sentStatus(n) + withdrawButtonHtml(n, name) +
      '</li>';
    }).join('') + '</ul>';
    bindWithdraw(list, function(id) {
      state.sent = state.sent.filter(function(n) { return n.id !== id; });
      renderSent(state);
    });
  }

  function renderPeople(state) {
    var list = dialog.querySelector('[data-people]');
    var q = state.query.trim().toLowerCase();
    if (!state.people) { list.innerHTML = '<div class="postit-people-empty">Loading staff…</div>'; return; }
    var matches = state.people.filter(function(p) { return !q || p.name.toLowerCase().indexOf(q) >= 0; });
    if (!matches.length) {
      list.innerHTML = '<div class="postit-people-empty">' + (state.people.length ? 'No one matches that name.' : 'No colleagues found.') + '</div>';
    } else {
      var allOn = matches.every(function(p) { return state.chosen[p.id]; });
      list.innerHTML =
        '<label class="postit-person is-all"><input type="checkbox" data-all' + (allOn ? ' checked' : '') + '> ' +
          (q ? 'All matching (' + matches.length + ')' : 'Everyone (' + matches.length + ')') + '</label>' +
        matches.map(function(p) {
          return '<label class="postit-person"><input type="checkbox" value="' + esc(p.id) + '"' +
            (state.chosen[p.id] ? ' checked' : '') + '> ' + esc(p.name) + '</label>';
        }).join('');
      list.querySelector('[data-all]').addEventListener('change', function(e) {
        matches.forEach(function(p) {
          if (e.target.checked) state.chosen[p.id] = true;
          else delete state.chosen[p.id];
        });
        renderPeople(state);
      });
      list.querySelectorAll('input[value]').forEach(function(box) {
        box.addEventListener('change', function() {
          if (box.checked) state.chosen[box.value] = true;
          else delete state.chosen[box.value];
          renderPeople(state);
        });
      });
    }
    var n = Object.keys(state.chosen).length;
    dialog.querySelector('[data-chosen]').textContent = n ? n + ' chosen' : '';
  }

  function updatePreview(state) {
    var prev = dialog.querySelector('[data-preview]');
    var text = dialog.querySelector('[data-text]').value;
    var date = dialog.querySelector('[data-date]').value;
    prev.className = 'postit color-' + state.color;
    prev.querySelector('.postit-body').textContent = text.trim() || 'Your note';
    prev.querySelector('[data-preview-when]').textContent = date && date > StaffPostits.todayISO()
      ? whenLabel(new Date().toISOString(), date)
      : 'Now';
    dialog.querySelector('[data-count]').textContent = text.length + ' / ' + StaffPostits.MAX_TEXT;
  }

  function openSendDialog(e) {
    if (dialog) return;
    var state = { people: null, sent: null, chosen: {}, query: '', color: 'yellow' };
    var today = StaffPostits.todayISO();
    openShell(
      '<div class="postit-dialog" role="dialog" aria-modal="true" aria-labelledby="postitDialogTitle">' +
        dialogHead('postitDialogTitle', 'Send a post-it') +
        '<form class="postit-dialog-body" novalidate>' +
          '<div>' +
            '<div class="postit-field">' +
              '<span class="postit-label" id="postitToLabel">To</span>' +
              '<div class="postit-people" role="group" aria-labelledby="postitToLabel">' +
                '<input type="search" class="postit-input" data-search placeholder="Search staff" aria-label="Search staff">' +
                '<div class="postit-people-list" data-people></div>' +
              '</div>' +
              '<div class="postit-chosen" data-chosen></div>' +
            '</div>' +
            '<div class="postit-field">' +
              '<label class="postit-label" for="postitText">Note</label>' +
              '<textarea id="postitText" class="postit-textarea" data-text maxlength="' + StaffPostits.MAX_TEXT + '" rows="3" placeholder="S3 reports are due Friday at 4pm."></textarea>' +
              '<div class="postit-count" data-count></div>' +
            '</div>' +
            '<div class="postit-row">' +
              '<div><span class="postit-label">Colour</span><div class="postit-colors" data-colors>' + colorButtonsHtml(state.color) + '</div></div>' +
              '<div><label class="postit-label" for="postitDate">Show from</label>' +
                '<input id="postitDate" type="date" class="postit-input postit-date" data-date value="' + today + '" min="' + today + '"></div>' +
            '</div>' +
            '<p class="postit-error" data-msg role="status"></p>' +
            '<div class="postit-actions">' +
              '<button type="button" class="postit-btn" data-close>Cancel</button>' +
              '<button type="submit" class="postit-btn is-primary" data-submit><i class="ti ti-send" aria-hidden="true"></i> Stick it</button>' +
            '</div>' +
          '</div>' +
          '<div class="postit-dialog-preview" aria-hidden="true">' +
            '<p class="postit-preview-label">How it will look to them</p>' +
            '<article class="postit color-yellow" data-preview>' +
              '<div class="postit-from"><span>From you</span><span data-preview-when>Now</span></div>' +
              '<div class="postit-body">Your note</div>' +
            '</article>' +
          '</div>' +
        '</form>' +
        '<div class="postit-sent"><h3 class="postit-sent-title">You sent</h3><div data-sent-list></div></div>' +
      '</div>',
      e && e.currentTarget
    );

    dialog.querySelector('[data-search]').addEventListener('input', function(ev) {
      state.query = ev.target.value;
      renderPeople(state);
    });
    dialog.querySelector('[data-text]').addEventListener('input', function() {
      dialog.querySelector('[data-msg]').textContent = '';
      updatePreview(state);
    });
    dialog.querySelector('[data-date]').addEventListener('change', function() { updatePreview(state); });
    dialog.querySelector('[data-colors]').addEventListener('click', function(ev) {
      var btn = ev.target.closest('.postit-color');
      if (!btn) return;
      state.color = btn.getAttribute('data-color');
      dialog.querySelector('[data-colors]').innerHTML = colorButtonsHtml(state.color);
      updatePreview(state);
    });
    dialog.querySelector('form').addEventListener('submit', function(ev) {
      ev.preventDefault();
      var msg = dialog.querySelector('[data-msg]');
      var submit = dialog.querySelector('[data-submit]');
      var textEl = dialog.querySelector('[data-text]');
      msg.className = 'postit-error';
      msg.textContent = '';
      submit.setAttribute('aria-busy', 'true');
      StaffPostits.send({
        recipientIds: Object.keys(state.chosen),
        body: textEl.value,
        color: state.color,
        showFrom: dialog.querySelector('[data-date]').value
      }).then(function(count) {
        if (!dialog) return;
        msg.className = 'postit-error postit-ok';
        msg.textContent = count === 1 ? 'Stuck on their home page.' : 'Stuck on ' + count + ' home pages.';
        textEl.value = '';
        state.chosen = {};
        renderPeople(state);
        updatePreview(state);
        return StaffPostits.sent().then(function(list) { state.sent = list; renderSent(state); });
      }).catch(function(err) {
        if (!dialog) return;
        msg.textContent = err.message;
      }).then(function() {
        if (dialog) submit.removeAttribute('aria-busy');
      });
    });

    renderPeople(state);
    renderSent(state);
    updatePreview(state);
    dialog.querySelector('[data-search]').focus();

    StaffPostits.directory().then(function(people) {
      if (!dialog) return;
      state.people = people;
      renderPeople(state);
      renderSent(state);
    }).catch(function(err) {
      if (!dialog) return;
      state.people = [];
      dialog.querySelector('[data-people]').innerHTML = '<div class="postit-people-empty">' + esc(err.message) + '</div>';
    });
    StaffPostits.sent().then(function(list) {
      if (!dialog) return;
      state.sent = list;
      renderSent(state);
    }).catch(function() {
      if (!dialog) return;
      state.sent = [];
      renderSent(state);
    });
  }

  /* ── All post-its (history) ── */

  function historyItemHtml(n, box, nameMap) {
    var received = box === 'received';
    var who = received ? n.senderName : (nameMap[n.recipientId] || 'Colleague');
    var side = received
      ? '<span class="postit-sent-status' + (n.dismissedAt ? ' is-seen' : '') + '">' +
          (n.dismissedAt ? '<i class="ti ti-checks" aria-hidden="true"></i> Ticked off' : 'On your screen') + '</span>' +
        reactButtonsHtml(n)
      : sentStatus(n) + withdrawButtonHtml(n, who);
    return '<li class="postit-hist-item" data-postit-id="' + esc(n.id) + '">' +
      '<span class="postit-sent-swatch" style="background:' + SWATCH[n.color] + '"></span>' +
      '<div class="postit-hist-text">' +
        '<div class="postit-hist-meta"><strong>' + (received ? 'From ' : 'To ') + esc(who) + '</strong> · ' +
          esc(whenLabel(n.createdAt, n.showFrom)) + '</div>' +
        '<div class="postit-hist-body">' + esc(n.body) + '</div>' +
      '</div>' +
      '<div class="postit-hist-side">' + side + '</div>' +
    '</li>';
  }

  function renderHistory(state) {
    var list = dialog.querySelector('[data-hist-list]');
    var notes = state.lists[state.box];
    dialog.querySelectorAll('[data-box]').forEach(function(tab) {
      var on = tab.getAttribute('data-box') === state.box;
      tab.classList.toggle('is-active', on);
      tab.setAttribute('aria-selected', String(on));
      tab.tabIndex = on ? 0 : -1;
    });
    if (state.error) { list.innerHTML = '<p class="postit-sent-empty">' + esc(state.error) + '</p>'; return; }
    if (!notes) { list.innerHTML = '<p class="postit-sent-empty">Loading…</p>'; return; }
    var q = state.query.trim().toLowerCase();
    var shown = notes.filter(function(n) {
      if (!q) return true;
      var who = state.box === 'received' ? n.senderName : (state.names[n.recipientId] || '');
      return (who + ' ' + n.body).toLowerCase().indexOf(q) >= 0;
    });
    if (!shown.length) {
      list.innerHTML = '<p class="postit-sent-empty">' + (q
        ? 'No post-its match that.'
        : (state.box === 'received' ? 'No one has sent you a post-it this school year.' : 'You haven\'t sent any post-its this school year.')) + '</p>';
      return;
    }
    list.innerHTML = '<ul class="postit-hist-list">' + shown.map(function(n) {
      return historyItemHtml(n, state.box, state.names);
    }).join('') + '</ul>';
    var byId = {};
    notes.forEach(function(n) { byId[n.id] = n; });
    bindReacts(list, byId);
    bindWithdraw(list, function(id) {
      state.lists.sent = state.lists.sent.filter(function(n) { return n.id !== id; });
      renderHistory(state);
    });
  }

  function loadHistory(state) {
    if (state.lists[state.box]) return renderHistory(state);
    var box = state.box;
    renderHistory(state);
    StaffPostits.history(box).then(function(list) {
      if (!dialog) return;
      state.lists[box] = list;
      if (state.box === box) renderHistory(state);
    }).catch(function(err) {
      if (!dialog) return;
      state.error = err.message;
      renderHistory(state);
    });
  }

  function openHistoryDialog(e) {
    if (dialog) return;
    var state = { box: 'received', lists: {}, names: {}, query: '', error: '' };
    openShell(
      '<div class="postit-dialog postit-dialog--history" role="dialog" aria-modal="true" aria-labelledby="postitHistTitle">' +
        dialogHead('postitHistTitle', 'All post-its') +
        '<div class="postit-hist-bar">' +
          '<div class="postit-tabs" role="tablist" aria-label="Post-its">' +
            '<button type="button" class="postit-tab" role="tab" data-box="received">Received</button>' +
            '<button type="button" class="postit-tab" role="tab" data-box="sent">Sent</button>' +
          '</div>' +
          '<input type="search" class="postit-input postit-hist-search" data-hist-search placeholder="Search names or words" aria-label="Search post-its">' +
        '</div>' +
        '<p class="postit-hist-note">This school year, newest first.</p>' +
        '<div class="postit-hist-wrap" role="tabpanel" data-hist-list></div>' +
      '</div>',
      e && e.currentTarget,
      function() { render(); }
    );
    dialog.querySelectorAll('[data-box]').forEach(function(tab) {
      tab.addEventListener('click', function() {
        state.box = tab.getAttribute('data-box');
        state.error = '';
        loadHistory(state);
      });
      tab.addEventListener('keydown', function(ev) {
        if (ev.key !== 'ArrowRight' && ev.key !== 'ArrowLeft') return;
        var other = dialog.querySelector('[data-box="' + (state.box === 'received' ? 'sent' : 'received') + '"]');
        other.click();
        other.focus();
      });
    });
    dialog.querySelector('[data-hist-search]').addEventListener('input', function(ev) {
      state.query = ev.target.value;
      renderHistory(state);
    });
    names().then(function(map) {
      if (!dialog) return;
      state.names = map;
      renderHistory(state);
    });
    loadHistory(state);
    dialog.querySelector('[data-box="received"]').focus();
  }

  document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'visible') render();
  });

  window.StaffPostitsHome = {
    render: render,
    openSendDialog: openSendDialog,
    openHistoryDialog: openHistoryDialog
  };
})();
