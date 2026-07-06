# Fish and Chat — Voxel Cozy Edition: Implementation Plan

**Role of this document:** Step-by-step build instructions for the implementing model (Sonnet).
Written by Fable (architect pass). Execute phases in order; each phase has done-criteria.
Do not skip the reference-loading steps — the threejs skills treat them as phase gates.

---

## 0. Context & Ground Rules

- Project root: `/Users/jared/Code/Fish & Chat 2/` (note the spaces — always quote paths).
- Design source: [game_design_document.md](game_design_document.md). It describes a Twitch
  extension; **we are building a standalone browser game instead**. Skip ALL of section 4
  (Muxy/Twitch SDK). Persistence = `localStorage` under key `fish-and-chat-save-v1`.
- Art direction: **cozy voxel diorama**. A floating voxel island with a pond, viewed from a
  fixed-orbit 3/4 camera. Chunky cube-based world, soft pastel palette, warm lighting,
  gentle idle animations (bobbing lilypads, drifting clouds, fireflies at dusk).
  Rank themes from the GDD map to three diorama skins: `forest-pond` → `ocean-trench` →
  `cosmic-lake`.
- Tech: Vite + TypeScript + Three.js (from the packaged scaffold, see Phase 1).
- API keys: all three are exported in `~/.zshrc` and confirmed working:
  `TRIPO_API_KEY`, `GEMINI_API_KEY`, `ELEVENLABS_API_KEY`.
  Non-interactive shells may not see them. Wrap every generator call like:
  ```bash
  zsh -c 'source "$HOME/.zshrc" 2>/dev/null; <command>'
  ```
  Credential probe (paste its output into the final report):
  ```bash
  bash ~/.claude/skills/threejs-game-director/scripts/probe_asset_credentials.sh
  ```
- **ElevenLabs key caveat (verified):** the key is permission-scoped. `/sound-generation`
  works (tested, returned a real MP3). `/user`, `/models`, `/voices` return 401
  (missing read permissions). Therefore: use the audio script's `sfx` subcommand only;
  do NOT rely on its `probe`/user-info call and do NOT try TTS voice listing. If a
  TTS/voice call 401s, log it as a blocker and move on — SFX + ambience are the priority.
- Skill install root: `~/.claude/skills/`. All 9 threejs skills live there.
- Budget discipline: Tripo and Gemini calls cost real credits. Stick to the asset lists in
  Phase 3 — do not generate extras without being asked. Retry a failed generation at most
  once, then record the failure and fall back to procedural.

## 0.1 Ledgers (fill as you go, include in final report)

The director skill requires these. Keep a running scratch copy in `report.md` at project root:

1. **Skill-loading ledger** — which SKILL.md files you read, with paths.
2. **Reference ledger** — each required reference: yes/no + path (list in each phase below).
3. **External asset sourcing ledger** — per surface: procedural / image-gen / 3d-gen / hybrid,
   with task IDs & output paths or blocker evidence.
4. **Phase ledger** — pending/running/done + evidence per phase.

Final audit before claiming completion:
```bash
python3 ~/.claude/skills/threejs-game-director/scripts/audit_reference_report.py --premium --audio report.md
```

---

## Phase 1 — Scaffold & Project Setup

**Load first:** `~/.claude/skills/threejs-gameplay-systems/SKILL.md` and
`~/.claude/skills/threejs-gameplay-systems/references/gameplay-workflows.md` and
`~/.claude/skills/threejs-gameplay-systems/references/checklists/new-game-definition-of-done.md`.
(Physics reference is **not needed**: no rigid-body physics — record as `not-needed,
custom arcade timing/collision only` in the reference ledger.)

1. Scaffold:
   ```bash
   python3 ~/.claude/skills/threejs-gameplay-systems/scripts/create_threejs_game.py "/Users/jared/Code/Fish & Chat 2/fish-and-chat"
   ```
2. `cd "/Users/jared/Code/Fish & Chat 2/fish-and-chat" && npm install && npm run build` — confirm the scaffold builds clean before touching it.
3. Rename in `package.json`: `fish-and-chat`. Strip scaffold demo entities/gameplay you
   won't use, but KEEP its loop/renderer/resize/inspect plumbing and
   `scripts/inspect-threejs-canvas.mjs` + `npm run inspect:canvas`.
4. Create `.claude/launch.json` in the **project root** so preview tools can start the dev server:
   ```json
   {
     "version": "0.0.1",
     "configurations": [
       {
         "name": "fish-and-chat",
         "runtimeExecutable": "npm",
         "runtimeArgs": ["run", "dev", "--prefix", "fish-and-chat"],
         "port": 5173
       }
     ]
   }
   ```
   (Check the scaffold's actual dev port in its `package.json`/vite config and match it.)

**Architecture** (create these directories under `fish-and-chat/src/`):

```
core/      — engine loop, renderer, camera rig, input, save/load, audio engine, event bus
game/      — GameState machine, economy, loot tables, progression/XP, theme manager
entities/  — Bobber, FishShadow, Fishbot, MongerBarnaby, props
systems/   — CastingSystem, BiteSystem, CatchResolver, MarketSystem, CraftingSystem,
             FishbotSystem, ParticleSystem (splash/sparkle), DayNightAmbience
world/     — VoxelKit (procedural voxel builders), DioramaBuilder, themes/ (3 theme configs)
assets/    — manifest.ts (paths + metadata for generated GLBs, images, audio)
ui/        — HUD, modals (Shop, Market, Crafting, Collection/Log), CatchCard, toasts
```

**Update order (explicit, in the main loop):** input → state machine tick → systems →
entities → particles → camera → render. Keep hot paths allocation-free (reuse vectors).

**Done when:** scaffold builds, dev server runs, canvas renders non-blank, directory
skeleton exists, save/load round-trips a dummy state through localStorage.

---

## Phase 2 — Core Gameplay Loop (playable slice, procedural placeholder visuals)

One-sentence loop: *Time your cast, react to the bite, catch fish of escalating rarity,
sell them to Barnaby, and spend the coins on bait and permanent upgrades.*

### 2.1 State machine (`game/GameState.ts`)

`IDLE → AIMING(cast gauge) → CASTING(anim) → WAITING(bobber) → BITE(reaction window)
→ RESOLVING → CELEBRATING(catch card) → IDLE`, plus `MISSED` (too early/late → back to IDLE
with a gentle "it got away…" toast — cozy, never punishing).

- **Cast gauge:** oscillating slider (sine, ~1.2s period). Click/Space/tap locks it.
  Precision = 1 − |value − sweetspot|. Precision scales cast distance (bobber lands
  further = small loot-quality bonus, +0–10 effective skill).
- **Wait time:** base 6–14s random, multiplied by bait modifier and LED Bobber (−20%).
  During WAITING, small ripple rings pulse around the bobber every ~2s.
- **Bite:** bobber dunks + "BITE!" burst + audio cue. Reaction window: base 900ms,
  +150ms per Carbon Rod tier, +skill bonus (see 2.3). React with same button.
- **Resolve:** roll the loot table (2.2) with effective skill; compute weight
  (per-species range, rare rolls skew heavy), XP, and add to basket.

### 2.2 Data tables (`game/data.ts`) — single source of truth, typed

Rarities & weights at skill 0 → shift with effective skill S (0–100+):
```
trash:     35 − 0.20·S   (floor 8)
common:    40 − 0.10·S   (floor 20)
uncommon:  15 + 0.05·S
rare:       7 + 0.12·S
epic:       2.5 + 0.08·S
legendary:  0.5 + 0.05·S   (Sonar Scanner upgrade: ×1.5 on rare+epic+legendary, renormalize)
```
Normalize to 100 at roll time. Effective skill = playerLevel·2 + baitSkill + castPrecisionBonus.

Species: define **18 fish** (3 per rarity above trash is fine: 5 common, 5 uncommon,
4 rare, 3 epic, 3 legendary — adjust freely) + **6 trash items** (boot, tin can, driftwood,
soggy hat, tangled line, bottle). Each entry: id, name, rarity, weightRange, baseValue,
flavor text (one cozy sentence), theme affinity (some species only appear in ocean/cosmic
themes — gives progression flavor).

Bait (from GDD): Pleb (free, ×1.0 wait, +0), Marshmallows (25🪙, ×0.85, +15),
Nightcrawlers (100🪙, ×0.75, +25), Neon Super Lure (500🪙, ×0.5, +50). Bait is consumed
per cast (buy in stacks of 10; Pleb infinite).

Upgrades (crafting bench — GDD 2.5): Carbon Rod (reaction window), LED Bobber (wait −20%),
Turbo Bot Chip (fishbot interval −30%), Heavy Duty Basket (+6 slots), Tackle Apron (+6 more),
Salvage Magnet (30% double materials), Insulated Cooler (+15% sale value),
Sonar Scanner (rarity boost). Each costs credits + materials (materials come from
recycling trash: boot→rubber, can→metal, driftwood→wood, etc.). Pick sensible costs;
tune so first upgrade lands within ~10 minutes of play.

Basket: 8 slots base. Full basket blocks casting → nudge toward market (gentle toast).

XP/levels: XP per catch = baseValue·rarityMult. Level curve `xpToNext = 40·level^1.4`.
Rank tiers drive theme: level 1–9 `forest-pond`, 10–19 `ocean-trench`, 20+ `cosmic-lake`.

### 2.3 Market — Monger Barnaby (`systems/MarketSystem.ts`)

Modal with Barnaby portrait (generated in Phase 3). Sell flow per GDD 2.4:
- **Sell Now** = market value. **Haggle** = risk 1 Patience Bone for +20%. **Desperate** =
  risk 2 bones for +50%. Barnaby starts each visit with 3 bones. Failed roll (haggle 35%
  fail, desperate 60% fail) burns the bones; at 0 bones he only pays 70% for the rest of
  the visit. Bones reset when you leave and fish for a while (2+ catches).
- Sell individually or "sell all commons/trash" convenience button.

### 2.4 Fishbots (`systems/FishbotSystem.ts`)

Mk I (shop, 750🪙): auto-catch on a 45s timer while the game is open, common-tier bias,
deposits into a 10-slot hopper (claim button in HUD). Mk II (2500🪙): 30s, uncommon bias.
Turbo Chip: −30% interval. Offline progress: on load, simulate elapsed time capped at 2h.
Visually: a tiny voxel robot on the dock with its own mini rod, casts on its timer.

**Done when:** full loop playable with keyboard + mouse + touch, placeholder voxel-box
visuals fine, state saves/restores, `npm run build` clean, no console errors, canvas
inspection passes. Fill the new-game definition-of-done checklist.

---

## Phase 3 — External Asset Generation (Tripo / Gemini / ElevenLabs)

**Load first:**
- `~/.claude/skills/threejs-3d-generator/SKILL.md` + `references/api-notes.md` + `references/threejs-integration.md` + `references/image-generator-workflows.md`
- `~/.claude/skills/threejs-image-generator/SKILL.md` (already summarized: script is `uv run ~/.claude/skills/threejs-image-generator/scripts/generate_image.py`)
- `~/.claude/skills/threejs-audio-generator/SKILL.md` + `references/audio-workflows.md`

Run the credential probe first and record output. Save all assets INSIDE
`fish-and-chat/` per the layout below. Generate in this order (images first — some feed 3D).

### 3.1 Gemini images (`uv run ~/.claude/skills/threejs-image-generator/scripts/generate_image.py --prompt "..." --filename <path> --resolution 2K`)

Save under `fish-and-chat/assets-src/` (source art, then copy/convert what ships into `public/`):

| # | Asset | Purpose | Prompt guidance |
|---|-------|---------|-----------------|
| 1 | `concepts/style-sheet.png` | Art direction anchor | Cozy voxel fishing diorama concept: floating island pond, pastel palette, chunky voxels, warm dusk light, lilypads, tiny dock. No text. |
| 2 | `concepts/monger-barnaby.png` | Image→3D input + market portrait | Full-body voxel-style walrus fishmonger in apron, centered, plain light background, readable silhouette, clear material zones, no text. |
| 3 | `ui/logo-title.png` | Title screen | "Fish & Chat" cozy wooden-sign game logo, voxel/chunky style, transparent-friendly, high contrast. |
| 4 | `sky/forest-pond.png`, `sky/ocean-trench.png`, `sky/cosmic-lake.png` | Theme backdrop plates (equirect-ish wide plates used on a large background sphere or gradient dome blend) | Wide painterly background plate, layered depth, readable horizon, no foreground subject. Forest: warm sunset over pines. Ocean: teal underwater god-rays. Cosmic: aurora nebula over dark water. |
| 5 | `ui/icons.png` | HUD icon sheet (coin, bait, basket, hammer, scale, bones) | Crisp cozy game icon sheet, 6 icons on grid, flat pastel, high contrast at 32px, no text. |

Record every prompt + path in the asset ledger. Use icons/logo as real `<img>`/CSS assets;
slice the icon sheet with CSS `background-position` or just generate-and-crop via a quick
script if cleaner.

### 3.2 Tripo 3D models (`python3 ~/.claude/skills/threejs-3d-generator/scripts/threejs_3d_asset.py`)

All static (no rigging — fish "swim" via code: sine wiggle + path following; Barnaby idles
via code bob. This avoids the rigging/animation credit + failure surface entirely).
Style gate: after base generation, run the voxel stylize postprocess on each
(`postprocess --type stylize_model --style voxel` — check `api-notes.md` for exact flag
names and whether `--block-size` is wanted; if stylize output loses too much charm on the
tiny fish, keep the low-poly base and note it in the ledger).

Keep it to **5 generations** (hero surfaces only; everything else is procedural voxel kit):

| # | Asset | Command sketch |
|---|-------|----------------|
| 1 | Monger Barnaby (from concept #2) | `image --image assets-src/concepts/monger-barnaby.png --smart-low-poly --wait --download --out-dir assets-src/models/barnaby` |
| 2 | Legendary fish "Prism Koi" | `text --prompt "voxel-style koi fish, crystalline rainbow scales, chunky cube segments, game asset, single object" --smart-low-poly --face-limit 8000 --wait --download` |
| 3 | Generic fish (recolorable base for species tinting) | `text --prompt "simple cute voxel fish, chunky cubes, neutral gray-white body, big eye, game asset"` — tint per-species via material color at load |
| 4 | Fishbot Mk I | `text --prompt "tiny cute voxel robot with a fishing rod, rounded cube body, single antenna, pastel teal, game asset"` |
| 5 | Old boot (hero trash item for catch card) | `text --prompt "voxel old leather boot, worn, chunky cubes, game asset, single object"` |

For each: record task ID + downloaded GLB path in the ledger. Load via GLTFLoader,
verify scale/orientation in-scene, set `castShadow/receiveShadow`. Budget check: keep
each under ~10k tris (use `--face-limit`/`smart_low_poly`; convert/lowpoly postprocess if over).

**Fallback:** if a Tripo task fails twice, build that asset from the procedural VoxelKit
and record the task IDs + error as blocker evidence. At least ONE hero surface must ship
with a real Tripo GLB for the premium gate — prioritize Barnaby, then the fish.

### 3.3 ElevenLabs audio (`python3 ~/.claude/skills/threejs-audio-generator/scripts/threejs_audio_asset.py sfx ...`)

Output to `fish-and-chat/public/audio/`. Remember: `sfx` subcommand only (key is scoped).
Wrap in the zshrc-sourcing shell. Suggested set (~11 files):

SFX (`--prompt-influence 0.65`, durations 0.4–2s):
`cast-whoosh`, `bobber-splash`, `bite-alert` (bright friendly "boop-boop"), `reel-in`,
`catch-jingle` (soft marimba arpeggio), `rare-catch-fanfare` (warm chimes swell),
`coin-clink`, `ui-click` (soft wooden tap), `craft-clunk` (workbench wood + metal tap),
`haggle-bones` (light bone rattle).

Ambience (`--loop --duration 14 --prompt-influence 0.45`), one per theme:
`ambience-forest` (evening pond, crickets, gentle water lapping, distant owl),
`ambience-ocean` (soft underwater hum, muffled bubbles, whale far away),
`ambience-cosmic` (dreamy shimmering pad, sparse twinkles, calm).

Runtime (`core/AudioEngine.ts`): Web Audio, unlock on first user gesture, groups
{master, sfx, ambience} with volume + mute persisted in the save. Crossfade ambience 2s on
theme change. Every state transition in Phase 2 emits an event; AudioEngine subscribes —
no direct `play()` calls from game logic.

**Done when:** ledger rows all filled (output path or blocker evidence per row), assets
load in-game without console errors, audio matrix documented in `report.md`.

---

## Phase 4 — Voxel World & Graphics Polish

**Load first:** `~/.claude/skills/threejs-aaa-graphics-builder/references/visual-scorecard.md`,
`implementation-blueprint.md`, `model-recipes.md`, `render-recipes.md`, and both checklists
under `references/checklists/` (`aaa-game-quality-gate.md`, `aaa-visual-scorecard.md`).

1. **VoxelKit** (`world/VoxelKit.ts`): helper that builds merged/instanced voxel meshes from
   small int grids (use `InstancedMesh` of a shared rounded-box geometry, per-instance color).
   Build: island terrain (grass/dirt/stone layers with irregular cozy edges), pond basin,
   wooden dock (planks + posts), Barnaby's market stall (awning, crates, hanging fish),
   crafting bench, lantern posts, trees (forest), coral + kelp (ocean), crystal shards +
   floating rocks (cosmic), clouds, lilypads, cattails, bushes, mushrooms.
   Density target: the diorama should read as *authored and lush*, not sparse — every
   theme needs ≥8 distinct prop types placed with intent.
2. **Water:** custom shader or animated `MeshStandardMaterial` — gentle vertex sine waves,
   two-tone depth gradient, moving voxel-style caustic dots, ripple rings (expanding
   transparent toruses/sprites) at bobber + rain of sparkles on rare catches.
3. **Render pipeline:** ACES tone mapping, soft directional key light + hemisphere fill,
   shadow map ≤2048, subtle bloom (low threshold restraint — no glow soup), gentle
   vignette, fog tinted per theme. Day/night slow cycle in forest theme (lanterns +
   fireflies at night).
4. **Theme manager:** swaps palette (per-instance colors), backdrop plate, ambience loop,
   fog color, prop set, with a 1.5s fade transition on rank-up + celebration toast.
5. **VFX:** cast arc trail, splash particles, bite exclamation burst, catch card confetti
   (voxel cubes!), coin sparkle on sale, craft success puff. All event-driven.
6. Integrate the Tripo GLBs (Barnaby at stall, fishbot on dock, fish appear in catch card
   close-up + occasionally leap from the water for ambient charm).
7. Screenshot desktop + mobile, self-score against the 10-category scorecard, iterate
   until every category ≥2/3. Include the filled scorecard in `report.md`.

**Done when:** scorecard filled with evidence screenshots, renderer diagnostics recorded
(draw calls, tris, textures — keep draw calls <150 via instancing), 60fps desktop / stable mobile.

---

## Phase 5 — UI/HUD

**Load first:** `~/.claude/skills/threejs-game-ui-designer/references/ui-patterns.md` +
checklists `game-ui-quality.md`, `hud-readability.md`, `responsive-ui-fit.md`, `mobile-input.md`.

Cozy visual language: rounded warm-wood + paper panels (CSS, subtle grain), pastel accent
per theme, chunky readable type (bundle a local font file — no CDN fonts), generated icons
from Phase 3. Keep the GDD's glassmorphism as *soft translucent paper*, not neon glass.

States: title screen (logo + "cast off" button + gentle scene pan), gameplay HUD
(top: level/XP bar, coins, bait selector; bottom-right: cast FAB; bottom-left: basket
badge with fill count; side: shop/market/craft/collection icons), modals (Shop, Market
w/ Barnaby portrait + patience bones display, Crafting bench w/ material inventory,
Collection log of discovered species), Catch Celebration Card (fish render or sprite,
rarity glow border, weight, flavor text, "keep"), settings (volume sliders, mute, reset
save w/ confirm), pause implicit (it's cozy — no fail state).

Touch: FAB ≥56px, all targets ≥44px, safe-area insets, test 375×812. Cast + bite react
must work with the same single tap/click/Space everywhere.

**Done when:** all states screenshotted desktop+mobile, no text clipping/overlap, UI reads
from game state only, checklists pass.

---

## Phase 6 — Debug, QA & Release

**Load first:** `~/.claude/skills/threejs-debug-profiler/references/debug-profile-checklists.md`,
`~/.claude/skills/threejs-qa-release/references/qa-release-checklists.md` + `checklists/visual-verification.md`, `playtest-qa.md`, `release.md`.

1. Full playtest matrix: cast(perfect/ok/miss) → bite(hit/miss) → each rarity catch →
   basket full → sell(now/haggle/desperate, bones exhausted) → buy each bait → craft ≥2
   upgrades → fishbot claim → offline progress → theme rank-up transition → reload
   restores everything.
2. Audio QA: gesture unlock, every SFX triggers, ambience loops seamlessly + crossfades,
   mute persists.
3. `npm run build` + `vite preview`, verify prod build desktop + mobile, canvas pixel
   inspection (`npm run inspect:canvas` or the QA skill's
   `node ~/.claude/skills/threejs-qa-release/scripts/inspect-threejs-canvas.mjs --url <preview-url>`), console clean.
4. Bundle review: total JS + GLB + audio weight; compress textures to WebP where opaque;
   report sizes. Lazy-load theme 2/3 assets if initial payload >8MB.
5. Write `report.md` final sections (all four ledgers, scorecard, QA matrix, screenshots
   list, remaining risks) and run the audit script (see 0.1). Fix anything it flags.

**Done when:** audit passes, prod preview verified, report complete.

---

## Suggested execution notes for the implementer

- Work phase-by-phase; commit nothing to git (project isn't a repo; leave it that way
  unless asked).
- Tripo tasks take 1–3 min each — submit with `--wait`, but you can interleave file work
  while a `run_in_background` shell polls.
- If a generated asset looks off-style, ONE regeneration attempt with an adjusted prompt,
  then move on (record both task IDs).
- Keep `game/data.ts` values easy to tune — expect a balancing pass after first playtest.
- The scaffold's own README/structure may differ slightly from the layout above; adapt the
  layout to the scaffold rather than fighting it, but keep module boundaries.
