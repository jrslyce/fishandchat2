# Fish and Chat — Sprite Sheet Phase (execution plan for Sonnet)

**Goal:** give every catalog item in the game a real 2D sprite — fish, trash, bait,
upgrades, fishbots, crafting materials, and specials (Lucky Ducky, Sunken Coin Purse) —
generated with `threejs-image-generator` (Gemini), sliced into individual transparent
PNGs, and wired into the UI (catch card, market/shop/craft rows, collection log).

Written by Fable (architect). Read this whole file before starting; the hard-won
lessons in it are the difference between a smooth pass and re-generating half the art.

---

## 0. Ground rules & context

- **The project is now a git repo** (root `/Users/jared/Code/Fish & Chat 2`, one commit
  so far). Start by checking `git status`; if `fish-and-chat/node_modules`, `dist/`, or
  `test-results/` show as untracked, add a root `.gitignore` covering them first.
  Commit at these points: (a) `.gitignore`/tooling prep, (b) after all sheets are
  generated+sliced+verified (the asset drop), (c) after UI integration passes tests.
  Clear imperative messages, e.g. `Add sprite sheets for all catalog items`.
- **The codebase has changed since earlier phases** (luck mechanics, make-believe fish,
  Lucky Ducky, treasure, recycling overhaul). Do NOT work from memory of old snapshots —
  read `fish-and-chat/src/game/data.ts` fresh and derive the sprite list from the live
  catalogs at execution time.
- Generator calls run through `zsh -c 'source "$HOME/.zshrc" 2>/dev/null; ...'`.
- Gemini billing was fixed earlier but daily quotas can still 429: on a 429, retry once;
  if it persists, STOP and report progress rather than burning retries — sheets already
  generated stay valid, the phase is resumable.
- After UI changes: `npm run build`, restart the preview server fully (stale HMR has
  faked bugs twice), verify by screenshot, and keep Playwright 2/2 (`npm run test`,
  preview server stopped first).
- Log the phase in `report.md` ("Sprite pass" section): sheet list, prompts, slicing
  results, mapping corrections, UI wiring, verification evidence.

## 1. Build the sprite inventory (from live data)

Enumerate ids from `src/game/data.ts`:
- `FISH_CATALOG` (~25 ids incl. the make-believe tier: stardust-guppy, nebula-ray,
  chrono-carp, void-bass, quantum-leviathan)
- `TRASH_CATALOG` (6)
- `BAIT_CATALOG` (4)
- `UPGRADE_CATALOG` (8)
- `FISHBOT_CATALOG` (2)
- `MaterialId` union (6: rubber, metal, wood, fabric, fiber, glass)
- Specials: `lucky-ducky`, `treasure` (Sunken Coin Purse — see `CatchResolver.ts`)

That's ~52 sprites. Write the list (id + one-line visual description derived from each
item's name/flavor text) into a scratch file first — this doubles as the sheet manifest
and the prompt source. **Golden/salvaged/double-catch variants do NOT get their own
sprites** — they're runtime name prefixes; if a visual distinction is wanted later, a
CSS filter (`sepia(1) saturate(3)`-ish) on the base sprite is the cheap path. Note that
in the report, don't build it now unless trivial.

## 2. Generate the sheets (Gemini)

**Layout: 6 items per sheet, 2 rows × 3 columns** — this exact layout worked reliably
for the Phase 3 icon sheet; more cells per sheet raises misalignment risk. ~9 sheets
total. Resolution `2K`. Output to `assets-src/sprites/sheet-NN-<group>.png`.

**Style consistency is the whole game here.** Every prompt uses the same style prefix so
52 sprites from 9 generations read as one set, and match the existing HUD icons:

> "Cozy game item icon sheet, 6 separate icons arranged in a 2x3 grid with generous
> clear spacing between them, flat pastel colors, chunky rounded shapes, thick soft
> dark-brown outlines, high contrast readable at small size, plain solid white
> background, no text, no labels."

Then name each cell positionally, e.g.:

> "Top-left: a cheerful orange perch fish. Top-middle: a silver minnow. Top-right: a
> brown carp. Bottom-left: a blue gill fish with stained-glass fins. Bottom-middle: a
> speckled freckled dace fish. Bottom-right: a copper-colored trout."

Group sheets sensibly (commons+1, uncommons, rares, epics, legendaries+make-believe
overflow, trash, bait+specials, upgrades, materials+fishbots). Fish descriptions come
from their flavor text — lean into distinct colors/shapes per species so they're
tellable apart at 40px.

**Ask for a plain WHITE background, not "transparent".** Lesson from Phase 5: Gemini
"transparent" renders a fake checkerboard baked into opaque pixels. A solid near-white
background keys out more cleanly than checkerboard gray.

## 3. Slice + key out backgrounds (reusable script this time)

Phase 5 did this ad-hoc for 6 icons; at 52 sprites, write it once:
`fish-and-chat/scripts/slice_sprites.py` (PIL + numpy, both installed):

1. Input: sheet path + ordered list of 6 ids (row-major). Grid-split into cells.
2. Background removal, two passes (proven in Phase 5): flood-fill from cell borders
   marking near-background pixels (for white: `min(r,g,b) >= ~235` and low saturation),
   then a global pass for enclosed pockets (e.g. gaps inside handles). Set alpha 0.
3. Tight-crop to content bbox + ~12px pad, downscale so the longest side is ≤256px
   (LANCZOS) — 52 full-res cells would bloat the payload for icons displayed at ≤64px.
4. Write `public/images/sprites/<id>.png` — **filenames must exactly match catalog ids**.
5. Emit/refresh `src/assets/spriteManifest.ts`: a generated
   `export const SPRITE_MANIFEST: Record<string, string>` mapping id → URL, with a
   header comment marking it generated-by-script.

**Mapping verification is mandatory, per sheet, before slicing is trusted:** Gemini
sometimes reorders or merges grid cells. For each sheet, Read the generated sheet image
and visually confirm each cell matches its intended id BEFORE running the slicer with
that id order. If a sheet's layout is wrong but the art is good, fix the id order passed
to the slicer; if an item is missing/duplicated/fused, regenerate that sheet once with
firmer positional language. After slicing, spot-Read at least one sliced PNG per sheet
to confirm real alpha (check `getchannel('A').getextrema()` — must not be (255,255))
and clean edges.

## 4. Wire into the UI

All in `src/ui/UI.ts` (+ small CSS in `src/styles.css`). Read the CURRENT file first —
it has changed since Phase 5 (Lucky Ducky pill, recycle events, gauge changes).

- Helper: `spriteFor(id: string): string | null` → `SPRITE_MANIFEST[id] ?? null`, and
  use it with a graceful fallback to the existing generic icons where a sprite is
  missing (never a broken img).
- **Catch card**: add the caught item's sprite (~72px) above the name — biggest visible
  win of the whole phase.
- **Market rows**: sprite per basket item (replaces text-only rows; `row-icon` slot
  already exists in the row markup pattern).
- **Shop rows**: real bait sprites replace the generic bait-can icon; fishbot sprites
  for the two bots; Lucky Ducky sprite wherever the ducky UI lives (check current UI.ts).
- **Craft rows**: per-upgrade sprites replace the generic hammer; material chips get
  small material sprites next to counts.
- **Collection modal**: sprite per entry; undiscovered entries show the sprite as a
  silhouette (`filter: brightness(0); opacity: 0.35;`) instead of plain "???" — keeps
  the mystery, teases the shape.
- Keep dynamic-value layout stability (fixed icon slot sizes), per the UI checklists.

## 5. Verify & close out

1. `npm run build` clean; Playwright 2/2.
2. Preview: screenshot catch card with sprite (drive a full cast), each modal
   (shop/market/craft/collection) on desktop; collection must show silhouettes for
   undiscovered + real sprites for discovered. One mobile spot-check (remember:
   coordinate `preview_click` misses under mobile emulation — dispatch synthetic events).
3. Confirm zero console errors (esp. 404s for sprite URLs — check the network panel via
   `preview_network` for any failed image requests).
4. Payload check: total size of `public/images/sprites/` — should be well under ~1.5MB
   after downscaling; report the number.
5. Update `report.md`, commit (`git add -A` mindful of .gitignore, imperative message),
   and report: sheets generated (paths + prompts), mapping fixes, sprite count vs
   catalog count (call out any item that still lacks a sprite and why), files changed,
   verification evidence.
