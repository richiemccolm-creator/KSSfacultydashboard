/**
 * Unit tests for the S1–S2 simple mode of the Stimulus Generator.
 * Run: node toolkit/stimulus-junior.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const context = { window: {} };
vm.runInNewContext(readFileSync(join(__dirname, 'stimulus-junior.js'), 'utf8'), context);
const J = context.window.StimulusJunior;

// Every story type has stories, and every story is complete
for (const t of J.TYPES) {
  const pool = J.STORIES.filter(s => s.type === t.id);
  assert.ok(pool.length >= 10, `${t.id} has at least 10 stories`);
}
const ids = new Set();
for (const s of J.STORIES) {
  assert.ok(!ids.has(s.id), `story id ${s.id} is unique`);
  ids.add(s.id);
  assert.ok(J.TYPES.some(t => t.id === s.type), `${s.id} has a known type`);
  assert.equal(s.who.length, 5, `${s.id} has 5 characters`);
  for (const w of s.who) assert.ok(w.role && w.want, `${s.id} character has role and want`);
  assert.ok(s.exposition && s.conflict && s.where && s.title, `${s.id} has exposition, conflict, where, title`);
  assert.equal(s.rising.length, 3, `${s.id} has 3 rising action beats`);
  assert.equal(s.climaxes.length, 2, `${s.id} has 2 climaxes`);
  for (const c of s.climaxes) assert.ok(c.text && c.falling, `${s.id} climax has falling action`);
  assert.equal(s.endings.length, 2, `${s.id} has 2 endings`);
}

// Generate respects type, group size and the teacher's lock
const g = J.generate({ type: 'spooky', cast: '3' }, { rng: () => 0 });
assert.equal(g.level, 'junior');
assert.equal(g.type, 'spooky');
assert.equal(g.characters.length, 3);
const locked = J.generate({ type: 'funny' }, { locks: { type: 'mystery' } });
assert.equal(locked.type, 'mystery', 'teacher lock wins');
const six = J.generate({ type: 'real', cast: 6 });
assert.equal(six.characters.length, 6);
assert.equal(six.characters[5].role, 'The narrator', 'a sixth person becomes the narrator');
const anyType = J.generate({});
assert.ok(J.TYPES.some(t => t.id === anyType.type), 'no type picks one at random');
assert.equal(anyType.characters.length, 4, 'default group of 4');

// Avoid repeats the group has just had
const pool = J.STORIES.filter(s => s.type === 'funny').map(s => s.id);
const next = J.generate({ type: 'funny' }, { avoid: pool.slice(0, -1) });
assert.equal(next.combo, pool[pool.length - 1]);

// Climax and resolution must be chosen before they can be ticked; falling action follows the climax
const st = J.generate({ type: 'adventure', cast: 4 }, { rng: () => 0 });
assert.equal(J.canPlan(st, 'exposition'), true);
assert.equal(J.canPlan(st, 'climax'), false);
assert.equal(J.canPlan(st, 'falling'), false);
assert.equal(J.canPlan(st, 'resolution'), false);
assert.ok(J.stageContent(st, 'falling').waiting);
st.picks.climax = 1;
assert.equal(J.canPlan(st, 'climax'), true);
assert.equal(J.stageContent(st, 'falling').text, st.plot.climaxes[1].falling);
assert.equal(J.stageContent(st, 'climax').text, st.plot.climaxes[1].text);
st.picks.resolution = J.OWN_IDEA;
assert.equal(J.canPlan(st, 'resolution'), true);
assert.match(J.stageContent(st, 'resolution').text, /own ending/);
assert.equal(J.stageContent(st, 'rising').list.length, 3);

// Progress counting and the mountain drawing
assert.equal(J.plannedCount(st), 0);
st.planned = { exposition: true, conflict: true, climax: true };
assert.equal(J.plannedCount(st), 3);
const svg = J.mountainSvg(st, { links: true });
assert.match(svg, /3 of 6 stages planned/);
assert.match(svg, /href="#stage-climax"/);
assert.equal((svg.match(/#35C796/g) || []).length, 6, 'three planned dots drawn green (fill + stroke)');

// Stays well inside the database's 16 KB limit for a stimulus
for (const s of J.STORIES) {
  const out = J.generate({ type: s.type, cast: 6 }, { avoid: J.STORIES.filter(x => x.id !== s.id).map(x => x.id) });
  out.planned = Object.fromEntries(J.STAGES.map(x => [x.id, true]));
  assert.ok(JSON.stringify(out).length < 8000, `${s.id} stimulus is small`);
}

console.log('stimulus-junior: all tests passed');
