import { test, expect } from '@playwright/test';
import {
  COMMUNITY_BOSS_RAIDS,
  createCommunityGoal,
  getNextGoalTemplate,
} from '../src/game/CommunityGoals';
import { CommunitySystem } from '../src/systems/CommunitySystem';
import { Economy } from '../src/game/Economy';
import { EventBus } from '../src/core/EventBus';
import { SaveManager } from '../src/core/SaveManager';
import { createDefaultSaveState, type GameSaveStateV1 } from '../src/game/SaveState';
import type { GameEventMap } from '../src/game/events';

test.describe('Community Goals and Boss Raids System', () => {
  let storage: Record<string, string> = {};

  test.beforeAll(() => {
    if (typeof window === 'undefined') {
      (globalThis as any).window = {
        localStorage: {
          getItem: (k: string) => storage[k] ?? null,
          setItem: (k: string, v: string) => {
            storage[k] = v;
          },
          removeItem: (k: string) => {
            delete storage[k];
          },
          clear: () => {
            storage = {};
          },
        },
      };
    }
  });

  test.beforeEach(() => {
    storage = {};
    if (typeof window !== 'undefined' && window.localStorage?.clear) {
      window.localStorage.clear();
    }
  });
  test('Community Goals catalog contains specified boss raids with correct schemas', () => {
    expect(COMMUNITY_BOSS_RAIDS.length).toBeGreaterThanOrEqual(3);

    // 1. The Great Ancient Leviathan
    const leviathan = COMMUNITY_BOSS_RAIDS.find((g) => g.id === 'ancient-leviathan');
    expect(leviathan).toBeDefined();
    expect(leviathan?.name).toBe('The Great Ancient Leviathan');
    expect(leviathan?.category).toBe('weight');
    expect(leviathan?.targetValue).toBe(300);
    expect(leviathan?.bossName).toBe('The Great Ancient Leviathan');
    expect(leviathan?.completionRewards.title).toBe('Leviathan Slayer');
    expect(leviathan?.cheerPacks.some((c) => c.id === 'mega-chum' && c.progressBoost === 25)).toBe(true);
    expect(leviathan?.cheerPacks.some((c) => c.id === 'sonar-ping' && c.progressBoost === 50)).toBe(true);

    // 2. Sunken Pirate Galleon
    const galleon = COMMUNITY_BOSS_RAIDS.find((g) => g.id === 'sunken-galleon');
    expect(galleon).toBeDefined();
    expect(galleon?.name).toBe('Sunken Pirate Galleon');
    expect(galleon?.category).toBe('salvage');
    expect(galleon?.targetValue).toBe(30);
    expect(galleon?.bossName).toBe('Sunken Pirate Galleon');
    expect(galleon?.completionRewards.title).toBe('Galleon Salvager');

    // 3. The Midnight Starlit Serpent
    const serpent = COMMUNITY_BOSS_RAIDS.find((g) => g.id === 'starlit-serpent');
    expect(serpent).toBeDefined();
    expect(serpent?.name).toBe('The Midnight Starlit Serpent');
    expect(serpent?.category).toBe('rare_fish');
    expect(serpent?.bossName).toBe('The Midnight Starlit Serpent');
    expect(serpent?.completionRewards.title).toBe('Serpent Tamer');
  });

  test('createCommunityGoal and getNextGoalTemplate work properly', () => {
    const goal = createCommunityGoal('ancient-leviathan');
    expect(goal.id).toBe('ancient-leviathan');
    expect(goal.currentValue).toBe(0);

    const next = getNextGoalTemplate('ancient-leviathan');
    expect(next.id).toBe('sunken-galleon');
  });

  test('CommunitySystem automatically credits player catches toward active weight goal', () => {
    const saveManager = new SaveManager<GameSaveStateV1>(createDefaultSaveState);
    const economy = new Economy(saveManager);
    const events = new EventBus<GameEventMap>();

    const communitySystem = new CommunitySystem(economy, events, {
      ambientSimulationEnabled: false,
      initialGoalId: 'ancient-leviathan',
    });

    expect(communitySystem.getActiveGoal().id).toBe('ancient-leviathan');
    expect(communitySystem.getActiveGoal().currentValue).toBe(0);
    expect(communitySystem.getProgressRatio()).toBe(0);

    // Emit catch resolved for 12.5 kg fish
    events.emit('catchResolved', {
      result: {
        catchId: 'largemouth-bass',
        name: 'Largemouth Bass',
        rarity: 'common',
        isTrash: false,
        weightKg: 12.5,
        value: 20,
        flavor: 'A plump bass',
        xpAwarded: 15,
        addedToBasket: true,
      },
    });

    expect(communitySystem.getActiveGoal().currentValue).toBe(12.5);
    expect(communitySystem.getProgressRatio()).toBeCloseTo(12.5 / 300, 2);
  });

  test('CommunitySystem credits salvage debris toward salvage goal', () => {
    const saveManager = new SaveManager<GameSaveStateV1>(createDefaultSaveState);
    const economy = new Economy(saveManager);
    const events = new EventBus<GameEventMap>();

    const communitySystem = new CommunitySystem(economy, events, {
      ambientSimulationEnabled: false,
      initialGoalId: 'sunken-galleon',
    });

    expect(communitySystem.getActiveGoal().id).toBe('sunken-galleon');

    // Emit trash catch
    events.emit('catchResolved', {
      result: {
        catchId: 'old-boot',
        name: 'Old Boot',
        rarity: 'common',
        isTrash: true,
        weightKg: 1.0,
        value: 1,
        flavor: 'Soggy leather',
        xpAwarded: 2,
        addedToBasket: false,
      },
    });

    expect(communitySystem.getActiveGoal().currentValue).toBe(1);

    // Emit trash recycled with 2 materials salvaged
    events.emit('trashRecycled', {
      result: {
        success: true,
        materialId: 'fabric',
        amount: 2,
        roll: 3,
        targetLimit: 6,
      },
      catchId: 'old-boot',
    });

    expect(communitySystem.getActiveGoal().currentValue).toBe(3);
  });

  test('CommunitySystem allows bit cheers using Candy Bars', () => {
    const saveManager = new SaveManager<GameSaveStateV1>(createDefaultSaveState);
    const economy = new Economy(saveManager);
    const events = new EventBus<GameEventMap>();

    const communitySystem = new CommunitySystem(economy, events, {
      ambientSimulationEnabled: false,
      initialGoalId: 'ancient-leviathan',
    });

    // Initial candy bars is 0 -> cheer should fail
    expect(communitySystem.contributeCheer('mega-chum')).toBe(false);

    // Grant candy bars
    economy.addCandyBars(50);
    expect(economy.snapshot.candyBars).toBe(50);

    // Mega chum costs 20, grants +25 kg
    const success = communitySystem.contributeCheer('mega-chum');
    expect(success).toBe(true);
    expect(economy.snapshot.candyBars).toBe(30);
    expect(communitySystem.getActiveGoal().currentValue).toBe(25);
  });

  test('CommunitySystem triggers boss emergence, awards rewards, and cooldown on 100% completion', () => {
    const saveManager = new SaveManager<GameSaveStateV1>(createDefaultSaveState);
    const economy = new Economy(saveManager);
    const events = new EventBus<GameEventMap>();

    let whaleJumpFired = false;
    events.on('whaleJump', () => {
      whaleJumpFired = true;
    });

    let completedEventFired = false;
    let completedRewards: any = null;
    events.on('communityGoalCompleted', ({ rewards }) => {
      completedEventFired = true;
      completedRewards = rewards;
    });

    const communitySystem = new CommunitySystem(economy, events, {
      ambientSimulationEnabled: false,
      initialGoalId: 'sunken-galleon', // target 30
      bossCooldownSeconds: 5,
    });

    const initialCoins = economy.snapshot.coins;
    const initialCandy = economy.snapshot.candyBars;

    // Advance directly to target
    communitySystem.addProgress(30, 'TestAngler');

    expect(whaleJumpFired).toBe(true);
    expect(completedEventFired).toBe(true);
    expect(completedRewards.title).toBe('Galleon Salvager');
    expect(communitySystem.isInCooldown()).toBe(true);
    expect(communitySystem.getProgressRatio()).toBe(1);

    // Player economy rewards
    expect(economy.snapshot.coins).toBe(initialCoins + completedRewards.coins);
    expect(economy.snapshot.candyBars).toBe(initialCandy + completedRewards.candyBars);
    expect(economy.unlockedTitles()).toContain('Galleon Salvager');

    // Update cooldown
    communitySystem.update(6); // elapsed past 5s cooldown
    expect(communitySystem.isInCooldown()).toBe(false);
    // Cycled to next raid
    expect(communitySystem.getActiveGoal().id).toBe('starlit-serpent');
    expect(communitySystem.getActiveGoal().currentValue).toBe(0);
  });

  test('CommunitySystem simulates ambient contributions over time', () => {
    const saveManager = new SaveManager<GameSaveStateV1>(createDefaultSaveState);
    const economy = new Economy(saveManager);
    const events = new EventBus<GameEventMap>();

    let progressUpdateCount = 0;
    let lastContributor = '';
    events.on('communityProgressUpdated', ({ contributor }) => {
      progressUpdateCount += 1;
      if (contributor) lastContributor = contributor;
    });

    const communitySystem = new CommunitySystem(economy, events, {
      ambientSimulationEnabled: true,
      ambientIntervalMinSeconds: 0.1,
      ambientIntervalMaxSeconds: 0.2,
      initialGoalId: 'ancient-leviathan',
    });

    // Advance time by 0.5s to trigger ambient contribution
    communitySystem.update(0.5);

    expect(progressUpdateCount).toBeGreaterThan(0);
    expect(communitySystem.getActiveGoal().currentValue).toBeGreaterThan(0);
    expect(lastContributor.length).toBeGreaterThan(0);
  });
});
