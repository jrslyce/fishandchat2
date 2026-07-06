/**
 * Paths and metadata for generated assets. Phase 3 (asset generation) fills
 * audio/images now; Phase 4 (voxel world & graphics polish) adds the GLB
 * model entries as it wires them into the scene.
 */

export const SFX_MANIFEST = {
  castWhoosh: '/audio/sfx/cast-whoosh.mp3',
  bobberSplash: '/audio/sfx/bobber-splash.mp3',
  biteAlert: '/audio/sfx/bite-alert.mp3',
  reelIn: '/audio/sfx/reel-in.mp3',
  catchJingle: '/audio/sfx/catch-jingle.mp3',
  rareCatchFanfare: '/audio/sfx/rare-catch-fanfare.mp3',
  coinClink: '/audio/sfx/coin-clink.mp3',
  uiClick: '/audio/sfx/ui-click.mp3',
  craftClunk: '/audio/sfx/craft-clunk.mp3',
  haggleBones: '/audio/sfx/haggle-bones.mp3',
} as const;

export const AMBIENCE_MANIFEST = {
  'forest-pond': '/audio/ambience/ambience-forest.mp3',
  'ocean-trench': '/audio/ambience/ambience-ocean.mp3',
  'cosmic-lake': '/audio/ambience/ambience-cosmic.mp3',
} as const;

/**
 * Maps game events (see game/events.ts GameEventMap) to the SFX that should
 * play when they fire. Consumed by the Phase 4/5 runtime audio wiring —
 * Phase 3 only generates the clips and defines this trigger table.
 */
export const AUDIO_TRIGGER_MAP: Record<string, keyof typeof SFX_MANIFEST> = {
  castLocked: 'castWhoosh',
  biteStarted: 'biteAlert',
  marketSold: 'coinClink',
  upgradePurchased: 'craftClunk',
  baitPurchased: 'coinClink',
  fishbotPurchased: 'coinClink',
};

/**
 * Source paths for Phase 3's generated images, relative to the project root
 * (NOT web-servable as-is — they live under assets-src/, outside public/).
 * Phase 4/5 must decide how to bring each into the Vite build: `import`ing
 * from src (bundled/hashed) or copying into public/ (served verbatim), then
 * replace these with the resulting resolvable URLs.
 */
export const IMAGE_SOURCE_MANIFEST = {
  styleSheet: 'assets-src/concepts/style-sheet.png',
  barnabyConcept: 'assets-src/concepts/monger-barnaby.png',
  logoTitle: 'assets-src/ui/logo-title.png',
  iconSheet: 'assets-src/ui/icons.png',
  skyForestPond: 'assets-src/sky/forest-pond.png',
  skyOceanTrench: 'assets-src/sky/ocean-trench.png',
  skyCosmicLake: 'assets-src/sky/cosmic-lake.png',
} as const;

/**
 * Source paths for Phase 3's generated GLBs (also under assets-src/, same
 * caveat as above). Phase 4 imports/copies these when building the scene.
 * Barnaby is v2 (image-to-3D) — v1 (text-to-3D) is superseded, do not use.
 */
export const MODEL_SOURCE_MANIFEST = {
  barnaby: 'assets-src/models/barnaby-v2/b297d502-e254-44ce-bf2f-ee4d2470e2ef-pbr_model.glb',
  prismKoi: 'assets-src/models/prism-koi/61262e20-5371-40b0-a33f-5953ea3a839c-pbr_model.glb',
  genericFish: 'assets-src/models/generic-fish/f4500b28-f57c-4e53-9a8b-b2e55fea9ce5-pbr_model.glb',
  fishbot: 'assets-src/models/fishbot/12886f27-5b39-4453-9f0e-294854466a1e-pbr_model.glb',
  oldBoot: 'assets-src/models/old-boot/8889e280-3579-474c-9b56-4279cacf51ca-pbr_model.glb',
} as const;

/**
 * Web-servable copies of the above, placed directly in public/ (Phase 4).
 * These are what the running game actually loads via GLTFLoader/fetch.
 */
export const MODEL_SOURCE_MANIFEST_PUBLIC = {
  barnaby: '/models/barnaby.glb',
  prismKoi: '/models/prism-koi.glb',
  genericFish: '/models/generic-fish.glb',
  fishbot: '/models/fishbot.glb',
  oldBoot: '/models/old-boot.glb',
} as const;

/**
 * Web-servable copies of IMAGE_SOURCE_MANIFEST, placed in public/images/
 * (Phase 4). `styleSheet` is deliberately absent — it's a concept/art-
 * direction reference only, never meant to render at runtime.
 */
export const IMAGE_MANIFEST_PUBLIC = {
  barnabyConcept: '/images/barnaby-portrait.png',
  logoTitle: '/images/logo-title.png',
  iconSheet: '/images/icons.png',
  skyForestPond: '/images/sky-forest-pond.png',
  skyOceanTrench: '/images/sky-ocean-trench.png',
  skyCosmicLake: '/images/sky-cosmic-lake.png',
} as const;
