/**
 * N5 Creative Industries assessment — progress, readiness for sign-off,
 * reading a pasted class list and reading a backup from the offline
 * Assessment Studio. No DOM here, so it can be unit tested
 * (ci-assessment-core.test.mjs).
 *
 * Marks are kept in an object keyed "pupilId|code" (see markKey). A unit is
 * ready for sign-off when every performance criterion is achieved and every
 * evidence checkpoint is verified; it passes once an assessor signs it off.
 */
(function (root) {
  'use strict';

  var STATUS = {
    n: { label: 'Not assessed', glyph: '' },
    d: { label: 'Developing', glyph: '↗' },
    r: { label: 'To assess', glyph: '?' },
    m: { label: 'Achieved', glyph: '✓' },
    x: { label: 'Action required', glyph: '!' }
  };
  var STATUS_ORDER = ['n', 'd', 'r', 'm', 'x'];

  function markKey(pupilId, code) {
    return pupilId + '|' + code;
  }

  function indexMarks(rows) {
    var out = {};
    (rows || []).forEach(function (r) { out[markKey(r.pupil_id, r.code)] = r; });
    return out;
  }

  function statusOf(marks, pupilId, code) {
    var m = marks[markKey(pupilId, code)];
    return (m && m.status) || 'n';
  }

  function unitProgress(unit, marks, pupilId) {
    var counts = { n: 0, d: 0, r: 0, m: 0, x: 0 };
    unit.criteria.forEach(function (c) { counts[statusOf(marks, pupilId, c.code)]++; });
    var checks = unit.checkpoints.filter(function (c) {
      return statusOf(marks, pupilId, c.code) === 'm';
    }).length;
    var signoff = marks[markKey(pupilId, unit.id + '.signoff')];
    var total = unit.criteria.length;
    var ready = counts.m === total && checks === unit.checkpoints.length;
    return {
      achieved: counts.m,
      total: total,
      counts: counts,
      checks: checks,
      checkTotal: unit.checkpoints.length,
      ready: ready,
      signed: !!(ready && signoff && signoff.status === 'm'),
      signoff: signoff && signoff.status === 'm' ? signoff : null
    };
  }

  function pupilProgress(units, order, marks, pupilId) {
    var met = 0;
    var total = 0;
    var passed = 0;
    var byUnit = {};
    order.forEach(function (id) {
      var p = unitProgress(units[id], marks, pupilId);
      byUnit[id] = p;
      met += p.achieved;
      total += p.total;
      if (p.signed) passed++;
    });
    return {
      met: met,
      total: total,
      pct: total ? Math.round(met / total * 100) : 0,
      passed: passed,
      coursePassed: passed === order.length,
      units: byUnit
    };
  }

  /** Everything the overview needs, computed from the rows. */
  function classSummary(units, order, pupils, marks, followups, today) {
    var met = 0;
    var possible = 0;
    var ready = [];
    var signed = 0;
    var passes = 0;
    var toAssess = {};
    var action = 0;
    pupils.forEach(function (p) {
      var pp = pupilProgress(units, order, marks, p.id);
      met += pp.met;
      possible += pp.total;
      signed += pp.passed;
      if (pp.coursePassed) passes++;
      order.forEach(function (id) {
        var u = pp.units[id];
        if (u.ready && !u.signed) ready.push({ pupil: p, unitId: id });
        action += u.counts.x;
        units[id].criteria.forEach(function (c) {
          if (statusOf(marks, p.id, c.code) === 'r') {
            toAssess[c.code] = (toAssess[c.code] || 0) + 1;
          }
        });
      });
    });
    var open = (followups || []).filter(function (f) { return !f.done_at; });
    var overdue = open.filter(function (f) { return f.due_on && f.due_on < today; });
    var assessList = Object.keys(toAssess).map(function (code) {
      return { code: code, count: toAssess[code] };
    }).sort(function (a, b) { return b.count - a.count || a.code.localeCompare(b.code); });
    return {
      pupils: pupils.length,
      met: met,
      possible: possible,
      pct: possible ? Math.round(met / possible * 1000) / 10 : 0,
      ready: ready,
      signed: signed,
      unitSlots: pupils.length * order.length,
      passes: passes,
      toAssess: assessList,
      toAssessTotal: assessList.reduce(function (s, a) { return s + a.count; }, 0),
      action: action,
      openFollowups: open.length,
      overdue: overdue.length
    };
  }

  function unitClassProgress(unit, pupils, marks) {
    var achieved = 0;
    var signed = 0;
    var ready = 0;
    pupils.forEach(function (p) {
      var u = unitProgress(unit, marks, p.id);
      achieved += u.achieved;
      if (u.signed) signed++;
      else if (u.ready) ready++;
    });
    var total = pupils.length * unit.criteria.length;
    return { achieved: achieved, total: total, signed: signed, ready: ready };
  }

  /** An "Achieved" decision needs somewhere to find the evidence, or an observation. */
  function markProblem(status, ref, note) {
    if (status === 'm' && !String(ref || '').trim() && !String(note || '').trim()) {
      return 'Add where the evidence is, or what you observed, before marking this achieved.';
    }
    return '';
  }

  /**
   * One pupil per line: "Name" or "Name, Class, Team" (commas or tabs).
   * A header row is skipped, and so is anyone already in the same class.
   */
  function parseClassList(text, existing) {
    var seen = {};
    (existing || []).forEach(function (p) {
      seen[(p.name + '|' + (p.class_code || '')).toLowerCase()] = true;
    });
    var rows = [];
    var skipped = 0;
    String(text || '').split(/\r?\n/).forEach(function (line) {
      line = line.trim();
      if (!line) return;
      var cols = (line.indexOf('\t') !== -1 ? line.split('\t') : line.split(','))
        .map(function (c) { return c.trim().replace(/^"|"$/g, '').trim(); });
      var name = cols[0] || '';
      if (!name || /^(name|pupil|candidate)$/i.test(name)) return;
      var row = {
        name: name.slice(0, 140),
        class_code: (cols[1] || '').slice(0, 70),
        team: (cols[2] || '').slice(0, 70)
      };
      var key = (row.name + '|' + row.class_code).toLowerCase();
      if (seen[key]) { skipped++; return; }
      seen[key] = true;
      rows.push(row);
    });
    return { rows: rows, skipped: skipped };
  }

  var CODE_RE = /^u[1-4]\.[1-3][a-f]$/;
  var CHECK_RE = /^u[1-4]\.[a-z0-9]+$/;
  var DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

  function clip(v, n) {
    return String(v == null ? '' : v).slice(0, n);
  }

  function dateOrNull(v) {
    return DATE_RE.test(String(v || '')) ? String(v) : null;
  }

  /**
   * Reads a JSON backup from the offline Assessment Studio (the single HTML
   * file) into rows for this tracker. Every pupil gets a new id.
   */
  function fromOfflineBackup(data, year, uid) {
    if (!data || !Array.isArray(data.pupils) || !data.settings || typeof data.settings !== 'object') {
      throw new Error('This file is not an Assessment Studio backup.');
    }
    var idMap = {};
    var pupils = [];
    var marks = [];
    data.pupils.forEach(function (p) {
      if (!p || typeof p.name !== 'string' || !p.name.trim()) return;
      var id = uid();
      idMap[p.id] = id;
      pupils.push({
        id: id,
        school_year: year,
        name: clip(p.name.trim(), 140),
        class_code: clip(p.group, 70),
        team: clip(p.team, 70),
        notes: clip(p.notes, 8000)
      });
      Object.keys(p.records || {}).forEach(function (code) {
        var r = p.records[code] || {};
        if (!CODE_RE.test(code) || STATUS_ORDER.indexOf(r.status) === -1 || r.status === 'n') return;
        marks.push({
          pupil_id: id, code: code, kind: 'pc', status: r.status,
          evidence_type: clip(r.type, 60), evidence_ref: clip(r.ref, 300),
          note: clip(r.note, 4000), assessed_on: dateOrNull(r.date), signed_by: ''
        });
      });
      Object.keys(p.checks || {}).forEach(function (k) {
        var c = p.checks[k] || {};
        if (!CHECK_RE.test(k) || !c.done) return;
        var parts = k.split('.');
        marks.push({
          pupil_id: id, code: parts[0] + '.check.' + parts[1], kind: 'check', status: 'm',
          evidence_type: '', evidence_ref: clip(c.ref, 300), note: '',
          assessed_on: dateOrNull(c.date), signed_by: ''
        });
      });
      Object.keys(p.signoffs || {}).forEach(function (u) {
        var s = p.signoffs[u] || {};
        if (!/^u[1-4]$/.test(u) || !s.date) return;
        marks.push({
          pupil_id: id, code: u + '.signoff', kind: 'signoff', status: 'm',
          evidence_type: '', evidence_ref: '', note: '',
          assessed_on: dateOrNull(s.date), signed_by: clip(s.by, 120)
        });
      });
    });
    var followups = (Array.isArray(data.actions) ? data.actions : []).filter(function (a) {
      return a && typeof a.title === 'string' && a.title.trim();
    }).map(function (a) {
      return {
        id: uid(),
        school_year: year,
        pupil_id: idMap[a.pupilId] || null,
        title: clip(a.title.trim(), 200),
        note: clip(a.note, 2000),
        due_on: dateOrNull(a.due),
        done_at: a.done ? new Date().toISOString() : null
      };
    });
    return {
      intro_variant: data.settings.intro === 'SCOT' ? 'SCOT' : 'UK',
      pupils: pupils,
      marks: marks,
      followups: followups
    };
  }

  function csvCell(v) {
    var s = String(v == null ? '' : v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  }

  function makeCsv(rows) {
    return '﻿' + rows.map(function (r) { return r.map(csvCell).join(','); }).join('\r\n');
  }

  root.CiAssessCore = {
    STATUS: STATUS,
    STATUS_ORDER: STATUS_ORDER,
    markKey: markKey,
    indexMarks: indexMarks,
    statusOf: statusOf,
    unitProgress: unitProgress,
    pupilProgress: pupilProgress,
    classSummary: classSummary,
    unitClassProgress: unitClassProgress,
    markProblem: markProblem,
    parseClassList: parseClassList,
    fromOfflineBackup: fromOfflineBackup,
    makeCsv: makeCsv
  };
})(typeof window !== 'undefined' ? window : globalThis);
