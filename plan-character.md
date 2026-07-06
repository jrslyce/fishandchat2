# Fish and Chat — Player Voxel Character Phase (execution plan)

**Goal:** a customizable, Minecraft-skin-style voxel player character that stands/wanders in the
diorama, walks, fishes (synced to real fishing-state), and waves; wears clothing the player buys
with coins or crafts from materials; is named after the player's Twitch username with an editable
override for desktop/testing.

Read this whole file before starting. It's grounded in the actual codebase (paths/classes verified
by direct inspection, not assumed) — follow the referenced patterns rather than inventing new ones.

---

## 0. Ground rules & context

- **Read the current state of every referenced file before editing it.** This is a fresh feature on
  top of a codebase that's had several rounds of external edits this project; do not assume any file
  content from this plan's quotes is still exactly current at execution time — the line numbers and
  snippets below are a map, not a guarantee.
- **Library choice (already researched, do not re-litigate):** port MIT-licensed source from
  [skinview3d](https://github.com/bs-community/skinview3d) — specifically its `PlayerObject` model
  code and `PlayerAnimation` base class + `WalkingAnimation`/`WaveAnimation` — into this repo's own
  `src/`. **Do not `npm install skinview3d`**: its package.json pins `three@^0.156.0` as a hard
  (non-peer) dependency, while this project is on `three@^0.184.0`; installing it as a real dependency
  risks bundling a second copy of three.js. Instead, fetch the relevant source files from the GitHub
  repo (raw.githubusercontent.com URLs, MIT license — keep the license header/attribution comment in
  the ported files), adapt imports to this project's own `three` install, and drop the parts we don't
  need (its standalone `SkinViewer` canvas/renderer wrapper, cape/elytra loader glue we're not using
  yet). Retain the attribution comment: this is our own voxel character using the *format* skinview3d
  renders, not Mojang assets — no copyrighted Minecraft textures/meshes are involved.
- **No `vendor/` directory convention exists in this repo** — everything lives under `src/`. Land the
  ported+adapted character code under a new `src/entities/character/` directory (matching the existing
  `src/entities/Bobber.ts` precedent of hand-authored `THREE.Group` wrappers, not `src/assets/` which
  is for GLB-loading via `ImportedAssetRegistry`).
- After any code change: `npm run build` clean, restart the preview server fully before testing (stale
  Vite HMR has produced false reference errors on this project after class/constructor signature
  changes — restart, don't just reload), verify by screenshot, keep Playwright passing. Note: as of
  the last sprite-phase pass, `desktop-chrome` fails a cast-lock timeout that reproduces identically on
  pre-existing code (confirmed via `git stash`) — this is a known pre-existing issue, not something to
  chase down as part of this phase unless your changes are the ones that touch fishing-state timing.
- Log this phase in `report.md` under a new "Player Character" section: what was ported, file paths,
  screenshots, catalog contents, any deviations from this plan and why.

## 1. Port the base character model + animation engine

Files to fetch (MIT license, `bs-community/skinview3d`, `src/` directory of that repo) and adapt:

- `model.ts` → the `PlayerObject` (`THREE.Group` subclass: head/body/rightArm/leftArm/rightLeg/
  leftLeg, each with inner "base" + outer "overlay" layer meshes), `SkinObject`, `CapeObject` if we
  want capes later (skip for v1 — no cape/elytra catalog item planned yet, cut this code on port to
  keep the file lean).
- `animation.ts` → the abstract `PlayerAnimation` base class (`animate(player, delta)` contract) plus
  `WalkingAnimation` and `WaveAnimation` concrete classes. Port `IdleAnimation` too (small arm-sway +
  cape idle) as the default resting pose.
- Skip `skinview-utils` (legacy 64×32→64×64 skin upgrade logic) entirely — we are authoring our own
  base skins from scratch at the modern 64×64 layout, not accepting arbitrary uploaded Minecraft
  skins, so there's no legacy-format compatibility problem to solve.

Land these as `src/entities/character/PlayerObject.ts` and `src/entities/character/animations.ts`.
Add a short header comment: `Adapted from skinview3d (MIT) — https://github.com/bs-community/skinview3d`.

**Scene integration** — mirror the existing Barnaby pattern exactly, don't invent a new mounting
convention:

- `src/world/DioramaBuilder.ts`: add a `playerSlot: THREE.Group` to `DioramaResult`, alongside the
  existing `barnabySlot`/`fishbotSlot`, positioned somewhere sensible on the grass near the dock/stall
  (pick a spot that reads as "the player's fishing spot," not overlapping Barnaby's stall or the pond).
  Add the new slot's footprint to `STRUCTURE_EXCLUSIONS` so scatter props don't spawn on top of it.
- `src/systems/ThemeManager.ts`: no change needed beyond the slot existing on `DioramaResult` — it
  already disposes/rebuilds the whole diorama and calls back into `Game`.
- `src/game/Game.ts`:
  - `onDioramaRebuilt(diorama)` (currently ~line 231): add
    `if (this.playerCharacter) diorama.playerSlot.add(this.playerCharacter.group);` next to the
    existing Barnaby/fishbot re-attach lines.
  - Construct the `PlayerObject` once (not via `loadHeroAssets`'s GLB pipeline — it's built procedurally
    in code, no async load needed) and add it to the initial diorama's `playerSlot`.
  - `Game.update(delta, elapsed)` (currently ~line 417): add a `this.playerCharacter.update(delta)`
    call in the same per-frame sequence as Barnaby's mixer/wander update.

**Verification for this step:** character renders in the live diorama with a flat placeholder-color
base skin (no clothing yet), holds an idle pose, doesn't clip through terrain, doesn't break the
existing Playwright screenshot test's "nonblank canvas" variance check.

## 2. Base skin + clothing texture compositor

The Minecraft skin format is a single 64×64 texture with a base layer and a semi-transparent overlay
layer per body part (hat over head, jacket over torso, sleeve over each arm, pant-leg over each leg).
This *is* the clothing system — clothing items are overlay-layer texture patches, not separate meshes.

- `src/entities/character/skinLayout.ts`: hard-code the UV rectangle for every base+overlay region as
  named constants (head/body/rightArm/leftArm/rightLeg/leftLeg × base/overlay), derived directly from
  the ported `model.ts`'s own UV-mapping (don't re-derive from scratch — copy the exact rectangles the
  ported geometry already expects, so texture and geometry never disagree).
- `src/entities/character/compositeSkin.ts`: a canvas-based function
  `compositeSkinTexture(baseToneId: string, equipped: Record<ClothingSlot, string | null>): THREE.CanvasTexture`.
  Draws the base tone's flat color fill into the base-layer regions, then draws each equipped clothing
  item's small overlay PNG (see below) into its slot's overlay region, and returns a `THREE.CanvasTexture`
  with `magFilter = THREE.NearestFilter` (pixel-art, no smoothing, matching the rest of the game's look).
- Clothing item art: **author these as flat pixel-art PNGs by script, not via Gemini/Tripo.** These
  need pixel-perfect placement at fixed UV offsets — that's a precision-drawing task (PIL rectangles
  and simple shading), not a generative-art task. A future pass could explore Gemini for pattern/texture
  variety on top of a correctly-placed base, but don't block v1 on that.

**Verification for this step:** a temporary debug hook (e.g. a console-exposed function or a debug
button matching the existing `#debug-perfect-cast` pattern in `index.html`) that cycles through 2-3
hardcoded clothing combinations and confirms the composited texture updates live on the in-scene
character with no seams/misaligned regions.

## 3. Economy & save-state integration

Follow the exact `UPGRADE_CATALOG`/`Economy`/`SaveState` pattern already in the codebase — don't
design a new shape.

- `src/game/data.ts`: add
  ```ts
  export type ClothingSlot = 'hat' | 'jacket' | 'pants' | 'shoes';
  export interface ClothingDefinition {
    id: string;
    slot: ClothingSlot;
    name: string;
    flavor: string;
    cost: { coins: number; materials?: Partial<Record<MaterialId, number>> };
  }
  export const CLOTHING_CATALOG: ClothingDefinition[] = [ /* ~6-8 starter items, 2 per slot */ ];
  ```
  and a small `BASE_TONE_CATALOG` (4-6 flat-color presets with playful names matching the game's voice,
  e.g. in the style of `FISH_CATALOG`'s flavor text — think "Sunfish Tan," "Moonlit Pale," "River Otter
  Brown," not literal skin-tone medical language).
- `src/game/SaveState.ts`: add `ownedClothingIds: string[]`, `equippedClothing: Record<ClothingSlot, string | null>`,
  `baseToneId: string`, `displayNameOverride: string | null` to `GameSaveStateV1`, with defaults in
  `createDefaultSaveState()` (unequipped/empty owned list, a default base tone, `displayNameOverride: null`).
- `src/game/Economy.ts`: add a clothing section (match the existing section-comment-header style):
  `buyClothing(id)`, `equipClothing(slot, id)`, `unequipClothing(slot)`, `ownsClothing(id)`,
  `setBaseTone(id)`, `setDisplayNameOverride(name: string | null)` — each following the exact
  `{ ok, reason? }` return shape and save-mutation style of `buyUpgrade`/`equipBait`.
- `src/game/events.ts`: add `clothingPurchased: { id: string; ok: boolean }`,
  `clothingEquipped: { slot: ClothingSlot; id: string | null }`, `displayNameChanged: { name: string }`
  to `GameEventMap`.
- Wire it: whenever equip state or base tone changes, re-run `compositeSkinTexture` and push the new
  texture onto the live `PlayerObject`'s skin material (a `refreshSkin()` method on the character
  wrapper, called from the event listener in `Game.ts` or `UI.ts` wherever purchase/equip resolves).

## 4. Animations: walk, fish (new), wave

- Idle/Walking/Wave are ported directly (step 1). Wire a wander loop for the "walking around" ask:
  reuse Barnaby's hand-rolled timer-based walk-to-target pattern in `Game.ts` (pick a random point
  within a small radius of `playerSlot`, lerp position + face direction, switch to `WalkingAnimation`
  while moving and back to `IdleAnimation` at rest) rather than inventing a different movement scheme.
- **New `FishingAnimation extends PlayerAnimation`** (`src/entities/character/animations.ts`): a
  cast/reel pose — raise the casting arm back then snap forward on cast-lock, small rhythmic
  wrist/arm motion during the wait, a tug motion on bite. This is the one genuinely new animation to
  author; the existing `WalkingAnimation`/`WaveAnimation` source is the template for how to procedurally
  rotate limb `THREE.Object3D`s per frame inside `animate()`.
- **Sync to real gameplay, not just decoration:** listen to the existing `GameEventMap` phase signals
  (`phaseChanged`, `castLocked`, `biteStarted`, `catchResolved`) in `Game.ts` and switch the player
  character's active animation accordingly: idle/wander when nothing's happening, `FishingAnimation`
  during aiming/casting/waiting/bite, and — nice touch — trigger `WaveAnimation` briefly on
  `catchResolved` for a good catch, reusing the celebration moment the catch-card already marks.

## 5. Character creation & closet UI

- New modal in `src/ui/UI.ts`: extend `ModalId` with `'closet'`, add a rail button
  (`#btn-closet`, matching the existing `#btn-shop`/`#btn-market`/etc. markup and
  `toggleModal('closet')` wiring), add the `renderModal()` case, and write `renderCloset()` following
  `renderShop()`'s structure: rows per clothing slot showing owned items (equip/unequip buttons) and
  locked items (cost label + Buy/Craft button, `disabled` when unaffordable — reuse the same
  `canAffordMaterials` helper pattern added for the crafting-bench redesign), plus a base-tone picker
  row.
- **Character preview in the closet:** don't spin up a second `THREE.WebGLRenderer` (that's the
  duplicate-context problem we're already avoiding with the vendoring decision) — reuse the existing
  renderer/scene. Simplest approach: when the closet modal is open, temporarily point/dolly the main
  camera at `playerSlot` (a small camera-focus routine, restored on modal close), so the player sees
  their actual in-world character react live to equip/base-tone changes. Note this as a decision point
  in the report if a second scissor-rect mini-viewport turns out cleaner in practice — either is
  acceptable, just don't create a second WebGL context.
- **Display name**: no existing text-input pattern in `UI.ts`'s Settings modal (only range sliders +
  one checkbox) — this is genuinely new UI. Add a `<input type="text" id="input-display-name">` row to
  `renderSettings()` (or the new Closet modal, either is reasonable — pick one and be consistent),
  wired to `economy.setDisplayNameOverride()` on `change`, persisted immediately like the volume
  sliders. Default value: a placeholder Twitch-username hook — **there is no Twitch integration in this
  codebase yet**, so for now just default to a generic name (e.g. "Angler") when no override is set,
  and leave a clearly-commented seam (`// TODO: source from Twitch extension context when available`)
  rather than building speculative Twitch API integration now.
- **Name tag over the character:** research/decide the simplest billboarded-text approach available
  (a `THREE.Sprite` with a canvas-drawn-text texture is the standard lightweight technique — check
  three.js's `addons/renderers/CSS2DRenderer` isn't already wired into this project's `RenderPipeline`
  before assuming it's available; if not, the canvas-sprite approach avoids adding a second render
  pass). Update the tag whenever `displayNameChanged` fires.

## 6. Verify & close out

1. `npm run build` clean; Playwright run (expect the pre-existing desktop-chrome cast-lock flake noted
   above — don't treat it as a regression unless this phase's changes touch fishing-state timing, in
   which case investigate for real).
2. Screenshot evidence: character idle in the diorama, character walking, fishing pose during
   aiming/waiting, wave on catch, Closet modal with an equip flow (before/after texture change visible),
   base-tone picker, Settings display-name field round-tripping through a reload.
3. Confirm no duplicate three.js in the bundle (`npm ls three` shows exactly one resolved version) —
   this is the specific risk the vendoring decision in §0 was meant to avoid; verify it actually worked.
4. Payload/perf sanity check: confirm adding the character didn't regress the frame rate noticeably
   (reuse whatever profiling approach — `renderer.info` — was used in earlier phases).
5. Update `report.md` with: ported files + license note, catalog contents, screenshots, any deviations
   from this plan (e.g. if the camera-focus preview approach didn't work out and a scissor-viewport was
   used instead), and commit.
