<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useUi } from '@/stores/ui.js';
import { useMatch } from '@/stores/match.js';
import { useSettings } from '@/stores/settings.js';
import { FIGHTER_IDS, STAGES } from '@shared/index.js';
import { ROOM_CODE_LEN, isValidRoomCode, normalizeRoomCode } from '@shared/protocol.js';
import { portrait } from '@/lib/portraits.js';
import { fighterName, stageName } from '@/lib/fighters.js';
import { onlineConfigured, onlineDisabledReason, supabaseConfigured } from '@/net/config.js';
import { getSession, getStoredRoom } from '@/net/session.js';
import { getAccessToken } from '@/net/supabase.js';

const LAST_CHAR_KEY = 'cc.net.char';
const ui = useUi();
const matchStore = useMatch();
const settings = useSettings();
const session = onlineConfigured ? getSession() : null;

const lobby = ref(session?.lobby || null);
const conn = ref(session?.status || 'idle');
const ping = ref(session?.ping || 0);
const lastResult = ref(session?.lastResult || null);
const rankUpdate = ref(session?.rankUpdate || null);
const joinCode = ref('');
const busy = ref(false);
const error = ref('');
const notice = ref('');
const copied = ref(false);
const signedIn = ref(false);

const roster = FIGHTER_IDS.map(id => ({ id, name: fighterName(id), img: portrait(id, 160) }));
const stageOptions = STAGES.filter(s => s.id !== 'final');

const side = computed(() => lobby.value?.side ?? session?.side ?? null);
const inRoom = computed(() => !!lobby.value && !!session?.inRoom);
const me = computed(() => (lobby.value && side.value != null ? lobby.value.players[side.value] : null));
const opp = computed(() => (lobby.value && side.value != null ? lobby.value.players[1 - side.value] : null));
const isHost = computed(() => !!lobby.value && lobby.value.hostSide === side.value);
const inMatch = computed(() => lobby.value?.phase === 'match');
const reconnecting = computed(() => conn.value === 'reconnecting' || conn.value === 'connecting');
const isRematch = computed(() => !!lastResult.value && (lobby.value?.matchNo || 0) > 0);

const statusText = computed(() => {
  if (!lobby.value) return '';
  if (reconnecting.value) return 'Reconnecting…';
  if (inMatch.value) return 'Match in progress…';
  if (!opp.value) return 'Waiting for an opponent. Share the room code.';
  if (!opp.value.connected) return `${opp.value.name} disconnected. Holding their slot…`;
  if (!me.value?.char) return 'Pick your fighter.';
  if (!me.value.ready) return isRematch.value ? 'Press Rematch when you are ready.' : 'Press Ready when you are set.';
  if (!opp.value.ready) return `Waiting for ${opp.value.name} to ready up…`;
  return 'Both ready. Starting…';
});

const resultText = computed(() => {
  const r = lastResult.value;
  if (!r || side.value == null) return '';
  if (r.reason === 'aborted') return 'The last match was interrupted by a server restart.';
  const base = r.winner === 'draw' || r.winner == null ? 'Last match: draw' : r.winner === side.value ? 'Last match: you won' : 'Last match: you lost';
  return r.reason === 'forfeit' ? `${base} (forfeit)` : `${base} ${r.wins?.[side.value] ?? 0}-${r.wins?.[1 - side.value] ?? 0}`;
});

const rankText = computed(() => {
  const d = rankUpdate.value;
  if (!d || !d.points || side.value == null) return '';
  const delta = d.delta?.[side.value];
  return `Rank points: ${d.points[side.value]}${delta != null ? ` (${delta >= 0 ? '+' : ''}${delta})` : ''}`;
});

function savedChar() {
  try { const c = localStorage.getItem(LAST_CHAR_KEY); return FIGHTER_IDS.includes(c) ? c : null; } catch { return null; }
}

async function identity() {
  const auth = supabaseConfigured ? await getAccessToken() : null;
  signedIn.value = !!auth;
  return { name: settings.displayName || 'Player', auth, char: savedChar() };
}

function showError(e) {
  error.value = e?.message || String(e || 'Something went wrong.');
}

async function createRoom() {
  if (busy.value) return;
  busy.value = true;
  error.value = '';
  notice.value = '';
  try {
    await session.create(await identity());
  } catch (e) {
    showError(e);
  } finally {
    busy.value = false;
  }
}

async function joinRoom(code = joinCode.value) {
  if (busy.value) return;
  const c = normalizeRoomCode(code);
  if (!isValidRoomCode(c)) {
    error.value = `Room codes are ${ROOM_CODE_LEN} letters or digits.`;
    return;
  }
  busy.value = true;
  error.value = '';
  notice.value = '';
  try {
    await session.join(c, await identity());
  } catch (e) {
    showError(e);
  } finally {
    busy.value = false;
  }
}

function onCodeInput(e) {
  joinCode.value = normalizeRoomCode(e.target.value).replace(/[^A-Z0-9]/g, '').slice(0, ROOM_CODE_LEN);
}

function pick(id) {
  if (!me.value || me.value.ready || inMatch.value) return;
  session.selectCharacter(id);
  try { localStorage.setItem(LAST_CHAR_KEY, id); } catch { /* ignore */ }
}

function toggleReady() {
  if (!me.value) return;
  if (!me.value.ready && isRematch.value) {
    lastResult.value = null;
    rankUpdate.value = null;
    session.requestRematch();
  } else session.setReady(!me.value.ready);
}

function setStage(e) {
  session.setStage(e.target.value || null);
}

async function copyCode() {
  const code = lobby.value?.code;
  if (!code) return;
  try {
    await navigator.clipboard.writeText(code);
    copied.value = true;
    setTimeout(() => (copied.value = false), 1500);
  } catch {
    notice.value = `Room code: ${code}`;
  }
}

function leave() {
  session?.leave();
  lobby.value = null;
  lastResult.value = null;
  rankUpdate.value = null;
  notice.value = '';
}

function goBack() {
  if (session?.inRoom) leave();
  ui.go('menu');
}

function startMatch(si) {
  matchStore.start({
    mode: 'online',
    p1: si.p1,
    p2: si.p2,
    stage: si.stage,
    roundsToWin: si.roundsToWin,
    controllers: si.side === 0 ? ['p1', 'net'] : ['net', 'p1'],
    online: { localSide: si.side, startInfo: si },
  });
}

const offs = [];
onMounted(() => {
  if (!session) return;
  offs.push(
    session.on('lobby', l => { lobby.value = l; conn.value = session.status; }),
    session.on('start', si => startMatch(si)),
    session.on('end', r => { lastResult.value = r; }),
    session.on('ranked', () => { rankUpdate.value = session.rankUpdate; }),
    session.on('ping', ms => { ping.value = ms; conn.value = session.status; }),
    session.on('error', e => { error.value = e.message; }),
    session.on('close', info => {
      conn.value = session.status;
      if (!info.willReconnect) {
        lobby.value = null;
        if (info.reason && info.reason !== 'left') error.value = info.reason;
      }
    }),
  );
  // A start that arrived while no screen was listening (e.g. resume after reconnect).
  if (session.pendingStart && session.driverMatch !== session.pendingStart.match) return startMatch(session.pendingStart);
  if (!session.inRoom) {
    const stored = getStoredRoom();
    if (stored) {
      notice.value = `Rejoining room ${stored.code}…`;
      joinRoom(stored.code).then(() => { notice.value = ''; });
    }
  }
  if (supabaseConfigured) getAccessToken().then(t => { signedIn.value = !!t; });
});

onBeforeUnmount(() => {
  // Keep the session alive: the fight screen and "Back to Lobby" reuse it.
  for (const off of offs) off();
  offs.length = 0;
});
</script>

<template>
  <div class="screen online-lobby">
    <div class="screen-inner">
      <header class="screen-header">
        <button class="back-btn" type="button" @click="goBack">Back</button>
        <h1 class="title">Online</h1>
        <span class="spacer" />
        <span v-if="inRoom" class="badge" :class="reconnecting ? 'orange' : 'good'">
          {{ reconnecting ? 'Reconnecting' : `Online · ${ping} ms` }}
        </span>
      </header>

      <section v-if="!onlineConfigured" class="panel">
        <h2 class="panel-title">Online play unavailable</h2>
        <p class="muted">{{ onlineDisabledReason }}</p>
        <p class="dim">Training, Arcade and Local Versus work offline.</p>
      </section>

      <template v-else>
        <p v-if="error" class="lobby-msg error" role="alert">{{ error }}</p>
        <p v-if="notice" class="lobby-msg">{{ notice }}</p>

        <!-- Not in a room yet -->
        <div v-if="!inRoom" class="grid">
          <section class="panel stack">
            <h2 class="panel-title">Create a private room</h2>
            <p class="muted">You get a short code to share with a friend. Best of 3.</p>
            <label class="field">
              <span class="label">Your name</span>
              <input v-model="settings.playerName" class="input" maxlength="16" placeholder="Player" autocomplete="nickname" />
            </label>
            <button class="btn primary" type="button" :disabled="busy" @click="createRoom">
              {{ busy ? 'Connecting…' : 'Create room' }}
            </button>
          </section>
          <section class="panel stack">
            <h2 class="panel-title">Join with a code</h2>
            <form class="stack" @submit.prevent="joinRoom()">
              <input
                class="input code-input"
                :value="joinCode"
                :maxlength="ROOM_CODE_LEN"
                placeholder="ABCDE"
                autocapitalize="characters"
                autocomplete="off"
                spellcheck="false"
                aria-label="Room code"
                @input="onCodeInput"
              />
              <button class="btn" type="submit" :disabled="busy || joinCode.length !== ROOM_CODE_LEN">Join room</button>
            </form>
            <p class="dim small">
              {{ signedIn ? 'Signed in: matches against another signed-in player are ranked.' : 'Playing as a guest (unranked). Sign in from Account to rank up.' }}
            </p>
          </section>
        </div>

        <!-- In a room -->
        <template v-else>
          <section class="panel room-head">
            <div class="stack">
              <span class="eyebrow">Room code</span>
              <button class="room-code" type="button" title="Copy code" @click="copyCode">{{ lobby.code }}</button>
              <span class="dim small">{{ copied ? 'Copied!' : 'Tap the code to copy it' }}</span>
            </div>
            <div class="stack status-col">
              <p class="status">{{ statusText }}</p>
              <p v-if="resultText" class="muted">{{ resultText }}</p>
              <p v-if="rankText" class="muted">{{ rankText }}</p>
              <span class="badge" :class="lobby.ranked ? 'gold' : ''">{{ lobby.ranked ? 'Ranked match' : 'Unranked' }}</span>
            </div>
          </section>

          <section class="panel">
            <h2 class="panel-title">Players</h2>
            <ul class="list players">
              <li v-for="(p, i) in lobby.players" :key="i" class="player" :class="{ me: i === side }">
                <template v-if="p">
                  <img v-if="p.char" class="mini" :src="portrait(p.char, 96)" :alt="fighterName(p.char)" />
                  <span v-else class="mini empty">?</span>
                  <div class="stack tight">
                    <strong>{{ p.name }}<span v-if="i === side" class="dim"> (you)</span><span v-if="i === lobby.hostSide" class="dim"> · host</span></strong>
                    <span class="muted small">{{ p.char ? fighterName(p.char) : 'Choosing…' }}</span>
                  </div>
                  <span class="spacer" />
                  <span class="badge" :class="p.connected ? 'blue' : 'bad'">{{ p.connected ? `${p.ping || '–'} ms` : 'offline' }}</span>
                  <span class="badge" :class="p.ready ? 'good' : ''">{{ p.ready ? 'Ready' : 'Not ready' }}</span>
                </template>
                <span v-else class="muted">Open slot: waiting for a player…</span>
              </li>
            </ul>
          </section>

          <section class="panel">
            <div class="row between wrap">
              <h2 class="panel-title">Choose your fighter</h2>
              <label v-if="isHost" class="field stage-pick">
                <span class="label">Stage</span>
                <select class="input" :value="lobby.stage || ''" :disabled="inMatch" @change="setStage">
                  <option value="">Random home stage</option>
                  <option v-for="s in stageOptions" :key="s.id" :value="s.id">{{ s.name }}</option>
                </select>
              </label>
              <span v-else class="muted small">Stage: {{ lobby.stage ? stageName(lobby.stage) : 'random home stage' }}</span>
            </div>
            <div class="char-grid">
              <button
                v-for="f in roster"
                :key="f.id"
                type="button"
                class="char"
                :class="{ picked: me?.char === f.id, opp: opp?.char === f.id }"
                :disabled="!me || me.ready || inMatch"
                @click="pick(f.id)"
              >
                <img v-if="f.img" :src="f.img" :alt="f.name" />
                <span>{{ f.name }}</span>
              </button>
            </div>
          </section>

          <div class="btn-row">
            <button class="btn danger" type="button" @click="leave">Leave room</button>
            <span class="spacer" />
            <button
              class="btn primary"
              type="button"
              :disabled="!me?.char || inMatch || reconnecting"
              @click="toggleReady"
            >
              {{ me?.ready ? 'Cancel ready' : isRematch ? 'Rematch' : 'Ready' }}
            </button>
          </div>
        </template>
      </template>
    </div>
  </div>
</template>

<style scoped>
.lobby-msg {
  margin: 0;
  padding: 10px 14px;
  border-radius: 12px;
  border: 1px solid var(--line);
  background: rgba(34, 228, 255, 0.08);
}
.lobby-msg.error {
  border-color: #ff2fa6;
  background: rgba(255, 47, 166, 0.12);
}
.code-input {
  font-family: var(--font-display);
  font-size: clamp(22px, 5vw, 32px);
  letter-spacing: 0.3em;
  text-align: center;
  text-transform: uppercase;
}
.room-head {
  display: flex;
  flex-wrap: wrap;
  gap: 18px 32px;
  align-items: center;
}
.room-code {
  font-family: var(--font-display);
  font-size: clamp(40px, 9vw, 72px);
  letter-spacing: 0.18em;
  color: #22e4ff;
  text-shadow: 0 0 18px rgba(34, 228, 255, 0.55);
  background: none;
  border: 2px dashed rgba(34, 228, 255, 0.45);
  border-radius: 16px;
  padding: 4px 18px;
  cursor: pointer;
  min-height: 48px;
}
.status-col {
  flex: 1 1 240px;
}
.status {
  margin: 0;
  font-weight: 700;
  font-size: 1.1em;
}
.small {
  font-size: 0.85em;
}
.tight {
  gap: 2px;
}
.player {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  padding: 8px 10px;
  border-radius: 12px;
  border: 1px solid var(--line);
  min-height: 64px;
}
.player.me {
  border-color: rgba(34, 228, 255, 0.6);
}
.mini {
  width: 48px;
  height: 48px;
  border-radius: 10px;
  object-fit: cover;
  background: rgba(255, 255, 255, 0.06);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.stage-pick {
  min-width: 200px;
}
.char-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(clamp(84px, 18vw, 120px), 1fr));
  gap: 10px;
  margin-top: 10px;
}
.char {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 8px 6px;
  min-height: 48px;
  border-radius: 14px;
  border: 2px solid var(--line);
  background: rgba(13, 21, 48, 0.7);
  color: inherit;
  font: inherit;
  font-size: 0.85em;
  font-weight: 700;
  cursor: pointer;
  transition: transform 0.12s, border-color 0.12s, box-shadow 0.12s;
}
.char img {
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  border-radius: 10px;
}
.char:hover:not(:disabled) {
  transform: translateY(-2px);
  border-color: #2f6bff;
}
.char.picked {
  border-color: #22e4ff;
  box-shadow: 0 0 16px rgba(34, 228, 255, 0.5);
}
.char.opp:not(.picked) {
  border-color: #ff8a1f;
}
.char:disabled {
  cursor: default;
  opacity: 0.75;
}
.char.picked:disabled {
  opacity: 1;
}
</style>
