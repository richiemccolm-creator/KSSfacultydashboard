/**
 * Teacher concern flags, faculty head actions, and concern closure.
 */
(function(global) {
  'use strict';

  var ACTIVE_STATUSES = ['Open', 'Ongoing'];

  function flagsForEnrolment(db, enrolmentId, statuses) {
    return (db.teacher_concerns || []).filter(function(f) {
      if (f.enrolment_id !== enrolmentId) return false;
      if (!statuses) return true;
      return statuses.indexOf(f.status) >= 0;
    });
  }

  function openFlags(db, enrolmentId) {
    return flagsForEnrolment(db, enrolmentId, ['Open']);
  }

  function activeFlags(db, enrolmentId) {
    return flagsForEnrolment(db, enrolmentId, ACTIVE_STATUSES);
  }

  function openFlagCount(db) {
    return (db.teacher_concerns || []).filter(function(f) {
      var en = global.SptStore.byId(db.enrolments, f.enrolment_id);
      return f.status === 'Open' && en && global.SptStore.canViewEnrolment(db, en);
    }).length;
  }

  function activeFlagCount(db, enrolmentId) {
    return activeFlags(db, enrolmentId).length;
  }

  function syncEnrolmentFlag(db, enrolmentId) {
    var active = activeFlagCount(db, enrolmentId) > 0;
    var en = global.SptStore.byId(db.enrolments, enrolmentId);
    if (!en || en.has_open_flag === active) return en;
    return global.SptStore.updateRecord(db, 'enrolments', enrolmentId, {
      has_open_flag: active
    }, active ? 'concern_flag_set' : 'concern_flags_cleared');
  }

  function primaryConcernStatus(flags) {
    if (!flags || !flags.length) return null;
    if (flags.some(function(f) { return f.status === 'Open'; })) return 'Open';
    return 'Ongoing';
  }

  function raiseFlag(db, enrolmentId, payload) {
    var en = global.SptStore.byId(db.enrolments, enrolmentId);
    if (!en) return null;
    var teacherId = db.simulated_teacher_id || en.teacher_id;
    var flag = global.SptStore.insertRecord(db, 'teacher_concerns', {
      enrolment_id: enrolmentId,
      raised_by_teacher_id: teacherId,
      category: payload.category || 'Other',
      comment: payload.comment || '',
      status: 'Open',
      is_urgent: true,
      intervention_id: null,
      action_taken_at: null,
      action_taken_by: null,
      resolved_at: null,
      resolved_by: null,
      resolution_note: '',
      closure_outcome: ''
    }, 'concern_raised');
    syncEnrolmentFlag(db, enrolmentId);
    return flag;
  }

  function actionFlag(db, flagId, payload) {
    var flag = global.SptStore.byId(db.teacher_concerns, flagId);
    if (!flag || flag.status !== 'Open') return null;
    var interventionId = payload.intervention_id;
    if (!interventionId && payload.create_intervention) {
      var en = global.SptStore.byId(db.enrolments, flag.enrolment_id);
      var int = global.SptStore.insertRecord(db, 'interventions', {
        enrolment_id: flag.enrolment_id,
        concern_area: payload.concern_area || flag.category,
        intervention_description: payload.intervention_description,
        intervention_start_date: payload.intervention_start_date || new Date().toISOString().slice(0, 10),
        review_date: payload.review_date,
        responsible_teacher_id: payload.responsible_teacher_id || en.teacher_id,
        intervention_status: 'Active',
        outcome_notes: '',
        impact_rating: 'Not Yet Known'
      }, 'intervention_from_flag');
      interventionId = int.id;
    }
    if (!interventionId) return null;
    var actionNote = (payload.action_note || payload.resolution_note || '').trim();
    if (actionNote && global.SptInterventions) {
      global.SptInterventions.addTrailEntry(db, interventionId, {
        note: actionNote,
        source: 'alert_action',
        concern_id: flagId
      });
    }
    global.SptStore.updateRecord(db, 'teacher_concerns', flagId, {
      status: 'Ongoing',
      intervention_id: interventionId,
      action_taken_at: new Date().toISOString(),
      action_taken_by: 'faculty_head',
      resolution_note: actionNote
    }, 'concern_action_taken');
    syncEnrolmentFlag(db, flag.enrolment_id);
    return flag;
  }

  function closeFlag(db, flagId, payload) {
    payload = payload || {};
    var flag = global.SptStore.byId(db.teacher_concerns, flagId);
    if (!flag || flag.status === 'Resolved') return null;
    var note = (payload.closure_note || '').trim();
    global.SptStore.updateRecord(db, 'teacher_concerns', flagId, {
      status: 'Resolved',
      resolved_at: new Date().toISOString(),
      resolved_by: 'faculty_head',
      closure_outcome: payload.closure_outcome || 'resolved',
      resolution_note: note || flag.resolution_note || ''
    }, 'concern_closed');
    syncEnrolmentFlag(db, flag.enrolment_id);
    return flag;
  }

  function sortByUrgency(rows, db) {
    return rows.slice().sort(function(a, b) {
      var aF = activeFlags(db, a.enrolment.id).length > 0;
      var bF = activeFlags(db, b.enrolment.id).length > 0;
      if (aF !== bF) return aF ? -1 : 1;
      var aOpen = openFlags(db, a.enrolment.id).length > 0;
      var bOpen = openFlags(db, b.enrolment.id).length > 0;
      if (aOpen !== bOpen) return aOpen ? -1 : 1;
      var ro = { Red: 0, Amber: 1, Green: 2, Grey: 3 };
      return (ro[a.enrolment.risk_status] || 3) - (ro[b.enrolment.risk_status] || 3);
    });
  }

  global.SptConcerns = {
    ACTIVE_STATUSES: ACTIVE_STATUSES,
    openFlags: openFlags,
    activeFlags: activeFlags,
    openFlagCount: openFlagCount,
    activeFlagCount: activeFlagCount,
    primaryConcernStatus: primaryConcernStatus,
    syncEnrolmentFlag: syncEnrolmentFlag,
    raiseFlag: raiseFlag,
    actionFlag: actionFlag,
    resolveFlag: actionFlag,
    closeFlag: closeFlag,
    sortByUrgency: sortByUrgency
  };
})(typeof window !== 'undefined' ? window : global);
