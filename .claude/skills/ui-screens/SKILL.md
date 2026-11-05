---
name: ui-screens
description: Vue 3 + Pinia front end of Cartoon Clash: screens (menu, character select, arcade ladder, fight, results, settings, online lobby, account, leaderboard), HUD, move list, touch controls, navigation store, match/settings/progress stores, the retro-neon CSS system, fonts, responsive and touch rules, and the Fight.vue to FightScene hooks API. Use this for any menu or HUD change, "add a screen", "add a setting", key rebinding, gamepad or touch options, layout bugs on phones, localStorage persistence, toasts, or wiring a new flow from menus into a match.
---

# UI screens

Menus are Vue components switched by the `ui` store; the fight itself is a Phaser canvas hosted by `Fight.vue` with Vue overlays (HUD, pause menu, training panel, touch controls, move list). Keep Vue reactivity out of the per-frame loop: the scene pushes to the HUD through a plain function API, never through reactive props per frame.

## Navigation and stores (`client/src/stores`)

- `useUi()`: `screen`, `params`, `history`, `nav`, `toasts`. `go(screen, params)` pushes the current screen on the back stack unless it is transient (`fight`, `results`); `go('menu')` clears history; `back()` pops; `toast(text, kind = 'info', ms)`. Screens: `menu select ladder fight results settings online account leaderboard`. `App.vue` maps them in `SCREEN_COMPONENTS` and lazy-loads `Fight`, `OnlineLobby`, `Account`, `Leaderboard` so the menu bundle stays small.
- `useMatch()`: `start(config)` deep-copies the config and goes to `fight`; `finish(result)` normalizes `{ winner, wins, stats, outcome }`, records arcade/versus progress and goes to `results`; `clear()`.
- `useSettings()` (persisted `cc.settings.v1`): `volume, muted, cleanMode, perfMode auto|on|off, showDebug, keymaps { p1, p2 }, touch auto|on|off, gamepad { enabled, swap }, playerName`. Actions `bindKey(player, action, code)` (swaps duplicates, refuses `Escape` and `F3`), `resetKeys`, `resetAll`; getters `codeLookup` (event.code → player/action for menu navigation) and `displayName`.
- `useProgress()` (persisted `cc.progress.v1`): `clears`, `run` (current arcade ladder), `stats`, `last` picks per mode; `startRun`, `abandonRun`, `recordMatch(cfg, result)` returning `next | champion | lost | done`, `remember(mode, picks)`.
- Persistence: `persistStore(store, key)` in `main.js` subscribes and writes debounced JSON; `loadJSON`/`saveJSON` guard private mode and quota. New stores sanitize what they load (see `sanitize()` in each store) because old saves may be malformed.

## Building a match config

Use `client/src/lib/matchConfig.js`: `arcadeConfig(run)`, `versusConfig({ p1, p2, stage })`, `trainingConfig({ p1, dummy, stage, dummyMode, infiniteMeter })`, `rematchConfig(cfg)`, `resolveStage('random')`, `randomSeed()`. Online configs are built in `OnlineLobby.vue` from the server's `start` message with `controllers: localSide === 0 ? ['p1', 'net'] : ['net', 'p1']`.

## Fight.vue ↔ FightScene

`createGame(host, { config, settings, hooks })` from `client/src/game/createGame.js`. Hooks the scene calls: `onReady(api)`, `onMatchEnd(result)`, `onDebug(fps, ping, drift, perf, res)`, `onToast(msg)`, `onError(err)`, and `hooks.hud = { update(state, stats), reset() }` supplied by `HUD.vue` (`emit('ready', api)`). The scene API: `setPaused(bool)` (offline only), `setInputLocked(bool)` (online pause menu), `restart()`, `setTraining({ dummyMode, infiniteMeter })`, `localSide`, `online`. `Esc`/`P` pause, `F3` toggles debug, visibility change and portrait rotation auto-pause offline matches. Always call `ctl.destroy()` on unmount.

## CSS system (`client/src/styles/base.css`)

Variables: `--surface --line --cyan --blue --orange --magenta --text --muted --dim --good --bad --gold`, fonts `--font-display` (Bungee) and `--font-body` (Inter), radii `--r-sm --r --r-lg`, `--tap: 48px`, fluid `--gap --pad`, type scale `--fs-xs .. --fs-hero`, glows `--glow-cyan --glow-magenta --glow-orange`, `--shadow`, safe areas `--safe-t/r/b/l`, `--ease`.

Classes: layout `.screen .screen-inner .screen-header .panel .panel.neon .panel-title .grid .list .row .row.between .row.wrap .divider`; type `.title .subtitle .eyebrow .label .muted .dim .neon-cyan .neon-magenta .neon-orange .kbd`; controls `.btn .btn.primary .btn.ghost .btn.danger .btn.magenta .btn.small .btn.block .btn:disabled .btn-row .btn-row.center .back-btn .icon-btn .seg .chip .input .field .range`; feedback `.badge .badge.good .badge.bad .badge.gold .badge.blue .badge.magenta .badge.orange`; transitions `screen`, `fade`, `pop`; `.scanlines` (hidden in clean mode), `.app-bg`.

Use these before writing new CSS. Component-scoped styles are fine for layout specific to one screen.

## Responsive and input rules

- Menus work in phone portrait; the fight is landscape (`Fight.vue` pauses on portrait rotation for offline modes and offers fullscreen with orientation lock).
- Touch targets at least `var(--tap)` (48 px); `touch-action: none` in the fight; multi-touch handled by `TouchControls.vue` writing `touchInput.mask`; safe-area insets on fixed overlays.
- Keyboard navigation in menus goes through `lib/menuNav.js` and `settings.codeLookup`; gamepads are polled in the fight only.
- Prevent browser defaults for bound keys and arrows (`input/keyboard.js`), block pinch and double-tap zoom (`main.js`).
- Disabled features must say why: Online, Account and Leaderboard buttons read `onlineDisabledReason` / `accountsDisabledReason` from `net/config.js`.
- Sounds: buttons get click sounds by delegation (`.btn` confirm, `.back-btn` back, others select); set `data-sfx` to override or `data-sfx="none"`.

## Checklist: add a screen

1. Create `client/src/screens/<Name>.vue` using `.screen`, `.panel`, `.btn` and the back button pattern from `Settings.vue`.
2. Add the id to `SCREENS` in `stores/ui.js` and the component to `SCREEN_COMPONENTS` in `App.vue` (use `defineAsyncComponent` if it pulls heavy code).
3. Navigate with `ui.go('<id>', params)`; read `ui.params` on mount; call `ui.back()` for the back button.
4. If it starts a match, build the config with `matchConfig.js` helpers and call `useMatch().start(config)`; handle `Results.vue` return paths (`ui.go` targets after results).
5. Test with keyboard only, with a gamepad, and on a narrow viewport (DevTools device mode) in both orientations.

## Checklist: add a setting

1. Add the field with a default in `defaults()` and a validation line in `sanitize()` in `stores/settings.js`.
2. Add the control to `Settings.vue` (reuse `.seg` for tri-state, `.range` for sliders).
3. Consume it where needed: `Fight.vue settingsSnapshot()` passes a plain copy to the scene; `App.vue` watches app-wide ones (volume, mute, clean mode).
