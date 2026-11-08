/**
 * Faculty tracking export: turns the saved tracker data into clean spreadsheet sheets.
 * No DOM and no network here, so it can be unit tested (tracker-export-core.test.mjs).
 * Loading the data is tracker-export-app.js; writing the Excel file is tracker-export-xlsx.js.
 *
 * buildWorkbook(source, deps) returns { sheets, summary, problems }.
 *
 * Every source also adds lines to the Check sheet, comparing the pupils counted in the saved data
 * with the rows written out, so a gap shows up instead of quietly going missing.
 */
(function(root) {
  'use strict';

  var YEARS = ['s1', 's2', 's3'];
  var PROC = [['creating', 'Creating'], ['presenting', 'Presenting'], ['evaluating', 'Evaluating']];
  var ATTIT = [['effort', 'Effort'], ['behaviour', 'Behaviour'], ['homelearning', 'Home Learning']];
  var TAB = { check: '1E2D4A', drama: '3B82F6', art: 'C2613F', npa: '7C3AED', ci: '0D9488', senior: 'B45309', qs: '4B5563', other: '6B7280' };
  var HIDDEN_KEY = /^(id|version|created_at|updated_at|created_by|updated_by|created_by_user_id|import_batch_id|imported_from_school_tracking)$|_id$/;
  var STATUS_NPA = { done: 'Complete', started: 'In progress' };

  // ── small helpers ──────────────────────────────────────
  function text(v) {
    return v === null || v === undefined ? '' : String(v).trim();
  }

  /** Whole numbers and short decimals become real numbers; longer digit strings (SCNs) stay as text. */
  function value(v) {
    if (v === null || v === undefined) return '';
    if (typeof v === 'number' || typeof v === 'boolean') return v;
    if (typeof v === 'object') return JSON.stringify(v);
    var s = String(v).trim();
    if (/^(0|-?[1-9]\d{0,5})(\.\d{1,3})?$/.test(s)) return Number(s);
    return s;
  }

  function isFilled(v) {
    return v !== null && v !== undefined && String(v).trim() !== '';
  }

  function pupilName(p) {
    if (!p) return '';
    return text(p.name) || [text(p.preferred_name) || text(p.first_name) || text(p.firstName), text(p.surname) || text(p.last_name) || text(p.lastName)].filter(Boolean).join(' ');
  }

  function humanLabel(key) {
    var s = String(key).replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().trim();
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function col(label, opts) {
    var c = { label: label };
    if (opts) Object.keys(opts).forEach(function(k) { c[k] = opts[k]; });
    return c;
  }

  function byText(a, b) {
    return String(a).localeCompare(String(b), 'en-GB', { numeric: true, sensitivity: 'base' });
  }

  function sortRows(rows, count) {
    return rows.sort(function(a, b) {
      for (var i = 0; i < count; i++) {
        var d = byText(a[i], b[i]);
        if (d) return d;
      }
      return 0;
    });
  }

  function byIdMap(list) {
    var map = {};
    (list || []).forEach(function(item) { if (item && item.id != null) map[item.id] = item; });
    return map;
  }

  function firstText(obj, keys) {
    for (var i = 0; i < keys.length; i++) {
      var v = obj && obj[keys[i]];
      if (isFilled(v)) return text(v);
    }
    return '';
  }

  /** Records into a table: lead columns first, then every other field that holds something. */
  function flatten(records, lead, opts) {
    opts = opts || {};
    var hide = opts.hide || {};
    var keys = [];
    var seen = {};
    records.forEach(function(rec) {
      Object.keys(rec || {}).forEach(function(k) {
        if (seen[k] || hide[k] || HIDDEN_KEY.test(k)) return;
        if (isFilled(rec[k]) && !(typeof rec[k] === 'object' && !Object.keys(rec[k]).length)) {
          seen[k] = true;
          keys.push(k);
        }
      });
    });
    var labels = opts.labels || {};
    var columns = lead.map(function(l) { return col(l.label, { wide: l.wide }); }).concat(keys.map(function(k) {
      return col(labels[k] || humanLabel(k), { wide: /note|comment|description|text|body|feedback|reason/i.test(k) });
    }));
    var rows = records.map(function(rec) {
      return lead.map(function(l) { return value(l.get(rec)); }).concat(keys.map(function(k) { return value(rec[k]); }));
    });
    return { columns: columns, rows: rows };
  }

  // ── collecting results ─────────────────────────────────
  function createOut() {
    var out = {
      sheets: [],
      checks: [],
      problems: [],
      addSheet: function(sheet) {
        if (sheet.rows && sheet.rows.length) out.sheets.push(sheet);
      },
      /** expected = pupils or records in the saved data; written = rows that reached the sheet. */
      addCheck: function(source, teacher, group, expected, written, withData) {
        out.checks.push({ source: source, teacher: teacher, group: group, expected: expected, written: written, withData: withData });
        if (expected !== written) {
          out.problems.push(source + (teacher ? ', ' + teacher : '') + (group ? ', ' + group : '') + ': ' + expected + ' in the tracker but ' + written + ' written out.');
        }
      }
    };
    return out;
  }

  // ── BGE trackers (Drama, Art) ──────────────────────────
  function bgeEntries(data, yg) {
    var list = [];
    Object.keys((data.pupils && data.pupils[yg]) || {}).forEach(function(cls) {
      list.push({ cls: cls, status: 'Current', pupils: data.pupils[yg][cls] || [], scores: (data.scores && data.scores[yg]) || {}, profiles: (data.profiles && data.profiles[yg]) || {} });
    });
    Object.keys((data.archived && data.archived[yg]) || {}).forEach(function(cls) {
      var a = data.archived[yg][cls] || {};
      list.push({ cls: cls, status: 'Archived', pupils: a.pupils || [], scores: a.scores || {}, profiles: a.profiles || {} });
    });
    return list;
  }

  function addBgeSheets(out, subject, title, tab, rows, staffName, tps) {
    var history = [];
    YEARS.forEach(function(yg) {
      var yearTps = (tps && tps[yg]) || [];
      var pupilsOut = [];
      var pending = [];
      rows.forEach(function(row) {
        var teacher = staffName(row.user_id);
        bgeEntries(row.data || {}, yg).forEach(function(entry) {
          var withData = 0;
          entry.pupils.forEach(function(p) {
            var sc = entry.scores[p.id] || {};
            var prof = entry.profiles[p.id] || {};
            if (Object.keys(sc).length) withData++;
            pupilsOut.push({ teacher: teacher, cls: entry.cls, status: entry.status, pupil: p, scores: sc, profile: prof });
            var hist = prof.trackingHistory;
            if (hist && typeof hist === 'object') {
              Object.keys(hist).forEach(function(fromYg) {
                history.push({ teacher: teacher, pupil: pupilName(p), fromYg: fromYg, entry: hist[fromYg] || {} });
              });
            }
          });
          pending.push({ teacher: teacher, cls: entry.cls, status: entry.status, expected: entry.pupils.length, withData: withData });
        });
      });
      if (!pupilsOut.length) {
        pending.forEach(function(c) {
          out.addCheck(title + ' ' + yg.toUpperCase(), c.teacher, c.cls + (c.status === 'Archived' ? ' (archived)' : ''), 0, 0, 0);
        });
        return;
      }

      // Only the units and measures that hold something, so empty columns don't clutter the sheet.
      var tpOrder = yearTps.slice();
      var known = {};
      tpOrder.forEach(function(tp) { known[tp.id] = true; });
      pupilsOut.forEach(function(p) {
        Object.keys(p.scores).forEach(function(id) {
          if (!known[id]) {
            known[id] = true;
            tpOrder.push({ id: id, label: String(id).toUpperCase(), unit: '' });
          }
        });
      });
      var columns = [col('Teacher'), col('Class'), col('Pupil'), col('Status')];
      var measures = [];
      var band = 0;
      tpOrder.forEach(function(tp) {
        var dims = PROC.concat(ATTIT);
        var seen = {};
        dims.forEach(function(d) { seen[d[0]] = true; });
        pupilsOut.forEach(function(p) {
          Object.keys(p.scores[tp.id] || {}).forEach(function(k) {
            if (!seen[k] && k !== 'notes') {
              seen[k] = true;
              dims = dims.concat([[k, humanLabel(k)]]);
            }
          });
        });
        dims = dims.concat([['notes', 'Notes']]);
        var used = dims.filter(function(d) {
          return pupilsOut.some(function(p) { return isFilled((p.scores[tp.id] || {})[d[0]]); });
        });
        if (!used.length) return;
        band = band ? 0 : 1;
        var unit = tp.unit ? ' (' + tp.unit + ')' : '';
        used.forEach(function(d) {
          columns.push(col(tp.label + ' ' + d[1] + unit, { band: band, wide: d[0] === 'notes' }));
          measures.push({ tp: tp.id, dim: d[0] });
        });
      });
      var profileCols = [['cfeLevel', 'CfE level'], ['teacherNotes', 'Teacher notes'], ['pupilReflection', 'Pupil reflection'], ['lastUpdated', 'Profile updated']].filter(function(f) {
        return pupilsOut.some(function(p) { return isFilled(p.profile[f[0]]); });
      });
      profileCols.forEach(function(f) { columns.push(col(f[1], { wide: /notes|reflection/i.test(f[0]) })); });

      var body = pupilsOut.map(function(p) {
        var r = [p.teacher, p.cls, pupilName(p.pupil), p.status];
        measures.forEach(function(m) { r.push(value((p.scores[m.tp] || {})[m.dim])); });
        profileCols.forEach(function(f) { r.push(value(p.profile[f[0]])); });
        return r;
      });
      out.addSheet({ name: title + ' ' + yg.toUpperCase(), columns: columns, rows: sortRows(body, 3), freezeCols: 3, tab: tab });
      pending.forEach(function(c) {
        var written = body.filter(function(r) { return r[0] === c.teacher && r[1] === c.cls && r[3] === c.status; }).length;
        // Two rows for one teacher never share a class here, so this count is per class.
        out.addCheck(title + ' ' + yg.toUpperCase(), c.teacher, c.cls + (c.status === 'Archived' ? ' (archived)' : ''), c.expected, written, c.withData);
      });
    });

    if (history.length) {
      var histRows = [];
      history.forEach(function(h) {
        var scores = h.entry.scores || {};
        var tpIds = Object.keys(scores);
        if (!tpIds.length) {
          histRows.push([h.teacher, h.pupil, h.fromYg.toUpperCase(), h.entry.className || '', '', '', '', '', '', '', '', '']);
          return;
        }
        tpIds.forEach(function(id) {
          var s = scores[id] || {};
          var unit = (((tps && tps[h.fromYg]) || []).filter(function(tp) { return tp.id === id; })[0] || {}).unit || '';
          histRows.push([h.teacher, h.pupil, h.fromYg.toUpperCase(), h.entry.className || '', String(id).toUpperCase() + (unit ? ' ' + unit : ''),
            value(s.creating), value(s.presenting), value(s.evaluating), value(s.effort), value(s.behaviour), value(s.homelearning), value(s.notes)]);
        });
      });
      out.addSheet({
        name: title + ' earlier years',
        columns: [col('Teacher now'), col('Pupil'), col('From year'), col('Class then'), col('Unit'), col('Creating'), col('Presenting'), col('Evaluating'), col('Effort'), col('Behaviour'), col('Home Learning'), col('Notes', { wide: true })],
        rows: sortRows(histRows, 3), freezeCols: 2, tab: tab
      });
    }
  }

  // ── NPA tracker (Photography, Art & Design strands) ────
  function addNpaSheets(out, rows, staffName) {
    var courses = {};
    var courseOrder = [];
    var taskCourse = {};
    rows.forEach(function(row) {
      ((row.data && row.data.courses) || []).forEach(function(course) {
        if (!courses[course.id]) {
          courses[course.id] = { id: course.id, name: course.name || humanLabel(course.id), tasks: [], seen: {} };
          courseOrder.push(course.id);
        }
        (course.units || []).forEach(function(unit) {
          (unit.tasks || []).forEach(function(task) {
            taskCourse[task.id] = course.id;
            if (!courses[course.id].seen[task.id]) {
              courses[course.id].seen[task.id] = true;
              courses[course.id].tasks.push({ id: task.id, label: (unit.name && unit.name !== task.name ? unit.name + ': ' : '') + task.name });
            }
          });
        });
      });
    });

    var pupils = [];
    var npaChecks = [];
    var firstTabRows = [];
    var unknownTasks = 0;
    rows.forEach(function(row) {
      var teacher = staffName(row.user_id);
      ((row.data && row.data.classes) || []).forEach(function(cls) {
        var list = cls.pupils || [];
        var withData = 0;
        list.forEach(function(p) {
          var work = p.work || {};
          if (Object.keys(work).length) withData++;
          Object.keys(work).forEach(function(id) { if (!taskCourse[id]) unknownTasks++; });
          pupils.push({ teacher: teacher, cls: cls.name || '', pupil: p, work: work });
        });
        npaChecks.push({ teacher: teacher, cls: cls.name || '', expected: list.length, withData: withData });
      });
    });
    if (unknownTasks) out.problems.push('NPA: ' + unknownTasks + ' task entries belong to tasks that are no longer on the course, so they are not shown.');

    courseOrder.forEach(function(id) {
      var course = courses[id];
      var tasks = course.tasks.filter(function(task) {
        return pupils.some(function(p) { return p.work[task.id] && (p.work[task.id].s || p.work[task.id].n); });
      });
      var body = pupils.map(function(p) {
        var notes = [];
        var r = [p.teacher, p.cls, pupilName(p.pupil)];
        tasks.forEach(function(task) {
          var w = p.work[task.id] || {};
          r.push(STATUS_NPA[w.s] || (w.s ? value(w.s) : ''));
          if (isFilled(w.n)) notes.push(task.label + ': ' + text(w.n));
        });
        r.push(notes.join('\n'), value(p.pupil.strengths), value(p.pupil.development));
        return r;
      });
      out.addSheet({
        name: course.name,
        columns: [col('Teacher'), col('Class'), col('Pupil')]
          .concat(tasks.map(function(task) { return col(task.label); }))
          .concat([col('Task notes', { wide: true }), col('Strengths', { wide: true }), col('Areas for development', { wide: true })]),
        rows: sortRows(body, 3), freezeCols: 3, tab: TAB.npa
      });
      if (!firstTabRows.length) firstTabRows = body;
    });
    // Every class appears on each strand's tab, so one tab is enough to count from.
    npaChecks.forEach(function(c) {
      var written = firstTabRows.filter(function(r) { return r[0] === c.teacher && r[1] === c.cls; }).length;
      out.addCheck('NPA', c.teacher, c.cls, c.expected, written, c.withData);
    });
  }

  // ── Creative Industries assessment ─────────────────────
  function addCiSheets(out, ci, deps) {
    if (!ci || !(ci.pupils || []).length) return;
    var unitsApi = deps.units;
    var core = deps.ciCore;
    var variantByYear = {};
    (ci.settings || []).forEach(function(s) { variantByYear[s.school_year] = s.intro_variant; });
    var marksByPupil = {};
    (ci.marks || []).forEach(function(m) { (marksByPupil[m.pupil_id] = marksByPupil[m.pupil_id] || []).push(m); });
    var order = unitsApi.ORDER;
    var pupilById = byIdMap(ci.pupils);
    var summaryRows = [];
    var markRows = [];
    var writtenByGroup = {};
    var withByGroup = {};

    ci.pupils.forEach(function(p) {
      var units = unitsApi.forVariant(variantByYear[p.school_year] || 'UK');
      var marks = marksByPupil[p.id] || [];
      var pp = core.pupilProgress(units, order, core.indexMarks(marks), p.id);
      var row = [p.school_year, value(p.class_code), p.name, value(p.team), pp.met, pp.total];
      order.forEach(function(id) {
        var u = pp.units[id];
        row.push(u.achieved + '/' + u.total, u.checks + '/' + u.checkTotal, u.signed ? 'Pass' : u.ready ? 'Ready to sign off' : 'Working towards');
      });
      row.push(pp.coursePassed ? 'Pass' : 'Working towards', value(p.notes));
      summaryRows.push(row);
      var group = p.school_year + ' ' + (p.class_code || '');
      writtenByGroup[group] = (writtenByGroup[group] || 0) + 1;
      withByGroup[group] = (withByGroup[group] || 0) + (marks.length ? 1 : 0);

      var kinds = {};
      order.forEach(function(id) {
        var u = units[id];
        u.criteria.forEach(function(c) { kinds[c.code] = { unit: u, type: 'Criterion ' + c.label, wording: c.text }; });
        u.checkpoints.forEach(function(c) { kinds[c.code] = { unit: u, type: 'Evidence checkpoint', wording: c.text }; });
        kinds[id + '.signoff'] = { unit: u, type: 'Unit sign-off', wording: '' };
      });
      marks.forEach(function(m) {
        var k = kinds[m.code] || { unit: { name: '', code: '' }, type: m.code, wording: '' };
        var status = (core.STATUS && core.STATUS[m.status] && core.STATUS[m.status].label) || m.status;
        if (m.kind === 'check') status = m.status === 'm' ? 'Verified' : 'Outstanding';
        if (m.kind === 'signoff') status = m.status === 'm' ? 'Signed off' : 'Not signed off';
        markRows.push([p.school_year, value(p.class_code), p.name, k.unit.name, k.unit.code, k.type, k.wording, status,
          value(m.evidence_type), value(m.evidence_ref), value(m.note), value(m.assessed_on), value(m.signed_by), value(m.updated_by_name), value(m.updated_at)]);
      });
    });

    Object.keys(writtenByGroup).sort(byText).forEach(function(group) {
      var written = summaryRows.filter(function(r) { return r[0] + ' ' + r[1] === group; }).length;
      out.addCheck('Creative Industries', '', group, writtenByGroup[group], written, withByGroup[group]);
    });
    var orphanMarks = (ci.marks || []).filter(function(m) { return !pupilById[m.pupil_id]; }).length;
    if (orphanMarks) out.problems.push('Creative Industries: ' + orphanMarks + ' decisions belong to pupils who are no longer listed.');

    var head = [col('Session'), col('Class'), col('Pupil'), col('Team'), col('Criteria achieved'), col('Criteria total')];
    var firstUnits = unitsApi.forVariant('UK');
    order.forEach(function(id, i) {
      var s = firstUnits[id].short;
      var band = i % 2 ? 0 : 1;
      head.push(col(s + ' criteria', { band: band }), col(s + ' checkpoints', { band: band }), col(s + ' decision', { band: band }));
    });
    head.push(col('Course result'), col('Pupil notes', { wide: true }));
    out.addSheet({ name: 'Creative Industries', columns: head, rows: sortRows(summaryRows, 3), freezeCols: 3, tab: TAB.ci });
    out.addSheet({
      name: 'CI evidence',
      columns: [col('Session'), col('Class'), col('Pupil'), col('Unit'), col('Unit code'), col('Item'), col('Wording', { wide: true }), col('Decision'), col('Evidence type'), col('Evidence location', { wide: true }), col('Assessor comment', { wide: true }), col('Assessed on'), col('Signed by'), col('Recorded by'), col('Recorded at')],
      rows: sortRows(markRows, 3), freezeCols: 3, tab: TAB.ci
    });
    if ((ci.followups || []).length) {
      var followRows = ci.followups.map(function(f) {
        return [f.school_year, (pupilById[f.pupil_id] || {}).name || 'Whole class', value(f.title), value(f.note), value(f.due_on), f.done_at ? 'Done' : 'Open', value(f.created_by_name)];
      });
      out.addSheet({
        name: 'CI follow-ups',
        columns: [col('Session'), col('Pupil'), col('Follow-up'), col('Note', { wide: true }), col('Due'), col('Status'), col('Added by')],
        rows: sortRows(followRows, 2), freezeCols: 2, tab: TAB.ci
      });
    }
  }

  // ── Senior Phase ───────────────────────────────────────
  var SP_HEADERS = { Att: 'Attendance %', WG: 'Attendance score', Eff: 'Effort', Beh: 'Behaviour', Gr: 'Grade', Mark: 'Mark', HL: 'Home learning', Prog: 'Progress' };

  /** The Senior Phase sheet has two header rows; a filterable spreadsheet needs one. */
  function flattenTwoRowHeader(aoa) {
    var top = aoa[0] || [];
    var sub = aoa[1] || [];
    var group = '';
    var band = 0;
    var columns = top.map(function(t, i) {
      if (t) {
        group = t;
        if (sub[i]) band = band ? 0 : 1;
      }
      if (!sub[i]) return col(top[i] || group);
      return col(group + ' ' + (SP_HEADERS[sub[i]] || sub[i]), { band: band });
    });
    var rows = aoa.slice(2).map(function(r) { return r.map(value); });
    return { columns: columns, rows: rows };
  }

  function keepUsedColumns(table, always) {
    var keep = table.columns.map(function(_c, i) {
      return i < always || table.rows.some(function(r) { return isFilled(r[i]); });
    });
    return {
      columns: table.columns.filter(function(_c, i) { return keep[i]; }),
      rows: table.rows.map(function(r) { return r.filter(function(_v, i) { return keep[i]; }); })
    };
  }

  function addSeniorSheets(out, db, deps) {
    if (!db || !(db.enrolments || []).length) return;
    var built = deps.senior.buildTables(db);
    var active = (db.enrolments || []).filter(function(en) { return en && en.active_status !== false; });
    var inactive = (db.enrolments || []).filter(function(en) { return en && en.active_status === false; });

    var main = keepUsedColumns(flattenTwoRowHeader(built.tracking), 6);
    out.addSheet({ name: 'Senior Phase', columns: main.columns, rows: main.rows, freezeCols: 1, tab: TAB.senior });
    out.addCheck('Senior Phase', '', 'Current courses', active.length, main.rows.length, (db.pupil_tracking_data || []).length ? new Set(db.pupil_tracking_data.map(function(t) { return t.enrolment_id; })).size : 0);
    if (inactive.length) {
      var old = keepUsedColumns(flattenTwoRowHeader(built.inactive), 6);
      out.addSheet({ name: 'SP left course', columns: old.columns, rows: old.rows, freezeCols: 1, tab: TAB.senior });
      out.addCheck('Senior Phase', '', 'Left course', inactive.length, old.rows.length, '');
    }
    if (built.pupils.length > 1) {
      out.addSheet({
        name: 'SP pupils',
        columns: built.pupils[0].map(function(l) { return col(l); }),
        rows: built.pupils.slice(1).map(function(r) { return r.map(function(v) { return typeof v === 'number' ? v : text(v); }); }),
        freezeCols: 2, tab: TAB.senior
      });
    }

    var pupils = byIdMap(db.pupils);
    var enrols = byIdMap(db.enrolments);
    var courses = byIdMap(db.courses);
    var classes = byIdMap(db.classes);
    var names = {
      tracking_point_id: { map: byIdMap(db.school_tracking_points), label: 'Tracking point', keys: ['tracking_point_name', 'name'] },
      assessment_point_id: { map: byIdMap(db.assessment_points), label: 'Assessment', keys: ['assessment_name', 'name'] },
      component_id: { map: byIdMap(db.prelim_components), label: 'Component', keys: ['component_name', 'short_label'] },
      prelim_component_id: { map: byIdMap(db.prelim_components), label: 'Component', keys: ['component_name', 'short_label'] },
      intervention_id: { map: byIdMap(db.interventions), label: 'Intervention', keys: ['intervention_description', 'description'] }
    };

    function recordPupil(rec) {
      var en = enrols[rec.enrolment_id] || {};
      return pupils[rec.pupil_id || en.pupil_id];
    }
    function recordEnrolment(rec) {
      return enrols[rec.enrolment_id] || {};
    }

    [
      ['SP tracking detail', 'pupil_tracking_data'],
      ['SP attendance', 'attendance_records'],
      ['SP concerns', 'teacher_concerns'],
      ['SP concern feedback', 'concern_feedback'],
      ['SP interventions', 'interventions'],
      ['SP intervention notes', 'intervention_trail'],
      ['SP level changes', 'level_changes'],
      ['SP evidence', 'evidence_bank'],
      ['SP assessment results', 'pupil_assessment_results'],
      ['SP prelim marks', 'prelim_marks'],
      ['SP baselines', 'enrolment_baselines'],
      ['SP prior attainment', 'prior_attainment']
    ].forEach(function(spec) {
      var list = (db[spec[1]] || []).filter(Boolean);
      if (!list.length) return;
      var lead = [
        { label: 'Pupil', get: function(r) { return pupilName(recordPupil(r)); } },
        { label: 'Class', get: function(r) { return (classes[recordEnrolment(r).class_id] || {}).class_name || ''; } },
        { label: 'Course', get: function(r) { return (courses[recordEnrolment(r).course_id] || {}).course_name || ''; } }
      ];
      Object.keys(names).forEach(function(key) {
        if (!list.some(function(r) { return isFilled(r[key]); })) return;
        var n = names[key];
        lead.push({ label: n.label, get: function(r) { return firstText(n.map[r[key]], n.keys); } });
      });
      var table = flatten(list, lead);
      out.addSheet({ name: spec[0], columns: table.columns, rows: sortRows(table.rows, 2), freezeCols: 1, tab: TAB.senior });
    });

    return { pupils: pupils, enrols: enrols, classes: classes, pupilName: recordPupil };
  }

  // ── Attainment review meetings ─────────────────────────
  function addMeetingSheets(out, meetings, seniorDb) {
    if (!meetings) return;
    var db = seniorDb || {};
    var pupils = byIdMap(db.pupils);
    var enrols = byIdMap(db.enrolments);
    var classes = byIdMap(db.classes);
    var cycles = byIdMap(meetings.cycles);
    var reviews = byIdMap(meetings.classReviews);
    function cycleOf(r) { return cycles[(reviews[r.class_review_id] || r).review_cycle_id] || {}; }
    function who(r) { return pupilName(pupils[r.pupil_id || (enrols[r.enrolment_id] || {}).pupil_id]); }
    function className(id) { return (classes[id] || {}).class_name || ''; }
    var meetingLead = { label: 'Review', get: function(r) { return cycleOf(r).title || ''; } };
    var yearLead = { label: 'Year', get: function(r) { return cycleOf(r).year_group || ''; } };

    var classNotes = (meetings.classReviews || []).filter(function(r) { return isFilled(r.meeting_notes) || isFilled(r.completed_at); });
    if (classNotes.length) {
      var t1 = flatten(classNotes, [meetingLead, yearLead, { label: 'Class', get: function(r) { return className(r.class_id); } }]);
      out.addSheet({ name: 'Attainment class reviews', columns: t1.columns, rows: sortRows(t1.rows, 3), tab: TAB.senior });
    }
    if ((meetings.pupilReviews || []).length) {
      var t2 = flatten(meetings.pupilReviews, [meetingLead, yearLead,
        { label: 'Class', get: function(r) { return className((reviews[r.class_review_id] || {}).class_id); } },
        { label: 'Pupil', get: who }]);
      out.addSheet({ name: 'Attainment pupil reviews', columns: t2.columns, rows: sortRows(t2.rows, 4), freezeCols: 4, tab: TAB.senior });
      out.addCheck('Attainment reviews', '', 'Pupil reviews', meetings.pupilReviews.length, t2.rows.length, '');
    }
    if ((meetings.actions || []).length) {
      var t3 = flatten(meetings.actions, [meetingLead, yearLead, { label: 'Pupil', get: who }]);
      out.addSheet({ name: 'Attainment actions', columns: t3.columns, rows: sortRows(t3.rows, 3), tab: TAB.senior });
    }
  }

  // ── QS attainment ──────────────────────────────────────
  var QS_LABELS = {
    scn: 'SCN', fore: 'Forename', sur: 'Surname', cem: 'CEM', pred: 'Predicted', est: 'Estimate',
    gradeRaw: 'Grade', decile: 'SIMD decile', quintile: 'SIMD quintile', asn: 'ASN',
    c1: 'Component 1 mark', c2: 'Component 2 mark', c3: 'Component 3 mark',
    n1: 'Component 1 national', n2: 'Component 2 national', n3: 'Component 3 national'
  };

  function addQsSheets(out, snapshots) {
    var rows = [];
    var comps = [];
    var counts = [];
    (snapshots || []).forEach(function(snap) {
      var d = snap.data || {};
      var list = d.rows || [];
      var session = d.session || snap.session_label || snap.school_year;
      list.forEach(function(r) { rows.push(Object.assign({}, r, { session: session })); });
      (d.comps || []).forEach(function(c) {
        if (c && typeof c === 'object') comps.push(Object.assign({}, c, { session: session }));
      });
      counts.push({ session: session, expected: list.length });
    });
    if (rows.length) {
      var lead = [
        { label: 'Session', get: function(r) { return r.session; } },
        { label: 'Subject', get: function(r) { return r.subject; } },
        { label: 'Pupil', get: function(r) { return pupilName(r) || [text(r.fore), text(r.sur)].filter(Boolean).join(' '); } }
      ];
      var t = flatten(rows, lead, { labels: QS_LABELS, hide: { session: 1, subject: 1, name: 1, fore: 1, sur: 1 } });
      out.addSheet({ name: 'QS Attainment', columns: t.columns, rows: sortRows(t.rows, 3), freezeCols: 3, tab: TAB.qs });
      counts.forEach(function(c) {
        var written = t.rows.filter(function(r) { return String(r[0]) === String(c.session); }).length;
        out.addCheck('QS Attainment', '', c.session, c.expected, written, '');
      });
    }
    if (comps.length) {
      var t2 = flatten(comps, [{ label: 'Session', get: function(r) { return r.session; } }], { labels: QS_LABELS, hide: { session: 1 } });
      out.addSheet({ name: 'QS components', columns: t2.columns, rows: sortRows(t2.rows, 1), tab: TAB.qs });
    }
  }

  // ── Report Builder ─────────────────────────────────────
  function addReportSheet(out, reportRows, staffName) {
    var rows = [];
    reportRows.forEach(function(row) {
      var subject = row.data_type === 'bge_art_reports_v1' ? 'Art & Design' : 'Drama';
      var pupils = (row.data && row.data.pupils) || [];
      var teacher = staffName(row.user_id);
      pupils.forEach(function(p) {
        var sel = p.selections || {};
        function pick(k) {
          return (sel[k] || []).map(function(item) {
            return typeof item === 'object' && item ? (item.code || item.id || JSON.stringify(item)) : item;
          }).join(', ');
        }
        rows.push([teacher, subject, value(p.year), value(p.className), pupilName(p), value(p.cfeLevel), value(p.trackStatus),
          p.isEal ? 'Yes' : '', value(p.s4Destination), p.recommend ? 'Yes' : '', p.confirmed ? 'Yes' : '',
          value(p.additionalComments), pick('strengths'), pick('aod'), pick('next_steps'), pick('attitude'), pick('closing')]);
      });
      var written = rows.filter(function(r) { return r[0] === teacher && r[1] === subject; }).length;
      out.addCheck('Report Builder ' + subject, teacher, '', pupils.length, written, pupils.filter(function(p) { return p.confirmed; }).length);
    });
    out.addSheet({
      name: 'Report Builder',
      columns: [col('Teacher'), col('Subject'), col('Year'), col('Class'), col('Pupil'), col('CfE level'), col('Track status'), col('EAL'), col('S4 destination'), col('Recommended'), col('Confirmed'), col('Additional comments', { wide: true }), col('Strengths codes'), col('Areas for development codes'), col('Next steps codes'), col('Attitude codes'), col('Closing codes')],
      rows: sortRows(rows, 5), freezeCols: 5, tab: TAB.other
    });
  }

  // ── Class lists and tracking hub notes ─────────────────
  function addRosterSheet(out, roster, staffName) {
    if (!roster || !(roster.classes || []).length) return;
    var years = byIdMap(roster.years);
    var pupils = byIdMap(roster.pupils);
    var classes = byIdMap(roster.classes);
    var teachers = {};
    (roster.assignments || []).forEach(function(a) {
      (teachers[a.class_id] = teachers[a.class_id] || []).push(staffName(a.teacher_id));
    });
    var rows = [];
    (roster.enrollments || []).forEach(function(en) {
      var cls = classes[en.class_id] || {};
      var p = pupils[en.pupil_id] || {};
      rows.push([(years[cls.academic_year_id] || {}).label || '', value(cls.subject), value(cls.year_level_id), value(cls.class_code), value(cls.class_name),
        (teachers[en.class_id] || []).join(', '), pupilName(p) || text(p.preferred_name), value(p.external_id)]);
    });
    out.addCheck('Class lists', '', '', (roster.enrollments || []).length, rows.length, '');
    out.addSheet({
      name: 'Class lists',
      columns: [col('Session'), col('Subject'), col('Year'), col('Class code'), col('Class name'), col('Teacher'), col('Pupil'), col('Pupil ID')],
      rows: sortRows(rows, 7), freezeCols: 0, tab: TAB.other
    });
  }

  function addNotesSheet(out, notes) {
    if (!(notes || []).length) return;
    var rows = notes.map(function(n) {
      return [value(n.subject), value(n.pupil_key), n.is_flag ? 'Concern flag' : 'Note', n.resolved ? 'Yes' : 'No', value(n.body), value(n.author_email), value(n.created_at)];
    });
    out.addCheck('Tracking hub notes', '', '', notes.length, rows.length, '');
    out.addSheet({
      name: 'Tracking hub notes',
      columns: [col('Subject'), col('Pupil reference'), col('Type'), col('Resolved'), col('Note', { wide: true }), col('Written by'), col('Written at')],
      rows: sortRows(rows, 2), tab: TAB.other
    });
  }

  // ── Read me and Check ──────────────────────────────────
  function checkSheet(out, source) {
    var rows = [];
    Object.keys(source.errors || {}).forEach(function(name) {
      rows.push([{ v: name, s: 'bad' }, '', '', '', '', '', { v: 'COULD NOT READ: ' + source.errors[name], s: 'bad' }]);
    });
    out.checks.slice().sort(function(a, b) {
      return byText(a.source, b.source) || byText(a.teacher, b.teacher) || byText(a.group, b.group);
    }).forEach(function(c) {
      var ok = c.expected === c.written;
      rows.push([c.source, c.teacher, c.group, c.expected, c.written, c.withData === '' ? '' : c.withData, ok ? { v: 'OK', s: 'ok' } : { v: 'DIFFERENT', s: 'bad' }]);
    });
    return {
      name: 'Check',
      columns: [col('Tracker'), col('Teacher'), col('Class or group'), col('Pupils or records saved'), col('Rows exported'), col('Pupils with tracking entered'), col('Result', { wide: true })],
      rows: rows, tab: TAB.check
    };
  }

  function readMeSheet(out, source, when) {
    var when2 = when.toLocaleString ? when.toLocaleString('en-GB', { dateStyle: 'long', timeStyle: 'short' }) : String(when);
    var problems = out.problems.concat(Object.keys(source.errors || {}).map(function(name) {
      return name + ' could not be read, so it is missing from this file.';
    }));
    var rows = [
      [{ v: 'Faculty tracking export', s: 'title' }, ''],
      ['Created', when2],
      ['Created by', source.exportedBy || ''],
      ['', ''],
      [{ v: 'Contains named pupil data. Keep this file in approved school storage only. Do not save it to a personal device, USB stick or personal email.', s: 'warn' }, ''],
      ['', '']
    ];
    if (problems.length) {
      rows.push([{ v: 'Check these before relying on this file', s: 'bad' }, '']);
      problems.forEach(function(p) { rows.push([{ v: p, s: 'bad' }, '']); });
      rows.push(['', '']);
    } else {
      rows.push([{ v: 'Every pupil counted in the saved data reached this file. See the Check tab.', s: 'ok' }, ''], ['', '']);
    }
    rows.push([{ v: 'Tabs in this file', s: 'bold' }, { v: 'Rows', s: 'bold' }]);
    out.sheets.forEach(function(s) { rows.push([s.name, s.rows.length]); });
    rows.push(['', ''], [{ v: 'Good to know', s: 'bold' }, '']);
    [
      'This is a copy from the moment it was created. Changes made here do not go back to the Hub.',
      'Unit and measure columns only appear when at least one pupil has an entry in them.',
      'Report Builder comments appear as their comment codes, plus any additional comments in full.',
      'Not included: lesson planners, class visit records, triangulation evidence, staff chat, classroom toolkit game responses and anything only saved on one device that has not synced.'
    ].forEach(function(line) { rows.push([{ v: line, s: 'plain' }, '']); });
    return {
      name: 'Read me',
      headerless: true,
      columns: [col('', { width: 95, wide: true }), col('', { width: 12 })],
      rows: rows, tab: TAB.check
    };
  }

  // ── the whole workbook ─────────────────────────────────
  function buildWorkbook(source, deps) {
    var out = createOut();
    var staff = source.staff || {};
    function staffName(id) {
      return (staff[id] && (staff[id].name || staff[id].email)) || 'Unknown teacher';
    }
    var rows = source.rows || [];
    function ofType(type) {
      return rows.filter(function(r) { return r.data_type === type; });
    }
    var tps = deps.tps || {};
    addBgeSheets(out, 'drama', 'Drama', TAB.drama, ofType('drama-v3'), staffName, tps.drama);
    addBgeSheets(out, 'art', 'Art', TAB.art, ofType('art-v2'), staffName, tps.art);
    addNpaSheets(out, ofType('npa-v1'), staffName);
    addCiSheets(out, source.ci, deps);
    addSeniorSheets(out, source.senior, deps);
    addMeetingSheets(out, source.meetings, source.senior);
    addQsSheets(out, source.qs);
    addReportSheet(out, ofType('bge_drama_reports_v1').concat(ofType('bge_art_reports_v1')), staffName);
    addRosterSheet(out, source.roster, staffName);
    addNotesSheet(out, source.notes);

    var check = checkSheet(out, source);
    var when = source.when || new Date();
    var readMe = readMeSheet(out, source, when);
    var problems = out.problems.slice();
    Object.keys(source.errors || {}).forEach(function(name) {
      problems.push(name + ' could not be read: ' + source.errors[name]);
    });

    // Totals for the page, one line per tracker.
    var bySource = {};
    out.checks.forEach(function(c) {
      var key = c.source.replace(/ S[123]$/, '');
      var s = bySource[key] = bySource[key] || { source: key, records: 0, teachers: {} };
      s.records += c.written;
      if (c.teacher) s.teachers[c.teacher] = true;
    });
    var teacherNames = {};
    rows.forEach(function(r) { teacherNames[staffName(r.user_id)] = true; });
    return {
      sheets: [readMe, check].concat(out.sheets),
      problems: problems,
      summary: {
        lines: Object.keys(bySource).sort(byText).map(function(k) {
          return { source: k, records: bySource[k].records, teachers: Object.keys(bySource[k].teachers).length };
        }),
        teachers: Object.keys(teacherNames).sort(byText),
        tabs: out.sheets.length
      }
    };
  }

  /** Rows as they come from the database, into the shape buildWorkbook reads. */
  function assembleSource(tables, errors, exportedBy, when) {
    var staff = {};
    (tables.profiles || []).forEach(function(p) {
      staff[p.id] = { name: text(p.display_name) || text(p.email), email: text(p.email) };
    });
    var workbook = (tables.senior_phase_workbook || [])[0];
    return {
      staff: staff,
      rows: tables.pupil_data || [],
      ci: { settings: tables.ci_assess_settings, pupils: tables.ci_assess_pupils, marks: tables.ci_assess_marks, followups: tables.ci_assess_followups },
      senior: workbook ? workbook.data : null,
      meetings: {
        cycles: tables.spt_attainment_review_cycles,
        classReviews: tables.spt_attainment_class_reviews,
        pupilReviews: tables.spt_attainment_pupil_reviews,
        actions: tables.spt_attainment_actions
      },
      qs: tables.qs_attainment_snapshots,
      roster: {
        years: tables.academic_years,
        classes: tables.classes,
        pupils: tables.pupils,
        enrollments: tables.class_enrollments,
        assignments: tables.class_teacher_assignments
      },
      notes: tables.tracking_hub_annotations,
      errors: errors || {},
      exportedBy: exportedBy || '',
      when: when
    };
  }

  root.TrackerExportCore = { buildWorkbook: buildWorkbook, assembleSource: assembleSource, value: value, flattenTwoRowHeader: flattenTwoRowHeader };
})(typeof window !== 'undefined' ? window : globalThis);
