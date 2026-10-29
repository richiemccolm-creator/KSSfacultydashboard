/**
 * Home banner post-its — notes colleagues have stuck on my Faculty Hub home,
 * plus the "Send a post-it" dialog. Data lives in StaffPostits (staff-postits-service.js).
 * Shows up to two notes beside the banner; "+N more" opens the rest.
 */
/* global StaffPostits */
(function() {
  var SHOW_MAX = 2;
  var expanded = false;
  var loading = null;
  var dialog = null;

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

  function noteHtml(n) {
    return (
      '<article class="postit color-' + esc(n.color) + '" data-postit-id="' + esc(n.id) + '">' +
        '<div class="postit-from"><span>From ' + esc(n.senderName) + '</span><span>' + esc(whenLabel(n.createdAt, n.showFrom)) + '</span></div>' +
        '<div class="postit-body">' + esc(n.body) + '</div>' +
        '<button type="button" class="postit-got" aria-label="Got it: remove note from ' + esc(n.senderName) + '">' +
          '<i class="ti ti-check" aria-hidden="true"></i> Got it</button>' +
      '</article>'
    );
  }

  function sendButtonHtml() {
    return '<button type="button" class="home-postits-link" data-postit-send>' +
      '<i class="ti ti-note" aria-hidden="true"></i> Send a post-it</button>';
  }

  function paint(el, notes) {
    var shown = expanded ? notes : notes.slice(0, SHOW_MAX);
    var extra = notes.length - shown.length;
    el.hidden = false;
    el.classList.toggle('is-empty', notes.length === 0);
    el.innerHTML =
      (shown.length ? '<div class="home-postits-notes">' + shown.map(noteHtml).join('') + '</div>' : '') +
      '<div class="home-postits-foot">' +
        (extra > 0
          ? '<button type="button" class="home-postits-link" data-postit-more>+' + extra + ' more note' + (extra === 1 ? '' : 's') + '</button>'
          : (expanded && notes.length > SHOW_MAX
            ? '<button type="button" class="home-postits-link" data-postit-less>Show fewer</button>'
            : '')) +
        sendButtonHtml() +
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
    var more = el.querySelector('[data-postit-more]');
    if (more) more.addEventListener('click', function() { expanded = true; paint(el, notes); });
    var less = el.querySelector('[data-postit-less]');
    if (less) less.addEventListener('click', function() { expanded = false; paint(el, notes); });
    el.querySelector('[data-postit-send]').addEventListener('click', openDialog);

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
      paint(el, notes);
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

  /* ── Send dialog ── */

  function colorButtonsHtml(active) {
    return StaffPostits.COLORS.map(function(c) {
      return '<button type="button" class="postit-color' + (c === active ? ' is-active' : '') + '" data-color="' + c +
        '" aria-label="' + c + '" aria-pressed="' + (c === active) + '"></button>';
    }).join('');
  }

  function sentStatus(n) {
    if (n.dismissedAt) return '<span class="postit-sent-status is-seen"><i class="ti ti-checks" aria-hidden="true"></i> Got it</span>';
    if (n.seenAt) return '<span class="postit-sent-status is-seen"><i class="ti ti-eye" aria-hidden="true"></i> Seen</span>';
    if (n.showFrom > StaffPostits.todayISO()) return '<span class="postit-sent-status">Shows ' + esc(whenLabel(n.createdAt, n.showFrom)) + '</span>';
    return '<span class="postit-sent-status">Not seen yet</span>';
  }

  var SWATCH = { yellow: '#fef08a', mint: '#bbf7d0', sky: '#bae6fd', peach: '#fed7aa', rose: '#fecdd3' };

  function renderSent(state) {
    var list = dialog.querySelector('[data-sent-list]');
    if (!state.sent) { list.innerHTML = '<p class="postit-sent-empty">Loading…</p>'; return; }
    if (!state.sent.length) { list.innerHTML = '<p class="postit-sent-empty">Notes you send show here, with whether they\'ve been seen.</p>'; return; }
    var names = {};
    (state.people || []).forEach(function(p) { names[p.id] = p.name; });
    list.innerHTML = '<ul class="postit-sent-list">' + state.sent.map(function(n) {
      return '<li class="postit-sent-item" data-id="' + esc(n.id) + '">' +
        '<span class="postit-sent-swatch" style="background:' + SWATCH[n.color] + '"></span>' +
        '<div class="postit-sent-text"><strong>' + esc(names[n.recipientId] || 'Colleague') + '</strong><span>' + esc(n.body) + '</span></div>' +
        sentStatus(n) +
        (n.dismissedAt ? '' : '<button type="button" class="postit-sent-withdraw" aria-label="Withdraw note to ' +
          esc(names[n.recipientId] || 'colleague') + '" title="Withdraw"><i class="ti ti-trash" aria-hidden="true"></i></button>') +
      '</li>';
    }).join('') + '</ul>';
    list.querySelectorAll('.postit-sent-withdraw').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var id = btn.closest('[data-id]').getAttribute('data-id');
        if (!confirm('Withdraw this post-it? It will come off their screen.')) return;
        StaffPostits.withdraw(id).then(function() {
          state.sent = state.sent.filter(function(n) { return n.id !== id; });
          renderSent(state);
        }).catch(function(err) { alert(err.message); });
      });
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

  function closeDialog() {
    if (!dialog) return;
    var opener = dialog._opener;
    dialog.remove();
    dialog = null;
    document.removeEventListener('keydown', onKey);
    if (opener && document.body.contains(opener)) opener.focus();
  }

  function onKey(e) {
    if (e.key === 'Escape') closeDialog();
  }

  function openDialog(e) {
    if (dialog) return;
    var state = { people: null, sent: null, chosen: {}, query: '', color: 'yellow' };
    var today = StaffPostits.todayISO();
    dialog = document.createElement('div');
    dialog.className = 'postit-dialog-backdrop';
    dialog._opener = e && e.currentTarget;
    dialog.innerHTML =
      '<div class="postit-dialog" role="dialog" aria-modal="true" aria-labelledby="postitDialogTitle">' +
        '<div class="postit-dialog-head">' +
          '<h2 class="postit-dialog-title" id="postitDialogTitle">Send a post-it</h2>' +
          '<button type="button" class="postit-dialog-close" data-close aria-label="Close"><i class="ti ti-x" aria-hidden="true"></i></button>' +
        '</div>' +
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
      '</div>';
    document.body.appendChild(dialog);
    document.addEventListener('keydown', onKey);

    dialog.addEventListener('click', function(ev) {
      if (ev.target === dialog) closeDialog();
    });
    dialog.querySelectorAll('[data-close]').forEach(function(b) { b.addEventListener('click', closeDialog); });
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

  document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'visible') render();
  });

  window.StaffPostitsHome = {
    render: render,
    openSendDialog: openDialog
  };
})();
