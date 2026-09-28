/**
 * Unit tests for importing Class Management pupils into the trackers.
 * Run: node tracker-roster.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const context = { window: {} };
vm.runInNewContext(readFileSync(join(__dirname, 'tracker-roster.js'), 'utf8'), context);
const R = context.window.TrackerRoster;
const plain = v => JSON.parse(JSON.stringify(v));

let n = 0;
const uid = () => 'new' + (++n);
function row(id, first, last, cls = '1A1', level = 1, pref = '') {
  return { pupil_id: id, first_name: first, last_name: last, preferred_name: pref, class_name: cls, year_level: level };
}
function state(pupils) {
  return { pupils: { s1: pupils, s2: {}, s3: {} }, scores: { s1: {}, s2: {}, s3: {} } };
}

let passed = 0;
function test(name, fn) { fn(); passed++; console.log('ok -', name); }

const G = rows => R.groupRows(rows);

test('an empty tracker class is filled from the roster, in surname order', () => {
  const S = state({ '1A1': [] });
  const res = R.sync(S, G([row('r2', 'Zara', 'Ahmed'), row('r1', 'Aiden', "O'Brien")]), uid);
  assert.deepEqual(plain(res), { filled: 2, classes: 1, linked: 0 });
  assert.deepEqual(plain(S.pupils.s1['1A1'].map(x => x.name + ':' + x.rosterId)), ['Zara Ahmed:r2', "Aiden O'Brien:r1"]);
});

test('a class with pupils is never changed without asking; missing pupils are offered', () => {
  const S = state({ '1A1': [{ id: 'a', name: 'aiden  o\u2019brien' }, { id: 'b', name: 'Ahmed, Zara' }] });
  const g = G([row('r1', 'Aiden', "O'Brien"), row('r2', 'Zara', 'Ahmed'), row('r3', 'Liam', 'Nguyen')]);
  const res = R.sync(S, g, uid);
  assert.deepEqual(plain(res), { filled: 0, classes: 0, linked: 2 });
  assert.equal(S.pupils.s1['1A1'].length, 2);
  assert.equal(S.pupils.s1['1A1'][0].rosterId, 'r1');
  assert.deepEqual(plain(R.missing(S, g, 's1', '1A1').map(x => x.name)), ['Liam Nguyen']);
});

test('preferred names and accents match', () => {
  const S = state({ '1A1': [{ id: 'a', name: 'Chloe McAllister' }, { id: 'b', name: 'Zoe Muller' }] });
  const g = G([row('r1', 'Rebecca', 'McAllister', '1A1', 1, 'Chloe'), row('r2', 'Zo\u00eb', 'M\u00fcller')]);
  assert.equal(R.sync(S, g, uid).linked, 2);
  assert.equal(R.missing(S, g, 's1', '1A1').length, 0);
});

test('once linked, a pupil is matched by roster id even after a name change', () => {
  const S = state({ '1A1': [{ id: 'a', name: 'Old Name', rosterId: 'r1' }] });
  assert.equal(R.missing(S, G([row('r1', 'New', 'Name')]), 's1', '1A1').length, 0);
});

test('pupils missing from the roster are never removed', () => {
  const S = state({ '1A1': [{ id: 'a', name: 'Left School' }] });
  const g = G([row('r1', 'Liam', 'Nguyen')]);
  R.sync(S, g, uid);
  R.addPupils(S, 's1', '1A1', R.missing(S, g, 's1', '1A1'), uid);
  assert.deepEqual(plain(S.pupils.s1['1A1'].map(x => x.name)), ['Left School', 'Liam Nguyen']);
});

test('two pupils with the same name each match one roster pupil', () => {
  const S = state({ '1A1': [{ id: 'a', name: 'Sam Lee' }, { id: 'b', name: 'Sam Lee' }] });
  const g = G([row('r1', 'Sam', 'Lee'), row('r2', 'Sam', 'Lee'), row('r3', 'Sam', 'Lee')]);
  assert.equal(R.sync(S, g, uid).linked, 2);
  assert.equal(R.missing(S, g, 's1', '1A1').length, 1);
});

test('ignored pupils are not offered again, and do not refill an emptied class', () => {
  const S = state({ '1A1': [{ id: 'a', name: 'Liam Nguyen' }] });
  const g = G([row('r1', 'Liam', 'Nguyen'), row('r2', 'Ava', 'Dsouza')]);
  R.ignore(S, 's1', '1A1', ['r2']);
  assert.equal(R.missing(S, g, 's1', '1A1').length, 0);
  S.pupils.s1['1A1'] = [];
  R.ignore(S, 's1', '1A1', ['r1']);
  assert.equal(R.sync(S, g, uid).filled, 0);
});

test('only classes that exist in the tracker, in the right year group, are touched', () => {
  const S = state({ '1A1': [] });
  const res = R.sync(S, G([row('r1', 'A', 'B', '1B2'), row('r2', 'C', 'D', '1A1', 2)]), uid);
  assert.deepEqual(plain(res), { filled: 0, classes: 0, linked: 0 });
  assert.deepEqual(plain(Object.keys(S.pupils.s1)), ['1A1']);
});

test('adding is idempotent', () => {
  const S = state({ '1A1': [] });
  const g = G([row('r1', 'A', 'B')]);
  R.sync(S, g, uid);
  assert.equal(R.sync(S, g, uid).filled, 0);
  assert.equal(R.addPupils(S, 's1', '1A1', g.s1['1A1'], uid), 0);
  assert.equal(S.pupils.s1['1A1'].length, 1);
});

console.log(`\n${passed} tracker-roster tests passed`);
