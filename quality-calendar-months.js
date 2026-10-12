'use strict';
/**
 * Monthly activity grid for the Quality Calendar planner.
 *
 * Built from window.QualityCalendarQiFocus (quality-calendar-qi-focus.js — the QI Calendar
 * "QC By month" sheet of Quality Calendar.xlsx), which is also what the Faculty Hub home and My Week
 * show, so the planner and the home page can never disagree. Load quality-calendar-qi-focus.js
 * first.
 *
 * Each QI Calendar line (e.g. "S4 Class Observations") is mapped to a planner activity key and
 * a year-group focus. Activities that only appear on the "QC Overview" sheet (leavers,
 * attendance, parent/carer and partner feedback, HMIE questionnaire) are added from ANNUAL_ONLY below.
 */
(function () {
  var QI_FOCUS = window.QualityCalendarQiFocus || [];
  var ORDER = window.QualityCalendarQiFocusOrder ||
    ['Aug', 'Sept', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'June'];

  var CAT_NAMES = {
    qi13: 'QI 1.3 Leadership of change',
    qi23: 'QI 2.3 Learning, teaching & assessment',
    qi31: 'QI 3.1 Wellbeing, equality & inclusion',
    qi32: 'QI 3.2 Raising attainment & achievement'
  };
  var CAT_ORDER = ['qi13', 'qi23', 'qi31', 'qi32'];
  var MISSION = { qi13: 'QI 1.3', qi23: 'QI 2.3', qi31: 'QI 3.1', qi32: 'QI 3.2' };

  var ACT_NAMES = {
    sltMeetings: 'SLT – PT/DH Link Meetings',
    sipReview: 'Termly DIP Review',
    prd: 'PRD',
    learnerConversations: 'Learner Conversations',
    observations: 'Class Observations',
    pupilFeedback: 'Young People Feedback on Learning',
    environment: 'Learning Environment Checklist',
    tracking: 'Tracking Data Analysis & Interventions',
    insightData: 'Insight Data Analysis',
    termlyQA: 'Reports Quality Assurance',
    attainmentMeetings: 'Attainment Meetings',
    leavers: 'Leaver Destinations',
    attendance: 'Attendance & Exclusion',
    parentFeedback: 'Parent Carer Feedback',
    partnersFeedback: 'Partners Feedback',
    hmieQuestionnaire: 'Young People HMIE Questionnaire'
  };
  var WELLBEING = { environment: true, attendance: true };

  /** Activities on the "QC Overview" sheet that the "QC By month" sheet does not cover. */
  var ANNUAL_ONLY = [
    { key: 'leavers', cat: 'qi32', missions: ['QI 3.2'], months: { Oct: ['*'], Feb: ['*'] } },
    { key: 'attendance', cat: 'qi31', missions: ['QI 3.1'], months: { Oct: ['*'], Dec: ['*'], Mar: ['*'], June: ['*'] } },
    { key: 'parentFeedback', cat: 'qi32', missions: [], months: { Nov: ['S1'], Feb: ['S4-6'], Mar: ['S2'], May: ['S3'] } },
    { key: 'partnersFeedback', cat: 'qi32', missions: [], months: { May: ['*'] } },
    { key: 'hmieQuestionnaire', cat: 'qi32', missions: [], months: { May: ['*'] } }
  ];

  function yearGroup(text) {
    var m = /\bS\d(?:-\d)?\b/.exec(text);
    return m ? m[0] : '';
  }

  /** Map one QI Calendar line to { key, focus }. */
  function classify(item, qi) {
    var yg = yearGroup(item);
    var all = '*';
    if (/link meetings/i.test(item)) return { key: 'sltMeetings', focus: all };
    if (/DIP Review/i.test(item)) return { key: 'sipReview', focus: all };
    if (/^PRD/i.test(item)) return { key: 'prd', focus: /review/i.test(item) ? 'Process review' : 'Process complete' };
    if (/learner conversation/i.test(item)) return { key: 'learnerConversations', focus: yg || all };
    if (/class observation/i.test(item)) return { key: 'observations', focus: yg || all };
    if (/feedback on learning/i.test(item)) return { key: 'pupilFeedback', focus: yg || all };
    if (/environment/i.test(item)) return { key: 'environment', focus: all };
    if (/insight/i.test(item)) return { key: 'insightData', focus: all };
    if (/quality assur/i.test(item)) return { key: 'termlyQA', focus: yg || all };
    if (/attainment meetings/i.test(item)) return { key: 'attainmentMeetings', focus: yg || all };
    var label;
    if (/SQA/i.test(item)) label = 'SQA Results';
    else if (/prelim/i.test(item)) label = 'Prelims';
    else if (/initial grades/i.test(item)) label = 'Initial Grades';
    else if (/review of .*reports/i.test(item)) label = 'Reports Review';
    else label = 'Tracking';
    if (qi !== 'qi32' && typeof console !== 'undefined') {
      console.warn('[Quality calendar] Unrecognised QI Calendar item, filed under tracking:', item);
    }
    return { key: 'tracking', focus: yg ? yg + ' ' + label : label };
  }

  function emptyMonth() {
    var cats = {};
    CAT_ORDER.forEach(function (c) { cats[c] = []; });
    return cats;
  }

  function findOrAdd(list, key, cat, missions) {
    for (var i = 0; i < list.length; i++) if (list[i].key === key) return list[i];
    var act = {
      key: key,
      name: ACT_NAMES[key] || key,
      gc: [WELLBEING[key] ? 'Wellbeing' : 'Progress'],
      missions: missions || [MISSION[cat]],
      focus: [],
      sources: []
    };
    list.push(act);
    return act;
  }

  var byMonth = {};
  ORDER.forEach(function (m) { byMonth[m] = emptyMonth(); });

  QI_FOCUS.forEach(function (row) {
    var cats = byMonth[row.month];
    if (!cats) return;
    row.categories.forEach(function (c) {
      c.items.forEach(function (item) {
        var hit = classify(item, c.qi);
        var act = findOrAdd(cats[c.qi], hit.key, c.qi);
        if (act.focus.indexOf(hit.focus) === -1) act.focus.push(hit.focus);
        act.sources.push(item);
      });
    });
  });

  ANNUAL_ONLY.forEach(function (a) {
    Object.keys(a.months).forEach(function (month) {
      var cats = byMonth[month];
      if (!cats) return;
      var act = findOrAdd(cats[a.cat], a.key, a.cat, a.missions);
      a.months[month].forEach(function (f) { if (act.focus.indexOf(f) === -1) act.focus.push(f); });
    });
  });

  window.QualityCalendarMonthsData = ORDER.map(function (month) {
    var cats = byMonth[month];
    return {
      month: month,
      categories: CAT_ORDER
        .filter(function (c) { return cats[c].length; })
        .map(function (c) { return { name: CAT_NAMES[c], cat: c, activities: cats[c] }; })
    };
  });
  window.QualityCalendarMonthsOrder = ORDER.slice();
})();
