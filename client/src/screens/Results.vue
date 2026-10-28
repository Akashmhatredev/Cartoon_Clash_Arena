<script setup>
import { computed, ref } from 'vue';
import { useUi } from '@/stores/ui.js';
import { useMatch } from '@/stores/match.js';
import { useProgress } from '@/stores/progress.js';
import { fighter, fighterName } from '@/lib/fighters.js';
import { portrait } from '@/lib/portraits.js';
import { arcadeConfig, rematchConfig } from '@/lib/matchConfig.js';
import { useMenuNav } from '@/lib/menuNav.js';

const ui = useUi();
const match = useMatch();
const progress = useProgress();
const root = ref(null);
useMenuNav(root);

// Snapshot: the stores may change when the player continues.
const cfg = match.config ? JSON.parse(JSON.stringify(match.config)) : null;
const res = match.result ? JSON.parse(JSON.stringify(match.result)) : null;
const mode = cfg?.mode || 'versus';
const ids = cfg ? [cfg.p1, cfg.p2] : [];
const names = ids.map(fighterName);
const you = mode === 'online' ? (cfg?.online?.localSide ?? 0) : mode === 'arcade' ? 0 : null;
const w = res?.winner;
const draw = w !== 0 && w !== 1;
const outcome = res?.outcome;
const champion = outcome === 'champion';
const won = you != null && w === you;

const headline = champion ? 'Champion' : draw ? 'Draw' : you != null ? (won ? 'Victory' : 'Defeat') : `P${w + 1} Wins`;
const tone = champion || won || (you == null && !draw) ? 'win' : draw ? 'draw' : 'lose';
const heroSide = draw ? (you ?? 0) : w;
const heroId = ids[heroSide];
const heroAccent = fighter(heroId)?.palette?.primary || '#22e4ff';
const sideLabels = mode === 'versus' ? ['P1', 'P2'] : you === 1 ? ['Rival', 'You'] : mode === 'online' ? ['You', 'Rival'] : ['You', 'CPU'];

const rows = res
  ? [
      { label: 'Rounds won', v: res.wins },
      { label: 'Max combo', v: res.stats.maxCombo },
      { label: 'Damage dealt', v: res.stats.damage },
    ]
  : [];

const arcade = cfg?.arcade || null;
const next = computed(() => {
  const r = progress.run;
  if (!r || outcome !== 'next') return null;
  const rung = r.ladder[r.index];
  return rung ? { name: fighterName(rung.opponent), boss: !!rung.boss, index: r.index } : null;
});
const subline = computed(() => {
  if (!res) return 'No result to show.';
  if (mode === 'arcade') {
    if (champion) return `${names[0]} cleared Arcade on ${arcade?.difficulty || ''}!`;
    if (outcome === 'next' && next.value) return `Fight ${arcade.index + 1} cleared. Next up: ${next.value.boss ? 'the final boss, ' : ''}${next.value.name}.`;
    if (outcome === 'lost') return `${names[1]} stopped your run. Retry to keep climbing.`;
  }
  if (draw) return 'Nobody blinked.';
  return `${names[w]} takes the match ${res.wins[w]}–${res.wins[1 - w]}.`;
});
const clearsForHero = champion ? progress.clearsFor(ids[0]) : null;
const confetti = Array.from({ length: 18 }, (_, i) => i);

function retry() {
  if (progress.run) match.start(arcadeConfig(progress.run));
  else ui.go('select', { mode: 'arcade', p1: ids[0] });
}
function rematch() {
  match.start(rematchConfig(cfg));
}
function changeCharacters() {
  ui.go('select', { mode: 'versus', p1: cfg.p1, p2: cfg.p2, stage: cfg.stageChoice || 'random' });
}
</script>

<template>
  <div ref="root" class="screen results-screen" :class="['tone-' + tone, { champion }]">
    <div v-if="champion" class="confetti" aria-hidden="true">
      <i v-for="i in confetti" :key="i" :style="{ '--i': i }" />
    </div>

    <div class="results-wrap">
      <section class="hero" :style="{ '--accent': heroAccent }">
        <div class="hero-portrait">
          <img v-if="heroId" :src="portrait(heroId, 320)" alt="" draggable="false" />
          <svg v-if="champion" class="crown" viewBox="0 0 64 40" aria-hidden="true">
            <path d="M4 36 8 8l14 14L32 2l10 20L56 8l4 28z" fill="#ffd166" stroke="#7a3d00" stroke-width="3" stroke-linejoin="round" />
          </svg>
        </div>
        <p class="eyebrow">{{ mode === 'arcade' ? 'Arcade' : mode === 'online' ? 'Online match' : mode === 'versus' ? 'Local versus' : 'Match' }}</p>
        <h1 class="headline">{{ headline }}</h1>
        <p class="sub">{{ subline }}</p>
        <div v-if="champion && clearsForHero" class="clear-badges">
          <span class="badge good" :class="{ dimmed: !clearsForHero.easy }">Easy {{ clearsForHero.easy ? '✓' : '' }}</span>
          <span class="badge" :class="{ dimmed: !clearsForHero.normal }">Normal {{ clearsForHero.normal ? '✓' : '' }}</span>
          <span class="badge orange" :class="{ dimmed: !clearsForHero.hard }">Hard {{ clearsForHero.hard ? '✓' : '' }}</span>
        </div>
      </section>

      <section v-if="res" class="panel stats">
        <div class="stats-head">
          <span />
          <span v-for="s in [0, 1]" :key="s" class="who" :class="['s' + s, { winner: w === s }]">
            <img :src="portrait(ids[s], 96)" alt="" draggable="false" />
            <span>
              <b>{{ names[s] }}</b>
              <small>{{ sideLabels[s] }}</small>
            </span>
          </span>
        </div>
        <div v-for="r in rows" :key="r.label" class="stats-row">
          <span class="muted">{{ r.label }}</span>
          <b :class="{ lead: r.v[0] > r.v[1] }">{{ r.v[0] }}</b>
          <b :class="{ lead: r.v[1] > r.v[0] }">{{ r.v[1] }}</b>
        </div>
      </section>

      <div class="btn-row center actions">
        <template v-if="mode === 'arcade'">
          <template v-if="champion">
            <button type="button" class="btn primary" data-autofocus @click="ui.go('select', { mode: 'arcade', p1: ids[0] })">New Run</button>
            <button type="button" class="btn" @click="ui.go('menu')">Main Menu</button>
          </template>
          <template v-else-if="outcome === 'next'">
            <button type="button" class="btn primary" data-autofocus @click="ui.go('ladder')">Continue</button>
            <button type="button" class="btn" @click="ui.go('menu')">Quit</button>
          </template>
          <template v-else>
            <button type="button" class="btn primary" data-autofocus @click="retry">Retry</button>
            <button type="button" class="btn" @click="ui.go('ladder')">Ladder</button>
            <button type="button" class="btn" @click="ui.go('menu')">Quit</button>
          </template>
        </template>
        <template v-else-if="mode === 'versus' && cfg">
          <button type="button" class="btn primary" data-autofocus @click="rematch">Rematch</button>
          <button type="button" class="btn magenta" @click="changeCharacters">Change Characters</button>
          <button type="button" class="btn" @click="ui.go('menu')">Main Menu</button>
        </template>
        <template v-else-if="mode === 'online'">
          <button type="button" class="btn primary" data-autofocus @click="ui.go('online')">Back to Lobby</button>
        </template>
        <template v-else>
          <button type="button" class="btn primary" data-autofocus @click="ui.go('menu')">Main Menu</button>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.results-screen {
  align-items: center;
  justify-content: center;
}
.results-wrap {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 760px;
  margin: auto;
  display: flex;
  flex-direction: column;
  gap: var(--gap);
}
.hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 6px;
}
.hero-portrait {
  position: relative;
  width: clamp(110px, 22vw, 190px);
  aspect-ratio: 1;
  border-radius: 24px;
  border: 3px solid var(--accent);
  background: radial-gradient(circle at 50% 35%, color-mix(in srgb, var(--accent) 50%, transparent), transparent 70%), var(--bg-1);
  box-shadow: 0 0 40px color-mix(in srgb, var(--accent) 45%, transparent);
  margin-bottom: 8px;
  animation: hero-in 0.6s var(--ease) both;
}
.hero-portrait img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 21px;
}
.tone-lose .hero-portrait {
  filter: saturate(0.6);
}
.crown {
  position: absolute;
  width: 46%;
  left: 27%;
  top: -24%;
  filter: drop-shadow(0 0 14px rgba(255, 209, 102, 0.9));
  animation: crown 1.6s ease-in-out infinite alternate;
}
@keyframes crown {
  to {
    transform: translateY(-5px) rotate(-4deg);
  }
}
@keyframes hero-in {
  from {
    opacity: 0;
    transform: scale(0.85) translateY(10px);
  }
}
.headline {
  font-family: var(--font-display);
  font-size: clamp(44px, 1rem + 7vw, 104px);
  line-height: 0.95;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  animation: headline-in 0.5s var(--ease) 0.1s both;
}
.tone-win .headline {
  color: var(--gold);
  text-shadow:
    0 0 26px rgba(255, 138, 31, 0.7),
    4px 4px 0 var(--magenta);
}
.tone-lose .headline {
  color: #c9d3f0;
  text-shadow:
    0 0 22px rgba(255, 47, 166, 0.5),
    4px 4px 0 #3a1030;
}
.tone-draw .headline {
  color: var(--cyan);
  text-shadow:
    0 0 22px rgba(34, 228, 255, 0.6),
    4px 4px 0 var(--blue);
}
.champion .headline {
  background: linear-gradient(180deg, #fff6d6, var(--gold) 45%, var(--orange));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  text-shadow: none;
  filter: drop-shadow(0 0 22px rgba(255, 138, 31, 0.7)) drop-shadow(4px 4px 0 #5a0d3a);
}
@keyframes headline-in {
  from {
    opacity: 0;
    transform: scale(1.3);
    letter-spacing: 0.2em;
  }
}
.sub {
  font-size: var(--fs-md);
  color: var(--muted);
  max-width: 520px;
}
.clear-badges {
  display: flex;
  gap: 8px;
  margin-top: 6px;
}
.dimmed {
  opacity: 0.35;
}
.stats {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.stats-head,
.stats-row {
  display: grid;
  grid-template-columns: 1.2fr 1fr 1fr;
  align-items: center;
  gap: 10px;
}
.stats-head {
  padding-bottom: 10px;
  border-bottom: 1px solid var(--line);
  margin-bottom: 4px;
}
.who {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.who img {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  object-fit: cover;
  border: 2px solid var(--p1);
  background: var(--bg-1);
}
.who.s1 img {
  border-color: var(--p2);
  transform: scaleX(-1);
}
.who span {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.who b {
  font-weight: 800;
  font-size: var(--fs-sm);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.who small {
  font-size: var(--fs-xs);
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}
.who.winner b {
  color: var(--gold);
}
.stats-row {
  padding: 8px 0;
}
.stats-row b {
  font-family: var(--font-display);
  font-weight: 400;
  font-size: var(--fs-lg);
}
.stats-row b.lead {
  color: var(--cyan);
  text-shadow: 0 0 12px rgba(34, 228, 255, 0.5);
}
.actions .btn {
  min-width: 160px;
}
.confetti {
  position: fixed;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
  z-index: 0;
}
.confetti i {
  position: absolute;
  top: -20px;
  left: calc(var(--i) * 5.6% + 2%);
  width: 10px;
  height: 18px;
  border-radius: 2px;
  background: var(--orange);
  opacity: 0.85;
  animation: fall calc(2.6s + (var(--i) * 0.13s)) linear infinite;
  animation-delay: calc(var(--i) * -0.37s);
}
.confetti i:nth-child(3n) {
  background: var(--cyan);
}
.confetti i:nth-child(3n + 1) {
  background: var(--magenta);
}
.confetti i:nth-child(4n) {
  background: var(--gold);
}
@keyframes fall {
  to {
    transform: translateY(110vh) rotate(720deg);
  }
}
@media (max-width: 520px) {
  .actions .btn {
    flex: 1 1 100%;
  }
  .stats-head,
  .stats-row {
    grid-template-columns: 1fr 1fr 1fr;
  }
  .who img {
    display: none;
  }
}
</style>
