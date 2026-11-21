import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useGameState } from './useGameState';
import { useCombat } from './useCombat';
import { clearGlobalSeed } from '../domain/random';
import { registerScenarioPlugin, getScenarioPlugin } from './scenarioPlugins';
import type { Enemy } from '../types';

function makeRangedEnemy(overrides: Partial<Enemy> = {}): Enemy {
  return {
    id: 'enemy-ranged',
    name: 'ゴブリン弓兵',
    level: 5,
    lifeMax: 2,
    lifeCurrent: 2,
    attackCount: 1,
    count: 1,
    tags: ['weak'],
    isRanged: true,
    ...overrides,
  };
}

function makeSelfDestructEnemy(overrides: Partial<Enemy> = {}): Enemy {
  return {
    id: 'enemy-bomb',
    name: '自爆ゴブリン',
    level: 5,
    lifeMax: 2,
    lifeCurrent: 2,
    attackCount: 1,
    count: 1,
    tags: ['weak', 'self_destruct'],
    selfDestructDamage: 2,
    ...overrides,
  };
}

describe('Combat & Equipment Bug Fixes (Issue #5)', () => {
  beforeEach(() => {
    clearGlobalSeed();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. 【そらし】executeDeflect & skipDeflect', () => {
    it('triggers handleRoundEndEffects when executeDeflect clears the last attack in queue', async () => {
      const gameState = useGameState();
      const combat = useCombat();
      gameState.initNewCharacter('そらし検証者', 'luck');
      gameState.character.value.miracles = ['そらし'];
      gameState.character.value.subStatCurrent = 2;
      gameState.character.value.lifeMax = 6;
      gameState.character.value.lifeCurrent = 6;
      gameState.activeScenario.value = null;

      const rangedEnemy = makeRangedEnemy();
      const bombEnemy = makeSelfDestructEnemy();
      gameState.combatState.active = true;
      gameState.combatState.isOver = false;
      gameState.combatState.round = 1;
      gameState.combatState.enemies = [rangedEnemy, bombEnemy];
      gameState.combatState.activeAttacks = [{ id: 'atk-1', source: rangedEnemy, type: 'normal' }];

      // Defense roll = 1 (fumble -> triggers pendingDeflect)
      vi.spyOn(Math, 'random').mockReturnValue(0);

      await combat.resolveDefense('atk-1', 'hero');
      expect(gameState.combatState.pendingDeflect).not.toBeNull();

      await combat.executeDeflect();

      expect(gameState.combatState.pendingDeflect).toBeNull();
      expect(gameState.combatState.activeAttacks).toHaveLength(0);
      expect((gameState.combatState as any).roundActive).toBeUndefined();
      // Round-end self-destruct should have executed: hero took 2 damage and bomb enemy died
      expect(gameState.character.value.lifeCurrent).toBe(4);
      expect(gameState.combatState.enemies.some(e => e.id === 'enemy-bomb')).toBe(false);
    });

    it('does not re-roll defense or double-increment defense count when skipDeflect is chosen', async () => {
      const gameState = useGameState();
      const combat = useCombat();
      gameState.initNewCharacter('見送り検証者', 'luck');
      gameState.character.value.miracles = ['そらし'];
      gameState.character.value.subStatCurrent = 2;
      gameState.character.value.lifeMax = 6;
      gameState.character.value.lifeCurrent = 6;
      gameState.activeScenario.value = null;

      // Also add a living follower so Rule 36 increments heroDefenseCount
      gameState.followers.value = [{
        id: 'fol-1',
        name: '新米兵士',
        type: 'soldier',
        isCombatant: true,
        skill: 1,
        lifeMax: 1,
        lifeCurrent: 1,
        weaponAttribute: 'slash',
        goldCost: 0,
        description: '',
      }];

      const rangedEnemy = makeRangedEnemy();
      const bombEnemy = makeSelfDestructEnemy();
      gameState.combatState.active = true;
      gameState.combatState.isOver = false;
      gameState.combatState.round = 1;
      gameState.combatState.heroDefenseCount = 0;
      gameState.combatState.followerDefenseCount = 0;
      gameState.combatState.enemies = [rangedEnemy, bombEnemy];
      gameState.combatState.activeAttacks = [{ id: 'atk-1', source: rangedEnemy, type: 'normal' }];

      // First roll = 1 (fail). Second roll (if erroneously re-rolled!) would be 6 (critical success).
      const randomSpy = vi.spyOn(Math, 'random')
        .mockReturnValueOnce(0) // roll 1
        .mockReturnValue(0.95); // roll 6 if called again

      await combat.resolveDefense('atk-1', 'hero');
      expect(randomSpy).toHaveBeenCalledTimes(1);
      expect(gameState.combatState.heroDefenseCount).toBe(1);
      expect(gameState.combatState.pendingDeflect).not.toBeNull();

      await combat.skipDeflect();

      // Must NOT re-roll or re-increment heroDefenseCount
      expect(randomSpy).toHaveBeenCalledTimes(1);
      expect(gameState.combatState.heroDefenseCount).toBe(1);
      expect(gameState.combatState.pendingDeflect).toBeNull();
      expect(gameState.combatState.activeAttacks).toHaveLength(0);
      // Hero took 1 hit damage + 2 self-destruct round-end damage = 3
      expect(gameState.character.value.lifeCurrent).toBe(3);
    });
  });

  describe('2. 「かばう」executeCover & cancelCover post-defense hooks & round end', () => {
    it('runs onResolveDefenseAttack and handleRoundEndEffects on executeCover failure and cancelCover', async () => {
      const hookCalls: Array<{ defSuccess: boolean; defenderId: string }> = [];
      const testScenarioId = 'test_cover_hook_scenario';
      registerScenarioPlugin({
        id: testScenarioId,
        onResolveDefenseAttack: async (_ctx, _enemy, _attack, defSuccess, _roll, _total, _isHero, defenderId) => {
          hookCalls.push({ defSuccess, defenderId });
        },
      });

      const gameState = useGameState();
      const combat = useCombat();
      gameState.initNewCharacter('かばう検証者', 'strength');
      gameState.character.value.subStatCurrent = 2;
      gameState.character.value.lifeMax = 6;
      gameState.character.value.lifeCurrent = 6;
      gameState.activeScenario.value = { id: testScenarioId } as any;

      gameState.followers.value = [{
        id: 'fol-cover',
        name: '新米兵士',
        type: 'soldier',
        isCombatant: true,
        skill: 0,
        lifeMax: 1,
        lifeCurrent: 1,
        weaponAttribute: 'slash',
        goldCost: 0,
        description: '',
      }];

      const enemy = makeSelfDestructEnemy({ level: 5 });
      gameState.combatState.active = true;
      gameState.combatState.isOver = false;
      gameState.combatState.round = 1;
      gameState.combatState.hasCoveredInRound = false;
      gameState.combatState.enemies = [enemy];
      gameState.combatState.activeAttacks = [{ id: 'atk-cover-1', source: enemy, type: 'normal' }];

      // Both follower defense and hero cover roll 1 (fail)
      vi.spyOn(Math, 'random').mockReturnValue(0);

      await combat.resolveDefense('atk-cover-1', 'fol-cover');
      expect(gameState.combatState.pendingCover).not.toBeNull();

      await combat.executeCover(true);
      expect(hookCalls).toEqual([{ defSuccess: false, defenderId: 'fol-cover' }]);
      expect(gameState.followers.value).toHaveLength(0);
      expect(gameState.combatState.activeAttacks).toHaveLength(0);
      // Self-destruct triggered at round end
      expect(gameState.character.value.lifeCurrent).toBe(4);

      // Now test cancelCover
      hookCalls.length = 0;
      const enemy2 = makeSelfDestructEnemy({ id: 'enemy-bomb-2', level: 5 });
      gameState.character.value.lifeCurrent = 6;
      gameState.combatState.isOver = false;
      gameState.combatState.round = 1;
      gameState.combatState.heroDefenseCount = 0;
      gameState.combatState.followerDefenseCount = 0;
      gameState.combatState.hasCoveredInRound = false;
      gameState.combatState.enemies = [enemy2];
      gameState.followers.value = [{
        id: 'fol-cover-2',
        name: '新米兵士2',
        type: 'soldier',
        isCombatant: true,
        skill: 0,
        lifeMax: 1,
        lifeCurrent: 1,
        weaponAttribute: 'slash',
        goldCost: 0,
        description: '',
      }];
      gameState.combatState.activeAttacks = [{ id: 'atk-cover-2', source: enemy2, type: 'normal' }];

      await combat.resolveDefense('atk-cover-2', 'fol-cover-2');
      expect(gameState.combatState.pendingCover).not.toBeNull();

      await combat.cancelCover();
      expect(hookCalls).toEqual([{ defSuccess: false, defenderId: 'fol-cover-2' }]);
      expect(gameState.followers.value).toHaveLength(0);
      expect(gameState.combatState.activeAttacks).toHaveLength(0);
      expect(gameState.character.value.lifeCurrent).toBe(4);
    });
  });

  describe('3. 「囮の風船」saves non-combatant followers', () => {
    it('consumes 囮の風船 and keeps a non-combatant follower alive on failed defense in twilight_knight', async () => {
      const gameState = useGameState();
      const combat = useCombat();
      gameState.initNewCharacter('風船検証者', 'luck');
      const tkPlugin = getScenarioPlugin('twilight_knight');
      expect(tkPlugin).toBeDefined();
      gameState.activeScenario.value = { id: 'twilight_knight' } as any;

      gameState.character.value.items.push({
        id: 'balloon-1',
        name: '囮の風船',
        type: 'consumable',
        goldCost: 6,
        value: 3,
        description: '身代わり',
      });
      gameState.followers.value = [{
        id: 'fol-porter',
        name: '荷運び',
        type: 'porter',
        isCombatant: false,
        skill: 0,
        lifeMax: 1,
        lifeCurrent: 1,
        weaponAttribute: 'strike',
        goldCost: 0,
        description: '',
      }];

      const enemy: Enemy = {
        id: 'goblin',
        name: 'ゴブリン',
        level: 5,
        lifeMax: 1,
        lifeCurrent: 1,
        attackCount: 1,
        count: 1,
        tags: ['weak'],
      };
      gameState.combatState.active = true;
      gameState.combatState.isOver = false;
      gameState.combatState.round = 1;
      gameState.combatState.enemies = [enemy];
      gameState.combatState.activeAttacks = [{ id: 'atk-balloon', source: enemy, type: 'normal' }];

      vi.spyOn(Math, 'random').mockReturnValue(0); // roll 1 -> defense fail

      await combat.resolveDefense('atk-balloon', 'fol-porter');

      expect(gameState.followers.value).toHaveLength(1);
      expect(gameState.followers.value[0].id).toBe('fol-porter');
      expect(gameState.followers.value[0].lifeCurrent).toBe(1);
      expect(gameState.character.value.items.some(i => i.name === '囮の風船')).toBe(false);
    });

    it('does not consume 囮の風船 for a combatant follower', async () => {
      const gameState = useGameState();
      const combat = useCombat();
      gameState.initNewCharacter('風船対象外検証者', 'luck');
      gameState.activeScenario.value = { id: 'twilight_knight' } as any;

      gameState.character.value.items.push({
        id: 'balloon-2',
        name: '囮の風船',
        type: 'consumable',
        goldCost: 6,
        value: 3,
        description: '身代わり',
      });
      gameState.followers.value = [{
        id: 'fol-soldier',
        name: '新米兵士',
        type: 'soldier',
        isCombatant: true,
        skill: 0,
        lifeMax: 1,
        lifeCurrent: 1,
        weaponAttribute: 'slash',
        goldCost: 0,
        description: '',
      }];

      const enemy: Enemy = {
        id: 'goblin',
        name: 'ゴブリン',
        level: 5,
        lifeMax: 1,
        lifeCurrent: 1,
        attackCount: 1,
        count: 1,
        tags: ['weak'],
      };
      gameState.combatState.active = true;
      gameState.combatState.isOver = false;
      gameState.combatState.round = 1;
      gameState.combatState.enemies = [enemy];
      gameState.combatState.activeAttacks = [{ id: 'atk-soldier', source: enemy, type: 'normal' }];

      vi.spyOn(Math, 'random').mockReturnValue(0);

      await combat.resolveDefense('atk-soldier', 'fol-soldier');

      expect(gameState.followers.value).toHaveLength(0);
      expect(gameState.character.value.items.some(i => i.name === '囮の風船')).toBe(true);
    });
  });

  describe('4. discardArmor & discardShield recalculate lifeMax and lifeCurrent', () => {
    it('reduces lifeMax and clamps lifeCurrent when discarding equipped armor or shield', () => {
      const gameState = useGameState();
      gameState.initNewCharacter('廃棄検証者', 'luck');
      // Start from clean unequipped state (base lifeMax = 4)
      gameState.equipWeapon(null);
      gameState.equipArmor(null);
      gameState.equipShield(null);
      gameState.character.value.armors = [];
      gameState.character.value.shields = [];
      expect(gameState.character.value.lifeMax).toBe(4);
      expect(gameState.character.value.lifeCurrent).toBe(4);

      const armor = { name: '板金鎧', type: 'plate' as const, modLife: 2, modDex: -1, modDef: 0, goldCost: 30, description: '' };
      const shield = { name: '丸盾', type: 'round' as const, modLife: 2, modDefRanged: 1, goldCost: 15, description: '' };

      gameState.character.value.armors.push(armor);
      gameState.equipArmor(armor);
      gameState.character.value.shields.push(shield);
      gameState.equipShield(shield);

      // base 4 + armor 2 + shield 2 = 8
      expect(gameState.character.value.lifeMax).toBe(8);
      expect(gameState.character.value.lifeCurrent).toBe(8);

      gameState.discardArmor('板金鎧');
      expect(gameState.character.value.equippedArmor).toBeNull();
      expect(gameState.character.value.lifeMax).toBe(6);
      expect(gameState.character.value.lifeCurrent).toBe(6);

      gameState.discardShield('丸盾');
      expect(gameState.character.value.equippedShield).toBeNull();
      expect(gameState.character.value.lifeMax).toBe(4);
      expect(gameState.character.value.lifeCurrent).toBe(4);
    });

    it('keeps equipped shield and lifeMax intact when discarding a duplicate spare shield from the bag', () => {
      const gameState = useGameState();
      gameState.initNewCharacter('重複盾検証者', 'luck');
      // Luck archetype already starts with 1 木盾 equipped (lifeMax = 4 + chain 1 + wood shield 1 = 6)
      const spareShield = { name: '木盾', type: 'wood' as const, modLife: 1, modDefRanged: 0, goldCost: 5, description: '' };
      gameState.character.value.shields.push(spareShield);
      expect(gameState.character.value.shields).toHaveLength(2);
      const initialLifeMax = gameState.character.value.lifeMax;

      gameState.discardShield('木盾');
      expect(gameState.character.value.shields).toHaveLength(1);
      expect(gameState.character.value.equippedShield?.name).toBe('木盾');
      expect(gameState.character.value.lifeMax).toBe(initialLifeMax);
    });
  });
});
