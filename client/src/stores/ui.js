import { defineStore } from 'pinia';

export const SCREENS = ['menu', 'select', 'ladder', 'fight', 'results', 'settings', 'online', 'account', 'leaderboard'];
// Transient screens are never pushed onto the back-stack.
const TRANSIENT = new Set(['fight', 'results']);
let toastSeq = 0;

export const useUi = defineStore('ui', {
  state: () => ({
    screen: 'menu',
    params: {},
    history: [],
    nav: 0, // bumps on every navigation so the same screen can remount with new params
    toasts: [],
  }),
  actions: {
    go(screen, params = {}) {
      if (!SCREENS.includes(screen)) screen = 'menu';
      if (screen === 'menu') {
        this.history = [];
      } else {
        const idx = this.history.findIndex((h) => h.screen === screen);
        if (idx >= 0) this.history.splice(idx);
        else if (this.screen !== screen && !TRANSIENT.has(this.screen)) {
          this.history.push({ screen: this.screen, params: this.params });
          if (this.history.length > 12) this.history.shift();
        }
      }
      this.screen = screen;
      this.params = params || {};
      this.nav++;
    },
    back() {
      const prev = this.history.pop();
      this.screen = prev ? prev.screen : 'menu';
      this.params = prev ? prev.params : {};
      this.nav++;
    },
    toast(text, kind = 'info', ms = 2800) {
      const id = ++toastSeq;
      this.toasts.push({ id, text, kind });
      setTimeout(() => {
        const i = this.toasts.findIndex((t) => t.id === id);
        if (i >= 0) this.toasts.splice(i, 1);
      }, ms);
    },
  },
});
