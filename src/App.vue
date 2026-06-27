<script setup lang="ts">
import { computed } from 'vue';
import { useGameState } from './composables/useGameState';
import { DEFAULT_ITEMS, DEFAULT_WEAPONS, DEFAULT_SHIELDS, DEFAULT_ARMORS } from './composables/useGameState';
import type { Weapon, Armor, Shield, GeneralItem } from './types';
import ScenarioSelector from './components/ScenarioSelector.vue';
import CharacterCreator from './components/CharacterCreator.vue';
import AdventureSheet from './components/AdventureSheet.vue';
import DiceRoller from './components/DiceRoller.vue';
import DungeonExplorer from './components/DungeonExplorer.vue';
import CombatSimulator from './components/CombatSimulator.vue';

const {
  currentScreen,
  character,
  followers,
  dungeonDepth,
  totalRoomsToClear,
  logs,
  spendExpForStat,
  restoreStatsAfterAdventure,
  buyFollower,
  equipArmor,
  addLog,
  clearLogs
} = useGameState();

const ALL_SPELLS = [
  { name: '気絶', desc: '弱い敵を眠らせて無力化する。アンデッド等には無効。' },
  { name: '炎球', desc: '敵全体への攻撃魔法。狭い場所ほど威力が上がる。' },
  { name: '氷槍', desc: '敵1体に2点ダメージを与える強力な氷の槍。' },
  { name: '速撃', desc: '先制呪文。反応確認後でもプレイヤーが先制攻撃できる。' },
  { name: '武具創造', desc: '武器・防具を創造する（両手武器や盾など。冒険終了時消失）。' },
  { name: '友情', desc: 'ワイロ金額を10分の1にするか、反応チェックの出目を±1する。' },
];

const ALL_MIRACLES = [
  { name: '防衛', desc: '戦闘中、味方全体の防御ロールに+1の修正を与える。' },
  { name: 'そらし', desc: '受けた飛び道具（矢や石）のダメージを無効化する。' },
  { name: '聖洗脳', desc: '弱い敵が1体だけになった時、幸運判定で捕虜にする。' },
  { name: '招天', desc: 'アンデッドのみに効く光の矢（弱敵は即死、強敵は1ダメージ）を2回放つ。' },
  { name: '聖餐', desc: '食料で回復する生命力をさらに+1点増やす。' },
  { name: '祝福', desc: '呪い・石化・麻痺の状態異常を1つ即座に解除する。' },
];

const learnableSpells = computed(() => {
  if (character.value.subStatType === 'magic') {
    return ALL_SPELLS.filter(s => !character.value.spells.includes(s.name));
  } else if (character.value.subStatType === 'luck') {
    return ALL_MIRACLES.filter(m => !character.value.miracles.includes(m.name));
  }
  return [];
});

const canLearnSpells = computed(() => {
  if (character.value.subStatType !== 'magic' && character.value.subStatType !== 'luck') {
    return false;
  }
  const allowed = Math.floor(character.value.subStatMax / 2);
  const currentCount = character.value.subStatType === 'magic' 
    ? character.value.spells.length 
    : character.value.miracles.length;
  return currentCount < allowed;
});

function learnSpell(name: string) {
  const allowed = Math.floor(character.value.subStatMax / 2);
  if (character.value.subStatType === 'magic') {
    if (character.value.spells.length >= allowed) return;
    character.value.spells.push(name);
    addLog(`🔮 魔術 【${name}】 を習得しました！`, 'success');
  } else if (character.value.subStatType === 'luck') {
    if (character.value.miracles.length >= allowed) return;
    character.value.miracles.push(name);
    addLog(`🕊️ 奇跡 【${name}】 を習得しました！`, 'success');
  }
}

const townWeapons = [
  { ...DEFAULT_WEAPONS.light },
  { ...DEFAULT_WEAPONS.oneHanded },
  { ...DEFAULT_WEAPONS.twoHanded },
  { ...DEFAULT_WEAPONS.sling },
  { ...DEFAULT_WEAPONS.bow }
] as Weapon[];

const townArmors = [
  { ...DEFAULT_ARMORS.cloth },
  { ...DEFAULT_ARMORS.leather },
  { ...DEFAULT_ARMORS.chain },
  { ...DEFAULT_ARMORS.plate }
] as Armor[];

const townShields = [
  { ...DEFAULT_SHIELDS.wood },
  { ...DEFAULT_SHIELDS.round }
] as Shield[];

const townItems = [
  { ...DEFAULT_ITEMS.lantern, value: 0 },
  { ...DEFAULT_ITEMS.rope, value: 0 },
  { ...DEFAULT_ITEMS.holywater, value: 0 },
  { ...DEFAULT_ITEMS.potion, value: 0 }
] as Omit<GeneralItem, 'id'>[];

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

function buyWeapon(w: Weapon) {
  if (character.value.gold < w.goldCost) return;
  character.value.gold -= w.goldCost;
  character.value.weapons.push({ ...w });
  addLog(`街の市場で [${w.name}] を購入しました。(金貨${w.goldCost}枚消費)`, 'success');
}

function buyArmor(a: Armor) {
  if (character.value.gold < a.goldCost) return;

  if (character.value.armors.length >= 1) {
    const oldArmor = character.value.armors[0];
    const isEquipped = character.value.equippedArmor?.name === oldArmor.name;
    if (isEquipped) {
      equipArmor(null);
    }
    character.value.armors = [];
    addLog(`古い防具 [${oldArmor.name}] を処分しました。`, 'info');
  }

  character.value.gold -= a.goldCost;
  character.value.armors.push({ ...a });
  addLog(`街の市場で [${a.name}] を購入しました。(金貨${a.goldCost}枚消費)`, 'success');
  equipArmor(character.value.armors[0]);
}

function buyShield(s: Shield) {
  if (character.value.gold < s.goldCost) return;
  character.value.gold -= s.goldCost;
  character.value.shields.push({ ...s });
  addLog(`街の市場で [${s.name}] を購入しました。(金貨${s.goldCost}枚消費)`, 'success');
}

function buyItem(item: Omit<GeneralItem, 'id'>) {
  if (character.value.gold < item.goldCost) return;
  character.value.gold -= item.goldCost;
  character.value.items.push({
    ...item,
    id: Math.random().toString(36).substring(2, 9)
  } as GeneralItem);
  addLog(`街の市場で [${item.name}] を購入しました。(金貨${item.goldCost}枚消費)`, 'success');
}

// Resolve dungeon victory, move to next adventure level-up
function proceedToNextAdventure() {
  restoreStatsAfterAdventure();
  // Clear depth
  dungeonDepth.value = 0;
  // Award 1 EXP for victory
  character.value.exp += 1;
  character.value.level += 1;
  addLog(`🎉 ダンジョンクリア報酬！ 経験値 +1。新しいレベルは ${character.value.level} です。`, 'success');
  currentScreen.value = 'scenario_select';
}

// Re-try after death (Rule 41)
function handleRetry() {
  const prevLevel = character.value.level;
  const subType = character.value.subStatType;
  
  // Rule 41: starting exp = previous level instead of 10
  const carryExp = prevLevel;
  // Starting gold = 10 + 50 per level above 10
  const bonusGold = 10 + (prevLevel > 10 ? (prevLevel - 10) * 50 : 0);

  // Initialize character state
  character.value = {
    name: character.value.name,
    level: prevLevel,
    exp: carryExp,
    gold: bonusGold,
    food: 2,
    skillMax: 0,
    skillCurrent: 0,
    lifeMax: 4,
    lifeCurrent: 4,
    subStatType: subType,
    subStatMax: 2,
    subStatCurrent: 2,
    followerMax: 7,
    followerCurrent: 7,
    spells: subType === 'magic' ? ['気絶'] : [], // Rule 18 compliance (1 spell)
    miracles: subType === 'luck' ? ['防衛'] : [], // Rule 20 compliance (1 miracle)
    weapons: [],
    armors: [],
    shields: [],
    items: [],
    equippedWeapon: null,
    equippedArmor: null,
    equippedShield: null,
    hasActiveLantern: true,
  };

  // Re-equip starting items
  if (subType === 'magic') {
    character.value.weapons.push({ name: '軽い武器 (短剣等)', type: 'light', modAttack: -1, attribute: 'strike', goldCost: 2, isMagic: false, description: '軽い武器' });
    character.value.armors.push({ name: '布鎧', type: 'cloth', modLife: 1, modDex: 1, modDef: 0, goldCost: 4, description: '布鎧' });
    character.value.equippedWeapon = character.value.weapons[0];
    character.value.equippedArmor = character.value.armors[0];
  } else if (subType === 'luck') {
    character.value.weapons.push({ name: '片手武器 (長剣/メイス)', type: 'one-handed', modAttack: 0, attribute: 'slash', goldCost: 5, isMagic: false, description: '片手武器' });
    character.value.armors.push({ name: '鎖鎧', type: 'chain', modLife: 1, modDex: 0, modDef: 1, goldCost: 30, description: '鎖鎧' });
    character.value.shields.push({ name: '木盾', type: 'wood', modLife: 1, modDefRanged: 0, goldCost: 5, description: '木盾' });
    character.value.equippedWeapon = character.value.weapons[0];
    character.value.equippedArmor = character.value.armors[0];
    character.value.equippedShield = character.value.shields[0];
  } else if (subType === 'strength') {
    character.value.weapons.push({ name: '両手武器 (大剣/戦斧)', type: 'two-handed', modAttack: 1, attribute: 'slash', goldCost: 15, isMagic: false, description: '両手武器' });
    character.value.armors.push({ name: '板金鎧', type: 'plate', modLife: 2, modDex: 0, modDef: 1, goldCost: 50, description: '板金鎧' });
    character.value.equippedWeapon = character.value.weapons[0];
    character.value.equippedArmor = character.value.armors[0];
  } else if (subType === 'dexterity') {
    character.value.weapons.push({ name: '弓と十分な矢', type: 'ranged', modAttack: 0, attribute: 'slash', goldCost: 18, isMagic: false, description: '弓矢' });
    character.value.armors.push({ name: '革鎧', type: 'leather', modLife: 2, modDex: 1, modDef: 0, goldCost: 10, description: '革鎧' });
    character.value.equippedWeapon = character.value.weapons[0];
    character.value.equippedArmor = character.value.armors[0];
  }

  // Everyone gets a lantern
  character.value.items.push({
    id: Math.random().toString(36).substring(2, 9),
    name: 'ランタン',
    type: 'lantern',
    goldCost: 2,
    value: 0,
    description: 'ランタン',
  });

  // Rule 30: Adjust lifeMax and lifeCurrent based on equipped armor and shield at start
  if (character.value.equippedArmor) {
    character.value.lifeMax += character.value.equippedArmor.modLife;
  }
  if (character.value.equippedShield) {
    character.value.lifeMax += character.value.equippedShield.modLife;
  }
  character.value.lifeCurrent = character.value.lifeMax;

  clearLogs();
  addLog(`💀 再挑戦！ レベル ${prevLevel} の強さを受け継ぎ、新しい体で復活しました。経験点 ${carryExp} 点を配分して金貨 ${bonusGold} 枚でリスタートします。`, 'success');
  currentScreen.value = 'levelup';
}

function startAdventure() {
  currentScreen.value = 'explore';
  addLog('🧭 さあ、暗い地下迷宮へと歩みを進めましょう！ 生きて宝を持ち帰るのだ。', 'success');
}
</script>

<template>
  <div class="tabletop-container">
    <!-- TOP ROW: Calligraphic Logbook -->
    <div v-if="currentScreen !== 'creator' && currentScreen !== 'scenario_select'" class="narrative-logbook-container" style="margin-bottom: 5px;">
      <div class="logbook-header">📜 冒険の足跡 (Log Ledger)</div>
      <div class="logbook-entries">
        <div 
          v-for="log in logs" 
          :key="log.id" 
          class="log-entry" 
          :class="log.type"
        >
          <span class="log-bullet">■</span>
          <span class="log-text">{{ log.text }}</span>
        </div>
        <div v-if="logs.length === 0" class="empty-logs">迷宮の扉が開かれました。あなたの歩みがここに記されます...</div>
      </div>
    </div>

    <div class="desktop-layout">
      
      <!-- LEFT COLUMN: Main Opened Gamebook -->
      <div class="left-book-section">
        <!-- Render current view -->
        <ScenarioSelector v-if="currentScreen === 'scenario_select'" />
        
        <CharacterCreator v-else-if="currentScreen === 'creator'" />
        
        <DungeonExplorer v-else-if="currentScreen === 'explore'" />
        
        <CombatSimulator v-else-if="currentScreen === 'combat'" />

        <!-- LEVEL UP STAT ALLOCATOR LEDGER -->
        <div v-else-if="currentScreen === 'levelup'" class="levelup-card paper-sheet">
          <h2 class="ledger-title">🖋️ 冒険者の強化記録紙 (Level Up Ledger)</h2>
          <p class="ledger-desc">迷宮に入る前に、経験点を消費して能力値の最大値を上昇させることができます。</p>
          
          <div class="exp-pool">
            <span>所持経験点: <b>{{ character.exp }}</b> 点</span>
          </div>

          <div class="ledger-rows">
            <!-- Skill -->
            <div class="ledger-row">
              <span class="row-label">🎓 <b>技量点 (Skill):</b></span>
              <span class="row-val">{{ character.skillMax }} / 2 (限界値)</span>
              <button 
                @click="spendExpForStat('skill')" 
                class="btn-ink btn-mini" 
                :disabled="character.exp < 4 || character.skillMax >= 2"
              >
                +1上昇 (4 EXP)
              </button>
            </div>

            <!-- Life -->
            <div class="ledger-row">
              <span class="row-label">❤️ <b>生命点 (Life):</b></span>
              <span class="row-val">{{ character.lifeMax }} / 8 (限界値)</span>
              <button 
                @click="spendExpForStat('life')" 
                class="btn-ink btn-mini" 
                :disabled="character.exp < 1 || character.lifeMax >= 8"
              >
                +1上昇 (1 EXP)
              </button>
            </div>

            <!-- Sub-stat -->
            <div class="ledger-row">
              <span class="row-label">🔮 <b>副能力値 (Sub-stat):</b></span>
              <span class="row-val">{{ character.subStatMax }} / 6 (限界値)</span>
              <button 
                @click="spendExpForStat('sub')" 
                class="btn-ink btn-mini" 
                :disabled="character.exp < 1 || character.subStatMax >= 6"
              >
                +1上昇 (1 EXP)
              </button>
            </div>

            <!-- Follower slots -->
            <div class="ledger-row">
              <span class="row-label">👥 <b>従者点 (Followers):</b></span>
              <span class="row-val">{{ character.followerMax }} / 9 (限界値)</span>
              <button 
                @click="spendExpForStat('follower')" 
                class="btn-ink btn-mini" 
                :disabled="character.exp < 2 || character.followerMax >= 9"
              >
                +1上昇 (2 EXP)
              </button>
            </div>
          </div>

          <!-- Spells / Miracles Learning Section (Rule 18 / 20) -->
          <div v-if="canLearnSpells" class="spell-learning-section" style="margin-top: 25px; padding: 20px; background: rgba(75, 0, 130, 0.05); border: 2px dashed #4b0082; border-radius: 6px;">
            <h3 style="margin-top: 0; font-family: 'Noto Serif JP', serif; color: var(--ink-dark); font-size: 1.1rem; border-bottom: 1px dashed #4b0082; padding-bottom: 5px;">
              {{ character.subStatType === 'magic' ? '🔮 新たな魔術の習得' : '🕊️ 新たな奇跡の習得' }} 
              (空きスロット: {{ Math.floor(character.subStatMax / 2) - (character.subStatType === 'magic' ? character.spells.length : character.miracles.length) }}つ)
            </h3>
            <p style="font-size: 0.85rem; color: #555; margin-bottom: 15px;">
              副能力値の最大値が上昇したため、新たな魔法を修得できます。（最大習得数: 魔術点/幸運点の半分）
            </p>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
              <button 
                v-for="spell in learnableSpells" 
                :key="spell.name" 
                @click="learnSpell(spell.name)"
                class="btn-ink btn-mini"
                style="justify-content: flex-start; text-align: left; height: auto; padding: 8px 12px; display: flex; flex-direction: column; gap: 2px;"
              >
                <b style="font-size: 0.9rem;">{{ spell.name }}</b>
                <span style="font-size: 0.7rem; font-weight: normal; color: #555;">{{ spell.desc }}</span>
              </button>
            </div>
          </div>

          <div v-else-if="character.subStatType === 'magic' || character.subStatType === 'luck'" class="spell-learning-section" style="margin-top: 25px; padding: 20px; background: rgba(0, 0, 0, 0.02); border: 1px dashed #c2b09a; border-radius: 6px;">
            <h3 style="margin-top: 0; font-family: 'Noto Serif JP', serif; color: var(--ink-dark); font-size: 1.1rem; border-bottom: 1px dashed #c2b09a; padding-bottom: 5px;">
              {{ character.subStatType === 'magic' ? '🔮 習得済みの魔術一覧' : '🕊️ 習得済みの奇跡一覧' }} 
              ({{ (character.subStatType === 'magic' ? character.spells.length : character.miracles.length) }} / {{ Math.floor(character.subStatMax / 2) }} スロット使用中)
            </h3>
            <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-top: 10px;">
              <span 
                v-for="name in (character.subStatType === 'magic' ? character.spells : character.miracles)" 
                :key="name" 
                class="badge-stat"
                style="background: #e8e0d4; padding: 5px 10px; border-radius: 4px; font-weight: bold; font-size: 0.85rem;"
              >
                {{ name }}
              </span>
            </div>
          </div>

          <!-- TOWN MARKET & RECRUITER (Rule 28 & 32 Compliance) -->
          <div class="divider"></div>
          
          <div class="town-market">
            <h3 class="ledger-title" style="font-size: 1.1rem; border-bottom: 1px dashed var(--ink-dark); margin-top: 10px;">🛒 街の市場 ＆ 従者スカウト (Town Market & Recruiter)</h3>
            <p class="ledger-desc" style="font-size: 0.85rem; margin-bottom: 15px;">
              冒険へ旅立つ前に、初期の金貨を使って基礎的な装備の購入や従者を雇うことができます。
              <br/>
              <b>所持金貨:</b> <span style="color: #b8860b; font-weight: bold;">{{ character.gold }}</span> 枚 | 
              <b>従者枠:</b> <span style="font-weight: bold;">{{ followers.length }} / {{ character.followerCurrent }}</span> 人
            </p>
            
            <div class="market-grid-container" style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
              <!-- Left: Gear Shop -->
              <div class="shop-column" style="background: rgba(255,255,255,0.3); border: 1px solid #c2b09a; padding: 15px; border-radius: 4px; max-height: 250px; overflow-y: auto;">
                <h4 style="margin: 0 0 10px 0; font-family: 'Noto Serif JP', serif; font-size: 0.9rem; color: var(--ink-dark); border-bottom: 1px dashed #c2b09a; padding-bottom: 3px;">🛡️ 装備品・道具の店</h4>
                
                <div style="display: flex; flex-direction: column; gap: 8px;">
                  <!-- Weapons -->
                  <div style="font-weight: bold; font-size: 0.75rem; color: #705844;">近接/射撃武器:</div>
                  <div v-for="w in townWeapons" :key="w.name" style="display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem; border-bottom: 1px dashed #e8e0d4; padding: 3px 0;">
                    <span>{{ w.name }} ({{ w.goldCost }}g)</span>
                    <button @click="buyWeapon(w)" class="btn-ink btn-mini" :disabled="character.gold < w.goldCost">購入</button>
                  </div>

                  <!-- Armors -->
                  <div style="font-weight: bold; font-size: 0.75rem; color: #705844; margin-top: 5px;">胴防具 (鎧):</div>
                  <div v-for="a in townArmors" :key="a.name" style="display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem; border-bottom: 1px dashed #e8e0d4; padding: 3px 0;">
                    <span>{{ a.name }} ({{ a.goldCost }}g)</span>
                    <button @click="buyArmor(a)" class="btn-ink btn-mini" :disabled="character.gold < a.goldCost">購入</button>
                  </div>

                  <!-- Shields -->
                  <div style="font-weight: bold; font-size: 0.75rem; color: #705844; margin-top: 5px;">防盾:</div>
                  <div v-for="s in townShields" :key="s.name" style="display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem; border-bottom: 1px dashed #e8e0d4; padding: 3px 0;">
                    <span>{{ s.name }} ({{ s.goldCost }}g)</span>
                    <button @click="buyShield(s)" class="btn-ink btn-mini" :disabled="character.gold < s.goldCost">購入</button>
                  </div>

                  <!-- Consumables -->
                  <div style="font-weight: bold; font-size: 0.75rem; color: #705844; margin-top: 5px;">一般道具・消耗品:</div>
                  <div v-for="i in townItems" :key="i.name" style="display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem; border-bottom: 1px dashed #e8e0d4; padding: 3px 0;">
                    <span>{{ i.name }} ({{ i.goldCost }}g)</span>
                    <button @click="buyItem(i)" class="btn-ink btn-mini" :disabled="character.gold < i.goldCost">購入</button>
                  </div>
                </div>
              </div>

              <!-- Right: Followers Recruiting -->
              <div class="recruiter-column" style="background: rgba(255,255,255,0.3); border: 1px solid #c2b09a; padding: 15px; border-radius: 4px; max-height: 250px; overflow-y: auto;">
                <h4 style="margin: 0 0 10px 0; font-family: 'Noto Serif JP', serif; font-size: 0.9rem; color: var(--ink-dark); border-bottom: 1px dashed #c2b09a; padding-bottom: 3px;">👥 従者のスカウト・雇用</h4>
                
                <div style="display: flex; flex-direction: column; gap: 10px;">
                  <div v-for="f in hireableFollowers" :key="f.name" style="display: flex; flex-direction: column; gap: 3px; border-bottom: 1px dashed #e8e0d4; padding-bottom: 6px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem; font-weight: bold;">
                      <span>{{ f.name }} <span style="font-weight: normal; color: #705844; font-size: 0.75rem;">(費用: {{ f.cost }}g)</span></span>
                      <button @click="buyFollower(f.type as any)" class="btn-ink btn-mini" :disabled="character.gold < f.cost || followers.length >= character.followerCurrent">雇用</button>
                    </div>
                    <div style="font-size: 0.7rem; color: #8c715c; line-height: 1.2;">{{ f.desc }}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="divider"></div>

          <div class="actions">
            <button @click="startAdventure" class="btn-ink btn-large">
              🧭 冒険を開始する (迷宮の探索へ)
            </button>
          </div>
        </div>

        <!-- GAME OVER SCREEN -->
        <div v-else-if="currentScreen === 'gameover'" class="gameover-card paper-sheet">
          <h2 class="dead-title">💀 冒険者は息絶えた...</h2>
          <p class="dead-desc">地下の闇に飲まれ、生命力が0となりました。アランツァの冷酷な地底に骸が残されます。</p>
          
          <div class="dead-stats">
            <p>最終到達部屋数: <b>{{ dungeonDepth }} / {{ totalRoomsToClear }}</b></p>
            <p>最終レベル: <b>Lv.{{ character.level }}</b></p>
          </div>

          <div class="divider"></div>

          <div class="actions">
            <button @click="handleRetry" class="btn-ink btn-large btn-retry">
              🔄 レベルを受け継いで再挑戦する (Rule 41)
            </button>
          </div>
        </div>

        <!-- VICTORY SUCCESS SCREEN -->
        <div v-else-if="currentScreen === 'success'" class="victory-card paper-sheet">
          <h2 class="victory-title">🏆 迷宮踏破！ 冒険成功！</h2>
          <p class="victory-desc">最深部の魔将を打ち倒し、迷宮の生ける宝物を抱えて地上へと生還しました！</p>
          
          <div class="victory-stats">
            <p>獲得経験値: <b>+1 点</b></p>
            <p>生命力・技量・副能力値: <b>最大値まで全回復！</b></p>
          </div>

          <div class="divider"></div>

          <div class="actions">
            <button @click="proceedToNextAdventure" class="btn-ink btn-large btn-success-next">
              📜 経験点分配 ＆ 次の冒険へ旅立つ
            </button>
          </div>
        </div>
      </div>

      <!-- RIGHT COLUMN: Dice Roller & Character Sheet -->
      <div class="right-sidebar">
        <DiceRoller />
        <AdventureSheet v-if="currentScreen !== 'creator' && currentScreen !== 'scenario_select'" />
      </div>

    </div>
  </div>
</template>

<style>
/* Global styling variables for layouts */
.tabletop-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-height: calc(100vh - 40px);
}

.desktop-layout {
  display: grid;
  grid-template-columns: 3fr 2fr;
  gap: 20px;
}

.left-book-section {
  display: flex;
  flex-direction: column;
}

.right-sidebar {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

/* Growth stat ledger styling */
.levelup-card {
  padding: 30px;
  border-radius: 6px;
}

.ledger-title {
  font-family: 'Noto Serif JP', serif;
  font-weight: bold;
  font-size: 1.4rem;
  color: var(--ink-dark);
  border-bottom: 2px solid var(--ink-dark);
  margin-top: 0;
  margin-bottom: 15px;
  padding-bottom: 5px;
}

.ledger-desc {
  font-size: 0.95rem;
  line-height: 1.5;
  color: var(--ink-light);
  margin-bottom: 20px;
}

.exp-pool {
  background: #fbf8f3;
  border: 2px solid var(--ink-dark);
  border-radius: 4px;
  padding: 10px 15px;
  font-size: 1.1rem;
  font-family: 'Noto Serif JP', serif;
  display: inline-block;
  margin-bottom: 25px;
}

.exp-pool b {
  color: #8c1c1c;
  font-size: 1.3rem;
}

.ledger-rows {
  display: flex;
  flex-direction: column;
  gap: 15px;
  margin-bottom: 25px;
}

.ledger-row {
  display: flex;
  align-items: center;
  border-bottom: 1px dashed #c2b09a;
  padding-bottom: 10px;
}

.row-label {
  font-family: 'Noto Serif JP', serif;
  font-size: 1rem;
  color: var(--ink-dark);
  min-width: 180px;
}

.row-val {
  font-weight: bold;
  color: #705844;
  flex-grow: 1;
}

/* Calligraphic Logbook */
.narrative-logbook-container {
  background: var(--paper-bg);
  border: 3px double var(--ink-dark);
  box-shadow: var(--card-shadow);
  border-radius: 4px;
  padding: 15px;
}

.logbook-header {
  font-family: 'Noto Serif JP', serif;
  font-weight: bold;
  font-size: 1rem;
  color: var(--ink-dark);
  border-bottom: 1px solid var(--ink-dark);
  padding-bottom: 5px;
  margin-bottom: 10px;
}

.logbook-entries {
  height: 140px;
  overflow-y: scroll;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 5px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 4px;
}

.log-entry {
  font-family: 'Noto Serif JP', serif;
  font-size: 0.85rem;
  line-height: 1.4;
  display: flex;
  gap: 8px;
  align-items: flex-start;
}

.log-bullet {
  font-size: 0.6rem;
  margin-top: 4px;
  color: #8c715c;
}

/* Log type colors matching ink calligraphy style */
.log-entry.info { color: var(--ink-dark); }
.log-entry.roll { color: #5c4b3d; font-style: italic; }
.log-entry.combat { color: #4682b4; font-weight: bold; }
.log-entry.success { color: #2e8b57; font-weight: bold; }
.log-entry.error { color: #a52a2a; }
.log-entry.damage { color: #8c1c1c; font-weight: bold; animation: text-shake 0.3s ease; }

@keyframes text-shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-4px); }
  75% { transform: translateX(4px); }
}

.empty-logs {
  font-size: 0.85rem;
  color: #8c7664;
  font-style: italic;
  text-align: center;
  padding: 15px 0;
}

/* GameOver styling */
.gameover-card {
  padding: 40px;
  border-color: #8c1c1c;
  color: #8c1c1c;
  text-align: center;
}

.dead-title {
  font-family: 'Noto Serif JP', serif;
  font-size: 2rem;
  font-weight: 900;
  margin-top: 0;
  margin-bottom: 15px;
}

.dead-desc {
  color: #614a38;
  font-size: 1.05rem;
  line-height: 1.6;
  margin-bottom: 25px;
}

.dead-stats {
  background: #fdf2f2;
  border: 1px solid #f5c6cb;
  border-radius: 4px;
  display: inline-block;
  padding: 15px 30px;
  font-size: 1.1rem;
  color: #721c24;
  margin-bottom: 25px;
}

.btn-retry {
  border-color: #8c1c1c !important;
  color: #8c1c1c !important;
  box-shadow: 2px 2px 0 #8c1c1c !important;
  font-size: 1.1rem;
  padding: 12px 25px;
}

.btn-retry:hover {
  background: #fdf2f2 !important;
  box-shadow: 3px 3px 0 #8c1c1c !important;
}

/* Victory styling */
.victory-card {
  padding: 40px;
  border-color: #b8860b;
  text-align: center;
}

.victory-title {
  font-family: 'Noto Serif JP', serif;
  font-size: 2rem;
  color: #b8860b;
  margin-top: 0;
  margin-bottom: 15px;
}

.victory-desc {
  color: #4a3c31;
  font-size: 1.05rem;
  line-height: 1.6;
  margin-bottom: 25px;
}

.victory-stats {
  background: #fffff0;
  border: 1px solid #ffeeba;
  border-radius: 4px;
  display: inline-block;
  padding: 15px 30px;
  font-size: 1.1rem;
  color: #856404;
  margin-bottom: 25px;
}

.btn-success-next {
  border-color: #b8860b !important;
  color: #b8860b !important;
  box-shadow: 2px 2px 0 #b8860b !important;
  font-size: 1.1rem;
  padding: 12px 25px;
}

.btn-success-next:hover {
  background: #fffff0 !important;
  box-shadow: 3px 3px 0 #b8860b !important;
}

/* Responsive Styles for Mobile Viewports */
@media (max-width: 900px) {
  .desktop-layout {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .market-grid-container {
    grid-template-columns: 1fr !important;
    gap: 15px !important;
  }

  .shop-column, .recruiter-column {
    max-height: none !important;
    overflow-y: visible !important;
  }
}

@media (max-width: 600px) {
  .tabletop-container {
    padding: 10px;
    gap: 10px;
  }

  .levelup-card {
    padding: 15px;
  }

  .ledger-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .row-label {
    min-width: auto;
  }

  /* Override inline grid style for spell learning buttons */
  .levelup-card div[style*="grid-template-columns"] {
    grid-template-columns: 1fr !important;
  }

  .gameover-card, .victory-card {
    padding: 20px 15px;
  }

  .dead-title, .victory-title {
    font-size: 1.6rem;
  }

  .dead-stats, .victory-stats {
    padding: 10px 15px;
    font-size: 1rem;
    width: 100%;
    box-sizing: border-box;
  }
}
</style>
