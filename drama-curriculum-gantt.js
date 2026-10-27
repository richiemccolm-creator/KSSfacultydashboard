/**
 * BGE Drama year-at-a-glance Gantt — one row per unit against the school calendar
 * (terms, months, school weeks, holidays), with the tracking point assessed in each unit.
 * Reads DramaCurriculumCalendar, so it matches the Teacher Planner week banner.
 * Used by the S1–S3 curriculum panels in faculty-hub.html and drama-curriculum-poster.html.
 * Needs drama-curriculum-gantt.css.
 */
(function () {
  'use strict';

  var YEAR_COLOURS = { S1: '#e11d48', S2: '#2563eb', S3: '#7c3aed' };
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function parseIso(str) {
    var p = String(str).split('-');
    return new Date(+p[0], +p[1] - 1, +p[2]);
  }

  function isoOf(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function shortDate(iso, addDays) {
    var d = parseIso(iso);
    if (addDays) d.setDate(d.getDate() + addDays);
    return d.getDate() + ' ' + MONTHS[d.getMonth()];
  }

  /** Calendar columns: one per Monday of the session, dropping the summer weeks at the end. */
  function columns() {
    var cols = window.DramaCurriculumCalendar.getWeeks().map(function (w, i) {
      var d = parseIso(w.monday);
      return { i: i, monday: w.monday, schoolWeek: w.schoolWeek, holiday: w.holiday, month: d.getMonth(), year: d.getFullYear() };
    });
    while (cols.length && !cols[cols.length - 1].schoolWeek) cols.pop();
    return cols;
  }

  function runs(cols, keyFn) {
    var out = [];
    cols.forEach(function (c, i) {
      var k = keyFn(c);
      var last = out[out.length - 1];
      if (last && last.key === k) last.to = i;
      else out.push({ key: k, from: i, to: i, col: c });
    });
    return out;
  }

  function colForSchoolWeek(cols, n) {
    for (var i = 0; i < cols.length; i++) if (cols[i].schoolWeek === n) return i;
    return -1;
  }

  function sessionLabel(cols) {
    return cols[0].year + '–' + String(cols[cols.length - 1].year).slice(2);
  }

  /** Earliest plan entry with a note (the "New timetable" switch), across all years. */
  function newTimetableBlock(plan) {
    var nt = null;
    Object.keys(plan).forEach(function (y) {
      (plan[y] || []).forEach(function (b) { if (b.note && (!nt || b.from < nt.from)) nt = b; });
    });
    return nt;
  }

  /**
   * Gantt markup for one year group.
   * opts.today: true to highlight the current week (screen use).
   * Returns { html, blocks, cols, newTimetable } — html is the full .dc-gantt element.
   */
  function render(year, opts) {
    opts = opts || {};
    var plan = window.DramaCurriculumCalendar.getPlan();
    var blocks = plan[year] || [];
    var cols = columns();
    var N = cols.length;
    var ROW0 = 4; // rows 1–3 are term, month and week-number headers
    var lastRow = ROW0 + blocks.length - 1;
    var html = [];

    html.push('<div class="g-corner" style="grid-row:1 / 3;grid-column:1">' + esc(sessionLabel(cols)) + ' session</div>');
    var termNo = 0;
    runs(cols, function (c) { return c.schoolWeek ? 'term' : 'break:' + c.holiday; }).forEach(function (r) {
      var isBreak = r.key !== 'term';
      if (!isBreak) termNo++;
      html.push('<div class="g-term' + (isBreak ? ' break' : '') + '" style="grid-row:1;grid-column:' + (r.from + 2) + ' / span ' + (r.to - r.from + 1) + '">' +
        (isBreak ? '' : 'Term ' + termNo) + '</div>');
    });
    runs(cols, function (c) { return c.year + '-' + c.month; }).forEach(function (r) {
      var span = r.to - r.from + 1;
      html.push('<div class="g-month" style="grid-row:2;grid-column:' + (r.from + 2) + ' / span ' + span + '">' +
        (span >= 3 ? MONTHS_LONG[r.col.month] : MONTHS[r.col.month]) + '</div>');
    });

    var todayCol = -1;
    if (opts.today) {
      var now = new Date();
      var dow = now.getDay();
      now.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1));
      var key = isoOf(now);
      for (var t = 0; t < N; t++) if (cols[t].monday === key) todayCol = t;
    }

    html.push('<div class="g-wk-label" style="grid-row:3;grid-column:1">School week</div>');
    cols.forEach(function (c, i) {
      html.push('<div class="g-wk' + (c.schoolWeek ? '' : ' hol') + (i === todayCol ? ' now' : '') + '" style="grid-row:3;grid-column:' + (i + 2) + '"' +
        (i === todayCol ? ' title="This week"' : '') + '>' + (c.schoolWeek || '') + '</div>');
    });

    blocks.forEach(function (b, bi) {
      var row = ROW0 + bi;
      var last = row === lastRow ? ' g-row-last' : '';
      html.push('<div class="g-label' + last + '" style="grid-row:' + row + ';--c:' + b.colour + '"><span class="g-num">' + (bi + 1) + '</span>' +
        '<span class="g-name">' + esc(b.title) + '<small>Weeks ' + b.from + (b.to !== b.from ? '–' + b.to : '') + (b.tpLabel ? ' · ' + b.tpLabel : '') + '</small></span></div>');
      cols.forEach(function (c, i) {
        var monthStart = i > 0 && cols[i - 1].month !== c.month;
        html.push('<div class="g-cell' + (c.schoolWeek ? '' : ' hol') + (monthStart ? ' month-start' : '') + last + '" style="grid-row:' + row + ';grid-column:' + (i + 2) + '"></div>');
      });
      var a = colForSchoolWeek(cols, b.from);
      var z = colForSchoolWeek(cols, b.to);
      if (a < 0 || z < 0) return;
      var span = z - a + 1;
      var short = span < 6;
      var tp = b.tpLabel ? '<span class="tp">' + esc(b.tpLabel) + '</span>' : '';
      var inner = short ? tp
        : '<span class="t">' + esc(b.title) + '</span>' + (span >= 7 ? ' <span class="wks">Wks ' + b.from + '–' + b.to + '</span>' : '') + tp;
      var tip = b.title + ' · Weeks ' + b.from + '–' + b.to + ' · ' + shortDate(cols[a].monday) + ' – ' + shortDate(cols[z].monday, 4) +
        (b.tpLabel ? ' · ' + b.tpLabel + ': ' + b.assessed : '');
      html.push('<div class="g-bar' + (short ? ' short' : '') + (b.note ? ' note' : '') + '" title="' + esc(tip) + '" style="grid-row:' + row + ';grid-column:' + (a + 2) + ' / span ' + span + ';--c:' + b.colour + '">' + inner + '</div>');
    });

    if (blocks.length) {
      runs(cols, function (c) { return c.schoolWeek ? '' : c.holiday; }).forEach(function (r) {
        if (!r.key) return;
        var label = r.key.replace(/\s*&\s*New Year/, '').replace(/ Week$/, '');
        html.push('<div class="g-hol" style="grid-row:' + ROW0 + ' / ' + (lastRow + 1) + ';grid-column:' + (r.from + 2) + ' / span ' + (r.to - r.from + 1) + '"><span>' + esc(label) + '</span></div>');
      });
    }

    var nt = newTimetableBlock(plan);
    if (nt && blocks.length) {
      var nc = colForSchoolWeek(cols, nt.from);
      if (nc >= 0) {
        html.push('<div class="g-marker" style="grid-row:' + ROW0 + ' / ' + (lastRow + 1) + ';grid-column:' + (nc + 2) + '"><span>' + esc(nt.note) + ' · w/c ' + shortDate(cols[nc].monday) + '</span></div>');
      }
    }

    if (todayCol >= 0 && blocks.length) {
      html.push('<div class="g-today" style="grid-row:' + ROW0 + ' / ' + (lastRow + 1) + ';grid-column:' + (todayCol + 2) + '"></div>');
    }

    return {
      html: '<div class="dc-gantt" style="--cols:' + N + ';--rows:' + blocks.length + '">' + html.join('') + '</div>',
      blocks: blocks,
      cols: cols,
      newTimetable: nt,
      todayCol: todayCol
    };
  }

  /** Key strip for under the chart. */
  function keyHtml(opts) {
    opts = opts || {};
    return '<div class="dc-gantt-key">' +
      '<span><i class="k-unit"></i>Unit</span>' +
      '<span><i class="k-tp"></i>Tracking point assessed</span>' +
      '<span><i class="k-hol"></i>School holiday</span>' +
      '<span><i class="k-line"></i>New timetable starts</span>' +
      (opts.today ? '<span><i class="k-now"></i>This week</span>' : '') +
      '</div>';
  }

  /** Fill every [data-dc-gantt="S1"] element on the page. */
  function mountAll(root) {
    if (!window.DramaCurriculumCalendar) return;
    (root || document).querySelectorAll('[data-dc-gantt]').forEach(function (el) {
      var year = el.getAttribute('data-dc-gantt');
      var out = render(year, { today: true });
      el.style.setProperty('--year', YEAR_COLOURS[year] || '#16243c');
      el.innerHTML = out.html + keyHtml({ today: out.todayCol >= 0 });
    });
  }

  window.DramaCurriculumGantt = {
    YEAR_COLOURS: YEAR_COLOURS,
    render: render,
    keyHtml: keyHtml,
    mountAll: mountAll,
    colForSchoolWeek: colForSchoolWeek,
    shortDate: shortDate,
    sessionLabel: sessionLabel,
    esc: esc
  };
})();
