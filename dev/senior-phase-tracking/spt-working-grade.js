/**
 * Per–tracking-period working grade (WG) scale for Senior Phase tracking.
 * Stored in attendance_records.attendance_score (legacy field name).
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
    8: 'No Award'
  };

  var INTERNAL_OVERRIDES = {
    6: 'Pass',
    7: 'Borderline Fail',
    8: 'Not going to achieve'
  };

  var INTERNAL_COURSE_SLUGS = ['creative-industries', 'l6l5-film'];

  var SCALE = [1, 2, 3, 4, 5, 6, 7, 8];

  function usesInternalScale(course) {
    if (!course) return false;
    return INTERNAL_COURSE_SLUGS.indexOf(course.slug) >= 0;
  }

  function label(score, course) {
    var n = parseInt(score, 10);
    if (isNaN(n) || n < 1 || n > 8) return '';
    if (usesInternalScale(course) && INTERNAL_OVERRIDES[n]) return INTERNAL_OVERRIDES[n];
    return EXAM_LABELS[n] || '';
  }

  function optionText(score, course) {
    var lbl = label(score, course);
    return lbl ? (score + ' — ' + lbl) : String(score);
  }

  function scoreClass(score, course) {
    var n = parseInt(score, 10);
    if (isNaN(n) || n < 1 || n > 8) return 'wg-empty';
    if (usesInternalScale(course)) {
      if (n >= 8) return 'wg-8';
      if (n >= 7) return 'wg-7';
      if (n >= 6) return 'wg-6';
      if (n >= 5) return 'wg-5';
      if (n >= 4) return 'wg-4';
      return 'wg-good';
    }
    if (n >= 8) return 'wg-8';
    if (n >= 7) return 'wg-7';
    if (n >= 6) return 'wg-6';
    if (n >= 5) return 'wg-5';
    if (n >= 4) return 'wg-4';
    return 'wg-good';
  }

  function assessRisk(score, course) {
    var n = parseInt(score, 10);
    if (isNaN(n) || n < 1 || n > 8) return null;
    if (usesInternalScale(course)) {
      if (n >= 8) return { level: 'red', reason: 'WG not going to achieve (TP)' };
      if (n >= 7) return { level: 'amber', reason: 'WG borderline fail (TP)' };
      return null;
    }
    if (n >= 8) return { level: 'red', reason: 'WG No Award (TP)' };
    if (n >= 7) return { level: 'red', reason: 'WG grade D (TP)' };
    if (n >= 6) return { level: 'amber', reason: 'WG grade C2 (TP)' };
    if (n >= 5) return { level: 'amber', reason: 'WG grade C1 (TP)' };
    return null;
  }

  function migrateLegacyScore(score) {
    var n = parseInt(score, 10);
    if (isNaN(n) || n > 4) return n;
    var map = { 1: 7, 2: 6, 3: 4, 4: 3 };
    return map[n] != null ? map[n] : n;
  }

  global.SptWorkingGrade = {
    EXAM_LABELS: EXAM_LABELS,
    INTERNAL_OVERRIDES: INTERNAL_OVERRIDES,
    INTERNAL_COURSE_SLUGS: INTERNAL_COURSE_SLUGS,
    SCALE: SCALE,
    usesInternalScale: usesInternalScale,
    label: label,
    optionText: optionText,
    scoreClass: scoreClass,
    assessRisk: assessRisk,
    migrateLegacyScore: migrateLegacyScore
  };
})(typeof window !== 'undefined' ? window : global);
