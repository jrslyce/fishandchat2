import type { AudioGroup } from './AudioEngine';

/**
 * Procedural WebAudio soundscape and sound-effects synthesizer for Fish and Chat.
 * Synthesizes rich atmospheric ambience (continuous filtered rain, ocean thunder,
 * harbor foghorns, whale songs, seagull chirps) and gameplay SFX (water splashes,
 * fanfares, level-up chimes, streak shimmers) dynamically without requiring any
 * external audio files.
 */
export class SoundSynthesizer {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private ambienceGain: GainNode | null = null;

  // Cached noise buffers (regenerated if context sample rate changes)
  private pinkNoiseBuffer: AudioBuffer | null = null;
  private whiteNoiseBuffer: AudioBuffer | null = null;
  private brownNoiseBuffer: AudioBuffer | null = null;

  // Looping rain state
  private rainSource: AudioBufferSourceNode | null = null;
  private rainGain: GainNode | null = null;
  private rainLfo: OscillatorNode | null = null;
  private rainFilter: BiquadFilterNode | null = null;
  private rainDropletTimer: ReturnType<typeof setTimeout> | null = null;
  private rainActive = false;
  private rainTargetVolume = 0.5;

  // Active transient nodes for clean disposal
  private readonly activeNodes = new Set<{ stop?: (when?: number) => void; disconnect: () => void }>();

  // Mix state matching AudioEngine
  private readonly volumes: Record<AudioGroup, number> = {
    master: 1,
    sfx: 0.8,
    ambience: 0.6,
  };
  private muted = false;

  constructor(context?: AudioContext, destination?: AudioNode) {
    if (context) {
      this.init(context, destination);
    }
  }

  /**
   * Initializes or re-initializes the synthesizer with an AudioContext and destination.
   */
  init(context: AudioContext, destination?: AudioNode): void {
    this.dispose();

    this.context = context;
    const dest = destination ?? context.destination;

    this.masterGain = context.createGain();
    this.masterGain.gain.setValueAtTime(this.muted ? 0 : this.volumes.master, context.currentTime);
    this.masterGain.connect(dest);

    this.sfxGain = context.createGain();
    this.sfxGain.gain.setValueAtTime(this.volumes.sfx, context.currentTime);
    this.sfxGain.connect(this.masterGain);

    this.ambienceGain = context.createGain();
    this.ambienceGain.gain.setValueAtTime(this.volumes.ambience, context.currentTime);
    this.ambienceGain.connect(this.masterGain);

    this.pinkNoiseBuffer = null;
    this.whiteNoiseBuffer = null;
    this.brownNoiseBuffer = null;
  }

  getMasterGain(): GainNode | null {
    return this.masterGain;
  }

  getSfxGain(): GainNode | null {
    return this.sfxGain;
  }

  getAmbienceGain(): GainNode | null {
    return this.ambienceGain;
  }

  setVolume(group: AudioGroup, value: number): void {
    const clamped = Math.max(0, Math.min(1, value));
    this.volumes[group] = clamped;
    const now = this.context?.currentTime ?? 0;

    if (group === 'master' && this.masterGain) {
      const val = this.muted ? 0 : clamped;
      this.masterGain.gain.setValueAtTime(val, now);
      this.masterGain.gain.value = val;
    } else if (group === 'sfx' && this.sfxGain) {
      this.sfxGain.gain.setValueAtTime(clamped, now);
      this.sfxGain.gain.value = clamped;
    } else if (group === 'ambience' && this.ambienceGain) {
      this.ambienceGain.gain.setValueAtTime(clamped, now);
      this.ambienceGain.gain.value = clamped;
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.masterGain && this.context) {
      const now = this.context.currentTime;
      const val = muted ? 0 : this.volumes.master;
      this.masterGain.gain.setValueAtTime(val, now);
      this.masterGain.gain.value = val;
    }
  }

  isRainPlaying(): boolean {
    return this.rainActive;
  }

  // =========================================================================
  // NOISE BUFFER GENERATORS
  // =========================================================================

  private getPinkNoiseBuffer(): AudioBuffer | null {
    if (!this.context) return null;
    if (this.pinkNoiseBuffer && this.pinkNoiseBuffer.sampleRate === this.context.sampleRate) {
      return this.pinkNoiseBuffer;
    }

    const length = Math.floor(this.context.sampleRate * 4.0);
    const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const data = buffer.getChannelData(0);

    // Paul Kellet's refined 6-pole pink noise filter algorithm (-3dB/octave)
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    let b3 = 0;
    let b4 = 0;
    let b5 = 0;
    let b6 = 0;

    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.969 * b2 + white * 0.153852;
      b3 = 0.8665 * b3 + white * 0.3104856;
      b4 = 0.55 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.016898;
      const pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
      b6 = white * 0.115926;
      data[i] = pink * 0.11;
    }

    this.pinkNoiseBuffer = buffer;
    return buffer;
  }

  private getWhiteNoiseBuffer(): AudioBuffer | null {
    if (!this.context) return null;
    if (this.whiteNoiseBuffer && this.whiteNoiseBuffer.sampleRate === this.context.sampleRate) {
      return this.whiteNoiseBuffer;
    }

    const length = Math.floor(this.context.sampleRate * 3.0);
    const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    this.whiteNoiseBuffer = buffer;
    return buffer;
  }

  private getBrownNoiseBuffer(): AudioBuffer | null {
    if (!this.context) return null;
    if (this.brownNoiseBuffer && this.brownNoiseBuffer.sampleRate === this.context.sampleRate) {
      return this.brownNoiseBuffer;
    }

    const length = Math.floor(this.context.sampleRate * 4.0);
    const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const data = buffer.getChannelData(0);

    // Brownian / red noise: integrated white noise (-6dB/octave)
    let lastOut = 0.0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      lastOut = (lastOut + 0.02 * white) / 1.02;
      data[i] = lastOut * 3.5;
    }

    this.brownNoiseBuffer = buffer;
    return buffer;
  }

  // =========================================================================
  // ATMOSPHERIC SOUND SYNTHESIS
  // =========================================================================

  /**
   * Generates continuous filtered pink noise with random high-frequency droplet ticks
   * and subtle pitch modulations. Loops with smooth start/stop crossfade.
   */
  playRain(volume = 0.5): void {
    if (!this.context || !this.ambienceGain) return;
    this.rainTargetVolume = Math.max(0, Math.min(1, volume));

    const now = this.context.currentTime;

    // If rain is already active, smoothly crossfade to the new volume
    if (this.rainActive && this.rainGain) {
      this.rainGain.gain.cancelScheduledValues(now);
      this.rainGain.gain.setValueAtTime(this.rainGain.gain.value, now);
      this.rainGain.gain.linearRampToValueAtTime(this.rainTargetVolume, now + 1.2);
      return;
    }

    const pinkBuffer = this.getPinkNoiseBuffer();
    if (!pinkBuffer) return;

    this.rainActive = true;

    // Pink noise source looping
    const source = this.context.createBufferSource();
    source.buffer = pinkBuffer;
    source.loop = true;

    // Highpass to eliminate low-end rumble/mud
    const hp = this.context.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(280, now);

    // Warm rain lowpass filter
    const lp = this.context.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(1300, now);
    lp.Q.setValueAtTime(0.8, now);

    // Subtle atmospheric pitch and filter modulation (undulating wind/intensity)
    const lfo = this.context.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(0.16, now);

    const lfoGain = this.context.createGain();
    lfoGain.gain.setValueAtTime(220, now); // Modulate cutoff by ±220Hz
    lfo.connect(lfoGain);
    lfoGain.connect(lp.frequency);

    const pitchModGain = this.context.createGain();
    pitchModGain.gain.setValueAtTime(0.02, now); // Gentle ±2% playback rate drift
    lfo.connect(pitchModGain);
    pitchModGain.connect(source.playbackRate);

    // Main rain volume gain with smooth fade in
    const rainGain = this.context.createGain();
    rainGain.gain.setValueAtTime(0, now);
    rainGain.gain.linearRampToValueAtTime(this.rainTargetVolume, now + 1.8);

    // Connect graph
    source.connect(hp);
    hp.connect(lp);
    lp.connect(rainGain);
    rainGain.connect(this.ambienceGain);

    source.start(now);
    lfo.start(now);

    this.rainSource = source;
    this.rainGain = rainGain;
    this.rainFilter = lp;
    this.rainLfo = lfo;

    // Schedule random high-frequency droplet ticks
    this.scheduleRainDropletTick();
  }

  /**
   * Smoothly crossfades out and stops the looping rain atmospheric sound.
   */
  stopRain(fadeSeconds = 1.2): void {
    if (!this.rainActive || !this.context || !this.rainGain) {
      this.rainActive = false;
      return;
    }

    this.rainActive = false;
    if (this.rainDropletTimer) {
      clearTimeout(this.rainDropletTimer);
      this.rainDropletTimer = null;
    }

    const now = this.context.currentTime;
    const gain = this.rainGain;
    const source = this.rainSource;
    const lfo = this.rainLfo;
    const filter = this.rainFilter;

    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.linearRampToValueAtTime(0, now + fadeSeconds);

    setTimeout(() => {
      try {
        source?.stop();
        lfo?.stop();
        filter?.disconnect();
        gain.disconnect();
      } catch {
        // Node may already be stopped
      }
    }, Math.floor((fadeSeconds + 0.1) * 1000));

    this.rainSource = null;
    this.rainGain = null;
    this.rainFilter = null;
    this.rainLfo = null;
  }

  private scheduleRainDropletTick(): void {
    if (!this.rainActive || !this.context || !this.rainGain) return;

    // Random droplet interval between 50ms and 180ms
    const delayMs = 50 + Math.random() * 130;
    this.rainDropletTimer = setTimeout(() => {
      if (!this.rainActive || !this.context || !this.rainGain) return;
      this.triggerSingleRainDroplet();
      this.scheduleRainDropletTick();
    }, delayMs);
  }

  private triggerSingleRainDroplet(): void {
    if (!this.context || !this.rainGain) return;

    const now = this.context.currentTime;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();

    // High frequency downward chirp (droplet impact)
    const baseFreq = 2600 + Math.random() * 2200;
    const duration = 0.012 + Math.random() * 0.014;
    const dropVol = (0.04 + Math.random() * 0.08) * this.rainTargetVolume;

    osc.type = Math.random() > 0.5 ? 'sine' : 'triangle';
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.65, now + duration);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(dropVol, now + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(this.rainGain);

    osc.start(now);
    osc.stop(now + duration + 0.01);
  }

  /**
   * Deep resonant rumble — low-pass filtered noise burst with slow decay and gentle sub-bass (40-60Hz) thump.
   */
  playThunder(): void {
    if (!this.context || !this.sfxGain) return;

    const now = this.context.currentTime;
    const brownBuffer = this.getBrownNoiseBuffer();
    if (!brownBuffer) return;

    // 1. Gentle sub-bass (40-60Hz) thump
    const subOsc = this.context.createOscillator();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(58, now);
    subOsc.frequency.exponentialRampToValueAtTime(38, now + 1.8);

    const subGain = this.context.createGain();
    subGain.gain.setValueAtTime(0.001, now);
    subGain.gain.linearRampToValueAtTime(0.75, now + 0.05); // Fast, punchy thump
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 2.4);

    subOsc.connect(subGain);
    subGain.connect(this.sfxGain);

    // 2. Low-pass filtered noise burst with undulating rumble and slow decay
    const noiseSource = this.context.createBufferSource();
    noiseSource.buffer = brownBuffer;

    const lp = this.context.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.setValueAtTime(3.8, now); // Resonant rumble
    lp.frequency.setValueAtTime(620, now);
    lp.frequency.linearRampToValueAtTime(780, now + 0.08); // Initial thunderclap crackle
    lp.frequency.exponentialRampToValueAtTime(85, now + 4.2); // Rolling deep lowpass decay

    const noiseGain = this.context.createGain();
    noiseGain.gain.setValueAtTime(0.001, now);
    noiseGain.gain.linearRampToValueAtTime(0.72, now + 0.06); // Thunder crack
    noiseGain.gain.linearRampToValueAtTime(0.32, now + 0.3);
    noiseGain.gain.linearRampToValueAtTime(0.52, now + 0.6); // Secondary rolling wave
    noiseGain.gain.linearRampToValueAtTime(0.24, now + 1.4);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 4.5);

    noiseSource.connect(lp);
    lp.connect(noiseGain);
    noiseGain.connect(this.sfxGain);

    subOsc.start(now);
    noiseSource.start(now);
    subOsc.stop(now + 2.5);
    noiseSource.stop(now + 4.6);

    this.registerTransientNode(subOsc, now + 2.5);
    this.registerTransientNode(noiseSource, now + 4.6);
  }

  /**
   * Resonant dual-tone brass foghorn (110Hz and 114Hz with slight beating), slow attack and long reverberant tail.
   */
  playFoghorn(): void {
    if (!this.context || !this.sfxGain) return;

    const now = this.context.currentTime;

    // Dual-tone brass oscillators: 110Hz & 114Hz create ~4Hz acoustic beating
    const osc1 = this.context.createOscillator();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(110.0, now);

    const osc2 = this.context.createOscillator();
    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(114.2, now);

    // Deep sub-octave fundamental for resonant body
    const sub = this.context.createOscillator();
    sub.type = 'triangle';
    sub.frequency.setValueAtTime(55.0, now);

    // Resonant brass filter with slow opening swell
    const filter = this.context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.setValueAtTime(3.2, now);
    filter.frequency.setValueAtTime(260, now);
    filter.frequency.linearRampToValueAtTime(580, now + 0.9); // Brass swell
    filter.frequency.setValueAtTime(520, now + 2.2);
    filter.frequency.exponentialRampToValueAtTime(190, now + 4.8);

    // Foghorn amplitude envelope: slow attack and long reverberant tail
    const hornGain = this.context.createGain();
    hornGain.gain.setValueAtTime(0.001, now);
    hornGain.gain.linearRampToValueAtTime(0.42, now + 0.8); // Slow majestic attack
    hornGain.gain.setValueAtTime(0.4, now + 2.2); // Sustain
    hornGain.gain.exponentialRampToValueAtTime(0.001, now + 4.8); // Long release

    // Reverberant harbor echo feedback delay
    const delay = this.context.createDelay();
    delay.delayTime.setValueAtTime(0.32, now);

    const delayFeedback = this.context.createGain();
    delayFeedback.gain.setValueAtTime(0.38, now);

    const delayFilter = this.context.createBiquadFilter();
    delayFilter.type = 'lowpass';
    delayFilter.frequency.setValueAtTime(450, now);

    // Wiring delay loop
    delay.connect(delayFilter);
    delayFilter.connect(delayFeedback);
    delayFeedback.connect(delay);

    hornGain.connect(delay);
    delayFilter.connect(this.sfxGain);

    // Direct path
    osc1.connect(filter);
    osc2.connect(filter);
    sub.connect(filter);
    filter.connect(hornGain);
    hornGain.connect(this.sfxGain);

    osc1.start(now);
    osc2.start(now);
    sub.start(now);

    const stopTime = now + 5.0;
    osc1.stop(stopTime);
    osc2.stop(stopTime);
    sub.stop(stopTime);

    this.registerTransientNode(osc1, stopTime);
    this.registerTransientNode(osc2, stopTime);
    this.registerTransientNode(sub, stopTime);
  }

  /**
   * Modulated slow sine glide (140Hz up to 260Hz and back) with gentle harmonics and long echo.
   */
  playWhaleSong(): void {
    if (!this.context || !this.sfxGain) return;

    const now = this.context.currentTime;

    // Carrier sine oscillator gliding gracefully 140Hz -> 260Hz -> 140Hz
    const carrier = this.context.createOscillator();
    carrier.type = 'sine';
    carrier.frequency.setValueAtTime(140, now);
    carrier.frequency.exponentialRampToValueAtTime(260, now + 1.8);
    carrier.frequency.exponentialRampToValueAtTime(145, now + 3.8);

    // Gentle harmonic overtone (triangle wave at 2x frequency)
    const harmonic = this.context.createOscillator();
    harmonic.type = 'triangle';
    harmonic.frequency.setValueAtTime(280, now);
    harmonic.frequency.exponentialRampToValueAtTime(520, now + 1.8);
    harmonic.frequency.exponentialRampToValueAtTime(290, now + 3.8);

    const harmonicGain = this.context.createGain();
    harmonicGain.gain.setValueAtTime(0.12, now);
    harmonic.connect(harmonicGain);

    // Slow vibrato LFO modulation
    const lfo = this.context.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(3.6, now);

    const lfoGain = this.context.createGain();
    lfoGain.gain.setValueAtTime(6.0, now); // ±6Hz modulation
    lfo.connect(lfoGain);
    lfoGain.connect(carrier.frequency);
    lfoGain.connect(harmonic.frequency);

    // Soft expressive amplitude envelope
    const mainGain = this.context.createGain();
    mainGain.gain.setValueAtTime(0.001, now);
    mainGain.gain.linearRampToValueAtTime(0.36, now + 0.85); // Gentle swell
    mainGain.gain.setValueAtTime(0.32, now + 2.5);
    mainGain.gain.exponentialRampToValueAtTime(0.001, now + 4.4); // Long release

    // Long underwater echo delay
    const delay = this.context.createDelay();
    delay.delayTime.setValueAtTime(0.42, now);

    const feedback = this.context.createGain();
    feedback.gain.setValueAtTime(0.46, now);

    const echoFilter = this.context.createBiquadFilter();
    echoFilter.type = 'lowpass';
    echoFilter.frequency.setValueAtTime(720, now);

    delay.connect(echoFilter);
    echoFilter.connect(feedback);
    feedback.connect(delay);

    mainGain.connect(delay);
    echoFilter.connect(this.sfxGain);

    // Direct output
    carrier.connect(mainGain);
    harmonicGain.connect(mainGain);
    mainGain.connect(this.sfxGain);

    carrier.start(now);
    harmonic.start(now);
    lfo.start(now);

    const stopTime = now + 4.6;
    carrier.stop(stopTime);
    harmonic.stop(stopTime);
    lfo.stop(stopTime);

    this.registerTransientNode(carrier, stopTime);
    this.registerTransientNode(harmonic, stopTime);
    this.registerTransientNode(lfo, stopTime);
  }

  /**
   * High-frequency pitch-swept chirp (1800Hz -> 2400Hz -> 1600Hz) with short staccato envelope.
   */
  playSeagullChirp(): void {
    if (!this.context || !this.sfxGain) return;

    const now = this.context.currentTime;

    const triggerChirp = (startTime: number, startFreq: number, peakFreq: number, endFreq: number, peakVol: number) => {
      if (!this.context || !this.sfxGain) return;

      const osc = this.context.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(startFreq, startTime);
      osc.frequency.linearRampToValueAtTime(peakFreq, startTime + 0.055);
      osc.frequency.exponentialRampToValueAtTime(endFreq, startTime + 0.16);

      const gain = this.context.createGain();
      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.linearRampToValueAtTime(peakVol, startTime + 0.018);
      gain.gain.setValueAtTime(peakVol * 0.9, startTime + 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.17);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(startTime);
      const stopTime = startTime + 0.18;
      osc.stop(stopTime);
      this.registerTransientNode(osc, stopTime);
    };

    // Primary staccato chirp (1800Hz -> 2400Hz -> 1600Hz)
    triggerChirp(now, 1800, 2400, 1600, 0.32);

    // Follow-up second chirp for an authentic natural double-call ("kya-kya!")
    triggerChirp(now + 0.13, 1720, 2260, 1520, 0.22);
  }

  /**
   * Water breakthrough impact — explosive white noise transient filtered with dynamic lowpass sweep.
   */
  playWaterSplash(intensity = 1.0): void {
    if (!this.context || !this.sfxGain) return;

    const whiteBuffer = this.getWhiteNoiseBuffer();
    if (!whiteBuffer) return;

    const now = this.context.currentTime;
    const clamped = Math.max(0.1, Math.min(2.5, intensity));

    // 1. Explosive white noise transient with dynamic lowpass sweep
    const noiseSource = this.context.createBufferSource();
    noiseSource.buffer = whiteBuffer;

    const lp = this.context.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.setValueAtTime(2.4, now);
    const initialCutoff = Math.min(8500, 3600 * clamped);
    lp.frequency.setValueAtTime(initialCutoff, now);
    lp.frequency.exponentialRampToValueAtTime(260, now + 0.36 * Math.sqrt(clamped));

    const noiseGain = this.context.createGain();
    noiseGain.gain.setValueAtTime(0.001, now);
    const peakVol = Math.min(0.9, 0.65 * clamped);
    noiseGain.gain.linearRampToValueAtTime(peakVol, now + 0.006); // Instant snap transient
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.45 * Math.sqrt(clamped));

    noiseSource.connect(lp);
    lp.connect(noiseGain);
    noiseGain.connect(this.sfxGain);

    // 2. Water displacement "plop" (body bubble)
    const plop = this.context.createOscillator();
    plop.type = 'sine';
    plop.frequency.setValueAtTime(240 * Math.min(1.2, clamped), now);
    plop.frequency.exponentialRampToValueAtTime(60, now + 0.08);

    const plopGain = this.context.createGain();
    plopGain.gain.setValueAtTime(0.001, now);
    plopGain.gain.linearRampToValueAtTime(0.55 * clamped, now + 0.005);
    plopGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    plop.connect(plopGain);
    plopGain.connect(this.sfxGain);

    // 3. High-frequency water droplet spray
    const spraySource = this.context.createBufferSource();
    spraySource.buffer = whiteBuffer;

    const sprayBp = this.context.createBiquadFilter();
    sprayBp.type = 'bandpass';
    sprayBp.frequency.setValueAtTime(5400, now);
    sprayBp.Q.setValueAtTime(3.8, now);

    const sprayGain = this.context.createGain();
    sprayGain.gain.setValueAtTime(0.001, now);
    sprayGain.gain.linearRampToValueAtTime(0.25 * clamped, now + 0.008);
    sprayGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    spraySource.connect(sprayBp);
    sprayBp.connect(sprayGain);
    sprayGain.connect(this.sfxGain);

    noiseSource.start(now);
    plop.start(now);
    spraySource.start(now);

    const noiseStop = now + 0.48 * Math.sqrt(clamped);
    noiseSource.stop(noiseStop);
    plop.stop(now + 0.14);
    spraySource.stop(now + 0.2);

    this.registerTransientNode(noiseSource, noiseStop);
    this.registerTransientNode(plop, now + 0.14);
    this.registerTransientNode(spraySource, now + 0.2);
  }

  /**
   * Glorious arpeggiated major triad chord (C5 -> E5 -> G5 -> C6) with brassy timbre and sparkling decay.
   */
  playFanfare(): void {
    if (!this.context || !this.sfxGain) return;

    const now = this.context.currentTime;

    // Arpeggiated C major triad notes: C5 (523.25), E5 (659.25), G5 (783.99), C6 (1046.50)
    const notes = [
      { freq: 523.25, offset: 0.0, dur: 0.35, isPeak: false },
      { freq: 659.25, offset: 0.1, dur: 0.35, isPeak: false },
      { freq: 783.99, offset: 0.2, dur: 0.4, isPeak: false },
      { freq: 1046.5, offset: 0.32, dur: 1.8, isPeak: true },
    ];

    for (const note of notes) {
      const noteStart = now + note.offset;
      const noteStop = noteStart + note.dur;

      // Brassy timbre: blended sawtooth and square waves
      const oscSaw = this.context.createOscillator();
      oscSaw.type = 'sawtooth';
      oscSaw.frequency.setValueAtTime(note.freq, noteStart);

      const oscSq = this.context.createOscillator();
      oscSq.type = 'square';
      oscSq.frequency.setValueAtTime(note.freq, noteStart);

      const sqGain = this.context.createGain();
      sqGain.gain.setValueAtTime(0.25, noteStart);
      oscSq.connect(sqGain);

      // Dynamic brass filter sweep
      const filter = this.context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.Q.setValueAtTime(2.6, noteStart);
      filter.frequency.setValueAtTime(1100, noteStart);
      filter.frequency.linearRampToValueAtTime(3200, noteStart + 0.04);
      filter.frequency.exponentialRampToValueAtTime(1400, noteStop);

      const gain = this.context.createGain();
      gain.gain.setValueAtTime(0.001, noteStart);
      gain.gain.linearRampToValueAtTime(note.isPeak ? 0.36 : 0.28, noteStart + 0.02);
      gain.gain.setValueAtTime(note.isPeak ? 0.32 : 0.24, noteStart + (note.isPeak ? 0.6 : 0.15));
      gain.gain.exponentialRampToValueAtTime(0.001, noteStop);

      oscSaw.connect(filter);
      sqGain.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain);

      oscSaw.start(noteStart);
      oscSq.start(noteStart);
      oscSaw.stop(noteStop);
      oscSq.stop(noteStop);

      this.registerTransientNode(oscSaw, noteStop);
      this.registerTransientNode(oscSq, noteStop);

      // Sparkling chime overtones on triumphant crowning C6 chord note
      if (note.isPeak) {
        const sparkleOsc1 = this.context.createOscillator();
        sparkleOsc1.type = 'sine';
        sparkleOsc1.frequency.setValueAtTime(2093.0, noteStart); // C7 octave

        const sparkleOsc2 = this.context.createOscillator();
        sparkleOsc2.type = 'sine';
        sparkleOsc2.frequency.setValueAtTime(3135.96, noteStart); // G7 fifth

        const sparkleGain = this.context.createGain();
        sparkleGain.gain.setValueAtTime(0.001, noteStart);
        sparkleGain.gain.linearRampToValueAtTime(0.1, noteStart + 0.015);
        sparkleGain.gain.exponentialRampToValueAtTime(0.001, noteStop);

        sparkleOsc1.connect(sparkleGain);
        sparkleOsc2.connect(sparkleGain);
        sparkleGain.connect(this.sfxGain);

        sparkleOsc1.start(noteStart);
        sparkleOsc2.start(noteStart);
        sparkleOsc1.stop(noteStop);
        sparkleOsc2.stop(noteStop);

        this.registerTransientNode(sparkleOsc1, noteStop);
        this.registerTransientNode(sparkleOsc2, noteStop);
      }
    }
  }

  /**
   * Ascending 4-note chime sequence.
   */
  playLevelUp(): void {
    if (!this.context || !this.sfxGain) return;

    const now = this.context.currentTime;

    // Ascending crystalline major chime sequence: G5 -> C6 -> E6 -> G6
    const chimes = [
      { freq: 783.99, offset: 0.0, dur: 0.7 },
      { freq: 1046.5, offset: 0.09, dur: 0.8 },
      { freq: 1318.51, offset: 0.18, dur: 0.9 },
      { freq: 1567.98, offset: 0.28, dur: 1.4 },
    ];

    for (const chime of chimes) {
      const startTime = now + chime.offset;
      const stopTime = startTime + chime.dur;

      // Pure fundamental sine
      const fund = this.context.createOscillator();
      fund.type = 'sine';
      fund.frequency.setValueAtTime(chime.freq, startTime);

      // Inharmonic bell overtone at 2.76x
      const overtone = this.context.createOscillator();
      overtone.type = 'sine';
      overtone.frequency.setValueAtTime(chime.freq * 2.76, startTime);

      const overtoneGain = this.context.createGain();
      overtoneGain.gain.setValueAtTime(0.18, startTime);
      overtoneGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.22);
      overtone.connect(overtoneGain);

      const mainGain = this.context.createGain();
      mainGain.gain.setValueAtTime(0.001, startTime);
      mainGain.gain.linearRampToValueAtTime(0.28, startTime + 0.006); // Crisp strike
      mainGain.gain.exponentialRampToValueAtTime(0.001, stopTime);

      fund.connect(mainGain);
      overtoneGain.connect(mainGain);
      mainGain.connect(this.sfxGain);

      fund.start(startTime);
      overtone.start(startTime);
      fund.stop(stopTime);
      overtone.stop(startTime + 0.25);

      this.registerTransientNode(fund, stopTime);
      this.registerTransientNode(overtone, startTime + 0.25);
    }
  }

  /**
   * Crisp ascending bell shimmer.
   */
  playStreakCheer(): void {
    if (!this.context || !this.sfxGain) return;

    const now = this.context.currentTime;

    // Rapid cascade of 6 crystalline shimmering bells
    const bellNotes = [880.0, 1108.73, 1318.51, 1760.0, 2217.46, 2637.02];

    for (let i = 0; i < bellNotes.length; i++) {
      const freq = bellNotes[i];
      const startTime = now + i * 0.038;
      const dur = 0.6 + i * 0.12;
      const stopTime = startTime + dur;

      // Bell fundamental
      const osc = this.context.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      // Bright metallic bell overtone (3.0x harmonic)
      const metalOsc = this.context.createOscillator();
      metalOsc.type = 'triangle';
      metalOsc.frequency.setValueAtTime(freq * 3.0, startTime);

      const metalGain = this.context.createGain();
      metalGain.gain.setValueAtTime(0.14, startTime);
      metalGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.18);
      metalOsc.connect(metalGain);

      const bellGain = this.context.createGain();
      bellGain.gain.setValueAtTime(0.001, startTime);
      bellGain.gain.linearRampToValueAtTime(0.24, startTime + 0.004);
      bellGain.gain.exponentialRampToValueAtTime(0.001, stopTime);

      osc.connect(bellGain);
      metalGain.connect(bellGain);
      bellGain.connect(this.sfxGain);

      osc.start(startTime);
      metalOsc.start(startTime);
      osc.stop(stopTime);
      metalOsc.stop(startTime + 0.2);

      this.registerTransientNode(osc, stopTime);
      this.registerTransientNode(metalOsc, startTime + 0.2);
    }

    // High shimmer burst at peak
    const whiteBuffer = this.getWhiteNoiseBuffer();
    if (whiteBuffer) {
      const shimmerStart = now + 0.14;
      const shimmerStop = shimmerStart + 0.25;

      const noise = this.context.createBufferSource();
      noise.buffer = whiteBuffer;

      const bp = this.context.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(6800, shimmerStart);
      bp.Q.setValueAtTime(5.0, shimmerStart);

      const gain = this.context.createGain();
      gain.gain.setValueAtTime(0.001, shimmerStart);
      gain.gain.linearRampToValueAtTime(0.16, shimmerStart + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, shimmerStop);

      noise.connect(bp);
      bp.connect(gain);
      gain.connect(this.sfxGain);

      noise.start(shimmerStart);
      noise.stop(shimmerStop);

      this.registerTransientNode(noise, shimmerStop);
    }
  }

  /**
   * Subtle procedural speech blip for typewriter/dialogue reveal.
   * Gentle rounded pitch chirp with quick decay.
   */
  playDialogueBlip(pitch = 280, volume = 0.12): void {
    if (!this.context || !this.sfxGain) return;
    const now = this.context.currentTime;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(pitch, now);
    osc.frequency.exponentialRampToValueAtTime(pitch * 0.9, now + 0.04);

    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.045);
    this.registerTransientNode(osc, now + 0.045);
  }

  // =========================================================================
  // LIFECYCLE MANAGEMENT
  // =========================================================================

  private registerTransientNode(node: { stop?: (when?: number) => void; disconnect: () => void }, stopTime: number): void {
    this.activeNodes.add(node);
    if (!this.context) return;

    const delayMs = Math.max(0, Math.floor((stopTime - this.context.currentTime + 0.05) * 1000));
    setTimeout(() => {
      this.activeNodes.delete(node);
    }, delayMs);
  }

  /**
   * Stops all active loops, disconnects nodes, and cleans up resources.
   */
  dispose(): void {
    this.stopRain(0);

    for (const node of this.activeNodes) {
      try {
        node.stop?.();
        node.disconnect();
      } catch {
        // Node may already be stopped
      }
    }
    this.activeNodes.clear();

    if (this.rainDropletTimer) {
      clearTimeout(this.rainDropletTimer);
      this.rainDropletTimer = null;
    }

    try {
      this.sfxGain?.disconnect();
      this.ambienceGain?.disconnect();
      this.masterGain?.disconnect();
    } catch {
      // Ignore disconnect errors during teardown
    }

    this.masterGain = null;
    this.sfxGain = null;
    this.ambienceGain = null;
    this.context = null;
    this.pinkNoiseBuffer = null;
    this.whiteNoiseBuffer = null;
    this.brownNoiseBuffer = null;
  }
}
