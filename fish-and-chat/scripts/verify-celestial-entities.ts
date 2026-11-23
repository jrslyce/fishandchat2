import * as THREE from 'three';
import { Lighthouse } from '../src/entities/Lighthouse.ts';
import { KrakenTentacle } from '../src/entities/KrakenTentacle.ts';
import { CelestialSky } from '../src/entities/CelestialSky.ts';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
  console.log(`  ✓ ${msg}`);
}

console.log('--- Testing Lighthouse ---');
{
  const lighthouse = new Lighthouse({
    position: new THREE.Vector3(10, -0.3, -13),
    initialFogIntensity: 0.4,
  });

  assert(lighthouse.group.position.x === 10, 'Lighthouse positioned at horizon X=10');
  assert(lighthouse.group.position.y === -0.3, 'Lighthouse positioned at horizon Y=-0.3');
  assert(lighthouse.group.position.z === -13, 'Lighthouse positioned at horizon Z=-13');
  assert(lighthouse.isVisible(), 'Lighthouse is visible by default');

  // Test rotation
  const initialRotation = (lighthouse as any).spotlightGroup.rotation.y;
  lighthouse.update(1.0);
  const rotated = (lighthouse as any).spotlightGroup.rotation.y;
  assert(rotated > initialRotation, 'Lighthouse spotlight continuously rotates around Y axis');

  // Test fog intensity scaling
  lighthouse.setFogIntensity(2.2);
  assert(lighthouse.getFogIntensity() === 0.4, 'Target fog intensity set to 2.2; initially at 0.4');
  lighthouse.update(1.5);
  assert(lighthouse.getFogIntensity() > 1.5, 'Fog intensity smoothly interpolates toward 2.2');
  assert((lighthouse as any).beamMaterial.opacity > 0.4, 'Spotlight beam opacity scales up with fog');

  lighthouse.setVisible(false);
  assert(!lighthouse.isVisible(), 'Lighthouse setVisible(false) hides group');
  lighthouse.setVisible(true);

  lighthouse.dispose();
  assert((lighthouse as any).materialsToDispose.length === 0, 'Lighthouse disposes all materials cleanly');
  assert((lighthouse as any).geometriesToDispose.length === 0, 'Lighthouse disposes all geometries cleanly');
}

console.log('\n--- Testing KrakenTentacle ---');
{
  let breachCallbackInvoked = false;
  let rippleEmitted = false;

  const kraken = new KrakenTentacle({
    waterY: -0.05,
    onBreach: () => { breachCallbackInvoked = true; },
    emitRipple: () => { rippleEmitted = true; },
  });

  assert(!kraken.isBreaching(), 'Kraken starts submerged and inactive');
  assert(!kraken.group.visible, 'Kraken is hidden by default');

  // Trigger breach
  kraken.triggerBreach(new THREE.Vector3(2.5, -0.05, -9.0));
  assert(kraken.isBreaching(), 'isBreaching() is true after trigger');
  assert(breachCallbackInvoked, 'onBreach callback fired on breach trigger');
  assert(kraken.group.visible, 'Kraken becomes visible on breach');

  // Update through emergence stage
  kraken.update(0.6);
  assert(kraken.isBreaching(), 'Kraken still breaching during reach stage');
  assert((kraken as any).tentacleRoot.position.y > -2.0, 'Kraken tentacle rose up towards water surface');

  // Update through surface slap stage (~t=0.78, duration is 4.3s => ~3.3s)
  kraken.update(2.7);
  assert((kraken as any).slapSplashTriggered, 'Kraken surface slap splash triggered');
  assert(rippleEmitted, 'Water ripple emitted on breach / slap');

  // Finish breach
  kraken.update(1.5);
  assert(!kraken.isBreaching(), 'Kraken finished breach sequence and submerged into depths');

  kraken.dispose();
  assert((kraken as any).materialsToDispose.length === 0, 'Kraken disposes all materials cleanly');
  assert((kraken as any).geometriesToDispose.length === 0, 'Kraken disposes all geometries cleanly');
}

console.log('\n--- Testing CelestialSky ---');
{
  const celestial = new CelestialSky({
    initialNightOpacity: 0.0,
  });

  assert(celestial.getNightOpacity() === 0, 'Night opacity starts at 0 during day');
  assert(!celestial.isVisible(), 'Celestial sky invisible during bright day');

  // Fade in to night
  celestial.setNightOpacity(1.0);
  celestial.update(1.0);
  assert(celestial.getNightOpacity() > 0.8, 'Night opacity smoothly fades in toward 1.0');
  assert(celestial.isVisible(), 'Celestial sky visible during night');
  assert((celestial as any).moonMaterial.opacity > 0.8, '3D crescent moon material opacity scales with night');
  assert((celestial as any).haloMaterial.uniforms.uOpacity.value > 0.8, 'Moon halo glow opacity scales with night');

  // Shooting star trigger
  celestial.triggerShootingStar();
  assert((celestial as any).meteorActive, 'Shooting star meteor activated');
  assert((celestial as any).meteorMesh.visible, 'Meteor streak mesh visible');

  celestial.update(0.3);
  assert((celestial as any).meteorActive, 'Meteor streak traveling across celestial sky');

  celestial.update(0.4);
  assert(!(celestial as any).meteorActive, 'Meteor completed streak across night vault');

  celestial.dispose();
  assert((celestial as any).materialsToDispose.length === 0, 'CelestialSky disposes all materials cleanly');
  assert((celestial as any).geometriesToDispose.length === 0, 'CelestialSky disposes all geometries cleanly');
}

console.log('\nALL CELESTIAL & LIVING WORLD VERIFICATIONS PASSED SUCCESSFULLY!');
