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
}

export interface Armor {
  name: string;
  type: 'cloth' | 'leather' | 'chain' | 'plate' | 'magic';
  modLife: number; // life increase
  modDex: number;  // dexterity roll modifier
  modDef: number;  // defense roll modifier
  goldCost: number;
  description: string;
}

export interface Shield {
  name: string;
  type: 'wood' | 'round' | 'magic';
  modLife: number; // life increase
  modDefRanged: number; // ranged defense modifier
  goldCost: number;
  description: string;
}

export interface GeneralItem {
  id: string;
  name: string;
  type: 'lantern' | 'rope' | 'holywater' | 'healingpotion' | 'accessory' | 'gem_small' | 'gem_large' | 'magic_flute' | 'magic_staff' | 'magic_monocle' | 'magic_shield' | 'magic_doll' | 'clue';
  goldCost: number;
  chargesCurrent?: number;
  chargesMax?: number;
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
}

export interface Enemy {
  id: string;
  name: string;
  level: number;
  lifeMax: number;
  lifeCurrent: number;
  attackCount: number;
  tags: ('undead' | 'golem' | 'weak' | 'strong' | 'plant' | 'weapon' | 'structure')[];
  special?: string;
  count: number; // for groups of weak enemies
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
  npcType?: 'merchant' | 'bribe' | 'priest' | 'mercenary' | 'captive';
  isResolved?: boolean;
  resolutionText?: string;
}

export interface Scenario {
  id: string;
  title: string;
  description: string;
  difficulty: string;
  totalRoomsToClear: number;
  d66EventTable: Record<string, DungeonEvent>;
  bossEvent: DungeonEvent;
}

