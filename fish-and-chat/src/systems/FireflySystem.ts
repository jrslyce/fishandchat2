import * as THREE from 'three';

interface Firefly {
  sprite: THREE.Sprite;
  home: THREE.Vector3;
  ampX: number;
  ampY: number;
  ampZ: number;
  freqX: number;
  freqY: number;
  freqZ: number;
  phase: number;
  flickerFreq: number;
  flickerPhase: number;
  baseOpacity: number;
}

const FIREFLY_COUNT = 16;
const POND_INNER_RADIUS = 1.6;
const POND_OUTER_RADIUS = 4.6;

function makeGlowTexture(): THREE.Texture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.35, 'rgba(228,255,150,0.8)');
  gradient.addColorStop(1, 'rgba(228,255,150,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Ambient dusk fireflies drifting around the pond's grassy edge. Purely
 * decorative — added directly to the scene (not the diorama root) so it
 * survives theme rebuilds untouched.
 */
export class FireflySystem {
  private readonly root = new THREE.Group();
  private readonly texture = makeGlowTexture();
  private readonly fireflies: Firefly[] = [];

  constructor(scene: THREE.Scene) {
    this.root.name = 'firefliesRoot';

    for (let i = 0; i < FIREFLY_COUNT; i++) {
      const material = new THREE.SpriteMaterial({
        map: this.texture,
        color: '#d9ff8a',
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const sprite = new THREE.Sprite(material);
      const scale = 0.06 + Math.random() * 0.05;
      sprite.scale.setScalar(scale);

      const angle = Math.random() * Math.PI * 2;
      const radius = POND_INNER_RADIUS + Math.random() * (POND_OUTER_RADIUS - POND_INNER_RADIUS);
      const home = new THREE.Vector3(Math.cos(angle) * radius, 0.25 + Math.random() * 0.7, Math.sin(angle) * radius);
      sprite.position.copy(home);

      this.root.add(sprite);
      this.fireflies.push({
        sprite,
        home,
        ampX: 0.3 + Math.random() * 0.4,
        ampY: 0.15 + Math.random() * 0.25,
        ampZ: 0.3 + Math.random() * 0.4,
        freqX: 0.15 + Math.random() * 0.25,
        freqY: 0.2 + Math.random() * 0.3,
        freqZ: 0.15 + Math.random() * 0.25,
        phase: Math.random() * Math.PI * 2,
        flickerFreq: 1.2 + Math.random() * 1.8,
        flickerPhase: Math.random() * Math.PI * 2,
        baseOpacity: 0.55 + Math.random() * 0.35,
      });
    }

    scene.add(this.root);
  }

  update(elapsed: number): void {
    for (const fly of this.fireflies) {
      fly.sprite.position.set(
        fly.home.x + Math.sin(elapsed * fly.freqX + fly.phase) * fly.ampX,
        fly.home.y + Math.sin(elapsed * fly.freqY + fly.phase * 1.3) * fly.ampY,
        fly.home.z + Math.cos(elapsed * fly.freqZ + fly.phase) * fly.ampZ,
      );
      const flicker = 0.5 + 0.5 * Math.sin(elapsed * fly.flickerFreq + fly.flickerPhase);
      (fly.sprite.material as THREE.SpriteMaterial).opacity = fly.baseOpacity * (0.35 + flicker * 0.65);
    }
  }

  dispose(): void {
    for (const fly of this.fireflies) {
      fly.sprite.material.dispose();
    }
    this.fireflies.length = 0;
    this.texture.dispose();
    this.root.clear();
  }
}
