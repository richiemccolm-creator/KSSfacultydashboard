/**
 * Bridge between Senior Phase Tracking and QS Attainment Dashboard.
 * - Map SPT enrolments → QS snapshot rows (estimates + awarded grades + SCN)
 * - Import QS / Component Marks Excel matched by SCN
 * - Push / merge into qs_attainment_snapshots for the current academic year
 */
(function (global) {
  'use strict';

  var GRADE_TO_BAND = {
    A1: 1, A2: 2,
    B1: 3, B2: 4, B3: 3, B4: 4,
    C1: 5, C2: 6, C5: 5, C6: 6,
    A: 2, B: 4, C: 6, D: 7,
    'NO AWARD': 8, NA: 8, 'N/A': 8,
    DNA: 9, 'DID NOT ATTEMPT': 9, 'NOT PRESENTED': 9,
    PASS: 6, 'BORDERLINE FAIL': 7, 'NOT GOING TO ACHIEVE': 8
  };

  function toNum(v) {
    if (v === null || v === undefined || v === '') return null;
    var n = parseFloat(String(v).replace('%', ''));
    return isNaN(n) ? null : n;
  }

  function gradeToBand(g) {
    if (g === null || g === undefined || g === '') return null;
    if (typeof g === 'number') return g >= 1 && g <= 9 ? Math.round(g) : null;
    var k = String(g).trim().toUpperCase().replace(/\s+/g, ' ');
    if (GRADE_TO_BAND[k] !== undefined) return GRADE_TO_BAND[k];
    var n = parseFloat(k);
    return !isNaN(n) && n >= 1 && n <= 9 ? Math.round(n) : null;
  }

  function bandToSelectValue(raw, course) {
    var band = gradeToBand(raw);
    if (band === null) return '';
    if (global.SptWorkingGrade && global.SptWorkingGrade.isValidScore &&
        !global.SptWorkingGrade.isValidScore(band, course)) {
      return '';
    }
    return String(band);
  }

  function qsSubject(course) {
    if (!course) return '—';
    var area = String(course.subject_area || '').toLowerCase();
    var name = String(course.course_name || '').toLowerCase();
    if (area.indexOf('drama') >= 0 || name.indexOf('drama') >= 0) return 'Drama';
    if (area.indexOf('photo') >= 0 || name.indexOf('photo') >= 0) return 'Photography';
    if (area.indexOf('art') >= 0 || name.indexOf('art') >= 0) return 'Art & Design';
    return course.subject_area || course.course_name || '—';
  }

  function qsLevel(level) {
    var s = String(level || '').trim();
    if (/^n\.?\s*5$|nat(ional)?\s*5|n5/i.test(s)) return 'National 5';
    if (/adv/i.test(s)) return 'Advanced Higher';
    if (/^higher$/i.test(s)) return 'Higher';
    if (/npa|level\s*[456]/i.test(s)) return 'NPA';
    if (/national\s*4|n4/i.test(s)) return 'NPA';
    return s || '—';
  }

  function schoolYear() {
    var y = global.SptConfig && global.SptConfig.currentAcademicYear
      ? global.SptConfig.currentAcademicYear()
      : '2026-27';
    if (global.QsAttainmentService && global.QsAttainmentService.toSchoolYear) {
      return global.QsAttainmentService.toSchoolYear(y);
    }
    return y;
  }

  function sessionLabel() {
    if (global.QsAttainmentService && global.QsAttainmentService.toSessionLabel) {
      return global.QsAttainmentService.toSessionLabel(schoolYear());
    }
    var y = schoolYear();
    var m = String(y).match(/^20(\d{2})-(\d{2})$/);
    return m ? m[1] + '-' + m[2] : y;
  }

  function headerMap(row0) {
    var map = {};
    Object.keys(row0 || {}).forEach(function (k) {
      map[String(k).toLowerCase().replace(/[^a-z0-9]/g, '')] = k;
    });
    return map;
  }

  function pick(row, map) {
    var cands = Array.prototype.slice.call(arguments, 2);
    for (var i = 0; i < cands.length; i++) {
      var key = map[cands[i]];
      if (key !== undefined && row[key] !== undefined && row[key] !== '') return row[key];
    }
    return null;
  }

  function sheetToObjects(ws) {
    if (!ws || !global.XLSX) return [];
    var arr = global.XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
    var hi = -1;
    for (var i = 0; i < Math.min(arr.length, 20); i++) {
      var cells = (arr[i] || []).map(function (v) {
        return String(v == null ? '' : v).trim().toLowerCase();
      });
      var has = function (k) {
        return cells.some(function (c) { return c === k || c.indexOf(k) >= 0; });
      };
      if ((has('forename') && has('surname')) ||
          (has('scn') && (has('mark') || has('grade') || has('band'))) ||
          (has('year') && has('mark') && has('component'))) {
        hi = i;
        break;
      }
    }
    if (hi < 0) return [];
    var seen = {};
    var keys = (arr[hi] || []).map(function (h) {
      var k = h == null ? '' : String(h).trim();
      if (!k) return '';
      if (seen[k] !== undefined) {
        seen[k]++;
        k = k + '_' + seen[k];
      } else seen[k] = 0;
      return k;
    });
    var out = [];
    for (var r = hi + 1; r < arr.length; r++) {
      var row = arr[r];
      if (!row) continue;
      var o = {};
      var any = false;
      keys.forEach(function (k, j) {
        if (!k) return;
        var v = row[j] == null ? null : row[j];
        o[k] = v;
        if (v !== null && v !== '') any = true;
      });
      if (any) out.push(o);
    }
    return out;
  }

  function normalizeScn(v) {
    return String(v == null ? '' : v).replace(/\s+/g, '').trim();
  }

  function findPupilByScn(db, scn) {
    var key = normalizeScn(scn);
    if (!key) return null;
    return (db.pupils || []).find(function (p) {
      return normalizeScn(p.candidate_number) === key;
    }) || null;
  }

  function courseMatchesSubject(course, subjectRaw) {
    var subj = qsSubject(course).toLowerCase();
    var raw = String(subjectRaw || '').toLowerCase();
    if (!raw) return false;
    if (subj.indexOf('drama') >= 0 && raw.indexOf('drama') >= 0) return true;
    if (subj.indexOf('photo') >= 0 && raw.indexOf('photo') >= 0) return true;
    if (subj.indexOf('art') >= 0 && (raw.indexOf('art') >= 0 || raw.indexOf('design') >= 0)) return true;
    return raw.indexOf(String(course.course_name || '').toLowerCase()) >= 0;
  }

  function findEnrolmentForPupilCourse(db, pupilId, subjectRaw, levelRaw) {
    var level = qsLevel(levelRaw);
    var matches = (db.enrolments || []).filter(function (en) {
      if (en.pupil_id !== pupilId || en.active_status === false) return false;
      var course = global.SptStore.byId(db.courses, en.course_id);
      return courseMatchesSubject(course, subjectRaw);
    });
    if (!matches.length) return null;
    if (level && level !== '—') {
      var exact = matches.find(function (en) {
        return qsLevel(en.current_level) === level;
      });
      if (exact) return exact;
    }
    return matches[0];
  }

  function attendanceForPupil(db, pupil, enrolment) {
    if (pupil && pupil.end_of_year_attendance_percent != null) {
      return toNum(pupil.end_of_year_attendance_percent);
    }
    var tps = global.SptStore.trackingPoints(db);
    var tp = tps[tps.length - 1];
    if (!tp || !enrolment) return null;
    var rec = (db.attendance_records || []).find(function (a) {
      return a.enrolment_id === enrolment.id && a.tracking_point_id === tp.id;
    });
    return rec && rec.attendance_percent != null ? toNum(rec.attendance_percent) : null;
  }

  function buildQsRows(db, options) {
    options = options || {};
    var rows = [];
    var missingScn = 0;
    var withEstimate = 0;
    var withAwarded = 0;
    (db.enrolments || []).forEach(function (en) {
      if (en.active_status === false) return;
      var pupil = global.SptStore.byId(db.pupils, en.pupil_id);
      var course = global.SptStore.byId(db.courses, en.course_id);
      if (!pupil || !course) return;
      if (options.courseId && en.course_id !== options.courseId) return;
      if (options.classId && en.class_id !== options.classId) return;
      var subject = qsSubject(course);
      var level = qsLevel(en.current_level);
      if (level === 'NPA' && options.skipNpa) return;
      var scn = normalizeScn(pupil.candidate_number);
      if (!scn) missingScn++;
      var est = gradeToBand(en.final_estimate);
      var band = gradeToBand(en.qs_awarded_grade);
      if (est != null) withEstimate++;
      if (band != null) withAwarded++;
      rows.push({
        name: [pupil.first_name || pupil.preferred_name, pupil.surname].filter(Boolean).join(' '),
        teacher: global.SptStore.teacherName(db, en.teacher_id) || '—',
        subject: subject,
        level: level,
        cem: null,
        pred: null,
        attendance: attendanceForPupil(db, pupil, en),
        est: est,
        band: band,
        gradeRaw: en.qs_awarded_grade ? String(en.qs_awarded_grade) : null,
        decile: null,
        quintile: null,
        asn: false,
        scn: scn || null,
        c1: null, n1: null,
        c2: null, n2: null,
        c3: null, n3: null,
        spt_enrolment_id: en.id,
        spt_course_id: course.id
      });
    });
    return {
      rows: rows,
      missingScn: missingScn,
      withEstimate: withEstimate,
      withAwarded: withAwarded,
      schoolYear: schoolYear(),
      session: sessionLabel()
    };
  }

  function parseWorkbookArrayBuffer(buf) {
    if (!global.XLSX) throw new Error('Excel library not loaded');
    return global.XLSX.read(new Uint8Array(buf), { type: 'array' });
  }

  function detectImportKind(wb) {
    var bestResults = null;
    var bestComps = null;
    wb.SheetNames.forEach(function (name) {
      var rows = sheetToObjects(wb.Sheets[name]);
      if (!rows.length) return;
      var m = headerMap(rows[0]);
      var isComp = m.scn !== undefined && m.mark !== undefined &&
        (m.coursetitle !== undefined || m.course !== undefined || m.subject !== undefined) &&
        m.component !== undefined && m.year === undefined;
      var isResult = (m.forename !== undefined || m.firstname !== undefined || m.knownas !== undefined) &&
        m.surname !== undefined &&
        (m.sqagrade !== undefined || m.grade !== undefined || m.sqaresultband !== undefined ||
          m.estimate !== undefined || m.sqaestimate !== undefined || m.band !== undefined);
      if (isComp && (!bestComps || rows.length > bestComps.rows.length)) {
        bestComps = { sheet: name, rows: rows };
      }
      if (isResult && (!bestResults || rows.length > bestResults.rows.length)) {
        bestResults = { sheet: name, rows: rows };
      }
    });
    if (bestComps && (!bestResults || bestComps.rows.length >= bestResults.rows.length)) {
      return { kind: 'components', sheet: bestComps.sheet, rows: bestComps.rows };
    }
    if (bestResults) return { kind: 'results', sheet: bestResults.sheet, rows: bestResults.rows };
    return { kind: 'unknown', sheet: '', rows: [] };
  }

  function previewResultsImport(db, rows) {
    var m = headerMap(rows[0] || {});
    var preview = [];
    rows.forEach(function (r) {
      var scn = normalizeScn(pick(r, m, 'scn', 'candidatenumber', 'candidateno', 'scottishcandidatenumber'));
      var fore = pick(r, m, 'forename', 'firstname', 'knownas') || '';
      var sur = pick(r, m, 'surname') || '';
      var subject = pick(r, m, 'subject', 'coursetitle', 'course') || '';
      var level = pick(r, m, 'level') || '';
      var est = pick(r, m, 'sqaestimate', 'sqaestimates', 'estimate', 'estimates');
      var awarded = pick(r, m, 'sqagrade', 'grade', 'sqaresultband', 'resultband', 'band', 'sqaresults');
      var pupil = scn ? findPupilByScn(db, scn) : null;
      var en = pupil ? findEnrolmentForPupilCourse(db, pupil.id, subject, level) : null;
      var status = 'unmatched';
      var note = '';
      if (!scn) {
        status = 'no_scn';
        note = 'Row has no SCN';
      } else if (!pupil) {
        status = 'pupil_missing';
        note = 'SCN not in Senior Phase tracking';
      } else if (!en) {
        status = 'enrolment_missing';
        note = 'Pupil found but no matching course enrolment';
      } else {
        status = 'matched';
        note = 'Will update estimate / QS grade';
      }
      preview.push({
        scn: scn,
        name: [fore, sur].filter(Boolean).join(' ') || (pupil ? global.SptStore.pupilName(db, pupil.id) : '—'),
        subject: subject,
        level: level,
        estimate: est,
        awarded: awarded,
        status: status,
        note: note,
        enrolment_id: en ? en.id : null,
        ready: status === 'matched'
      });
    });
    return preview;
  }

  function commitResultsImport(db, preview) {
    var updated = 0;
    preview.forEach(function (item) {
      if (!item.ready || !item.enrolment_id) return;
      var patch = {};
      var estBand = gradeToBand(item.estimate);
      var awBand = gradeToBand(item.awarded);
      if (estBand != null) patch.final_estimate = String(estBand);
      else if (item.estimate != null && String(item.estimate).trim() !== '') {
        patch.final_estimate = String(item.estimate).trim();
      }
      if (awBand != null) patch.qs_awarded_grade = String(awBand);
      else if (item.awarded != null && String(item.awarded).trim() !== '') {
        patch.qs_awarded_grade = String(item.awarded).trim();
      }
      if (!Object.keys(patch).length) return;
      global.SptStore.updateRecord(db, 'enrolments', item.enrolment_id, patch, 'qs_results_import');
      updated++;
    });
    if (global.SptRisk) global.SptRisk.recalculateAll(db);
    return { updated: updated };
  }

  function parseComponentEntries(rows) {
    var m = headerMap(rows[0] || {});
    var entries = [];
    rows.forEach(function (r) {
      var fore = pick(r, m, 'forename', 'firstname', 'knownas');
      var sur = pick(r, m, 'surname');
      if (!fore || !sur) return;
      var mark = toNum(pick(r, m, 'mark'));
      if (mark !== null && mark >= 999) mark = null;
      var band = gradeToBand(pick(r, m, 'band', 'grade'));
      if (mark === null && band === null) return;
      entries.push({
        scn: normalizeScn(pick(r, m, 'scn', 'candidatenumber')),
        fore: String(fore).trim(),
        sur: String(sur).trim(),
        subject: String(pick(r, m, 'coursetitle', 'course', 'subject') || '').trim(),
        level: qsLevel(pick(r, m, 'level')),
        component: String(pick(r, m, 'component') || '').trim(),
        title: String(pick(r, m, 'title') || '').trim(),
        mark: mark,
        band: band
      });
    });
    return entries;
  }

  function nameKey(f, s) {
    return String((f || '') + (s || '')).toLowerCase().replace(/[^a-z]/g, '');
  }

  function normSubjectForComps(s) {
    s = String(s || '').trim();
    if (/^art/i.test(s)) {
      var m = s.match(/\((design|expressive)\)/i);
      return 'Art & Design' + (m ? ' (' + m[1][0].toUpperCase() + m[1].slice(1).toLowerCase() + ')' : '');
    }
    if (/photo/i.test(s)) return 'Photography';
    if (/drama/i.test(s)) return 'Drama';
    return s || '—';
  }

  function facultySubjectsFromRows(qsRows) {
    var set = {};
    (qsRows || []).forEach(function (r) {
      if (r.subject) set[r.subject] = true;
    });
    return Object.keys(set);
  }

  function mergeComponentEntries(existingComps, entries, year, facultySubjects) {
    var isFac = function (s) {
      var ns = normSubjectForComps(s);
      return facultySubjects.some(function (f) {
        return ns === f || ns.indexOf(f + ' (') === 0 || f.indexOf(ns) === 0;
      });
    };
    var facRows = entries.filter(function (r) { return isFac(r.subject); });
    var kept = (existingComps || []).filter(function (r) {
      return !(r.year === year && isFac(r.subject));
    });
    facRows.forEach(function (r) {
      kept.push({
        year: year,
        fore: r.fore,
        sur: r.sur,
        subject: normSubjectForComps(r.subject),
        level: r.level,
        component: r.component,
        title: r.title,
        mark: r.mark,
        band: r.band,
        nat: null,
        scn: r.scn || null
      });
    });
    var seen = {};
    var school = [];
    entries.forEach(function (r) {
      if (r.band === null) return;
      var k = nameKey(r.fore, r.sur) + '¦' + normSubjectForComps(r.subject);
      if (seen[k]) return;
      seen[k] = true;
      school.push({
        key: nameKey(r.fore, r.sur),
        subject: normSubjectForComps(r.subject),
        level: r.level,
        band: r.band
      });
    });
    return { comps: kept, school: school, facCount: facRows.length };
  }

  function pushToQsAttainment(db, options) {
    options = options || {};
    if (!global.QsAttainmentService) {
      return Promise.reject(new Error('QS Attainment service not loaded'));
    }
    var built = buildQsRows(db, options);
    if (!built.rows.length) {
      return Promise.reject(new Error('No enrolments to send'));
    }
    var year = built.schoolYear;
    return global.QsAttainmentService.getSnapshot(year).then(function (existing) {
      var prev = (existing && existing.data) || {};
      var data = {
        rows: built.rows,
        comps: prev.comps || [],
        school: prev.school || [],
        filename: 'Senior Phase Tracking sync',
        sheetName: 'SPT ' + built.session,
        session: built.session,
        preResults: !built.rows.some(function (r) { return r.band !== null; }),
        pupilCount: built.rows.length,
        source: 'senior_phase_tracking',
        synced_at: new Date().toISOString()
      };
      return global.QsAttainmentService.saveSnapshot({
        school_year: year,
        session: built.session,
        data: data,
        metadata: {
          pupil_count: built.rows.length,
          component_count: (data.comps || []).length,
          filename: data.filename,
          pre_results: data.preResults,
          missing_scn: built.missingScn,
          with_estimate: built.withEstimate,
          with_awarded: built.withAwarded,
          source: 'senior_phase_tracking'
        }
      }).then(function (saved) {
        return {
          saved: saved,
          built: built,
          year: year
        };
      });
    });
  }

  function pushComponentsToQs(db, entries) {
    if (!global.QsAttainmentService) {
      return Promise.reject(new Error('QS Attainment service not loaded'));
    }
    var yearLabel = sessionLabel();
    var year = schoolYear();
    var built = buildQsRows(db, {});
    return global.QsAttainmentService.getSnapshot(year).then(function (existing) {
      var prev = (existing && existing.data) || {};
      var rows = (prev.rows && prev.rows.length) ? prev.rows : built.rows;
      var facSubs = facultySubjectsFromRows(rows);
      if (!facSubs.length) {
        facSubs = ['Art & Design', 'Drama', 'Photography'];
      }
      var merged = mergeComponentEntries(prev.comps || [], entries, yearLabel, facSubs);
      var data = {
        rows: rows,
        comps: merged.comps,
        school: merged.school.length ? merged.school : (prev.school || []),
        filename: (prev.filename || 'Senior Phase Tracking') + ' + QS components',
        sheetName: prev.sheetName || 'SPT',
        session: yearLabel,
        preResults: !rows.some(function (r) { return r.band !== null; }),
        pupilCount: rows.length,
        source: 'senior_phase_tracking',
        synced_at: new Date().toISOString(),
        compReport: {
          filename: 'QS Component Marks Report',
          year: yearLabel,
          fac: merged.facCount,
          all: entries.length
        }
      };
      return global.QsAttainmentService.saveSnapshot({
        school_year: year,
        session: yearLabel,
        data: data,
        metadata: {
          pupil_count: rows.length,
          component_count: merged.comps.length,
          filename: data.filename,
          pre_results: data.preResults,
          source: 'senior_phase_tracking_components'
        }
      }).then(function (saved) {
        return { saved: saved, facCount: merged.facCount, year: year, comps: merged.comps.length };
      });
    });
  }

  global.SptQsBridge = {
    gradeToBand: gradeToBand,
    bandToSelectValue: bandToSelectValue,
    qsSubject: qsSubject,
    qsLevel: qsLevel,
    schoolYear: schoolYear,
    sessionLabel: sessionLabel,
    buildQsRows: buildQsRows,
    parseWorkbookArrayBuffer: parseWorkbookArrayBuffer,
    detectImportKind: detectImportKind,
    previewResultsImport: previewResultsImport,
    commitResultsImport: commitResultsImport,
    parseComponentEntries: parseComponentEntries,
    pushToQsAttainment: pushToQsAttainment,
    pushComponentsToQs: pushComponentsToQs
  };
})(typeof window !== 'undefined' ? window : global);
