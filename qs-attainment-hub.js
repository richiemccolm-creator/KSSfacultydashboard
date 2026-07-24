/**
 * Hub bridge for QS Attainment Dashboard: year switcher + Save to Hub.
 * Requires QsAttainmentService and window.QSAttainment (exposed by the dashboard).
 */
(function () {
  var Svc = null;
  var statusEl = null;
  var barStatusEl = null;
  var libraryEl = null;
  var chipsEl = null;
  var saveBtn = null;
  var deleteBtn = null;
  var newYearBtn = null;
  var currentCloudYear = null;
  var savedRows = [];
  var booted = false;
  var openingYear = null;

  function $(id) {
    return document.getElementById(id);
  }

  function fmtDate(iso) {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return String(iso);
    }
  }

  function setStatus(msg, kind) {
    var cls = 'qs-hub-status' + (kind ? ' qs-hub-status--' + kind : '');
    if (statusEl) {
      statusEl.textContent = msg || '';
      statusEl.className = cls;
    }
    if (barStatusEl) {
      barStatusEl.textContent = msg || '';
      barStatusEl.className = 'qs-year-bar-status' + (kind ? ' qs-hub-status--' + kind : '');
    }
  }

  function canManage() {
    return Svc && Svc.canManage && Svc.canManage();
  }

  function syncManagerUi() {
    var manage = canManage();
    if (saveBtn) saveBtn.classList.toggle('hidden', !manage);
    if (deleteBtn) deleteBtn.classList.toggle('hidden', !manage || !currentCloudYear);
    document.querySelectorAll('.qs-hub-manage-only').forEach(function (el) {
      el.classList.toggle('hidden', !manage);
    });
  }

  function payloadFromState() {
    var api = window.QSAttainment;
    if (!api || !api.getPayload) return null;
    return api.getPayload();
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function highlightYears() {
    document.querySelectorAll('.qs-hub-year[data-year], .qs-year-chip[data-year]').forEach(function (el) {
      el.classList.toggle('on', el.getAttribute('data-year') === currentCloudYear);
    });
  }

  function applySnapshot(row) {
    var api = window.QSAttainment;
    if (!api || !api.loadFromCloud) return;
    var data = (row && row.data) || {};
    currentCloudYear = row.school_year;
    window.__qsLoadingFromCloud = true;
    try {
      api.loadFromCloud({
        rows: data.rows || [],
        comps: data.comps || [],
        school: data.school || [],
        filename: data.filename || (row.metadata && row.metadata.filename) || row.school_year,
        sheetName: data.sheetName || '',
        session: data.session || row.session_label || Svc.toSessionLabel(row.school_year),
        preResults: !!data.preResults,
        compReport: data.compReport || null
      });
    } finally {
      window.__qsLoadingFromCloud = false;
    }
    var meta = row.metadata || {};
    var banner = $('hubCloudBanner');
    if (banner) {
      banner.classList.remove('hidden');
      banner.innerHTML =
        'Saved in Faculty Hub · <b>' +
        escapeHtml(row.school_year) +
        '</b> · ' +
        (meta.pupil_count != null ? meta.pupil_count + ' pupils · ' : '') +
        'updated ' +
        escapeHtml(fmtDate(row.updated_at || row.created_at)) +
        ' · use the Years bar to switch sessions';
    }
    highlightYears();
    syncManagerUi();
    setStatus('Loaded ' + row.school_year + ' from the hub.', 'ok');
  }

  function renderLibrary(rows) {
    if (!libraryEl) return;
    if (!rows || !rows.length) {
      libraryEl.innerHTML =
        '<div class="qs-hub-empty">No saved sessions yet. Upload a workbook, set the exam session, then Save to Hub.</div>';
      return;
    }
    libraryEl.innerHTML = rows
      .map(function (r) {
        var meta = r.metadata || {};
        var pupils = meta.pupil_count != null ? meta.pupil_count + ' pupils' : '—';
        var pre = meta.pre_results ? ' · pre-results' : '';
        return (
          '<button type="button" class="qs-hub-year' +
          (currentCloudYear === r.school_year ? ' on' : '') +
          '" data-year="' +
          escapeHtml(r.school_year) +
          '">' +
          '<span class="qs-hub-year-label">' +
          escapeHtml(r.school_year) +
          '</span>' +
          '<span class="qs-hub-year-meta">' +
          escapeHtml(pupils + pre) +
          '<br>Updated ' +
          escapeHtml(fmtDate(r.updated_at || r.created_at)) +
          '</span></button>'
        );
      })
      .join('');
  }

  function renderChips(rows) {
    if (!chipsEl) return;
    if (!rows || !rows.length) {
      chipsEl.innerHTML = '<span class="qs-year-empty">No saved years yet</span>';
      return;
    }
    chipsEl.innerHTML = rows
      .map(function (r) {
        var meta = r.metadata || {};
        var label = r.session_label || Svc.toSessionLabel(r.school_year) || r.school_year;
        var title =
          r.school_year +
          (meta.pupil_count != null ? ' · ' + meta.pupil_count + ' pupils' : '') +
          (meta.updated_at || r.updated_at ? ' · updated ' + fmtDate(r.updated_at || r.created_at) : '');
        return (
          '<button type="button" class="qs-year-chip' +
          (currentCloudYear === r.school_year ? ' on' : '') +
          '" data-year="' +
          escapeHtml(r.school_year) +
          '" title="' +
          escapeHtml(title) +
          '">' +
          escapeHtml(label) +
          '</button>'
        );
      })
      .join('');
  }

  function openYear(year) {
    if (!year || openingYear === year) return;
    if (currentCloudYear === year) {
      var app = $('app');
      var hero = $('uploadHero');
      if (app && app.classList.contains('hidden')) {
        // Already this year but on upload screen — reload to show charts
      } else {
        setStatus('Already viewing ' + year + '.', 'ok');
        return;
      }
    }
    openingYear = year;
    setStatus('Opening ' + year + '…');
    chipsEl &&
      chipsEl.querySelectorAll('.qs-year-chip').forEach(function (btn) {
        btn.disabled = true;
      });
    Svc.getSnapshot(year)
      .then(function (row) {
        openingYear = null;
        chipsEl &&
          chipsEl.querySelectorAll('.qs-year-chip').forEach(function (btn) {
            btn.disabled = false;
          });
        if (!row) {
          setStatus('No data found for ' + year, 'err');
          return;
        }
        applySnapshot(row);
        refreshLibrary(year);
      })
      .catch(function (err) {
        openingYear = null;
        chipsEl &&
          chipsEl.querySelectorAll('.qs-year-chip').forEach(function (btn) {
            btn.disabled = false;
          });
        setStatus('Could not open session: ' + ((err && err.message) || err), 'err');
      });
  }

  function refreshLibrary(preferYear) {
    if (!Svc) return Promise.resolve();
    setStatus('Loading saved sessions…');
    return Svc.listSnapshots()
      .then(function (rows) {
        savedRows = rows || [];
        renderLibrary(savedRows);
        renderChips(savedRows);
        setStatus(
          savedRows.length
            ? savedRows.length + ' saved year' + (savedRows.length === 1 ? '' : 's') + ' — click to switch'
            : 'No saved years yet — upload and Save to Hub'
        );
        if (!preferYear && !currentCloudYear && savedRows.length && !window.__SNAPSHOT__) {
          var hero = $('uploadHero');
          if (hero && !hero.classList.contains('hidden')) {
            return Svc.getSnapshot(savedRows[0].school_year).then(function (full) {
              if (full) applySnapshot(full);
            });
          }
        }
        highlightYears();
        return savedRows;
      })
      .catch(function (err) {
        var msg = (err && err.message) || String(err);
        if (/relation .* does not exist|qs_attainment_snapshots/i.test(msg)) {
          setStatus('Cloud table not set up yet — run the qs_attainment_snapshots migration.', 'err');
        } else {
          setStatus('Could not load saved sessions: ' + msg, 'err');
        }
        savedRows = [];
        renderLibrary([]);
        renderChips([]);
      });
  }

  function onLibraryClick(e) {
    var btn = e.target.closest('.qs-hub-year');
    if (!btn) return;
    openYear(btn.getAttribute('data-year'));
  }

  function onChipsClick(e) {
    var btn = e.target.closest('.qs-year-chip');
    if (!btn) return;
    openYear(btn.getAttribute('data-year'));
  }

  function suggestNextSession() {
    if (!Svc) return '';
    if (savedRows && savedRows.length) {
      var latest = savedRows[0].school_year;
      var m = String(latest).match(/^20(\d{2})-(\d{2})$/);
      if (m) {
        var y = parseInt(m[1], 10) + 1;
        return String(y).padStart(2, '0') + '-' + String(y + 1).padStart(2, '0');
      }
    }
    return Svc.toSessionLabel(Svc.guessCurrentSchoolYear());
  }

  function startNewYear() {
    var suggestion = suggestNextSession();
    var api = window.QSAttainment;
    if (!api || !api.showUploadForNewYear) return;
    currentCloudYear = null;
    highlightYears();
    syncManagerUi();
    api.showUploadForNewYear(suggestion);
    setStatus(
      'Set exam session to ' +
        (suggestion || 'the new year') +
        ', upload the workbook, then Save to Hub. Other years stay saved.',
      'ok'
    );
  }

  function saveToHub() {
    if (!canManage()) {
      setStatus('Only faculty heads and admins can save to the hub.', 'err');
      return;
    }
    var payload = payloadFromState();
    if (!payload || !(payload.rows && payload.rows.length)) {
      setStatus('Load or upload data before saving.', 'err');
      return;
    }
    var session =
      payload.session ||
      ($('ySessionBar') && $('ySessionBar').value) ||
      ($('ySession') && $('ySession').value) ||
      '';
    if (!session) {
      var guess = Svc.guessCurrentSchoolYear();
      session = Svc.toSessionLabel(guess);
      if (!window.confirm('No exam session detected. Save as ' + guess + '?')) return;
      payload.session = session;
      if (window.QSAttainment && window.QSAttainment.setSession) {
        window.QSAttainment.setSession(session);
      }
    }
    var schoolYear = Svc.toSchoolYear(session);
    var replacing = savedRows.some(function (r) {
      return r.school_year === schoolYear;
    });
    if (
      replacing &&
      !window.confirm(
        'A snapshot for ' +
          schoolYear +
          ' already exists. Save will replace that year only — other years are unchanged. Continue?'
      )
    ) {
      return;
    }
    setStatus('Saving ' + schoolYear + ' to the hub…');
    if (saveBtn) saveBtn.disabled = true;
    Svc.saveSnapshot({
      school_year: schoolYear,
      session: session,
      data: payload
    })
      .then(function (row) {
        currentCloudYear = row.school_year || schoolYear;
        setStatus(
          'Saved ' + currentCloudYear + ' — switch years anytime from the Years bar.',
          'ok'
        );
        var banner = $('hubCloudBanner');
        if (banner) {
          banner.classList.remove('hidden');
          banner.innerHTML =
            'Saved in Faculty Hub · <b>' +
            escapeHtml(currentCloudYear) +
            '</b> · just now · use the Years bar to switch sessions';
        }
        syncManagerUi();
        return refreshLibrary(currentCloudYear);
      })
      .catch(function (err) {
        setStatus('Save failed: ' + ((err && err.message) || err), 'err');
      })
      .then(function () {
        if (saveBtn) saveBtn.disabled = false;
      });
  }

  function deleteFromHub() {
    if (!canManage() || !currentCloudYear) return;
    if (
      !window.confirm(
        'Delete the saved ' +
          currentCloudYear +
          ' attainment snapshot from the hub? Other years are kept. This cannot be undone.'
      )
    ) {
      return;
    }
    var deleted = currentCloudYear;
    setStatus('Deleting ' + deleted + '…');
    Svc.deleteSnapshot(deleted)
      .then(function () {
        setStatus('Deleted ' + deleted + '.', 'ok');
        currentCloudYear = null;
        var banner = $('hubCloudBanner');
        if (banner) banner.classList.add('hidden');
        syncManagerUi();
        return refreshLibrary().then(function (rows) {
          if (rows && rows.length) openYear(rows[0].school_year);
          else if (window.QSAttainment && window.QSAttainment.showUploadForNewYear) {
            window.QSAttainment.showUploadForNewYear('');
          }
        });
      })
      .catch(function (err) {
        setStatus('Delete failed: ' + ((err && err.message) || err), 'err');
      });
  }

  function onDataLoaded() {
    if (!window.__qsLoadingFromCloud) {
      currentCloudYear = null;
      var banner = $('hubCloudBanner');
      if (banner) {
        banner.classList.remove('hidden');
        banner.innerHTML =
          'Local workbook loaded — <b>not saved to the hub yet</b>. Check <b>Save as</b> in the Years bar, then Save to Hub. Other years stay intact.';
      }
      highlightYears();
    }
    syncManagerUi();
    if (canManage() && saveBtn && !window.__qsLoadingFromCloud) {
      setStatus('Data ready — confirm the year in Save as, then Save to Hub.', 'ok');
    }
  }

  function boot() {
    if (booted) return;
    booted = true;
    Svc = window.QsAttainmentService;
    statusEl = $('qsHubStatus');
    barStatusEl = $('qsYearBarStatus');
    libraryEl = $('qsHubLibrary');
    chipsEl = $('qsYearChips');
    saveBtn = $('btnSaveHub');
    deleteBtn = $('btnDeleteHub');
    newYearBtn = $('btnNewYear');

    if (libraryEl) libraryEl.addEventListener('click', onLibraryClick);
    if (chipsEl) chipsEl.addEventListener('click', onChipsClick);
    if (saveBtn) saveBtn.addEventListener('click', saveToHub);
    if (deleteBtn) deleteBtn.addEventListener('click', deleteFromHub);
    if (newYearBtn) newYearBtn.addEventListener('click', startNewYear);

    if (window.QSAttainment && window.QSAttainment.onDataLoaded) {
      window.QSAttainment.onDataLoaded(onDataLoaded);
    }

    syncManagerUi();

    if (!Svc) {
      setStatus('Cloud service not loaded.', 'err');
      return;
    }

    refreshLibrary();
  }

  function start() {
    function tryBoot() {
      if (window.QsAttainmentService && window.QSAttainment) boot();
      else if (window.__authReady && window.QsAttainmentService) boot();
    }
    window.addEventListener('auth-guard-ready', tryBoot);
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', tryBoot);
    } else {
      tryBoot();
    }
    setTimeout(tryBoot, 600);
  }

  start();
})();
