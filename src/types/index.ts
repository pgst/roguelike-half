export interface Weapon {
  name: string;
  type: 'light' | 'one-handed' | 'two-handed' | 'ranged';
  modAttack: number; // e.g. -1 for light, +1 for two-handed
  attribute: 'strike' | 'slash';
  goldCost: number;
  isMagic: boolean;
  magicChargesCurrent?: number;
  magicChargesMax?: number;
  description: string;
  fumblesCount?: number;
  tagModifiers?: Record<string, number>; // 【追加】 特定のエネミータグ（例: 'demon', 'undead'）に対する攻撃修正
  tagDamageModifiers?: Record<string, number>; // 【追加】 特定のエネミータグ（例: 'demon', 'undead'）に対するダメージ修正
}

export interface Armor {
  name: string;
  type: 'cloth' | 'leather' | 'chain' | 'plate' | 'magic';
  modLife: number; // life increase
  modDex: number;  // dexterity roll modifier
  modDef: number;  // defense roll modifier
  goldCost: number;
  isMagic?: boolean;
  description: string;
}

export interface Shield {
  name: string;
  type: 'wood' | 'round' | 'magic';
  modLife: number; // life increase
  modDefRanged: number; // ranged defense modifier
  goldCost: number;
  isMagic?: boolean;
  description: string;
}

export interface GeneralItem {
  id: string;
  name: string;
  type: 'lantern' | 'rope' | 'holywater' | 'healingpotion' | 'accessory' | 'gem_small' | 'gem_large' | 'magic_flute' | 'magic_staff' | 'magic_monocle' | 'magic_shield' | 'magic_doll' | 'clue' | 'quest';
  goldCost: number;
  chargesCurrent?: number;
  chargesMax?: number;
  charges?: number; // 【追加】 シナリオ固有アイテムの使用回数カウンター
  value: number; // Sell value, 0 if not sellable
  description: string;
}

export interface Character {
  name: string;
  level: number;
  exp: number; // level progress / allocation
  gold: number;
  food: number;
  skillMax: number;
  skillCurrent: number;
  lifeMax: number;
  lifeCurrent: number;
  subStatType: 'magic' | 'luck' | 'strength' | 'dexterity';
  subStatMax: number;
  subStatCurrent: number;
  followerMax: number;
  followerCurrent: number;
  spells: string[];
  miracles: string[];
  weapons: Weapon[];
  armors: Armor[];
  shields: Shield[];
  items: GeneralItem[];
  equippedWeapon: Weapon | null;
  equippedArmor: Armor | null;
  equippedShield: Shield | null;
  hasActiveLantern: boolean;
  statusEffects?: string[]; // 【追加】 呪い、石化、麻痺などの状態異常を保持
}

export interface Follower {
  id: string;
  name: string;
  type: 'soldier' | 'swordsman' | 'archer' | 'mage' | 'lantern' | 'swordbearer' | 'porter' | 'scout' | 'captive';
  isCombatant: boolean;
  skill: number;
  lifeMax: number; // always 1
  lifeCurrent: number; // always 1, dies if 0
  magicMax?: number;
  magicCurrent?: number;
  magicList?: string[];
  weaponAttribute: 'strike' | 'slash';
  goldCost: number;
  description: string;
  statusEffects?: string[]; // 【追加】 呪い、石化、麻痺などの状態異常を保持
}

export interface EnemyResistance {
  attribute: 'strike' | 'slash' | 'ranged' | 'magic';
  modifier: number;
  ignoreIfMagic?: boolean;
}

export interface Enemy {
  id: string;
  name: string;
  level: number;
  lifeMax: number;
  lifeCurrent: number;
  attackCount: number;
  tags: ('undead' | 'golem' | 'weak' | 'strong' | 'plant' | 'weapon' | 'structure' | 'demon')[];
  special?: string;
  count: number; // for groups of weak enemies
  isRanged?: boolean; // 【追加】 飛び道具（遠距離攻撃）を行うクリーチャーかの判定フラグ
  weaponAttribute?: 'strike' | 'slash';
  resistances?: EnemyResistance[]; // 【追加】 特定の攻撃属性（strike, slash, ranged, magic）に対する修正
  evasionRule?: string; // 【追加】 特殊回避ルール（例: 'shireen_future_sight'）
}

export interface DungeonEvent {
  title: string;
  d66Code: string;
  description: string;
  type: 'encounter' | 'trap' | 'rest' | 'treasure' | 'empty' | 'npc';
  enemies?: Omit<Enemy, 'id'>[];
  trapStat?: 'dexterity' | 'strength' | 'magic' | 'luck' | 'skill';
  trapTarget?: number;
  trapDamage?: number;
  lootModifier?: number;
  npcType?: 'merchant' | 'bribe' | 'priest' | 'mercenary' | 'captive' | 'final2_choice' | 'desert_crocodile';
  isResolved?: boolean;
  resolutionText?: string;
  statusEffect?: string; // 【追加】 罠によって受ける状態異常（例: '呪い', '石化', '麻痺'）
  customChoices?: any[]; // 【追加】 シナリオ固有の選択肢を注入するためのフィールド
}

export interface StatusEffectRule {
  description: string;
  modAttack?: number;   // 攻撃判定へのペナルティ (例: -1)
  modDefense?: number;  // 防御判定へのペナルティ (例: -1)
  modSkill?: number;    // スキル/能力値判定へのペナルティ (例: -1)
  preventsAttack?: boolean;  // 戦闘時に攻撃不可
  preventsDefense?: boolean; // 戦闘時に防御判定自動失敗
  preventsMagic?: boolean;   // 魔法・奇跡の詠唱不可
  preventsCover?: boolean;   // かばう行動不可
}

export interface Scenario {
  id: string;
  title: string;
  description: string;
  recommendedLevel: string;
  totalRoomsToClear: number;
  d66EventTable: Record<string, DungeonEvent>;
  bossEvent: DungeonEvent;
  statusEffectRules?: Record<string, StatusEffectRule>; // 【追加】 シナリオ固有の状態異常ルール定義
}

