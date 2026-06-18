/**
 * Intervention support trail — chronological record of actions taken for a pupil.
 */
(function(global) {
  'use strict';

  function authorLabel(db) {
    if (db.dev_role === 'class_teacher' && db.simulated_teacher_id && global.SptStore) {
      return global.SptStore.teacherName(db, db.simulated_teacher_id);
    }
    var r = global.SptStore ? global.SptStore.getRole(db) : {};
    return r.label || db.dev_role || 'Staff';
  }

  function trailForIntervention(db, interventionId) {
    return (db.intervention_trail || []).filter(function(e) {
      return e.intervention_id === interventionId;
    }).sort(function(a, b) {
      return (a.created_at || '').localeCompare(b.created_at || '');
    });
  }

  function latestTrailEntry(db, interventionId) {
    var trail = trailForIntervention(db, interventionId);
    return trail.length ? trail[trail.length - 1] : null;
  }

  function canAddTrail(db, intervention) {
    if (!intervention || intervention.intervention_status === 'Completed') return false;
    var r = global.SptStore.getRole(db);
    if (!r.canAddInterventionNote) return false;
    var en = global.SptStore.byId(db.enrolments, intervention.enrolment_id);
    return !!(en && global.SptStore.canViewEnrolment(db, en));
  }

  function addTrailEntry(db, interventionId, payload) {
    var intervention = global.SptStore.byId(db.interventions, interventionId);
    if (!intervention) return null;
    var entry = global.SptStore.insertRecord(db, 'intervention_trail', {
      intervention_id: interventionId,
      note: (payload.note || '').trim(),
      author_role: db.dev_role,
      author_teacher_id: db.simulated_teacher_id || null,
      author_label: authorLabel(db),
      source: payload.source || 'follow_up',
      concern_id: payload.concern_id || null
    }, 'intervention_trail_entry');
    if (intervention.intervention_status === 'Planned') {
      global.SptStore.updateRecord(db, 'interventions', interventionId, {
        intervention_status: 'Active'
      }, 'intervention_activated');
    }
    if (global.SptFeedback) {
      global.SptFeedback.notifyTrailEntry(db, entry, intervention);
    }
    return entry;
  }

  function sourceLabel(source) {
    if (source === 'alert_action') return 'Initial action';
    return 'Follow-up';
  }

  global.SptInterventions = {
    authorLabel: authorLabel,
    trailForIntervention: trailForIntervention,
    latestTrailEntry: latestTrailEntry,
    canAddTrail: canAddTrail,
    addTrailEntry: addTrailEntry,
    sourceLabel: sourceLabel
  };
})(typeof window !== 'undefined' ? window : global);
