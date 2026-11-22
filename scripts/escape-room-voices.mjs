#!/usr/bin/env node
// Generates voiceover clips for toolkit/escape-room.html with a local VoiceStudio backend.
// Reads the story, objectives and theatre facts straight from the game file, so audio always
// matches the on-screen text. Re-runnable: a clip is only (re)made when its text changes.
//
//   node scripts/escape-room-voices.mjs            # make missing or changed clips
//   node scripts/escape-room-voices.mjs --list     # just write lines.json and list what's to do
//
// Needs: the VoiceStudio CLI connected to a backend, saved voices "ER Narrator", "ER Prompter", "ER You".
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GAME = join(ROOT, 'toolkit/escape-room.html');
const OUT = join(ROOT, 'toolkit/escape-room-audio');
const CLI = process.env.VOICESTUDIO_CLI || '/Applications/VoiceStudio.app/Contents/Resources/cli/voicestudio';
const VOICES = { narrator: 'ER Narrator', prompter: 'ER Prompter', you: 'ER You' };
const SEED = { narrator: '11', prompter: '7', you: '23' };

function literal(src, name) {
  const start = src.indexOf(`const ${name}=`);
  if (start < 0) throw new Error(`${name} not found in game file`);
  let i = src.indexOf('{', start), depth = 0, j = i;
  for (; j < src.length; j++) { const c = src[j]; if (c === '{') depth++; else if (c === '}' && --depth === 0) break; }
  return Function(`"use strict"; return (${src.slice(i, j + 1)});`)();
}

const spoken = t => t
  .replace(/<[^>]+>/g, '')
  .replace(/^YOU\b/, 'You').replace(/\bYOU\b/g, 'you')
  .replace(/\bLX\b/g, 'L X').replace(/\bEXIT\b/g, 'exit')
  .replace(/\bcyc\b/gi, 'sike')
  .replace(/…/g, '...')
  .replace(/^\s*\.{3}\s*/, '')                 // a leading "..." makes short lines ramble
  .replace(/\s+/g, ' ').trim()
  .replace(/^[a-z]/, c => c.toUpperCase());

function buildLines() {
  const src = readFileSync(GAME, 'utf8');
  const SCENES = literal(src, 'SCENES'), OBJECTIVES = literal(src, 'OBJECTIVES'), FLAVOUR = literal(src, 'FLAVOUR');
  const lines = [];
  for (const [key, scene] of Object.entries(SCENES))
    scene.lines.forEach(([who, txt], i) => lines.push({ id: `${key}-${i + 1}`, voice: who === 'sd' ? 'narrator' : who === 'YOU' ? 'you' : 'prompter', text: spoken(txt) }));
  for (const [level, steps] of Object.entries(OBJECTIVES))
    for (const [step, txt] of Object.entries(steps)) lines.push({ id: `obj-${level}-${step}`, voice: 'narrator', text: spoken(txt) });
  for (const [key, txt] of Object.entries(FLAVOUR)) lines.push({ id: `fl-${key}`, voice: 'narrator', text: spoken(txt) });
  lines.push({ id: 'fail-1', voice: 'narrator', text: 'The house lights snap on. There are voices in the foyer. It’s morning, and the show has started without you.' });
  lines.push({ id: 'fail-2', voice: 'prompter', text: 'The curtain waits for no one. Try again.' });
  for (const l of lines) l.hash = createHash('sha1').update(`${l.voice}|${SEED[l.voice]}|${l.text}`).digest('hex').slice(0, 12);
  return lines;
}

mkdirSync(OUT, { recursive: true });
const manifestPath = join(OUT, 'lines.json');
const old = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : { lines: [] };
const done = new Map(old.lines.filter(l => l.file).map(l => [l.id, l]));
const lines = buildLines();
for (const l of lines) { const prev = done.get(l.id); if (prev && prev.hash === l.hash && existsSync(join(OUT, prev.file))) l.file = prev.file; }
const save = () => writeFileSync(manifestPath, JSON.stringify({ generated: new Date().toISOString(), voices: VOICES, lines }, null, 1));
save();

const todo = lines.filter(l => !l.file);
console.log(`${lines.length} lines, ${lines.length - todo.length} already voiced, ${todo.length} to make.`);
if (process.argv.includes('--list')) { todo.forEach(l => console.log(`  ${l.id} [${l.voice}] ${l.text}`)); process.exit(0); }

// A generation that runs away (a rambling take) is abandoned by the backend but keeps holding the
// model, so every later line then fails too. On failure, restart the local Docker backend to clear it,
// then retry the line once with a different seed. Set VOICESTUDIO_DOCKER= to skip restarts (remote backend).
const DOCKER_NAME = process.env.VOICESTUDIO_DOCKER ?? 'omnivoice';
const sleep = s => execFileSync('sleep', [String(s)]);
const MAX_MIN = Number(process.env.VOICE_MAX_MINUTES || 12);
function restartBackend() {
  if (!DOCKER_NAME) return;
  const docker = ['/usr/local/bin/docker', `${process.env.HOME}/.docker/bin/docker`].find(p => existsSync(p));
  if (!docker) return;
  console.log('  restarting the VoiceStudio backend to clear a stuck job…');
  execFileSync(docker, ['restart', DOCKER_NAME], { stdio: 'ignore' });
  for (let i = 0; i < 60; i++) { try { execFileSync(CLI, ['connection', 'test'], { stdio: 'ignore' }); break; } catch { sleep(10); } }
  sleep(30);
}
function make(l, wav, seed) {
  // A normal line takes 1-5 minutes on a laptop CPU; past MAX_MIN it is almost certainly a runaway take.
  execFileSync(CLI, ['--timeout', String(MAX_MIN * 60 + 60), 'speak', '--voice', VOICES[l.voice], '--language', 'English', '--seed', seed, '-o', wav, '--overwrite', l.text],
    { stdio: ['ignore', 'ignore', 'pipe'], timeout: MAX_MIN * 60 * 1000, killSignal: 'SIGKILL' });
}

let n = 0, failed = 0;
for (const l of todo) {
  n++; const t0 = Date.now(); const wav = join(OUT, `${l.id}.wav`), m4a = join(OUT, `${l.id}.m4a`);
  try {
    try { make(l, wav, SEED[l.voice]); }
    catch (e) { console.log(`[${n}/${todo.length}] ${l.id} first try failed, retrying: ${String(e.stderr || e.message).trim().slice(0, 120)}`); restartBackend(); make(l, wav, String(Number(SEED[l.voice]) + 100)); }
    execFileSync('afconvert', ['-f', 'm4af', '-d', 'aac', '-b', '64000', wav, m4a]);
    unlinkSync(wav);
    l.file = `${l.id}.m4a`; save();
    console.log(`[${n}/${todo.length}] ${l.id} done in ${Math.round((Date.now() - t0) / 1000)}s (${Math.round(statSync(m4a).size / 1024)} KB)`);
  } catch (e) {
    failed++;
    console.log(`[${n}/${todo.length}] ${l.id} FAILED: ${String(e.stderr || e.message).trim().slice(0, 300)}`);
    restartBackend();
  }
}
console.log(failed ? `ALL DONE with ${failed} failed (run again to retry them)` : 'ALL DONE');
