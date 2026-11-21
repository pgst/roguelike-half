import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useGameState } from './useGameState';
import { useCombat } from './useCombat';
import { useDungeon } from './useDungeon';
import { clearGlobalSeed } from '../domain/random';
import aranzasScenario from '../data/scenarios/public/aranzas.json';
import type { Enemy, Scenario } from '../types';

function makeEnemy(overrides: Partial<Enemy> = {}): Enemy {
  return {
    id: 'goblin-1',
    name: 'ゴブリン',
    level: 4,
    lifeMax: 1,
    lifeCurrent: 1,
    attackCount: 1,
    count: 1,
    tags: ['weak'],
    ...overrides,
  };
}

function setupCurseTestCharacter() {
  const gameState = useGameState();
  gameState.initNewCharacter('呪い検証者', 'luck');
  gameState.resetCombatState();
  gameState.followers.value = [];
  gameState.clearLogs();
  gameState.activeScenario.value = aranzasScenario as unknown as Scenario;
  gameState.equipWeapon({
    name: '片手剣',
    type: 'one-handed',
    modAttack: 0,
    attribute: 'slash',
    goldCost: 10,
    isMagic: false,
    description: '',
  });
  gameState.equipArmor(null);
  gameState.equipShield(null);
  gameState.character.value.skillCurrent = 2;
  gameState.character.value.skillMax = 2;
  gameState.character.value.lifeMax = 6;
  gameState.character.value.lifeCurrent = 6;
  // Ensure lantern is carried so darkness -2 penalty is not applied
  if (!gameState.carriesLantern.value) {
    gameState.character.value.items.push({
      id: 'lantern',
      name: 'ランタン',
      type: 'lantern',
      goldCost: 5,
      value: 2,
      description: '',
    });
  }
  return gameState;
}

describe('Status Effect Modifiers (Issue #11)', () => {
  beforeEach(() => {
    clearGlobalSeed();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('applies curse (-1) only once and logs once in playerAttack', async () => {
    const gameState = setupCurseTestCharacter();
    const combat = useCombat();
    gameState.character.value.statusEffects = ['呪い'];

    const enemy = makeEnemy({ level: 4, lifeMax: 1, lifeCurrent: 1 });
    gameState.combatState.active = true;
    gameState.combatState.isOver = false;
    gameState.combatState.round = 1;
    gameState.combatState.enemies = [enemy];

    // roll = 3; skill(2) + roll(3) + mod(-1) = 4 >= 4 -> hit! (would miss with -2)
    vi.spyOn(Math, 'random').mockReturnValue(0.4);

    await combat.playerAttack('goblin-1');

    expect(gameState.diceTray.resultText).toContain('出目[3] + 能力値(2) - 修正(1) = 合計(4) vs 目標値(4) → 🎯命中！');
    const penaltyLogs = gameState.logs.value.filter(l =>
      l.text.includes('状態異常ペナルティにより攻撃判定に')
    );
    expect(penaltyLogs).toHaveLength(1);
    expect(penaltyLogs[0].text).toBe('状態異常ペナルティにより攻撃判定に -1 の修正が入ります。');
  });

  it('applies curse (-1) only once and logs once in resolveDefense', async () => {
    const gameState = setupCurseTestCharacter();
    const combat = useCombat();
    gameState.character.value.statusEffects = ['呪い'];

    const enemy = makeEnemy({ level: 4 });
    gameState.combatState.active = true;
    gameState.combatState.isOver = false;
    gameState.combatState.round = 1;
    gameState.combatState.enemies = [enemy];
    gameState.combatState.activeAttacks = [{ id: 'atk-1', source: enemy, type: 'normal' }];

    // roll = 3; skill(2) + roll(3) + mod(-1) = 4 >= 4 -> defense success! (would fail with -2)
    vi.spyOn(Math, 'random').mockReturnValue(0.4);

    await combat.resolveDefense('atk-1', 'hero');

    expect(gameState.character.value.lifeCurrent).toBe(6);
    expect(gameState.diceTray.resultText).toContain('出目[3] + 能力値(2) - 修正(1) = 合計(4) vs 目標値(4) → 🛡️防御成功！');
    const penaltyLogs = gameState.logs.value.filter(l =>
      l.text.includes('状態異常ペナルティにより防御判定に')
    );
    expect(penaltyLogs).toHaveLength(1);
    expect(penaltyLogs[0].text).toBe('状態異常ペナルティにより防御判定に -1 の修正が入ります。');
  });

  it('applies curse (-1) only once and logs once in executeCover', async () => {
    const gameState = setupCurseTestCharacter();
    const combat = useCombat();
    gameState.character.value.statusEffects = ['呪い'];
    gameState.character.value.subStatType = 'strength';
    gameState.character.value.subStatCurrent = 2;

    gameState.followers.value = [{
      id: 'fol-1',
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

    const enemy = makeEnemy({ level: 4 });
    gameState.combatState.active = true;
    gameState.combatState.isOver = false;
    gameState.combatState.round = 1;
    gameState.combatState.enemies = [enemy];
    const attack = { id: 'atk-cover', source: enemy, type: 'normal' };
    gameState.combatState.activeAttacks = [attack];
    gameState.combatState.pendingCover = {
      attackId: 'atk-cover',
      followerId: 'fol-1',
      followerName: '新米兵士',
      enemyName: enemy.name,
      enemyLevel: 4,
      enemy,
      attack,
    };

    // roll = 3; skill(2) + roll(3) + mod(-1) = 4 >= 4 -> cover success! (would fail with -2)
    vi.spyOn(Math, 'random').mockReturnValue(0.4);

    await combat.executeCover(false);

    expect(gameState.followers.value).toHaveLength(1);
    expect(gameState.followers.value[0].lifeCurrent).toBe(1);
    const penaltyLogs = gameState.logs.value.filter(l =>
      l.text.includes('状態異常ペナルティにより防御判定に')
    );
    expect(penaltyLogs).toHaveLength(1);
    expect(penaltyLogs[0].text).toBe('状態異常ペナルティにより防御判定に -1 の修正が入ります。');
  });

  it('handles partial statusEffectRules (modSkill only, modAttack only, modDefense only) per check type', async () => {
    const gameState = setupCurseTestCharacter();
    const combat = useCombat();
    const dungeon = useDungeon();

    gameState.activeScenario.value = {
      ...(aranzasScenario as unknown as Scenario),
      statusEffectRules: {
        集中低下: { description: '能力判定のみ -1', modSkill: -1 },
        腕負傷: { description: '攻撃判定のみ -1', modAttack: -1 },
        足負傷: { description: '防御判定のみ -1', modDefense: -1 },
      },
    };

    // 1) modSkill only: should NOT penalize attack or defense, SHOULD penalize skill/trap check
    gameState.character.value.statusEffects = ['集中低下'];
    gameState.combatState.active = true;
    gameState.combatState.isOver = false;
    gameState.combatState.round = 1;
    const enemy = makeEnemy({ level: 5, lifeMax: 1, lifeCurrent: 1 });
    gameState.combatState.enemies = [enemy];
    vi.spyOn(Math, 'random').mockReturnValue(0.4); // roll = 3

    await combat.playerAttack('goblin-1');
    expect(gameState.diceTray.resultText).toContain('出目[3] + 能力値(2) = 合計(5) vs 目標値(5) → 🎯命中！');
    expect(gameState.logs.value.some(l => l.text.includes('状態異常ペナルティにより攻撃判定に'))).toBe(false);

    gameState.clearLogs();
    gameState.combatState.enemies = [makeEnemy({ level: 5 })];
    gameState.combatState.isOver = false;
    gameState.combatState.activeAttacks = [{ id: 'atk-skill-only', source: enemy, type: 'normal' }];
    await combat.resolveDefense('atk-skill-only', 'hero');
    expect(gameState.diceTray.resultText).toContain('出目[3] + 能力値(2) = 合計(5) vs 目標値(5) → 🛡️防御成功！');
    expect(gameState.logs.value.some(l => l.text.includes('状態異常ペナルティにより防御判定に'))).toBe(false);

    gameState.clearLogs();
    gameState.activeEvent.value = {
      title: 'テスト罠',
      d66Code: '12',
      description: '',
      type: 'trap',
      trapStat: 'skill',
      trapTarget: 4,
      trapDamage: 1,
    };
    const trapPassed = await dungeon.resolveTrapCheck(false);
    // roll(3) + skill(2) + modSkill(-1) = 4 >= 4 -> true
    expect(trapPassed).toBe(true);
    expect(gameState.logs.value.filter(l => l.text.includes('状態異常ペナルティにより判定に -1'))).toHaveLength(1);

    // 2) modAttack only: penalizes attack (-1), not defense
    gameState.clearLogs();
    gameState.character.value.statusEffects = ['腕負傷'];
    gameState.combatState.isOver = false;
    gameState.combatState.enemies = [makeEnemy({ level: 4, lifeMax: 1, lifeCurrent: 1 })];
    await combat.playerAttack('goblin-1');
    expect(gameState.diceTray.resultText).toContain('出目[3] + 能力値(2) - 修正(1) = 合計(4) vs 目標値(4) → 🎯命中！');
    expect(gameState.logs.value.filter(l => l.text.includes('状態異常ペナルティにより攻撃判定に -1'))).toHaveLength(1);

    gameState.clearLogs();
    gameState.combatState.isOver = false;
    gameState.combatState.enemies = [makeEnemy({ level: 5 })];
    gameState.combatState.activeAttacks = [{ id: 'atk-modatk-only', source: enemy, type: 'normal' }];
    await combat.resolveDefense('atk-modatk-only', 'hero');
    expect(gameState.diceTray.resultText).toContain('出目[3] + 能力値(2) = 合計(5) vs 目標値(5) → 🛡️防御成功！');
    expect(gameState.logs.value.some(l => l.text.includes('状態異常ペナルティにより防御判定に'))).toBe(false);

    // 3) modDefense only: penalizes defense (-1), not attack
    gameState.clearLogs();
    gameState.character.value.statusEffects = ['足負傷'];
    gameState.combatState.isOver = false;
    gameState.combatState.enemies = [makeEnemy({ level: 5, lifeMax: 1, lifeCurrent: 1 })];
    await combat.playerAttack('goblin-1');
    expect(gameState.diceTray.resultText).toContain('出目[3] + 能力値(2) = 合計(5) vs 目標値(5) → 🎯命中！');
    expect(gameState.logs.value.some(l => l.text.includes('状態異常ペナルティにより攻撃判定に'))).toBe(false);

    gameState.clearLogs();
    gameState.combatState.isOver = false;
    const defEnemy = makeEnemy({ level: 4 });
    gameState.combatState.enemies = [defEnemy];
    gameState.combatState.activeAttacks = [{ id: 'atk-moddef-only', source: defEnemy, type: 'normal' }];
    await combat.resolveDefense('atk-moddef-only', 'hero');
    expect(gameState.diceTray.resultText).toContain('出目[3] + 能力値(2) - 修正(1) = 合計(4) vs 目標値(4) → 🛡️防御成功！');
    expect(gameState.logs.value.filter(l => l.text.includes('状態異常ペナルティにより防御判定に -1'))).toHaveLength(1);
  });
});
