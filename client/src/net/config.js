// Online/accounts configuration from Vite env. Everything here is public (VITE_ vars ship to the browser):
// never put the Supabase service key in a VITE_ variable.
const env = import.meta.env || {};
const clean = s => String(s || '').trim().replace(/\/+$/, '');

export const WS_URL = clean(env.VITE_WS_URL);
export const HTTP_URL = WS_URL.replace(/^ws(s?):\/\//i, 'http$1://');
export const SUPABASE_URL = clean(env.VITE_SUPABASE_URL);
export const SUPABASE_ANON_KEY = String(env.VITE_SUPABASE_ANON_KEY || '').trim();

const insecureWs = typeof location !== 'undefined' && location.protocol === 'https:' && /^ws:\/\//i.test(WS_URL);

export const onlineConfigured = /^wss?:\/\/[^/]+/i.test(WS_URL) && !insecureWs;
export const supabaseConfigured = /^https?:\/\/[^/]+/i.test(SUPABASE_URL) && SUPABASE_ANON_KEY.length > 20;

export const onlineDisabledReason = onlineConfigured
  ? ''
  : insecureWs
    ? 'Online is off: this https page needs a wss:// server URL (VITE_WS_URL).'
    : 'Online is off: no game server configured (VITE_WS_URL).';

export const accountsDisabledReason = supabaseConfigured
  ? ''
  : 'Accounts are off: Supabase is not configured (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY).';
