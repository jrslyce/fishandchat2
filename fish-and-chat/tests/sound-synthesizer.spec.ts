import { expect, test } from '@playwright/test';

test('SoundSynthesizer and AudioEngine integration test', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#game-canvas')).toBeVisible();

  // Test procedural SoundSynthesizer and AudioEngine in browser context
  const result = await page.evaluate(async () => {
    // Import AudioEngine and SoundSynthesizer directly
    const { AudioEngine } = await import('../src/core/AudioEngine');
    const { SoundSynthesizer } = await import('../src/core/SoundSynthesizer');

    const audioEngine = new AudioEngine();
    await audioEngine.unlock();

    const synth = audioEngine.getSynthesizer();
    if (!synth) {
      throw new Error('AudioEngine.getSynthesizer() returned null or undefined');
    }

    // Verify master gain existence and wiring
    const masterGain = synth.getMasterGain();
    if (!masterGain) {
      throw new Error('Synthesizer master gain node not initialized');
    }

    // Test volume controls wiring
    audioEngine.setVolume('master', 0.7);
    audioEngine.setVolume('sfx', 0.85);
    audioEngine.setVolume('ambience', 0.65);

    // Test mute wiring
    audioEngine.setMuted(true);
    const mutedGainVal = masterGain.gain.value;
    audioEngine.setMuted(false);
    const unmutedGainVal = masterGain.gain.value;

    // Test all synthesis methods
    synth.playRain(0.6);
    const rainPlaying = synth.isRainPlaying();

    synth.playThunder();
    synth.playFoghorn();
    synth.playWhaleSong();
    synth.playSeagullChirp();
    synth.playWaterSplash(1.2);
    synth.playWaterSplash();
    synth.playFanfare();
    synth.playLevelUp();
    synth.playStreakCheer();

    // Test stopping rain
    synth.stopRain(0.1);
    const rainAfterStop = synth.isRainPlaying();

    // Test standalone instantiation
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const standaloneCtx = new AudioContextClass();
    const standaloneSynth = new SoundSynthesizer(standaloneCtx);
    standaloneSynth.playStreakCheer();
    standaloneSynth.dispose();
    await standaloneCtx.close();

    // Clean up
    audioEngine.dispose();

    return {
      hasSynthesizer: true,
      hasMasterGain: true,
      mutedGainVal,
      unmutedGainVal,
      rainPlaying,
      rainAfterStop,
    };
  });

  expect(result.hasSynthesizer).toBe(true);
  expect(result.hasMasterGain).toBe(true);
  expect(result.mutedGainVal).toBe(0);
  expect(result.unmutedGainVal).toBeCloseTo(0.7, 2);
  expect(result.rainPlaying).toBe(true);
  expect(result.rainAfterStop).toBe(false);
});
