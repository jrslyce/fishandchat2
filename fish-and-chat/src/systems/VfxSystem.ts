import * as THREE from 'three';
import type { EventBus } from '../core/EventBus';
import type { GameEventMap } from '../game/events';

interface Particle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  gravity: number;
}

const RARITY_COLORS: Record<string, string> = {
  trash: '#9a9a8f',
  common: '#cfd9c8',
  uncommon: '#7fbfa0',
  rare: '#5a9bd4',
  epic: '#b07de0',
  legendary: '#f2b33a',
};

export interface VfxAnchors {
  getBobberPosition: () => THREE.Vector3;
  getBarnabyPosition: () => THREE.Vector3;
  getCraftingBenchPosition: () => THREE.Vector3;
}

/**
 * Lightweight pooled particle bursts. Effects are small boxes/spheres with
 * manual velocity+gravity+fade, added to a dedicated root and removed once
 * expired. No permanent particle fields, per the render-recipes guidance.
 */
export class VfxSystem {
  private readonly root = new THREE.Group();
  private readonly particles: Particle[] = [];
  private readonly geometry = new THREE.BoxGeometry(0.06, 0.06, 0.06);
  private readonly sparkGeometry = new THREE.SphereGeometry(0.04, 6, 6);

  constructor(
    scene: THREE.Scene,
    private readonly events: EventBus<GameEventMap>,
    private readonly anchors: VfxAnchors,
  ) {
    this.root.name = 'vfxRoot';
    scene.add(this.root);
    this.bindEvents();
  }

  private bindEvents(): void {
    this.events.on('castLocked', () => this.emitCastTrail());
    this.events.on('biteStarted', () => this.emitBiteBurst());
    this.events.on('catchResolved', ({ result }) => this.emitCatchConfetti(result.rarity));
    this.events.on('marketSold', () => this.emitCoinSparkle());
    this.events.on('upgradePurchased', ({ ok }) => {
      if (ok) this.emitCraftPuff();
    });
  }

  private spawnBurst(
    origin: THREE.Vector3,
    count: number,
    color: string,
    options: { spread?: number; upBias?: number; life?: number; gravity?: number; geometry?: THREE.BufferGeometry } = {},
  ): void {
    const spread = options.spread ?? 1.2;
    const upBias = options.upBias ?? 1.5;
    const life = options.life ?? 0.7;
    const gravity = options.gravity ?? 2.2;
    const material = new THREE.MeshBasicMaterial({ color, transparent: true });

    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(options.geometry ?? this.geometry, material.clone());
      mesh.position.copy(origin);
      this.root.add(mesh);

      const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * spread,
        Math.random() * upBias + 0.4,
        (Math.random() - 0.5) * spread,
      );
      this.particles.push({ mesh, velocity, life, maxLife: life, gravity });
    }
  }

  private emitCastTrail(): void {
    this.spawnBurst(this.anchors.getBobberPosition(), 6, '#dff6ff', { spread: 0.5, upBias: 0.8, life: 0.4, gravity: 1 });
  }

  private emitBiteBurst(): void {
    this.spawnBurst(this.anchors.getBobberPosition(), 8, '#ffce54', { spread: 0.9, upBias: 1.8, life: 0.5 });
  }

  private emitCatchConfetti(rarity: string): void {
    const color = RARITY_COLORS[rarity] ?? RARITY_COLORS.common;
    const isRare = rarity === 'rare' || rarity === 'epic' || rarity === 'legendary';
    this.spawnBurst(this.anchors.getBobberPosition(), isRare ? 22 : 10, color, {
      spread: isRare ? 1.8 : 1.0,
      upBias: isRare ? 2.6 : 1.6,
      life: isRare ? 1.1 : 0.8,
    });
  }

  private emitCoinSparkle(): void {
    this.spawnBurst(this.anchors.getBarnabyPosition(), 10, '#ffd54a', {
      spread: 0.6,
      upBias: 1.2,
      life: 0.6,
      geometry: this.sparkGeometry,
    });
  }

  private emitCraftPuff(): void {
    this.spawnBurst(this.anchors.getCraftingBenchPosition(), 12, '#cbb896', {
      spread: 0.7,
      upBias: 0.9,
      life: 0.5,
      gravity: 0.6,
    });
  }

  update(delta: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const particle = this.particles[i];
      particle.life -= delta;
      if (particle.life <= 0) {
        this.root.remove(particle.mesh);
        (particle.mesh.material as THREE.Material).dispose();
        this.particles.splice(i, 1);
        continue;
      }
      particle.velocity.y -= particle.gravity * delta;
      particle.mesh.position.addScaledVector(particle.velocity, delta);
      const t = particle.life / particle.maxLife;
      (particle.mesh.material as THREE.MeshBasicMaterial).opacity = t;
      particle.mesh.scale.setScalar(0.6 + t * 0.4);
    }
  }

  dispose(): void {
    for (const particle of this.particles) {
      (particle.mesh.material as THREE.Material).dispose();
    }
    this.particles.length = 0;
    this.geometry.dispose();
    this.sparkGeometry.dispose();
  }
}
