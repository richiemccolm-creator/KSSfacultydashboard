/**
 * Teacher concern flags and Faculty Head resolution.
 */
(function(global) {
  'use strict';

  function openFlags(db, enrolmentId) {
    return (db.teacher_concerns || []).filter(function(f) {
      return f.enrolment_id === enrolmentId && f.status === 'Open';
    });
  }

  function openFlagCount(db) {
    return (db.teacher_concerns || []).filter(function(f) {
      var en = global.SptStore.byId(db.enrolments, f.enrolment_id);
      return f.status === 'Open' && en && global.SptStore.canViewEnrolment(db, en);
    }).length;
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
      resolved_at: null,
      resolved_by: null,
      resolution_note: ''
    }, 'concern_raised');
    global.SptStore.updateRecord(db, 'enrolments', enrolmentId, { has_open_flag: true }, 'concern_flag_set');
    return flag;
  }

  function resolveFlag(db, flagId, payload) {
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
    global.SptStore.updateRecord(db, 'teacher_concerns', flagId, {
      status: 'Resolved',
      intervention_id: interventionId,
      resolved_at: new Date().toISOString(),
      resolved_by: 'faculty_head',
      resolution_note: payload.resolution_note || ''
    }, 'concern_resolved');
    var stillOpen = openFlags(db, flag.enrolment_id).length;
    if (!stillOpen) {
      global.SptStore.updateRecord(db, 'enrolments', flag.enrolment_id, { has_open_flag: false }, 'concern_flags_cleared');
    }
    return flag;
  }

  function sortByUrgency(rows, db) {
    return rows.slice().sort(function(a, b) {
      var aF = openFlags(db, a.enrolment.id).length > 0;
      var bF = openFlags(db, b.enrolment.id).length > 0;
      if (aF !== bF) return aF ? -1 : 1;
      var ro = { Red: 0, Amber: 1, Green: 2, Grey: 3 };
      return (ro[a.enrolment.risk_status] || 3) - (ro[b.enrolment.risk_status] || 3);
    });
  }

  global.SptConcerns = {
    openFlags: openFlags,
    openFlagCount: openFlagCount,
    raiseFlag: raiseFlag,
    resolveFlag: resolveFlag,
    sortByUrgency: sortByUrgency
  };
})(typeof window !== 'undefined' ? window : global);
