/**
 * Prelim component marks and scaled totals.
 */
(function(global) {
  'use strict';

  var C = global.SptConfig;

  function componentsForCourse(db, courseId) {
    return (db.prelim_components || [])
      .filter(function(pc) { return pc.course_id === courseId; })
      .sort(function(a, b) { return a.display_order - b.display_order; });
  }

  function marksForEnrolment(db, enrolmentId, assessmentPointId) {
    var compIds = (db.prelim_components || [])
      .filter(function(pc) { return pc.assessment_point_id === assessmentPointId; })
      .map(function(pc) { return pc.id; });
    return (db.prelim_marks || []).filter(function(m) {
      return m.enrolment_id === enrolmentId && compIds.indexOf(m.prelim_component_id) >= 0;
    });
  }

  function computeSummary(db, enrolmentId, assessmentPointId, overrides) {
    var comps = (db.prelim_components || []).filter(function(pc) {
      return pc.assessment_point_id === assessmentPointId;
    });
    if (!comps.length) return null;
    var totalMax = 0;
    var weighted = 0;
    var hasAny = false;
    comps.forEach(function(pc) {
      var mark = (db.prelim_marks || []).find(function(m) {
        return m.enrolment_id === enrolmentId && m.prelim_component_id === pc.id;
      });
      var max = pc.max_marks || 0;
      totalMax += max;
      var rawVal = overrides && Object.prototype.hasOwnProperty.call(overrides, pc.id)
        ? overrides[pc.id]
        : (mark && mark.raw_mark != null ? mark.raw_mark : null);
      if (rawVal != null && rawVal !== '') {
        hasAny = true;
        var raw = parseFloat(rawVal);
        if (!isNaN(raw)) weighted += (raw / max) * (pc.weighting || 100);
      }
    });
    if (!hasAny) return null;
    var pct = Math.round(weighted * 10) / 10;
    return {
      percentage: pct,
      grade_band: C.percentageToGrade(pct),
      raw_display: comps.map(function(pc) {
        var m = (db.prelim_marks || []).find(function(x) {
          return x.enrolment_id === enrolmentId && x.prelim_component_id === pc.id;
        });
        return (m && m.raw_mark != null ? m.raw_mark : '—') + '/' + pc.max_marks;
      }).join(', ')
    };
  }

  function saveMark(db, enrolmentId, componentId, rawMark) {
    var existing = (db.prelim_marks || []).find(function(m) {
      return m.enrolment_id === enrolmentId && m.prelim_component_id === componentId;
    });
    var patch = { raw_mark: rawMark === '' ? null : parseFloat(rawMark), updated_at: new Date().toISOString() };
    if (existing) {
      global.SptStore.updateRecord(db, 'prelim_marks', existing.id, patch, 'prelim_mark_update');
    } else {
      global.SptStore.insertRecord(db, 'prelim_marks', {
        enrolment_id: enrolmentId,
        prelim_component_id: componentId,
        raw_mark: patch.raw_mark
      }, 'prelim_mark_insert');
    }
    var comp = global.SptStore.byId(db.prelim_components, componentId);
    if (comp) {
      var summary = computeSummary(db, enrolmentId, comp.assessment_point_id);
      var ap = comp.assessment_point_id;
      if (summary) {
        global.SptStore.upsertAssessmentResult(db, enrolmentId, ap, {
          score: summary.percentage,
          grade: summary.grade_band,
          completion_status: 'Complete',
          assessment_date: new Date().toISOString().slice(0, 10)
        });
      }
    }
    global.SptRisk.recalculateEnrolment(db, enrolmentId);
    global.SptStore.save(db);
  }

  function templateSignature(tpl) {
    return tpl.map(function(t) {
      return [t.component_name, t.max_marks, t.weighting, t.short_label || ''].join(':');
    }).join('|');
  }

  function existingSignature(components) {
    return components.slice().sort(function(a, b) { return a.display_order - b.display_order; }).map(function(pc) {
      return [pc.component_name, pc.max_marks, pc.weighting, pc.short_label || ''].join(':');
    }).join('|');
  }

  function pushComponentsFromTemplate(db, course, prelimAp, tpl) {
    var now = new Date().toISOString();
    tpl.forEach(function(t, i) {
      db.prelim_components.push({
        id: 'pc-' + course.slug + '-' + i,
        course_id: course.id,
        assessment_point_id: prelimAp.id,
        component_name: t.component_name,
        short_label: t.short_label || t.component_name,
        max_marks: t.max_marks,
        weighting: t.weighting,
        display_order: i + 1,
        created_at: now,
        updated_at: now
      });
    });
  }

  function buildComponentsFromConfig(db) {
    db.prelim_components = db.prelim_components || [];
    db.courses.forEach(function(course) {
      var slug = course.slug || course.default_assessment_model;
      var tpl = C.PRELIM_COMPONENT_TEMPLATES[slug];
      if (!tpl || !course.has_prelim) return;
      var prelimAp = (db.assessment_points || []).find(function(ap) {
        return ap.course_id === course.id && ap.assessment_type === 'Prelim';
      });
      if (!prelimAp) return;
      var existing = db.prelim_components.filter(function(pc) { return pc.course_id === course.id; });
      if (existing.length) return;
      pushComponentsFromTemplate(db, course, prelimAp, tpl);
    });
  }

  /** Rebuild prelim components when config templates change (e.g. written + practical). */
  function syncComponentsFromConfig(db) {
    db.prelim_components = db.prelim_components || [];
    db.prelim_marks = db.prelim_marks || [];
    var changed = false;
    db.courses.forEach(function(course) {
      var slug = course.slug || course.default_assessment_model;
      var tpl = C.PRELIM_COMPONENT_TEMPLATES[slug];
      var prelimAp = (db.assessment_points || []).find(function(ap) {
        return ap.course_id === course.id && ap.assessment_type === 'Prelim';
      });
      if (!course.has_prelim || !tpl || !prelimAp) {
        var stale = db.prelim_components.filter(function(pc) { return pc.course_id === course.id; });
        if (stale.length) {
          var staleIds = stale.map(function(pc) { return pc.id; });
          db.prelim_components = db.prelim_components.filter(function(pc) { return pc.course_id !== course.id; });
          db.prelim_marks = db.prelim_marks.filter(function(m) {
            return staleIds.indexOf(m.prelim_component_id) < 0;
          });
          changed = true;
        }
        return;
      }
      var existing = db.prelim_components.filter(function(pc) { return pc.course_id === course.id; });
      if (existing.length && templateSignature(tpl) === existingSignature(existing)) {
        existing.forEach(function(pc, i) {
          var t = tpl[i];
          if (!t) return;
          if (!pc.short_label && t.short_label) {
            pc.short_label = t.short_label;
            changed = true;
          }
        });
        return;
      }
      var oldIds = existing.map(function(pc) { return pc.id; });
      db.prelim_components = db.prelim_components.filter(function(pc) { return pc.course_id !== course.id; });
      db.prelim_marks = db.prelim_marks.filter(function(m) {
        return oldIds.indexOf(m.prelim_component_id) < 0;
      });
      pushComponentsFromTemplate(db, course, prelimAp, tpl);
      changed = true;
    });
    return changed;
  }

  function columnLabel(pc) {
    if (pc.short_label) return pc.short_label;
    var n = pc.component_name || '';
    return n.length > 12 ? n.slice(0, 10) + '…' : n;
  }

  global.SptPrelim = {
    componentsForCourse: componentsForCourse,
    marksForEnrolment: marksForEnrolment,
    computeSummary: computeSummary,
    saveMark: saveMark,
    buildComponentsFromConfig: buildComponentsFromConfig,
    syncComponentsFromConfig: syncComponentsFromConfig,
    columnLabel: columnLabel
  };
})(typeof window !== 'undefined' ? window : global);
