/**
 * Unit tests for tracker promotion with pupil exclusions.
 * Run: node tracker-promote-archive.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(__dirname, 'tracker-promote-archive.js'), 'utf8');
const context = { window: {}, Date: Date, JSON: JSON };
vm.runInNewContext(source, context);
const TPA = context.window.TrackerPromoteArchive;

function makeState() {
  return {
    pupils: {
      s1: { '1A 25-26': [{ id: 'p1', name: 'Alice' }, { id: 'p2', name: 'Bob' }, { id: 'p3', name: 'Cara' }] },
      s2: {},
      s3: {}
    },
    scores: {
      s1: {
        p1: { tp1: { progress: 3 } },
        p2: { tp1: { progress: 2 } },
        p3: { tp1: { progress: 4 } }
      },
      s2: {},
      s3: {}
    },
    profiles: { s1: {}, s2: {}, s3: {} },
    archived: { s1: {}, s2: {}, s3: {} }
  };
}

let uidCounter = 0;
function testUid() {
  uidCounter += 1;
  return 'new-' + uidCounter;
}

// Full promotion preserves all pupils
{
  const S = makeState();
  const result = TPA.promoteClass(S, {
    fromYearGroup: 's1',
    className: '1A 25-26',
    toYearGroup: 's2',
    toClassName: '2A 26-27',
    uid: testUid,
    continuingPupilIds: ['p1', 'p2', 'p3']
  });
  assert.equal(result.pupilCount, 3);
  assert.equal(result.excludedCount, 0);
  assert.equal(S.pupils.s2['2A 26-27'].length, 3);
  assert.ok(S.archived.s1['1A 25-26']);
  assert.equal(S.archived.s1['1A 25-26'].pupils.length, 3);
  assert.equal(Object.keys(S.archived.s1['1A 25-26'].scores).length, 3);
  S.pupils.s2['2A 26-27'].forEach(function(np) {
    assert.ok(S.profiles.s2[np.id].trackingHistory.s1);
    assert.ok(S.profiles.s2[np.id].trackingHistory.s1.scores);
  });
}

// Excluded pupil stays in archive only
{
  const S = makeState();
  const result = TPA.promoteClass(S, {
    fromYearGroup: 's1',
    className: '1A 25-26',
    toYearGroup: 's2',
    toClassName: '2A 26-27',
    uid: testUid,
    continuingPupilIds: ['p1', 'p3']
  });
  assert.equal(result.pupilCount, 2);
  assert.equal(result.excludedCount, 1);
  const names = S.pupils.s2['2A 26-27'].map(function(p) { return p.name; }).sort();
  assert.deepEqual(names, ['Alice', 'Cara']);
  const archivedNames = S.archived.s1['1A 25-26'].pupils.map(function(p) { return p.name; }).sort();
  assert.deepEqual(archivedNames, ['Alice', 'Bob', 'Cara']);
  assert.ok(S.archived.s1['1A 25-26'].scores.p2);
  const promotedBob = S.pupils.s2['2A 26-27'].find(function(p) { return p.name === 'Bob'; });
  assert.equal(promotedBob, undefined);
}

// excludePupilIds alternative
{
  const S = makeState();
  TPA.promoteClass(S, {
    fromYearGroup: 's1',
    className: '1A 25-26',
    toYearGroup: 's2',
    toClassName: '2A 26-27',
    uid: testUid,
    excludePupilIds: ['p2']
  });
  assert.equal(S.pupils.s2['2A 26-27'].length, 2);
  assert.equal(S.archived.s1['1A 25-26'].pupils.length, 3);
}

// filterHandover helper
{
  const handover = {
    pupils: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }],
    scores: { a: { x: 1 }, b: { x: 2 } },
    profiles: {},
    className: 'c1',
    yearGroup: 's1'
  };
  const filtered = TPA.filterHandover(handover, { continuingPupilIds: ['a'] });
  assert.equal(filtered.pupils.length, 1);
  assert.equal(filtered.pupils[0].id, 'a');
  assert.equal(filtered.scores.a.x, 1);
}

console.log('tracker-promote-archive.test.mjs: all tests passed');
