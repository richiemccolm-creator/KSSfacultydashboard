'use strict';
/** Virtual month reminders from Quality Calendar — merged into Faculty Hub announcements (not stored in DB). */
(function () {
  /** Activities excluded from staff reminders (dates live in academic calendar or FH-only). */
  var EXCLUDE_KEYS = {
    sltMeetings: true,
    tracking: true,
    reportQA: true,
    insightData: true,
    attainmentMeetings: true
  };

  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  function toISODate(d) {
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function monthBounds(monthLabel, sessionKey) {
    var y0 = parseInt(String(sessionKey || '').split('-')[0], 10);
    if (!y0 || Number.isNaN(y0)) {
      var now = new Date();
      y0 = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
    }
    var map = {
      Aug: [7, y0], Sept: [8, y0], Oct: [9, y0], Nov: [10, y0], Dec: [11, y0],
      Jan: [0, y0 + 1], Feb: [1, y0 + 1], Mar: [2, y0 + 1], Apr: [3, y0 + 1],
      May: [4, y0 + 1], June: [5, y0 + 1]
    };
    var m = map[monthLabel];
    if (!m) return { start: toISODate(new Date()), end: toISODate(new Date()) };
    var start = new Date(m[1], m[0], 1);
    var end = new Date(m[1], m[0] + 1, 0);
    return { start: toISODate(start), end: toISODate(end) };
  }

  function buildBody() {
    return 'This quality calendar activity is coming up this month. Open Quality Calendar for details.';
  }

  function getForMonth(monthLabel, sessionKey, todayIso) {
    if (!window.QualityCalendarMonthsData || !monthLabel) return [];
    var block = window.QualityCalendarMonthsData.find(function (x) { return x.month === monthLabel; });
    if (!block || !block.categories || !block.categories.length) return [];

    var bounds = monthBounds(monthLabel, sessionKey);
    if (todayIso && (todayIso < bounds.start || todayIso > bounds.end)) return [];

    var seen = {};
    var out = [];

    block.categories.forEach(function (cat) {
      (cat.activities || []).forEach(function (act) {
        if (!act || !act.key || EXCLUDE_KEYS[act.key] || seen[act.key]) return;
        seen[act.key] = true;
        var id = String(sessionKey || 'session') + '-' + monthLabel + '-' + act.key;
        out.push({
          id: id,
          title: act.name || act.key,
          body: buildBody(),
          created_at: bounds.start,
          expires_at: bounds.end,
          priority: 'medium',
          _virtualQuality: true,
          _monthLabel: monthLabel,
          _actKey: act.key,
          _qiCategory: cat.cat || ''
        });
      });
    });

    return out;
  }

  window.QualityCalendarReminders = {
    EXCLUDE_KEYS: EXCLUDE_KEYS,
    getForMonth: getForMonth,
    monthBounds: monthBounds
  };
})();
