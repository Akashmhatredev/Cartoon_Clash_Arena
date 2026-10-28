import { onBeforeUnmount, onMounted } from 'vue';
import { sfx } from '@/game/audio/sfx.js';

const COARSE = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;

/**
 * Arrow/W/S focus navigation across buttons inside rootRef, plus optional Escape-to-back.
 * Native Enter/Space activates the focused button.
 */
export function useMenuNav(rootRef, opts = {}) {
  const selector = opts.selector || '.btn:not(:disabled)';
  const enabled = opts.enabled || (() => true);

  function items() {
    const root = rootRef.value;
    if (!root) return [];
    return Array.from(root.querySelectorAll(selector)).filter((el) => el.offsetParent !== null);
  }

  function onKey(e) {
    if (e.defaultPrevented || !enabled()) return;
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
    if (e.code === 'Escape' && opts.onBack) {
      e.preventDefault();
      opts.onBack();
      return;
    }
    let dir = 0;
    if (e.code === 'ArrowUp' || e.code === 'KeyW') dir = -1;
    else if (e.code === 'ArrowDown' || e.code === 'KeyS') dir = 1;
    if (!dir) return;
    const list = items();
    if (!list.length) return;
    e.preventDefault();
    const i = list.indexOf(document.activeElement);
    const n = i < 0 ? (dir > 0 ? 0 : list.length - 1) : (i + dir + list.length) % list.length;
    list[n].focus();
    try {
      sfx.play('select');
    } catch {
      /* ignore */
    }
  }

  onMounted(() => {
    window.addEventListener('keydown', onKey);
    if (opts.autofocus !== false && !COARSE) {
      requestAnimationFrame(() => {
        const first = rootRef.value?.querySelector('[data-autofocus]:not(:disabled)') || items()[0];
        first?.focus({ preventScroll: true });
      });
    }
  });
  onBeforeUnmount(() => window.removeEventListener('keydown', onKey));
}
