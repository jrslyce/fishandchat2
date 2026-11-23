import * as THREE from 'three';
import type { RainbowArc } from '../entities/RainbowArc';

export type WeatherType = 'clear' | 'rain' | 'fog' | 'golden-hour' | 'rainbow';

interface WeatherPreset {
  keyColor: string;
  keyIntensity: number;
  hemiSky: string;
  hemiGround: string;
  hemiIntensity: number;
  fogColor: string;
  fogNear: number;
  fogFar: number;
  rainIntensity: number;
  rainbowOpacity: number;
}

const WEATHER_PRESETS: Record<WeatherType, WeatherPreset> = {
  'clear': {
    keyColor: '#ffedbf',
    keyIntensity: 2.0,
    hemiSky: '#fff6df',
    hemiGround: '#5a7a5f',
    hemiIntensity: 1.3,
    fogColor: '#bfe3d8',
    fogNear: 16,
    fogFar: 36,
    rainIntensity: 0.0,
    rainbowOpacity: 0.0,
  },
  'rain': {
    keyColor: '#8da2b8',
    keyIntensity: 0.75,
    hemiSky: '#697c8f',
    hemiGround: '#37434f',
    hemiIntensity: 0.7,
    fogColor: '#637585',
    fogNear: 5.5,
    fogFar: 20,
    rainIntensity: 1.0,
    rainbowOpacity: 0.0,
  },
  'fog': {
    keyColor: '#b0c0ce',
    keyIntensity: 1.05,
    hemiSky: '#c2d5df',
    hemiGround: '#677984',
    hemiIntensity: 0.95,
    fogColor: '#9eb4c2',
    fogNear: 3.8,
    fogFar: 14.5,
    rainIntensity: 0.0,
    rainbowOpacity: 0.0,
  },
  'golden-hour': {
    keyColor: '#ff9638',
    keyIntensity: 2.5,
    hemiSky: '#ffc88d',
    hemiGround: '#4e3b5a',
    hemiIntensity: 1.45,
    fogColor: '#efa568',
    fogNear: 9.5,
    fogFar: 27,
    rainIntensity: 0.0,
    rainbowOpacity: 0.0,
  },
  'rainbow': {
    keyColor: '#fff5e2',
    keyIntensity: 2.2,
    hemiSky: '#e4f3ff',
    hemiGround: '#5a8668',
    hemiIntensity: 1.4,
    fogColor: '#c0e1ed',
    fogNear: 13,
    fogFar: 34,
    rainIntensity: 0.0,
    rainbowOpacity: 1.0,
  },
};

export interface WeatherSystemOptions {
  scene: THREE.Scene;
  keyLight?: THREE.DirectionalLight;
  hemisphereLight?: THREE.HemisphereLight;
  rainbowArc?: RainbowArc;
  emitRipple?: (x: number, z: number) => void;
  initialWeather?: WeatherType;
  cycleIntervalSeconds?: number;
  onWeatherChange?: (weather: WeatherType) => void;
  waterY?: number;
}

interface RaindropData {
  x: number;
  y: number;
  z: number;
  speed: number;
}

/**
 * Atmospheric Weather System managing sky conditions:
 * - Types: 'clear' | 'rain' | 'fog' | 'golden-hour' | 'rainbow'
 * - Rain effect: Instanced falling raindrops with water ripple impacts
 * - Smooth lighting and fog adjustments per weather state
 * - Natural 3-5 minute weather progression cycle
 * - setWeather() for forcing states (e.g. Rainbow Totem stream purchase)
 * - Automatic rainbow arc fade-in during 'rainbow' and following 'rain'
 */
export class WeatherSystem {
  private currentWeather: WeatherType;
  private previousWeather: WeatherType = 'clear';

  private readonly scene: THREE.Scene;
  private readonly keyLight?: THREE.DirectionalLight;
  private readonly hemisphereLight?: THREE.HemisphereLight;
  private readonly rainbowArc?: RainbowArc;
  private readonly rippleEmitter?: (x: number, z: number) => void;
  private readonly onWeatherChange?: (weather: WeatherType) => void;
  private readonly waterY: number;

  private readonly cycleInterval: number;
  private cycleTimer: number;
  private forcedDurationTimer: number | null = null;
  private postRainRainbowTimer = 0;

  // Fog management
  private readonly fog: THREE.Fog;
  private readonly ownsFog: boolean;

  // Atmospheric interpolation state
  private readonly currentKeyColor = new THREE.Color();
  private readonly targetKeyColor = new THREE.Color();
  private currentKeyIntensity = 2.0;

  private readonly currentHemiSky = new THREE.Color();
  private readonly targetHemiSky = new THREE.Color();
  private readonly currentHemiGround = new THREE.Color();
  private readonly targetHemiGround = new THREE.Color();
  private currentHemiIntensity = 1.3;

  private readonly currentFogColor = new THREE.Color();
  private readonly targetFogColor = new THREE.Color();

  private currentRainIntensity = 0;
  private targetRainIntensity = 0;

  // Raindrop instancing
  private readonly raindropCount = 350;
  private readonly rainGroup = new THREE.Group();
  private readonly rainMesh: THREE.InstancedMesh;
  private readonly rainGeometry: THREE.BufferGeometry;
  private readonly rainMaterial: THREE.MeshBasicMaterial;
  private readonly raindrops: RaindropData[] = [];
  private readonly dummy = new THREE.Object3D();
  private rippleCooldown = 0;

  constructor(options: WeatherSystemOptions) {
    this.scene = options.scene;
    this.keyLight = options.keyLight;
    this.hemisphereLight = options.hemisphereLight;
    this.rainbowArc = options.rainbowArc;
    this.rippleEmitter = options.emitRipple;
    this.onWeatherChange = options.onWeatherChange;
    this.waterY = options.waterY ?? -0.05;

    this.currentWeather = options.initialWeather ?? 'clear';
    this.cycleInterval = options.cycleIntervalSeconds ?? 210; // ~3.5 minutes default
    this.cycleTimer = this.cycleInterval;

    // Set up or adapt scene fog
    if (this.scene.fog && this.scene.fog instanceof THREE.Fog) {
      this.fog = this.scene.fog;
      this.ownsFog = false;
    } else {
      const preset = WEATHER_PRESETS[this.currentWeather];
      this.fog = new THREE.Fog(preset.fogColor, preset.fogNear, preset.fogFar);
      this.scene.fog = this.fog;
      this.ownsFog = true;
    }

    // Initialize atmospheric colors from preset
    const initialPreset = WEATHER_PRESETS[this.currentWeather];
    this.currentKeyColor.set(initialPreset.keyColor);
    this.targetKeyColor.set(initialPreset.keyColor);
    this.currentKeyIntensity = initialPreset.keyIntensity;

    this.currentHemiSky.set(initialPreset.hemiSky);
    this.targetHemiSky.set(initialPreset.hemiSky);
    this.currentHemiGround.set(initialPreset.hemiGround);
    this.targetHemiGround.set(initialPreset.hemiGround);
    this.currentHemiIntensity = initialPreset.hemiIntensity;

    this.currentFogColor.set(initialPreset.fogColor);
    this.targetFogColor.set(initialPreset.fogColor);
    this.fog.color.copy(this.currentFogColor);
    this.fog.near = initialPreset.fogNear;
    this.fog.far = initialPreset.fogFar;

    this.currentRainIntensity = initialPreset.rainIntensity;
    this.targetRainIntensity = initialPreset.rainIntensity;

    if (this.keyLight) {
      this.keyLight.color.copy(this.currentKeyColor);
      this.keyLight.intensity = this.currentKeyIntensity;
    }
    if (this.hemisphereLight) {
      this.hemisphereLight.color.copy(this.currentHemiSky);
      this.hemisphereLight.groundColor.copy(this.currentHemiGround);
      this.hemisphereLight.intensity = this.currentHemiIntensity;
    }

    // Set up Raindrop Particle System
    this.rainGeometry = new THREE.BoxGeometry(0.015, 0.32, 0.015);
    this.rainMaterial = new THREE.MeshBasicMaterial({
      color: '#cbe4f8',
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    this.rainMesh = new THREE.InstancedMesh(this.rainGeometry, this.rainMaterial, this.raindropCount);
    this.rainMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.rainGroup.name = 'RainSystem';
    this.rainGroup.add(this.rainMesh);
    this.scene.add(this.rainGroup);

    // Populate raindrop positions
    for (let i = 0; i < this.raindropCount; i++) {
      const drop: RaindropData = {
        x: (Math.random() - 0.5) * 16.0,
        y: this.waterY + Math.random() * 8.5,
        z: -12.0 + Math.random() * 14.0,
        speed: 12.0 + Math.random() * 5.0,
      };
      this.raindrops.push(drop);

      this.dummy.position.set(drop.x, drop.y, drop.z);
      // Slight slant in wind
      this.dummy.rotation.z = -0.06;
      this.dummy.updateMatrix();
      this.rainMesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.rainMesh.instanceMatrix.needsUpdate = true;
    this.rainGroup.visible = this.currentRainIntensity > 0;

    // Apply rainbow arc initial state
    if (this.rainbowArc) {
      this.rainbowArc.setOpacity(initialPreset.rainbowOpacity, true);
    }
  }

  getWeather(): WeatherType {
    return this.currentWeather;
  }

  /**
   * Sets weather state. If durationSeconds is provided, returns to natural cycle after timer expires.
   * Useful for Stream Purchases like Rainbow Totem.
   */
  setWeather(weather: WeatherType, durationSeconds?: number): void {
    if (this.currentWeather === weather && durationSeconds === undefined) return;

    this.previousWeather = this.currentWeather;
    this.currentWeather = weather;

    if (durationSeconds !== undefined && durationSeconds > 0) {
      this.forcedDurationTimer = durationSeconds;
    } else {
      this.forcedDurationTimer = null;
      this.cycleTimer = this.cycleInterval;
    }

    // If leaving rain, trigger post-rain rainbow lingering window
    if (this.previousWeather === 'rain' && weather !== 'rainbow') {
      this.postRainRainbowTimer = 45.0; // rainbow arc lingers for 45s following rain
    } else if (weather === 'rainbow') {
      this.postRainRainbowTimer = 0;
    }

    const preset = WEATHER_PRESETS[weather];
    this.targetKeyColor.set(preset.keyColor);
    this.targetHemiSky.set(preset.hemiSky);
    this.targetHemiGround.set(preset.hemiGround);
    this.targetFogColor.set(preset.fogColor);
    this.targetRainIntensity = preset.rainIntensity;

    this.onWeatherChange?.(weather);
  }

  update(delta: number): void {
    // 1. Natural weather progression or forced duration timer
    if (this.forcedDurationTimer !== null) {
      this.forcedDurationTimer -= delta;
      if (this.forcedDurationTimer <= 0) {
        this.forcedDurationTimer = null;
        this.progressNaturalWeather();
      }
    } else {
      this.cycleTimer -= delta;
      if (this.cycleTimer <= 0) {
        this.progressNaturalWeather();
      }
    }

    // 2. Post-rain rainbow lingering countdown
    if (this.postRainRainbowTimer > 0) {
      this.postRainRainbowTimer -= delta;
    }

    // 3. Smooth atmospheric transitions (lerp lights, fog, rain)
    const lerpRate = 1 - Math.exp(-delta * 1.6);
    const preset = WEATHER_PRESETS[this.currentWeather];

    // Key light
    this.currentKeyColor.lerp(this.targetKeyColor, lerpRate);
    this.currentKeyIntensity = THREE.MathUtils.lerp(this.currentKeyIntensity, preset.keyIntensity, lerpRate);
    if (this.keyLight) {
      this.keyLight.color.copy(this.currentKeyColor);
      this.keyLight.intensity = this.currentKeyIntensity;
    }

    // Hemisphere light
    this.currentHemiSky.lerp(this.targetHemiSky, lerpRate);
    this.currentHemiGround.lerp(this.targetHemiGround, lerpRate);
    this.currentHemiIntensity = THREE.MathUtils.lerp(this.currentHemiIntensity, preset.hemiIntensity, lerpRate);
    if (this.hemisphereLight) {
      this.hemisphereLight.color.copy(this.currentHemiSky);
      this.hemisphereLight.groundColor.copy(this.currentHemiGround);
      this.hemisphereLight.intensity = this.currentHemiIntensity;
    }

    // Fog
    if (this.scene.fog !== this.fog) {
      this.scene.fog = this.fog;
    }
    this.currentFogColor.lerp(this.targetFogColor, lerpRate);
    this.fog.color.copy(this.currentFogColor);
    this.fog.near = THREE.MathUtils.lerp(this.fog.near, preset.fogNear, lerpRate);
    this.fog.far = THREE.MathUtils.lerp(this.fog.far, preset.fogFar, lerpRate);

    // Rain intensity
    this.currentRainIntensity = THREE.MathUtils.lerp(this.currentRainIntensity, this.targetRainIntensity, lerpRate);
    this.rainMaterial.opacity = this.currentRainIntensity * 0.65;
    this.rainGroup.visible = this.currentRainIntensity > 0.005;

    // Rainbow arc opacity: active during 'rainbow' OR following 'rain'
    if (this.rainbowArc) {
      let desiredRainbowOpacity = preset.rainbowOpacity;
      if (this.currentWeather !== 'rainbow' && this.postRainRainbowTimer > 0) {
        // Lingers and gently fades out
        const factor = Math.min(1.0, this.postRainRainbowTimer / 10.0);
        desiredRainbowOpacity = Math.max(desiredRainbowOpacity, factor * 0.85);
      }
      this.rainbowArc.setOpacity(desiredRainbowOpacity);
      this.rainbowArc.update(delta);
    }

    // 4. Update raindrops
    if (this.currentRainIntensity > 0.005) {
      this.updateRain(delta);
    }
  }

  private updateRain(delta: number): void {
    this.rippleCooldown -= delta;

    for (let i = 0; i < this.raindropCount; i++) {
      const drop = this.raindrops[i];
      drop.y -= drop.speed * delta;
      drop.x += 0.8 * delta; // gentle wind drift

      // Hit water surface
      if (drop.y <= this.waterY) {
        // Emit ripple if in pond bounds and cooldown allowed
        if (this.rippleCooldown <= 0 && drop.x > -5.0 && drop.x < 5.0 && drop.z > -8.5 && drop.z < 0.5) {
          this.rippleEmitter?.(drop.x, drop.z);
          this.rippleCooldown = 0.16; // throttle ripple rate to conserve ripple pool
        }

        // Reset to top with randomized position
        drop.y = 7.5 + Math.random() * 1.8;
        drop.x = (Math.random() - 0.5) * 16.0;
        drop.z = -12.0 + Math.random() * 14.0;
      }

      this.dummy.position.set(drop.x, drop.y, drop.z);
      this.dummy.rotation.z = -0.06;
      this.dummy.updateMatrix();
      this.rainMesh.setMatrixAt(i, this.dummy.matrix);
    }

    this.rainMesh.instanceMatrix.needsUpdate = true;
  }

  private progressNaturalWeather(): void {
    this.cycleTimer = this.cycleInterval + (Math.random() - 0.5) * 40; // slight random variation

    let next: WeatherType;

    // If it was raining, naturally progress into a vibrant rainbow!
    if (this.currentWeather === 'rain') {
      next = 'rainbow';
    } else if (this.currentWeather === 'rainbow') {
      next = Math.random() > 0.5 ? 'clear' : 'golden-hour';
    } else {
      // Natural cycle choices
      const choices: WeatherType[] = ['clear', 'rain', 'fog', 'golden-hour'];
      const filtered = choices.filter((w) => w !== this.currentWeather);
      next = filtered[Math.floor(Math.random() * filtered.length)];
    }

    this.setWeather(next);
  }

  dispose(): void {
    this.scene.remove(this.rainGroup);
    this.rainGeometry.dispose();
    this.rainMaterial.dispose();
    this.rainMesh.dispose();

    if (this.ownsFog && this.scene.fog === this.fog) {
      this.scene.fog = null;
    }
  }
}
