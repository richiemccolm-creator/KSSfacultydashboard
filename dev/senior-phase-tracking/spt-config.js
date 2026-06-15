/**
 * Senior Phase Tracking — development config (local preview).
 */
(function(global) {
  'use strict';

  var useSeedData = (function() {
    try {
      return new URLSearchParams(window.location.search).get('dev_seed') === '1';
    } catch (e) {
      return false;
    }
  })();

  var STORAGE_KEY = useSeedData ? 'spt-dev-v2' : 'spt-hub-v1';
  var DATA_VERSION = 11;

  var CFE_LEVELS = ['Second', 'Third', 'Fourth'];

  var STATUS = {
    risk: ['Green', 'Amber', 'Red'],
    completion: ['Not Started', 'In Progress', 'Complete', 'Missing', 'Not Applicable'],
    concern: ['Green', 'Amber', 'Red', 'Grey'],
    evidence: ['Not Started', 'In Progress', 'Banked', 'Needs Rework', 'Missing'],
    verification: ['Not Verified', 'Verified', 'Requires Moderation', 'Not Applicable'],
    levelChange: ['Not Started', 'Under Review', 'Recommended', 'Approved', 'Completed', 'Not Proceeding'],
    intervention: ['Planned', 'Active', 'Reviewed', 'Completed', 'Escalated'],
    impact: ['No Impact', 'Some Impact', 'Good Impact', 'Not Yet Known'],
    flag: ['Open', 'Resolved'],
    pathway: ['Completed previous level', 'Crashing subject', 'Deferred', 'First time in subject', 'No prior entry', 'Not crashing (override)']
  };

  var CONCERN_CATEGORIES = [
    'Attainment', 'Evidence', 'Prelim', 'Attendance', 'Behaviour', 'Wellbeing', 'Level change', 'Other'
  ];

  var ATTENDANCE_LABELS = {
    1: 'Serious concern',
    2: 'Some concern',
    3: 'Acceptable',
    4: 'Good'
  };

  var TRACKING_SCORE_CLASS = {
    1: 'score-1',
    2: 'score-2',
    3: 'score-3',
    4: 'score-4'
  };

  var BADGE_CLASS = {
    Green: 'badge-green', Amber: 'badge-amber', Red: 'badge-red', Grey: 'badge-grey',
    Open: 'badge-red', Resolved: 'badge-green',
    'Not Started': 'badge-grey', 'In Progress': 'badge-amber', Complete: 'badge-green',
    Missing: 'badge-red', 'Not Applicable': 'badge-grey',
    Banked: 'badge-green', 'Needs Rework': 'badge-amber',
    Verified: 'badge-green', 'Not Verified': 'badge-grey', 'Requires Moderation': 'badge-amber',
    Planned: 'badge-grey', Active: 'badge-amber', Reviewed: 'badge-amber', Escalated: 'badge-red',
    'Under Review': 'badge-amber', Recommended: 'badge-amber', Approved: 'badge-green',
    Completed: 'badge-green', 'Not Proceeding': 'badge-grey',
    'Completed previous level': 'badge-green',
    'Crashing subject': 'badge-amber',
    'First time in subject': 'badge-amber',
    'First time': 'badge-amber',
    'Not crashing (override)': 'badge-green'
  };

  var GRADE_RANK = {
    A: 7, 'A*': 8, B: 6, C: 5, D: 4, E: 3, F: 2, P: 3, NP: 1,
    Pass: 4, Merit: 5, Distinction: 6, 'No Award': 0
  };

  var ROLES = {
    faculty_head: {
      id: 'faculty_head', label: 'Faculty Head / Admin',
      canImport: true, canApproveLevelChange: true, viewAll: true, canEdit: true,
      canSetup: true, canEditBaseline: true, canResolveFlags: true, canFlag: true
    },
    class_teacher: {
      id: 'class_teacher', label: 'Class Teacher',
      canImport: false, canApproveLevelChange: false, viewAll: false, canEdit: true,
      canSetup: false, canEditBaseline: false, canResolveFlags: false, canFlag: true
    },
    read_only: {
      id: 'read_only', label: 'Read Only / SLT',
      canImport: false, canApproveLevelChange: false, viewAll: true, canEdit: false,
      canSetup: false, canEditBaseline: false, canResolveFlags: false, canFlag: false
    }
  };

  var COURSE_DEFS = [
    { slug: 'n5n4-drama', course_name: 'N5/N4 Drama', subject_area: 'Drama', scqf_level: 'Level 5/4', course_type: 'N5/N4 Combined', has_prelim: true, supports_level_change: true, default_assessment_model: 'n5n4-drama' },
    { slug: 'higher-drama', course_name: 'Higher Drama', subject_area: 'Drama', scqf_level: 'Level 6', course_type: 'Higher', has_prelim: true, supports_level_change: false, default_assessment_model: 'higher-drama' },
    { slug: 'ah-drama', course_name: 'Advanced Higher Drama', subject_area: 'Drama', scqf_level: 'Level 7', course_type: 'Advanced Higher', has_prelim: false, supports_level_change: false, default_assessment_model: 'ah-drama' },
    { slug: 'n5n4-art', course_name: 'N5/N4 Art', subject_area: 'Art', scqf_level: 'Level 5/4', course_type: 'N5/N4 Combined', has_prelim: true, supports_level_change: true, default_assessment_model: 'n5n4-art' },
    { slug: 'higher-photo', course_name: 'Higher Photography', subject_area: 'Photography', scqf_level: 'Level 6', course_type: 'Higher', has_prelim: true, supports_level_change: false, default_assessment_model: 'higher-photo' },
    { slug: 'npa-photo', course_name: 'NPA Photography', subject_area: 'Photography', scqf_level: 'Level 4/5', course_type: 'NPA Award', has_prelim: false, supports_level_change: true, default_assessment_model: 'npa-photo', group_award_l4: 'GR4L 44', group_award_l5: 'GR4M 45' },
    { slug: 'ah-art', course_name: 'Advanced Higher Art', subject_area: 'Art', scqf_level: 'Level 7', course_type: 'Advanced Higher', has_prelim: false, supports_level_change: false, default_assessment_model: 'ah-art' },
    { slug: 'l6l5-film', course_name: 'Level 6/5 Film and Screen', subject_area: 'Film and Screen', scqf_level: 'Level 6/5', course_type: 'NPA Combined', has_prelim: false, supports_level_change: true, default_assessment_model: 'l6l5-film' },
    { slug: 'creative-industries', course_name: 'Creative Industries', subject_area: 'Creative Industries', scqf_level: 'Level 5', course_type: 'Skills for Work', has_prelim: false, supports_level_change: false, default_assessment_model: 'creative-industries' }
  ];

  var ASSESSMENT_TEMPLATES = {
    'n5n4-drama': [
      { assessment_name: 'Practical Performance / Production Role', assessment_type: 'Performance', assessment_window: 'Year', is_required: true },
      { assessment_name: 'Preparation for Performance', assessment_type: 'Performance', assessment_window: 'Year', is_required: true },
      { assessment_name: 'Question Paper Prelim', assessment_type: 'Prelim', assessment_window: 'January', is_required: true },
      { assessment_name: 'Final Practical Progress', assessment_type: 'Practical', assessment_window: 'Spring', is_required: true },
      { assessment_name: 'Final Estimate', assessment_type: 'Portfolio', assessment_window: 'Final', is_required: true }
    ],
    'higher-drama': [
      { assessment_name: 'Section 1: Text in Context', assessment_type: 'Written Paper', assessment_window: 'Year', is_required: true },
      { assessment_name: 'Section 2: Performance Analysis', assessment_type: 'Written Paper', assessment_window: 'Year', is_required: true },
      { assessment_name: 'Question Paper Prelim', assessment_type: 'Prelim', assessment_window: 'January', is_required: true },
      { assessment_name: 'Practical Acting or Design Progress', assessment_type: 'Practical', assessment_window: 'Year', is_required: true },
      { assessment_name: 'Preparation for Performance', assessment_type: 'Performance', assessment_window: 'Year', is_required: true },
      { assessment_name: 'Final Estimate', assessment_type: 'Portfolio', assessment_window: 'Final', is_required: true }
    ],
    'ah-drama': [
      { assessment_name: 'Practical Performance or Design Progress', assessment_type: 'Practical', assessment_window: 'Year', is_required: true },
      { assessment_name: 'Research / Dissertation Progress', assessment_type: 'Dissertation', assessment_window: 'Year', is_required: true },
      { assessment_name: 'Assignment / Portfolio Evidence', assessment_type: 'Portfolio', assessment_window: 'Year', is_required: true },
      { assessment_name: 'Final Estimate', assessment_type: 'Portfolio', assessment_window: 'Final', is_required: true },
      { assessment_name: 'Overall Award Risk', assessment_type: 'Portfolio', assessment_window: 'Final', is_required: true }
    ],
    'n5n4-art': [
      { assessment_name: 'Expressive Folio Progress', assessment_type: 'Folio', assessment_window: 'Year', is_required: true },
      { assessment_name: 'Design Folio Progress', assessment_type: 'Folio', assessment_window: 'Year', is_required: true },
      { assessment_name: 'Written Paper Prelim', assessment_type: 'Prelim', assessment_window: 'January', is_required: true },
      { assessment_name: 'Final Folio Progress', assessment_type: 'Folio', assessment_window: 'Spring', is_required: true },
      { assessment_name: 'Final Estimate', assessment_type: 'Portfolio', assessment_window: 'Final', is_required: true }
    ],
    'higher-photo': [
      { assessment_name: 'Question Paper Prelim', assessment_type: 'Prelim', assessment_window: 'January', is_required: true },
      { assessment_name: 'Project Planning', assessment_type: 'Project', assessment_window: 'Year', is_required: true },
      { assessment_name: 'Research and Investigation', assessment_type: 'Research', assessment_window: 'Year', is_required: true },
      { assessment_name: 'Development Work', assessment_type: 'Project', assessment_window: 'Year', is_required: true },
      { assessment_name: 'Final Images', assessment_type: 'Project', assessment_window: 'Spring', is_required: true },
      { assessment_name: 'Evaluation', assessment_type: 'Evaluation', assessment_window: 'Spring', is_required: true },
      { assessment_name: 'Final Estimate', assessment_type: 'Portfolio', assessment_window: 'Final', is_required: true }
    ],
    'npa-photo': [],
    'ah-art': [
      { assessment_name: 'Expressive or Design Portfolio Progress', assessment_type: 'Portfolio', assessment_window: 'Year', is_required: true },
      { assessment_name: 'Research and Investigation', assessment_type: 'Research', assessment_window: 'Year', is_required: true },
      { assessment_name: 'Development Work', assessment_type: 'Project', assessment_window: 'Year', is_required: true },
      { assessment_name: 'Final Resolution', assessment_type: 'Portfolio', assessment_window: 'Spring', is_required: true },
      { assessment_name: 'Evaluation / Written Component', assessment_type: 'Evaluation', assessment_window: 'Spring', is_required: true },
      { assessment_name: 'Final Estimate', assessment_type: 'Portfolio', assessment_window: 'Final', is_required: true },
      { assessment_name: 'Overall Award Risk', assessment_type: 'Portfolio', assessment_window: 'Final', is_required: true }
    ],
    'l6l5-film': [],
    'creative-industries': []
  };

  /**
   * Prelim component templates per course slug.
   * short_label: column header on course grid; weighting must sum to 100 per course.
   */
  var PRELIM_COMPONENT_TEMPLATES = {
    'higher-drama': [
      { component_name: 'Written paper (Sections 1 & 2)', short_label: 'Written', max_marks: 50, weighting: 50 },
      { component_name: 'Practical performance', short_label: 'Practical', max_marks: 50, weighting: 50 }
    ],
    'n5n4-drama': [
      { component_name: 'Question paper', short_label: 'Written', max_marks: 40, weighting: 70 },
      { component_name: 'Practical performance', short_label: 'Practical', max_marks: 30, weighting: 30 }
    ],
    'n5n4-art': [
      { component_name: 'Written paper', short_label: 'Written', max_marks: 60, weighting: 100 }
    ],
    'higher-photo': [
      { component_name: 'Question paper', short_label: 'Written', max_marks: 40, weighting: 50 },
      { component_name: 'Project / portfolio', short_label: 'Project', max_marks: 100, weighting: 50 }
    ]
  };

  var TRACKING_POINT_NAMES = [
    { tracking_point_name: 'Tracking Point 1', tracking_point_date: '2026-10-15', academic_year: '2026-27' },
    { tracking_point_name: 'Tracking Point 2', tracking_point_date: '2026-12-10', academic_year: '2026-27' },
    { tracking_point_name: 'Tracking Point 3', tracking_point_date: '2027-02-20', academic_year: '2026-27' }
  ];

  function currentAcademicYear() {
    return (TRACKING_POINT_NAMES[0] && TRACKING_POINT_NAMES[0].academic_year) || '2026-27';
  }

  function gradeRank(g) {
    if (!g) return -1;
    var k = String(g).trim();
    return Object.prototype.hasOwnProperty.call(GRADE_RANK, k) ? GRADE_RANK[k] : 3;
  }

  function percentageToGrade(pct) {
    if (pct >= 70) return 'A';
    if (pct >= 60) return 'B';
    if (pct >= 50) return 'C';
    if (pct >= 40) return 'D';
    return 'F';
  }

  var SUBJECT_TILE_CLASS = {
    'Drama': 'drama',
    'Art': 'art',
    'Photography': 'photo',
    'Film and Screen': 'film',
    'Creative Industries': 'creative'
  };

  var SUBJECT_ORDER = ['Drama', 'Art', 'Photography', 'Film and Screen', 'Creative Industries'];

  function subjectTileClass(subjectArea) {
    return SUBJECT_TILE_CLASS[subjectArea] || 'default';
  }

  global.SptConfig = {
    STORAGE_KEY: STORAGE_KEY,
    DATA_VERSION: DATA_VERSION,
    useSeedData: useSeedData,
    isHubMode: function() { return !useSeedData; },
    STATUS: STATUS,
    CONCERN_CATEGORIES: CONCERN_CATEGORIES,
    ATTENDANCE_LABELS: ATTENDANCE_LABELS,
    TRACKING_SCORE_CLASS: TRACKING_SCORE_CLASS,
    BADGE_CLASS: BADGE_CLASS,
    GRADE_RANK: GRADE_RANK,
    gradeRank: gradeRank,
    percentageToGrade: percentageToGrade,
    subjectTileClass: subjectTileClass,
    SUBJECT_ORDER: SUBJECT_ORDER,
    ROLES: ROLES,
    CFE_LEVELS: CFE_LEVELS,
    COURSE_DEFS: COURSE_DEFS,
    ASSESSMENT_TEMPLATES: ASSESSMENT_TEMPLATES,
    PRELIM_COMPONENT_TEMPLATES: PRELIM_COMPONENT_TEMPLATES,
    TRACKING_POINT_NAMES: TRACKING_POINT_NAMES,
    currentAcademicYear: currentAcademicYear
  };
})(typeof window !== 'undefined' ? window : global);
