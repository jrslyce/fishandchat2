import { test, expect } from '@playwright/test';

test.describe('Atmosphere & Living World System', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => (window as any).__THREE_GAME_DIAGNOSTICS__?.frame > 5);
    const titleStart = page.locator('#title-start');
    await expect(titleStart).toBeEnabled({ timeout: 10000 });
    await titleStart.click();
    await expect(page.locator('#title-screen')).toBeHidden({ timeout: 10000 });
  });

  test('LivingWorldSystem initializes entities and integrates with Game', async ({ page }) => {
    const initialized = await page.evaluate(() => {
      const game = (window as any).__FISH_GAME__;
      const lw = game?.livingWorld;
      return {
        hasLivingWorld: Boolean(lw),
        hasRainbow: Boolean(lw?.rainbowArc),
        hasBoat: Boolean(lw?.boat),
        hasWhale: Boolean(lw?.whale),
        hasFlock: Boolean(lw?.flock),
        hasLighthouse: Boolean(lw?.lighthouse),
        hasKraken: Boolean(lw?.kraken),
        hasCelestialSky: Boolean(lw?.celestialSky),
        hasWeather: Boolean(lw?.weather),
        initialWeather: lw?.getWeather(),
      };
    });

    expect(initialized.hasLivingWorld).toBe(true);
    expect(initialized.hasRainbow).toBe(true);
    expect(initialized.hasBoat).toBe(true);
    expect(initialized.hasWhale).toBe(true);
    expect(initialized.hasFlock).toBe(true);
    expect(initialized.hasLighthouse).toBe(true);
    expect(initialized.hasKraken).toBe(true);
    expect(initialized.hasCelestialSky).toBe(true);
    expect(initialized.hasWeather).toBe(true);
    expect(initialized.initialWeather).toBe('clear');
  });

  test('RainbowArc methods and opacity controls', async ({ page }) => {
    const result = await page.evaluate(() => {
      const game = (window as any).__FISH_GAME__;
      const rainbow = game.livingWorld.rainbowArc;

      const initialOpacity = rainbow.getOpacity();

      // Set target opacity
      rainbow.setOpacity(0.8);
      // Fast forward update
      rainbow.update(1.5);
      const fadedOpacity = rainbow.getOpacity();

      // Instant opacity
      rainbow.setOpacity(1.0, true);
      const instantOpacity = rainbow.getOpacity();

      rainbow.setVisible(false);
      const visibleFalse = rainbow.group.visible;
      rainbow.setVisible(true);
      const visibleTrue = rainbow.group.visible;

      return { initialOpacity, fadedOpacity, instantOpacity, visibleFalse, visibleTrue };
    });

    expect(result.fadedOpacity).toBeGreaterThan(0.5);
    expect(result.instantOpacity).toBe(1.0);
    expect(result.visibleFalse).toBe(false);
    expect(result.visibleTrue).toBe(true);
  });

  test('DistantBoat cruises across horizon and bobs on waves', async ({ page }) => {
    const boatMovement = await page.evaluate(() => {
      const game = (window as any).__FISH_GAME__;
      const boat = game.livingWorld.boat;

      const startX = boat.group.position.x;
      const startY = boat.group.position.y;

      // Update 5 seconds of movement
      boat.update(5.0);
      const midX = boat.group.position.x;
      const midY = boat.group.position.y;

      // Force boat past maxX (14.0) to test seamless wrap-around loop
      boat.group.position.x = 13.9;
      boat.update(1.0); // moves > 14.0 and wraps to minX (-14.0)
      const wrappedX = boat.group.position.x;

      return { startX, midX, movedRight: midX > startX, wrappedX, yChanged: startY !== midY };
    });

    expect(boatMovement.movedRight).toBe(true);
    expect(boatMovement.wrappedX).toBeLessThan(0); // wrapped around to negative X
  });

  test('BreachingWhale inactive by default, leaps on trigger, and creates splash', async ({ page }) => {
    const whaleData = await page.evaluate(() => {
      const game = (window as any).__FISH_GAME__;
      const whale = game.livingWorld.whale;

      const wasBreachingBefore = whale.isBreaching();

      let breachCallbackFired = false;
      whale.setBreachCallback(() => {
        breachCallbackFired = true;
      });

      // Trigger whale breach
      game.livingWorld.triggerWhaleJump();
      const isBreachingNow = whale.isBreaching();

      // Simulate ascent into air (apex at t ~ 1.7s)
      whale.update(1.6);
      const apexY = whale.group.children[0].position.y; // whaleMesh y

      // Simulate plunge back into water and completion (duration is 3.4s)
      whale.update(2.5);
      const isBreachingDone = whale.isBreaching();

      return {
        wasBreachingBefore,
        breachCallbackFired,
        isBreachingNow,
        apexY,
        isBreachingDone,
      };
    });

    expect(whaleData.wasBreachingBefore).toBe(false);
    expect(whaleData.breachCallbackFired).toBe(true);
    expect(whaleData.isBreachingNow).toBe(true);
    expect(whaleData.apexY).toBeGreaterThan(1.5); // leaped high into the air
    expect(whaleData.isBreachingDone).toBe(false); // finished breach
  });

  test('FlockOfBirds flaps wings and flies along trajectory', async ({ page }) => {
    const flockData = await page.evaluate(() => {
      const game = (window as any).__FISH_GAME__;
      const flock = game.livingWorld.flock;

      const birdCount = flock.group.children.length;

      // Update flock flight
      flock.update(0.5);
      const leaderPos1 = flock.group.children[0].position.clone();

      flock.update(2.0);
      const leaderPos2 = flock.group.children[0].position.clone();

      const moved = leaderPos1.distanceTo(leaderPos2) > 0.1;

      flock.setVisible(false);
      const visibleFalse = flock.group.visible;
      flock.setVisible(true);

      return { birdCount, moved, visibleFalse };
    });

    expect(flockData.birdCount).toBeGreaterThanOrEqual(3);
    expect(flockData.moved).toBe(true);
    expect(flockData.visibleFalse).toBe(false);
  });

  test('WeatherSystem transitions weathers, lighting, rain, and rainbow arc', async ({ page }) => {
    const weatherData = await page.evaluate(() => {
      const game = (window as any).__FISH_GAME__;
      const lw = game.livingWorld;
      const ws = lw.weather;

      // 1. Set to rain
      ws.setWeather('rain');
      const rainWeather = ws.getWeather();
      // Fast forward update for rain particles
      ws.update(1.0);
      const rainVisible = (ws as any).rainGroup.visible;

      // 2. Set to rainbow
      ws.setWeather('rainbow');
      const rainbowWeather = ws.getWeather();
      ws.update(2.0);
      const rainbowOpacity = lw.rainbowArc.getOpacity();

      // 3. Set to golden-hour
      ws.setWeather('golden-hour');
      const goldenWeather = ws.getWeather();

      // 4. Set to fog
      ws.setWeather('fog');
      const fogWeather = ws.getWeather();

      return {
        rainWeather,
        rainVisible,
        rainbowWeather,
        rainbowOpacity,
        goldenWeather,
        fogWeather,
      };
    });

    expect(weatherData.rainWeather).toBe('rain');
    expect(weatherData.rainVisible).toBe(true);
    expect(weatherData.rainbowWeather).toBe('rainbow');
    expect(weatherData.rainbowOpacity).toBeGreaterThan(0.5);
    expect(weatherData.goldenWeather).toBe('golden-hour');
    expect(weatherData.fogWeather).toBe('fog');
  });

  test('Stream purchases trigger weather overrides and whale leaps', async ({ page }) => {
    const streamEvent = await page.evaluate(() => {
      const game = (window as any).__FISH_GAME__;
      const lw = game.livingWorld;

      // Trigger Rainbow Totem
      game.events.emit('premiumItemPurchased', { id: 'rainbow-totem', ok: true });
      const weatherAfterTotem = lw.getWeather();

      // Trigger Whale Call Horn
      game.events.emit('premiumItemPurchased', { id: 'whale-call-horn', ok: true });
      const whaleBreaching = lw.whale.isBreaching();

      return { weatherAfterTotem, whaleBreaching };
    });

    expect(streamEvent.weatherAfterTotem).toBe('rainbow');
    expect(streamEvent.whaleBreaching).toBe(true);
  });

  test('Lighthouse rotates spotlight beam and scales intensity with fog', async ({ page }) => {
    const lighthouseData = await page.evaluate(() => {
      const game = (window as any).__FISH_GAME__;
      const lw = game.livingWorld;
      const lh = lw.getLighthouse();

      const initialPos = {
        x: lh.group.position.x,
        y: lh.group.position.y,
        z: lh.group.position.z,
      };

      const rot0 = (lh as any).spotlightGroup.rotation.y;
      lh.update(1.0);
      const rot1 = (lh as any).spotlightGroup.rotation.y;

      // Fog scaling
      const fog0 = lh.getFogIntensity();
      lh.setFogIntensity(2.2);
      lh.update(1.2);
      const fog1 = lh.getFogIntensity();
      const beamOpacity = (lh as any).beamMaterial.opacity;

      lh.setVisible(false);
      const visibleFalse = lh.group.visible;
      lh.setVisible(true);

      return { initialPos, rotated: rot1 > rot0, fog0, fog1, beamOpacity, visibleFalse };
    });

    expect(lighthouseData.initialPos.x).toBe(10.0);
    expect(lighthouseData.rotated).toBe(true);
    expect(lighthouseData.fog1).toBeGreaterThan(1.2);
    expect(lighthouseData.beamOpacity).toBeGreaterThan(0.35);
    expect(lighthouseData.visibleFalse).toBe(false);
  });

  test('KrakenTentacle rises in curved S-shape, slaps surface, and dives into depths', async ({ page }) => {
    const krakenData = await page.evaluate(() => {
      const game = (window as any).__FISH_GAME__;
      const lw = game.livingWorld;
      const kraken = lw.kraken;

      const wasBreachingBefore = kraken.isBreaching();

      let callbackFired = false;
      kraken.setBreachCallback(() => {
        callbackFired = true;
      });

      // Trigger via coordinator method
      lw.triggerKrakenJump();
      const isBreachingNow = kraken.isBreaching();
      const visibleNow = kraken.group.visible;

      // Simulate ascent (t ~ 0.28, duration 4.3s => update 1.2s)
      kraken.update(1.2);
      const rootY = (kraken as any).tentacleRoot.position.y;

      // Simulate surface slap (t ~ 0.78 => update 2.2s)
      kraken.update(2.2);
      const slapTriggered = (kraken as any).slapSplashTriggered;

      // Finish breach
      kraken.update(1.5);
      const isBreachingDone = kraken.isBreaching();

      return {
        wasBreachingBefore,
        callbackFired,
        isBreachingNow,
        visibleNow,
        rootY,
        slapTriggered,
        isBreachingDone,
      };
    });

    expect(krakenData.wasBreachingBefore).toBe(false);
    expect(krakenData.callbackFired).toBe(true);
    expect(krakenData.isBreachingNow).toBe(true);
    expect(krakenData.visibleNow).toBe(true);
    expect(krakenData.rootY).toBeGreaterThan(-1.5);
    expect(krakenData.slapTriggered).toBe(true);
    expect(krakenData.isBreachingDone).toBe(false);
  });

  test('CelestialSky fades 3D crescent moon, twinkling starfield, and shoots meteors', async ({ page }) => {
    const celestialData = await page.evaluate(() => {
      const game = (window as any).__FISH_GAME__;
      const lw = game.livingWorld;
      const sky = lw.getCelestialSky();

      const initialOpacity = sky.getNightOpacity();

      // Fade in to night
      sky.setNightOpacity(1.0);
      sky.update(1.0);
      const fadedOpacity = sky.getNightOpacity();
      const moonOpacity = (sky as any).moonMaterial.opacity;
      const starOpacity = (sky as any).starfieldMaterial.uniforms.uOpacity.value;

      // Shooting star trigger
      sky.triggerShootingStar();
      const meteorActive = (sky as any).meteorActive;
      const meteorVisible = (sky as any).meteorMesh.visible;

      // Complete meteor
      sky.update(0.7);
      const meteorFinished = !(sky as any).meteorActive;

      // Instant opacity control
      sky.setNightOpacity(0.0, true);
      const zeroOpacity = sky.getNightOpacity();

      return {
        initialOpacity,
        fadedOpacity,
        moonOpacity,
        starOpacity,
        meteorActive,
        meteorVisible,
        meteorFinished,
        zeroOpacity,
      };
    });

    expect(celestialData.fadedOpacity).toBeGreaterThan(0.8);
    expect(celestialData.moonOpacity).toBeGreaterThan(0.8);
    expect(celestialData.starOpacity).toBeGreaterThan(0.8);
    expect(celestialData.meteorActive).toBe(true);
    expect(celestialData.meteorVisible).toBe(true);
    expect(celestialData.meteorFinished).toBe(true);
    expect(celestialData.zeroOpacity).toBe(0.0);
  });
});
