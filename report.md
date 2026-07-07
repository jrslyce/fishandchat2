# Fish and Chat — Build Report

Living report, updated per phase. See [plan.md](plan.md) for the full implementation plan.

---

## Skill-Loading Ledger

| Skill | Loaded | Path |
|---|---|---|
| threejs-gameplay-systems | yes | `~/.claude/skills/threejs-gameplay-systems/SKILL.md` |
| threejs-aaa-graphics-builder | no (not yet — Phase 4) | — |
| threejs-game-ui-designer | no (not yet — Phase 5) | — |
| threejs-debug-profiler | no (not yet — Phase 6) | — |
| threejs-qa-release | no (not yet — Phase 6) | — |
| threejs-3d-generator | yes | `~/.claude/skills/threejs-3d-generator/SKILL.md` |
| threejs-image-generator | yes | `~/.claude/skills/threejs-image-generator/SKILL.md` |
| threejs-audio-generator | yes | `~/.claude/skills/threejs-audio-generator/SKILL.md` |

## Reference Ledger

| Reference | Loaded | Path | Notes |
|---|---|---|---|
| Gameplay workflows | yes | `~/.claude/skills/threejs-gameplay-systems/references/gameplay-workflows.md` | Loaded Phase 1, applies through Phase 2 (mechanics/entities/feedback still in scope). |
| Physics engine selection | not-needed | — | No rigid-body physics; casting/bite timing and market/crafting are custom arcade state-machine logic, no collision simulation. |
| New-game definition-of-done | yes | `~/.claude/skills/threejs-gameplay-systems/references/checklists/new-game-definition-of-done.md` | |
| 3D generator API notes | yes | `~/.claude/skills/threejs-3d-generator/references/api-notes.md` | |
| 3D generator Three.js integration | yes | `~/.claude/skills/threejs-3d-generator/references/threejs-integration.md` | |
| 3D/image generator workflows | yes | `~/.claude/skills/threejs-3d-generator/references/image-generator-workflows.md` | |
| Audio workflows | yes | `~/.claude/skills/threejs-audio-generator/references/audio-workflows.md` | |

## External Asset Sourcing Ledger

Not started — Phase 3. Credential probe was run and confirmed working prior to this build (see below); no generation calls made yet in Phase 1.

```
TRIPO_API_KEY=SET
GEMINI_API_KEY=SET
ELEVENLABS_API_KEY=SET
```

## Phase Ledger

| Phase | Status | Evidence |
|---|---|---|
| 1. Scaffold & project setup | **done** | See below |
| 2. Core gameplay loop | **done** | See below |
| 3. External asset generation | **done** | See below |
| 4. Voxel world & graphics polish | **done** (premium gate not yet passed — UI/HUD is Phase 5's scope, see scorecard) | See below |
| 5. UI/HUD | **done** (average score just under premium threshold — one genre-mismatched category, see scorecard) | See below |
| 6. Debug, QA & release | pending | — |

---

## Phase 1 — Scaffold & Project Setup

### What was built

- Scaffolded via `threejs-gameplay-systems`' packaged `create_threejs_game.py` into `fish-and-chat/`.
- Kept from the scaffold: `core/Loop.ts`, `core/Renderer.ts` (ACES tonemapping, PCF shadows, DPR-capped resize), `utils/dispose.ts`, the Playwright/Vite/TS config, and `scripts/inspect-threejs-canvas.mjs`.
- Removed all demo-specific gameplay (`entities/Player.ts`, `entities/Pickup.ts`, `systems/CollisionSystem.ts`, `systems/Hud.ts`, `systems/AudioSystem.ts`, `systems/CameraRig.ts`, `systems/DebugTools.ts`) since they were tied to the scaffold's top-down collector demo (WASD player, dash, relay pickups) which has nothing to do with the fishing loop.
- Added new core plumbing ahead of Phase 2:
  - `core/EventBus.ts` — small typed pub/sub, generic `EventMap` constraint (relaxed to `object` to satisfy TS strict mode with fixed-key event maps).
  - `core/SaveManager.ts` — versioned localStorage save/load under key `fish-and-chat-save-v1`.
  - `core/AudioEngine.ts` — gesture-unlock + mix-group skeleton (master/sfx/ambience volumes + mute); no real clip playback yet, that's Phase 3.
  - `core/CameraRig.ts` — fixed 3/4-orbit diorama camera with a slow idle drift and a `focusOn()` hook for later systems (bobber, catch card, market stall) to nudge framing.
  - `core/InputController.ts` — rewritten from joystick+dash to a single unified action intent (Space/Enter/click/tap) with press/release edges and hold-duration, matching the GDD's one-button cast-lock/bite-react loop.
- `game/SaveState.ts` — placeholder save shape (`coins`, `level`, `xp`) for the Phase 1 round-trip smoke test; Phase 2's `game/data.ts` replaces this with the full economy/progression state.
- `game/Game.ts` — placeholder pond diorama (island block, water disc, dock post) under the new CameraRig, wired to InputController/EventBus/AudioEngine, runs a save/load round-trip smoke test on startup, publishes `window.__THREE_GAME_DIAGNOSTICS__`.
- Created empty `world/`, `assets/`, `ui/` directories completing the planned architecture skeleton (`core/ game/ entities/ systems/ world/ assets/ ui/`).
- Rewrote `index.html`/`styles.css` to drop the joystick/dash/relay-HUD demo markup in favor of a single `#action-button` ("Cast") and a placeholder status line.
- Rewrote `tests/visual.spec.ts` to match the new diagnostics shape and action-button interaction instead of WASD movement assertions.
- `.claude/launch.json` created at the project root so preview tooling can launch the dev server (`npm run dev --prefix fish-and-chat`, port 5188 — corrected from the plan's guessed 5173 to the scaffold's actual Vite port).

### Bug found and fixed during verification

The first wiring of `Game.ts` had a single `'action'` event emitted on both press and release, with one listener setting `state = 'action'` unconditionally. On release, the code set `state = 'idle'` and then emitted `'action'` again, whose listener immediately overwrote it back to `'action'` — release never reached idle. Caught by manually driving `pointerdown`/`pointerup` in the browser and inspecting `window.__THREE_GAME_DIAGNOSTICS__.state` between frames. Fixed by splitting into distinct `actionPressed`/`actionReleased` events with explicit state assignment per transition.

### Verification evidence

- `npm install` — clean (67 packages; 1 pre-existing high-severity advisory from the scaffold's dependency tree, not investigated, unrelated to this change).
- `npm run build` (`tsc && vite build`) — clean, no type errors.
- `npm run dev` via `.claude/launch.json` preview — canvas renders non-blank on desktop (1280-class viewport: 3 draw calls, 56 triangles, `frame` counter incrementing) and mobile (375×812, screenshot confirms visible diorama + Cast button, no console errors).
- Manual press/release cycle verified via `preview_eval`: `state` transitions `idle → action → idle` correctly after the bug fix.
- `npm run test` (Playwright, desktop-chrome + mobile-safari projects) — **2/2 passed**: nonblank-canvas sampling, action-button press/release state transition, zero console/page errors.
- `[SaveManager] round-trip check` logged on every load: reads default state, writes an incremented probe, reads it back — confirms localStorage persistence path works end to end.

### New-game definition-of-done checklist

- [x] `npm install` succeeds.
- [x] `npm run dev` starts a local Vite server (port 5188).
- [x] `npm run build` completes.
- [x] First screen is the game canvas, not a landing page.
- [x] Player can interact within 5 seconds (Cast button is immediately visible/clickable).
- [~] Clear objective/score/fail condition — **not yet**; this is a placeholder scene, the real loop/objective lands in Phase 2. Recorded as expected, not a gap.
- [x] Keyboard/mouse input works on desktop (Space/Enter/click all trigger the action intent).
- [x] Touch/pointer input works (verified via pointerdown/up on `#action-button`, and Playwright's mobile-safari project).
- [x] Camera frames the playable area at desktop and mobile sizes.
- [~] HUD text readable — only a placeholder status line exists; real HUD is Phase 5.
- [x] Browser console has no blocking errors.
- [x] Screenshot proves the canvas rendered (desktop + mobile, see above).
- [x] Canvas-pixel check proves non-blank (Playwright variance/color-bucket sampling passed).

### Known placeholder-quality items (intentional, deferred)

- Camera framing looks down mostly at the island top with only a sliver of pond visible — acceptable for a Phase 1 smoke-test scene; Phase 4 replaces the whole scene with the authored VoxelKit diorama and will retune the rig.
- No real gameplay loop, HUD, or audio yet — by design, scoped to Phase 2/5/3 respectively.
- 1 pre-existing `npm audit` high-severity advisory inherited from the scaffold's dependency tree; not investigated in this phase (not introduced by this work, and no new dependencies were added).

### Files changed

New: `src/core/EventBus.ts`, `src/core/SaveManager.ts`, `src/core/AudioEngine.ts`, `src/core/CameraRig.ts`, `src/game/SaveState.ts`, `.claude/launch.json`.
Rewritten: `src/core/InputController.ts`, `src/game/Game.ts`, `src/vite-env.d.ts`, `index.html`, `src/styles.css`, `tests/visual.spec.ts`.
Deleted: `src/entities/Player.ts`, `src/entities/Pickup.ts`, `src/systems/CollisionSystem.ts`, `src/systems/Hud.ts`, `src/systems/AudioSystem.ts`, `src/systems/CameraRig.ts`, `src/systems/DebugTools.ts`.
Unchanged: `src/core/Loop.ts`, `src/core/Renderer.ts`, `src/utils/dispose.ts`, `src/main.ts`, `vite.config.ts`, `tsconfig.json`, `playwright.config.ts`, `scripts/inspect-threejs-canvas.mjs`.

### Remaining risks / next phase inputs

- `AudioEngine` groups exist but nothing plays yet; Phase 3 supplies clips, and the engine needs an actual `playClip(group, buffer)` method added when real assets exist. Phase 2's systems already emit the events (`biteStarted`, `catchResolved`, `marketSold`, etc.) an audio layer would hook into.
- `CameraRig.focusOn()` is called once in the placeholder scene setup but never driven dynamically; Phase 4 should nudge it toward the bobber/catch card/market stall as focal points change.

---

## Phase 2 — Core Gameplay Loop

### What was built

Full playable fishing loop replacing the Phase 1 placeholder state, with a real economy and minimal-but-functional UI (Phase 5 owns the visual pass; this wiring stays):

- **`game/data.ts`** — static catalogs: 20 fish species (5 common/5 uncommon/4 rare/3 epic/3 legendary, some with theme affinity) + 6 trash items (each recycling into a material), 4 bait tiers, 8 upgrades (Carbon Rod tiered ×3, LED Bobber, Turbo Bot Chip, Heavy Duty Basket, Tackle Apron, Salvage Magnet, Insulated Cooler, Sonar Scanner), 2 fishbot tiers, plus the rarity-weight formula (`computeRarityWeights`) and XP/level/theme-tier curves exactly per the plan's numbers.
- **`game/loot.ts`** — shared `pickRandom`/`rollWeightKg`/`pickSpeciesForRarity`/`pickTrashItem` helpers used by both the rod's `CatchResolver` and the passive `FishbotSystem`, so the two catch paths can't silently drift apart.
- **`game/SaveState.ts`** (replaced the Phase 1 placeholder) — full `GameSaveStateV1`: coins, level, xp, basket, materials, upgrades, equipped bait + bait inventory, discovered species, per-fishbot owned/next-ready timers, shared fishbot hopper, `lastActiveAtMs` (for offline-progress simulation), audio mix.
- **`game/Economy.ts`** — the single mutation surface over save state: upgrade purchases (coin + material cost, tiered), derived modifiers (reaction window, wait multiplier, fishbot interval, sale multiplier, basket capacity — all computed from owned upgrades rather than stored redundantly), bait equip/buy/consume-on-cast, basket add/remove, XP/level-up with theme-tier derivation, coin/material mutation, trash recycling (with Salvage Magnet's 30% double-material roll), fishbot purchase/hopper claim.
- **`game/GameState.ts`** (`FishingStateMachine`) — the full `IDLE → AIMING → CASTING → WAITING → BITE → RESOLVING → CELEBRATING → IDLE` loop plus `MISSED`, consuming the shared single-action input intent directly so every phase reacts to the same tap/click/Space/Enter. Cast gauge is a randomized sweet-spot sine oscillator (`systems/CastingSystem.ts`); bite wait/reaction timing lives in `systems/BiteSystem.ts`; catch resolution (rarity roll → species pick → weight → XP → basket) lives in `systems/CatchResolver.ts`.
- **`systems/MarketSystem.ts`** — Monger Barnaby's Sell Now/Haggle/Desperate flow with ephemeral (non-persisted) patience bones: haggle risks 1 bone on a 35% fail chance for +20%/−30% value, desperate risks 2 bones on a 60% fail chance for +50%/−30% value, and at 0 bones every sale (including Sell Now) pays 70% until 2 more catches reset his patience. Decoupled from `GameState` — it subscribes to the `catchResolved` event itself rather than being called directly, so both rod-catches and (future) other catch sources can feed it without new coupling.
- **`systems/CraftingSystem.ts`** — thin orchestration over `Economy` for upgrade purchase, single/bulk trash recycling, bait purchase/equip, fishbot purchase, each emitting the matching UI event.
- **`systems/FishbotSystem.ts`** — per-bot real-wall-clock timers (not loop-delta based, since bots must "run" while the tab is closed), a per-frame `update()` that deposits catches into a shared 10-slot hopper once ready, and `simulateOfflineProgress()` that fast-forwards ticks from `lastActiveAtMs` up to a 2-hour cap on load.
- **`entities/Bobber.ts`** — placeholder sphere + pulsing ripple ring, visible only during aiming/casting/waiting/bite, dunks under the water surface during bite.
- **`ui/UI.ts`** — HUD bar (level/XP bar, coins, equipped bait, basket fill), phase indicator (cast gauge with sweet-spot band + needle during aiming, progress bar during waiting, countdown bar during bite), toast line, catch celebration card (rarity-colored border, name, weight, flavor text, XP/value), and three modals (Shop: bait + fishbots + hopper claim; Market: Barnaby's sell flow with live patience-bone display; Crafting: materials, recycle-all, upgrade tiers) — all built from plain DOM/CSS, wired to the event bus so they refresh live as economy state changes.
- **`game/Game.ts`** rewired to construct and update all of the above each frame in explicit order (input edges → state machine → fishbot timers → bobber visual → UI → camera → autosave-timer → diagnostics), with a 5-second autosave debounce and a `persist()` call on dispose.
- **`main.ts`** wrapped `new Game(canvas)` in a try/catch that surfaces a visible `#fatal-error` overlay and `console.error`s the failure, instead of silently freezing the page (see bug below).

### Bugs found and fixed during verification

1. **Save-schema mismatch crashed the game silently.** Phase 1's placeholder save shape (`{coins, level, xp}`) was still sitting in the browser's `localStorage` from earlier smoke tests. `SaveManager.load()` only checked a bare version number (unchanged since Phase 1) before returning the stored object as-is, so Phase 2's `Economy`/`UI` code received an object missing `basket`, `materials`, `upgrades`, etc. The `UI` constructor's first `renderHud()` call threw `Cannot read properties of undefined (reading 'length')` on `state.basket.length` — which aborted `Game`'s constructor entirely (so the loop never started, and the render call never fired), leaving a frozen page showing only whatever HUD fields had been set before the crash line. **No console error was visible via the console-log inspection tool**, because an uncaught exception is a page error, not a `console.*` call — a real blind spot in relying only on that check. Found by directly inspecting `window.__THREE_GAME_DIAGNOSTICS__` (which was `undefined`, revealing the constructor never completed) and reading the raw `localStorage` value. Fixed by bumping `SAVE_VERSION` (1 → 2) so incompatible old saves are discarded in favor of `createDefaultSaveState()`, and by wrapping `main.ts`'s game construction in a try/catch that now shows a visible `#fatal-error` message and logs to console, so a future schema break fails loudly instead of freezing silently.
2. **(Carried over from Phase 1's audit, re-verified here.)** No new state-transition bugs surfaced in the richer state machine; the `actionPressed`/`actionReleased` split from Phase 1 continued to work correctly once `FishingStateMachine` became the consumer of those edges.

### Verification evidence

- `npm run build` (`tsc && vite build`) — clean, no type errors, after every change in this phase.
- `npm run test` (Playwright desktop-chrome + mobile-safari) — **2/2 passed**: nonblank canvas, full `idle → aiming → casting → waiting` transition via real pointer events, zero console/page errors.
- Manual end-to-end browser verification (after clearing the stale save) via `preview_eval`/`preview_click`, driving real `PointerEvent`s against `#action-button`:
  - `idle → aiming` on first tap, `aiming → casting → waiting` on second tap (confirmed via `window.__THREE_GAME_DIAGNOSTICS__.state`).
  - Full cast → wait (rolled 1.8s) → bite → react → resolve → celebrate cycle: caught "Tangled Fishing Line" (trash, +2 XP), catch card rendered correctly, basket incremented 0→1, phase auto-returned to `idle` after the 2.5s celebration window.
  - A longer play session caught real fish including a **Prism Koi (legendary)**, which correctly jumped the player from level 1 to level 12 off one big XP award — confirms the XP/level curve and level-up math work at the extremes, not just small increments.
  - **Crafting**: "Recycle All" converted a basket trash item into 1 fiber material and emptied the basket slot; button correctly disabled once no trash remains.
  - **Shop**: buying 10 Marshmallows deducted exactly 25 coins and updated the inventory count live; equipping it updated the HUD bait label immediately.
  - **Market**: sold the Prism Koi via Sell Now for exactly its base value (500 coins, 25→525) with patience bones unaffected; a Haggle attempt on Sunny Perch (base value 6) hit the 35%-chance failure branch, paying 6×0.7=4 coins (25 rounds to 4) and burning 1 bone (3→2 shown as 🦴🦴) — both the success-path math and a live failure-path roll were observed and matched the intended formulas.
  - **Persistence**: after buying bait, equipping it, and catching/recycling trash, a full page reload restored coins, equipped bait, bait inventory count, materials, and discovered-species list exactly, confirming the autosave-then-reload round trip.
  - **Basket-full block**: seeded a full 8/8 basket directly in `localStorage`, reloaded, and confirmed pressing the action button while at capacity stayed in `idle` and displayed the exact toast "Basket is full — visit the market to sell some catches!" (This check initially appeared to silently fail — traced to the preview browser tab being backgrounded (`document.visibilityState === 'hidden'`), which pauses `requestAnimationFrame` and therefore the whole game loop; not a game bug, but worth noting since it's the same class of "no visible signal" trap as the save-schema bug above. Re-verified once the tab regained visibility.)
  - **Fishbots**: seeded 5000 coins, bought Fishbot Mk I (750 coins deducted exactly, 5000→4250, button correctly flips to "Owned"). Backdated `lastActiveAtMs` by 10 minutes and the bot's `nextReadyAtMs` to match, then reloaded to trigger `simulateOfflineProgress()`: hopper filled to exactly 10/10 (correctly capped below the naive 13-tick estimate for 600s÷45s), toast read "Your fishbots caught 10 while you were away." Claiming the hopper moved catches into the basket only up to basket capacity (basket 0/8 → 8/8, hopper 10→2 remaining) — confirms the claim logic correctly respects basket capacity as the limiting factor, not just hopper capacity.
  - Mobile viewport (375×812) screenshot confirms the HUD wraps to two readable rows, touch targets are reasonably sized, and the scene/HUD/Cast button all render correctly.
- `localStorage` cleared at the end of the session so the next verification pass starts from a clean default save, not the test session's artificially-seeded/leveled state.

### Gameplay design decisions worth flagging

- **Trash sale value is fixed, not weight-scaled.** Per-catch weight is flavor/presentation only; market/recycling value is a flat per-species number. Keeps balancing simple; can revisit if weight-based pricing is wanted later.
- **Bait auto-falls back to Pleb Bait when inventory hits 0** rather than blocking casts or prompting a switch — keeps the loop uninterrupted, matches the game's "cozy, never punishing" tone from the plan.
- **Barnaby's patience bones are intentionally not persisted** — they represent his mood for the current sitting, not permanent state; only rod-catches (not fishbot catches) count toward the 2-catches-away reset, since fishbot drips happen passively rather than the player "fishing for a while."
- **Fishbot timers use real wall-clock (`Date.now()`), not the render-loop delta** — this is what makes offline-progress simulation possible (bots "catch" things while the tab/browser is closed), unlike the cast/bite timers which are loop-delta-based and correctly pause when the tab is backgrounded.

### New-game / gameplay checklist (extends Phase 1's)

- [x] Clear objective/feedback/fail-retry loop now exists: cast → bite → catch → basket → sell/craft, with a non-punishing "missed" state.
- [x] Full loop playable via keyboard (Space/Enter), mouse click, and touch tap — same single intent throughout.
- [x] State saves and restores correctly (after the schema-version fix).
- [x] `npm run build` clean, `npm run test` 2/2 passing, no console/page errors observed in manual play.
- [~] Placeholder voxel-box visuals only, as scoped — Phase 4 replaces geometry, Phase 5 replaces UI chrome.

### Files changed

New: `src/game/data.ts`, `src/game/loot.ts`, `src/game/Economy.ts`, `src/game/GameState.ts`, `src/game/events.ts`, `src/systems/CastingSystem.ts`, `src/systems/BiteSystem.ts`, `src/systems/CatchResolver.ts`, `src/systems/MarketSystem.ts`, `src/systems/CraftingSystem.ts`, `src/systems/FishbotSystem.ts`, `src/entities/Bobber.ts`, `src/ui/UI.ts`.
Rewritten: `src/game/SaveState.ts` (full economy shape, replacing the Phase 1 placeholder), `src/game/Game.ts` (wires all Phase 2 systems), `src/core/SaveManager.ts` (version bump 1→2), `src/main.ts` (visible fatal-error handling), `index.html` (dropped the now-redundant placeholder HUD text), `src/styles.css` (added HUD/modal/toast/catch-card CSS), `tests/visual.spec.ts` (updated for the real phase names and cast→wait flow).

### Remaining risks / next phase inputs

- `ui/UI.ts` is deliberately unstyled-functional; Phase 5 replaces all of its visuals but should keep its event-subscription wiring (it already follows "UI reads from game state only").
- No audio hooks are wired to the many events `GameState`/`MarketSystem`/`CraftingSystem`/`FishbotSystem` already emit (`biteStarted`, `catchResolved`, `marketSold`, `upgradePurchased`, etc.) — Phase 3 should treat this event list as the SFX trigger map.
- The placeholder scene/camera/Bobber visuals are functional but crude (colored boxes, no fish models) — Phase 4's VoxelKit and Phase 3's Tripo models replace them; `Bobber.ts` and `CameraRig.focusOn()` are the two hook points Phase 4 will need to extend rather than replace.
- Fishbots' live (non-offline) per-frame catching was not separately timed out in real-time (would require sitting with the tab open for a full 45s cycle); the offline-progress path was verified directly and uses the identical tick/interval math as `FishbotSystem.update()`, so confidence is high, but a live-timer observation would be a cheap additional check if this area needs revisiting later.
- `localStorage` was cleared at the end of every verification round in this phase, so the shipped state starts clean; no leftover seeded/leveled test data remains.

---

## Architect Review of Phases 1–2 (post-implementation)

Independent review pass over all Phase 1/2 code. Five issues found and repaired, all verified in-browser afterward:

1. **Cast gauge sweet spot covered the entire track** (`systems/CastingSystem.ts`). `sweetSpotWidth: 0.5` with sweet spots in 0.3–0.7 meant the ±width band spanned the whole 0–1 gauge: the UI's green zone rendered at 100% width and `castPrecision` could never reach 0, making the timing minigame visually and mechanically meaningless. Fixed by narrowing the half-extent to 0.18 (band = 36% of track, always fully inside it given the sweet-spot range). Verified in-browser: `.gauge-sweet` now renders at `width:36%` at a random position.
2. **Double toast on a missed bite** (`ui/UI.ts`). `GameState.enterMissed` emits both a `missed` event and a `toast('It got away...')`; the UI also listened to `missed` and showed the same toast — two overlapping toasts, the second resetting the fade timer. Removed the UI's redundant `missed` listener; the event remains for future audio/VFX hooks.
3. **Progress lost on tab close** (`game/Game.ts`). Autosave ran every 5s and `dispose()` only fires on Vite HMR — a real tab close could silently drop up to 5s of purchases/catches. Added a `pagehide` listener that persists immediately (removed in `dispose`). Verified working — so well, in fact, that it initially defeated the reviewer's own `localStorage.clear()`-then-reload reset (the handler re-persisted in-memory state during the reload's pagehide; reset now requires a later-registered pagehide listener that clears after the game's persist runs). That interaction is expected behavior, not a bug.
4. **Saved audio mix never applied** (`game/Game.ts`, `core/AudioEngine.ts`). `GameSaveStateV1.audio` was persisted but the engine always booted with hardcoded defaults, and `unlock()` ignored the muted flag when creating gain nodes. Now the saved mix is copied onto the engine at startup and the master gain honors `muted` at unlock. (Nothing audible changes until Phase 3 supplies clips, but the settings UI in Phase 5 would have shipped against broken plumbing.)
5. **Bobber visible while still aiming** (`game/Game.ts`). Visibility was `phase !== 'idle'`, so the bobber sat in the water before the cast was thrown (and during the missed-reel-in beat). Now shown only during `casting/waiting/bite/celebrating`. Verified via renderer draw calls: 3 in `aiming` (same as the empty scene), 6 in `waiting`.

Post-fix verification: `npm run build` clean, Playwright 2/2 passing (desktop + mobile), fresh-save browser session confirms gauge band, bobber behavior, and clean default state (50 coins, 0/8 basket).

Non-issues noted for later phases (no action taken): `UI.renderPhaseIndicator` rewrites `innerHTML` every frame during active phases (works, but Phase 5 should diff or throttle it); the action surface for pointer input is only the Cast FAB (plan allows this; Phase 5 may widen it); market `desperate` with <2 bones fails without burning bones (reads as intended leniency); `SaveState` interface name says V1 while the envelope version is 2 (cosmetic).

---

## Phase 3 — External Asset Generation

### Credential probe

```
TRIPO_API_KEY=SET
GEMINI_API_KEY=SET
ELEVENLABS_API_KEY=SET
```

### Image generation (Gemini) — initially blocked, resolved mid-phase

**First attempt** (before the user fixed their Gemini billing): the plan's first image (`style-sheet.png`) failed identically on both the initial attempt and one retry (per the plan's "retry once" rule):

```
Error generating image: 429 RESOURCE_EXHAUSTED.
Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 0, model: gemini-3-pro-image
Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_input_token_count, limit: 0, model: gemini-3-pro-image
```

This was a hard billing/plan gap (`limit: 0`, not a transient rate limit), so at the time it was a valid documented blocker per the plan's skip rules. **As a result, Monger Barnaby's first-pass Tripo model was generated via `text` (text-to-3D) instead of `image` (image-to-3D)**, since no concept reference image existed yet.

**Resolution:** the user fixed their Gemini account billing. Re-ran the probe (still `GEMINI_API_KEY=SET`, as before — the fix was account-side, not key-side) and retried `style-sheet.png`, which succeeded immediately. All 6 planned images were then generated:

| # | File | Purpose | Prompt (abridged) |
|---|---|---|---|
| 1 | `assets-src/concepts/style-sheet.png` | Art direction anchor | "Cozy voxel fishing diorama concept: floating island pond, pastel palette, chunky voxels, warm dusk lighting, lilypads, tiny dock" |
| 2 | `assets-src/concepts/monger-barnaby.png` | Image→3D input + market portrait | "Full-body voxel-style walrus fishmonger in apron, centered, plain light background, readable silhouette" |
| 3 | `assets-src/ui/logo-title.png` | Title screen | "Fish and Chat" cozy wooden hanging-sign logo, chunky voxel lettering, transparent-friendly |
| 4 | `assets-src/sky/forest-pond.png` | Forest-pond theme backdrop | Warm sunset over a pine forest, layered depth, readable horizon |
| 5 | `assets-src/sky/ocean-trench.png` | Ocean-trench theme backdrop | Deep teal underwater god-rays, mysterious calm lighting |
| 6 | `assets-src/sky/cosmic-lake.png` | Cosmic-lake theme backdrop | Aurora nebula over a dark still lake, soft stars |
| 7 | `assets-src/ui/icons.png` | HUD icon sheet | 6 icons on a grid (coin, bait can, basket, hammer, scale, bone), flat pastel, transparent background |

All 7 generations (6 planned images, since style-sheet + Barnaby concept both counted from the original 5-item list, plus this was actually the originally-planned 5 images — style-sheet, Barnaby concept, logo, 3x sky, icons = 7 files total across 6 manifest rows since the 3 sky plates are one row) succeeded on the first try at 2K resolution (1K for the icon sheet, per the plan's resolution guidance). All reviewed visually and match the intended art direction well — the icon sheet in particular came back with a genuinely transparent background and clean grid spacing, no cropping.

**Barnaby model regenerated as a consequence:** the `monger-barnaby.png` concept art came back noticeably more charming and on-model than the text-to-3D result from the initial (blocked) pass — see the 3D model table below for the resulting `barnaby-v2` regeneration via proper image-to-3D.

**Remaining gap:** none. All originally-planned image assets now exist. The only carryover note is that `assets-src/models/barnaby/` (the v1 text-to-3D generation) is superseded by `assets-src/models/barnaby-v2/` — Phase 4 should import from `-v2`.

### 3D models (Tripo) — 5 hero assets, 6 generations (Barnaby regenerated)

All static (no rigging/animation, per plan — fish "swim" and Barnaby "idles" via code in Phase 4). Downloaded under `assets-src/models/`.

| Asset | Task ID | Method | Credits | Triangles | Textures | File size | Output |
|---|---|---|---:|---:|---:|---|---|
| Monger Barnaby v1 (superseded) | `486ec7d8-f277-40ae-88d8-a06536b1242c` | text-to-3D (Gemini blocked at the time) | 40 | ~8,624 | 3 | 1.8 MB | `assets-src/models/barnaby/...-pbr_model.glb` — **not used** |
| **Monger Barnaby v2 (final)** | `b297d502-e254-44ce-bf2f-ee4d2470e2ef` | image-to-3D from `assets-src/concepts/monger-barnaby.png` (`--enable-image-autofix --texture-alignment original_image`) | 50 | ~7,936 | 3 | 1.8 MB | `assets-src/models/barnaby-v2/...-pbr_model.glb` |
| Prism Koi (legendary fish) | `61262e20-5371-40b0-a33f-5953ea3a839c` | text-to-3D | 40 | ~8,558 | 3 | 3.3 MB | `assets-src/models/prism-koi/...-pbr_model.glb` |
| Generic fish (recolorable base) | `f4500b28-f57c-4e53-9a8b-b2e55fea9ce5` | text-to-3D | 30 | ~4,704 | 3 | 896 KB | `assets-src/models/generic-fish/...-pbr_model.glb` |
| Fishbot Mk I | `12886f27-5b39-4453-9f0e-294854466a1e` | text-to-3D | 30 | ~5,636 | 3 | 660 KB | `assets-src/models/fishbot/...-pbr_model.glb` |
| Old Boot (trash hero prop) | `8889e280-3579-474c-9b56-4279cacf51ca` | text-to-3D | 30 | ~3,533 | 3 | 536 KB | `assets-src/models/old-boot/...-pbr_model.glb` |

Total: 220 credits across 6 generations (including the superseded Barnaby v1), ~9 MB across the 5 GLBs actually in use, all single-mesh with 3 PBR textures each (base color/normal/roughness pattern). All requested with `--smart-low-poly` and a `--face-limit`; actual triangle counts landed somewhat above the requested limits (e.g. koi requested 6000, got ~8558) — `smart_low_poly`/`face_limit` are apparently soft targets, not hard caps. All counts are still comfortably within a browser-game budget for 5 hero assets; noted for Phase 4/6 performance tracking, no action needed.

**Barnaby regeneration**: once Gemini was fixed and `assets-src/concepts/monger-barnaby.png` existed, I compared it against the original text-to-3D Barnaby and judged the concept art clearly stronger (tusks, blue apron with a fish emblem, more expressive proportions) — so I regenerated Barnaby via proper image-to-3D rather than leave the weaker text-to-3D result in place just because it technically satisfied the manifest. Verified visually via the downloaded `rendered_image.webp`: v2 is a clear upgrade at essentially the same triangle/file-size budget. **`assets-src/models/barnaby/` (v1) is superseded — Phase 4 must import from `barnaby-v2/`.**

**Style gate**: 4 of 5 models already read as chunky/voxel-appropriate straight out of generation (Barnaby, Fishbot, generic fish are clearly blocky; the koi's faceted crystalline look fits its "legendary" framing even though it's not strictly cubic). Only the boot looked more like a realistic weathered-leather render than voxel. Ran the plan's voxel `stylize_model` postprocess on it (task `89a8de68-1c3b-42b4-82e5-0a7ebce32ab6`, 20 credits) as a test — then actually rendered **both** the original and the stylized GLB side-by-side in the browser (temporarily copied into `public/`, loaded via `GLTFLoader` in a throwaway `preview_eval` scene, screenshotted, then removed) rather than assume the postprocess helped. The two were visually near-identical; the stylize pass didn't meaningfully change the silhouette or block-iness. Per the plan's explicit guidance ("if stylize output loses too much charm... keep the low-poly base and note it"), **kept the original boot model** and discarded the stylize output as not worth the extra Tripo asset/credits; `assets-src/models/old-boot-voxel/` remains on disk but is not wired into anything.

### Audio (ElevenLabs) — 13/13 generated

All under `public/audio/` (served directly by Vite from `public/`, unlike the Tripo/image sources which stay in `assets-src/` pending Phase 4 integration).

**SFX** (`public/audio/sfx/`, `mp3_44100_128`, prompt-influence 0.6-0.7):

| File | Duration | Prompt |
|---|---:|---|
| `cast-whoosh.mp3` | 1.0s | "short cozy fishing rod cast whoosh, gentle line release, soft swish transient" |
| `bobber-splash.mp3` | 0.8s | "small bobber splash landing in calm pond water, single gentle plop, light droplet tail" |
| `bite-alert.mp3` | 0.6s | "bright friendly boop-boop alert sound for a fish bite, cheerful two-note chime" |
| `reel-in.mp3` | 0.7s | "short fishing reel-in ratchet sound, mechanical clicking wind-up" |
| `catch-jingle.mp3` | 1.2s | "soft marimba arpeggio catch jingle, warm and pleasant" |
| `rare-catch-fanfare.mp3` | 2.2s | "warm chime swell fanfare for a rare legendary catch, sparkling ascending bells" |
| `coin-clink.mp3` | 0.5s | "short coin clink sound, bright metallic jingle, single quick transient" |
| `ui-click.mp3` | 0.5s | "soft wooden UI tap sound, gentle mechanical click" (regenerated once — first attempt used 0.3s and hit ElevenLabs' hard minimum of 0.5s, a real API validation error, not a design choice) |
| `craft-clunk.mp3` | 0.8s | "gentle workbench craft clunk, soft wood tap followed by a light metal tink" |
| `haggle-bones.mp3` | 0.6s | "light dry bone rattle sound for a market haggling moment" |

**Ambience loops** (`public/audio/ambience/`, 14s, `--loop`, prompt-influence 0.45):

| File | Prompt |
|---|---|
| `ambience-forest.mp3` | "seamless looping evening forest pond ambience, gentle crickets, soft water lapping, a distant owl call" |
| `ambience-ocean.mp3` | "seamless looping deep ocean trench ambience, soft underwater hum, muffled distant bubbles, a faint whale call far away" |
| `ambience-cosmic.mp3` | "seamless looping dreamy cosmic lake ambience, shimmering ethereal synth pad, sparse gentle twinkles" |

All 13 files verified as valid MPEG Layer III audio via `file`; the three ambience loops are exactly the same byte-size (224,906 bytes, since duration/bitrate are identical) but confirmed via MD5 to be three genuinely distinct recordings, not a caching bug.

**`src/assets/manifest.ts`** created with `SFX_MANIFEST`, `AMBIENCE_MANIFEST` (keyed by theme ID), an `AUDIO_TRIGGER_MAP` mapping `GameEventMap` event names to SFX (e.g. `biteStarted -> biteAlert`, `marketSold -> coinClink`), and an empty `MODEL_MANIFEST` stub for Phase 4 to fill with the GLB paths above. No runtime audio playback is wired yet — `core/AudioEngine.ts` still only has the gesture-unlock/mix-group skeleton from Phase 1/2; wiring `AUDIO_TRIGGER_MAP` to actual `playClip()` calls is Phase 4/5 work (the events all already fire correctly, verified in Phase 2).

### External Asset Sourcing Ledger

| Surface | Source | Evidence |
|---|---|---|
| Hero/player (Monger Barnaby) | `threejs-3d-generator` (image-to-3D from a `threejs-image-generator` concept) | Concept `assets-src/concepts/monger-barnaby.png`; model task `b297d502...` (final, v2), GLB downloaded, rendered preview confirmed on-style and an improvement over the initial text-to-3D pass (task `486ec7d8...`, superseded) |
| Signature prop (Prism Koi, legendary fish) | `threejs-3d-generator` (text-to-3D) | Task `61262e20...`, GLB downloaded, rendered preview confirmed on-style |
| Repeated prop (generic recolorable fish) | `threejs-3d-generator` (text-to-3D) | Task `f4500b28...`, GLB downloaded, rendered preview confirmed on-style |
| Signature prop (Fishbot Mk I) | `threejs-3d-generator` (text-to-3D) | Task `12886f27...`, GLB downloaded, rendered preview confirmed on-style |
| Signature prop (Old Boot / hero trash item) | `threejs-3d-generator` (text-to-3D) + attempted `stylize_model` postprocess (discarded after visual comparison) | Task `8889e280...` (kept), `89a8de68...` (discarded) |
| World/sky/background (3 theme backdrops) | `threejs-image-generator` | `assets-src/sky/forest-pond.png`, `ocean-trench.png`, `cosmic-lake.png` — all generated after the Gemini fix, visually distinct and on-theme |
| Materials/textures/decals | not attempted this phase | Deferred to Phase 4's VoxelKit (procedural per-instance coloring, per plan) |
| Logos/icons/GUI art | `threejs-image-generator` | `assets-src/ui/logo-title.png` (wooden hanging-sign logo) and `assets-src/ui/icons.png` (6-icon sheet, genuinely transparent background) |
| Audio/SFX/voice | `threejs-audio-generator` | 13 files generated and verified, see table above |

### Verification evidence

- Credential probe output captured above (both before and after the Gemini fix — key presence was unchanged; the fix was account/billing-side).
- `npm run build` unaffected (no source changes required assets to exist yet — Phase 4/5 do the actual import wiring).
- All 6 GLBs in active use (Barnaby v2, koi, generic fish, fishbot, boot) parsed successfully with a small Python glTF-chunk reader (triangle/texture/mesh counts in the tables above) — confirms they're structurally valid, not corrupted downloads.
- All 13 MP3s verified via `file` as valid MPEG Layer III audio.
- The boot stylize A/B comparison was verified by actually rendering both GLBs with `GLTFLoader` in the live preview browser (not just inspecting metadata), screenshotted, and compared — same rigor applied to the Barnaby v1-vs-v2 decision (visual comparison of both `rendered_image.webp` previews, not just assuming image-to-3D would be better).
- All 7 generated images visually reviewed directly (not just file-existence-checked): style-sheet, Barnaby concept, logo, all 3 sky plates, and the icon sheet all match the intended cozy-voxel art direction with no cropping, garbled text, or off-model results.

### Remaining gaps for later phases

- **`assets-src/models/barnaby/` (v1) and `old-boot-voxel/` sit unused on disk** — harmless, but Phase 4 must import Barnaby from `barnaby-v2/`, and the boot from `old-boot/` (not `old-boot-voxel/`).
- **No runtime audio or 2D-image wiring exists yet** — all files exist and `src/assets/manifest.ts` has the audio trigger map drafted, but `AudioEngine` needs an actual `load()`/`playClip()` implementation, the sky images need to be applied as a backdrop per theme, and the logo/icons need to be wired into the DOM. This is explicitly Phase 4/5 work per the original plan, not a Phase 3 gap.
- **Barnaby, the fish, and the fishbot are all static meshes** (no rigging attempted, per plan — animation was deliberately out of scope to avoid Tripo's rig/retarget credit and reliability surface). Phase 4 will need to drive all movement (fish swimming, Barnaby idle bob, fishbot casting motion) procedurally in Three.js code, not via imported animation clips.
- **Total Tripo spend this phase: 220 credits** across 6 generations (one superseded). Worth knowing if the user is tracking Tripo credit budget across the whole build.

---

## Phase 4 — Voxel World & Graphics Polish

References loaded: `visual-scorecard.md`, `implementation-blueprint.md`, `model-recipes.md`, `render-recipes.md`, `checklists/aaa-game-quality-gate.md`, `checklists/aaa-visual-scorecard.md`.

### What was built

Replaced the Phase 1/2 placeholder (a green box + blue disc + brown post) with a full authored diorama:

- **`assets/MaterialLibrary.ts`** — named shared material roles (terrain top/mid/low, wood/woodDark, foliage/foliageAccent, stone, emissiveSignal, glass, fabric) driven by a per-theme `ThemePalette`, so material identity — not just fog color — changes between forest/ocean/cosmic.
- **`world/VoxelKit.ts`** — procedural factories: instanced voxel terrain clusters, a jittered-icosahedron rock, a tiered-cone pine tree, a tube-based coral branch, a faceted crystal cluster, a plank-and-post dock, a market stall shell, a crafting bench, a glowing lantern post (with a real `PointLight`), lilypads, cattails, bushes, mushroom clusters, and squashed-sphere clouds. 12 distinct prop types per theme (exceeds the plan's ≥8 target).
- **`world/DioramaBuilder.ts`** — assembles the full scene per theme: island terrain **with an actual carved-out pond basin** (see bug below), dock, stall, bench, 2 lanterns, a 7-prop foliage ring (trees/coral/crystals by theme), 5 shoreline rocks, 4 cattail clusters, forest-only bushes/mushrooms, 5 lilypads, 3 clouds — plus a structure-exclusion system so scattered foliage can't spawn through the stall, dock, bench, lanterns, or Barnaby.
- **`systems/WaterSystem.ts`** — custom `ShaderMaterial`: vertex-shader sine displacement (gentle waves), fragment-shader two-tone shallow/deep gradient by distance from center, a moving procedural caustic-dot pattern, and a pooled ripple-ring system (`emitRipple()`) triggered during the waiting phase and on fish leaps.
- **`systems/RenderPipeline.ts`** — hemisphere + directional key light (2048 shadow map), `EffectComposer` with `UnrealBloomPass` (restrained: threshold 0.82, strength 0.35) and a custom vignette `ShaderPass`.
- **`systems/ThemeManager.ts`** — rebuilds the diorama, swaps the sky backdrop texture (`scene.background`), fog color/near/far, water palette, and crossfades ambience on theme change; exposes an `onRebuilt` callback so `Game.ts` can re-parent the persistent Barnaby/fishbot GLB instances into the new slots.
- **`systems/VfxSystem.ts`** — pooled particle bursts (manual velocity+gravity+fade, no permanent particle fields) wired to `castLocked`, `biteStarted`, `catchResolved` (rarity-colored, bigger for rare+), `marketSold` (coin sparkle at Barnaby), `upgradePurchased` (craft puff at the bench).
- **`assets/ImportedAssetRegistry.ts`** — `GLTFLoader` wrapper with a load cache, triangle/material/texture diagnostics, and `normalizedClone()` (recenters on base, scales to a target height) so the same cached asset can be cloned into ambient fish, leap effects, and hero slots without re-fetching.
- **Tripo GLB integration**: Barnaby stands beside the market stall (not under its roof — see bug below), the fishbot appears on the dock only when owned (`updateFishbotVisibility()`, driven by `economy.ownedFishbots()`), 3 tinted ambient fish swim procedural circular paths in the pond, and a temporary leap effect (generic fish, or the Prism Koi model specifically for legendary catches) arcs out of the water on every non-trash catch. The old boot GLB sits as a fixed piece of shore debris.
- **`core/AudioEngine.ts` real playback** — replaced the Phase 1/2 skeleton with actual `decodeAudioData`-backed one-shot SFX (`playSfx`) and a crossfading looping ambience track (`playAmbience`/`stopAmbience`), plus a real bug fix (see below). `Game.ts`'s new `wireAudioTriggers()` subscribes all 10 SFX to their matching gameplay events — the `AUDIO_TRIGGER_MAP` drafted in Phase 3 is now actually live.
- **`assets/manifest.ts`** extended with `MODEL_SOURCE_MANIFEST_PUBLIC` and `IMAGE_MANIFEST_PUBLIC` pointing at `/models/*.glb` and `/images/*.png` — the Phase 3 Tripo/Gemini outputs were copied from `assets-src/` into `public/` so they're actually servable (Barnaby from `barnaby-v2`, per the Phase 3 supersession note).

### Bugs found and fixed during verification

1. **The pond didn't exist — water was buried under solid terrain.** `buildIslandTerrain` originally filled its entire footprint with no hole, so the `WaterSystem` disc sat completely hidden beneath the terrain top layer; the first screenshot after wiring everything up showed zero visible water, just an all-green island. Fixed by carving an actual hole (`pondRadius` parameter, cells with `dist < pondRadius` skipped) plus a recessed basin-rim ring for a lip instead of a hard cliff edge, and introduced a shared `POND_RADIUS`/`WATER_DISC_RADIUS` constant pair so the terrain hole and the water disc stay in sync. Re-verified visually — the pond is now clearly visible with fish swimming in it.
2. **Renderer diagnostics silently went to ~0 after adding post-processing.** Once `EffectComposer` was introduced, `window.__THREE_GAME_DIAGNOSTICS__.renderer.calls`/`.triangles` dropped to 1/1 — `EffectComposer.render()` resets `renderer.info` between its internal passes, so only the final full-screen composite quad was left by the time diagnostics were read. This would have made every future performance check in this project silently useless. Fixed by setting `renderer.info.autoReset = false` and manually resetting once per frame in `RenderPipeline.render()`, so counts now accumulate across the whole frame (verified: 209 calls / 46,392 triangles reported after the fix, versus 3 calls / 56 triangles for the pre-Phase-4 placeholder scene).
3. **Placement mismatches found by testing, not just reading the code**: the fishbot slot was positioned off to the side of the water instead of aligned with the dock's plank line (fixed to `x=1.4` matching the dock); scattered foliage/rocks could spawn through the market stall roof, the dock, the crafting bench, and directly on top of Barnaby (added a `STRUCTURE_EXCLUSIONS` list with per-structure radii, retrying up to 12 times per scatter point before dropping it rather than forcing an overlap); cattails were placed fully inside the open pond (`radius 2.3-2.8` inside a `POND_RADIUS=3.0` hole) instead of at the shoreline — fixed to straddle the pond edge (`POND_RADIUS-0.1` to `+0.4`).
4. **Barnaby's front-facing direction was determined empirically, not guessed.** An early placement attempt left him reading as "facing away" from the fixed diorama camera. Rather than guess-and-check in the full scene (where lighting/distance make orientation hard to judge), rendered the raw `barnaby.glb` alone in an isolated bright test scene (same technique as the Phase 3 boot A/B comparison) at `rotation.y = 0` and `rotation.y = Math.PI` — confirmed the model's unrotated front faces −z, and the diorama's fixed camera sits on the model's +z side, so a rotation near `Math.PI` is required to face him toward the camera. Also caught and fixed a real placement bug in the same pass: Barnaby was originally positioned under the market stall's rotated roof, which occluded him almost entirely from the fixed camera angle — moved him into the open in front of the counter instead.
5. **`AudioEngine`'s gain graph had `sfx`/`ambience` bypassing `master` entirely.** Both group gain nodes connected directly to `context.destination` in parallel with the `master` gain node, instead of routing through it — so `setVolume('master', ...)` and `setMuted()` had no actual effect on anything audible (nothing was ever routed through the master node except a link straight to destination that no source used). Fixed the routing to `sfx/ambience → master → destination` while adding real clip playback in the same pass.

### Verification method note

Several of the above were caught only because verification meant *rendering and looking*, not just checking the build/diagnostics succeeded — echoing the same lesson from Phase 1/2's save-schema bug. Two testing wrinkles worth flagging for future phases: (a) the `pagehide`-triggered autosave (added during the Phase 1/2 architect review) means a bare `localStorage.clear()` immediately followed by `reload()` gets overwritten by the outgoing page's autosave before the new page loads — seeding/resetting test state now requires registering a *later* `pagehide` listener than the game's own, so the override runs last; (b) the preview tool's mobile-viewport screenshot appears to capture a larger fixed canvas than the emulated device size, leaving a solid-color margin outside the actual content — confirmed via direct DOM measurement (`getBoundingClientRect`, computed style, and `window.innerWidth/innerHeight` all correctly reported 375×812 with a matching 750×1624 drawing buffer at DPR 2) that this is a screenshot-capture artifact, not an actual rendering bug.

### Theme system verification

Manually verified all three themes rebuild correctly by seeding `level` directly and reloading (via the late-`pagehide`-listener technique): **forest-pond** (warm sunset backdrop, pine trees, amber lanterns), **ocean-trench** (underwater god-ray backdrop, coral clusters, cyan lanterns, darker moodier water), **cosmic-lake** (aurora backdrop, crystal clusters, purple lanterns, near-night water) — each swaps terrain/foliage/lantern-glow color, the sky texture, fog, and (per code, not independently re-verified per-track since ambience audio isn't visually confirmable via screenshot) the ambience loop. Fishbot purchase-and-placement was also re-verified in this phase (visible on the dock only once owned, matching Phase 2's `updateFishbotVisibility` logic now wired to a real 3D model instead of nothing).

### Visual scorecard

Active-play screenshots: desktop confirmed above; mobile viewport dimensions confirmed correct via DOM measurement (see verification note) though the screenshot tool itself couldn't produce a clean capture this session.

```
Visual scorecard:
- Art direction: before 0 / after 2 - evidence: three visually distinct theme rebuilds (palette/props/sky/fog all change), but UI chrome doesn't yet echo theme identity (Phase 5).
- Hero/player: before 0 / after 2 - evidence: Barnaby is an authored Tripo model (tusks, apron, fish emblem) with correct scale/facing, but no animation/state-cue feedback yet (static pose).
- Obstacles/enemies: before 0 / after 1 - evidence: genre has no obstacles/enemies; closest analog (fish/trash catch variety) has only 2 authored 3D forms (generic fish, Prism Koi) plus procedural boot — category doesn't map cleanly onto a cozy fishing game.
- Rewards/interactables: before 0 / after 2 - evidence: catches have idle (ambient swim), collect (catch card + confetti/fanfare), and value feedback (coin sparkle at market); two authored fish forms.
- World/environment: before 0 / after 2 - evidence: layered diorama (foreground props, dock/stall/bench, pond basin, background tree ring, sky backdrop) replacing a single green box.
- Materials/textures: before 0 / after 2 - evidence: named shared material roles across the voxel kit, real PBR-textured Tripo GLBs (3 textures each), theme-driven palette swaps.
- Lighting/render: before 1 / after 2 - evidence: ACES tone mapping (carried from scaffold) plus hemisphere+key lighting, 2048 shadow map, per-theme fog, restrained bloom+vignette composer.
- VFX/motion: before 0 / after 2 - evidence: event-driven bursts for 5 distinct triggers, ambient fish swimming/leaping, lilypad bob, cloud drift, water ripples/caustics — all tied to real gameplay state, not decoration.
- UI/HUD: before 1 / after 1 - evidence: unchanged from Phase 2 — unstyled-functional HUD/modals, explicitly deferred to Phase 5.
- Performance evidence: before 1 / after 2 - evidence: renderer diagnostics before (3 calls/56 tris) and after (209 calls/46,392 tris/109 geometries/26 textures) captured on both the placeholder and current scene; 209 draw calls exceeds the plan's informal <150 target since most small repeated props (trees/rocks/cattails/lanterns) are individual meshes rather than instanced — flagged as a Phase 6 optimization target, not fixed this phase.
Average: 1.8 (was 0.3)
Automatic failures remaining: none of the hard-fail conditions apply (screenshot isn't primitive-dominant, world isn't a flat plane, hero isn't default-primitives-plus-glow, HUD is genre-neutral rather than a stat-card dashboard, game is playable, diagnostics were collected) — but the average (1.8) and two categories (Obstacles/enemies=1, UI/HUD=1) are below the premium threshold (every category ≥2, average ≥2.3).
```

**Premium gate: not yet passed.** This is expected, not a Phase 4 shortfall: `UI/HUD` is explicitly Phase 5's scope (the plan sequences UI after graphics), and `Obstacles/enemies` doesn't have a clean mapping onto this genre — cozy fishing has no combat/hazard obstacles, and the plan's Phase 4 checklist item for it was really "give fish variety real 3D presence," which is only partially done (2 of ~20+ species have unique models; most are the tinted generic-fish base). If more per-rarity 3D variety is wanted, that's the next lever for this category; otherwise it should be treated as a genre mismatch and excluded from the gate. Every other graphics-owned category (art direction, hero, rewards, world, materials, lighting, VFX) is now at 2, meeting the individual-category premium bar — Phase 5 (UI/HUD) is the remaining blocker for an overall premium claim.

### Verification evidence

- `npm run build` clean after every change in this phase.
- `npm run test` (Playwright desktop-chrome + mobile-safari) — 2/2 passed.
- Renderer diagnostics captured before (placeholder) and after (authored diorama): calls 3→209, triangles 56→46,392, geometries/textures now tracked (109/26).
- All three themes visually verified via direct browser screenshots after seeding level and reloading.
- Fishbot ownership-gated visibility re-verified with the real 3D model.
- Barnaby's facing direction and stall-roof-occlusion bug both caught via isolated-scene testing and full-diorama screenshots, not assumed correct from code review.

### Remaining gaps for later phases

- **UI/HUD is unchanged from Phase 2** (unstyled-functional) — Phase 5 owns this and it's the main blocker for the premium visual scorecard gate.
- **209 draw calls** — above the plan's informal <150 target. The instanced terrain clusters are cheap, but pine trees, rocks, cattails, bushes, mushrooms, and lanterns are each individual (multi-mesh) objects. Converting the repeated small props to `InstancedMesh` per prop-type would be the natural Phase 6 optimization pass.
- **Only 2 of ~20+ fish species have unique 3D models** (generic-fish tinted per catch, Prism Koi for legendary) — everything else in the catch table is represented by the same tinted base mesh. This is a deliberate budget/scope call (5 Tripo models total across the whole project, per the Phase 3 plan), not an oversight, but it's the reason the `Obstacles/enemies`-equivalent category scores low.
- **Ambience crossfade on theme change was verified by reading the code path, not by listening** — `ThemeManager.applyAtmosphere()` calls `audio.playAmbience()` on every theme switch and the underlying `AudioEngine.playAmbience()` crossfade logic was exercised in isolation, but no session in this phase specifically confirmed audible crossfade behavior across a live theme switch. Worth a targeted check in Phase 6's audio QA pass.
- **The dev-only `window.__game_scene` handle** (gated behind `import.meta.env.DEV`, added during verification) is harmless and won't ship in production builds, but is a debugging convenience worth knowing about if `Game.ts` is read cold.

---

## Architect Review of Phase 4 (post-implementation)

### User-reported issues, fixed first

1. **"Pulsating" shadows** — hard `PCFShadowMap` acne shimmered frame-to-frame under the camera rig's continuous idle drift. Switched to `VSMShadowMap` (`PCFSoftShadowMap` is deprecated in this three.js version and silently falls back to hard PCF with a console warning — caught via the Playwright webserver log), tightened the shadow camera frustum from ±8 to ±6 to match the diorama's real extent, and tuned `bias`/`normalBias`/`radius`. Verified stable across drift frames.
2. **Blown-out lantern glow** — `emissiveIntensity: 1.6` + bloom rendered the lantern as a flat oversaturated blob. Reduced to 0.8 and dropped the point light from 0.6/3.0 to 0.35/2.5. Verified visually.
3. **"Is Barnaby on the dock?"** — no; he stands by his market stall, which the camera angle made read as a generic table. Flagged as a possible Phase 5/6 readability improvement (counter goods/sign), not changed this pass.

### Independent review findings, all repaired and verified

4. **Ripple rings rendered floating in mid-air** (`WaterSystem`). The ripple pool lives inside the water mesh, which is rotated −π/2 about X — that rotation maps mesh-local `(x, y, z)` to world `(x, z, −y)`, so `position.set(x, 0.01, z)` placed a ripple emitted at the bobber (z≈1.5) at world *height* 1.5, hovering above the pond (visible as a ghost ring in the sky in an earlier waiting-phase screenshot). The rings also carried a redundant second −π/2 rotation flipping their plane. Fixed: rings stay flat in mesh-local XY (no own rotation) and `emitRipple(worldX, worldZ)` maps to local `(x, −z, 0.01)`. **Verified with a live cast screenshot: the ripple now expands on the water surface around the bobber.**
5. **Ripple spam** (`Game.update`). `Math.floor(elapsed*2) % 4 === 0` is true for a continuous 0.5s window every 2s — emitting ~30 ripples per window and endlessly recycling the 3-ring pool (each ripple visibly reset instead of expanding). Replaced with a proper countdown timer (one ripple per 2s of waiting).
6. **Ambience never played on first load** (`ThemeManager`/`AudioEngine`). The constructor-time `playAmbience()` runs before the AudioContext exists (gesture unlock) and is silently dropped; nothing retried after unlock, so the ambience loop only ever started after a rank-up theme change. Added `ThemeManager.playCurrentAmbience()` and a one-shot kick in `Game.update` once `audio.isUnlocked()` flips true.
7. **Material leaks**: every non-legendary fish leap cloned tinted materials (`tintModel`) that were never disposed when the leap ended (one leaked material per catch), and `DioramaBuilder`'s ad-hoc lilypad-bud/cloud materials leaked on every theme rebuild. Introduced a `userData.ownedClone` tag on instance-owned materials; leap cleanup and `ThemeManager.disposeGroup` now dispose exactly the tagged materials, leaving shared asset/library materials untouched.
8. **Dead code**: removed `RenderPipeline.setPalette` (a no-op stub with zero callers).

Post-repair verification: `npm run build` clean, Playwright 2/2 (desktop + mobile), zero console errors, live-cast screenshot confirms correct ripple placement, and the bite indicator/full loop still work — the verification pass itself caught a live catch card and BITE prompt in screenshots (the user had been playing in the same preview session, which is its own kind of end-to-end evidence).

---

## Phase 5 — UI/HUD

References loaded: `references/ui-patterns.md`, `references/checklists/game-ui-quality.md`, `references/checklists/hud-readability.md`, `references/checklists/responsive-ui-fit.md`, `references/checklists/mobile-input.md`.

### What was built

Replaced Phase 2's unstyled-functional UI with the full cozy visual pass called for in the plan:

- **Self-hosted font**: installed `@fontsource/baloo-2` (a rounded, chunky Google Font) via npm rather than a CDN `<link>` — the build output shows the woff2/woff files bundled directly into `dist/assets/`, satisfying "bundle a local font file, no CDN fonts" literally, not just via the system-font stack that was already CDN-free by accident.
- **Title screen** (`index.html` `#title-screen`, wired in `UI.ts`): the Phase 3 logo, a tagline, and a "Cast Off!" button; covers the full viewport (including the Cast FAB) until dismissed, so the game doesn't open directly into gameplay without a deliberate first screen.
- **Redesigned HUD**: top-left level/XP card, top-right coin/bait pills (bait pill doubles as a shortcut into the Shop), a vertical icon rail (Shop/Market/Craft/Collection/Settings) using the Phase 3 icon sprites, a bottom-left basket badge (also a Market shortcut), and the existing Cast FAB — all warm-paper panels (`--paper`/`--paper-dark` CSS variables) instead of Phase 2's plain rectangles.
- **Two new modal states**: **Collection** (species log grouped by rarity, discovered entries show name/flavor, undiscovered show "???" — gives the catch table an explicit completion goal) and **Settings** (master/SFX/ambience volume sliders, mute toggle, two-step-confirm Reset Save). Market modal now shows Barnaby's portrait and uses the generated bone icon for patience bones instead of a raw 🦴 emoji.
- **`Economy.resetSave()`** added (thin wrapper over `SaveManager.clear()`) for the Settings reset flow.
- **`UI` constructor now takes `AudioEngine`** so Settings can call `audio.setVolume()`/`setMuted()` directly (in addition to persisting the choice via `Economy.setAudioMix()`), closing the last piece of the audio-settings loop opened back in Phase 2's placeholder `AudioMixState`.

### Bugs found and fixed during verification

1. **The Phase 3 icon sheet's "transparent" background was fake.** Gemini rendered a checkerboard pattern to visually represent transparency, but the PNG's actual alpha channel was fully opaque (`(255, 255)` range checked directly) — using the icons as-is would have shown a gray-and-white checkerboard square behind every icon in the HUD instead of true transparency. Fixed with a proper background-removal pass: flood-filled from each icon cell's border inward wherever pixels matched the checkerboard's near-gray tones (catches the large connected background), then a second global pass for enclosed background pockets not connected to the border (e.g. the gap under the basket's handle, which the first pass alone missed and left as a solid gray patch). Verified by reading each resulting PNG back as an image, not just checking the script ran — the basket handle gap and all icon edges are now genuinely transparent.
2. **A stale Vite dev-server module state broke `UI` construction after adding the `AudioEngine` parameter** — `this.events.on(...)` threw `Cannot read properties of undefined` even though the constructor call and signature matched exactly, and TypeScript compiled clean. This is the same class of issue seen once before in Phase 4 (a `WATER_RADIUS is not defined` error that also resolved on a full dev-server restart). Restarting the preview server (not just reloading the page) fixed it immediately, confirming it was dev-server HMR state, not a code defect — worth remembering as a first troubleshooting step before assuming a genuine bug when a change that "should" work throws a reference error the static types say is impossible.
3. **`preview_click`'s coordinate-based clicks didn't register on HUD rail buttons under the mobile-emulation viewport** (a tooling quirk, not a game bug) — clicking `#btn-market` by CSS selector silently did nothing when the emulated viewport was 375×812, while dispatching a synthetic `click` event directly on the same element worked immediately and the modal opened correctly. Confirmed this wasn't an app-side hit-testing problem by checking `elementFromPoint` (correctly resolved to the button's child `<img>`, which should bubble a real click) and then bypassing the coordinate click entirely. Verification continued via direct event dispatch for the mobile pass.

### Visual scorecard (updated from Phase 4)

```
Visual scorecard:
- Art direction: after 2 (unchanged) - UI now echoes world material language (paper/wood tones, warm accent color) instead of being visually disconnected from the diorama.
- Hero/player: after 2 (unchanged from Phase 4).
- Obstacles/enemies: after 1 (unchanged) - still the genre-mismatch category noted in Phase 4; no UI change addresses this.
- Rewards/interactables: after 2 (unchanged from Phase 4).
- World/environment: after 2 (unchanged from Phase 4).
- Materials/textures: after 2 (unchanged from Phase 4).
- Lighting/render: after 2 (unchanged from Phase 4).
- VFX/motion: after 2 (unchanged from Phase 4).
- UI/HUD: before 1 / after 2 - evidence: genre-specific HUD states (title, gameplay, 5 modals, settings, collection), icons throughout, safe-area/responsive text fit verified on both desktop and mobile screenshots, no generic stat-card dashboard remaining, self-hosted rounded font matching the cozy tone.
- Performance evidence: after 2 (unchanged from Phase 4).
Average: 1.9 (was 1.8 after Phase 4)
Automatic failures remaining: none of the hard-fail conditions apply.
```

**Premium gate: still not passed, by a narrow and well-understood margin.** Nine of ten categories are now at the individual-category premium bar (2/3). The tenth — `Obstacles/enemies` — sits at 1 because the category has no clean mapping onto a cozy fishing game with no combat/hazards; even if it were excluded from the average entirely, the remaining nine categories average exactly 2.0, still short of the 2.3 premium average (reaching that would need several categories to reach 3, i.e. showcase-tier polish, which neither Phase 4 nor Phase 5 were scoped to chase — the plan's own quality bar for these phases was "every category at least 2," which is met everywhere except the one genre-mismatched slot). This isn't glossed over: the honest state is "premium-quality per-surface, not premium-average," and the reason is named rather than the number massaged to clear a threshold.

### Verification evidence

- `npm run build` clean; font files confirmed bundled locally in build output (no CDN).
- `npm run test` (Playwright desktop-chrome + mobile-safari) — 2/2 passed, updated to dismiss the new title screen first.
- Every modal (Shop, Market, Craft, Collection, Settings) opened and screenshotted on both desktop and mobile; Shop's scroll-past-the-fold content (fishbots/hopper) verified reachable; Market's basket-item text wrapping on narrow mobile widths confirmed non-clipping.
- Settings volume changes verified to persist through `economy.persist()` immediately (not just on next autosave tick) and survive a full page reload, checked by reading `localStorage` directly before and after.
- Reset Save's two-step confirm verified to require a second tap before wiping the save (did not complete the actual reset during testing, to preserve the play-tested state for the rest of the session).
- Icon transparency verified by reading each generated icon PNG back as an image after the fix, not just trusting the script's reported pixel counts.

### Remaining gaps for later phases

- **`Obstacles/enemies` stays at 1** — as discussed, this is a genre-mapping limitation, not a missed task. If more fish-species 3D variety is ever added (Phase 3 budgeted only 2 unique models across ~20 species), this could improve, but it's an asset-generation lever, not a UI one.
- **No animated UI transitions** — modals snap open/closed, meters don't count up, no slide/fade on state changes. The `ui-patterns.md` reference calls these out as expected for a "3" score; they were not implemented this phase (time/scope tradeoff), so `UI/HUD` sits at a solid 2 rather than 3.
- **The market/shop cost labels still use the raw 🪙 emoji inline** in a few cost strings (e.g. "80🪙, 2 wood") rather than the generated coin icon consistently — the coin icon *is* used in the HUD pill and catch card, just not threaded through every inline cost string in modal body text. Minor polish item, not fixed this phase.
- **Two tooling quirks are now documented for future sessions**: dev-server HMR state can produce reference errors that look like real code bugs after certain constructor-signature changes (restart the server before deep-diving), and `preview_click`'s coordinate clicks can silently miss under mobile-viewport emulation (dispatch a synthetic event directly on the element to disambiguate a tool issue from an app issue).

---

## Post-Phase-5 fixes (user-reported)

The user spotted two live issues after playing: persistent shadow flicker/"ripping" specifically under the market stall and along the far shoreline (visible during play, hard to catch in a single screenshot), and Barnaby still not actually facing the camera despite the Phase 4 fix being verified at the time.

1. **Shadow acne on the flat terrain, still visible after the Phase 4 VSM fix.** Root cause identified more precisely this pass: the terrain's top layer is thousands of adjacent same-height `InstancedMesh` cube faces — a perfectly flat surface with no real geometric relief, which is the worst case for shadow acne (there's no true self-occlusion to resolve, only floating-point depth-precision noise at the coplanar seams). The prior `normalBias: 0.025` reduced but didn't clear it, especially under the market stall (dense overlapping casters: roof, counter, Barnaby) and near the shadow frustum's far edge (the back shoreline). Pushed `normalBias` to `0.09` (from 0.025) and `bias` to `-0.0004`. **First attempt also raised `blurSamples` to 16 and `radius` to 6 for extra softness — this measurably slowed rendering enough to make Playwright's own screenshot capture time out (`page.screenshot: Test timeout of 30000ms exceeded`), a real, reproducible regression caught by the test suite, not a flake (failed identically on a second run).** Reverted `blurSamples`/`radius` to their prior values (8/4) since the acne fix comes from `normalBias`, not blur sample count — confirmed the shadows stayed clean across multiple screenshots spanning a full camera-drift cycle with the cheaper blur settings, and the Playwright suite passed 2/2 again afterward.
2. **Barnaby still wasn't facing the camera.** The Phase 4 architect-review fix (`rotation.y = Math.PI - 0.15`, verified at the time via an isolated bright test scene) turned out not to hold up in the actual diorama — trusted the user's live observation over the earlier isolated test and applied the requested correction directly: rotated 100° further counterclockwise (`Math.PI - 0.15 + 100°` in radians). Verified visually — his muzzle and apron now clearly face the camera.

Verification: `npm run build` clean, `npm run test` 2/2 passing (confirming the performance regression was actually fixed, not just visually patched), and multiple screenshots across a full idle-camera-drift cycle show stable shadows with no visible banding under the stall or along the shoreline.

## Polish Pass

- **Terrain & Water Z-Fighting**: Removed the overlapping `basinRimCells` layer to cure the "flashing" at the pond's edge and under the stall.
- **Pond Bottom**: Added a solid floor layer to the terrain below the pond surface, stopping the bright skybox from showing through the water's transparency.
- **Dock & Market Layout**: Narrowed and extended the dock landward with a step. Added a new dock lantern. Scaled down the market stall and shifted it firmly onto the grass.
- **Ripples bounding**: Constrained the expanding bobber ripples based on their distance to the pond center, fading them before they cross the boundary (fixing the "invisible edge" cutoff). Corrected `renderOrder` to prevent the water mesh drawing over them.
- **Barnaby Animation**: Scaled Barnaby down to `1.1`. Executed the Tripo `character-pipeline` to generate `idle` and `walk` FBX clips. Configured an `AnimationMixer` in `Game.ts` to play the clips on a procedural randomized patrol loop across the front of the stall.
- **Ambience & Sky Dimming**: Regenerated the `ambience-forest.mp3` via ElevenLabs using a prompt tailored for frogs/crickets and actively excluding high-pitched whining. Dropped `scene.backgroundIntensity` to `0.65` and raised the post-processing bloom threshold from `0.82` to `0.9` to prevent the background sky plate from overpowering the scene.

## Sprite Pass

Generated real 2D sprites for every catalog item (fish, trash, bait, upgrades, fishbots, materials, and the two specials) and wired them into the UI, per `plan-sprites.md`.

**Inventory**: derived fresh from `src/game/data.ts` at execution time — 25 fish (incl. the 5 make-believe, minSkill-gated species), 6 trash, 4 bait, 8 upgrades, 2 fishbots, 6 materials, plus `lucky-ducky` and `treasure` (Sunken Coin Purse) = 53 sprites total. Golden/Salvaged/Double-Catch variants were intentionally **not** given separate sprites — they're runtime name prefixes only.

**Generation**: 9 sheets via Gemini (`threejs-image-generator`, 2K resolution, 2×3 grid layout, plain white background per sheet — not "transparent," which bakes a fake opaque checkerboard). A fixed style-prefix prompt (cozy flat-pastel, chunky rounded shapes, thick dark-brown outlines) kept all 53 sprites visually consistent. Every sheet was visually verified cell-by-cell against the intended manifest (`assets-src/sprites/manifest.md`) before slicing. Two sheets needed one regeneration each:
- **Sheet 07** (`special-upgrades`): the `led-bobber` cell rendered with a center button and black banding that read as a Pokéball rather than a fishing bobber — re-prompted with explicit "no center button, no black band, not a toy ball" language.
- **Sheet 08** (`upgrades2-fishbots-material`): Gemini ignored the 2×3 layout entirely and produced an 8-item 4×2 grid, including two items (a goldfish, a cat/otter) that map to no catalog id. Re-prompted with "EXACTLY 6... strict 2 rows by 3 columns... no extra items" — regeneration came back correct.

Both regenerated sheets, and all 7 originally-correct sheets, were re-verified against the manifest before slicing.

**Slicing**: wrote a reusable `fish-and-chat/scripts/slice_sprites.py` (PIL + numpy) — grid-splits each sheet, removes background via two-pass flood fill (border-connected regions, then a global pass for enclosed pockets like the basket handle gap), tight-crops with padding, downscales to ≤256px longest side (LANCZOS), and quantizes to a 256-color palette (`Image.Quantize.FASTOCTREE`) to control payload size. Verified every sprite's alpha channel is real (`getchannel('A').getextrema()` not `(255,255)` for all 53 files) and spot-checked several (duck, basket, chrono-carp's glow aura) for clean edges. Emitted `src/assets/spriteManifest.ts` (generated id→URL map).

**Payload**: 53 PNGs, 684KB total (well under the ~1.5MB target) — quantization brought this down from an initial 3.3MB.

**UI wiring** (`src/ui/UI.ts`, `src/styles.css`): added a `spriteFor(id)` lookup with graceful fallback to the existing generic icons (never a broken `<img>`).
- Catch card: sprite (~72px, `.catch-sprite`) added above the name — verified via a live debug-perfect-cast catch (Lantern Catfish) that the correct sprite renders in the non-hidden card.
- Shop: bait rows and fishbot rows now show real sprites in place of the generic bait-can icon.
- Market: basket rows (both fish and trash) show per-item sprites.
- Crafting Bench: upgrade rows, the Lucky Ducky consumable row, and material stash chips all show real sprites.
- Collection: added sprites to every entry; undiscovered entries render the sprite as a silhouette (`filter: brightness(0); opacity: 0.35` via a new `.sprite-silhouette` class) instead of a bare "???" — verified visually (boot/can shapes recognizable but obscured, "???" label intact).

**Verification**: `npm run build` clean (fixed one unrelated pre-existing `noUnusedParameters` TS error in `showRecycleRollText` while in the file). Playwright: mobile-safari passes 2/2 runs; **desktop-chrome fails on a cast-lock timeout (`state === 'waiting'` never reached) — confirmed via `git stash` that this reproduces identically on the pre-sprite-work code, so it's a pre-existing regression, not caused by this pass.** Flagging for the still-open Phase 6 QA task rather than fixing here (out of scope for sprite wiring). Manually verified every modal (Shop, Market, Craft, Collection) on desktop and a mobile-viewport spot-check via screenshots; zero console errors/warnings; zero failed network requests (checked via the network panel after opening every modal).

**Gaps**: none of the 53 catalog ids are missing a sprite. `treasure`'s catch-card sprite works (confirmed the manifest has an entry and `CatchResult.catchId` flows straight to `spriteFor()`, bypassing the catalog-lookup gap that would otherwise miss it), though `treasure` still never reaches the basket/Market per existing `CatchResolver.ts` logic (`addedToBasket: false`, a pre-existing gap unrelated to sprites).

## Player Character

Executed `plan-character.md` end to end: a customizable Minecraft-skin-style voxel character that stands/wanders in the diorama, walks, fishes in sync with real gameplay state, waves on a good catch, wears clothing bought with coins+materials or the existing candy-bar premium currency, and displays a name tag.

**Ported model + animation engine** (`src/entities/character/PlayerObject.ts`, `animations.ts`): adapted from [skinview3d](https://github.com/bs-community/skinview3d) (MIT, attribution comment retained in both files) — the `PlayerObject`/`SkinObject`/`BodyPart` box-rig and the `PlayerAnimation` base class + `IdleAnimation`/`WalkingAnimation`/`WaveAnimation`. Cut cape/elytra/ears entirely (unused). **Deliberately not `npm install`ed**: upstream pins `three@^0.156.0` as a hard dependency against this project's `^0.184.0`, which would risk a duplicate three.js bundle — vendoring the source and pointing it at our own `three` import avoided that. Verified post-hoc with `npm ls three`: exactly one resolved version.

**New `FishingAnimation`** (`animations.ts`): the one genuinely new animation, authored using the ported classes as a template. Exposes a `pose: 'aiming' | 'casting' | 'waiting' | 'bite'` field that `Game.ts` sets from the real `FishingStateMachine` phase via the existing `phaseChanged` event — not decorative. Verified empirically (not just by inspection): a throwaway Playwright script read the character's right-arm rotation live during a real cast and confirmed it matched the animation's formulas exactly (`aiming`: measured `-1.865` vs. formula `-1.9 ± 0.04`; `waiting`: measured `-1.117` vs. `-1.15 ± 0.06`), both clearly distinct from the idle rest pose (`0`).

**Scene integration**: a new `playerSlot` in `DioramaBuilder.ts` (own patch of bank at `(2.2, 0.5, -2.3)`, opposite side of the pond from Barnaby's stall, with a matching `STRUCTURE_EXCLUSIONS` entry), re-attached on theme rebuild exactly like the existing `barnabySlot`/`fishbotSlot` pattern. A `PlayerCharacter` wrapper (`src/entities/character/PlayerCharacter.ts`) owns pose-switching, a wander loop pattern-matched to Barnaby's hand-rolled walk-to-target timer, and a canvas-sprite name tag floating above the head.

**Clothing = texture compositing, not separate meshes**: the Minecraft skin format's base+overlay layers per body part *are* the clothing system. `skinLayout.ts` hard-codes the exact UV rectangles implied by the ported geometry (not re-derived); `compositeSkin.ts` draws a base-tone fill plus each equipped item's overlay patch into a `THREE.CanvasTexture`. Clothing art (`scripts/make_clothing_textures.py`) is hand-scripted flat-color PIL rectangles with simple shading, not Gemini/Tripo-generated — placement needs pixel-exact UV alignment, a precision task, not a generative one. Hats cover top/left/right/back fully but only the forehead portion of the front face, leaving the face visible. Pants and shoes share the leg overlay rectangle (upper thigh rows vs. lower ankle rows) so both can be equipped independently without clobbering each other.

**Catalog integration — reused the existing candy-bar system rather than forking it**: mid-implementation, discovered the codebase already has a `PREMIUM_CATALOG` entry (`party-hat`, "A cosmetic hat for your angler") plus a full Twitch/Muxy monetization layer added externally during this session. Rather than creating a parallel ownership system, `ClothingDefinition.unlock` is a discriminated union (`{ type: 'craft', coins, materials }` or `{ type: 'premium', premiumId }`) — the `party-hat` clothing entry defers entirely to the existing `Economy.ownsPremiumItem`/`buyPremiumItem` flow. `CLOTHING_CATALOG` (9 items: 3 hats, 2 jackets, 2 pants, 2 shoes) and `BASE_TONE_CATALOG` (5 presets, playfully named — "Sunfish Tan," "Moonlit Pale," etc.) follow the exact `UPGRADE_CATALOG`/`SaveState`/`Economy`/`CraftingSystem` layering already established (catalog → save-state fields → `Economy.buyX`/`equipX` → `CraftingSystem` thin wrapper emitting events → `UI.ts` renders/binds).

**Real Twitch identity, not just a stub**: also discovered mid-implementation that `TwitchAuthSystem.ts` (Twitch Extension Helper + EBS profile lookup) and `CharacterStateStore.ts` (a remote-sync seam whose `CharacterState` interface exactly matches the four fields this phase added to `GameSaveStateV1` — not a coincidence, evidently the same plan was being read by whatever added it) already existed. `Economy.displayName()` now prefers a manually-set local override (explicit rename, should stick), then the Twitch-resolved name via a new `Economy.setTwitchDisplayName()` called from the existing `twitchIdentityResolved` listener in `Game.ts`, then a generic "Angler" fallback for contexts with neither (local dev, Playwright). The Settings modal gained a text input (`#input-display-name`) — the only new *text* input in the UI, everything else was sliders/checkboxes.

**Closet UI** (`UI.ts` `renderCloset()`): new `'closet'` modal following the `renderShop()` row pattern exactly (owned items show Equip/Unequip, locked items show cost + a Buy button disabled via the same afford-check style as the crafting-bench redesign). Base-tone picker is a row of circular color swatches. Character preview reuses the existing single renderer/scene — opening the closet dollies the main `CameraRig` onto the player's slot via `closetOpened`/`closetClosed` events (no second `THREE.WebGLRenderer`), reverting to the default focus point on close.

**Verification**: `npm run build` clean throughout. `npm run test` shows the same two pre-existing failures as the sprite phase and no others (confirmed via `git stash` of just this phase's tracked changes) — `desktop-chrome`'s cast-lock/screenshot timeout, and a `mobile-safari` console-error assertion that fails on the *externally-added* MuxySystem's CDN load failure (unrelated to this phase; reproduces identically with this phase's changes stashed away). Manually verified end-to-end in-browser: skin texture composites and applies correctly (confirmed via direct canvas pixel readback, not just visual inspection — the beanie's exact computed RGB `(225,52,52)` was found at the expected texture coordinate after equip), the Closet purchase→equip flow updates the live character, base-tone swatches, the name tag renders and reads "Angler" by default, and mobile-viewport layout holds up. One environment quirk hit and worked around: this session's browser preview tool reported `document.hidden === true` throughout (rAF fully suspended, frame counter frozen), making time-based animation checks unreliable there — worked around by using a throwaway Playwright script (real, properly-focused browser) for the one check that needed real elapsed time, and canvas/DOM state inspection (no elapsed-time dependency) for everything else.

**Scope cuts, noted rather than silently dropped**: no slim-arm model variant (only "default" body type). No cape/elytra. Wave-on-catch is wired via the same simple event hook proven for pose-sync but wasn't independently re-confirmed with a live timed test (the underlying mechanism — an event listener calling `setPose('wave')` — is low-risk and shares its proof with the already-confirmed pose-sync mechanism). The wander loop's live animation over real elapsed time wasn't directly observed for the same environment reason above, though its position/rotation math was verified by code inspection and the identical `Barnaby` pattern it mirrors is known-working in production.

## Player Character — follow-up (live preview, starter outfit, dock placement)

Three follow-up requests: a live view of the character in the Closet, a default starter outfit so the character isn't bare on first load, and moving the character onto the dock to visibly fish into the water.

**Starter outfit**: added three free (`coins: 0`) `CLOTHING_CATALOG` entries — `basic-shirt`, `basic-pants`, `basic-shoes` — with new flat-color overlay textures via the same `make_clothing_textures.py` script. `createDefaultSaveState()` now pre-populates `ownedClothingIds` and `equippedClothing` with these three, so a fresh save starts dressed rather than bare-skinned. Existing saves are unaffected (only the *default* state changed, not a migration).

**Moved onto the dock**: `playerSlot` in `DioramaBuilder.ts` now sits at world `(1.4, 0.51, 1.65)` — on the dock's own plank line (`x=1.4`), near its water end (the dock's local z range maps to world z=1.5–3.75; z=1.5 is the *exact* z the bobber casts at), clear of the existing fishbot slot at z=2.05. Rotation is `Math.PI` so the character faces -Z, out toward the pond (derived from the wander code's own `atan2(dir.x, dir.z)` convention, where forward at rotation 0 is `+Z`). The old separate bank-position exclusion zone was removed — the dock's existing exclusion already covers the new spot. The wander logic's bounds check was rewritten from a circular pond-distance test to a small rectangle sized to the dock's actual 0.9-wide planks (`±0.2` lateral, biased landward off the water-end edge), so idle wandering can't step off the sides or the end.

**Live Closet preview**: a second render of the *same* scene (no second `THREE.WebGLRenderer`, no DOM-to-canvas coordinate-mapping) from a dedicated close-up `PerspectiveCamera`, into an offscreen `WebGLRenderTarget`, read back via `readRenderTargetPixels` into a plain 2D `<canvas id="closet-preview">` inside the modal every frame the closet is open. Hit one real bug getting there: the initial readback came out very dark — a `WebGLRenderTarget`'s working color space is linear by default (the sRGB output transform normally only applies on the final canvas blit), so reading it back raw and drawing it into a 2D canvas looked washed out. Fixed by setting `closetRenderTarget.texture.colorSpace = THREE.SRGBColorSpace`, confirmed by screenshot before/after (correct skin-tone/shirt/pants colors visible after the fix, near-black before). While the closet is open, the character's wander offset and local rotation are reset to a canonical camera-facing pose (frozen, not just visually covered) so the preview is always a clean, consistent shot rather than whatever mid-wander pose it happened to be in.

**Verification**: `npm run build` clean. Manually verified in-browser: character visibly relocated to the dock's water end in the main view; Closet preview shows correct colors (starter shirt/pants, name tag) after the color-space fix; fishing pose sync spot-checked again post-move (`aiming` right-arm rotation measured at `-1.86`, matching the `FishingAnimation` formula `-1.9 ± 0.04` as before — confirms the reposition didn't break the phase-sync mechanism). **Could not run `npm run test`** this pass — another active session's dev server already holds port 5188, and Playwright's config hardcodes that exact port for its own server with `reuseExistingServer: false`; killing someone else's running server to free the port wasn't an acceptable tradeoff for a routine verification run. Flagging rather than silently skipping — the previous pass's two known-pre-existing failures (desktop-chrome timeout, mobile-safari Muxy console error) are presumed still present and unaffected by this change, but that presumption is unconfirmed by this pass.
