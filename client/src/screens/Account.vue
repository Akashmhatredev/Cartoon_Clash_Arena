<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useUi } from '@/stores/ui.js';
import { useSettings } from '@/stores/settings.js';
import { portrait } from '@/lib/portraits.js';
import { fighterName } from '@/lib/fighters.js';
import { supabaseConfigured, accountsDisabledReason } from '@/net/config.js';
import {
  onAuthChange, signInWithEmail, signInWithOAuth, signOut, getProfile, ensureProfile, updateDisplayName,
  fetchMyMatches, characterUsage, validateDisplayName,
} from '@/net/supabase.js';

const ui = useUi();
const settings = useSettings();

const loading = ref(supabaseConfigured);
const user = ref(null);
const profile = ref(null);
const matches = ref([]);
const usage = ref([]);
const email = ref('');
const nameInput = ref('');
const busy = ref(false);
const msg = ref('');
const err = ref('');
const dataLoading = ref(false);

const winRate = computed(() => {
  const p = profile.value;
  const total = p ? p.wins + p.losses : 0;
  return total ? Math.round((p.wins / total) * 100) : 0;
});
const nameError = computed(() => (nameInput.value ? validateDisplayName(nameInput.value) : ''));

async function loadAll() {
  dataLoading.value = true;
  err.value = '';
  try {
    profile.value = await getProfile();
    nameInput.value = profile.value?.display_name || (settings.playerName || '').trim().slice(0, 20);
    if (profile.value) {
      const all = await fetchMyMatches(200);
      matches.value = all.slice(0, 15);
      usage.value = await characterUsage(all);
    }
  } catch (e) {
    err.value = e.message;
  } finally {
    dataLoading.value = false;
  }
}

async function run(fn, okMsg = '') {
  if (busy.value) return;
  busy.value = true;
  err.value = '';
  msg.value = '';
  try {
    await fn();
    if (okMsg) msg.value = okMsg;
  } catch (e) {
    err.value = e.message || String(e);
  } finally {
    busy.value = false;
  }
}

function sendLink() {
  const e = email.value.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
    err.value = 'Enter a valid email address.';
    return;
  }
  run(() => signInWithEmail(e), `Magic link sent to ${e}. Open it on this device to sign in.`);
}

function oauth(provider) {
  run(() => signInWithOAuth(provider));
}

function saveName() {
  const n = nameInput.value.trim();
  const bad = validateDisplayName(n);
  if (bad) {
    err.value = bad;
    return;
  }
  run(async () => {
    profile.value = profile.value ? await updateDisplayName(n) : await ensureProfile(n);
    settings.playerName = n.slice(0, 16);
    if (!matches.value.length) await loadAll();
  }, 'Display name saved.');
}

function logout() {
  run(async () => {
    await signOut();
    profile.value = null;
    matches.value = [];
    usage.value = [];
  }, 'Signed out.');
}

const fmtDate = d => {
  try { return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); } catch { return ''; }
};

let off = null;
onMounted(() => {
  if (!supabaseConfigured) return;
  off = onAuthChange(u => {
    const changed = (u?.id || null) !== (user.value?.id || null);
    user.value = u;
    loading.value = false;
    if (u && (changed || !profile.value)) loadAll();
    if (!u) {
      profile.value = null;
      matches.value = [];
      usage.value = [];
    }
  });
});
onBeforeUnmount(() => off?.());
</script>

<template>
  <div class="screen account">
    <div class="screen-inner">
      <header class="screen-header">
        <button class="back-btn" type="button" @click="ui.back()">Back</button>
        <h1 class="title">Account</h1>
      </header>

      <section v-if="!supabaseConfigured" class="panel">
        <h2 class="panel-title">Accounts unavailable</h2>
        <p class="muted">{{ accountsDisabledReason }}</p>
        <p class="dim">Guest play always works. Settings and arcade progress are saved on this device.</p>
      </section>

      <section v-else-if="loading" class="panel"><p class="muted">Loading…</p></section>

      <template v-else>
        <p v-if="err" class="acct-msg error" role="alert">{{ err }}</p>
        <p v-if="msg" class="acct-msg">{{ msg }}</p>

        <!-- Signed out -->
        <div v-if="!user" class="grid">
          <section class="panel stack">
            <h2 class="panel-title">Playing as a guest</h2>
            <p class="muted">Everything works without an account. Sign in to get a display name, rank points, wins and losses, and match history. Online matches are ranked when both players are signed in.</p>
          </section>
          <section class="panel stack">
            <h2 class="panel-title">Sign in</h2>
            <form class="stack" @submit.prevent="sendLink">
              <label class="field">
                <span class="label">Email (magic link)</span>
                <input v-model="email" class="input" type="email" autocomplete="email" placeholder="you@example.com" />
              </label>
              <button class="btn primary" type="submit" :disabled="busy">Send magic link</button>
            </form>
            <div class="btn-row">
              <button class="btn" type="button" :disabled="busy" @click="oauth('google')">Continue with Google</button>
              <button class="btn" type="button" :disabled="busy" @click="oauth('github')">Continue with GitHub</button>
            </div>
          </section>
        </div>

        <!-- Signed in -->
        <template v-else>
          <div class="grid">
            <section class="panel stack">
              <h2 class="panel-title">{{ profile ? 'Profile' : 'Create your profile' }}</h2>
              <p class="muted small">Signed in as {{ user.email || 'player' }}</p>
              <form class="stack" @submit.prevent="saveName">
                <label class="field">
                  <span class="label">Display name (3-20 characters)</span>
                  <input v-model="nameInput" class="input" maxlength="20" autocomplete="nickname" />
                </label>
                <span v-if="nameError" class="dim small">{{ nameError }}</span>
                <button class="btn primary" type="submit" :disabled="busy || !!nameError || !nameInput">
                  {{ profile ? 'Save name' : 'Create profile' }}
                </button>
              </form>
              <button class="btn ghost" type="button" :disabled="busy" @click="logout">Sign out</button>
            </section>

            <section v-if="profile" class="panel">
              <h2 class="panel-title">Stats</h2>
              <div class="stats">
                <div><span class="label">Rank points</span><strong class="big">{{ profile.rank_points }}</strong></div>
                <div><span class="label">Wins</span><strong class="big">{{ profile.wins }}</strong></div>
                <div><span class="label">Losses</span><strong class="big">{{ profile.losses }}</strong></div>
                <div><span class="label">Win rate</span><strong class="big">{{ winRate }}%</strong></div>
              </div>
            </section>
          </div>

          <div v-if="profile" class="grid">
            <section class="panel">
              <h2 class="panel-title">Recent matches</h2>
              <p v-if="dataLoading" class="muted">Loading…</p>
              <p v-else-if="!matches.length" class="muted">No ranked matches yet. Play an online match against a signed-in friend.</p>
              <ul v-else class="list">
                <li v-for="m in matches" :key="m.id" class="match-row">
                  <span class="badge" :class="m.result === 'win' ? 'good' : m.result === 'loss' ? 'bad' : ''">{{ m.result.toUpperCase() }}</span>
                  <span>{{ fighterName(m.myChar) }} <span class="dim">vs</span> {{ fighterName(m.oppChar) }}</span>
                  <span class="muted small">{{ m.oppName }}</span>
                  <span class="spacer" />
                  <span class="dim small">{{ fmtDate(m.date) }}</span>
                </li>
              </ul>
            </section>
            <section class="panel">
              <h2 class="panel-title">Character usage</h2>
              <p v-if="!usage.length" class="muted">No data yet.</p>
              <ul v-else class="list">
                <li v-for="u in usage" :key="u.char" class="match-row">
                  <img class="mini" :src="portrait(u.char, 96)" :alt="fighterName(u.char)" />
                  <strong>{{ fighterName(u.char) }}</strong>
                  <span class="spacer" />
                  <span class="muted small">{{ u.games }} games · {{ Math.round((u.wins / u.games) * 100) }}% wins</span>
                </li>
              </ul>
            </section>
          </div>
        </template>
      </template>
    </div>
  </div>
</template>

<style scoped>
.acct-msg {
  margin: 0;
  padding: 10px 14px;
  border-radius: 12px;
  border: 1px solid var(--line);
  background: rgba(34, 228, 255, 0.08);
}
.acct-msg.error {
  border-color: #ff2fa6;
  background: rgba(255, 47, 166, 0.12);
}
.small {
  font-size: 0.85em;
}
.stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}
.stats > div {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.big {
  font-family: var(--font-display);
  font-size: clamp(24px, 4vw, 34px);
  color: #22e4ff;
}
.match-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  min-height: 48px;
}
.mini {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  object-fit: cover;
  background: rgba(255, 255, 255, 0.06);
}
</style>
