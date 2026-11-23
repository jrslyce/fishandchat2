import * as THREE from 'three';
import type { ClothingSlot } from '../../game/data';
import { MODEL_SOURCE_MANIFEST_PUBLIC } from '../../assets/manifest';
import { clonedSkinnedGroup, loadImportedAsset } from '../../assets/ImportedAssetRegistry';
import { compositeSkinTexture } from './compositeSkin';
import { PlayerObject } from './PlayerObject';
import { setOutfitAccessories } from './ClothingAccessories';
import { FishingAnimation, IdleAnimation, PlayerAnimation, WalkingAnimation, WaveAnimation, type FishingPose } from './animations';

/** Minecraft-format character is 32 "MC units" tall; scaled here to ~1 game unit (roughly Barnaby's height). */
const CHARACTER_SCALE = 1 / 32;
/** Feet sit at local y=-16 in PlayerObject space (see PlayerObject.ts); shift up so feet land at y=0 of the wrapper. */
const FEET_OFFSET = 16 * CHARACTER_SCALE;
const NAME_TAG_Y = 1.18;
const CLAY_DEFAULT_ROD_COLOR = '#b57f45';
const CLAY_DEFAULT_REEL_COLOR = '#c79642';
const CLAY_DEFAULT_TIP_COLOR = '#e3553f';

export type CharacterPose = 'idle' | 'walking' | 'fishing' | 'wave';

type AccessorySockets = Record<'head' | 'body' | 'leftArm' | 'rightArm' | 'leftLeg' | 'rightLeg', THREE.Group>;

/**
 * Owns the player's 3D angler representation (meshed Alt-A clay figurine when loaded,
 * voxel PlayerObject fallback until ready), clothing/hat sockets, fishing rod pivot,
 * name tag, and pose animations for both the main dock scene and Closet studio.
 */
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
  private readonly pole: THREE.Group;
  private readonly poleHoldGroup = new THREE.Group();
  private readonly goldenRodMaterial: THREE.MeshStandardMaterial;
  private goldenRodEnabled = false;
  private showcaseEnabled = false;
  private rodTime = 0;

  // Sculpted Alt-A Meshy clay figurine assembly (replaces blocky PlayerObject visuals once loaded)
  private readonly clayBodyPivot = new THREE.Group();
  private readonly clayRodPivot = new THREE.Group();
  private readonly claySockets: AccessorySockets = createClaySockets();
  private clayModelGroup: THREE.Group | null = null;
  private clayAnimClock = 0;

  private pose: CharacterPose = 'idle';
  private waveTimer = 0;
  private skinRequest = 0;
  private disposed = false;
  private accessories: ReturnType<typeof setOutfitAccessories> = [];

  constructor(private readonly onModelLoaded?: () => void) {
    this.player = new PlayerObject();
    this.player.position.y = FEET_OFFSET;
    this.player.scale.setScalar(CHARACTER_SCALE);

    this.group = new THREE.Group();
    this.group.name = 'playerCharacter';
    this.group.add(this.player);

    this.clayBodyPivot.name = 'clayAnglerBodyPivot';
    this.clayBodyPivot.visible = false;
    this.clayRodPivot.name = 'clayAnglerRodPivot';
    // Hand socket on the right side of the sculpted A-pose clay figurine.
    this.clayRodPivot.position.set(-0.20, 0.35, 0.02);
    this.clayBodyPivot.add(this.clayRodPivot);
    Object.values(this.claySockets).forEach((socket) => this.clayBodyPivot.add(socket));
    this.group.add(this.clayBodyPivot);

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

    // Carved Alt-A honey-bamboo fishing pole + cork grip + brass reel
    this.pole = buildFishingPole();
    this.goldenRodMaterial = (this.pole.getObjectByName('rod-blank') as THREE.Mesh).material as THREE.MeshStandardMaterial;

    // Anchor the rod tip directly to the pole so world queries follow both fallback and clay pivots.
    this.rodTipAnchor.position.set(0, -8.3, 29.2);
    this.pole.add(this.rodTipAnchor);

    this.poleHoldGroup.name = 'fishingPoleHoldGroup';
    this.poleHoldGroup.add(this.pole);
    this.player.skin.rightArm.add(this.poleHoldGroup);

    void this.loadClayAngler();
  }

  private async loadClayAngler(): Promise<void> {
    try {
      const asset = await loadImportedAsset(MODEL_SOURCE_MANIFEST_PUBLIC.angler);
      if (this.disposed) return;

      const model = clonedSkinnedGroup(asset, 0.98);
      model.name = 'AnglerClayGLB';
      this.clayModelGroup = model;
      this.clayBodyPivot.add(model);
      this.clayBodyPivot.visible = true;
      this.player.visible = false;

      // Move rod assembly into the clay hand socket at world-scale equivalent of PlayerObject (1/32).
      this.poleHoldGroup.removeFromParent();
      this.poleHoldGroup.scale.setScalar(CHARACTER_SCALE);
      this.poleHoldGroup.position.set(0, 10.5 * CHARACTER_SCALE, -1.0 * CHARACTER_SCALE);
      this.clayRodPivot.add(this.poleHoldGroup);

      this.syncClayAccessorySockets();
      this.applyRodShowcaseTransform();
      this.onModelLoaded?.();
    } catch {
      // Keep PlayerObject fallback if the GLB cannot load.
    }
  }

  private syncClayAccessorySockets(): void {
    if (!this.clayModelGroup) return;
    for (const { anchor, group } of this.accessories) {
      if (anchor === 'head') {
        this.claySockets.head.add(group);
      }
    }
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
    if (this.disposed) return;
    const request = ++this.skinRequest;
    this.accessories = setOutfitAccessories(this.player, this.accessories, equipped);
    this.syncClayAccessorySockets();

    const texture = await compositeSkinTexture(baseToneId, equipped);
    if (request !== this.skinRequest || this.disposed) {
      texture.dispose();
      return;
    }
    this.player.skin.map?.dispose();
    this.player.skin.map = texture;
    this.onModelLoaded?.();
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

  /** World-space position of the rod-tip anchor — the fishing line's start point. */
  getRodTipWorldPosition(target: THREE.Vector3): THREE.Vector3 {
    return this.rodTipAnchor.getWorldPosition(target);
  }

  setGoldenRod(enabled: boolean): void {
    this.goldenRodEnabled = enabled;
    this.pole.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh || !mesh.name.startsWith('rod-')) return;
      const material = mesh.material as THREE.MeshStandardMaterial;
      if (mesh.name === 'rod-blank') {
        material.color.set(enabled ? '#f7be2b' : CLAY_DEFAULT_ROD_COLOR);
        material.emissive.set(enabled ? '#6a3900' : '#000000');
        material.metalness = enabled ? 0.95 : 0.08;
      } else if (mesh.name === 'rod-reel') {
        material.color.set(enabled ? '#fff1a4' : CLAY_DEFAULT_REEL_COLOR);
      } else if (mesh.name === 'rod-tip') {
        material.color.set(enabled ? '#fff4a8' : CLAY_DEFAULT_TIP_COLOR);
        material.emissive.set(enabled ? '#8f5b00' : '#000000');
      }
    });
  }

  setRodVisible(visible: boolean): void {
    this.pole.visible = visible;
  }

  /** Poses the Closet rod to the side so it remains visible without crossing the face. */
  setShowcaseRod(enabled: boolean): void {
    this.showcaseEnabled = enabled;
    this.applyRodShowcaseTransform();
  }

  private applyRodShowcaseTransform(): void {
    this.pole.rotation.y = this.showcaseEnabled ? -0.58 : 0;
    this.pole.scale.setScalar(this.showcaseEnabled ? 0.84 : 1);
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

  private updateClayFigurineAnimation(delta: number): void {
    this.clayAnimClock += delta;
    const t = this.clayAnimClock;

    let bodyY = 0;
    let bodyRx = 0;
    let bodyRy = 0;
    let bodyRz = 0;
    let rodRx = -0.35;
    let rodRy = -0.08;
    let rodRz = 0.05;

    if (this.pose === 'idle') {
      bodyY = Math.sin(t * 2.1) * 0.008;
      bodyRz = Math.sin(t * 1.4) * 0.025;
      rodRx = -0.32 + Math.sin(t * 2.1) * 0.04;
      rodRy = -0.08 + Math.cos(t * 1.3) * 0.03;
    } else if (this.pose === 'walking') {
      bodyY = Math.abs(Math.sin(t * 7.5)) * 0.035;
      bodyRz = Math.sin(t * 7.5) * 0.08;
      bodyRx = 0.05;
      rodRx = -0.45 + Math.sin(t * 7.5) * 0.14;
    } else if (this.pose === 'wave') {
      const hopPhase = Math.max(0, 1.5 - this.waveTimer) * Math.PI * 3.5;
      bodyY = Math.abs(Math.sin(hopPhase)) * 0.07;
      bodyRy = Math.sin(hopPhase * 0.5) * 0.22;
      bodyRz = Math.sin(hopPhase) * 0.09;
      rodRx = -0.65 + Math.sin(hopPhase) * 0.18;
      rodRy = -0.22;
    } else if (this.pose === 'fishing') {
      switch (this.fishAnim.pose) {
        case 'aiming':
          bodyRx = -0.11;
          bodyY = -0.012;
          rodRx = -1.05 + Math.sin(t * 6.0) * 0.04;
          rodRy = -0.18;
          break;
        case 'casting':
          bodyRx = 0.16;
          bodyY = 0.01;
          rodRx = 0.42;
          rodRy = -0.05;
          break;
        case 'waiting':
          bodyY = Math.sin(t * 1.8) * 0.007;
          bodyRz = Math.sin(t * 1.2) * 0.02;
          rodRx = -0.36 + Math.sin(t * 2.4) * 0.05;
          rodRy = -0.08;
          break;
        case 'bite':
          bodyRx = 0.06 + Math.sin(t * 18) * 0.03;
          bodyRz = Math.sin(t * 16) * 0.045;
          rodRx = -0.25 + Math.sin(t * 18) * 0.22;
          rodRz = -0.08 + Math.cos(t * 14) * 0.08;
          break;
        case 'resolving':
          bodyRx = -0.14 + Math.sin(t * 12) * 0.04;
          bodyY = Math.abs(Math.sin(t * 12)) * 0.015;
          rodRx = -0.78 + Math.sin(t * 12) * 0.24;
          break;
      }
    }

    if (this.showcaseEnabled) {
      bodyRx = 0;
      bodyRy = 0;
      bodyRz = 0;
      bodyY = Math.sin(t * 1.6) * 0.005;
      rodRx = -0.52 + Math.sin(t * 1.8) * 0.03;
      rodRy = -0.26;
      rodRz = -0.12;
    }

    this.clayBodyPivot.position.y = bodyY;
    this.clayBodyPivot.rotation.set(bodyRx, bodyRy, bodyRz);
    this.clayRodPivot.rotation.set(rodRx, rodRy, rodRz);
  }

  update(delta: number): void {
    this.rodTime += delta;
    if (this.goldenRodEnabled) this.goldenRodMaterial.emissiveIntensity = 0.55 + 0.25 * Math.sin(this.rodTime * 3.6);
    if (this.pose === 'wave') {
      this.waveTimer -= delta;
      if (this.waveTimer <= 0) this.pose = 'idle';
    }
    this.player.resetJoints();
    this.activeAnimation().update(this.player, delta);
    if (this.clayModelGroup) {
      this.updateClayFigurineAnimation(delta);
    }
  }

  dispose(): void {
    this.disposed = true;
    this.skinRequest++;
    this.player.skin.map?.dispose();
    this.accessories = setOutfitAccessories(this.player, this.accessories, { hat: null, jacket: null, pants: null, shoes: null });

    // Only dispose procedural geometries/materials owned by this instance (not shared cached clay GLB assets).
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    for (const root of [this.pole, this.player]) {
      root.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (!mesh.isMesh) return;
        if (mesh.geometry) geometries.add(mesh.geometry);
        const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const mat of list) {
          if (mat) materials.add(mat);
        }
      });
    }
    for (const geo of geometries) geo.dispose();
    for (const mat of materials) mat.dispose();
    this.nameTagTexture.dispose();
    (this.nameTag.material as THREE.Material).dispose();
  }
}

function createClaySockets(): AccessorySockets {
  const head = new THREE.Group();
  head.name = 'claySocketHead';
  head.position.set(0, 0.67, -0.01);
  head.scale.setScalar(0.027);

  const body = new THREE.Group();
  body.name = 'claySocketBody';
  body.position.set(0, 0.29, 0);
  body.scale.setScalar(0.031);

  const leftArm = new THREE.Group();
  leftArm.name = 'claySocketLeftArm';
  leftArm.position.set(0.18, 0.44, 0);
  leftArm.scale.setScalar(0.029);

  const rightArm = new THREE.Group();
  rightArm.name = 'claySocketRightArm';
  rightArm.position.set(-0.18, 0.44, 0);
  rightArm.scale.setScalar(0.029);

  const leftLeg = new THREE.Group();
  leftLeg.name = 'claySocketLeftLeg';
  leftLeg.position.set(0.075, 0.34, 0);
  leftLeg.scale.setScalar(0.028);

  const rightLeg = new THREE.Group();
  rightLeg.name = 'claySocketRightLeg';
  rightLeg.position.set(-0.075, 0.34, 0);
  rightLeg.scale.setScalar(0.028);

  return { head, body, leftArm, rightArm, leftLeg, rightLeg };
}

function buildFishingPole(): THREE.Group {
  const pole = new THREE.Group();
  pole.name = 'fishingPole';

  // Tactile cork grip handle held in angler's right hand
  const corkMat = new THREE.MeshStandardMaterial({
    color: '#d6b182',
    roughness: 0.85,
  });
  const handleGeo = new THREE.CylinderGeometry(0.62, 0.62, 6, 10);
  const handle = new THREE.Mesh(handleGeo, corkMat);
  handle.rotation.x = Math.PI / 2;
  handle.position.set(0, -10.5, 1.0);
  handle.castShadow = true;
  pole.add(handle);

  // Miniature brushed-brass reel attached to handle base
  const metalMat = new THREE.MeshStandardMaterial({
    color: CLAY_DEFAULT_REEL_COLOR,
    metalness: 0.72,
    roughness: 0.32,
  });
  const reelGeo = new THREE.CylinderGeometry(0.95, 0.95, 0.85, 12);
  const reel = new THREE.Mesh(reelGeo, metalMat);
  reel.name = 'rod-reel';
  reel.rotation.z = Math.PI / 2;
  reel.position.set(0.65, -11.5, 0.2);
  reel.castShadow = true;
  pole.add(reel);

  // Carved honey-bamboo shaft tapering smoothly toward tip
  const blankMat = new THREE.MeshStandardMaterial({
    color: CLAY_DEFAULT_ROD_COLOR,
    roughness: 0.65,
    metalness: 0.08,
  });
  const blankGeo = new THREE.CylinderGeometry(0.14, 0.42, 28, 10);
  const blank = new THREE.Mesh(blankGeo, blankMat);
  blank.name = 'rod-blank';
  blank.rotation.x = Math.PI / 2 + 0.08;
  blank.position.set(0, -9.5, 15.0);
  blank.castShadow = true;
  pole.add(blank);

  // Lacquered coral-red tip guide
  const tipMat = new THREE.MeshStandardMaterial({
    color: CLAY_DEFAULT_TIP_COLOR,
    roughness: 0.45,
  });
  const tipRingGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.7, 10);
  const tipRing = new THREE.Mesh(tipRingGeo, tipMat);
  tipRing.name = 'rod-tip';
  tipRing.rotation.x = Math.PI / 2;
  tipRing.position.set(0, -8.3, 29.0);
  pole.add(tipRing);

  return pole;
}
