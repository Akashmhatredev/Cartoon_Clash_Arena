// Phaser-free character registry: rig proportions + Canvas2D part drawings, one file per fighter in ./chars/.
// Fan-art likenesses built from each character's signature design cues (proportions, hair, face, outfit).
// All coordinates are world units; each part is drawn around its pivot (limbs hang along +y, torso and head
// extend up along -y). Characters face +x in a three-quarter view: the near eye is drawn first and larger.
// Heads accept an expression ('normal' | 'blink' | 'hurt' | 'shout'); the atlas bakes one frame per expression.
import * as D from './draw.js';
import { getFighter } from '@shared/index.js';
import shinchan from './chars/shinchan.js';
import doraemon from './chars/doraemon.js';
import hattori from './chars/hattori.js';
import pikachu from './chars/pikachu.js';
import ben10 from './chars/ben10.js';
import nobita from './chars/nobita.js';
import goku from './chars/goku.js';
import bheem from './chars/bheem.js';

export { EXPRS } from './chars/kit.js';

const ART = { ...shinchan, ...doraemon, ...hattori, ...pikachu, ...ben10, ...nobita, ...goku, ...bheem };

/** fallback body sizes (the engine fighter data wins; see shared/fighters/<id>.js body) */
export const BODY = {};
/** fallback palettes; accent drives glows, auras and portrait frames */
export const PALETTE = {};
const BUILDERS = {};
for (const id in ART) { BODY[id] = ART[id].body; PALETTE[id] = ART[id].palette; BUILDERS[id] = ART[id].build; }

const HUMAN = { shinchan: 1, hattori: 1, ben10: 1, nobita: 1, goku: 1, bheem: 1 };

function engineFighter(id) {
  try { return getFighter ? getFighter(id) : null; } catch { return null; }
}

/** engine body for a char/form (falls back to the BODY table) */
export function bodyFor(charId, form = null) {
  const key = form || charId;
  const fb = BODY[key] || BODY[charId] || BODY.ben10;
  const f = engineFighter(charId);
  let b = f && f.body;
  if (form && f && f.forms && f.forms[form]) b = f.forms[form].body || null;
  if (form && !b) return fb;
  const h = b && Number.isFinite(b.h) ? b.h : fb.h;
  const w = b && Number.isFinite(b.w) ? b.w : fb.w;
  const crouchH = b && Number.isFinite(b.crouchH) ? b.crouchH : fb.crouchH;
  return { w, h, crouchH };
}

export function paletteFor(charId, form = null) {
  const key = form || charId;
  const base = { ...(PALETTE[key] || PALETTE.ben10) };
  if (!form) {
    const f = engineFighter(charId);
    const p = f && f.palette;
    if (p) {
      if (D.isHex(p.primary)) base.primary = p.primary;
      if (HUMAN[charId] && D.isHex(p.skin)) base.skin = p.skin;
      if (D.isHex(p.accent)) base.accent = p.accent;
    }
  }
  return base;
}

export const FORMS = { ben10: ['fourarms', 'xlr8', 'heatblast'] };

const specCache = new Map();
/** rig spec for a fighter (form = null for base). Cached. */
export function getSpec(charId, form = null) {
  const id = BUILDERS[charId] ? charId : 'ben10';
  const fkey = form && BUILDERS[form] ? form : null;
  const key = id + '|' + (fkey || '');
  let s = specCache.get(key);
  if (s) return s;
  const pal = paletteFor(id, fkey);
  s = BUILDERS[fkey || id](pal);
  const body = bodyFor(id, fkey);
  s.id = id; s.form = fkey; s.pal = pal; s.body = body;
  s.k = body.h / s.H;           // uniform scale so art height matches the engine hurtbox
  specCache.set(key, s);
  return s;
}
