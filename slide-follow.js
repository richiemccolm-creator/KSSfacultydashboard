/**
 * Classroom follow-along for lesson decks.
 * Teacher (host) broadcasts slide + reveal state. Pupils open ?follow=PIN
 * from a QR code and stay on the teacher's slide while locked.
 *
 * Uses Supabase Realtime broadcast when available, plus BroadcastChannel
 * so two tabs on the same computer can still stay in sync for testing.
 */
(function (w) {
  var DECK_ID = (w.SLIDE_FOLLOW_DECK_ID || 'deck').replace(/[^a-z0-9-]/gi, '').slice(0, 24) || 'deck';
  var QR_PLACEHOLDER = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
  var params = new URLSearchParams(w.location.search);
  var followPin = String(params.get('follow') || '').replace(/\D/g, '').slice(0, 6);
  var isFollow = followPin.length === 6;
  var pin = followPin;
  var hostLocked = true;
  var applying = false;
  var started = false;
  var hooks = null;
  var channel = null;
  var localChannel = null;
  var heartbeat = null;
  var lastSent = '';
  var lastApplied = '';

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function $all(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  function makePin() {
    var key = 'slide-follow-pin:' + DECK_ID;
    try {
      var stored = sessionStorage.getItem(key);
      if (stored && /^\d{6}$/.test(stored)) return stored;
    } catch (e) {}
    var next = String(100000 + Math.floor(Math.random() * 900000));
    try { sessionStorage.setItem(key, next); } catch (e2) {}
    return next;
  }

  function followUrl() {
    var url = new URL(w.location.href);
    url.searchParams.set('follow', pin);
    url.hash = '';
    return url.toString();
  }

  function reachableUrl() {
    return w.location.protocol === 'http:' || w.location.protocol === 'https:';
  }

  function currentState() {
    if (!hooks || typeof hooks.getState !== 'function') return null;
    var state = hooks.getState() || {};
    state.locked = hostLocked;
    state.pin = pin;
    state.t = Date.now();
    return state;
  }

  function send(payload) {
    if (!payload || isFollow) return;
    var json = JSON.stringify({
      slide: payload.slide,
      reveals: payload.reveals,
      locked: payload.locked,
      lang: payload.lang,
      toggles: payload.toggles || []
    });
    if (json === lastSent && payload.force !== true) return;
    lastSent = json;
    var body = payload;
    if (localChannel) {
      try { localChannel.postMessage(body); } catch (e) {}
    }
    if (channel && channel.send) {
      channel.send({ type: 'broadcast', event: 'state', payload: body }).catch(function () {});
    }
  }

  function publish(force) {
    if (isFollow || applying) return;
    var state = currentState();
    if (!state) return;
    if (force) state.force = true;
    send(state);
  }

  function applyRemote(payload) {
    if (!payload || !hooks || typeof hooks.applyState !== 'function') return;
    var key = [payload.slide, payload.reveals, payload.locked, payload.lang, JSON.stringify(payload.toggles || [])].join('|');
    if (key === lastApplied) return;
    lastApplied = key;
    applying = true;
    try {
      document.documentElement.classList.remove('is-follow-waiting');
      hooks.applyState(payload);
      if (typeof payload.locked === 'boolean') {
        document.documentElement.classList.toggle('is-follow-free', isFollow && !payload.locked);
        updateFollowPill(payload.locked !== false);
      }
    } finally {
      applying = false;
    }
  }

  function updateFollowPill(locked) {
    var pill = $('#followPill');
    if (!pill) return;
    if (!isFollow) {
      pill.hidden = true;
      return;
    }
    pill.hidden = false;
    pill.textContent = locked ? 'Following the board' : 'You can move through the slides';
  }

  function drawQr(img, url) {
    if (!img || !url) return;
    function fallback() {
      img.src = 'https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&data=' + encodeURIComponent(url);
    }
    var lib = w.QRCode;
    if (lib && typeof lib.toDataURL === 'function') {
      lib.toDataURL(url, {
        width: 240,
        margin: 1,
        color: { dark: '#08090b', light: '#fffdf7' }
      }, function (err, dataUrl) {
        if (err || !dataUrl) fallback();
        else img.src = dataUrl;
      });
      return;
    }
    fallback();
  }

  function fillJoinUi() {
    var url = followUrl();
    $all('[data-follow-pin]').forEach(function (el) { el.textContent = pin; });
    $all('[data-follow-url]').forEach(function (el) { el.textContent = url; });
    $all('[data-follow-qr]').forEach(function (img) { drawQr(img, url); });
    var warn = $('#followLocalWarn');
    if (warn) warn.hidden = reachableUrl();
    var lockBtn = $('#lockBtn');
    if (lockBtn) lockBtn.textContent = hostLocked ? 'iPads locked' : 'iPads free';
  }

  function setOverlay(open) {
    var overlay = $('#followOverlay');
    if (!overlay) return;
    overlay.hidden = !open;
    overlay.setAttribute('aria-hidden', open ? 'false' : 'true');
  }

  function buildChrome() {
    if ($('#followOverlay')) return;
    var overlay = document.createElement('div');
    overlay.id = 'followOverlay';
    overlay.hidden = true;
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML =
      '<div class="follow-overlay-card">' +
        '<p class="follow-kicker">Scan to follow</p>' +
        '<img data-follow-qr alt="QR code to open the slides on an iPad" width="240" height="240" src="' + QR_PLACEHOLDER + '">' +
        '<p class="follow-pin-label">Code <strong data-follow-pin>' + pin + '</strong></p>' +
        '<p class="follow-url" data-follow-url></p>' +
        '<p class="follow-note" id="followLocalWarn" hidden>Open this deck from the faculty website so iPads can scan a real link.</p>' +
        '<p class="follow-note">iPads stay on your slide until you tap iPads free.</p>' +
        '<button type="button" class="control-btn primary" id="followOverlayClose">Close</button>' +
      '</div>';
    document.body.appendChild(overlay);

    var pill = document.createElement('div');
    pill.id = 'followPill';
    pill.hidden = true;
    document.body.appendChild(pill);

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) setOverlay(false);
    });
    var closeBtn = $('#followOverlayClose');
    if (closeBtn) closeBtn.addEventListener('click', function () { setOverlay(false); });
  }

  function bindHostControls() {
    var qrBtn = $('#qrBtn');
    if (qrBtn) {
      qrBtn.addEventListener('click', function () { setOverlay(true); });
    }
    var lockBtn = $('#lockBtn');
    if (lockBtn) {
      lockBtn.addEventListener('click', function () {
        hostLocked = !hostLocked;
        fillJoinUi();
        publish(true);
      });
    }
  }

  function bindFollowerGuards() {
    document.addEventListener('keydown', function (event) {
      if (!isFollow) return;
      var locked = document.documentElement.classList.contains('is-follow') &&
        !document.documentElement.classList.contains('is-follow-free');
      if (!locked) return;
      if (['ArrowRight', 'ArrowLeft', 'PageDown', 'PageUp', ' '].indexOf(event.key) !== -1) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }, true);

    var startX = 0;
    document.addEventListener('touchstart', function (e) {
      if (!e.changedTouches || !e.changedTouches[0]) return;
      startX = e.changedTouches[0].screenX;
    }, { passive: true });

    document.addEventListener('touchend', function (e) {
      if (!isFollow || !e.changedTouches || !e.changedTouches[0]) return;
      var dx = e.changedTouches[0].screenX - startX;
      if (Math.abs(dx) < 60) return;
      var locked = !document.documentElement.classList.contains('is-follow-free');
      if (locked) {
        e.preventDefault();
        return;
      }
      if (hooks && typeof hooks.nudge === 'function') hooks.nudge(dx < 0 ? 1 : -1);
    }, { passive: false });
  }

  function connectRealtime() {
    var topic = 'sf-' + DECK_ID + '-' + pin;
    try {
      localChannel = new BroadcastChannel(topic);
      localChannel.onmessage = function (event) {
        if (isFollow) applyRemote(event.data);
        else if (event.data && event.data.request) publish(true);
      };
    } catch (e) {
      localChannel = null;
    }

    var sb = w.supabase;
    if (!sb || typeof sb.channel !== 'function') return Promise.resolve(false);

    channel = sb.channel(topic, { config: { broadcast: { self: false } } });
    channel.on('broadcast', { event: 'state' }, function (msg) {
      if (isFollow) applyRemote(msg.payload);
    });
    channel.on('broadcast', { event: 'request' }, function () {
      if (!isFollow) publish(true);
    });
    return new Promise(function (resolve) {
      channel.subscribe(function (status) {
        if (status === 'SUBSCRIBED') {
          if (isFollow) {
            channel.send({ type: 'broadcast', event: 'request', payload: { request: true } }).catch(function () {});
            if (localChannel) {
              try { localChannel.postMessage({ request: true }); } catch (e2) {}
            }
          } else {
            publish(true);
          }
          resolve(true);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          resolve(false);
        }
      });
    });
  }

  function startHeartbeat() {
    if (isFollow) return;
    if (heartbeat) clearInterval(heartbeat);
    heartbeat = setInterval(function () { publish(true); }, 2000);
  }

  w.SlideFollow = {
    isFollow: function () { return isFollow; },
    isLocked: function () {
      if (!isFollow) return hostLocked;
      return !document.documentElement.classList.contains('is-follow-free');
    },
    publish: function () { publish(false); },
    init: function (opts) {
      if (started) return;
      started = true;
      hooks = opts || {};
      if (isFollow) {
        document.documentElement.classList.add('is-follow', 'is-follow-waiting');
        document.body.classList.add('is-follow');
      } else {
        pin = makePin();
        document.documentElement.classList.add('is-host');
      }
      buildChrome();
      fillJoinUi();
      if (!isFollow) bindHostControls();
      bindFollowerGuards();
      updateFollowPill(true);
      setTimeout(function () {
        if (!document.documentElement.classList.contains('is-follow-waiting')) return;
        document.documentElement.classList.remove('is-follow-waiting');
        document.documentElement.classList.add('is-follow-free');
        var pill = document.getElementById('followPill');
        if (pill) {
          pill.hidden = false;
          pill.textContent = 'Could not lock to the board — swipe to follow';
        }
      }, 5000);
      connectRealtime().then(function () {
        if (!isFollow) startHeartbeat();
      });
      if (!isFollow) startHeartbeat();
    }
  };
})(window);
