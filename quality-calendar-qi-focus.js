'use strict';
/**
 * Monthly QI focus lists — source: Quality Calendar.xlsx ("QC By month" sheet).
 * Used by the Faculty Hub home, My Week and (via quality-calendar-months.js) the Quality Calendar
 * planner and poster. My Week links saved tasks to the exact item text, so keep wording stable.
 */
(function () {
  var N = {
    qi13: 'QI 1.3 Leadership of change',
    qi23: 'QI 2.3 Learning, teaching & assessment',
    qi31: 'QI 3.1 Ensuring wellbeing, equality & inclusion',
    qi32: 'QI 3.2 Raising attainment & achievement'
  };
  function cat(qi, items) { return { qi: qi, name: N[qi], items: items }; }

  window.QualityCalendarQiFocus = [
    { month: 'Aug', categories: [
      cat('qi23', ['S4 Learner Conversation']),
      cat('qi31', ['Environment Checklist']),
      cat('qi32', ['S4 Initial Grades analysis & interventions'])
    ] },
    { month: 'Sept', categories: [
      cat('qi13', ['SLT - PT DH Link Meetings']),
      cat('qi23', ['S3 Learner Conversation', 'S5-6 Learner Conversation']),
      cat('qi32', ['Analysis of S3 Tracking Data & Interventions', 'Analysis of S5-6 Initial Grades & Interventions', 'S4-6 SQA Analysis', 'Insight Data Analysis'])
    ] },
    { month: 'Oct', categories: [
      cat('qi13', ['PRD Process Complete', 'Termly DIP Review']),
      cat('qi23', ['S4 Class Observations', 'S4 Young People Feedback on Learning', 'S2 Learner Conversations', 'S4 Learner Conversation']),
      cat('qi32', ['Analysis of S2 Tracking Data & Interventions', 'Analysis of S4 Tracking Data & Interventions', 'Quality Assure S4 Full reports'])
    ] },
    { month: 'Nov', categories: [
      cat('qi13', ['SLT - PT DH Link Meetings']),
      cat('qi23', ['S5-6 Class Observations', 'S5-6 Learner Conversation', 'S5-6 Young People Feedback on Learning']),
      cat('qi32', ['Quality Assure S5-6 Full reports', 'Analysis of S5-6 Tracking Data & Interventions', 'Review of S5-6 Reports & Tracking Data'])
    ] },
    { month: 'Dec', categories: [
      cat('qi13', ['Termly DIP Review']),
      cat('qi23', ['S3 Learner Conversation']),
      cat('qi31', ['Environment Checklist']),
      cat('qi32', ['Analysis of S3 Tracking Data & Interventions', 'Quality Assure S3 Full reports', 'S1-3 Attainment Meetings'])
    ] },
    { month: 'Jan', categories: [
      cat('qi13', ['SLT - PT DH Link Meetings']),
      cat('qi23', ['S4-5 Learner Conversations', 'S1-2 Class Observations', 'S1-2 Young People Feedback on Learning']),
      cat('qi32', ['Analysis of S4-6 Tracking Data & Interventions', 'S4-6 Prelim Analysis'])
    ] },
    { month: 'Feb', categories: [
      cat('qi23', ['S2 Learner Conversations']),
      cat('qi32', ['Quality Assure S2 Full reports', 'Analysis of S2 Tracking Data & Interventions', 'Insight Data'])
    ] },
    { month: 'Mar', categories: [
      cat('qi13', ['Termly DIP Review', 'SLT - PT DH Link Meetings']),
      cat('qi23', ['S1 Learner Conversations']),
      cat('qi32', ['Analysis of S1 Tracking Data Interventions'])
    ] },
    { month: 'Apr', categories: [] },
    { month: 'May', categories: [
      cat('qi13', ['SLT - PT DH Link Meetings', 'Termly DIP Review']),
      cat('qi23', ['S3 Class Observations', 'S3 Young People Feedback on Learning']),
      cat('qi31', ['Environment Checklist'])
    ] },
    { month: 'June', categories: [
      cat('qi13', ['PRD Process Review']),
      cat('qi23', ['S1 Learner Conversations']),
      cat('qi32', ['Analysis of S1 Tracking Data & Intervention', 'Quality Assurance of S1 Reports', 'S1-3 Attainment Meetings'])
    ] }
  ];
  window.QualityCalendarQiFocusOrder = ['Aug', 'Sept', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'June'];
})();
