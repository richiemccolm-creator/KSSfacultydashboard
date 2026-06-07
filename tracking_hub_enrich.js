/**
 * Tracking Hub — Phase 4: moderation + planner enrichment indexes
 */
(function(global) {
  'use strict';

  function lessonList(data) {
    if (!data) return [];
    if (Array.isArray(data.lessons)) return data.lessons;
    if (Array.isArray(data)) return data;
    return [];
  }

  function buildIndexes(rows) {
    var moderationByUser = {};
    var lessonsByUser = {};
    (rows || []).forEach(function(row) {
      if (!row || !row.user_id) return;
      if (row.data_type === 'moderation-data' && row.data) {
        moderationByUser[row.user_id] = row.data.entries || [];
      }
      if (row.data_type === 'plannerLessons' && row.data) {
        lessonsByUser[row.user_id] = lessonList(row.data);
      }
    });
    return { moderationByUser: moderationByUser, lessonsByUser: lessonsByUser };
  }

  function isTpModerated(entries, tp) {
    var tpNorm = String(tp || '').toLowerCase();
    if (!tpNorm) return false;
    return (entries || []).some(function(e) {
      var done = e && (e.status === 'completed' || e.completed === true);
      if (!done) return false;
      var id = String(e.id || e.unitId || e.unit_id || '').toLowerCase();
      return id === tpNorm || id.indexOf(tpNorm) >= 0 || id.indexOf(tpNorm.replace('tp', 'tp-')) >= 0;
    });
  }

  function moderationIcon(entries, tp) {
    if (!isTpModerated(entries, tp)) return '';
    return ' <i class="ti ti-shield-check th-mod-badge" title="Moderation completed" aria-hidden="true"></i>';
  }

  function classLessonCount(lessons, cls, yg) {
    var clsNorm = String(cls || '').toLowerCase();
    var ygNorm = String(yg || '').toLowerCase();
    var count = (lessons || []).filter(function(l) {
      var c = String(l.className || l.class || l.class_code || '').toLowerCase();
      var y = String(l.yearGroup || l.year_group || l.yg || '').toLowerCase();
      if (!c || c !== clsNorm) return false;
      if (ygNorm && y && y !== ygNorm) return false;
      return true;
    }).length;
    return count;
  }

  function lessonSubtitle(lessons, cls, yg) {
    var n = classLessonCount(lessons, cls, yg);
    if (!n) return '';
    return ' · ' + n + ' planned lesson' + (n === 1 ? '' : 's');
  }

  global.TrackingHubEnrich = {
    buildIndexes: buildIndexes,
    isTpModerated: isTpModerated,
    moderationIcon: moderationIcon,
    classLessonCount: classLessonCount,
    lessonSubtitle: lessonSubtitle
  };
})(window);
