/**
 * Read-only Excel download of currently loaded Senior Phase tracking.
 * Does not save, sync, upsert, migrate, normalise, or write to Supabase.
 */
(function(global) {
  'use strict';

  function byId(arr, id) {
    if (!id) return null;
    return (arr || []).find(function(x) { return x && x.id === id; }) || null;
  }

  function cell(v) {
    if (v == null || v === '') return '';
    return v;
  }

  function displayPupil(pupil) {
    if (!pupil) return '';
    var first = pupil.preferred_name || pupil.first_name || '';
    var last = pupil.surname || '';
    return [first, last].filter(Boolean).join(' ');
  }

  function displayTeacher(teacher) {
    if (!teacher) return '';
    return [teacher.first_name, teacher.surname].filter(Boolean).join(' ');
  }

  function viewableEnrolments(db) {
    var canView = global.SptStore && typeof global.SptStore.canViewEnrolment === 'function'
      ? function(en) { return global.SptStore.canViewEnrolment(db, en); }
      : function() { return true; };
    return (db.enrolments || []).filter(function(en) {
      return en && en.active_status !== false && canView(en);
    });
  }

  function trackingPointsCopy(db) {
    return (db.school_tracking_points || []).slice().sort(function(a, b) {
      var ao = a && a.display_order;
      var bo = b && b.display_order;
      if (ao != null && bo != null && ao !== bo) return ao - bo;
      return String((a && a.tracking_point_date) || '').localeCompare(String((b && b.tracking_point_date) || ''));
    });
  }

  function findAttendance(db, enrolmentId, tpId) {
    return (db.attendance_records || []).find(function(a) {
      return a && a.enrolment_id === enrolmentId && a.tracking_point_id === tpId;
    }) || null;
  }

  function findTracking(db, enrolmentId, tpId) {
    return (db.pupil_tracking_data || []).find(function(t) {
      return t && t.enrolment_id === enrolmentId && t.tracking_point_id === tpId;
    }) || null;
  }

  function findBaseline(db, enrolmentId) {
    return (db.enrolment_baselines || []).find(function(b) {
      return b && b.enrolment_id === enrolmentId;
    }) || null;
  }

  function findPrior(db, pupilId, course) {
    if (!pupilId || !course || !course.subject_area) return null;
    return (db.prior_attainment || []).find(function(p) {
      return p && p.pupil_id === pupilId && p.subject_area === course.subject_area;
    }) || null;
  }

  function findPrelimPoint(db, courseId) {
    return (db.assessment_points || []).find(function(ap) {
      return ap && ap.course_id === courseId && ap.assessment_type === 'Prelim';
    }) || null;
  }

  function storedPrelim(db, enrolment) {
    var ap = findPrelimPoint(db, enrolment.course_id);
    var detailParts = (db.prelim_marks || []).filter(function(m) {
      return m && m.enrolment_id === enrolment.id && m.raw_mark != null && m.raw_mark !== '';
    }).map(function(m) { return m.raw_mark; });
    var result = ap ? (db.pupil_assessment_results || []).find(function(r) {
      return r && r.enrolment_id === enrolment.id && r.assessment_point_id === ap.id;
    }) : null;
    return {
      detail: detailParts.join(' · '),
      pct: result && result.percentage != null ? result.percentage : (result && result.score != null ? result.score : ''),
      grade: result && result.grade != null ? result.grade : ''
    };
  }

  function storedConcerns(db, enrolmentId) {
    return (db.teacher_concerns || []).filter(function(f) {
      return f && f.enrolment_id === enrolmentId;
    }).map(function(f) {
      return [f.category, f.status].filter(Boolean).join(' ');
    }).join('; ');
  }

  function tpLabel(tp, index) {
    if (tp && tp.tracking_point_name) return tp.tracking_point_name;
    return 'TP' + (index + 1);
  }

  function showsS3Baseline(course, enrolment) {
    if (global.SptBaseline && typeof global.SptBaseline.showsS3Baseline === 'function') {
      return global.SptBaseline.showsS3Baseline(course, enrolment);
    }
    return !!(course && course.course_type === 'N5/N4 Combined');
  }

  function s3ExamValues(baseline) {
    if (!baseline) return { raw: '', pct: '', grade: '' };
    return {
      raw: baseline.s3_exam_raw != null && baseline.s3_exam_raw !== '' ? baseline.s3_exam_raw : '',
      pct: baseline.s3_exam_mark != null ? baseline.s3_exam_mark : '',
      grade: baseline.s3_exam_grade || ''
    };
  }

  function s3BaselineScores(baseline, include) {
    if (!include || !baseline) {
      return { effort: '', behaviour: '', homelearning: '', progress: '', cfe_level: '', notes: '' };
    }
    return {
      effort: cell(baseline.effort),
      behaviour: cell(baseline.behaviour),
      homelearning: cell(baseline.homelearning),
      progress: cell(baseline.progress),
      cfe_level: cell(baseline.cfe_level),
      notes: cell(baseline.notes)
    };
  }

  function sortedEnrolments(db, enrolments) {
    return enrolments.slice().sort(function(a, b) {
      var ca = byId(db.classes, a.class_id);
      var cb = byId(db.classes, b.class_id);
      var classCmp = String((ca && ca.class_name) || '').localeCompare(String((cb && cb.class_name) || ''));
      if (classCmp) return classCmp;
      var pa = byId(db.pupils, a.pupil_id);
      var pb = byId(db.pupils, b.pupil_id);
      var sur = String((pa && pa.surname) || '').localeCompare(String((pb && pb.surname) || ''));
      if (sur) return sur;
      return String((pa && pa.first_name) || '').localeCompare(String((pb && pb.first_name) || ''));
    });
  }

  function trackingSheet(db, enrolments, tps) {
    var tail = ['Prelim marks', 'Prelim %', 'Prelim grade', 'Working grade', 'Target', 'Risk'];
    var head1 = ['Pupil', 'Year', 'Class', 'Course', 'Level', 'Teacher',
      'S3 Exam', '', '', 'S3 baseline', '', '', '', '',
      'Prior', 'Pathway', 'EOY att', 'Concern'];
    tps.forEach(function(tp, i) {
      head1.push(tpLabel(tp, i), '', '', '');
    });
    head1 = head1.concat(tail);
    var head2 = ['', '', '', '', '', '',
      'Mark', '%', 'Gr', 'Eff', 'Beh', 'HL', 'Prog', 'CfE',
      '', '', '', ''];
    tps.forEach(function() {
      head2.push('Att', 'WG', 'Eff', 'Beh');
    });
    head2 = head2.concat(['', '', '', '', '', '']);
    var rows = [head1, head2];

    sortedEnrolments(db, enrolments).forEach(function(en) {
      var pupil = byId(db.pupils, en.pupil_id);
      var course = byId(db.courses, en.course_id);
      var cl = byId(db.classes, en.class_id);
      var teacher = byId(db.teachers, en.teacher_id);
      var includeS3 = showsS3Baseline(course, en);
      var baseline = includeS3 ? findBaseline(db, en.id) : null;
      var exam = s3ExamValues(baseline);
      var scores = s3BaselineScores(baseline, includeS3);
      var prior = findPrior(db, en.pupil_id, course);
      var prelim = storedPrelim(db, en);
      var row = [
        displayPupil(pupil),
        cell(pupil && pupil.year_group),
        cell(cl && cl.class_name),
        cell(course && course.course_name),
        cell(en.current_level),
        displayTeacher(teacher),
        cell(exam.raw),
        cell(exam.pct),
        cell(exam.grade),
        scores.effort,
        scores.behaviour,
        scores.homelearning,
        scores.progress,
        scores.cfe_level,
        cell(prior && prior.result_grade),
        cell(prior && prior.pathway_status),
        cell(pupil && pupil.end_of_year_attendance_percent),
        storedConcerns(db, en.id)
      ];
      tps.forEach(function(tp) {
        var att = findAttendance(db, en.id, tp.id);
        var tr = findTracking(db, en.id, tp.id);
        row.push(
          cell(att && att.attendance_percent),
          cell(att && att.attendance_score),
          cell(tr && tr.effort),
          cell(tr && tr.behaviour)
        );
      });
      row.push(
        prelim.detail,
        cell(prelim.pct),
        cell(prelim.grade),
        cell(en.latest_working_grade),
        cell(en.target_grade),
        cell(en.risk_status)
      );
      rows.push(row);
    });

    var merges = [];
    var identRowspan = [0, 1, 2, 3, 4, 5, 14, 15, 16, 17];
    identRowspan.forEach(function(c) {
      merges.push({ s: { r: 0, c: c }, e: { r: 1, c: c } });
    });
    merges.push({ s: { r: 0, c: 6 }, e: { r: 0, c: 8 } });
    merges.push({ s: { r: 0, c: 9 }, e: { r: 0, c: 13 } });
    var col = 18;
    tps.forEach(function() {
      merges.push({ s: { r: 0, c: col }, e: { r: 0, c: col + 3 } });
      col += 4;
    });
    for (var t = 0; t < 6; t++) {
      merges.push({ s: { r: 0, c: col + t }, e: { r: 1, c: col + t } });
    }
    return { aoa: rows, merges: merges };
  }

  function s3BaselineSheet(db, enrolments) {
    var rows = [[
      'Pupil', 'Year', 'Class', 'Course', 'Level', 'Teacher',
      'S3 mark', 'S3 %', 'S3 grade',
      'Effort', 'Behaviour', 'Home learning', 'Progress', 'CfE level',
      'EOY att', 'Notes', 'Source', 'Locked'
    ]];
    var s3Enrolments = sortedEnrolments(db, enrolments).filter(function(en) {
      return showsS3Baseline(byId(db.courses, en.course_id), en);
    });
    s3Enrolments.forEach(function(en) {
      var pupil = byId(db.pupils, en.pupil_id);
      var course = byId(db.courses, en.course_id);
      var cl = byId(db.classes, en.class_id);
      var teacher = byId(db.teachers, en.teacher_id);
      var baseline = findBaseline(db, en.id);
      var exam = s3ExamValues(baseline);
      var scores = s3BaselineScores(baseline, true);
      rows.push([
        displayPupil(pupil),
        cell(pupil && pupil.year_group),
        cell(cl && cl.class_name),
        cell(course && course.course_name),
        cell(en.current_level),
        displayTeacher(teacher),
        cell(exam.raw),
        cell(exam.pct),
        cell(exam.grade),
        scores.effort,
        scores.behaviour,
        scores.homelearning,
        scores.progress,
        scores.cfe_level,
        cell(pupil && pupil.end_of_year_attendance_percent),
        scores.notes,
        cell(baseline && baseline.source),
        baseline && baseline.locked_at ? baseline.locked_at : ''
      ]);
    });
    return rows;
  }

  function pupilsSheet(db, enrolments) {
    var seen = {};
    var rows = [['First name', 'Surname', 'Preferred name', 'Year', 'Candidate number', 'Class group']];
    var body = [];
    enrolments.forEach(function(en) {
      if (!en.pupil_id || seen[en.pupil_id]) return;
      seen[en.pupil_id] = true;
      var p = byId(db.pupils, en.pupil_id);
      if (!p) return;
      body.push([
        cell(p.first_name),
        cell(p.surname),
        cell(p.preferred_name),
        cell(p.year_group),
        cell(p.candidate_number),
        cell(p.class_group)
      ]);
    });
    body.sort(function(a, b) {
      var sur = String(a[1]).localeCompare(String(b[1]));
      return sur || String(a[0]).localeCompare(String(b[0]));
    });
    return rows.concat(body);
  }

  function classesSheet(db, enrolments) {
    var counts = {};
    enrolments.forEach(function(en) {
      var key = en.class_id || ('course:' + en.course_id);
      if (!counts[key]) {
        var cl = byId(db.classes, en.class_id);
        var course = byId(db.courses, en.course_id);
        var teacher = byId(db.teachers, (cl && cl.teacher_id) || en.teacher_id);
        counts[key] = {
          class_name: cl ? cl.class_name : '',
          teacher: displayTeacher(teacher),
          course: course ? course.course_name : '',
          year: cl ? cl.academic_year : '',
          pupils: 0
        };
      }
      counts[key].pupils += 1;
    });
    var rows = [['Class', 'Teacher', 'Course', 'Academic year', 'Enrolments']];
    Object.keys(counts).sort(function(a, b) {
      return String(counts[a].class_name).localeCompare(String(counts[b].class_name));
    }).forEach(function(key) {
      var c = counts[key];
      rows.push([c.class_name, c.teacher, c.course, c.year, c.pupils]);
    });
    return rows;
  }

  function styleSheet(ws, colCount, freezeRows) {
    var ySplit = freezeRows == null ? 2 : freezeRows;
    ws['!views'] = [{
      state: 'frozen',
      xSplit: 1,
      ySplit: ySplit,
      topLeftCell: 'B' + (ySplit + 1),
      activeCell: 'A' + (ySplit + 1)
    }];
    ws['!cols'] = [];
    for (var i = 0; i < colCount; i++) {
      ws['!cols'].push({ wch: i === 0 ? 22 : (i === 3 || i === 17 ? 18 : 12) });
    }
  }

  function downloadSpreadsheet(db) {
    if (!db || typeof db !== 'object') {
      return { error: 'No tracking data loaded to export.' };
    }
    if (typeof global.XLSX === 'undefined' || !global.XLSX.utils || !global.XLSX.writeFile) {
      return { error: 'Excel library not loaded.' };
    }
    var enrolments = viewableEnrolments(db);
    var tps = trackingPointsCopy(db);
    var tracking = trackingSheet(db, enrolments, tps);
    var s3Rows = s3BaselineSheet(db, enrolments);
    var wb = global.XLSX.utils.book_new();
    var trackWs = global.XLSX.utils.aoa_to_sheet(tracking.aoa);
    trackWs['!merges'] = tracking.merges;
    styleSheet(trackWs, tracking.aoa[0].length, 2);
    global.XLSX.utils.book_append_sheet(wb, trackWs, 'Tracking');
    var s3Ws = global.XLSX.utils.aoa_to_sheet(s3Rows);
    styleSheet(s3Ws, s3Rows[0].length, 1);
    global.XLSX.utils.book_append_sheet(wb, s3Ws, 'S3 baseline');
    global.XLSX.utils.book_append_sheet(wb, global.XLSX.utils.aoa_to_sheet(pupilsSheet(db, enrolments)), 'Pupils');
    global.XLSX.utils.book_append_sheet(wb, global.XLSX.utils.aoa_to_sheet(classesSheet(db, enrolments)), 'Classes');
    var stamp = new Date().toISOString().slice(0, 10);
    var filename = 'senior-phase-tracking-' + stamp + '.xlsx';
    global.XLSX.writeFile(wb, filename);
    return { ok: true, filename: filename, rows: tracking.aoa.length - 2 };
  }

  global.SptExport = {
    downloadSpreadsheet: downloadSpreadsheet
  };
})(typeof window !== 'undefined' ? window : global);
