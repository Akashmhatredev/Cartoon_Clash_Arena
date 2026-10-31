#!/usr/bin/env node
// Headless AI-vs-AI balance runs. Node 20.19+. From the repo root:
//   node .claude/skills/ai-opponent/scripts/ai-arena.mjs goku bheem --n 10 --diff hard
//   node .claude/skills/ai-opponent/scripts/ai-arena.mjs --all --n 4 --diff normal
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const engine = await import(path.join(root, 'shared/index.js'));
const { createAI } = await import(path.join(root, 'shared/ai/index.js'));

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf('--' + name); return i >= 0 && args[i + 1] ? args[i + 1] : def; };
const all = args.includes('--all');
const n = Math.max(1, parseInt(opt('n', '6'), 10));
const diff = opt('diff', 'normal');
const ids = args.filter(a => !a.startsWith('--') && engine.FIGHTER_IDS.includes(a));
const MAX_FRAMES = 60 * 60 * 6; // safety cap: 6 minutes of sim

function playMatch(p1, p2, seed) {
  const state = engine.createMatch({ p1, p2, stage: engine.getFighter(p1).homeStage, seed });
  const a = createAI({ charId: p1, difficulty: diff, seed: seed * 31 + 1 });
  const b = createAI({ charId: p2, difficulty: diff, seed: seed * 31 + 2 });
  const inputs = [0, 0];
  while (state.phase !== 'matchEnd' && state.frame < MAX_FRAMES) {
    inputs[0] = a.think(state, 0) | 0;
    inputs[1] = b.think(state, 1) | 0;
    engine.step(state, inputs);
  }
  return { winner: state.matchWinner, frames: state.frame, wins: state.wins, dmg: state.stats.damage, combo: state.stats.maxCombo };
}

function matchup(p1, p2) {
  let w1 = 0, w2 = 0, draws = 0, frames = 0, d1 = 0, d2 = 0, c1 = 0, c2 = 0, timeouts = 0;
  for (let s = 1; s <= n; s++) {
    const r = playMatch(p1, p2, s);
    if (r.winner === 0) w1++; else if (r.winner === 1) w2++; else draws++;
    frames += r.frames; d1 += r.dmg[0]; d2 += r.dmg[1]; c1 = Math.max(c1, r.combo[0]); c2 = Math.max(c2, r.combo[1]);
    if (r.frames >= MAX_FRAMES) timeouts++;
  }
  return { w1, w2, draws, avgSec: frames / n / 60, d1: d1 / n, d2: d2 / n, c1, c2, timeouts };
}

const pct = (x) => (100 * x).toFixed(0).padStart(3) + '%';
const t0 = Date.now();

if (all) {
  const cast = engine.FIGHTER_IDS;
  const wins = Object.fromEntries(cast.map(id => [id, 0]));
  const games = Object.fromEntries(cast.map(id => [id, 0]));
  console.log(`AI vs AI, difficulty ${diff}, ${n} seeds per matchup (row = side 0, col = side 1; cell = row win rate)\n`);
  console.log(''.padEnd(10) + cast.map(c => c.slice(0, 7).padStart(8)).join(''));
  for (const p1 of cast) {
    let line = p1.padEnd(10);
    for (const p2 of cast) {
      if (p1 === p2) { line += '   -    '; continue; }
      const m = matchup(p1, p2);
      line += pct(m.w1 / n).padStart(8);
      wins[p1] += m.w1; wins[p2] += m.w2; games[p1] += n; games[p2] += n;
    }
    console.log(line);
  }
  console.log('\nOverall win rate:');
  for (const id of cast) console.log(`  ${id.padEnd(10)} ${pct(wins[id] / Math.max(1, games[id]))}  (${wins[id]}/${games[id]})`);
} else {
  const [p1 = 'goku', p2 = 'bheem'] = ids;
  const m = matchup(p1, p2);
  console.log(`${p1} (side 0) vs ${p2} (side 1), difficulty ${diff}, ${n} seeds`);
  console.log(`  wins: ${p1} ${m.w1}  ${p2} ${m.w2}  draws ${m.draws}  ${m.timeouts ? `cap-hits ${m.timeouts}` : ''}`);
  console.log(`  avg match length ${m.avgSec.toFixed(1)} s, avg damage ${m.d1.toFixed(0)} / ${m.d2.toFixed(0)}, best combo ${m.c1} / ${m.c2}`);
}
console.log(`\n(${((Date.now() - t0) / 1000).toFixed(1)} s)`);
