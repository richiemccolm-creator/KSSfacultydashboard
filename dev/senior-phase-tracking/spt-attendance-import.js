/**
 * Whole-school attendance import from MIS Excel export.
 * Columns: A Known As, B Surname, C Reg class (ignored), D Attendance (%), E Late (ignored).
 */
(function(global) {
  'use strict';

  function norm(s) {
    return String(s || '').trim().toLowerCase();
  }

  function parsePercent(val) {
    if (val == null || val === '') return null;
    var s = String(val).trim().replace(/%/g, '');
    var n = parseFloat(s);
    if (isNaN(n)) return null;
    if (n < 0) return 0;
    if (n > 100) return 100;
    return Math.round(n * 10) / 10;
  }

  function cellStr(row, idx) {
    if (!row || idx < 0) return '';
    var v = row[idx];
    return v == null ? '' : String(v).trim();
  }

  function headerLooksLikeAttendanceRow(row) {
    if (!row || !row.length) return false;
    var joined = row.map(function(c) { return norm(c); }).join(' ');
    return joined.indexOf('known') >= 0 || joined.indexOf('surname') >= 0 ||
      joined.indexOf('attendance') >= 0;
  }

  function parseExcelArrayBuffer(arrayBuffer) {
    if (typeof global.XLSX === 'undefined') {
      return { error: 'Excel library not loaded — refresh the page.', rows: [] };
    }
    var wb;
    try {
      wb = global.XLSX.read(arrayBuffer, { type: 'array' });
    } catch (e) {
      return { error: 'Could not read Excel file.', rows: [] };
    }
    if (!wb.SheetNames || !wb.SheetNames.length) {
      return { error: 'Workbook has no sheets.', rows: [] };
    }
    var sheet = wb.Sheets[wb.SheetNames[0]];
    var aoa = global.XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    if (!aoa.length) return { error: 'Sheet is empty.', rows: [] };

    var start = 0;
    if (headerLooksLikeAttendanceRow(aoa[0])) start = 1;

    var parsed = [];
    for (var i = start; i < aoa.length; i++) {
      var row = aoa[i];
      if (!row || !row.length) continue;
      var knownAs = cellStr(row, 0);
      var surname = cellStr(row, 1);
      var pct = parsePercent(row[3]);
      if (!knownAs && !surname) continue;
      if (pct == null && !knownAs && !surname) continue;
      parsed.push({
        line: i + 1,
        known_as: knownAs,
        surname: surname,
        attendance_percent: pct
      });
    }
    if (!parsed.length) {
      return { error: 'No pupil rows found — check columns A (Known As), B (Surname), D (Attendance %).', rows: [] };
    }
    return { rows: parsed, sheetName: wb.SheetNames[0] };
  }

  function pupilsWithActiveEnrolment(db) {
    var activeIds = {};
    (db.enrolments || []).forEach(function(e) {
      if (e.active_status !== false) activeIds[e.pupil_id] = true;
    });
    return (db.pupils || []).filter(function(p) {
      return p.active_status !== false && activeIds[p.id];
    });
  }

  function nameMatches(pupil, knownAs, surname) {
    var sn = norm(surname);
    if (!sn || norm(pupil.surname) !== sn) return false;
    var ka = norm(knownAs);
    if (!ka) return false;
    var fn = norm(pupil.first_name);
    var pref = norm(pupil.preferred_name);
    return fn === ka || pref === ka || (pref && pref.indexOf(ka) === 0) || (fn && fn.indexOf(ka) === 0);
  }

  function matchPupil(db, knownAs, surname) {
    if (!knownAs && !surname) {
      return { status: 'empty', pupil: null, matches: [] };
    }
    if (!surname) {
      return { status: 'missing_surname', pupil: null, matches: [] };
    }
    var pool = pupilsWithActiveEnrolment(db);
    var matches = pool.filter(function(p) { return nameMatches(p, knownAs, surname); });
    if (matches.length === 0) {
      return { status: 'not_in_tracking', pupil: null, matches: [] };
    }
    if (matches.length > 1) {
      return { status: 'duplicate', pupil: null, matches: matches };
    }
    return { status: 'matched', pupil: matches[0], matches: matches };
  }

  function buildPreview(db, rows, target) {
    return rows.map(function(row, i) {
      var match = matchPupil(db, row.known_as, row.surname);
      var pct = row.attendance_percent;
      var note = '';
      if (pct == null && match.status === 'matched') {
        note = 'Missing or invalid attendance %';
      } else if (match.status === 'not_in_tracking') {
        note = 'Not in senior-phase tracking';
      } else if (match.status === 'duplicate') {
        note = 'Multiple pupils match — check names in Setup';
      } else if (match.status === 'missing_surname') {
        note = 'Missing surname';
      }
      var ready = match.status === 'matched' && pct != null;
      return {
        rowIndex: i,
        row: row,
        match: match,
        ready: ready,
        note: note,
        target: target
      };
    });
  }

  function activeEnrolmentIds(db, pupilId) {
    return (db.enrolments || []).filter(function(e) {
      return e.pupil_id === pupilId && e.active_status !== false;
    }).map(function(e) { return e.id; });
  }

  function commitImport(db, previewRows, options) {
    options = options || {};
    var target = options.target || 'eoy';
    var batchId = 'att-batch-' + Date.now();
    var stats = {
      batchId: batchId,
      processed: 0,
      skipped: 0,
      pupils: 0,
      enrolments: 0,
      errors: []
    };
    var ready = previewRows.filter(function(p) { return p.ready; });
    var seenPupils = {};

    ready.forEach(function(item) {
      var pupil = item.match.pupil;
      var pct = item.row.attendance_percent;
      if (!pupil || pct == null) {
        stats.skipped++;
        return;
      }

      if (target === 'eoy') {
        global.SptStore.updatePupilEoyAttendance(db, pupil.id, pct, options.sessionLabel || '');
        if (!seenPupils[pupil.id]) {
          seenPupils[pupil.id] = true;
          stats.pupils++;
        }
        stats.processed++;
        return;
      }

      if (target.indexOf('tp:') === 0) {
        var tpId = target.slice(3);
        var enIds = activeEnrolmentIds(db, pupil.id);
        if (!enIds.length) {
          stats.skipped++;
          stats.errors.push('Line ' + item.row.line + ': no active enrolments');
          return;
        }
        enIds.forEach(function(enId) {
          global.SptStore.upsertAttendancePercent(db, enId, tpId, pct);
          stats.enrolments++;
        });
        if (!seenPupils[pupil.id]) {
          seenPupils[pupil.id] = true;
          stats.pupils++;
        }
        stats.processed++;
      }
    });

    global.SptStore.insertRecord(db, 'import_batches', {
      id: batchId,
      filename: options.filename || 'attendance.xlsx',
      import_type: 'attendance',
      target: target,
      uploaded_by: options.uploadedBy || 'Faculty Head',
      row_count: stats.processed,
      status: 'completed'
    }, 'attendance_import_batch');

    global.SptStore.save(db);
    return stats;
  }

  function previewSummary(preview) {
    var matched = preview.filter(function(p) { return p.ready; }).length;
    var noPct = preview.filter(function(p) {
      return p.match.status === 'matched' && p.row.attendance_percent == null;
    }).length;
    var notTracked = preview.filter(function(p) { return p.match.status === 'not_in_tracking'; }).length;
    var dup = preview.filter(function(p) { return p.match.status === 'duplicate'; }).length;
    return {
      total: preview.length,
      matched: matched,
      noPct: noPct,
      notTracked: notTracked,
      duplicate: dup
    };
  }

  global.SptAttendanceImport = {
    parseExcelArrayBuffer: parseExcelArrayBuffer,
    parsePercent: parsePercent,
    matchPupil: matchPupil,
    buildPreview: buildPreview,
    commitImport: commitImport,
    previewSummary: previewSummary
  };
})(typeof window !== 'undefined' ? window : global);
