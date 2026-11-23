import { SoundSynthesizer } from './SoundSynthesizer';

export type AudioGroup = 'master' | 'sfx' | 'ambience';

export interface AudioMixState {
  master: number;
  sfx: number;
  ambience: number;
  muted: boolean;
}

/**
 * Runtime audio engine: gesture-unlock, per-group volume/mute, clip loading
 * with an in-memory decode cache, one-shot SFX playback, a single
 * crossfading ambience loop, and procedural atmospheric sound synthesis.
 */
export class AudioEngine {
  private context: AudioContext | null = null;
  private unlocked = false;
  private readonly gains = new Map<AudioGroup, GainNode>();
  private readonly bufferCache = new Map<string, Promise<AudioBuffer>>();
  private ambienceSource: AudioBufferSourceNode | null = null;
  private ambienceGainNode: GainNode | null = null;
  private readonly synthesizer: SoundSynthesizer = new SoundSynthesizer();

  readonly mix: AudioMixState = {
    master: 1,
    sfx: 0.8,
    ambience: 0.6,
    muted: false,
  };

  constructor() {
    const unlock = () => {
      void this.unlock();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
  }

  async unlock(): Promise<void> {
    if (this.unlocked) return;
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    this.context = new AudioContextClass();
    await this.context.resume();

    const master = this.context.createGain();
    master.gain.value = this.mix.muted ? 0 : this.mix.master;
    master.connect(this.context.destination);
    this.gains.set('master', master);

    for (const group of ['sfx', 'ambience'] as const) {
      const gain = this.context.createGain();
      gain.gain.value = this.mix[group];
      gain.connect(master);
      this.gains.set(group, gain);
    }

    // Initialize procedural sound synthesizer connected to destination with mirrored volumes
    this.synthesizer.init(this.context, this.context.destination);
    this.synthesizer.setVolume('master', this.mix.master);
    this.synthesizer.setVolume('sfx', this.mix.sfx);
    this.synthesizer.setVolume('ambience', this.mix.ambience);
    this.synthesizer.setMuted(this.mix.muted);

    this.unlocked = true;
  }

  isUnlocked(): boolean {
    return this.unlocked;
  }

  getSynthesizer(): SoundSynthesizer {
    return this.synthesizer;
  }

  setVolume(group: AudioGroup, value: number): void {
    this.mix[group] = Math.max(0, Math.min(1, value));
    this.gains.get(group)?.gain.setValueAtTime(this.mix[group], this.context?.currentTime ?? 0);
    this.synthesizer.setVolume(group, this.mix[group]);
  }

  setMuted(muted: boolean): void {
    this.mix.muted = muted;
    const master = this.gains.get('master');
    if (master) {
      master.gain.setValueAtTime(muted ? 0 : this.mix.master, this.context?.currentTime ?? 0);
    }
    this.synthesizer.setMuted(muted);
  }

  private async loadBuffer(url: string): Promise<AudioBuffer | null> {
    if (!this.context) return null;
    const cached = this.bufferCache.get(url);
    if (cached) return cached;
    const promise = fetch(url)
      .then((response) => response.arrayBuffer())
      .then((data) => this.context!.decodeAudioData(data));
    this.bufferCache.set(url, promise);
    return promise;
  }

  /** Fire-and-forget one-shot SFX. No-ops silently if the context isn't unlocked yet. */
  async playSfx(url: string, volume = 1): Promise<void> {
    if (!this.context) return;
    const buffer = await this.loadBuffer(url);
    if (!buffer) return;
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    const gain = this.context.createGain();
    gain.gain.value = volume;
    source.connect(gain).connect(this.gains.get('sfx')!);
    source.start();
  }

  /** Crossfades to a new looping ambience track; stops any previous one. */
  async playAmbience(url: string, crossfadeSeconds = 2): Promise<void> {
    if (!this.context) return;
    const buffer = await this.loadBuffer(url);
    if (!buffer) return;

    const now = this.context.currentTime;
    const previousSource = this.ambienceSource;
    const previousGain = this.ambienceGainNode;
    if (previousSource && previousGain) {
      previousGain.gain.cancelScheduledValues(now);
      previousGain.gain.setValueAtTime(previousGain.gain.value, now);
      previousGain.gain.linearRampToValueAtTime(0, now + crossfadeSeconds);
      previousSource.stop(now + crossfadeSeconds + 0.05);
    }

    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const gain = this.context.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(1, now + crossfadeSeconds);
    source.connect(gain).connect(this.gains.get('ambience')!);
    source.start();

    this.ambienceSource = source;
    this.ambienceGainNode = gain;
  }

  stopAmbience(fadeSeconds = 1): void {
    if (!this.context || !this.ambienceSource || !this.ambienceGainNode) return;
    const now = this.context.currentTime;
    this.ambienceGainNode.gain.cancelScheduledValues(now);
    this.ambienceGainNode.gain.setValueAtTime(this.ambienceGainNode.gain.value, now);
    this.ambienceGainNode.gain.linearRampToValueAtTime(0, now + fadeSeconds);
    this.ambienceSource.stop(now + fadeSeconds + 0.05);
    this.ambienceSource = null;
    this.ambienceGainNode = null;
  }

  dispose(): void {
    this.synthesizer.dispose();
    this.ambienceSource?.stop();
    void this.context?.close();
    this.context = null;
    this.gains.clear();
    this.bufferCache.clear();
  }
}
