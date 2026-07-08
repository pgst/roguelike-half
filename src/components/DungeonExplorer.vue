<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useGameState } from '../composables/useGameState';
import { useDungeon } from '../composables/useDungeon';
import { useCombat } from '../composables/useCombat';
import { DEFAULT_ITEMS, DEFAULT_WEAPONS, DEFAULT_SHIELDS, DEFAULT_ARMORS } from '../composables/useGameState';
import type { Weapon, Armor, Shield, GeneralItem } from '../types';

const {
  character,
  followers,
  activeEvent,
  dungeonDepth,
  totalRoomsToClear,
  addLog,
  currentScreen,
  logs,
  combatState,
  clearDiceTray,
  diceTray,
  activeScenario,
  nextRoomTensDigitOverride,
  rollD6,
  pyramidRunCount,
  handleDeath,
  carriesLantern,
  playerActiveStatusEffectRules,
  isBackpackFull,
  isBackpackOverLimit,
  equipArmor
} = useGameState();

const { 
  exploreNextRoom, 
  resolveTrapCheck, 
  confirmPerceptionSkip, 
  executePerceptionScout, 
  executePerceptionHero,
  startEncounter,
  resolveTrapDamageTarget
} = useDungeon();
const { resolveLoot } = useCombat();

const showMerchant = ref(false);

// Pyramid of Chronodemon Scenario Custom State & Logic
const final1Step = ref<number>(1);

function addStoryLogs(text: string) {
  const paragraphs = text.split('\n');
  paragraphs.forEach(p => {
    if (p.trim()) {
      addLog(p.trim(), 'info');
    }
  });
}

function choosePyramidOrigin(origin: 'polomeia' | 'almaciuda') {
  (character.value as any).pyramidOriginChosen = true;
  (character.value as any).pyramidOrigin = origin;

  const scenarioData = activeScenario.value;
  if (scenarioData && (scenarioData as any).prologues) {
    const prologue = (scenarioData as any).prologues["1"]?.[origin];
    if (prologue) {
      addStoryLogs(prologue.text);
    }
  }

  if (origin === 'polomeia') {
    character.value.items.push({
      id: 'golden_brooch',
      name: '黄金虫のブローチ',
      type: 'accessory',
      goldCost: 0,
      description: 'これを身につけていると、副能力値が【器用点】でなくても『察知』を行うことができる。副能力値が【器用点】の場合は、判定ロールに＋１の修正を加えることができる。２回の使用で、ブローチにはヒビが入り効果を失う。また冒険が終わったとき残っていたら、王に返却すること。',
      value: 0,
      charges: 2
    } as any);
  }

  // Mark run 1 prep completed
  (character.value as any).pyramidPrepRun = 1;
  (character.value as any).pyramidSliderShopDone = true;
}

function startPyramidPrep() {
  const run = pyramidRunCount.value;
  const origin = (character.value as any).pyramidOrigin || 'polomeia';
  const scenarioData = activeScenario.value;
  if (!scenarioData || !(scenarioData as any).prologues) return;

  let storyText = '';
  if (run === 1) {
    storyText = (scenarioData as any).prologues["1"]?.[origin]?.text || '';
  } else if (run === 2) {
    storyText = (scenarioData as any).prologues["2"]?.[origin]?.text || '';
  } else if (run === 3) {
    const commonText = (scenarioData as any).prologues["3"]?.common?.text || '';
    const uniqueText = (scenarioData as any).prologues["3"]?.[origin]?.text || '';
    storyText = commonText + '\n\n' + uniqueText;
  }

  if (storyText) {
    addStoryLogs(storyText);
  }

  // Items distribution for Run 3
  if (run === 3) {
    const rewardKey = origin === 'polomeia' ? 'rewardItemsPolomeia' : 'rewardItemsAlmaciuda';
    const rewards = (scenarioData as any).prologues["3"]?.common?.[rewardKey];
    if (rewards) {
      rewards.forEach((r: any) => {
        if (r.type === 'one-handed') {
          if (!character.value.weapons.some(w => w.name === r.name)) {
            character.value.weapons.push({ ...r });
            addLog(`⚔️ 支給品 『${r.name}』 を受け取りました！`, 'success');
          }
        } else {
          if (!character.value.items.some(i => i.id === r.id)) {
            character.value.items.push({ ...r });
            addLog(`🎒 支給品 『${r.name}』 を受け取りました！`, 'success');
          }
        }
      });
    }
  }

  (character.value as any).pyramidPrepRun = run;

  if (run === 3) {
    (character.value as any).pyramidSliderShopDone = false;
  } else {
    (character.value as any).pyramidSliderShopDone = true;
  }
}

const sliderRecipes = computed(() => {
  if (activeScenario.value?.id === 'pyramid_of_chronodemon') {
    return (activeScenario.value as any).sliderShop?.recipes || [];
  }
  return [];
});

function hasMaterial(itemName: string): boolean {
  return character.value.items.some(i => i.name === itemName);
}

function canForge(recipe: any): boolean {
  if (!hasMaterial(recipe.requiredItem)) return false;
  if (character.value.gold < recipe.goldCost) return false;
  return true;
}

function forgeItem(recipe: any) {
  if (!canForge(recipe)) return;

  character.value.gold -= recipe.goldCost;

  const matIdx = character.value.items.findIndex(i => i.name === recipe.requiredItem);
  if (matIdx !== -1) {
    character.value.items.splice(matIdx, 1);
  }

  const res = recipe.result;
  if (recipe.type === 'weapon') {
    character.value.weapons.push({ ...res });
  } else if (recipe.type === 'shield') {
    character.value.shields.push({ ...res });
  } else {
    character.value.items.push({
      id: Math.random().toString(36).substring(2, 9),
      ...res,
      charges: recipe.type === 'arrow' ? 1 : undefined
    });
  }
  addLog(`🔨 『${recipe.requiredItem}』を加工して『${res.name}』を製作しました！ (金貨 ${recipe.goldCost} 枚消費)`, 'success');
}

function finishSliderShop() {
  (character.value as any).pyramidSliderShopDone = true;
  addLog('🚪 スライダー商会での準備を終え、ピラミッドの探索を開始します！', 'success');
}

function completePyramidRun() {
  if (activeEvent.value?.d66Code === 'Final1') {
    pyramidRunCount.value = 2;
  } else if (activeEvent.value?.d66Code === 'Final2') {
    pyramidRunCount.value = 3;
  }
  
  dungeonDepth.value = 0;
  activeEvent.value = null;
  currentScreen.value = 'levelup';
  addLog(`🧭 冒険を終え、無事に砂漠の迷宮から帰還しました！ (次の周回: ${pyramidRunCount.value}回目 / 3)`, 'success');
}

async function rollFinal1Trap() {
  if (!activeEvent.value) return;
  const step = final1Step.value;
  const target = step === 3 ? 4 : 3;
  
  addLog(`🏃 崩落する床の器用判定ロール (目標値: ${target}, 現在回数: ${step}/3)`, 'info');
  const roll = await rollD6(true);
  const total = roll + character.value.skillCurrent;
  
  const success = roll === 6 || (roll !== 1 && total >= target);
  
  if (success) {
    addLog(`✨ ${step}回目の跳躍成功！ (ロール計: ${roll === 6 ? 'クリティカル' : total} >= ${target})`, 'success');
  } else {
    character.value.lifeCurrent = Math.max(0, character.value.lifeCurrent - 1);
    addLog(`😢 ${step}回目の跳躍失敗... 足元の床が崩れ落ち、生命力に1点のダメージ！ (生命力残り: ${character.value.lifeCurrent})`, 'error');
    if (character.value.lifeCurrent <= 0) {
      handleDeath();
      return;
    }
  }
  
  if (step < 3) {
    final1Step.value++;
  } else {
    const scenarioData = activeScenario.value;
    const origin = (character.value as any).pyramidOrigin || 'polomeia';
    const epilogue = (scenarioData as any)?.epilogues?.["1"]?.[origin];

    let goldReward = 20;
    if (epilogue && epilogue.goldBase && epilogue.goldDiceCount) {
      goldReward = epilogue.goldBase;
      const rolls = [];
      for (let i = 0; i < epilogue.goldDiceCount; i++) {
        const d = Math.floor(Math.random() * 6) + 1;
        rolls.push(d);
        goldReward += d;
      }
      addLog(`🎲 金貨ロール (3d6: ${rolls.join('+')})`, 'roll');
    }

    character.value.gold += goldReward;
    character.value.exp += epilogue?.exp || 1;
    character.value.items.push({
      name: 'プラチナコイン',
      type: 'gem_large',
      goldCost: 0,
      description: '異端者シーリーンや悪魔と取引するためのプラチナの硬貨。価値はないが極めて貴重。',
      value: 0
    } as any);

    if (epilogue) {
      addStoryLogs(epilogue.text);
    }

    const rText = `🎉 無事に崩落する床を渡りきりました！\n金貨 ${goldReward} 枚、1 Exp、そしてプラチナコインを獲得し、次の冒険の準備へ向かいます。`;
    (activeEvent.value as any).isResolved = true;
    (activeEvent.value as any).resolutionText = rText;
    addLog(rText, 'success');
  }
}

function startFinal2Fight(choice: 'golem' | 'shireen') {
  if (!activeEvent.value) return;
  if (choice === 'golem') {
    activeEvent.value.enemies = [
      { name: "至高のヘラクレオス", level: 5, lifeMax: 12, lifeCurrent: 12, attackCount: 1, tags: ["golem", "strong"], count: 1 }
    ];
  } else {
    activeEvent.value.enemies = [
      { name: "異端者シーリーン", level: 5, lifeMax: 5, lifeCurrent: 5, attackCount: 3, tags: ["strong"], count: 1 }
    ];
  }
  startEncounter();
}

async function bribeCrocodile(type: 'food' | 'follower') {
  if (!activeEvent.value) return;
  if (type === 'food') {
    character.value.food = Math.max(0, character.value.food - 2);
    addLog('💸 食料2食分をワイロとして投げ与えました。', 'info');
  } else {
    const fIdx = followers.value.findIndex(f => f.goldCost <= 10);
    if (fIdx !== -1) {
      const lostFollower = followers.value[fIdx];
      followers.value.splice(fIdx, 1);
      addLog(`💸 従者 ${lostFollower.name} をおとりとして砂漠ワニに差し出しました。`, 'info');
    }
  }
  
  addLog('🐊 砂漠ワニの反応判定ロール (1d6を振り、1-3で成功/戦闘回避、4-6で失敗/戦闘突入)', 'info');
  const roll = await rollD6(true);
  if (roll <= 3) {
    const rText = `🐊 砂漠ワニは差し出されたエサに夢中になっています！ その隙に安全に脇を通り抜けました。`;
    (activeEvent.value as any).isResolved = true;
    (activeEvent.value as any).resolutionText = rText;
    addLog(rText, 'success');
  } else {
    addLog('🐊 ロール失敗！ 砂漠ワニはエサだけでは満足せず、こちらに襲いかかってきました！', 'error');
    startCrocodileFight();
  }
}

function startCrocodileFight() {
  if (!activeEvent.value) return;
  activeEvent.value.enemies = [
    { name: "砂漠ワニ", level: 4, lifeMax: 9, lifeCurrent: 9, attackCount: 1, tags: ["weak"], count: 1, weaponAttribute: "slash" }
  ];
  activeEvent.value.type = 'encounter';
  startEncounter();
}

function payBribeLocal() {
  if (!activeEvent.value) return;
  if (character.value.gold < 5) {
    addLog('金貨が足りません！', 'error');
    return;
  }
  character.value.gold -= 5;
  addLog('ゴブリンの交渉人に金貨5枚のワイロを支払いました。', 'success');
  (activeEvent.value as any).isResolved = true;
  (activeEvent.value as any).resolutionText = '🪙 ゴブリンの交渉人に金貨5枚のワイロを支払い、穏便に道を通して（見逃して）もらいました。';
}

const depthText = computed(() => {
  if (dungeonDepth.value >= totalRoomsToClear.value) {
    return '最深部 (Boss Room)';
  }
  return `第 ${dungeonDepth.value + 1} の部屋 / 全 ${totalRoomsToClear.value} 部屋`;
});

// Merchant items list
const merchantGoods = {
  weapons: [
    { ...DEFAULT_WEAPONS.light },
    { ...DEFAULT_WEAPONS.oneHanded },
    { ...DEFAULT_WEAPONS.twoHanded },
    { ...DEFAULT_WEAPONS.sling },
    { ...DEFAULT_WEAPONS.bow }
  ] as Weapon[],
  armors: [
    { ...DEFAULT_ARMORS.cloth },
    { ...DEFAULT_ARMORS.leather },
    { ...DEFAULT_ARMORS.chain },
    { ...DEFAULT_ARMORS.plate }
  ] as Armor[],
  shields: [
    { ...DEFAULT_SHIELDS.wood },
    { ...DEFAULT_SHIELDS.round }
  ] as Shield[],
  items: [
    { ...DEFAULT_ITEMS.lantern, value: 0 },
    { ...DEFAULT_ITEMS.rope, value: 0 },
    { ...DEFAULT_ITEMS.holywater, value: 0 },
    { ...DEFAULT_ITEMS.potion, value: 0 }
  ] as Omit<GeneralItem, 'id'>[]
};

// Hireable followers list
const hireableFollowers = [
  { type: 'soldier', name: '兵士', cost: 0, desc: '戦闘要員。技量0、生命1。無料。' },
  { type: 'swordsman', name: '剣士', cost: 7, desc: '戦闘要員。技量1、生命1。金貨7枚。' },
  { type: 'archer', name: '弓兵', cost: 5, desc: '戦闘要員。第0R射撃。金貨5枚。' },
  { type: 'mage', name: '魔術師', cost: 5, desc: '戦闘要員。魔術1。金貨5枚。' },
  { type: 'scout', name: '斥候', cost: 5, desc: '非戦闘。察知可能。金貨5枚。' },
  { type: 'lantern', name: 'ランタン持ち', cost: 0, desc: '非戦闘。明かり提供。無料。' },
  { type: 'swordbearer', name: '太刀持ち', cost: 0, desc: '非戦闘。武器即時持替。無料。' },
  { type: 'porter', name: '荷物持ち', cost: 0, desc: '非戦闘。バッグ拡張。無料。' },
];

function buyWeaponFromMerchant(w: Weapon) {
  if (isBackpackFull.value) {
    addLog('🎒 背負い袋が満杯のため、これ以上アイテムを購入できません！', 'error');
    return;
  }
  if (character.value.gold < w.goldCost) {
    addLog('金貨が足りません！', 'error');
    return;
  }
  character.value.gold -= w.goldCost;
  character.value.weapons.push({ ...w });
  addLog(`行商人から [${w.name}] を購入しました。(金貨${w.goldCost}枚消費)`, 'success');
}

function buyArmorFromMerchant(a: Armor) {
  if (character.value.gold < a.goldCost) {
    addLog('金貨が足りません！', 'error');
    return;
  }
  
  if (character.value.armors.length >= 1) {
    const oldArmor = character.value.armors[0];
    if (character.value.equippedArmor?.name === oldArmor.name) {
      equipArmor(null);
    }
    character.value.armors = [];
    addLog(`古い防具 [${oldArmor.name}] を処分しました。`, 'info');
  }

  character.value.gold -= a.goldCost;
  character.value.armors.push({ ...a });
  addLog(`行商人から [${a.name}] を購入しました。(金貨${a.goldCost}枚消費)`, 'success');
  equipArmor(character.value.armors[0]);
}

function buyShieldFromMerchant(s: Shield) {
  if (isBackpackFull.value) {
    addLog('🎒 背負い袋が満杯のため、これ以上アイテムを購入できません！', 'error');
    return;
  }
  if (character.value.gold < s.goldCost) {
    addLog('金貨が足りません！', 'error');
    return;
  }
  character.value.gold -= s.goldCost;
  character.value.shields.push({ ...s });
  addLog(`行商人から [${s.name}] を購入しました。(金貨${s.goldCost}枚消費)`, 'success');
}

function buyItemFromMerchant(item: Omit<GeneralItem, 'id'>) {
  if (isBackpackFull.value) {
    addLog('🎒 背負い袋が満杯のため、これ以上アイテムを購入できません！', 'error');
    return;
  }
  if (character.value.gold < item.goldCost) {
    addLog('金貨が足りません！', 'error');
    return;
  }
  character.value.gold -= item.goldCost;
  character.value.items.push({
    ...item,
    id: Math.random().toString(36).substring(2, 9)
  } as GeneralItem);
  addLog(`行商人から [${item.name}] を購入しました。(金貨${item.goldCost}枚消費)`, 'success');
}

const { buyFollower } = useGameState();
function hireFollower(type: any) {
  buyFollower(type);
}

// Loot item logic
async function resolveLootRoom() {
  const currentEvent = activeEvent.value;
  if (!currentEvent) return;
  addLog(`部屋の探索を開始します。宝物を得るためにダイスを振ります...`, 'info');
  const lootText = await resolveLoot(); // Call loot table roll directly
  (currentEvent as any).isResolved = true;
  (currentEvent as any).resolutionText = `🎁 宝物を獲得しました！\n獲得した戦利品: ${lootText}`;
}

// Priest NPC heal options
function resolvePriest(choice: 'heal' | 'holywater') {
  if (!activeEvent.value) return;
  let text = '';
  if (choice === 'heal') {
    character.value.lifeCurrent = character.value.lifeMax;
    followers.value.forEach(f => f.lifeCurrent = 1);
    text = '巡礼の僧侶から神聖な癒やしを施され、パーティの生命力が全回復しました！';
  } else {
    character.value.items.push({
      id: Math.random().toString(36).substring(2, 9),
      ...DEFAULT_ITEMS.holywater,
      value: 0
    } as GeneralItem);
    text = '巡礼の僧侶から魔を退ける「聖水」を1つ譲り受けました！';
  }
  (activeEvent.value as any).isResolved = true;
  (activeEvent.value as any).resolutionText = text;
}

// Jill-Mega Event 23 Option
async function resolveJillMega(help: boolean) {
  if (!activeEvent.value) return;
  if (help) {
    clearDiceTray();
    addLog('🎲 キャットゴーレムの出現数を決定するために1d6を振ります...', 'info');
    const d6 = await rollD6(true);
    const count = Math.ceil((d6 + 2) / 2);
    addLog(`🎲 ダイスロール: ${d6} (出現数: ${d6}+2 = ${d6+2}体)`, 'info');
    addLog(`⚔️ 手助けのために、その半数（端数切り上げ）のキャットゴーレム ${count} 体と戦闘を行います！`, 'success');
    
    // Generate enemies list dynamically
    activeEvent.value.enemies = [];
    for (let i = 0; i < count; i++) {
      activeEvent.value.enemies.push({
        name: count === 1 ? 'キャットゴーレム' : `キャットゴーレム ${String.fromCharCode(65 + i)}`,
        level: 4,
        lifeMax: 2,
        lifeCurrent: 2,
        attackCount: 1,
        tags: ["weak", "golem"],
        count: 1
      });
    }
    
    activeEvent.value.type = 'encounter';
    startEncounter();
  } else {
    const text = '🐱 ジル＝メガをその場に残し、関わらないように部屋を立ち去りました。';
    activeEvent.value.isResolved = true;
    activeEvent.value.resolutionText = text;
    addLog(text, 'info');
  }
}

// Alan Event 25 Option
async function rollAlanReaction() {
  clearDiceTray();
  addLog('🎲 アランの反応チェックを行います...', 'info');
  const roll = await rollD6(true);
  if (roll <= 2) { // Friendly
    addLog(`🎲 反応チェック: ${roll} 【友好的】 - アランはアダマンタイトを譲ってくれました！`, 'success');
    character.value.items.push({
      id: Math.random().toString(36).substring(2, 9),
      name: 'アダマンタイト',
      type: 'quest',
      goldCost: 20,
      value: 20,
      description: '頑強な地下鉱物の原石。武具 of 素材として使われる。原石のまま投擲武器としても使用できるが、大きく重いため【判定ロール】に−２の修正が入る。代わりに命中すればダメージに＋１される。１回の戦闘で１度しか使用できない。逃走した場合は失われる。'
    } as any);
    activeEvent.value.isResolved = true;
    activeEvent.value.resolutionText = 'アランと友好的に交渉し、無事にアダマンタイトを譲り受けました。';
  } else if (roll <= 4) { // Neutral
    addLog(`🎲 反応チェック: ${roll} 【中立】 - アラン「これは私が持ち帰った方が有効に使える。あきらめろ」`, 'error');
    (activeEvent.value as any).alanChoiceState = 'neutral';
  } else { // Hostile
    addLog(`🎲 反応チェック: ${roll} 【敵対的】 - アランは武器を構え、襲いかかってきました！`, 'error');
    startAlanFight(false);
  }
}

function resolveAlanNeutral(choice: 'leave' | 'fight' | 'duel') {
  if (!activeEvent.value) return;
  if (choice === 'leave') {
    let text = 'アランとの争いを避けるため、アダマンタイトを諦めて立ち去りました。';
    if ((character.value as any).pyramidOrigin === 'almaciuda') {
      character.value.food = (character.value.food || 0) + 1;
      text += ' アランは「代わりにこれを持っていけ」と食料を1回分くれました。';
    }
    activeEvent.value.isResolved = true;
    activeEvent.value.resolutionText = text;
    addLog(text, 'info');
  } else if (choice === 'fight') {
    startAlanFight(false);
  } else if (choice === 'duel') {
    startAlanFight(true);
  }
}

function startAlanFight(isDuel: boolean) {
  if (!activeEvent.value) return;
  activeEvent.value.enemies = [
    { name: "黒蜘蛛隊隊長アラン", level: 5, lifeMax: 5, lifeCurrent: 5, attackCount: 1, tags: ["strong"], count: 1, weaponAttribute: "strike" }
  ];
  if (isDuel) {
    addLog('⚔️ 1対1の決闘を受け入れました！ 第1ラウンドの攻撃ロールに+1修正を得ます。', 'success');
    (combatState as any).alanDuel = true;
  }
  activeEvent.value.type = 'encounter';
  startEncounter();
}

// Painting Event 53 Option
async function rollPaintingLuck() {
  if (!activeEvent.value) return;
  clearDiceTray();
  addLog('🎲 僧侶の企みに気づけるか、幸運ロール（目標値: 4）を行います...', 'info');
  const roll = await rollD6(true);
  const total = roll + (character.value.subStatType === 'luck' ? character.value.subStatCurrent : 0);
  if (total >= 4) {
    addLog(`🎲 幸運ロール成功: ${roll} + 修正 = ${total} (目標値: 4)`, 'success');
    addLog('✨ 僧侶の召喚の儀式にいち早く気づきました！ 奇襲の遠距離攻撃を行えます！', 'success');
    (activeEvent.value as any).paintingState = 'ranged_chance';
  } else {
    addLog(`🎲 幸運ロール失敗: ${roll} + 修正 = ${total} (目標値: 4)`, 'error');
    addLog('👿 企みに気づくのが遅れ、絵から下級悪魔が出現しました！', 'error');
    startPaintingFight();
  }
}

async function rollPaintingRanged() {
  if (!activeEvent.value) return;
  clearDiceTray();
  addLog('🏹 遠距離攻撃（目標値: 3）を行います...', 'info');
  const roll = await rollD6(true);
  const modifier = character.value.subStatType === 'dexterity' ? character.value.subStatCurrent : character.value.skillCurrent;
  const finalVal = roll + modifier;
  if (finalVal >= 3) {
    addLog(`🎲 射撃成功: ${roll} + 修正 = ${finalVal} (目標値: 3)`, 'success');
    const text = '🏹 見事に射撃が命中し、僧侶は絶命しました！ 悪魔の召喚は未然に防がれました。';
    activeEvent.value.isResolved = true;
    activeEvent.value.resolutionText = text;
    addLog(text, 'success');
  } else {
    addLog(`🎲 射撃失敗: ${roll} + 修正 = ${finalVal} (目標値: 3)`, 'error');
    addLog('👿 矢は外れた！ 儀式が完了し、絵から下級悪魔が出現しました！', 'error');
    startPaintingFight();
  }
}

function startPaintingFight() {
  if (!activeEvent.value) return;
  clearDiceTray();
  const d6 = Math.floor(Math.random() * 6) + 1;
  addLog(`🎲 出現数ダイスロール: ${d6} (出現数: ${d6}体)`, 'info');
  activeEvent.value.enemies = [];
  for (let i = 0; i < d6; i++) {
    activeEvent.value.enemies.push({
      name: d6 === 1 ? '下級悪魔' : `下級悪魔 ${String.fromCharCode(65 + i)}`,
      level: 4,
      lifeMax: 2,
      lifeCurrent: 2,
      attackCount: 1,
      tags: ["demon", "weak"],
      count: 1,
      weaponAttribute: "fire"
    });
  }
  activeEvent.value.type = 'encounter';
  startEncounter();
}

// Right Arm Event 61 Option
async function rollRightArmReaction() {
  if (!activeEvent.value) return;
  clearDiceTray();
  addLog('🎲 ヘラクレオスの右腕の反応判定を行います...', 'info');
  const roll = await rollD6(true);
  if (roll <= 3) {
    addLog(`🎲 反応判定: ${roll} 【無視】 - 右腕はあなたに気づいていません。無視して立ち去ることができます。`, 'success');
    (activeEvent.value as any).rightArmState = 'ignore_choice';
  } else {
    addLog(`🎲 反応判定: ${roll} 【死ぬまで戦う】 - 右腕が動き出し襲いかかってきました！`, 'error');
    startRightArmFight();
  }
}

function resolveRightArmIgnore(ignore: boolean) {
  if (!activeEvent.value) return;
  if (ignore) {
    let text = '無視して立ち去りました。';
    const hasStone = character.value.items.some(i => i.name === '青の聖石');
    if (!hasStone) {
      if (!character.value.statusEffects) character.value.statusEffects = [];
      if (!character.value.statusEffects.includes('呪い')) {
        character.value.statusEffects.push('呪い');
      }
      text += ' ⚠️ 青の聖石を持たずに立ち去ったため、右腕の絶望による【呪い】（防御判定-1）を受けました。';
      addLog('⚠️ ヘラクレオスの右腕の絶望により【呪い】状態になりました。', 'error');
    }
    activeEvent.value.isResolved = true;
    activeEvent.value.resolutionText = text;
  } else {
    startRightArmFight();
  }
}

function useRightArmStone() {
  if (!activeEvent.value) return;
  const stoneIdx = character.value.items.findIndex(i => i.name === '青の聖石');
  if (stoneIdx !== -1) {
    character.value.items.splice(stoneIdx, 1);
    (character.value as any).heraclesRightBuff = true;
    addLog('💎 青の聖石を消費して、怪力王ヘラクレオスの右腕の魂を救いました！ 悪魔への追加ダメージ+1を得ます。', 'success');
    const text = '青の聖石を使用してヘラクレオスの右腕を救済しました。怪力王の魂が宿り、悪魔への追加ダメージ+1を得ました。';
    activeEvent.value.isResolved = true;
    activeEvent.value.resolutionText = text;
  }
}

function startRightArmFight() {
  if (!activeEvent.value) return;
  activeEvent.value.enemies = [
    { name: "ヘラクレオスの右腕", level: 5, lifeMax: 7, lifeCurrent: 7, attackCount: 2, tags: ["strong", "golem"], count: 1, weaponAttribute: "strike" }
  ];
  activeEvent.value.type = 'encounter';
  startEncounter();
}

// Left Arm Event 62 Option
async function rollLeftArmReaction() {
  if (!activeEvent.value) return;
  clearDiceTray();
  addLog('🎲 ヘラクレオスの左腕の反応判定を行います...', 'info');
  const roll = await rollD6(true);
  if (roll <= 3) {
    addLog(`🎲 反応判定: ${roll} 【無視】 - 左腕はあなたに気づいていません。無視して立ち去ることができます。`, 'success');
    (activeEvent.value as any).leftArmState = 'ignore_choice';
  } else {
    addLog(`🎲 反応判定: ${roll} 【死ぬまで戦う】 - 左腕が動き出し襲いかかってきました！`, 'error');
    startLeftArmFight();
  }
}

function resolveLeftArmIgnore(ignore: boolean) {
  if (!activeEvent.value) return;
  if (ignore) {
    let text = '無視して立ち去りました。';
    const hasStone = character.value.items.some(i => i.name === '赤の聖石');
    if (!hasStone) {
      if (!character.value.statusEffects) character.value.statusEffects = [];
      if (!character.value.statusEffects.includes('呪い')) {
        character.value.statusEffects.push('呪い');
      }
      text += ' ⚠️ 赤の聖石を持たずに立ち去ったため、左腕の悔恨による【呪い】（防御判定-1）を受けました。';
      addLog('⚠️ ヘラクレオスの左腕の悔恨により【呪い】状態になりました。', 'error');
    }
    activeEvent.value.isResolved = true;
    activeEvent.value.resolutionText = text;
  } else {
    startLeftArmFight();
  }
}

function useLeftArmStone() {
  if (!activeEvent.value) return;
  const stoneIdx = character.value.items.findIndex(i => i.name === '赤の聖石');
  if (stoneIdx !== -1) {
    character.value.items.splice(stoneIdx, 1);
    (character.value as any).heraclesLeftBuff = true;
    addLog('💎 赤の聖石を消費して、怪力王ヘラクレオスの左腕の魂を救いました！ 悪魔への防御+1を得ます。', 'success');
    const text = '赤の聖石を使用してヘラクレオスの左腕を救済しました。怪力王の魂が宿り、悪魔への防御ロール+1を得ました。';
    activeEvent.value.isResolved = true;
    activeEvent.value.resolutionText = text;
  }
}

function startLeftArmFight() {
  if (!activeEvent.value) return;
  activeEvent.value.enemies = [
    { name: "ヘラクレオスの左腕", level: 4, lifeMax: 7, lifeCurrent: 7, attackCount: 1, tags: ["strong", "golem"], count: 1, weaponAttribute: "strike" }
  ];
  activeEvent.value.type = 'encounter';
  startEncounter();
}

// Wounded mercenary option
function resolveMercenary(save: boolean) {
  if (!activeEvent.value) return;
  let text = '';
  if (save) {
    if (character.value.gold < 7) {
      addLog('金貨が足りないため、彼を治療できません。', 'error');
      return;
    }
    if (followers.value.length >= character.value.followerCurrent) {
      addLog('従者の最大雇用枠に達しているため、これ以上従者を連れていけません！', 'error');
      return;
    }
    character.value.gold -= 7;
    // Recruit Swordsman
    followers.value.push({
      id: Math.random().toString(36).substring(2, 9),
      name: '救出された剣士',
      type: 'swordsman',
      isCombatant: true,
      skill: 1,
      lifeMax: 1,
      lifeCurrent: 1,
      weaponAttribute: 'slash',
      goldCost: 0,
      description: '助けた傭兵。戦闘に参加する戦う従者。技量1、生命1。',
    });
    text = '金貨7枚を払い傭兵を治療しました！ 新たに従者「剣士」が仲間に加わりました。';
  } else {
    text = '傷ついた傭兵を見捨てて先を急ぎます。アランツァの冷酷な現実です。';
  }
  (activeEvent.value as any).isResolved = true;
  (activeEvent.value as any).resolutionText = text;
}

// Goblin Captive option
function resolveCaptive(enslave: boolean) {
  if (!activeEvent.value) return;
  let text = '';
  if (enslave) {
    const ropeIdx = character.value.items.findIndex(i => i.type === 'rope');
    if (ropeIdx === -1) {
      addLog('ロープを所持していないため、捕虜を拘束できません！', 'error');
      return;
    }
    if (followers.value.length >= character.value.followerCurrent) {
      addLog('従者枠がいっぱいです。', 'error');
      return;
    }

    character.value.items.splice(ropeIdx, 1);
    followers.value.push({
      id: Math.random().toString(36).substring(2, 9),
      name: 'ゴブリンの捕虜',
      type: 'captive',
      isCombatant: false,
      skill: 0,
      lifeMax: 1,
      lifeCurrent: 1,
      weaponAttribute: 'strike',
      goldCost: 0,
      description: '拘束したゴブリン。非戦闘従者。身代わりに使える。',
    });
    text = 'ロープを使用してゴブリンを拘束し、捕虜として同行させました！';
  } else {
    text = 'ゴブリンの捕虜を放置して部屋を立ち去りました。';
  }
  (activeEvent.value as any).isResolved = true;
  (activeEvent.value as any).resolutionText = text;
}

// Altar/Rest room heal
function resolveRestRoom(option: 'life' | 'sub') {
  if (!activeEvent.value) return;
  let text = '';
  if (option === 'life') {
    character.value.lifeCurrent = Math.min(character.value.lifeMax, character.value.lifeCurrent + 2);
    text = '静かに祈りを捧げ、怪我を癒やしました。生命力+2回復。';
  } else {
    character.value.subStatCurrent = character.value.subStatMax;
    text = '瞑想を行い、精神と体力を統一しました。副能力値が全回復しました！';
  }
  (activeEvent.value as any).isResolved = true;
  (activeEvent.value as any).resolutionText = text;
}

async function handleCustomChoiceClick(choice: any) {
  if (choice.checkStat) {
    addLog(`🧭 独自判定開始: 【${choice.checkStat.toUpperCase()}】判定ロール (目標値: ${choice.checkTarget || 3})`, 'info');
    const roll = await rollD6(true);
    let modifier = 0;

    // Apply 剛力丸 (strong_pill) bonus
    const pillIdx = character.value.items.findIndex(i => i.id === 'strong_pill');
    if (choice.checkStat === 'strength' && pillIdx !== -1) {
      modifier += 1;
      character.value.items.splice(pillIdx, 1);
      addLog('💊 『剛力丸』を服用し、筋力判定に +1 ボーナスを得ました！(アイテムを消費)', 'success');
    }

    if (!carriesLantern.value) {
      modifier -= 2;
      addLog('暗闇のため判定に -2 のペナルティ！', 'error');
    }
    
    // Check status effect modSkill (penalties)
    playerActiveStatusEffectRules.value.forEach(rule => {
      if (rule.modSkill) {
        modifier += rule.modSkill;
        addLog(`状態異常ペナルティにより判定に ${rule.modSkill} の修正が入ります。`, 'error');
      }
    });

    // Armor bonuses for dexterity
    if (choice.checkStat === 'dexterity' && character.value.equippedArmor) {
      const arm = character.value.equippedArmor;
      if (arm.modDex > 0) {
        modifier += arm.modDex;
        addLog(`防具 [${arm.name}] の効果で器用判定に +${arm.modDex}`, 'success');
      }
    }

    let statVal = 0;
    let isUsingSubStat = false;
    if (choice.checkStat === 'skill') {
      statVal = character.value.skillCurrent;
    } else {
      const isSubMatch = character.value.subStatType === choice.checkStat;
      if (isSubMatch && character.value.subStatCurrent > 0) {
        statVal = character.value.subStatCurrent;
        isUsingSubStat = true;
        addLog(`得意な副能力値【${choice.checkStat.toUpperCase()}】を技量点の代わりに使用します。(現在値: ${statVal})`, 'success');
      } else {
        statVal = character.value.skillCurrent;
        if (isSubMatch) {
          addLog(`副能力値が0点以下のため、技量点を使用します。`, 'error');
        } else {
          addLog(`技量点を使用して判定を行います。(現在値: ${statVal})`, 'info');
        }
      }
    }
    
    const target = choice.checkTarget || 3;
    const total = roll === 6 ? 99 : roll === 1 ? -99 : roll + statVal + modifier;
    const success = roll === 6 || (roll !== 1 && total >= target);
    
    if (isUsingSubStat) {
      character.value.subStatCurrent = Math.max(0, character.value.subStatCurrent - 1);
      addLog(`判定終了後、副能力値を1点消費しました。(残り: ${character.value.subStatCurrent}点)`, 'info');
    }
    
    choice.onSelect({ success, roll, total });
  } else {
    choice.onSelect();
  }
}

function confirmEventResolution() {
  if (isBackpackOverLimit.value) {
    addLog('🎒 背負い袋が容量制限を超過しています！ 不要なアイテムを捨てるか、装備を変更して整理してください。', 'error');
    return;
  }
  if (activeEvent.value?.d66Code === 'Final1' || activeEvent.value?.d66Code === 'Final2') {
    completePyramidRun();
    return;
  }
  activeEvent.value = null;
  dungeonDepth.value++;
}

function startGoblinFight() {
  if (!activeEvent.value) return;
  clearDiceTray();
  combatState.active = true;
  combatState.round = 0;
  combatState.log = [];
  combatState.hasRangedFired = false;
  combatState.playerHasFiredRanged = false;
  combatState.archerHasFiredRanged = false;
  combatState.buffs.defenseBonus = 0;
  combatState.buffs.damageIgnoreCount = 0;
  combatState.isEscaping = false;
  combatState.combatType = 'melee';
  combatState.hasReactionChecked = true; // Reaction check already happened
  combatState.isBribeAllowed = false;
  combatState.reactionResult = null;

  // Generate goblin negotiator enemy
  combatState.enemies = [{
    id: Math.random().toString(36).substring(2, 9),
    name: "ゴブリンの交渉人",
    level: 3,
    lifeMax: 2,
    lifeCurrent: 2,
    attackCount: 1,
    tags: ["strong"],
    count: 1
  }];

  addLog('⚔️ 交渉決裂！ゴブリンの交渉人が襲いかかってきました！', 'combat');
  currentScreen.value = 'combat';
}

// --- Custom Skeleton Encounter (33) Logic ---
const skeletonReaction = ref<number | null>(null);
const isSkeletonTraded = ref<boolean>(false);
const hasChosenTensDigit = ref<boolean>(false);

watch(activeEvent, (newEvent) => {
  if (!newEvent || newEvent.d66Code !== '33') {
    skeletonReaction.value = null;
    isSkeletonTraded.value = false;
    hasChosenTensDigit.value = false;
  }
});

async function rollSkeletonReaction() {
  addLog('砂掃きの骸骨の反応を確認します。1d6を振ります...', 'info');
  const roll = await rollD6();
  skeletonReaction.value = roll;
  if (roll <= 3) {
    addLog(`反応: 【友好的】 (出目: ${roll}) - 骸骨はミロスとの契約について語り、ピラミッドのアドバイス（次の出目操作）と武器交換を提案してきました。`, 'success');
  } else if (roll <= 5) {
    addLog(`反応: 【中立】 (出目: ${roll}) - 骸骨はあなたの武器に興味を持ち、武器交換を提案してきました。`, 'info');
  } else {
    addLog(`反応: 【逃走】 (出目: ${roll}) - 骸骨は驚いて逃げ出しました！`, 'info');
  }
}

function tradeWeaponWithSkeleton(weaponName: string) {
  if (!activeEvent.value) return;
  const idx = character.value.weapons.findIndex(w => w.name === weaponName);
  if (idx === -1) return;

  const tradedWeapon = character.value.weapons[idx];
  character.value.weapons.splice(idx, 1);
  if (character.value.equippedWeapon?.name === weaponName) {
    character.value.equippedWeapon = null;
  }

  const ribSword: Weapon = {
    name: '古竜の肋骨剣',
    type: 'one-handed',
    modAttack: 0,
    attribute: 'strike',
    goldCost: 25,
    isMagic: true,
    description: '古竜の肋骨から作られた太い片手剣。打撃属性。弱い敵との戦闘でクリティカル時に衝撃波で追加1d3体撃破。5回ファンブルで破損。',
    fumblesCount: 0
  };
  character.value.weapons.push(ribSword);

  isSkeletonTraded.value = true;
  addLog(`🤝 骸骨に [${tradedWeapon.name}] を手渡し、代わりに『古竜の肋骨剣』を受け取りました！`, 'success');
}

function selectSkeletonTensDigit(digit: number) {
  nextRoomTensDigitOverride.value = digit;
  hasChosenTensDigit.value = true;
  addLog(`Res: 骸骨のアドバイスに従い、次の部屋探索の十の位を [ ${digit} ] に指定しました。`, 'success');
  resolveSkeletonEvent();
}

function resolveSkeletonEvent() {
  if (!activeEvent.value) return;

  let rText = '🧹 砂掃きの骸骨との遭遇を終えました。';
  if (isSkeletonTraded.value) {
    rText += '\n• 特性【斬撃】の片手武器を渡し、代わりに『古竜の肋骨剣』を獲得しました。';
  } else {
    rText += '\n• 武器の交換は行いませんでした。';
  }
  if (nextRoomTensDigitOverride.value !== null) {
    rText += `\n• 次回部屋探索時の十の位の出目に [ ${nextRoomTensDigitOverride.value} ] を指定されました。`;
  }

  (activeEvent.value as any).isResolved = true;
  (activeEvent.value as any).resolutionText = rText;
}
// ---------------------------------------------
</script>

<template>
  <div class="explorer-card paper-sheet">
    <div class="explorer-header">
      <h2>🏰 ダンジョン探索</h2>
      <div style="display: flex; gap: 8px; align-items: center;">
        <div v-if="activeScenario?.id === 'pyramid_of_chronodemon'" class="badge-depth" style="background: #e1f5fe; border-color: #29b6f6; color: #0288d1; font-weight: bold;">
          現在の周回数: {{ pyramidRunCount }}回目 / 3回中
        </div>
        <div class="badge-depth">{{ depthText }}</div>
      </div>
    </div>

    <!-- Recent Event Log -->
    <div v-if="logs.length > 0" class="recent-event-box" style="margin: 0 0 20px 0; padding: 10px; border: 1px dashed var(--ink-light); background: rgba(255,255,255,0.5); border-radius: 4px; font-family: 'Noto Serif JP', serif; font-size: 0.9rem;">
      📖 <b>直近の出来事:</b> <span :class="logs[logs.length - 1]?.type">{{ logs[logs.length - 1]?.text }}</span>
    </div>

    <!-- Active Event Panel -->
    <div v-if="activeEvent" class="event-panel">
      <!-- Resolved screen for player acknowledgment -->
      <div v-if="(activeEvent as any).isResolved" class="resolution-panel" style="text-align: center;">
        <div class="clear-stamp-container" style="margin-bottom: 12px;">
          <span class="clear-stamp">探索完了 CLEAR</span>
        </div>
        <h3 class="event-title resolved-title" style="border-bottom: 1px dashed rgba(92, 75, 61, 0.3); padding-bottom: 8px; margin-bottom: 15px; color: var(--ink-light); font-size: 1.1rem; opacity: 0.8;">
          📜 解決済: {{ activeEvent.title }}
        </h3>
        <p class="event-description resolved-desc" style="white-space: pre-line; background: rgba(225, 218, 205, 0.4); padding: 15px; border-radius: 4px; border: 1px dashed rgba(92, 75, 61, 0.4); font-size: 0.95rem; color: var(--ink-light); line-height: 1.6; text-align: left; opacity: 0.9;">
          {{ (activeEvent as any).resolutionText }}
        </p>
        <div v-if="isBackpackOverLimit" class="overlimit-warning-banner" style="background: rgba(140, 28, 28, 0.1); border: 1px solid #8c1c1c; padding: 12px; border-radius: 4px; color: #8c1c1c; font-size: 0.9rem; margin-top: 10px; margin-bottom: 10px; text-align: left;">
          ⚠️ <b>背負い袋の容量制限を超過しています！</b><br/>
          右側の「キャラクター記録紙」から、不要な武器・道具を「捨てる」か、装備を変更して空きスロットを作ってください。（整理が完了するまで次の部屋に進めません）
        </div>
        <button @click="confirmEventResolution" class="btn-ink btn-large btn-primary-ink" :disabled="isBackpackOverLimit" style="margin-top: 15px; width: 100%;">
          🚪 次の小部屋へ進む
        </button>
      </div>

      <!-- Active unresolved event card -->
      <div v-else>
        <div class="event-type-badge" :class="activeEvent.type">
          {{ activeEvent.type === 'trap' ? '💀 トラップ' : activeEvent.type === 'treasure' ? '🎁 宝箱' : activeEvent.type === 'rest' ? '⛲ 聖域/休息' : activeEvent.type === 'npc' ? '👤 遭遇' : '部屋' }}
          (d66: {{ activeEvent.d66Code }})
        </div>
        <h3 class="event-title">{{ activeEvent.title }}</h3>
        <p class="event-description">{{ activeEvent.description }}</p>

        <div class="event-actions">
        <!-- Scenario Plugin Custom Choices (Dynamic Choices) -->
        <div v-if="activeEvent.customChoices" class="custom-choices-panel" style="width: 100%; margin-bottom: 10px;">
          <div class="button-group" style="display: flex; flex-direction: column; gap: 8px;">
            <button 
              v-for="choice in activeEvent.customChoices" 
              :key="choice.id"
              @click="handleCustomChoiceClick(choice)"
              class="btn-ink"
              :disabled="choice.disabled || diceTray.isRolling"
              style="width: 100%; justify-content: center;"
            >
              {{ choice.label }}
            </button>
          </div>
        </div>

        <!-- Trap Actions -->
        <div v-else-if="activeEvent.type === 'trap'">
          <!-- Damage Target Selection Panel -->
          <div v-if="combatState.pendingTrapDamage" class="trap-damage-target-select" style="margin-top: 15px; border: 1px dashed #8c1c1c; padding: 15px; border-radius: 4px; background: rgba(140, 28, 28, 0.05); text-align: left; width: 100%;">
            <h4 style="color: #8c1c1c; margin-top: 0; margin-bottom: 10px; font-weight: bold; display: flex; align-items: center; gap: 6px;">
              ⚠️ ダメージ対象の選択
            </h4>
            <p style="font-size: 0.9rem; margin-bottom: 15px; line-height: 1.4; color: var(--ink-dark);">
              <span v-if="combatState.pendingTrapDamage.chooseCount">
                罠が発動しました！あと <b>{{ combatState.pendingTrapDamage.chooseCount }}人</b> の対象者を選択してください。
              </span>
              <span v-else>
                罠が発動してしまいました。ダメージ（{{ combatState.pendingTrapDamage.damage }}点）および状態異常を引き受けるキャラクターを選択してください。
              </span>
              <br/>
              <span style="font-size: 0.85rem; opacity: 0.8;">※『ウォー・ドール』は罠の対象になりません。</span>
            </p>
            <div class="button-group" style="display: flex; flex-direction: column; gap: 8px;">
              <button 
                v-if="!combatState.pendingTrapDamage?.chosenIds?.includes('hero')"
                @click="resolveTrapDamageTarget('hero')" 
                class="btn-ink btn-strength" 
                style="justify-content: center; background: #8c1c1c; color: white; border-color: #8c1c1c;"
              >
                👤 主人公が受ける (生命力 -{{ combatState.pendingTrapDamage?.damage }})
              </button>
              <button 
                v-for="follower in followers.filter(f => f.lifeCurrent > 0 && f.name !== 'ウォー・ドール' && !combatState.pendingTrapDamage?.chosenIds?.includes(f.id))" 
                :key="follower.id"
                @click="resolveTrapDamageTarget(follower.id)"
                class="btn-ink btn-primary-ink"
                style="justify-content: center; background: #e07a5f; border-color: #e07a5f; color: white;"
              >
                👥 {{ follower.name }} に身代わりになってもらう (死亡します)
              </button>
            </div>
          </div>
          <!-- Trap Challenge Options -->
          <template v-else>
            <div v-if="activeEvent.trapStat && character.subStatType === activeEvent.trapStat && character.subStatCurrent > 0" class="button-group" style="display: flex; gap: 10px; flex-wrap: wrap;">
              <button @click="resolveTrapCheck(true)" class="btn-ink btn-strength" style="flex: 1; min-width: 200px; justify-content: center;" :disabled="activeEvent.isResolved || diceTray.isRolling">
                {{ activeEvent.trapStat === 'strength' ? '💪' : activeEvent.trapStat === 'dexterity' ? '🏹' : activeEvent.trapStat === 'magic' ? '🔮' : '✨' }} 副能力値【{{ activeEvent.trapStat === 'strength' ? '筋力点' : activeEvent.trapStat === 'dexterity' ? '器用点' : activeEvent.trapStat === 'magic' ? '魔術点' : activeEvent.trapStat === 'luck' ? '幸運点' : activeEvent.trapStat }}】で挑戦 (判定値: {{ character.subStatCurrent }} / 1点消費)
              </button>
              <button @click="resolveTrapCheck(false)" class="btn-ink" style="flex: 1; min-width: 200px; justify-content: center;" :disabled="activeEvent.isResolved || diceTray.isRolling">
                🎲 技量点で挑戦 (判定値: {{ character.skillCurrent }} / 消費なし)
              </button>
            </div>
            <button v-else @click="resolveTrapCheck(true)" class="btn-ink" style="width: 100%; justify-content: center;" :disabled="activeEvent.isResolved || diceTray.isRolling">
              🎲 判定ロールに挑戦する (技量点判定値: {{ character.skillCurrent }} / 目標値: {{ activeEvent.trapTarget }})
            </button>
          </template>
        </div>

        <!-- Treasure Actions -->
        <div v-else-if="activeEvent.type === 'treasure'">
          <button @click="resolveLootRoom" class="btn-ink" :disabled="activeEvent.isResolved || diceTray.isRolling">
            💎 宝物を入手する (ダイスを振る)
          </button>
        </div>

        <!-- Rest Room Options -->
        <div v-else-if="activeEvent.type === 'rest'" class="button-group">
          <button @click="resolveRestRoom('life')" class="btn-ink">❤️ 怪我を癒やす (生命力+2)</button>
          <button @click="resolveRestRoom('sub')" class="btn-ink">🔮 魔力/運気を回復 (副能力値全快)</button>
        </div>

        <!-- Custom Skeleton Event (33) -->
        <div v-else-if="activeEvent.d66Code === '33' && activeScenario?.id === 'pyramid_of_chronodemon'" class="skeleton-event-panel" style="width: 100%;">
          <div v-if="skeletonReaction === null">
            <p style="margin-bottom: 20px; font-style: italic;">
              箒を持った骸骨がピラミッドの床を静かに掃除しています。彼に接触しますか？それとも立ち去りますか？
            </p>
            <div class="button-group" style="display: flex; gap: 10px;">
              <button @click="rollSkeletonReaction" class="btn-ink btn-primary-ink" style="flex: 1;">
                🎲 接触を試みる (反応チェックを行う)
              </button>
              <button @click="activeEvent = null; dungeonDepth++" class="btn-ink btn-secondary" style="flex: 1;">
                🏃 見つからないように立ち去る
              </button>
            </div>
          </div>

          <div v-else>
            <!-- Show Reaction Result -->
            <div class="reaction-result-box" style="padding: 10px; background: rgba(92, 75, 61, 0.05); border: 1px solid var(--ink-dark); border-radius: 4px; margin-bottom: 15px; text-align: center;">
              <b>反応チェック結果:</b> 
              <span v-if="skeletonReaction <= 3" style="color: var(--ink-dark); font-weight: bold;">【友好的】 (出目: {{ skeletonReaction }})</span>
              <span v-else-if="skeletonReaction <= 5" style="color: var(--ink-dark); font-weight: bold;">【中立】 (出目: {{ skeletonReaction }})</span>
              <span v-else style="color: #8c1c1c; font-weight: bold;">【逃走】 (出目: {{ skeletonReaction }})</span>
            </div>

            <!-- Flee Outcome -->
            <div v-if="skeletonReaction === 6">
              <p style="margin-bottom: 15px;">骸骨はあなたを見ると、持っていた箒を置いて慌てて逃げ去ってしまいました。</p>
              <button @click="activeEvent = null; dungeonDepth++" class="btn-ink btn-large btn-primary-ink" style="width: 100%;">
                🚪 部屋を立ち去る
              </button>
            </div>

            <!-- Friendly or Neutral Outcome -->
            <div v-else>
              <!-- 1. Weapon Trade Section -->
              <div v-if="!isSkeletonTraded" class="trade-section" style="margin-bottom: 20px; border-bottom: 1px dashed rgba(92,75,61,0.2); padding-bottom: 20px;">
                <p style="margin-bottom: 10px; font-size: 0.95rem;">
                  骸骨はあなたの持つ武器に興味深そうに視線を向けています。<br/>
                  ピラミッドの石壁にある隙間に <b>特性【斬撃】の「片手武器」</b> を差し出せば、代わりに『古竜の肋骨剣』と交換してくれるようです。
                </p>
                
                <!-- Eligible Weapons list -->
                <div v-if="character.weapons.filter(w => w.type === 'one-handed' && w.attribute === 'slash').length > 0" style="width: 100%;">
                  <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 10px; width: 100%;">
                    <div v-for="w in character.weapons.filter(w => w.type === 'one-handed' && w.attribute === 'slash')" :key="w.name" style="display: flex; justify-content: space-between; align-items: center; padding: 6px 10px; border: 1px dashed rgba(92,75,61,0.4); border-radius: 4px;">
                      <span>🗡️ {{ w.name }} (斬撃)</span>
                      <button @click="tradeWeaponWithSkeleton(w.name)" class="btn-ink btn-mini">🤝 交換を申し出る</button>
                    </div>
                  </div>
                </div>
                <div v-else style="color: #8c1c1c; font-size: 0.85rem; margin-top: 10px; font-style: italic;">
                  ⚠️ 条件に合う武器（【斬撃】の片手武器）を所持していません。
                </div>
              </div>
              <div v-else style="margin-bottom: 20px; text-align: center; color: green; font-weight: bold;">
                🤝 『古竜の肋骨剣』と交換しました！
              </div>

              <!-- 2. Advice (Next Tens Digit) Section for Friendly reaction -->
              <div v-if="skeletonReaction <= 3 && !hasChosenTensDigit" class="advice-section" style="margin-top: 15px; border-top: 1px dashed rgba(92,75,61,0.2); padding-top: 15px;">
                <p style="margin-bottom: 10px; font-size: 0.95rem;">
                  骸骨はピラミッドの内部構造に詳しいため、次の部屋の案内をしてくれます。<br/>
                  <b>次に進む部屋の出目の十の位を選択してください：</b>
                </p>
                <div class="digit-buttons" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;">
                  <button v-for="d in [1, 2, 3, 4, 5, 6]" :key="d" @click="selectSkeletonTensDigit(d)" class="btn-ink" style="justify-content: center;">
                    🚪 {{ d }}の部屋へ (d66: {{ d }}X)
                  </button>
                </div>
              </div>

              <!-- 3. Resolution confirm button -->
              <div v-if="skeletonReaction > 3 || hasChosenTensDigit" style="margin-top: 15px;">
                <button @click="resolveSkeletonEvent" class="btn-ink btn-large btn-primary-ink" style="width: 100%;">
                  ✔️ 取引を終了して結果を確定する
                </button>
              </div>
              <div v-else-if="skeletonReaction <= 3 && !hasChosenTensDigit" style="margin-top: 15px; text-align: center;">
                <button @click="resolveSkeletonEvent" class="btn-ink btn-secondary" style="width: 100%;">
                  🏃 取引もアドバイスも受けずに立ち去る
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Merchant NPC Interaction -->
        <div v-else-if="activeEvent.d66Code === 'Final1'" style="width: 100%;">
          <div v-if="!activeEvent.isResolved">
            <p style="font-weight: bold; font-size: 1.1rem; color: #8c1c1c; margin-bottom: 10px;">
              🏃 床の崩落を跳び越える (器用判定 {{ final1Step }}回目 / 3回中)
            </p>
            <p style="margin-bottom: 20px; font-size: 0.95rem; color: var(--ink-light); line-height: 1.6;">
              崩れ落ちる床を飛び越えなければなりません！<br/>
              <span style="font-weight: bold; color: #8c1c1c;" v-if="final1Step === 1">1回目目標値: 3 (失敗時: 生命力 -1)</span>
              <span style="font-weight: bold; color: #8c1c1c;" v-if="final1Step === 2">2回目目標値: 3 (失敗時: 生命力 -1)</span>
              <span style="font-weight: bold; color: #8c1c1c;" v-if="final1Step === 3">3回目目標値: 4 (失敗時: 生命力 -1)</span>
            </p>
            <button @click="rollFinal1Trap" class="btn-ink btn-large btn-primary-ink" style="width: 100%; justify-content: center;" :disabled="diceTray.isRolling">
              🎲 器用判定ロールを行う (能力値: {{ character.skillCurrent }})
            </button>
          </div>
        </div>

        <div v-else-if="activeEvent.npcType === 'final2_choice'" style="width: 100%;">
          <div v-if="!activeEvent.isResolved">
            <p style="margin-bottom: 20px; font-size: 0.95rem; color: var(--ink-light); line-height: 1.6;">
              背後の巨像「至高のヘラクレオス」と「異端者シーリーン」のどちらと対峙しますか？<br/>
              どちらか一方を選んで戦わなければなりません。
            </p>
            <div class="button-group" style="display: flex; gap: 15px; flex-wrap: wrap;">
              <button @click="startFinal2Fight('golem')" class="btn-ink" style="flex: 1; min-width: 200px; justify-content: center; background: #efebe9; border-color: #5d4037; color: #5d4037; font-weight: bold;">
                🤖 至高のヘラクレオスと戦う (Level 5 / Life 12)
              </button>
              <button @click="startFinal2Fight('shireen')" class="btn-ink" style="flex: 1; min-width: 200px; justify-content: center; background: #f3e5f5; border-color: #7b1fa2; color: #7b1fa2; font-weight: bold;">
                🔮 異端者シーリーンと戦う (Level 5 / Life 5)
              </button>
            </div>
          </div>
        </div>

        <div v-else-if="activeEvent.npcType === 'desert_crocodile'" style="width: 100%;">
          <div v-if="!activeEvent.isResolved">
            <p style="margin-bottom: 20px; font-size: 0.95rem; color: var(--ink-light); line-height: 1.6;">
              巨大な砂漠ワニが獲物を求めて口を開けています！<br/>
              食料2個、または弱い（雇用費が金貨10枚以下）従者1体を差し出すことで、友好関係を試すことができます (1d6を振り、1-3で成功/戦闘回避、4-6で戦闘突入)。
            </p>
            <div class="button-group" style="display: flex; gap: 10px; flex-direction: column;">
              <button v-if="character.food >= 2" @click="bribeCrocodile('food')" class="btn-ink" style="width: 100%; justify-content: center; font-weight: bold;" :disabled="diceTray.isRolling">
                💸 食料 2 個を差し出してワイロを試みる (現在の食料: {{ character.food }}個)
              </button>
              <button v-if="followers.some(f => f.goldCost <= 10)" @click="bribeCrocodile('follower')" class="btn-ink" style="width: 100%; justify-content: center; font-weight: bold;" :disabled="diceTray.isRolling">
                💸 弱い従者 1 体を差し出してワイロを試みる
              </button>
              <button @click="startCrocodileFight" class="btn-ink btn-large btn-danger-ink" style="width: 100%; justify-content: center; font-weight: bold;" :disabled="diceTray.isRolling">
                ⚔️ 交渉決裂！戦う！
              </button>
            </div>
          </div>
        </div>

        <div v-else-if="activeEvent.npcType === 'merchant' || activeEvent.title === '地下の行商人'">
          <button v-if="!showMerchant" @click="showMerchant = true" class="btn-ink">🪙 取引をする</button>
          <button v-else @click="showMerchant = false" class="btn-ink btn-mini">閉じる</button>
          <button v-if="!showMerchant" @click="activeEvent = null; dungeonDepth++" class="btn-ink btn-secondary">部屋を立ち去る</button>

          <!-- Interactive Merchant Menu -->
          <div v-if="showMerchant" class="merchant-menu">
            <h4 class="menu-title">🛒 取引メニュー ({{ activeEvent.title }})</h4>
            
            <div class="merchant-tabs">
              <!-- Weapons -->
              <div class="merch-cat">
                <h5>⚔️ 武器・道具の購入:</h5>
                <div class="merch-grid">
                  <div v-for="w in merchantGoods.weapons" :key="w.name" class="merch-item">
                    <span>{{ w.name }} ({{ w.goldCost }}g)</span>
                    <button @click="buyWeaponFromMerchant(w)" class="btn-ink btn-mini" :disabled="character.gold < w.goldCost || isBackpackFull">購入</button>
                  </div>
                </div>
              </div>

              <!-- Armors -->
              <div class="merch-cat">
                <h5>🛡️ 防具の購入:</h5>
                <div class="merch-grid">
                  <div v-for="a in merchantGoods.armors" :key="a.name" class="merch-item">
                    <span>{{ a.name }} ({{ a.goldCost }}g)</span>
                    <button @click="buyArmorFromMerchant(a)" class="btn-ink btn-mini" :disabled="character.gold < a.goldCost">購入</button>
                  </div>
                </div>
              </div>

              <!-- Shields -->
              <div class="merch-cat">
                <h5>🛡️ [盾] の購入:</h5>
                <div class="merch-grid">
                  <div v-for="s in merchantGoods.shields" :key="s.name" class="merch-item">
                    <span>{{ s.name }} ({{ s.goldCost }}g)</span>
                    <button @click="buyShieldFromMerchant(s)" class="btn-ink btn-mini" :disabled="character.gold < s.goldCost || isBackpackFull">購入</button>
                  </div>
                </div>
              </div>

              <!-- General Consumables -->
              <div class="merch-cat">
                <h5>🧪 消耗品・小物の購入:</h5>
                <div class="merch-grid">
                  <div v-for="i in merchantGoods.items" :key="i.name" class="merch-item">
                    <span>{{ i.name }} ({{ i.goldCost }}g)</span>
                    <button @click="buyItemFromMerchant(i)" class="btn-ink btn-mini" :disabled="character.gold < i.goldCost || isBackpackFull">購入</button>
                  </div>
                </div>
              </div>

              <!-- Hire followers -->
              <div class="merch-cat">
                <h5>👥 従者の雇用:</h5>
                <div class="merch-grid">
                  <div v-for="f in hireableFollowers" :key="f.name" class="merch-item">
                    <span class="fol-details">
                      <b>{{ f.name }}</b> ({{ f.cost }}g)<br/>
                      <small class="fol-sub-desc">{{ f.desc }}</small>
                    </span>
                    <button @click="hireFollower(f.type)" class="btn-ink btn-mini" :disabled="character.gold < f.cost || followers.length >= character.followerCurrent">雇う</button>
                  </div>
                </div>
              </div>
            </div>

            <button @click="activeEvent = null; showMerchant = false; dungeonDepth++" class="btn-ink btn-large btn-leave">取引を終えて部屋を進む</button>
          </div>
        </div>

        <!-- Goblin Negotiator NPC -->
        <div v-else-if="activeEvent.npcType === 'bribe' || activeEvent.title === 'ゴブリンの交渉人'" class="button-group">
          <button @click="payBribeLocal" class="btn-ink" :disabled="character.gold < 5">🪙 ワイロを払う (金貨5枚)</button>
          <button @click="startGoblinFight" class="btn-ink btn-red">⚔️ 交渉決裂！戦う！</button>
        </div>

        <!-- Priest NPC -->
        <div v-else-if="activeEvent.npcType === 'priest' || activeEvent.title === '囚われた聖職者'" class="button-group">
          <button @click="resolvePriest('heal')" class="btn-ink">❤️ 傷の癒やしを乞う (生命力/従者全回復)</button>
          <button @click="resolvePriest('holywater')" class="btn-ink">🧪 聖水を譲り受ける (聖水+1)</button>
        </div>

        <!-- Mercenary NPC -->
        <div v-else-if="activeEvent.npcType === 'mercenary' || activeEvent.title === '傷ついた傭兵'" class="button-group">
          <button @click="resolveMercenary(true)" class="btn-ink" :disabled="character.gold < 7 || followers.length >= character.followerCurrent">💖 治療して味方にする (金貨7枚消費)</button>
          <button @click="resolveMercenary(false)" class="btn-ink btn-secondary">無視して進む</button>
        </div>

        <!-- Captive NPC -->
        <div v-else-if="activeEvent.npcType === 'captive' || activeEvent.title === '逃亡中の捕虜'" class="button-group">
          <button @click="resolveCaptive(true)" class="btn-ink">⛓️ ロープで縛って捕虜にする</button>
          <button @click="resolveCaptive(false)" class="btn-ink btn-secondary">無視して進む</button>
        </div>

        <!-- Alan NPC (Event 25) -->
        <div v-else-if="activeEvent.npcType === 'alan'" class="button-group" style="flex-direction: column; gap: 10px;">
          <div v-if="!activeEvent.alanChoiceState" style="width: 100%;">
            <button @click="rollAlanReaction" class="btn-ink btn-large" style="width: 100%;">🎲 アランの反応チェックを行う</button>
          </div>
          <div v-else-if="activeEvent.alanChoiceState === 'neutral'" style="display: flex; flex-direction: column; gap: 8px; width: 100%;">
            <p style="font-size: 0.9rem; color: #8c1c1c; font-weight: bold; margin: 0 0 5px 0; text-align: center;">アラン「あきらめろ。これは私が持ち帰る」</p>
            <button @click="resolveAlanNeutral('leave')" class="btn-ink btn-secondary" style="width: 100%;">🚪 アダマンタイトを諦めて立ち去る</button>
            <button @click="resolveAlanNeutral('fight')" class="btn-ink btn-red" style="width: 100%;">⚔️ 諦めずに戦い奪い取る (全体戦闘)</button>
            <button @click="resolveAlanNeutral('duel')" class="btn-ink btn-red" style="width: 100%;">⚔️ 1対1の決闘を受ける (ボーナスあり)</button>
          </div>
        </div>

        <!-- Painting NPC (Event 53) -->
        <div v-else-if="activeEvent.npcType === 'dread_painting'" class="button-group" style="flex-direction: column; gap: 10px;">
          <div v-if="!activeEvent.paintingState" style="width: 100%;">
            <button @click="rollPaintingLuck" class="btn-ink btn-large" style="width: 100%;">✨ 幸運判定ロールを行う (判定値: 4)</button>
          </div>
          <div v-else-if="activeEvent.paintingState === 'ranged_chance'" style="display: flex; flex-direction: column; gap: 8px; width: 100%;">
            <p style="font-size: 0.9rem; color: #1e5a38; font-weight: bold; margin: 0 0 5px 0; text-align: center;">僧侶の企みに気づいた！ 召喚前に狙撃できます！</p>
            <button @click="rollPaintingRanged" class="btn-ink btn-large" style="width: 100%;">🏹 遠距離攻撃を行う (目標値: 3)</button>
          </div>
        </div>

        <!-- Right Arm NPC (Event 61) -->
        <div v-else-if="activeEvent.npcType === 'heracles_right'" class="button-group" style="flex-direction: column; gap: 10px;">
          <div v-if="!activeEvent.rightArmState" style="width: 100%; display: flex; flex-direction: column; gap: 8px;">
            <button 
              v-if="character.items.some(i => i.name === '青の聖石')" 
              @click="useRightArmStone" 
              class="btn-ink btn-large" 
              style="width: 100%; font-weight: bold; background: #e0f2f1; border-color: #4db6ac; color: #00796b;"
            >
              💎 青の聖石を使用して、怪力王の魂を救う
            </button>
            <button @click="rollRightArmReaction" class="btn-ink btn-large" style="width: 100%;">🎲 反応チェックを行う</button>
          </div>
          <div v-else-if="activeEvent.rightArmState === 'ignore_choice'" style="display: flex; flex-direction: column; gap: 8px; width: 100%;">
            <p style="font-size: 0.9rem; color: #1e5a38; font-weight: bold; margin: 0 0 5px 0; text-align: center;">右腕はあなたに気づいていません。</p>
            <button @click="resolveRightArmIgnore(true)" class="btn-ink btn-secondary" style="width: 100%;">🚪 無視して先に進む</button>
            <button @click="resolveRightArmIgnore(false)" class="btn-ink btn-red" style="width: 100%;">⚔️ あえて戦闘を仕掛ける</button>
          </div>
        </div>

        <!-- Left Arm NPC (Event 62) -->
        <div v-else-if="activeEvent.npcType === 'heracles_left'" class="button-group" style="flex-direction: column; gap: 10px;">
          <div v-if="!activeEvent.leftArmState" style="width: 100%; display: flex; flex-direction: column; gap: 8px;">
            <button 
              v-if="character.items.some(i => i.name === '赤の聖石')" 
              @click="useLeftArmStone" 
              class="btn-ink btn-large" 
              style="width: 100%; font-weight: bold; background: #ffebee; border-color: #ef5350; color: #c62828;"
            >
              💎 赤の聖石を使用して、怪力王の魂を救う
            </button>
            <button @click="rollLeftArmReaction" class="btn-ink btn-large" style="width: 100%;">🎲 反応チェックを行う</button>
          </div>
          <div v-else-if="activeEvent.leftArmState === 'ignore_choice'" style="display: flex; flex-direction: column; gap: 8px; width: 100%;">
            <p style="font-size: 0.9rem; color: #1e5a38; font-weight: bold; margin: 0 0 5px 0; text-align: center;">左腕はあなたに気づいていません。</p>
            <button @click="resolveLeftArmIgnore(true)" class="btn-ink btn-secondary" style="width: 100%;">🚪 無視して先に進む</button>
            <button @click="resolveLeftArmIgnore(false)" class="btn-ink btn-red" style="width: 100%;">⚔️ あえて戦闘を仕掛ける</button>
          </div>
        </div>

        <!-- Jill-Mega NPC -->
        <div v-else-if="activeEvent.npcType === 'jill_mega'" class="button-group">
          <button @click="resolveJillMega(true)" class="btn-ink">⚔️ ジル＝メガを手助けする</button>
          <button @click="resolveJillMega(false)" class="btn-ink btn-secondary">🚪 放っておいて先に進む</button>
        </div>

        <!-- Fallback explore room clear -->
        <div v-else>
          <div v-if="isBackpackOverLimit" class="overlimit-warning-banner" style="background: rgba(140, 28, 28, 0.1); border: 1px solid #8c1c1c; padding: 12px; border-radius: 4px; color: #8c1c1c; font-size: 0.9rem; margin-bottom: 10px; text-align: left;">
            ⚠️ <b>背負い袋の容量制限を超過しています！</b><br/>
            右側の「キャラクター記録紙」から、不要な武器・道具を「捨てる」か、装備を変更して空きスロットを作ってください。（整理が完了するまで次の部屋に進めません）
          </div>
          <button @click="confirmEventResolution" class="btn-ink" :disabled="isBackpackOverLimit">次の小部屋へ進む</button>
        </div>
      </div>
      </div>
    </div>

    <!-- Perception Choice Panel -->
    <div v-else-if="combatState.pendingPerception" class="exploration-deck paper-sheet" style="border: 2px dashed var(--ink-dark); padding: 20px; background: rgba(92, 75, 61, 0.05); border-radius: 6px; text-align: center; margin-top: 15px;">
      <div class="adventure-text" style="margin-bottom: 15px;">
        <h3 style="font-family: 'Noto Serif JP', serif; color: var(--ink-dark); margin: 0 0 10px 0;">🧭 危険を察知しました！</h3>
        <p style="font-size: 0.95rem; margin: 0;">
          発見した小部屋: <b>{{ combatState.pendingPerception.event.title }}</b> (d66出目: {{ combatState.pendingPerception.rollValue }})
        </p>
        <p style="font-size: 0.85rem; color: var(--ink-light); margin-top: 5px; font-style: italic;">
          ※「察知」を試みて成功（目標値4）すれば、この部屋を避けてd66を振り直すことができます。
        </p>
      </div>

      <div style="display: flex; flex-direction: column; gap: 10px; width: 100%;">
        <button 
          v-if="combatState.pendingPerception.hasScout"
          @click="executePerceptionScout" 
          class="btn-ink btn-large btn-spell"
          style="justify-content: center;"
        >
          🧭 従者の斥候に【察知】を依頼する (器用点消費なし)
        </button>
        <button 
          v-if="combatState.pendingPerception.hasHero && character.subStatCurrent >= 1"
          @click="executePerceptionHero" 
          class="btn-ink btn-large btn-strength"
          style="justify-content: center;"
        >
          🧭 主人公が【察知】を行う (器用点1消費, 残り: {{ character.subStatCurrent }})
        </button>
        <button @click="confirmPerceptionSkip" class="btn-ink btn-large btn-primary-ink" style="background: var(--ink-dark); color: white; justify-content: center;">
          🚪 察知せずに部屋に入る
        </button>
      </div>
    </div>

    <!-- Normal exploration deck -->
    <div v-else class="exploration-deck">
      <!-- 1周目の出自選択 -->
      <template v-if="activeScenario?.id === 'pyramid_of_chronodemon' && pyramidRunCount === 1 && !(character as any).pyramidOriginChosen">
        <!-- 共通プロローグをまず読ませる -->
        <template v-if="!(character as any).pyramidIntroRead">
          <div class="adventure-text" style="margin-bottom: 15px; font-size: 0.95rem; line-height: 1.6; max-height: 300px; overflow-y: auto; padding: 10px; border: 1px dashed var(--ink-dark); border-radius: 4px; background: #faf6f0; text-align: left;">
            <p style="white-space: pre-wrap; font-family: 'Noto Serif JP', serif; color: var(--ink-dark); margin: 0;">{{ (activeScenario as any).prologues?.["1"]?.common?.text }}</p>
          </div>
          <button @click="(character as any).pyramidIntroRead = true" class="btn-ink btn-large" style="justify-content: center; width: 100%;">
            📜 背景を確認し、自分の所属（出自）の選択へ進む
          </button>
        </template>
        <!-- その後、出自を選択させる -->
        <template v-else>
          <div class="adventure-text" style="margin-bottom: 15px;">
            <p>📜 君のキャラクターの資質（年齢や出自）に見合った〈冒険の始まり〉を選んでください。</p>
          </div>
          <div class="custom-choices-panel" style="display: flex; flex-direction: column; gap: 8px; width: 100%;">
            <button @click="choosePyramidOrigin('polomeia')" class="btn-ink btn-large" style="justify-content: center;">
              👑 ポロメイア王国の若者として開始 (ブローチ獲得)
            </button>
            <button @click="choosePyramidOrigin('almaciuda')" class="btn-ink btn-large" style="justify-content: center;">
              🦂 アルマシウダ帝国の大人として開始
            </button>
          </div>
        </template>
      </template>

      <!-- 各周回の準備フェーズ (プロローグ読了・アイテム配布) -->
      <template v-else-if="activeScenario?.id === 'pyramid_of_chronodemon' && (character as any).pyramidPrepRun !== pyramidRunCount">
        <div class="adventure-text" style="margin-bottom: 15px;">
          <h3 style="font-family: 'Noto Serif JP', serif; color: var(--ink-dark); margin: 0 0 10px 0;">🧭 冒険のはじまり ({{ pyramidRunCount }}回目 / 3)</h3>
          <p>ピラミッドへ入る前に、現在の状況を確認し、支給品を受け取りましょう。</p>
        </div>
        
        <button @click="startPyramidPrep" class="btn-ink btn-large btn-explore" style="justify-content: center; width: 100%;">
          📜 状況を確認して支給品を受け取る
        </button>
      </template>

      <!-- 3周目のスライダー商会 (準備フェーズ中かつ未完了の場合) -->
      <template v-else-if="activeScenario?.id === 'pyramid_of_chronodemon' && pyramidRunCount === 3 && !(character as any).pyramidSliderShopDone">
        <div class="slider-shop-panel" style="width: 100%; border: 2px solid var(--ink-dark); padding: 20px; border-radius: 6px; background: #fbf8f3; text-align: left;">
          <h3 style="font-family: 'Noto Serif JP', serif; color: var(--ink-dark); margin: 0 0 10px 0; text-align: center;">🔨 スライダー商会</h3>
          <p style="font-size: 0.95rem; line-height: 1.6; color: var(--ink-light); margin-bottom: 15px;">
            ビウレスの一流鍛冶屋スライダー親方に金貨を支払い、所持している貴重な素材を強力な武具へ加工してもらうことができます。(3周目の探索開始前のみ利用可能)
          </p>

          <!-- レシピ一覧 -->
          <div style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 20px;">
            <div v-for="recipe in sliderRecipes" :key="recipe.id" class="recipe-card" style="border: 1px dashed rgba(92, 75, 61, 0.4); padding: 12px; border-radius: 4px; display: flex; justify-content: space-between; align-items: center; background: white;">
              <div>
                <span style="font-weight: bold; font-size: 0.95rem; color: var(--ink-dark);">🛠️ {{ recipe.name }}</span><br/>
                <small style="color: var(--ink-light);">
                  必要: {{ recipe.requiredItem }} ({{ hasMaterial(recipe.requiredItem) ? '所持' : '未所持' }}) & 金貨 {{ recipe.goldCost }} 枚
                </small>
              </div>
              <button 
                @click="forgeItem(recipe)" 
                class="btn-ink btn-mini" 
                :disabled="!canForge(recipe)"
              >
                加工する
              </button>
            </div>
          </div>

          <div style="display: flex; gap: 10px;">
            <button @click="finishSliderShop" class="btn-ink btn-large btn-primary-ink" style="flex: 1; justify-content: center;">
              🚪 取引を終えて探索を開始する
            </button>
          </div>
        </div>
      </template>

      <!-- 通常の探索開始ダイスボタン -->
      <template v-else>
        <div class="adventure-text">
          <p>d66ダイスを振ってその「できごと」を確認してください。</p>
        </div>

        <button @click="exploreNextRoom" class="btn-ink btn-large btn-explore">
          🎲 d66を振って次の部屋を探索する
        </button>
      </template>
    </div>
  </div>
</template>

<style scoped>
.explorer-card {
  padding: 30px;
  border-radius: 6px;
  box-shadow: var(--card-shadow);
  border: 3px double var(--ink-dark);
}

.explorer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 2px solid var(--ink-dark);
  margin-bottom: 20px;
  padding-bottom: 10px;
}

.explorer-header h2 {
  font-family: 'Noto Serif JP', serif;
  font-size: 1.4rem;
  color: var(--ink-dark);
  margin: 0;
}

.badge-depth {
  background: var(--ink-dark);
  color: var(--paper-bg);
  font-family: 'Noto Serif JP', serif;
  font-weight: bold;
  font-size: 0.9rem;
  padding: 4px 10px;
  border-radius: 4px;
}

.event-panel {
  border: 2px solid var(--ink-dark);
  background: #fbf8f3;
  padding: 20px;
  border-radius: 6px;
  box-shadow: inset 0 0 10px rgba(0,0,0,0.05);
  margin-top: 15px;
}

.event-type-badge {
  display: inline-block;
  font-size: 0.75rem;
  font-weight: bold;
  padding: 2px 8px;
  border-radius: 3px;
  color: #fff;
  background: #705844;
  margin-bottom: 10px;
  font-family: 'Noto Serif JP', serif;
}

.event-type-badge.trap { background: #8c1c1c; }
.event-type-badge.treasure { background: #b8860b; }
.event-type-badge.rest { background: #2e8b57; }
.event-type-badge.npc { background: #4682b4; }

.event-title {
  font-family: 'Noto Serif JP', serif;
  font-size: 1.3rem;
  font-weight: bold;
  color: var(--ink-dark);
  margin-top: 0;
  margin-bottom: 12px;
}

.event-description {
  font-size: 1.05rem;
  line-height: 1.6;
  color: #4a3c31;
  margin-bottom: 25px;
  white-space: pre-wrap;
  text-align: left;
}

.event-actions {
  display: flex;
  justify-content: center;
}

.button-group {
  display: flex;
  gap: 15px;
  flex-wrap: wrap;
  justify-content: center;
}

.merchant-menu {
  background: #fff;
  border: 2px solid var(--ink-dark);
  padding: 20px;
  border-radius: 6px;
  margin-top: 15px;
  width: 100%;
  box-shadow: 0 4px 10px rgba(0,0,0,0.1);
  box-sizing: border-box;
}

.menu-title {
  font-family: 'Noto Serif JP', serif;
  font-size: 1.1rem;
  color: var(--ink-dark);
  border-bottom: 1px solid var(--ink-dark);
  margin-top: 0;
  margin-bottom: 15px;
  padding-bottom: 5px;
}

.merch-cat {
  margin-bottom: 15px;
  border-bottom: 1px dashed #e8e0d4;
  padding-bottom: 15px;
}

.merch-cat h5 {
  font-family: 'Noto Serif JP', serif;
  margin: 0 0 10px 0;
  font-size: 0.95rem;
  color: #705844;
}

.merch-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.merch-item {
  border: 1px solid #e8e0d4;
  padding: 8px 10px;
  border-radius: 4px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.85rem;
  background: #faf8f5;
}

.fol-details {
  line-height: 1.2;
}

.fol-sub-desc {
  font-size: 0.7rem;
  color: #8c715c;
}

.btn-leave {
  display: block;
  width: 100%;
  margin-top: 15px;
}

.adventure-text {
  font-size: 1.05rem;
  line-height: 1.6;
  color: #4a3c31;
  margin-bottom: 30px;
}

.btn-explore {
  display: block;
  margin: 0 auto;
  padding: 15px 40px;
  font-size: 1.2rem;
  font-weight: bold;
}

.btn-red {
  border-color: #8c1c1c !important;
  color: #8c1c1c !important;
}

.btn-red:hover {
  background: #fdf2f2 !important;
}

.clear-stamp {
  font-family: 'Noto Serif JP', serif;
  font-weight: 900;
  font-size: 1.1rem;
  color: #5b7052;
  border: 2px solid #5b7052;
  padding: 3px 12px;
  display: inline-block;
  transform: rotate(-3deg);
  border-radius: 4px;
  letter-spacing: 0.1em;
  background: rgba(91, 112, 82, 0.05);
  box-shadow: 0 0 3px rgba(91, 112, 82, 0.15);
}

.btn-primary-ink {
  background: var(--ink-dark) !important;
  color: var(--paper-bg) !important;
  border-color: var(--ink-dark) !important;
  box-shadow: 2px 2px 0 rgba(0,0,0,0.3) !important;
}

.btn-primary-ink:hover:not(:disabled) {
  background: var(--ink-light) !important;
  box-shadow: 3px 3px 0 rgba(0,0,0,0.3) !important;
}

@media (max-width: 600px) {
  .explorer-card {
    padding: 20px 15px;
  }
  .explorer-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }
  .merch-grid {
    grid-template-columns: 1fr;
  }
  .button-group {
    flex-direction: column;
    gap: 10px;
    width: 100%;
  }
  .button-group .btn-ink {
    width: 100%;
  }
  .btn-explore {
    padding: 12px 25px;
    font-size: 1.05rem;
    width: 100%;
  }
}
</style>
