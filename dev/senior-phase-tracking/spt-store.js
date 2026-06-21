/**
 * Local-only data store (localStorage) for Senior Phase Tracking dev preview.
 */
(function(global) {
  'use strict';

  var KEY = global.SptConfig.STORAGE_KEY;
  var VER = global.SptConfig.DATA_VERSION;

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function save(db, options) {
    options = options || {};
    db.version = VER;
    db.updated_at = new Date().toISOString();
    localStorage.setItem(KEY, JSON.stringify(db));
    if (!options.localOnly && !global.SptConfig.useSeedData && global.SptSync) {
      global.SptSync.schedulePush(db);
    }
    return db;
  }

  function importCloudSnapshot(data, options) {
    options = options || {};
    var db = data ? migrate(JSON.parse(JSON.stringify(data))) : buildEmpty();
    if (!db) db = buildEmpty();
    db.version = VER;
    db.updated_at = options.cloudUpdatedAt || db.updated_at || new Date().toISOString();
    localStorage.setItem(KEY, JSON.stringify(db));
    if (global.SptRisk) global.SptRisk.recalculateAll(db);
    return db;
  }

  function recordTs(r) {
    return String((r && r.updated_at) || (r && r.created_at) || '').trim();
  }

  function tsNewer(a, b) {
    return recordTs(a) >= recordTs(b);
  }

  function mergeById(localArr, remoteArr) {
    var map = {};
    (localArr || []).forEach(function(r) {
      if (r && r.id) map[r.id] = r;
    });
    (remoteArr || []).forEach(function(r) {
      if (!r || !r.id) return;
      var existing = map[r.id];
      if (!existing || tsNewer(r, existing)) map[r.id] = r;
    });
    return Object.keys(map).map(function(k) { return map[k]; });
  }

  function mergeFieldRecords(a, b, fields) {
    if (!a) return b ? Object.assign({}, b) : null;
    if (!b) return Object.assign({}, a);
    var out = Object.assign({}, a, { id: a.id || b.id });
    fields.forEach(function(f) {
      var av = a[f];
      var bv = b[f];
      var aSet = av != null && av !== '';
      var bSet = bv != null && bv !== '';
      if (aSet && !bSet) out[f] = av;
      else if (!aSet && bSet) out[f] = bv;
      else if (aSet && bSet) out[f] = tsNewer(a, b) ? av : bv;
    });
    out.updated_at = tsNewer(a, b) ? (a.updated_at || b.updated_at) : (b.updated_at || a.updated_at);
    return out;
  }

  function mergeByCompositeKey(localArr, remoteArr, keyFn, mergeFn) {
    var map = {};
    (localArr || []).forEach(function(r) {
      if (!r) return;
      var k = keyFn(r);
      if (k) map[k] = r;
    });
    (remoteArr || []).forEach(function(r) {
      if (!r) return;
      var k = keyFn(r);
      if (!k) return;
      map[k] = map[k] ? mergeFn(map[k], r) : r;
    });
    return Object.keys(map).map(function(k) { return map[k]; });
  }

  var BASELINE_MERGE_FIELDS = [
    's3_exam_raw', 's3_exam_mark', 's3_exam_grade', 'effort', 'behaviour',
    'homelearning', 'progress', 'cfe_level', 'source', 'notes', 'locked_at'
  ];

  function mergeBaselines(local, remote) {
    return mergeByCompositeKey(local, remote, function(r) { return r.enrolment_id; }, function(a, b) {
      var merged = mergeFieldRecords(a, b, BASELINE_MERGE_FIELDS);
      merged.enrolment_id = a.enrolment_id || b.enrolment_id;
      merged.id = a.id || b.id;
      return merged;
    });
  }

  function mergePrelimMarks(local, remote) {
    return mergeByCompositeKey(local, remote, function(r) {
      return r.enrolment_id + '|' + r.prelim_component_id;
    }, function(a, b) {
      var merged = mergeFieldRecords(a, b, ['raw_mark']);
      merged.enrolment_id = a.enrolment_id || b.enrolment_id;
      merged.prelim_component_id = a.prelim_component_id || b.prelim_component_id;
      merged.id = a.id || b.id;
      return merged;
    });
  }

  function mergeTrackingData(local, remote) {
    return mergeByCompositeKey(local, remote, function(r) {
      return r.enrolment_id + '|' + r.tracking_point_id;
    }, function(a, b) {
      var merged = mergeFieldRecords(a, b, ['effort', 'behaviour', 'imported_from_school_tracking', 'import_batch_id']);
      merged.enrolment_id = a.enrolment_id || b.enrolment_id;
      merged.tracking_point_id = a.tracking_point_id || b.tracking_point_id;
      merged.id = a.id || b.id;
      return merged;
    });
  }

  function mergeAttendance(local, remote) {
    return mergeByCompositeKey(local, remote, function(r) {
      return r.enrolment_id + '|' + r.tracking_point_id;
    }, function(a, b) {
      var merged = mergeFieldRecords(a, b, ['attendance_score', 'teacher_comment']);
      merged.enrolment_id = a.enrolment_id || b.enrolment_id;
      merged.tracking_point_id = a.tracking_point_id || b.tracking_point_id;
      merged.id = a.id || b.id;
      return merged;
    });
  }

  function mergePriorAttainment(local, remote) {
    return mergeByCompositeKey(local, remote, function(r) {
      return r.pupil_id + '|' + r.subject_area + '|' + (r.qualification_year || '');
    }, function(a, b) {
      var merged = mergeFieldRecords(a, b, [
        'qualification_level', 'result_grade', 'pathway_status', 'crashing_dismissed', 'notes'
      ]);
      merged.pupil_id = a.pupil_id || b.pupil_id;
      merged.subject_area = a.subject_area || b.subject_area;
      merged.qualification_year = a.qualification_year || b.qualification_year;
      merged.id = a.id || b.id;
      return merged;
    });
  }

  function mergeEvidenceBank(local, remote) {
    return mergeByCompositeKey(local, remote, function(r) {
      return r.enrolment_id + '|' + (r.unit_code || r.id);
    }, function(a, b) {
      var merged = mergeFieldRecords(a, b, [
        'evidence_status', 'notes', 'date_banked', 'verified_by_teacher_id', 'verification_status'
      ]);
      merged.enrolment_id = a.enrolment_id || b.enrolment_id;
      merged.unit_code = a.unit_code || b.unit_code;
      merged.id = a.id || b.id;
      return merged;
    });
  }

  function mergeWorkbooks(local, remote) {
    if (!remote) return local ? migrate(JSON.parse(JSON.stringify(local))) : null;
    if (!local) return migrate(JSON.parse(JSON.stringify(remote)));
    var base = JSON.parse(JSON.stringify(local));
    var setupTables = [
      'teachers', 'classes', 'pupils', 'enrolments', 'courses',
      'assessment_points', 'school_tracking_points', 'prelim_components'
    ];
    setupTables.forEach(function(table) {
      base[table] = mergeById(base[table], remote[table]);
    });
    base.enrolment_baselines = mergeBaselines(base.enrolment_baselines, remote.enrolment_baselines);
    base.prelim_marks = mergePrelimMarks(base.prelim_marks, remote.prelim_marks);
    base.pupil_tracking_data = mergeTrackingData(base.pupil_tracking_data, remote.pupil_tracking_data);
    base.attendance_records = mergeAttendance(base.attendance_records, remote.attendance_records);
    base.prior_attainment = mergePriorAttainment(base.prior_attainment, remote.prior_attainment);
    base.evidence_bank = mergeEvidenceBank(base.evidence_bank, remote.evidence_bank);
    [
      'pupil_assessment_results', 'teacher_concerns', 'interventions',
      'intervention_trail', 'concern_feedback', 'level_changes', 'import_batches'
    ].forEach(function(table) {
      base[table] = mergeById(base[table], remote[table]);
    });
    base.updated_at = recordTs(local) >= recordTs(remote) ? local.updated_at : remote.updated_at;
    return migrate(base);
  }

  function cloudSnapshot(db) {
    var copy = JSON.parse(JSON.stringify(db || {}));
    delete copy.simulated_teacher_id;
    return copy;
  }

  function workbooksDiffer(a, b) {
    return JSON.stringify(cloudSnapshot(a)) !== JSON.stringify(cloudSnapshot(b));
  }

  function examDefaultsForSlug(slug) {
    var byCourse = (global.SptConfig && global.SptConfig.EXAM_DEFAULTS_BY_COURSE) || {};
    return byCourse[slug] || {};
  }

  function applyExamDefaultsToCourse(course) {
    var defs = examDefaultsForSlug(course.slug || course.default_assessment_model || '');
    if (course.s3_exam_paper_marks == null) {
      if (defs.s3_paper_marks != null) course.s3_exam_paper_marks = defs.s3_paper_marks;
      else if (defs.s3_max_marks != null) course.s3_exam_paper_marks = defs.s3_max_marks;
    }
    if (course.s3_exam_scaled_marks == null) {
      if (defs.s3_scaled_marks != null) course.s3_exam_scaled_marks = defs.s3_scaled_marks;
      else if (course.s3_exam_paper_marks != null) course.s3_exam_scaled_marks = course.s3_exam_paper_marks;
    }
    if (course.s3_exam_paper_marks != null) course.s3_max_marks = course.s3_exam_paper_marks;
    return course;
  }

  function patchCourseExamDefaults(db) {
    var changed = false;
    (db.courses || []).forEach(function(course) {
      var before = JSON.stringify({
        p: course.s3_exam_paper_marks, s: course.s3_exam_scaled_marks
      });
      applyExamDefaultsToCourse(course);
      if (JSON.stringify({ p: course.s3_exam_paper_marks, s: course.s3_exam_scaled_marks }) !== before) changed = true;
    });
    if (global.SptPrelim && global.SptPrelim.patchComponentScales(db)) changed = true;
    return changed;
  }

  function mergeCoursesFromConfig(db) {
    if (!global.SptConfig) return false;
    var ts = new Date().toISOString();
    var changed = false;
    db.courses = db.courses || [];
    db.assessment_points = db.assessment_points || [];
    global.SptConfig.COURSE_DEFS.forEach(function(def) {
      var id = 'c-' + def.slug;
      if (db.courses.some(function(c) { return c.slug === def.slug || c.id === id; })) return;
      db.courses.push(applyExamDefaultsToCourse({
        id: id,
        slug: def.slug,
        course_name: def.course_name,
        subject_area: def.subject_area,
        scqf_level: def.scqf_level,
        course_type: def.course_type,
        has_prelim: def.has_prelim,
        supports_level_change: def.supports_level_change,
        default_assessment_model: def.default_assessment_model,
        active_status: true,
        created_at: ts,
        updated_at: ts
      }));
      var tpl = global.SptConfig.ASSESSMENT_TEMPLATES[def.default_assessment_model] || [];
      tpl.forEach(function(a, i) {
        db.assessment_points.push({
          id: 'ap-' + def.slug + '-' + i,
          course_id: id,
          assessment_name: a.assessment_name,
          assessment_type: a.assessment_type,
          assessment_window: a.assessment_window,
          max_score: a.assessment_type === 'Prelim' ? 100 : null,
          weighting: null,
          is_required: a.is_required,
          display_order: i + 1,
          created_at: ts,
          updated_at: ts
        });
      });
      changed = true;
    });
    return changed;
  }

  function seedNpaPhotoIfMissing(db) {
    if (db.courses && !db.courses.some(function(c) { return c.slug === 'npa-photo'; })) return false;
    var ts = new Date().toISOString();
    var changed = false;
    function ensureClass() {
      db.classes = db.classes || [];
      if (db.classes.some(function(cl) { return cl.id === 'cl-npa-a'; })) return;
      db.classes.push({
        id: 'cl-npa-a', course_id: 'c-npa-photo', class_name: 'NPA Photo L5 A',
        teacher_id: 't-douglas', academic_year: global.SptConfig.currentAcademicYear(), created_at: ts, updated_at: ts
      });
      changed = true;
    }
    function ensurePupil(id, first, surname, year, cand, enId) {
      db.pupils = db.pupils || [];
      if (!db.pupils.some(function(p) { return p.id === id; })) {
        db.pupils.push({
          id: id, first_name: first, surname: surname, preferred_name: first,
          year_group: year, candidate_number: cand, class_group: 'NPA Photo A',
          teacher_id: 't-douglas', active_status: true, notes: '', created_at: ts, updated_at: ts
        });
        changed = true;
      }
      db.enrolments = db.enrolments || [];
      if (!db.enrolments.some(function(e) { return e.id === enId; })) {
        db.enrolments.push({
          id: enId, pupil_id: id, course_id: 'c-npa-photo', class_id: 'cl-npa-a',
          teacher_id: 't-douglas', current_level: 'Level 5', target_grade: 'Pass',
          latest_working_grade: 'Pass', final_estimate: 'Pass', risk_status: 'Green',
          risk_manual_override: false, risk_override_reason: '', has_open_flag: false,
          active_status: true, start_date: '2025-08-15', end_date: null, created_at: ts, updated_at: ts
        });
        if (global.SptEvidence) global.SptEvidence.seedForEnrolment(db, enId);
        changed = true;
      }
    }
    ensureClass();
    ensurePupil('p-graham', 'Mia', 'Graham', 'S3', '2410001', 'e-mia-npa');
    ensurePupil('p-murray', 'Callum', 'Murray', 'S4', '2410002', 'e-callum-npa');
    return changed;
  }

  function patchNpaPhotoCourse(db) {
    var changed = false;
    (db.courses || []).forEach(function(c) {
      if (c.slug !== 'npa-photo') return;
      if (c.scqf_level !== 'Level 4/5') { c.scqf_level = 'Level 4/5'; changed = true; }
      if (!c.group_award_l4) { c.group_award_l4 = 'GR4L 44'; changed = true; }
      if (!c.group_award_l5) { c.group_award_l5 = 'GR4M 45'; changed = true; }
      if (!c.supports_level_change) { c.supports_level_change = true; changed = true; }
    });
    var cl = (db.classes || []).find(function(x) { return x.id === 'cl-npa-a'; });
    if (cl && cl.class_name === 'NPA Photo A') {
      cl.class_name = 'NPA Photo L5 A';
      changed = true;
    }
    return changed;
  }

  function syncNpaPhotoEvidence(db) {
    if (!global.SptEvidence) return false;
    var changed = false;
    (db.enrolments || []).forEach(function(en) {
      if (en.course_id !== 'c-npa-photo' || en.active_status === false) return;
      var before = (db.evidence_bank || []).filter(function(e) { return e.enrolment_id === en.id; })
        .map(function(e) { return e.unit_code; }).sort().join(',');
      global.SptEvidence.syncEnrolment(db, en.id);
      var after = (db.evidence_bank || []).filter(function(e) { return e.enrolment_id === en.id; })
        .map(function(e) { return e.unit_code; }).sort().join(',');
      if (before !== after) changed = true;
    });
    return changed;
  }

  function shouldUseSeed() {
    return !!(global.SptConfig && global.SptConfig.useSeedData &&
      global.SptSeed && typeof global.SptSeed.build === 'function');
  }

  function buildEmpty() {
    var ts = new Date().toISOString();
    var db = {
      version: 0,
      dev_role: 'faculty_head',
      simulated_teacher_id: null,
      hub_mode: true,
      teachers: [],
      classes: [],
      pupils: [],
      enrolments: [],
      school_tracking_points: [],
      pupil_tracking_data: [],
      assessment_points: [],
      pupil_assessment_results: [],
      evidence_bank: [],
      level_changes: [],
      interventions: [],
      intervention_trail: [],
      concern_feedback: [],
      prior_attainment: [],
      enrolment_baselines: [],
      attendance_records: [],
      teacher_concerns: [],
      prelim_components: [],
      prelim_marks: [],
      import_batches: [],
      audit_log: [],
      created_at: ts,
      updated_at: ts
    };
    (global.SptConfig.TRACKING_POINT_NAMES || []).forEach(function(tp) {
      db.school_tracking_points.push({
        id: uid('tp'),
        tracking_point_name: tp.tracking_point_name,
        tracking_point_date: tp.tracking_point_date,
        academic_year: tp.academic_year,
        created_at: ts,
        updated_at: ts
      });
    });
    mergeCoursesFromConfig(db);
    return db;
  }

  function syncTrackingPointsFromConfig(db) {
    if (!global.SptConfig || !global.SptConfig.TRACKING_POINT_NAMES) return false;
    var config = global.SptConfig.TRACKING_POINT_NAMES;
    db.school_tracking_points = db.school_tracking_points || [];
    var ts = new Date().toISOString();
    var changed = false;
    config.forEach(function(cfg, i) {
      var existing = db.school_tracking_points.find(function(tp) {
        return tp.tracking_point_name === cfg.tracking_point_name;
      }) || db.school_tracking_points[i];
      if (existing) {
        if (existing.tracking_point_date !== cfg.tracking_point_date ||
            existing.academic_year !== cfg.academic_year) {
          existing.tracking_point_date = cfg.tracking_point_date;
          existing.academic_year = cfg.academic_year;
          existing.updated_at = ts;
          changed = true;
        }
      } else {
        db.school_tracking_points.push({
          id: uid('tp'),
          tracking_point_name: cfg.tracking_point_name,
          tracking_point_date: cfg.tracking_point_date,
          academic_year: cfg.academic_year,
          created_at: ts,
          updated_at: ts
        });
        changed = true;
      }
    });
    return changed;
  }

  function migrate(db) {
    if (!db) return null;
    if (db.version >= VER) return db;
    db.enrolment_baselines = db.enrolment_baselines || [];
    db.intervention_trail = db.intervention_trail || [];
    db.concern_feedback = db.concern_feedback || [];
    if (db.version < 18) {
      (db.attendance_records || []).forEach(function(a) {
        if (a.attendance_score != null && global.SptWorkingGrade) {
          var en18 = byId(db.enrolments, a.enrolment_id);
          var course18 = en18 ? byId(db.courses, en18.course_id) : null;
          a.attendance_score = global.SptWorkingGrade.migrateLegacyScore(a.attendance_score, course18);
        }
      });
    }
    if (db.version < 19) {
      (db.attendance_records || []).forEach(function(a) {
        if (a.attendance_score == null || !global.SptWorkingGrade) return;
        var en19 = byId(db.enrolments, a.enrolment_id);
        var course19 = en19 ? byId(db.courses, en19.course_id) : null;
        if (!global.SptWorkingGrade.isValidScore(a.attendance_score, course19)) {
          a.attendance_score = global.SptWorkingGrade.migrateLegacyScore(a.attendance_score, course19);
        }
      });
    }
    (db.teacher_concerns || []).forEach(function(f) {
      if (f.status === 'Resolved' && f.intervention_id && f.resolved_at && !f.action_taken_at) {
        f.status = 'Ongoing';
        f.action_taken_at = f.resolved_at;
        f.action_taken_by = f.resolved_by || 'faculty_head';
        f.resolved_at = null;
        f.resolved_by = null;
      }
    });
    (db.level_changes || []).forEach(function(lc) {
      if (!lc.change_type) lc.change_type = 'level';
    });
    (db.enrolment_baselines || []).forEach(function(b) {
      if (b.s3_exam_raw == null && b.s3_exam_mark != null) {
        b.s3_exam_raw = b.s3_exam_mark;
      }
      if (b.s3_exam_mark == null && b.s3_exam_grade && global.SptBaseline) {
        var g = b.s3_exam_grade;
        if (g === 'A') b.s3_exam_mark = 75;
        else if (g === 'B') b.s3_exam_mark = 65;
        else if (g === 'C') b.s3_exam_mark = 55;
        else if (g === 'D') b.s3_exam_mark = 45;
        else if (g === 'F') b.s3_exam_mark = 35;
      }
      if (b.s3_exam_mark != null && !b.s3_exam_grade && global.SptBaseline) {
        b.s3_exam_grade = global.SptBaseline.bandFromMark(b.s3_exam_mark);
      }
    });
    if (global.SptEvidence && global.SptEvidence.syncAll) {
      global.SptEvidence.syncAll(db);
    }
    if (global.SptPrelim && global.SptPrelim.syncComponentsFromConfig) {
      global.SptPrelim.syncComponentsFromConfig(db);
    }
    syncTrackingPointsFromConfig(db);
    mergeCoursesFromConfig(db);
    patchCourseExamDefaults(db);
    if (shouldUseSeed()) {
      seedNpaPhotoIfMissing(db);
      linkEnrolmentsToClasses(db);
      seedAhArtBIfMissing(db);
      if (global.SptSeedRoster && global.SptSeedRoster.mergeIntoDb) {
        global.SptSeedRoster.mergeIntoDb(db);
      }
      patchNpaPhotoCourse(db);
      syncNpaPhotoEvidence(db);
    } else {
      patchNpaPhotoCourse(db);
    }
    (db.prior_attainment || []).forEach(function(p) {
      if (p.pathway_status === 'Completed') p.pathway_status = 'Completed previous level';
      if (p.pathway_status === 'First time') p.pathway_status = 'First time in subject';
      if (p.pathway_status === 'Crashed / withdrew') {
        p.pathway_status = p.result_grade ? 'Completed previous level' : 'Crashing subject';
      }
    });
    (db.enrolments || []).forEach(function(en) {
      if (global.SptConcerns && global.SptConcerns.syncEnrolmentFlag) {
        global.SptConcerns.syncEnrolmentFlag(db, en.id);
      }
    });
    if (global.SptRisk) global.SptRisk.recalculateAll(db);
    db.version = VER;
    return db;
  }

  function ensure() {
    var db = load();
    if (db) {
      var verBefore = db.version;
      db = migrate(db);
      if (db && db.version !== verBefore) {
        if (global.SptRisk) global.SptRisk.recalculateAll(db);
        save(db);
      }
    }
    if (!db) {
      db = shouldUseSeed() ? global.SptSeed.build() : buildEmpty();
      if (global.SptPrelim) global.SptPrelim.buildComponentsFromConfig(db);
      if (global.SptRisk) global.SptRisk.recalculateAll(db);
      save(db);
    }
    db.classes = db.classes || [];
    db.prior_attainment = db.prior_attainment || [];
    db.enrolment_baselines = db.enrolment_baselines || [];
    db.attendance_records = db.attendance_records || [];
    db.teacher_concerns = db.teacher_concerns || [];
    db.intervention_trail = db.intervention_trail || [];
    db.concern_feedback = db.concern_feedback || [];
    db.prelim_components = db.prelim_components || [];
    db.prelim_marks = db.prelim_marks || [];
    var cohortPatched = false;
    if (shouldUseSeed()) {
      cohortPatched = linkEnrolmentsToClasses(db) || seedAhArtBIfMissing(db) ||
        (global.SptSeedRoster && global.SptSeedRoster.mergeIntoDb(db)) ||
        patchNpaPhotoCourse(db) || syncNpaPhotoEvidence(db);
    } else {
      cohortPatched = mergeCoursesFromConfig(db) || patchNpaPhotoCourse(db) || patchCourseExamDefaults(db);
    }
    if (syncTrackingPointsFromConfig(db)) {
      cohortPatched = true;
    }
    if (cohortPatched) {
      if (global.SptRisk) global.SptRisk.recalculateAll(db);
      save(db);
    } else if (!db.prelim_components.length && global.SptPrelim) {
      global.SptPrelim.buildComponentsFromConfig(db);
      save(db);
    } else if (db.version < VER && global.SptPrelim) {
      if (global.SptPrelim.syncComponentsFromConfig(db)) save(db);
      else {
        db.version = VER;
        save(db);
      }
    }
    return db;
  }

  function reset() {
    localStorage.removeItem(KEY);
    localStorage.removeItem('spt-dev-v1');
    localStorage.removeItem('spt-dev-v2');
    var db = ensure();
    if (!global.SptConfig.useSeedData && global.SptSync) {
      global.SptSync.flushPush(db);
    }
    return db;
  }

  function uid(p) {
    return p + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
  }

  function audit(db, action) {
    db.audit_log = db.audit_log || [];
    db.audit_log.unshift({
      id: 'aud-' + Date.now(),
      user_id: db.dev_role || 'dev',
      user_label: (global.SptConfig.ROLES[db.dev_role] || {}).label || db.dev_role,
      action_type: action.action_type,
      table_name: action.table_name,
      record_id: action.record_id,
      previous_value: action.previous_value != null ? JSON.stringify(action.previous_value) : null,
      new_value: action.new_value != null ? JSON.stringify(action.new_value) : null,
      timestamp: new Date().toISOString()
    });
    if (db.audit_log.length > 500) db.audit_log.length = 500;
  }

  function getRole(db) {
    return global.SptConfig.ROLES[db.dev_role] || global.SptConfig.ROLES.faculty_head;
  }

  function setDevRole(roleId) {
    var db = ensure();
    db.dev_role = roleId;
    if (roleId === 'class_teacher' && !db.simulated_teacher_id) {
      db.simulated_teacher_id = (db.teachers[0] && db.teachers[0].id) || null;
    }
    return save(db);
  }

  function setSimulatedTeacher(teacherId) {
    var db = ensure();
    db.simulated_teacher_id = teacherId;
    return save(db);
  }

  function canViewEnrolment(db, enrolment) {
    var role = getRole(db);
    if (role.viewAll) return true;
    return enrolment.teacher_id === db.simulated_teacher_id;
  }

  function filterEnrolments(db, list) {
    return list.filter(function(e) { return e.active_status !== false && canViewEnrolment(db, e); });
  }

  function byId(arr, id) {
    return (arr || []).find(function(x) { return x.id === id; });
  }

  function pupilName(db, pupilId) {
    var p = byId(db.pupils, pupilId);
    return p ? (p.preferred_name || p.first_name) + ' ' + p.surname : 'Unknown';
  }

  function teacherName(db, teacherId) {
    var t = byId(db.teachers, teacherId);
    return t ? t.first_name + ' ' + t.surname : '—';
  }

  function courseName(db, courseId) {
    var c = byId(db.courses, courseId);
    return c ? c.course_name : '—';
  }

  function className(db, classId) {
    var c = byId(db.classes, classId);
    return c ? c.class_name : '—';
  }

  function trackingPoints(db) {
    return (db.school_tracking_points || []).slice().sort(function(a, b) {
      return (a.tracking_point_date || '').localeCompare(b.tracking_point_date || '');
    });
  }

  function attendanceForEnrolment(db, enrolmentId) {
    var tps = trackingPoints(db);
    return tps.map(function(tp) {
      var rec = (db.attendance_records || []).find(function(a) {
        return a.enrolment_id === enrolmentId && a.tracking_point_id === tp.id;
      });
      return { tracking_point: tp, record: rec || null };
    });
  }

  function trackingRecordFor(db, enrolmentId, trackingPointId) {
    return (db.pupil_tracking_data || []).find(function(t) {
      return t.enrolment_id === enrolmentId && t.tracking_point_id === trackingPointId;
    }) || null;
  }

  function trackingDataForEnrolment(db, enrolmentId) {
    var tps = trackingPoints(db);
    return tps.map(function(tp) {
      return { tracking_point: tp, record: trackingRecordFor(db, enrolmentId, tp.id) };
    });
  }

  function trackingScoreValue(record, field) {
    if (!record || record[field] == null || record[field] === '') return '';
    return parseInt(record[field], 10);
  }

  function priorForPupil(db, pupilId) {
    return (db.prior_attainment || []).filter(function(p) { return p.pupil_id === pupilId; });
  }

  function baselineForEnrolment(db, enrolmentId) {
    return global.SptBaseline ? global.SptBaseline.baselineForEnrolment(db, enrolmentId) : null;
  }

  function getEnrichedRows(db) {
    return filterEnrolments(db, db.enrolments).map(function(en) {
      var pupil = byId(db.pupils, en.pupil_id);
      var course = byId(db.courses, en.course_id);
      var tracking = (db.pupil_tracking_data || []).filter(function(t) { return t.enrolment_id === en.id; });
      var latestTp = tracking.sort(function(a, b) {
        var ta = byId(db.school_tracking_points, a.tracking_point_id);
        var tb = byId(db.school_tracking_points, b.tracking_point_id);
        return (tb && tb.tracking_point_date || '').localeCompare(ta && ta.tracking_point_date || '');
      })[0];
      var usesExam = global.SptEvidence && global.SptEvidence.usesExamRoute(course, en);
      var usesEvBank = global.SptEvidence && global.SptEvidence.usesEvidenceBank(course, en);
      var prelimAp = usesExam ? (db.assessment_points || []).find(function(ap) {
        return ap.course_id === en.course_id && ap.assessment_type === 'Prelim';
      }) : null;
      var prelimSummary = prelimAp && global.SptPrelim ? global.SptPrelim.computeSummary(db, en.id, prelimAp.id) : null;
      var prelimDisplay = prelimSummary ? (prelimSummary.percentage + '% ' + prelimSummary.grade_band) : null;
      if (!prelimDisplay && prelimAp) {
        var res = resultForAssessment(db, en.id, prelimAp.id);
        prelimDisplay = res ? (res.grade || res.score) : null;
      }
      var evidence = usesEvBank && global.SptEvidence ? global.SptEvidence.evidenceForEnrolment(db, en.id) : [];
      var missingEv = usesEvBank && global.SptEvidence ? global.SptEvidence.missingCount(db, en.id) : 0;
      var unitsBanked = usesEvBank && global.SptEvidence ? global.SptEvidence.bankedCount(db, en.id) : 0;
      var lc = global.SptLevelChange
        ? global.SptLevelChange.activeForEnrolment(db, en.id)
        : (db.level_changes || []).find(function(l) {
          return l.enrolment_id === en.id && l.current_status !== 'Completed' && l.current_status !== 'Not Proceeding';
        });
      var ints = (db.interventions || []).filter(function(i) {
        return i.enrolment_id === en.id && i.intervention_status !== 'Completed';
      });
      var openFlags = global.SptConcerns ? global.SptConcerns.openFlags(db, en.id) : [];
      var activeFlags = global.SptConcerns ? global.SptConcerns.activeFlags(db, en.id) : [];
      var att = attendanceForEnrolment(db, en.id);
      var tracking = trackingDataForEnrolment(db, en.id);
      var worstWg = att.reduce(function(worst, a) {
        var s = a.record && a.record.attendance_score;
        if (s == null) return worst;
        return worst === null || s > worst ? s : worst;
      }, null);
      var prior = priorForPupil(db, en.pupil_id).filter(function(p) {
        return p.subject_area === course.subject_area;
      });
      var priorMain = global.SptBaseline ? global.SptBaseline.priorForCourse(db, en.pupil_id, course) : (prior[0] || null);
      var crashing = global.SptBaseline
        ? global.SptBaseline.isCrashingSubject(db, en, course) : false;
      var priorDisp = global.SptBaseline
        ? global.SptBaseline.priorDisplay(priorMain, crashing)
        : { grade: '—', pathway: '—', crashing_subject: false };
      var baseline = global.SptBaseline && global.SptBaseline.showsS3Baseline(course, en)
        ? baselineForEnrolment(db, en.id) : null;
      return {
        enrolment: en,
        pupil: pupil,
        course: course,
        teacher_name: teacherName(db, en.teacher_id),
        class_name: en.class_id ? className(db, en.class_id) : (pupil && pupil.class_group) || '—',
        latest_tracking: latestTp,
        latest_tracking_point_name: latestTp ? (byId(db.school_tracking_points, latestTp.tracking_point_id) || {}).tracking_point_name : '—',
        prelim_result: prelimDisplay,
        prelim_summary: prelimSummary,
        uses_exam_route: usesExam,
        uses_evidence_bank: usesEvBank,
        evidence_rows: evidence,
        evidence_missing_count: missingEv,
        units_banked: unitsBanked,
        units_total: evidence.length,
        level_change: lc || null,
        active_interventions: ints,
        open_flags: activeFlags,
        open_flag_count: activeFlags.length,
        pending_alert_count: openFlags.length,
        attendance: att,
        tracking_data: tracking,
        worst_wg: worstWg,
        prior_attainment: prior,
        prior_main: priorMain,
        prior_display: priorDisp,
        crashing_subject: crashing,
        s3_baseline: baseline,
        shows_s3_baseline: global.SptBaseline ? global.SptBaseline.showsS3Baseline(course, en) : false,
        shows_prior_entry: global.SptBaseline ? global.SptBaseline.showsPriorEntry(course) : false
      };
    });
  }

  function getSortedRows(db) {
    var rows = getEnrichedRows(db);
    return global.SptConcerns ? global.SptConcerns.sortByUrgency(rows, db) : rows;
  }

  function updateRecord(db, tableName, id, patch, actionType) {
    var arr = db[tableName];
    if (!arr) return null;
    var idx = arr.findIndex(function(r) { return r.id === id; });
    if (idx < 0) return null;
    var prev = Object.assign({}, arr[idx]);
    arr[idx] = Object.assign({}, arr[idx], patch, { updated_at: new Date().toISOString() });
    audit(db, { action_type: actionType || 'update', table_name: tableName, record_id: id, previous_value: prev, new_value: arr[idx] });
    var enId = arr[idx].enrolment_id || (tableName === 'enrolments' ? id : null);
    if (enId && global.SptRisk) global.SptRisk.recalculateEnrolment(db, enId);
    return save(db);
  }

  function insertRecord(db, tableName, record, actionType) {
    db[tableName] = db[tableName] || [];
    record.id = record.id || uid(tableName.slice(0, 2));
    record.created_at = record.created_at || new Date().toISOString();
    record.updated_at = record.updated_at || record.created_at;
    db[tableName].push(record);
    audit(db, { action_type: actionType || 'insert', table_name: tableName, record_id: record.id, previous_value: null, new_value: record });
    save(db);
    return record;
  }

  function deleteRecord(db, tableName, id) {
    db[tableName] = (db[tableName] || []).filter(function(r) { return r.id !== id; });
    save(db);
  }

  function upsertAttendance(db, enrolmentId, trackingPointId, score) {
    var parsed = score === '' || score == null ? null : parseInt(score, 10);
    if (parsed != null) {
      var en = byId(db.enrolments, enrolmentId);
      var course = en ? byId(db.courses, en.course_id) : null;
      if (global.SptWorkingGrade) {
        if (!global.SptWorkingGrade.isValidScore(parsed, course)) return db;
      } else if (parsed < 1 || parsed > 9) {
        return db;
      }
    }
    var existing = (db.attendance_records || []).find(function(a) {
      return a.enrolment_id === enrolmentId && a.tracking_point_id === trackingPointId;
    });
    if (existing) {
      updateRecord(db, 'attendance_records', existing.id, { attendance_score: parsed }, 'wg_update');
    } else {
      insertRecord(db, 'attendance_records', {
        enrolment_id: enrolmentId,
        tracking_point_id: trackingPointId,
        attendance_score: parsed,
        teacher_comment: ''
      }, 'wg_insert');
    }
    if (global.SptRisk) global.SptRisk.recalculateEnrolment(db, enrolmentId);
    return db;
  }

  function upsertTrackingScore(db, enrolmentId, trackingPointId, field, value) {
    if (field !== 'effort' && field !== 'behaviour') return db;
    var existing = trackingRecordFor(db, enrolmentId, trackingPointId);
    var score = value === '' || value == null ? null : parseInt(value, 10);
    if (score != null && (score < 1 || score > 4)) return db;
    if (existing) {
      var patch = {};
      patch[field] = score;
      updateRecord(db, 'pupil_tracking_data', existing.id, patch, 'tracking_update');
    } else {
      var row = {
        enrolment_id: enrolmentId,
        tracking_point_id: trackingPointId,
        effort: field === 'effort' ? score : null,
        behaviour: field === 'behaviour' ? score : null,
        imported_from_school_tracking: false,
        import_batch_id: null
      };
      insertRecord(db, 'pupil_tracking_data', row, 'tracking_insert');
    }
    if (global.SptRisk) global.SptRisk.recalculateEnrolment(db, enrolmentId);
    return db;
  }

  function assessmentPointsForCourse(db, courseId) {
    return (db.assessment_points || [])
      .filter(function(ap) { return ap.course_id === courseId; })
      .sort(function(a, b) { return a.display_order - b.display_order; });
  }

  function resultForAssessment(db, enrolmentId, assessmentPointId) {
    return (db.pupil_assessment_results || []).find(function(r) {
      return r.enrolment_id === enrolmentId && r.assessment_point_id === assessmentPointId;
    });
  }

  function upsertAssessmentResult(db, enrolmentId, assessmentPointId, patch) {
    var existing = resultForAssessment(db, enrolmentId, assessmentPointId);
    if (existing) {
      updateRecord(db, 'pupil_assessment_results', existing.id, patch, 'assessment_update');
      return byId(db.pupil_assessment_results, existing.id);
    }
    var row = Object.assign({
      enrolment_id: enrolmentId,
      assessment_point_id: assessmentPointId,
      score: null,
      grade: null,
      completion_status: 'In Progress',
      concern_status: 'Green',
      assessment_date: null,
      teacher_comment: '',
      next_steps: ''
    }, patch);
    insertRecord(db, 'pupil_assessment_results', row, 'assessment_create');
    if (global.SptRisk) global.SptRisk.recalculateEnrolment(db, enrolmentId);
    return row;
  }

  function upsertBaseline(db, enrolmentId, patch) {
    if (!global.SptBaseline) return null;
    return global.SptBaseline.upsertBaseline(db, enrolmentId, patch);
  }

  function upsertPriorForCourse(db, enrolmentId, patch) {
    if (!global.SptBaseline) return null;
    return global.SptBaseline.upsertPriorForCourse(db, enrolmentId, patch);
  }

  function createEnrolment(db, pupilId, courseId, classId, teacherId, level) {
    var en = insertRecord(db, 'enrolments', {
      pupil_id: pupilId,
      course_id: courseId,
      class_id: classId || null,
      teacher_id: teacherId,
      current_level: level || 'National 5',
      target_grade: '',
      latest_working_grade: '',
      final_estimate: '',
      risk_status: 'Grey',
      risk_manual_override: false,
      risk_override_reason: '',
      has_open_flag: false,
      active_status: true,
      start_date: new Date().toISOString().slice(0, 10),
      end_date: null
    }, 'enrolment_create');
    var course = byId(db.courses, courseId);
    if (global.SptBaseline && global.SptBaseline.showsS3Baseline(course, en)) {
      global.SptBaseline.upsertBaseline(db, en.id, { source: 'manual' });
    }
    if (global.SptEvidence) global.SptEvidence.syncEnrolment(db, en.id);
    if (global.SptRisk) global.SptRisk.recalculateEnrolment(db, en.id);
    return en;
  }

  function defaultLevelForCourse(course) {
    if (!course) return 'National 5';
    if (course.course_type === 'Advanced Higher') return 'Advanced Higher';
    if (course.course_type === 'Higher') return 'Higher';
    if (course.course_type === 'NPA Combined') return 'Level 6';
    if (course.course_type === 'NPA Award' && course.slug === 'npa-photo') return 'Level 5';
    if (course.course_type === 'NPA Award') return 'Level 5';
    if (course.course_type === 'N5/N4 Combined') return 'National 5';
    return 'National 5';
  }

  function defaultYearGroupForCourse(course) {
    if (!course) return 'S5/6';
    if (course.course_type === 'N5/N4 Combined') return 'S4';
    return 'S5/6';
  }

  function levelsForCourse(course) {
    if (!course) return ['National 5'];
    if (course.course_type === 'Advanced Higher') return ['Advanced Higher'];
    if (course.course_type === 'Higher') return ['Higher'];
    if (course.course_type === 'N5/N4 Combined') return ['National 5', 'National 4', 'National 3'];
    if (course.course_type === 'NPA Combined') return ['Level 6', 'Level 5'];
    if (course.slug === 'npa-photo') return ['Level 5', 'Level 4'];
    if (course.course_type === 'NPA Award') return ['Level 5'];
    return ['National 5'];
  }

  function classesForCourse(db, courseId) {
    return (db.classes || []).filter(function(cl) { return cl.course_id === courseId; });
  }

  function teachersForCourse(db, courseId) {
    var ids = {};
    classesForCourse(db, courseId).forEach(function(cl) { ids[cl.teacher_id] = true; });
    var list = (db.teachers || []).filter(function(t) {
      return t.active_status !== false && ids[t.id];
    });
    if (list.length) return list;
    return (db.teachers || []).filter(function(t) { return t.active_status !== false; });
  }

  function findEnrolment(db, pupilId, courseId) {
    return (db.enrolments || []).find(function(e) {
      return e.pupil_id === pupilId && e.course_id === courseId;
    });
  }

  function hasActiveEnrolment(db, pupilId, courseId) {
    var en = findEnrolment(db, pupilId, courseId);
    return en && en.active_status !== false;
  }

  function createPupil(db, fields) {
    return insertRecord(db, 'pupils', {
      first_name: fields.first_name,
      surname: fields.surname,
      preferred_name: fields.preferred_name || fields.first_name,
      year_group: fields.year_group || 'S5/6',
      candidate_number: fields.candidate_number || '',
      class_group: fields.class_group || '',
      teacher_id: fields.teacher_id || null,
      active_status: true,
      notes: fields.notes || ''
    }, 'pupil_add');
  }

  function deactivateEnrolment(db, enrolmentId) {
    return updateRecord(db, 'enrolments', enrolmentId, {
      active_status: false,
      end_date: new Date().toISOString().slice(0, 10)
    }, 'enrolment_deactivate');
  }

  function unassignedEnrolmentsForCourse(db, courseId) {
    return filterEnrolments(db, db.enrolments || []).filter(function(e) {
      return e.course_id === courseId && !e.class_id;
    });
  }

  function deactivateUnassignedForCourse(db, courseId) {
    var list = unassignedEnrolmentsForCourse(db, courseId);
    if (!list.length) return { removed: 0 };
    var endDate = new Date().toISOString().slice(0, 10);
    var now = new Date().toISOString();
    list.forEach(function(en) {
      var arr = db.enrolments || [];
      var idx = arr.findIndex(function(e) { return e.id === en.id; });
      if (idx < 0) return;
      var prev = Object.assign({}, arr[idx]);
      arr[idx] = Object.assign({}, arr[idx], {
        active_status: false,
        end_date: endDate,
        updated_at: now
      });
      audit(db, {
        action_type: 'enrolment_deactivate',
        table_name: 'enrolments',
        record_id: en.id,
        previous_value: prev,
        new_value: arr[idx]
      });
      if (global.SptRisk) global.SptRisk.recalculateEnrolment(db, en.id);
    });
    save(db);
    if (!global.SptConfig.useSeedData && global.SptSync && global.SptSync.flushPush) {
      global.SptSync.flushPush(db);
    }
    return { removed: list.length };
  }

  function addPupilToCourse(db, opts) {
    var courseId = opts.courseId;
    var teacherId = opts.teacherId;
    var classId = opts.classId || null;
    var level = opts.level || defaultLevelForCourse(byId(db.courses, courseId));
    var pupilId = opts.pupilId;
    if (!pupilId) {
      if (!opts.first_name || !opts.surname) return { error: 'Name required' };
      pupilId = createPupil(db, opts).id;
    }
    if (hasActiveEnrolment(db, pupilId, courseId)) return { error: 'Pupil is already on this course' };
    var existing = findEnrolment(db, pupilId, courseId);
    if (existing) {
      updateRecord(db, 'enrolments', existing.id, {
        active_status: true,
        teacher_id: teacherId,
        class_id: classId,
        current_level: level,
        end_date: null,
        start_date: new Date().toISOString().slice(0, 10)
      }, 'enrolment_reactivate');
      if (global.SptEvidence) global.SptEvidence.syncEnrolment(db, existing.id);
      if (global.SptRisk) global.SptRisk.recalculateEnrolment(db, existing.id);
      return { enrolment: byId(db.enrolments, existing.id) };
    }
    return { enrolment: createEnrolment(db, pupilId, courseId, classId, teacherId, level) };
  }

  function updateEnrolmentTeacher(db, enrolmentId, teacherId, classId) {
    var patch = { teacher_id: teacherId };
    if (classId !== undefined) patch.class_id = classId || null;
    return updateRecord(db, 'enrolments', enrolmentId, patch, 'enrolment_teacher_update');
  }

  function updateEnrolmentArtRoute(db, enrolmentId, route) {
    var valid = [''].concat(global.SptConfig.AH_ART_PORTFOLIO_ROUTES || ['Expressive', 'Design']);
    if (valid.indexOf(route) < 0) route = '';
    return updateRecord(db, 'enrolments', enrolmentId, { art_portfolio_route: route }, 'enrolment_art_route');
  }

  function canViewClass(db, cl) {
    if (!cl) return false;
    var role = getRole(db);
    if (role.viewAll) return true;
    return cl.teacher_id === db.simulated_teacher_id;
  }

  function enrolmentCountForClass(db, classId) {
    return filterEnrolments(db, db.enrolments || []).filter(function(e) {
      return e.class_id === classId;
    }).length;
  }

  function trackingEntriesForUser(db) {
    var role = getRole(db);
    var entries = [];
    (db.classes || []).forEach(function(cl) {
      if (!canViewClass(db, cl)) return;
      var count = enrolmentCountForClass(db, cl.id);
      if (!role.viewAll && count === 0) return;
      var course = byId(db.courses, cl.course_id);
      entries.push({
        type: 'class',
        classId: cl.id,
        courseId: cl.course_id,
        className: cl.class_name,
        courseName: course ? course.course_name : '—',
        teacherName: teacherName(db, cl.teacher_id),
        subjectArea: course ? (course.subject_area || 'Other') : 'Other',
        count: count
      });
    });
    var unassignedByCourse = {};
    filterEnrolments(db, db.enrolments || []).forEach(function(e) {
      if (e.class_id) return;
      unassignedByCourse[e.course_id] = (unassignedByCourse[e.course_id] || 0) + 1;
    });
    Object.keys(unassignedByCourse).forEach(function(courseId) {
      var course = byId(db.courses, courseId);
      entries.push({
        type: 'unassigned',
        classId: null,
        courseId: courseId,
        className: 'Unassigned pupils',
        courseName: course ? course.course_name : '—',
        teacherName: '',
        subjectArea: course ? (course.subject_area || 'Other') : 'Other',
        count: unassignedByCourse[courseId]
      });
    });
    return entries;
  }

  function updateClassTeacher(db, classId, teacherId) {
    var cl = byId(db.classes, classId);
    if (!cl) return null;
    updateRecord(db, 'classes', classId, { teacher_id: teacherId }, 'class_teacher_update');
    (db.enrolments || []).forEach(function(en) {
      if (en.class_id === classId && en.active_status !== false && en.teacher_id !== teacherId) {
        updateRecord(db, 'enrolments', en.id, { teacher_id: teacherId }, 'class_teacher_sync');
      }
    });
    return byId(db.classes, classId);
  }

  function updateClass(db, classId, patch) {
    var cl = byId(db.classes, classId);
    if (!cl) return { error: 'Class not found' };

    var className = patch.class_name != null ? String(patch.class_name).trim() : cl.class_name;
    if (!className) return { error: 'Class name is required' };

    var courseId = patch.course_id != null ? patch.course_id : cl.course_id;
    var yearGroup = patch.year_group != null ? patch.year_group : cl.year_group;
    var teacherId = patch.teacher_id != null ? patch.teacher_id : cl.teacher_id;

    var dup = (db.classes || []).find(function(c) {
      return c.id !== classId && c.teacher_id === teacherId &&
        String(c.class_name || '').trim().toLowerCase() === className.toLowerCase();
    });
    if (dup) return { error: 'This teacher already has a class named "' + dup.class_name + '"' };

    var course = byId(db.courses, courseId);
    if (!course) return { error: 'Course not found' };

    var courseChanged = courseId !== cl.course_id;
    var teacherChanged = teacherId !== cl.teacher_id;
    var enrolments = (db.enrolments || []).filter(function(e) {
      return e.class_id === classId && e.active_status !== false;
    });

    if (courseChanged && enrolments.length) {
      var conflicts = [];
      enrolments.forEach(function(en) {
        var existing = findEnrolment(db, en.pupil_id, courseId);
        if (existing && existing.active_status !== false && existing.id !== en.id) {
          conflicts.push(en.pupil_id);
        }
      });
      if (conflicts.length) {
        var names = conflicts.map(function(pid) { return pupilName(db, pid); }).join(', ');
        return {
          error: 'Cannot change course — these pupils are already enrolled on ' + courseName(db, courseId) + ': ' + names
        };
      }
    }

    updateRecord(db, 'classes', classId, {
      class_name: className,
      course_id: courseId,
      year_group: yearGroup || defaultYearGroupForCourse(course),
      teacher_id: teacherId
    }, 'class_update');

    if (courseChanged || teacherChanged) {
      enrolments.forEach(function(en) {
        var enPatch = {};
        if (courseChanged) enPatch.course_id = courseId;
        if (teacherChanged) enPatch.teacher_id = teacherId;
        updateRecord(db, 'enrolments', en.id, enPatch, 'class_update_sync');
        if (courseChanged && global.SptEvidence) global.SptEvidence.syncEnrolment(db, en.id);
        if (global.SptRisk) global.SptRisk.recalculateEnrolment(db, en.id);
      });
    }

    return { class: byId(db.classes, classId), courseChanged: courseChanged };
  }

  function deleteClass(db, classId) {
    var cl = byId(db.classes, classId);
    if (!cl) return { error: 'Class not found' };
    var unassigned = 0;
    (db.enrolments || []).forEach(function(en) {
      if (en.class_id !== classId) return;
      unassigned++;
      updateRecord(db, 'enrolments', en.id, { class_id: null }, 'enrolment_class_unassign');
    });
    var prev = Object.assign({}, cl);
    deleteRecord(db, 'classes', classId);
    audit(db, {
      action_type: 'class_delete',
      table_name: 'classes',
      record_id: classId,
      previous_value: prev,
      new_value: null
    });
    save(db);
    return { className: cl.class_name, unassigned: unassigned };
  }

  function linkEnrolmentsToClasses(db) {
    var map = {
      'e-chloe-aa': 'cl-aa-a',
      'e-connor-nd': 'cl-nd-b',
      'e-sophie-na': 'cl-na-c',
      'e-isla-hp': 'cl-hp-a',
      'e-lewis-fs': 'cl-fs-a',
      'e-aiden-ci': 'cl-ci-b',
      'e-maya-ahd': 'cl-ahd-a',
      'e-noah-hd2': 'cl-hd-b',
      'e-mia-npa': 'cl-npa-a',
      'e-callum-npa': 'cl-npa-a'
    };
    var changed = false;
    (db.enrolments || []).forEach(function(en) {
      var clId = map[en.id];
      if (clId && !en.class_id) {
        en.class_id = clId;
        changed = true;
      }
    });
    return changed;
  }

  function seedAhArtBIfMissing(db) {
    var ts = new Date().toISOString();
    var changed = false;
    db.classes = db.classes || [];
    if (!db.classes.some(function(cl) { return cl.id === 'cl-aa-b'; })) {
      db.classes.push({
        id: 'cl-aa-b', course_id: 'c-ah-art', class_name: 'AH Art B',
        teacher_id: 't-douglas', academic_year: global.SptConfig.currentAcademicYear(), created_at: ts, updated_at: ts
      });
      changed = true;
    }
    db.pupils = db.pupils || [];
    if (!db.pupils.some(function(p) { return p.id === 'p-balfour'; })) {
      db.pupils.push({
        id: 'p-balfour', first_name: 'Erin', surname: 'Balfour', preferred_name: 'Erin',
        year_group: 'S6', candidate_number: '2411001', class_group: 'AH Art B',
        teacher_id: 't-douglas', active_status: true, notes: '', created_at: ts, updated_at: ts
      });
      changed = true;
    }
    db.enrolments = db.enrolments || [];
    if (!db.enrolments.some(function(e) { return e.id === 'e-erin-aab'; })) {
      db.enrolments.push({
        id: 'e-erin-aab', pupil_id: 'p-balfour', course_id: 'c-ah-art', class_id: 'cl-aa-b',
        teacher_id: 't-douglas', current_level: 'Advanced Higher', target_grade: 'B',
        latest_working_grade: 'B', final_estimate: 'B', risk_status: 'Green',
        risk_manual_override: false, risk_override_reason: '', has_open_flag: false,
        active_status: true, start_date: '2025-08-15', end_date: null, created_at: ts, updated_at: ts
      });
      if (global.SptEvidence) global.SptEvidence.seedForEnrolment(db, 'e-erin-aab');
      changed = true;
    }
    return changed;
  }

  global.SptStore = {
    load: load,
    save: save,
    importCloudSnapshot: importCloudSnapshot,
    mergeWorkbooks: mergeWorkbooks,
    workbooksDiffer: workbooksDiffer,
    cloudSnapshot: cloudSnapshot,
    ensure: ensure,
    reset: reset,
    uid: uid,
    audit: audit,
    getRole: getRole,
    setDevRole: setDevRole,
    setSimulatedTeacher: setSimulatedTeacher,
    canViewEnrolment: canViewEnrolment,
    canViewClass: canViewClass,
    filterEnrolments: filterEnrolments,
    byId: byId,
    pupilName: pupilName,
    teacherName: teacherName,
    courseName: courseName,
    className: className,
    trackingPoints: trackingPoints,
    attendanceForEnrolment: attendanceForEnrolment,
    trackingRecordFor: trackingRecordFor,
    trackingDataForEnrolment: trackingDataForEnrolment,
    trackingScoreValue: trackingScoreValue,
    priorForPupil: priorForPupil,
    baselineForEnrolment: baselineForEnrolment,
    upsertBaseline: upsertBaseline,
    upsertPriorForCourse: upsertPriorForCourse,
    getEnrichedRows: getEnrichedRows,
    getSortedRows: getSortedRows,
    updateRecord: updateRecord,
    insertRecord: insertRecord,
    deleteRecord: deleteRecord,
    upsertAttendance: upsertAttendance,
    upsertTrackingScore: upsertTrackingScore,
    assessmentPointsForCourse: assessmentPointsForCourse,
    resultForAssessment: resultForAssessment,
    upsertAssessmentResult: upsertAssessmentResult,
    createEnrolment: createEnrolment,
    defaultLevelForCourse: defaultLevelForCourse,
    levelsForCourse: levelsForCourse,
    classesForCourse: classesForCourse,
    teachersForCourse: teachersForCourse,
    findEnrolment: findEnrolment,
    hasActiveEnrolment: hasActiveEnrolment,
    createPupil: createPupil,
    deactivateEnrolment: deactivateEnrolment,
    unassignedEnrolmentsForCourse: unassignedEnrolmentsForCourse,
    deactivateUnassignedForCourse: deactivateUnassignedForCourse,
    addPupilToCourse: addPupilToCourse,
    updateEnrolmentTeacher: updateEnrolmentTeacher,
    updateEnrolmentArtRoute: updateEnrolmentArtRoute,
    updateClassTeacher: updateClassTeacher,
    updateClass: updateClass,
    deleteClass: deleteClass,
    enrolmentCountForClass: enrolmentCountForClass,
    trackingEntriesForUser: trackingEntriesForUser
  };
})(typeof window !== 'undefined' ? window : global);
