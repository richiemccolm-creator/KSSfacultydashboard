/**
 * Unit tests for reading an NPA tracking spreadsheet (Photography and Art & Design strands) into the tracker.
 * Names below are made up; the layout mirrors the 2025–27 tracking spreadsheet.
 * Run: node npa-tracker-core.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const context = { window: {} };
vm.runInNewContext(readFileSync(join(__dirname, 'npa-tracker-core.js'), 'utf8'), context);
const N = context.window.NpaTracker;
const plain = v => JSON.parse(JSON.stringify(v));

let passed = 0;
function test(name, fn) { fn(); passed++; console.log('ok -', name); }

let n = 0;
const uid = p => p + (++n);

const _ = null;
// Columns: A name, B area for development, C strength, D.. units
const SHEET = [
  ['NPA Art and Design', _, _, 'Printmaking Unit', _, 'Mixed Media Unit'],
  [_, 'Area for development ', 'Strength', 'Print technique 1 (Lino print)', 'Print technique 2 (screen print) ', 'Mark making 1'],
  ['Alex', 'Maintain focus ', 'Good eye for photography', 'X', 'To do screen print cut outs done', ' x'],
  ['Bea', _, 'Highly motivated', 'X', _, _],
  ['Cal', 'Attendance', _, _, _, _],
  ['Eve', _, _, 'X', _, _],
  [],
  ['NPA Photography', _, _, 'Understanding  Photography ', 'Photographing People Unit', _, _, 'Photographing Places Unit', _, 'Working with Photographs', _],
  [_, _, _, _, 'Photoshoot 1 Plan', 'Photoshoot 1', 'Photoshoot 2', 'Photoshoot 1 Plan', 'Photoshoot 1', _, _],
  ['Alex', _, _, 'X', 'x', 'Started - to finish ', 'X but perhaps develop further', _, _, _, _],
  ['Bea', _, _, 'To finish', _, _, _, 'X', _, _, _],
  ['Cal', _, _, _, _, _, _, _, _, _, _],
  [_, _, _, 'X', _, _, _, _, _, _, _],
  ['Dee', _, _, _, _, _, _, _, 'found a photo\nto write up', _, _],
];
const PHOTO = N.COURSES.find(c => c.id === 'photo').heading;
const ART = N.COURSES.find(c => c.id === 'art').heading;

test('reads cells: X is complete, X + text is complete with a note, other text is in progress', () => {
  assert.deepEqual(plain(N.parseCell('X')), { s: 'done' });
  assert.deepEqual(plain(N.parseCell(' x ')), { s: 'done' });
  assert.deepEqual(plain(N.parseCell('X but perhaps develop further')), { s: 'done', n: 'but perhaps develop further' });
  assert.deepEqual(plain(N.parseCell('To finish writing up')), { s: 'started', n: 'To finish writing up' });
  assert.equal(N.parseCell(''), null);
  assert.equal(N.parseCell(null), null);
  assert.equal(N.parseCell({ f: '=HYPERLINK()' }), null);
});

test('finds the Photography section and its units and tasks', () => {
  const p = N.parseSection(SHEET, PHOTO);
  assert.deepEqual(plain(p.units.map(u => u.name)), ['Understanding Photography', 'Photographing People', 'Photographing Places', 'Working with Photographs'], 'trailing "Unit" dropped');
  assert.deepEqual(plain(p.units[0].tasks.map(t => t.name)), ['Understanding Photography'], 'merged heading with data becomes one task');
  assert.deepEqual(plain(p.units[1].tasks.map(t => t.name)), ['Photoshoot 1 Plan', 'Photoshoot 1', 'Photoshoot 2']);
  assert.equal(p.units[3].tasks.length, 0, 'empty unit has no tasks');
});

test('finds the Art & Design section, skipping the comment columns before the first unit', () => {
  const a = N.parseSection(SHEET, ART);
  assert.deepEqual(plain(a.units.map(u => u.name)), ['Printmaking', 'Mixed Media']);
  assert.deepEqual(plain(a.units[0].tasks.map(t => t.name)), ['Print technique 1 (Lino print)', 'Print technique 2 (screen print)']);
  assert.deepEqual(plain(a.pupils.map(x => x.name)), ['Alex', 'Bea', 'Cal', 'Eve'], 'stops at the blank row');
  assert.deepEqual(plain(a.pupils[0].cells), { 3: { s: 'done' }, 4: { s: 'started', n: 'To do screen print cut outs done' }, 5: { s: 'done' } });
});

test('reads pupils, skips unnamed rows with a warning, and stops at the section end', () => {
  const p = N.parseSection(SHEET, PHOTO);
  assert.deepEqual(plain(p.pupils.map(x => x.name)), ['Alex', 'Bea', 'Cal', 'Dee']);
  assert.equal(p.warnings.length, 1);
  assert.match(p.warnings[0], /Row 13/);
  assert.deepEqual(plain(p.pupils[0].cells), {
    3: { s: 'done' }, 4: { s: 'done' }, 5: { s: 'started', n: 'Started - to finish' },
    6: { s: 'done', n: 'but perhaps develop further' }
  });
  assert.deepEqual(plain(p.pupils[3].cells), { 8: { s: 'started', n: 'found a photo to write up' } }, 'line breaks flattened');
});

test('a workbook gives both strands, one combined pupil list, and comments', () => {
  const w = N.parseWorkbook([{ name: 'Sheet1', rows: SHEET }]);
  assert.deepEqual(plain(w.sections.map(s => s.courseId)), ['photo', 'art']);
  assert.deepEqual(plain(w.pupilNames), ['Alex', 'Bea', 'Cal', 'Dee', 'Eve']);
  assert.equal(w.comments.alex.strengths, 'Good eye for photography');
  assert.equal(w.comments.alex.development, 'Maintain focus');
  assert.equal(w.comments.cal.development, 'Attendance');
});

test('a sheet without either heading is not read', () => {
  assert.equal(N.parseRows([['Name', 'Score'], ['Alex', 3]]), null);
  assert.equal(N.parseWorkbook([{ name: 'Other', rows: [['Hello']] }]), null);
  const onlyArt = N.parseWorkbook([{ name: 'A', rows: SHEET.slice(0, 6) }]);
  assert.deepEqual(plain(onlyArt.sections.map(s => s.courseId)), ['art']);
});

test('long text is cut short', () => {
  assert.equal(N.cleanText('a'.repeat(900)).length, 500);
});

test('an empty tracker has both strands', () => {
  const S = N.ensureShape({});
  assert.deepEqual(plain(S.courses.map(c => c.id)), ['photo', 'art']);
  assert.ok(N.allTasks(S, 'art').length > 0);
});

test('importing puts each pupil in the class once, with work from both strands', () => {
  const S = N.ensureShape({});
  const before = N.allTasks(S).length;
  const stats = N.applyImport(S, N.parseWorkbook([{ name: 'Sheet1', rows: SHEET }]), { className: 'NPA 2025–27' }, uid);
  const cls = S.classes[0];
  assert.equal(cls.name, 'NPA 2025–27');
  assert.deepEqual(plain(cls.pupils.map(p => p.name)), ['Alex', 'Bea', 'Cal', 'Dee', 'Eve']);
  assert.equal(stats.pupilsAdded, 5);
  assert.equal(stats.unitsAdded, 0, 'units match the built-in strands');
  assert.equal(stats.tasksAdded, 0, 'tasks match the built-in strands');
  assert.equal(N.allTasks(S).length, before);
  const alex = cls.pupils[0];
  assert.equal(alex.work['u-understanding-t1'].s, 'done');
  assert.equal(alex.work['a-print-t1'].s, 'done');
  assert.equal(alex.work['a-mixed-t1'].s, 'done');
  assert.equal(alex.strengths, 'Good eye for photography');
  assert.equal(stats.byCourse.photo.cellsFilled + stats.byCourse.art.cellsFilled, stats.cellsFilled);
});

test('importing again never overwrites or duplicates', () => {
  const S = N.ensureShape({});
  const parsed = N.parseWorkbook([{ name: 'Sheet1', rows: SHEET }]);
  const first = N.applyImport(S, parsed, { className: 'NPA' }, uid);
  const cls = S.classes[0];
  cls.pupils[1].work['u-understanding-t1'] = { s: 'done' };   // teacher has since marked Bea complete
  cls.pupils[0].strengths = 'Edited by teacher';
  const stats = N.applyImport(S, parsed, { classId: first.classId }, uid);
  assert.equal(S.classes.length, 1);
  assert.equal(cls.pupils.length, 5);
  assert.equal(stats.pupilsMatched, 5);
  assert.equal(stats.pupilsAdded, 0);
  assert.equal(stats.cellsFilled, 0);
  assert.equal(cls.pupils[1].work['u-understanding-t1'].s, 'done');
  assert.equal(cls.pupils[0].strengths, 'Edited by teacher');
});

test('pupil names match ignoring case, accents and apostrophes', () => {
  const S = N.ensureShape({ classes: [{ id: 'c1', name: 'NPA', pupils: [{ id: 'p1', name: 'zoë o’neil', work: {} }] }] });
  const parsed = { sections: [], comments: {}, pupilNames: ["Zoe O'Neil"] };
  const stats = N.applyImport(S, parsed, { classId: 'c1' }, uid);
  assert.equal(stats.pupilsMatched, 1);
  assert.equal(S.classes[0].pupils.length, 1);
});

test('progress counts complete and in-progress tasks', () => {
  const tasks = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  const p = N.pupilProgress({ work: { a: { s: 'done' }, b: { s: 'started' }, z: { s: 'done' } } }, tasks);
  assert.deepEqual(plain(p), { done: 1, started: 1, total: 3 });
});

console.log(`\n${passed} passed`);
