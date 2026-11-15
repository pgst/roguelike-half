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

  it('should migrate legacy created weapons and normalize diceTray.isRolling on deserialize', () => {
    const session = new GameSession({
      character: {
        name: 'Mage Hero',
        weapons: [
          { name: '創られた片手武器', type: 'one-handed', modAttack: 0, attribute: 'slash', goldCost: 5, isMagic: true, description: '' },
          { name: '魔法の片手武器', type: 'one-handed', modAttack: 0, attribute: 'slash', goldCost: 25, isMagic: true, description: '' },
        ],
        items: [
          { id: '1', name: '貫きの石弾 (5個)', type: 'holywater', goldCost: 15, value: 12, chargesCurrent: 5, chargesMax: 5, description: '' },
        ],
      },
      followers: [
        { id: 'f1', name: 'ウォー・ドール', type: 'soldier', isCombatant: true, skill: 1, lifeMax: 1, lifeCurrent: 1, weaponAttribute: 'slash', goldCost: 0, description: '' },
      ],
      diceTray: { isRolling: true, d1: 4, d2: 0, sides: 6, resultText: '', isCritical: false, isFumble: false },
    });

    expect(session.character.weapons[0].isCreated).toBe(true);
    expect(session.character.weapons[0].isMagic).toBe(false);
    expect(session.character.weapons[1].isCreated).toBeUndefined();
    expect(session.character.weapons[1].isMagic).toBe(true);
    expect(session.character.items[0].type).toBe('magic_bullet');
    expect(session.character.items[0].value).toBe(60);
    expect(session.followers[0].type).toBe('golem');
    expect(session.followers[0].attackCount).toBe(2);
    expect(session.followers[0].damageIgnoreCount).toBe(1);
    expect(session.diceTray.isRolling).toBe(false);
  });
});
