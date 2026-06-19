/**
 * Per–tracking-period working grade (WG) scale for Senior Phase tracking.
 * Stored in attendance_records.attendance_score (legacy field name).
 *
 * Exam-route courses (Higher, Drama, Art, etc.): 1–9
 * Pass/fail courses (Film & Screen, Creative Industries, NPAs): 6–8 only
 */
(function(global) {
  'use strict';

  var EXAM_LABELS = {
    1: 'A1',
    2: 'A2',
    3: 'B1',
    4: 'B2',
    5: 'C1',
    6: 'C2',
    7: 'D',
    8: 'No Award',
    9: 'Not presented'
  };

  var PASS_FAIL_LABELS = {
    6: 'Pass',
    7: 'Borderline Fail',
    8: 'Not going to achieve'
  };

  var EXAM_SCALE = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  var PASS_FAIL_SCALE = [6, 7, 8];

  function usesPassFailScale(course) {
    if (!course) return false;
    if (global.SptEvidence && global.SptEvidence.isPassFailCourse) {
      return global.SptEvidence.isPassFailCourse(course);
    }
    return course.slug === 'creative-industries' ||
      course.slug === 'l6l5-film' ||
      course.slug === 'npa-photo';
  }

  function scaleForCourse(course) {
    return usesPassFailScale(course) ? PASS_FAIL_SCALE : EXAM_SCALE;
  }

  function validRange(course) {
    if (usesPassFailScale(course)) return { min: 6, max: 8 };
    return { min: 1, max: 9 };
  }

  function isValidScore(score, course) {
    var n = parseInt(score, 10);
    if (isNaN(n)) return false;
    var range = validRange(course);
    return n >= range.min && n <= range.max;
  }

  function label(score, course) {
    var n = parseInt(score, 10);
    if (usesPassFailScale(course)) {
      return PASS_FAIL_LABELS[n] || '';
    }
    return EXAM_LABELS[n] || '';
  }

  function optionText(score, course) {
    var lbl = label(score, course);
    return lbl ? (score + ' — ' + lbl) : String(score);
  }

  function scoreClass(score, course) {
    var n = parseInt(score, 10);
    if (!isValidScore(n, course)) return 'wg-empty';
    if (usesPassFailScale(course)) {
      if (n >= 8) return 'wg-8';
      if (n >= 7) return 'wg-7';
      return 'wg-6';
    }
    if (n >= 9) return 'wg-9';
    if (n >= 8) return 'wg-8';
    if (n >= 7) return 'wg-7';
    if (n >= 6) return 'wg-6';
    if (n >= 5) return 'wg-5';
    if (n >= 4) return 'wg-4';
    return 'wg-good';
  }

  function assessRisk(score, course) {
    var n = parseInt(score, 10);
    if (!isValidScore(n, course)) return null;
    if (usesPassFailScale(course)) {
      if (n >= 8) return { level: 'red', reason: 'WG not going to achieve (TP)' };
      if (n >= 7) return { level: 'amber', reason: 'WG borderline fail (TP)' };
      return null;
    }
    if (n >= 9) return { level: 'red', reason: 'WG not presented (TP)' };
    if (n >= 8) return { level: 'red', reason: 'WG No Award (TP)' };
    if (n >= 7) return { level: 'red', reason: 'WG grade D (TP)' };
    if (n >= 6) return { level: 'amber', reason: 'WG grade C2 (TP)' };
    if (n >= 5) return { level: 'amber', reason: 'WG grade C1 (TP)' };
    return null;
  }

  function migrateLegacyScore(score, course) {
    var n = parseInt(score, 10);
    if (isNaN(n)) return n;
    if (usesPassFailScale(course)) {
      if (n < 6) return 6;
      if (n > 8) return 8;
      return n;
    }
    if (n > 4) return n;
    var map = { 1: 7, 2: 6, 3: 4, 4: 3 };
    return map[n] != null ? map[n] : n;
  }

  global.SptWorkingGrade = {
    EXAM_LABELS: EXAM_LABELS,
    PASS_FAIL_LABELS: PASS_FAIL_LABELS,
    EXAM_SCALE: EXAM_SCALE,
    PASS_FAIL_SCALE: PASS_FAIL_SCALE,
    SCALE: EXAM_SCALE,
    usesPassFailScale: usesPassFailScale,
    usesInternalScale: usesPassFailScale,
    scaleForCourse: scaleForCourse,
    validRange: validRange,
    isValidScore: isValidScore,
    label: label,
    optionText: optionText,
    scoreClass: scoreClass,
    assessRisk: assessRisk,
    migrateLegacyScore: migrateLegacyScore
  };
})(typeof window !== 'undefined' ? window : global);
