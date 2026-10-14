import * as THREE from 'three';
import { disposeObject3D } from '../utils/dispose';

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

  constructor() {
    // Unit-height cylinder along +Y; stretched to the hand-bobber distance via scale.y each update.
    const geometry = new THREE.CylinderGeometry(LINE_RADIUS, LINE_RADIUS, 1, 6);

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

  /** Stretches and reorients the line's cylinder to run from `start` to `end` (world space). */
  update(start: THREE.Vector3, end: THREE.Vector3): void {
    this.mesh.position.copy(start).add(end).multiplyScalar(0.5);
    this.mesh.scale.set(1, start.distanceTo(end), 1);
    const direction = end.clone().sub(start).normalize();
    if (direction.lengthSq() > 0) this.mesh.quaternion.setFromUnitVectors(UP, direction);
  }

  dispose(): void {
    for (const mat of this.materials) {
      if (mat.map) mat.map.dispose();
      mat.dispose();
    }
    disposeObject3D(this.mesh);
  }
}
