// Content (C) art API. See CONTRACT section 8.
import { getSpec, FORMS } from './chars.js';
import { buildAtlas, buildBodyTexture } from './atlas.js';
import { ensureCommonTextures } from '../fx/textures.js';
import { preloadProjectileArt as preloadProj } from './projectileArt.js';

export { FighterView } from './FighterView.js';
export { ProjectileLayer } from './ProjectileLayer.js';
export { renderPortrait, portraitURL } from './portrait.js';

/** Rasterize vector parts to high-res atlases (scale = registry 'res'). Idempotent; builds ben10 forms. */
export async function preloadFighterArt(scene, charId) {
  ensureCommonTextures(scene);
  const forms = [null].concat(FORMS[charId] || []);
  for (const form of forms) {
    const spec = getSpec(charId, form);
    buildAtlas(scene, spec);
    if (!form) buildBodyTexture(scene, spec);
  }
  // shadow clones copy Hattori's idle; make sure that silhouette exists whoever is fighting
  if (charId !== 'hattori') buildBodyTexture(scene, getSpec('hattori', null));
}

export function preloadProjectileArt(scene) {
  preloadProj(scene);
}
