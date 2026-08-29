/**
 * Attainment Meetings — new workflow layer beside Senior Phase Tracking.
 *
 * DATA BOUNDARY
 * ─────────────
 * Tracking data (SptStore / spt-hub-v1 / spt-dev-v2) is READ-ONLY here.
 * This module never calls SptStore.save, insertRecord, updateRecord, or
 * SptSync. It never mutates enrolments, tracking rows, risk, concerns,
 * interventions, baselines, prelims, evidence, or pupil records.
 *
 * Meeting records live in a separate store (never the tracking workbook):
 *   seed/dev  — localStorage key <SptConfig.STORAGE_KEY>-meetings
 *   live hub  — dedicated Supabase tables via SptAttainmentMeetingStore
 *
 * Existing tables left untouched:
 *   teachers, classes, pupils, enrolments, school_tracking_points,
 *   pupil_tracking_data, attendance_records, enrolment_baselines,
 *   prior_attainment, teacher_concerns, interventions, intervention_trail,
 *   prelim_*, evidence_bank, level_changes, assessment_*, audit_log
 *
 * ADDITIVE MEETING SCHEMA (this key only)
 *   review_cycles, class_reviews, pupil_reviews, actions
 *
 * Existing interventions are displayed as previous support. Meeting actions
 * are NOT stored as interventions — creating them would change risk and
 * historic intervention behaviour.
 */
(function(global) {
  'use strict';

  var STORE_VERSION = 1;
  var OWNERS = [
    { id: 'teacher', label: 'Teacher' },
    { id: 'faculty_head', label: 'Faculty Head' },
    { id: 'slt', label: 'SLT' },
    { id: 'monitor', label: 'Monitor' }
  ];
  var OWNER_LABEL = {
    teacher: 'Teacher',
    faculty_head: 'Faculty Head',
    slt: 'SLT',
    monitor: 'Monitor'
  };

  var ui = {
    view: 'home',
    cycleId: null,
    classId: null,
    enrolmentId: null,
    saveState: '',
    drafts: {},
    noteTimer: null,
    printKind: null,
    printCycleId: null,
    printClassId: null,
    showCreate: false,
    addPupilOpen: false,
    showClassNotes: false
  };

  var ctx = null;

  function emptyStore() {
    return {
      version: STORE_VERSION,
      review_cycles: [],
      class_reviews: [],
      pupil_reviews: [],
      actions: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }

  function loadStore() {
    if (global.SptAttainmentMeetingStore) return global.SptAttainmentMeetingStore.load();
    return emptyStore();
  }

  function saveStore(store) {
    if (global.SptAttainmentMeetingStore) return global.SptAttainmentMeetingStore.save(store);
    store.updated_at = new Date().toISOString();
    store.version = STORE_VERSION;
    return store;
  }

  function resolveTeacherHubUserId(teacherId) {
    var d;
    try { d = db(); } catch (e) { return null; }
    if (!d) return null;
    var t = teacherId && global.SptStore ? global.SptStore.byId(d.teachers, teacherId) : null;
    if (t && t.hub_user_id) return t.hub_user_id;
    if (d.hub_current_user_id && teacherId && d.simulated_teacher_id === teacherId) {
      return d.hub_current_user_id;
    }
    return null;
  }

  function uid(prefix) {
    return prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
  }

  function byId(arr, id) {
    return (arr || []).find(function(x) { return x && x.id === id; }) || null;
  }

  function esc(s) {
    return ctx && ctx.esc ? ctx.esc(s) : String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function badge(status) {
    return ctx && ctx.badge ? ctx.badge(status) : esc(status);
  }

  function db() { return ctx.db(); }
  function role() { return ctx.role(); }

  function canManage(r) {
    r = r || role();
    return !!(r && r.canEdit && r.viewAll);
  }

  function canEditMeetings(r) {
    r = r || role();
    return !!(r && r.canEdit);
  }

  function tpShort(tp, index) {
    if (!tp) return 'TP';
    if (tp.display_order != null) return 'TP' + tp.display_order;
    var m = String(tp.tracking_point_name || '').match(/(\d+)/);
    if (m) return 'TP' + m[1];
    return 'TP' + ((index || 0) + 1);
  }

  function defaultTitle(yearGroup, tpLabel) {
    return yearGroup + ' Attainment Review · ' + tpLabel;
  }

  function formatDate(iso) {
    if (!iso) return '';
    var d = String(iso).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
    var p = d.split('-');
    return p[2] + ' ' + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][parseInt(p[1], 10) - 1] + ' ' + p[0];
  }

  function scoreLabel(n) {
    var labels = (global.SptConfig && global.SptConfig.ATTENDANCE_LABELS) || {};
    if (n == null || n === '') return '—';
    return labels[n] ? (n + ' · ' + labels[n]) : String(n);
  }

  function wgForEnrolment(d, enrolmentId, tpId, course) {
    var rec = (d.attendance_records || []).find(function(a) {
      return a.enrolment_id === enrolmentId && a.tracking_point_id === tpId;
    });
    if (!rec || rec.attendance_score == null || rec.attendance_score === '') return { score: null, label: '—', pct: rec && rec.attendance_percent };
    var score = rec.attendance_score;
    var label = global.SptWorkingGrade ? (global.SptWorkingGrade.label(score, course) || String(score)) : String(score);
    return { score: score, label: label, pct: rec.attendance_percent };
  }

  function previousWg(d, enrolmentId, currentTp, course) {
    var tps = global.SptStore.trackingPoints(d);
    var idx = tps.findIndex(function(tp) { return tp.id === currentTp; });
    if (idx <= 0) return null;
    return wgForEnrolment(d, enrolmentId, tps[idx - 1].id, course);
  }

  function trackingScores(d, enrolmentId, tpId) {
    var rec = global.SptStore.trackingRecordFor(d, enrolmentId, tpId);
    return {
      effort: rec ? global.SptStore.trackingScoreValue(rec, 'effort') : '',
      behaviour: rec ? global.SptStore.trackingScoreValue(rec, 'behaviour') : ''
    };
  }

  function yearMatches(pupilYear, cycleYear) {
    if (!pupilYear || !cycleYear) return false;
    if (pupilYear === cycleYear) return true;
    if (cycleYear === 'S5/6') return pupilYear === 'S5' || pupilYear === 'S6' || pupilYear === 'S5/6';
    if (pupilYear === 'S5/6') return cycleYear === 'S5' || cycleYear === 'S6';
    return false;
  }

  function isSuggested(row) {
    var en = row.enrolment;
    if (!en) return false;
    if (en.risk_status === 'Red' || en.risk_status === 'Amber') return true;
    if ((row.open_flag_count || 0) > 0 || (row.pending_alert_count || 0) > 0) return true;
    if ((row.active_interventions || []).length) return true;
    return false;
  }

  function reasonChips(reasons) {
    var chips = [];
    function add(c) { if (chips.indexOf(c) < 0) chips.push(c); }
    (reasons || []).forEach(function(r) {
      var s = String(r).toLowerCase();
      if (s.indexOf('working grade') >= 0 || s.indexOf('wg ') >= 0 || s.indexOf('below target') >= 0) add('Below WG');
      if (s.indexOf('attendance') >= 0) add('Attendance');
      if (s.indexOf('effort') >= 0) add('Effort');
      if (s.indexOf('behaviour') >= 0) add('Behaviour');
      if (s.indexOf('concern') >= 0) add('Concern');
      if (s.indexOf('intervention') >= 0) add('Support');
      if (s.indexOf('s3') >= 0) add('S3 exam');
      if (s.indexOf('prelim') >= 0) add('Prelim');
      if (s.indexOf('evidence') >= 0) add('Evidence');
    });
    return chips;
  }

  function visibleRows(d) {
    return global.SptStore.getEnrichedRows(d).filter(function(r) {
      return r.enrolment && r.enrolment.active_status !== false && r.enrolment.class_id;
    });
  }

  function rowsForCycle(d, cycle) {
    return visibleRows(d).filter(function(r) {
      return r.pupil && yearMatches(r.pupil.year_group, cycle.year_group);
    });
  }

  function classIdsForCycle(d, cycle) {
    var seen = {};
    var ids = [];
    rowsForCycle(d, cycle).forEach(function(r) {
      var id = r.enrolment.class_id;
      if (!id || seen[id]) return;
      seen[id] = true;
      ids.push(id);
    });
    return ids;
  }

  function rowsForClass(d, cycle, classId) {
    return rowsForCycle(d, cycle).filter(function(r) { return r.enrolment.class_id === classId; });
  }

  function classReview(store, cycleId, classId) {
    return (store.class_reviews || []).find(function(r) {
      return r.review_cycle_id === cycleId && r.class_id === classId;
    }) || null;
  }

  function ensureClassReview(store, cycle, classId, teacherId) {
    var existing = classReview(store, cycle.id, classId);
    if (existing) {
      if (!existing.teacher_hub_user_id) {
        existing.teacher_hub_user_id = resolveTeacherHubUserId(teacherId || existing.teacher_id);
      }
      return existing;
    }
    var rec = {
      id: uid('acr'),
      review_cycle_id: cycle.id,
      class_id: classId,
      teacher_id: teacherId || null,
      teacher_hub_user_id: resolveTeacherHubUserId(teacherId),
      started_at: null,
      completed_at: null,
      status: 'not_started',
      meeting_notes: '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    store.class_reviews.push(rec);
    return rec;
  }

  function pupilReviewsForClass(store, classReviewId) {
    return (store.pupil_reviews || []).filter(function(p) { return p.class_review_id === classReviewId; });
  }

  function actionsForClass(store, classReviewId) {
    return (store.actions || []).filter(function(a) { return a.class_review_id === classReviewId; });
  }

  function actionsForPupil(store, classReviewId, enrolmentId) {
    return actionsForClass(store, classReviewId).filter(function(a) { return a.enrolment_id === enrolmentId; });
  }

  function seedSuggested(store, cr, rows) {
    var existing = {};
    pupilReviewsForClass(store, cr.id).forEach(function(p) { existing[p.enrolment_id] = p; });
    rows.forEach(function(row) {
      if (!isSuggested(row)) return;
      if (existing[row.enrolment.id]) return;
      store.pupil_reviews.push({
        id: uid('apr'),
        class_review_id: cr.id,
        enrolment_id: row.enrolment.id,
        pupil_id: row.enrolment.pupil_id,
        discussion_status: 'suggested',
        reviewed: false,
        notes: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    });
  }

  function discussionList(store, cr, rows) {
    var reviews = pupilReviewsForClass(store, cr.id);
    var byEn = {};
    reviews.forEach(function(p) { byEn[p.enrolment_id] = p; });
    var list = [];
    rows.forEach(function(row) {
      var pr = byEn[row.enrolment.id];
      if (!pr) return;
      if (pr.discussion_status === 'skipped') {
        list.push({ row: row, review: pr });
        return;
      }
      list.push({ row: row, review: pr });
    });
    list.sort(function(a, b) {
      var an = global.SptStore.pupilName(db(), a.row.enrolment.pupil_id);
      var bn = global.SptStore.pupilName(db(), b.row.enrolment.pupil_id);
      return an.localeCompare(bn);
    });
    return list;
  }

  function activeDiscussion(list) {
    return list.filter(function(item) { return item.review.discussion_status !== 'skipped'; });
  }

  function startClassReview(cycle, classId) {
    var d = db();
    var store = loadStore();
    var cl = global.SptStore.byId(d.classes, classId);
    var cr = ensureClassReview(store, cycle, classId, cl && cl.teacher_id);
    if (cr.status === 'not_started') {
      cr.status = 'in_progress';
      cr.started_at = cr.started_at || new Date().toISOString();
      cr.updated_at = new Date().toISOString();
    }
    seedSuggested(store, cr, rowsForClass(d, cycle, classId));
    saveStore(store);
    return cr;
  }

  function actorMeta(d) {
    var r = role();
    return {
      created_by_role: d.dev_role || r.id,
      created_by_teacher_id: d.simulated_teacher_id || null,
      created_by_label: r.label || d.dev_role || 'Staff'
    };
  }

  function upsertPupilNotes(classReviewId, enrolmentId, notes) {
    var store = loadStore();
    var pr = (store.pupil_reviews || []).find(function(p) {
      return p.class_review_id === classReviewId && p.enrolment_id === enrolmentId;
    });
    if (!pr) return store;
    pr.notes = notes;
    pr.updated_at = new Date().toISOString();
    return saveStore(store);
  }

  function markReviewed(classReviewId, enrolmentId, skipped) {
    var store = loadStore();
    var pr = (store.pupil_reviews || []).find(function(p) {
      return p.class_review_id === classReviewId && p.enrolment_id === enrolmentId;
    });
    if (!pr) return store;
    pr.reviewed = true;
    if (skipped) pr.discussion_status = 'skipped';
    else if (pr.discussion_status === 'skipped') pr.discussion_status = 'added';
    pr.reviewed_at = new Date().toISOString();
    pr.updated_at = pr.reviewed_at;
    return saveStore(store);
  }

  function addAction(payload) {
    var store = loadStore();
    var rec = Object.assign({
      id: uid('ama'),
      status: 'open',
      created_at: new Date().toISOString(),
      completed_at: null,
      review_point_id: null,
      review_date: null,
      owner_id: null,
      action_text: ''
    }, payload);
    rec.updated_at = rec.created_at;
    store.actions.push(rec);
    return saveStore(store);
  }

  function removeAction(id) {
    var store = loadStore();
    store.actions = (store.actions || []).filter(function(a) { return a.id !== id; });
    return saveStore(store);
  }

  function setActionStatus(id, status) {
    var store = loadStore();
    var a = byId(store.actions, id);
    if (!a) return store;
    a.status = status;
    a.completed_at = status === 'complete' ? new Date().toISOString() : null;
    a.updated_at = new Date().toISOString();
    return saveStore(store);
  }

  function addPupilToMeeting(cr, row) {
    var store = loadStore();
    var existing = (store.pupil_reviews || []).find(function(p) {
      return p.class_review_id === cr.id && p.enrolment_id === row.enrolment.id;
    });
    if (existing) {
      existing.discussion_status = existing.discussion_status === 'skipped' ? 'added' : existing.discussion_status;
      existing.reviewed = false;
      existing.updated_at = new Date().toISOString();
    } else {
      store.pupil_reviews.push({
        id: uid('apr'),
        class_review_id: cr.id,
        enrolment_id: row.enrolment.id,
        pupil_id: row.enrolment.pupil_id,
        discussion_status: 'added',
        reviewed: false,
        notes: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }
    return saveStore(store);
  }

  function finishClassReview(crId, force) {
    var store = loadStore();
    var cr = byId(store.class_reviews, crId);
    if (!cr) return { ok: false, remaining: 0 };
    var remaining = pupilReviewsForClass(store, crId).filter(function(p) {
      return !p.reviewed && p.discussion_status !== 'skipped';
    }).length;
    if (remaining && !force) return { ok: false, remaining: remaining, cr: cr };
    cr.status = 'complete';
    cr.completed_at = new Date().toISOString();
    cr.updated_at = cr.completed_at;
    saveStore(store);
    return { ok: true, remaining: remaining, cr: cr };
  }

  function createCycle(opts) {
    var d = db();
    var store = loadStore();
    var tps = global.SptStore.trackingPoints(d);
    var tp = byId(tps, opts.tracking_point_id) || tps[0];
    var tpLabel = tpShort(tp, tps.indexOf(tp));
    var yearGroup = opts.year_group || 'S4';
    var session = opts.session || ((global.SptConfig && global.SptConfig.currentAcademicYear()) || '');
    var title = String(opts.title || '').trim() || defaultTitle(yearGroup, tpLabel);
    var rec = Object.assign({
      id: uid('arc'),
      title: title,
      year_group: yearGroup,
      tracking_point_id: tp ? tp.id : null,
      tracking_point_label: tpLabel,
      session: session,
      status: 'open',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }, actorMeta(d));
    store.review_cycles.unshift(rec);
    saveStore(store);
    return rec;
  }

  function cycleStats(d, store, cycle) {
    var classIds = classIdsForCycle(d, cycle);
    var completed = 0;
    var inProgress = 0;
    var discussed = 0;
    var actionCount = 0;
    classIds.forEach(function(classId) {
      var cr = classReview(store, cycle.id, classId);
      if (cr && cr.status === 'complete') completed++;
      else if (cr && cr.status === 'in_progress') inProgress++;
      if (cr) {
        discussed += pupilReviewsForClass(store, cr.id).filter(function(p) {
          return p.reviewed || p.discussion_status === 'skipped';
        }).length;
        actionCount += actionsForClass(store, cr.id).length;
      }
    });
    return {
      classes: classIds.length,
      completed: completed,
      inProgress: inProgress,
      remaining: classIds.length - completed,
      discussed: discussed,
      actions: actionCount
    };
  }

  function countByOwner(actions) {
    var out = { teacher: 0, faculty_head: 0, slt: 0, monitor: 0 };
    (actions || []).forEach(function(a) {
      if (out[a.owner_type] != null) out[a.owner_type]++;
      else out[a.owner_type] = 1;
    });
    return out;
  }

  function draftFor(enrolmentId) {
    if (!ui.drafts[enrolmentId]) {
      ui.drafts[enrolmentId] = { owner: 'teacher', text: '', reviewPointId: '', reviewDate: '' };
    }
    return ui.drafts[enrolmentId];
  }

  function nextTpId(d, currentId) {
    var tps = global.SptStore.trackingPoints(d);
    var idx = tps.findIndex(function(tp) { return tp.id === currentId; });
    if (idx >= 0 && idx < tps.length - 1) return tps[idx + 1].id;
    return '';
  }

  function supportHistory(d, enrolmentId) {
    var items = [];
    (d.interventions || []).forEach(function(int) {
      if (int.enrolment_id !== enrolmentId) return;
      var trail = global.SptInterventions && global.SptInterventions.trailForIntervention
        ? global.SptInterventions.trailForIntervention(d, int.id) : [];
      items.push({
        kind: 'intervention',
        title: int.intervention_description || int.concern_area || 'Intervention',
        when: int.intervention_start_date || int.created_at || '',
        status: int.intervention_status,
        outcome: int.impact_rating || int.outcome_notes || '',
        trail: trail
      });
      trail.forEach(function(entry) {
        items.push({
          kind: 'trail',
          title: entry.note || 'Support note',
          when: entry.created_at || '',
          status: entry.source === 'closure' ? 'Closed' : 'Follow-up',
          outcome: ''
        });
      });
    });
    (d.teacher_concerns || []).forEach(function(f) {
      if (f.enrolment_id !== enrolmentId) return;
      if (f.resolution_note) {
        items.push({
          kind: 'concern',
          title: f.resolution_note,
          when: f.resolved_at || f.action_taken_at || f.created_at || '',
          status: f.status,
          outcome: f.closure_outcome || f.status
        });
      }
    });
    items.sort(function(a, b) { return String(b.when).localeCompare(String(a.when)); });
    return items;
  }

  function interventionsFor(d, enrolmentId) {
    return (d.interventions || []).filter(function(int) { return int.enrolment_id === enrolmentId; });
  }

  function concernsFor(d, enrolmentId) {
    if (global.SptConcerns && global.SptConcerns.activeFlags) {
      return global.SptConcerns.activeFlags(d, enrolmentId);
    }
    return (d.teacher_concerns || []).filter(function(f) {
      return f.enrolment_id === enrolmentId && (f.status === 'Open' || f.status === 'Ongoing');
    });
  }

  function otherContext(d, row, cycle) {
    var notes = [];
    var rec = (d.attendance_records || []).find(function(a) {
      return a.enrolment_id === row.enrolment.id && a.tracking_point_id === cycle.tracking_point_id;
    });
    if (rec && rec.teacher_comment) notes.push(rec.teacher_comment);
    var track = global.SptStore.trackingRecordFor(d, row.enrolment.id, cycle.tracking_point_id);
    if (track && track.teacher_comment && notes.indexOf(track.teacher_comment) < 0) {
      notes.push(track.teacher_comment);
    }
    if (row.prelim_summary && row.prelim_summary.teacher_comment) {
      notes.push(row.prelim_summary.teacher_comment);
    }
    return notes.filter(Boolean);
  }

  function s3Display(row) {
    if (!row.shows_s3_baseline || !row.s3_baseline) return null;
    var b = row.s3_baseline;
    var course = row.course;
    if (global.SptBaseline && global.SptBaseline.s3ExamResult) {
      var res = global.SptBaseline.s3ExamResult(b, course);
      if (res && (res.grade || res.percentage != null)) {
        return (res.grade || '') + (res.percentage != null ? ' · ' + Math.round(res.percentage) + '%' : '');
      }
    }
    return b.s3_exam_grade || (b.s3_exam_mark != null ? String(b.s3_exam_mark) : null);
  }

  function snapshotMetrics(d, row, cycle) {
    var en = row.enrolment;
    var tpId = cycle.tracking_point_id;
    var wg = wgForEnrolment(d, en.id, tpId, row.course);
    var prev = previousWg(d, en.id, tpId, row.course);
    var scores = trackingScores(d, en.id, tpId);
    var attPct = wg.pct;
    if (attPct == null && row.pupil && row.pupil.end_of_year_attendance_percent != null) {
      attPct = row.pupil.end_of_year_attendance_percent;
    }
    var attNum = attPct != null && attPct !== '' ? parseFloat(attPct) : null;
    var belowTarget = false;
    if (global.SptConfig && global.SptConfig.gradeRank && wg.label && wg.label !== '—' && en.target_grade) {
      var wr = global.SptConfig.gradeRank(wg.label);
      var tr = global.SptConfig.gradeRank(en.target_grade);
      if (wr >= 0 && tr >= 0 && wr < tr) belowTarget = true;
    }
    var tps = global.SptStore.trackingPoints(d);
    var tpHistory = tps.map(function(tp, i) {
      var g = wgForEnrolment(d, en.id, tp.id, row.course);
      return { label: tpShort(tp, i), value: g.label, below: false, score: g.score };
    });
    tpHistory.forEach(function(h) {
      if (global.SptConfig && global.SptConfig.gradeRank && h.value && h.value !== '—' && en.target_grade) {
        h.below = global.SptConfig.gradeRank(h.value) < global.SptConfig.gradeRank(en.target_grade);
      }
    });
    var effortHist = [];
    tps.forEach(function(tp) {
      var rec = global.SptStore.trackingRecordFor(d, en.id, tp.id);
      var v = rec ? global.SptStore.trackingScoreValue(rec, 'effort') : '';
      if (v !== '' && v != null) effortHist.push(v);
    });
    var usualEffort = effortHist.length ? effortHist[0] : null;
    if (effortHist.length > 1) {
      var counts = {};
      effortHist.forEach(function(v) { counts[v] = (counts[v] || 0) + 1; });
      usualEffort = effortHist.reduce(function(best, v) {
        return counts[v] > (counts[best] || 0) ? v : best;
      }, effortHist[0]);
    }
    return {
      wg: wg.label,
      prevWg: prev && prev.score != null ? prev.label : null,
      target: en.target_grade || '—',
      attendance: attNum != null && !isNaN(attNum) ? Math.round(attNum) + '%' : '—',
      attendanceNum: attNum,
      effort: scores.effort !== '' ? String(scores.effort) : '—',
      effortRaw: scores.effort,
      effortLabel: scores.effort !== '' ? scoreLabel(scores.effort) : '—',
      usualEffort: usualEffort,
      behaviour: scores.behaviour !== '' ? scoreLabel(scores.behaviour) : '—',
      behaviourRaw: scores.behaviour,
      risk: en.risk_status || 'Grey',
      s3: s3Display(row),
      prior: row.prior_display && row.prior_display.grade && row.prior_display.grade !== '—' ? row.prior_display.grade : null,
      belowTarget: belowTarget,
      tpHistory: tpHistory,
      openConcerns: row.open_flag_count || 0
    };
  }

  function discussionReasons(row, snap) {
    var items = [];
    var seen = {};
    function add(label) {
      if (!label || seen[label]) return;
      seen[label] = true;
      items.push(label);
    }
    (row.enrolment.risk_reasons || []).forEach(function(r) {
      var s = String(r).toLowerCase();
      if (s.indexOf('working grade') >= 0 || s.indexOf('below target') >= 0 || s.indexOf('wg ') >= 0) add('Below target');
      else if (s.indexOf('attendance') >= 0) add('Attendance concern');
      else if (s.indexOf('effort') >= 0) {
        add(snap.effortRaw !== '' && snap.effortRaw != null ? 'Effort ' + snap.effortRaw : 'Effort concern');
      } else if (s.indexOf('behaviour') >= 0) add('Behaviour concern');
      else if (s.indexOf('intervention') >= 0) add('Active support');
      else if (s.indexOf('s3') >= 0) add('S3 exam');
      else if (s.indexOf('prelim') >= 0) add('Prelim concern');
      else add(String(r));
    });
    if (snap.belowTarget) add('Below target');
    if (snap.attendanceNum != null && !isNaN(snap.attendanceNum) && snap.attendanceNum < 90) add('Attendance concern');
    if (snap.effortRaw === 1 || snap.effortRaw === 2 || snap.effortRaw === '1' || snap.effortRaw === '2') {
      add('Effort ' + snap.effortRaw);
    }
    if ((row.open_flag_count || 0) > 0) add('Open concern');
    if ((row.active_interventions || []).length) add('Active support');
    return items;
  }

  function pupilInitials(d, pupilId) {
    var p = global.SptStore.byId(d.pupils, pupilId);
    if (!p) return '?';
    var a = (p.preferred_name || p.first_name || '?').charAt(0);
    var b = (p.surname || '').charAt(0);
    return (a + b).toUpperCase();
  }

  function pupilFirstName(d, pupilId) {
    var p = global.SptStore.byId(d.pupils, pupilId);
    return p ? (p.preferred_name || p.first_name || 'this pupil') : 'this pupil';
  }

  function currentStaffLabel(d) {
    var r = role();
    var name = '';
    if (d.simulated_teacher_id) name = global.SptStore.teacherName(d, d.simulated_teacher_id);
    if ((!name || name === '—') && r && r.viewAll) {
      var fh = (d.teachers || []).find(function(t) { return t && /faculty head/i.test(t.role || ''); });
      if (fh) name = global.SptStore.teacherName(d, fh.id);
    }
    if (!name || name === '—') name = (r && r.label) || 'Staff';
    return name;
  }

  function queueState(item, isActive) {
    if (isActive) return { id: 'discussion', label: 'Discussion' };
    if (item.review.discussion_status === 'skipped') return { id: 'skipped', label: 'Skipped' };
    if (item.review.reviewed) return { id: 'reviewed', label: 'Reviewed' };
    return { id: 'todo', label: 'To discuss' };
  }

  function queueSummary(snap) {
    return 'WG ' + snap.wg + ' · Target ' + snap.target + ' · Att ' + snap.attendance;
  }

  function snapTone(kind, snap) {
    if (kind === 'wg' && snap.belowTarget) return 'is-risk';
    if (kind === 'att' && snap.attendanceNum != null && !isNaN(snap.attendanceNum)) {
      if (snap.attendanceNum < 75) return 'is-risk';
      if (snap.attendanceNum < 90) return 'is-warn';
    }
    if (kind === 'effort' && (snap.effortRaw === 1 || snap.effortRaw === 2 || snap.effortRaw === '1' || snap.effortRaw === '2')) {
      return snap.effortRaw == 1 ? 'is-risk' : 'is-warn';
    }
    if (kind === 'behaviour' && (snap.behaviourRaw === 1 || snap.behaviourRaw === 2)) return 'is-warn';
    return '';
  }

  function svgIcon(name) {
    var common = ' class="am-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
    var paths = {
      flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>',
      users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
      check: '<polyline points="20 6 9 17 4 12"/>',
      printer: '<polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
      plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
      x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
      notes: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
      grid: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>',
      chevronL: '<polyline points="15 18 9 12 15 6"/>',
      chevronR: '<polyline points="9 18 15 12 9 6"/>',
      pencil: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>'
    };
    return '<svg' + common + '>' + (paths[name] || '') + '</svg>';
  }

  function outcomeClass(outcome) {
    var s = String(outcome || '').toLowerCase();
    if (s.indexOf('significant') >= 0 || s.indexOf('resolved') >= 0) return 'is-good';
    if (s.indexOf('some') >= 0) return 'is-some';
    if (s.indexOf('not yet') >= 0 || s.indexOf('no ') >= 0) return 'is-none';
    return '';
  }

  function setClassMeetingNotes(classReviewId, notes) {
    var store = loadStore();
    var cr = byId(store.class_reviews, classReviewId);
    if (!cr) return store;
    cr.meeting_notes = notes;
    cr.updated_at = new Date().toISOString();
    return saveStore(store);
  }

  function applySuggestList(cr, rows) {
    var before = pupilReviewsForClass(loadStore(), cr.id).length;
    var store = loadStore();
    seedSuggested(store, cr, rows);
    saveStore(store);
    return pupilReviewsForClass(loadStore(), cr.id).length - before;
  }

  function reviewPointLabel(d, action) {
    if (action.review_date) return formatDate(action.review_date);
    if (action.review_point_id) {
      var tps = global.SptStore.trackingPoints(d);
      var tp = byId(tps, action.review_point_id);
      return tp ? tpShort(tp, tps.indexOf(tp)) : '';
    }
    return '';
  }

  /* ── views ───────────────────────────────────────── */

  function renderHome() {
    var d = db();
    var r = role();
    var store = loadStore();
    var cycles = (store.review_cycles || []).slice();
    if (!r.viewAll) {
      cycles = cycles.filter(function(c) { return classIdsForCycle(d, c).length; });
    }
    var html = '<div class="am-page">';
    html += '<div class="am-head"><div><h1>Attainment Meetings</h1>';
    html += '<p>Review pupils at risk, agree actions and track next steps.</p></div>';
    html += '<div class="am-head-actions">';
    html += '<button type="button" class="btn btn-secondary" data-am-view="my-actions">My attainment actions</button>';
    if (canManage(r)) {
      html += '<button type="button" class="btn" data-am-toggle-create>' + (ui.showCreate ? 'Close' : 'New review cycle') + '</button>';
    }
    html += '</div></div>';

    if (canManage(r) && ui.showCreate) html += renderCreateForm(d);

    if (!cycles.length) {
      html += '<p class="am-empty">' + (canManage(r)
        ? 'No review cycles yet. Create one to start class conversations after a tracking period.'
        : 'No attainment reviews are available for your classes yet.') + '</p>';
    }
    cycles.forEach(function(cycle) {
      var st = cycleStats(d, store, cycle);
      html += '<article class="am-cycle-card"><h2>' + esc(cycle.title) + '</h2>';
      html += '<div class="am-cycle-meta">';
      html += '<span><strong>' + st.classes + '</strong> classes</span>';
      html += '<span><strong>' + st.completed + '</strong> completed</span>';
      html += '<span><strong>' + st.inProgress + '</strong> in progress</span>';
      html += '<span><strong>' + st.remaining + '</strong> remaining</span>';
      html += '<span><strong>' + st.discussed + '</strong> pupils discussed</span>';
      html += '<span><strong>' + st.actions + '</strong> actions agreed</span>';
      html += '</div><div class="am-cycle-actions">';
      html += '<button type="button" class="btn" data-am-open-cycle="' + esc(cycle.id) + '">Open review</button>';
      html += '<button type="button" class="btn btn-secondary" data-am-cycle-summary="' + esc(cycle.id) + '">View summary</button>';
      html += '<button type="button" class="btn btn-secondary" data-am-print="cycle" data-am-cycle="' + esc(cycle.id) + '">Print / export actions</button>';
      html += '</div></article>';
    });
    html += '</div>';
    return html;
  }

  function renderCreateForm(d) {
    var tps = global.SptStore.trackingPoints(d);
    var years = (global.SptConfig && global.SptConfig.SENIOR_YEAR_GROUPS) || ['S4', 'S5', 'S6'];
    var session = (global.SptConfig && global.SptConfig.currentAcademicYear()) || '';
    var html = '<div class="am-create"><h2>Create review cycle</h2><div class="am-create-row">';
    html += '<div class="am-field"><label for="am-year">Year group</label><select id="am-year">';
    years.forEach(function(y) {
      html += '<option value="' + esc(y) + '"' + (y === 'S4' ? ' selected' : '') + '>' + esc(y) + '</option>';
    });
    html += '</select></div>';
    html += '<div class="am-field"><label for="am-tp">Tracking point</label><select id="am-tp">';
    tps.forEach(function(tp, i) {
      html += '<option value="' + esc(tp.id) + '">' + esc(tpShort(tp, i)) + ' — ' + esc(tp.tracking_point_name || '') + '</option>';
    });
    html += '</select></div>';
    html += '<div class="am-field"><label for="am-session">Session</label><input id="am-session" value="' + esc(session) + '"></div>';
    html += '<div class="am-field" style="min-width:14rem"><label for="am-title">Title (optional)</label><input id="am-title" placeholder="Leave blank to auto-name"></div>';
    html += '<button type="button" class="btn" id="am-create-cycle">Create</button>';
    html += '</div><p class="am-title-preview" id="am-title-preview"></p></div>';
    return html;
  }

  function classQueueModel(d, store, cycle) {
    return classIdsForCycle(d, cycle).map(function(classId) {
      var cl = global.SptStore.byId(d.classes, classId);
      var rows = rowsForClass(d, cycle, classId);
      var cr = classReview(store, cycle.id, classId);
      if (cr) seedSuggested(store, cr, rows);
      var discuss = 0;
      var reviewed = 0;
      if (cr) {
        var list = discussionList(store, cr, rows);
        discuss = activeDiscussion(list).length;
        reviewed = activeDiscussion(list).filter(function(i) { return i.review.reviewed; }).length;
      } else {
        discuss = rows.filter(isSuggested).length;
      }
      var status = cr ? cr.status : 'not_started';
      return {
        classId: classId,
        className: cl ? cl.class_name : global.SptStore.className(d, classId),
        teacherName: cl ? global.SptStore.teacherName(d, cl.teacher_id) : '—',
        teacherId: cl ? cl.teacher_id : null,
        pupils: rows.length,
        discuss: discuss,
        reviewed: reviewed,
        status: status,
        cr: cr
      };
    }).sort(function(a, b) { return a.className.localeCompare(b.className); });
  }

  function statusLabel(status) {
    if (status === 'complete') return '<span class="am-status is-complete">Complete</span>';
    if (status === 'in_progress') return '<span class="am-status is-progress">In progress</span>';
    return '<span class="am-status">Not started</span>';
  }

  function renderCycle() {
    var d = db();
    var store = loadStore();
    var cycle = byId(store.review_cycles, ui.cycleId);
    if (!cycle) return renderHome();
    var classes = classQueueModel(d, store, cycle);
    saveStore(store);
    var html = '<div class="am-page am-page--wide">';
    html += '<div class="am-head"><div>';
    html += '<p><button type="button" class="am-link" data-am-view="home">Attainment meetings</button></p>';
    html += '<h1>' + esc(cycle.title) + '</h1>';
    html += '<p>' + esc(cycle.year_group) + ' · ' + esc(cycle.tracking_point_label || '') +
      (cycle.session ? ' · ' + esc(cycle.session) : '') + '</p></div>';
    html += '<div class="am-head-actions">';
    html += '<button type="button" class="btn btn-secondary" data-am-cycle-summary="' + esc(cycle.id) + '">Combined summary</button>';
    html += '<button type="button" class="btn btn-secondary" data-am-print="cycle" data-am-cycle="' + esc(cycle.id) + '">Print actions</button>';
    html += '</div></div>';
    html += '<div class="spt-home-panel"><div class="spt-home-table-wrap"><table class="am-table"><thead><tr>';
    html += '<th>Class</th><th>Teacher</th><th class="cell-num">Pupils</th><th class="cell-num">To discuss</th><th>Status</th><th></th>';
    html += '</tr></thead><tbody>';
    if (!classes.length) {
      html += '<tr><td colspan="6" class="am-empty">No classes for this year group in your view.</td></tr>';
    }
    classes.forEach(function(c) {
      var action = 'Start review';
      if (c.status === 'in_progress') action = 'Resume';
      if (c.status === 'complete') action = 'View summary';
      html += '<tr><td class="am-class-name">' + esc(c.className) + '</td>';
      html += '<td>' + esc(c.teacherName) + '</td>';
      html += '<td class="cell-num">' + c.pupils + '</td>';
      html += '<td class="cell-num">' + c.discuss + '</td>';
      html += '<td>' + statusLabel(c.status) + '</td>';
      html += '<td class="cell-action">';
      if (c.status === 'complete') {
        html += '<button type="button" class="btn btn-secondary btn-sm" data-am-class-summary="' + esc(c.classId) + '">' + action + '</button>';
      } else if (canEditMeetings()) {
        html += '<button type="button" class="btn btn-sm" data-am-start-class="' + esc(c.classId) + '">' + action + '</button>';
      }
      html += '</td></tr>';
    });
    html += '</tbody></table></div></div></div>';
    return html;
  }

  function renderChrome(d, cycle, info, canEdit) {
    var crumb = cycle.title || 'Attainment meeting';
    var html = '<header class="am-chrome am-no-print">';
    html += '<div class="am-chrome-left">';
    html += '<button type="button" class="am-chrome-back" data-am-open-cycle="' + esc(cycle.id) + '">Classes</button>';
    html += '<h1>Attainment Meeting</h1>';
    html += '</div>';
    html += '<p class="am-chrome-crumb">' + esc(crumb) + '</p>';
    html += '<div class="am-chrome-right">';
    html += '<span class="am-chrome-you">You: ' + esc(currentStaffLabel(d)) + ' (' + esc(role().label || 'Staff') + ')</span>';
    if (canEdit) {
      html += '<button type="button" class="am-chrome-btn' + (ui.showClassNotes ? ' is-on' : '') +
        '" data-am-toggle-class-notes>' + svgIcon('notes') + ' Meeting notes</button>';
    }
    html += '</div></header>';
    return html;
  }

  function renderPupilQueue(d, cycle, list, currentId, canEdit) {
    var html = '<div class="am-queue-head">';
    html += '<h3>Pupil queue</h3>';
    if (canEdit) {
      html += '<button type="button" class="am-quiet-btn" data-am-suggest-list>Suggest list</button>';
    }
    html += '</div>';
    html += '<div class="am-pupil-queue" role="list">';
    if (!list.length) {
      html += '<p class="am-empty">No pupils on the list yet. Use Suggest list to add those at risk, or add a pupil.</p>';
    }
    list.forEach(function(item, i) {
      var en = item.row.enrolment;
      var isActive = en.id === currentId;
      var st = queueState(item, isActive);
      var snap = snapshotMetrics(d, item.row, cycle);
      var name = global.SptStore.pupilName(d, en.pupil_id);
      var flagged = isSuggested(item.row);
      var cls = 'am-q-item' + (isActive ? ' is-active' : '') + (st.id === 'skipped' ? ' is-skip' : '') +
        (st.id === 'reviewed' ? ' is-done' : '');
      html += '<button type="button" class="' + cls + '" role="listitem" data-am-pupil="' + esc(en.id) + '">';
      html += '<span class="am-q-num">' + (i + 1) + '</span>';
      html += '<span class="am-q-body">';
      html += '<span class="am-q-top"><span class="am-q-name">' + esc(name) + '</span>';
      if (flagged) html += '<span class="am-q-flag" title="Priority">' + svgIcon('flag') + '</span>';
      html += '<span class="am-q-state is-' + st.id + '">' + esc(st.label) + '</span></span>';
      html += '<span class="am-q-sum">' + esc(queueSummary(snap)) + '</span>';
      html += '</span></button>';
    });
    html += '</div>';
    return html;
  }

  function renderAside(d, row, cycle) {
    var support = supportHistory(d, row.enrolment.id).filter(function(s) { return s.kind !== 'trail'; }).slice(0, 6);
    var ints = interventionsFor(d, row.enrolment.id);
    var concerns = concernsFor(d, row.enrolment.id);
    var context = otherContext(d, row, cycle || {});
    var html = '<aside class="am-aside">';

    html += '<details class="am-panel" open><summary>Previous support</summary>';
    if (!support.length) html += '<p class="am-empty">Nothing recorded yet.</p>';
    html += '<ol class="am-timeline">';
    support.forEach(function(s) {
      html += '<li><span class="am-timeline-when">' + esc(formatDate(s.when) || '') + '</span>';
      html += '<span class="am-timeline-title">' + esc(s.title) + '</span>';
      if (s.outcome) {
        html += '<span class="am-outcome ' + outcomeClass(s.outcome) + '">' + esc(s.outcome) + '</span>';
      } else if (s.status) {
        html += '<span class="am-outcome">' + esc(s.status) + '</span>';
      }
      html += '</li>';
    });
    html += '</ol></details>';

    html += '<details class="am-panel"><summary>Interventions';
    if (ints.length) html += '<span class="am-count">' + ints.length + '</span>';
    html += '</summary>';
    if (!ints.length) html += '<p class="am-empty">No interventions on record.</p>';
    ints.forEach(function(int) {
      var past = int.intervention_status === 'Completed';
      html += '<div class="am-side-item"><span>' + esc(int.intervention_description || int.concern_area || 'Intervention') +
        '</span><span class="am-pill' + (past ? ' is-past' : ' is-live') + '">' +
        esc(past ? 'Past' : (int.intervention_status || 'Active')) + '</span></div>';
    });
    html += '</details>';

    html += '<details class="am-panel"' + (concerns.length ? ' open' : '') + '><summary>Concerns';
    if (concerns.length) html += '<span class="am-count is-risk">' + concerns.length + '</span>';
    html += '</summary>';
    if (!concerns.length) html += '<p class="am-empty">No open concerns.</p>';
    concerns.forEach(function(f) {
      var raiser = f.raised_by_teacher_id ? global.SptStore.teacherName(d, f.raised_by_teacher_id) : '';
      html += '<div class="am-side-item"><div><strong>' + esc(f.category || 'Concern') + '</strong>';
      if (f.comment) html += '<p>' + esc(f.comment) + '</p>';
      if (raiser && raiser !== '—') html += '<span class="am-muted">Raised by ' + esc(raiser) + '</span>';
      html += '</div><span class="am-pill is-open">' + esc(f.status || 'Open') + '</span></div>';
    });
    html += '</details>';

    html += '<details class="am-panel"><summary>Other context</summary>';
    if (!context.length) html += '<p class="am-empty">No extra notes in tracking.</p>';
    else {
      html += '<ul class="am-context">';
      context.forEach(function(n) { html += '<li>' + esc(n) + '</li>'; });
      html += '</ul>';
    }
    html += '</details></aside>';
    return html;
  }

  function renderReview() {
    var d = db();
    var store = loadStore();
    var cycle = byId(store.review_cycles, ui.cycleId);
    if (!cycle) return renderHome();
    var classes = classQueueModel(d, store, cycle);
    var classId = ui.classId || (classes[0] && classes[0].classId);
    if (!classId) return renderCycle();
    ui.classId = classId;
    var info = classes.find(function(c) { return c.classId === classId; });
    var cr = startClassReview(cycle, classId);
    store = loadStore();
    var rows = rowsForClass(d, cycle, classId);
    var list = discussionList(store, cr, rows);
    var active = activeDiscussion(list);
    if (!ui.enrolmentId && active[0]) ui.enrolmentId = active[0].row.enrolment.id;
    var current = list.find(function(i) { return i.row.enrolment.id === ui.enrolmentId; }) || active[0] || list[0];
    if (current) ui.enrolmentId = current.row.enrolment.id;

    var handled = list.filter(function(i) {
      return i.review.reviewed || i.review.discussion_status === 'skipped';
    }).length;
    var remaining = active.filter(function(i) { return !i.review.reviewed; }).length;
    var pct = list.length ? Math.round(handled / list.length * 100) : 0;
    var mins = remaining * 3;
    var canEdit = canEditMeetings();
    var saveCls = ui.saveState === 'saving' ? ' is-saving' : ui.saveState === 'saved' ? ' is-saved' : '';
    var saveTxt = ui.saveState === 'saving' ? 'Saving…' : ui.saveState === 'saved' ? 'Saved' : '';

    var html = '<div class="am-workspace">';
    html += renderChrome(d, cycle, info, canEdit);

    if (ui.showClassNotes && canEdit) {
      html += '<div class="am-class-notes am-no-print">';
      html += '<label for="am-class-notes">Class meeting notes</label>';
      html += '<textarea id="am-class-notes" placeholder="Whole-class points that should not sit on one pupil record.">' +
        esc(cr.meeting_notes || '') + '</textarea></div>';
    }

    html += '<div class="am-workspace-body">';

    html += '<section class="am-col-queue" aria-label="Class and pupil queue">';
    html += '<article class="am-class-card">';
    html += '<div class="am-class-card-top"><h2>' + esc(info ? info.className : '') + '</h2>';
    html += '<span class="am-enrolled">' + (info ? info.pupils : 0) + ' enrolled</span></div>';
    html += '<p class="am-class-teacher">Teacher: ' + esc(info ? info.teacherName : '—') + '</p>';
    html += '<p class="am-class-cycle">' + esc(cycle.title) + '</p>';
    html += '<div class="am-review-progress">';
    html += '<span>' + handled + ' of ' + list.length + ' pupils reviewed</span>';
    html += '<div class="am-bar" role="progressbar" aria-valuenow="' + handled + '" aria-valuemin="0" aria-valuemax="' +
      list.length + '"><span style="width:' + pct + '%"></span></div>';
    html += '<span class="am-mins">' + (mins > 0 ? '~' + mins + ' mins remaining' : 'Queue complete') + '</span>';
    html += '</div></article>';
    html += renderPupilQueue(d, cycle, list, ui.enrolmentId, canEdit);
    html += '<div class="am-queue-foot">';
    if (canEdit) {
      html += '<button type="button" class="am-quiet-btn" data-am-add-pupil>' +
        svgIcon('plus') + ' Add pupil</button>';
    }
    html += '<button type="button" class="am-quiet-btn" data-am-class-summary="' + esc(classId) + '">' +
      svgIcon('grid') + ' Class summary</button>';
    html += '</div></section>';

    html += '<section class="am-col-main" aria-label="Pupil discussion">';
    if (!current) {
      html += '<div class="am-pupil am-pupil--empty"><p class="am-empty">No pupils suggested for discussion.</p>';
      if (canEdit) {
        html += '<p>Use Suggest list for pupils at risk, or add someone the list missed.</p>';
      }
      html += '</div>';
    } else {
      html += renderPupilPane(d, store, cycle, cr, current, list, canEdit);
    }
    html += '</section>';

    if (current) html += renderAside(d, current.row, cycle);
    else html += '<aside class="am-aside"><p class="am-empty">Select a pupil to see previous support.</p></aside>';

    html += '</div>';

    html += '<footer class="am-dock am-no-print">';
    html += '<div class="am-dock-meta"><span class="am-save-status' + saveCls + '">' + (saveTxt || '\u00a0') + '</span></div>';
    html += '<div class="am-dock-actions">';
    html += '<div class="am-dock-nav">';
    if (canEdit && current) {
      html += '<button type="button" class="am-btn-ghost" data-am-skip-pupil>Skip this pupil</button>';
      html += '<button type="button" class="am-btn-primary" data-am-save-next>Save &amp; next pupil</button>';
    }
    html += '</div>';
    html += '<div class="am-dock-end">';
    if (canEdit) {
      html += '<button type="button" class="am-btn-text" data-am-finish-class>Finish class review</button>';
    }
    html += '<button type="button" class="am-btn-text" data-am-print="class" data-am-cycle="' + esc(cycle.id) +
      '" data-am-class="' + esc(classId) + '">Print action sheet</button>';
    html += '</div></div></footer></div>';
    return html;
  }

  function renderPupilPane(d, store, cycle, cr, current, list, canEdit) {
    var row = current.row;
    var en = row.enrolment;
    var name = global.SptStore.pupilName(d, en.pupil_id);
    var first = pupilFirstName(d, en.pupil_id);
    var courseLabel = (row.course && row.course.course_name) || en.current_level || '';
    var snap = snapshotMetrics(d, row, cycle);
    var reasons = discussionReasons(row, snap);
    var pupilActions = actionsForPupil(store, cr.id, en.id);
    var draft = draftFor(en.id);
    var tps = global.SptStore.trackingPoints(d);
    if (!draft.reviewPointId) draft.reviewPointId = nextTpId(d, cycle.tracking_point_id);
    var idx = list.findIndex(function(i) { return i.row.enrolment.id === en.id; });
    var atRisk = snap.risk === 'Red' || snap.risk === 'Amber';
    var openConcern = (row.open_flags && row.open_flags[0]) || null;

    var html = '<div class="am-pupil">';
    html += '<div class="am-pupil-nav">';
    html += '<button type="button" class="am-nav-btn" data-am-prev-pupil ' + (idx <= 0 ? 'disabled' : '') + '>' +
      svgIcon('chevronL') + ' Previous</button>';
    html += '<div class="am-dots" aria-hidden="true">';
    list.forEach(function(item, i) {
      var cls = 'am-dot-step';
      if (item.row.enrolment.id === en.id) cls += ' is-on';
      else if (item.review.reviewed) cls += ' is-done';
      else if (item.review.discussion_status === 'skipped') cls += ' is-skip';
      html += '<span class="' + cls + '"></span>';
    });
    html += '</div>';
    html += '<span class="am-pupil-pos">' + (idx + 1) + ' of ' + list.length + ' pupils</span>';
    html += '<button type="button" class="am-nav-btn" data-am-next-pupil ' + (idx >= list.length - 1 ? 'disabled' : '') +
      '>Next pupil ' + svgIcon('chevronR') + '</button>';
    html += '</div>';

    html += '<div class="am-pupil-hero">';
    html += '<div class="am-avatar" aria-hidden="true">' + esc(pupilInitials(d, en.pupil_id)) + '</div>';
    html += '<div class="am-pupil-id">';
    html += '<h2 class="am-pupil-name">' + esc(name) + '</h2>';
    html += '<p class="am-pupil-sub">' + esc(courseLabel || '');
    if (atRisk) html += ' <span class="am-risk-badge">At risk</span>';
    html += ' · <button type="button" class="am-link" data-am-full-tracking="' + esc(en.id) + '">View full tracking</button></p>';
    html += '</div></div>';

    html += '<div class="am-why' + (reasons.length ? '' : ' is-quiet') + '">';
    html += '<h3>Why are we discussing ' + esc(first) + '?</h3>';
    if (!reasons.length) html += '<p>Added to this meeting. No stored risk reasons.</p>';
    else {
      html += '<div class="am-why-chips">';
      reasons.forEach(function(r) { html += '<span class="am-why-chip">' + esc(r) + '</span>'; });
      html += '</div>';
    }
    html += '</div>';

    html += '<dl class="am-snapshot">';
    html += '<div class="am-snap ' + snapTone('wg', snap) + '"><dt>WG</dt><dd>' + esc(snap.wg) + '</dd></div>';
    html += '<div class="am-snap ' + snapTone('target', snap) + '"><dt>Target</dt><dd>' + esc(snap.target) + '</dd></div>';
    html += '<div class="am-snap ' + snapTone('att', snap) + '"><dt>Attendance</dt><dd>' + esc(snap.attendance) + '</dd></div>';
    html += '<div class="am-snap ' + snapTone('effort', snap) + '"><dt>Effort</dt><dd>' + esc(snap.effort) + '</dd></div>';
    html += '<div class="am-snap ' + snapTone('behaviour', snap) + '"><dt>Behaviour</dt><dd>' +
      esc(snap.behaviourRaw !== '' && snap.behaviourRaw != null ? String(snap.behaviourRaw) : snap.behaviour) + '</dd></div>';
    html += '</dl>';

    html += '<section class="am-picture"><h3>Current picture</h3><div class="am-picture-grid">';
    snap.tpHistory.forEach(function(h) {
      html += '<div><span>' + esc(h.label) + '</span><strong class="' + (h.below ? 'is-risk' : '') + '">' +
        esc(h.value) + '</strong></div>';
    });
    if (snap.s3) html += '<div><span>S3 attainment</span><strong>' + esc(snap.s3) + '</strong></div>';
    if (snap.usualEffort != null) {
      html += '<div><span>Usual effort</span><strong>' + esc(String(snap.usualEffort)) + '</strong></div>';
    }
    html += '<div><span>Open concerns</span><strong>' + snap.openConcerns;
    if (openConcern && openConcern.comment) html += ' <em>' + esc(openConcern.comment) + '</em>';
    html += '</strong></div></div></section>';

    html += '<section class="am-notes-block"><h3>Discussion notes</h3>';
    html += '<textarea class="am-notes-area" id="am-notes" ' + (canEdit ? '' : 'readonly ') +
      'placeholder="What is the teacher seeing? Barriers, context, professional judgment.">' +
      esc(current.review.notes || '') + '</textarea></section>';

    html += '<section class="am-actions-block">';
    html += '<div class="am-actions-head"><h3>Agreed actions</h3>';
    if (canEdit) html += '<button type="button" class="am-heading-action" data-am-focus-action>Add action</button>';
    html += '</div>';
    if (canEdit) {
      html += '<div class="am-action-composer">';
      html += '<div class="am-owner-row">';
      OWNERS.forEach(function(o) {
        html += '<button type="button" class="am-owner is-' + o.id + (draft.owner === o.id ? ' is-on' : '') +
          '" data-am-owner="' + o.id + '">' + esc(o.label) + '</button>';
      });
      html += '</div>';
      html += '<textarea class="am-action-text" id="am-action-text" placeholder="Short next step, e.g. Weekly written-work check-in at the start of Thursday lesson.">' +
        esc(draft.text) + '</textarea>';
      html += '<div class="am-action-tools">';
      html += '<div class="am-field"><label for="am-review-tp">Review at</label>';
      html += '<select id="am-review-tp"><option value="">None</option>';
      tps.forEach(function(tp, i) {
        html += '<option value="' + esc(tp.id) + '"' + (draft.reviewPointId === tp.id ? ' selected' : '') + '>' +
          esc(tpShort(tp, i)) + '</option>';
      });
      html += '</select></div>';
      html += '<div class="am-field"><label for="am-review-date">Or date</label>';
      html += '<input id="am-review-date" type="date" value="' + esc(draft.reviewDate || '') + '"></div>';
      html += '<button type="button" class="am-composer-add" data-am-add-action>Add</button>';
      html += '</div></div>';
    }
    html += '<ul class="am-action-list">';
    if (!pupilActions.length) {
      html += '<li class="am-empty">No actions yet. Add a next step, or choose Monitor if discussion is enough.</li>';
    }
    pupilActions.forEach(function(a) {
      html += '<li class="am-action-row">';
      html += '<span class="am-owner-chip is-' + esc(a.owner_type) + '">' + esc(OWNER_LABEL[a.owner_type] || a.owner_type) + '</span>';
      html += '<div class="am-action-body"><p>' + esc(a.action_text) + '</p>';
      html += '<span class="am-action-meta">' + esc(a.status === 'complete' ? 'Complete' : (a.status === 'open' ? 'Open' : (a.status || 'Open')));
      if (reviewPointLabel(d, a)) html += ' · Review ' + esc(reviewPointLabel(d, a));
      html += '</span></div>';
      if (canEdit && a.status !== 'complete') {
        html += '<button type="button" class="am-icon-btn" data-am-del-action="' + esc(a.id) + '" aria-label="Remove action">' +
          svgIcon('x') + '</button>';
      }
      html += '</li>';
    });
    html += '</ul></section></div>';
    return html;
  }

  function groupedActionsHtml(d, actions, store) {
    var groups = [
      { id: 'teacher', title: 'Teacher actions' },
      { id: 'faculty_head', title: 'Faculty Head actions' },
      { id: 'slt', title: 'SLT escalations' },
      { id: 'monitor', title: 'Monitor' }
    ];
    var html = '';
    groups.forEach(function(g) {
      var items = actions.filter(function(a) { return a.owner_type === g.id; });
      html += '<h2>' + esc(g.title) + '</h2>';
      if (!items.length) {
        html += '<p class="am-empty">None.</p>';
        return;
      }
      items.forEach(function(a) {
        var name = global.SptStore.pupilName(d, a.pupil_id);
        var cl = global.SptStore.className(d, (byId(store.class_reviews, a.class_review_id) || {}).class_id);
        html += '<h3>' + esc(name) + (cl && cl !== '—' ? ' · ' + esc(cl) : '') + '</h3>';
        html += '<p>' + esc(a.action_text) +
          (reviewPointLabel(d, a) ? '<br>Review ' + esc(reviewPointLabel(d, a)) : '') + '</p>';
      });
    });
    return html;
  }

  function renderClassSummary() {
    var d = db();
    var store = loadStore();
    var cycle = byId(store.review_cycles, ui.cycleId);
    var cr = classReview(store, ui.cycleId, ui.classId);
    if (!cycle || !cr) return renderCycle();
    var cl = global.SptStore.byId(d.classes, ui.classId);
    var actions = actionsForClass(store, cr.id);
    var discussed = pupilReviewsForClass(store, cr.id).filter(function(p) {
      return p.reviewed || p.discussion_status === 'skipped';
    });
    var html = '<div class="am-page"><div class="am-head am-no-print"><div>';
    html += '<p><button type="button" class="am-link" data-am-open-cycle="' + esc(cycle.id) + '">Back to classes</button></p>';
    html += '<h1>' + esc(cl ? cl.class_name : '') + ' Attainment Review</h1></div>';
    html += '<div class="am-head-actions">';
    html += '<button type="button" class="btn btn-secondary" data-am-start-class="' + esc(ui.classId) + '">Return to review</button>';
    html += '<button type="button" class="btn" data-am-print="class" data-am-cycle="' + esc(cycle.id) + '" data-am-class="' + esc(ui.classId) + '">Print summary</button>';
    html += '</div></div>';
    html += '<article class="am-summary-doc" id="am-print-root">';
    html += '<h1>' + esc(cl ? cl.class_name : '') + ' Attainment Review</h1>';
    html += '<p class="am-doc-meta">' + esc(cycle.title) + '<br>';
    if (cycle.tracking_point_label && String(cycle.title).indexOf(cycle.tracking_point_label) < 0) {
      html += esc(cycle.tracking_point_label) + ' · ';
    }
    html += esc(cycle.year_group) +
      '<br>Teacher: ' + esc(cl ? global.SptStore.teacherName(d, cl.teacher_id) : '—') +
      '<br>Meeting date: ' + esc(formatDate(cr.completed_at || cr.started_at || cr.updated_at)) +
      '<br>Pupils discussed: ' + discussed.length + '</p>';
    html += '<h2>Pupils in this review</h2>';
    if (!discussed.length) html += '<p class="am-empty">No pupils marked reviewed or skipped.</p>';
    discussed.forEach(function(p) {
      var status = p.discussion_status === 'skipped' ? 'Skipped' : 'Reviewed';
      html += '<p><strong>' + esc(global.SptStore.pupilName(d, p.pupil_id)) + '</strong> · ' + esc(status);
      if (p.notes) html += '<br>' + esc(p.notes) + '';
      html += '</p>';
    });
    html += groupedActionsHtml(d, actions, store);
    html += '</article></div>';
    return html;
  }

  function renderCycleSummary() {
    var d = db();
    var store = loadStore();
    var cycle = byId(store.review_cycles, ui.cycleId);
    if (!cycle) return renderHome();
    var st = cycleStats(d, store, cycle);
    var actions = [];
    (store.class_reviews || []).forEach(function(cr) {
      if (cr.review_cycle_id !== cycle.id) return;
      if (!global.SptStore.canViewClass(d, global.SptStore.byId(d.classes, cr.class_id))) return;
      actions = actions.concat(actionsForClass(store, cr.id));
    });
    var due = actions.filter(function(a) { return a.review_date || a.review_point_id; }).slice().sort(function(a, b) {
      return String(a.review_date || a.review_point_id).localeCompare(String(b.review_date || b.review_point_id));
    });
    var html = '<div class="am-page"><div class="am-head am-no-print"><div>';
    html += '<p><button type="button" class="am-link" data-am-open-cycle="' + esc(cycle.id) + '">Back to classes</button></p>';
    html += '<h1>' + esc(cycle.title) + '</h1></div>';
    html += '<div class="am-head-actions"><button type="button" class="btn" data-am-print="cycle" data-am-cycle="' + esc(cycle.id) + '">Print summary</button></div></div>';
    html += '<article class="am-summary-doc" id="am-print-root">';
    html += '<h1>' + esc(cycle.title) + '</h1>';
    html += '<p class="am-doc-meta">' + st.classes + ' classes · ' + st.discussed + ' pupils discussed · ' + st.actions + ' actions</p>';
    html += groupedActionsHtml(d, actions, store);
    html += '<h2>Review due</h2>';
    if (!due.length) html += '<p class="am-empty">No review points set.</p>';
    due.forEach(function(a) {
      html += '<p><strong>' + esc(global.SptStore.pupilName(d, a.pupil_id)) + '</strong> — ' +
        esc(OWNER_LABEL[a.owner_type] || '') + ': ' + esc(a.action_text) +
        ' · ' + esc(reviewPointLabel(d, a)) + '</p>';
    });
    html += '</article></div>';
    return html;
  }

  function renderMyActions() {
    var d = db();
    var r = role();
    var store = loadStore();
    var mine = (store.actions || []).filter(function(a) {
      var cr = byId(store.class_reviews, a.class_review_id);
      var cl = cr ? global.SptStore.byId(d.classes, cr.class_id) : null;
      if (!cl || !global.SptStore.canViewClass(d, cl)) return false;
      if (r.viewAll && r.canEdit) return a.owner_type === 'faculty_head';
      if (r.viewAll && !r.canEdit) return a.owner_type === 'slt';
      return a.owner_type === 'teacher';
    });
    var html = '<div class="am-page"><div class="am-head"><div>';
    html += '<p><button type="button" class="am-link" data-am-view="home">Attainment meetings</button></p>';
    html += '<h1>My attainment actions</h1>';
    html += '<p>Follow-up from class attainment reviews. Mark complete when done — this does not change tracking.</p></div></div>';
    html += '<div class="spt-home-panel"><table class="am-table"><thead><tr>';
    html += '<th>Pupil</th><th>Class</th><th>Action</th><th>Review</th><th>Status</th>';
    html += '</tr></thead><tbody>';
    if (!mine.length) html += '<tr><td colspan="5" class="am-empty">No actions assigned to you yet.</td></tr>';
    mine.forEach(function(a) {
      var cr = byId(store.class_reviews, a.class_review_id);
      html += '<tr><td>' + esc(global.SptStore.pupilName(d, a.pupil_id)) + '</td>';
      html += '<td>' + esc(cr ? global.SptStore.className(d, cr.class_id) : '—') + '</td>';
      html += '<td>' + esc(a.action_text) + '</td>';
      html += '<td>' + esc(reviewPointLabel(d, a) || '—') + '</td>';
      html += '<td>';
      if (canEditMeetings()) {
        html += '<select data-am-action-status="' + esc(a.id) + '">';
        html += '<option value="open"' + (a.status === 'open' ? ' selected' : '') + '>Open</option>';
        html += '<option value="complete"' + (a.status === 'complete' ? ' selected' : '') + '>Complete</option>';
        html += '</select>';
      } else html += esc(a.status === 'complete' ? 'Complete' : 'Open');
      html += '</td></tr>';
    });
    html += '</tbody></table></div></div>';
    return html;
  }

  function renderDenied() {
    return '<div class="am-page"><div class="am-head"><h1>Attainment Meetings</h1>' +
      '<p>This view is not available for the current role.</p></div></div>';
  }

  function render(appCtx) {
    ctx = appCtx;
    document.body.classList.toggle('am-review-focus', ui.view === 'review');
    document.body.classList.toggle('am-printing', ui.view === 'class-summary' || ui.view === 'cycle-summary');
    if (ui.view === 'home') return renderHome();
    if (ui.view === 'cycle') return renderCycle();
    if (ui.view === 'review') return renderReview();
    if (ui.view === 'class-summary') return renderClassSummary();
    if (ui.view === 'cycle-summary') return renderCycleSummary();
    if (ui.view === 'my-actions') return renderMyActions();
    return renderHome();
  }

  function refresh() {
    if (ctx && ctx.renderApp) ctx.renderApp();
  }

  function go(view, extras) {
    ui.view = view;
    if (extras) {
      if (extras.cycleId) ui.cycleId = extras.cycleId;
      if (extras.classId) ui.classId = extras.classId;
      if (extras.enrolmentId) ui.enrolmentId = extras.enrolmentId;
    }
    refresh();
  }

  function currentList() {
    var d = db();
    var store = loadStore();
    var cycle = byId(store.review_cycles, ui.cycleId);
    var cr = classReview(store, ui.cycleId, ui.classId);
    if (!cycle || !cr) return [];
    return discussionList(store, cr, rowsForClass(d, cycle, ui.classId));
  }

  function movePupil(delta) {
    var list = currentList();
    var idx = list.findIndex(function(i) { return i.row.enrolment.id === ui.enrolmentId; });
    if (idx < 0) return;
    var next = list[idx + delta];
    if (!next) return;
    ui.enrolmentId = next.row.enrolment.id;
    refresh();
  }

  function flushClassNotes() {
    var area = document.getElementById('am-class-notes');
    if (!area || !ui.cycleId || !ui.classId) return;
    var cr = classReview(loadStore(), ui.cycleId, ui.classId);
    if (!cr) return;
    setClassMeetingNotes(cr.id, area.value);
  }

  function flushNotes() {
    if (!ui.cycleId || !ui.classId || !ui.enrolmentId) {
      flushClassNotes();
      return;
    }
    var store = loadStore();
    var cr = classReview(store, ui.cycleId, ui.classId);
    var area = document.getElementById('am-notes');
    if (cr && area) {
      ui.saveState = 'saving';
      upsertPupilNotes(cr.id, ui.enrolmentId, area.value);
      ui.saveState = 'saved';
    }
    flushClassNotes();
  }

  function nextPending(fromId) {
    var list = currentList();
    var idx = list.findIndex(function(i) { return i.row.enrolment.id === fromId; });
    function pending(i) {
      return i && !i.review.reviewed && i.review.discussion_status !== 'skipped' && i.row.enrolment.id !== fromId;
    }
    var after = list.slice(Math.max(idx, 0) + 1).find(pending);
    if (after) return after;
    return list.find(pending) || list[idx + 1] || null;
  }

  function captureDraft() {
    if (!ui.enrolmentId) return;
    var draft = draftFor(ui.enrolmentId);
    var text = document.getElementById('am-action-text');
    var tp = document.getElementById('am-review-tp');
    var date = document.getElementById('am-review-date');
    if (text) draft.text = text.value;
    if (tp) draft.reviewPointId = tp.value;
    if (date) draft.reviewDate = date.value;
  }

  function commitDraftAction() {
    captureDraft();
    var draft = draftFor(ui.enrolmentId);
    var text = String(draft.text || '').trim();
    if (!text) return false;
    var d = db();
    var store = loadStore();
    var cycle = byId(store.review_cycles, ui.cycleId);
    var cr = classReview(store, ui.cycleId, ui.classId);
    var row = rowsForClass(d, cycle, ui.classId).find(function(r) { return r.enrolment.id === ui.enrolmentId; });
    if (!cr || !row) return false;
    addAction(Object.assign({
      class_review_id: cr.id,
      enrolment_id: row.enrolment.id,
      pupil_id: row.enrolment.pupil_id,
      owner_type: draft.owner || 'teacher',
      owner_id: draft.owner === 'teacher' ? (row.enrolment.teacher_id || null) : null,
      action_text: text,
      review_point_id: draft.reviewPointId || null,
      review_date: draft.reviewDate || null
    }, actorMeta(d)));
    draft.text = '';
    return true;
  }

  function printNow() {
    document.body.classList.add('am-printing');
    window.print();
    setTimeout(function() { document.body.classList.remove('am-printing'); }, 400);
  }

  function showAddPupilModal() {
    var d = db();
    var store = loadStore();
    var cycle = byId(store.review_cycles, ui.cycleId);
    var cr = classReview(store, ui.cycleId, ui.classId);
    var rows = rowsForClass(d, cycle, ui.classId);
    var inMeeting = {};
    pupilReviewsForClass(store, cr.id).forEach(function(p) {
      if (p.discussion_status !== 'skipped') inMeeting[p.enrolment_id] = true;
    });
    var options = rows.filter(function(r) { return !inMeeting[r.enrolment.id]; });
    var body = '<p>Add a pupil from this class who is not already on the discussion list. This does not change their risk status.</p>';
    if (!options.length) {
      body += '<p class="am-empty">Everyone in this class is already on the list (or skipped).</p>';
      ctx.openModal('Add pupil to meeting', body, '<button type="button" class="btn btn-secondary" id="modal-cancel">Close</button>');
      document.getElementById('modal-cancel').onclick = ctx.closeModal;
      return;
    }
    body += '<div class="am-field"><label for="am-add-select">Pupil</label><select id="am-add-select">';
    options.forEach(function(r) {
      body += '<option value="' + esc(r.enrolment.id) + '">' + esc(global.SptStore.pupilName(d, r.enrolment.pupil_id)) + '</option>';
    });
    body += '</select></div>';
    ctx.openModal('Add pupil to meeting', body,
      '<button type="button" class="btn btn-secondary" id="modal-cancel">Cancel</button>' +
      '<button type="button" class="btn" id="am-add-confirm">Add</button>');
    document.getElementById('modal-cancel').onclick = ctx.closeModal;
    document.getElementById('am-add-confirm').onclick = function() {
      var sel = document.getElementById('am-add-select');
      var row = options.find(function(r) { return r.enrolment.id === sel.value; });
      if (row) {
        addPupilToMeeting(cr, row);
        ui.enrolmentId = row.enrolment.id;
      }
      ctx.closeModal();
      refresh();
    };
  }

  function confirmFinish() {
    var store = loadStore();
    var cr = classReview(store, ui.cycleId, ui.classId);
    if (!cr) return;
    var result = finishClassReview(cr.id, false);
    if (result.ok) {
      ui.view = 'class-summary';
      refresh();
      return;
    }
    ctx.openModal('Finish class review?',
      '<p class="am-warn">' + result.remaining + ' pupil' + (result.remaining === 1 ? ' has' : 's have') +
      ' not yet been reviewed.</p>' +
      '<p>Continue the meeting, or finish anyway without marking remaining pupils as reviewed.</p>',
      '<button type="button" class="btn btn-secondary" id="modal-cancel">Continue meeting</button>' +
      '<button type="button" class="btn" id="am-finish-anyway">Finish without reviewing them</button>');
    document.getElementById('modal-cancel').onclick = ctx.closeModal;
    document.getElementById('am-finish-anyway').onclick = function() {
      finishClassReview(cr.id, true);
      ctx.closeModal();
      ui.view = 'class-summary';
      refresh();
    };
  }

  function bindCreatePreview(root) {
    var year = root.querySelector('#am-year');
    var tp = root.querySelector('#am-tp');
    var title = root.querySelector('#am-title');
    var preview = root.querySelector('#am-title-preview');
    function update() {
      if (!preview || !year || !tp) return;
      var d = db();
      var tps = global.SptStore.trackingPoints(d);
      var rec = byId(tps, tp.value);
      var label = tpShort(rec, tps.indexOf(rec));
      var custom = title && title.value.trim();
      preview.textContent = 'Title: ' + (custom || defaultTitle(year.value, label));
    }
    if (year) year.addEventListener('change', update);
    if (tp) tp.addEventListener('change', update);
    if (title) title.addEventListener('input', update);
    update();
    var createBtn = root.querySelector('#am-create-cycle');
    if (createBtn) createBtn.addEventListener('click', function() {
      var rec = createCycle({
        year_group: year.value,
        tracking_point_id: tp.value,
        session: (root.querySelector('#am-session') || {}).value,
        title: title.value
      });
      ui.showCreate = false;
      ui.cycleId = rec.id;
      ui.view = 'cycle';
      refresh();
    });
  }

  function bind(root, appCtx) {
    ctx = appCtx;
    bindCreatePreview(root);

    root.querySelectorAll('[data-am-view]').forEach(function(el) {
      el.addEventListener('click', function() { go(el.getAttribute('data-am-view')); });
    });
    root.querySelectorAll('[data-am-toggle-create]').forEach(function(el) {
      el.addEventListener('click', function() { ui.showCreate = !ui.showCreate; refresh(); });
    });
    root.querySelectorAll('[data-am-open-cycle]').forEach(function(el) {
      el.addEventListener('click', function() {
        ui.cycleId = el.getAttribute('data-am-open-cycle');
        ui.view = 'cycle';
        refresh();
      });
    });
    root.querySelectorAll('[data-am-cycle-summary]').forEach(function(el) {
      el.addEventListener('click', function() {
        ui.cycleId = el.getAttribute('data-am-cycle-summary');
        ui.view = 'cycle-summary';
        refresh();
      });
    });
    root.querySelectorAll('[data-am-start-class]').forEach(function(el) {
      el.addEventListener('click', function() {
        ui.classId = el.getAttribute('data-am-start-class');
        ui.enrolmentId = null;
        var store = loadStore();
        var cycle = byId(store.review_cycles, ui.cycleId);
        startClassReview(cycle, ui.classId);
        ui.view = 'review';
        refresh();
      });
    });
    root.querySelectorAll('[data-am-queue-class]').forEach(function(el) {
      el.addEventListener('click', function() {
        ui.classId = el.getAttribute('data-am-queue-class');
        ui.enrolmentId = null;
        var store = loadStore();
        startClassReview(byId(store.review_cycles, ui.cycleId), ui.classId);
        ui.view = 'review';
        refresh();
      });
    });
    root.querySelectorAll('[data-am-class-summary]').forEach(function(el) {
      el.addEventListener('click', function() {
        ui.classId = el.getAttribute('data-am-class-summary') || ui.classId;
        ui.view = 'class-summary';
        refresh();
      });
    });
    root.querySelectorAll('[data-am-pupil]').forEach(function(el) {
      el.addEventListener('click', function() {
        flushNotes();
        captureDraft();
        ui.enrolmentId = el.getAttribute('data-am-pupil');
        refresh();
      });
    });
    root.querySelectorAll('[data-am-owner]').forEach(function(el) {
      el.addEventListener('click', function() {
        captureDraft();
        var owner = el.getAttribute('data-am-owner');
        draftFor(ui.enrolmentId).owner = owner;
        root.querySelectorAll('[data-am-owner]').forEach(function(btn) {
          btn.classList.toggle('is-on', btn.getAttribute('data-am-owner') === owner);
        });
      });
    });
    root.querySelectorAll('[data-am-add-action]').forEach(function(el) {
      el.addEventListener('click', function() {
        flushNotes();
        var owner = draftFor(ui.enrolmentId).owner;
        var added = commitDraftAction();
        if (added && owner === 'monitor') {
          var store = loadStore();
          var cr = classReview(store, ui.cycleId, ui.classId);
          if (cr) markReviewed(cr.id, ui.enrolmentId, false);
        }
        ui.saveState = 'saved';
        refresh();
      });
    });
    root.querySelectorAll('[data-am-del-action]').forEach(function(el) {
      el.addEventListener('click', function() {
        removeAction(el.getAttribute('data-am-del-action'));
        refresh();
      });
    });
    root.querySelectorAll('[data-am-save-next]').forEach(function(el) {
      el.addEventListener('click', function() {
        commitDraftAction();
        flushNotes();
        var store = loadStore();
        var cr = classReview(store, ui.cycleId, ui.classId);
        var fromId = ui.enrolmentId;
        if (cr) markReviewed(cr.id, fromId, false);
        var next = nextPending(fromId);
        if (next) ui.enrolmentId = next.row.enrolment.id;
        ui.saveState = 'saved';
        refresh();
      });
    });
    root.querySelectorAll('[data-am-prev-pupil]').forEach(function(el) {
      el.addEventListener('click', function() { flushNotes(); captureDraft(); movePupil(-1); });
    });
    root.querySelectorAll('[data-am-next-pupil]').forEach(function(el) {
      el.addEventListener('click', function() { flushNotes(); captureDraft(); movePupil(1); });
    });
    root.querySelectorAll('[data-am-skip-pupil]').forEach(function(el) {
      el.addEventListener('click', function() {
        flushNotes();
        captureDraft();
        var store = loadStore();
        var cr = classReview(store, ui.cycleId, ui.classId);
        var fromId = ui.enrolmentId;
        if (cr) markReviewed(cr.id, fromId, true);
        var next = nextPending(fromId);
        if (next) ui.enrolmentId = next.row.enrolment.id;
        refresh();
      });
    });
    root.querySelectorAll('[data-am-suggest-list]').forEach(function(el) {
      el.addEventListener('click', function() {
        flushNotes();
        var store = loadStore();
        var cycle = byId(store.review_cycles, ui.cycleId);
        var cr = classReview(store, ui.cycleId, ui.classId);
        if (!cycle || !cr) return;
        var added = applySuggestList(cr, rowsForClass(db(), cycle, ui.classId));
        if (!added) {
          showAddPupilModal();
          return;
        }
        refresh();
      });
    });
    root.querySelectorAll('[data-am-toggle-class-notes]').forEach(function(el) {
      el.addEventListener('click', function() {
        flushNotes();
        ui.showClassNotes = !ui.showClassNotes;
        refresh();
      });
    });
    root.querySelectorAll('[data-am-focus-action]').forEach(function(el) {
      el.addEventListener('click', function() {
        var t = document.getElementById('am-action-text');
        if (t) t.focus();
      });
    });
    root.querySelectorAll('[data-am-finish-class]').forEach(function(el) {
      el.addEventListener('click', function() { flushNotes(); confirmFinish(); });
    });
    root.querySelectorAll('[data-am-add-pupil]').forEach(function(el) {
      el.addEventListener('click', showAddPupilModal);
    });
    root.querySelectorAll('[data-am-full-tracking]').forEach(function(el) {
      el.addEventListener('click', function() {
        if (ctx.openDrawer) ctx.openDrawer(el.getAttribute('data-am-full-tracking'));
      });
    });
    root.querySelectorAll('[data-am-print]').forEach(function(el) {
      el.addEventListener('click', function() {
        flushNotes();
        var kind = el.getAttribute('data-am-print');
        ui.cycleId = el.getAttribute('data-am-cycle') || ui.cycleId;
        if (kind === 'class') {
          ui.classId = el.getAttribute('data-am-class') || ui.classId;
          ui.view = 'class-summary';
        } else {
          ui.view = 'cycle-summary';
        }
        refresh();
        setTimeout(printNow, 50);
      });
    });
    root.querySelectorAll('[data-am-action-status]').forEach(function(el) {
      el.addEventListener('change', function() {
        setActionStatus(el.getAttribute('data-am-action-status'), el.value);
        refresh();
      });
    });
    var notes = root.querySelector('#am-notes');
    if (notes) {
      notes.addEventListener('input', function() {
        ui.saveState = 'saving';
        var status = root.querySelector('.am-save-status');
        if (status) {
          status.textContent = 'Saving…';
          status.className = 'am-save-status is-saving';
        }
        clearTimeout(ui.noteTimer);
        ui.noteTimer = setTimeout(function() {
          flushNotes();
          var s2 = document.querySelector('.am-save-status');
          if (s2) {
            s2.textContent = 'Saved';
            s2.className = 'am-save-status is-saved';
          }
        }, 500);
      });
    }
    var actionText = root.querySelector('#am-action-text');
    if (actionText) actionText.addEventListener('input', captureDraft);
    var classNotes = root.querySelector('#am-class-notes');
    if (classNotes) {
      classNotes.addEventListener('input', function() {
        clearTimeout(ui.noteTimer);
        ui.noteTimer = setTimeout(flushClassNotes, 500);
      });
    }
  }

  function trackingFingerprint(d) {
    d = d || (global.SptStore && global.SptStore.ensure());
    function slice(arr, fields) {
      return (arr || []).map(function(r) {
        var o = { id: r.id };
        fields.forEach(function(f) { o[f] = r[f]; });
        return o;
      }).sort(function(a, b) { return String(a.id).localeCompare(String(b.id)); });
    }
    return JSON.stringify({
      enrolments: slice(d.enrolments, ['latest_working_grade', 'target_grade', 'risk_status', 'risk_reasons', 'has_open_flag']),
      baselines: slice(d.enrolment_baselines, ['s3_exam_raw', 's3_exam_mark', 's3_exam_grade', 'effort', 'behaviour', 'homelearning', 'progress', 'cfe_level']),
      tracking: slice(d.pupil_tracking_data, ['enrolment_id', 'tracking_point_id', 'effort', 'behaviour']),
      attendance: slice(d.attendance_records, ['enrolment_id', 'tracking_point_id', 'attendance_score', 'attendance_percent']),
      concerns: slice(d.teacher_concerns, ['status', 'comment', 'category']),
      interventions: slice(d.interventions, ['intervention_status', 'intervention_description']),
      prelims: slice(d.prelim_marks, ['raw_mark']),
      evidence: slice(d.evidence_bank, ['evidence_status'])
    });
  }

  global.SptAttainmentMeetings = {
    showHome: function() { ui.view = 'home'; ui.saveState = ''; },
    isReviewView: function() { return ui.view === 'review'; },
    render: render,
    bind: bind,
    trackingFingerprint: trackingFingerprint,
    loadStore: loadStore,
    whenStoreReady: function(cb) {
      if (global.SptAttainmentMeetingStore) return global.SptAttainmentMeetingStore.whenReady(cb);
      if (cb) cb();
      return Promise.resolve();
    }
  };
})(typeof window !== 'undefined' ? window : global);
