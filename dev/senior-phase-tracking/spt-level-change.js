/**
 * Level change and course withdrawal requests.
 */
(function(global) {
  'use strict';

  var ACTIVE_STATUSES = ['Under Review', 'Recommended', 'Approved'];

  function activeForEnrolment(db, enrolmentId) {
    return (db.level_changes || []).find(function(lc) {
      return lc.enrolment_id === enrolmentId && ACTIVE_STATUSES.indexOf(lc.current_status) >= 0;
    }) || null;
  }

  function targetLevels(course, currentLevel) {
    if (!course) return [];
    return global.SptStore.levelsForCourse(course).filter(function(l) { return l !== currentLevel; });
  }

  function emptyRecord(enrolmentId, changeType) {
    return {
      enrolment_id: enrolmentId,
      change_type: changeType || 'level',
      original_level: '',
      recommended_level: '',
      current_status: 'Under Review',
      reason_for_recommendation: '',
      evidence_summary: '',
      pupil_discussed: false,
      pupil_discussion_date: null,
      parent_carer_contacted: false,
      parent_carer_contact_date: null,
      faculty_head_approved: false,
      sqa_coordinator_notified: false,
      confirmed_on_sqa_system: false,
      date_completed: null,
      notes: ''
    };
  }

  function requestLevelChange(db, enrolmentId, payload) {
    var en = global.SptStore.byId(db.enrolments, enrolmentId);
    if (!en) return { error: 'Enrolment not found' };
    var course = global.SptStore.byId(db.courses, en.course_id);
    if (!course || !course.supports_level_change) return { error: 'This course does not support level changes' };
    if (activeForEnrolment(db, enrolmentId)) return { error: 'A level change or withdrawal is already pending for this pupil' };
    if (!payload.recommended_level) return { error: 'Select a recommended level' };
    if (payload.recommended_level === en.current_level) return { error: 'Recommended level must differ from current level' };
    var row = global.SptStore.insertRecord(db, 'level_changes', Object.assign(emptyRecord(enrolmentId, 'level'), {
      original_level: en.current_level,
      recommended_level: payload.recommended_level,
      reason_for_recommendation: payload.reason_for_recommendation || '',
      evidence_summary: payload.evidence_summary || '',
      pupil_discussed: !!payload.pupil_discussed,
      pupil_discussion_date: payload.pupil_discussed ? (payload.pupil_discussion_date || today()) : null
    }), 'level_change_request');
    return { level_change: row };
  }

  function requestWithdrawal(db, enrolmentId, payload) {
    var en = global.SptStore.byId(db.enrolments, enrolmentId);
    if (!en) return { error: 'Enrolment not found' };
    if (activeForEnrolment(db, enrolmentId)) return { error: 'A level change or withdrawal is already pending for this pupil' };
    var row = global.SptStore.insertRecord(db, 'level_changes', Object.assign(emptyRecord(enrolmentId, 'withdrawal'), {
      original_level: en.current_level,
      recommended_level: 'Withdrawn',
      reason_for_recommendation: payload.reason_for_recommendation || '',
      evidence_summary: payload.evidence_summary || '',
      pupil_discussed: !!payload.pupil_discussed,
      pupil_discussion_date: payload.pupil_discussed ? (payload.pupil_discussion_date || today()) : null
    }), 'withdrawal_request');
    return { level_change: row };
  }

  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  function approveChange(db, levelChangeId) {
    return global.SptStore.updateRecord(db, 'level_changes', levelChangeId, {
      current_status: 'Approved',
      faculty_head_approved: true
    }, 'level_change_approve');
  }

  function rejectChange(db, levelChangeId, notes) {
    return global.SptStore.updateRecord(db, 'level_changes', levelChangeId, {
      current_status: 'Not Proceeding',
      notes: notes || '',
      date_completed: today()
    }, 'level_change_reject');
  }

  function confirmAndApply(db, levelChangeId) {
    var lc = global.SptStore.byId(db.level_changes, levelChangeId);
    if (!lc) return { error: 'Request not found' };
    if (ACTIVE_STATUSES.indexOf(lc.current_status) < 0 && lc.current_status !== 'Approved') {
      return { error: 'This request is no longer active' };
    }
    var en = global.SptStore.byId(db.enrolments, lc.enrolment_id);
    if (!en) return { error: 'Enrolment not found' };

    if (lc.change_type === 'withdrawal') {
      global.SptStore.updateRecord(db, 'enrolments', en.id, {
        withdrawal_status: 'Withdrawn',
        active_status: false,
        end_date: today()
      }, 'withdrawal_apply');
    } else {
      global.SptStore.updateRecord(db, 'enrolments', en.id, {
        current_level: lc.recommended_level,
        withdrawal_status: null
      }, 'level_change_apply');
      if (global.SptEvidence) global.SptEvidence.syncEnrolment(db, en.id);
      if (global.SptBaseline && global.SptBaseline.ensureBaseline) {
        global.SptBaseline.ensureBaseline(db, en.id);
      }
    }

    global.SptStore.updateRecord(db, 'level_changes', levelChangeId, {
      current_status: 'Completed',
      faculty_head_approved: true,
      confirmed_on_sqa_system: true,
      date_completed: today()
    }, 'level_change_complete');

    if (global.SptRisk) global.SptRisk.recalculateEnrolment(db, en.id);
    return { level_change: global.SptStore.byId(db.level_changes, levelChangeId) };
  }

  function isPending(lc) {
    return lc && ACTIVE_STATUSES.indexOf(lc.current_status) >= 0;
  }

  function wasRecentlyChanged(lc, en) {
    return lc && lc.change_type === 'level' && lc.current_status === 'Completed' &&
      lc.recommended_level === en.current_level;
  }

  global.SptLevelChange = {
    ACTIVE_STATUSES: ACTIVE_STATUSES,
    activeForEnrolment: activeForEnrolment,
    targetLevels: targetLevels,
    requestLevelChange: requestLevelChange,
    requestWithdrawal: requestWithdrawal,
    approveChange: approveChange,
    rejectChange: rejectChange,
    confirmAndApply: confirmAndApply,
    isPending: isPending,
    wasRecentlyChanged: wasRecentlyChanged
  };
})(typeof window !== 'undefined' ? window : global);
