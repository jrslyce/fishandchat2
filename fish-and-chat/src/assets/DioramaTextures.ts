import * as THREE from 'three';

function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeCanvasTexture(
  size: number,
  draw: (ctx: CanvasRenderingContext2D, size: number) => void,
  srgb: boolean,
  repeat = 1,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  draw(ctx, size);
  const texture = new THREE.CanvasTexture(canvas);
  if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  if (repeat !== 1) texture.repeat.set(repeat, repeat);
  texture.needsUpdate = true;
  return texture;
}

/** Carved balsa wood grain albedo texture for tabletop miniature planks & posts. */
export function createBalsaWoodTexture(baseHex: string, grainHex: string): THREE.CanvasTexture {
  return makeCanvasTexture(128, (ctx, size) => {
    const rng = createRng(104729);
    ctx.fillStyle = baseHex;
    ctx.fillRect(0, 0, size, size);

    ctx.strokeStyle = grainHex;
    for (let i = 0; i < 40; i++) {
      const y = (i / 40) * size + (rng() - 0.5) * 2;
      ctx.globalAlpha = 0.09 + rng() * 0.16;
      ctx.lineWidth = 0.8 + rng() * 1.4;
      ctx.beginPath();
      ctx.moveTo(0, y);
      const midY = y + (rng() - 0.5) * 4;
      ctx.quadraticCurveTo(size * 0.5, midY, size, y + (rng() - 0.5) * 3);
      ctx.stroke();
    }

    // Subtle carved gouge highlights
    ctx.strokeStyle = '#ffffff';
    for (let i = 0; i < 12; i++) {
      const y = rng() * size;
      ctx.globalAlpha = 0.04 + rng() * 0.06;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(rng() * size * 0.3, y);
      ctx.lineTo(size * (0.6 + rng() * 0.4), y + (rng() - 0.5) * 1.5);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }, true);
}

/** Sunlit model-railroad sponge flocking texture for miniature moss, grass & coral clusters. */
export function createFlockedFoliageTexture(baseHex: string, highlightHex: string): THREE.CanvasTexture {
  return makeCanvasTexture(128, (ctx, size) => {
    const rng = createRng(23993);
    ctx.fillStyle = baseHex;
    ctx.fillRect(0, 0, size, size);

    for (let i = 0; i < 360; i++) {
      const x = rng() * size;
      const y = rng() * size;
      const r = 1.4 + rng() * 3.5;
      ctx.fillStyle = rng() > 0.42 ? highlightHex : 'rgba(20, 35, 18, 0.22)';
      ctx.globalAlpha = 0.16 + rng() * 0.28;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }, true, 2);
}

/** Soft warm fibrous spun-cotton cloud shading texture. */
export function createCottonCloudTexture(): THREE.CanvasTexture {
  return makeCanvasTexture(128, (ctx, size) => {
    const rng = createRng(51907);
    ctx.fillStyle = '#fffaf0';
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 160; i++) {
      const x = rng() * size;
      const y = rng() * size;
      const r = 3 + rng() * 9;
      ctx.fillStyle = rng() > 0.35 ? 'rgba(255, 252, 244, 0.35)' : 'rgba(232, 219, 198, 0.22)';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }, true);
}
