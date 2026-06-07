/**
 * Tracking Hub — Phase 4: Supabase annotations & concern flags
 */
(function(global) {
  'use strict';

  var TH = null;
  var CACHE = { byPupil: {}, loaded: false, available: true };

  function canUseSupabase() {
    return !!(global.supabase && global.supabase.from);
  }

  function indexRows(rows) {
    var byPupil = {};
    (rows || []).forEach(function(r) {
      var key = r.pupil_key + '|' + r.subject;
      if (!byPupil[key]) byPupil[key] = [];
      byPupil[key].push(r);
    });
    Object.keys(byPupil).forEach(function(k) {
      byPupil[k].sort(function(a, b) {
        return new Date(b.created_at) - new Date(a.created_at);
      });
    });
    CACHE.byPupil = byPupil;
    CACHE.loaded = true;
  }

  function loadAll() {
    if (!canUseSupabase()) {
      CACHE.available = false;
      return Promise.resolve([]);
    }
    return global.supabase.from('tracking_hub_annotations')
      .select('id, pupil_key, subject, author_email, body, is_flag, resolved, created_at')
      .order('created_at', { ascending: false })
      .limit(2000)
      .then(function(res) {
        if (res.error) {
          if (/relation|does not exist|42P01/i.test(String(res.error.message || ''))) {
            CACHE.available = false;
          }
          return [];
        }
        indexRows(res.data || []);
        if (TH && TH.HUB) TH.HUB.annotations = CACHE.byPupil;
        return res.data || [];
      })
      .catch(function() {
        CACHE.available = false;
        return [];
      });
  }

  function getForPupil(pupilKey, subject) {
    return CACHE.byPupil[(pupilKey || '') + '|' + (subject || '')] || [];
  }

  function hasOpenFlag(pupilKey, subject) {
    return getForPupil(pupilKey, subject).some(function(n) {
      return n.is_flag && !n.resolved;
    });
  }

  function formatDate(iso) {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
    } catch (e) {
      return String(iso);
    }
  }

  function renderNotesHtml(pupilKey, subject) {
    var notes = getForPupil(pupilKey, subject);
    if (!notes.length) {
      return '<p class="th-profile-text th-muted">No hub notes yet.</p>';
    }
    return '<div class="th-notes-list">' + notes.map(function(n) {
      var flag = n.is_flag && !n.resolved ? '<span class="th-badge th-badge-high">Flag</span> ' :
        n.is_flag && n.resolved ? '<span class="th-badge">Resolved</span> ' : '';
      return '<div class="th-note-item">' + flag +
        '<span class="th-note-meta">' + TH.safeText(n.author_email || 'Staff') +
        ' · ' + TH.safeText(formatDate(n.created_at)) + '</span>' +
        '<p class="th-note-body">' + TH.safeText(n.body || '') + '</p>' +
        (canResolve() && n.is_flag && !n.resolved ?
          '<button type="button" class="th-btn th-btn-ghost th-btn-compact th-resolve-flag" data-note-id="' +
          TH.safeText(n.id) + '">Resolve flag</button>' : '') +
        '</div>';
    }).join('') + '</div>';
  }

  function canResolve() {
    return !!(global.__authGuardIsAdmin || global.__authGuardIsFacultyHead);
  }

  function addNote(pupilKey, subject, body, isFlag) {
    if (!canUseSupabase() || !CACHE.available) {
      TH.toast('Notes unavailable — run DB migration');
      return Promise.resolve(null);
    }
    return global.supabase.auth.getSession().then(function(r) {
      var session = (r.data || {}).session;
      if (!session) throw new Error('Not signed in');
      return global.supabase.from('tracking_hub_annotations').insert({
        pupil_key: pupilKey,
        subject: subject,
        author_id: session.user.id,
        author_email: session.user.email || '',
        body: String(body || '').trim(),
        is_flag: !!isFlag
      }).select().single();
    }).then(function(res) {
      if (res.error) throw res.error;
      var row = res.data;
      var key = pupilKey + '|' + subject;
      if (!CACHE.byPupil[key]) CACHE.byPupil[key] = [];
      CACHE.byPupil[key].unshift(row);
      if (TH && TH.HUB) TH.HUB.annotations = CACHE.byPupil;
      TH.toast(isFlag ? 'Flag added' : 'Note saved');
      if (TH.recalcFilteredState) TH.recalcFilteredState();
      return row;
    }).catch(function(err) {
      TH.toast((err && err.message) ? err.message : 'Could not save note');
      return null;
    });
  }

  function resolveFlag(noteId) {
    if (!canUseSupabase() || !noteId) return Promise.resolve();
    return global.supabase.from('tracking_hub_annotations')
      .update({ resolved: true })
      .eq('id', noteId)
      .then(function(res) {
        if (res.error) throw res.error;
        Object.keys(CACHE.byPupil).forEach(function(k) {
          CACHE.byPupil[k] = CACHE.byPupil[k].map(function(n) {
            return n.id === noteId ? Object.assign({}, n, { resolved: true }) : n;
          });
        });
        TH.toast('Flag resolved');
        return res;
      })
      .catch(function() { TH.toast('Could not resolve flag'); });
  }

  function bindDrawerEvents() {
    var body = document.getElementById('profile-drawer-body');
    if (!body || body._thNotesBound) return;
    body._thNotesBound = true;
    body.addEventListener('click', function(ev) {
      var resolveBtn = ev.target.closest('.th-resolve-flag');
      if (resolveBtn) {
        resolveFlag(resolveBtn.getAttribute('data-note-id')).then(function() {
          if (global.TrackingHubDrawer) global.TrackingHubDrawer.render();
        });
        return;
      }
      if (!ev.target.closest('#profile-add-note-btn')) return;
      var state = global.TrackingHubDrawer && global.TrackingHubDrawer.getState
        ? global.TrackingHubDrawer.getState() : {};
      var ta = document.getElementById('profile-note-input');
      var flag = document.getElementById('profile-note-flag');
      if (!state.pupilKey || !state.subject || !ta) return;
      var text = ta.value.trim();
      if (!text) { TH.toast('Enter a note first'); return; }
      addNote(state.pupilKey, state.subject, text, flag && flag.checked).then(function() {
        if (global.TrackingHubDrawer) global.TrackingHubDrawer.render();
      });
    });
  }

  function init(hubApi) {
    TH = hubApi;
    bindDrawerEvents();
  }

  global.TrackingHubNotes = {
    init: init,
    loadAll: loadAll,
    getForPupil: getForPupil,
    hasOpenFlag: hasOpenFlag,
    renderNotesHtml: renderNotesHtml,
    addNote: addNote,
    resolveFlag: resolveFlag
  };
})(window);
