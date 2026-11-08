/**
 * Made-up data for testing the faculty tracking export. Every name here is fictional.
 * Rows match what the database returns, one list per table.
 */
(function(root) {
  'use strict';

  var ANNA = 'staff-anna';
  var BEN = 'staff-ben';

  function bge(prefix, classA) {
    var p1 = prefix + '-1';
    var p2 = prefix + '-2';
    var p3 = prefix + '-3';
    var old = prefix + '-old';
    var pupils = { s1: {}, s2: {}, s3: {} };
    pupils.s1[classA] = [{ id: p1, name: 'Test Pupil Alpha' }, { id: p2, name: 'Test Pupil O\'Bravo' }];
    pupils.s2['2X1'] = [{ id: p3, name: 'Test Pupil Charlie & Co' }];
    var scores = { s1: {}, s2: {}, s3: {} };
    scores.s1[p1] = {
      tp1: { creating: 3, presenting: '2', evaluating: 4, effort: 4, behaviour: 4, homelearning: 3, notes: 'Strong start <b>not html</b>' },
      tp2: { creating: 4, notes: '=1+1 must stay as text' }
    };
    scores.s2[p3] = { tp1: { creating: 2, progress: 3 }, tp99: { effort: 1 } };
    var profiles = { s1: {}, s2: {}, s3: {} };
    profiles.s1[p1] = { teacherNotes: 'Line one\nLine two', pupilReflection: 'I enjoyed mime', lastUpdated: '2026-10-01' };
    profiles.s2[p3] = {
      cfeLevel: 'Third',
      trackingHistory: { s1: { className: '1Z9', scores: { tp1: { creating: 1, effort: 2, notes: 'Last year' } }, snapshotAt: '2026-06-20T10:00:00Z' } }
    };
    var archived = { s1: {}, s2: {}, s3: {} };
    archived.s1['1OLD'] = {
      pupils: [{ id: old, name: 'Test Pupil Archived' }],
      scores: (function() { var s = {}; s[old] = { tp1: { creating: 1 } }; return s; })(),
      profiles: {}, archivedAt: '2026-06-25T10:00:00Z'
    };
    return { pupils: pupils, scores: scores, profiles: profiles, archived: archived };
  }

  var senior = {
    teachers: [{ id: 't1', first_name: 'Anna', surname: 'Testington' }],
    courses: [{ id: 'c1', course_name: 'Higher Drama' }, { id: 'c2', course_name: 'N5 Art' }],
    classes: [{ id: 'cl1', class_name: 'H Drama A', teacher_id: 't1', academic_year: '2026-27' }, { id: 'cl2', class_name: 'N5 Art B', teacher_id: 't1', academic_year: '2026-27' }],
    pupils: [
      { id: 'sp1', first_name: 'Senior', surname: 'Delta', year_group: 'S5', candidate_number: '012345678', end_of_year_attendance_percent: 91 },
      { id: 'sp2', first_name: 'Senior', surname: 'Echo', year_group: 'S4', candidate_number: '087654321' },
      { id: 'sp3', first_name: 'Senior', surname: 'Foxtrot', year_group: 'S5', candidate_number: '011111111' }
    ],
    enrolments: [
      { id: 'e1', pupil_id: 'sp1', course_id: 'c1', class_id: 'cl1', teacher_id: 't1', current_level: 'Higher', latest_working_grade: 'B', target_grade: 'A', risk_status: 'On track' },
      { id: 'e2', pupil_id: 'sp2', course_id: 'c2', class_id: 'cl2', teacher_id: 't1', current_level: 'N5', latest_working_grade: 'D', target_grade: 'B', risk_status: 'At risk' },
      { id: 'e3', pupil_id: 'sp3', course_id: 'c2', class_id: 'cl2', teacher_id: 't1', current_level: 'N5', active_status: false }
    ],
    school_tracking_points: [{ id: 'tp-a', tracking_point_name: 'Tracking Point 1', display_order: 1 }],
    pupil_tracking_data: [{ id: 'ptd1', enrolment_id: 'e1', tracking_point_id: 'tp-a', working_grade: 'B', effort: 3, behaviour: 4, teacher_comment: 'Working well' }],
    attendance_records: [{ id: 'att1', enrolment_id: 'e1', tracking_point_id: 'tp-a', attendance_percent: 94, attendance_score: 4 }],
    teacher_concerns: [{ id: 'tc1', enrolment_id: 'e2', category: 'Wellbeing', status: 'open', note: 'Fictional concern' }],
    interventions: [{ id: 'iv1', enrolment_id: 'e2', intervention_description: 'Extra support session', intervention_status: 'ongoing' }],
    intervention_trail: [{ id: 'it1', enrolment_id: 'e2', intervention_id: 'iv1', note: 'Parent contacted', parent_carer_contacted: true }]
  };

  var units = { };

  root.TrackerExportFixture = {
    units: units,
    tables: {
      profiles: [
        { id: ANNA, email: 'anna@example.test', display_name: 'Anna Testington' },
        { id: BEN, email: 'ben@example.test', display_name: '' }
      ],
      pupil_data: [
        { id: 'r1', user_id: ANNA, data_type: 'drama-v3', data: bge('dr', '1A1') },
        { id: 'r2', user_id: BEN, data_type: 'art-v2', data: bge('ar', '1B2') },
        { id: 'r3', user_id: BEN, data_type: 'npa-v1', data: {
          courses: [
            { id: 'photo', name: 'NPA Photography', units: [{ id: 'u1', name: 'People', tasks: [{ id: 't1', name: 'Research' }, { id: 't2', name: 'Shoot' }, { id: 't3', name: 'Empty task' }] }] },
            { id: 'art', name: 'NPA Art and Design', units: [{ id: 'u2', name: 'Printmaking', tasks: [{ id: 't4', name: 'Lino' }] }] }
          ],
          classes: [{ id: 'k1', name: '6NPA', pupils: [
            { id: 'n1', name: 'Test Pupil Golf', strengths: 'Composition', development: 'Deadlines', work: { t1: { s: 'done' }, t2: { s: 'started', n: 'Needs reshoot' }, t4: { s: 'done' } } },
            { id: 'n2', name: 'Test Pupil Hotel', work: {} }
          ] }]
        } },
        { id: 'r4', user_id: ANNA, data_type: 'bge_drama_reports_v1', data: { pupils: [
          { id: 'b1', firstName: 'Test', lastName: 'Report', year: 'S2', className: '2X1', cfeLevel: 'Third', isEal: true, confirmed: true, additionalComments: 'Fictional comment', selections: { strengths: ['C1', 'C2'], aod: [], next_steps: ['C18'], attitude: [], closing: [] } }
        ] } }
      ],
      ci_assess_settings: [{ school_year: '2026-27', intro_variant: 'SCOT' }],
      ci_assess_pupils: [
        { id: 'ci1', school_year: '2026-27', name: 'Test Pupil India', class_code: '5ciC', team: 'Team A', notes: 'Fictional note' },
        { id: 'ci2', school_year: '2026-27', name: 'Test Pupil Juliet', class_code: '5ciC', team: 'Team B', notes: '' }
      ],
      ci_assess_marks: [
        { pupil_id: 'ci1', code: 'u1.1a', kind: 'pc', status: 'm', evidence_type: 'Observation', evidence_ref: 'OneNote', note: 'Met', assessed_on: '2026-10-01', updated_by_name: 'A. Testington', updated_at: '2026-10-01T10:00:00Z' },
        { pupil_id: 'ci1', code: 'u1.signoff', kind: 'signoff', status: 'm', signed_by: 'A. Testington' }
      ],
      ci_assess_followups: [{ id: 'f1', school_year: '2026-27', pupil_id: 'ci2', title: 'Catch up on folio', note: '', due_on: '2026-11-20', created_by_name: 'A. Testington' }],
      senior_phase_workbook: [{ id: 'default', data: senior }],
      spt_attainment_review_cycles: [{ id: 'rc1', title: 'S5 TP1 review', year_group: 'S5' }],
      spt_attainment_class_reviews: [{ id: 'cr1', review_cycle_id: 'rc1', class_id: 'cl1', status: 'complete', meeting_notes: 'Fictional meeting notes' }],
      spt_attainment_pupil_reviews: [{ id: 'pr1', class_review_id: 'cr1', enrolment_id: 'e1', pupil_id: 'sp1', discussion_status: 'discussed', reviewed: true, notes: 'Fictional review' }],
      spt_attainment_actions: [{ id: 'ac1', class_review_id: 'cr1', enrolment_id: 'e1', pupil_id: 'sp1', owner_type: 'teacher', action_text: 'Fictional action', status: 'open' }],
      qs_attainment_snapshots: [{ id: 'q1', school_year: '2025-26', session_label: '25-26', data: {
        session: '25-26',
        rows: [{ scn: '123456789', name: 'Test Pupil Kilo', fore: 'Test', sur: 'Kilo', teacher: 'A. Testington', subject: 'Drama', level: 'Higher', pred: 'B', gradeRaw: 'A', attendance: 92, decile: 3, quintile: 2, asn: true, c1: 40, n1: 35 }],
        comps: [{ sur: 'Kilo', component: 'Performance', mark: 40 }]
      } }],
      academic_years: [{ id: 'y1', label: '2026-27' }],
      classes: [{ id: 'cc1', academic_year_id: 'y1', year_level_id: 1, subject: 'drama', class_code: '1A1', class_name: 'S1 Drama 1A1' }],
      pupils: [{ id: 'rp1', first_name: 'Test', last_name: 'Lima', external_id: 'X123' }],
      class_enrollments: [{ id: 'ce1', class_id: 'cc1', pupil_id: 'rp1' }],
      class_teacher_assignments: [{ id: 'ca1', class_id: 'cc1', teacher_id: ANNA }],
      tracking_hub_annotations: [{ id: 'n1', pupil_key: 'test-key', subject: 'drama', author_email: 'anna@example.test', body: 'Fictional flag', is_flag: true, resolved: false, created_at: '2026-10-02T10:00:00Z' }]
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
