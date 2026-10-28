<script setup>
import { onMounted, ref } from 'vue';
import { useUi } from '@/stores/ui.js';
import { supabaseConfigured, accountsDisabledReason } from '@/net/config.js';
import { fetchLeaderboard, getProfile } from '@/net/supabase.js';

const ui = useUi();
const rows = ref([]);
const loading = ref(false);
const error = ref('');
const myName = ref('');

async function load() {
  if (!supabaseConfigured || loading.value) return;
  loading.value = true;
  error.value = '';
  try {
    rows.value = (await fetchLeaderboard(100)) || [];
  } catch (e) {
    error.value = e.message || 'Could not load the leaderboard.';
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  load();
  if (supabaseConfigured) getProfile().then(p => { myName.value = p?.display_name || ''; }).catch(() => {});
});
</script>

<template>
  <div class="screen leaderboard">
    <div class="screen-inner">
      <header class="screen-header">
        <button class="back-btn" type="button" @click="ui.back()">Back</button>
        <h1 class="title">Leaderboard</h1>
        <span class="spacer" />
        <button v-if="supabaseConfigured" class="btn small" type="button" :disabled="loading" @click="load">Refresh</button>
      </header>

      <section v-if="!supabaseConfigured" class="panel">
        <h2 class="panel-title">Leaderboard unavailable</h2>
        <p class="muted">{{ accountsDisabledReason }}</p>
      </section>

      <section v-else class="panel">
        <p v-if="loading && !rows.length" class="muted">Loading top players…</p>
        <div v-else-if="error" class="stack">
          <p class="muted" role="alert">{{ error }}</p>
          <div class="btn-row"><button class="btn" type="button" @click="load">Try again</button></div>
        </div>
        <p v-else-if="!rows.length" class="muted">No ranked players yet. Sign in and win an online match to be first.</p>
        <div v-else class="table-wrap">
          <table class="lb">
            <thead>
              <tr><th>#</th><th class="name">Player</th><th>Points</th><th>W</th><th>L</th></tr>
            </thead>
            <tbody>
              <tr v-for="(r, i) in rows" :key="i" :class="{ me: myName && r.display_name === myName, top: i < 3 }">
                <td class="rank">{{ i + 1 }}</td>
                <td class="name">{{ r.display_name }}</td>
                <td class="pts">{{ r.rank_points }}</td>
                <td>{{ r.wins }}</td>
                <td>{{ r.losses }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.table-wrap {
  overflow-x: auto;
}
.lb {
  width: 100%;
  border-collapse: collapse;
  font-variant-numeric: tabular-nums;
}
.lb th,
.lb td {
  padding: 10px 8px;
  text-align: right;
  border-bottom: 1px solid var(--line);
}
.lb th {
  font-size: 0.75em;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--muted);
}
.lb .name {
  text-align: left;
  width: 100%;
  overflow-wrap: anywhere;
}
.lb .rank {
  font-family: var(--font-display);
  color: var(--muted);
}
.lb .pts {
  font-weight: 800;
  color: #22e4ff;
}
.lb tr.top .rank {
  color: #ff8a1f;
}
.lb tr.me td {
  background: rgba(34, 228, 255, 0.1);
}
</style>
