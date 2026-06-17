/**
 * Shared exam / prelim mark scaling: raw mark → percentage → grade band.
 */
(function(global) {
  'use strict';

  var C = global.SptConfig;

  function parseNum(val) {
    if (val === '' || val == null) return null;
    var n = parseFloat(val);
    return isNaN(n) ? null : n;
  }

  function roundPct(n) {
    return Math.round(n * 10) / 10;
  }

  function positiveNum(val, fallback) {
    var n = parseNum(val);
    return n != null && n > 0 ? n : fallback;
  }

  /**
   * Per-component paper total and scaled contribution.
   */
  function componentMarks(pc) {
    if (!pc) return { paper_marks: 100, scaled_marks: 100, weighting: 0 };
    var paper = pc.paper_marks != null ? pc.paper_marks : (pc.max_marks != null ? pc.max_marks : 100);
    var scaled = pc.scaled_marks != null ? pc.scaled_marks : paper;
    return {
      paper_marks: positiveNum(paper, 100),
      scaled_marks: positiveNum(scaled, paper),
      weighting: pc.weighting != null ? pc.weighting : 0
    };
  }

  function componentScaleLabel(pc) {
    var m = componentMarks(pc);
    if (m.paper_marks === m.scaled_marks) return '/' + m.paper_marks;
    return '/' + m.paper_marks + ' → ' + m.scaled_marks;
  }

  /** Points contributed toward weighted prelim total. */
  function componentContribution(raw, pc) {
    if (raw == null || isNaN(raw)) return 0;
    var m = componentMarks(pc);
    return (raw / m.paper_marks) * m.scaled_marks * (m.weighting / 100);
  }

  function componentMaxContribution(pc) {
    var m = componentMarks(pc);
    return m.scaled_marks * (m.weighting / 100);
  }

  function prelimPercentage(rawByComponentId, components) {
    var total = 0;
    var maxTotal = 0;
    var hasAny = false;
    (components || []).forEach(function(pc) {
      var max = componentMaxContribution(pc);
      maxTotal += max;
      var rawVal = rawByComponentId[pc.id];
      if (rawVal != null && rawVal !== '') {
        var raw = parseFloat(rawVal);
        if (!isNaN(raw)) {
          hasAny = true;
          total += componentContribution(raw, pc);
        }
      }
    });
    if (!hasAny || maxTotal <= 0) return null;
    return roundPct((total / maxTotal) * 100);
  }

  function percentageToGrade(pct) {
    if (pct == null) return '';
    return C.percentageToGrade(pct);
  }

  function s3ExamMarks(course) {
    if (!course) return { paper_marks: 100, scaled_marks: 100 };
    var defaults = (C.EXAM_DEFAULTS && C.EXAM_DEFAULTS.s3) || {};
    var slug = course.slug || course.default_assessment_model || '';
    var slugDefs = (C.EXAM_DEFAULTS_BY_COURSE && C.EXAM_DEFAULTS_BY_COURSE[slug]) || {};
    var paper = course.s3_exam_paper_marks != null ? course.s3_exam_paper_marks
      : (course.s3_max_marks != null ? course.s3_max_marks
        : (slugDefs.s3_paper_marks != null ? slugDefs.s3_paper_marks
          : (slugDefs.s3_max_marks != null ? slugDefs.s3_max_marks : defaults.paper_marks || 100)));
    var scaled = course.s3_exam_scaled_marks != null ? course.s3_exam_scaled_marks
      : (slugDefs.s3_scaled_marks != null ? slugDefs.s3_scaled_marks
        : (slugDefs.s3_max_marks != null ? slugDefs.s3_max_marks : paper));
    return {
      paper_marks: positiveNum(paper, 100),
      scaled_marks: positiveNum(scaled, paper)
    };
  }

  function s3ExamPercentage(raw, course) {
    if (raw == null || isNaN(raw)) return null;
    var m = s3ExamMarks(course);
    return roundPct((raw / m.paper_marks) * 100);
  }

  function computeS3Result(raw, course) {
    var pct = s3ExamPercentage(raw, course);
    if (pct == null) return null;
    return { percentage: pct, grade: percentageToGrade(pct) };
  }

  /** @deprecated use s3ExamMarks */
  function courseExamConfig(course, kind) {
    if (kind === 's3') {
      var m = s3ExamMarks(course);
      return { max_marks: m.paper_marks, paper_marks: m.paper_marks, scaled_marks: m.scaled_marks, use_scaling: true };
    }
    return { max_marks: 100, use_scaling: true };
  }

  function updateS3ExamMarks(db, courseId, patch) {
    var course = global.SptStore.byId(db.courses, courseId);
    if (!course) return null;
    var update = { updated_at: new Date().toISOString() };
    if (patch.paper_marks !== undefined) {
      update.s3_exam_paper_marks = positiveNum(patch.paper_marks, 100);
      update.s3_max_marks = update.s3_exam_paper_marks;
    }
    if (patch.scaled_marks !== undefined) {
      update.s3_exam_scaled_marks = positiveNum(patch.scaled_marks, update.s3_exam_paper_marks || course.s3_exam_paper_marks || 100);
    }
    global.SptStore.updateRecord(db, 'courses', courseId, update, 's3_exam_config');
    return global.SptStore.byId(db.courses, courseId);
  }

  /** @deprecated */
  function updateCourseExamConfig(db, courseId, kind, patch) {
    if (kind === 's3') {
      var p = {};
      if (patch.max_marks !== undefined) p.paper_marks = patch.max_marks;
      if (patch.paper_marks !== undefined) p.paper_marks = patch.paper_marks;
      if (patch.scaled_marks !== undefined) p.scaled_marks = patch.scaled_marks;
      return updateS3ExamMarks(db, courseId, p);
    }
    return null;
  }

  global.SptExamMark = {
    parseNum: parseNum,
    componentMarks: componentMarks,
    componentScaleLabel: componentScaleLabel,
    componentContribution: componentContribution,
    componentMaxContribution: componentMaxContribution,
    prelimPercentage: prelimPercentage,
    percentageToGrade: percentageToGrade,
    s3ExamMarks: s3ExamMarks,
    s3ExamPercentage: s3ExamPercentage,
    computeS3Result: computeS3Result,
    courseExamConfig: courseExamConfig,
    updateS3ExamMarks: updateS3ExamMarks,
    updateCourseExamConfig: updateCourseExamConfig
  };
})(typeof window !== 'undefined' ? window : global);
