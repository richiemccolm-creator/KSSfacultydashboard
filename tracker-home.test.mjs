/**
 * Unit tests for the tracker home "To do" list.
 * Run: node tracker-home.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const context = { window: {} };
vm.runInNewContext(readFileSync(join(__dirname, 'tracker-home.js'), 'utf8'), context);
const H = context.window.TrackerHome;
const plain = v => JSON.parse(JSON.stringify(v));

const DIMS = ['creating', 'presenting', 'evaluating', 'effort', 'behaviour', 'homelearning'];
const TPS = { s1: [1, 2, 3].map(i => ({ id: 'tp' + i, label: 'TP' + i, unit: 'Unit ' + i })), s2: [], s3: [] };
const full = { creating: 3, presenting: 3, evaluating: 3, effort: 4, behaviour: 4, homelearning: 4 };
const pupils = n => Array.from({ length: n }, (_, i) => ({ id: 'p' + i, name: 'P' + i }));

function S(classes, scores = {}, extra = {}) {
  return Object.assign({ pupils: { s1: classes, s2: {}, s3: {} }, scores: { s1: scores, s2: {}, s3: {} } }, extra);
}
const build = (s, missing) => plain(H.build({ S: s, TPS, dims: DIMS, rosterMissing: missing || (() => []) }));

let passed = 0;
function test(name, fn) { fn(); passed++; console.log('ok -', name); }

test('a class with no scores has not started, and points at the first unit', () => {
  const r = build(S({ '1A1': pupils(3) }));
  assert.equal(r.todo[0].kind, 'not-started');
  assert.equal(r.todo[0].tp.id, 'tp1');
});

test('the current unit is the latest one with entered scores; gaps are counted', () => {
  const r = build(S({ '1A1': pupils(3) }, { p0: { tp1: full, tp2: { creating: 2 } }, p1: { tp1: full, tp2: full } }));
  assert.equal(r.todo[0].kind, 'scoring');
  assert.equal(r.todo[0].tp.id, 'tp2');
  assert.equal(r.todo[0].left, 2);
  assert.equal(r.todo[0].dim, 'creating', 'first empty column (p2 has nothing)');
});

test('switching a unit\'s defaults on counts as starting it', () => {
  const r = build(S({ '1A1': pupils(1) }, {}, { defaultsOn: { s1: { tp2: true } } }));
  assert.equal(r.todo[0].kind, 'scoring');
  assert.equal(r.todo[0].tp.id, 'tp2');
});

test('a unit filled only with starting scores asks the teacher to check', () => {
  const d = Object.assign({ defaultDims: DIMS.slice() }, full);
  const r = build(S({ '1A1': pupils(2) }, { p0: { tp1: d }, p1: { tp1: Object.assign({}, full) } }, { defaultsOn: { s1: { tp1: true } } }));
  assert.equal(r.todo[0].kind, 'defaults');
  assert.equal(r.todo[0].count, 1);
});

test('a finished unit offers the next one and is listed as done', () => {
  const r = build(S({ '1A1': pupils(2) }, { p0: { tp1: full }, p1: { tp1: full } }));
  assert.equal(r.todo[0].kind, 'next-unit');
  assert.equal(r.todo[0].next.id, 'tp2');
  assert.equal(r.done[0].kind, 'complete');
});

test('the last unit finished leaves nothing to do', () => {
  const sc = { p0: { tp3: full } };
  const r = build(S({ '1A1': pupils(1) }, sc));
  assert.equal(r.todo.length, 0);
  assert.equal(r.done.length, 1);
});

test('empty classes and Class Management pupils are listed', () => {
  const r = build(S({ '1A1': [], '1B2': pupils(1) }), (yg, cls) => (cls === '1B2' ? [{}, {}] : []));
  assert.deepEqual(r.todo.map(t => t.kind + ':' + t.cls), ['no-pupils:1A1', 'roster:1B2', 'not-started:1B2']);
});

test('scoring comes first, busiest class first', () => {
  const r = build(S({ A: pupils(2), B: pupils(5), C: [] }, { p0: { tp1: { creating: 1 } } }));
  assert.deepEqual(r.todo.map(t => t.kind + ':' + t.cls), ['scoring:B', 'scoring:A', 'no-pupils:C']);
});

test('the list renders with escaped class names', () => {
  const html = H.render(H.build({ S: S({ '<b>': pupils(1) }), TPS, dims: DIMS }));
  assert.ok(html.includes('&lt;b&gt;'));
  assert.ok(!html.includes('<b>'));
});

console.log(`\n${passed} tracker-home tests passed`);
