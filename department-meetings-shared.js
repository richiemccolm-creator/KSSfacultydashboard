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
    '3.1 Ensuring wellbeing, equality and inclusion',
    '3.2 Participation in partnerships for improvement in the life of the school',
    '3.2 Raising attainment and achievement',
    '4.1 Raising attainment for all and closing the poverty-related attainment gap',
    '5.1 Developing and using appropriate skills for learning, life and work',
    '2.2 Curriculum',
    '1.3 Leadership of change',
    '2.6 Transitions'
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
    if (det0.indexOf('best practice') === -1 && det0.indexOf('sharing') === -1 && det0.indexOf('share') === -1) {
      errs.push('The first item\'s details should mention sharing or best practice (plain language).');
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

  function isSeparatorCells(cells) {
    if (!cells || !cells.length) return true;
    return cells.every(function(c) {
      var t = String(c || '').trim();
      return !t || /^[-:\s.]+$/.test(t);
    });
  }

  function isHeaderCells(cells) {
    var a = String(cells[0] || '').toLowerCase();
    if (a.indexOf('agenda item') >= 0) return true;
    if (a.indexOf('agenda') >= 0 && /details|description/i.test(String(cells[1] || ''))) return true;
    return false;
  }

  /**
   * Parse a pasted markdown / pipe table or tab-separated rows into agenda rows.
   * Expects columns: Agenda item | Details | Time | Minutes (optional) | Action items (optional).
   */
  window.parseDepartmentMeetingAgendaPaste = function(text) {
    if (!text || !String(text).trim()) return [];
    var lines = String(text).split(/\r?\n/);
    var rows = [];
    for (var li = 0; li < lines.length; li++) {
      var raw = lines[li].trim();
      if (!raw) continue;
      var cells;
      if (raw.indexOf('|') >= 0) {
        cells = raw.split('|').map(function(c) { return c.trim(); });
        if (cells.length && cells[0] === '') cells.shift();
        if (cells.length && cells[cells.length - 1] === '') cells.pop();
      } else if (raw.indexOf('\t') >= 0) {
        cells = raw.split('\t').map(function(c) { return c.trim(); });
      } else {
        continue;
      }
      if (cells.length < 3) continue;
      if (isSeparatorCells(cells)) continue;
      if (isHeaderCells(cells)) continue;
      rows.push({
        agenda_item: cells[0] || '',
        details: cells[1] || '',
        time_allocated: cells[2] || '',
        minutes: cells.length > 3 ? (cells[3] || '') : '',
        action_items: cells.length > 4 ? (cells[4] || '') : ''
      });
    }
    return rows;
  };
})();
