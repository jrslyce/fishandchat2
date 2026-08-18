import { BoxGeometry, ColorRepresentation, DoubleSide, Group, Mesh, MeshStandardMaterial } from 'three';

/**
 * Geometric hats attach to PlayerObject's `head` BodyPart, whose meshes span
 * local y 0..8 (an 8x8x8 cube). Unlike the texture-based hat overlay (a
 * uniformly-scaled-up copy of that same cube, see PlayerObject.ts's
 * `head2Box`), real geometry can be wider than the head, which is what a
 * cowboy-hat brim needs.
 *
 * Geometry hats are also the cheap axis for cosmetic variety: each one is a
 * few boxes and three colors, so a new hat costs a catalog entry rather than
 * a hand-authored PNG. That's why the hat catalog leans on these shapes.
 *
 * The head's face is on +Z (see setSkinUVs in PlayerObject.ts, where the
 * `front` UV island maps to BoxGeometry's 5th face group), so forward-pointing
 * details like a cap bill extend toward +Z.
 */
export interface HatGeometryColors {
  crown: ColorRepresentation;
  band: ColorRepresentation;
  brim: ColorRepresentation;
}

export type HatShape = 'brimmed' | 'bucket' | 'top' | 'beanie' | 'cap' | 'visor';

/** Head cube top surface; every hat stacks upward from here. */
const HEAD_TOP = 8;

function box(
  width: number,
  height: number,
  depth: number,
  y: number,
  color: ColorRepresentation,
  z = 0,
): Mesh {
  const mesh = new Mesh(
    new BoxGeometry(width, height, depth),
    new MeshStandardMaterial({ color, side: DoubleSide }),
  );
  mesh.position.set(0, y + height / 2, z);
  return mesh;
}

export function buildHatGeometry(shape: HatShape, colors: HatGeometryColors): Group {
  const group = new Group();
  group.name = `hat-geometry-${shape}`;

  switch (shape) {
    case 'brimmed':
      group.add(box(15, 1, 15, HEAD_TOP, colors.brim));
      group.add(box(7.4, 1, 7.4, HEAD_TOP + 1, colors.band));
      group.add(box(7, 4, 7, HEAD_TOP + 2, colors.crown));
      break;

    case 'bucket':
      group.add(box(12.5, 1, 12.5, HEAD_TOP, colors.brim));
      group.add(box(9, 1, 9, HEAD_TOP + 1, colors.band));
      group.add(box(8.6, 3, 8.6, HEAD_TOP + 2, colors.crown));
      break;

    case 'top':
      group.add(box(12, 1, 12, HEAD_TOP, colors.brim));
      group.add(box(8.6, 1.2, 8.6, HEAD_TOP + 1, colors.band));
      group.add(box(8.2, 7, 8.2, HEAD_TOP + 2.2, colors.crown));
      break;

    case 'beanie':
      // Sits low and close: a cuff that overlaps the head sides, then a dome.
      group.add(box(9.2, 2, 9.2, HEAD_TOP - 1.6, colors.band));
      group.add(box(8.8, 3, 8.8, HEAD_TOP + 0.4, colors.crown));
      group.add(box(3, 1.4, 3, HEAD_TOP + 3.4, colors.brim));
      break;

    case 'cap':
      // Bill extends over the face (+Z) only.
      group.add(box(8.8, 1, 8.8, HEAD_TOP - 0.6, colors.band));
      group.add(box(8.4, 3.2, 8.4, HEAD_TOP + 0.4, colors.crown));
      group.add(box(8, 0.8, 5, HEAD_TOP - 0.8, colors.brim, 6.2));
      break;

    case 'visor':
      // Band + bill, no crown — the hair/head stays visible through the top.
      group.add(box(9, 1.8, 9, HEAD_TOP - 1.8, colors.band));
      group.add(box(8.4, 0.8, 5.5, HEAD_TOP - 1.6, colors.brim, 6.4));
      break;
  }

  group.traverse((child) => {
    const mesh = child as Mesh;
    if (mesh.isMesh) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
  });

  return group;
}
