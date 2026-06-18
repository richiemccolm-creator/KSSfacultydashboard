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

  function hasScore(val) {
    return val != null && val !== '';
  }

  function hasText(val) {
    return String(val || '').trim().length > 0;
  }

  function hasBaselineData(db, enrolmentId, course, en) {
    if (!global.SptBaseline || !global.SptBaseline.showsS3Baseline(course, en)) return false;
    var baseline = global.SptBaseline.baselineForEnrolment(db, enrolmentId);
    if (!baseline) return false;
    if (baseline.s3_exam_raw != null || baseline.s3_exam_mark != null || hasText(baseline.s3_exam_grade)) return true;
    if (hasScore(baseline.effort) || hasScore(baseline.behaviour) ||
        hasScore(baseline.homelearning) || hasScore(baseline.progress)) return true;
    if (hasText(baseline.cfe_level)) return true;
    return false;
  }

  function hasTrackingData(db, enrolmentId, en, course) {
    if (!en) return false;

    if (hasBaselineData(db, enrolmentId, course, en)) return true;

    var att = (db.attendance_records || []).filter(function(a) { return a.enrolment_id === enrolmentId; });
    if (att.some(function(a) { return hasScore(a.attendance_score); })) return true;

    var tracking = (db.pupil_tracking_data || []).filter(function(t) { return t.enrolment_id === enrolmentId; });
    if (tracking.some(function(t) { return hasScore(t.effort) || hasScore(t.behaviour); })) return true;

    if (hasText(en.target_grade) || hasText(en.latest_working_grade) || hasText(en.final_estimate)) return true;

    var results = (db.pupil_assessment_results || []).filter(function(r) { return r.enrolment_id === enrolmentId; });
    if (results.some(function(r) {
      if (r.completion_status && r.completion_status !== 'Not Started') return true;
      if (r.concern_status && r.concern_status !== 'Green' && r.concern_status !== 'Grey') return true;
      if (hasScore(r.score)) return true;
      if (hasText(r.grade)) return true;
      return false;
    })) return true;

    if (Ev) {
      var evidence = Ev.evidenceForEnrolment(db, enrolmentId);
      if (evidence.some(function(ev) { return ev.evidence_status && ev.evidence_status !== 'Not Started'; })) return true;
    }

    return false;
  }

  function recalculateEnrolment(db, enrolmentId) {
    var en = global.SptStore.byId(db.enrolments, enrolmentId);
    if (!en) return;
    if (en.risk_manual_override) return;

    var course = global.SptStore.byId(db.courses, en.course_id);
    if (!hasTrackingData(db, enrolmentId, en, course)) {
      en.risk_status = 'Grey';
      en.risk_reasons = [];
      en.updated_at = new Date().toISOString();
      return;
    }

    var usesExam = Ev && Ev.usesExamRoute(course, en);
    var usesEvBank = Ev && Ev.usesEvidenceBank(course, en);
    var reasons = [];
    var red = false;
    var amber = false;

    if (global.SptBaseline && global.SptBaseline.showsS3Baseline(course, en)) {
      var baseline = global.SptBaseline.baselineForEnrolment(db, enrolmentId);
      if (baseline) {
        var examResult = global.SptBaseline.s3ExamResult(baseline, course);
        var examGrade = (examResult && examResult.grade) || baseline.s3_exam_grade || '';
        var examPct = examResult ? examResult.percentage : baseline.s3_exam_mark;
        if (examGrade === 'F' || examGrade === 'NP') {
          red = true;
          reasons.push('S3 exam result below pass (baseline)');
        } else if (examGrade === 'D' || examGrade === 'E') {
          amber = true;
          reasons.push('S3 exam result weak (baseline)');
        }
        if (examPct != null && !isNaN(examPct)) {
          if (examPct < 40) { red = true; reasons.push('S3 exam under 40% (baseline)'); }
          else if (examPct < 50) { amber = true; reasons.push('S3 exam under 50% (baseline)'); }
        }
        ['effort', 'behaviour', 'homelearning', 'progress'].forEach(function(field) {
          var s = baseline[field] != null && baseline[field] !== '' ? parseInt(baseline[field], 10) : null;
          var label = field === 'homelearning' ? 'Home learning' : field.charAt(0).toUpperCase() + field.slice(1);
          if (s === 1) { red = true; reasons.push(label + ' serious concern (S3 baseline)'); }
          else if (s === 2) { amber = true; reasons.push(label + ' some concern (S3 baseline)'); }
        });
        if (baseline.cfe_level === 'Second') {
          amber = true;
          reasons.push('S3 CfE level below Fourth (baseline)');
        } else if (baseline.cfe_level === 'Third') {
          amber = true;
          reasons.push('S3 CfE level Third (baseline)');
        }
      }
    }

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
        if (res && res.completion_status === 'Missing') {
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
      var missing = evidence.filter(function(ev) { return ev.evidence_status === 'Missing'; }).length;
      var rework = evidence.filter(function(ev) { return ev.evidence_status === 'Needs Rework'; }).length;
      if (missing >= 2 || rework >= 2) {
        red = true;
        reasons.push('Key unit evidence missing');
      } else if (missing >= 1 || rework >= 1) {
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

    var attRecords = (db.attendance_records || []).filter(function(a) { return a.enrolment_id === enrolmentId; });
    attRecords.forEach(function(a) {
      if (!global.SptWorkingGrade || a.attendance_score == null) return;
      var wgRisk = global.SptWorkingGrade.assessRisk(a.attendance_score, course);
      if (!wgRisk) return;
      if (wgRisk.level === 'red') { red = true; reasons.push(wgRisk.reason); }
      else if (wgRisk.level === 'amber') { amber = true; reasons.push(wgRisk.reason); }
    });

    var trackingRecords = (db.pupil_tracking_data || []).filter(function(t) { return t.enrolment_id === enrolmentId; });
    trackingRecords.forEach(function(t) {
      ['effort', 'behaviour'].forEach(function(field) {
        var s = t[field] != null && t[field] !== '' ? parseInt(t[field], 10) : null;
        if (s === 1) { red = true; reasons.push(field.charAt(0).toUpperCase() + field.slice(1) + ' serious concern (TP)'); }
        else if (s === 2) { amber = true; reasons.push(field.charAt(0).toUpperCase() + field.slice(1) + ' some concern (TP)'); }
      });
    });

    if (global.SptConcerns) {
      var openConcern = global.SptConcerns.openFlags(db, enrolmentId).length;
      var ongoingConcern = global.SptConcerns.activeFlags(db, enrolmentId)
        .filter(function(f) { return f.status === 'Ongoing'; }).length;
      if (openConcern) {
        amber = true;
        reasons.push('Open teacher concern flag');
      } else if (ongoingConcern) {
        amber = true;
        reasons.push('Concern under intervention');
      }
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
    hasTrackingData: hasTrackingData,
    recalculateEnrolment: recalculateEnrolment,
    recalculateAll: recalculateAll
  };
})(typeof window !== 'undefined' ? window : global);
