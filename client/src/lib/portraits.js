import { portraitURL } from '@/game/art/portrait.js';

// Safe wrapper so a missing/broken portrait never takes a whole menu down.
export function portrait(id, size = 256) {
  if (!id) return '';
  try {
    return portraitURL(id, size) || '';
  } catch (err) {
    if (import.meta.env.DEV) console.warn('[portrait]', id, err);
    return '';
  }
}
