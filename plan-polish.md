# Fish and Chat — Polish Pass Execution Plan (user-annotated feedback)

**Role:** Step-by-step instructions for the implementing model (Sonnet), written by Fable
(architect) from the user's annotated screenshot. Work top to bottom — Task 1 likely fixes
several symptoms at once, so verify after it before touching shadow/related code further.

**Ground rules (carry-overs from this project's history):**
- After every change: `npm run build`, then **fully restart** the preview server before
  judging results (stale Vite HMR state has produced false "bugs" twice — reload alone is
  not enough after constructor/module-shape changes).
- Verify visually with multiple screenshots a few seconds apart (the camera idle-drifts;
  single frames hide flicker). Zero console errors. Playwright suite (`npm run test`,
  stop the preview server first — port conflict) must stay 2/2.
- The game's `pagehide` autosave overwrites `localStorage.clear()` on reload. To reset
  test state, register a *later* `pagehide` listener that clears after the game's persist.
- Log everything in `report.md` under a new "Polish pass" section: root causes, fixes,
  verification evidence, any Tripo credits spent.
- Generator calls must run through `zsh -c 'source "$HOME/.zshrc" 2>/dev/null; ...'`.

---

## Task 1 — Kill the faceting/flashing for real (red circles: far shoreline, right pond wall, under the market stall)

**Root cause to verify first (don't chase shadows again):** in
`src/world/VoxelKit.ts` → `buildIslandTerrain`, the `basinRimCells` layer places unit
cubes at `y = -0.3` on the *same x/z cells* as the top layer's cubes at `y = 0`. A cube
at y=-0.3 spans y∈[-0.8, 0.2]; a top cube spans [-0.5, 0.5] — they interpenetrate, and
their *side faces lie in identical planes*. That's classic z-fighting: which face wins
the depth test changes per-frame as the camera drifts → shimmering/"ripping" exactly
along the 1-cell band around the pond (`pondRadius ≤ dist < pondRadius+1`). The market
stall sits at (-2.6, 2.4), dist ≈ 3.54 — *inside that band*, which is why the "brown
rectangle under the stall" flashes too. All three red-circled regions are this band.
Previous passes tuned shadow bias; the acne got better but this remained because it was
never a shadow problem.

**Fix:** delete the `basinRimCells` layer entirely (the cells, the cluster build, and
the loop that fills it). The mid layer (y=-1) plus the top cubes' inner faces already
form the basin wall; the decorative "lip" isn't worth the artifact. Do NOT try to fix it
by nudging the rim to a non-overlapping offset — any coincident face plane between
instanced cubes re-creates the bug.

**Verify:** rebuild, restart server, take 3+ screenshots several seconds apart and
compare the far shoreline, the right pond wall, and the ground under the stall
specifically. Then confirm with the user-visible symptom gone before moving on.

## Task 2 — Give the pond a bottom (blue circle: "see-through" water)

**Root cause:** the island's pond hole has *no floor*. Water alpha is 0.78, and behind
it (below the island) is nothing but `scene.background` — the bright sunset sky texture.
The pale "see-through rectangle" in the blue circle is literally the sky showing through
the planet-less gap under the water. It moves with camera angle, not with gameplay.

**Fix:** in `buildIslandTerrain`, add a floor layer of cells at `y = -1` for
`dist < pondRadius` (the same loop that currently *skips* those cells for the top
layer), using the `low` (darkest) material — or a dedicated even-darker mud color via
per-instance color. The floor must NOT share any face plane with the mid-layer cells
(mid starts at `dist > pondRadius - 1.2`; overlap region exists — either exclude
`dist < pondRadius` from the mid layer or exclude `dist >= pondRadius - 1.2`ish from the
floor so each x/z cell appears in exactly ONE of {floor, mid} — avoid re-creating Task 1).
- Result check: looking at the pond you should see dark bottom through the water
  everywhere; the deep-color gradient in the water shader will read better too.

## Task 3 — Bobber ripples hitting an "invisible edge"

Two contributors; fix both:
1. **Transparency sorting:** the ripple rings and the water surface are both transparent;
   the rings are *children of the water mesh* (`WaterSystem`). Three.js sorts transparent
   objects per-frame by depth, so some frames draw water OVER the rings — combined with
   the (now-fixed) bright sky patch this produced a hard visible boundary. Set on the
   water mesh: `renderOrder = 1`; on each ripple ring: `renderOrder = 2` and
   `material.depthWrite = false`. This pins rings above the surface consistently.
2. **Rings escaping the pond:** rings expand to ~4-5x scale; emitted near the bobber
   (z≈1.5) they can cross the shoreline and get depth-cut by the basin wall. Clamp: in
   `WaterSystem.update`, compute each ring's max allowed scale from its distance to the
   pond edge (`(WATER_DISC_RADIUS - ringCenterDistanceFromPondCenter) / ringBaseOuterRadius`)
   and fade it out at that cap instead of growing past the shore.

**Verify with a live cast:** drive idle→aiming→lock via pointer events on
`#action-button`, screenshot during `waiting` with a ripple mid-expansion near the
bobber. The ring should fade before reaching shore and never show a hard cut.

## Task 4 — Market stall: smaller, fully on land

`src/world/DioramaBuilder.ts` + `src/world/VoxelKit.ts` (`buildMarketStall`):
- Scale the stall down ~25-30% (either `stall.scale.setScalar(0.72)` or shrink the
  built dimensions — prefer real dimensions so shadows/posts stay crisp: roof ~1.5×1.2,
  posts height ~1.0, counter to match).
- Move it away from the pond edge so no part overhangs water: try `(-3.2, 0, 2.0)` and
  adjust by screenshot; every corner must sit over grass (land band is dist 3..5 from
  origin; pond edge at 3.0).
- Update its entry in `STRUCTURE_EXCLUSIONS` (position + radius) so foliage doesn't
  spawn into the new footprint, and re-check Barnaby's slot still sits clear of the roof
  from the camera's angle.
- The "brown rectangle flashing under it" should already be gone after Task 1 (it's the
  rim band). If any static brown rectangle remains under the stall, check whether the
  counter/roof shadow is being mistaken for geometry — screenshot and judge; only act
  if something is actually wrong.

## Task 5 — Dock rework (green circle) + dock lantern

`buildDock` in `VoxelKit.ts`, placement in `DioramaBuilder.ts`:
- **Narrower:** plank width 1.6 → ~0.9 (posts move inward to match, offsets ±0.35).
- **Extends onto the grass:** lengthen the dock landward (+z) so ~2 planks sit over
  grass (start z ≈ POND_RADIUS + 0.8) while the far end still reaches over water
  (end z ≈ POND_RADIUS − 1.8). Keep deck height as-is so it reads as raised above grass.
- **Step up on the left side:** one small box step (~0.45×0.15×0.35, wood material) at
  grass level against the dock's landward-left edge (left from the camera = −x side).
- **Lantern on the dock:** add a `buildLanternPost` (shorter, height ~1.0) standing ON
  the deck near the water end, positioned at a deck corner so it doesn't block the
  fishbot slot (fishbot sits at x=1.4, z=1.6 — keep it clear or nudge the fishbot slot
  a plank landward; verify fishbot placement afterward by seeding coins and buying one).
- Update the dock's `STRUCTURE_EXCLUSIONS` entry (center moves landward, radius grows).

## Task 6 — Barnaby: smaller + walking animation

- **Size:** `normalizedClone(barnaby.value, 1.5)` → `1.1` in `Game.ts`.
- **Animation — try Tripo first** (user preference, "or something else" = fallback OK).
  Barnaby's generation task id: `b297d502-e254-44ce-bf2f-ee4d2470e2ef`.

  ```bash
  cd fish-and-chat && zsh -c 'source "$HOME/.zshrc" 2>/dev/null; python3 ~/.claude/skills/threejs-3d-generator/scripts/threejs_3d_asset.py character-pipeline \
    --model-task-id b297d502-e254-44ce-bf2f-ee4d2470e2ef \
    --animations preset:idle,preset:walk \
    --out-dir assets-src/models/barnaby-anim'
  ```

  Read `~/.claude/skills/threejs-3d-generator/references/api-notes.md` +
  `threejs-integration.md` BEFORE running (rigging rules). Key facts you'll hit:
  - The pipeline runs prerigcheck → rig (with validation + retries) → retargets.
    Bipeds route to the v1.0 anatomical rig, which exports **one FBX per clip**
    (GLB bake is broken on that path — the script enforces FBX).
  - Runtime: load with `FBXLoader` from `three/addons/loaders/FBXLoader.js`, play each
    file's `animations[0]`, keep the FBX with the shallower node path if duplicates
    appear, and strip ONLY the horizontal components of the `Root.position` track
    (keep Y). Never `--animate-in-place`. Snippet is in `threejs-integration.md`.
  - Budget: ~25 credits rig + ~10 per clip + retries. If prerigcheck says
    `riggable=false` or rig validation fails through the retries, STOP the Tripo path
    (chunky no-neck voxel bodies are exactly the shape that fails) and fall back.
  - FBXLoader materials render darker (Phong) than the GLB — acceptable for now; note it.
  - **Fallback (procedural waddle):** keep the static GLB and animate in code — a small
    2-point patrol in front of the stall (~1.2 units apart): lerp position, face travel
    direction, add body roll `sin(t*8)*0.06` and a little hop `|sin(t*8)|*0.03`, pause
    2-3s at each end in "idle" (gentle bob). This reads as walking for a chunky voxel
    character and costs nothing.
- **Wire-up either way:** movement lives in `Game.update` (like ambient fish), NOT
  inside the diorama; his slot group stays the anchor. Keep him inside his
  `STRUCTURE_EXCLUSIONS` zone (grow it to cover the patrol path).

## Task 7 — Regenerate forest ambience (ElevenLabs)

The current `public/audio/ambience/ambience-forest.mp3` has high-pitched content the
user dislikes. Regenerate (same output path, overwrite):

```bash
cd fish-and-chat && zsh -c 'source "$HOME/.zshrc" 2>/dev/null; python3 ~/.claude/skills/threejs-audio-generator/scripts/threejs_audio_asset.py sfx \
  --prompt "seamless looping calm pond ambience at dusk, low croaking toads, soft crickets, occasional gentle fish splash, a few distant duck quacks, warm low-frequency nature bed, no birds chirping, no high-pitched insect whine, no music, no voice" \
  --duration 14 --loop --prompt-influence 0.5 \
  --out public/audio/ambience/ambience-forest.mp3'
```

- `sfx` subcommand only (the ElevenLabs key is permission-scoped; /voices etc. 401).
- Negative wording in-prompt ("no high-pitched insect whine") is the only lever —
  regenerate at most twice if the first result still has piercing highs, then keep the
  best and note it. Verify the file replaced (mtime/size) and plays in-game (ambience
  starts after first user gesture).

## Task 8 — Dim the background sky plate

The sunset backdrop blows out (worsened by bloom catching it). Two dials, apply both:
- In `ThemeManager.applyAtmosphere` after assigning `scene.background`:
  `this.scene.backgroundIntensity = 0.65;` (set once; it applies scene-wide — tune
  0.55-0.75 by screenshot until the horizon glow no longer overpowers the island).
- In `RenderPipeline`, raise the bloom threshold `0.82 → 0.9` so only genuine emissives
  (lanterns) bloom, not the bright sky band. Keep strength as-is.
- Verify across ALL THREE themes (seed level 10 / 20 via the late-pagehide-listener
  trick) — cosmic/ocean are darker plates and must not become murky. If ocean/cosmic
  look too dark at 0.65, make `backgroundIntensity` a per-theme value in
  `world/themes.ts` instead of a constant.

---

## Final verification (after all tasks)

1. `npm run build` clean; Playwright 2/2 (stop preview server first).
2. Fresh-save playthrough in the preview: title → cast → wait (ripples stay in pond, no
   hard edges) → bite → catch (leap + card) → market/shop/craft modals still work.
3. 3+ spaced screenshots on the final build: no flashing anywhere on the rim band, under
   the stall, or on the pond walls; pond floor visible through water; stall fully on
   land; dock narrow with step + lantern; Barnaby smaller and walking (or waddling).
4. Mobile viewport spot-check (remember: coordinate `preview_click` misses under mobile
   emulation — dispatch synthetic events directly).
5. Update `report.md` ("Polish pass" section): per-task root cause → fix → evidence,
   Tripo/ElevenLabs spend, and any fallback decisions (esp. Task 6).
