#!/usr/bin/env node
// Headless smoke test for shared/: engine, AI, arcade and protocol. Node 20.19+. From the repo root:
//   node .claude/skills/engine-testing/scripts/smoke.mjs
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const engine = await import(path.join(root, 'shared/index.js'));
const { createAI } = await import(path.join(root, 'shared/ai/index.js'));
const { buildLadder, ARCADE_LENGTH } = await import(path.join(root, 'shared/arcade.js'));
const proto = await import(path.join(root, 'shared/protocol.js'));

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? '  (' + detail + ')' : ''}`);
  if (!ok) failed++;
};

// 1. every fighter has all slots and a sane body
const { FIGHTERS } = await import(path.join(root, 'shared/fighters/index.js'));
const { SLOTS } = await import(path.join(root, 'shared/fighters/index.js'));
for (const id of engine.FIGHTER_IDS) {
  const d = FIGHTERS[id];
  const missing = SLOTS.filter((s) => !d || !d.moves[s]);
  check(`fighter ${id} complete`, !!d && missing.length === 0 && d.body.h > 0 && engine.STAGE_IDS.includes(d.homeStage), missing.join(','));
}

// 2. a scripted human-ish match against the AI resolves
function playAI(p1, p2, seed, frames = 60 * 120) {
  const s = engine.createMatch({ p1, p2, stage: 'island', seed });
  const a = createAI({ charId: p1, difficulty: 'hard', seed: seed + 1 });
  const b = createAI({ charId: p2, difficulty: 'boss', seed: seed + 2 });
  const inputs = [0, 0];
  for (let i = 0; i < frames && s.phase !== 'matchEnd'; i++) {
    inputs[0] = a.think(s, 0) | 0; inputs[1] = b.think(s, 1) | 0;
    engine.step(s, inputs);
  }
  return s;
}
const s1 = playAI('goku', 'bheem', 7);
check('AI match reaches matchEnd within 2 minutes', s1.phase === 'matchEnd', `phase ${s1.phase} frame ${s1.frame} wins ${s1.wins}`);
check('damage was dealt by both sides', s1.stats.damage[0] > 0 && s1.stats.damage[1] > 0, `${s1.stats.damage}`);

// 3. determinism: identical replay
const s2 = playAI('goku', 'bheem', 7);
const a1 = JSON.stringify(proto.packState(s1)), a2 = JSON.stringify(proto.packState(s2));
check('replay is deterministic', a1 === a2, `${a1.length} bytes`);

// 4. clone + continue equals original continue
const base = engine.createMatch({ p1: 'pikachu', p2: 'hattori', stage: 'forest', seed: 3 });
for (let i = 0; i < 400; i++) engine.step(base, [i % 20 < 2 ? engine.BTN.LIGHT : engine.BTN.RIGHT, i % 30 < 3 ? engine.BTN.HEAVY : engine.BTN.LEFT]);
const clone = engine.cloneState(base);
for (let i = 0; i < 300; i++) { const m = [i % 7 ? engine.BTN.RIGHT : engine.BTN.SPECIAL, engine.BTN.BLOCK]; engine.step(base, m); engine.step(clone, m); }
check('cloneState continues identically', JSON.stringify(proto.packState(base)) === JSON.stringify(proto.packState(clone)));

// 5. snapshot round trip
const target = engine.createMatch({ p1: 'pikachu', p2: 'hattori', stage: 'forest', seed: 3 });
proto.applyPackedState(target, JSON.parse(JSON.stringify(proto.packState(base))));
check('packState/applyPackedState round-trips', JSON.stringify(proto.packState(target)) === JSON.stringify(proto.packState(base)));

// 6. training mode never ends
const tr = engine.createMatch({ p1: 'nobita', p2: 'shinchan', seed: 1, training: { dummyInvincible: true, infiniteMeter: true } });
for (let i = 0; i < 60 * 30; i++) engine.step(tr, [i % 15 < 2 ? engine.BTN.HEAVY : engine.BTN.RIGHT, 0]);
check('training mode stays in fight phase with full meter', tr.phase === 'fight' && tr.fighters[0].meter === engine.METER_MAX && tr.fighters[1].hp > 0);

// 7. arcade ladder
const lad = buildLadder('goku', 'hard', 5);
const uniq = new Set(lad.map((r) => r.opponent));
check('ladder has 7 unique non-player opponents and a boss on final', lad.length === ARCADE_LENGTH && uniq.size === 7 && !uniq.has('goku') && lad[6].boss && lad[6].stage === 'final' && lad[6].mods.hpMult > 1);
check('ladder is stable per seed', JSON.stringify(buildLadder('goku', 'hard', 5)) === JSON.stringify(lad));

// 8. protocol validation
const ok = proto.parseClientMessage(proto.encode('in', { s: 1, f: 0, m: 1023 }));
const badMask = proto.parseClientMessage(proto.encode('in', { s: 1, f: 0, m: 1024 }));
const badVer = proto.parseClientMessage(JSON.stringify({ v: proto.PROTOCOL_VERSION + 1, t: 'ready', on: true }));
const tooBig = proto.parseClientMessage(proto.encode('char', { id: 'goku', pad: 'x'.repeat(1100) }));
check('protocol accepts a valid input and rejects bad mask / version / size', ok.ok && !badMask.ok && !badVer.ok && badVer.fatal && !tooBig.ok && tooBig.err === proto.ERR.TOO_BIG);

console.log(failed ? `\n${failed} check(s) FAILED` : '\nall smoke checks passed');
process.exit(failed ? 1 : 0);
