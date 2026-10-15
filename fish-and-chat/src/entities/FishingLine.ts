import * as THREE from 'three';
import { disposeObject3D } from '../utils/dispose';
import type { FishingPhase } from '../game/GameState';

const LINE_RADIUS = 0.0048; // 60% less than original 0.012
const UP = new THREE.Vector3(0, 1, 0);

function createBraidTexture(baseColor: string, weaveColor: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, 32, 32);
    ctx.strokeStyle = weaveColor;
    ctx.lineWidth = 3;
    for (let i = -32; i <= 64; i += 8) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + 32, 32);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(i, 32);
      ctx.lineTo(i + 32, 0);
      ctx.stroke();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 16);
  return texture;
}

/**
 * A thin lit cylinder stretched between the player's rod-tip anchor and the bobber each
 * frame — a lit `MeshStandardMaterial` rather than `THREE.Line` (whose `LineBasicMaterial`
 * is unlit and can't show a specular highlight), so it catches a real glint from
 * RenderPipeline's key light standing in for sun/moonlight.
 */
export class FishingLine {
  readonly mesh: THREE.Mesh;
  private currentTier = -1;
  private readonly materials: THREE.MeshStandardMaterial[] = [];
  private readonly basePositions: THREE.BufferAttribute;

  constructor() {
    // Unit-height cylinder along +Y with 16 height segments so it can bend smoothly.
    // Stretched to the hand-bobber distance via scale.y each update.
    const geometry = new THREE.CylinderGeometry(LINE_RADIUS, LINE_RADIUS, 1, 6, 16);
    this.basePositions = (geometry.attributes.position as THREE.BufferAttribute).clone();

    // Tier 0: Base monofilament (translucent nylon)
    this.materials[0] = new THREE.MeshStandardMaterial({
      color: '#f5f5f0',
      roughness: 0.15,
      metalness: 0.5,
      transparent: true,
      opacity: 0.85,
    });

    // Tier 1: Braided Line I (Chartreuse neon braid)
    const braidTex1 = createBraidTexture('#bfe600', '#7a9900');
    this.materials[1] = new THREE.MeshStandardMaterial({
      color: '#d4ff20',
      roughness: 0.4,
      metalness: 0.2,
      map: braidTex1,
    });

    // Tier 2: Braided Line II (Aqua Kevlar high-tensile braid)
    const braidTex2 = createBraidTexture('#00c8e6', '#007099');
    this.materials[2] = new THREE.MeshStandardMaterial({
      color: '#00e5ff',
      roughness: 0.35,
      metalness: 0.4,
      map: braidTex2,
    });

    // Tier 3: Braided Line III (Mastercraft Golden Dragon Braid)
    const braidTex3 = createBraidTexture('#ffd700', '#a87800');
    this.materials[3] = new THREE.MeshStandardMaterial({
      color: '#ffd700',
      emissive: '#5c4300',
      roughness: 0.2,
      metalness: 0.85,
      map: braidTex3,
    });

    this.mesh = new THREE.Mesh(geometry, this.materials[0]);
    this.mesh.visible = false;
    this.setTier(0);
  }

  setTier(tier: number): void {
    const clampedTier = Math.max(0, Math.min(3, tier));
    if (this.currentTier === clampedTier) return;
    this.currentTier = clampedTier;
    const mat = this.materials[clampedTier] ?? this.materials[0];
    this.mesh.material = mat;
  }

  getTier(): number {
    return this.currentTier;
  }

  setVisible(visible: boolean): void {
    this.mesh.visible = visible;
  }

  /**
   * Stretches, reorients, and dynamically curves/vibrates the line between `start` and `end`.
   * In 'waiting', droops in a natural catenary sag responsive to wave breathing.
   * In 'bite', pulls taut and shudders at high tension frequencies as the hooked fish struggles.
   */
  update(start: THREE.Vector3, end: THREE.Vector3, phase?: FishingPhase, elapsedSeconds = 0): void {
    const distance = start.distanceTo(end);
    if (distance < 0.0001) return;

    this.mesh.position.copy(start).add(end).multiplyScalar(0.5);
    this.mesh.scale.set(1, distance, 1);
    const direction = end.clone().sub(start).normalize();
    if (direction.lengthSq() > 0) this.mesh.quaternion.setFromUnitVectors(UP, direction);

    // Compute local downward and lateral unit vectors in the line's local space
    const invQuat = this.mesh.quaternion.clone().invert();
    const localDown = new THREE.Vector3(0, -1, 0).applyQuaternion(invQuat).normalize();
    const localSide = new THREE.Vector3(1, 0, 0).applyQuaternion(invQuat).normalize();

    let sagAmount = 0.04;
    let vibrationY = 0;
    let vibrationX = 0;

    if (phase === 'waiting') {
      // Natural gentle catenary droop under gravity, subtly breathing with water swell
      sagAmount = 0.045 + Math.sin(elapsedSeconds * 2.6) * 0.008;
    } else if (phase === 'bite') {
      // Taut, straightened line under heavy load, vibrating rapidly with tension shudder
      sagAmount = 0.012;
      const strugglePulse = 1 + Math.sin(elapsedSeconds * 12) * 0.35;
      vibrationY = (Math.sin(elapsedSeconds * 46) * 0.015 + Math.sin(elapsedSeconds * 82) * 0.007) * strugglePulse;
      vibrationX = (Math.cos(elapsedSeconds * 41) * 0.012 + Math.sin(elapsedSeconds * 67) * 0.006) * strugglePulse;
    } else if (phase === 'casting') {
      // Aerodynamic trailing arc
      sagAmount = 0.025;
    }

    const posAttr = this.mesh.geometry.attributes.position as THREE.BufferAttribute;
    const baseAttr = this.basePositions;
    const count = posAttr.count;

    for (let i = 0; i < count; i++) {
      const bx = baseAttr.getX(i);
      const by = baseAttr.getY(i);
      const bz = baseAttr.getZ(i);

      // Normalized parameter: 0 at rod tip (y = -0.5), 1 at bobber (y = +0.5)
      const t = by + 0.5;
      const curveFactor = Math.sin(t * Math.PI);

      const totalDown = (sagAmount + vibrationY) * curveFactor;
      const totalSide = vibrationX * curveFactor;

      posAttr.setXYZ(
        i,
        bx + localDown.x * totalDown + localSide.x * totalSide,
        by,
        bz + localDown.z * totalDown + localSide.z * totalSide,
      );
    }
    posAttr.needsUpdate = true;
  }

  dispose(): void {
    for (const mat of this.materials) {
      if (mat.map) mat.map.dispose();
      mat.dispose();
    }
    disposeObject3D(this.mesh);
  }
}
