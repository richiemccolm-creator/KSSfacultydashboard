/**
 * Unit tests for the faculty tracking export, using made-up pupils only.
 * Run: node tracker-export-core.test.mjs
 * Set TRACKER_EXPORT_OUT to a file path to also write the workbook for checking in Excel.
 */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));
const context = { TextEncoder, console };
context.window = context;
vm.createContext(context);
[
  'curriculum-units.js', 'ci-assessment-units.js', 'ci-assessment-core.js',
  'dev/senior-phase-tracking/spt-export.js', 'tracker-export-core.js', 'tracker-export-xlsx.js',
  'dev/tracker-export-fixture.js'
].forEach((file) => vm.runInContext(readFileSync(join(here, file), 'utf8'), context, { filename: file }));

const { TrackerExportCore: Core, TrackerExportXlsx: Xlsx, TrackerExportFixture: Fixture } = context;
const deps = { tps: context.CURRICULUM_TPS, units: context.CI_ASSESS_UNITS, ciCore: context.CiAssessCore, senior: context.SptExport };
const when = new Date('2026-11-08T12:00:00Z');

function build(tables, errors) {
  return Core.buildWorkbook(Core.assembleSource(tables, errors || {}, 'admin@example.test', when), deps);
}
const copy = (v) => JSON.parse(JSON.stringify(v));
const wb = build(Fixture.tables);
const sheet = (name) => wb.sheets.find((s) => s.name === name);
const colOf = (s, label) => s.columns.findIndex((c) => c.label === label);
const rowOf = (s, text) => s.rows.find((r) => r.some((v) => (v && v.v !== undefined ? v.v : v) === text));

// Every source reaches the workbook.
const names = wb.sheets.map((s) => s.name);
['Read me', 'Check', 'Drama S1', 'Drama S2', 'Art S1', 'NPA Photography', 'NPA Art and Design', 'Creative Industries',
  'CI evidence', 'CI follow-ups', 'Senior Phase', 'SP left course', 'SP tracking detail', 'SP concerns', 'SP interventions',
  'Attainment pupil reviews', 'Attainment actions', 'QS Attainment', 'Report Builder', 'Class lists', 'Tracking hub notes',
  'Drama earlier years'].forEach((n) => assert.ok(names.includes(n), 'missing sheet ' + n));
assert.ok(!names.includes('Drama S3'), 'a year with no pupils gets no tab');
assert.deepEqual([...wb.problems], [], 'nothing should be flagged');

// BGE: current and archived pupils, teacher names, real numbers, and text kept as text.
const drama = sheet('Drama S1');
assert.equal(drama.rows.length, 3);
const alpha = rowOf(drama, 'Test Pupil Alpha');
assert.equal(alpha[0], 'Anna Testington');
assert.equal(alpha[colOf(drama, 'TP1 Presenting (Mime & Melodrama)')], 2, 'text scores become numbers');
assert.equal(alpha[colOf(drama, 'TP2 Notes (Improvisation)')], '=1+1 must stay as text');
assert.equal(rowOf(drama, 'Test Pupil Archived')[3], 'Archived');
assert.ok(colOf(drama, 'Teacher notes') > 0);
assert.ok(!drama.columns.some((c) => /TP6/.test(c.label)), 'empty units are left out');
assert.equal(sheet('Art S1').rows[0][0], 'ben@example.test', 'falls back to email with no display name');

// Scores for a unit no longer in the curriculum, and extra measures, are not lost.
const s2 = sheet('Drama S2');
assert.ok(colOf(s2, 'TP99 Effort') > 0);
assert.ok(s2.columns.some((c) => /TP1 Progress/.test(c.label)));
assert.equal(rowOf(s2, 'Test Pupil Charlie & Co')[colOf(s2, 'CfE level')], 'Third');
assert.ok(rowOf(sheet('Drama earlier years'), 'Test Pupil Charlie & Co'));

// NPA: status words, each strand's tasks, notes kept, empty tasks dropped.
const photo = sheet('NPA Photography');
const golf = rowOf(photo, 'Test Pupil Golf');
assert.equal(golf[colOf(photo, 'People: Research')], 'Complete');
assert.equal(golf[colOf(photo, 'People: Shoot')], 'In progress');
assert.match(golf[colOf(photo, 'Task notes')], /Needs reshoot/);
assert.equal(colOf(photo, 'People: Empty task'), -1);
assert.equal(photo.rows.length, 2, 'pupils with no work are still listed');
assert.equal(rowOf(sheet('NPA Art and Design'), 'Test Pupil Golf')[3], 'Complete');

// Creative Industries: progress and every kind of decision.
const ci = sheet('Creative Industries');
const india = rowOf(ci, 'Test Pupil India');
assert.equal(india[colOf(ci, 'Criteria achieved')], 1);
assert.equal(india[colOf(ci, 'Introduction decision')], 'Working towards', 'same rule as the tracker: a pass needs every criterion too');
assert.equal(india[colOf(ci, 'Pupil notes')], 'Fictional note');
const evidence = sheet('CI evidence');
assert.equal(evidence.rows.length, 2);
assert.ok(rowOf(evidence, 'Signed off'));
assert.match(String(evidence.rows.find((r) => r[5] === 'Criterion 1a')[6]), /Scotland/, 'uses the session\'s unit wording');

// Senior Phase: identifiers stay text, one header row, withdrawn pupils kept apart.
const senior = sheet('Senior Phase');
assert.equal(senior.rows.length, 2);
assert.ok(rowOf(senior, 'Senior Delta'));
assert.ok(senior.columns.some((c) => c.label === 'Tracking Point 1 Attendance score'), 'column is labelled for what it holds');
assert.equal(colOf(senior, 'Tracking Point 1 WG'), -1);
assert.ok(rowOf(sheet('SP left course'), 'Senior Foxtrot'));
assert.ok(rowOf(sheet('SP pupils'), '012345678'), 'leading zeros survive');
const detail = sheet('SP tracking detail');
const delta = rowOf(detail, 'Senior Delta');
assert.equal(delta[colOf(detail, 'Teacher comment')], 'Working well');
assert.equal(delta[colOf(detail, 'Tracking point')], 'Tracking Point 1');
assert.equal(rowOf(sheet('SP concerns'), 'Senior Echo')[colOf(sheet('SP concerns'), 'Category')], 'Wellbeing');
assert.ok(!sheet('SP concerns').columns.some((c) => /Enrolment|^Id$/.test(c.label)), 'internal ids are hidden');

// Attainment reviews link back to pupil and class.
const review = sheet('Attainment pupil reviews');
assert.equal(rowOf(review, 'Senior Delta')[colOf(review, 'Class')], 'H Drama A');

// QS: SCN stays text; labels are readable.
const qs = sheet('QS Attainment');
const kilo = rowOf(qs, 'Test Pupil Kilo');
assert.equal(kilo[colOf(qs, 'SCN')], '123456789');
assert.equal(kilo[colOf(qs, 'SIMD decile')], 3);
assert.equal(colOf(qs, 'Fore'), -1);

// Report Builder and class lists.
const report = rowOf(sheet('Report Builder'), 'Test Report');
assert.equal(report[colOf(sheet('Report Builder'), 'Strengths codes')], 'C1, C2');
assert.equal(rowOf(sheet('Class lists'), 'Test Lima')[5], 'Anna Testington');

// A table that can't be read is flagged in three places, never silently left out.
const failed = build(copy(Fixture.tables), { 'Senior Phase': 'permission denied' });
assert.ok(failed.problems.some((p) => /Senior Phase could not be read/.test(p)));
assert.ok(failed.sheets.find((s) => s.name === 'Check').rows.some((r) => /COULD NOT READ/.test(String((r[6] || {}).v))));
assert.ok(failed.sheets.find((s) => s.name === 'Read me').rows.some((r) => /could not be read/.test(String((r[0] || {}).v))));

// Empty data doesn't crash and gives no data tabs.
const empty = build({});
assert.equal(empty.summary.tabs, 0);
assert.ok(Xlsx.build(empty.sheets).length > 0);

// Odd stored shapes don't crash.
const odd = copy(Fixture.tables);
odd.pupil_data = [
  { id: 'x', user_id: 'gone', data_type: 'drama-v3', data: { pupils: { s1: { '1Q': [{ id: 'q', name: 'Test Pupil Mike' }] } } } },
  { id: 'y', user_id: 'gone', data_type: 'npa-v1', data: {} },
  { id: 'z', user_id: 'gone', data_type: 'art-v2', data: {} }
];
const oddWb = build(odd);
assert.equal(oddWb.sheets.find((s) => s.name === 'Drama S1').rows[0][0], 'Unknown teacher');

// A class with no course list on NPA must be flagged, not reported as fine.
const noCourses = copy(Fixture.tables);
noCourses.pupil_data.find((r) => r.data_type === 'npa-v1').data.courses = [];
assert.ok(build(noCourses).problems.some((p) => /NPA.*2 in the tracker but 0 written/.test(p)));

// Check sheet totals match.
assert.equal(wb.summary.lines.find((l) => l.source === 'Drama').records, 4);
assert.ok(wb.summary.teachers.includes('Anna Testington'));

// Excel writer helpers.
assert.equal(Xlsx.colName(0), 'A');
assert.equal(Xlsx.colName(26), 'AA');
assert.equal(Xlsx.colName(701), 'ZZ');
assert.equal(Xlsx.clean('a\u0000b\u0008c'), 'abc');
assert.equal(Xlsx.clean('x'.repeat(40000)).length, 32767);
const safe = Xlsx.safeSheetNames([{ name: 'A/B*C' }, { name: 'a b c' }, { name: 'x'.repeat(40) }]);
assert.equal(safe[0], 'A B C');
assert.equal(safe[1], 'a b c 2');
assert.equal(safe[2].length, 31);

const bytes = Xlsx.build(wb.sheets, when);
assert.equal(bytes[0], 0x50);
assert.equal(bytes[1], 0x4b);
if (process.env.TRACKER_EXPORT_OUT) writeFileSync(process.env.TRACKER_EXPORT_OUT, Buffer.from(bytes));

console.log('tracker-export-core tests passed');
