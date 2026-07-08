/**
 * N5 Creative Industries — teaching dates for each numbered session (1–61).
 * Sourced from U1–U4 Lesson Outlines (Glasgow term dates, Tue / Wed / Fri doubles).
 * Used by Teacher Planner to populate period lesson plans.
 */
(function () {
  var RAW = [
    [1, '2025-08-15'], [2, '2025-08-19'], [3, '2025-08-20'], [4, '2025-08-22'],
    [5, '2025-08-26'], [6, '2025-08-27'], [7, '2025-08-29'],
    [8, '2025-09-02'], [9, '2025-09-03'], [10, '2025-09-05'],
    [11, '2025-09-09'], [12, '2025-09-10'], [13, '2025-09-12'],
    [14, '2025-09-16'], [15, '2025-09-17'], [16, '2025-09-19'],
    [17, '2025-09-23'], [18, '2025-09-24'], [19, '2025-09-26'],
    [20, '2025-10-10'],
    [21, '2025-10-21'], [22, '2025-10-22'], [23, '2025-10-24'],
    [24, '2025-10-28'], [25, '2025-10-29'], [26, '2025-10-31'],
    [27, '2025-11-04'], [28, '2025-11-05'], [29, '2025-11-07'],
    [30, '2025-11-11'], [31, '2025-11-12'], [32, '2025-11-14'],
    [33, '2025-11-18'], [34, '2025-11-19'], [35, '2025-11-21'],
    [36, '2025-11-25'], [37, '2025-11-26'], [38, '2025-11-28'],
    [39, '2025-12-02'], [40, '2025-12-03'], [41, '2025-12-05'],
    [42, '2025-12-09'], [43, '2025-12-10'],
    [44, '2025-12-16'], [45, '2025-12-17'], [46, '2025-12-19'],
    [47, '2026-01-06'], [48, '2026-01-07'], [49, '2026-01-09'],
    [50, '2026-01-13'], [51, '2026-01-14'], [52, '2026-01-16'],
    [53, '2026-01-20'], [54, '2026-01-21'], [55, '2026-01-23'],
    [56, '2026-01-27'], [57, '2026-01-28'], [58, '2026-01-30'],
    [59, '2026-02-03'], [60, '2026-02-04'], [61, '2026-02-06']
  ];

  var DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

  function weekdayFromDateStr(dateStr) {
    var p = String(dateStr || '').split('-');
    if (p.length !== 3) return '';
    var d = new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10));
    return DAY_NAMES[d.getDay()] || '';
  }

  var schedule = RAW.map(function (row) {
    return { session: row[0], date: row[1], day: weekdayFromDateStr(row[1]) };
  });

  function getSessionMeta(sessionNum) {
    var n = parseInt(sessionNum, 10);
    if (isNaN(n) || !window.N5_CI_UNITS) return null;
    var units = window.N5_CI_UNITS;
    var keys = Object.keys(units);
    for (var i = 0; i < keys.length; i++) {
      var unit = units[keys[i]];
      var lessons = unit.lessons || [];
      for (var j = 0; j < lessons.length; j++) {
        var les = lessons[j];
        var sn = parseInt(les.session != null ? les.session : les.id, 10);
        if (sn === n) {
          return {
            session: n,
            title: les.title || ('Session ' + n),
            slides: les.slides || '',
            status: les.status || 'planned',
            unitId: unit.id,
            unitLabel: unit.unitLabel || '',
            unitTitle: unit.title || ''
          };
        }
      }
    }
    return null;
  }

  /** Canonical academic year for the published N5 CI year planner (Aug 2025 – Easter 2026). */
  var SCHEDULE_ACADEMIC_START_YEAR = 2025;

  function parseAcademicStartYear(label) {
    var m = String(label || '').match(/(\d{4})/);
    return m ? parseInt(m[1], 10) : SCHEDULE_ACADEMIC_START_YEAR;
  }

  function shiftIsoDate(dateStr, yearDelta) {
    if (!yearDelta) return dateStr;
    var p = String(dateStr).split('-');
    if (p.length !== 3) return dateStr;
    return (parseInt(p[0], 10) + yearDelta) + '-' + p[1] + '-' + p[2];
  }

  function resolveYearOffset() {
    /* Course dates are fixed to the published 2025–26 Glasgow year planner. */
    return 0;
  }

  function entryWithOffset(entry, yearOffset) {
    var date = shiftIsoDate(entry.date, yearOffset);
    return { session: entry.session, date: date, day: weekdayFromDateStr(date) };
  }

  window.N5_CI_SCHEDULE = schedule;
  window.N5_CI_SCHEDULE_HELPERS = {
    SCHEDULE_ACADEMIC_START_YEAR: SCHEDULE_ACADEMIC_START_YEAR,
    weekdayFromDateStr: weekdayFromDateStr,
    shiftIsoDate: shiftIsoDate,
    resolveYearOffset: resolveYearOffset,
    getSessionMeta: getSessionMeta,
    getEntry: function (sessionNum, yearOffset) {
      var n = parseInt(sessionNum, 10);
      var base = schedule.find(function (e) { return e.session === n; }) || null;
      if (!base) return null;
      return entryWithOffset(base, resolveYearOffset(yearOffset));
    },
    getRange: function (fromSession, toSession, yearOffset) {
      var from = parseInt(fromSession, 10) || 1;
      var to = parseInt(toSession, 10) || 61;
      var offset = resolveYearOffset(yearOffset);
      return schedule
        .filter(function (e) { return e.session >= from && e.session <= to; })
        .map(function (e) { return entryWithOffset(e, offset); });
    },
    formatDateRange: function (entries) {
      if (!entries || !entries.length) return '';
      var sorted = entries.slice().sort(function (a, b) { return a.date.localeCompare(b.date); });
      function fmt(iso) {
        var p = iso.split('-');
        var d = new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10));
        return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      }
      return fmt(sorted[0].date) + ' – ' + fmt(sorted[sorted.length - 1].date);
    }
  };
})();
