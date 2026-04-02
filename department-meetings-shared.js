/**
 * Shared HGIOS4-style agenda labels and validation for departmental meetings.
 */
(function() {
  window.DEPARTMENT_MEETINGS_FIRST_ROW_QI = '2.3 Learning, Teaching and Assessment';

  window.DEPARTMENT_MEETINGS_HGIOS = [
    '2.3 Learning, Teaching and Assessment',
    '1.1 Ensuring wellbeing, equality and inclusion',
    '1.2 Strategic approaches to closing the poverty-related attainment gap',
    '1.3 Leadership of learning',
    '1.4 Leadership of change',
    '2.1 Safeguarding and child protection',
    '2.2 Curriculum rationale',
    '2.4 Family learning',
    '3.1 Engagement of parents, families and learners in leading improvement',
    '3.2 Participation in partnerships for improvement in the life of the school',
    '4.1 Raising attainment for all and closing the poverty-related attainment gap',
    '5.1 Developing and using appropriate skills for learning, life and work'
  ];

  function norm(s) {
    return String(s || '').trim();
  }

  /**
   * @param {Array<{agenda_item:string,details:string,time_allocated:string,minutes:string,action_items:string}>} rows
   * @param {{ enforceBlankMinutesActions?: boolean }} options
   */
  window.validateDepartmentMeetingAgenda = function(rows, options) {
    options = options || {};
    var errs = [];
    var warns = [];
    if (!rows || !rows.length) {
      errs.push('Add at least one agenda row.');
      return { ok: false, errs: errs, warns: warns };
    }
    var first = rows[0];
    var qi0 = norm(first.agenda_item);
    if (!/^2\.3\b/i.test(qi0)) {
      errs.push('The first agenda item must be 2.3 (Learning, Teaching and Assessment).');
    }
    var det0 = norm(first.details).toLowerCase();
    if (det0.indexOf('best practice') === -1 && det0.indexOf('sharing') === -1) {
      errs.push('The first item\'s details should mention sharing best practice (plain language).');
    }
    var sum = 0;
    rows.forEach(function(r) {
      var m = norm(r.time_allocated).match(/^(\d+)/);
      if (m) sum += parseInt(m[1], 10);
    });
    if (sum > 70) {
      warns.push('Time allocations sum to about ' + sum + ' minutes — check against your usual ~60 minute meeting.');
    } else if (sum > 0 && sum < 45) {
      warns.push('Time allocations sum to about ' + sum + ' minutes — ensure that reflects your full meeting.');
    }
    if (options.enforceBlankMinutesActions) {
      rows.forEach(function(r, i) {
        if (norm(r.minutes) || norm(r.action_items)) {
          errs.push('Row ' + (i + 1) + ': leave Minutes and Action items blank for a pre-meeting agenda.');
        }
      });
    }
    return { ok: errs.length === 0, errs: errs, warns: warns };
  };

  window.defaultDepartmentMeetingRows = function() {
    return [{
      agenda_item: window.DEPARTMENT_MEETINGS_FIRST_ROW_QI,
      details: 'Sharing best practice — ',
      time_allocated: '10',
      minutes: '',
      action_items: ''
    }];
  };
})();
