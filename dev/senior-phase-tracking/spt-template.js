/**
 * Senior Phase — Excel workbook template (one sheet per subject area).
 * Download blank or filled; re-upload merges new tracking periods with existing data.
 */
(function(global) {
  'use strict';

  var HEADERS = [
    'Academic Year', 'Course', 'Class Name',
    'Teacher First Name', 'Teacher Surname', 'Teacher Email',
    'Pupil First Name', 'Pupil Surname', 'Year Group', 'Candidate Number',
    'Current Level', 'Target Grade', 'Tracking Point',
    'Effort', 'Behaviour', 'Home Learning', 'Working Grade', 'Attendance',
    'Teacher Comment', 'Concern'
  ];

  var HEADER_KEYS = [
    'academic_year', 'course', 'class_name',
    'teacher_first', 'teacher_surname', 'teacher_email',
    'pupil_first', 'pupil_surname', 'year_group', 'candidate_number',
    'current_level', 'target_grade', 'tracking_point',
    'effort', 'behaviour', 'home_learning', 'working_grade', 'attendance',
    'teacher_comment', 'concern'
  ];

  function norm(s) {
    return String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
  }

  function sheetSafeName(name) {
    return String(name || 'Sheet').replace(/[\\/*?:\[\]]/g, '').slice(0, 31);
  }

  function hasXlsx() {
    return typeof global.XLSX !== 'undefined' && global.XLSX.utils && global.XLSX.writeFile;
  }

  function subjectAreas() {
    return (global.SptConfig && global.SptConfig.SUBJECT_ORDER) || [];
  }

  function coursesForSubject(area) {
    return (global.SptConfig.COURSE_DEFS || []).filter(function(c) { return c.subject_area === area; });
  }

  function defaultAcademicYear(db) {
    var tps = (db && db.school_tracking_points) || [];
    if (tps[0] && tps[0].academic_year) return tps[0].academic_year;
    return global.SptConfig.currentAcademicYear();
  }

  function exampleRow(courseName) {
    return [
      global.SptConfig.currentAcademicYear(), courseName || '', 'Class A',
      'Teacher', 'Name', 'teacher@school.gla.ac.uk',
      'Pupil', 'Example', 'S5', '2410001',
      'Higher', 'B', 'Tracking Point 1',
      '3', '3', '3', 'B', '3', '', ''
    ];
  }

  function buildInstructionsAoa(db) {
    var year = defaultAcademicYear(db);
    var lines = [
      ['Senior Phase Tracking — Import workbook'],
      [''],
      ['How to use'],
      ['1. Each subject has its own sheet (Drama, Art, Photography, etc.).'],
      ['2. Enter one row per pupil, per course, per tracking point (TP1, TP2, TP3).'],
      ['3. Save offline. When a new tracking period starts, add new rows with the new Tracking Point — keep existing rows.'],
      ['4. Re-upload the workbook: matching rows update; new rows are added. Teachers, classes, pupils and enrolments are created if missing.'],
      [''],
      ['Tracking points (use exact names or TP1 / TP2 / TP3):']
    ];
    (global.SptConfig.TRACKING_POINT_NAMES || []).forEach(function(tp) {
      lines.push(['• ' + tp.tracking_point_name + ' (' + tp.tracking_point_date + ')']);
    });
    lines.push(['']);
    lines.push(['Courses by subject sheet:']);
    subjectAreas().forEach(function(area) {
      lines.push(['— ' + area + ': ' + coursesForSubject(area).map(function(c) { return c.course_name; }).join(', ')]);
    });
    lines.push(['']);
    lines.push(['Scores: Effort, Behaviour, Home Learning, Attendance = 1–4. Concern = Open to flag (optional).']);
    lines.push(['Academic year for this workbook: ' + year]);
    return lines;
  }

  function rowFromEnrolment(db, en, tp, tr, att) {
    var pupil = global.SptStore.byId(db.pupils, en.pupil_id);
    var course = global.SptStore.byId(db.courses, en.course_id);
    var cl = en.class_id ? global.SptStore.byId(db.classes, en.class_id) : null;
    var teacher = global.SptStore.byId(db.teachers, en.teacher_id);
    return [
      (cl && cl.academic_year) || defaultAcademicYear(db),
      course ? course.course_name : '',
      cl ? cl.class_name : '',
      teacher ? teacher.first_name : '',
      teacher ? teacher.surname : '',
      teacher ? (teacher.email || '') : '',
      pupil ? pupil.first_name : '',
      pupil ? pupil.surname : '',
      pupil ? pupil.year_group : '',
      pupil ? (pupil.candidate_number || '') : '',
      en.current_level || '',
      en.target_grade || '',
      tp ? tp.tracking_point_name : '',
      tr && tr.effort != null ? tr.effort : '',
      tr && tr.behaviour != null ? tr.behaviour : '',
      tr && (tr.homework != null ? tr.homework : tr.homelearning) != null
        ? (tr.homework != null ? tr.homework : tr.homelearning) : '',
      en.latest_working_grade || (tr && tr.working_grade) || '',
      att && att.record && att.record.attendance_score != null ? att.record.attendance_score : '',
      tr && tr.teacher_comment ? tr.teacher_comment : '',
      en.has_open_flag ? 'Open' : ''
    ];
  }

  function rowsForSubject(db, area, includeFilled) {
    var rows = [HEADERS];
    var courses = coursesForSubject(area);
    if (!includeFilled) {
      if (courses.length) rows.push(exampleRow(courses[0].course_name));
      return rows;
    }
    var courseIds = {};
    courses.forEach(function(def) {
      var c = (db.courses || []).find(function(x) { return x.slug === def.slug; });
      if (c) courseIds[c.id] = true;
    });
    var tps = global.SptStore.trackingPoints(db);
    (db.enrolments || []).forEach(function(en) {
      if (!courseIds[en.course_id] || en.active_status === false) return;
      tps.forEach(function(tp) {
        var tr = global.SptStore.trackingRecordFor(db, en.id, tp.id);
        var att = global.SptStore.attendanceForEnrolment(db, en.id).find(function(a) {
          return a.tracking_point.id === tp.id;
        });
        rows.push(rowFromEnrolment(db, en, tp, tr, att));
      });
    });
    if (rows.length === 1 && courses.length) rows.push(exampleRow(courses[0].course_name));
    return rows;
  }

  function downloadWorkbook(db, options) {
    options = options || {};
    if (!hasXlsx()) return { error: 'Excel library not loaded' };
    var filled = !!options.filled;
    var wb = global.XLSX.utils.book_new();
    global.XLSX.utils.book_append_sheet(wb, global.XLSX.utils.aoa_to_sheet(buildInstructionsAoa(db)), 'Instructions');
    subjectAreas().forEach(function(area) {
      var aoa = rowsForSubject(db, area, filled);
      global.XLSX.utils.book_append_sheet(wb, global.XLSX.utils.aoa_to_sheet(aoa), sheetSafeName(area));
    });
    var stamp = new Date().toISOString().slice(0, 10);
    var fname = filled
      ? 'senior-phase-tracking-' + defaultAcademicYear(db) + '-filled-' + stamp + '.xlsx'
      : 'senior-phase-tracking-template-blank.xlsx';
    global.XLSX.writeFile(wb, fname);
    return { ok: true, filename: fname };
  }

  function parseSheetRows(sheet, sheetName) {
    if (!sheet || !sheet['!ref']) return [];
    var aoa = global.XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    if (!aoa.length) return [];
    var headerRow = aoa[0].map(function(c) { return norm(c); });
    var colMap = {};
    HEADER_KEYS.forEach(function(key, i) {
      var want = norm(HEADERS[i]);
      var idx = headerRow.indexOf(want);
      if (idx < 0) {
        idx = headerRow.findIndex(function(h) {
          return h === want || (h && (h.indexOf(want) >= 0 || want.indexOf(h) >= 0));
        });
      }
      if (idx >= 0) colMap[key] = idx;
    });
    var out = [];
    aoa.slice(1).forEach(function(cells, i) {
      var row = { _sheet: sheetName, _line: i + 2 };
      var empty = true;
      HEADER_KEYS.forEach(function(key) {
        var idx = colMap[key];
        var val = idx >= 0 ? String(cells[idx] != null ? cells[idx] : '').trim() : '';
        row[key] = val;
        if (val) empty = false;
      });
      if (!empty && (row.pupil_first || row.pupil_surname || row.candidate_number)) out.push(row);
    });
    return out;
  }

  function parseWorkbook(arrayBuffer) {
    if (!hasXlsx()) return { error: 'Excel library not loaded', rows: [] };
    var wb = global.XLSX.read(arrayBuffer, { type: 'array' });
    var rows = [];
    Object.keys(wb.Sheets).forEach(function(name) {
      if (norm(name) === 'instructions') return;
      rows = rows.concat(parseSheetRows(wb.Sheets[name], name));
    });
    return { rows: rows, sheetCount: Object.keys(wb.Sheets).length };
  }

  function findCourse(db, courseName, subjectArea) {
    var n = norm(courseName);
    if (!n) return null;
    var list = (db.courses || []).filter(function(c) {
      var cn = norm(c.course_name);
      return cn === n || cn.indexOf(n) >= 0 || n.indexOf(cn) >= 0;
    });
    if (subjectArea) {
      var sub = list.filter(function(c) { return c.subject_area === subjectArea; });
      if (sub.length) list = sub;
    }
    return list[0] || null;
  }

  function findTrackingPoint(db, name) {
    var n = norm(name);
    if (!n) return (db.school_tracking_points || [])[0] || null;
    return (db.school_tracking_points || []).find(function(tp) {
      var tn = norm(tp.tracking_point_name);
      return tn === n || tn.indexOf(n) >= 0 || n.indexOf(tn) >= 0 ||
        (n === 'tp1' && tn.indexOf('point 1') >= 0) ||
        (n === 'tp2' && tn.indexOf('point 2') >= 0) ||
        (n === 'tp3' && tn.indexOf('point 3') >= 0);
    }) || null;
  }

  function ensureTeacher(db, row) {
    var fn = row.teacher_first;
    var sn = row.teacher_surname;
    var email = norm(row.teacher_email);
    if (!fn && !sn && !email) return null;
    var existing = (db.teachers || []).find(function(t) {
      if (email && norm(t.email) === email) return true;
      return fn && sn &&
        norm(t.first_name) === norm(fn) &&
        norm(t.surname) === norm(sn);
    });
    if (existing) return existing;
    return global.SptStore.insertRecord(db, 'teachers', {
      first_name: fn || 'Teacher',
      surname: sn || 'Unknown',
      email: row.teacher_email || '',
      role: 'Class Teacher',
      active_status: true,
      source: 'import'
    }, 'template_teacher');
  }

  function ensureClass(db, courseId, className, teacherId, academicYear) {
    if (!className) return null;
    var existing = (db.classes || []).find(function(cl) {
      return cl.course_id === courseId && norm(cl.class_name) === norm(className);
    });
    if (existing) {
      if (teacherId && existing.teacher_id !== teacherId) {
        global.SptStore.updateRecord(db, 'classes', existing.id, { teacher_id: teacherId }, 'template_class');
        existing.teacher_id = teacherId;
      }
      return existing;
    }
    return global.SptStore.insertRecord(db, 'classes', {
      course_id: courseId,
      class_name: className,
      teacher_id: teacherId,
      academic_year: academicYear || defaultAcademicYear(db)
    }, 'template_class');
  }

  function ensurePupil(db, row, teacherId) {
    var existing = null;
    if (row.candidate_number) {
      existing = (db.pupils || []).find(function(p) { return p.candidate_number === row.candidate_number; });
    }
    if (!existing && row.pupil_first && row.pupil_surname) {
      existing = (db.pupils || []).find(function(p) {
        return norm(p.first_name) === norm(row.pupil_first) &&
          norm(p.surname) === norm(row.pupil_surname) &&
          (!row.year_group || p.year_group === row.year_group);
      });
    }
    if (existing) return existing;
    return global.SptStore.createPupil(db, {
      first_name: row.pupil_first,
      surname: row.pupil_surname,
      year_group: row.year_group || 'S5/6',
      candidate_number: row.candidate_number || '',
      class_group: row.class_name || '',
      teacher_id: teacherId || null
    });
  }

  function ensureEnrolment(db, row, pupilId, courseId, classId, teacherId, level, targetGrade, workingGrade) {
    var result = global.SptStore.addPupilToCourse(db, {
      pupilId: pupilId,
      courseId: courseId,
      classId: classId,
      teacherId: teacherId,
      level: level || undefined
    });
    var en = null;
    if (result.error) {
      if (result.error === 'Pupil is already on this course') {
        en = global.SptStore.findEnrolment(db, pupilId, courseId);
      } else {
        return null;
      }
    } else {
      en = result.enrolment;
    }
    if (!en) return null;
    var patch = {};
    if (targetGrade) patch.target_grade = targetGrade;
    if (workingGrade) patch.latest_working_grade = workingGrade;
    if (level) patch.current_level = level;
    if (teacherId) patch.teacher_id = teacherId;
    if (classId) patch.class_id = classId;
    if (norm(rowConcern(row)) === 'open') patch.has_open_flag = true;
    if (Object.keys(patch).length) {
      global.SptStore.updateRecord(db, 'enrolments', en.id, patch, 'template_enrolment');
      en = global.SptStore.byId(db.enrolments, en.id);
    }
    return en;
  }

  function rowConcern(row) {
    return row && row.concern ? row.concern : '';
  }

  function upsertTrackingRow(db, enrolmentId, tpId, row, batchId) {
    var existing = global.SptStore.trackingRecordFor(db, enrolmentId, tpId);
    var payload = {
      imported_from_school_tracking: true,
      import_batch_id: batchId
    };
    if (row.effort !== '') payload.effort = parseInt(row.effort, 10);
    if (row.behaviour !== '') payload.behaviour = parseInt(row.behaviour, 10);
    if (row.home_learning !== '') payload.homework = parseInt(row.home_learning, 10);
    if (row.teacher_comment) payload.teacher_comment = row.teacher_comment;
    if (row.working_grade) payload.working_grade = row.working_grade;
    if (row.target_grade) payload.target_grade = row.target_grade;
    if (existing) {
      global.SptStore.updateRecord(db, 'pupil_tracking_data', existing.id, payload, 'template_tracking');
    } else if (payload.effort != null || payload.behaviour != null || payload.homework != null ||
        payload.teacher_comment || payload.working_grade) {
      global.SptStore.insertRecord(db, 'pupil_tracking_data', Object.assign({
        enrolment_id: enrolmentId,
        tracking_point_id: tpId
      }, payload), 'template_tracking');
    }
    if (row.attendance !== '') {
      global.SptStore.upsertAttendance(db, enrolmentId, tpId, row.attendance);
    }
  }

  function buildImportPreview(db, rows) {
    var ready = 0;
    var warn = 0;
    var error = 0;
    var items = rows.map(function(row, i) {
      var course = findCourse(db, row.course, row._sheet);
      var tp = findTrackingPoint(db, row.tracking_point);
      var status = 'ready';
      var note = '';
      if (!course) { status = 'error'; note = 'Unknown course'; error++; }
      else if (!tp) { status = 'warn'; note = 'Tracking point not matched — will use first period'; warn++; }
      else { ready++; }
      if (!row.pupil_first && !row.pupil_surname && !row.candidate_number) {
        status = 'error'; note = 'Missing pupil'; error++;
      }
      return { index: i, row: row, status: status, note: note, course: course, trackingPoint: tp };
    });
    return { items: items, ready: ready, warn: warn, error: error, total: rows.length };
  }

  function commitWorkbookImport(db, rows, options) {
    options = options || {};
    var batchId = 'batch-' + Date.now();
    var stats = {
      rows: rows.length,
      processed: 0,
      skipped: 0,
      teachers: 0,
      classes: 0,
      pupils: 0,
      enrolments: 0,
      tracking: 0,
      errors: []
    };
    var seenTeachers = {};
    var seenClasses = {};
    var seenPupils = {};

    rows.forEach(function(row) {
      var course = findCourse(db, row.course, row._sheet);
      if (!course) {
        stats.skipped++;
        stats.errors.push('Row ' + row._line + ' (' + row._sheet + '): unknown course "' + row.course + '"');
        return;
      }
      var teacher = ensureTeacher(db, row);
      if (!teacher) {
        stats.skipped++;
        stats.errors.push('Row ' + row._line + ': missing teacher');
        return;
      }
      if (!seenTeachers[teacher.id]) { seenTeachers[teacher.id] = true; stats.teachers++; }
      var cl = ensureClass(db, course.id, row.class_name, teacher.id, row.academic_year);
      if (cl && !seenClasses[cl.id]) { seenClasses[cl.id] = true; stats.classes++; }
      var pupil = ensurePupil(db, row, teacher.id);
      if (!seenPupils[pupil.id]) { seenPupils[pupil.id] = true; stats.pupils++; }
      var en = ensureEnrolment(db, row, pupil.id, course.id, cl ? cl.id : null, teacher.id,
        row.current_level, row.target_grade, row.working_grade);
      if (!en) {
        stats.skipped++;
        stats.errors.push('Row ' + row._line + ': could not create enrolment');
        return;
      }
      stats.enrolments++;
      var tp = findTrackingPoint(db, row.tracking_point) || (db.school_tracking_points || [])[0];
      if (tp) {
        upsertTrackingRow(db, en.id, tp.id, row, batchId);
        stats.tracking++;
      }
      stats.processed++;
    });

    global.SptStore.insertRecord(db, 'import_batches', {
      id: batchId,
      filename: options.filename || 'workbook.xlsx',
      uploaded_by: (global.SptConfig.ROLES[db.dev_role] || {}).label || 'Faculty Head',
      row_count: stats.processed,
      status: 'completed'
    }, 'import_batch');
    if (global.SptRisk) global.SptRisk.recalculateAll(db);
    global.SptStore.save(db);
    return stats;
  }

  global.SptTemplate = {
    HEADERS: HEADERS,
    hasXlsx: hasXlsx,
    downloadWorkbook: downloadWorkbook,
    parseWorkbook: parseWorkbook,
    buildImportPreview: buildImportPreview,
    commitWorkbookImport: commitWorkbookImport
  };
})(typeof window !== 'undefined' ? window : global);
