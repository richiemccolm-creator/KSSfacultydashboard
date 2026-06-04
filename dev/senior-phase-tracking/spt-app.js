/**
 * Senior Phase Tracking — development preview UI (local only).
 */
(function() {
  'use strict';

  var state = {
    route: 'dashboard',
    setupTab: 'teachers',
    courseId: null,
    reportId: null,
    filters: {},
    importStep: 1,
    importPreview: null,
    importMapping: null,
    importRaw: null,
    modal: null
  };

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : s;
    return d.innerHTML;
  }

  function badge(status) {
    var cls = (SptConfig.BADGE_CLASS[status] || 'badge-grey');
    return '<span class="badge ' + cls + '">' + esc(status) + '</span>';
  }

  function sheetPanel(title, meta, hint, tableInner) {
    return '<div class="sheet-panel">' +
      '<div class="sheet-toolbar">' +
      '<div class="sheet-toolbar-left"><h2>' + esc(title) + '</h2>' +
      (meta ? '<span>' + esc(meta) + '</span>' : '') + '</div>' +
      (hint ? '<div class="sheet-toolbar-right"><span class="sheet-hint">' + esc(hint) + '</span></div>' : '') +
      '</div><div class="sheet-grid-wrap">' + tableInner + '</div></div>';
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
    state.courseId = params.courseId || null;
    state.reportId = params.reportId || null;
    if (route === 'import') { state.importStep = 1; state.importPreview = null; }
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

  function filtersHtml(d, extra) {
    return '<div class="filters-bar">' +
      '<div class="filter-field"><label>Course</label><select data-filter="course"><option value="">All</option>' +
      d.courses.map(function(c) { return '<option value="' + c.id + '">' + esc(c.course_name) + '</option>'; }).join('') +
      '</select></div>' +
      '<div class="filter-field"><label>Teacher</label><select data-filter="teacher"><option value="">All</option>' +
      d.teachers.map(function(t) { return '<option value="' + t.id + '">' + esc(t.first_name + ' ' + t.surname) + '</option>'; }).join('') +
      '</select></div>' +
      '<div class="filter-field"><label>Year</label><select data-filter="year"><option value="">All</option>' +
      ['S4','S5','S6'].map(function(y) { return '<option value="' + y + '">' + y + '</option>'; }).join('') +
      '</select></div>' +
      '<div class="filter-field"><label>Risk</label><select data-filter="risk"><option value="">All</option>' +
      SptConfig.STATUS.risk.map(function(s) { return '<option value="' + s + '">' + s + '</option>'; }).join('') +
      '</select></div>' + (extra || '') + '</div>';
  }

  function summaryCards(rows) {
    var openFlags = rows.filter(function(r) { return r.open_flag_count > 0; }).length;
    return [
      { lbl: 'Pupils', val: rows.length, cls: '' },
      { lbl: 'Teacher flags', val: openFlags, cls: openFlags ? 'red' : '' },
      { lbl: 'On track', val: rows.filter(function(r) { return r.enrolment.risk_status === 'Green'; }).length, cls: 'green' },
      { lbl: 'Amber', val: rows.filter(function(r) { return r.enrolment.risk_status === 'Amber'; }).length, cls: 'amber' },
      { lbl: 'Red', val: rows.filter(function(r) { return r.enrolment.risk_status === 'Red'; }).length, cls: 'red' },
      { lbl: 'Missing evidence', val: rows.filter(function(r) { return r.evidence_missing_count > 0; }).length, cls: 'amber' },
      { lbl: 'Prior crash', val: rows.filter(function(r) { return r.prior_crashed; }).length, cls: 'amber' }
    ];
  }

  function renderDashboard() {
    var d = db();
    var rows = applyFilters(SptConcerns.sortByUrgency(SptStore.getEnrichedRows(d), d));
    var tps = SptStore.trackingPoints(d);
    var html = alertStripHtml() + '<div class="page-head"><h1>Senior Phase Dashboard</h1><p>Flagged pupils appear first. Click a row for full profile.</p></div>';
    html += '<div class="summary-row">' + summaryCards(rows).map(function(c) {
      return '<div class="summary-card ' + c.cls + '"><div class="val">' + c.val + '</div><div class="lbl">' + esc(c.lbl) + '</div></div>';
    }).join('') + '</div>';
    html += filtersHtml(d, '<div class="filter-field"><label>Flagged</label><select data-filter="flagged"><option value="">All</option><option value="yes">Open flags only</option></select></div>');
    var bodyRows = '';
    rows.forEach(function(r) {
      var attCells = r.attendance.map(function(a) {
        var v = a.record ? a.record.attendance_score : '';
        return '<td class="cell-num">' + (v ? esc(v) : '—') + '</td>';
      }).join('');
      bodyRows += '<tr class="' + (r.open_flag_count ? 'row-flagged' : '') + '" data-enrolment="' + r.enrolment.id + '">' +
        '<td class="col-pupil">' + esc(SptStore.pupilName(d, r.pupil.id)) + '</td>' +
        '<td class="cell-num">' + esc(r.pupil.year_group) + '</td>' +
        '<td>' + esc(r.course.course_name) + '</td>' +
        '<td>' + esc(r.class_name) + '</td>' +
        '<td>' + esc(r.teacher_name) + '</td>' +
        '<td>' + (r.open_flag_count ? badge('Open') : '—') + '</td>' +
        attCells +
        '<td class="cell-grade">' + esc(r.prelim_result || '—') + '</td>' +
        '<td class="cell-grade">' + esc(r.enrolment.latest_working_grade || '—') + '</td>' +
        '<td>' + badge(r.enrolment.risk_status) + '</td>' +
        '<td>' + (r.prior_crashed ? badge('Crashed / withdrew') : '—') + '</td></tr>';
    });
    var tbl = '<table class="data-table"><thead><tr>' +
      '<th class="col-pupil">Pupil</th><th>Year</th><th>Course</th><th>Class</th><th>Teacher</th><th>Flag</th>' +
      '<th>Att TP1</th><th>Att TP2</th><th>Att TP3</th><th>Prelim</th><th>Working</th><th>Risk</th><th>Prior</th></tr></thead><tbody>' +
      bodyRows + '</tbody></table>';
    html += sheetPanel('Pupil register', rows.length + ' rows', 'Click a row for profile · Flagged pupils at top', tbl);
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

  function renderSetup() {
    if (!role().canSetup) return '<div class="empty">Setup is only available for Faculty Head / Admin.</div>';
    var d = db();
    var tab = state.setupTab;
    var html = '<div class="page-head"><h1>Setup / Cohort</h1><p>Add teachers, classes, pupils, and enrolments (local dev data).</p></div>';
    html += '<div class="setup-tabs">' +
      ['teachers','classes','pupils','enrolments','prior'].map(function(t) {
        return '<button type="button" class="setup-tab' + (tab === t ? ' active' : '') + '" data-setup-tab="' + t + '">' + t + '</button>';
      }).join('') + '</div>';

    if (tab === 'teachers') {
      html += '<div class="sheet-panel"><div class="sheet-toolbar"><div class="sheet-toolbar-left"><h2>Teachers</h2></div></div><div class="sheet-body">' +
        '<form id="form-add-teacher" class="form-grid" style="max-width:400px;margin-bottom:1rem">' +
        '<div><label>First name</label><input name="first_name" required></div>' +
        '<div><label>Surname</label><input name="surname" required></div>' +
        '<div><label>Email</label><input name="email" type="email"></div>' +
        '<button type="submit" class="btn btn-sm">Add teacher</button></form></div>' +
        '<div class="sheet-grid-wrap"><table class="data-table"><thead><tr><th class="col-pupil">Name</th><th>Email</th></tr></thead><tbody>' +
        d.teachers.map(function(t) {
          return '<tr><td class="col-pupil">' + esc(t.first_name + ' ' + t.surname) + '</td><td>' + esc(t.email) + '</td></tr>';
        }).join('') + '</tbody></table></div></div>';
    } else if (tab === 'classes') {
      html += '<div class="card"><div class="card-head"><h2>Classes</h2></div><div class="card-body">' +
        '<form id="form-add-class" class="form-grid" style="max-width:480px;margin-bottom:1rem">' +
        '<div><label>Course</label><select name="course_id">' + d.courses.map(function(c) {
          return '<option value="' + c.id + '">' + esc(c.course_name) + '</option>';
        }).join('') + '</select></div>' +
        '<div><label>Class name</label><input name="class_name" required placeholder="e.g. H Drama A"></div>' +
        '<div><label>Teacher</label><select name="teacher_id">' + d.teachers.map(function(t) {
          return '<option value="' + t.id + '">' + esc(t.first_name + ' ' + t.surname) + '</option>';
        }).join('') + '</select></div>' +
        '<button type="submit" class="btn btn-sm">Add class</button></form>' +
        '<table class="data-table"><thead><tr><th>Class</th><th>Course</th><th>Teacher</th></tr></thead><tbody>' +
        (d.classes || []).map(function(cl) {
          return '<tr><td>' + esc(cl.class_name) + '</td><td>' + esc(SptStore.courseName(d, cl.course_id)) + '</td>' +
            '<td>' + esc(SptStore.teacherName(d, cl.teacher_id)) + '</td></tr>';
        }).join('') + '</tbody></table></div></div>';
    } else if (tab === 'pupils') {
      html += '<div class="card"><div class="card-head"><h2>Pupils</h2></div><div class="card-body">' +
        '<form id="form-add-pupil" class="form-grid" style="max-width:480px;margin-bottom:1rem">' +
        '<div><label>First name</label><input name="first_name" required></div>' +
        '<div><label>Surname</label><input name="surname" required></div>' +
        '<div><label>Year group</label><select name="year_group"><option>S4</option><option>S5</option><option>S6</option></select></div>' +
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
        '<div><label>Current level</label><input name="current_level" value="National 5"></div>' +
        '<button type="submit" class="btn btn-sm">Enrol pupil</button></form>' +
        '<table class="data-table"><thead><tr><th>Pupil</th><th>Course</th><th>Class</th><th>Teacher</th></tr></thead><tbody>' +
        d.enrolments.filter(function(e) { return e.active_status !== false; }).map(function(en) {
          return '<tr><td>' + esc(SptStore.pupilName(d, en.pupil_id)) + '</td><td>' + esc(SptStore.courseName(d, en.course_id)) + '</td>' +
            '<td>' + esc(en.class_id ? SptStore.className(d, en.class_id) : '—') + '</td>' +
            '<td>' + esc(SptStore.teacherName(d, en.teacher_id)) + '</td></tr>';
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
    var html = alertStripHtml() + '<div class="page-head"><h1>Course Tracking</h1></div><div class="report-grid">';
    d.courses.forEach(function(c) {
      var count = SptStore.filterEnrolments(d, d.enrolments).filter(function(e) { return e.course_id === c.id; }).length;
      html += '<div class="report-tile" data-course="' + c.id + '"><h3>' + esc(c.course_name) + '</h3><p>' + count + ' pupils</p></div>';
    });
    return html + '</div>';
  }

  function renderCoursePage(courseId) {
    var d = db();
    var course = SptStore.byId(d.courses, courseId);
    if (!course) return '<div class="empty">Course not found</div>';
    var aps = SptStore.assessmentPointsForCourse(d, courseId);
    var prelimAp = aps.find(function(ap) { return ap.assessment_type === 'Prelim'; });
    var prelimComps = prelimAp ? SptPrelim.componentsForCourse(d, courseId) : [];
    var enrolments = SptConcerns.sortByUrgency(
      SptStore.getEnrichedRows(d).filter(function(r) { return r.enrolment.course_id === courseId; }), d);
    var tps = SptStore.trackingPoints(d);
    var html = alertStripHtml() + '<div class="page-head"><h1>' + esc(course.course_name) + '</h1></div>' +
      '<p style="margin-bottom:.75rem"><button type="button" class="btn btn-secondary btn-sm" data-route="courses">Back</button></p>';
    var head = '<th class="col-pupil">Pupil</th><th>Flag</th>';
    tps.forEach(function(tp, i) { head += '<th>Att TP' + (i + 1) + '</th>'; });
    prelimComps.forEach(function(pc) {
      head += '<th class="col-prelim" title="' + esc(pc.component_name) + ' (' + pc.weighting + '%)">' +
        esc(SptPrelim.columnLabel(pc)) + '<span class="th-sub">/' + pc.max_marks + '</span></th>';
    });
    if (prelimAp) head += '<th>Prelim %</th>';
    aps.filter(function(ap) { return ap.assessment_type !== 'Prelim'; }).slice(0, 4).forEach(function(ap) {
      head += '<th>' + esc(ap.assessment_name.length > 14 ? ap.assessment_name.slice(0, 12) + '…' : ap.assessment_name) + '</th>';
    });
    head += '<th>Risk</th><th>Actions</th>';
    var courseBody = '';
    enrolments.forEach(function(r) {
      var en = r.enrolment;
      courseBody += '<tr class="' + (r.open_flag_count ? 'row-flagged' : '') + '">' +
        '<td class="col-pupil" data-enrolment="' + en.id + '">' + esc(SptStore.pupilName(d, r.pupil.id)) + '</td>' +
        '<td>' + (r.open_flag_count ? badge('Open') : '—') + '</td>';
      tps.forEach(function(tp) {
        var rec = (d.attendance_records || []).find(function(a) {
          return a.enrolment_id === en.id && a.tracking_point_id === tp.id;
        });
        var val = rec ? rec.attendance_score : '';
        if (role().canEdit) {
          courseBody += '<td><select class="inline-select" data-att="' + en.id + '|' + tp.id + '">' +
            '<option value="">—</option>' + [1,2,3,4].map(function(n) {
              return '<option value="' + n + '"' + (val === n ? ' selected' : '') + '>' + n + '</option>';
            }).join('') + '</select></td>';
        } else courseBody += '<td class="cell-num">' + esc(val || '—') + '</td>';
      });
      prelimComps.forEach(function(pc) {
        var markRec = (d.prelim_marks || []).find(function(m) {
          return m.enrolment_id === en.id && m.prelim_component_id === pc.id;
        });
        var raw = markRec && markRec.raw_mark != null ? markRec.raw_mark : '';
        if (role().canEdit) {
          courseBody += '<td class="cell-prelim"><input type="number" class="prelim-inline" min="0" max="' + pc.max_marks + '" step="0.5" ' +
            'data-prelim-mark="' + en.id + '|' + pc.id + '" value="' + (raw !== '' ? raw : '') + '" placeholder="—" title="' + esc(pc.component_name) + '"></td>';
        } else {
          courseBody += '<td class="cell-num">' + esc(raw !== '' ? raw + '/' + pc.max_marks : '—') + '</td>';
        }
      });
      if (prelimAp) {
        courseBody += '<td class="cell-grade">' + esc(r.prelim_result || '—') + '</td>';
      }
      aps.filter(function(ap) { return ap.assessment_type !== 'Prelim'; }).slice(0, 4).forEach(function(ap) {
        var res = SptStore.resultForAssessment(d, en.id, ap.id);
        courseBody += '<td>' + badge(res ? res.completion_status : 'Not Started') + '</td>';
      });
      courseBody += '<td>' + badge(en.risk_status) + '</td><td>';
      if (role().canFlag) courseBody += '<button type="button" class="btn btn-sm" data-flag="' + en.id + '">Flag</button>';
      courseBody += '</td></tr>';
    });
    var sheetHint = 'Edit attendance (1–4)';
    if (prelimComps.length) sheetHint += ' · enter raw prelim marks per component';
    html += sheetPanel(course.course_name, enrolments.length + ' pupils', sheetHint, '<table class="data-table"><thead><tr>' + head + '</tr></thead><tbody>' + courseBody + '</tbody></table>');
    return html;
  }

  function showFlagModal(enrolmentId) {
    var cats = SptConfig.CONCERN_CATEGORIES.map(function(c) {
      return '<option value="' + c + '">' + c + '</option>';
    }).join('');
    openModal('Flag concern for Faculty Head',
      '<form id="flag-form" class="form-grid"><div><label>Category</label><select name="category">' + cats + '</select></div>' +
      '<div><label>Comment</label><textarea name="comment" required placeholder="What should the Faculty Head know?"></textarea></div></form>',
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
      return '<div class="prelim-row"><span>' + esc(pc.component_name) + ' / ' + pc.max_marks + '</span>' +
        '<input type="number" min="0" max="' + pc.max_marks + '" data-pc="' + pc.id + '" value="' + (m && m.raw_mark != null ? m.raw_mark : '') + '">' +
        '<span>' + pc.weighting + '%</span></div>';
    }).join('');
    var sum = SptPrelim.computeSummary(d, enrolmentId, assessmentPointId);
    openModal('Prelim marks',
      '<div class="prelim-grid">' + rows + '</div>' +
      (sum ? '<p style="margin-top:.75rem;font-size:.88rem"><strong>Total: ' + sum.percentage + '% (' + sum.grade_band + ')</strong></p>' : ''),
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
    if (r && r.prior_attainment.length) {
      body += '<div class="profile-section"><h3>Prior attainment</h3><ul class="profile-list">';
      r.prior_attainment.forEach(function(p) {
        body += '<li>' + esc(p.qualification_year) + ' ' + esc(p.qualification_level) + ': ' + esc(p.result_grade) + ' ' + badge(p.pathway_status) + '</li>';
      });
      body += '</ul></div>';
    }
    body += '<div class="profile-section"><h3>Attendance (1–4)</h3><ul class="profile-list">';
    r.attendance.forEach(function(a, i) {
      var lbl = SptConfig.ATTENDANCE_LABELS[a.record && a.record.attendance_score] || '—';
      body += '<li>TP' + (i + 1) + ': ' + (a.record ? a.record.attendance_score + ' — ' + lbl : '—') + '</li>';
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
  }

  function closeDrawer() {
    document.getElementById('drawer-backdrop').classList.remove('open');
    document.getElementById('pupil-drawer').classList.remove('open');
  }

  function renderEvidence() {
    var d = db();
    var list = (d.evidence_bank || []).filter(function(ev) {
      var en = SptStore.byId(d.enrolments, ev.enrolment_id);
      return en && SptStore.canViewEnrolment(d, en);
    });
    var html = '<div class="page-head"><h1>Evidence Bank</h1></div>' + filtersHtml(d);
    var evRows = '';
    list.forEach(function(ev) {
      var en = SptStore.byId(d.enrolments, ev.enrolment_id);
      evRows += '<tr data-enrolment="' + en.id + '"><td class="col-pupil">' + esc(SptStore.pupilName(d, en.pupil_id)) + '</td>' +
        '<td>' + esc(SptStore.courseName(d, en.course_id)) + '</td><td>' + esc(ev.unit_or_component) + '</td>' +
        '<td>' + (role().canEdit ?
          '<select class="inline-select" data-evidence="' + ev.id + '">' + SptConfig.STATUS.evidence.map(function(s) {
            return '<option' + (ev.evidence_status === s ? ' selected' : '') + '>' + s + '</option>';
          }).join('') + '</select>' : badge(ev.evidence_status)) + '</td></tr>';
    });
    html += sheetPanel('Evidence register', list.length + ' items', 'Click row for pupil profile', '<table class="data-table"><thead><tr>' +
      '<th class="col-pupil">Pupil</th><th>Course</th><th>Unit</th><th>Status</th></tr></thead><tbody>' + evRows + '</tbody></table>');
    return html;
  }

  function renderLevelChanges() {
    var d = db();
    var courseIds = d.courses.filter(function(c) { return c.supports_level_change; }).map(function(c) { return c.id; });
    var list = (d.level_changes || []).filter(function(lc) {
      var en = SptStore.byId(d.enrolments, lc.enrolment_id);
      return en && courseIds.indexOf(en.course_id) >= 0 && SptStore.canViewEnrolment(d, en);
    });
    var html = '<div class="page-head"><h1>Level Change Tracker</h1></div><div class="card"><div class="table-wrap"><table class="data-table">';
    html += '<thead><tr><th>Pupil</th><th>From</th><th>To</th><th>Status</th><th>SQA confirmed</th></tr></thead><tbody>';
    list.forEach(function(lc) {
      var en = SptStore.byId(d.enrolments, lc.enrolment_id);
      html += '<tr data-enrolment="' + en.id + '"><td>' + esc(SptStore.pupilName(d, en.pupil_id)) + '</td>' +
        '<td>' + esc(lc.original_level) + '</td><td>' + esc(lc.recommended_level) + '</td>' +
        '<td>' + badge(lc.current_status) + '</td><td>' + (lc.confirmed_on_sqa_system ? 'Yes' : 'No') + '</td></tr>';
    });
    return html + '</tbody></table></div></div>';
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
    var html = '<div class="page-head"><h1>Import School Tracking</h1></div>';
    if (state.importStep === 1) {
      html += '<div class="card" style="padding:1rem"><input type="file" id="import-file" accept=".csv"> ' +
        '<button type="button" class="btn btn-sm" id="import-load-sample">Load sample CSV</button></div>';
    } else if (state.importStep === 3 && state.importPreview) {
      html += '<button type="button" class="btn" id="import-commit">Import matched rows</button>';
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
    root.querySelectorAll('[data-course]').forEach(function(el) {
      el.addEventListener('click', function() { setRoute('course', { courseId: el.getAttribute('data-course') }); });
    });
    root.querySelectorAll('[data-report]').forEach(function(el) {
      el.addEventListener('click', function() { state.reportId = el.getAttribute('data-report'); render(); });
    });
    root.querySelectorAll('[data-flag]').forEach(function(el) {
      el.addEventListener('click', function(e) { e.stopPropagation(); showFlagModal(el.getAttribute('data-flag')); });
    });
    root.querySelectorAll('[data-prelim-mark]').forEach(function(el) {
      el.addEventListener('change', function(e) {
        e.stopPropagation();
        var p = el.getAttribute('data-prelim-mark').split('|');
        SptPrelim.saveMark(db(), p[0], p[1], el.value);
        render();
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
        render();
      });
    });
    root.querySelectorAll('[data-evidence]').forEach(function(el) {
      el.addEventListener('change', function() {
        SptStore.updateRecord(db(), 'evidence_bank', el.getAttribute('data-evidence'), { evidence_status: el.value }, 'evidence_update');
        render();
      });
    });
    root.querySelectorAll('[data-setup-tab]').forEach(function(el) {
      el.addEventListener('click', function() {
        state.setupTab = el.getAttribute('data-setup-tab');
        render();
      });
    });
    bindFilters(root);

    var ft = document.getElementById('form-add-teacher');
    if (ft) ft.onsubmit = function(e) {
      e.preventDefault();
      var fd = new FormData(ft);
      SptStore.insertRecord(db(), 'teachers', {
        first_name: fd.get('first_name'), surname: fd.get('surname'), email: fd.get('email'),
        role: 'Class Teacher', active_status: true
      }, 'teacher_add');
      render();
    };
    var fc = document.getElementById('form-add-class');
    if (fc) fc.onsubmit = function(e) {
      e.preventDefault();
      var fd = new FormData(fc);
      SptStore.insertRecord(db(), 'classes', {
        course_id: fd.get('course_id'), class_name: fd.get('class_name'),
        teacher_id: fd.get('teacher_id'), academic_year: '2025-26'
      }, 'class_add');
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
        state.importStep = 3;
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
        state.importStep = 3;
        render();
      });
    });
    var commit = root.querySelector('#import-commit');
    if (commit) commit.addEventListener('click', function() {
      if (!role().canImport) { alert('Faculty Head only'); return; }
      var res = SptImport.commitImport(db(), state.importPreview, { includeAll: true });
      alert('Imported ' + res.imported + ' rows');
      state.importStep = 1;
      render();
    });
    var exportBtn = root.querySelector('#export-csv');
    if (exportBtn) exportBtn.addEventListener('click', function() {
      var id = exportBtn.getAttribute('data-report');
      var rep = SptReports.REPORTS[id];
      SptReports.downloadCsv(rep.title.replace(/\s+/g, '_') + '.csv', SptReports.toCsv(rep.headers, rep.fn(db())));
    });
  }

  function render() {
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
    bindMainEvents(document.getElementById('app-main'));
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
    if (confirm('Reset all development data?')) { SptStore.reset(); render(); updateNavBadge(); }
  });

  function initRoleControls() {
    var d = db();
    var roleSel = document.getElementById('dev-role');
    var teacherSel = document.getElementById('dev-teacher');
    roleSel.value = d.dev_role || 'faculty_head';
    teacherSel.innerHTML = d.teachers.map(function(t) {
      return '<option value="' + t.id + '">' + esc(t.first_name + ' ' + t.surname) + '</option>';
    }).join('');
    teacherSel.value = d.simulated_teacher_id || 't-anderson';
    teacherSel.disabled = roleSel.value !== 'class_teacher';
    roleSel.onchange = function() {
      SptStore.setDevRole(roleSel.value);
      teacherSel.disabled = roleSel.value !== 'class_teacher';
      document.getElementById('nav-setup').style.display = SptStore.getRole(db()).canSetup ? '' : 'none';
      render();
      updateNavBadge();
    };
    teacherSel.onchange = function() { SptStore.setSimulatedTeacher(teacherSel.value); render(); };
    document.getElementById('nav-setup').style.display = role().canSetup ? '' : 'none';
  }

  SptStore.ensure();
  initRoleControls();
  render();
  updateNavBadge();
})();
