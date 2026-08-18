import * as THREE from 'three';
import { CLOTHING_CATALOG, type ClothingSlot } from '../../game/data';
import { compositeSkinTexture } from './compositeSkin';
import { buildHatGeometry } from './hatGeometry';
import { PlayerObject } from './PlayerObject';
import { FishingAnimation, IdleAnimation, PlayerAnimation, WalkingAnimation, WaveAnimation, type FishingPose } from './animations';

/** Minecraft-format character is 32 "MC units" tall; scaled here to ~1 game unit (roughly Barnaby's height). */
const CHARACTER_SCALE = 1 / 32;
/** Feet sit at local y=-16 in PlayerObject space (see PlayerObject.ts); shift up so feet land at y=0 of the wrapper. */
const FEET_OFFSET = 16 * CHARACTER_SCALE;

export type CharacterPose = 'idle' | 'walking' | 'fishing' | 'wave';

/**
 * Wraps the ported skinview3d PlayerObject with this game's own scale/offset,
 * skin-texture compositing, and pose switching. `group` is what callers add
 * to a scene slot; everything else is internal bookkeeping.
 */
const NAME_TAG_Y = 1.18;

export class PlayerCharacter {
  readonly group: THREE.Group;
  private readonly player: PlayerObject;
  private readonly nameTag: THREE.Sprite;
  private nameTagCanvas!: HTMLCanvasElement;
  private nameTagTexture!: THREE.CanvasTexture;

  private readonly idleAnim = new IdleAnimation();
  private readonly walkAnim = new WalkingAnimation();
  private readonly fishAnim = new FishingAnimation();
  // Left arm waves — the right arm is reserved for fishing poses.
  private readonly waveAnim = new WaveAnimation('left');

  // No rod is modeled — FishingAnimation only swings the arm bone to imply holding one.
  // Anchoring this to the arm (rather than computing a world offset by hand) means it
  // automatically rides the same aiming/casting/waiting swing for free.
  private readonly rodTipAnchor = new THREE.Object3D();

  private pose: CharacterPose = 'idle';
  private waveTimer = 0;
  private hatGeometry: THREE.Group | null = null;

  constructor() {
    this.player = new PlayerObject();
    this.player.position.y = FEET_OFFSET;
    this.player.scale.setScalar(CHARACTER_SCALE);

    this.group = new THREE.Group();
    this.group.name = 'playerCharacter';
    this.group.add(this.player);

    this.player.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });

    this.nameTag = this.buildNameTag();
    this.nameTag.position.y = NAME_TAG_Y;
    this.nameTag.visible = false;
    this.group.add(this.nameTag);
    this.setName('Angler');

    // A bit past the hand (rightArm's own local space, Minecraft units) — approximates
    // where a held rod's tip would sit.
    this.rodTipAnchor.position.set(0, -13, 0);
    this.player.skin.rightArm.add(this.rodTipAnchor);
  }

  private buildNameTag(): THREE.Sprite {
    this.nameTagCanvas = document.createElement('canvas');
    this.nameTagCanvas.width = 256;
    this.nameTagCanvas.height = 64;
    this.nameTagTexture = new THREE.CanvasTexture(this.nameTagCanvas);
    const material = new THREE.SpriteMaterial({ map: this.nameTagTexture, depthTest: false, transparent: true });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(0.5, 0.125, 1);
    sprite.renderOrder = 10;
    return sprite;
  }

  /** Redraws the floating name-tag sprite above the character's head. */
  setName(name: string): void {
    const ctx = this.nameTagCanvas.getContext('2d')!;
    const w = this.nameTagCanvas.width;
    const h = this.nameTagCanvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.font = '700 34px "Baloo 2", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const textWidth = ctx.measureText(name).width;
    const pillW = Math.min(w, textWidth + 48);
    const pillH = 52;
    const x = (w - pillW) / 2;
    const y = (h - pillH) / 2;
    const radius = pillH / 2;
    ctx.fillStyle = 'rgba(44, 58, 48, 0.78)';
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + pillW, y, x + pillW, y + pillH, radius);
    ctx.arcTo(x + pillW, y + pillH, x, y + pillH, radius);
    ctx.arcTo(x, y + pillH, x, y, radius);
    ctx.arcTo(x, y, x + pillW, y, radius);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#fbf6ea';
    ctx.fillText(name, w / 2, h / 2 + 2);
    this.nameTagTexture.needsUpdate = true;
  }

  /** Recomposites the skin texture from a base tone + equipped clothing and applies it. */
  async refreshSkin(baseToneId: string, equipped: Record<ClothingSlot, string | null>): Promise<void> {
    const texture = await compositeSkinTexture(baseToneId, equipped);
    this.player.skin.map?.dispose();
    this.player.skin.map = texture;
    this.refreshHatGeometry(equipped.hat);
  }

  /**
   * Hats with a `hatGeometry` catalog entry (e.g. the cowboy hat's brim) render
   * as a real mesh attached to the head bone instead of a flat texture overlay
   * — see hatGeometry.ts for why. Swaps it out whenever the equipped hat changes.
   */
  private refreshHatGeometry(hatId: string | null): void {
    if (this.hatGeometry) {
      this.player.skin.head.remove(this.hatGeometry);
      this.hatGeometry.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.geometry.dispose();
          (mesh.material as THREE.Material).dispose();
        }
      });
      this.hatGeometry = null;
    }

    const item = hatId ? CLOTHING_CATALOG.find((c) => c.id === hatId) : null;
    if (!item?.hatGeometry) return;

    this.hatGeometry = buildHatGeometry(item.hatGeometry.shape, item.hatGeometry);
    this.player.skin.head.add(this.hatGeometry);
  }

  setPose(pose: CharacterPose): void {
    if (pose === 'wave') {
      // One-shot: play the wave for ~1.5s, then fall back to idle.
      this.waveAnim.progress = 0;
      this.waveTimer = 1.5;
    }
    this.pose = pose;
  }

  setFishingSubPose(sub: FishingPose): void {
    this.fishAnim.pose = sub;
  }

  /** World-space position of the rod-tip anchor (see constructor) — the fishing line's start point. */
  getRodTipWorldPosition(target: THREE.Vector3): THREE.Vector3 {
    return this.rodTipAnchor.getWorldPosition(target);
  }

  private activeAnimation(): PlayerAnimation {
    switch (this.pose) {
      case 'walking':
        return this.walkAnim;
      case 'fishing':
        return this.fishAnim;
      case 'wave':
        return this.waveAnim;
      default:
        return this.idleAnim;
    }
  }

  update(delta: number): void {
    if (this.pose === 'wave') {
      this.waveTimer -= delta;
      if (this.waveTimer <= 0) this.pose = 'idle';
    }
    this.player.resetJoints();
    this.activeAnimation().update(this.player, delta);
  }

  dispose(): void {
    this.player.skin.map?.dispose();
    this.nameTagTexture.dispose();
    this.refreshHatGeometry(null);
  }
}
