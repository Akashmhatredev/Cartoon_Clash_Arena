import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import './styles/base.css';
import { persistStore } from './lib/storage.js';
import { useSettings, SETTINGS_KEY } from './stores/settings.js';
import { useProgress, PROGRESS_KEY } from './stores/progress.js';
import { supabaseConfigured } from './net/config.js';

const app = createApp(App);
const pinia = createPinia();
app.use(pinia);

persistStore(useSettings(pinia), SETTINGS_KEY);
persistStore(useProgress(pinia), PROGRESS_KEY);

// iOS Safari ignores user-scalable=no: block pinch and double-tap zoom gestures.
const block = (e) => e.preventDefault();
document.addEventListener('gesturestart', block, { passive: false });
document.addEventListener('gesturechange', block, { passive: false });
document.addEventListener('dblclick', block, { passive: false });

app.mount('#app');

// Finish magic-link / OAuth redirects on page load; the Supabase SDK stays out of the menu bundle.
if (supabaseConfigured && /access_token|code=/.test(location.hash + location.search)) {
  import('./net/supabase.js').then((m) => m.getClient()).catch(() => {});
}
