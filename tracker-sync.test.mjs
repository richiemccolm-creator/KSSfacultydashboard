/**
 * Unit tests for tracker cloud saving: three-way merge, failed loads, and saves from two devices.
 * Run: node tracker-sync.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(__dirname, 'tracker-sync.js'), 'utf8');

function makeWindow(dataService) {
  const store = {};
  const win = {
    DataService: dataService,
    localStorage: {
      getItem: k => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: k => { delete store[k]; }
    },
    addEventListener() {},
    setTimeout, clearTimeout
  };
  const context = { window: win, JSON, Date, Promise, Object, Array, setTimeout, clearTimeout,
    localStorage: win.localStorage, navigator: { onLine: true } };
  vm.runInNewContext(source, context);
  return { TS: win.TrackerSync, store };
}

// A fake cloud row shared by several "devices".
function makeCloud(initial) {
  const cloud = { data: initial ? JSON.parse(JSON.stringify(initial)) : null, version: initial ? 1 : 0, failReads: false, writes: 0 };
  const ts = () => (cloud.version ? 'v' + cloud.version : null);
  cloud.service = {
    getWithVersion() {
      if (cloud.failReads) return Promise.reject(new Error('network'));
      return Promise.resolve({ data: cloud.data ? JSON.parse(JSON.stringify(cloud.data)) : null, updatedAt: ts(), userId: 'u1', local: false });
    },
    setIfUnchanged(_type, data, expected) {
      if ((expected || null) !== ts()) { const e = new Error('conflict'); e.code = 'conflict'; return Promise.reject(e); }
      cloud.data = JSON.parse(JSON.stringify(data));
      cloud.version++;
      cloud.writes++;
      return Promise.resolve({ updatedAt: ts() });
    }
  };
  return cloud;
}

// Values from the vm context carry its own prototypes; compare as plain JSON.
const plain = v => JSON.parse(JSON.stringify(v));

let passed = 0;
async function test(name, fn) {
  await fn();
  passed++;
  console.log('ok -', name);
}

const { TS: pure } = makeWindow(null);

await test('merge keeps score changes made on each device', () => {
  const base = { scores: { s1: { p1: { tp1: { creating: 3 } }, p2: { tp1: { creating: 3 } } } } };
  const local = { scores: { s1: { p1: { tp1: { creating: 4 } }, p2: { tp1: { creating: 3 } } } } };
  const remote = { scores: { s1: { p1: { tp1: { creating: 3 } }, p2: { tp1: { creating: 1, notes: 'x' } } } } };
  const m = pure.merge3(base, local, remote);
  assert.equal(m.scores.s1.p1.tp1.creating, 4);
  assert.equal(m.scores.s1.p2.tp1.creating, 1);
  assert.equal(m.scores.s1.p2.tp1.notes, 'x');
});

await test('merge: this device wins when both changed the same cell', () => {
  const m = pure.merge3({ a: 1 }, { a: 2 }, { a: 3 });
  assert.equal(m.a, 2);
});

await test('merge keeps pupils added on each device and respects deletions', () => {
  const base = { pupils: { s1: { '1A1': [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }] } } };
  const local = { pupils: { s1: { '1A1': [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }] } } };
  const remote = { pupils: { s1: { '1A1': [{ id: 'a', name: 'A' }, { id: 'd', name: 'D' }] } } }; // b deleted, d added
  const ids = plain(pure.merge3(base, local, remote).pupils.s1['1A1'].map(p => p.id));
  assert.deepEqual(ids, ['a', 'c', 'd']);
});

await test('merge honours a class deleted on one device', () => {
  const base = { pupils: { s1: { X: [], Y: [] } } };
  const local = { pupils: { s1: { X: [], Y: [] } } };
  const remote = { pupils: { s1: { X: [] } } };
  assert.deepEqual(plain(Object.keys(pure.merge3(base, local, remote).pupils.s1)), ['X']);
});

await test('merge ignores key order differences (Postgres jsonb reorders keys)', () => {
  assert.ok(pure.deepEqual({ a: 1, bb: { x: 1, y: 2 } }, { bb: { y: 2, x: 1 }, a: 1 }));
});

await test('a failed load blocks saving, so an empty screen cannot overwrite the cloud', async () => {
  const cloud = makeCloud({ pupils: { s1: { '1A1': [{ id: 'a', name: 'A' }] } } });
  cloud.failReads = true;
  const { TS } = makeWindow(cloud.service);
  const S = { pupils: { s1: {} } };
  const statuses = [];
  const sync = TS.create({ dataType: 'drama-v3', state: S, onStatus: s => statuses.push(s), debounceMs: 0 });
  const res = await sync.load();
  assert.equal(res.ok, false);
  assert.equal(sync.status(), 'load-failed');
  S.pupils.s1.New = [];
  await sync.save();
  assert.equal(cloud.writes, 0);
  assert.deepEqual(plain(Object.keys(cloud.data.pupils.s1)), ['1A1']);
});

await test('two devices saving different scores keep both', async () => {
  const cloud = makeCloud({ scores: { s1: { p1: {}, p2: {} } } });
  const ipad = makeWindow(cloud.service).TS;
  const desk = makeWindow(cloud.service).TS;
  const SA = {}, SB = {};
  const a = ipad.create({ dataType: 'drama-v3', state: SA, debounceMs: 0 });
  const b = desk.create({ dataType: 'drama-v3', state: SB, debounceMs: 0 });
  await a.load(); await b.load();
  SA.scores.s1.p1.tp1 = { creating: 4 };
  a.save();
  assert.equal((await a.flush()).ok, true);
  SB.scores.s1.p2.tp1 = { creating: 2 };       // desktop still has the old copy
  b.save();
  assert.equal((await b.flush()).ok, true);
  assert.equal(cloud.data.scores.s1.p1.tp1.creating, 4, 'iPad score survived');
  assert.equal(cloud.data.scores.s1.p2.tp1.creating, 2, 'desktop score saved');
  assert.equal(SB.scores.s1.p1.tp1.creating, 4, 'desktop now shows the iPad score');
});

await test('rapid edits are grouped into one write', async () => {
  const cloud = makeCloud({ n: 0 });
  const { TS } = makeWindow(cloud.service);
  const S = {};
  const sync = TS.create({ dataType: 'art-v2', state: S, debounceMs: 20 });
  await sync.load();
  for (let i = 1; i <= 10; i++) { S.n = i; sync.save(); }
  await sync.flush();
  assert.equal(cloud.writes, 1);
  assert.equal(cloud.data.n, 10);
});

await test('unsaved work from a closed tab is merged back in on the next load', async () => {
  const cloud = makeCloud({ scores: { p1: 1, p2: 1 } });
  const dev = makeWindow(cloud.service);
  const S1 = {};
  const first = dev.TS.create({ dataType: 'drama-v3', state: S1, debounceMs: 10000 });
  await first.load();
  S1.scores.p1 = 4;
  first.save();                                   // debounced, never sent: tab "closes"
  // simulate the page writing its backup on pagehide
  dev.store['tracker-unsaved:u1:drama-v3'] = JSON.stringify({ at: Date.now(), base: { scores: { p1: 1, p2: 1 } }, local: S1 });
  cloud.data.scores.p2 = 3; cloud.version++;       // another device saved meanwhile
  const S2 = {};
  const second = dev.TS.create({ dataType: 'drama-v3', state: S2, debounceMs: 0 });
  const res = await second.load();
  assert.equal(res.recovered, true);
  await second.flush();
  assert.deepEqual(cloud.data.scores, { p1: 4, p2: 3 });
  assert.equal(dev.store['tracker-unsaved:u1:drama-v3'], undefined, 'backup cleared once saved');
});

console.log(`\n${passed} tracker-sync tests passed`);
