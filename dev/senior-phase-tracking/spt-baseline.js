/**
 * S3 entry baseline and prior attainment display for course grids.
 */
(function(global) {
  'use strict';

  var CFE_LEVELS = ['Second', 'Third', 'Fourth'];
  var SCORE_OPTS = [1, 2, 3, 4];

  function showsS3Baseline(course, enrolment) {
    if (!course || !enrolment) return false;
    return course.course_type === 'N5/N4 Combined';
  }

  function showsPriorEntry(course) {
    if (!course) return false;
    return course.course_type === 'Higher' || course.course_type === 'Advanced Higher';
  }

  function baselineForEnrolment(db, enrolmentId) {
    return (db.enrolment_baselines || []).find(function(b) { return b.enrolment_id === enrolmentId; }) || null;
  }

  function emptyBaseline(enrolmentId) {
    return {
      enrolment_id: enrolmentId,
      s3_exam_raw: null,
      s3_exam_mark: null,
      s3_exam_grade: '',
      effort: null,
      behaviour: null,
      homelearning: null,
      progress: null,
      cfe_level: '',
      source: 'manual',
      notes: '',
      locked_at: null
    };
  }

  function bandFromMark(val) {
    if (val === '' || val == null) return '';
    var s = String(val).trim().toUpperCase();
    if (s === 'NP' || s === 'NO PRESENTATION') return 'NP';
    if (/^(A|B|C|D|E|F|P)$/.test(s)) return s === 'P' ? 'P' : s;
    var n = parseFloat(s);
    if (isNaN(n)) return '';
    if (n < 0) return '';
    return global.SptConfig.percentageToGrade(Math.min(n, 100));
  }

  function s3ExamResult(baseline, course) {
    if (!baseline) return null;
    var raw = baseline.s3_exam_raw != null ? baseline.s3_exam_raw : baseline.s3_exam_mark;
    if (raw == null && baseline.s3_exam_mark == null) return null;
    if (global.SptExamMark) {
      return global.SptExamMark.computeS3Result(raw, course);
    }
    var pct = baseline.s3_exam_mark;
    return pct != null ? { percentage: pct, grade: bandFromMark(pct) } : null;
  }

  function applyS3ExamRaw(db, enrolmentId, rawVal, course) {
    var raw = rawVal === '' || rawVal == null ? null : parseFloat(rawVal);
    if (raw != null && isNaN(raw)) raw = null;
    var result = raw != null && global.SptExamMark
      ? global.SptExamMark.computeS3Result(raw, course)
      : null;
    return upsertBaseline(db, enrolmentId, {
      s3_exam_raw: raw,
      s3_exam_mark: result ? result.percentage : null,
      s3_exam_grade: result ? result.grade : ''
    });
  }

  function formatS3ExamDisplay(baseline, course) {
    if (!baseline) return '—';
    var result = s3ExamResult(baseline, course);
    if (!result) {
      var band = baseline.s3_exam_grade;
      return band ? band : '—';
    }
    var raw = baseline.s3_exam_raw != null ? baseline.s3_exam_raw : '';
    var marks = global.SptExamMark ? global.SptExamMark.s3ExamMarks(course) : { paper_marks: 100, scaled_marks: 100 };
    var markPart = raw !== '' ? raw + '/' + marks.paper_marks : '';
    if (raw !== '' && marks.paper_marks !== marks.scaled_marks) markPart += ' → ' + marks.scaled_marks;
    if (markPart) markPart += ' · ';
    return markPart + result.percentage + '% ' + (result.grade || '');
  }

  function upsertBaseline(db, enrolmentId, patch) {
    var existing = baselineForEnrolment(db, enrolmentId);
    if (existing) {
      global.SptStore.updateRecord(db, 'enrolment_baselines', existing.id, patch, 'baseline_update');
      return global.SptStore.byId(db.enrolment_baselines, existing.id);
    }
    return global.SptStore.insertRecord(db, 'enrolment_baselines',
      Object.assign(emptyBaseline(enrolmentId), patch), 'baseline_create');
  }

  function ensureBaseline(db, enrolmentId) {
    var en = global.SptStore.byId(db.enrolments, enrolmentId);
    var course = en ? global.SptStore.byId(db.courses, en.course_id) : null;
    if (!en || !showsS3Baseline(course, en)) return null;
    var b = baselineForEnrolment(db, enrolmentId);
    if (b) return b;
    return upsertBaseline(db, enrolmentId, { source: 'manual' });
  }

  var COMPLETED_PATHWAYS = ['Completed previous level', 'Completed'];
  var CRASHING_PATHWAYS = ['Crashing subject', 'First time in subject', 'First time', 'No prior entry'];
  var OVERRIDE_PATHWAYS = ['Not crashing (override)'];

  function isCrashingDismissed(prior) {
    return !!(prior && (prior.crashing_dismissed || OVERRIDE_PATHWAYS.indexOf(prior.pathway_status || '') >= 0));
  }

  function qualLevelMatches(level, courseType) {
    var lvl = (level || '').toLowerCase();
    if (courseType === 'Advanced Higher') {
      return lvl.indexOf('higher') >= 0 && lvl.indexOf('advanced') < 0;
    }
    if (courseType === 'Higher') {
      return lvl.indexOf('national 5') >= 0 || lvl.indexOf('n5') >= 0;
    }
    return false;
  }

  function priorsForSubject(db, pupilId, subjectArea) {
    return (db.prior_attainment || []).filter(function(p) {
      return p.pupil_id === pupilId && p.subject_area === subjectArea;
    });
  }

  function hasQualifyingPrior(db, pupilId, course) {
    return priorsForSubject(db, pupilId, course.subject_area).some(function(p) {
      return qualLevelMatches(p.qualification_level, course.course_type) &&
        p.result_grade && String(p.result_grade).trim();
    });
  }

  function isCrashingSubject(db, enrolment, course) {
    if (!showsPriorEntry(course)) return false;
    var prior = priorForCourse(db, enrolment.pupil_id, course);
    if (prior && isCrashingDismissed(prior)) return false;
    if (prior) {
      var ps = prior.pathway_status || '';
      if (ps === 'Crashed / withdrew') {
        return !hasQualifyingPrior(db, enrolment.pupil_id, course);
      }
      if (CRASHING_PATHWAYS.indexOf(ps) >= 0) return true;
      if (COMPLETED_PATHWAYS.indexOf(ps) >= 0) {
        if (!prior.result_grade || !String(prior.result_grade).trim()) return false;
        return !qualLevelMatches(prior.qualification_level, course.course_type);
      }
    }
    return !hasQualifyingPrior(db, enrolment.pupil_id, course);
  }

  function priorForCourse(db, pupilId, course) {
    var list = priorsForSubject(db, pupilId, course.subject_area);
    if (!list.length) return null;
    return list.sort(function(a, b) {
      return (b.qualification_year || '').localeCompare(a.qualification_year || '');
    })[0];
  }

  function priorDisplay(prior, crashing) {
    if (!prior) {
      return { grade: '—', pathway: '—', crashing_subject: !!crashing };
    }
    return {
      grade: prior.result_grade || '—',
      pathway: prior.pathway_status || '—',
      crashing_subject: !!crashing
    };
  }

  function emptyPrior(pupilId, course) {
    var qualLevel = 'National 5';
    if (course.course_type === 'Advanced Higher') qualLevel = 'Higher';
    else if (course.course_type === 'Higher') qualLevel = 'National 5';
    return {
      pupil_id: pupilId,
      subject_area: course.subject_area,
      qualification_year: '2024-25',
      qualification_level: qualLevel,
      result_grade: '',
      pathway_status: '',
      crashing_dismissed: false,
      notes: ''
    };
  }

  function upsertPriorForCourse(db, enrolmentId, patch) {
    var en = global.SptStore.byId(db.enrolments, enrolmentId);
    if (!en) return null;
    var course = global.SptStore.byId(db.courses, en.course_id);
    if (!course || !showsPriorEntry(course)) return null;
    var existing = priorForCourse(db, en.pupil_id, course);
    if (patch.pathway_status !== undefined) {
      if (OVERRIDE_PATHWAYS.indexOf(patch.pathway_status) >= 0) {
        patch.crashing_dismissed = true;
      } else if (CRASHING_PATHWAYS.indexOf(patch.pathway_status) >= 0) {
        patch.crashing_dismissed = false;
      } else if (COMPLETED_PATHWAYS.indexOf(patch.pathway_status) >= 0) {
        patch.crashing_dismissed = false;
      }
    }
    if (patch.crashing_dismissed === true && patch.pathway_status === undefined) {
      patch.pathway_status = OVERRIDE_PATHWAYS[0];
    }
    if (patch.result_grade !== undefined) {
      var grade = String(patch.result_grade || '').trim();
      if (grade && patch.qualification_level === undefined) {
        var defaults = emptyPrior(en.pupil_id, course);
        patch.qualification_level = (existing && existing.qualification_level) || defaults.qualification_level;
      }
    }
    if (existing) {
      global.SptStore.updateRecord(db, 'prior_attainment', existing.id, patch, 'prior_update');
      if (global.SptRisk) global.SptRisk.recalculateEnrolment(db, enrolmentId);
      return global.SptStore.byId(db.prior_attainment, existing.id);
    }
    var created = global.SptStore.insertRecord(db, 'prior_attainment',
      Object.assign(emptyPrior(en.pupil_id, course), patch), 'prior_create');
    if (global.SptRisk) global.SptRisk.recalculateEnrolment(db, enrolmentId);
    return created;
  }

  function scoreSelect(field, enrolmentId, val, canEdit) {
    if (!canEdit) return val != null ? String(val) : '—';
    var n = val != null && val !== '' ? parseInt(val, 10) : '';
    var cls = 'inline-select inline-select-sm score-select ' +
      (global.SptConfig.TRACKING_SCORE_CLASS[n] || 'score-empty');
    var opts = '<option value="">—</option>' + SCORE_OPTS.map(function(s) {
      var lbl = global.SptConfig.ATTENDANCE_LABELS[s];
      return '<option value="' + s + '"' + (n === s ? ' selected' : '') + '>' + s + '</option>';
    }).join('');
    return '<select class="' + cls + '" data-baseline="' + enrolmentId + '|' + field + '">' + opts + '</select>';
  }

  global.SptBaseline = {
    CFE_LEVELS: CFE_LEVELS,
    SCORE_OPTS: SCORE_OPTS,
    showsS3Baseline: showsS3Baseline,
    showsPriorEntry: showsPriorEntry,
    baselineForEnrolment: baselineForEnrolment,
    emptyBaseline: emptyBaseline,
    upsertBaseline: upsertBaseline,
    ensureBaseline: ensureBaseline,
    priorsForSubject: priorsForSubject,
    qualLevelMatches: qualLevelMatches,
    hasQualifyingPrior: hasQualifyingPrior,
    priorForCourse: priorForCourse,
    isCrashingSubject: isCrashingSubject,
    priorDisplay: priorDisplay,
    emptyPrior: emptyPrior,
    upsertPriorForCourse: upsertPriorForCourse,
    scoreSelect: scoreSelect,
    applyS3ExamRaw: applyS3ExamRaw,
    s3ExamResult: s3ExamResult,
    bandFromMark: bandFromMark,
    formatS3ExamDisplay: formatS3ExamDisplay
  };
})(typeof window !== 'undefined' ? window : global);
