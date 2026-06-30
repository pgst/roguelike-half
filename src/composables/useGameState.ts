import { ref, reactive, computed, watch } from 'vue';
import type { Character, Follower, Enemy, Weapon, Armor, Shield, GeneralItem, DungeonEvent, Scenario } from '../types';

// Load Scenarios
const scenarioModules = import.meta.glob<{ default: any }>('../data/scenarios/*.json', { eager: true });
const availableScenarios = computed<Scenario[]>(() => {
  const list: Scenario[] = [];
  for (const path in scenarioModules) {
    const mod = scenarioModules[path];
    const data = mod.default || mod;
    if (data && data.id) {
      list.push(data as Scenario);
    }
  }
  return list;
});

const activeScenario = ref<Scenario | null>(null);

// Central State
const currentScreen = ref<'scenario_select' | 'creator' | 'explore' | 'combat' | 'levelup' | 'gameover' | 'success'>('scenario_select');
const dungeonDepth = ref<number>(0);
const totalRoomsToClear = computed(() => activeScenario.value ? activeScenario.value.totalRoomsToClear : 8);
const logs = ref<{ id: string; text: string; type: 'info' | 'roll' | 'combat' | 'error' | 'success' | 'damage' }[]>([]);

// Dice Tray State for animation
const diceTray = reactive({
  isRolling: false,
  d1: 0,
  d2: 0,
  sides: 6,
  resultText: '',
  isCritical: false,
  isFumble: false,
});

// Initial Weapons and Items
export const DEFAULT_WEAPONS = {
  light: { name: '軽い武器 (短剣等)', type: 'light', modAttack: -1, attribute: 'strike', goldCost: 2, isMagic: false, description: '攻撃力-1。素早く扱いやすい武器。特性は打撃/斬撃から購入時に選択。' } as Weapon,
  oneHanded: { name: '片手武器 (長剣/メイス)', type: 'one-handed', modAttack: 0, attribute: 'slash', goldCost: 5, isMagic: false, description: '標準的な片手用近接武器。盾やランタンと併用可能。' } as Weapon,
  twoHanded: { name: '両手武器 (大剣/戦斧)', type: 'two-handed', modAttack: 1, attribute: 'slash', goldCost: 15, isMagic: false, description: '攻撃力+1。両手が必要なため盾やランタンは装備不可。' } as Weapon,
  sling: { name: 'スリング (投石器)', type: 'ranged', modAttack: -1, attribute: 'strike', goldCost: 3, isMagic: false, description: '射撃用の飛び道具。攻撃力-1。戦闘開始時(第0ラウンド)のみ使用可能。' } as Weapon,
  bow: { name: '弓と十分な矢', type: 'ranged', modAttack: 0, attribute: 'slash', goldCost: 18, isMagic: false, description: '射撃用の飛び道具。第0ラウンドのみ使用可能。' } as Weapon,
};

export const DEFAULT_ARMORS = {
  cloth: { name: '布鎧', type: 'cloth', modLife: 1, modDex: 1, modDef: 0, goldCost: 4, description: '生命力最大値+1、器用ロール+1。身軽に動ける防具。' } as Armor,
  leather: { name: '革鎧', type: 'leather', modLife: 2, modDex: 1, modDef: 0, goldCost: 10, description: '生命力最大値+2、器用ロール+1。静かで身軽な防具。' } as Armor,
  chain: { name: '鎖鎧', type: 'chain', modLife: 1, modDex: 0, modDef: 1, goldCost: 30, description: '生命力最大値+1、防御ロール+1。防御性能の高い防具。' } as Armor,
  plate: { name: '板金鎧', type: 'plate', modLife: 2, modDex: 0, modDef: 1, goldCost: 50, description: '生命力最大値+2、防御ロール+1。最も堅牢な金属防具。' } as Armor,
};

export const DEFAULT_SHIELDS = {
  wood: { name: '木盾', type: 'wood', modLife: 1, modDefRanged: 0, goldCost: 5, description: '生命力最大値+1。軽量な木製防盾。' } as Shield,
  round: { name: '丸盾', type: 'round', modLife: 2, modDefRanged: 0, goldCost: 15, description: '生命力最大値+2。しっかり防げる丸盾。' } as Shield,
};

export const DEFAULT_ITEMS = {
  lantern: { id: 'lantern', name: 'ランタン', type: 'lantern', goldCost: 2, value: 0, description: '暗闇を照らす。手元に明かりがない（ランタンを手に持っていない、かつランタン持ちの従者がいない）と全判定に-2の修正を受ける。使用する（手に持つ）場合は片手が塞がる。' } as Omit<GeneralItem, 'id'>,
  rope: { id: 'rope', name: 'ロープ', type: 'rope', goldCost: 3, value: 0, description: '気絶した弱い敵を【捕虜】として拘束するのに使用する。' } as Omit<GeneralItem, 'id'>,
  holywater: { id: 'holywater', name: '聖水', type: 'holywater', goldCost: 10, value: 0, description: 'アンデッドや強い敵に2ダメージ、弱い敵なら2体を一撃で倒す消耗品。' } as Omit<GeneralItem, 'id'>,
  potion: { id: 'potion', name: '治療のポーション', type: 'healingpotion', goldCost: 50, value: 0, description: '生命力を最大値まで回復する。1回の冒険で1個のみ使用可能。' } as Omit<GeneralItem, 'id'>,
};

// Initial empty Character
const character = ref<Character>({
  name: '無名の冒険者',
  level: 10,
  exp: 10,
  gold: 10,
  food: 2,
  skillMax: 0,
  skillCurrent: 0,
  lifeMax: 4,
  lifeCurrent: 4,
  subStatType: 'magic',
  subStatMax: 2,
  subStatCurrent: 2,
  followerMax: 7,
  followerCurrent: 7,
  spells: [],
  miracles: [],
  weapons: [],
  armors: [],
  shields: [],
  items: [],
  equippedWeapon: null,
  equippedArmor: null,
  equippedShield: null,
  hasActiveLantern: true,
  statusEffects: [],
});

const followers = ref<Follower[]>([]);
const activeEvent = ref<DungeonEvent | null>(null);

// Level-up stats checkpoints (to support refund/undo of allocation before finalization)
const checkpointSkillMax = ref(0);
const checkpointLifeMax = ref(0);
const checkpointSubStatMax = ref(0);
const checkpointFollowerMax = ref(0);
const checkpointExp = ref(0);
const checkpointSpells = ref<string[]>([]);
const checkpointMiracles = ref<string[]>([]);

watch(currentScreen, (newScreen) => {
  if (newScreen === 'levelup') {
    checkpointSkillMax.value = character.value.skillMax;
    checkpointLifeMax.value = character.value.lifeMax;
    checkpointSubStatMax.value = character.value.subStatMax;
    checkpointFollowerMax.value = character.value.followerMax;
    checkpointExp.value = character.value.exp;
    checkpointSpells.value = [...(character.value.spells || [])];
    checkpointMiracles.value = [...(character.value.miracles || [])];
  }
});

// Combat state
const combatState = reactive({
  active: false,
  enemies: [] as Enemy[],
  round: 0,
  log: [] as string[],
  hasQuickStrikeActive: false,
  hasCoveredInRound: false,
  pendingCover: null as {
    attackId: string;
    followerId: string;
    followerName: string;
    enemyName: string;
    enemyLevel: number;
  } | null,
  pendingPerception: null as {
    rollValue: number;
    event: any;
    hasScout: boolean;
    hasHero: boolean;
  } | null,
  pendingHolyArrow: 0, // 招天の光の矢の残り発射回数
  pendingDeflect: null as { attackId: string; defenderId: string; enemy: any } | null, // そらしの割り込み待機状態
  hasRangedFired: false,
  playerHasFiredRanged: false,
  archerHasFiredRanged: false,
  buffs: {
    defenseBonus: 0, // from Protection miracle
    damageIgnoreCount: 0, // War Doll trait
  },
  isEscaping: false,
  combatType: 'melee' as 'melee' | 'ranged_only',
  isOver: false,
  resultType: null as 'victory' | 'escaped' | 'peaceful' | null,
  lootText: null as string | null,
  lootRolled: false,
  getLootAfterVictory: true,
  hasReactionChecked: false,
  isBribeAllowed: false,
  reactionResult: null as {
    roll: number;
    text: string;
    actionType: 'hostile' | 'bribe' | 'flee' | 'neutral' | 'hospitable' | 'outnumbered_flee' | 'outnumbered_hostile';
  } | null,
  peacefulText: null as string | null,
});

// Logs Manager
function addLog(text: string, type: 'info' | 'roll' | 'combat' | 'error' | 'success' | 'damage' = 'info') {
  logs.value.push({
    id: Math.random().toString(36).substring(2, 9),
    text,
    type,
  });
}

function clearLogs() {
  logs.value = [];
}

// 1d6 Rolling with visual delays
function rollD6(isCheck: boolean = false): Promise<number> {
  return new Promise((resolve) => {
    diceTray.isRolling = true;
    diceTray.sides = 6;
    diceTray.resultText = 'ダイスを振っています...';
    diceTray.isCritical = false;
    diceTray.isFumble = false;

    setTimeout(() => {
      const roll = Math.floor(Math.random() * 6) + 1;
      diceTray.d1 = roll;
      diceTray.d2 = 0;
      diceTray.isRolling = false;
      
      if (isCheck) {
        diceTray.isCritical = roll === 6;
        diceTray.isFumble = roll === 1;
        diceTray.resultText = `出目: [ ${roll} ] ${roll === 6 ? '★クリティカル！' : roll === 1 ? '💀ファンブル！' : ''}`;
        addLog(`1d6をロール(判定): 出目 ${roll} ${roll === 6 ? '(クリティカル)' : roll === 1 ? '(ファンブル)' : ''}`, 'roll');
      } else {
        diceTray.isCritical = false;
        diceTray.isFumble = false;
        diceTray.resultText = `出目: [ ${roll} ]`;
        addLog(`1d6をロール: 出目 ${roll}`, 'roll');
      }
      resolve(roll);
    }, 700);
  });
}

// d66 Roll (11 to 66)
function rollD66(): Promise<{ d1: number; d2: number; value: number }> {
  return new Promise((resolve) => {
    diceTray.isRolling = true;
    diceTray.sides = 66;
    diceTray.resultText = 'd66ダイスを振っています...';
    diceTray.isCritical = false;
    diceTray.isFumble = false;

    setTimeout(() => {
      const d1 = Math.floor(Math.random() * 6) + 1;
      const d2 = Math.floor(Math.random() * 6) + 1;
      const value = d1 * 10 + d2;
      diceTray.d1 = d1;
      diceTray.d2 = d2;
      diceTray.isRolling = false;
      diceTray.resultText = `d66出目: 十の位 [ ${d1} ] 一の位 [ ${d2} ] = [ ${value} ]`;
      
      addLog(`d66をロール: 出目 ${d1}, ${d2} -> ${value}`, 'roll');
      resolve({ d1, d2, value });
    }, 900);
  });
}

// 1d3 Roll
async function rollD3(): Promise<number> {
  const raw = await rollD6();
  const val = Math.ceil(raw / 2);
  addLog(`1d3に変換: 1d6の出目 ${raw} -> 切り上げて ${val}`, 'roll');
  return val;
}

// Helper to count hands occupied by equipment
function getHandsUsed(weapon: Weapon | null, shield: Shield | null): number {
  let hands = 0;
  if (weapon) {
    if (weapon.type === 'two-handed') {
      hands += 2;
    } else {
      hands += 1;
    }
  }
  if (shield) {
    hands += 1;
  }
  return hands;
}

// State helpers
const carriesLantern = computed(() => {
  // 1. If any follower is a lantern bearer, we have active light
  if (followers.value.some(f => f.type === 'lantern')) {
    return true;
  }
  // 2. If the hero doesn't have a lantern in their inventory, we have no light
  const hasLanternItem = character.value.items.some(i => i.type === 'lantern');
  if (!hasLanternItem) {
    return false;
  }
  // 3. If the hero carries a lantern, they need at least 1 free hand to hold it
  const handsUsed = getHandsUsed(character.value.equippedWeapon, character.value.equippedShield);
  return handsUsed < 2;
});

const getRollModifier = computed(() => {
  if (!carriesLantern.value) {
    return -2; // Lantern penalty
  }
  return 0;
});

const currentBackpackCount = computed(() => {
  const baseItems = character.value.weapons.length + 
                     character.value.armors.length + 
                     character.value.shields.length + 
                     character.value.items.length;
  // Exclude equipped items
  let equippedCount = 0;
  if (character.value.equippedWeapon) equippedCount++;
  if (character.value.equippedArmor) equippedCount++;
  if (character.value.equippedShield) equippedCount++;

  const equipmentCount = baseItems - equippedCount;

  // Gold and Food weight rules:
  // 金貨100枚につき1スロット、食料10個につき1スロット
  const goldSlots = Math.floor(character.value.gold / 100);
  const foodSlots = Math.floor(character.value.food / 10);

  return equipmentCount + goldSlots + foodSlots;
});

const isBackpackFull = computed(() => {
  // Follower Porter gives +3 slots
  const porterBonus = followers.value.filter(f => f.type === 'porter').length * 3;
  const maxSlots = character.value.lifeMax + porterBonus;

  return currentBackpackCount.value >= maxSlots;
});

const hasSwordbearer = computed(() => followers.value.some(f => f.type === 'swordbearer'));
const isSwitchingWeapons = computed(() => {
  return combatState.round === 1 && combatState.playerHasFiredRanged && !hasSwordbearer.value;
});

// Follower purchasing logic
function buyFollower(type: Follower['type'], attrib: 'strike' | 'slash' = 'strike'): boolean {
  // Check follower slots
  const activeFollowerCount = followers.value.length;
  if (activeFollowerCount >= character.value.followerCurrent) {
    addLog('従者枠がいっぱいです。最大従者点を超えて連れていくことはできません。', 'error');
    return false;
  }

  let cost = 0;
  let followerData: Omit<Follower, 'id'>;

  switch (type) {
    case 'soldier':
      cost = 0;
      followerData = {
        name: '新米兵士',
        type: 'soldier',
        isCombatant: true,
        skill: 0,
        lifeMax: 1,
        lifeCurrent: 1,
        weaponAttribute: attrib,
        goldCost: 0,
        description: '戦闘に参加する戦う従者。技量0、生命1。無料。',
      };
      break;
    case 'swordsman':
      cost = 7;
      followerData = {
        name: '熟練剣士',
        type: 'swordsman',
        isCombatant: true,
        skill: 1,
        lifeMax: 1,
        lifeCurrent: 1,
        weaponAttribute: attrib,
        goldCost: 7,
        description: '戦闘に参加する戦う従者。技量1、生命1。金貨7枚。',
      };
      break;
    case 'archer':
      cost = 5;
      followerData = {
        name: '熟練弓兵',
        type: 'archer',
        isCombatant: true,
        skill: 0,
        lifeMax: 1,
        lifeCurrent: 1,
        weaponAttribute: 'slash',
        goldCost: 5,
        description: '戦う従者。Round 0に射撃(+1修正)。接近戦時は軽い武器で攻撃力-1。',
      };
      break;
    case 'mage':
      cost = 5;
      followerData = {
        name: '従者魔術師',
        type: 'mage',
        isCombatant: true,
        skill: 0,
        lifeMax: 1,
        lifeCurrent: 1,
        magicMax: 1,
        magicCurrent: 1,
        magicList: ['気絶'], // starting spell
        weaponAttribute: 'strike',
        goldCost: 5,
        description: '戦う従者。魔術点1。基礎魔術を1つ覚えられる。軽い武器(-1)。',
      };
      break;
    case 'lantern':
      cost = 0;
      followerData = {
        name: 'ランタン持ち従者',
        type: 'lantern',
        isCombatant: false,
        skill: 0,
        lifeMax: 1,
        lifeCurrent: 1,
        weaponAttribute: 'strike',
        goldCost: 0,
        description: '戦わない従者。明かりを提供し、主人公の片手を塞がせない。',
      };
      break;
    case 'swordbearer':
      cost = 0;
      followerData = {
        name: '太刀持ち従者',
        type: 'swordbearer',
        isCombatant: false,
        skill: 0,
        lifeMax: 1,
        lifeCurrent: 1,
        weaponAttribute: 'strike',
        goldCost: 0,
        description: '戦わない従者。弓矢の射撃後の接近戦武器への持ち替えラウンドを省略できる。',
      };
      break;
    case 'porter':
      cost = 0;
      followerData = {
        name: '荷物持ち従者',
        type: 'porter',
        isCombatant: false,
        skill: 0,
        lifeMax: 1,
        lifeCurrent: 1,
        weaponAttribute: 'strike',
        goldCost: 0,
        description: '戦わない従者。主人公の持ち物上限を+3スロット追加する。',
      };
      break;
    case 'scout':
      cost = 5;
      followerData = {
        name: '斥候従者',
        type: 'scout',
        isCombatant: false,
        skill: 0,
        lifeMax: 1,
        lifeCurrent: 1,
        weaponAttribute: 'strike',
        goldCost: 5,
        description: '戦わない従者。技量0で、主人公とは別に【察知】の器用ロールを行える。',
      };
      break;
    default:
      return false;
  }

  if (character.value.gold < cost) {
    addLog(`金貨が足りません！ (必要: ${cost}枚, 所持: ${character.value.gold}枚)`, 'error');
    return false;
  }

  character.value.gold -= cost;
  followers.value.push({
    ...followerData,
    id: Math.random().toString(36).substring(2, 9),
  });

  addLog(`${followerData.name}を雇用しました。 (金貨${cost}枚消費)`, 'success');
  if (followerData.type === 'lantern') {
    addLog('ランタン持ちを雇ったため、両手が塞がっていても周囲が照らされます！', 'success');
  }
  return true;
}

function dismissFollower(id: string) {
  const index = followers.value.findIndex(f => f.id === id);
  if (index !== -1) {
    const f = followers.value[index];
    followers.value.splice(index, 1);
    addLog(`${f.name}を解雇しました。`, 'info');

    // Check if we lost light because the lantern bearer left and hands are full
    const hasLantern = character.value.items.some(i => i.type === 'lantern');
    const handsUsed = getHandsUsed(character.value.equippedWeapon, character.value.equippedShield);
    if (f.type === 'lantern' && hasLantern && handsUsed === 2) {
      addLog('ランタン持ちがいなくなり、両手が塞がっているため暗闇状態になりました（全判定に-2の修正を受けます）。', 'error');
    }
  }
}

// Gear management
function equipWeapon(w: Weapon | null) {
  const hasLantern = character.value.items.some(i => i.type === 'lantern');
  const hasBearer = followers.value.some(f => f.type === 'lantern');
  const checkLanternLog = (handsBefore: number, handsAfter: number) => {
    if (hasLantern && !hasBearer) {
      if (handsBefore < 2 && handsAfter === 2) {
        addLog('両手が塞がったため、ランタンを手に持てず暗闇状態になりました（全判定に-2の修正を受けます）。', 'error');
      } else if (handsBefore === 2 && handsAfter < 2) {
        addLog('片手が空いたため、ランタンを手に持って周囲を照らしました。', 'success');
      }
    }
  };

  const handsBefore = getHandsUsed(character.value.equippedWeapon, character.value.equippedShield);

  if (w && character.value.equippedWeapon?.name === w.name) {
    // Unequip
    character.value.equippedWeapon = null;
    addLog(`${w.name}を装備解除しました。`, 'info');
    const handsAfter = getHandsUsed(character.value.equippedWeapon, character.value.equippedShield);
    checkLanternLog(handsBefore, handsAfter);
    return;
  }
  
  if (w) {
    // Check two-handed / lantern restriction
    if (w.type === 'two-handed') {
      if (character.value.equippedShield) {
        addLog('両手武器は盾と同時に装備できません。', 'error');
        return;
      }
    }
    character.value.equippedWeapon = w;
    addLog(`${w.name}を装備しました。`, 'success');
    const handsAfter = getHandsUsed(character.value.equippedWeapon, character.value.equippedShield);
    checkLanternLog(handsBefore, handsAfter);
  } else {
    character.value.equippedWeapon = null;
    const handsAfter = getHandsUsed(character.value.equippedWeapon, character.value.equippedShield);
    checkLanternLog(handsBefore, handsAfter);
  }
}

function equipArmor(a: Armor | null) {
  if (a && character.value.equippedArmor?.name === a.name) {
    // Unequip
    const oldArmor = character.value.equippedArmor;
    character.value.equippedArmor = null;
    if (oldArmor) {
      character.value.lifeMax = Math.max(1, character.value.lifeMax - oldArmor.modLife);
      character.value.lifeCurrent = Math.max(1, Math.min(character.value.lifeMax, character.value.lifeCurrent - oldArmor.modLife));
      addLog(`${oldArmor.name}を装備解除しました。生命力最大値 -${oldArmor.modLife}`, 'info');
    }
    return;
  }

  // Unequip existing armor first
  if (character.value.equippedArmor) {
    const oldArmor = character.value.equippedArmor;
    character.value.lifeMax = Math.max(1, character.value.lifeMax - oldArmor.modLife);
    character.value.lifeCurrent = Math.max(1, Math.min(character.value.lifeMax, character.value.lifeCurrent - oldArmor.modLife));
  }

  if (a) {
    character.value.equippedArmor = a;
    character.value.lifeMax += a.modLife;
    character.value.lifeCurrent += a.modLife;
    addLog(`${a.name}を装備しました。生命力最大値 +${a.modLife}`, 'success');
  } else {
    character.value.equippedArmor = null;
  }
}

function equipShield(s: Shield | null) {
  const hasLantern = character.value.items.some(i => i.type === 'lantern');
  const hasBearer = followers.value.some(f => f.type === 'lantern');
  const checkLanternLog = (handsBefore: number, handsAfter: number) => {
    if (hasLantern && !hasBearer) {
      if (handsBefore < 2 && handsAfter === 2) {
        addLog('両手が塞がったため、ランタンを手に持てず暗闇状態になりました（全判定に-2の修正を受けます）。', 'error');
      } else if (handsBefore === 2 && handsAfter < 2) {
        addLog('片手が空いたため、ランタンを手に持って周囲を照らしました。', 'success');
      }
    }
  };

  const handsBefore = getHandsUsed(character.value.equippedWeapon, character.value.equippedShield);

  if (s && character.value.equippedShield?.name === s.name) {
    // Unequip
    const oldShield = character.value.equippedShield;
    character.value.equippedShield = null;
    if (oldShield) {
      character.value.lifeMax = Math.max(1, character.value.lifeMax - oldShield.modLife);
      character.value.lifeCurrent = Math.max(1, Math.min(character.value.lifeMax, character.value.lifeCurrent - oldShield.modLife));
      addLog(`${oldShield.name}を装備解除しました。生命力最大値 -${oldShield.modLife}`, 'info');
    }
    const handsAfter = getHandsUsed(character.value.equippedWeapon, character.value.equippedShield);
    checkLanternLog(handsBefore, handsAfter);
    return;
  }

  // Unequip existing shield first
  if (character.value.equippedShield) {
    const oldShield = character.value.equippedShield;
    character.value.lifeMax = Math.max(1, character.value.lifeMax - oldShield.modLife);
    character.value.lifeCurrent = Math.max(1, Math.min(character.value.lifeMax, character.value.lifeCurrent - oldShield.modLife));
  }

  if (s) {
    if (character.value.equippedWeapon?.type === 'two-handed') {
      addLog('両手武器を装備しているため盾を装備できません。', 'error');
      return;
    }
    character.value.equippedShield = s;
    character.value.lifeMax += s.modLife;
    character.value.lifeCurrent += s.modLife;
    addLog(`${s.name}を装備しました。生命力最大値 +${s.modLife}`, 'success');
    const handsAfter = getHandsUsed(character.value.equippedWeapon, character.value.equippedShield);
    checkLanternLog(handsBefore, handsAfter);
  } else {
    character.value.equippedShield = null;
    const handsAfter = getHandsUsed(character.value.equippedWeapon, character.value.equippedShield);
    checkLanternLog(handsBefore, handsAfter);
  }
}

// Items selling
function sellItem(itemId: string) {
  if (currentScreen.value !== 'levelup') {
    addLog('売却は街（冒険の合間）でしか行えません。', 'error');
    return;
  }
  const index = character.value.items.findIndex(i => i.id === itemId);
  if (index !== -1) {
    const item = character.value.items[index];
    if (item.value > 0) {
      character.value.gold += item.value;
      character.value.items.splice(index, 1);
      addLog(`${item.name}を金貨${item.value}枚で売却しました。`, 'success');
    } else {
      addLog(`${item.name}は売却できません。`, 'error');
    }
  }
}

// Consumption functions
function useFood(useHolyFeast = false) {
  if (character.value.food <= 0) {
    addLog('食料がありません！', 'error');
    return;
  }
  if (combatState.active) {
    addLog('戦闘中に食料を食べることはできません。', 'error');
    return;
  }
  if (character.value.lifeCurrent >= character.value.lifeMax) {
    addLog('生命力はすでに満タンです。', 'error');
    return;
  }

  character.value.food--;
  let heal = 2;
  
  if (useHolyFeast) {
    character.value.subStatCurrent = Math.max(0, character.value.subStatCurrent - 1);
    heal = 3;
    addLog('✨ 奇跡【聖餐】を発動！ 幸運点1を消費し、食料の回復量が3になりました。', 'success');
  }

  character.value.lifeCurrent = Math.min(character.value.lifeMax, character.value.lifeCurrent + heal);
  addLog(`食料を食べました。生命力が${heal}回復。 (残り食料: ${character.value.food}個)`, 'success');
}

let potionUsedThisAdventure = false;
function useHealingPotion() {
  const idx = character.value.items.findIndex(i => i.type === 'healingpotion');
  if (idx === -1) {
    addLog('治療のポーションを所持していません。', 'error');
    return;
  }
  if (potionUsedThisAdventure) {
    addLog('治療のポーションは一度の冒険で1回しか使用できません。', 'error');
    return;
  }

  character.value.items.splice(idx, 1);
  character.value.lifeCurrent = character.value.lifeMax;
  potionUsedThisAdventure = true;
  addLog('治療のポーションを飲みました。生命力が最大値まで全回復！', 'success');
}

function castCreateWeaponSpell(category: 'weapon' | 'armor' | 'shield', itemKey: string) {
  if (character.value.subStatCurrent < 1) {
    addLog('魔術点が足りないため、呪文を唱えられません！', 'error');
    return;
  }
  
  character.value.subStatCurrent--;
  
  if (category === 'weapon') {
    const base = DEFAULT_WEAPONS[itemKey as keyof typeof DEFAULT_WEAPONS];
    if (!base) return;
    const summon: Weapon = {
      ...base,
      name: `創られた${base.name}`,
      isMagic: true,
      description: `【武具創造】によって生み出された魔法の武具。冒険終了後に消滅する。`
    };
    character.value.weapons.push(summon);
    addLog(`✨ 呪文【武具創造】を唱え、「${summon.name}」を背負い袋に創造しました！`, 'success');
  } else if (category === 'armor') {
    const base = DEFAULT_ARMORS[itemKey as keyof typeof DEFAULT_ARMORS];
    if (!base) return;
    const summon: Armor = {
      ...base,
      name: `創られた${base.name}`,
      isMagic: true,
      description: `【武具創造】によって生み出された魔法の防具。冒険終了後に消滅する。`
    };
    character.value.armors.push(summon);
    addLog(`✨ 呪文【武具創造】を唱え、「${summon.name}」を背負い袋に創造しました！`, 'success');
  } else if (category === 'shield') {
    const base = DEFAULT_SHIELDS[itemKey as keyof typeof DEFAULT_SHIELDS];
    if (!base) return;
    const summon: Shield = {
      ...base,
      name: `創られた${base.name}`,
      isMagic: true,
      description: `【武具創造】によって生み出された魔法の盾。冒険終了後に消滅する。`
    };
    character.value.shields.push(summon);
    addLog(`✨ 呪文【武具創造】を唱え、「${summon.name}」を背負い袋に創造しました！`, 'success');
  }
}

// Dungeon completion stats restore
function restoreStatsAfterAdventure() {
  // Unequip magic items first to safely adjust stats
  if (character.value.equippedWeapon?.isMagic) {
    character.value.equippedWeapon = null;
  }
  if (character.value.equippedArmor?.isMagic) {
    const oldArmor = character.value.equippedArmor;
    character.value.equippedArmor = null;
    character.value.lifeMax = Math.max(1, character.value.lifeMax - oldArmor.modLife);
  }
  if (character.value.equippedShield?.isMagic) {
    const oldShield = character.value.equippedShield;
    character.value.equippedShield = null;
    character.value.lifeMax = Math.max(1, character.value.lifeMax - oldShield.modLife);
  }

  // Remove magic items from inventory lists
  character.value.weapons = character.value.weapons.filter(w => !w.isMagic);
  character.value.armors = character.value.armors.filter(a => !a.isMagic);
  character.value.shields = character.value.shields.filter(s => !s.isMagic);

  character.value.skillCurrent = character.value.skillMax;
  character.value.lifeCurrent = character.value.lifeMax;
  character.value.subStatCurrent = character.value.subStatMax;
  potionUsedThisAdventure = false;
  // Restore follower mages' mana
  followers.value.forEach(f => {
    if (f.type === 'mage' && f.magicCurrent !== undefined && f.magicMax !== undefined) {
      f.magicCurrent = f.magicMax;
    }
  });
}

// Growth stats allocation
function spendExpForStat(stat: 'skill' | 'life' | 'sub' | 'follower'): boolean {
  if (character.value.exp <= 0) {
    addLog('経験点が足りません。', 'error');
    return false;
  }

  if (stat === 'skill') {
    // 4 exp per skill max. Limit is +2 from base (base 0, max 2)
    if (character.value.skillMax >= 2) {
      addLog('技量点の上限(+2)に達しています。', 'error');
      return false;
    }
    if (character.value.exp < 4) {
      addLog('技量点を上げるには4経験点必要です。', 'error');
      return false;
    }
    character.value.exp -= 4;
    character.value.skillMax += 1;
    character.value.skillCurrent = character.value.skillMax;
    addLog('技量点が1上昇しました！', 'success');
    return true;
  }

  if (stat === 'life') {
    // 1 exp per life max. Limit is +4 from base (base 4, max 8)
    if (character.value.lifeMax >= 8) {
      addLog('生命力の上限(+4)に達しています。', 'error');
      return false;
    }
    character.value.exp -= 1;
    character.value.lifeMax += 1;
    character.value.lifeCurrent = character.value.lifeMax;
    addLog('生命力最大値が1上昇しました！', 'success');
    return true;
  }

  if (stat === 'sub') {
    // 1 exp per subStat max. Limit is +4 from base (base 2, max 6)
    if (character.value.subStatMax >= 6) {
      addLog('副能力値の上限(+4)に達しています。', 'error');
      return false;
    }
    character.value.exp -= 1;
    character.value.subStatMax += 1;
    character.value.subStatCurrent = character.value.subStatMax;
    addLog('副能力値の最大値が1上昇しました！', 'success');
    return true;
  }

  if (stat === 'follower') {
    // 2 exp per follower max. Limit is +2 from base (base 7, max 9)
    if (character.value.followerMax >= 9) {
      addLog('従者点の上限(+2)に達しています。', 'error');
      return false;
    }
    if (character.value.exp < 2) {
      addLog('従者点を上げるには2経験点必要です。', 'error');
      return false;
    }
    character.value.exp -= 2;
    character.value.followerMax += 1;
    character.value.followerCurrent = character.value.followerMax;
    addLog('従者点の最大値が1上昇しました！', 'success');
    return true;
  }

  return false;
}

// Refund/Undo allocated EXP
function refundExpForStat(stat: 'skill' | 'life' | 'sub' | 'follower'): boolean {
  if (stat === 'skill') {
    if (character.value.skillMax <= checkpointSkillMax.value) {
      addLog('この画面で上昇させた値より下げることはできません。', 'error');
      return false;
    }
    character.value.skillMax -= 1;
    character.value.skillCurrent = character.value.skillMax;
    character.value.exp += 4;
    addLog('技量点の割り振りをキャンセルし、4経験点を払い戻しました。', 'info');
    return true;
  }

  if (stat === 'life') {
    if (character.value.lifeMax <= checkpointLifeMax.value) {
      addLog('この画面で上昇させた値より下げることはできません。', 'error');
      return false;
    }
    character.value.lifeMax -= 1;
    character.value.lifeCurrent = character.value.lifeMax;
    character.value.exp += 1;
    addLog('生命力最大値の割り振りをキャンセルし、1経験点を払い戻しました。', 'info');
    return true;
  }

  if (stat === 'sub') {
    if (character.value.subStatMax <= checkpointSubStatMax.value) {
      addLog('この画面で上昇させた値より下げることはできません。', 'error');
      return false;
    }
    
    // Check if we need to remove learned spells/miracles to fit the new allowed limit
    const allowed = Math.floor((character.value.subStatMax - 1) / 2);
    if (character.value.subStatType === 'magic') {
      while (character.value.spells.length > allowed) {
        const removed = character.value.spells.pop();
        addLog(`制限数超過のため、魔術 【${removed}】 の習得を取り消しました。`, 'info');
      }
    } else if (character.value.subStatType === 'luck') {
      while (character.value.miracles.length > allowed) {
        const removed = character.value.miracles.pop();
        addLog(`制限数超過のため、奇跡 【${removed}】 の習得を取り消しました。`, 'info');
      }
    }

    character.value.subStatMax -= 1;
    character.value.subStatCurrent = character.value.subStatMax;
    character.value.exp += 1;
    addLog('副能力値の最大値の割り振りをキャンセルし、1経験点を払い戻しました。', 'info');
    return true;
  }

  if (stat === 'follower') {
    if (character.value.followerMax <= checkpointFollowerMax.value) {
      addLog('この画面で上昇させた値より下げることはできません。', 'error');
      return false;
    }
    character.value.followerMax -= 1;
    character.value.followerCurrent = character.value.followerMax;
    character.value.exp += 2;
    addLog('従者点(最大同行可能数)の割り振りをキャンセルし、2経験点を払い戻しました。', 'info');
    return true;
  }

  return false;
}

// Game lifecycle
function initNewCharacter(name: string, subStat: Character['subStatType']) {
  character.value = {
    name: name || '無名の冒険者',
    level: 10,
    exp: 10, // Starting Exp
    gold: 10,
    food: 2,
    skillMax: 0,
    skillCurrent: 0,
    lifeMax: 4,
    lifeCurrent: 4,
    subStatType: subStat,
    subStatMax: 2,
    subStatCurrent: 2,
    followerMax: 7,
    followerCurrent: 7,
    spells: [],
    miracles: [],
    weapons: [],
    armors: [],
    shields: [],
    items: [],
    equippedWeapon: null,
    equippedArmor: null,
    equippedShield: null,
    hasActiveLantern: true,
    statusEffects: [],
  };

  followers.value = [];
  dungeonDepth.value = 0;
  clearLogs();
  
  // Set default initial equipment based on sub-stat
  if (subStat === 'magic') {
    character.value.weapons.push({ ...DEFAULT_WEAPONS.light });
    character.value.armors.push({ ...DEFAULT_ARMORS.cloth });
    character.value.equippedWeapon = character.value.weapons[0];
    character.value.equippedArmor = character.value.armors[0];
    character.value.spells = []; // レベルアップ画面で習得するため、初期は空
  } else if (subStat === 'luck') {
    character.value.weapons.push({ ...DEFAULT_WEAPONS.oneHanded });
    character.value.armors.push({ ...DEFAULT_ARMORS.chain });
    character.value.shields.push({ ...DEFAULT_SHIELDS.wood });
    character.value.equippedWeapon = character.value.weapons[0];
    character.value.equippedArmor = character.value.armors[0];
    character.value.equippedShield = character.value.shields[0];
    character.value.miracles = []; // レベルアップ画面で習得するため、初期は空
  } else if (subStat === 'strength') {
    character.value.weapons.push({ ...DEFAULT_WEAPONS.twoHanded });
    character.value.armors.push({ ...DEFAULT_ARMORS.plate });
    character.value.equippedWeapon = character.value.weapons[0];
    character.value.equippedArmor = character.value.armors[0];
  } else if (subStat === 'dexterity') {
    character.value.weapons.push({ ...DEFAULT_WEAPONS.bow });
    character.value.weapons.push({ ...DEFAULT_WEAPONS.light });
    character.value.armors.push({ ...DEFAULT_ARMORS.leather });
    character.value.equippedWeapon = character.value.weapons[0];
    character.value.equippedArmor = character.value.armors[0];
  }

  // Everyone gets a lantern
  character.value.items.push({
    id: Math.random().toString(36).substring(2, 9),
    ...DEFAULT_ITEMS.lantern,
  });

  // Rule 30: Adjust lifeMax and lifeCurrent based on equipped armor and shield at start
  if (character.value.equippedArmor) {
    character.value.lifeMax += character.value.equippedArmor.modLife;
  }
  if (character.value.equippedShield) {
    character.value.lifeMax += character.value.equippedShield.modLife;
  }
  character.value.lifeCurrent = character.value.lifeMax;

  addLog(`キャラクター「${character.value.name}」を作成しました！ 初期経験点10点を割り振ってください。`, 'success');
  currentScreen.value = 'levelup';
}

function handleDeath() {
  addLog('💀 主人公の生命点が0になりました。ゲームオーバーです...', 'error');
  currentScreen.value = 'gameover';
}

function forgetSpell(name: string) {
  if (character.value.subStatType === 'magic') {
    if (checkpointSpells.value.includes(name)) {
      addLog(`既に以前から習得している魔術 【${name}】 は忘れられません。`, 'error');
      return false;
    }
    const idx = character.value.spells.indexOf(name);
    if (idx !== -1) {
      character.value.spells.splice(idx, 1);
      addLog(`🔮 魔術 【${name}】 を忘れました。`, 'info');
      return true;
    }
  } else if (character.value.subStatType === 'luck') {
    if (checkpointMiracles.value.includes(name)) {
      addLog(`既に以前から習得している奇跡 【${name}】 は忘れられません。`, 'error');
      return false;
    }
    const idx = character.value.miracles.indexOf(name);
    if (idx !== -1) {
      character.value.miracles.splice(idx, 1);
      addLog(`✨ 奇跡 【${name}】 を忘れました。`, 'info');
      return true;
    }
  }
  return false;
}

function clearDiceTray() {
  diceTray.d1 = 0;
  diceTray.d2 = 0;
  diceTray.isRolling = false;
  diceTray.resultText = '';
  diceTray.isCritical = false;
  diceTray.isFumble = false;
}

export function useGameState() {
  return {
    // State
    currentScreen,
    character,
    followers,
    activeEvent,
    dungeonDepth,
    totalRoomsToClear,
    logs,
    diceTray,
    combatState,
    availableScenarios,
    activeScenario,

    // Computed
    carriesLantern,
    getRollModifier,
    isBackpackFull,
    currentBackpackCount,
    hasSwordbearer,
    isSwitchingWeapons,
    checkpointSkillMax,
    checkpointLifeMax,
    checkpointSubStatMax,
    checkpointFollowerMax,
    checkpointSpells,
    checkpointMiracles,

    // Utility functions
    addLog,
    clearLogs,
    rollD6,
    rollD3,
    rollD66,

    // Follower actions
    buyFollower,
    dismissFollower,

    // Equipment actions
    equipWeapon,
    equipArmor,
    equipShield,
    sellItem,

    // Consumption / Restore
    useFood,
    useHealingPotion,
    restoreStatsAfterAdventure,
    spendExpForStat,
    refundExpForStat,

    // Lifecycle
    initNewCharacter,
    handleDeath,
    clearDiceTray,
    forgetSpell,
    castCreateWeaponSpell,
  };
}
