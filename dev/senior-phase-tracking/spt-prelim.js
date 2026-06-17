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
    var rawById = {};
    var hasAny = false;
    comps.forEach(function(pc) {
      var mark = (db.prelim_marks || []).find(function(m) {
        return m.enrolment_id === enrolmentId && m.prelim_component_id === pc.id;
      });
      var rawVal = overrides && Object.prototype.hasOwnProperty.call(overrides, pc.id)
        ? overrides[pc.id]
        : (mark && mark.raw_mark != null ? mark.raw_mark : null);
      if (rawVal != null && rawVal !== '') {
        hasAny = true;
        rawById[pc.id] = rawVal;
      }
    });
    if (!hasAny) return null;
    var pct = global.SptExamMark
      ? global.SptExamMark.prelimPercentage(rawById, comps)
      : null;
    if (pct == null) return null;
    return {
      percentage: pct,
      grade_band: C.percentageToGrade(pct),
      raw_display: comps.map(function(pc) {
        var m = (db.prelim_marks || []).find(function(x) {
          return x.enrolment_id === enrolmentId && x.prelim_component_id === pc.id;
        });
        var label = global.SptExamMark ? global.SptExamMark.componentScaleLabel(pc) : ('/' + pc.max_marks);
        return (m && m.raw_mark != null ? m.raw_mark : '—') + label;
      }).join(', ')
    };
  }

  function updateComponentConfig(db, componentId, patch) {
    var allowed = { paper_marks: true, scaled_marks: true };
    var update = { updated_at: new Date().toISOString() };
    Object.keys(patch || {}).forEach(function(key) {
      if (!allowed[key]) return;
      var n = parseFloat(patch[key]);
      if (!isNaN(n) && n > 0) update[key] = n;
    });
    if (!Object.keys(patch || {}).some(function(key) { return allowed[key]; })) return null;
    if (update.paper_marks != null) update.max_marks = update.paper_marks;
    global.SptStore.updateRecord(db, 'prelim_components', componentId, update, 'prelim_component_config');
    return global.SptStore.byId(db.prelim_components, componentId);
  }

  function templateFromEntry(t) {
    var paper = t.paper_marks != null ? t.paper_marks : t.max_marks;
    var scaled = t.scaled_marks != null ? t.scaled_marks : paper;
    return {
      component_name: t.component_name,
      short_label: t.short_label || t.component_name,
      paper_marks: paper,
      scaled_marks: scaled,
      max_marks: paper,
      weighting: t.weighting
    };
  }

  function templateSignature(tpl) {
    return tpl.map(function(t) {
      var e = templateFromEntry(t);
      return [e.component_name, e.paper_marks, e.scaled_marks, e.weighting, e.short_label || ''].join(':');
    }).join('|');
  }

  function existingSignature(components) {
    return components.slice().sort(function(a, b) { return a.display_order - b.display_order; }).map(function(pc) {
      var paper = pc.paper_marks != null ? pc.paper_marks : pc.max_marks;
      var scaled = pc.scaled_marks != null ? pc.scaled_marks : paper;
      return [pc.component_name, paper, scaled, pc.weighting, pc.short_label || ''].join(':');
    }).join('|');
  }

  function pushComponentsFromTemplate(db, course, prelimAp, tpl) {
    var now = new Date().toISOString();
    tpl.forEach(function(t, i) {
      var e = templateFromEntry(t);
      db.prelim_components.push({
        id: 'pc-' + course.slug + '-' + i,
        course_id: course.id,
        assessment_point_id: prelimAp.id,
        component_name: e.component_name,
        short_label: e.short_label,
        paper_marks: e.paper_marks,
        scaled_marks: e.scaled_marks,
        max_marks: e.paper_marks,
        weighting: e.weighting,
        display_order: i + 1,
        created_at: now,
        updated_at: now
      });
    });
  }

  function patchComponentScales(db) {
    var changed = false;
    (db.prelim_components || []).forEach(function(pc) {
      if (pc.paper_marks == null && pc.max_marks != null) {
        pc.paper_marks = pc.max_marks;
        changed = true;
      }
      if (pc.scaled_marks == null) {
        pc.scaled_marks = pc.paper_marks != null ? pc.paper_marks : pc.max_marks;
        changed = true;
      }
      if (pc.paper_marks != null && pc.max_marks !== pc.paper_marks) {
        pc.max_marks = pc.paper_marks;
        changed = true;
      }
    });
    return changed;
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
    updateComponentConfig: updateComponentConfig,
    patchComponentScales: patchComponentScales,
    columnLabel: columnLabel
  };
})(typeof window !== 'undefined' ? window : global);
