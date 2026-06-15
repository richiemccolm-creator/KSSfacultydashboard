/**
 * Auto risk calculation for Senior Phase Tracking (dev).
 */
(function(global) {
  'use strict';

  var C = global.SptConfig;
  var Ev = global.SptEvidence;

  function daysUntil(dateStr) {
    if (!dateStr) return 999;
    var d = new Date(dateStr);
    var now = new Date();
    return Math.ceil((d - now) / (1000 * 60 * 60 * 24));
  }

  function recalculateEnrolment(db, enrolmentId) {
    var en = global.SptStore.byId(db.enrolments, enrolmentId);
    if (!en) return;
    if (en.risk_manual_override) return;

    var course = global.SptStore.byId(db.courses, en.course_id);
    var usesExam = Ev && Ev.usesExamRoute(course, en);
    var usesEvBank = Ev && Ev.usesEvidenceBank(course, en);
    var reasons = [];
    var red = false;
    var amber = false;

    if (usesExam) {
      var target = en.target_grade;
      var working = en.latest_working_grade;
      var tRank = C.gradeRank(target);
      var wRank = C.gradeRank(working);
      if (tRank >= 0 && wRank >= 0) {
        var gap = tRank - wRank;
        if (gap >= 2) { red = true; reasons.push('Working grade well below target'); }
        else if (gap === 1) { amber = true; reasons.push('Working grade one band below target'); }
      }

      var aps = (db.assessment_points || []).filter(function(ap) {
        return ap.course_id === en.course_id && ap.is_required;
      });
      var results = (db.pupil_assessment_results || []).filter(function(r) {
        return r.enrolment_id === enrolmentId;
      });
      var missingCount = 0;
      aps.forEach(function(ap) {
        var res = results.find(function(r) { return r.assessment_point_id === ap.id; });
        if (!res || res.completion_status === 'Missing' || res.completion_status === 'Not Started') {
          missingCount++;
        }
        if (res && ap.assessment_type === 'Prelim' && res.completion_status === 'Complete') {
          var pGap = C.gradeRank(target) - C.gradeRank(res.grade);
          if (pGap >= 2) { red = true; reasons.push('Prelim seriously below target'); }
          else if (pGap === 1) { amber = true; reasons.push('Prelim below target'); }
          if (res.score != null && res.score < 40) { red = true; reasons.push('Prelim score under 40%'); }
        }
      });
      if (missingCount >= 2) { red = true; reasons.push('Multiple required assessments missing'); }
      else if (missingCount === 1) { amber = true; reasons.push('One required assessment missing'); }
    }

    if (usesEvBank) {
      var evidence = Ev.evidenceForEnrolment(db, enrolmentId);
      var criticalMissing = evidence.filter(function(ev) {
        return ev.evidence_status === 'Missing' || ev.evidence_status === 'Not Started';
      }).length;
      var total = evidence.length;
      var banked = Ev.bankedCount(db, enrolmentId);
      if (criticalMissing >= 2 || (total >= 3 && banked === 0)) {
        red = true;
        reasons.push('Key unit evidence missing');
      } else if (criticalMissing >= 1) {
        amber = true;
        reasons.push('Incomplete unit evidence');
      }
    }

    var ints = (db.interventions || []).filter(function(i) {
      return i.enrolment_id === enrolmentId && i.intervention_status !== 'Completed';
    });
    ints.forEach(function(i) {
      var days = daysUntil(i.review_date);
      if (days < 0) { red = true; reasons.push('Intervention review overdue'); }
      else if (days <= 7) { amber = true; reasons.push('Intervention review due soon'); }
    });

    var att = (db.attendance_records || []).filter(function(a) { return a.enrolment_id === enrolmentId; });
    att.forEach(function(a) {
      if (a.attendance_score === 1) { red = true; reasons.push('Attendance serious concern (TP)'); }
      else if (a.attendance_score === 2) { amber = true; reasons.push('Attendance some concern (TP)'); }
    });

    var tracking = (db.pupil_tracking_data || []).filter(function(t) { return t.enrolment_id === enrolmentId; });
    tracking.forEach(function(t) {
      ['effort', 'behaviour'].forEach(function(field) {
        var s = t[field] != null && t[field] !== '' ? parseInt(t[field], 10) : null;
        if (s === 1) { red = true; reasons.push(field.charAt(0).toUpperCase() + field.slice(1) + ' serious concern (TP)'); }
        else if (s === 2) { amber = true; reasons.push(field.charAt(0).toUpperCase() + field.slice(1) + ' some concern (TP)'); }
      });
    });

    if (global.SptConcerns && global.SptConcerns.openFlags(db, enrolmentId).length) {
      amber = true;
      reasons.push('Open teacher concern flag');
    }

    var status = 'Green';
    if (red) status = 'Red';
    else if (amber) status = 'Amber';

    en.risk_status = status;
    en.risk_reasons = reasons;
    en.updated_at = new Date().toISOString();
  }

  function recalculateAll(db) {
    (db.enrolments || []).forEach(function(en) {
      recalculateEnrolment(db, en.id);
    });
    return db;
  }

  global.SptRisk = {
    recalculateEnrolment: recalculateEnrolment,
    recalculateAll: recalculateAll
  };
})(typeof window !== 'undefined' ? window : global);
