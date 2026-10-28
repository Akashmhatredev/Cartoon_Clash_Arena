// Server-side Supabase helpers. The service key never leaves the Worker.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function supabaseEnabled(env) {
  return !!(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
}

const base = env => String(env.SUPABASE_URL).replace(/\/+$/, '');

function serviceHeaders(env) {
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  const h = { apikey: key, 'Content-Type': 'application/json' };
  // Legacy service_role keys are JWTs and go in Authorization too; new sb_secret_ keys go only in apikey.
  if (key.startsWith('eyJ')) h.Authorization = `Bearer ${key}`;
  return h;
}

// Returns the verified user id for a client access token, or null. Never trust client-sent ids.
export async function verifyUser(env, accessToken) {
  if (!supabaseEnabled(env) || !accessToken) return null;
  try {
    const res = await fetch(`${base(env)}/auth/v1/user`, {
      headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const u = await res.json();
    return u && typeof u.id === 'string' && UUID_RE.test(u.id) ? u.id : null;
  } catch {
    return null;
  }
}

// Calls public.cc_record_match (SECURITY DEFINER, service_role only). Idempotent per p_match_id, so a retry is safe.
export async function recordMatch(env, args) {
  let lastErr;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(`${base(env)}/rest/v1/rpc/cc_record_match`, {
        method: 'POST',
        headers: serviceHeaders(env),
        body: JSON.stringify(args),
      });
      if (res.ok) return await res.json();
      lastErr = new Error(`cc_record_match ${res.status}: ${(await res.text()).slice(0, 200)}`);
      if (res.status < 500) break;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}
