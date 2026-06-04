/**
 * Local-only data store (localStorage) for Senior Phase Tracking dev preview.
 */
(function(global) {
  'use strict';

  var KEY = global.SptConfig.STORAGE_KEY;
  var VER = global.SptConfig.DATA_VERSION;

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function save(db) {
    db.version = VER;
    db.updated_at = new Date().toISOString();
    localStorage.setItem(KEY, JSON.stringify(db));
    return db;
  }

  function migrate(db) {
    if (!db) return null;
    if (db.version >= VER) return db;
    if (global.SptPrelim && global.SptPrelim.syncComponentsFromConfig) {
      global.SptPrelim.syncComponentsFromConfig(db);
      if (global.SptRisk) global.SptRisk.recalculateAll(db);
    }
    db.version = VER;
    return db;
  }

  function ensure() {
    var db = load();
    if (db) {
      var verBefore = db.version;
      db = migrate(db);
      if (db && db.version !== verBefore) save(db);
    }
    if (!db || !db.enrolments) {
      db = global.SptSeed.build();
      if (global.SptPrelim) global.SptPrelim.buildComponentsFromConfig(db);
      if (global.SptRisk) global.SptRisk.recalculateAll(db);
      save(db);
    }
    db.classes = db.classes || [];
    db.prior_attainment = db.prior_attainment || [];
    db.attendance_records = db.attendance_records || [];
    db.teacher_concerns = db.teacher_concerns || [];
    db.prelim_components = db.prelim_components || [];
    db.prelim_marks = db.prelim_marks || [];
    if (!db.prelim_components.length && global.SptPrelim) {
      global.SptPrelim.buildComponentsFromConfig(db);
      save(db);
    } else if (db.version < VER && global.SptPrelim) {
      if (global.SptPrelim.syncComponentsFromConfig(db)) save(db);
      else {
        db.version = VER;
        save(db);
      }
    }
    return db;
  }

  function reset() {
    localStorage.removeItem(KEY);
    localStorage.removeItem('spt-dev-v1');
    return ensure();
  }

  function uid(p) {
    return p + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
  }

  function audit(db, action) {
    db.audit_log = db.audit_log || [];
    db.audit_log.unshift({
      id: 'aud-' + Date.now(),
      user_id: db.dev_role || 'dev',
      user_label: (global.SptConfig.ROLES[db.dev_role] || {}).label || db.dev_role,
      action_type: action.action_type,
      table_name: action.table_name,
      record_id: action.record_id,
      previous_value: action.previous_value != null ? JSON.stringify(action.previous_value) : null,
      new_value: action.new_value != null ? JSON.stringify(action.new_value) : null,
      timestamp: new Date().toISOString()
    });
    if (db.audit_log.length > 500) db.audit_log.length = 500;
  }

  function getRole(db) {
    return global.SptConfig.ROLES[db.dev_role] || global.SptConfig.ROLES.faculty_head;
  }

  function setDevRole(roleId) {
    var db = ensure();
    db.dev_role = roleId;
    if (roleId === 'class_teacher' && !db.simulated_teacher_id) db.simulated_teacher_id = 't-anderson';
    return save(db);
  }

  function setSimulatedTeacher(teacherId) {
    var db = ensure();
    db.simulated_teacher_id = teacherId;
    return save(db);
  }

  function canViewEnrolment(db, enrolment) {
    var role = getRole(db);
    if (role.viewAll) return true;
    return enrolment.teacher_id === db.simulated_teacher_id;
  }

  function filterEnrolments(db, list) {
    return list.filter(function(e) { return e.active_status !== false && canViewEnrolment(db, e); });
  }

  function byId(arr, id) {
    return (arr || []).find(function(x) { return x.id === id; });
  }

  function pupilName(db, pupilId) {
    var p = byId(db.pupils, pupilId);
    return p ? (p.preferred_name || p.first_name) + ' ' + p.surname : 'Unknown';
  }

  function teacherName(db, teacherId) {
    var t = byId(db.teachers, teacherId);
    return t ? t.first_name + ' ' + t.surname : '—';
  }

  function courseName(db, courseId) {
    var c = byId(db.courses, courseId);
    return c ? c.course_name : '—';
  }

  function className(db, classId) {
    var c = byId(db.classes, classId);
    return c ? c.class_name : '—';
  }

  function trackingPoints(db) {
    return (db.school_tracking_points || []).slice().sort(function(a, b) {
      return (a.tracking_point_date || '').localeCompare(b.tracking_point_date || '');
    });
  }

  function attendanceForEnrolment(db, enrolmentId) {
    var tps = trackingPoints(db);
    return tps.map(function(tp) {
      var rec = (db.attendance_records || []).find(function(a) {
        return a.enrolment_id === enrolmentId && a.tracking_point_id === tp.id;
      });
      return { tracking_point: tp, record: rec || null };
    });
  }

  function priorForPupil(db, pupilId) {
    return (db.prior_attainment || []).filter(function(p) { return p.pupil_id === pupilId; });
  }

  function getEnrichedRows(db) {
    return filterEnrolments(db, db.enrolments).map(function(en) {
      var pupil = byId(db.pupils, en.pupil_id);
      var course = byId(db.courses, en.course_id);
      var tracking = (db.pupil_tracking_data || []).filter(function(t) { return t.enrolment_id === en.id; });
      var latestTp = tracking.sort(function(a, b) {
        var ta = byId(db.school_tracking_points, a.tracking_point_id);
        var tb = byId(db.school_tracking_points, b.tracking_point_id);
        return (tb && tb.tracking_point_date || '').localeCompare(ta && ta.tracking_point_date || '');
      })[0];
      var prelimAp = (db.assessment_points || []).find(function(ap) {
        return ap.course_id === en.course_id && ap.assessment_type === 'Prelim';
      });
      var prelimSummary = prelimAp && global.SptPrelim ? global.SptPrelim.computeSummary(db, en.id, prelimAp.id) : null;
      var prelimDisplay = prelimSummary ? (prelimSummary.percentage + '% ' + prelimSummary.grade_band) : null;
      if (!prelimDisplay && prelimAp) {
        var res = resultForAssessment(db, en.id, prelimAp.id);
        prelimDisplay = res ? (res.grade || res.score) : null;
      }
      var evidence = (db.evidence_bank || []).filter(function(ev) { return ev.enrolment_id === en.id; });
      var missingEv = evidence.filter(function(ev) {
        return ev.evidence_status === 'Missing' || ev.evidence_status === 'Not Started';
      }).length;
      var lc = (db.level_changes || []).find(function(l) {
        return l.enrolment_id === en.id && l.current_status !== 'Completed' && l.current_status !== 'Not Proceeding';
      });
      var ints = (db.interventions || []).filter(function(i) {
        return i.enrolment_id === en.id && i.intervention_status !== 'Completed';
      });
      var openFlags = global.SptConcerns ? global.SptConcerns.openFlags(db, en.id) : [];
      var att = attendanceForEnrolment(db, en.id);
      var worstAtt = att.reduce(function(min, a) {
        var s = a.record && a.record.attendance_score;
        if (s == null) return min;
        return min === null || s < min ? s : min;
      }, null);
      var prior = priorForPupil(db, en.pupil_id).filter(function(p) {
        return p.subject_area === course.subject_area;
      });
      var crashed = prior.some(function(p) { return p.pathway_status === 'Crashed / withdrew'; });
      return {
        enrolment: en,
        pupil: pupil,
        course: course,
        teacher_name: teacherName(db, en.teacher_id),
        class_name: en.class_id ? className(db, en.class_id) : (pupil && pupil.class_group) || '—',
        latest_tracking: latestTp,
        latest_tracking_point_name: latestTp ? (byId(db.school_tracking_points, latestTp.tracking_point_id) || {}).tracking_point_name : '—',
        prelim_result: prelimDisplay,
        prelim_summary: prelimSummary,
        evidence_missing_count: missingEv,
        level_change: lc || null,
        active_interventions: ints,
        open_flags: openFlags,
        open_flag_count: openFlags.length,
        attendance: att,
        worst_attendance: worstAtt,
        prior_attainment: prior,
        prior_crashed: crashed
      };
    });
  }

  function getSortedRows(db) {
    var rows = getEnrichedRows(db);
    return global.SptConcerns ? global.SptConcerns.sortByUrgency(rows, db) : rows;
  }

  function updateRecord(db, tableName, id, patch, actionType) {
    var arr = db[tableName];
    if (!arr) return null;
    var idx = arr.findIndex(function(r) { return r.id === id; });
    if (idx < 0) return null;
    var prev = Object.assign({}, arr[idx]);
    arr[idx] = Object.assign({}, arr[idx], patch, { updated_at: new Date().toISOString() });
    audit(db, { action_type: actionType || 'update', table_name: tableName, record_id: id, previous_value: prev, new_value: arr[idx] });
    var enId = arr[idx].enrolment_id || (tableName === 'enrolments' ? id : null);
    if (enId && global.SptRisk) global.SptRisk.recalculateEnrolment(db, enId);
    return save(db);
  }

  function insertRecord(db, tableName, record, actionType) {
    db[tableName] = db[tableName] || [];
    record.id = record.id || uid(tableName.slice(0, 2));
    record.created_at = record.created_at || new Date().toISOString();
    record.updated_at = record.updated_at || record.created_at;
    db[tableName].push(record);
    audit(db, { action_type: actionType || 'insert', table_name: tableName, record_id: record.id, previous_value: null, new_value: record });
    save(db);
    return record;
  }

  function deleteRecord(db, tableName, id) {
    db[tableName] = (db[tableName] || []).filter(function(r) { return r.id !== id; });
    save(db);
  }

  function upsertAttendance(db, enrolmentId, trackingPointId, score) {
    var existing = (db.attendance_records || []).find(function(a) {
      return a.enrolment_id === enrolmentId && a.tracking_point_id === trackingPointId;
    });
    if (existing) {
      updateRecord(db, 'attendance_records', existing.id, { attendance_score: parseInt(score, 10) }, 'attendance_update');
    } else {
      insertRecord(db, 'attendance_records', {
        enrolment_id: enrolmentId,
        tracking_point_id: trackingPointId,
        attendance_score: parseInt(score, 10),
        teacher_comment: ''
      }, 'attendance_insert');
    }
    if (global.SptRisk) global.SptRisk.recalculateEnrolment(db, enrolmentId);
    return db;
  }

  function assessmentPointsForCourse(db, courseId) {
    return (db.assessment_points || [])
      .filter(function(ap) { return ap.course_id === courseId; })
      .sort(function(a, b) { return a.display_order - b.display_order; });
  }

  function resultForAssessment(db, enrolmentId, assessmentPointId) {
    return (db.pupil_assessment_results || []).find(function(r) {
      return r.enrolment_id === enrolmentId && r.assessment_point_id === assessmentPointId;
    });
  }

  function upsertAssessmentResult(db, enrolmentId, assessmentPointId, patch) {
    var existing = resultForAssessment(db, enrolmentId, assessmentPointId);
    if (existing) {
      updateRecord(db, 'pupil_assessment_results', existing.id, patch, 'assessment_update');
      return byId(db.pupil_assessment_results, existing.id);
    }
    var row = Object.assign({
      enrolment_id: enrolmentId,
      assessment_point_id: assessmentPointId,
      score: null,
      grade: null,
      completion_status: 'In Progress',
      concern_status: 'Green',
      assessment_date: null,
      teacher_comment: '',
      next_steps: ''
    }, patch);
    insertRecord(db, 'pupil_assessment_results', row, 'assessment_create');
    if (global.SptRisk) global.SptRisk.recalculateEnrolment(db, enrolmentId);
    return row;
  }

  function createEnrolment(db, pupilId, courseId, classId, teacherId, level) {
    var en = insertRecord(db, 'enrolments', {
      pupil_id: pupilId,
      course_id: courseId,
      class_id: classId || null,
      teacher_id: teacherId,
      current_level: level || 'National 5',
      target_grade: '',
      latest_working_grade: '',
      final_estimate: '',
      risk_status: 'Green',
      risk_manual_override: false,
      risk_override_reason: '',
      has_open_flag: false,
      active_status: true,
      start_date: new Date().toISOString().slice(0, 10),
      end_date: null
    }, 'enrolment_create');
    return en;
  }

  global.SptStore = {
    load: load,
    save: save,
    ensure: ensure,
    reset: reset,
    uid: uid,
    audit: audit,
    getRole: getRole,
    setDevRole: setDevRole,
    setSimulatedTeacher: setSimulatedTeacher,
    canViewEnrolment: canViewEnrolment,
    filterEnrolments: filterEnrolments,
    byId: byId,
    pupilName: pupilName,
    teacherName: teacherName,
    courseName: courseName,
    className: className,
    trackingPoints: trackingPoints,
    attendanceForEnrolment: attendanceForEnrolment,
    priorForPupil: priorForPupil,
    getEnrichedRows: getEnrichedRows,
    getSortedRows: getSortedRows,
    updateRecord: updateRecord,
    insertRecord: insertRecord,
    deleteRecord: deleteRecord,
    upsertAttendance: upsertAttendance,
    assessmentPointsForCourse: assessmentPointsForCourse,
    resultForAssessment: resultForAssessment,
    upsertAssessmentResult: upsertAssessmentResult,
    createEnrolment: createEnrolment
  };
})(typeof window !== 'undefined' ? window : global);
