'use strict';
/** One-line guidance per activity type — source: Quality_Calendar_Full.xlsx (Guidance sheet). */
window.QualityCalendarGuidance = {
  'Learner Conversations': 'Structured discussions with learners to gather evidence about learning, progress and classroom experiences.',
  'Class Observations': 'Planned observations focused on learning, teaching and assessment.',
  'Young People Feedback on Learning': 'Gather learner views on learning experiences and use findings to inform improvements.',
  'Environment Checklist': 'Review classroom and faculty environments for consistency, inclusion and readiness for learning.',
  'Tracking Data Analysis': 'Review attainment data, identify trends and agree interventions.',
  'Attainment Meetings': 'Professional dialogue focused on progress, attainment and next steps.',
  'PRD': 'Professional Review and Development discussions linked to improvement priorities.',
  'DIP Review': 'Review progress against the Departmental/School Improvement Plan and evaluate impact.',
  'Reports QA': 'Quality assure reports before issue to ensure accuracy and consistency.',
  'Insight Data': 'Analyse national benchmarking data and compare performance with similar schools and national measures.',
  'Leaver Destinations': 'Track and support young people towards positive destinations when they leave school.',
  'Attendance & Exclusion': 'Monitor attendance and exclusions and agree support to remove barriers to learning.',
  'Parent Carer Feedback': 'Gather and respond to parent and carer views to inform improvement.',
  'HMIE Questionnaire': 'Gather young people\'s views using the HMIe questionnaire and act on findings.'
};

(function () {
  var rules = [
    { key: 'Learner Conversations', re: /learner conversation/i },
    { key: 'Class Observations', re: /class observation/i },
    { key: 'Young People Feedback on Learning', re: /young people feedback|pupil voice|feedback on learning/i },
    { key: 'Environment Checklist', re: /environment checklist|learning environment/i },
    { key: 'Attainment Meetings', re: /attainment meeting/i },
    { key: 'DIP Review', re: /dip review|slt \/ dip review/i },
    { key: 'PRD', re: /prd process|^\s*prd\s*$/i },
    { key: 'Reports QA', re: /quality assure|quality assurance|futureports|full reports?/i },
    { key: 'Insight Data', re: /insight data/i },
    { key: 'Tracking Data Analysis', re: /analysis of|tracking data|initial grades|prelim analysis|sqa analysis/i },
    { key: 'Leaver Destinations', re: /leaver destination/i },
    { key: 'Attendance & Exclusion', re: /attendance|exclusion/i },
    { key: 'Parent Carer Feedback', re: /parent carer feedback|parental questionnaire/i },
    { key: 'HMIE Questionnaire', re: /hmie questionnaire/i }
  ];

  window.QualityCalendarGuidanceFor = function (label) {
    var text = String(label || '');
    if (!text) return '';
    for (var i = 0; i < rules.length; i++) {
      if (rules[i].re.test(text)) {
        return window.QualityCalendarGuidance[rules[i].key] || '';
      }
    }
    return '';
  };
})();
