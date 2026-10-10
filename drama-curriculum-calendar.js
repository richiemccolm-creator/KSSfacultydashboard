/**
 * BGE Drama curriculum calendar — which unit each year group should be on, by school week.
 * Used by the Teacher Planner week banner.
 *
 * School weeks are teaching weeks counted from the first week of the session, skipping
 * weeks that are entirely holiday/INSET in academic-calendar-defaults.js
 * (2026–27: Wk 1 = w/c 10 Aug, October week skipped, Wk 10 = w/c 19 Oct, …).
 *
 * S1 week ranges come from drama-curriculum-manifest.js (`weeks: 'Wks 3–6'`).
 * S2 and S3 ranges below are converted from the TP timings in curriculum-units.js
 * (e.g. 'Sep–Oct'), so treat them as approximate and correct them here.
 */
(function () {
  'use strict';

  /** First Monday of the session and the day the school closes for summer. */
  var SESSION_START = '2026-08-10';
  var SESSION_END = '2027-06-25';

  /**
   * Year-group plans. `unit` links to a DRAMA_CURRICULUM unit (for colour, slides, lessons);
   * `tp` links to CURRICULUM_TPS.drama[year] (for the assessment description).
   * S1 entries without `weeks` take them from the manifest.
   */
  var PLAN = {
    S1: [
      { unit: '01' },
      { unit: '02', tp: 'tp1' },
      { unit: '03' },
      { unit: '04', tp: 'tp2' },
      { title: 'Intro to Stimulus', weeks: [15, 18], tp: 'tp3', colour: '#DB2777' },
      { unit: '05', tp: 'tp4' },
      { unit: '06', tp: 'tp5' },
      { unit: '07', tp: 'tp6' }
    ],
    S2: [
      { unit: 's2-02', weeks: [1, 4], tp: 'tp2' },
      { title: 'Voice & Movement', weeks: [5, 9], tp: 'tp3', colour: '#D4A800' },
      { title: 'Working with Scripts', weeks: [10, 14], tp: 'tp4', colour: '#1D4ED8' },
      { title: 'Production Skills', weeks: [15, 18], tp: 'tp5', colour: '#0891B2' },
      { title: 'Showcase & Review', weeks: [32, 38], tp: 'tp6', colour: '#6D28D9' },
      { title: 'Stage Combat', weeks: [39, 41], tp: 'tp1', colour: '#B91C1C', note: 'New timetable' }
    ],
    S3: [
      { title: 'Forms & Conventions', weeks: [1, 6], tp: 'tp2', colour: '#F97316' },
      { title: 'Theatre in Education', weeks: [7, 9], tp: 'tp3', colour: '#65A30D' },
      { title: 'Script Unit + Mini PFP', weeks: [10, 18], tp: 'tp4', colour: '#1D4ED8' },
      { title: 'Drama Skills — Stimulus', weeks: [19, 25], tp: 'tp5', colour: '#DB2777' },
      { title: 'Production Skills — Design', weeks: [26, 33], tp: 'tp6', colour: '#0891B2' },
      { title: 'Directing Unit', weeks: [39, 41], tp: 'tp1', colour: '#7C3AED', note: 'New timetable' }
    ]
  };

  var YEARS = ['S1', 'S2', 'S3'];
  var _weeks = null;
  var _plan = null;

  function parseIso(str) {
    var p = String(str || '').slice(0, 10).split('-');
    if (p.length !== 3) return null;
    var d = new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10));
    return isNaN(d.getTime()) ? null : d;
  }

  function isoOf(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function mondayOf(date) {
    var d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    var dow = d.getDay();
    d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
    return d;
  }

  function holidayLabel(title) {
    return String(title || 'Holiday').replace(/^Holiday\s*[–-]\s*/, '') || 'Holiday';
  }

  /** Every Monday from SESSION_START to SESSION_END, numbered if it has a teaching day. */
  function buildWeeks() {
    var events = window.ACADEMIC_CALENDAR_DEFAULT_EVENTS || [];
    var offDays = {};
    events.forEach(function (e) {
      if (e && (e.category === 'holiday' || e.category === 'inset') && e.date) {
        offDays[String(e.date).slice(0, 10)] = e.category === 'holiday' ? holidayLabel(e.title) : 'INSET';
      }
    });
    var start = parseIso(SESSION_START);
    var end = parseIso(SESSION_END);
    var weeks = [];
    var n = 0;
    for (var d = new Date(start); d <= end; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7)) {
      var teachingDays = 0;
      var offLabel = '';
      for (var i = 0; i < 5; i++) {
        var day = new Date(d.getFullYear(), d.getMonth(), d.getDate() + i);
        var key = isoOf(day);
        if (offDays[key]) {
          if (!offLabel && offDays[key] !== 'INSET') offLabel = offDays[key];
        } else if (day <= end) {
          teachingDays++;
        }
      }
      weeks.push({
        monday: isoOf(d),
        schoolWeek: teachingDays ? ++n : null,
        teachingDays: teachingDays,
        holiday: teachingDays ? '' : (offLabel || 'Holiday')
      });
    }
    return weeks;
  }

  function parseWeekRange(str) {
    var m = /(\d+)\s*[–-]\s*(\d+)/.exec(String(str || ''));
    if (m) return [parseInt(m[1], 10), parseInt(m[2], 10)];
    m = /Wks?\s*(\d+)/i.exec(String(str || ''));
    return m ? [parseInt(m[1], 10), parseInt(m[1], 10)] : null;
  }

  function findTp(year, tpId) {
    var tps = window.CURRICULUM_TPS && window.CURRICULUM_TPS.drama && window.CURRICULUM_TPS.drama[year.toLowerCase()];
    if (!tps || !tpId) return null;
    for (var i = 0; i < tps.length; i++) if (tps[i].id === tpId) return tps[i];
    return null;
  }

  /** Resolve PLAN against the manifest and TP data into flat, sorted unit blocks per year. */
  function buildPlan() {
    var manifest = (window.DRAMA_CURRICULUM && window.DRAMA_CURRICULUM.units) || {};
    var out = {};
    YEARS.forEach(function (year) {
      out[year] = (PLAN[year] || []).map(function (entry) {
        var u = entry.unit ? manifest[entry.unit] : null;
        var weeks = entry.weeks || (u && parseWeekRange(u.weeks));
        if (!weeks) return null;
        var tp = findTp(year, entry.tp);
        return {
          year: year,
          unitId: u ? u.id : '',
          title: entry.title || (u && u.title) || (tp && tp.unit) || 'Unit',
          from: weeks[0],
          to: weeks[1],
          colour: entry.colour || (u && u.colour) || '#64748b',
          tpLabel: tp ? tp.label : '',
          assessed: tp ? tp.assessed : '',
          lessons: u ? (u.lessons || []).filter(function (l) { return l && l.slides; }) : [],
          note: entry.note || ''
        };
      }).filter(Boolean).sort(function (a, b) { return a.from - b.from; });
    });
    return out;
  }

  function ensure() {
    if (!_weeks) _weeks = buildWeeks();
    if (!_plan) _plan = buildPlan();
  }

  function weekEntryFor(date) {
    ensure();
    var key = isoOf(mondayOf(date));
    for (var i = 0; i < _weeks.length; i++) if (_weeks[i].monday === key) return { index: i, week: _weeks[i] };
    return null;
  }

  function blockAt(year, schoolWeek) {
    var list = _plan[year] || [];
    for (var i = 0; i < list.length; i++) {
      if (schoolWeek >= list[i].from && schoolWeek <= list[i].to) return list[i];
    }
    return null;
  }

  function nextBlockAfter(year, schoolWeek) {
    var list = _plan[year] || [];
    for (var i = 0; i < list.length; i++) if (list[i].from > schoolWeek) return list[i];
    return null;
  }

  function mondayForSchoolWeek(n) {
    for (var i = 0; i < _weeks.length; i++) if (_weeks[i].schoolWeek === n) return _weeks[i].monday;
    return '';
  }

  function rowFor(year, schoolWeek) {
    var b = blockAt(year, schoolWeek);
    var next = nextBlockAfter(year, schoolWeek);
    var row = { year: year, schoolWeek: schoolWeek, block: b, next: null };
    if (next && (!b || schoolWeek === b.to)) {
      row.next = { title: next.title, fromWeek: next.from, monday: mondayForSchoolWeek(next.from), colour: next.colour };
    }
    if (b) {
      row.weekInUnit = schoolWeek - b.from + 1;
      row.unitLength = b.to - b.from + 1;
      row.isFirstWeek = schoolWeek === b.from;
      row.isFinalWeek = schoolWeek === b.to;
    }
    return row;
  }

  /**
   * Curriculum position for the school week containing `date`.
   * opts.years: limit rows to these year groups (e.g. ['S1', 'S2']); defaults to S1–S3.
   * Returns null outside the session.
   */
  function getWeek(date, opts) {
    var d = date instanceof Date ? date : parseIso(date);
    if (!d) return null;
    var hit = weekEntryFor(d);
    if (!hit) return null;
    var years = (opts && opts.years && opts.years.length) ? opts.years : YEARS;
    var w = hit.week;
    var result = {
      monday: w.monday,
      schoolWeek: w.schoolWeek,
      totalWeeks: _weeks.reduce(function (n, x) { return x.schoolWeek ? Math.max(n, x.schoolWeek) : n; }, 0),
      teachingDays: w.teachingDays,
      holiday: w.holiday,
      resumes: null,
      rows: []
    };
    var teachWeek = w.schoolWeek;
    if (!teachWeek) {
      for (var i = hit.index + 1; i < _weeks.length; i++) {
        if (_weeks[i].schoolWeek) {
          teachWeek = _weeks[i].schoolWeek;
          result.resumes = { monday: _weeks[i].monday, schoolWeek: teachWeek };
          break;
        }
      }
      if (!teachWeek) return result;
    }
    result.rows = years.map(function (y) { return rowFor(y, teachWeek); });
    return result;
  }

  /** Planner year group ('S1'…'S3') for a Drama class code such as '1F' or '2L'; '' otherwise. */
  function yearForClass(className, subject) {
    if (subject && subject !== 'drama') return '';
    var m = /^\s*([1-3])[A-Za-z]/.exec(String(className || ''));
    return m ? 'S' + m[1] : '';
  }

  window.DramaCurriculumCalendar = {
    YEARS: YEARS,
    getWeek: getWeek,
    yearForClass: yearForClass,
    getPlan: function () { ensure(); return _plan; },
    getWeeks: function () { ensure(); return _weeks.slice(); }
  };
})();
