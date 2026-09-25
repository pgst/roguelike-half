import { describe, it, expect } from 'vitest';
import { PlayerCharacter, GameSession } from './index';

describe('PlayerCharacter Domain Model', () => {
  it('should initialize with default parameters', () => {
    const pc = new PlayerCharacter();
    expect(pc.name).toBe('無名の冒険者');
    expect(pc.level).toBe(10);
    expect(pc.lifeMax).toBe(4);
    expect(pc.lifeCurrent).toBe(4);
    expect(pc.gold).toBe(10);
  });

  it('should take damage and heal correctly', () => {
    const pc = new PlayerCharacter({ lifeMax: 10, lifeCurrent: 10 });
    
    pc.takeDamage(3);
    expect(pc.lifeCurrent).toBe(7);

    // Should not drop below 0
    pc.takeDamage(10);
    expect(pc.lifeCurrent).toBe(0);

    pc.heal(5);
    expect(pc.lifeCurrent).toBe(5);

    // Should not heal above lifeMax
    pc.heal(10);
    expect(pc.lifeCurrent).toBe(10);
  });

  it('should manage gold transactions correctly', () => {
    const pc = new PlayerCharacter({ gold: 15 });
    
    expect(pc.spendGold(10)).toBe(true);
    expect(pc.gold).toBe(5);

    expect(pc.spendGold(10)).toBe(false);
    expect(pc.gold).toBe(5); // unchanged
  });

  it('should dynamically update lifeMax on armor equip/unequip preserving baseLifeMax', () => {
    const pc = new PlayerCharacter({ lifeMax: 4, lifeCurrent: 4 });
    expect(pc.baseLifeMax).toBe(4);

    const leatherArmor = { name: '革鎧', type: 'leather' as const, modLife: 2, modDex: 1, modDef: 0, goldCost: 10, description: '革鎧' };

    pc.equipArmor(leatherArmor);
    expect(pc.baseLifeMax).toBe(4);
    expect(pc.lifeMax).toBe(6);
    expect(pc.lifeCurrent).toBe(6);

    // Growing baseLifeMax while wearing armor
    pc.baseLifeMax = 5;
    pc.recalculateLife();
    expect(pc.baseLifeMax).toBe(5);
    expect(pc.lifeMax).toBe(7);

    pc.equipArmor(null);
    expect(pc.baseLifeMax).toBe(5);
    expect(pc.lifeMax).toBe(5);
    expect(pc.lifeCurrent).toBe(5);
  });

  it('should backward-compatibly restore baseLifeMax from legacy character data', () => {
    // Legacy data without baseLifeMax but wearing armor with modLife = 2
    const plateArmor = { name: '板金鎧', type: 'plate' as const, modLife: 2, modDex: -1, modDef: 0, goldCost: 30, description: '板金鎧' };
    const legacyData = {
      name: 'ベテラン戦士',
      lifeMax: 6,
      lifeCurrent: 6,
      armor: plateArmor
    };

    const pc = new PlayerCharacter(legacyData as any);
    expect(pc.baseLifeMax).toBe(4); // 6 - 2 = 4
    expect(pc.lifeMax).toBe(6);
  });
});

describe('GameSession Serialization', () => {
  it('should serialize and deserialize a session maintaining states', () => {
    const session = new GameSession();
    session.character.name = 'Test Hero';
    session.character.gold = 55;
    session.dungeonDepth = 3;

    const jsonStr = session.serialize();
    const loadedSession = GameSession.deserialize(jsonStr);

    expect(loadedSession.sessionId).toBe(session.sessionId);
    expect(loadedSession.character.name).toBe('Test Hero');
    expect(loadedSession.character.gold).toBe(55);
    expect(loadedSession.dungeonDepth).toBe(3);
    expect(loadedSession.seed).toBe(session.seed);
  });
});
