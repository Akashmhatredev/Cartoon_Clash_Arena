// localStorage helpers. Every access is guarded: private mode, quota and disabled storage must never break the game.

export function loadJSON(key, fallback = null) {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const v = JSON.parse(raw);
    return v == null ? fallback : v;
  } catch {
    return fallback;
  }
}

export function saveJSON(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeKey(key) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/** Persist a Pinia store's state on every mutation (debounced to one write per frame burst). */
export function persistStore(store, key) {
  let pending = 0;
  store.$subscribe(
    (_m, state) => {
      if (pending) return;
      pending = setTimeout(() => {
        pending = 0;
        saveJSON(key, state);
      }, 60);
    },
    { detached: true, deep: true },
  );
}
