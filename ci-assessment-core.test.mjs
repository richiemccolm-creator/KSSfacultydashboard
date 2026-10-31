/**
 * Unit tests for the N5 Creative Industries assessment tracker.
 * Names below are made up.
 * Run: node ci-assessment-core.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const context = { window: {} };
vm.runInNewContext(readFileSync(join(__dirname, 'ci-assessment-units.js'), 'utf8'), context);
vm.runInNewContext(readFileSync(join(__dirname, 'ci-assessment-core.js'), 'utf8'), context);
const U = context.window.CI_ASSESS_UNITS;
const C = context.window.CiAssessCore;
const plain = v => JSON.parse(JSON.stringify(v));

let passed = 0;
function test(name, fn) { fn(); passed++; console.log('ok -', name); }

let n = 0;
const uid = () => 'id-' + (++n);

const units = U.forVariant('UK');

test('the four units carry 45 performance criteria and 18 checkpoints', () => {
  const pcs = U.ORDER.reduce((s, id) => s + units[id].criteria.length, 0);
  const checks = U.ORDER.reduce((s, id) => s + units[id].checkpoints.length, 0);
  assert.equal(pcs, 45);
  assert.equal(checks, 18);
  assert.equal(units.u3.criteria[5].code, 'u3.2a');
  assert.equal(units.u3.checkpoints[1].code, 'u3.check.obs1');
});

test('the Scotland variant changes only the Introduction code and wording', () => {
  const scot = U.forVariant('SCOT');
  assert.equal(scot.u1.code, 'H6MV 75');
  assert.match(scot.u1.criteria[0].text, /Scotland/);
  assert.equal(scot.u2.code, units.u2.code);
});

function allMet(pupilId, unit, withChecks) {
  const rows = unit.criteria.map(c => ({ pupil_id: pupilId, code: c.code, status: 'm' }));
  if (withChecks) unit.checkpoints.forEach(c => rows.push({ pupil_id: pupilId, code: c.code, status: 'm' }));
  return rows;
}

test('a unit is ready only when every criterion and checkpoint is confirmed', () => {
  let marks = C.indexMarks(allMet('p1', units.u2, false));
  let p = C.unitProgress(units.u2, marks, 'p1');
  assert.equal(p.achieved, 9);
  assert.equal(p.ready, false);
  marks = C.indexMarks(allMet('p1', units.u2, true));
  p = C.unitProgress(units.u2, marks, 'p1');
  assert.equal(p.ready, true);
  assert.equal(p.signed, false);
});

test('a sign-off only counts while the unit is still complete', () => {
  const rows = allMet('p1', units.u2, true).concat([{ pupil_id: 'p1', code: 'u2.signoff', status: 'm', signed_by: 'R. Teacher' }]);
  let marks = C.indexMarks(rows);
  assert.equal(C.unitProgress(units.u2, marks, 'p1').signed, true);
  marks[C.markKey('p1', 'u2.2b')].status = 'x';
  assert.equal(C.unitProgress(units.u2, marks, 'p1').signed, false);
});

test('the class summary adds up from the rows', () => {
  const pupils = [{ id: 'p1', name: 'Ava' }, { id: 'p2', name: 'Ben' }];
  const rows = allMet('p1', units.u2, true).concat([
    { pupil_id: 'p2', code: 'u3.1a', status: 'r' },
    { pupil_id: 'p2', code: 'u3.1b', status: 'r' },
    { pupil_id: 'p1', code: 'u3.1a', status: 'r' },
    { pupil_id: 'p2', code: 'u1.1a', status: 'x' }
  ]);
  const followups = [
    { id: 'f1', due_on: '2026-10-01', done_at: null },
    { id: 'f2', due_on: '2026-12-01', done_at: null },
    { id: 'f3', due_on: '2026-09-01', done_at: '2026-09-02T10:00:00Z' }
  ];
  const s = C.classSummary(units, U.ORDER, pupils, C.indexMarks(rows), followups, '2026-10-31');
  assert.equal(s.met, 9);
  assert.equal(s.possible, 90);
  assert.equal(s.pct, 10);
  assert.equal(s.ready.length, 1);
  assert.equal(s.ready[0].unitId, 'u2');
  assert.equal(s.toAssessTotal, 3);
  assert.deepEqual(plain(s.toAssess[0]), { code: 'u3.1a', count: 2 });
  assert.equal(s.action, 1);
  assert.equal(s.openFollowups, 2);
  assert.equal(s.overdue, 1);
});

test('an achieved decision needs an evidence location or an observation', () => {
  assert.ok(C.markProblem('m', '', ''));
  assert.equal(C.markProblem('m', 'OneNote > Unit 3', ''), '');
  assert.equal(C.markProblem('m', '', 'Led the team pitch'), '');
  assert.equal(C.markProblem('r', '', ''), '');
});

test('a pasted class list skips the header and pupils already in the class', () => {
  const r = C.parseClassList('Name, Class, Team\nAva Brown, 5ciC, Team A\n\nBen Cole\tS5\tB\nava brown, 5ciC\n"Cara Doyle"', [{ name: 'Ben Cole', class_code: 'S5' }]);
  assert.deepEqual(plain(r.rows), [
    { name: 'Ava Brown', class_code: '5ciC', team: 'Team A' },
    { name: 'Cara Doyle', class_code: '', team: '' }
  ]);
  assert.equal(r.skipped, 2);
});

test('an offline Assessment Studio backup becomes rows with new ids', () => {
  const backup = {
    version: 1,
    settings: { session: '2026–27', intro: 'SCOT', assessor: 'R. Teacher' },
    pupils: [{
      id: 'old-1', name: 'Ava Brown', group: '5ciC', team: 'A', notes: 'Extra time',
      records: {
        'u3.1a': { status: 'm', date: '2026-10-20', type: 'Observation', ref: 'Checklist 1', note: '' },
        'u3.1b': { status: 'n' },
        'bad.code': { status: 'm' }
      },
      checks: { 'u3.obs1': { done: true, ref: 'Sheet', date: '2026-10-21' }, 'u3.obs2': { done: false } },
      signoffs: { u2: { date: '2026-10-22', by: 'R. Teacher' } }
    }, { id: 'old-2', name: '  ' }],
    actions: [
      { id: 'a1', title: 'Chase evaluation', pupilId: 'old-1', due: '2026-11-04', note: '', done: false },
      { id: 'a2', title: 'Book the hall', pupilId: '', due: '', done: true }
    ]
  };
  n = 0;
  const out = C.fromOfflineBackup(backup, '2026-27', uid);
  assert.equal(out.intro_variant, 'SCOT');
  assert.equal(out.pupils.length, 1);
  assert.equal(out.pupils[0].id, 'id-1');
  assert.equal(out.pupils[0].class_code, '5ciC');
  assert.deepEqual(plain(out.marks.map(m => m.code)), ['u3.1a', 'u3.check.obs1', 'u2.signoff']);
  assert.equal(out.marks[2].signed_by, 'R. Teacher');
  assert.equal(out.followups[0].pupil_id, 'id-1');
  assert.equal(out.followups[1].pupil_id, null);
  assert.ok(out.followups[1].done_at);
  assert.throws(() => C.fromOfflineBackup({ pupils: [] }, '2026-27', uid));
});

test('CSV cells are quoted and formula-safe', () => {
  const csv = C.makeCsv([['Name', 'Note'], ['Ava', '=SUM(A1)'], ['Ben "B"', '']]);
  assert.equal(csv, '﻿"Name","Note"\r\n"Ava","\'=SUM(A1)"\r\n"Ben ""B""",""');
});

console.log(`\n${passed} tests passed`);
