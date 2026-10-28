// Optional Supabase accounts. @supabase/supabase-js is imported lazily and only when configured,
// so guests and offline builds never download it. Clients only read data and edit their own display name;
// match results and rank points are written by the Worker with the service key.
import { supabaseConfigured, SUPABASE_URL, SUPABASE_ANON_KEY, accountsDisabledReason } from './config.js';

let clientP = null;

export function getClient() {
  if (!supabaseConfigured) return Promise.resolve(null);
  if (!clientP) {
    clientP = import('@supabase/supabase-js')
      .then(({ createClient }) => createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'cc.auth.v1' },
      }))
      .catch(e => { clientP = null; throw e; });
  }
  return clientP;
}

// Finish a magic-link / OAuth redirect as soon as this module loads.
if (supabaseConfigured && typeof location !== 'undefined' && /access_token=|[?&]code=|error_description=/.test(location.hash + location.search)) {
  getClient().catch(() => {});
}

async function need() {
  const c = await getClient();
  if (!c) throw new Error(accountsDisabledReason);
  return c;
}

function unwrap({ data, error }) {
  if (error) throw new Error(error.message || String(error));
  return data;
}

export function validateDisplayName(name) {
  const n = String(name || '').trim();
  if (n.length < 3 || n.length > 20) return 'Display name must be 3-20 characters.';
  if (/[\u0000-\u001f<>]/.test(n)) return 'Display name has invalid characters.';
  return '';
}

// cb(user|null, session|null). Returns an unsubscribe function. The callback is deferred so callers may
// await other Supabase calls inside it (calling them synchronously inside onAuthStateChange can deadlock).
export function onAuthChange(cb) {
  let sub = null;
  let dead = false;
  const fire = (u, s) => setTimeout(() => { if (!dead) cb(u, s); }, 0);
  getClient()
    .then(c => {
      if (dead) return;
      if (!c) return fire(null, null);
      sub = c.auth.onAuthStateChange((_evt, session) => fire(session?.user ?? null, session ?? null)).data.subscription;
    })
    .catch(() => fire(null, null));
  return () => { dead = true; sub?.unsubscribe(); };
}

export async function signInWithEmail(email) {
  const c = await need();
  unwrap(await c.auth.signInWithOtp({ email: String(email).trim(), options: { emailRedirectTo: location.origin } }));
}

export async function signInWithOAuth(provider) {
  const c = await need();
  unwrap(await c.auth.signInWithOAuth({ provider, options: { redirectTo: location.origin } }));
}

export async function signOut() {
  const c = await getClient();
  if (c) unwrap(await c.auth.signOut());
}

export async function getSessionUser() {
  const c = await getClient();
  if (!c) return null;
  const { data } = await c.auth.getSession();
  return data.session?.user ?? null;
}

export async function getAccessToken() {
  try {
    const c = await getClient();
    if (!c) return null;
    const { data } = await c.auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

const PROFILE_COLS = 'id, display_name, rank_points, wins, losses, created_at';

export async function getProfile() {
  const c = await getClient();
  const user = await getSessionUser();
  if (!c || !user) return null;
  return unwrap(await c.from('cc_profiles').select(PROFILE_COLS).eq('id', user.id).maybeSingle());
}

export async function ensureProfile(displayName) {
  const c = await need();
  const user = await getSessionUser();
  if (!user) throw new Error('Not signed in.');
  const existing = await getProfile();
  if (existing) return existing;
  const bad = validateDisplayName(displayName);
  if (bad) throw new Error(bad);
  return unwrap(await c.from('cc_profiles').insert({ id: user.id, display_name: displayName.trim() }).select(PROFILE_COLS).single());
}

export async function updateDisplayName(displayName) {
  const c = await need();
  const user = await getSessionUser();
  if (!user) throw new Error('Not signed in.');
  const bad = validateDisplayName(displayName);
  if (bad) throw new Error(bad);
  return unwrap(await c.from('cc_profiles').update({ display_name: displayName.trim() }).eq('id', user.id).select(PROFILE_COLS).single());
}

export async function fetchLeaderboard(limit = 100) {
  const c = await need();
  return unwrap(await c.from('cc_leaderboard').select('display_name, rank_points, wins, losses')
    .order('rank_points', { ascending: false }).limit(Math.min(100, limit)));
}

// Own matches (RLS only returns matches the user played), newest first, with opponent names.
export async function fetchMyMatches(limit = 20) {
  const c = await need();
  const user = await getSessionUser();
  if (!user) return [];
  const uid = user.id;
  const rows = unwrap(await c.from('cc_matches').select('id, p1, p2, winner, p1_char, p2_char, rounds, created_at')
    .or(`p1.eq.${uid},p2.eq.${uid}`).order('created_at', { ascending: false }).limit(limit)) || [];
  const oppIds = [...new Set(rows.map(r => (r.p1 === uid ? r.p2 : r.p1)).filter(Boolean))];
  const names = {};
  if (oppIds.length) {
    const profs = unwrap(await c.from('cc_profiles').select('id, display_name').in('id', oppIds)) || [];
    for (const p of profs) names[p.id] = p.display_name;
  }
  return rows.map(r => {
    const mine = r.p1 === uid ? 1 : 2;
    const opp = mine === 1 ? r.p2 : r.p1;
    return {
      id: r.id,
      date: r.created_at,
      myChar: mine === 1 ? r.p1_char : r.p2_char,
      oppChar: mine === 1 ? r.p2_char : r.p1_char,
      oppName: names[opp] || 'Unknown',
      result: r.winner == null ? 'draw' : r.winner === uid ? 'win' : 'loss',
      rounds: r.rounds || [],
    };
  });
}

// [{ char, games, wins }] sorted by games. Pass matches from fetchMyMatches or let it fetch the last 200.
export async function characterUsage(matches = null) {
  const list = matches || (await fetchMyMatches(200));
  const by = {};
  for (const m of list) {
    if (!m.myChar) continue;
    const u = (by[m.myChar] ||= { char: m.myChar, games: 0, wins: 0 });
    u.games++;
    if (m.result === 'win') u.wins++;
  }
  return Object.values(by).sort((a, b) => b.games - a.games || b.wins - a.wins);
}
