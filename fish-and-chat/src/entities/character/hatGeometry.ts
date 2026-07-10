import { BoxGeometry, ColorRepresentation, DoubleSide, Group, Mesh, MeshStandardMaterial } from 'three';

/**
 * Geometric hats attach to PlayerObject's `head` BodyPart, whose meshes span
 * local y 0..8 (an 8x8x8 cube). Unlike the texture-based hat overlay (a
 * uniformly-scaled-up copy of that same cube, see PlayerObject.ts's
 * `head2Box`), real geometry can be wider than the head, which is what a
 * cowboy-hat brim needs.
 */
export interface HatGeometryColors {
  crown: ColorRepresentation;
  band: ColorRepresentation;
  brim: ColorRepresentation;
}

export function buildCowboyHatGeometry(colors: HatGeometryColors): Group {
  const group = new Group();
  group.name = 'cowboy-hat-geometry';

  const brim = new Mesh(
    new BoxGeometry(15, 1, 15),
    new MeshStandardMaterial({ color: colors.brim, side: DoubleSide }),
  );
  brim.position.y = 8.5;
  group.add(brim);

  const band = new Mesh(new BoxGeometry(7.4, 1, 7.4), new MeshStandardMaterial({ color: colors.band }));
  band.position.y = 9.5;
  group.add(band);

  const crown = new Mesh(new BoxGeometry(7, 4, 7), new MeshStandardMaterial({ color: colors.crown }));
  crown.position.y = 12;
  group.add(crown);

  group.traverse((child) => {
    const mesh = child as Mesh;
    if (mesh.isMesh) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
  });

  return group;
}
