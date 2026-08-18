import * as THREE from 'three';
import { DOCK_ANCHOR, POND_RADIUS } from '../world/DioramaBuilder';
import { hasTopTerrainCell } from '../world/VoxelKit';

/**
 * Where the player character is allowed to stand, and how it gets there.
 *
 * Everything here is in WORLD space; the character is parented to the diorama's
 * playerSlot, so callers convert at the boundary.
 *
 * Routing is a breadth-first search over a fine grid rather than steering. That
 * looks like overkill for one pond, but greedy steering genuinely does not work
 * on this island: the dock is a dead-end jetty over the water, and the pond rim
 * is a voxel staircase full of pockets. Both are shapes where the only way
 * forward is briefly backward, and no amount of detour-angle tuning fixes that.
 * The grid is ~1,900 cells and the search runs once per click.
 */

/**
 * Walkable land is the grassy top tier of the island. Its outer boundary is a
 * noisy voxel silhouette that swings by up to 0.8 units with direction, so this
 * asks the terrain builder which cell exists rather than approximating with a
 * radius — an approximation either fences the player off from ground they can
 * plainly see, or walks them off the edge, depending on the direction.
 */
function onBank(x: number, z: number): boolean {
  // The pond rim voxel straddles POND_RADIUS, so a cell can exist under a point
  // the water disc still covers. Keep the character out of the wet part of it.
  if (Math.hypot(x, z) < POND_RADIUS) return false;
  return hasTopTerrainCell(Math.round(x), Math.round(z));
}

/**
 * The dock is the exception to the pond rule: it overhangs the water, so its
 * planks sit at r≈2.2, well inside POND_RADIUS. Derived from the plank run
 * buildDock lays down — 0.9 wide, planks centred at local z 0.9 down to -1.35
 * with 0.42 depth — offset by DOCK_ANCHOR.
 *
 * The inset is deliberately small. It has to stay under the character's own
 * standing footprint, because the dock is where the character spawns and idles:
 * insetting far enough to look "safe" instead puts the spawn point outside the
 * walkable set, and then every route planned from it is wrong.
 */
const DOCK_EDGE_INSET = 0.06;
const DOCK_HALF_WIDTH = 0.45 - DOCK_EDGE_INSET;
const DOCK_Z_MIN = DOCK_ANCHOR.z - 1.35 - 0.21 + DOCK_EDGE_INSET;
const DOCK_Z_MAX = DOCK_ANCHOR.z + 0.9 + 0.21 - DOCK_EDGE_INSET;

function onDock(x: number, z: number): boolean {
  return Math.abs(x - DOCK_ANCHOR.x) <= DOCK_HALF_WIDTH && z >= DOCK_Z_MIN && z <= DOCK_Z_MAX;
}

/** True if the character can stand at this world XZ — grassy bank or dock planks, never open water. */
export function isWalkable(x: number, z: number): boolean {
  return onDock(x, z) || onBank(x, z);
}

/** Metres per second. The wander loop's 0.25 is a shuffle; a commanded walk should feel deliberate. */
export const WALK_SPEED = 1.2;

/** Close enough to count as arrived — smaller than one walk step at 60fps would cause jitter. */
export const ARRIVAL_RADIUS = 0.12;

// --- Navigation grid -------------------------------------------------------

/**
 * Grid pitch. Has to be well under the dock's 0.78-unit walkable width or the
 * jetty falls out of the graph entirely and the character can never leave it.
 */
const CELL = 0.25;
/** Half-extent of the grid; the island's noisy silhouette reaches ~5.4. */
const EXTENT = 5.5;
const DIM = Math.ceil((EXTENT * 2) / CELL) + 1;

let grid: Uint8Array | null = null;

/**
 * The terrain is generated deterministically from the same formula every
 * rebuild, so the grid is built once and reused across theme switches.
 */
function navGrid(): Uint8Array {
  if (grid) return grid;
  const built = new Uint8Array(DIM * DIM);
  for (let ix = 0; ix < DIM; ix++) {
    for (let iz = 0; iz < DIM; iz++) {
      const x = ix * CELL - EXTENT;
      const z = iz * CELL - EXTENT;
      built[ix * DIM + iz] = isWalkable(x, z) ? 1 : 0;
    }
  }
  grid = built;
  return built;
}

function toIndex(value: number): number {
  return Math.round((value + EXTENT) / CELL);
}

function toWorld(index: number): number {
  return index * CELL - EXTENT;
}

function cellOpen(ix: number, iz: number): boolean {
  if (ix < 0 || iz < 0 || ix >= DIM || iz >= DIM) return false;
  return navGrid()[ix * DIM + iz] === 1;
}

/** Nearest open cell to a world point, searched in rings. Guards against a click or a spawn landing a hair off the walkable set. */
function nearestOpenCell(x: number, z: number): { ix: number; iz: number } | null {
  const cx = toIndex(x);
  const cz = toIndex(z);
  if (cellOpen(cx, cz)) return { ix: cx, iz: cz };
  for (let ring = 1; ring <= 6; ring++) {
    for (let dx = -ring; dx <= ring; dx++) {
      for (let dz = -ring; dz <= ring; dz++) {
        if (Math.abs(dx) !== ring && Math.abs(dz) !== ring) continue;
        if (cellOpen(cx + dx, cz + dz)) return { ix: cx + dx, iz: cz + dz };
      }
    }
  }
  return null;
}

/** True if a straight line between two world points stays walkable the whole way. */
function lineOfSight(ax: number, az: number, bx: number, bz: number): boolean {
  const distance = Math.hypot(bx - ax, bz - az);
  const samples = Math.ceil(distance / (CELL * 0.5));
  for (let i = 1; i < samples; i++) {
    const t = i / samples;
    if (!isWalkable(ax + (bx - ax) * t, az + (bz - az) * t)) return false;
  }
  return true;
}

/**
 * Waypoints from `from` to `to`, or an empty array if no walkable route exists.
 *
 * Breadth-first over the nav grid, then string-pulled: consecutive waypoints
 * are collapsed while the straight line between them stays walkable, so the
 * character walks natural diagonals instead of tracing grid steps.
 */
export function findPath(from: THREE.Vector3, to: THREE.Vector3): THREE.Vector3[] {
  const start = nearestOpenCell(from.x, from.z);
  const goal = nearestOpenCell(to.x, to.z);
  if (!start || !goal) return [];

  const startIndex = start.ix * DIM + start.iz;
  const goalIndex = goal.ix * DIM + goal.iz;
  if (startIndex === goalIndex) return [to.clone()];

  const cameFrom = new Int32Array(DIM * DIM).fill(-1);
  cameFrom[startIndex] = startIndex;
  const queue = [startIndex];

  let found = false;
  for (let head = 0; head < queue.length && !found; head++) {
    const current = queue[head];
    const ix = Math.floor(current / DIM);
    const iz = current % DIM;

    for (let dx = -1; dx <= 1 && !found; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        if (dx === 0 && dz === 0) continue;
        const nx = ix + dx;
        const nz = iz + dz;
        if (!cellOpen(nx, nz)) continue;
        // Diagonals may not squeeze past a corner — without this the path can
        // clip the pond rim between two water cells.
        if (dx !== 0 && dz !== 0 && (!cellOpen(ix + dx, iz) || !cellOpen(ix, iz + dz))) continue;
        const neighbor = nx * DIM + nz;
        if (cameFrom[neighbor] !== -1) continue;
        cameFrom[neighbor] = current;
        if (neighbor === goalIndex) {
          found = true;
          break;
        }
        queue.push(neighbor);
      }
    }
  }

  if (cameFrom[goalIndex] === -1) return [];

  const cells: number[] = [];
  for (let node = goalIndex; node !== startIndex; node = cameFrom[node]) cells.push(node);
  cells.reverse();

  const points = cells.map((node) =>
    new THREE.Vector3(toWorld(Math.floor(node / DIM)), from.y, toWorld(node % DIM)),
  );
  // Finish at the exact clicked point when it is itself standable, so the
  // character stops where the player pointed rather than on a grid centre.
  if (isWalkable(to.x, to.z)) points[points.length - 1] = new THREE.Vector3(to.x, from.y, to.z);

  return stringPull(from, points);
}

function stringPull(from: THREE.Vector3, points: THREE.Vector3[]): THREE.Vector3[] {
  const pulled: THREE.Vector3[] = [];
  let anchor = from;
  let index = 0;
  while (index < points.length) {
    let furthest = index;
    for (let candidate = points.length - 1; candidate > index; candidate--) {
      if (lineOfSight(anchor.x, anchor.z, points[candidate].x, points[candidate].z)) {
        furthest = candidate;
        break;
      }
    }
    pulled.push(points[furthest]);
    anchor = points[furthest];
    index = furthest + 1;
  }
  return pulled;
}

/** Dev-only probe for the walkable set and the router; mirrors Game's __game hook. */
if (import.meta.env.DEV) {
  (window as unknown as { __nav?: unknown }).__nav = {
    isWalkable,
    findPath: (ax: number, az: number, bx: number, bz: number) =>
      findPath(new THREE.Vector3(ax, 0, az), new THREE.Vector3(bx, 0, bz)).map((p) => [
        +p.x.toFixed(2),
        +p.z.toFixed(2),
      ]),
    openCellCount: () => navGrid().reduce((total, cell) => total + cell, 0),
    gridDim: () => DIM,
  };
}

export interface StepResult {
  position: THREE.Vector3;
  /** Facing for the movement taken, or null once within ARRIVAL_RADIUS. */
  heading: number | null;
  arrived: boolean;
}

/**
 * Advances one frame straight toward `target`. No obstacle handling here on
 * purpose — findPath already guarantees the leg is clear, which is exactly what
 * makes this safe to keep trivial.
 */
export function stepTowardTarget(
  from: THREE.Vector3,
  target: THREE.Vector3,
  delta: number,
  speed = WALK_SPEED,
): StepResult {
  const dx = target.x - from.x;
  const dz = target.z - from.z;
  const distance = Math.hypot(dx, dz);
  if (distance <= ARRIVAL_RADIUS) {
    return { position: from.clone(), heading: null, arrived: true };
  }

  // Never overshoot on a long frame (tab refocus, slow device).
  const stepLength = Math.min(speed * delta, distance);
  const heading = Math.atan2(dx, dz);
  return {
    position: new THREE.Vector3(
      from.x + (dx / distance) * stepLength,
      from.y,
      from.z + (dz / distance) * stepLength,
    ),
    heading,
    arrived: false,
  };
}
