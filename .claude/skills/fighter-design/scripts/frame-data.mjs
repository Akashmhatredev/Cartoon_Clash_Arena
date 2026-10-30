#!/usr/bin/env node
// Prints frame data for one or all fighters (forms included). Run with Node 20.19+ from the repo root:
//   node .claude/skills/fighter-design/scripts/frame-data.mjs [fighterId]
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const { FIGHTERS, getMove } = await import(path.join(root, 'shared/fighters/index.js'));
const { SLOTS } = await import(path.join(root, 'shared/fighters/index.js'));

const want = process.argv[2];
const ids = want ? [want] : Object.keys(FIGHTERS);
const pad = (s, n, right = false) => { s = String(s); return right ? s.padStart(n) : s.padEnd(n); };

function flags(m) {
  const f = [];
  if (m.projectile) f.push('proj');
  if (m.entity) f.push('ent:' + m.entity.kind);
  if (m.behavior) f.push(m.behavior);
  if (m.dash) f.push('dash' + (m.dash.speed < 0 ? '-' : ''));
  if (m.invuln) f.push(`inv${m.invuln[0]}-${m.invuln[1]}`);
  if (m.armor) f.push(`armor${m.armor[0]}-${m.armor[1]}`);
  if (m.counter) f.push('counter');
  if (m.charge) f.push('charge');
  if (m.chainHits) f.push(`chain${m.chainHits}`);
  if (m.hits > 1) f.push(`x${m.hits}`);
  if (m.knockdown) f.push('kd');
  if (m.guard && m.guard !== 'mid') f.push(m.guard);
  if (m.noCancel) f.push('noCancel');
  return f.join(' ');
}

function row(slot, m) {
  const reach = m.hitbox ? m.hitbox.x + m.hitbox.w : m.projectile ? 'screen' : '-';
  const top = m.hitbox ? -m.hitbox.y : '-';
  const bot = m.hitbox ? -(m.hitbox.y + m.hitbox.h) : '-';
  const onBlock = m.hitbox || m.projectile ? (m.blockstun | 0) - (m.recovery | 0) : '-';
  const dmg = m.projectile && !m.damage ? m.projectile.damage * (m.projectile.hits || 1) : m.damage * (m.hits || 1);
  return [
    pad(slot, 12), pad(m.name, 26), pad(m.startup, 3, true), pad(m.active, 3, true), pad(m.recovery, 3, true),
    pad(dmg, 4, true), pad(onBlock, 5, true), pad(m.cooldown || 0, 4, true), pad(reach, 7, true), pad(top === '-' ? '-' : `${top}..${bot}`, 9, true), flags(m),
  ].join(' ');
}

const header = [pad('slot', 12), pad('name', 26), pad('st', 3, true), pad('ac', 3, true), pad('rc', 3, true), pad('dmg', 4, true), pad('onBlk', 5, true), pad('cd', 4, true), pad('reach', 7, true), pad('yTop..Bot', 9, true), 'flags'].join(' ');

for (const id of ids) {
  const d = FIGHTERS[id];
  if (!d) { console.error(`unknown fighter ${id}`); process.exit(1); }
  const forms = [null, ...Object.keys(d.forms || {})];
  for (const form of forms) {
    console.log(`\n== ${d.name} (${id}${form ? ' / ' + form : ''})  hp ${d.hp}  body ${d.body.w}x${d.body.h}/${d.body.crouchH}  walk ${d.walkSpeed} back ${d.backSpeed} jump ${d.jumpVel} dash ${d.dashSpeed}x${d.dashFrames}  dmg x${d.dmgMult} def x${d.defMult}`);
    console.log(header);
    for (const slot of SLOTS) {
      const m = getMove(id, slot, form);
      if (!m) { console.log(pad(slot, 12) + ' (missing)'); continue; }
      const own = !form || (d.forms[form].moves && d.forms[form].moves[slot]);
      if (form && !own) continue; // only show overridden moves for forms
      console.log(row(slot, m));
    }
  }
}
