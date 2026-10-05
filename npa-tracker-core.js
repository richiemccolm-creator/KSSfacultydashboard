/**
 * NPA tracker (Photography and Art & Design strands, taught to the same class): course structure,
 * reading a tracking spreadsheet, and merging it in.
 * No DOM here, so it can be unit tested (npa-tracker-core.test.mjs).
 *
 * The spreadsheet is read in the browser only. parseWorkbook() takes the sheets' cell values and
 * keeps just the pupil first name, task progress, short notes, strengths and areas for development.
 * Everything else in the file is ignored, and the file itself is never uploaded.
 *
 * Saved shape (pupil_data, data_type 'npa-v1'):
 * { version, courses:[{id:'photo'|'art',name,units:[{id,name,tasks:[{id,name}]}]}],
 *   (a unit may also have due:'YYYY-MM-DD', used by the off-track dashboard)
 *   classes:[{id,name,pupils:[{id,name,strengths,development,work:{taskId:{s:'done'|'started',n}}}]}] }
 * A class has one list of pupils; each pupil's work covers the tasks of both strands.
 */
(function(root) {
  'use strict';

  var MAX_TEXT = 500;
  var ANY_SECTION = /^\s*npa\b/i;

  // Both strands as laid out in the 2025–27 tracking spreadsheet, so the tracker is usable before
  // anything is imported. "heading" finds each strand's section (column A) in a spreadsheet.
  var COURSES = [
    {
      id: 'photo', name: 'NPA Photography', short: 'Photography',
      heading: /^\s*npa\s+photography\b/i,
      units: [
        { id: 'u-understanding', name: 'Understanding Photography', tasks: [
          { id: 'u-understanding-t1', name: 'Understanding Photography' }
        ] },
        { id: 'u-people', name: 'Photographing People', tasks: [
          { id: 'u-people-t1', name: 'Photographing People Research' },
          { id: 'u-people-t2', name: 'Photoshoot 1 Plan' },
          { id: 'u-people-t3', name: 'Photoshoot 1' },
          { id: 'u-people-t4', name: 'Photoshoot 2 Plan' },
          { id: 'u-people-t5', name: 'Photoshoot 2' },
          { id: 'u-people-t6', name: 'Photoshoot 3 Plan (group of people)' },
          { id: 'u-people-t7', name: 'Photoshoot 3' }
        ] },
        { id: 'u-places', name: 'Photographing Places', tasks: [
          { id: 'u-places-t1', name: 'Photoshoot 1 Plan' },
          { id: 'u-places-t2', name: 'Photoshoot 1' },
          { id: 'u-places-t3', name: 'Photoshoot 2 Plan' },
          { id: 'u-places-t4', name: 'Photoshoot 2' },
          { id: 'u-places-t5', name: 'Photoshoot 3 Plan (interior)' },
          { id: 'u-places-t6', name: 'Photoshoot 3 (interior)' }
        ] },
        { id: 'u-working', name: 'Working with Photographs', tasks: [] }
      ]
    },
    {
      id: 'art', name: 'NPA Art and Design', short: 'Art & Design',
      heading: /^\s*npa\s+art\s*(and|&)\s*design\b/i,
      units: [
        { id: 'a-print', name: 'Printmaking', tasks: [
          { id: 'a-print-t1', name: 'Print technique 1 (Lino print)' },
          { id: 'a-print-t2', name: 'Print technique 2 (screen print)' },
          { id: 'a-print-t3', name: 'Print technique 3 (mono print)' },
          { id: 'a-print-t4', name: 'Written annotations added?' },
          { id: 'a-print-t5', name: 'Final Print 1' },
          { id: 'a-print-t6', name: 'Final Print 2' }
        ] },
        { id: 'a-mixed', name: 'Mixed Media', tasks: [
          { id: 'a-mixed-t1', name: 'Mark making 1' },
          { id: 'a-mixed-t2', name: 'Mark making 2' },
          { id: 'a-mixed-t3', name: 'Mark making 3' },
          { id: 'a-mixed-t4', name: 'Paper manipulation technique 1' },
          { id: 'a-mixed-t5', name: 'Paper manipulation technique 2' }
        ] },
        { id: 'a-illus', name: 'Illustration', tasks: [
          { id: 'a-illus-t1', name: 'Illustration 1' },
          { id: 'a-illus-t2', name: 'Illustration 2' },
          { id: 'a-illus-t3', name: 'Illustration 3' },
          { id: 'a-illus-t4', name: 'Design Brief' },
          { id: 'a-illus-t5', name: 'Final' }
        ] }
      ]
    }
  ];

  function clone(v) { return JSON.parse(JSON.stringify(v)); }
  function courseDef(id) { return COURSES.find(function(c) { return c.id === id; }); }

  /** Plain, single-line, length-limited text. Anything that is not text becomes ''. */
  function cleanText(v) {
    if (v === null || v === undefined) return '';
    if (typeof v !== 'string' && typeof v !== 'number') return '';
    return String(v)
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ') // eslint-disable-line no-control-regex
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, MAX_TEXT);
  }

  /** For matching names and headings: ignores case, accents, curly apostrophes and spacing. */
  function norm(s) {
    return cleanText(s)
      .normalize('NFKD').replace(/[̀-ͯ]/g, '')
      .replace(/[‘’ʼ`]/g, "'")
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * One spreadsheet cell -> progress. 'X' means complete; 'X but …' is complete with a note;
   * any other text means in progress, with the text kept as the note. Blank means not started.
   */
  function parseCell(v) {
    var t = cleanText(v);
    if (!t) return null;
    if (/^(x|✓|✔|done|complete|completed)$/i.test(t)) return { s: 'done' };
    var m = /^x[\s,.:;-]+(.+)$/i.exec(t);
    if (m) return { s: 'done', n: m[1].trim() };
    return { s: 'started', n: t };
  }

  function rowIsEmpty(row) {
    return !row || !row.some(function(c) { return cleanText(c) !== ''; });
  }

  /** Strengths / areas for development, from any table in the sheet with those headings. */
  function readPupilComments(rows, out) {
    out = out || {};
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i] || [];
      var sCol = -1, dCol = -1;
      row.forEach(function(c, j) {
        var h = norm(c);
        if (/^strengths?$/.test(h)) sCol = j;
        else if (/^areas? (for|of) development$/.test(h) || /^next steps?$/.test(h)) dCol = j;
      });
      if (sCol < 0 && dCol < 0) continue;
      for (var k = i + 1; k < rows.length; k++) {
        var r = rows[k] || [];
        var name = cleanText(r[0]);
        if (!name || ANY_SECTION.test(name)) break;
        var key = norm(name);
        var cur = out[key] || (out[key] = { strengths: '', development: '' });
        if (sCol >= 0 && !cur.strengths) cur.strengths = cleanText(r[sCol]);
        if (dCol >= 0 && !cur.development) cur.development = cleanText(r[dCol]);
      }
    }
    return out;
  }

  /**
   * rows: one sheet as an array of rows of cell values (SheetJS sheet_to_json with header:1).
   * Finds the row whose column A matches `heading`: that row holds the unit names, the row below
   * the task names, and pupils follow until a blank row or the next "NPA …" heading.
   * Returns null when the sheet has no such heading.
   */
  function parseSection(rows, heading) {
    rows = Array.isArray(rows) ? rows : [];
    var start = -1;
    for (var i = 0; i < rows.length; i++) {
      if (heading.test(cleanText((rows[i] || [])[0]))) { start = i; break; }
    }
    if (start < 0) return null;

    var unitRow = rows[start] || [];
    var taskRow = rows[start + 1] || [];
    var width = Math.max(unitRow.length, taskRow.length);
    var units = [];
    var cur = null;
    for (var c = 1; c < width; c++) {
      var u = cleanText(unitRow[c]).replace(/\s+unit$/i, '');
      if (u) { cur = { name: u, startCol: c, tasks: [] }; units.push(cur); }
      var t = cleanText(taskRow[c]);
      if (cur && t) cur.tasks.push({ name: t, col: c });
    }

    var warnings = [];
    var pupilRows = [];
    for (var r = start + 2; r < rows.length; r++) {
      var row = rows[r] || [];
      var name = cleanText(row[0]);
      if (ANY_SECTION.test(name)) break;
      if (!name) {
        if (rowIsEmpty(row)) break;
        warnings.push('Row ' + (r + 1) + ' has progress but no pupil name, so it was skipped.');
        continue;
      }
      pupilRows.push(row);
    }

    // A unit heading with no task headings beneath it (e.g. one merged cell) is a single task,
    // as long as pupils have something recorded in that column.
    units.forEach(function(unit) {
      if (unit.tasks.length) return;
      var used = pupilRows.some(function(row) { return cleanText(row[unit.startCol]) !== ''; });
      if (used) unit.tasks.push({ name: unit.name, col: unit.startCol });
    });

    var seen = {};
    var pupils = pupilRows.map(function(row) {
      var name = cleanText(row[0]);
      var key = norm(name);
      if (seen[key]) warnings.push(name + ' appears more than once; both rows were kept.');
      seen[key] = true;
      var cells = {};
      units.forEach(function(unit) {
        unit.tasks.forEach(function(task) {
          var p = parseCell(row[task.col]);
          if (p) cells[task.col] = p;
        });
      });
      return { name: name, cells: cells };
    });

    return {
      units: units.map(function(un) { return { name: un.name, tasks: un.tasks }; }),
      pupils: pupils,
      warnings: warnings
    };
  }

  /** The Photography section of a sheet (kept for callers that only want one strand). */
  function parseRows(rows) { return parseSection(rows, courseDef('photo').heading); }

  /**
   * sheets: [{ name, rows }]. Reads every strand's section (the first sheet that has it) plus
   * strengths / areas for development. Returns null when no strand heading is found anywhere.
   * Result: { sections:[{courseId, courseName, sheetName, units, pupils, warnings}], comments, pupilNames }
   */
  function parseWorkbook(sheets) {
    var sections = [];
    COURSES.forEach(function(course) {
      for (var i = 0; i < sheets.length; i++) {
        var sec = parseSection(sheets[i].rows, course.heading);
        if (!sec) continue;
        sec.courseId = course.id;
        sec.courseName = course.name;
        sec.sheetName = sheets[i].name;
        sections.push(sec);
        return;
      }
    });
    if (!sections.length) return null;
    var comments = {};
    sheets.forEach(function(s) { readPupilComments(s.rows || [], comments); });
    // Everyone in any section, in first-seen order.
    var names = [], seen = {};
    sections.forEach(function(sec) {
      sec.pupils.forEach(function(p) {
        var k = norm(p.name);
        if (!seen[k]) { seen[k] = true; names.push(p.name); }
      });
    });
    return { sections: sections, comments: comments, pupilNames: names };
  }

  function ensureShape(S) {
    if (!S.version) S.version = 1;
    if (!Array.isArray(S.courses)) S.courses = [];
    COURSES.forEach(function(def) {
      if (S.courses.some(function(c) { return c.id === def.id; })) return;
      S.courses.push({ id: def.id, name: def.name, units: clone(def.units) });
    });
    S.courses.forEach(function(c) {
      if (!Array.isArray(c.units)) c.units = [];
      c.units.forEach(function(u) { if (!Array.isArray(u.tasks)) u.tasks = []; });
    });
    if (!Array.isArray(S.classes)) S.classes = [];
    S.classes.forEach(function(cl) {
      if (!Array.isArray(cl.pupils)) cl.pupils = [];
      cl.pupils.forEach(function(p) {
        if (!p.work || typeof p.work !== 'object' || Array.isArray(p.work)) p.work = {};
        if (typeof p.strengths !== 'string') p.strengths = '';
        if (typeof p.development !== 'string') p.development = '';
      });
    });
    return S;
  }

  function getCourse(S, id) { return (S.courses || []).find(function(c) { return c.id === id; }) || null; }

  /**
   * Merge a parsed spreadsheet into the tracker (mutates S). Never removes or overwrites anything:
   * units, tasks and pupils are matched by name; only empty cells and empty comments are filled.
   * A pupil who appears in both strands' sections is one pupil.
   * target: { classId } for an existing class, or { className } for a new one.
   */
  function applyImport(S, parsed, target, uid) {
    ensureShape(S);
    var stats = { unitsAdded: 0, tasksAdded: 0, pupilsAdded: 0, pupilsMatched: 0, cellsFilled: 0, cellsKept: 0, commentsFilled: 0, byCourse: {} };

    var cls = target.classId ? S.classes.find(function(c) { return c.id === target.classId; }) : null;
    if (!cls) {
      cls = { id: uid('c'), name: cleanText(target.className) || 'NPA', pupils: [] };
      S.classes.push(cls);
    }

    var counted = {};
    function pupilFor(name) {
      var pupil = cls.pupils.find(function(p) { return norm(p.name) === norm(name); });
      if (!pupil) {
        pupil = { id: uid('p'), name: name, strengths: '', development: '', work: {} };
        cls.pupils.push(pupil);
        stats.pupilsAdded++;
      } else if (!counted[pupil.id]) {
        stats.pupilsMatched++;
      }
      counted[pupil.id] = true;
      return pupil;
    }

    (parsed.pupilNames || []).forEach(function(name) {
      var pupil = pupilFor(name);
      var cm = parsed.comments && parsed.comments[norm(name)];
      if (!cm) return;
      ['strengths', 'development'].forEach(function(k) {
        if (cm[k] && !pupil[k]) { pupil[k] = cm[k]; stats.commentsFilled++; }
      });
    });

    parsed.sections.forEach(function(sec) {
      var course = getCourse(S, sec.courseId);
      var cs = stats.byCourse[sec.courseId] = { cellsFilled: 0 };
      var colToTask = {};
      sec.units.forEach(function(pu) {
        var unit = course.units.find(function(u) { return norm(u.name) === norm(pu.name); });
        if (!unit) {
          unit = { id: uid('u'), name: pu.name, tasks: [] };
          course.units.push(unit);
          stats.unitsAdded++;
        }
        pu.tasks.forEach(function(pt) {
          var task = unit.tasks.find(function(t) { return norm(t.name) === norm(pt.name); });
          if (!task) {
            task = { id: uid('t'), name: pt.name };
            unit.tasks.push(task);
            stats.tasksAdded++;
          }
          colToTask[pt.col] = task.id;
        });
      });
      sec.pupils.forEach(function(pp) {
        var pupil = pupilFor(pp.name);
        Object.keys(pp.cells).forEach(function(col) {
          var taskId = colToTask[col];
          if (!taskId) return;
          if (pupil.work[taskId] && pupil.work[taskId].s) { stats.cellsKept++; return; }
          pupil.work[taskId] = clone(pp.cells[col]);
          stats.cellsFilled++;
          cs.cellsFilled++;
        });
      });
    });

    stats.classId = cls.id;
    return stats;
  }

  /** Every task, or one strand's tasks. */
  function allTasks(S, courseId) {
    var out = [];
    (S.courses || []).forEach(function(c) {
      if (courseId && c.id !== courseId) return;
      c.units.forEach(function(u) { u.tasks.forEach(function(t) { out.push(t); }); });
    });
    return out;
  }

  /** { done, started, total } for one pupil over the given tasks. */
  function pupilProgress(pupil, tasks) {
    var done = 0, started = 0;
    tasks.forEach(function(t) {
      var w = pupil.work && pupil.work[t.id];
      if (w && w.s === 'done') done++;
      else if (w && w.s === 'started') started++;
    });
    return { done: done, started: started, total: tasks.length };
  }

  // ── Off-track dashboard ─────────────────────────────────
  // A pupil is flagged when: a unit's due date has passed and they have tasks left in it;
  // their completion in a strand is BEHIND_POINTS or more below the class median; or they have
  // nothing recorded in a unit that at least MISSING_SHARE of the rest of the class has started.
  // Overdue work, or two or more reasons, is "off track"; one other reason is "watch".
  var BEHIND_POINTS = 25;
  var MISSING_SHARE = 0.5;
  // Spotlight: the off-track pupils furthest behind, by a severity score. Each overdue task not
  // started scores 3 (started: 2), each unit with nothing recorded 4, and each 5 points behind the
  // class median in a flagged strand 1. Off-track pupils scoring SPOTLIGHT_SCORE or more qualify;
  // the worst SPOTLIGHT_MAX are shown.
  var SPOTLIGHT_SCORE = 10;
  var SPOTLIGHT_MAX = 3;
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function isDate(s) { return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s); }
  function shortDate(s) { return Number(s.slice(8, 10)) + ' ' + MONTHS[Number(s.slice(5, 7)) - 1]; }
  function daysBetween(from, to) {
    return Math.round((Date.UTC(+to.slice(0, 4), +to.slice(5, 7) - 1, +to.slice(8, 10)) -
      Date.UTC(+from.slice(0, 4), +from.slice(5, 7) - 1, +from.slice(8, 10))) / 86400000);
  }
  function median(nums) {
    if (!nums.length) return 0;
    var s = nums.slice().sort(function(a, b) { return a - b; });
    var m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }
  function hasAny(pupil, tasks) {
    return tasks.some(function(t) { var w = pupil.work[t.id]; return w && (w.s === 'done' || w.s === 'started'); });
  }
  function shortName(courseId) { var d = courseDef(courseId); return d ? d.short : courseId; }

  /**
   * today: 'YYYY-MM-DD'. Returns { pupils:[{pupil,status,reasons:[{kind,text,courseId,unitId}],strands,score,
   *   overdueTasks,missingUnits,maxGap,catchUp,strandsBehind}], deadlines:[{course,unit,due,days,finished,total}],
   *   medians:{courseId:pct}, spotlight:[worst off-track rows] }, pupils most at risk first.
   */
  function analyse(S, cls, today) {
    ensureShape(S);
    var pupils = (cls && cls.pupils) || [];
    var courses = S.courses;
    var medians = {};
    var pct = {};   // pct[courseId][pupilId]
    courses.forEach(function(c) {
      var tasks = allTasks(S, c.id);
      pct[c.id] = {};
      pupils.forEach(function(p) {
        pct[c.id][p.id] = tasks.length ? Math.round(100 * pupilProgress(p, tasks).done / tasks.length) : 0;
      });
      medians[c.id] = median(pupils.map(function(p) { return pct[c.id][p.id]; }));
    });

    var deadlines = [];
    courses.forEach(function(c) {
      c.units.forEach(function(u) {
        if (!u.tasks.length || !isDate(u.due)) return;
        var finished = pupils.filter(function(p) { return pupilProgress(p, u.tasks).done === u.tasks.length; }).length;
        deadlines.push({ course: c, unit: u, due: u.due, days: daysBetween(today, u.due), finished: finished, total: pupils.length });
      });
    });
    deadlines.sort(function(a, b) { return a.due < b.due ? -1 : a.due > b.due ? 1 : 0; });

    var rows = pupils.map(function(p) {
      var reasons = [];
      var overdue = false;
      var score = 0;
      var overdueTasks = 0, missingUnits = 0, maxGap = 0;
      var catchUp = [];   // tasks to chase first: overdue ones (earliest due first), then units not started
      function addCatchUp(c, u, kind) {
        u.tasks.forEach(function(t) {
          var w = p.work[t.id];
          if (w && w.s === 'done') return;
          catchUp.push({ kind: kind, courseId: c.id, unitId: u.id, taskId: t.id, name: t.name, unitName: u.name,
            due: kind === 'overdue' ? u.due : null, status: (w && w.s) || '', note: (w && w.n) || '' });
        });
      }
      courses.forEach(function(c) {
        c.units.forEach(function(u) {
          if (!u.tasks.length) return;
          var pr = pupilProgress(p, u.tasks);
          var left = u.tasks.length - pr.done;
          if (isDate(u.due) && u.due < today && left > 0) {
            overdue = true;
            overdueTasks += left;
            score += 3 * (left - pr.started) + 2 * pr.started;
            addCatchUp(c, u, 'overdue');
            reasons.push({ kind: 'overdue', courseId: c.id, unitId: u.id,
              text: u.name + ' was due ' + shortDate(u.due) + ': ' + left + ' of ' + u.tasks.length + ' task' + (u.tasks.length === 1 ? '' : 's') + ' not complete' });
            return;
          }
          var others = pupils.filter(function(o) { return o !== p; });
          if (others.length < 2 || hasAny(p, u.tasks)) return;
          var started = others.filter(function(o) { return hasAny(o, u.tasks); }).length;
          if (started / others.length >= MISSING_SHARE) {
            missingUnits++;
            score += 4;
            addCatchUp(c, u, 'missing');
            reasons.push({ kind: 'missing', courseId: c.id, unitId: u.id,
              text: 'Nothing recorded in ' + u.name + ' (' + started + ' of ' + others.length + ' others have started it)' });
          }
        });
        if (pupils.length >= 3 && medians[c.id] > 0 && medians[c.id] - pct[c.id][p.id] >= BEHIND_POINTS) {
          var gap = Math.round(medians[c.id] - pct[c.id][p.id]);
          maxGap = Math.max(maxGap, gap);
          score += Math.floor(gap / 5);
          reasons.push({ kind: 'behind', courseId: c.id,
            text: shortName(c.id) + ': ' + pct[c.id][p.id] + '% complete, class median ' + Math.round(medians[c.id]) + '%' });
        }
      });
      var status = overdue || reasons.length >= 2 ? 'off' : reasons.length ? 'watch' : 'on';
      var strands = {};
      courses.forEach(function(c) { strands[c.id] = pupilProgress(p, allTasks(S, c.id)); });
      catchUp.sort(function(a, b) {
        if (a.kind !== b.kind) return a.kind === 'overdue' ? -1 : 1;
        return a.due && b.due && a.due !== b.due ? (a.due < b.due ? -1 : 1) : 0;
      });
      var strandsBehind = courses.filter(function(c) {
        return reasons.some(function(r) { return r.courseId === c.id; });
      }).map(function(c) { return c.id; });
      return { pupil: p, status: status, reasons: reasons, strands: strands, score: score,
        overdueTasks: overdueTasks, missingUnits: missingUnits, maxGap: maxGap, catchUp: catchUp, strandsBehind: strandsBehind };
    });
    var rank = { off: 0, watch: 1, on: 2 };
    rows.sort(function(a, b) {
      return rank[a.status] - rank[b.status] || b.score - a.score || b.reasons.length - a.reasons.length ||
        a.pupil.name.localeCompare(b.pupil.name);
    });
    var spotlight = rows.filter(function(x) { return x.status === 'off' && x.score >= SPOTLIGHT_SCORE; }).slice(0, SPOTLIGHT_MAX);
    return { pupils: rows, deadlines: deadlines, medians: medians, spotlight: spotlight };
  }

  /**
   * Headline numbers and per-unit progress for the dashboard.
   * Returns { pupils, counts:{off,watch,on}, tasks:{done,started,total}, strands:{courseId:{done,started,total}},
   *   overdueTasks, overduePupils, nextDeadline (from analyse, or null), units:[{course,unit,due,done,started,total,late}] }
   * Task totals count pupil-tasks: 10 pupils x 6 tasks = 60.
   */
  function classMetrics(S, cls, today) {
    var a = analyse(S, cls, today);
    var pupils = (cls && cls.pupils) || [];
    var out = { pupils: pupils.length, counts: { off: 0, watch: 0, on: 0 }, tasks: { done: 0, started: 0, total: 0 },
      strands: {}, overdueTasks: 0, overduePupils: 0, nextDeadline: null, units: [] };
    a.pupils.forEach(function(x) {
      out.counts[x.status]++;
      out.overdueTasks += x.overdueTasks;
      if (x.overdueTasks) out.overduePupils++;
    });
    S.courses.forEach(function(c) {
      var st = out.strands[c.id] = { done: 0, started: 0, total: 0 };
      c.units.forEach(function(u) {
        if (!u.tasks.length) return;
        var row = { course: c, unit: u, due: isDate(u.due) ? u.due : null, done: 0, started: 0, total: u.tasks.length * pupils.length };
        pupils.forEach(function(p) {
          var pr = pupilProgress(p, u.tasks);
          row.done += pr.done;
          row.started += pr.started;
        });
        row.late = !!(row.due && row.due < today && row.done < row.total);
        st.done += row.done; st.started += row.started; st.total += row.total;
        out.units.push(row);
      });
      out.tasks.done += st.done; out.tasks.started += st.started; out.tasks.total += st.total;
    });
    out.nextDeadline = a.deadlines.filter(function(d) { return d.days >= 0; })[0] || null;
    out.analysis = a;
    return out;
  }

  root.NpaTracker = {
    COURSES: COURSES,
    cleanText: cleanText,
    norm: norm,
    parseCell: parseCell,
    parseSection: parseSection,
    parseRows: parseRows,
    parseWorkbook: parseWorkbook,
    ensureShape: ensureShape,
    getCourse: getCourse,
    applyImport: applyImport,
    allTasks: allTasks,
    pupilProgress: pupilProgress,
    analyse: analyse,
    classMetrics: classMetrics,
    shortDate: shortDate,
    isDate: isDate,
    BEHIND_POINTS: BEHIND_POINTS,
    SPOTLIGHT_SCORE: SPOTLIGHT_SCORE
  };
})(typeof window !== 'undefined' ? window : globalThis);
