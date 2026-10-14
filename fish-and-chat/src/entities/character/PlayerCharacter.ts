import * as THREE from 'three';
import type { ClothingSlot } from '../../game/data';
import { compositeSkinTexture } from './compositeSkin';
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

  private readonly rodTipAnchor = new THREE.Object3D();

  private pose: CharacterPose = 'idle';
  private waveTimer = 0;

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

    // Model and attach a fishing pole in the character's right hand
    const pole = buildFishingPole();
    this.player.skin.rightArm.add(pole);

    // Tip of the held rod (rightArm local space, MC units)
    this.rodTipAnchor.position.set(0, -8.3, 29.2);
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
  }
}

function buildFishingPole(): THREE.Group {
  const pole = new THREE.Group();
  pole.name = 'fishingPole';

  // Handle (cork grip) in player's right hand
  const corkMat = new THREE.MeshStandardMaterial({
    color: '#b07e4d',
    roughness: 0.7,
  });
  const handleGeo = new THREE.CylinderGeometry(0.55, 0.55, 6, 8);
  const handle = new THREE.Mesh(handleGeo, corkMat);
  handle.rotation.x = Math.PI / 2;
  handle.position.set(0, -10.5, 1.0);
  handle.castShadow = true;
  pole.add(handle);

  // Reel attached to handle base
  const metalMat = new THREE.MeshStandardMaterial({
    color: '#3a4454',
    metalness: 0.8,
    roughness: 0.2,
  });
  const reelGeo = new THREE.CylinderGeometry(0.9, 0.9, 0.8, 10);
  const reel = new THREE.Mesh(reelGeo, metalMat);
  reel.rotation.z = Math.PI / 2;
  reel.position.set(0.6, -11.5, 0.2);
  reel.castShadow = true;
  pole.add(reel);

  // Rod blank (carbon shaft tapering toward tip)
  const blankMat = new THREE.MeshStandardMaterial({
    color: '#1a1f26',
    roughness: 0.3,
    metalness: 0.4,
  });
  const blankGeo = new THREE.CylinderGeometry(0.12, 0.38, 28, 8);
  const blank = new THREE.Mesh(blankGeo, blankMat);
  blank.rotation.x = Math.PI / 2 + 0.08;
  blank.position.set(0, -9.5, 15.0);
  blank.castShadow = true;
  pole.add(blank);

  // Tip guide / accent ring at rod tip
  const tipMat = new THREE.MeshStandardMaterial({
    color: '#f26849',
    roughness: 0.3,
  });
  const tipRingGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.6, 8);
  const tipRing = new THREE.Mesh(tipRingGeo, tipMat);
  tipRing.rotation.x = Math.PI / 2;
  tipRing.position.set(0, -8.3, 29.0);
  pole.add(tipRing);

  return pole;
}
