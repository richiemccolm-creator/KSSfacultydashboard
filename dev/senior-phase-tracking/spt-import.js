/**
 * Whole-school tracking import (CSV) — dev preview only.
 */
(function(global) {
  'use strict';

  var FIELD_ALIASES = {
    first_name: ['first name', 'firstname', 'forename', 'pupil first name'],
    surname: ['surname', 'last name', 'lastname', 'pupil surname'],
    year_group: ['year group', 'year', 'stage', 'yeargroup'],
    candidate_number: ['candidate number', 'candidate no', 'scn', 'candidate_number', 'cand no'],
    course: ['course', 'subject', 'class course', 'qualification'],
    class_group: ['class', 'class group', 'class name', 'reg class'],
    teacher: ['teacher', 'class teacher', 'teacher name'],
    target_grade: ['target grade', 'target', 'tgt grade', 'target_grade'],
    working_grade: ['working grade', 'working', 'current grade', 'working_grade', 'attainment'],
    tracking_point: ['tracking point', 'tp', 'tracking point name', 'period'],
    effort: ['effort'],
    behaviour: ['behaviour', 'behavior'],
    homework: ['homework', 'home learning', 'homelearning'],
    concern_level: ['concern', 'concern level', 'concern_level'],
    comment: ['comment', 'teacher comment', 'notes', 'remarks']
  };

  function normHeader(h) {
    return String(h || '').trim().toLowerCase().replace(/\s+/g, ' ');
  }

  function parseCsvText(text) {
    var lines = String(text || '').split(/\r?\n/).filter(function(l) { return l.trim(); });
    if (!lines.length) return { headers: [], rows: [] };
    function splitLine(line) {
      var out = [];
      var cur = '';
      var inQ = false;
      for (var i = 0; i < line.length; i++) {
        var ch = line[i];
        if (ch === '"') { inQ = !inQ; continue; }
        if (ch === ',' && !inQ) { out.push(cur.trim()); cur = ''; continue; }
        cur += ch;
      }
      out.push(cur.trim());
      return out;
    }
    var headers = splitLine(lines[0]).map(normHeader);
    var rows = lines.slice(1).map(function(line) {
      var cells = splitLine(line);
      var obj = {};
      headers.forEach(function(h, i) { obj[h] = cells[i] != null ? cells[i] : ''; });
      return obj;
    });
    return { headers: headers, rows: rows };
  }

  function mapColumns(headers) {
    var mapping = {};
    Object.keys(FIELD_ALIASES).forEach(function(field) {
      var found = headers.find(function(h) {
        return FIELD_ALIASES[field].some(function(alias) { return normHeader(alias) === h || h.indexOf(alias) >= 0; });
      });
      if (found) mapping[field] = found;
    });
    return mapping;
  }

  function rowValue(row, mapping, field) {
    var col = mapping[field];
    return col ? String(row[col] || '').trim() : '';
  }

  function matchEnrolment(db, mapped) {
    var pupil = null;
    if (mapped.candidate_number) {
      pupil = (db.pupils || []).find(function(p) { return p.candidate_number === mapped.candidate_number; });
    }
    if (!pupil && mapped.first_name && mapped.surname) {
      var fn = mapped.first_name.toLowerCase();
      var sn = mapped.surname.toLowerCase();
      pupil = (db.pupils || []).find(function(p) {
        return p.first_name.toLowerCase() === fn && p.surname.toLowerCase() === sn &&
          (!mapped.year_group || p.year_group === mapped.year_group);
      });
    }
    if (!pupil) return { status: 'unmatched', pupil: null, enrolment: null, duplicates: [] };

    var courseName = mapped.course || '';
    var enrolments = (db.enrolments || []).filter(function(e) { return e.pupil_id === pupil.id && e.active_status !== false; });
    var matches = enrolments.filter(function(e) {
      var c = global.SptStore.byId(db.courses, e.course_id);
      if (!c) return false;
      return c.course_name.toLowerCase() === courseName.toLowerCase() ||
        c.course_name.toLowerCase().indexOf(courseName.toLowerCase()) >= 0 ||
        courseName.toLowerCase().indexOf(c.course_name.toLowerCase()) >= 0;
    });
    if (matches.length === 0) return { status: 'unmatched', pupil: pupil, enrolment: null, duplicates: [] };
    if (matches.length > 1) return { status: 'duplicate', pupil: pupil, enrolment: null, duplicates: matches };
    return { status: 'matched', pupil: pupil, enrolment: matches[0], duplicates: [] };
  }

  function buildPreview(db, rows, mapping) {
    return rows.map(function(row, i) {
      var mapped = {
        first_name: rowValue(row, mapping, 'first_name'),
        surname: rowValue(row, mapping, 'surname'),
        year_group: rowValue(row, mapping, 'year_group'),
        candidate_number: rowValue(row, mapping, 'candidate_number'),
        course: rowValue(row, mapping, 'course'),
        class_group: rowValue(row, mapping, 'class_group'),
        teacher: rowValue(row, mapping, 'teacher'),
        target_grade: rowValue(row, mapping, 'target_grade'),
        working_grade: rowValue(row, mapping, 'working_grade'),
        tracking_point: rowValue(row, mapping, 'tracking_point'),
        effort: rowValue(row, mapping, 'effort'),
        behaviour: rowValue(row, mapping, 'behaviour'),
        homework: rowValue(row, mapping, 'homework'),
        concern_level: rowValue(row, mapping, 'concern_level'),
        comment: rowValue(row, mapping, 'comment')
      };
      var match = matchEnrolment(db, mapped);
      return { rowIndex: i, mapped: mapped, match: match };
    });
  }

  function findTrackingPoint(db, name) {
    var n = String(name || '').trim().toLowerCase();
    return (db.school_tracking_points || []).find(function(tp) {
      return tp.tracking_point_name.toLowerCase() === n ||
        tp.tracking_point_name.toLowerCase().indexOf(n) >= 0;
    });
  }

  function commitImport(db, previewRows, options) {
    options = options || {};
    var batchId = 'batch-' + Date.now();
    var confirmed = previewRows.filter(function(p) {
      return p.match.status === 'matched' && (options.includeAll || p._confirmed);
    });
    var count = 0;
    confirmed.forEach(function(p) {
      var en = p.match.enrolment;
      var tp = findTrackingPoint(db, p.mapped.tracking_point) || db.school_tracking_points[1];
      if (!tp) return;
      var existing = (db.pupil_tracking_data || []).find(function(t) {
        return t.enrolment_id === en.id && t.tracking_point_id === tp.id;
      });
      var payload = {
        working_grade: p.mapped.working_grade,
        target_grade: p.mapped.target_grade || en.target_grade,
        effort: p.mapped.effort,
        behaviour: p.mapped.behaviour,
        homework: p.mapped.homework,
        concern_level: p.mapped.concern_level,
        teacher_comment: p.mapped.comment,
        imported_from_school_tracking: true,
        import_batch_id: batchId
      };
      if (existing) {
        global.SptStore.updateRecord(db, 'pupil_tracking_data', existing.id, payload, 'import_update');
      } else {
        global.SptStore.insertRecord(db, 'pupil_tracking_data', Object.assign({
          enrolment_id: en.id,
          tracking_point_id: tp.id
        }, payload), 'import_insert');
      }
      if (p.mapped.working_grade && !en.working_grade_locked) {
        en.latest_working_grade = p.mapped.working_grade;
      }
      if (p.mapped.target_grade) en.target_grade = p.mapped.target_grade;
      count++;
    });
    global.SptStore.insertRecord(db, 'import_batches', {
      id: batchId,
      filename: options.filename || 'import.csv',
      uploaded_by: (global.SptConfig.ROLES[db.dev_role] || {}).label || 'dev',
      row_count: count,
      status: 'completed'
    }, 'import_batch');
    global.SptRisk.recalculateAll(db);
    global.SptStore.save(db);
    return { batchId: batchId, imported: count };
  }

  global.SptImport = {
    parseCsvText: parseCsvText,
    mapColumns: mapColumns,
    buildPreview: buildPreview,
    commitImport: commitImport,
    FIELD_ALIASES: FIELD_ALIASES
  };
})(typeof window !== 'undefined' ? window : global);
