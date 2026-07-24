/**
 * Report builders and CSV export for Senior Phase Tracking (dev).
 */
(function(global) {
  'use strict';

  function csvEscape(v) {
    return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
  }

  function toCsv(headers, rows) {
    var lines = [headers.map(csvEscape).join(',')];
    rows.forEach(function(r) {
      lines.push(headers.map(function(h) { return csvEscape(r[h]); }).join(','));
    });
    return '\uFEFF' + lines.join('\n');
  }

  function downloadCsv(filename, content) {
    var blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function pupilsAtRisk(db) {
    var rows = global.SptStore.getEnrichedRows(db).filter(function(r) {
      return r.enrolment.risk_status === 'Red' || r.enrolment.risk_status === 'Amber';
    });
    return rows.map(function(r) {
      var missing = (db.pupil_assessment_results || []).filter(function(ar) {
        var ap = global.SptStore.byId(db.assessment_points, ar.assessment_point_id);
        return ar.enrolment_id === r.enrolment.id && ap && ap.is_required &&
          ar.completion_status === 'Missing';
      });
      var int = r.active_interventions[0];
      return {
        pupil: global.SptStore.pupilName(db, r.pupil.id),
        course: r.course.course_name,
        teacher: r.teacher_name,
        current_level: r.enrolment.current_level,
        target_grade: r.enrolment.target_grade,
        latest_working_grade: r.enrolment.latest_working_grade,
        risk_status: r.enrolment.risk_status,
        risk_reason: (r.enrolment.risk_reasons || []).join('; '),
        missing_items: missing.length,
        intervention: int ? int.intervention_description : '—',
        next_review: int ? int.review_date : '—'
      };
    });
  }

  function missingEvidence(db) {
    return (db.evidence_bank || []).filter(function(ev) {
      if (ev.evidence_status !== 'Missing' && ev.evidence_status !== 'Needs Rework') return false;
      var en = global.SptStore.byId(db.enrolments, ev.enrolment_id);
      if (!en) return false;
      var course = global.SptStore.byId(db.courses, en.course_id);
      if (!global.SptEvidence || !global.SptEvidence.usesEvidenceBank(course, en)) return false;
      return global.SptRisk && global.SptRisk.hasTrackingData(db, ev.enrolment_id, en, course);
    }).map(function(ev) {
      var en = global.SptStore.byId(db.enrolments, ev.enrolment_id);
      return {
        pupil: global.SptStore.pupilName(db, en.pupil_id),
        course: global.SptStore.courseName(db, en.course_id),
        unit_component: (ev.unit_code ? ev.unit_code + ' — ' : '') + ev.unit_or_component,
        teacher: global.SptStore.teacherName(db, en.teacher_id),
        evidence_status: ev.evidence_status,
        notes: ev.notes
      };
    });
  }

  function levelChangeReport(db) {
    return (db.level_changes || []).map(function(lc) {
      var en = global.SptStore.byId(db.enrolments, lc.enrolment_id);
      return {
        pupil: global.SptStore.pupilName(db, en.pupil_id),
        course: global.SptStore.courseName(db, en.course_id),
        original_level: lc.original_level,
        recommended_level: lc.recommended_level,
        reason: lc.reason_for_recommendation,
        status: lc.current_status,
        pupil_discussed: lc.pupil_discussed ? 'Yes' : 'No',
        parent_contacted: lc.parent_carer_contacted ? 'Yes' : 'No',
        sqa_confirmed: lc.confirmed_on_sqa_system ? 'Yes' : 'No'
      };
    });
  }

  function interventionReport(db) {
    return (db.interventions || []).map(function(i) {
      var en = global.SptStore.byId(db.enrolments, i.enrolment_id);
      return {
        pupil: global.SptStore.pupilName(db, en.pupil_id),
        course: global.SptStore.courseName(db, en.course_id),
        teacher: global.SptStore.teacherName(db, en.teacher_id),
        concern_area: i.concern_area,
        intervention: i.intervention_description,
        start_date: i.intervention_start_date,
        review_date: i.review_date,
        status: i.intervention_status,
        impact: i.impact_rating,
        outcome: i.outcome_notes
      };
    });
  }

  function courseOverview(db) {
    return global.SptStore.getEnrichedRows(db).map(function(r) {
      return {
        course: r.course.course_name,
        pupil: global.SptStore.pupilName(db, r.pupil.id),
        teacher: r.teacher_name,
        level: r.enrolment.current_level,
        target: r.enrolment.target_grade,
        working: r.enrolment.latest_working_grade,
        risk: r.enrolment.risk_status,
        final_estimate: r.enrolment.final_estimate
      };
    });
  }

  function prelimPerformance(db) {
    return global.SptStore.getEnrichedRows(db).filter(function(r) {
      return r.course.has_prelim;
    }).map(function(r) {
      return {
        pupil: global.SptStore.pupilName(db, r.pupil.id),
        course: r.course.course_name,
        teacher: r.teacher_name,
        target: r.enrolment.target_grade,
        prelim: r.prelim_result,
        risk: r.enrolment.risk_status
      };
    });
  }

  function finalEstimateReport(db) {
    return global.SptStore.getEnrichedRows(db).map(function(r) {
      return {
        pupil: global.SptStore.pupilName(db, r.pupil.id),
        course: r.course.course_name,
        teacher: r.teacher_name,
        working: r.enrolment.latest_working_grade,
        final_estimate: r.enrolment.final_estimate,
        risk: r.enrolment.risk_status
      };
    });
  }

  function teacherFlagsReport(db) {
    return (db.teacher_concerns || []).map(function(f) {
      var en = global.SptStore.byId(db.enrolments, f.enrolment_id);
      return {
        pupil: global.SptStore.pupilName(db, en.pupil_id),
        course: global.SptStore.courseName(db, en.course_id),
        teacher: global.SptStore.teacherName(db, f.raised_by_teacher_id),
        category: f.category,
        comment: f.comment,
        status: f.status,
        raised: (f.created_at || '').slice(0, 10)
      };
    });
  }

  var REPORTS = {
    'teacher-flags': { title: 'Teacher Concern Flags', fn: teacherFlagsReport, headers: ['pupil', 'course', 'teacher', 'category', 'comment', 'status', 'raised'] },
    'at-risk': { title: 'Pupils at Risk', fn: pupilsAtRisk, headers: ['pupil', 'course', 'teacher', 'current_level', 'target_grade', 'latest_working_grade', 'risk_status', 'risk_reason', 'missing_items', 'intervention', 'next_review'] },
    'missing-evidence': { title: 'Missing Evidence', fn: missingEvidence, headers: ['pupil', 'course', 'unit_component', 'teacher', 'evidence_status', 'notes'] },
    'level-change': { title: 'Level Change', fn: levelChangeReport, headers: ['pupil', 'course', 'original_level', 'recommended_level', 'reason', 'status', 'pupil_discussed', 'parent_contacted', 'sqa_confirmed'] },
    'interventions': { title: 'Interventions', fn: interventionReport, headers: ['pupil', 'course', 'teacher', 'concern_area', 'intervention', 'start_date', 'review_date', 'status', 'impact', 'outcome'] },
    'course-overview': { title: 'Course Overview', fn: courseOverview, headers: ['course', 'pupil', 'teacher', 'level', 'target', 'working', 'risk', 'final_estimate'] },
    'prelim': { title: 'Prelim Performance', fn: prelimPerformance, headers: ['pupil', 'course', 'teacher', 'target', 'prelim', 'risk'] },
    'final-estimate': { title: 'Final Estimate', fn: finalEstimateReport, headers: ['pupil', 'course', 'teacher', 'working', 'final_estimate', 'risk'] }
  };

  global.SptReports = {
    REPORTS: REPORTS,
    toCsv: toCsv,
    downloadCsv: downloadCsv
  };
})(typeof window !== 'undefined' ? window : global);
