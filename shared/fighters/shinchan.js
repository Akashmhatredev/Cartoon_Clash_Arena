import { fighter, light, heavy, crouchLight, crouchHeavy, airLight, airHeavy, throwMove, special, ultimate } from './kit.js';

export default fighter({
  id: 'shinchan', name: 'Shinchan', title: 'The Kasukabe Menace', bio: 'A cheeky five-year-old whose chaos is his strategy.',
  hp: 100, stats: { speed: 4, power: 3, defense: 2 },
  walkSpeed: 4.6, backSpeed: 3.8, jumpVel: -17, jumpSpeedX: 4.6, dashSpeed: 11, defMult: 1.08,
  body: { w: 70, h: 150, crouchH: 100 },
  palette: { primary: '#e8322f', secondary: '#f6c445', accent: '#22e4ff', skin: '#ffd2a8', outline: '#0b0f1e' },
  homeStage: 'suburb',
  passive: { name: 'Unpredictable', desc: 'Punch, Kick and his low poke recover a few frames faster than normal.' },
  moves: {
    // Unpredictable: recovery trimmed on his basics
    light: light({ name: 'Punch', desc: 'Quick poke. Chains into Kick.', startup: 4, recovery: 7, hitbox: { x: 8, y: -112, w: 58, h: 58 } }),
    heavy: heavy({ name: 'Kick', anim: 'kick', desc: 'Swinging kick with good reach.', startup: 9, recovery: 13, hitbox: { x: 8, y: -112, w: 78, h: 62 } }),
    crouchLight: crouchLight({ name: 'Ankle Poke', desc: 'Low jab. Must be blocked low.', recovery: 7 }),
    crouchHeavy: crouchHeavy({ name: 'Butt Taunt', anim: 'taunt', desc: 'Safe taunt that builds a little meter. No hitbox.',
      startup: 6, active: 1, recovery: 12, hitbox: null, damage: 0, meterOnUse: 8, cancel: null }),
    airLight: airLight({ name: 'Hop Punch', desc: 'Air jab. Overhead.' }),
    airHeavy: airHeavy({ name: 'Diving Kick', desc: 'Downward kick. Overhead.' }),
    throw: throwMove({ name: 'Piggyback Toss' }),
    special1: special({ name: 'B-Style Dash', input: 'Sp', anim: 'dashStrike', desc: 'Low slide with brief evasion. Cooldown.',
      startup: 6, active: 12, recovery: 14, damage: 7, guard: 'low', cooldown: 90, invuln: [3, 10],
      dash: { speed: 9, frames: 14, from: 3 }, hitbox: { x: 0, y: -50, w: 62, h: 50 }, knockback: { x: 5, y: 0 } }),
    special2: special({ name: 'Mischief Feint', input: '→+Sp', anim: 'flurry', desc: 'Fakes a wind-up, then darts in with a quick strike.',
      startup: 16, active: 4, recovery: 14, damage: 9, cooldown: 120, dash: { speed: 9, frames: 6, from: 10 },
      hitbox: { x: 8, y: -115, w: 64, h: 70 }, knockback: { x: 5, y: 0 } }),
    special3: special({ name: 'Chaos Spin', input: '↓+Sp', anim: 'spin', desc: 'Four-hit spin. Big recovery if blocked.',
      startup: 8, active: 20, recovery: 26, damage: 3, hits: 4, hitInterval: 5, hitstun: 14, blockstun: 8, cooldown: 150,
      hitbox: { x: -50, y: -110, w: 140, h: 100 }, knockback: { x: 2, y: 0 }, strength: 1, scaling: 0.9 }),
    ultimate: ultimate({ name: 'Maximum Mischief', desc: 'Lunging grab-strike; on hit, a strike chain ends in a launch.',
      startup: 10, active: 6, recovery: 30, damage: 6, hitbox: { x: 8, y: -115, w: 80, h: 70 }, dash: { speed: 7, frames: 8, from: 4 },
      chainHits: 6, chainInterval: 6, chainDamage: 3, chainFinal: { damage: 8, knockback: { x: 9, y: -11 } }, effect: 'sparkle' }),
  },
});
