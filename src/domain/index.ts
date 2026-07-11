import type { Character, Follower, DungeonEvent, Scenario, Weapon, Armor, Shield, GeneralItem, Enemy } from '../types';

export function createDefaultDiceTray() {
  return {
    isRolling: false,
    d1: 0,
    d2: 0,
    sides: 6,
    resultText: '',
    isCritical: false,
    isFumble: false,
  };
}

export function createDefaultCombatState() {
  return {
    active: false,
    enemies: [] as Enemy[],
    round: 0,
    pendingRoarCheck: null as 'start' | 'death' | null,
    roarCheckedThisCombat: false,
    shireenClueSpent: false,
    chronovalsWindPenalty: false,
    isCharmed: false,
    isStunned: false,
    isClinging: false,
    isBerserk: false,
    isAnotherEnding: false,
    activeAttacks: [] as any[],
    log: [] as string[],
    hasQuickStrikeActive: false,
    hasWeaponCreatedThisRound: false,
    hasCoveredInRound: false,
    pendingCover: null as {
      attackId: string;
      followerId: string;
      followerName: string;
      enemyName: string;
      enemyLevel: number;
    } | null,
    lootText: '',
    lootRolled: false,
  };
}

export class PlayerCharacter implements Character {
  public name: string;
  public level: number;
  public exp: number;
  public gold: number;
  public food: number;
  public skillMax: number;
  public skillCurrent: number;
  public lifeMax: number;
  public lifeCurrent: number;
  public subStatType: 'magic' | 'luck' | 'strength' | 'dexterity';
  public subStatMax: number;
  public subStatCurrent: number;
  public followerMax: number;
  public followerCurrent: number;
  public spells: string[];
  public miracles: string[];
  public weapons: Weapon[];
  public armors: Armor[];
  public shields: Shield[];
  public items: GeneralItem[];
  public equippedWeapon: Weapon | null;
  public equippedArmor: Armor | null;
  public equippedShield: Shield | null;
  public hasActiveLantern: boolean;
  public statusEffects: string[];

  constructor(data?: Partial<Character>) {
    this.name = data?.name || '無名の冒険者';
    this.level = data?.level ?? 10;
    this.exp = data?.exp ?? 10;
    this.gold = data?.gold ?? 10;
    this.food = data?.food ?? 2;
    this.skillMax = data?.skillMax ?? 0;
    this.skillCurrent = data?.skillCurrent ?? 0;
    this.lifeMax = data?.lifeMax ?? 4;
    this.lifeCurrent = data?.lifeCurrent ?? 4;
    this.subStatType = data?.subStatType || 'magic';
    this.subStatMax = data?.subStatMax ?? 2;
    this.subStatCurrent = data?.subStatCurrent ?? 2;
    this.followerMax = data?.followerMax ?? 7;
    this.followerCurrent = data?.followerCurrent ?? 7;
    this.spells = data?.spells ? [...data.spells] : [];
    this.miracles = data?.miracles ? [...data.miracles] : [];
    this.weapons = data?.weapons ? [...data.weapons] : [];
    this.armors = data?.armors ? [...data.armors] : [];
    this.shields = data?.shields ? [...data.shields] : [];
    this.items = data?.items ? [...data.items] : [];
    this.equippedWeapon = data?.equippedWeapon || null;
    this.equippedArmor = data?.equippedArmor || null;
    this.equippedShield = data?.equippedShield || null;
    this.hasActiveLantern = data?.hasActiveLantern ?? true;
    this.statusEffects = data?.statusEffects ? [...data.statusEffects] : [];
  }

  public takeDamage(amount: number): void {
    this.lifeCurrent = Math.max(0, this.lifeCurrent - amount);
  }

  public heal(amount: number): void {
    this.lifeCurrent = Math.min(this.lifeMax, this.lifeCurrent + amount);
  }

  public addGold(amount: number): void {
    this.gold += amount;
  }

  public spendGold(amount: number): boolean {
    if (this.gold >= amount) {
      this.gold -= amount;
      return true;
    }
    return false;
  }

  public addFood(amount: number): void {
    this.food += amount;
  }

  public useFood(): boolean {
    if (this.food > 0) {
      this.food--;
      this.heal(2);
      return true;
    }
    return false;
  }

  public addStatusEffect(effect: string): void {
    if (!this.statusEffects.includes(effect)) {
      this.statusEffects.push(effect);
    }
  }

  public removeStatusEffect(effect: string): void {
    this.statusEffects = this.statusEffects.filter(e => e !== effect);
  }

  public hasStatusEffect(effect: string): boolean {
    return this.statusEffects.includes(effect);
  }

  public equipWeapon(weapon: Weapon | null): void {
    if (!weapon) {
      this.equippedWeapon = null;
      return;
    }
    if (weapon.hands === 2) {
      this.equippedShield = null;
    }
    this.equippedWeapon = weapon;
  }

  public equipArmor(armor: Armor | null): void {
    if (this.equippedArmor) {
      const oldArmor = this.equippedArmor;
      this.lifeMax = Math.max(1, this.lifeMax - oldArmor.modLife);
      this.lifeCurrent = Math.max(1, Math.min(this.lifeMax, this.lifeCurrent - oldArmor.modLife));
    }
    this.equippedArmor = armor;
    if (armor) {
      this.lifeMax += armor.modLife;
      this.lifeCurrent += armor.modLife;
    }
  }

  public equipShield(shield: Shield | null): void {
    if (!shield) {
      this.equippedShield = null;
      return;
    }
    if (this.equippedWeapon && this.equippedWeapon.hands === 2) {
      this.equippedWeapon = null;
    }
    this.equippedShield = shield;
  }

  public static fromJSON(data: any): PlayerCharacter {
    return new PlayerCharacter(data);
  }

  public toJSON() {
    return {
      name: this.name,
      level: this.level,
      exp: this.exp,
      gold: this.gold,
      food: this.food,
      skillMax: this.skillMax,
      skillCurrent: this.skillCurrent,
      lifeMax: this.lifeMax,
      lifeCurrent: this.lifeCurrent,
      subStatType: this.subStatType,
      subStatMax: this.subStatMax,
      subStatCurrent: this.subStatCurrent,
      followerMax: this.followerMax,
      followerCurrent: this.followerCurrent,
      spells: this.spells,
      miracles: this.miracles,
      weapons: this.weapons,
      armors: this.armors,
      shields: this.shields,
      items: this.items,
      equippedWeapon: this.equippedWeapon,
      equippedArmor: this.equippedArmor,
      equippedShield: this.equippedShield,
      hasActiveLantern: this.hasActiveLantern,
      statusEffects: this.statusEffects,
    };
  }
}

export class GameSession {
  public sessionId: string;
  public currentScreen: 'scenario_select' | 'creator' | 'explore' | 'combat' | 'levelup' | 'gameover' | 'success';
  public isCharacterCreated: boolean;
  public nextRoomTensDigitOverride: number | null;
  public character: PlayerCharacter;
  public followers: Follower[];
  public activeEvent: DungeonEvent | null;
  public dungeonDepth: number;
  public logs: any[];
  public diceTray: ReturnType<typeof createDefaultDiceTray>;
  public combatState: ReturnType<typeof createDefaultCombatState>;
  public activeScenario: Scenario | null;
  public pyramidRunCount: number;
  public pyramidBossSnapshot: any;

  constructor(data?: any) {
    this.sessionId = data?.sessionId || Math.random().toString(36).substring(2, 9);
    this.currentScreen = data?.currentScreen || 'scenario_select';
    this.isCharacterCreated = data?.isCharacterCreated ?? false;
    this.nextRoomTensDigitOverride = data?.nextRoomTensDigitOverride ?? null;
    this.character = data?.character ? new PlayerCharacter(data.character) : new PlayerCharacter();
    this.followers = data?.followers || [];
    this.activeEvent = data?.activeEvent || null;
    this.dungeonDepth = data?.dungeonDepth ?? 1;
    this.logs = data?.logs || [];
    this.diceTray = data?.diceTray || createDefaultDiceTray();
    this.combatState = data?.combatState || createDefaultCombatState();
    this.activeScenario = data?.activeScenario || null;
    this.pyramidRunCount = data?.pyramidRunCount ?? 1;
    this.pyramidBossSnapshot = data?.pyramidBossSnapshot || null;
  }

  public toJSON() {
    return {
      sessionId: this.sessionId,
      currentScreen: this.currentScreen,
      isCharacterCreated: this.isCharacterCreated,
      nextRoomTensDigitOverride: this.nextRoomTensDigitOverride,
      character: this.character.toJSON(),
      followers: this.followers,
      activeEvent: this.activeEvent,
      dungeonDepth: this.dungeonDepth,
      logs: this.logs,
      diceTray: this.diceTray,
      combatState: this.combatState,
      activeScenario: this.activeScenario,
      pyramidRunCount: this.pyramidRunCount,
      pyramidBossSnapshot: this.pyramidBossSnapshot,
    };
  }

  public serialize(): string {
    return JSON.stringify(this.toJSON());
  }

  public static deserialize(jsonStr: string): GameSession {
    const data = JSON.parse(jsonStr);
    return new GameSession(data);
  }

  public saveToLocalStorage(): void {
    localStorage.setItem('roguelike_half_saved_session', this.serialize());
  }

  public static loadFromLocalStorage(): GameSession | null {
    try {
      const jsonStr = localStorage.getItem('roguelike_half_saved_session');
      if (jsonStr) {
        return GameSession.deserialize(jsonStr);
      }
    } catch (e) {
      console.error('Failed to load session from localStorage:', e);
    }
    return null;
  }

  public static clearLocalStorage(): void {
    localStorage.removeItem('roguelike_half_saved_session');
  }
}
