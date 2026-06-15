/**
 * Read-only "view as teacher" mode for Drama / Art BGE trackers.
 * URL: drama-tracker.html?viewAs=<userId>&name=<displayName>&return=<path>
 */
(function() {
  var STYLE_ID = 'tracker-readonly-styles';

  function parseParams() {
    var p = new URLSearchParams(window.location.search);
    return {
      userId: (p.get('viewAs') || '').trim(),
      teacherName: (p.get('name') || '').trim(),
      returnTo: (p.get('return') || 'faculty_dashboard.html?view=staff').trim()
    };
  }

  function canViewSchoolTracking() {
    return !!(
      window.__authGuardCanViewSchoolWideTracking ||
      window.__authGuardCanManageSchool ||
      window.__authGuardIsAdmin ||
      window.__authGuardIsFacultyHead
    );
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var el = document.createElement('style');
    el.id = STYLE_ID;
    el.textContent = [
      'body.tracker-readonly .topbar-actions{display:none!important}',
      'body.tracker-readonly .sc-btn,body.tracker-readonly .na-btn,body.tracker-readonly .p-del,',
      'body.tracker-readonly .defaults-toggle-btn,body.tracker-readonly .profile-ta,',
      'body.tracker-readonly .form-row .btn-primary,body.tracker-readonly .btn-danger,',
      'body.tracker-readonly .bulk-bar .btn,body.tracker-readonly .class-actions .btn,',
      'body.tracker-readonly .handover-actions .btn,body.tracker-readonly .import-actions .btn{',
      'pointer-events:none!important;opacity:.72}',
      'body.tracker-readonly .profile-ta{background:var(--bg,#f8fafc)}',
      '.tracker-readonly-banner{',
      'position:sticky;top:0;z-index:200;display:flex;align-items:center;justify-content:space-between;',
      'gap:.75rem;flex-wrap:wrap;padding:.55rem 1rem;background:#1e3a5f;color:#fff;',
      'font-size:.78rem;line-height:1.45;border-bottom:2px solid #4a7fd4}',
      '.tracker-readonly-banner strong{font-weight:700}',
      '.tracker-readonly-banner a{color:#bfdbfe;text-decoration:none;font-weight:600}',
      '.tracker-readonly-banner a:hover{text-decoration:underline}',
      '.tracker-readonly-denied{padding:2rem;text-align:center;color:var(--text2,#475569)}'
    ].join('');
    document.head.appendChild(el);
  }

  function showDenied(message, returnTo) {
    injectStyles();
    document.body.classList.add('tracker-readonly');
    var main = document.querySelector('.main') || document.body;
    var div = document.createElement('div');
    div.className = 'tracker-readonly-denied';
    div.innerHTML = '<p>' + message + '</p><p style="margin-top:1rem"><a href="' +
      String(returnTo || 'faculty_dashboard.html').replace(/"/g, '&quot;') +
      '">← Back to Faculty Dashboard</a></p>';
    if (main.firstChild) main.insertBefore(div, main.firstChild);
    else main.appendChild(div);
  }

  function applyBanner(teacherName, subjectLabel, returnTo) {
    injectStyles();
    document.body.classList.add('tracker-readonly');
    var label = teacherName || 'this teacher';
    var banner = document.createElement('div');
    banner.className = 'tracker-readonly-banner';
    banner.innerHTML =
      '<span><strong>Read-only view</strong> — viewing <strong>' + escHtml(label) + '</strong>\'s ' +
      escHtml(subjectLabel || 'tracker') + '. Changes are not saved.</span>' +
      '<a href="' + escAttr(returnTo) + '">← Back to dashboard</a>';
    var main = document.querySelector('.main');
    if (main) main.insertBefore(banner, main.firstChild);
    var indicator = document.getElementById('storage-indicator');
    if (indicator) {
      indicator.innerHTML = '<span style="color:#93c5fd;font-weight:600">● Read-only</span>';
      indicator.title = 'Viewing another staff member\'s tracker — read only';
    }
  }

  function escHtml(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function escAttr(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }

  var params = parseParams();
  var configured = !!params.userId;

  window.__trackerReadonly = {
    active: false,
    userId: params.userId || null,
    teacherName: params.teacherName || '',
    returnTo: params.returnTo,
    dataType: null
  };

  window.TrackerReadonlyView = {
    isConfigured: function() {
      return configured;
    },

    isActive: function() {
      return !!(window.__trackerReadonly && window.__trackerReadonly.active);
    },

    block: function() {
      if (!this.isActive()) return false;
      if (typeof window.toast === 'function') {
        window.toast('Read-only view — changes are not saved');
      }
      return true;
    },

    loadInto: function(state, dataType) {
      var self = this;
      window.__trackerReadonly.dataType = dataType;
      if (!configured) {
        return Promise.resolve(false);
      }
      function attemptLoad() {
        if (!canViewSchoolTracking()) {
          showDenied('You do not have permission to view other staff trackers.', params.returnTo);
          return Promise.resolve(false);
        }
        if (!window.DataService || typeof DataService.getForUser !== 'function') {
          showDenied('Cloud data is not available.', params.returnTo);
          return Promise.resolve(false);
        }
        return DataService.getForUser(params.userId, dataType).then(function(data) {
          if (data && state) Object.assign(state, data);
          window.__trackerReadonly.active = true;
          var profileP = window.DataService.getProfileByUserId
            ? DataService.getProfileByUserId(params.userId)
            : Promise.resolve(null);
          return profileP.then(function(profile) {
            if (profile) {
              var dn = profile.display_name != null ? String(profile.display_name).trim() : '';
              window.__trackerReadonly.teacherName = dn || profile.email || params.teacherName || 'Staff member';
            } else if (!window.__trackerReadonly.teacherName) {
              window.__trackerReadonly.teacherName = params.teacherName || 'Staff member';
            }
            return true;
          }).catch(function() { return true; });
        }).catch(function() {
          showDenied('Could not load this teacher\'s tracker data.', params.returnTo);
          return false;
        });
      }
      if (window.__authReady) return attemptLoad();
      return new Promise(function(resolve) {
        window.addEventListener('auth-guard-ready', function() {
          attemptLoad().then(resolve);
        }, { once: true });
        setTimeout(function() {
          if (!window.__authReady) attemptLoad().then(resolve);
        }, 2500);
      });
    },

    applyUI: function(subjectLabel) {
      if (!this.isActive()) return;
      applyBanner(
        window.__trackerReadonly.teacherName || params.teacherName,
        subjectLabel,
        window.__trackerReadonly.returnTo || params.returnTo
      );
    },

    boot: function(options) {
      var opts = options || {};
      var dataType = opts.dataType;
      var subjectLabel = opts.subjectLabel || 'tracker';
      var state = opts.state;
      var syncClasses = opts.syncClasses;
      var afterLoad = opts.afterLoad;
      var onReady = opts.onReady || function() {};

      function finish(ok) {
        if (ok && typeof afterLoad === 'function') afterLoad(state);
        if (window.TrackerReadonlyView.isActive()) {
          window.TrackerReadonlyView.applyUI(subjectLabel);
        } else if (typeof syncClasses === 'function') {
          return syncClasses();
        }
        return Promise.resolve();
      }

      var loadP = configured
        ? window.TrackerReadonlyView.loadInto(state, dataType)
        : (typeof opts.loadOwn === 'function' ? opts.loadOwn() : Promise.resolve(true));

      return loadP.then(finish).then(onReady);
    }
  };
})();
