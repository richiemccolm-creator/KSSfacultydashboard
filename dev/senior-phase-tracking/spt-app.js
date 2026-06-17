/**
 * Senior Phase Tracking — development preview UI (local only).
 */
(function() {
  'use strict';

  var state = {
    route: 'dashboard',
    setupTab: 'profile',
    courseId: null,
    classId: null,
    unassignedOnly: false,
    reportId: null,
    filters: {},
    setupTeacherId: null,
    setupClassId: null,
    hubStaff: [],
    hubStaffStatus: 'idle',
    hubStaffError: null,
    hubStaffDiagnostics: null,
    currentHubUser: null,
    hubStaffMessage: null,
    setupMessage: null,
    importStep: 1,
    importSource: null,
    importPreview: null,
    templatePreview: null,
    templateRows: null,
    importFilename: null,
    importMessage: null,
    importMapping: null,
    importRaw: null,
    modal: null,
    navCollapsed: false
  };

  function loadNavCollapsed() {
    try { return localStorage.getItem('spt-nav-collapsed') === '1'; } catch (e) { return false; }
  }

  function setNavCollapsed(collapsed) {
    state.navCollapsed = !!collapsed;
    try { localStorage.setItem('spt-nav-collapsed', state.navCollapsed ? '1' : '0'); } catch (e) {}
    syncLayoutClasses();
    updateNavToggleUi();
  }

  function syncLayoutClasses() {
    document.body.classList.toggle('nav-collapsed', state.navCollapsed);
    document.body.classList.toggle('tracking-focus', state.route === 'course');
    document.body.classList.toggle('dashboard-compact', state.route === 'dashboard');
  }

  function updateNavToggleUi() {
    var btn = document.getElementById('nav-toggle');
    var label = document.getElementById('nav-toggle-label');
    var inline = document.getElementById('nav-toggle-inline');
    if (btn) {
      btn.setAttribute('aria-pressed', state.navCollapsed ? 'true' : 'false');
      btn.title = state.navCollapsed ? 'Show navigation (N)' : 'Hide navigation (N)';
    }
    if (label) label.textContent = state.navCollapsed ? 'Show menu' : 'Hide menu';
    if (inline) {
      inline.textContent = state.navCollapsed ? 'Show menu' : 'Hide menu';
      inline.title = state.navCollapsed ? 'Show navigation (N)' : 'Hide navigation (N)';
    }
  }

  function initLayoutControls() {
    state.navCollapsed = loadNavCollapsed();
    syncLayoutClasses();
    updateNavToggleUi();
    document.addEventListener('click', function(e) {
      var toggle = e.target.closest('#nav-toggle, #nav-toggle-inline');
      if (toggle) {
        e.preventDefault();
        setNavCollapsed(!state.navCollapsed);
        return;
      }
      if (e.target.closest('#nav-edge-open')) {
        e.preventDefault();
        setNavCollapsed(false);
      }
    });
    document.addEventListener('keydown', function(e) {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT')) return;
      if (e.key === 'n' || e.key === 'N') setNavCollapsed(!state.navCollapsed);
    });
  }

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : s;
    return d.innerHTML;
  }

  function badge(status) {
    var cls = (SptConfig.BADGE_CLASS[status] || 'badge-grey');
    return '<span class="badge ' + cls + '">' + esc(status) + '</span>';
  }

  function sheetPanel(title, meta, hint, tableInner, toolbarExtra, aboveGrid) {
    return '<div class="sheet-panel">' +
      '<div class="sheet-toolbar">' +
      '<div class="sheet-toolbar-left"><h2>' + esc(title) + '</h2>' +
      (meta ? '<span>' + esc(meta) + '</span>' : '') + '</div>' +
      '<div class="sheet-toolbar-right">' +
      (toolbarExtra || '') +
      (hint ? '<span class="sheet-hint">' + esc(hint) + '</span>' : '') +
      '</div></div>' +
      (aboveGrid || '') +
      '<div class="sheet-grid-wrap">' + tableInner + '</div></div>';
  }

  function db() { return SptStore.ensure(); }
  function role() { return SptStore.getRole(db()); }

  function openModal(title, bodyHtml, footHtml) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = bodyHtml;
    document.getElementById('modal-foot').innerHTML = footHtml || '';
    document.getElementById('modal-backdrop').classList.add('open');
    document.getElementById('app-modal').classList.add('open');
    document.getElementById('app-modal').hidden = false;
  }

  function closeModal() {
    document.getElementById('modal-backdrop').classList.remove('open');
    document.getElementById('app-modal').classList.remove('open');
    document.getElementById('app-modal').hidden = true;
    state.modal = null;
  }

  function updateNavBadge() {
    var n = SptConcerns.openFlagCount(db());
    var btn = document.getElementById('nav-alerts');
    if (!btn) return;
    var base = 'Alerts';
    btn.textContent = n ? base + ' (' + n + ')' : base;
  }

  function setRoute(route, params) {
    params = params || {};
    state.route = route;
    if (route === 'course') {
      state.courseId = params.courseId || null;
      state.classId = params.classId || null;
      state.unassignedOnly = !!params.unassignedOnly;
    } else {
      state.courseId = null;
      state.classId = null;
      state.unassignedOnly = false;
    }
    state.reportId = params.reportId || null;
    if (route === 'import') {
      state.importStep = 1;
      state.importSource = null;
      state.importPreview = null;
      state.templatePreview = null;
      state.templateRows = null;
      state.importFilename = null;
    }
    document.querySelectorAll('.nav-btn').forEach(function(btn) {
      var r = btn.getAttribute('data-route');
      btn.classList.toggle('active', r === route || (route === 'course' && r === 'courses'));
    });
    var setupNav = document.getElementById('nav-setup');
    if (setupNav) setupNav.style.display = role().canSetup ? '' : 'none';
    render();
    updateNavBadge();
    if (params.enrolmentId) openDrawer(params.enrolmentId);
  }

  function alertStripHtml() {
    var n = SptConcerns.openFlagCount(db());
    if (!n || !role().viewAll) return '';
    return '<div class="alert-strip"><strong>' + n + ' open teacher concern' + (n !== 1 ? 's' : '') + ' require your attention</strong>' +
      '<button type="button" class="linkish" data-route="alerts">View alerts</button></div>';
  }

  function gettingStartedHtml(d) {
    if (SptConfig.useSeedData || (d.enrolments || []).length) return '';
    if (!role().canSetup) {
      return '<div class="getting-started getting-started--readonly">' +
        '<h2>No tracking data yet</h2>' +
        '<p>Your faculty head will set up teachers, classes, and pupil enrolments. You will then see your classes on <button type="button" class="linkish" data-route="courses">Enter tracking</button>.</p>' +
        '</div>';
    }
    var step = !(d.teachers || []).length ? 1 : !(d.classes || []).length ? 2 : 3;
    return '<div class="getting-started">' +
      '<div class="getting-started-badge">Blank workbook</div>' +
      '<h2>Set up Senior Phase tracking</h2>' +
      '<p>Add your faculty team, create senior phase classes, and enrol pupils. Course templates are ready — you start with zero pupils.</p>' +
      '<ol class="getting-started-steps">' +
      '<li class="' + (step === 1 ? 'is-current' : (step > 1 ? 'is-done' : '')) + '"><strong>Import teachers</strong> — sync staff signed up for the Faculty Hub</li>' +
      '<li class="' + (step === 2 ? 'is-current' : (step > 2 ? 'is-done' : '')) + '"><strong>Create classes</strong> — link each teacher to a course and class name</li>' +
      '<li class="' + (step === 3 ? 'is-current' : '') + '"><strong>Enrol pupils</strong> — add pupils to each class, then enter tracking</li>' +
      '</ol>' +
      '<button type="button" class="btn" data-route="setup">Open setup</button></div>';
  }

  function maybeBootstrapRoute() {
    if (SptConfig.useSeedData) return;
    var d = db();
    if (state.route !== 'dashboard') return;
    if (!(d.teachers || []).length && role().canSetup) {
      state.route = 'setup';
      document.querySelectorAll('.nav-btn').forEach(function(btn) {
        btn.classList.toggle('active', btn.getAttribute('data-route') === 'setup');
      });
    }
  }

  function entryGuideHtml(variant) {
    var r = role();
    if (!r.canEdit && !r.canEditBaseline) {
      return '<div class="entry-guide entry-guide-readonly"><strong>Read-only view</strong> — tracking data is entered by class teachers on <button type="button" class="linkish" data-route="courses">Enter tracking</button> course sheets.</div>';
    }
    if (variant === 'dashboard') {
      return '';
    }
    if (variant === 'courses-list') {
      var admin = r.canEditBaseline ? ' · bulk S3 baseline in Setup' : '';
      return '<div class="entry-guide entry-guide-inline">Open your <strong>class sheet</strong> to record attendance, effort, behaviour, S3 baseline, prelims, evidence &amp; flags' + admin + '</div>';
    }
    if (variant === 'course') {
      var bits = 'Attendance · effort · behaviour · S3 exam (mark → % → grade) · prior exam &amp; pathway (H/AH) · level change · withdraw · prelims · evidence · flags';
      bits += ' · <strong>Add pupil</strong> / <strong>Remove</strong> for roster';
      return '<div class="entry-guide entry-guide-inline">' + bits + '</div>';
    }
    if (variant === 'evidence') {
      return '<div class="entry-guide entry-guide-inline"><strong>Unit evidence</strong> — same as course sheet, pupil-by-pupil · also editable on <button type="button" class="linkish" data-route="courses">Enter tracking</button></div>';
    }
    return '';
  }

  function applyFilters(rows) {
    var f = state.filters;
    return rows.filter(function(r) {
      if (f.course && r.course.id !== f.course) return false;
      if (f.teacher && r.enrolment.teacher_id !== f.teacher) return false;
      if (f.year && r.pupil.year_group !== f.year) return false;
      if (f.risk && r.enrolment.risk_status !== f.risk) return false;
      if (f.flagged === 'yes' && !r.open_flag_count) return false;
      if (f.evidence === 'missing' && !r.evidence_missing_count) return false;
      return true;
    });
  }

  function getEvidenceBankRows(d) {
    return (d.enrolments || []).filter(function(en) {
      if (en.active_status === false) return false;
      if (!SptStore.canViewEnrolment(d, en)) return false;
      var course = SptStore.byId(d.courses, en.course_id);
      return SptEvidence.usesEvidenceBank(course, en);
    }).map(function(en) {
      return {
        enrolment: en,
        pupil: SptStore.byId(d.pupils, en.pupil_id),
        course: SptStore.byId(d.courses, en.course_id),
        evidence_rows: SptEvidence.evidenceForEnrolment(d, en.id)
      };
    }).sort(function(a, b) {
      return SptStore.pupilName(d, a.enrolment.pupil_id).localeCompare(SptStore.pupilName(d, b.enrolment.pupil_id));
    });
  }

  function applyEvidenceEnrolmentFilters(rows) {
    var f = state.filters;
    return rows.filter(function(row) {
      if (f.course && row.course.id !== f.course) return false;
      if (f.teacher && row.enrolment.teacher_id !== f.teacher) return false;
      if (f.year && (!row.pupil || row.pupil.year_group !== f.year)) return false;
      if (f.risk && row.enrolment.risk_status !== f.risk) return false;
      if (f.evidenceStatus && !row.evidence_rows.some(function(ev) { return ev.evidence_status === f.evidenceStatus; })) return false;
      if (f.evidence === 'missing' && !row.evidence_rows.some(function(ev) {
        var s = ev.evidence_status;
        return s === 'Missing' || s === 'Not Started' || s === 'Needs Rework';
      })) return false;
      return true;
    });
  }

  function dashboardRowsForTeacherFilter(rows) {
    var f = state.filters;
    return rows.filter(function(r) {
      if (f.course && r.course.id !== f.course) return false;
      if (f.year && r.pupil.year_group !== f.year) return false;
      if (f.risk && r.enrolment.risk_status !== f.risk) return false;
      if (f.flagged === 'yes' && !r.open_flag_count) return false;
      if (f.evidence === 'missing' && !r.evidence_missing_count) return false;
      return true;
    });
  }

  function evidenceRowsForTeacherFilter(rows) {
    var f = state.filters;
    return rows.filter(function(row) {
      if (f.course && row.course.id !== f.course) return false;
      if (f.year && (!row.pupil || row.pupil.year_group !== f.year)) return false;
      if (f.risk && row.enrolment.risk_status !== f.risk) return false;
      if (f.evidenceStatus && !row.evidence_rows.some(function(ev) {
        return ev.evidence_status === f.evidenceStatus;
      })) return false;
      if (f.evidence === 'missing' && !row.evidence_rows.some(function(ev) {
        var s = ev.evidence_status;
        return s === 'Missing' || s === 'Not Started' || s === 'Needs Rework';
      })) return false;
      return true;
    });
  }

  function teachersForFilterBar(d, rows) {
    var ids = {};
    rows.forEach(function(r) {
      var tid = r.enrolment && r.enrolment.teacher_id;
      if (tid) ids[tid] = true;
    });
    return (d.teachers || []).filter(function(t) { return ids[t.id]; }).sort(function(a, b) {
      var an = (a.surname || '') + ', ' + (a.first_name || '');
      var bn = (b.surname || '') + ', ' + (b.first_name || '');
      return an.localeCompare(bn);
    });
  }

  function sanitizeTeacherFilter(teacherList) {
    if (state.filters.teacher && !teacherList.some(function(t) { return t.id === state.filters.teacher; })) {
      delete state.filters.teacher;
    }
  }

  function filtersHtml(d, extra, teachers) {
    var teacherList = teachers || d.teachers || [];
    return '<div class="filters-bar">' +
      '<div class="filter-field"><label>Course</label><select data-filter="course"><option value="">All</option>' +
      d.courses.map(function(c) { return '<option value="' + c.id + '">' + esc(c.course_name) + '</option>'; }).join('') +
      '</select></div>' +
      '<div class="filter-field"><label>Teacher</label><select data-filter="teacher"><option value="">All</option>' +
      teacherList.map(function(t) { return '<option value="' + t.id + '">' + esc(t.first_name + ' ' + t.surname) + '</option>'; }).join('') +
      '</select></div>' +
      '<div class="filter-field"><label>Year</label><select data-filter="year"><option value="">All</option>' +
      SptConfig.SENIOR_YEAR_GROUPS.map(function(y) { return '<option value="' + y + '">' + y + '</option>'; }).join('') +
      '</select></div>' +
      '<div class="filter-field"><label>Risk</label><select data-filter="risk"><option value="">All</option>' +
      SptConfig.STATUS.risk.map(function(s) { return '<option value="' + s + '">' + s + '</option>'; }).join('') +
      '</select></div>' + (extra || '') + '</div>';
  }

  function canEditBaseline() {
    return role().canEditBaseline;
  }

  function canManageEnrolment(en) {
    if (!role().canEdit) return false;
    if (role().viewAll) return true;
    return en.teacher_id === db().simulated_teacher_id;
  }

  function courseShowsTeacherColumn(d, courseId, enrolments) {
    if (role().viewAll && role().canEdit) return true;
    var teacherIds = {};
    enrolments.forEach(function(r) { teacherIds[r.enrolment.teacher_id] = true; });
    return Object.keys(teacherIds).length > 1 || SptStore.classesForCourse(d, courseId).length > 1;
  }

  function levelCellHtml(r, course) {
    var en = r.enrolment;
    var lc = r.level_change;
    var d = db();
    var applied = (d.level_changes || []).filter(function(l) {
      return l.enrolment_id === en.id && l.change_type === 'level' && l.current_status === 'Completed';
    }).sort(function(a, b) {
      return (b.date_completed || '').localeCompare(a.date_completed || '');
    })[0];
    var html = '<td class="cell-level">';
    if (lc && SptLevelChange.isPending(lc)) {
      if (lc.change_type === 'withdrawal') {
        html += '<span class="level-current">' + esc(en.current_level) + '</span> ' + badge('Withdrawal pending');
      } else {
        html += '<span class="level-current">' + esc(en.current_level) + '</span>';
        html += ' <span class="level-arrow">→</span> <span class="level-pending">' + esc(lc.recommended_level) + '</span>';
        html += ' ' + badge(lc.current_status);
      }
    } else {
      html += '<span class="level-current">' + esc(en.current_level) + '</span>';
      if (applied && applied.original_level !== en.current_level) {
        html += ' <span class="level-applied" title="Changed from ' + esc(applied.original_level) +
          (applied.date_completed ? ' on ' + applied.date_completed : '') + '">✓ changed</span>';
      }
    }
    return html + '</td>';
  }

  function cellNa() { return '<td class="cell-na">—</td>'; }

  function tpBandClass(i) {
    return 'tp-col tp-col-' + ((i % 3) + 1);
  }

  function tpStartClass(i) {
    return i > 0 ? ' tp-start' : '';
  }

  function tpColAttrs(i, extra) {
    var cls = tpBandClass(i) + tpStartClass(i);
    if (extra) cls += ' ' + extra;
    return ' class="' + cls + '"';
  }

  function formatTpShortDate(dateStr) {
    if (!dateStr) return '';
    var parts = dateStr.split('-');
    if (parts.length < 3) return dateStr;
    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[parseInt(parts[1], 10) - 1] + ' \'' + parts[0].slice(2);
  }

  function trackingScoreClass(val) {
    if (val === '' || val == null) return 'score-empty';
    var n = parseInt(val, 10);
    return (SptConfig.TRACKING_SCORE_CLASS[n] || 'score-empty');
  }

  function trackingScoreLabel(val) {
    var n = parseInt(val, 10);
    return SptConfig.ATTENDANCE_LABELS[n] || '';
  }

  function scorePillHtml(val) {
    if (val === '' || val == null) return '—';
    var cls = trackingScoreClass(val);
    var lbl = trackingScoreLabel(val);
    return '<span class="score-pill ' + cls + '"' + (lbl ? ' title="' + esc(lbl) + '"' : '') + '>' + esc(val) + '</span>';
  }

  function scoreSelectHtml(val, dataAttr) {
    var cls = 'inline-select score-select ' + trackingScoreClass(val);
    var opts = '<option value="">—</option>' + [1, 2, 3, 4].map(function(n) {
      var lbl = trackingScoreLabel(n);
      return '<option value="' + n + '"' + (val === n ? ' selected' : '') + (lbl ? ' title="' + lbl + '"' : '') + '>' + n + '</option>';
    }).join('');
    return '<select class="' + cls + '" ' + dataAttr + '>' + opts + '</select>';
  }

  function applyScoreSelectColor(el) {
    el.classList.remove('score-1', 'score-2', 'score-3', 'score-4', 'score-empty');
    el.classList.add(trackingScoreClass(el.value));
  }

  function sheetEnrolmentIdsFromButton(btn) {
    var raw = btn.getAttribute('data-tp-enrolments') || '';
    return raw.split(',').map(function(id) { return id.trim(); }).filter(Boolean);
  }

  function updateTpScoreSelects(enrolmentId, tpId, score) {
    var attSel = document.querySelector('[data-att="' + enrolmentId + '|' + tpId + '"]');
    if (attSel) {
      attSel.value = String(score);
      applyScoreSelectColor(attSel);
    }
    ['effort', 'behaviour'].forEach(function(field) {
      var sel = document.querySelector('[data-tracking="' + enrolmentId + '|' + tpId + '|' + field + '"]');
      if (sel) {
        sel.value = String(score);
        applyScoreSelectColor(sel);
      }
    });
  }

  function applyDefaultTpScores(tpId, enrolmentIds) {
    if (!role().canEdit || !enrolmentIds.length) return;
    var d = db();
    var score = 4;
    enrolmentIds.forEach(function(enId) {
      SptStore.upsertAttendance(d, enId, tpId, score);
      SptStore.upsertTrackingScore(d, enId, tpId, 'effort', score);
      SptStore.upsertTrackingScore(d, enId, tpId, 'behaviour', score);
      updateTpScoreSelects(enId, tpId, score);
      updateEnrolmentRiskCell(enId);
    });
  }

  function updateS3BaselineInputs(enrolmentId) {
    var b = SptBaseline.baselineForEnrolment(db(), enrolmentId);
    if (!b) return;
    ['effort', 'behaviour', 'homelearning', 'progress'].forEach(function(field) {
      var sel = document.querySelector('[data-baseline="' + enrolmentId + '|' + field + '"]');
      if (sel && b[field] != null && b[field] !== '') {
        sel.value = String(b[field]);
        applyScoreSelectColor(sel);
      }
    });
    var cfe = document.querySelector('[data-baseline="' + enrolmentId + '|cfe_level"]');
    if (cfe && b.cfe_level) cfe.value = b.cfe_level;
  }

  function applyDefaultS3BaselineScores(enrolmentIds) {
    if (!enrolmentIds.length || !canEditBaselineField('effort')) return;
    var d = db();
    var patch = {
      effort: 4,
      behaviour: 4,
      homelearning: 4,
      progress: 4,
      cfe_level: 'Fourth'
    };
    enrolmentIds.forEach(function(enId) {
      SptStore.upsertBaseline(d, enId, patch);
      updateS3BaselineInputs(enId);
      updateEnrolmentRiskCell(enId);
    });
  }

  function showDefaultS3BaselineModal(enrolmentIds) {
    if (!enrolmentIds.length || !canEditBaselineField('effort')) return;
    var count = enrolmentIds.length;
    openModal('Default S3 baseline scores',
      '<div class="modal-note tp-default-modal">' +
      '<p>This will set S3 entry baseline scores for all <strong>' + count + '</strong> National course pupil' +
      (count !== 1 ? 's' : '') + ' on this sheet:</p>' +
      '<ul>' +
      '<li><strong>Effort</strong>, <strong>Behaviour</strong>, <strong>Home learning</strong>, and <strong>Progress</strong> → <strong>4 (Good)</strong></li>' +
      '<li><strong>CfE level</strong> → <strong>Fourth</strong> (the expected strong entry level for senior phase)</li>' +
      '</ul>' +
      '<p><strong>What this means:</strong></p>' +
      '<ul>' +
      '<li>Score <strong>4</strong> = good / no concern for each category</li>' +
      '<li>Existing Eff, Beh, HL, Prog, and CfE values will be <strong>replaced</strong></li>' +
      '<li><strong>S3 exam mark</strong> is not changed — enter exam marks separately in the Mark column</li>' +
      '<li>After applying, adjust individual pupils who need lower scores or a different CfE level</li>' +
      '</ul></div>',
      '<button type="button" class="btn btn-secondary" id="modal-cancel">Cancel</button>' +
      '<button type="button" class="btn" id="s3-baseline-default-confirm">Apply default 4</button>');
    document.getElementById('s3-baseline-default-confirm').onclick = function() {
      applyDefaultS3BaselineScores(enrolmentIds);
      closeModal();
    };
    document.getElementById('modal-cancel').onclick = closeModal;
  }

  function showDefaultTpModal(tpId, tpLabel, tpDate, enrolmentIds) {
    if (!role().canEdit || !enrolmentIds.length) return;
    var count = enrolmentIds.length;
    var dateNote = tpDate ? ' (' + formatTpShortDate(tpDate) + ')' : '';
    openModal('Default scores — ' + tpLabel + dateNote,
      '<div class="modal-note tp-default-modal">' +
      '<p>This will set <strong>Attendance</strong>, <strong>Effort</strong>, and <strong>Behaviour</strong> to ' +
      '<strong>4 (Good)</strong> for all <strong>' + count + '</strong> pupil' + (count !== 1 ? 's' : '') +
      ' on this class sheet.</p>' +
      '<p><strong>What this means:</strong></p>' +
      '<ul>' +
      '<li>Score <strong>4</strong> = good / no concern (attendance acceptable, effort good, behaviour good)</li>' +
      '<li>Any existing Att, Eff, or Beh scores for this tracking period will be <strong>replaced</strong></li>' +
      '<li>After applying, change individual pupils who need a lower score (1–3)</li>' +
      '<li>Risk status will update based on the scores entered — all 4s typically show as on track (Green)</li>' +
      '</ul></div>',
      '<button type="button" class="btn btn-secondary" id="modal-cancel">Cancel</button>' +
      '<button type="button" class="btn" id="tp-default-confirm">Apply default 4</button>');
    document.getElementById('tp-default-confirm').onclick = function() {
      applyDefaultTpScores(tpId, enrolmentIds);
      closeModal();
    };
    document.getElementById('modal-cancel').onclick = closeModal;
  }

  function bindScoreSelectColors(root) {
    root.querySelectorAll('.score-select').forEach(function(el) {
      applyScoreSelectColor(el);
      el.addEventListener('change', function() { applyScoreSelectColor(el); });
    });
  }

  function captureGridScroll() {
    var main = document.getElementById('app-main');
    return {
      main: main ? { left: main.scrollLeft, top: main.scrollTop } : null,
      wraps: Array.prototype.map.call(document.querySelectorAll('.sheet-grid-wrap'), function(el) {
        return { left: el.scrollLeft, top: el.scrollTop };
      })
    };
  }

  function restoreGridScroll(positions) {
    if (!positions) return;
    requestAnimationFrame(function() {
      if (positions.main) {
        var main = document.getElementById('app-main');
        if (main) {
          main.scrollLeft = positions.main.left;
          main.scrollTop = positions.main.top;
        }
      }
      var wraps = document.querySelectorAll('.sheet-grid-wrap');
      (positions.wraps || []).forEach(function(pos, i) {
        if (!wraps[i]) return;
        wraps[i].scrollLeft = pos.left;
        wraps[i].scrollTop = pos.top;
      });
    });
  }

  function prelimPctHtml(summary) {
    if (!summary) return '—';
    return esc(summary.percentage) + '%';
  }

  function prelimGradeHtml(summary) {
    if (!summary || !summary.grade_band) return '—';
    return gradeBandHtml(summary.grade_band);
  }

  function prelimResultHtml(summary, fallbackText) {
    if (summary) {
      return prelimPctHtml(summary) + ' ' + prelimGradeHtml(summary);
    }
    if (fallbackText) return esc(fallbackText);
    return '—';
  }

  function prelimAssessmentForEnrolment(d, enrolmentId) {
    var en = SptStore.byId(d.enrolments, enrolmentId);
    if (!en) return null;
    return (d.assessment_points || []).find(function(ap) {
      return ap.course_id === en.course_id && ap.assessment_type === 'Prelim';
    }) || null;
  }

  function prelimOverridesFromRow(row) {
    var overrides = {};
    if (!row) return overrides;
    row.querySelectorAll('[data-prelim-mark]').forEach(function(inp) {
      var parts = inp.getAttribute('data-prelim-mark').split('|');
      overrides[parts[1]] = inp.value;
    });
    return overrides;
  }

  function updatePrelimResultCell(enrolmentId, overrides) {
    var d = db();
    var prelimAp = prelimAssessmentForEnrolment(d, enrolmentId);
    if (!prelimAp) return;
    var summary = SptPrelim.computeSummary(d, enrolmentId, prelimAp.id, overrides);
    var pctCell = document.querySelector('[data-prelim-pct-for="' + enrolmentId + '"]');
    var gradeCell = document.querySelector('[data-prelim-grade-for="' + enrolmentId + '"]');
    if (pctCell) pctCell.innerHTML = prelimPctHtml(summary);
    if (gradeCell) gradeCell.innerHTML = prelimGradeHtml(summary);
    var legacyCell = document.querySelector('[data-prelim-result-for="' + enrolmentId + '"]');
    if (legacyCell) legacyCell.innerHTML = prelimResultHtml(summary);
  }

  function updateS3ExamDerivedCells(enrolmentId, course) {
    var d = db();
    var b = SptBaseline.baselineForEnrolment(d, enrolmentId);
    var result = SptBaseline.s3ExamResult(b, course);
    var pctEl = document.querySelector('[data-s3-pct-for="' + enrolmentId + '"]');
    var gradeEl = document.querySelector('[data-s3-grade-for="' + enrolmentId + '"]');
    if (pctEl) pctEl.textContent = result ? result.percentage + '%' : '—';
    if (gradeEl) gradeEl.innerHTML = result && result.grade ? gradeBandHtml(result.grade) : '—';
  }

  function updateAllS3ExamDerivedCells(courseId) {
    var d = db();
    var course = SptStore.byId(d.courses, courseId);
    document.querySelectorAll('[data-s3-raw]').forEach(function(el) {
      var p = el.getAttribute('data-s3-raw').split('|');
      if (p[0]) updateS3ExamDerivedCells(p[0], course);
    });
  }

  function updateAllPrelimDerivedCells(courseId) {
    var d = db();
    document.querySelectorAll('[data-prelim-mark]').forEach(function(el) {
      var p = el.getAttribute('data-prelim-mark').split('|');
      var row = el.closest('tr');
      updatePrelimResultCell(p[0], prelimOverridesFromRow(row));
    });
  }

  function examSetupIsOpen(courseId) {
    try {
      return localStorage.getItem('spt-exam-setup-' + courseId) === '1';
    } catch (e) {
      return false;
    }
  }

  function examSetupSummaryLine(course, prelimComps, meta) {
    var bits = [];
    if (meta.hasS3) {
      var s3 = SptExamMark.s3ExamMarks(course);
      bits.push('S3 ' + s3.paper_marks + (s3.paper_marks !== s3.scaled_marks ? '→' + s3.scaled_marks : ''));
    }
    (prelimComps || []).forEach(function(pc) {
      var m = SptExamMark.componentMarks(pc);
      var label = SptPrelim.columnLabel(pc);
      bits.push(label + ' ' + m.paper_marks + (m.paper_marks !== m.scaled_marks ? '→' + m.scaled_marks : '') +
        ' (' + m.weighting + '%)');
    });
    return bits.join(' · ');
  }

  function examMarkSetupHtml(course, prelimComps, meta) {
    if (!course) return '';
    var canEditSheet = role().canEdit;
    var rows = '';
    if (meta.hasS3) {
      var s3 = SptExamMark.s3ExamMarks(course);
      rows += examSetupRow({
        label: 'S3 exam',
        paper: s3.paper_marks,
        scaled: s3.scaled_marks,
        weight: '',
        canEdit: canEditSheet,
        s3CourseId: course.id
      });
    }
    (prelimComps || []).forEach(function(pc) {
      var m = SptExamMark.componentMarks(pc);
      rows += examSetupRow({
        label: SptPrelim.columnLabel(pc),
        paper: m.paper_marks,
        scaled: m.scaled_marks,
        weight: m.weighting + '%',
        canEdit: canEditSheet,
        componentId: pc.id
      });
    });
    if (!rows) return '';
    var isOpen = examSetupIsOpen(course.id);
    var summary = examSetupSummaryLine(course, prelimComps, meta);
    return '<div class="exam-setup-panel' + (isOpen ? ' is-open' : ' is-collapsed') + '" data-exam-setup-panel data-exam-setup-course="' + course.id + '">' +
      '<button type="button" class="exam-setup-toggle" data-exam-setup-toggle aria-expanded="' + (isOpen ? 'true' : 'false') + '">' +
      '<span class="exam-setup-toggle-title">Mark setup</span>' +
      '<span class="exam-setup-summary">' + esc(summary) + '</span>' +
      '<span class="exam-setup-chevron" aria-hidden="true"></span></button>' +
      '<div class="exam-setup-body"' + (isOpen ? '' : ' hidden') + '>' +
      '<p class="exam-setup-hint">Paper = marks available; Scaled = how it counts. Lower paper if the full exam was not sat.</p>' +
      '<div class="exam-setup-rows">' + rows + '</div></div></div>';
  }

  function examSetupRow(opts) {
    var weightCell = opts.weight
      ? '<span class="exam-setup-wt">' + esc(opts.weight) + '</span>'
      : '';
    if (!opts.canEdit) {
      return '<div class="exam-setup-row">' +
        '<span class="exam-setup-name">' + esc(opts.label) + '</span>' +
        '<span class="exam-setup-val">Paper ' + esc(opts.paper) + '</span>' +
        '<span class="exam-setup-val">Scaled ' + esc(opts.scaled) + '</span>' +
        weightCell + '</div>';
    }
    if (opts.componentId) {
      return '<div class="exam-setup-row">' +
        '<span class="exam-setup-name">' + esc(opts.label) + '</span>' +
        '<label class="exam-setup-field">Paper<input type="number" class="exam-config-input" min="1" max="500" step="1" ' +
        'data-component-config="' + opts.componentId + '|paper_marks" value="' + opts.paper + '"></label>' +
        '<label class="exam-setup-field">Scaled<input type="number" class="exam-config-input" min="1" max="500" step="1" ' +
        'data-component-config="' + opts.componentId + '|scaled_marks" value="' + opts.scaled + '"></label>' +
        weightCell + '</div>';
    }
    return '<div class="exam-setup-row">' +
      '<span class="exam-setup-name">' + esc(opts.label) + '</span>' +
      '<label class="exam-setup-field">Paper<input type="number" class="exam-config-input" min="1" max="500" step="1" ' +
      'data-s3-exam-config="' + opts.s3CourseId + '|paper_marks" value="' + opts.paper + '"></label>' +
      '<label class="exam-setup-field">Scaled<input type="number" class="exam-config-input" min="1" max="500" step="1" ' +
      'data-s3-exam-config="' + opts.s3CourseId + '|scaled_marks" value="' + opts.scaled + '"></label>' +
      weightCell + '</div>';
  }

  function updateEnrolmentRiskCell(enrolmentId) {
    var en = SptStore.byId(db().enrolments, enrolmentId);
    if (!en) return;
    var anchor = document.querySelector('td.col-pupil[data-enrolment="' + enrolmentId + '"]');
    var row = anchor ? anchor.closest('tr') : document.querySelector('tr[data-enrolment="' + enrolmentId + '"]');
    if (!row) return;
    var riskTd = row.querySelector('.cell-risk');
    if (riskTd) riskTd.innerHTML = badge(en.risk_status);
  }

  function trackingAttCell(enId, tpId, val, canEdit, tpIndex) {
    if (canEdit) {
      return '<td' + tpColAttrs(tpIndex, '') + '>' +
        scoreSelectHtml(val, 'data-att="' + enId + '|' + tpId + '"') + '</td>';
    }
    return '<td' + tpColAttrs(tpIndex, 'cell-num') + '>' + scorePillHtml(val) + '</td>';
  }

  function trackingScoreCell(enId, tpId, field, record, canEdit, tpIndex) {
    var val = SptStore.trackingScoreValue(record, field);
    var cls = tpBandClass(tpIndex);
    if (!canEdit) return '<td class="' + cls + ' cell-num">' + scorePillHtml(val) + '</td>';
    return '<td class="' + cls + '">' +
      scoreSelectHtml(val, 'data-tracking="' + enId + '|' + tpId + '|' + field + '"') + '</td>';
  }

  function canEditBaselineField(field) {
    return canEditBaseline() || role().canEdit;
  }

  function gradeBandHtml(grade) {
    if (!grade) return '';
    return '<span class="grade-band grade-band-' + esc(String(grade).toLowerCase()) + '">' + esc(grade) + '</span>';
  }

  function s3ExamDisplayHtml(b, course) {
    if (!b) return '—';
    return esc(SptBaseline.formatS3ExamDisplay(b, course));
  }

  function s3ExamCells(r, course) {
    var b = r.s3_baseline;
    var enId = r.enrolment.id;
    if (!r.shows_s3_baseline) return cellNa() + cellNa() + cellNa();
    var cfg = SptExamMark.s3ExamMarks(course);
    var result = SptBaseline.s3ExamResult(b, course);
    var raw = b && b.s3_exam_raw != null ? b.s3_exam_raw : '';
    var canEditS3 = canEditBaselineField('s3_exam_raw');
    if (!canEditS3) {
      var rawDisp = raw !== '' ? (raw + '/' + cfg.paper_marks) : '—';
      if (raw !== '' && cfg.paper_marks !== cfg.scaled_marks) rawDisp += ' → ' + cfg.scaled_marks;
      return '<td class="cell-num cell-exam-mark">' + esc(rawDisp) + '</td>' +
        '<td class="cell-num cell-exam-pct">' + esc(result ? result.percentage + '%' : '—') + '</td>' +
        '<td class="cell-grade cell-exam-grade">' + (result && result.grade ? gradeBandHtml(result.grade) : '—') + '</td>';
    }
    var maxAttr = ' max="' + cfg.paper_marks + '"';
    var placeholder = '/' + cfg.paper_marks;
    return '<td class="cell-prelim cell-exam-mark">' +
      '<input type="number" class="prelim-inline s3-exam-raw" min="0"' + maxAttr + ' step="0.5" ' +
      'data-s3-raw="' + enId + '|raw" data-baseline="' + enId + '|s3_exam_raw" ' +
      'value="' + (raw !== '' ? raw : '') + '" placeholder="' + esc(placeholder) + '" ' +
      'title="Raw mark out of ' + cfg.paper_marks + (cfg.paper_marks !== cfg.scaled_marks ? ' (scaled to ' + cfg.scaled_marks + ')' : '') + '"></td>' +
      '<td class="cell-num cell-exam-pct" data-s3-pct-for="' + enId + '">' +
      esc(result ? result.percentage + '%' : '—') + '</td>' +
      '<td class="cell-grade cell-exam-grade" data-s3-grade-for="' + enId + '">' +
      (result && result.grade ? gradeBandHtml(result.grade) : '—') + '</td>';
  }

  function baselineFieldCell(r, field, type) {
    var b = r.s3_baseline;
    var enId = r.enrolment.id;
    if (!r.shows_s3_baseline) return cellNa();
    if (type === 's3_exam') return '';
    var canEdit = canEditBaselineField(field);
    if (!canEdit) {
      var v = b ? b[field] : null;
      if (type === 'score') return '<td class="cell-num">' + scorePillHtml(v != null && v !== '' ? v : '') + '</td>';
      return '<td class="cell-num">' + esc(v != null && v !== '' ? v : '—') + '</td>';
    }
    if (type === 'score') {
      return '<td>' + SptBaseline.scoreSelect(field, enId, b ? b[field] : null, canEdit) + '</td>';
    }
    if (type === 'cfe') {
      var opts = '<option value="">—</option>' + SptConfig.CFE_LEVELS.map(function(l) {
        return '<option value="' + l + '"' + (b && b.cfe_level === l ? ' selected' : '') + '>' + l + '</option>';
      }).join('');
      return '<td><select class="inline-select inline-select-sm" data-baseline="' + enId + '|cfe_level">' + opts + '</select></td>';
    }
    return '<td><input type="text" class="inline-input-sm" data-baseline="' + enId + '|' + field + '" value="' +
      esc(b && b[field] ? b[field] : '') + '" placeholder="—"></td>';
  }

  function priorEntryCells(r, canEdit) {
    if (!r.shows_prior_entry) return cellNa() + cellNa();
    var enId = r.enrolment.id;
    var prior = r.prior_main;
    var grade = prior && prior.result_grade ? prior.result_grade : '';
    var pathway = prior && prior.pathway_status ? prior.pathway_status : '';
    var crashing = r.crashing_subject;
    var crashCls = crashing ? ' cell-crashing-subject' : '';
    if (!canEdit) {
      var pd = r.prior_display;
      return '<td class="cell-grade' + crashCls + '">' + esc(pd.grade) + '</td>' +
        '<td class="cell-prior-pathway' + crashCls + '">' +
        (crashing ? badge('Crashing subject') : badge(pd.pathway)) + '</td>';
    }
    var gradeTitle = crashing ? ' title="No prior qualification at the expected level for this course"' : '';
    var gradeCell = '<td class="cell-grade' + crashCls + '">' +
      '<input type="text" class="inline-input-sm prior-grade-input" data-prior="' + enId + '|result_grade" ' +
      'value="' + esc(grade) + '" placeholder="Grade"' + gradeTitle + '></td>';
    var pathwayOpts = '<option value="">—</option>' + SptConfig.STATUS.pathway.map(function(s) {
      return '<option value="' + esc(s) + '"' + (pathway === s ? ' selected' : '') + '>' + esc(s) + '</option>';
    }).join('');
    var crashBadge = '';
    if (crashing) {
      crashBadge = '<span class="crash-tag">' + badge('Crashing subject') +
        '<button type="button" class="crash-dismiss" data-dismiss-crashing="' + enId + '" ' +
        'title="Remove crashing flag (admin override)">×</button></span> ';
    }
    var pathwayCell = '<td class="cell-prior-pathway' + crashCls + '">' + crashBadge +
      '<select class="inline-select inline-select-sm" data-prior="' + enId + '|pathway_status">' +
      pathwayOpts + '</select></td>';
    return gradeCell + pathwayCell;
  }

  function evidenceUnitCell(r, unitCode, canEdit) {
    if (!r.uses_evidence_bank) return cellNa();
    var ev = r.evidence_rows.find(function(x) { return x.unit_code === unitCode; });
    return '<td>' + SptEvidence.statusCellHtml(ev, canEdit && role().canEdit) + '</td>';
  }

  function courseGridMeta(course, enrolments) {
    var evUnits = [];
    enrolments.forEach(function(r) {
      if (!r.uses_evidence_bank) return;
      SptEvidence.getUnitTemplate(r.course, r.enrolment).forEach(function(u) {
        if (!evUnits.some(function(x) { return x.unit_code === u.unit_code; })) evUnits.push(u);
      });
    });
    return {
      hasS3: enrolments.some(function(r) { return r.shows_s3_baseline; }),
      hasPrior: enrolments.some(function(r) { return r.shows_prior_entry; }),
      evUnits: evUnits,
      hasExamPupils: enrolments.some(function(r) { return r.uses_exam_route; }),
      hasEvPupils: enrolments.some(function(r) { return r.uses_evidence_bank; }),
      mixedClass: enrolments.some(function(r) { return r.shows_s3_baseline; }) &&
        enrolments.some(function(r) { return r.uses_evidence_bank; })
    };
  }

  function summaryCards(rows) {
    var openFlags = rows.filter(function(r) { return r.open_flag_count > 0; }).length;
    var missingEv = rows.filter(function(r) { return r.uses_evidence_bank && r.evidence_missing_count > 0; }).length;
    return [
      { lbl: 'Pupils', val: rows.length, cls: '' },
      { lbl: 'Teacher flags', val: openFlags, cls: openFlags ? 'red' : '' },
      { lbl: 'Not started', val: rows.filter(function(r) { return r.enrolment.risk_status === 'Grey'; }).length, cls: '' },
      { lbl: 'On track', val: rows.filter(function(r) { return r.enrolment.risk_status === 'Green'; }).length, cls: 'green' },
      { lbl: 'Amber', val: rows.filter(function(r) { return r.enrolment.risk_status === 'Amber'; }).length, cls: 'amber' },
      { lbl: 'Red', val: rows.filter(function(r) { return r.enrolment.risk_status === 'Red'; }).length, cls: 'red' },
      { lbl: 'Missing evidence', val: missingEv, cls: missingEv ? 'amber' : '' },
      { lbl: 'Crashing subject', val: rows.filter(function(r) { return r.crashing_subject; }).length, cls: 'amber' }
    ];
  }

  function dashboardEmptyMessage() {
    if (!role().canSetup) {
      return 'No tracking data yet. Your faculty head will set up teachers, classes, and enrolments.';
    }
    return 'No pupils enrolled yet — open <button type="button" class="linkish" data-route="setup">Setup</button> to add teachers, classes, and pupils.';
  }

  function renderDashboard() {
    var d = db();
    var allRows = SptConcerns.sortByUrgency(SptStore.getEnrichedRows(d), d);
    var filterTeachers = teachersForFilterBar(d, dashboardRowsForTeacherFilter(allRows));
    sanitizeTeacherFilter(filterTeachers);
    var rows = applyFilters(allRows);
    var html = alertStripHtml() + '<div class="dashboard-wrap">';
    html += '<div class="dashboard-head">' +
      '<div class="page-head page-head-compact"><h1>Senior Phase Dashboard</h1>' +
      '<p class="page-sub">Flagged pupils first · overview only — enter data on ' +
      '<button type="button" class="linkish" data-route="courses">Enter tracking</button></p></div>';
    html += '<div class="summary-row summary-row-compact">' + summaryCards(rows).map(function(c) {
      return '<div class="summary-card ' + c.cls + '"><div class="val">' + c.val + '</div><div class="lbl">' + esc(c.lbl) + '</div></div>';
    }).join('') + '</div></div>';
    html += filtersHtml(d,
      '<div class="filter-field"><label>Flagged</label><select data-filter="flagged"><option value="">All</option><option value="yes">Open flags only</option></select></div>',
      filterTeachers);
    var bodyRows = '';
    if (!rows.length) {
      bodyRows = '<tr><td colspan="14" class="empty">' + dashboardEmptyMessage() + '</td></tr>';
    }
    rows.forEach(function(r) {
      var attCells = r.attendance.map(function(a) {
        var v = a.record ? a.record.attendance_score : '';
        return '<td class="cell-num">' + scorePillHtml(v) + '</td>';
      }).join('');
      var entryCell = '—';
      if (r.shows_s3_baseline && r.s3_baseline) {
        entryCell = 'S3 ' + SptBaseline.formatS3ExamDisplay(r.s3_baseline, r.course) + ' · CfE ' + (r.s3_baseline.cfe_level || '—');
      } else if (r.shows_prior_entry) {
        entryCell = (r.prior_display.grade || '—') + ' · ' +
          (r.crashing_subject ? 'Crashing subject' : (r.prior_display.pathway || '—'));
      } else if (r.uses_evidence_bank) {
        entryCell = r.units_banked + '/' + r.units_total + ' units';
      }
      bodyRows += '<tr class="' + (r.open_flag_count ? 'row-flagged' : '') + '" data-enrolment="' + r.enrolment.id + '">' +
        '<td class="col-pupil">' + esc(SptStore.pupilName(d, r.pupil.id)) + '</td>' +
        '<td class="cell-num">' + esc(r.pupil.year_group) + '</td>' +
        '<td>' + esc(r.course.course_name) + '</td>' +
        '<td>' + esc(r.enrolment.current_level) + '</td>' +
        '<td>' + esc(r.class_name) + '</td>' +
        '<td>' + esc(r.teacher_name) + '</td>' +
        '<td class="cell-entry">' + esc(entryCell) + '</td>' +
        '<td>' + (r.open_flag_count ? badge('Open') : '—') + '</td>' +
        attCells +
        '<td class="cell-grade">' + esc(r.uses_exam_route ? (r.prelim_result || '—') : '—') + '</td>' +
        '<td class="cell-grade">' + esc(r.uses_exam_route ? (r.enrolment.latest_working_grade || '—') : (r.uses_evidence_bank ? r.units_banked + '/' + r.units_total : '—')) + '</td>' +
        '<td>' + badge(r.enrolment.risk_status) + '</td></tr>';
    });
    var tbl = '<table class="data-table data-table-compact"><thead><tr>' +
      '<th class="col-pupil">Pupil</th><th>Yr</th><th>Course</th><th>Level</th><th>Class</th><th>Teacher</th>' +
      '<th>Entry</th><th>Flag</th>' +
      '<th>TP1</th><th>TP2</th><th>TP3</th><th>Prelim</th><th>Working</th><th>Risk</th></tr></thead><tbody>' +
      bodyRows + '</tbody></table>';
    html += sheetPanel('Pupil register', rows.length + ' pupils', '', tbl);
    html += '</div>';
    return html;
  }

  function renderAlerts() {
    var d = db();
    var flags = (d.teacher_concerns || []).filter(function(f) {
      if (f.status !== 'Open') return false;
      var en = SptStore.byId(d.enrolments, f.enrolment_id);
      return en && SptStore.canViewEnrolment(d, en);
    }).sort(function(a, b) { return (b.created_at || '').localeCompare(a.created_at || ''); });
    var html = alertStripHtml() + '<div class="page-head"><h1>Teacher concern alerts</h1><p>Resolve each flag by linking or creating an intervention.</p></div>';
    var alertRows = '';
    flags.forEach(function(f) {
      var en = SptStore.byId(d.enrolments, f.enrolment_id);
      alertRows += '<tr class="row-flagged"><td class="col-pupil">' + esc(SptStore.pupilName(d, en.pupil_id)) + '</td>' +
        '<td>' + esc(SptStore.courseName(d, en.course_id)) + '</td>' +
        '<td>' + esc(SptStore.teacherName(d, f.raised_by_teacher_id)) + '</td>' +
        '<td>' + esc(f.category) + '</td><td>' + esc(f.comment) + '</td>' +
        '<td class="cell-num">' + esc((f.created_at || '').slice(0, 10)) + '</td>' +
        '<td>' + (role().canResolveFlags ?
          '<button type="button" class="btn btn-sm" data-resolve-flag="' + f.id + '">Resolve</button> ' +
          '<button type="button" class="btn btn-secondary btn-sm" data-view-enrolment="' + en.id + '">Profile</button>' : '') +
        '</td></tr>';
    });
    if (!flags.length) alertRows = '<tr><td colspan="7" class="empty">No open teacher concerns.</td></tr>';
    html += sheetPanel('Open alerts', flags.length + ' flags', 'Resolve with an intervention', '<table class="data-table"><thead><tr>' +
      '<th class="col-pupil">Pupil</th><th>Course</th><th>Teacher</th><th>Category</th><th>Comment</th><th>Raised</th><th>Actions</th></tr></thead><tbody>' +
      alertRows + '</tbody></table>');
    return html;
  }

  function hubStaffStatusText() {
    if (state.hubStaffMessage) return state.hubStaffMessage;
    if (state.hubStaffStatus === 'loading') return 'Loading Faculty Hub staff…';
    if (state.hubStaffStatus === 'offline') {
      return 'Open while signed in to Faculty Hub to import staff, or add teachers manually below.';
    }
    if (state.hubStaffStatus === 'error') {
      return 'Could not load hub staff: ' + (state.hubStaffError || 'unknown error');
    }
    var imported = (db().teachers || []).filter(function(t) { return t.hub_user_id || t.source === 'hub'; }).length;
    var total = state.hubStaff.length;
    if (!total) return 'No hub staff returned — check you are signed in, or add teachers manually.';
    return total + ' staff on Faculty Hub · ' + imported + ' linked in Senior Phase tracking';
  }

  function renderHubStaffPanel(d) {
    var rows = state.hubStaff || [];
    var html = '<div class="hub-staff-panel">' +
      '<div class="hub-staff-head">' +
      '<h3>Faculty Hub staff</h3>' +
      '<p class="sheet-hint">Pull in teachers who have signed up for the hub. You can set up classes for any imported teacher, including yourself.</p>' +
      '<div class="hub-staff-actions">' +
      '<button type="button" class="btn btn-sm" id="btn-sync-hub-teachers"' +
      (state.hubStaffStatus === 'loading' ? ' disabled' : '') + '>Sync from Hub</button>' +
      '<button type="button" class="btn btn-secondary btn-sm" id="btn-add-me-teacher">Add me as a teacher</button>' +
      '</div>' +
      '<p class="hub-staff-status">' + esc(hubStaffStatusText()) + '</p>' +
      '</div>';
    if (rows.length) {
      html += '<div class="sheet-grid-wrap"><table class="data-table hub-staff-table"><thead><tr>' +
        '<th class="col-pupil">Hub staff</th><th>Email</th><th>Status</th><th></th></tr></thead><tbody>';
      rows.forEach(function(row) {
        var linked = window.SptHubStaff && SptHubStaff.findLocalTeacher(d, row);
        html += '<tr><td class="col-pupil">' + esc(row.display_name || row.email || 'Unknown') + '</td>' +
          '<td>' + esc(row.email || '—') + '</td>' +
          '<td>' + (linked ? badge('Complete') : badge('Not Started')) + '</td>' +
          '<td>' + (linked ? '—' : '<button type="button" class="btn btn-sm btn-secondary" data-import-hub-teacher="' +
            esc(row.teacher_id) + '">Import</button>') + '</td></tr>';
      });
      html += '</tbody></table></div>';
    }
    html += '</div>';
    return html;
  }

  function loadHubStaffState() {
    if (!window.SptHubStaff) {
      state.hubStaffStatus = 'offline';
      return;
    }
    state.hubStaffStatus = 'loading';
    state.hubStaffMessage = null;
    SptHubStaff.loadHubStaff().then(function(payload) {
      state.hubStaff = payload.rows || [];
      state.hubStaffStatus = payload.status || 'ready';
      state.hubStaffError = payload.error || null;
      state.hubStaffDiagnostics = payload.diagnostics || null;
      state.currentHubUser = payload.currentUser || null;
      if (payload.currentUser) {
        var d = db();
        d.hub_current_user_id = payload.currentUser.teacher_id;
        SptStore.save(d);
      }
      if (state.hubStaff.length) {
        SptHubStaff.syncStaffRows(db(), state.hubStaff);
      }
      render();
    }).catch(function(err) {
      state.hubStaffStatus = 'error';
      state.hubStaffError = err && err.message ? err.message : String(err);
      render();
    });
  }

  function syncHubTeachers(messagePrefix) {
    if (!window.SptHubStaff) {
      state.hubStaffMessage = 'Hub staff module not loaded — refresh the page.';
      render();
      return;
    }
    state.hubStaffStatus = 'loading';
    state.hubStaffMessage = null;
    render();
    SptHubStaff.loadHubStaff().then(function(payload) {
      state.hubStaff = payload.rows || [];
      state.hubStaffStatus = payload.status || 'ready';
      state.hubStaffError = payload.error || null;
      state.currentHubUser = payload.currentUser || state.currentHubUser;
      if (!state.hubStaff.length) {
        state.hubStaffMessage = state.hubStaffError || 'No hub staff found to import.';
        render();
        return;
      }
      var result = SptHubStaff.syncStaffRows(db(), state.hubStaff);
      state.hubStaffMessage = (messagePrefix || 'Synced from Faculty Hub:') + ' ' +
        result.added + ' added, ' + result.updated + ' updated.';
      render();
      initRoleControls();
    }).catch(function(err) {
      state.hubStaffStatus = 'error';
      state.hubStaffMessage = 'Sync failed: ' + (err && err.message ? err.message : String(err));
      render();
    });
  }

  function addMeAsTeacher(andSelect) {
    if (!window.SptHubStaff) {
      state.hubStaffMessage = 'Hub staff module not loaded — refresh the page.';
      render();
      return;
    }
    state.hubStaffStatus = 'loading';
    render();
    SptHubStaff.loadCurrentHubUser().then(function(user) {
      state.hubStaffStatus = user ? 'ready' : 'offline';
      if (!user) {
        state.hubStaffMessage = 'Sign in to Faculty Hub to add yourself as a teacher.';
        render();
        return;
      }
      state.currentHubUser = user;
      var d = db();
      d.hub_current_user_id = user.teacher_id;
      var teacher = SptHubStaff.ensureHubTeacher(d, user);
      if (andSelect !== false && teacher) state.setupTeacherId = teacher.id;
      state.hubStaffMessage = 'Added you as ' + (user.display_name || user.email) + '.';
      render();
      initRoleControls();
    }).catch(function(err) {
      state.hubStaffStatus = 'error';
      state.hubStaffMessage = 'Could not add you: ' + (err && err.message ? err.message : String(err));
      render();
    });
  }

  function importHubTeacherById(hubUserId) {
    if (!window.SptHubStaff) {
      state.hubStaffMessage = 'Hub staff module not loaded — refresh the page.';
      render();
      return;
    }
    var row = (state.hubStaff || []).find(function(r) { return r.teacher_id === hubUserId; });
    if (!row) {
      state.hubStaffMessage = 'Could not find that staff member — try Sync from Hub first.';
      render();
      return;
    }
    SptHubStaff.ensureHubTeacher(db(), row);
    state.hubStaffMessage = 'Imported ' + (row.display_name || row.email) + '.';
    render();
    initRoleControls();
  }

  function setupMyClasses() {
    addMeAsTeacher(true);
    state.setupTab = 'profile';
    state.route = 'setup';
    document.querySelectorAll('.nav-btn').forEach(function(btn) {
      btn.classList.toggle('active', btn.getAttribute('data-route') === 'setup');
    });
  }

  function parsePupilLine(raw, defaultYear) {
    var line = String(raw || '').trim();
    if (!line || line.charAt(0) === '#') return null;
    var year = '';
    var scn = '';
    var namePart = line;
    var mixedMatch = namePart.match(/\b(S5\s*\/\s*6|S5\/6)\b/i);
    if (mixedMatch) {
      year = 'S5/6';
      namePart = namePart.replace(mixedMatch[0], '').trim();
    } else {
      var yearMatch = namePart.match(/\b(S[456])\b/i);
      if (yearMatch) {
        year = yearMatch[1].toUpperCase();
        namePart = namePart.replace(/\bS[456]\b/i, '').trim();
      }
    }
    var scnMatch = namePart.match(/\b(\d{6,9})\b/);
    if (scnMatch) {
      scn = scnMatch[1];
      namePart = namePart.replace(scn, '').trim();
    }
    if (namePart.indexOf('\t') >= 0) {
      var cols = namePart.split('\t').map(function(c) { return c.trim(); }).filter(Boolean);
      if (cols.length >= 2 && /^\d+$/.test(cols[cols.length - 1])) {
        scn = scn || cols.pop();
        namePart = cols.join(' ');
      }
    }
    var first = '';
    var surname = '';
    if (namePart.indexOf(',') >= 0) {
      var commaParts = namePart.split(',');
      surname = commaParts[0].trim();
      first = commaParts.slice(1).join(',').trim();
    } else {
      var bits = namePart.split(/\s+/).filter(Boolean);
      if (!bits.length) return null;
      if (bits.length === 1) {
        first = bits[0];
        surname = '';
      } else {
        first = bits[0];
        surname = bits.slice(1).join(' ');
      }
    }
    if (!first && !surname) return null;
    return {
      first_name: first || 'Pupil',
      surname: surname || '',
      year_group: year || defaultYear || 'S5/6',
      candidate_number: scn
    };
  }

  function parsePupilLines(text, defaultYear) {
    return String(text || '').split(/\r?\n/).map(function(line) {
      return parsePupilLine(line, defaultYear);
    }).filter(Boolean);
  }

  function findOrCreatePupil(d, parsed) {
    var existing = null;
    if (parsed.candidate_number) {
      existing = (d.pupils || []).find(function(p) { return p.candidate_number === parsed.candidate_number; });
    }
    if (!existing) {
      var fn = parsed.first_name.toLowerCase();
      var sn = parsed.surname.toLowerCase();
      existing = (d.pupils || []).find(function(p) {
        return p.first_name.toLowerCase() === fn && p.surname.toLowerCase() === sn;
      });
    }
    if (existing) {
      if (parsed.year_group && existing.year_group !== parsed.year_group) {
        SptStore.updateRecord(d, 'pupils', existing.id, { year_group: parsed.year_group }, 'pupil_year_update');
      }
      return existing;
    }
    return SptStore.createPupil(d, parsed);
  }

  function bulkEnrolPupilsInClass(classId, level, parsedRows) {
    var d = db();
    var cl = SptStore.byId(d.classes, classId);
    if (!cl) return { error: 'Class not found', enrolled: 0, created: 0, skipped: 0 };
    if (!parsedRows.length) return { error: 'No names found — paste one pupil per line.', enrolled: 0, created: 0, skipped: 0 };
    var enrolled = 0;
    var created = 0;
    var skipped = 0;
    var errors = [];
    parsedRows.forEach(function(parsed, i) {
      var beforeCount = (d.pupils || []).length;
      var pupil = findOrCreatePupil(d, parsed);
      if ((d.pupils || []).length > beforeCount) created++;
      var result = SptStore.addPupilToCourse(d, {
        pupilId: pupil.id,
        courseId: cl.course_id,
        classId: cl.id,
        teacherId: cl.teacher_id,
        level: level
      });
      if (result.error) {
        if (result.error === 'Pupil is already on this course') skipped++;
        else errors.push((parsed.first_name + ' ' + parsed.surname).trim() + ': ' + result.error);
      } else {
        enrolled++;
      }
    });
    return { enrolled: enrolled, created: created, skipped: skipped, errors: errors };
  }

  function copyClassRoster(fromClassId, toClassId, level) {
    var d = db();
    if (!fromClassId || !toClassId) return { error: 'Select both classes.', copied: 0, skipped: 0 };
    if (fromClassId === toClassId) return { error: 'Choose a different target class.', copied: 0, skipped: 0 };
    var toCl = SptStore.byId(d.classes, toClassId);
    if (!toCl) return { error: 'Target class not found.', copied: 0, skipped: 0 };
    var source = (d.enrolments || []).filter(function(e) {
      return e.class_id === fromClassId && e.active_status !== false;
    });
    if (!source.length) return { error: 'Source class has no pupils to copy.', copied: 0, skipped: 0 };
    var copied = 0;
    var skipped = 0;
    source.forEach(function(en) {
      var pupil = SptStore.byId(d.pupils, en.pupil_id);
      if (!pupil) return;
      var result = SptStore.addPupilToCourse(d, {
        pupilId: pupil.id,
        courseId: toCl.course_id,
        classId: toCl.id,
        teacherId: toCl.teacher_id,
        level: level || en.current_level
      });
      if (result.error) {
        if (result.error === 'Pupil is already on this course') skipped++;
      } else {
        copied++;
      }
    });
    return { copied: copied, skipped: skipped, errors: [] };
  }

  function levelOptionsHtml(selected) {
    var levels = ['National 5', 'National 4', 'National 3', 'Higher', 'Advanced Higher', 'Level 6', 'Level 5'];
    return levels.map(function(l) {
      return '<option' + (selected === l ? ' selected' : '') + '>' + l + '</option>';
    }).join('');
  }

  function defaultYearGroupForCourse(course) {
    if (!course) return 'S5/6';
    if (course.course_type === 'N5/N4 Combined') return 'S4';
    return 'S5/6';
  }

  function defaultYearGroupForClass(d, cl) {
    if (!cl) return 'S5/6';
    if (cl.year_group && SptConfig.SENIOR_YEAR_GROUPS.indexOf(cl.year_group) >= 0) return cl.year_group;
    return defaultYearGroupForCourse(SptStore.byId(d.courses, cl.course_id));
  }

  function yearGroupOptionsHtml(selected) {
    return SptConfig.SENIOR_YEAR_GROUPS.map(function(y) {
      return '<option value="' + esc(y) + '"' + (selected === y ? ' selected' : '') + '>' + esc(y) + '</option>';
    }).join('');
  }

  function defaultLevelForClass(d, cl) {
    if (!cl) return 'Higher';
    var course = SptStore.byId(d.courses, cl.course_id);
    return course ? SptStore.defaultLevelForCourse(course) : 'Higher';
  }

  function enrolmentsForClass(d, classId) {
    return (d.enrolments || []).filter(function(e) {
      return e.class_id === classId && e.active_status !== false;
    });
  }

  function renderClassEnrolPanel(d, activeClass) {
    var classId = activeClass.id;
    var levelDefault = defaultLevelForClass(d, activeClass);
    var yearDefault = defaultYearGroupForClass(d, activeClass);
    var roster = enrolmentsForClass(d, classId);
    var html = '<div class="setup-enrol-block setup-class-focus" id="setup-class-panel">' +
      '<div class="setup-class-focus-head">' +
      '<h3>Class roster — ' + esc(activeClass.class_name) + '</h3>' +
      '<p class="sheet-hint">' + esc(SptStore.courseName(d, activeClass.course_id)) + ' · ' +
      roster.length + ' pupil' + (roster.length !== 1 ? 's' : '') + ' enrolled · Default year: ' +
      '<select class="inline-select inline-select-sm" data-class-year="' + esc(classId) + '" title="Default year for new pupils">' +
      yearGroupOptionsHtml(yearDefault) + '</select></p>' +
      '<button type="button" class="btn btn-secondary btn-sm" data-setup-class-clear>Choose a different class</button>' +
      '<button type="button" class="btn btn-secondary btn-sm" data-delete-class="' + esc(classId) + '">Delete class</button>' +
      '</div>';
    if (state.setupMessage) {
      html += '<p class="hub-staff-status">' + esc(state.setupMessage) + '</p>';
    }
    if (roster.length) {
      html += '<div class="setup-class-roster"><table class="data-table"><thead><tr>' +
        '<th class="col-pupil">Pupil</th><th>Year</th><th>Level</th></tr></thead><tbody>' +
        roster.map(function(en) {
          var p = SptStore.byId(d.pupils, en.pupil_id);
          return '<tr><td class="col-pupil">' + esc(p ? SptStore.pupilName(d, p.id) : '—') + '</td>' +
            '<td>' + (p ? '<select class="inline-select inline-select-sm" data-pupil-year="' + p.id + '">' +
              yearGroupOptionsHtml(p.year_group) + '</select>' : '—') + '</td>' +
            '<td>' + esc(en.current_level || '—') + '</td></tr>';
        }).join('') +
        '</tbody></table></div>';
    } else {
      html += '<p class="sheet-hint">No pupils yet — add one below or paste a list.</p>';
    }

    html += '<form id="form-enrol-profile" class="form-grid setup-enrol-form">' +
      '<input type="hidden" name="class_id" value="' + esc(classId) + '">' +
      '<div><label>Pupil</label><select name="pupil_id">' +
      ((d.pupils || []).length
        ? (d.pupils || []).map(function(p) {
          return '<option value="' + p.id + '">' + esc(SptStore.pupilName(d, p.id) + ' (' + p.year_group + ')') + '</option>';
        }).join('')
        : '<option value="">— Paste names below first —</option>') +
      '</select></div>' +
      '<div><label>Year group</label><select name="year_group">' + yearGroupOptionsHtml(yearDefault) + '</select></div>' +
      '<div><label>Current level</label><select name="current_level">' + levelOptionsHtml(levelDefault) + '</select></div>' +
      '<div class="form-span"><button type="submit" class="btn btn-sm">Add one pupil to this class</button></div></form>' +

      '<div class="setup-bulk-panel">' +
      '<h4>Paste multiple names</h4>' +
      '<p class="sheet-hint">One pupil per line — e.g. <code>Jamie Smith</code>, <code>Smith, Jamie</code>, <code>Alex Brown S5</code>, <code>Taylor Reid S5/6</code>. ' +
      'Year in the name overrides the default below.</p>' +
      '<form id="form-bulk-enrol-profile" class="form-grid">' +
      '<input type="hidden" name="class_id" value="' + esc(classId) + '">' +
      '<div class="form-span"><label>Pupil names</label>' +
      '<textarea name="pupil_lines" rows="8" placeholder="Jamie Smith&#10;Alex Brown S5&#10;Taylor Reid, Sam S4"></textarea></div>' +
      '<div><label>Default year group</label><select name="year_group">' + yearGroupOptionsHtml(yearDefault) + '</select></div>' +
      '<div><label>Current level</label><select name="current_level">' + levelOptionsHtml(levelDefault) + '</select></div>' +
      '<div class="form-span"><button type="submit" class="btn btn-sm">Add pasted pupils to this class</button></div></form></div>';

    if ((d.classes || []).some(function(cl) {
      return cl.id !== classId && SptStore.enrolmentCountForClass(d, cl.id) > 0;
    })) {
      html += '<div class="setup-bulk-panel">' +
        '<h4>Copy roster from another class</h4>' +
        '<p class="sheet-hint">Copy pupils from another class into <strong>' + esc(activeClass.class_name) + '</strong>.</p>' +
        '<form id="form-copy-roster" class="form-grid">' +
        '<input type="hidden" name="to_class_id" value="' + esc(classId) + '">' +
        '<div><label>Copy from</label><select name="from_class_id">' +
        (d.classes || []).filter(function(cl) {
          return cl.id !== classId && SptStore.enrolmentCountForClass(d, cl.id) > 0;
        }).map(function(cl) {
          var teacher = SptStore.teacherName(d, cl.teacher_id);
          return '<option value="' + cl.id + '">' + esc(cl.class_name + ' · ' + SptStore.courseName(d, cl.course_id) +
            ' (' + SptStore.enrolmentCountForClass(d, cl.id) + ' pupils) · ' + teacher) + '</option>';
        }).join('') + '</select></div>' +
        '<div><label>Current level</label><select name="current_level">' + levelOptionsHtml(levelDefault) + '</select></div>' +
        '<div class="form-span"><button type="submit" class="btn btn-sm btn-secondary">Copy pupils into this class</button></div></form></div>';
    }

    html += '</div>';
    return html;
  }

  function renderTeacherProfileSetup(d) {
    var teachers = d.teachers || [];
    if (!state.setupTeacherId && teachers.length) state.setupTeacherId = teachers[0].id;
    var selected = state.setupTeacherId ? SptStore.byId(teachers, state.setupTeacherId) : null;
    var teacherClasses = selected
      ? (d.classes || []).filter(function(cl) { return cl.teacher_id === selected.id; })
      : [];
    var activeClass = null;
    if (state.setupClassId && selected) {
      var candidate = SptStore.byId(d.classes, state.setupClassId);
      if (candidate && candidate.teacher_id === selected.id) activeClass = candidate;
      else state.setupClassId = null;
    }
    var html = '<div class="card"><div class="card-head"><h2>Teacher classes</h2></div><div class="card-body">' +
      '<p class="sheet-hint">Select a teacher, create their senior phase classes, and enrol pupils. ' +
      'Use <strong>Set up my classes</strong> if you teach senior phase yourself.</p>' +
      '<div class="setup-quick-actions">' +
      '<button type="button" class="btn btn-sm" id="btn-sync-hub-teachers-inline">Sync hub staff</button>' +
      '<button type="button" class="btn btn-secondary btn-sm" id="btn-setup-my-classes">Set up my classes</button>' +
      '</div>' +
      '<p class="hub-staff-status">' + esc(hubStaffStatusText()) + '</p>' +
      '<div class="setup-teacher-picker">' +
      '<label for="setup-teacher-select">Teacher</label>' +
      '<select id="setup-teacher-select" data-setup-teacher>' +
      (teachers.length ? '' : '<option value="">— Import teachers first —</option>') +
      teachers.map(function(t) {
        return '<option value="' + t.id + '"' + (selected && selected.id === t.id ? ' selected' : '') + '>' +
          esc(t.first_name + ' ' + t.surname) + (t.hub_user_id ? '' : ' (manual)') + '</option>';
      }).join('') +
      '</select></div>';

    if (!selected) {
      html += '<div class="empty">Sync staff from the Faculty Hub on the <strong>Teachers</strong> tab, or click <strong>Set up my classes</strong> to add yourself.</div></div></div>';
      return html;
    }

    html += '<div class="setup-teacher-banner">' +
      '<div class="setup-teacher-banner-main">' +
      '<div class="setup-teacher-avatar">' + esc((selected.first_name || '?')[0] + (selected.surname || '?')[0]) + '</div>' +
      '<div><div class="setup-teacher-name">' + esc(selected.first_name + ' ' + selected.surname) + '</div>' +
      '<div class="setup-teacher-meta">' + esc(selected.email || 'No email') + ' · ' +
      teacherClasses.length + ' class' + (teacherClasses.length !== 1 ? 'es' : '') + '</div></div></div></div>';

    html += '<form id="form-add-class-profile" class="form-grid setup-class-form">' +
      '<input type="hidden" name="teacher_id" value="' + esc(selected.id) + '">' +
      '<div><label>Course</label><select name="course_id" id="setup-class-course">' + d.courses.map(function(c, i) {
        return '<option value="' + c.id + '"' + (i === 0 ? ' selected' : '') + '>' + esc(c.course_name) + '</option>';
      }).join('') + '</select></div>' +
      '<div><label>Class name</label><input name="class_name" required placeholder="e.g. H Drama A"></div>' +
      '<div><label>Default year group</label><select name="year_group" id="setup-class-year-group">' +
      yearGroupOptionsHtml(defaultYearGroupForCourse(d.courses[0])) + '</select></div>' +
      '<p class="sheet-hint form-span">New pupils added to this class use this year group unless you specify S4, S5, S6, or S5/6 in their name when pasting.</p>' +
      '<div class="form-span"><button type="submit" class="btn btn-sm">Add class for this teacher</button></div></form>';

    if (!teacherClasses.length) {
      html += '<div class="empty">No classes yet — add one above.</div>';
    } else {
      html += '<p class="sheet-hint">Click <strong>Add pupils</strong> on a class to update its roster — add one pupil or paste many names at once.</p>' +
        '<table class="data-table setup-class-table"><thead><tr>' +
        '<th>Class</th><th>Course</th><th>Year</th><th>Pupils</th><th></th></tr></thead><tbody>' +
        teacherClasses.map(function(cl) {
          var count = SptStore.enrolmentCountForClass(d, cl.id);
          var isActive = activeClass && activeClass.id === cl.id;
          return '<tr class="setup-class-row' + (isActive ? ' is-selected' : '') + '">' +
            '<td>' + esc(cl.class_name) + '</td>' +
            '<td>' + esc(SptStore.courseName(d, cl.course_id)) + '</td>' +
            '<td>' + esc(defaultYearGroupForClass(d, cl)) + '</td>' +
            '<td>' + count + '</td>' +
            '<td class="setup-class-actions">' +
            '<button type="button" class="btn btn-sm' + (isActive ? '' : ' btn-secondary') + '" data-setup-class="' +
            esc(cl.id) + '">' + (isActive ? 'Managing' : 'Add pupils') + '</button> ' +
            '<button type="button" class="btn btn-sm btn-secondary" data-open-class-sheet="' +
            esc(cl.course_id) + '|' + esc(cl.id) + '">Open sheet</button> ' +
            '<button type="button" class="btn btn-sm btn-secondary" data-delete-class="' +
            esc(cl.id) + '">Delete</button></td></tr>';
        }).join('') +
        '</tbody></table>';

      if (activeClass) {
        html += renderClassEnrolPanel(d, activeClass);
      } else {
        html += '<div class="setup-class-pick-hint empty">Select a class above to add or update pupils.</div>';
      }
    }

    html += '</div></div>';
    return html;
  }

  function renderSetup() {
    if (!role().canSetup) return '<div class="empty">Setup is only available for Faculty Head / Admin.</div>';
    var d = db();
    var tab = state.setupTab;
    var html = gettingStartedHtml(d) + '<div class="page-head"><h1>Setup / Cohort</h1>' +
      '<p>Set up teachers and classes so class teachers can enter tracking data on their class sheets.</p></div>';
    html += '<div class="setup-tabs">' +
      [{ id: 'profile', label: 'Teacher classes' }, { id: 'teachers', label: 'Teachers' },
        { id: 'pupils', label: 'Pupils' }, { id: 'enrolments', label: 'Enrolments' },
        { id: 'baseline', label: 'Baseline' }, { id: 'prior', label: 'Prior' }].map(function(t) {
        return '<button type="button" class="setup-tab' + (tab === t.id ? ' active' : '') +
          '" data-setup-tab="' + t.id + '">' + t.label + '</button>';
      }).join('') + '</div>';

    if (tab === 'profile') {
      html += renderTeacherProfileSetup(d);
    } else if (tab === 'teachers') {
      html += renderHubStaffPanel(d);
      html += '<div class="sheet-panel"><div class="sheet-toolbar"><div class="sheet-toolbar-left"><h2>Tracking teachers</h2></div></div><div class="sheet-body">' +
        '<p class="sheet-hint">Imported hub staff appear automatically after sync. Add anyone else manually if needed.</p>' +
        '<form id="form-add-teacher" class="form-grid setup-manual-teacher" style="max-width:400px;margin-bottom:1rem">' +
        '<div><label>First name</label><input name="first_name" required></div>' +
        '<div><label>Surname</label><input name="surname" required></div>' +
        '<div><label>Email</label><input name="email" type="email"></div>' +
        '<button type="submit" class="btn btn-sm btn-secondary">Add manually</button></form></div>' +
        '<div class="sheet-grid-wrap"><table class="data-table"><thead><tr>' +
        '<th class="col-pupil">Name</th><th>Email</th><th>Source</th></tr></thead><tbody>' +
        (d.teachers || []).map(function(t) {
          return '<tr><td class="col-pupil">' + esc(t.first_name + ' ' + t.surname) + '</td><td>' + esc(t.email) + '</td>' +
            '<td>' + esc((t.hub_user_id || t.source === 'hub') ? 'Faculty Hub' : 'Manual') + '</td></tr>';
        }).join('') +
        ((d.teachers || []).length ? '' : '<tr><td colspan="3" class="empty">No teachers yet — sync from the hub above.</td></tr>') +
        '</tbody></table></div></div>';
    } else if (tab === 'pupils') {
      html += '<div class="card"><div class="card-head"><h2>Pupils</h2></div><div class="card-body">' +
        '<form id="form-add-pupil" class="form-grid" style="max-width:480px;margin-bottom:1rem">' +
        '<div><label>First name</label><input name="first_name" required></div>' +
        '<div><label>Surname</label><input name="surname" required></div>' +
        '<div><label>Year group</label><select name="year_group">' + yearGroupOptionsHtml('S5/6') + '</select></div>' +
        '<div><label>Candidate number</label><input name="candidate_number"></div>' +
        '<button type="submit" class="btn btn-sm">Add pupil</button></form>' +
        '<table class="data-table"><thead><tr><th>Name</th><th>Year</th><th>SCN</th></tr></thead><tbody>' +
        d.pupils.map(function(p) {
          return '<tr><td>' + esc(SptStore.pupilName(d, p.id)) + '</td><td>' + esc(p.year_group) + '</td><td>' + esc(p.candidate_number) + '</td></tr>';
        }).join('') + '</tbody></table></div></div>';
    } else if (tab === 'enrolments') {
      html += '<div class="card"><div class="card-head"><h2>Enrolments</h2></div><div class="card-body">' +
        '<form id="form-add-enrolment" class="form-grid" style="max-width:520px;margin-bottom:1rem">' +
        '<div><label>Pupil</label><select name="pupil_id">' + d.pupils.map(function(p) {
          return '<option value="' + p.id + '">' + esc(SptStore.pupilName(d, p.id)) + '</option>';
        }).join('') + '</select></div>' +
        '<div><label>Class</label><select name="class_id"><option value="">—</option>' + (d.classes || []).map(function(cl) {
          return '<option value="' + cl.id + '" data-course="' + cl.course_id + '" data-teacher="' + cl.teacher_id + '">' +
            esc(cl.class_name + ' (' + SptStore.courseName(d, cl.course_id) + ')') + '</option>';
        }).join('') + '</select></div>' +
        '<div><label>Current level</label><select name="current_level">' +
        '<option>National 5</option><option>National 4</option><option>National 3</option>' +
        '<option>Higher</option><option>Advanced Higher</option><option>Level 6</option><option>Level 5</option></select></div>' +
        '<button type="submit" class="btn btn-sm">Enrol pupil</button></form>' +
        '<table class="data-table"><thead><tr><th>Pupil</th><th>Course</th><th>Class</th><th>Teacher</th></tr></thead><tbody>' +
        d.enrolments.filter(function(e) { return e.active_status !== false; }).map(function(en) {
          return '<tr><td>' + esc(SptStore.pupilName(d, en.pupil_id)) + '</td><td>' + esc(SptStore.courseName(d, en.course_id)) + '</td>' +
            '<td>' + esc(en.class_id ? SptStore.className(d, en.class_id) : '—') + '</td>' +
            '<td>' + esc(SptStore.teacherName(d, en.teacher_id)) + '</td></tr>';
        }).join('') + '</tbody></table></div></div>';
    } else if (tab === 'baseline') {
      html += '<div class="card"><div class="card-head"><h2>S3 entry baseline (N5 &amp; N4 pupils)</h2></div><div class="card-body">' +
        '<p class="sheet-hint">Frozen S3 snapshot for N5/N4 combined courses. Enter on course sheets or here in bulk.</p>' +
        '<form id="form-add-baseline" class="form-grid" style="max-width:640px;margin-bottom:1rem">' +
        '<div><label>Enrolment</label><select name="enrolment_id">' +
        SptStore.getEnrichedRows(d).filter(function(r) { return r.shows_s3_baseline; }).map(function(r) {
          return '<option value="' + r.enrolment.id + '">' + esc(SptStore.pupilName(d, r.pupil.id) + ' — ' + r.course.course_name) + '</option>';
        }).join('') + '</select></div>' +
        '<div><label>S3 exam mark (raw)</label><input name="s3_exam_raw" type="number" min="0" placeholder="Raw mark — % and grade auto-calculated"></div>' +
        '<div><label>Effort (1–4)</label><input name="effort" type="number" min="1" max="4"></div>' +
        '<div><label>Behaviour (1–4)</label><input name="behaviour" type="number" min="1" max="4"></div>' +
        '<div><label>Home learning (1–4)</label><input name="homelearning" type="number" min="1" max="4"></div>' +
        '<div><label>Progress (1–4)</label><input name="progress" type="number" min="1" max="4" step="1"></div>' +
        '<div><label>CfE level</label><select name="cfe_level"><option value="">—</option>' +
        SptConfig.CFE_LEVELS.map(function(l) { return '<option>' + l + '</option>'; }).join('') + '</select></div>' +
        '<div><label>Notes</label><textarea name="notes"></textarea></div>' +
        '<button type="submit" class="btn btn-sm">Save baseline</button></form>' +
        '<table class="data-table"><thead><tr><th>Pupil</th><th>Course</th><th>Mark</th><th>%</th><th>Grade</th><th>Eff</th><th>Beh</th><th>HL</th><th>Prog</th><th>CfE</th></tr></thead><tbody>' +
        (d.enrolment_baselines || []).map(function(b) {
          var en = SptStore.byId(d.enrolments, b.enrolment_id);
          if (!en) return '';
          var course = SptStore.byId(d.courses, en.course_id);
          var result = SptBaseline.s3ExamResult(b, course);
          return '<tr><td>' + esc(SptStore.pupilName(d, en.pupil_id)) + '</td><td>' + esc(SptStore.courseName(d, en.course_id)) + '</td>' +
            '<td>' + esc(b.s3_exam_raw != null ? b.s3_exam_raw : '—') + '</td>' +
            '<td>' + esc(result ? result.percentage + '%' : '—') + '</td>' +
            '<td>' + esc(result ? result.grade : '—') + '</td>' +
            '<td>' + esc(b.effort != null ? b.effort : '—') + '</td>' +
            '<td>' + esc(b.behaviour != null ? b.behaviour : '—') + '</td><td>' + esc(b.homelearning != null ? b.homelearning : '—') + '</td>' +
            '<td>' + esc(b.progress != null ? b.progress : '—') + '</td><td>' + esc(b.cfe_level || '—') + '</td></tr>';
        }).join('') + '</tbody></table></div></div>';
    } else if (tab === 'prior') {
      html += '<div class="card"><div class="card-head"><h2>Prior attainment / exam history</h2></div><div class="card-body">' +
        '<form id="form-add-prior" class="form-grid" style="max-width:520px;margin-bottom:1rem">' +
        '<div><label>Pupil</label><select name="pupil_id">' + d.pupils.map(function(p) {
          return '<option value="' + p.id + '">' + esc(SptStore.pupilName(d, p.id)) + '</option>';
        }).join('') + '</select></div>' +
        '<div><label>Subject area</label><input name="subject_area" placeholder="Drama, Art, etc."></div>' +
        '<div><label>Year</label><input name="qualification_year" value="2024-25"></div>' +
        '<div><label>Level</label><input name="qualification_level" placeholder="Higher, N5"></div>' +
        '<div><label>Grade</label><input name="result_grade"></div>' +
        '<div><label>Pathway</label><select name="pathway_status">' +
        SptConfig.STATUS.pathway.map(function(s) { return '<option>' + s + '</option>'; }).join('') +
        '</select></div>' +
        '<div><label>Notes</label><textarea name="notes"></textarea></div>' +
        '<button type="submit" class="btn btn-sm">Add record</button></form>' +
        '<table class="data-table"><thead><tr><th>Pupil</th><th>Subject</th><th>Year</th><th>Level</th><th>Grade</th><th>Pathway</th></tr></thead><tbody>' +
        (d.prior_attainment || []).map(function(p) {
          return '<tr><td>' + esc(SptStore.pupilName(d, p.pupil_id)) + '</td><td>' + esc(p.subject_area) + '</td>' +
            '<td>' + esc(p.qualification_year) + '</td><td>' + esc(p.qualification_level) + '</td>' +
            '<td>' + esc(p.result_grade) + '</td><td>' + badge(p.pathway_status) + '</td></tr>';
        }).join('') + '</tbody></table></div></div>';
    }
    return html;
  }

  function renderCoursesList() {
    var d = db();
    var r = role();
    var html = alertStripHtml() + '<div class="page-head page-head-compact"><h1>Enter tracking data</h1>' +
      '<p class="page-sub">Open your class sheet — colours match subject area.</p></div>' +
      entryGuideHtml('courses-list');
    var entries = SptStore.trackingEntriesForUser(d);
    if (!entries.length) {
      html += '<div class="empty">No classes with pupils assigned' +
        (r.viewAll ? ' — add classes in Setup' : ' — ask your faculty head to assign you to a class') + '.</div>';
      return html;
    }
    var bySubject = {};
    entries.forEach(function(entry) {
      var area = entry.subjectArea || 'Other';
      if (!bySubject[area]) bySubject[area] = [];
      bySubject[area].push(entry);
    });
    var order = SptConfig.SUBJECT_ORDER.concat(Object.keys(bySubject).filter(function(a) {
      return SptConfig.SUBJECT_ORDER.indexOf(a) < 0;
    }));
    order.forEach(function(area) {
      var items = bySubject[area];
      if (!items || !items.length) return;
      var slug = SptConfig.subjectTileClass(area);
      html += '<div class="course-subject-group course-subject-group--' + slug + '">' +
        '<div class="course-subject-head"><span class="course-subject-label">' + esc(area) + '</span></div>' +
        '<div class="course-tile-grid">';
      items.slice().sort(function(a, b) {
        return (a.className || '').localeCompare(b.className || '');
      }).forEach(function(entry) {
        var title = entry.type === 'class' ?
          entry.className + ' (' + entry.teacherName + ')' :
          entry.courseName + ' — unassigned';
        var sub = entry.type === 'class' ?
          esc(entry.teacherName) + ' · ' + esc(entry.courseName) :
          esc(entry.courseName) + ' · pupils without a class';
        html += '<div class="course-tile course-tile--' + slug + '" data-class-sheet data-course="' + entry.courseId + '"' +
          (entry.classId ? ' data-class="' + entry.classId + '"' : ' data-unassigned="1"') +
          ' title="Open ' + esc(title) + '">' +
          '<div class="course-tile-row">' +
          '<span class="course-tile-name">' + esc(entry.className) + '</span>' +
          '<span class="course-tile-count">' + entry.count + '</span>' +
          '</div><div class="course-tile-sub">' + sub + '</div></div>';
      });
      html += '</div></div>';
    });
    return html;
  }

  function renderCoursePage(courseId) {
    var d = db();
    var course = SptStore.byId(d.courses, courseId);
    if (!course) return '<div class="empty">Course not found</div>';
    var sheetClass = state.classId ? SptStore.byId(d.classes, state.classId) : null;
    var aps = SptStore.assessmentPointsForCourse(d, courseId);
    var prelimAp = aps.find(function(ap) { return ap.assessment_type === 'Prelim'; });
    var prelimComps = prelimAp ? SptPrelim.componentsForCourse(d, courseId) : [];
    var enrolments = SptConcerns.sortByUrgency(
      SptStore.getEnrichedRows(d).filter(function(r) { return r.enrolment.course_id === courseId; }), d);
    if (state.classId) {
      enrolments = enrolments.filter(function(r) { return r.enrolment.class_id === state.classId; });
    } else if (state.unassignedOnly) {
      enrolments = enrolments.filter(function(r) { return !r.enrolment.class_id; });
    }
    var meta = courseGridMeta(course, enrolments);
    var tps = SptStore.trackingPoints(d);
    var canEdit = role().canEdit;
    var canBaseline = canEditBaseline();
    var sheetEnrolmentIds = enrolments.map(function(r) { return r.enrolment.id; }).join(',');
    var s3BaselineEnrolmentIds = enrolments.filter(function(r) { return r.shows_s3_baseline; })
      .map(function(r) { return r.enrolment.id; }).join(',');
    var showTeachers = !state.classId && courseShowsTeacherColumn(d, courseId, enrolments);
    var courseTeachers = SptStore.teachersForCourse(d, courseId);
    var sheetTitle = sheetClass ? sheetClass.class_name :
      (state.unassignedOnly ? course.course_name + ' — unassigned' : course.course_name);
    var sheetSubtitle = sheetClass ? SptStore.teacherName(d, sheetClass.teacher_id) + ' · ' + course.course_name :
      (state.unassignedOnly ? 'Pupils not linked to a class' : '');
    var groupAwardTag = '';
    if (course.slug === 'npa-photo') {
      var hasL4 = enrolments.some(function(r) {
        return SptEvidence.isNpaPhotoLevel4(r.enrolment.current_level);
      });
      var hasL5 = enrolments.some(function(r) {
        return !SptEvidence.isNpaPhotoLevel4(r.enrolment.current_level);
      });
      if (hasL4 && hasL5) {
        groupAwardTag = (course.group_award_l4 || 'GR4L 44') + ' / ' + (course.group_award_l5 || 'GR4M 45');
      } else if (hasL4) {
        groupAwardTag = course.group_award_l4 || 'GR4L 44';
      } else {
        groupAwardTag = course.group_award_l5 || 'GR4M 45';
      }
    }
    var html = alertStripHtml();
    html += '<div class="course-focus-wrap">';
    html += '<div class="course-topbar">' +
      '<div class="course-topbar-left">' +
      '<button type="button" class="btn btn-secondary btn-sm" data-route="courses">← Classes</button>' +
      '<h1>' + esc(sheetTitle) + '</h1>' +
      (sheetSubtitle ? '<span class="course-topbar-meta">' + esc(sheetSubtitle) + '</span>' : '') +
      '<span class="course-topbar-meta">' + enrolments.length + ' pupils</span>' +
      (meta.mixedClass ? '<span class="course-topbar-tag">N5 + N4</span>' : '') +
      (groupAwardTag ? '<span class="course-topbar-tag">' + esc(groupAwardTag) + '</span>' : '') +
      '</div>' +
      '<div class="course-topbar-right">' +
      (canEdit ? '<button type="button" class="btn btn-sm" data-add-pupil-course="' + courseId + '">+ Add pupil</button>' : '') +
      '<button type="button" class="btn btn-secondary btn-sm layout-toggle-inline" id="nav-toggle-inline" title="Toggle navigation (N)">' +
      (state.navCollapsed ? 'Show menu' : 'Hide menu') + '</button>' +
      '</div></div>';

    var headGroup = '<tr class="head-group">';
    headGroup += '<th class="col-pupil" rowspan="2">Pupil</th><th rowspan="2">Level</th>';
    if (showTeachers) headGroup += '<th rowspan="2">Teacher</th>';
    if (meta.hasS3) {
      var s3Cfg = SptExamMark.s3ExamMarks(course);
      var s3Scale = s3Cfg.paper_marks === s3Cfg.scaled_marks
        ? ('/' + s3Cfg.paper_marks)
        : ('/' + s3Cfg.paper_marks + ' → ' + s3Cfg.scaled_marks);
      headGroup += '<th colspan="3" class="s3-exam-head" title="Enter raw mark — % and grade calculated automatically">S3 Exam' +
        '<span class="th-sub">' + esc(s3Scale) + '</span></th>' +
        '<th colspan="5" class="s3-baseline-head">S3 baseline' +
        (canEdit && s3BaselineEnrolmentIds ? '<button type="button" class="btn-tp-default" data-s3-baseline-default="1" data-tp-enrolments="' +
          esc(s3BaselineEnrolmentIds) + '" title="Set Eff, Beh, HL, Prog to 4 and CfE to Fourth">Default 4</button>' : '') +
        '</th>';
    }
    if (meta.hasPrior) headGroup += '<th rowspan="2">Prior exam</th><th rowspan="2">Pathway</th>';
    meta.evUnits.forEach(function(u) {
      headGroup += '<th rowspan="2" title="' + esc(u.unit_name) + '">' + esc(u.short_label) + '</th>';
    });
    headGroup += '<th rowspan="2">Flag</th>';
    tps.forEach(function(tp, i) {
      var date = formatTpShortDate(tp.tracking_point_date);
      headGroup += '<th colspan="3" class="tp-group-head ' + tpBandClass(i) + tpStartClass(i) + '">' +
        'TP' + (i + 1) +
        (date ? '<span class="tp-date">' + esc(date) + '</span>' : '') +
        (canEdit && sheetEnrolmentIds ? '<button type="button" class="btn-tp-default" data-tp-default="' + esc(tp.id) +
          '" data-tp-label="TP' + (i + 1) + '" data-tp-date="' + esc(tp.tracking_point_date || '') +
          '" data-tp-enrolments="' + esc(sheetEnrolmentIds) + '" title="Set all pupils to 4 (Good) for Att, Eff, and Beh">Default 4</button>' : '') +
        '</th>';
    });
    if (meta.hasExamPupils && prelimComps.length) {
      prelimComps.forEach(function(pc) {
        headGroup += '<th class="col-prelim" rowspan="2" title="' + esc(pc.component_name) + ' (' + pc.weighting + '%)">' +
          esc(SptPrelim.columnLabel(pc)) + '<span class="th-sub">' + esc(SptExamMark.componentScaleLabel(pc)) + '</span></th>';
      });
      if (prelimAp) {
        headGroup += '<th rowspan="2" title="Weighted prelim percentage">Prelim %</th>' +
          '<th rowspan="2" title="Grade band from prelim %">Prelim grade</th>';
      }
    }
    if (meta.hasExamPupils) {
      aps.filter(function(ap) { return ap.assessment_type !== 'Prelim'; }).slice(0, 3).forEach(function(ap) {
        headGroup += '<th rowspan="2">' + esc(ap.assessment_name.length > 12 ? ap.assessment_name.slice(0, 10) + '…' : ap.assessment_name) + '</th>';
      });
    }
    if (meta.hasEvPupils && !meta.hasExamPupils) headGroup += '<th rowspan="2">Units</th>';
    headGroup += '<th rowspan="2">Risk</th><th rowspan="2">Actions</th></tr>';

    var headSub = '<tr class="head-sub">';
    if (meta.hasS3) {
      headSub += '<th>Mark</th><th>%</th><th>Grade</th>';
      headSub += '<th>Eff</th><th>Beh</th><th>HL</th><th>Prog</th><th>CfE</th>';
    }
    tps.forEach(function(tp, i) {
      headSub += '<th' + tpColAttrs(i, '') + '>Att</th>';
      headSub += '<th class="' + tpBandClass(i) + '">Eff</th>';
      headSub += '<th class="' + tpBandClass(i) + '">Beh</th>';
    });
    headSub += '</tr>';
    var head = headGroup + headSub;

    var courseBody = '';
    enrolments.forEach(function(r) {
      var en = r.enrolment;
      courseBody += '<tr class="' +
        (r.open_flag_count ? 'row-flagged ' : '') +
        (r.crashing_subject ? 'row-crashing-subject' : '') + '">' +
        '<td class="col-pupil" data-enrolment="' + en.id + '">' + esc(SptStore.pupilName(d, r.pupil.id)) + '</td>';
      courseBody += levelCellHtml(r, course);
      if (showTeachers) {
        if (role().viewAll && canEdit) {
          courseBody += '<td><select class="inline-select" data-enrolment-teacher="' + en.id + '">' +
            courseTeachers.map(function(t) {
              return '<option value="' + t.id + '"' + (en.teacher_id === t.id ? ' selected' : '') + '>' +
                esc(t.first_name + ' ' + t.surname) + '</option>';
            }).join('') + '</select></td>';
        } else {
          courseBody += '<td>' + esc(r.teacher_name) + '</td>';
        }
      }
      if (meta.hasS3) {
        courseBody += s3ExamCells(r, course);
        courseBody += baselineFieldCell(r, 'effort', 'score');
        courseBody += baselineFieldCell(r, 'behaviour', 'score');
        courseBody += baselineFieldCell(r, 'homelearning', 'score');
        courseBody += baselineFieldCell(r, 'progress', 'score');
        courseBody += baselineFieldCell(r, 'cfe_level', 'cfe');
      }
      if (meta.hasPrior) courseBody += priorEntryCells(r, canEdit);
      meta.evUnits.forEach(function(u) {
        courseBody += evidenceUnitCell(r, u.unit_code, canEdit);
      });
      courseBody += '<td>' + (r.open_flag_count ? badge('Open') : '—') + '</td>';
      tps.forEach(function(tp, i) {
        var rec = (d.attendance_records || []).find(function(a) {
          return a.enrolment_id === en.id && a.tracking_point_id === tp.id;
        });
        var val = rec ? rec.attendance_score : '';
        courseBody += trackingAttCell(en.id, tp.id, val, canEdit, i);
        var tr = SptStore.trackingRecordFor(d, en.id, tp.id);
        courseBody += trackingScoreCell(en.id, tp.id, 'effort', tr, canEdit, i);
        courseBody += trackingScoreCell(en.id, tp.id, 'behaviour', tr, canEdit, i);
      });
      if (meta.hasExamPupils && prelimComps.length) {
        if (r.uses_exam_route) {
          prelimComps.forEach(function(pc) {
            var markRec = (d.prelim_marks || []).find(function(m) {
              return m.enrolment_id === en.id && m.prelim_component_id === pc.id;
            });
            var raw = markRec && markRec.raw_mark != null ? markRec.raw_mark : '';
            var paperMax = SptExamMark.componentMarks(pc).paper_marks;
            if (canEdit) {
              courseBody += '<td class="cell-prelim"><input type="number" class="prelim-inline" min="0" max="' + paperMax + '" step="0.5" ' +
                'data-prelim-mark="' + en.id + '|' + pc.id + '" value="' + (raw !== '' ? raw : '') + '" placeholder="—"></td>';
            } else {
              courseBody += '<td class="cell-num">' + esc(raw !== '' ? raw + SptExamMark.componentScaleLabel(pc) : '—') + '</td>';
            }
          });
          if (prelimAp) {
            courseBody += '<td class="cell-num cell-prelim-pct" data-prelim-pct-for="' + en.id + '">' +
              prelimPctHtml(r.prelim_summary) + '</td>';
            courseBody += '<td class="cell-grade cell-prelim-grade" data-prelim-grade-for="' + en.id + '">' +
              prelimGradeHtml(r.prelim_summary) + '</td>';
          }
        } else {
          courseBody += prelimComps.map(function() { return cellNa(); }).join('');
          if (prelimAp) courseBody += cellNa() + cellNa();
        }
      }
      if (meta.hasExamPupils) {
        var examAps = aps.filter(function(ap) { return ap.assessment_type !== 'Prelim'; }).slice(0, 3);
        if (r.uses_exam_route) {
          examAps.forEach(function(ap) {
            var res = SptStore.resultForAssessment(d, en.id, ap.id);
            courseBody += '<td>' + badge(res ? res.completion_status : 'Not Started') + '</td>';
          });
        } else {
          courseBody += examAps.map(function() { return cellNa(); }).join('');
        }
      }
      if (meta.hasEvPupils && !meta.hasExamPupils) {
        courseBody += '<td class="cell-num">' + esc(r.uses_evidence_bank ? r.units_banked + '/' + r.units_total : '—') + '</td>';
      }
      courseBody += '<td class="cell-risk">' + badge(en.risk_status) + '</td><td class="cell-actions">';
      if (role().canFlag) courseBody += '<button type="button" class="btn btn-sm" data-flag="' + en.id + '">Flag</button> ';
      var pendingLc = SptLevelChange.activeForEnrolment(d, en.id);
      if (canEdit && course.supports_level_change && !pendingLc) {
        courseBody += '<button type="button" class="btn btn-secondary btn-sm" data-level-change="' + en.id + '">Change level</button> ';
      }
      if (canEdit && canManageEnrolment(en) && !pendingLc) {
        courseBody += '<button type="button" class="btn btn-secondary btn-sm" data-withdraw-course="' + en.id + '">Withdraw</button> ';
      }
      if (pendingLc && canEdit) {
        courseBody += '<button type="button" class="btn btn-secondary btn-sm" data-route="level-changes">View request</button> ';
      }
      if (canManageEnrolment(en) && !pendingLc) {
        courseBody += '<button type="button" class="btn btn-secondary btn-sm" data-remove-enrolment="' + en.id + '">Remove</button>';
      }
      courseBody += '</td></tr>';
    });

    var sheetHint = '1 red · 2 amber · 3 yellow · 4 green';
    if (meta.hasEvPupils) sheetHint += ' · evidence';
    if (prelimComps.length) sheetHint += ' · prelims';
    if (role().canFlag) sheetHint += ' · flag concerns';
    html += sheetPanel('Tracking grid', enrolments.length + ' rows', sheetHint,
      '<table class="data-table course-grid"><thead>' + head + '</thead><tbody>' + courseBody + '</tbody></table>',
      '',
      examMarkSetupHtml(course, prelimComps, meta));
    html += '</div>';
    return html;
  }

  function showAddPupilToCourseModal(courseId) {
    var d = db();
    var course = SptStore.byId(d.courses, courseId);
    if (!course || !role().canEdit) return;
    var r = role();
    var teachers = SptStore.teachersForCourse(d, courseId);
    var classes = SptStore.classesForCourse(d, courseId);
    var levels = SptStore.levelsForCourse(course);
    var defaultTeacher = r.viewAll ? (teachers[0] && teachers[0].id) : d.simulated_teacher_id;
    if (!defaultTeacher && teachers.length) defaultTeacher = teachers[0].id;
    var defaultClassId = state.classId || null;
    if (defaultClassId) {
      var sheetClass = SptStore.byId(d.classes, defaultClassId);
      if (sheetClass && sheetClass.teacher_id) defaultTeacher = sheetClass.teacher_id;
    }
    var enrolledIds = {};
    (d.enrolments || []).filter(function(e) {
      return e.course_id === courseId && e.active_status !== false;
    }).forEach(function(e) { enrolledIds[e.pupil_id] = true; });
    var availablePupils = (d.pupils || []).filter(function(p) {
      return p.active_status !== false && !enrolledIds[p.id];
    }).sort(function(a, b) {
      return SptStore.pupilName(d, a.id).localeCompare(SptStore.pupilName(d, b.id));
    });
    var teacherOpts = teachers.map(function(t) {
      return '<option value="' + t.id + '"' + (t.id === defaultTeacher ? ' selected' : '') + '>' +
        esc(t.first_name + ' ' + t.surname) + '</option>';
    }).join('');
    var classOpts = '<option value="">— No class —</option>' + classes.map(function(cl) {
      return '<option value="' + cl.id + '"' + (cl.id === defaultClassId ? ' selected' : '') +
        ' data-teacher="' + cl.teacher_id + '">' + esc(cl.class_name) + '</option>';
    }).join('');
    var levelOpts = levels.map(function(l, i) {
      return '<option' + (i === 0 ? ' selected' : '') + '>' + esc(l) + '</option>';
    }).join('');
    var pupilOpts = availablePupils.length ?
      availablePupils.map(function(p) {
        return '<option value="' + p.id + '">' + esc(SptStore.pupilName(d, p.id) + ' (' + p.year_group + ')') + '</option>';
      }).join('') :
      '<option value="" disabled>No unenrolled pupils</option>';

    openModal('Add pupil to ' + course.course_name,
      '<form id="add-pupil-course-form" class="form-grid">' +
      '<p class="modal-note">Add a new arrival or enrol an existing pupil on this course. Assign them to the correct teacher.</p>' +
      '<div class="form-span pupil-mode-row">' +
      '<label><input type="radio" name="pupil_mode" value="new" checked> New pupil — type name</label> ' +
      '<label><input type="radio" name="pupil_mode" value="existing"> Existing pupil</label></div>' +
      '<div id="add-pupil-new-fields">' +
      '<div><label>First name</label><input name="first_name" required autocomplete="given-name"></div>' +
      '<div><label>Surname</label><input name="surname" required autocomplete="family-name"></div>' +
      '<div><label>Year group</label><select name="year_group">' + yearGroupOptionsHtml('S5/6') + '</select></div>' +
      '<div><label>Candidate no. (optional)</label><input name="candidate_number" placeholder="e.g. 2409999"></div></div>' +
      '<div id="add-pupil-existing-fields" hidden>' +
      '<div><label>Pupil</label><select name="pupil_id"><option value="">— Select pupil —</option>' + pupilOpts + '</select></div></div>' +
      '<div><label>Teacher</label><select name="teacher_id"' + (!r.viewAll ? ' disabled' : '') + '>' + teacherOpts + '</select>' +
      (!r.viewAll ? '<input type="hidden" name="teacher_id" value="' + esc(defaultTeacher || '') + '">' : '') + '</div>' +
      '<div><label>Class (optional)</label><select name="class_id"' +
      (defaultClassId && !r.viewAll ? ' disabled' : '') + '>' + classOpts + '</select>' +
      (defaultClassId && !r.viewAll ? '<input type="hidden" name="class_id" value="' + esc(defaultClassId) + '">' : '') + '</div>' +
      '<div><label>Course level</label><select name="current_level">' + levelOpts + '</select></div></form>',
      '<button type="button" class="btn btn-secondary" id="modal-cancel">Cancel</button>' +
      '<button type="button" class="btn" id="add-pupil-submit">Add to course</button>');

    var form = document.getElementById('add-pupil-course-form');
    var newFields = document.getElementById('add-pupil-new-fields');
    var existingFields = document.getElementById('add-pupil-existing-fields');
    form.querySelectorAll('[name=pupil_mode]').forEach(function(radio) {
      radio.addEventListener('change', function() {
        var isNew = form.pupil_mode.value === 'new';
        newFields.hidden = !isNew;
        existingFields.hidden = isNew;
        form.first_name.required = isNew;
        form.surname.required = isNew;
      });
    });
    form.class_id.addEventListener('change', function() {
      var opt = form.class_id.options[form.class_id.selectedIndex];
      var tid = opt && opt.getAttribute('data-teacher');
      if (tid && form.teacher_id) form.teacher_id.value = tid;
    });

    document.getElementById('add-pupil-submit').onclick = function() {
      var fd = new FormData(form);
      var mode = fd.get('pupil_mode');
      var teacherId = fd.get('teacher_id');
      if (!teacherId) { alert('Select a teacher'); return; }
      var opts = {
        courseId: courseId,
        teacherId: teacherId,
        classId: fd.get('class_id') || null,
        level: fd.get('current_level')
      };
      if (mode === 'existing') {
        if (!fd.get('pupil_id')) { alert('Select a pupil'); return; }
        opts.pupilId = fd.get('pupil_id');
      } else {
        opts.first_name = (fd.get('first_name') || '').trim();
        opts.surname = (fd.get('surname') || '').trim();
        opts.year_group = fd.get('year_group');
        opts.candidate_number = (fd.get('candidate_number') || '').trim();
        if (!opts.first_name || !opts.surname) { alert('Enter first and surname'); return; }
      }
      var result = SptStore.addPupilToCourse(db(), opts);
      if (result.error) { alert(result.error); return; }
      closeModal();
      setRoute('course', {
        courseId: courseId,
        classId: state.classId,
        unassignedOnly: state.unassignedOnly
      });
    };
    document.getElementById('modal-cancel').onclick = closeModal;
  }

  function confirmRemoveEnrolment(enrolmentId) {
    var d = db();
    var en = SptStore.byId(d.enrolments, enrolmentId);
    if (!en || !canManageEnrolment(en)) return;
    var name = SptStore.pupilName(d, en.pupil_id);
    var course = SptStore.courseName(d, en.course_id);
    if (!confirm('Remove ' + name + ' from ' + course + '?\n\nThey will disappear from tracking but their history is kept.')) return;
    SptStore.deactivateEnrolment(d, enrolmentId);
    render();
  }

  function confirmDeleteClass(classId) {
    if (!role().canSetup) return;
    var d = db();
    var cl = SptStore.byId(d.classes, classId);
    if (!cl) return;
    var count = SptStore.enrolmentCountForClass(d, classId);
    var msg = 'Delete class "' + cl.class_name + '"?';
    if (count) {
      msg += '\n\n' + count + ' enrolled pupil' + (count !== 1 ? 's' : '') +
        ' will become unassigned on the course sheet (they stay on the course).';
    } else {
      msg += '\n\nThis cannot be undone.';
    }
    if (!confirm(msg)) return;
    var result = SptStore.deleteClass(d, classId);
    if (result.error) {
      alert(result.error);
      return;
    }
    if (state.setupClassId === classId) state.setupClassId = null;
    if (state.classId === classId) {
      state.classId = null;
      if (state.route === 'course') state.route = 'courses';
    }
    state.setupMessage = 'Deleted class "' + result.className + '"' +
      (result.unassigned ? ' — ' + result.unassigned + ' pupil' + (result.unassigned !== 1 ? 's' : '') + ' unassigned' : '') + '.';
    render();
  }

  function showLevelChangeModal(enrolmentId) {
    var d = db();
    var en = SptStore.byId(d.enrolments, enrolmentId);
    if (!en || !role().canEdit) return;
    var course = SptStore.byId(d.courses, en.course_id);
    if (!course || !course.supports_level_change) return;
    if (SptLevelChange.activeForEnrolment(d, enrolmentId)) {
      alert('A level change or withdrawal is already pending for this pupil.');
      return;
    }
    var targets = SptLevelChange.targetLevels(course, en.current_level);
    if (!targets.length) { alert('No alternative levels available.'); return; }
    var levelOpts = targets.map(function(l) {
      return '<option value="' + esc(l) + '">' + esc(l) + '</option>';
    }).join('');
    openModal('Request level change',
      '<form id="level-change-form" class="form-grid">' +
      '<p class="modal-note">Creates a request in <strong>Level Changes</strong>. Tracking updates after Faculty Head confirms.</p>' +
      '<div><label>Current level</label><input value="' + esc(en.current_level) + '" disabled></div>' +
      '<div><label>Recommended level</label><select name="recommended_level" required>' + levelOpts + '</select></div>' +
      '<div><label>Reason</label><textarea name="reason_for_recommendation" required placeholder="Why is this level change recommended?"></textarea></div>' +
      '<div><label>Evidence summary</label><textarea name="evidence_summary" placeholder="Unit evidence, prelim, attendance…"></textarea></div>' +
      '<div><label><input type="checkbox" name="pupil_discussed" value="yes"> Pupil has been discussed with</label></div></form>',
      '<button type="button" class="btn btn-secondary" id="modal-cancel">Cancel</button>' +
      '<button type="button" class="btn" id="level-change-submit">Submit request</button>');
    document.getElementById('level-change-submit').onclick = function() {
      var f = document.getElementById('level-change-form');
      var fd = new FormData(f);
      var result = SptLevelChange.requestLevelChange(db(), enrolmentId, {
        recommended_level: fd.get('recommended_level'),
        reason_for_recommendation: (fd.get('reason_for_recommendation') || '').trim(),
        evidence_summary: (fd.get('evidence_summary') || '').trim(),
        pupil_discussed: !!fd.get('pupil_discussed')
      });
      if (result.error) { alert(result.error); return; }
      closeModal();
      setRoute('level-changes');
    };
    document.getElementById('modal-cancel').onclick = closeModal;
  }

  function showWithdrawModal(enrolmentId) {
    var d = db();
    var en = SptStore.byId(d.enrolments, enrolmentId);
    if (!en || !canManageEnrolment(en)) return;
    if (SptLevelChange.activeForEnrolment(d, enrolmentId)) {
      alert('A level change or withdrawal is already pending for this pupil.');
      return;
    }
    openModal('Request withdrawal from course',
      '<form id="withdraw-form" class="form-grid">' +
      '<p class="modal-note">Creates a withdrawal request in <strong>Level Changes</strong>. Pupil stays on the sheet until Faculty Head confirms.</p>' +
      '<div><label>Course</label><input value="' + esc(SptStore.courseName(d, en.course_id)) + '" disabled></div>' +
      '<div><label>Current level</label><input value="' + esc(en.current_level) + '" disabled></div>' +
      '<div><label>Reason for withdrawal</label><textarea name="reason_for_recommendation" required placeholder="Why is the pupil withdrawing?"></textarea></div>' +
      '<div><label><input type="checkbox" name="pupil_discussed" value="yes"> Pupil / parent discussed</label></div></form>',
      '<button type="button" class="btn btn-secondary" id="modal-cancel">Cancel</button>' +
      '<button type="button" class="btn" id="withdraw-submit">Submit withdrawal</button>');
    document.getElementById('withdraw-submit').onclick = function() {
      var f = document.getElementById('withdraw-form');
      var fd = new FormData(f);
      var result = SptLevelChange.requestWithdrawal(db(), enrolmentId, {
        reason_for_recommendation: (fd.get('reason_for_recommendation') || '').trim(),
        pupil_discussed: !!fd.get('pupil_discussed')
      });
      if (result.error) { alert(result.error); return; }
      closeModal();
      setRoute('level-changes');
    };
    document.getElementById('modal-cancel').onclick = closeModal;
  }

  function showFlagModal(enrolmentId) {
    var cats = SptConfig.CONCERN_CATEGORIES.map(function(c) {
      return '<option value="' + c + '">' + c + '</option>';
    }).join('');
    openModal('Flag concern for Faculty Head',
      '<p class="modal-note modal-note-warn">For attainment and classroom concerns only. ' +
      '<strong>Do not include sensitive or personal information</strong> — e.g. medical details, ' +
      'safeguarding, or child protection matters.</p>' +
      '<form id="flag-form" class="form-grid"><div><label>Category</label><select name="category">' + cats + '</select></div>' +
      '<div><label>Comment</label><textarea name="comment" required ' +
      'placeholder="Brief concern for the Faculty Head (no sensitive information)"></textarea></div></form>',
      '<button type="button" class="btn btn-secondary" id="modal-cancel">Cancel</button>' +
      '<button type="button" class="btn" id="flag-submit">Submit flag</button>');
    document.getElementById('flag-submit').onclick = function() {
      var f = document.getElementById('flag-form');
      SptConcerns.raiseFlag(db(), enrolmentId, {
        category: f.category.value,
        comment: f.comment.value
      });
      closeModal();
      render();
      updateNavBadge();
    };
    document.getElementById('modal-cancel').onclick = closeModal;
  }

  function showPrelimModal(enrolmentId, assessmentPointId) {
    var d = db();
    var comps = (d.prelim_components || []).filter(function(pc) { return pc.assessment_point_id === assessmentPointId; });
    var rows = comps.map(function(pc) {
      var m = (d.prelim_marks || []).find(function(x) {
        return x.enrolment_id === enrolmentId && x.prelim_component_id === pc.id;
      });
      var paperMax = SptExamMark.componentMarks(pc).paper_marks;
      return '<div class="prelim-row"><span>' + esc(pc.component_name) + ' ' + esc(SptExamMark.componentScaleLabel(pc)) + '</span>' +
        '<input type="number" min="0" max="' + paperMax + '" data-pc="' + pc.id + '" value="' + (m && m.raw_mark != null ? m.raw_mark : '') + '">' +
        '<span>' + pc.weighting + '%</span></div>';
    }).join('');
    var sum = SptPrelim.computeSummary(d, enrolmentId, assessmentPointId);
    openModal('Prelim marks',
      '<div class="prelim-grid">' + rows + '</div>' +
      (sum ? '<p style="margin-top:.75rem;font-size:.88rem"><strong>' +
        prelimPctHtml(sum) + ' · ' + prelimGradeHtml(sum) + '</strong></p>' : ''),
      '<button type="button" class="btn btn-secondary" id="modal-cancel">Cancel</button>' +
      '<button type="button" class="btn" id="prelim-save">Save marks</button>');
    document.getElementById('prelim-save').onclick = function() {
      document.querySelectorAll('#modal-body [data-pc]').forEach(function(inp) {
        SptPrelim.saveMark(db(), enrolmentId, inp.getAttribute('data-pc'), inp.value);
      });
      closeModal();
      render();
    };
    document.getElementById('modal-cancel').onclick = closeModal;
  }

  function showResolveModal(flagId) {
    var d = db();
    var flag = SptStore.byId(d.teacher_concerns, flagId);
    var en = SptStore.byId(d.enrolments, flag.enrolment_id);
    var ints = (d.interventions || []).filter(function(i) {
      return i.enrolment_id === en.id && i.intervention_status !== 'Completed';
    });
    var intOpts = ints.map(function(i) {
      return '<option value="' + i.id + '">' + esc(i.intervention_description.slice(0, 40)) + '</option>';
    }).join('');
    openModal('Resolve concern',
      '<p style="font-size:.85rem;margin-bottom:.75rem">' + esc(flag.comment) + '</p>' +
      '<form id="resolve-form" class="form-grid">' +
      '<div><label>Link existing intervention</label><select name="intervention_id"><option value="">Create new below</option>' + intOpts + '</select></div>' +
      '<div><label>New intervention description</label><textarea name="intervention_description" placeholder="If not linking existing"></textarea></div>' +
      '<div><label>Review date</label><input type="date" name="review_date"></div>' +
      '<div><label>Resolution note</label><input name="resolution_note"></div></form>',
      '<button type="button" class="btn btn-secondary" id="modal-cancel">Cancel</button>' +
      '<button type="button" class="btn" id="resolve-submit">Resolve with intervention</button>');
    document.getElementById('resolve-submit').onclick = function() {
      var f = document.getElementById('resolve-form');
      var payload = {
        intervention_id: f.intervention_id.value || null,
        resolution_note: f.resolution_note.value,
        create_intervention: !f.intervention_id.value,
        intervention_description: f.intervention_description.value,
        concern_area: flag.category,
        review_date: f.review_date.value,
        responsible_teacher_id: en.teacher_id
      };
      if (!payload.intervention_id && !payload.intervention_description) {
        alert('Select an existing intervention or describe a new one.');
        return;
      }
      SptConcerns.resolveFlag(db(), flagId, payload);
      closeModal();
      render();
      updateNavBadge();
    };
    document.getElementById('modal-cancel').onclick = closeModal;
  }

  function openDrawer(enrolmentId) {
    var d = db();
    var en = SptStore.byId(d.enrolments, enrolmentId);
    if (!en || !SptStore.canViewEnrolment(d, en)) return;
    var r = SptStore.getEnrichedRows(d).find(function(x) { return x.enrolment.id === enrolmentId; });
    var pupil = SptStore.byId(d.pupils, en.pupil_id);
    var course = SptStore.byId(d.courses, en.course_id);
    document.getElementById('drawer-title').textContent = SptStore.pupilName(d, pupil.id);
    document.getElementById('drawer-sub').textContent = course.course_name + ' · ' + en.current_level;
    var body = '';
    if (r.shows_s3_baseline && r.s3_baseline) {
      var b = r.s3_baseline;
      body += '<div class="profile-section"><h3>S3 entry baseline</h3><dl class="profile-grid">' +
        '<dt>S3 exam</dt><dd>' + s3ExamDisplayHtml(b, course) + '</dd>' +
        '<dt>Effort</dt><dd>' + esc(b.effort != null ? b.effort : '—') + '</dd>' +
        '<dt>Behaviour</dt><dd>' + esc(b.behaviour != null ? b.behaviour : '—') + '</dd>' +
        '<dt>Home learning</dt><dd>' + esc(b.homelearning != null ? b.homelearning : '—') + '</dd>' +
        '<dt>Progress</dt><dd>' + scorePillHtml(b.progress != null && b.progress !== '' ? b.progress : '') + '</dd>' +
        '<dt>CfE level</dt><dd>' + esc(b.cfe_level || '—') + '</dd></dl></div>';
    }
    if (r.shows_prior_entry && r.prior_main) {
      body += '<div class="profile-section"><h3>Prior attainment</h3><dl class="profile-grid">' +
        '<dt>Grade</dt><dd>' + esc(r.prior_display.grade) + '</dd>' +
        '<dt>Pathway</dt><dd>' + badge(r.prior_display.pathway) + '</dd></dl></div>';
    } else if (r.prior_attainment.length) {
      body += '<div class="profile-section"><h3>Prior attainment</h3><ul class="profile-list">';
      r.prior_attainment.forEach(function(p) {
        body += '<li>' + esc(p.qualification_year) + ' ' + esc(p.qualification_level) + ': ' + esc(p.result_grade) + ' ' + badge(p.pathway_status) + '</li>';
      });
      body += '</ul></div>';
    }
    if (r.uses_evidence_bank && r.evidence_rows.length) {
      body += '<div class="profile-section"><h3>Unit evidence</h3><ul class="profile-list">';
      r.evidence_rows.forEach(function(ev) {
        body += '<li><strong>' + esc(ev.unit_code || '') + '</strong> ' + esc(ev.unit_or_component) + ' — ' + badge(ev.evidence_status) + '</li>';
      });
      body += '</ul></div>';
    }
    if (r.level_change && SptLevelChange.isPending(r.level_change)) {
      var plc = r.level_change;
      body += '<div class="profile-section"><h3>Pending ' + (plc.change_type === 'withdrawal' ? 'withdrawal' : 'level change') + '</h3>';
      if (plc.change_type === 'withdrawal') {
        body += '<p>Withdrawal requested — ' + badge(plc.current_status) + '</p>';
      } else {
        body += '<p>' + esc(plc.original_level) + ' → <strong>' + esc(plc.recommended_level) + '</strong> ' + badge(plc.current_status) + '</p>';
      }
      if (plc.reason_for_recommendation) body += '<p class="cell-hint">' + esc(plc.reason_for_recommendation) + '</p>';
      body += '<button type="button" class="btn btn-secondary btn-sm" id="drawer-level-changes">View in Level Changes</button></div>';
    }
    body += '<div class="profile-section"><h3>Tracking periods (1–4)</h3><ul class="profile-list">';
    r.tracking_data.forEach(function(t, i) {
      var att = r.attendance[i];
      var attLbl = att && att.record ? att.record.attendance_score : '—';
      var eff = t.record ? SptStore.trackingScoreValue(t.record, 'effort') : '';
      var beh = t.record ? SptStore.trackingScoreValue(t.record, 'behaviour') : '';
      body += '<li>TP' + (i + 1) + ': Att ' + attLbl + ' · Eff ' + (eff !== '' ? eff : '—') + ' · Beh ' + (beh !== '' ? beh : '—') + '</li>';
    });
    body += '</ul></div>';
    if (r.open_flags.length) {
      body += '<div class="profile-section"><h3>Open teacher flags</h3><ul class="profile-list">';
      r.open_flags.forEach(function(f) {
        body += '<li><strong>' + esc(f.category) + '</strong>: ' + esc(f.comment) + '</li>';
      });
      body += '</ul></div>';
    }
    body += '<div class="profile-section"><h3>Overview</h3><dl class="profile-grid">' +
      '<dt>Teacher</dt><dd>' + esc(SptStore.teacherName(d, en.teacher_id)) + '</dd>' +
      '<dt>Target</dt><dd>' + esc(en.target_grade) + '</dd>' +
      '<dt>Working</dt><dd>' + esc(en.latest_working_grade) + '</dd>' +
      '<dt>Risk</dt><dd>' + badge(en.risk_status) + '</dd></dl></div>';
    if (role().canFlag) {
      body += '<button type="button" class="btn btn-sm" id="drawer-flag" data-enrolment="' + en.id + '">Flag concern</button> ';
    }
    body += '<button type="button" class="btn btn-secondary btn-sm" id="drawer-prelim" style="margin-top:.5rem">Prelim / tracking detail</button>';
    document.getElementById('drawer-body').innerHTML = body;
    document.getElementById('drawer-backdrop').classList.add('open');
    document.getElementById('pupil-drawer').classList.add('open');
    var df = document.getElementById('drawer-flag');
    if (df) df.onclick = function() { showFlagModal(en.id); };
    var dlc = document.getElementById('drawer-level-changes');
    if (dlc) dlc.onclick = function() { closeDrawer(); setRoute('level-changes'); };
  }

  function closeDrawer() {
    document.getElementById('drawer-backdrop').classList.remove('open');
    document.getElementById('pupil-drawer').classList.remove('open');
  }

  function renderEvidence() {
    var d = db();
    var allRows = getEvidenceBankRows(d);
    var filterTeachers = teachersForFilterBar(d, evidenceRowsForTeacherFilter(allRows));
    sanitizeTeacherFilter(filterTeachers);
    var rows = applyEvidenceEnrolmentFilters(allRows);
    var canEdit = role().canEdit;
    var maxUnits = rows.reduce(function(m, r) { return Math.max(m, r.evidence_rows.length); }, 0);
    var html = '<div class="page-head"><h1>Evidence Bank</h1>' +
      '<p class="page-sub">N3/N4 pupils, Creative Industries, and Film &amp; Screen — unit evidence statuses.</p></div>' +
      entryGuideHtml('evidence') +
      filtersHtml(d,
        '<div class="filter-field"><label>Status</label><select data-filter="evidenceStatus"><option value="">All</option>' +
        SptConfig.STATUS.evidence.map(function(s) { return '<option value="' + s + '">' + s + '</option>'; }).join('') +
        '</select></div>' +
        '<div class="filter-field"><label>Evidence</label><select data-filter="evidence"><option value="">All</option>' +
        '<option value="missing">Missing only</option></select></div>',
        filterTeachers);
    var head = '<th class="col-pupil">Pupil</th><th>Course</th>';
    for (var i = 0; i < maxUnits; i++) {
      head += '<th class="cell-num">Unit code</th><th>Status</th>';
    }
    var evRows = '';
    rows.forEach(function(row) {
      var en = row.enrolment;
      evRows += '<tr data-enrolment="' + en.id + '">' +
        '<td class="col-pupil">' + esc(SptStore.pupilName(d, en.pupil_id)) + '</td>' +
        '<td>' + esc(row.course.course_name) + '</td>';
      row.evidence_rows.forEach(function(ev) {
        evRows += '<td class="cell-num">' + esc(ev.unit_code || '—') + '</td>' +
          '<td>' + SptEvidence.statusCellHtml(ev, canEdit) + '</td>';
      });
      for (var j = row.evidence_rows.length; j < maxUnits; j++) {
        evRows += cellNa() + cellNa();
      }
      evRows += '</tr>';
    });
    var unitCount = rows.reduce(function(n, r) { return n + r.evidence_rows.length; }, 0);
    html += sheetPanel('Evidence register', rows.length + ' pupils · ' + unitCount + ' units', 'Click row for pupil profile',
      '<table class="data-table evidence-grid"><thead><tr>' + head + '</tr></thead><tbody>' + evRows + '</tbody></table>');
    return html;
  }

  function renderLevelChanges() {
    var d = db();
    var r = role();
    var list = (d.level_changes || []).filter(function(lc) {
      var en = SptStore.byId(d.enrolments, lc.enrolment_id);
      if (!en || !SptStore.canViewEnrolment(d, en)) return false;
      if (en.active_status === false && lc.current_status === 'Completed') return false;
      if (lc.change_type === 'withdrawal') return true;
      var course = SptStore.byId(d.courses, en.course_id);
      return course && course.supports_level_change;
    }).sort(function(a, b) {
      var pendingA = SptLevelChange.isPending(a) ? 0 : 1;
      var pendingB = SptLevelChange.isPending(b) ? 0 : 1;
      if (pendingA !== pendingB) return pendingA - pendingB;
      return (b.updated_at || '').localeCompare(a.updated_at || '');
    });
    var pending = list.filter(function(lc) { return SptLevelChange.isPending(lc); }).length;
    var html = '<div class="page-head"><h1>Level Changes &amp; Withdrawals</h1>' +
      '<p class="page-sub">Requests from course sheets — confirm here to update tracking.</p></div>' +
      '<div class="entry-guide entry-guide-inline">Teachers request via <strong>Change level</strong> or <strong>Withdraw</strong> on the course sheet · Faculty Head <strong>confirms</strong> to apply</div>';
    var rows = '';
    list.forEach(function(lc) {
      var en = SptStore.byId(d.enrolments, lc.enrolment_id);
      var typeLabel = lc.change_type === 'withdrawal' ? 'Withdrawal' : 'Level change';
      var toCell = lc.change_type === 'withdrawal' ? 'Withdraw from course' : esc(lc.recommended_level);
      rows += '<tr data-level-change="' + lc.id + '">' +
        '<td class="col-pupil">' + esc(SptStore.pupilName(d, en.pupil_id)) + '</td>' +
        '<td>' + esc(SptStore.courseName(d, en.course_id)) + '</td>' +
        '<td>' + esc(typeLabel) + '</td>' +
        '<td>' + esc(lc.original_level) + '</td>' +
        '<td>' + toCell + '</td>' +
        '<td>' + badge(lc.current_status) + '</td>' +
        '<td class="cell-actions">';
      if (r.canApproveLevelChange && SptLevelChange.isPending(lc)) {
        if (lc.current_status === 'Under Review') {
          rows += '<button type="button" class="btn btn-secondary btn-sm" data-level-approve="' + lc.id + '">Approve</button> ';
        }
        rows += '<button type="button" class="btn btn-sm" data-level-confirm="' + lc.id + '">Confirm &amp; apply</button> ';
        rows += '<button type="button" class="btn btn-secondary btn-sm" data-level-reject="' + lc.id + '">Reject</button>';
      } else if (lc.current_status === 'Completed') {
        rows += '<span class="cell-hint">' + (lc.confirmed_on_sqa_system ? 'Applied to tracking' : '—') + '</span>';
      } else {
        rows += '—';
      }
      rows += '</td></tr>';
    });
    if (!rows) rows = '<tr><td colspan="7" class="empty">No level change or withdrawal requests.</td></tr>';
    html += sheetPanel('Requests', pending + ' pending · ' + list.length + ' total', 'Confirm applies level or removes pupil from course',
      '<table class="data-table"><thead><tr>' +
      '<th class="col-pupil">Pupil</th><th>Course</th><th>Type</th><th>From</th><th>To</th><th>Status</th><th>Actions</th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table>');
    return html;
  }

  function renderInterventions() {
    var d = db();
    var list = (d.interventions || []).filter(function(i) {
      var en = SptStore.byId(d.enrolments, i.enrolment_id);
      return en && SptStore.canViewEnrolment(d, en);
    });
    var html = '<div class="page-head"><h1>Intervention Tracker</h1></div><div class="card"><div class="table-wrap"><table class="data-table">';
    html += '<thead><tr><th>Pupil</th><th>Intervention</th><th>Review</th><th>Status</th></tr></thead><tbody>';
    list.forEach(function(i) {
      var en = SptStore.byId(d.enrolments, i.enrolment_id);
      var overdue = new Date(i.review_date) < new Date();
      html += '<tr data-enrolment="' + en.id + '"' + (overdue ? ' class="row-flagged"' : '') + '><td>' + esc(SptStore.pupilName(d, en.pupil_id)) + '</td>' +
        '<td>' + esc(i.intervention_description) + '</td><td>' + esc(i.review_date) + '</td><td>' + badge(i.intervention_status) + '</td></tr>';
    });
    return html + '</tbody></table></div></div>';
  }

  function renderImport() {
    var html = '<div class="page-head"><h1>Import School Tracking</h1>' +
      '<p>Download an Excel workbook (one sheet per subject), enter data offline, then upload. ' +
      'Re-upload the same file each tracking period — new rows are added and existing rows update.</p></div>';

    if (state.importMessage) {
      html += '<div class="card" style="padding:1rem;margin-bottom:1rem"><p class="hub-staff-status">' +
        esc(state.importMessage) + '</p></div>';
    }

    if (state.importStep === 1) {
      html += '<div class="card"><div class="card-head"><h2>Excel workbook</h2></div><div class="card-body">' +
        '<p class="sheet-hint">Sheets: Instructions, Drama, Art, Photography, Film and Screen, Creative Industries. ' +
        'One row per pupil × course × tracking point.</p>' +
        '<div class="setup-quick-actions" style="margin-bottom:1rem">' +
        '<button type="button" class="btn btn-sm" id="template-download-blank">Download blank template</button>' +
        '<button type="button" class="btn btn-secondary btn-sm" id="template-download-filled">Download with current data</button>' +
        '</div>' +
        '<p class="sheet-hint" style="margin-top:1rem"><strong>Upload completed workbook</strong> (.xlsx)</p>' +
        '<input type="file" id="import-workbook-file" accept=".xlsx,.xls" style="margin-top:0.35rem">' +
        '</div></div>';

      html += '<div class="card" style="margin-top:1rem"><div class="card-head"><h2>CSV (existing enrolments only)</h2></div>' +
        '<div class="card-body"><p class="sheet-hint">Updates tracking for pupils already enrolled — does not create classes or pupils.</p>' +
        '<input type="file" id="import-file" accept=".csv"> ' +
        '<button type="button" class="btn btn-sm btn-secondary" id="import-load-sample">Load sample CSV</button></div></div>';
      return html;
    }

    if (state.importStep === 2 && state.templatePreview) {
      var prev = state.templatePreview;
      var previewRows = prev.items.slice(0, 40).map(function(item) {
        var r = item.row;
        return '<tr class="' + (item.status === 'error' ? 'row-flagged' : '') + '">' +
          '<td>' + esc(r._sheet) + '</td>' +
          '<td class="col-pupil">' + esc((r.pupil_first || '') + ' ' + (r.pupil_surname || '')) + '</td>' +
          '<td>' + esc(r.course) + '</td>' +
          '<td>' + esc(r.tracking_point) + '</td>' +
          '<td>' + badge(item.status === 'ready' ? 'Green' : item.status === 'warn' ? 'Amber' : 'Missing') + '</td>' +
          '<td>' + esc(item.note || '—') + '</td></tr>';
      }).join('');
      html += '<div class="card"><div class="card-body">' +
        '<p><strong>' + prev.total + ' rows</strong> from ' + esc(state.importFilename || 'workbook') + ' — ' +
        prev.ready + ' ready, ' + prev.warn + ' warnings, ' + prev.error + ' errors</p>' +
        '<div class="setup-quick-actions" style="margin-bottom:1rem">' +
        '<button type="button" class="btn" id="template-commit">Import workbook</button>' +
        '<button type="button" class="btn btn-secondary" id="import-cancel">Cancel</button></div>' +
        sheetPanel('Preview', 'First ' + Math.min(40, prev.items.length) + ' rows', '',
          '<table class="data-table"><thead><tr>' +
          '<th>Sheet</th><th class="col-pupil">Pupil</th><th>Course</th><th>Tracking point</th><th>Status</th><th>Note</th>' +
          '</tr></thead><tbody>' + (previewRows || '<tr><td colspan="6" class="empty">No rows found</td></tr>') +
          '</tbody></table>') +
        '</div></div>';
      return html;
    }

    if (state.importStep === 3 && state.importPreview) {
      var matched = state.importPreview.filter(function(p) { return p.match.status === 'matched'; }).length;
      html += '<div class="card" style="padding:1rem"><p>' + matched + ' of ' + state.importPreview.length +
        ' CSV rows matched existing enrolments.</p>' +
        '<button type="button" class="btn" id="import-commit">Import matched rows</button> ' +
        '<button type="button" class="btn btn-secondary" id="import-cancel">Cancel</button></div>';
    }
    return html;
  }

  function renderReports() {
    if (state.reportId && SptReports.REPORTS[state.reportId]) {
      var rep = SptReports.REPORTS[state.reportId];
      var data = rep.fn(db());
      var repRows = data.map(function(row) {
        return '<tr>' + rep.headers.map(function(h, i) {
          return '<td' + (i === 0 ? ' class="col-pupil"' : '') + '>' + esc(row[h]) + '</td>';
        }).join('') + '</tr>';
      }).join('');
      return '<div class="page-head"><h1>' + esc(rep.title) + '</h1></div>' +
        '<p style="margin-bottom:.75rem"><button type="button" class="btn btn-secondary btn-sm" data-route="reports">Back</button> ' +
        '<button type="button" class="btn btn-sm" id="export-csv" data-report="' + state.reportId + '">Export CSV</button></p>' +
        sheetPanel(rep.title, data.length + ' rows', 'Export for meetings or records', '<table class="data-table"><thead><tr>' +
        rep.headers.map(function(h, i) { return '<th' + (i === 0 ? ' class="col-pupil"' : '') + '>' + esc(h) + '</th>'; }).join('') +
        '</tr></thead><tbody>' + repRows + '</tbody></table>');
    }
    var html = '<div class="page-head"><h1>Reports</h1></div><div class="report-grid">';
    Object.keys(SptReports.REPORTS).forEach(function(id) {
      html += '<div class="report-tile" data-report="' + id + '"><h3>' + esc(SptReports.REPORTS[id].title) + '</h3></div>';
    });
    return html + '</div>';
  }

  function bindFilters(root) {
    root.querySelectorAll('[data-filter]').forEach(function(el) {
      var key = el.getAttribute('data-filter');
      if (state.filters[key]) el.value = state.filters[key];
      el.addEventListener('change', function() {
        if (el.value) state.filters[key] = el.value; else delete state.filters[key];
        render();
      });
    });
  }

  function bindMainEvents(root) {
    root.querySelectorAll('[data-route]').forEach(function(el) {
      el.addEventListener('click', function() { setRoute(el.getAttribute('data-route')); });
    });
    root.querySelectorAll('[data-enrolment]').forEach(function(el) {
      el.addEventListener('click', function(e) {
        if (e.target.closest('select, input, button')) return;
        openDrawer(el.getAttribute('data-enrolment'));
      });
    });
    root.querySelectorAll('.col-pupil[data-enrolment]').forEach(function(el) {
      el.addEventListener('click', function(e) {
        if (e.target.closest('select, input, button')) return;
        openDrawer(el.getAttribute('data-enrolment'));
      });
    });
    root.querySelectorAll('[data-class-sheet]').forEach(function(el) {
      el.addEventListener('click', function() {
        setRoute('course', {
          courseId: el.getAttribute('data-course'),
          classId: el.getAttribute('data-class') || null,
          unassignedOnly: el.hasAttribute('data-unassigned')
        });
      });
    });
    root.querySelectorAll('[data-course]').forEach(function(el) {
      if (el.hasAttribute('data-class-sheet')) return;
      el.addEventListener('click', function() { setRoute('course', { courseId: el.getAttribute('data-course') }); });
    });
    root.querySelectorAll('[data-class-teacher]').forEach(function(el) {
      el.addEventListener('change', function() {
        if (!role().canSetup) return;
        SptStore.updateClassTeacher(db(), el.getAttribute('data-class-teacher'), el.value);
        render();
      });
    });
    root.querySelectorAll('[data-report]').forEach(function(el) {
      el.addEventListener('click', function() { state.reportId = el.getAttribute('data-report'); render(); });
    });
    root.querySelectorAll('[data-flag]').forEach(function(el) {
      el.addEventListener('click', function(e) { e.stopPropagation(); showFlagModal(el.getAttribute('data-flag')); });
    });
    root.querySelectorAll('[data-add-pupil-course]').forEach(function(el) {
      el.addEventListener('click', function() { showAddPupilToCourseModal(el.getAttribute('data-add-pupil-course')); });
    });
    root.querySelectorAll('[data-remove-enrolment]').forEach(function(el) {
      el.addEventListener('click', function(e) {
        e.stopPropagation();
        confirmRemoveEnrolment(el.getAttribute('data-remove-enrolment'));
      });
    });
    root.querySelectorAll('[data-level-change]').forEach(function(el) {
      el.addEventListener('click', function(e) {
        e.stopPropagation();
        showLevelChangeModal(el.getAttribute('data-level-change'));
      });
    });
    root.querySelectorAll('[data-withdraw-course]').forEach(function(el) {
      el.addEventListener('click', function(e) {
        e.stopPropagation();
        showWithdrawModal(el.getAttribute('data-withdraw-course'));
      });
    });
    root.querySelectorAll('[data-level-approve]').forEach(function(el) {
      el.addEventListener('click', function() {
        SptLevelChange.approveChange(db(), el.getAttribute('data-level-approve'));
        render();
      });
    });
    root.querySelectorAll('[data-level-confirm]').forEach(function(el) {
      el.addEventListener('click', function() {
        var lcId = el.getAttribute('data-level-confirm');
        var lc = SptStore.byId(db().level_changes, lcId);
        var en = lc ? SptStore.byId(db().enrolments, lc.enrolment_id) : null;
        var msg = lc && lc.change_type === 'withdrawal' ?
          'Confirm withdrawal? Pupil will be removed from the course tracking sheet.' :
          'Confirm level change? Tracking will update to the new level.';
        if (!confirm(msg)) return;
        var result = SptLevelChange.confirmAndApply(db(), lcId);
        if (result.error) { alert(result.error); return; }
        if (en) setRoute('course', { courseId: en.course_id, classId: en.class_id || null });
        else render();
      });
    });
    root.querySelectorAll('[data-level-reject]').forEach(function(el) {
      el.addEventListener('click', function() {
        var notes = prompt('Reason for rejecting this request (optional):') || '';
        SptLevelChange.rejectChange(db(), el.getAttribute('data-level-reject'), notes);
        render();
      });
    });
    root.querySelectorAll('[data-enrolment-teacher]').forEach(function(el) {
      el.addEventListener('change', function(e) {
        e.stopPropagation();
        SptStore.updateEnrolmentTeacher(db(), el.getAttribute('data-enrolment-teacher'), el.value);
        render();
      });
    });
    root.querySelectorAll('[data-prelim-mark]').forEach(function(el) {
      el.addEventListener('input', function() {
        var p = el.getAttribute('data-prelim-mark').split('|');
        var row = el.closest('tr');
        updatePrelimResultCell(p[0], prelimOverridesFromRow(row));
      });
      el.addEventListener('change', function(e) {
        e.stopPropagation();
        var p = el.getAttribute('data-prelim-mark').split('|');
        SptPrelim.saveMark(db(), p[0], p[1], el.value);
        updatePrelimResultCell(p[0]);
        updateEnrolmentRiskCell(p[0]);
      });
    });
    root.querySelectorAll('[data-resolve-flag]').forEach(function(el) {
      el.addEventListener('click', function() { showResolveModal(el.getAttribute('data-resolve-flag')); });
    });
    root.querySelectorAll('[data-view-enrolment]').forEach(function(el) {
      el.addEventListener('click', function() { openDrawer(el.getAttribute('data-view-enrolment')); });
    });
    root.querySelectorAll('[data-att]').forEach(function(el) {
      el.addEventListener('change', function() {
        var p = el.getAttribute('data-att').split('|');
        SptStore.upsertAttendance(db(), p[0], p[1], el.value);
        applyScoreSelectColor(el);
        updateEnrolmentRiskCell(p[0]);
      });
    });
    root.querySelectorAll('[data-tp-default]').forEach(function(el) {
      el.addEventListener('click', function(e) {
        e.stopPropagation();
        if (!role().canEdit) return;
        showDefaultTpModal(
          el.getAttribute('data-tp-default'),
          el.getAttribute('data-tp-label') || 'Tracking period',
          el.getAttribute('data-tp-date') || '',
          sheetEnrolmentIdsFromButton(el)
        );
      });
    });
    root.querySelectorAll('[data-s3-baseline-default]').forEach(function(el) {
      el.addEventListener('click', function(e) {
        e.stopPropagation();
        showDefaultS3BaselineModal(sheetEnrolmentIdsFromButton(el));
      });
    });
    root.querySelectorAll('[data-tracking]').forEach(function(el) {
      el.addEventListener('change', function() {
        var p = el.getAttribute('data-tracking').split('|');
        SptStore.upsertTrackingScore(db(), p[0], p[1], p[2], el.value);
        applyScoreSelectColor(el);
        updateEnrolmentRiskCell(p[0]);
      });
    });
    root.querySelectorAll('[data-evidence]').forEach(function(el) {
      el.addEventListener('change', function() {
        SptStore.updateRecord(db(), 'evidence_bank', el.getAttribute('data-evidence'), { evidence_status: el.value }, 'evidence_update');
        var row = el.closest('tr');
        if (!row) return;
        var pupilTd = row.querySelector('.col-pupil[data-enrolment]');
        var enId = pupilTd ? pupilTd.getAttribute('data-enrolment') : row.getAttribute('data-enrolment');
        if (enId) updateEnrolmentRiskCell(enId);
      });
    });
    root.querySelectorAll('.s3-exam-raw').forEach(function(el) {
      el.addEventListener('input', function() {
        var p = el.getAttribute('data-s3-raw').split('|');
        var courseId = state.courseId;
        var course = SptStore.byId(db().courses, courseId);
        var result = SptExamMark.computeS3Result(
          el.value === '' ? null : parseFloat(el.value),
          course
        );
        var pctEl = document.querySelector('[data-s3-pct-for="' + p[0] + '"]');
        var gradeEl = document.querySelector('[data-s3-grade-for="' + p[0] + '"]');
        if (pctEl) pctEl.textContent = result ? result.percentage + '%' : '—';
        if (gradeEl) gradeEl.innerHTML = result && result.grade ? gradeBandHtml(result.grade) : '—';
      });
    });
    root.querySelectorAll('[data-exam-setup-toggle]').forEach(function(el) {
      el.addEventListener('click', function() {
        var panel = el.closest('[data-exam-setup-panel]');
        if (!panel) return;
        var courseId = panel.getAttribute('data-exam-setup-course');
        var open = panel.classList.toggle('is-open');
        panel.classList.toggle('is-collapsed', !open);
        var body = panel.querySelector('.exam-setup-body');
        if (body) body.hidden = !open;
        el.setAttribute('aria-expanded', open ? 'true' : 'false');
        try {
          localStorage.setItem('spt-exam-setup-' + courseId, open ? '1' : '0');
        } catch (e) { /* ignore */ }
      });
    });
    root.querySelectorAll('[data-s3-exam-config]').forEach(function(el) {
      el.addEventListener('change', function() {
        var parts = el.getAttribute('data-s3-exam-config').split('|');
        var patch = {};
        patch[parts[1]] = parseFloat(el.value) || 100;
        SptExamMark.updateS3ExamMarks(db(), parts[0], patch);
        SptStore.save(db());
        if (state.route === 'course' && state.courseId === parts[0]) render();
      });
    });
    root.querySelectorAll('[data-component-config]').forEach(function(el) {
      el.addEventListener('change', function() {
        var parts = el.getAttribute('data-component-config').split('|');
        var patch = {};
        patch[parts[1]] = parseFloat(el.value) || 100;
        SptPrelim.updateComponentConfig(db(), parts[0], patch);
        SptStore.save(db());
        if (state.route === 'course') render();
      });
    });
    root.querySelectorAll('[data-baseline]').forEach(function(el) {
      el.addEventListener('change', function() {
        var p = el.getAttribute('data-baseline').split('|');
        var field = p[1];
        if (!canEditBaselineField(field)) return;
        var val = el.value;
        var patch = {};
        if (field === 's3_exam_raw') {
          var course = SptStore.byId(db().courses, state.courseId);
          SptBaseline.applyS3ExamRaw(db(), p[0], val, course);
          SptStore.save(db());
          updateS3ExamDerivedCells(p[0], course);
          return;
        }
        if (field === 's3_exam_mark') {
          var band = SptBaseline.bandFromMark(val);
          patch.s3_exam_raw = val === '' ? null : parseFloat(val);
          patch.s3_exam_mark = val === '' ? null : parseFloat(val);
          patch.s3_exam_grade = band;
          SptStore.upsertBaseline(db(), p[0], patch);
          return;
        }
        if (field === 'effort' || field === 'behaviour' || field === 'homelearning' || field === 'progress') {
          patch[field] = val === '' ? null : parseInt(val, 10);
        } else {
          patch[field] = val;
        }
        SptStore.upsertBaseline(db(), p[0], patch);
        if (field === 'effort' || field === 'behaviour' || field === 'homelearning' || field === 'progress') {
          applyScoreSelectColor(el);
        }
      });
    });
    root.querySelectorAll('[data-baseline]').forEach(function(el) {
      if (el.tagName === 'INPUT') {
        el.addEventListener('blur', function() { el.dispatchEvent(new Event('change')); });
      }
    });
    root.querySelectorAll('[data-dismiss-crashing]').forEach(function(el) {
      el.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        if (!role().canEdit) return;
        var enId = el.getAttribute('data-dismiss-crashing');
        SptStore.upsertPriorForCourse(db(), enId, { crashing_dismissed: true });
        if (state.route === 'course') render();
      });
    });
    root.querySelectorAll('[data-prior]').forEach(function(el) {
      function savePrior() {
        if (!role().canEdit) return;
        var p = el.getAttribute('data-prior').split('|');
        var patch = {};
        patch[p[1]] = el.value;
        SptStore.upsertPriorForCourse(db(), p[0], patch);
        updateEnrolmentRiskCell(p[0]);
        if (state.route === 'course') render();
      }
      el.addEventListener('change', savePrior);
      if (el.tagName === 'INPUT') {
        el.addEventListener('blur', savePrior);
      }
    });
    root.querySelectorAll('[data-setup-tab]').forEach(function(el) {
      el.addEventListener('click', function() {
        state.setupTab = el.getAttribute('data-setup-tab');
        render();
      });
    });
    root.querySelectorAll('[data-setup-teacher]').forEach(function(el) {
      el.addEventListener('change', function() {
        state.setupTeacherId = el.value || null;
        state.setupClassId = null;
        state.setupMessage = null;
        render();
      });
    });
    root.querySelectorAll('[data-setup-class]').forEach(function(el) {
      el.addEventListener('click', function() {
        state.setupClassId = el.getAttribute('data-setup-class');
        state.setupMessage = null;
        render();
        var panel = document.getElementById('setup-class-panel');
        if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
    root.querySelectorAll('[data-setup-class-clear]').forEach(function(el) {
      el.addEventListener('click', function() {
        state.setupClassId = null;
        state.setupMessage = null;
        render();
      });
    });
    root.querySelectorAll('[data-pupil-year]').forEach(function(el) {
      el.addEventListener('change', function() {
        if (!role().canSetup) return;
        SptStore.updateRecord(db(), 'pupils', el.getAttribute('data-pupil-year'), { year_group: el.value }, 'pupil_year_update');
      });
    });
    root.querySelectorAll('[data-class-year]').forEach(function(el) {
      el.addEventListener('change', function() {
        if (!role().canSetup) return;
        SptStore.updateRecord(db(), 'classes', el.getAttribute('data-class-year'), { year_group: el.value }, 'class_year_update');
        var bulkYear = document.querySelector('#form-bulk-enrol-profile [name=year_group]');
        var singleYear = document.querySelector('#form-enrol-profile [name=year_group]');
        if (bulkYear) bulkYear.value = el.value;
        if (singleYear) singleYear.value = el.value;
      });
    });
    root.querySelectorAll('[data-delete-class]').forEach(function(el) {
      el.addEventListener('click', function() {
        confirmDeleteClass(el.getAttribute('data-delete-class'));
      });
    });
    root.querySelectorAll('[data-open-class-sheet]').forEach(function(el) {
      el.addEventListener('click', function() {
        var parts = el.getAttribute('data-open-class-sheet').split('|');
        setRoute('course', { courseId: parts[0], classId: parts[1] || null });
      });
    });
    bindFilters(root);
    bindScoreSelectColors(root);

    root.querySelectorAll('[data-import-hub-teacher]').forEach(function(el) {
      el.addEventListener('click', function() {
        importHubTeacherById(el.getAttribute('data-import-hub-teacher'));
      });
    });
    var syncHub = document.getElementById('btn-sync-hub-teachers');
    if (syncHub) syncHub.addEventListener('click', function() { syncHubTeachers('Synced from Faculty Hub:'); });
    var syncHubInline = document.getElementById('btn-sync-hub-teachers-inline');
    if (syncHubInline) syncHubInline.addEventListener('click', function() { syncHubTeachers('Synced from Faculty Hub:'); });
    var addMe = document.getElementById('btn-add-me-teacher');
    if (addMe) addMe.addEventListener('click', function() { addMeAsTeacher(false); });
    var setupMine = document.getElementById('btn-setup-my-classes');
    if (setupMine) setupMine.addEventListener('click', function() { setupMyClasses(); });

    var ft = document.getElementById('form-add-teacher');
    if (ft) ft.onsubmit = function(e) {
      e.preventDefault();
      var fd = new FormData(ft);
      SptStore.insertRecord(db(), 'teachers', {
        first_name: fd.get('first_name'), surname: fd.get('surname'), email: fd.get('email'),
        role: 'Class Teacher', active_status: true, source: 'manual'
      }, 'teacher_add');
      state.hubStaffMessage = 'Added ' + fd.get('first_name') + ' ' + fd.get('surname') + ' manually.';
      render();
    };
    var fc = document.getElementById('form-add-class-profile');
    if (fc) fc.onsubmit = function(e) {
      e.preventDefault();
      var fd = new FormData(fc);
      var className = String(fd.get('class_name') || '').trim();
      var teacherId = fd.get('teacher_id');
      var course = SptStore.byId(db().courses, fd.get('course_id'));
      SptStore.insertRecord(db(), 'classes', {
        course_id: fd.get('course_id'), class_name: className,
        teacher_id: teacherId, academic_year: SptConfig.currentAcademicYear(),
        year_group: fd.get('year_group') || defaultYearGroupForCourse(course)
      }, 'class_add');
      var newCl = (db().classes || []).find(function(c) {
        return c.teacher_id === teacherId && c.class_name === className;
      });
      if (newCl) {
        state.setupClassId = newCl.id;
        state.setupMessage = 'Class created — add pupils below.';
      }
      render();
    };
    var setupCourse = document.getElementById('setup-class-course');
    var setupYear = document.getElementById('setup-class-year-group');
    if (setupCourse && setupYear) {
      setupCourse.addEventListener('change', function() {
        var course = SptStore.byId(db().courses, setupCourse.value);
        setupYear.value = defaultYearGroupForCourse(course);
      });
    }
    var fep = document.getElementById('form-enrol-profile');
    if (fep) fep.onsubmit = function(e) {
      e.preventDefault();
      var fd = new FormData(fep);
      var classId = fd.get('class_id');
      var cl = SptStore.byId(db().classes, classId);
      if (!cl) { alert('Class not found'); return; }
      if (!fd.get('pupil_id')) { state.setupMessage = 'Add pupils via paste below, or add pupils on the Pupils tab first.'; render(); return; }
      if (fd.get('year_group')) {
        SptStore.updateRecord(db(), 'pupils', fd.get('pupil_id'), { year_group: fd.get('year_group') }, 'pupil_year_update');
      }
      SptStore.createEnrolment(db(), fd.get('pupil_id'), cl.course_id, classId, cl.teacher_id, fd.get('current_level'));
      state.setupMessage = 'Added pupil to ' + cl.class_name + '.';
      render();
    };
    if (fep) {
      var pupilSelect = fep.querySelector('[name=pupil_id]');
      var yearSelect = fep.querySelector('[name=year_group]');
      if (pupilSelect && yearSelect) {
        pupilSelect.addEventListener('change', function() {
          var p = SptStore.byId(db().pupils, pupilSelect.value);
          if (p && p.year_group) yearSelect.value = p.year_group;
        });
      }
    }
    var fbep = document.getElementById('form-bulk-enrol-profile');
    if (fbep) fbep.onsubmit = function(e) {
      e.preventDefault();
      var fd = new FormData(fbep);
      var defaultYear = fd.get('year_group');
      var parsed = parsePupilLines(fd.get('pupil_lines'), defaultYear);
      var result = bulkEnrolPupilsInClass(fd.get('class_id'), fd.get('current_level'), parsed);
      if (result.error && !result.enrolled) {
        state.setupMessage = result.error;
      } else {
        state.setupMessage = 'Added ' + result.enrolled + ' pupil' + (result.enrolled !== 1 ? 's' : '') +
          (result.created ? ' (' + result.created + ' new)' : '') +
          (result.skipped ? ', ' + result.skipped + ' already on course' : '') + '.';
        if (result.errors.length) state.setupMessage += ' Issues: ' + result.errors.slice(0, 2).join('; ');
      }
      render();
    };
    var fcr = document.getElementById('form-copy-roster');
    if (fcr) fcr.onsubmit = function(e) {
      e.preventDefault();
      var fd = new FormData(fcr);
      var result = copyClassRoster(fd.get('from_class_id'), fd.get('to_class_id'), fd.get('current_level'));
      if (result.error && !result.copied) {
        state.setupMessage = result.error;
      } else {
        state.setupMessage = 'Copied ' + result.copied + ' pupil' + (result.copied !== 1 ? 's' : '') +
          (result.skipped ? ' (' + result.skipped + ' already on target course)' : '') + '.';
      }
      render();
    };
    var fp = document.getElementById('form-add-pupil');
    if (fp) fp.onsubmit = function(e) {
      e.preventDefault();
      var fd = new FormData(fp);
      SptStore.insertRecord(db(), 'pupils', {
        first_name: fd.get('first_name'), surname: fd.get('surname'), preferred_name: fd.get('first_name'),
        year_group: fd.get('year_group'), candidate_number: fd.get('candidate_number'),
        class_group: '', teacher_id: null, active_status: true, notes: ''
      }, 'pupil_add');
      render();
    };
    var fe = document.getElementById('form-add-enrolment');
    if (fe) fe.onsubmit = function(e) {
      e.preventDefault();
      var fd = new FormData(fe);
      var clOpt = fe.querySelector('[name=class_id] option:checked');
      var courseId = clOpt && clOpt.getAttribute('data-course');
      var teacherId = clOpt && clOpt.getAttribute('data-teacher');
      if (!courseId) { alert('Select a class'); return; }
      SptStore.createEnrolment(db(), fd.get('pupil_id'), courseId, fd.get('class_id'), teacherId, fd.get('current_level'));
      render();
    };
    var fbl = document.getElementById('form-add-baseline');
    if (fbl) fbl.onsubmit = function(e) {
      e.preventDefault();
      var fd = new FormData(fbl);
      var raw = fd.get('s3_exam_raw');
      var enId = fd.get('enrolment_id');
      var en = SptStore.byId(db().enrolments, enId);
      var course = en ? SptStore.byId(db().courses, en.course_id) : null;
      SptBaseline.applyS3ExamRaw(db(), enId, raw, course);
      SptStore.upsertBaseline(db(), enId, {
        effort: fd.get('effort') ? parseInt(fd.get('effort'), 10) : null,
        behaviour: fd.get('behaviour') ? parseInt(fd.get('behaviour'), 10) : null,
        homelearning: fd.get('homelearning') ? parseInt(fd.get('homelearning'), 10) : null,
        progress: fd.get('progress') ? parseInt(fd.get('progress'), 10) : null,
        cfe_level: fd.get('cfe_level'),
        notes: fd.get('notes'),
        locked_at: new Date().toISOString().slice(0, 10)
      });
      render();
    };
    var fpr = document.getElementById('form-add-prior');
    if (fpr) fpr.onsubmit = function(e) {
      e.preventDefault();
      var fd = new FormData(fpr);
      SptStore.insertRecord(db(), 'prior_attainment', {
        pupil_id: fd.get('pupil_id'), subject_area: fd.get('subject_area'),
        qualification_year: fd.get('qualification_year'), qualification_level: fd.get('qualification_level'),
        result_grade: fd.get('result_grade'), pathway_status: fd.get('pathway_status'), notes: fd.get('notes')
      }, 'prior_add');
      render();
    };

    var importFile = root.querySelector('#import-file');
    if (importFile) importFile.addEventListener('change', function() {
      var file = importFile.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function() {
        state.importRaw = SptImport.parseCsvText(reader.result);
        state.importMapping = SptImport.mapColumns(state.importRaw.headers);
        state.importPreview = SptImport.buildPreview(db(), state.importRaw.rows, state.importMapping);
        state.importSource = 'csv';
        state.importStep = 3;
        state.importMessage = null;
        render();
      };
      reader.readAsText(file);
    });
    var loadSample = root.querySelector('#import-load-sample');
    if (loadSample) loadSample.addEventListener('click', function() {
      fetch('samples/tracking-import-sample.csv').then(function(r) { return r.text(); }).then(function(text) {
        state.importRaw = SptImport.parseCsvText(text);
        state.importMapping = SptImport.mapColumns(state.importRaw.headers);
        state.importPreview = SptImport.buildPreview(db(), state.importRaw.rows, state.importMapping);
        state.importSource = 'csv';
        state.importStep = 3;
        state.importMessage = null;
        render();
      });
    });
    var importCancel = root.querySelector('#import-cancel');
    if (importCancel) importCancel.addEventListener('click', function() {
      state.importStep = 1;
      state.importSource = null;
      state.importPreview = null;
      state.templatePreview = null;
      state.templateRows = null;
      state.importFilename = null;
      render();
    });
    var templateBlank = root.querySelector('#template-download-blank');
    if (templateBlank) templateBlank.addEventListener('click', function() {
      if (!window.SptTemplate || !SptTemplate.hasXlsx()) {
        alert('Excel library not loaded — refresh the page.');
        return;
      }
      var res = SptTemplate.downloadWorkbook(db(), { filled: false });
      if (res.error) alert(res.error);
    });
    var templateFilled = root.querySelector('#template-download-filled');
    if (templateFilled) templateFilled.addEventListener('click', function() {
      if (!window.SptTemplate || !SptTemplate.hasXlsx()) {
        alert('Excel library not loaded — refresh the page.');
        return;
      }
      var res = SptTemplate.downloadWorkbook(db(), { filled: true });
      if (res.error) alert(res.error);
    });
    var workbookFile = root.querySelector('#import-workbook-file');
    if (workbookFile) workbookFile.addEventListener('change', function() {
      var file = workbookFile.files[0];
      if (!file) return;
      if (!window.SptTemplate || !SptTemplate.hasXlsx()) {
        alert('Excel library not loaded — refresh the page.');
        return;
      }
      var reader = new FileReader();
      reader.onload = function() {
        var parsed = SptTemplate.parseWorkbook(reader.result);
        if (parsed.error) {
          state.importMessage = parsed.error;
          render();
          return;
        }
        if (!parsed.rows.length) {
          state.importMessage = 'No data rows found in workbook — check each subject sheet has pupil rows.';
          render();
          return;
        }
        state.importFilename = file.name;
        state.templatePreview = SptTemplate.buildImportPreview(db(), parsed.rows);
        state.templateRows = parsed.rows;
        state.importSource = 'workbook';
        state.importStep = 2;
        state.importMessage = null;
        render();
      };
      reader.readAsArrayBuffer(file);
    });
    var templateCommit = root.querySelector('#template-commit');
    if (templateCommit) templateCommit.addEventListener('click', function() {
      if (!role().canImport) { alert('Faculty Head only'); return; }
      if (!window.SptTemplate || !state.templateRows || !state.templateRows.length) return;
      var stats = SptTemplate.commitWorkbookImport(db(), state.templateRows, {
        filename: state.importFilename || 'workbook.xlsx'
      });
      state.importStep = 1;
      state.importSource = null;
      state.templatePreview = null;
      state.templateRows = null;
      state.importFilename = null;
      state.importMessage = 'Imported ' + stats.processed + ' rows (' + stats.tracking + ' tracking updates)' +
        (stats.skipped ? ', ' + stats.skipped + ' skipped' : '') + '.';
      if (stats.errors.length) {
        state.importMessage += ' First issue: ' + stats.errors[0];
      }
      render();
      updateNavBadge();
    });
    var commit = root.querySelector('#import-commit');
    if (commit) commit.addEventListener('click', function() {
      if (!role().canImport) { alert('Faculty Head only'); return; }
      var res = SptImport.commitImport(db(), state.importPreview, { includeAll: true });
      state.importStep = 1;
      state.importSource = null;
      state.importPreview = null;
      state.importMessage = 'Imported ' + res.imported + ' CSV rows.';
      render();
      updateNavBadge();
    });
    var exportBtn = root.querySelector('#export-csv');
    if (exportBtn) exportBtn.addEventListener('click', function() {
      var id = exportBtn.getAttribute('data-report');
      var rep = SptReports.REPORTS[id];
      SptReports.downloadCsv(rep.title.replace(/\s+/g, '_') + '.csv', SptReports.toCsv(rep.headers, rep.fn(db())));
    });
  }

  function render() {
    var scrollPos = captureGridScroll();
    var html = '';
    switch (state.route) {
      case 'dashboard': html = renderDashboard(); break;
      case 'alerts': html = renderAlerts(); break;
      case 'setup': html = renderSetup(); break;
      case 'courses': html = renderCoursesList(); break;
      case 'course': html = renderCoursePage(state.courseId); break;
      case 'evidence': html = renderEvidence(); break;
      case 'level-changes': html = renderLevelChanges(); break;
      case 'interventions': html = renderInterventions(); break;
      case 'import': html = renderImport(); break;
      case 'reports': html = renderReports(); break;
      default: html = renderDashboard();
    }
    document.getElementById('app-main').innerHTML = html;
    syncLayoutClasses();
    updateNavToggleUi();
    bindMainEvents(document.getElementById('app-main'));
    restoreGridScroll(scrollPos);
  }

  document.querySelectorAll('.nav-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var r = btn.getAttribute('data-route');
      if (r === 'courses') setRoute('courses');
      else setRoute(r);
    });
  });
  document.getElementById('drawer-close').addEventListener('click', closeDrawer);
  document.getElementById('drawer-backdrop').addEventListener('click', closeDrawer);
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-backdrop').addEventListener('click', closeModal);
  document.getElementById('btn-reset-data').addEventListener('click', function() {
    var msg = SptConfig.useSeedData
      ? 'Reset all development sample data?'
      : 'Clear all teachers, classes, pupils, and tracking data? Course templates will remain.';
    if (confirm(msg)) { SptStore.reset(); render(); updateNavBadge(); }
  });

  function updateSyncBanner(status, message) {
    if (SptConfig.useSeedData) return;
    var devNote = document.getElementById('dev-banner-note');
    if (!devNote) return;
    if (status === 'loading') {
      devNote.textContent = 'Loading workbook from Faculty Hub cloud…';
      devNote.hidden = false;
    } else if (status === 'syncing') {
      devNote.textContent = 'Saving to Faculty Hub cloud…';
      devNote.hidden = false;
    } else if (status === 'synced') {
      if (message) {
        devNote.textContent = message;
        devNote.hidden = false;
      } else {
        devNote.textContent = '';
        devNote.hidden = true;
      }
    } else if (status === 'offline') {
      devNote.textContent = message || 'Sign in to Faculty Hub to sync this workbook across devices.';
      devNote.hidden = false;
    } else if (status === 'error') {
      devNote.textContent = 'Cloud sync issue: ' + (message || 'try refreshing the page.');
      devNote.hidden = false;
    }
  }

  window.SptSyncOnStatus = function(status, message) {
    updateSyncBanner(status, message);
  };

  function initRoleControls() {
    var d = db();
    var roleSel = document.getElementById('dev-role');
    var teacherSel = document.getElementById('dev-teacher');
    var devNote = document.getElementById('dev-banner-note');
    if (devNote && SptConfig.useSeedData) {
      devNote.textContent = 'Development preview with sample pupils — add ?dev_seed=1 to URL. Data stored locally in your browser.';
      devNote.hidden = false;
    }
    if (!SptConfig.useSeedData) document.body.classList.add('spt-hub-mode');
    else document.body.classList.add('spt-dev-seed');
    roleSel.value = d.dev_role || 'faculty_head';
    var teachers = d.teachers || [];
    if (!teachers.length) {
      teacherSel.innerHTML = '<option value="">No teachers yet</option>';
      teacherSel.disabled = true;
    } else {
      teacherSel.innerHTML = teachers.map(function(t) {
        return '<option value="' + t.id + '">' + esc(t.first_name + ' ' + t.surname) + '</option>';
      }).join('');
      teacherSel.value = d.simulated_teacher_id || teachers[0].id;
      teacherSel.disabled = roleSel.value !== 'class_teacher';
    }
    roleSel.onchange = function() {
      SptStore.setDevRole(roleSel.value);
      initRoleControls();
      document.getElementById('nav-setup').style.display = SptStore.getRole(db()).canSetup ? '' : 'none';
      render();
      updateNavBadge();
    };
    teacherSel.onchange = function() {
      if (!teacherSel.value) return;
      SptStore.setSimulatedTeacher(teacherSel.value);
      render();
    };
    document.getElementById('nav-setup').style.display = role().canSetup ? '' : 'none';
  }

  function initHubEmbed() {
    var params = new URLSearchParams(window.location.search);
    var isEmbed = params.get('embed') === '1';
    var fromLanding = params.get('from') === 'landing';
    if (isEmbed) document.body.classList.add('hub-embed');
    if (fromLanding) document.body.classList.add('suite-from-landing');
    if (isEmbed || fromLanding) {
      var link = document.getElementById('hub-back-link');
      if (link) {
        link.classList.remove('is-hidden');
        var q = isEmbed ? '?embed=1' : '';
        link.href = '../../tracking_monitoring_landing.html' + q;
      }
    }
  }

  SptStore.ensure();
  initHubEmbed();
  initLayoutControls();
  initRoleControls();
  maybeBootstrapRoute();
  render();
  updateNavBadge();

  window.addEventListener('staffdisplaynameupdated', function() {
    if (SptConfig.useSeedData || !window.SptSync) {
      loadHubStaffState();
      return;
    }
    SptSync.whenHydrated(loadHubStaffState);
  });

  function afterCloudHydrate(status, message, changed) {
    if (changed) {
      initRoleControls();
      render();
      updateNavBadge();
    }
    updateSyncBanner(status, message);
    loadHubStaffState();
  }

  if (!SptConfig.useSeedData && window.SptSync) {
    SptSync.hydrate(afterCloudHydrate);
  } else {
    loadHubStaffState();
  }
})();
