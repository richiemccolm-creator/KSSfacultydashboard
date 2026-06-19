/**
 * Development seed data for Senior Phase Tracking (sample pupils only).
 */
(function(global) {
  'use strict';

  var C = global.SptConfig;

  function uid(prefix) {
    return prefix + '-' + Math.random().toString(36).slice(2, 10);
  }

  function now() {
    return new Date().toISOString();
  }

  function buildAssessmentPoints(courses) {
    var points = [];
    courses.forEach(function(course) {
      var tpl = C.ASSESSMENT_TEMPLATES[course.default_assessment_model] || [];
      tpl.forEach(function(a, i) {
        points.push({
          id: uid('ap'),
          course_id: course.id,
          assessment_name: a.assessment_name,
          assessment_type: a.assessment_type,
          assessment_window: a.assessment_window,
          max_score: a.assessment_type === 'Prelim' ? 100 : null,
          weighting: null,
          is_required: a.is_required,
          display_order: i + 1,
          created_at: now(),
          updated_at: now()
        });
      });
    });
    return points;
  }

  function buildSeed() {
    var ts = now();
    var teachers = [
      { id: 't-anderson', first_name: 'Fiona', surname: 'Anderson', email: 'f.anderson@dev.school', role: 'Class Teacher', active_status: true, created_at: ts, updated_at: ts },
      { id: 't-bruce', first_name: 'David', surname: 'Bruce', email: 'd.bruce@dev.school', role: 'Class Teacher', active_status: true, created_at: ts, updated_at: ts },
      { id: 't-campbell', first_name: 'Moira', surname: 'Campbell', email: 'm.campbell@dev.school', role: 'Class Teacher', active_status: true, created_at: ts, updated_at: ts },
      { id: 't-douglas', first_name: 'Ewan', surname: 'Douglas', email: 'e.douglas@dev.school', role: 'Class Teacher', active_status: true, created_at: ts, updated_at: ts },
      { id: 't-evans', first_name: 'Helen', surname: 'Evans', email: 'h.evans@dev.school', role: 'Faculty Head', active_status: true, created_at: ts, updated_at: ts }
    ];

    var courses = C.COURSE_DEFS.map(function(def) {
      return {
        id: 'c-' + def.slug,
        slug: def.slug,
        course_name: def.course_name,
        subject_area: def.subject_area,
        scqf_level: def.scqf_level,
        course_type: def.course_type,
        has_prelim: def.has_prelim,
        supports_level_change: def.supports_level_change,
        default_assessment_model: def.default_assessment_model,
        active_status: true,
        created_at: ts,
        updated_at: ts
      };
    });

    var cohort = global.SptSeedRoster.buildCohort(ts);
    var classes = cohort.classes;
    var pupils = cohort.pupils;
    var enrolments = cohort.enrolments;

    var trackingPoints = C.TRACKING_POINT_NAMES.map(function(tp) {
      return {
        id: uid('tp'),
        tracking_point_name: tp.tracking_point_name,
        tracking_point_date: tp.tracking_point_date,
        academic_year: tp.academic_year,
        created_at: ts,
        updated_at: ts
      };
    });

    var assessmentPoints = buildAssessmentPoints(courses);

    var pupilTrackingData = [];
    var tp1 = trackingPoints[0];
    var tp2 = trackingPoints[1];
    var tp3 = trackingPoints[2];
    enrolments.forEach(function(en, idx) {
      pupilTrackingData.push({
        id: uid('ptd'),
        enrolment_id: en.id,
        tracking_point_id: tp1.id,
        effort: idx % 5 === 0 ? 2 : 3,
        behaviour: idx % 4 === 0 ? 2 : 3,
        imported_from_school_tracking: true,
        import_batch_id: 'batch-seed-001',
        created_at: ts,
        updated_at: ts
      });
      pupilTrackingData.push({
        id: uid('ptd'),
        enrolment_id: en.id,
        tracking_point_id: tp2.id,
        working_grade: en.latest_working_grade,
        target_grade: en.target_grade,
        effort: idx % 3 === 0 ? 3 : 2,
        behaviour: 3,
        homework: idx % 4 === 0 ? 2 : 3,
        concern_level: en.risk_status === 'Red' ? 'High' : en.risk_status === 'Amber' ? 'Medium' : 'Low',
        teacher_comment: 'Imported from whole-school tracking (sample)',
        imported_from_school_tracking: true,
        import_batch_id: 'batch-seed-001',
        created_at: ts,
        updated_at: ts
      });
      if (en.id === 'e-jamie-hd') {
        pupilTrackingData.push({
          id: uid('ptd'),
          enrolment_id: en.id,
          tracking_point_id: tp3.id,
          working_grade: 'D',
          target_grade: 'B',
          effort: 2,
          behaviour: 3,
          homework: '2',
          concern_level: 'Medium',
          teacher_comment: 'Prelim concern — faculty follow-up',
          imported_from_school_tracking: false,
          import_batch_id: null,
          created_at: ts,
          updated_at: ts
        });
      }
    });

    var pupilAssessmentResults = [];
    function addResult(enrolmentId, courseSlug, assessmentName, opts) {
      var course = courses.find(function(c) { return c.id === 'c-' + courseSlug || c.default_assessment_model === courseSlug; });
      if (!course) course = courses.find(function(c) { return c.id === enrolmentId.split('-').pop(); });
      var en = enrolments.find(function(e) { return e.id === enrolmentId; });
      if (!en) return;
      var ap = assessmentPoints.find(function(a) { return a.course_id === en.course_id && a.assessment_name === assessmentName; });
      if (!ap) return;
      pupilAssessmentResults.push({
        id: uid('par'),
        enrolment_id: enrolmentId,
        assessment_point_id: ap.id,
        score: opts.score != null ? opts.score : null,
        grade: opts.grade || null,
        completion_status: opts.completion_status || 'In Progress',
        concern_status: opts.concern_status || 'Green',
        assessment_date: opts.assessment_date || '2026-01-20',
        teacher_comment: opts.teacher_comment || '',
        next_steps: opts.next_steps || '',
        created_at: ts,
        updated_at: ts
      });
    }

    addResult('e-emma-hd', 'higher-drama', 'Section 1: Text in Context', { grade: 'A', completion_status: 'Complete', concern_status: 'Green' });
    addResult('e-emma-hd', 'higher-drama', 'Question Paper Prelim', { score: 78, grade: 'A', completion_status: 'Complete', concern_status: 'Green' });
    addResult('e-jamie-hd', 'higher-drama', 'Question Paper Prelim', { score: 42, grade: 'D', completion_status: 'Complete', concern_status: 'Amber', teacher_comment: 'Below target' });
    addResult('e-jamie-hd', 'higher-drama', 'Practical Acting or Design Progress', { completion_status: 'In Progress', concern_status: 'Amber' });
    addResult('e-connor-nd', 'n5n4-drama', 'Question Paper Prelim', { score: 48, grade: 'C', completion_status: 'Complete', concern_status: 'Green' });
    addResult('e-connor-nd', 'n5n4-drama', 'Practical Performance / Production Role', { completion_status: 'In Progress', concern_status: 'Amber' });
    addResult('e-sophie-na', 'n5n4-art', 'Expressive Folio Progress', { completion_status: 'In Progress', concern_status: 'Amber' });
    addResult('e-sophie-na', 'n5n4-art', 'Design Folio Progress', { completion_status: 'Missing', concern_status: 'Red' });
    addResult('e-isla-hp', 'higher-photo', 'Development Work', { completion_status: 'In Progress', concern_status: 'Amber' });
    addResult('e-isla-hp', 'higher-photo', 'Question Paper Prelim', { score: 55, grade: 'C', completion_status: 'Complete', concern_status: 'Amber' });
    addResult('e-maya-ahd', 'ah-drama', 'Research / Dissertation Progress', { completion_status: 'Complete', concern_status: 'Green' });
    addResult('e-chloe-aa', 'ah-art', 'Development Work', { completion_status: 'In Progress', concern_status: 'Amber' });
    addResult('e-chloe-aa', 'ah-art', 'Overall Award Risk', { grade: 'Amber', completion_status: 'In Progress', concern_status: 'Amber' });

    var evidenceBank = global.SptSeedRoster.buildEvidenceBank(enrolments, courses, ts);
    var levelChanges = [
      {
        id: uid('lc'),
        enrolment_id: 'e-ryan-nd',
        change_type: 'level',
        original_level: 'National 5',
        recommended_level: 'National 4',
        current_status: 'Under Review',
        reason_for_recommendation: 'Insufficient unit evidence — now on N4 Drama route',
        evidence_summary: 'Production Skills unit missing; moved to N4 route',
        pupil_discussed: true,
        pupil_discussion_date: '2026-02-10',
        parent_carer_contacted: false,
        parent_carer_contact_date: null,
        faculty_head_approved: false,
        sqa_coordinator_notified: false,
        confirmed_on_sqa_system: false,
        date_completed: null,
        notes: '',
        created_at: ts,
        updated_at: ts
      },
      {
        id: uid('lc'),
        enrolment_id: 'e-lewis-fs',
        change_type: 'level',
        original_level: 'Level 6',
        recommended_level: 'Level 5',
        current_status: 'Recommended',
        reason_for_recommendation: 'Unit 2 incomplete; realistic award at L5',
        evidence_summary: 'Unit 1 banked; Unit 2 planning incomplete',
        pupil_discussed: true,
        pupil_discussion_date: '2026-02-18',
        parent_carer_contacted: true,
        parent_carer_contact_date: '2026-02-20',
        faculty_head_approved: false,
        sqa_coordinator_notified: false,
        confirmed_on_sqa_system: false,
        date_completed: null,
        notes: 'Awaiting FH approval',
        created_at: ts,
        updated_at: ts
      }
    ];

    var priorAttainment = [
      { id: uid('pa'), pupil_id: 'p-morrison', subject_area: 'Drama', qualification_year: '2024-25', qualification_level: 'National 5', result_grade: 'C', pathway_status: 'Completed previous level', notes: 'Completed N5 before Higher', created_at: ts, updated_at: ts },
      { id: uid('pa'), pupil_id: 'p-stewart', subject_area: 'Drama', qualification_year: '2024-25', qualification_level: 'National 5', result_grade: 'D', pathway_status: 'Completed previous level', notes: 'Sat N5 — now on N4 route', created_at: ts, updated_at: ts },
      { id: uid('pa'), pupil_id: 'p-robertson', subject_area: 'Art', qualification_year: '2024-25', qualification_level: 'Higher', result_grade: 'B', pathway_status: 'Completed previous level', notes: '', created_at: ts, updated_at: ts },
      { id: uid('pa'), pupil_id: 'p-quinn-quinn', subject_area: 'Drama', qualification_year: '2024-25', qualification_level: 'National 5', result_grade: '', pathway_status: 'Crashing subject', notes: 'Picked Higher with no prior Drama qualification', created_at: ts, updated_at: ts },
      { id: uid('pa'), pupil_id: 'p-jared-keith', subject_area: 'Drama', qualification_year: '2024-25', qualification_level: 'National 5', result_grade: '', pathway_status: 'First time in subject', notes: '', created_at: ts, updated_at: ts },
      { id: uid('pa'), pupil_id: 'p-fraser', subject_area: 'Drama', qualification_year: '2024-25', qualification_level: 'Higher', result_grade: 'B', pathway_status: 'Completed previous level', notes: '', created_at: ts, updated_at: ts },
      { id: uid('pa'), pupil_id: 'p-struan-scott', subject_area: 'Drama', qualification_year: '2024-25', qualification_level: 'Higher', result_grade: '', pathway_status: 'Crashing subject', notes: 'AH without prior Higher in Drama', created_at: ts, updated_at: ts }
    ];

    var enrolmentBaselines = global.SptSeedRoster.buildBaselines(enrolments, ts);

    function seedWgScore(en, tpi, course) {
      if (global.SptEvidence && global.SptEvidence.isPassFailCourse(course)) {
        if (en.risk_status === 'Red') return 8;
        if (en.risk_status === 'Amber') return 7;
        return 6;
      }
      if (en.risk_status === 'Red') return tpi === 2 ? 7 : 6;
      if (en.risk_status === 'Amber') return 5;
      return 4;
    }

    var attendanceRecords = [];
    enrolments.forEach(function(en, idx) {
      var course = courses.find(function(c) { return c.id === en.course_id; });
      trackingPoints.forEach(function(tp, tpi) {
        attendanceRecords.push({
          id: uid('att'),
          enrolment_id: en.id,
          tracking_point_id: tp.id,
          attendance_score: seedWgScore(en, tpi, course),
          teacher_comment: '',
          created_at: ts,
          updated_at: ts
        });
      });
    });

    var teacherConcerns = [
      { id: 'flag-jamie-1', enrolment_id: 'e-jamie-hd', raised_by_teacher_id: 't-anderson', category: 'Prelim', comment: 'Prelim marks well below target — parents should be aware.', status: 'Ongoing', is_urgent: true, intervention_id: 'int-jamie-1', action_taken_at: '2026-01-26T09:00:00.000Z', action_taken_by: 'faculty_head', resolved_at: null, resolved_by: null, resolution_note: 'Emailed pastoral care and SLT about prelim results.', closure_outcome: '', created_at: ts, updated_at: ts },
      { id: 'flag-ryan-1', enrolment_id: 'e-ryan-nd', raised_by_teacher_id: 't-bruce', category: 'Award risk', comment: 'Considering N4 — needs FH discussion.', status: 'Open', is_urgent: true, intervention_id: null, resolved_at: null, resolved_by: null, resolution_note: '', created_at: ts, updated_at: ts },
      { id: 'flag-quinn-1', enrolment_id: 'e-quinn-hd', raised_by_teacher_id: 't-bruce', category: 'Behaviour', comment: 'Repeated disruption in practical rehearsals.', status: 'Open', is_urgent: false, intervention_id: null, resolved_at: null, resolved_by: null, resolution_note: '', created_at: ts, updated_at: ts },
      { id: 'flag-peter-1', enrolment_id: 'e-peter-hp', raised_by_teacher_id: 't-douglas', category: 'Evidence', comment: 'No project images submitted for moderation check.', status: 'Open', is_urgent: true, intervention_id: null, resolved_at: null, resolved_by: null, resolution_note: '', created_at: ts, updated_at: ts },
      { id: 'flag-yvonne-1', enrolment_id: 'e-yvonne-ahd', raised_by_teacher_id: 't-bruce', category: 'Attainment', comment: 'Dissertation draft overdue — award at risk.', status: 'Open', is_urgent: true, intervention_id: null, resolved_at: null, resolved_by: null, resolution_note: '', created_at: ts, updated_at: ts },
      { id: 'flag-gemma-old', enrolment_id: 'e-gemma-nd', raised_by_teacher_id: 't-bruce', category: 'Attendance', comment: 'Repeated lateness — resolved after pastoral support.', status: 'Resolved', is_urgent: false, intervention_id: null, action_taken_at: '2025-11-12T10:00:00.000Z', action_taken_by: 'faculty_head', resolved_at: '2025-12-01T14:00:00.000Z', resolved_by: 'faculty_head', resolution_note: 'Attendance improved — no further action required', closure_outcome: 'no_further_action', created_at: '2025-11-05T09:00:00.000Z', updated_at: ts }
    ];

    var prelimComponents = [];
    var prelimMarks = [];
    courses.forEach(function(course) {
      var tpl = C.PRELIM_COMPONENT_TEMPLATES[course.slug];
      if (!tpl) return;
      var prelimAp = assessmentPoints.find(function(ap) {
        return ap.course_id === course.id && ap.assessment_type === 'Prelim';
      });
      if (!prelimAp) return;
      tpl.forEach(function(t, i) {
        var pcId = 'pc-' + course.slug + '-' + i;
        prelimComponents.push({
          id: pcId,
          course_id: course.id,
          assessment_point_id: prelimAp.id,
          component_name: t.component_name,
          short_label: t.short_label || t.component_name,
          max_marks: t.max_marks,
          weighting: t.weighting,
          display_order: i + 1,
          created_at: ts,
          updated_at: ts
        });
      });
    });
    if (prelimComponents.length) {
      prelimMarks = global.SptSeedRoster.buildPrelimMarks(enrolments, prelimComponents, ts);
    }

    var interventions = [
      { id: 'int-jamie-1', enrolment_id: 'e-jamie-hd', concern_area: 'Prelim performance', intervention_description: 'Weekly written paper clinic', intervention_start_date: '2026-01-25', review_date: '2026-03-15', responsible_teacher_id: 't-anderson', intervention_status: 'Active', outcome_notes: '', impact_rating: 'Not Yet Known', created_at: ts, updated_at: ts },
      { id: uid('int'), enrolment_id: 'e-ryan-nd', concern_area: 'Award risk', intervention_description: 'Supported study for production skills', intervention_start_date: '2026-02-01', review_date: '2026-02-28', responsible_teacher_id: 't-bruce', intervention_status: 'Active', outcome_notes: '', impact_rating: 'Not Yet Known', created_at: ts, updated_at: ts },
      { id: uid('int'), enrolment_id: 'e-sophie-na', concern_area: 'Missing evidence', intervention_description: 'After-school folio catch-up', intervention_start_date: '2026-01-10', review_date: '2026-01-20', responsible_teacher_id: 't-campbell', intervention_status: 'Active', outcome_notes: 'Partial attendance', impact_rating: 'Some Impact', created_at: ts, updated_at: ts },
      { id: uid('int'), enrolment_id: 'e-aiden-ci', concern_area: 'Unit evidence', intervention_description: '1:1 project planning meetings', intervention_start_date: '2026-02-05', review_date: '2026-03-01', responsible_teacher_id: 't-douglas', intervention_status: 'Planned', outcome_notes: '', impact_rating: 'Not Yet Known', created_at: ts, updated_at: ts }
    ];

    var interventionTrail = [
      { id: 'it-jamie-1', intervention_id: 'int-jamie-1', note: 'Emailed pastoral care and SLT about prelim results.', author_role: 'faculty_head', author_teacher_id: null, author_label: 'Faculty Head / Admin', source: 'alert_action', concern_id: 'flag-jamie-1', created_at: '2026-01-26T09:00:00.000Z', updated_at: '2026-01-26T09:00:00.000Z' },
      { id: 'it-jamie-2', intervention_id: 'int-jamie-1', note: 'Weekly clinic started — Jamie attended first session.', author_role: 'class_teacher', author_teacher_id: 't-anderson', author_label: 'Mrs Anderson', source: 'follow_up', concern_id: null, created_at: '2026-02-03T14:30:00.000Z', updated_at: '2026-02-03T14:30:00.000Z' }
    ];

    var concernFeedback = [
      { id: uid('fb'), recipient_teacher_id: 't-anderson', recipient_role: null, flag_id: 'flag-jamie-1', intervention_id: 'int-jamie-1', trail_entry_id: 'it-jamie-1', enrolment_id: 'e-jamie-hd', author_label: 'Faculty Head / Admin', note_preview: 'Emailed pastoral care and SLT about prelim results.', read_at: null, created_at: '2026-01-26T09:05:00.000Z', updated_at: '2026-01-26T09:05:00.000Z' },
      { id: uid('fb'), recipient_teacher_id: null, recipient_role: 'faculty_head', flag_id: 'flag-jamie-1', intervention_id: 'int-jamie-1', trail_entry_id: 'it-jamie-2', enrolment_id: 'e-jamie-hd', author_label: 'Mrs Anderson', note_preview: 'Weekly clinic started — Jamie attended first session.', read_at: null, created_at: '2026-02-03T14:35:00.000Z', updated_at: '2026-02-03T14:35:00.000Z' }
    ];

    enrolments.forEach(function(en) {
      en.has_open_flag = teacherConcerns.some(function(f) {
        return f.enrolment_id === en.id && (f.status === 'Open' || f.status === 'Ongoing');
      });
    });

    var db = {
      version: C.DATA_VERSION,
      seeded_at: ts,
      dev_role: 'faculty_head',
      simulated_teacher_id: 't-anderson',
      teachers: teachers,
      courses: courses,
      classes: classes,
      pupils: pupils,
      enrolments: enrolments,
      school_tracking_points: trackingPoints,
      pupil_tracking_data: pupilTrackingData,
      assessment_points: assessmentPoints,
      pupil_assessment_results: pupilAssessmentResults,
      evidence_bank: evidenceBank,
      level_changes: levelChanges,
      interventions: interventions,
      intervention_trail: interventionTrail,
      concern_feedback: concernFeedback,
      prior_attainment: priorAttainment,
      enrolment_baselines: enrolmentBaselines,
      attendance_records: attendanceRecords,
      teacher_concerns: teacherConcerns,
      prelim_components: prelimComponents,
      prelim_marks: prelimMarks,
      import_batches: [{ id: 'batch-seed-001', filename: 'sample-tp2-import.csv', uploaded_by: 'Faculty Head (dev)', row_count: enrolments.length, status: 'completed', created_at: ts }],
      audit_log: []
    };
    if (global.SptPrelim) {
      enrolments.forEach(function(en) {
        var course = courses.find(function(c) { return c.id === en.course_id; });
        if (!course || !course.has_prelim) return;
        if (en.current_level === 'National 4') return;
        var prelimAp = assessmentPoints.find(function(ap) {
          return ap.course_id === en.course_id && ap.assessment_type === 'Prelim';
        });
        if (!prelimAp) return;
        var sum = global.SptPrelim.computeSummary(db, en.id, prelimAp.id);
        if (!sum) return;
        var existing = pupilAssessmentResults.find(function(r) {
          return r.enrolment_id === en.id && r.assessment_point_id === prelimAp.id;
        });
        if (existing) {
          existing.score = sum.percentage;
          existing.grade = sum.grade_band;
        } else {
          pupilAssessmentResults.push({
            id: uid('par'),
            enrolment_id: en.id,
            assessment_point_id: prelimAp.id,
            score: sum.percentage,
            grade: sum.grade_band,
            completion_status: 'Complete',
            concern_status: en.risk_status === 'Red' ? 'Red' : en.risk_status === 'Amber' ? 'Amber' : 'Green',
            assessment_date: '2026-01-20',
            teacher_comment: '',
            next_steps: '',
            created_at: ts,
            updated_at: ts
          });
        }
      });
    }
    return db;
  }

  global.SptSeed = {
    build: buildSeed
  };
})(typeof window !== 'undefined' ? window : global);
