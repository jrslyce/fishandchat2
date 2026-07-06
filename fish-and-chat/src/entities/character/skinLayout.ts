/**
 * Pixel rectangles for the 64x64 Minecraft-style skin texture, one per body
 * part x layer. These are NOT guessed — they're the exact (u, v, islandWidth,
 * islandHeight) values implied by the `setSkinUVs(box, u, v, width, height,
 * depth)` calls in PlayerObject.ts's SkinObject constructor, where an
 * island's on-texture footprint is `(2*width + 2*depth, height + depth)`
 * starting at `(u, v)`. Keeping these derived-not-duplicated means texture
 * and geometry can never drift out of sync with each other.
 *
 * Only the "default" (non-slim) arm width is modeled — slim arms are not a
 * customization option in v1.
 */
export interface SkinRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface BodyPartLayout {
  base: SkinRect;
  overlay: SkinRect;
}

export const SKIN_TEXTURE_SIZE = 64;

export const SKIN_LAYOUT: Record<'head' | 'body' | 'rightArm' | 'leftArm' | 'rightLeg' | 'leftLeg', BodyPartLayout> = {
  head: { base: { x: 0, y: 0, w: 32, h: 16 }, overlay: { x: 32, y: 0, w: 32, h: 16 } },
  body: { base: { x: 16, y: 16, w: 24, h: 16 }, overlay: { x: 16, y: 32, w: 24, h: 16 } },
  rightArm: { base: { x: 40, y: 16, w: 16, h: 16 }, overlay: { x: 40, y: 32, w: 16, h: 16 } },
  leftArm: { base: { x: 32, y: 48, w: 16, h: 16 }, overlay: { x: 48, y: 48, w: 16, h: 16 } },
  rightLeg: { base: { x: 0, y: 16, w: 16, h: 16 }, overlay: { x: 0, y: 32, w: 16, h: 16 } },
  leftLeg: { base: { x: 16, y: 48, w: 16, h: 16 }, overlay: { x: 0, y: 48, w: 16, h: 16 } },
};

export type ClothingSlot = 'hat' | 'jacket' | 'pants' | 'shoes';

/**
 * Which body parts' overlay layer a given clothing slot draws into.
 * `jacket` owns the body+arm overlays exclusively. `pants` and `shoes` both
 * target the leg overlay rectangles (one region per leg, covering thigh to
 * foot) — `pants` art must only be opaque in the upper/thigh rows and
 * `shoes` only in the lower/ankle rows, transparent elsewhere, so layering
 * them via canvas drawImage doesn't clobber the other slot's pixels.
 */
export const CLOTHING_SLOT_TARGETS: Record<ClothingSlot, Array<keyof typeof SKIN_LAYOUT>> = {
  hat: ['head'],
  jacket: ['body', 'rightArm', 'leftArm'],
  pants: ['rightLeg', 'leftLeg'],
  shoes: ['rightLeg', 'leftLeg'],
};
