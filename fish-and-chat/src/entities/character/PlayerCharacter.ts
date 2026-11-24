import * as THREE from 'three';
import type { ClothingSlot } from '../../game/data';
import { MODEL_SOURCE_MANIFEST_PUBLIC } from '../../assets/manifest';
import { loadImportedAsset } from '../../assets/ImportedAssetRegistry';
import { buildClayAnglerRig, type ClayAnglerRig } from './ClayAnglerRig';
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
export type CharacterGender = 'male' | 'female';

/**
 * Owns the player's 3D angler representation (articulated Alt-A clay figurine when loaded,
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

  // Articulated Alt-A Meshy clay figurine assembly (replaces blocky PlayerObject visuals once loaded)
  private readonly clayBodyPivot = new THREE.Group();
  private clayRig: ClayAnglerRig | null = null;
  private clayAnimClock = 0;
  private gender: CharacterGender = 'male';
  private loadGeneration = 0;

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
    this.rodTipAnchor.position.set(0, -10.5, 31.8);
    this.pole.add(this.rodTipAnchor);

    this.poleHoldGroup.name = 'fishingPoleHoldGroup';
    this.poleHoldGroup.add(this.pole);
    this.player.skin.rightArm.add(this.poleHoldGroup);

    void this.loadClayAngler();
  }

  getGender(): CharacterGender {
    return this.gender;
  }

  setGender(gender: CharacterGender): void {
    const normalized: CharacterGender = gender === 'female' ? 'female' : 'male';
    if (this.gender === normalized && (this.clayRig || this.loadGeneration > 0)) return;
    this.gender = normalized;
    void this.loadClayAngler();
  }

  private async loadClayAngler(): Promise<void> {
    const gen = ++this.loadGeneration;
    const primaryUrl =
      this.gender === 'female'
        ? MODEL_SOURCE_MANIFEST_PUBLIC.anglerFemale
        : MODEL_SOURCE_MANIFEST_PUBLIC.angler;

    try {
      let asset;
      try {
        asset = await loadImportedAsset(primaryUrl);
      } catch {
        asset = await loadImportedAsset(MODEL_SOURCE_MANIFEST_PUBLIC.angler);
      }
      if (this.disposed || gen !== this.loadGeneration) return;

      // Clean up any previous rigged instance before mounting the new gender model
      this.disposeClayRig();

      const rig = buildClayAnglerRig(asset, 0.98);
      this.clayRig = rig;
      this.clayBodyPivot.add(rig.root);
      this.clayBodyPivot.visible = true;
      this.player.visible = false;

      // Seat the cork grip directly inside the sculpted closed fist socket
      this.poleHoldGroup.removeFromParent();
      this.poleHoldGroup.scale.setScalar(CHARACTER_SCALE);
      this.poleHoldGroup.position.set(0, 10.5 * CHARACTER_SCALE, -1.0 * CHARACTER_SCALE);
      rig.rightHandSocket.add(this.poleHoldGroup);

      this.syncClayAccessorySockets();
      this.applyRodShowcaseTransform();
      this.updateClayFigurineAnimation(0);
      this.onModelLoaded?.();
    } catch {
      // Keep PlayerObject fallback if the GLB cannot load.
    }
  }

  private disposeClayRig(): void {
    if (!this.clayRig) return;
    this.poleHoldGroup.removeFromParent();
    for (const { anchor, group } of this.accessories) {
      if (anchor === 'head') {
        group.removeFromParent();
      }
    }
    this.clayRig.root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.geometry?.dispose();
        if (mesh.name === 'anglerContactShadow' || mesh.parent?.name === 'clayAnglerRodPivot') {
          (mesh.material as THREE.Material)?.dispose();
        }
      }
    });
    this.clayBodyPivot.remove(this.clayRig.root);
    this.clayRig = null;
  }

  private syncClayAccessorySockets(): void {
    if (!this.clayRig) return;
    for (const { anchor, group } of this.accessories) {
      if (anchor === 'head') {
        this.clayRig.headSocket.add(group);
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

  /** Poses the Closet rod slightly outward so it remains visible without crossing the face. */
  setShowcaseRod(enabled: boolean): void {
    this.showcaseEnabled = enabled;
    this.applyRodShowcaseTransform();
  }

  private applyRodShowcaseTransform(): void {
    this.pole.rotation.y = this.showcaseEnabled ? -0.32 : 0;
    this.pole.scale.setScalar(this.showcaseEnabled ? 0.86 : 1);
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

  /**
   * Drives gentle Object3D rod & upper-body motion on the natural-stance clay figurine
   * while keeping feet 100% planted on the dock planks at y = 0.
   */
  private updateClayFigurineAnimation(delta: number): void {
    const rig = this.clayRig;
    if (!rig) return;

    this.clayAnimClock += delta;
    const t = this.clayAnimClock;

    // Keep feet & pivot 100% planted on the dock at all times
    this.clayBodyPivot.position.set(0, 0, 0);
    this.clayBodyPivot.rotation.set(0, 0, 0);

    let rodRx = -0.34;
    let rodRy = -0.06;
    let rodRz = 0.04;
    let bodyRx = 0;
    let bodyRy = 0;

    if (this.pose === 'idle') {
      const breath = Math.sin(t * 1.6);
      rodRx = -0.32 + breath * 0.025;
      rodRy = -0.06 + Math.cos(t * 1.3) * 0.015;
      bodyRx = breath * 0.012;
    } else if (this.pose === 'walking') {
      const stride = Math.sin(t * 7.5);
      rodRx = -0.26 + Math.abs(stride) * 0.04;
      bodyRx = 0.03;
      bodyRy = stride * 0.04;
    } else if (this.pose === 'wave') {
      rodRx = -0.28;
      bodyRy = Math.sin(t * 5) * 0.05;
    } else if (this.pose === 'fishing') {
      switch (this.fishAnim.pose) {
        case 'aiming':
          bodyRx = -0.06;
          rodRx = -0.78 + Math.sin(t * 5.5) * 0.04;
          break;
        case 'casting':
          bodyRx = 0.08;
          rodRx = 0.12;
          break;
        case 'waiting': {
          const breath = Math.sin(t * 1.7);
          rodRx = -0.40 + breath * 0.03;
          break;
        }
        case 'bite':
          bodyRx = 0.05;
          rodRx = -0.14 + Math.sin(t * 18) * 0.16;
          rodRz = 0.04 + Math.cos(t * 14) * 0.05;
          break;
        case 'resolving':
          bodyRx = -0.05;
          rodRx = -0.52 + Math.sin(t * 10) * 0.16;
          break;
      }
    }

    if (this.showcaseEnabled) {
      const breath = Math.sin(t * 1.6);
      bodyRx = 0;
      bodyRy = 0;
      rodRx = -0.38 + breath * 0.025;
      rodRy = 0.46;
      rodRz = 0;
    }

    rig.root.rotation.set(bodyRx, bodyRy, 0);
    rig.rightHandSocket.rotation.set(rodRx, rodRy, rodRz);
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
    if (this.clayRig) {
      this.updateClayFigurineAnimation(delta);
    }
  }

  dispose(): void {
    this.disposed = true;
    this.player.skin.map?.dispose();
    this.accessories = setOutfitAccessories(this.player, this.accessories, { hat: null, jacket: null, pants: null, shoes: null });
    this.disposeClayRig();

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

function buildFishingPole(): THREE.Group {
  const pole = new THREE.Group();
  pole.name = 'fishingPole';

  // Tactile cork grip handle held in angler's right hand
  const corkMat = new THREE.MeshStandardMaterial({
    color: '#d6b182',
    roughness: 0.85,
  });
  const handleGeo = new THREE.CylinderGeometry(0.56, 0.56, 5.6, 10);
  const handle = new THREE.Mesh(handleGeo, corkMat);
  handle.rotation.x = Math.PI / 2;
  handle.position.set(0, -10.5, 1.0);
  handle.castShadow = true;
  pole.add(handle);

  // Miniature brushed-brass reel attached snug under the cork handle
  const metalMat = new THREE.MeshStandardMaterial({
    color: CLAY_DEFAULT_REEL_COLOR,
    metalness: 0.72,
    roughness: 0.32,
  });
  const reelGeo = new THREE.CylinderGeometry(0.85, 0.85, 0.78, 12);
  const reel = new THREE.Mesh(reelGeo, metalMat);
  reel.name = 'rod-reel';
  reel.rotation.z = Math.PI / 2;
  reel.position.set(0.55, -11.35, -0.4);
  reel.castShadow = true;
  pole.add(reel);

  // Carved honey-bamboo shaft tapering smoothly toward tip (colinear with cork handle)
  const blankMat = new THREE.MeshStandardMaterial({
    color: CLAY_DEFAULT_ROD_COLOR,
    roughness: 0.65,
    metalness: 0.08,
  });
  const blankGeo = new THREE.CylinderGeometry(0.14, 0.40, 28, 10);
  const blank = new THREE.Mesh(blankGeo, blankMat);
  blank.name = 'rod-blank';
  blank.rotation.x = Math.PI / 2;
  blank.position.set(0, -10.5, 17.5);
  blank.castShadow = true;
  pole.add(blank);

  // Lacquered coral-red tip guide seated flush on the shaft tip
  const tipMat = new THREE.MeshStandardMaterial({
    color: CLAY_DEFAULT_TIP_COLOR,
    roughness: 0.45,
  });
  const tipRingGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.7, 10);
  const tipRing = new THREE.Mesh(tipRingGeo, tipMat);
  tipRing.name = 'rod-tip';
  tipRing.rotation.x = Math.PI / 2;
  tipRing.position.set(0, -10.5, 31.5);
  pole.add(tipRing);

  return pole;
}
