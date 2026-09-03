import * as THREE from 'three';
import type { ClothingSlot } from '../../game/data';
import { compositeSkinTexture } from './compositeSkin';
import { PlayerObject } from './PlayerObject';
import { FishingAnimation, IdleAnimation, PlayerAnimation, WalkingAnimation, WaveAnimation, type FishingPose } from './animations';

/** Minecraft-format character is 32 "MC units" tall; scaled here to ~1 game unit (roughly Barnaby's height). */
const CHARACTER_SCALE = 1 / 32;
/** Feet sit at local y=-16 in PlayerObject space (see PlayerObject.ts); shift up so feet land at y=0 of the wrapper. */
const FEET_OFFSET = 16 * CHARACTER_SCALE;
/**
 * Height of the hip joint above the group origin — the legs are 12 MC units
 * long, so with them swung forward for a seat this is exactly how far the
 * group has to drop for the hips to land on the seat surface. Exported so
 * DioramaBuilder can place the slot against a real crate height instead of a
 * hand-tuned magic number.
 */
export const SEATED_HIP_HEIGHT = 12 * CHARACTER_SCALE;
/** Thighs swung forward to just past horizontal — the seated read for a knee-less box rig. */
const SEATED_LEG_PITCH = -1.48;
/**
 * Outward splay at the hips. Enough that both knees clear the torso from
 * directly behind — which is the only angle the fixed camera ever sees the
 * angler from, and without it the swung-forward legs hide entirely and the
 * pose reads as a torso balanced on a box.
 */
const SEATED_LEG_SPLAY = 0.24;

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
  private seated = false;

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

  /**
   * Sits the character down (on the crate at the water's edge). Applied on top
   * of whichever animation is running rather than as another pose, so idle
   * sway, the fishing arm swing and the catch wave all still play while seated.
   */
  setSeated(seated: boolean): void {
    this.seated = seated;
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
    if (this.seated) this.applySeatedLegs();
  }

  /**
   * Overrides whatever the active animation did to the legs. Runs last on
   * purpose: the arm-driven animations above are free to keep animating, and
   * the legs simply stay folded onto the crate underneath them.
   */
  private applySeatedLegs(): void {
    const { leftLeg, rightLeg } = this.player.skin;
    leftLeg.rotation.x = SEATED_LEG_PITCH;
    rightLeg.rotation.x = SEATED_LEG_PITCH;
    leftLeg.rotation.z = -SEATED_LEG_SPLAY;
    rightLeg.rotation.z = SEATED_LEG_SPLAY;
  }

  dispose(): void {
    this.player.skin.map?.dispose();
    this.nameTagTexture.dispose();
  }
}
