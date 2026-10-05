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

// ── Off-track dashboard ──
function dashState() {
  const S = N.ensureShape({});
  const photo = S.courses.find(c => c.id === 'photo');
  photo.units[0].due = '2026-09-30';                        // Understanding Photography (1 task)
  const people = photo.units[1].tasks.map(t => t.id);       // 7 tasks
  const done = ids => Object.fromEntries(ids.map(id => [id, { s: 'done' }]));
  const pupil = (id, work) => ({ id, name: id, strengths: '', development: '', work });
  S.classes = [{ id: 'c1', name: 'NPA', pupils: [
    pupil('Ada', { 'u-understanding-t1': { s: 'done' }, ...done(people) }),
    pupil('Ben', { 'u-understanding-t1': { s: 'done' }, ...done(people) }),
    pupil('Cy', { 'u-understanding-t1': { s: 'done' }, ...done(people.slice(0, 6)) }),
    pupil('Dot', { 'u-understanding-t1': { s: 'started', n: 'To finish' } }),
  ] }];
  return S;
}

test('overdue units flag a pupil as off track', () => {
  const S = dashState();
  const r = N.analyse(S, S.classes[0], '2026-10-05');
  const dot = r.pupils.find(x => x.pupil.id === 'Dot');
  assert.equal(dot.status, 'off');
  assert.ok(dot.reasons.some(x => x.kind === 'overdue' && /was due 30 Sep: 1 of 1 task not complete/.test(x.text)));
  assert.equal(r.pupils[0].pupil.id, 'Dot', 'most at risk first');
});

test('a due date that has not passed yet does not flag anyone', () => {
  const S = dashState();
  const r = N.analyse(S, S.classes[0], '2026-09-30');
  assert.ok(!r.pupils.some(x => x.reasons.some(y => y.kind === 'overdue')));
  assert.deepEqual(plain(r.deadlines.map(d => [d.unit.name, d.days, d.finished, d.total])), [['Understanding Photography', 0, 3, 4]]);
});

test('missing a unit the rest of the class has started, and being behind the class median', () => {
  const S = dashState();
  const r = N.analyse(S, S.classes[0], '2026-09-01');
  const dot = r.pupils.find(x => x.pupil.id === 'Dot');
  assert.ok(dot.reasons.some(x => x.kind === 'missing' && /Photographing People \(3 of 3 others/.test(x.text)));
  assert.ok(dot.reasons.some(x => x.kind === 'behind' && /^Photography: 0% complete/.test(x.text)));
  assert.equal(dot.status, 'off', 'two reasons');
  const cy = r.pupils.find(x => x.pupil.id === 'Cy');
  assert.equal(cy.status, 'on', 'one task behind is not flagged');
  assert.equal(r.pupils.find(x => x.pupil.id === 'Ada').status, 'on');
});

test('one reason on its own is "watch"', () => {
  const S = dashState();
  S.classes[0].pupils[3].work = { 'u-understanding-t1': { s: 'done' }, 'u-people-t1': { s: 'started' } };
  S.classes[0].pupils.push({ id: 'Eve', name: 'Eve', work: { 'u-understanding-t1': { s: 'done' }, 'u-people-t1': { s: 'done' }, 'u-people-t2': { s: 'done' } } });
  const r = N.analyse(S, S.classes[0], '2026-09-01');
  const dot = r.pupils.find(x => x.pupil.id === 'Dot');
  assert.deepEqual(plain(dot.reasons.map(x => x.kind)), ['behind']);
  assert.equal(dot.status, 'watch');
});

test('units without tasks and classes with no work flag nobody', () => {
  const S = N.ensureShape({ classes: [{ id: 'c', name: 'x', pupils: [
    { id: 'a', name: 'a', work: {} }, { id: 'b', name: 'b', work: {} }, { id: 'c', name: 'c', work: {} }] }] });
  const r = N.analyse(S, S.classes[0], '2026-10-05');
  assert.ok(r.pupils.every(x => x.status === 'on'));
});

test('the spotlight picks the off-track pupils furthest behind, with what to catch up first', () => {
  const S = dashState();
  const r = N.analyse(S, S.classes[0], '2026-10-05');
  const dot = r.pupils.find(x => x.pupil.id === 'Dot');
  // 1 overdue task started (2) + Photographing People missing (4) + 54 points behind the median (10) = 16
  assert.equal(dot.score, 16);
  assert.equal(dot.maxGap, 54);
  assert.equal(dot.overdueTasks, 1);
  assert.equal(dot.missingUnits, 1);
  assert.deepEqual(plain(r.spotlight.map(x => x.pupil.id)), ['Dot']);
  assert.equal(dot.catchUp[0].kind, 'overdue');
  assert.equal(dot.catchUp[0].note, 'To finish');
  assert.equal(dot.catchUp.length, 8, '1 overdue task, then the 7 tasks of the unit not started');
  assert.deepEqual(plain(dot.strandsBehind), ['photo']);
});

test('pupils only a little off track stay out of the spotlight', () => {
  const S = dashState();
  // Dot: Understanding Photography overdue, but most of Photographing People done (not far behind the class)
  S.classes[0].pupils[3].work = Object.fromEntries(['u-people-t1', 'u-people-t2', 'u-people-t3', 'u-people-t4', 'u-people-t5'].map(id => [id, { s: 'done' }]));
  const r = N.analyse(S, S.classes[0], '2026-10-05');
  const dot = r.pupils.find(x => x.pupil.id === 'Dot');
  assert.equal(dot.status, 'off');
  assert.ok(dot.score < N.SPOTLIGHT_SCORE);
  assert.equal(r.spotlight.length, 0);
});

test('class metrics add up pupil-tasks per unit and strand, and find the next deadline', () => {
  const S = dashState();
  S.courses.find(c => c.id === 'photo').units[1].due = '2026-10-20';
  const m = N.classMetrics(S, S.classes[0], '2026-10-05');
  assert.equal(m.pupils, 4);
  const und = m.units.find(u => u.unit.id === 'u-understanding');
  assert.deepEqual([und.done, und.started, und.total, und.late], [3, 1, 4, true]);
  const people = m.units.find(u => u.unit.id === 'u-people');
  assert.deepEqual([people.done, people.total, people.late], [20, 28, false]);
  assert.equal(m.strands.photo.total, 4 * 14);
  assert.equal(m.tasks.total, m.strands.photo.total + m.strands.art.total);
  assert.equal(m.counts.off, 1);
  assert.equal(m.overdueTasks, 1);
  assert.equal(m.overduePupils, 1);
  assert.equal(m.nextDeadline.unit.id, 'u-people');
  assert.equal(m.nextDeadline.days, 15);
});

console.log(`\n${passed} passed`);
