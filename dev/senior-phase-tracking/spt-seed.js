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

    var classes = [
      { id: 'cl-hd-a', course_id: 'c-higher-drama', class_name: 'H Drama A', teacher_id: 't-anderson', academic_year: '2025-26', created_at: ts, updated_at: ts },
      { id: 'cl-hd-b', course_id: 'c-higher-drama', class_name: 'H Drama B', teacher_id: 't-bruce', academic_year: '2025-26', created_at: ts, updated_at: ts },
      { id: 'cl-nd-b', course_id: 'c-n5n4-drama', class_name: 'N5/N4 Drama B', teacher_id: 't-bruce', academic_year: '2025-26', created_at: ts, updated_at: ts },
      { id: 'cl-na-c', course_id: 'c-n5n4-art', class_name: 'N5/N4 Art C', teacher_id: 't-campbell', academic_year: '2025-26', created_at: ts, updated_at: ts },
      { id: 'cl-hp-a', course_id: 'c-higher-photo', class_name: 'H Photo A', teacher_id: 't-douglas', academic_year: '2025-26', created_at: ts, updated_at: ts },
      { id: 'cl-fs-a', course_id: 'c-l6l5-film', class_name: 'L6 Film A', teacher_id: 't-evans', academic_year: '2025-26', created_at: ts, updated_at: ts },
      { id: 'cl-aa-a', course_id: 'c-ah-art', class_name: 'AH Art A', teacher_id: 't-campbell', academic_year: '2025-26', created_at: ts, updated_at: ts },
      { id: 'cl-ci-b', course_id: 'c-creative-industries', class_name: 'CI B', teacher_id: 't-douglas', academic_year: '2025-26', created_at: ts, updated_at: ts },
      { id: 'cl-ahd-a', course_id: 'c-ah-drama', class_name: 'AH Drama A', teacher_id: 't-anderson', academic_year: '2025-26', created_at: ts, updated_at: ts }
    ];

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

    var pupils = [
      { id: 'p-campbell', first_name: 'Emma', surname: 'Campbell', preferred_name: 'Emma', year_group: 'S5', candidate_number: '2401001', class_group: 'H Drama A', teacher_id: 't-anderson', active_status: true, notes: '', created_at: ts, updated_at: ts },
      { id: 'p-morrison', first_name: 'Jamie', surname: 'Morrison', preferred_name: 'Jamie', year_group: 'S5', candidate_number: '2401002', class_group: 'H Drama A', teacher_id: 't-anderson', active_status: true, notes: 'Prelim below target — monitoring', created_at: ts, updated_at: ts },
      { id: 'p-reid', first_name: 'Connor', surname: 'Reid', preferred_name: 'Connor', year_group: 'S4', candidate_number: '2402001', class_group: 'N5/N4 Drama B', teacher_id: 't-bruce', active_status: true, notes: '', created_at: ts, updated_at: ts },
      { id: 'p-stewart', first_name: 'Ryan', surname: 'Stewart', preferred_name: 'Ryan', year_group: 'S4', candidate_number: '2402002', class_group: 'N5/N4 Drama B', teacher_id: 't-bruce', active_status: true, notes: 'Level change under review', created_at: ts, updated_at: ts },
      { id: 'p-henderson', first_name: 'Sophie', surname: 'Henderson', preferred_name: 'Sophie', year_group: 'S4', candidate_number: '2403001', class_group: 'N5/N4 Art C', teacher_id: 't-campbell', active_status: true, notes: 'Missing unit evidence', created_at: ts, updated_at: ts },
      { id: 'p-thomson', first_name: 'Isla', surname: 'Thomson', preferred_name: 'Isla', year_group: 'S6', candidate_number: '2404001', class_group: 'H Photo A', teacher_id: 't-douglas', active_status: true, notes: 'Incomplete project evidence', created_at: ts, updated_at: ts },
      { id: 'p-maclean', first_name: 'Lewis', surname: 'MacLean', preferred_name: 'Lewis', year_group: 'S5', candidate_number: '2405001', class_group: 'L6 Film A', teacher_id: 't-evans', active_status: true, notes: 'Moving L6 to L5', created_at: ts, updated_at: ts },
      { id: 'p-robertson', first_name: 'Chloe', surname: 'Robertson', preferred_name: 'Chloe', year_group: 'S6', candidate_number: '2406001', class_group: 'AH Art A', teacher_id: 't-campbell', active_status: true, notes: 'Portfolio concerns', created_at: ts, updated_at: ts },
      { id: 'p-walker', first_name: 'Aiden', surname: 'Walker', preferred_name: 'Aiden', year_group: 'S5', candidate_number: '2407001', class_group: 'CI B', teacher_id: 't-douglas', active_status: true, notes: 'Missing evidence', created_at: ts, updated_at: ts },
      { id: 'p-fraser', first_name: 'Maya', surname: 'Fraser', preferred_name: 'Maya', year_group: 'S6', candidate_number: '2408001', class_group: 'AH Drama A', teacher_id: 't-anderson', active_status: true, notes: 'On track', created_at: ts, updated_at: ts },
      { id: 'p-sinclair', first_name: 'Noah', surname: 'Sinclair', preferred_name: 'Noah', year_group: 'S5', candidate_number: '2409001', class_group: 'H Drama B', teacher_id: 't-bruce', active_status: true, notes: '', created_at: ts, updated_at: ts }
    ];

    var enrolments = [
      { id: 'e-emma-hd', pupil_id: 'p-campbell', course_id: 'c-higher-drama', class_id: 'cl-hd-a', teacher_id: 't-anderson', current_level: 'Higher', target_grade: 'A', latest_working_grade: 'A', final_estimate: 'A', risk_status: 'Green', risk_manual_override: false, risk_override_reason: '', has_open_flag: false, active_status: true, start_date: '2025-08-15', end_date: null, created_at: ts, updated_at: ts },
      { id: 'e-jamie-hd', pupil_id: 'p-morrison', course_id: 'c-higher-drama', class_id: 'cl-hd-a', teacher_id: 't-anderson', current_level: 'Higher', target_grade: 'B', latest_working_grade: 'D', final_estimate: 'C', risk_status: 'Amber', risk_manual_override: false, risk_override_reason: '', has_open_flag: true, active_status: true, start_date: '2025-08-15', end_date: null, created_at: ts, updated_at: ts },
      { id: 'e-connor-nd', pupil_id: 'p-reid', course_id: 'c-n5n4-drama', teacher_id: 't-bruce', current_level: 'National 5', target_grade: 'C', latest_working_grade: 'C', final_estimate: 'C', risk_status: 'Amber', risk_manual_override: false, risk_override_reason: '', active_status: true, start_date: '2025-08-15', end_date: null, created_at: ts, updated_at: ts },
      { id: 'e-ryan-nd', pupil_id: 'p-stewart', course_id: 'c-n5n4-drama', class_id: 'cl-nd-b', teacher_id: 't-bruce', current_level: 'National 5', target_grade: 'C', latest_working_grade: 'D', final_estimate: 'D', risk_status: 'Red', risk_manual_override: false, risk_override_reason: '', has_open_flag: true, active_status: true, start_date: '2025-08-15', end_date: null, created_at: ts, updated_at: ts },
      { id: 'e-sophie-na', pupil_id: 'p-henderson', course_id: 'c-n5n4-art', teacher_id: 't-campbell', current_level: 'National 5', target_grade: 'B', latest_working_grade: 'C', final_estimate: 'C', risk_status: 'Red', risk_manual_override: false, risk_override_reason: '', active_status: true, start_date: '2025-08-15', end_date: null, created_at: ts, updated_at: ts },
      { id: 'e-isla-hp', pupil_id: 'p-thomson', course_id: 'c-higher-photo', teacher_id: 't-douglas', current_level: 'Higher', target_grade: 'A', latest_working_grade: 'B', final_estimate: 'B', risk_status: 'Amber', risk_manual_override: false, risk_override_reason: '', active_status: true, start_date: '2025-08-15', end_date: null, created_at: ts, updated_at: ts },
      { id: 'e-lewis-fs', pupil_id: 'p-maclean', course_id: 'c-l6l5-film', teacher_id: 't-evans', current_level: 'Level 6', target_grade: 'Pass', latest_working_grade: 'Pass', final_estimate: 'Pass', risk_status: 'Amber', risk_manual_override: false, risk_override_reason: '', active_status: true, start_date: '2025-08-15', end_date: null, created_at: ts, updated_at: ts },
      { id: 'e-chloe-aa', pupil_id: 'p-robertson', course_id: 'c-ah-art', teacher_id: 't-campbell', current_level: 'Advanced Higher', target_grade: 'A', latest_working_grade: 'C', final_estimate: 'B', risk_status: 'Amber', risk_manual_override: false, risk_override_reason: '', active_status: true, start_date: '2025-08-15', end_date: null, created_at: ts, updated_at: ts },
      { id: 'e-aiden-ci', pupil_id: 'p-walker', course_id: 'c-creative-industries', teacher_id: 't-douglas', current_level: 'National 5', target_grade: 'Pass', latest_working_grade: 'NP', final_estimate: 'NP', risk_status: 'Red', risk_manual_override: false, risk_override_reason: '', active_status: true, start_date: '2025-08-15', end_date: null, created_at: ts, updated_at: ts },
      { id: 'e-maya-ahd', pupil_id: 'p-fraser', course_id: 'c-ah-drama', teacher_id: 't-anderson', current_level: 'Advanced Higher', target_grade: 'A', latest_working_grade: 'A', final_estimate: 'A', risk_status: 'Green', risk_manual_override: false, risk_override_reason: '', active_status: true, start_date: '2025-08-15', end_date: null, created_at: ts, updated_at: ts },
      { id: 'e-noah-hd2', pupil_id: 'p-sinclair', course_id: 'c-higher-drama', teacher_id: 't-bruce', current_level: 'Higher', target_grade: 'B', latest_working_grade: 'B', final_estimate: 'B', risk_status: 'Green', risk_manual_override: false, risk_override_reason: '', active_status: true, start_date: '2025-08-15', end_date: null, created_at: ts, updated_at: ts }
    ];

    var pupilTrackingData = [];
    var tp2 = trackingPoints[1];
    var tp3 = trackingPoints[2];
    enrolments.forEach(function(en, idx) {
      pupilTrackingData.push({
        id: uid('ptd'),
        enrolment_id: en.id,
        tracking_point_id: tp2.id,
        working_grade: en.latest_working_grade,
        target_grade: en.target_grade,
        effort: idx % 3 === 0 ? '3' : '2',
        behaviour: '3',
        homework: idx % 4 === 0 ? '2' : '3',
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
          effort: '2',
          behaviour: '3',
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
    addResult('e-connor-nd', 'n5n4-drama', 'Drama Skills Unit Evidence', { completion_status: 'In Progress', concern_status: 'Amber' });
    addResult('e-ryan-nd', 'n5n4-drama', 'Question Paper Prelim', { score: 35, grade: 'D', completion_status: 'Complete', concern_status: 'Red' });
    addResult('e-sophie-na', 'n5n4-art', 'Unit Evidence Banked', { completion_status: 'Missing', concern_status: 'Red' });
    addResult('e-isla-hp', 'higher-photo', 'Development Work', { completion_status: 'In Progress', concern_status: 'Amber' });
    addResult('e-isla-hp', 'higher-photo', 'Question Paper Prelim', { score: 55, grade: 'C', completion_status: 'Complete', concern_status: 'Amber' });
    addResult('e-maya-ahd', 'ah-drama', 'Research / Dissertation Progress', { completion_status: 'Complete', concern_status: 'Green' });
    addResult('e-chloe-aa', 'ah-art', 'Development Work', { completion_status: 'In Progress', concern_status: 'Amber' });
    addResult('e-chloe-aa', 'ah-art', 'Overall Award Risk', { grade: 'Amber', completion_status: 'In Progress', concern_status: 'Amber' });
    addResult('e-aiden-ci', 'creative-industries', 'Unit Evidence', { completion_status: 'Missing', concern_status: 'Red' });

    var evidenceBank = [
      { id: uid('ev'), enrolment_id: 'e-connor-nd', evidence_title: 'Drama skills unit folio', unit_or_component: 'Drama Skills', evidence_type: 'Unit Evidence', evidence_status: 'In Progress', date_banked: null, verified_by_teacher_id: null, verification_status: 'Not Verified', notes: '', created_at: ts, updated_at: ts },
      { id: uid('ev'), enrolment_id: 'e-ryan-nd', evidence_title: 'Production skills evidence pack', unit_or_component: 'Production Skills', evidence_type: 'Unit Evidence', evidence_status: 'Missing', date_banked: null, verified_by_teacher_id: null, verification_status: 'Not Verified', notes: 'Urgent', created_at: ts, updated_at: ts },
      { id: uid('ev'), enrolment_id: 'e-sophie-na', evidence_title: 'Design unit evidence', unit_or_component: 'Design', evidence_type: 'Unit Evidence', evidence_status: 'Missing', date_banked: null, verified_by_teacher_id: null, verification_status: 'Not Verified', notes: '', created_at: ts, updated_at: ts },
      { id: uid('ev'), enrolment_id: 'e-sophie-na', evidence_title: 'Expressive folio draft', unit_or_component: 'Expressive', evidence_type: 'Folio', evidence_status: 'In Progress', date_banked: null, verified_by_teacher_id: 't-campbell', verification_status: 'Not Verified', notes: '', created_at: ts, updated_at: ts },
      { id: uid('ev'), enrolment_id: 'e-lewis-fs', evidence_title: 'Unit 1 production evidence', unit_or_component: 'Unit 1', evidence_type: 'Unit Evidence', evidence_status: 'Banked', date_banked: '2025-11-12', verified_by_teacher_id: 't-evans', verification_status: 'Verified', notes: '', created_at: ts, updated_at: ts },
      { id: uid('ev'), enrolment_id: 'e-lewis-fs', evidence_title: 'Unit 2 planning', unit_or_component: 'Unit 2', evidence_type: 'Unit Evidence', evidence_status: 'In Progress', date_banked: null, verified_by_teacher_id: null, verification_status: 'Not Verified', notes: '', created_at: ts, updated_at: ts },
      { id: uid('ev'), enrolment_id: 'e-aiden-ci', evidence_title: 'Skills development portfolio', unit_or_component: 'Skills', evidence_type: 'Unit Evidence', evidence_status: 'Missing', date_banked: null, verified_by_teacher_id: null, verification_status: 'Not Verified', notes: '', created_at: ts, updated_at: ts },
      { id: uid('ev'), enrolment_id: 'e-emma-hd', evidence_title: 'Performance preparation log', unit_or_component: 'Performance', evidence_type: 'Performance', evidence_status: 'Banked', date_banked: '2026-01-08', verified_by_teacher_id: 't-anderson', verification_status: 'Verified', notes: '', created_at: ts, updated_at: ts }
    ];

    var levelChanges = [
      {
        id: uid('lc'),
        enrolment_id: 'e-ryan-nd',
        original_level: 'National 5',
        recommended_level: 'National 4',
        current_status: 'Under Review',
        reason_for_recommendation: 'Insufficient unit evidence and prelim performance',
        evidence_summary: 'Production skills not banked; prelim 35%',
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
      { id: uid('pa'), pupil_id: 'p-morrison', subject_area: 'Drama', qualification_year: '2024-25', qualification_level: 'Higher', result_grade: 'C', pathway_status: 'Completed', notes: 'Completed N5 then Higher', created_at: ts, updated_at: ts },
      { id: uid('pa'), pupil_id: 'p-stewart', subject_area: 'Drama', qualification_year: '2024-25', qualification_level: 'National 5', result_grade: 'D', pathway_status: 'Crashed / withdrew', notes: 'Struggled with written paper', created_at: ts, updated_at: ts },
      { id: uid('pa'), pupil_id: 'p-robertson', subject_area: 'Art', qualification_year: '2024-25', qualification_level: 'Higher', result_grade: 'B', pathway_status: 'Completed', notes: '', created_at: ts, updated_at: ts }
    ];

    var attendanceRecords = [];
    enrolments.forEach(function(en, idx) {
      trackingPoints.forEach(function(tp, tpi) {
        attendanceRecords.push({
          id: uid('att'),
          enrolment_id: en.id,
          tracking_point_id: tp.id,
          attendance_score: en.risk_status === 'Red' ? (tpi === 2 ? 1 : 2) : en.risk_status === 'Amber' ? 2 : 4,
          teacher_comment: '',
          created_at: ts,
          updated_at: ts
        });
      });
    });

    var teacherConcerns = [
      { id: 'flag-jamie-1', enrolment_id: 'e-jamie-hd', raised_by_teacher_id: 't-anderson', category: 'Prelim', comment: 'Prelim marks well below target — parents should be aware.', status: 'Open', is_urgent: true, intervention_id: null, resolved_at: null, resolved_by: null, resolution_note: '', created_at: ts, updated_at: ts },
      { id: 'flag-ryan-1', enrolment_id: 'e-ryan-nd', raised_by_teacher_id: 't-bruce', category: 'Award risk', comment: 'Considering N4 — needs FH discussion.', status: 'Open', is_urgent: true, intervention_id: null, resolved_at: null, resolved_by: null, resolution_note: '', created_at: ts, updated_at: ts }
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
      prelimMarks.push({ id: uid('pm'), enrolment_id: 'e-jamie-hd', prelim_component_id: 'pc-higher-drama-0', raw_mark: 22, created_at: ts, updated_at: ts });
      prelimMarks.push({ id: uid('pm'), enrolment_id: 'e-jamie-hd', prelim_component_id: 'pc-higher-drama-1', raw_mark: 18, created_at: ts, updated_at: ts });
      prelimMarks.push({ id: uid('pm'), enrolment_id: 'e-emma-hd', prelim_component_id: 'pc-higher-drama-0', raw_mark: 42, created_at: ts, updated_at: ts });
      prelimMarks.push({ id: uid('pm'), enrolment_id: 'e-emma-hd', prelim_component_id: 'pc-higher-drama-1', raw_mark: 45, created_at: ts, updated_at: ts });
    }

    var interventions = [
      { id: 'int-jamie-1', enrolment_id: 'e-jamie-hd', concern_area: 'Prelim performance', intervention_description: 'Weekly written paper clinic', intervention_start_date: '2026-01-25', review_date: '2026-03-15', responsible_teacher_id: 't-anderson', intervention_status: 'Active', outcome_notes: '', impact_rating: 'Not Yet Known', created_at: ts, updated_at: ts },
      { id: uid('int'), enrolment_id: 'e-ryan-nd', concern_area: 'Award risk', intervention_description: 'Supported study for production skills', intervention_start_date: '2026-02-01', review_date: '2026-02-28', responsible_teacher_id: 't-bruce', intervention_status: 'Active', outcome_notes: '', impact_rating: 'Not Yet Known', created_at: ts, updated_at: ts },
      { id: uid('int'), enrolment_id: 'e-sophie-na', concern_area: 'Missing evidence', intervention_description: 'After-school folio catch-up', intervention_start_date: '2026-01-10', review_date: '2026-01-20', responsible_teacher_id: 't-campbell', intervention_status: 'Active', outcome_notes: 'Partial attendance', impact_rating: 'Some Impact', created_at: ts, updated_at: ts },
      { id: uid('int'), enrolment_id: 'e-aiden-ci', concern_area: 'Unit evidence', intervention_description: '1:1 project planning meetings', intervention_start_date: '2026-02-05', review_date: '2026-03-01', responsible_teacher_id: 't-douglas', intervention_status: 'Planned', outcome_notes: '', impact_rating: 'Not Yet Known', created_at: ts, updated_at: ts }
    ];

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
      prior_attainment: priorAttainment,
      attendance_records: attendanceRecords,
      teacher_concerns: teacherConcerns,
      prelim_components: prelimComponents,
      prelim_marks: prelimMarks,
      import_batches: [{ id: 'batch-seed-001', filename: 'sample-tp2-import.csv', uploaded_by: 'Faculty Head (dev)', row_count: enrolments.length, status: 'completed', created_at: ts }],
      audit_log: []
    };
    if (global.SptPrelim) {
      ['e-jamie-hd', 'e-emma-hd'].forEach(function(eid) {
        var prelimAp = assessmentPoints.find(function(ap) {
          return ap.course_id === 'c-higher-drama' && ap.assessment_type === 'Prelim';
        });
        if (prelimAp) {
          var sum = global.SptPrelim.computeSummary(db, eid, prelimAp.id);
          if (sum) {
            var existing = pupilAssessmentResults.find(function(r) {
              return r.enrolment_id === eid && r.assessment_point_id === prelimAp.id;
            });
            if (existing) {
              existing.score = sum.percentage;
              existing.grade = sum.grade_band;
            }
          }
        }
      });
    }
    return db;
  }

  global.SptSeed = {
    build: buildSeed
  };
})(typeof window !== 'undefined' ? window : global);
