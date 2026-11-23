import * as THREE from 'three';
import type { EventBus } from '../core/EventBus';
import type { GameEventMap } from '../game/events';
import type { WaterSystem } from './WaterSystem';
import { RainbowArc } from '../entities/RainbowArc';
import { DistantBoat } from '../entities/DistantBoat';
import { BreachingWhale } from '../entities/BreachingWhale';
import { FlockOfBirds } from '../entities/FlockOfBirds';
import { Lighthouse } from '../entities/Lighthouse';
import { KrakenTentacle } from '../entities/KrakenTentacle';
import { CelestialSky } from '../entities/CelestialSky';
import { WeatherSystem, type WeatherType } from './WeatherSystem';
export type { WeatherType };

export interface LivingWorldOptions {
  scene: THREE.Scene;
  water: WaterSystem;
  events?: EventBus<GameEventMap>;
  hemisphereLight?: THREE.HemisphereLight;
  keyLight?: THREE.DirectionalLight;
  initialWeather?: WeatherType;
  ambientWhalesEnabled?: boolean;
  ambientKrakenEnabled?: boolean;
  initialTheme?: string;
}

/**
 * LivingWorldSystem coordinates all living background entities and atmosphere:
 * - WeatherSystem: rain particles, water ripples, dynamic lighting & fog presets
 * - RainbowArc: 7-color vibrant spectral arch positioned over the horizon
 * - DistantBoat: low-poly trawler bobbing on waves, cruising horizon, steam & wake
 * - BreachingWhale: humpback whale leaps in parabolic arcs with splash particles
 * - FlockOfBirds: seagulls with sinusoidal flapping wings soaring and swooping
 * - Lighthouse: rocky crag base, banded tower, balcony, lantern room, and 360 rotating spotlight
 * - KrakenTentacle: colossal sea monster tentacle rising in curved S-shape with splash slap
 * - CelestialSky: 3D crescent moon, twinkling starfield, and shooting star meteors
 */
export class LivingWorldSystem {
  readonly rainbowArc: RainbowArc;
  readonly boat: DistantBoat;
  readonly whale: BreachingWhale;
  readonly flock: FlockOfBirds;
  readonly lighthouse: Lighthouse;
  readonly kraken: KrakenTentacle;
  readonly celestialSky: CelestialSky;
  readonly weather: WeatherSystem;

  private readonly root = new THREE.Group();
  private readonly scene: THREE.Scene;
  private readonly events?: EventBus<GameEventMap>;

  private ambientWhaleTimer = 110.0;
  private readonly ambientWhalesEnabled: boolean;

  private ambientKrakenTimer = 160.0;
  private readonly ambientKrakenEnabled: boolean;

  private currentTheme: string;

  constructor(options: LivingWorldOptions) {
    this.scene = options.scene;
    this.events = options.events;
    this.ambientWhalesEnabled = options.ambientWhalesEnabled ?? true;
    this.ambientKrakenEnabled = options.ambientKrakenEnabled ?? true;
    this.currentTheme = options.initialTheme ?? 'forest-pond';

    this.root.name = 'LivingWorldRoot';
    this.scene.add(this.root);

    // 1. Rainbow Arc (distant background)
    this.rainbowArc = new RainbowArc();
    this.root.add(this.rainbowArc.group);

    // 2. Distant Cruising Boat (water horizon)
    this.boat = new DistantBoat();
    this.root.add(this.boat.group);

    // 3. Breaching Humpback Whale
    this.whale = new BreachingWhale({
      waterY: -0.05,
      emitRipple: (x, z) => options.water.emitRipple(x, z),
      onBreach: (pos) => {
        this.events?.emit('toast', { message: 'A humpback whale breaches on the horizon!' });
        this.events?.emit('whaleJump', { position: { x: pos.x, y: pos.y, z: pos.z } });
      },
    });
    this.root.add(this.whale.group);

    // 4. Flock of Soaring Seagulls
    this.flock = new FlockOfBirds();
    this.root.add(this.flock.group);

    // 5. Lighthouse (distant rocky horizon cliff)
    this.lighthouse = new Lighthouse({
      position: new THREE.Vector3(10.0, -0.3, -13.0),
      initialFogIntensity: options.initialWeather === 'fog' ? 2.2 : 0.4,
    });
    this.root.add(this.lighthouse.group);

    // 6. Kraken Tentacle (distant ocean depths)
    this.kraken = new KrakenTentacle({
      waterY: -0.05,
      emitRipple: (x, z) => options.water.emitRipple(x, z),
      onBreach: (pos) => {
        this.events?.emit('toast', { message: 'A colossal kraken tentacle breaches from the depths!' });
        this.events?.emit('krakenBreach', { position: { x: pos.x, y: pos.y, z: pos.z } });
      },
    });
    this.root.add(this.kraken.group);

    // 7. Celestial Night Sky (3D crescent moon, twinkling starfield, shooting stars)
    const initialNightOpacity = this.currentTheme === 'cosmic-lake' ? 1.0 : (options.initialWeather === 'golden-hour' ? 0.35 : 0.0);
    this.celestialSky = new CelestialSky({
      initialNightOpacity,
    });
    this.root.add(this.celestialSky.group);

    // 8. Atmospheric Weather System
    this.weather = new WeatherSystem({
      scene: options.scene,
      keyLight: options.keyLight,
      hemisphereLight: options.hemisphereLight,
      rainbowArc: this.rainbowArc,
      emitRipple: (x, z) => options.water.emitRipple(x, z),
      initialWeather: options.initialWeather ?? 'clear',
      onWeatherChange: (weather) => this.handleWeatherChange(weather),
    });
  }

  private handleWeatherChange(weather: WeatherType): void {
    if (!this.events) return;
    this.events.emit('weatherChanged', { weather });

    // Adjust lighthouse spotlight & beacon intensity
    switch (weather) {
      case 'fog':
        this.lighthouse.setFogIntensity(2.2);
        break;
      case 'rain':
        this.lighthouse.setFogIntensity(1.6);
        break;
      case 'golden-hour':
        this.lighthouse.setFogIntensity(0.8);
        break;
      case 'rainbow':
        this.lighthouse.setFogIntensity(0.5);
        break;
      case 'clear':
      default:
        this.lighthouse.setFogIntensity(0.4);
        break;
    }

    // Adjust celestial night sky opacity
    this.updateCelestialOpacity(weather);

    switch (weather) {
      case 'rainbow':
        this.events.emit('toast', { message: 'A vibrant rainbow spans the horizon!' });
        break;
      case 'golden-hour':
        this.events.emit('toast', { message: 'Golden hour warms the pond.' });
        break;
      case 'rain':
        this.events.emit('toast', { message: 'A gentle rain shower begins.' });
        break;
      case 'fog':
        this.events.emit('toast', { message: 'A misty fog settles over the water.' });
        break;
      case 'clear':
        this.events.emit('toast', { message: 'Skies clear above the water.' });
        break;
    }
  }

  private updateCelestialOpacity(weather: WeatherType): void {
    if (this.currentTheme === 'cosmic-lake') {
      // Cosmic lake is perpetually immersed in starry cosmos
      this.celestialSky.setNightOpacity(1.0);
      return;
    }

    switch (weather) {
      case 'golden-hour':
        // Twilight / dusk: stars and crescent moon begin to appear
        this.celestialSky.setNightOpacity(0.35);
        break;
      case 'rain':
      case 'fog':
      case 'rainbow':
      case 'clear':
      default:
        this.celestialSky.setNightOpacity(0.0);
        break;
    }
  }

  /**
   * Sets active theme and re-evaluates atmospheric celestial sky opacity.
   */
  setTheme(theme: string): void {
    this.currentTheme = theme;
    this.updateCelestialOpacity(this.weather.getWeather());
  }

  /**
   * Updates all living world entities, physics, animations, and weather.
   */
  update(delta: number): void {
    this.boat.update(delta);
    this.whale.update(delta);
    this.flock.update(delta);
    this.lighthouse.update(delta);
    this.kraken.update(delta);
    this.celestialSky.update(delta);
    this.weather.update(delta);

    // Ambient whale breach trigger
    if (this.ambientWhalesEnabled && !this.whale.isBreaching()) {
      this.ambientWhaleTimer -= delta;
      if (this.ambientWhaleTimer <= 0) {
        this.ambientWhaleTimer = 100.0 + Math.random() * 80.0; // every 100-180 seconds
        this.whale.triggerBreach();
      }
    }

    // Ambient kraken breach trigger
    if (this.ambientKrakenEnabled && !this.kraken.isBreaching()) {
      this.ambientKrakenTimer -= delta;
      if (this.ambientKrakenTimer <= 0) {
        this.ambientKrakenTimer = 140.0 + Math.random() * 90.0; // every 140-230 seconds
        this.kraken.triggerBreach();
      }
    }
  }

  /**
   * Sets weather state (optionally for a fixed duration before resuming natural cycle).
   */
  setWeather(weather: WeatherType, durationSeconds?: number): void {
    this.weather.setWeather(weather, durationSeconds);
  }

  /**
   * Gets current active weather.
   */
  getWeather(): WeatherType {
    return this.weather.getWeather();
  }

  /**
   * Manually triggers a whale breach jump.
   */
  triggerWhaleJump(targetPos?: THREE.Vector3): void {
    this.whale.triggerBreach(targetPos);
  }

  /**
   * Manually triggers a kraken tentacle breach.
   */
  triggerKrakenJump(targetPos?: THREE.Vector3): void {
    this.kraken.triggerBreach(targetPos);
  }

  /**
   * Gets reference to the Lighthouse entity.
   */
  getLighthouse(): Lighthouse {
    return this.lighthouse;
  }

  /**
   * Gets reference to the CelestialSky entity.
   */
  getCelestialSky(): CelestialSky {
    return this.celestialSky;
  }

  dispose(): void {
    this.weather.dispose();
    this.rainbowArc.dispose();
    this.boat.dispose();
    this.whale.dispose();
    this.flock.dispose();
    this.lighthouse.dispose();
    this.kraken.dispose();
    this.celestialSky.dispose();

    this.root.remove(
      this.rainbowArc.group,
      this.boat.group,
      this.whale.group,
      this.flock.group,
      this.lighthouse.group,
      this.kraken.group,
      this.celestialSky.group,
    );
    this.scene.remove(this.root);
  }
}
