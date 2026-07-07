import { CanvasTexture, NearestFilter, SRGBColorSpace } from 'three';
import { BASE_TONE_CATALOG, CLOTHING_CATALOG, type ClothingSlot } from '../../game/data';
import { CLOTHING_SLOT_TARGETS, SKIN_LAYOUT, SKIN_TEXTURE_SIZE } from './skinLayout';

const imageCache = new Map<string, Promise<HTMLImageElement>>();

function loadImage(url: string): Promise<HTMLImageElement> {
  let cached = imageCache.get(url);
  if (!cached) {
    cached = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load clothing texture: ${url}`));
      img.src = url;
    });
    imageCache.set(url, cached);
  }
  return cached;
}

/**
 * Builds the final 64x64 skin texture for a character: a flat base-tone fill
 * in every base-layer region, then each equipped clothing item's per-part
 * overlay patch drawn into its target overlay region(s). Item patches must be
 * pre-cropped to the exact `SKIN_LAYOUT[part].overlay` size for the parts
 * they target (see skinLayout.ts) and transparent outside their own area.
 */
export async function compositeSkinTexture(
  baseToneId: string,
  equipped: Record<ClothingSlot, string | null>,
): Promise<CanvasTexture> {
  const canvas = document.createElement('canvas');
  canvas.width = SKIN_TEXTURE_SIZE;
  canvas.height = SKIN_TEXTURE_SIZE;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, SKIN_TEXTURE_SIZE, SKIN_TEXTURE_SIZE);

  const tone = BASE_TONE_CATALOG.find((t) => t.id === baseToneId) ?? BASE_TONE_CATALOG[0];
  ctx.fillStyle = tone.color;
  for (const layout of Object.values(SKIN_LAYOUT)) {
    ctx.fillRect(layout.base.x, layout.base.y, layout.base.w, layout.base.h);
  }

  // Simple pixel face on the head's front-face island (base layer, not overlay — a hat's
  // overlay-layer box mesh renders in front of it automatically, so equipping a hat still
  // covers the face with no extra bookkeeping). Hard-coded dark brown so it reads against
  // every base skin tone.
  ctx.fillStyle = '#3a2418';
  ctx.fillRect(10, 10, 1, 2);
  ctx.fillRect(13, 10, 1, 2);
  ctx.fillRect(10, 13, 4, 1);

  const drawJobs: Array<Promise<void>> = [];
  for (const slot of Object.keys(equipped) as ClothingSlot[]) {
    const itemId = equipped[slot];
    if (!itemId) continue;
    const item = CLOTHING_CATALOG.find((c) => c.id === itemId);
    if (!item) continue;

    for (const part of CLOTHING_SLOT_TARGETS[slot]) {
      const textureUrl = item.textures[part];
      if (!textureUrl) continue;
      const rect = SKIN_LAYOUT[part].overlay;
      drawJobs.push(
        loadImage(textureUrl).then((img) => {
          ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h);
        }),
      );
    }
  }
  await Promise.all(drawJobs);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.magFilter = NearestFilter;
  texture.minFilter = NearestFilter;
  texture.needsUpdate = true;
  return texture;
}
