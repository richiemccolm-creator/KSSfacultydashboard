/**
 * Shared password gate for Tracking & Monitoring hub.
 * Requires auth-guard.js and DataService tracking hub password RPCs.
 */
(function() {
  var UNLOCK_KEY = 'trackingHubUnlocked';

  function isAdminBypass() {
    return !!window.__authGuardIsAdmin;
  }

  function isUnlockedLocally() {
    try {
      return sessionStorage.getItem(UNLOCK_KEY) === '1';
    } catch (e) {
      return false;
    }
  }

  function setUnlockedLocally() {
    try {
      sessionStorage.setItem(UNLOCK_KEY, '1');
    } catch (e) {}
  }

  function clearUnlockedLocally() {
    try {
      sessionStorage.removeItem(UNLOCK_KEY);
    } catch (e) {}
  }

  function isMissingRpcError(err) {
    var msg = String((err && (err.message || err.details || err.hint)) || err || '').toLowerCase();
    return /function|rpc|does not exist|not found|42883|pgrst202/.test(msg);
  }

  function getStatus() {
    if (!window.DataService || typeof window.DataService.getTrackingHubPasswordStatus !== 'function') {
      return Promise.resolve({ enabled: false, available: false });
    }
    return window.DataService.getTrackingHubPasswordStatus().then(function(enabled) {
      return { enabled: !!enabled, available: true };
    }).catch(function(err) {
      if (isMissingRpcError(err)) return { enabled: false, available: false };
      throw err;
    });
  }

  function verifyPassword(password) {
    if (!window.DataService || typeof window.DataService.verifyTrackingHubPassword !== 'function') {
      return Promise.resolve(true);
    }
    return window.DataService.verifyTrackingHubPassword(password).then(function(ok) {
      return !!ok;
    });
  }

  function waitForAuth(timeoutMs) {
    return new Promise(function(resolve) {
      if (window.__authReady) { resolve(); return; }
      var done = false;
      var t = setTimeout(function() {
        if (done) return;
        done = true;
        resolve();
      }, timeoutMs || 5000);
      function finish() {
        if (done) return;
        done = true;
        clearTimeout(t);
        resolve();
      }
      window.addEventListener('auth-guard-ready', finish, { once: true });
    });
  }

  function ensureGateDom() {
    var existing = document.getElementById('tracking-hub-password-gate');
    if (existing) return existing;

    var gate = document.createElement('div');
    gate.id = 'tracking-hub-password-gate';
    gate.className = 'tracking-hub-password-gate';
    gate.innerHTML =
      '<div class="tracking-hub-password-card" role="dialog" aria-modal="true" aria-labelledby="tracking-hub-password-title">' +
        '<h2 id="tracking-hub-password-title">Tracking &amp; Monitoring</h2>' +
        '<p class="tracking-hub-password-sub">Enter the faculty hub password to view school-wide tracking data.</p>' +
        '<div id="tracking-hub-password-error" class="tracking-hub-password-error" style="display:none"></div>' +
        '<form id="tracking-hub-password-form" class="tracking-hub-password-form">' +
          '<label class="tracking-hub-password-label" for="tracking-hub-password-input">Hub password</label>' +
          '<input type="password" id="tracking-hub-password-input" class="tracking-hub-password-input" autocomplete="current-password" required>' +
          '<button type="submit" class="tracking-hub-password-btn" id="tracking-hub-password-submit">Unlock</button>' +
        '</form>' +
      '</div>';
    document.body.appendChild(gate);
    return gate;
  }

  function showGate(onSuccess) {
    var gate = ensureGateDom();
    var form = document.getElementById('tracking-hub-password-form');
    var input = document.getElementById('tracking-hub-password-input');
    var errEl = document.getElementById('tracking-hub-password-error');
    var submitBtn = document.getElementById('tracking-hub-password-submit');
    document.body.classList.add('tracking-hub-locked');

    function setError(msg) {
      if (!errEl) return;
      if (!msg) {
        errEl.style.display = 'none';
        errEl.textContent = '';
        return;
      }
      errEl.textContent = msg;
      errEl.style.display = 'block';
    }

    gate.style.display = 'flex';
    if (input) {
      input.value = '';
      setTimeout(function() { input.focus(); }, 50);
    }

    if (!form || form.__trackingHubBound) {
      return;
    }
    form.__trackingHubBound = true;
    form.addEventListener('submit', function(ev) {
      ev.preventDefault();
      setError('');
      var password = input ? String(input.value || '') : '';
      if (!password) {
        setError('Enter the hub password.');
        return;
      }
      if (submitBtn) submitBtn.disabled = true;
      verifyPassword(password).then(function(ok) {
        if (!ok) {
          setError('Incorrect password. Try again or ask your admin.');
          if (input) input.select();
          return;
        }
        setUnlockedLocally();
        gate.style.display = 'none';
        document.body.classList.remove('tracking-hub-locked');
        if (typeof onSuccess === 'function') onSuccess();
      }).catch(function(err) {
        setError((err && err.message) ? err.message : 'Could not verify password.');
      }).finally(function() {
        if (submitBtn) submitBtn.disabled = false;
      });
    });
  }

  function hideGate() {
    var gate = document.getElementById('tracking-hub-password-gate');
    if (gate) gate.style.display = 'none';
    document.body.classList.remove('tracking-hub-locked');
  }

  /**
   * Runs onSuccess when the user may access the hub.
   * Admins bypass. Others need session unlock or correct password when enabled.
   */
  window.ensureTrackingHubAccess = function(onSuccess) {
    return waitForAuth(5000).then(function() {
      if (isAdminBypass() || isUnlockedLocally()) {
        hideGate();
        if (typeof onSuccess === 'function') onSuccess();
        return;
      }
      return getStatus().then(function(status) {
        if (!status.available || !status.enabled) {
          hideGate();
          if (typeof onSuccess === 'function') onSuccess();
          return;
        }
        showGate(onSuccess);
      });
    });
  };

  window.clearTrackingHubUnlock = clearUnlockedLocally;
})();
