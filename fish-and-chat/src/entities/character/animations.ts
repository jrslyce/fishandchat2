/**
 * Adapted from skinview3d (MIT) — https://github.com/bs-community/skinview3d
 * Copyright (c) 2014-2018 Kent Rasmussen; Copyright (c) 2017-2022 Haowei Wen,
 * Sean Boult and contributors. `PlayerAnimation`, `IdleAnimation`,
 * `WalkingAnimation`, and `WaveAnimation` are ported directly (with cape
 * references stripped, since this game's PlayerObject has no cape).
 * `FishingAnimation` at the bottom is new, written for this game.
 */
import type { PlayerObject } from './PlayerObject';

/**
 * An animation which can be played on a {@link PlayerObject}.
 * Subclasses implement particular animations via `animate()`.
 */
export abstract class PlayerAnimation {
  speed = 1.0;
  paused = false;
  progress = 0;

  protected abstract animate(player: PlayerObject, delta: number): void;

  update(player: PlayerObject, deltaTime: number): void {
    if (this.paused) return;
    const delta = deltaTime * this.speed;
    this.animate(player, delta);
    this.progress += delta;
  }
}

export class IdleAnimation extends PlayerAnimation {
  protected animate(player: PlayerObject): void {
    const t = this.progress * 2;
    const basicArmRotationZ = Math.PI * 0.02;
    player.skin.leftArm.rotation.z = Math.cos(t) * 0.03 + basicArmRotationZ;
    player.skin.rightArm.rotation.z = Math.cos(t + Math.PI) * 0.03 - basicArmRotationZ;
  }
}

export class WalkingAnimation extends PlayerAnimation {
  /** Whether to shake head when walking. @defaultValue `true` */
  headBobbing = true;

  protected animate(player: PlayerObject): void {
    const t = this.progress * 8;

    player.skin.leftLeg.rotation.x = Math.sin(t) * 0.5;
    player.skin.rightLeg.rotation.x = Math.sin(t + Math.PI) * 0.5;

    player.skin.leftArm.rotation.x = Math.sin(t + Math.PI) * 0.5;
    player.skin.rightArm.rotation.x = Math.sin(t) * 0.5;
    const basicArmRotationZ = Math.PI * 0.02;
    player.skin.leftArm.rotation.z = Math.cos(t) * 0.03 + basicArmRotationZ;
    player.skin.rightArm.rotation.z = Math.cos(t + Math.PI) * 0.03 - basicArmRotationZ;

    if (this.headBobbing) {
      player.skin.head.rotation.y = Math.sin(t / 4) * 0.2;
      player.skin.head.rotation.x = Math.sin(t / 5) * 0.1;
    } else {
      player.skin.head.rotation.y = 0;
      player.skin.head.rotation.x = 0;
    }
  }
}

export class WaveAnimation extends PlayerAnimation {
  whichArm: 'left' | 'right';

  constructor(whichArm: 'left' | 'right' = 'right') {
    super();
    this.whichArm = whichArm;
  }

  protected animate(player: PlayerObject): void {
    const t = this.progress * 2 * Math.PI * 0.5;
    const targetArm = this.whichArm === 'left' ? player.skin.leftArm : player.skin.rightArm;
    targetArm.rotation.x = -2.6;
    targetArm.rotation.z = (this.whichArm === 'left' ? -1 : 1) * (Math.sin(t) * 0.5 + 0.3);
  }
}

/** Sub-poses this animation blends between; the driver (Game.ts) sets this from real fishing state. */
export type FishingPose = 'aiming' | 'casting' | 'waiting' | 'bite';

/**
 * New animation (not part of upstream skinview3d): cast/hold/reel poses for
 * the right arm, driven by `pose` — set externally to match the real
 * FishingStateMachine phase so the character's arm motion stays in sync with
 * actual gameplay rather than just looping decoratively.
 */
export class FishingAnimation extends PlayerAnimation {
  pose: FishingPose = 'waiting';

  protected animate(player: PlayerObject): void {
    const t = this.progress * 3;
    const rightArm = player.skin.rightArm;
    const leftArm = player.skin.leftArm;

    // Left arm stays loosely at the side throughout, small idle sway.
    leftArm.rotation.x = Math.sin(t * 0.5) * 0.05;
    leftArm.rotation.z = Math.PI * 0.02;

    switch (this.pose) {
      case 'aiming':
        // Wind the rod back over the shoulder while the player holds the gauge.
        rightArm.rotation.x = -1.9 + Math.sin(t * 2) * 0.04;
        rightArm.rotation.z = -0.15;
        break;
      case 'casting':
        // Snap forward — fast swing from the wound-back position to out in front.
        rightArm.rotation.x = -1.9 + Math.min(1, this.progress * 6) * 2.2;
        rightArm.rotation.z = -0.15;
        break;
      case 'waiting':
        // Rod held out steady with a small rhythmic wrist bob.
        rightArm.rotation.x = -1.15 + Math.sin(t) * 0.06;
        rightArm.rotation.z = -0.1;
        break;
      case 'bite':
        // Quick tug motion.
        rightArm.rotation.x = -1.15 + Math.sin(t * 6) * 0.18;
        rightArm.rotation.z = -0.1;
        break;
    }
  }
}
