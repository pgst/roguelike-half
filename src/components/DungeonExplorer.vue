<script setup lang="ts">
import { ref, computed } from 'vue';
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
  clearDiceTray
} = useGameState();

const { exploreNextRoom, resolveTrapCheck } = useDungeon();
const { resolveLoot } = useCombat();

const showMerchant = ref(false);

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
  character.value.gold -= a.goldCost;
  character.value.armors.push({ ...a });
  addLog(`行商人から [${a.name}] を購入しました。(金貨${a.goldCost}枚消費)`, 'success');
}

function buyShieldFromMerchant(s: Shield) {
  if (character.value.gold < s.goldCost) {
    addLog('金貨が足りません！', 'error');
    return;
  }
  character.value.gold -= s.goldCost;
  character.value.shields.push({ ...s });
  addLog(`行商人から [${s.name}] を購入しました。(金貨${s.goldCost}枚消費)`, 'success');
}

function buyItemFromMerchant(item: Omit<GeneralItem, 'id'>) {
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
  if (!activeEvent.value) return;
  addLog(`部屋の探索を開始します。宝物を得るためにダイスを振ります...`, 'info');
  const lootText = await resolveLoot(); // Call loot table roll directly
  (activeEvent.value as any).isResolved = true;
  (activeEvent.value as any).resolutionText = `🎁 宝物を獲得しました！\n獲得した戦利品: ${lootText}`;
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

// Wounded mercenary option
function resolveMercenary(save: boolean) {
  if (!activeEvent.value) return;
  let text = '';
  if (save) {
    if (character.value.gold < 7) {
      addLog('金貨が足りないため、彼を治療できません。', 'error');
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

function confirmEventResolution() {
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
</script>

<template>
  <div class="explorer-card paper-sheet">
    <div class="explorer-header">
      <h2>🏰 ダンジョン探索 (Explore Room)</h2>
      <div class="badge-depth">{{ depthText }}</div>
    </div>

    <!-- Recent Event Log -->
    <div v-if="logs.length > 0" class="recent-event-box" style="margin: 0 0 20px 0; padding: 10px; border: 1px dashed var(--ink-light); background: rgba(255,255,255,0.5); border-radius: 4px; font-family: 'Noto Serif JP', serif; font-size: 0.9rem;">
      📖 <b>直近の出来事:</b> <span :class="logs[0].type">{{ logs[0].text }}</span>
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
        <button @click="confirmEventResolution" class="btn-ink btn-large btn-primary-ink" style="margin-top: 15px; width: 100%;">
          🚪 次の小部屋へ進む (Proceed to Next Room)
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
        <!-- Trap Actions -->
        <div v-if="activeEvent.type === 'trap'">
          <button @click="resolveTrapCheck" class="btn-ink">
            🎲 判定ロールに挑戦する (目標値: {{ activeEvent.trapTarget }})
          </button>
        </div>

        <!-- Treasure Actions -->
        <div v-else-if="activeEvent.type === 'treasure'">
          <button @click="resolveLootRoom" class="btn-ink">
            💎 宝物を入手する (ダイスを振る)
          </button>
        </div>

        <!-- Rest Room Options -->
        <div v-else-if="activeEvent.type === 'rest'" class="button-group">
          <button @click="resolveRestRoom('life')" class="btn-ink">❤️ 怪我を癒やす (生命力+2)</button>
          <button @click="resolveRestRoom('sub')" class="btn-ink">🔮 魔力/運気を回復 (副能力値全快)</button>
        </div>

        <!-- Merchant NPC Interaction -->
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
                    <button @click="buyWeaponFromMerchant(w)" class="btn-ink btn-mini" :disabled="character.gold < w.goldCost">購入</button>
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
                    <button @click="buyShieldFromMerchant(s)" class="btn-ink btn-mini" :disabled="character.gold < s.goldCost">購入</button>
                  </div>
                </div>
              </div>

              <!-- General Consumables -->
              <div class="merch-cat">
                <h5>🧪 消耗品・小物の購入:</h5>
                <div class="merch-grid">
                  <div v-for="i in merchantGoods.items" :key="i.name" class="merch-item">
                    <span>{{ i.name }} ({{ i.goldCost }}g)</span>
                    <button @click="buyItemFromMerchant(i)" class="btn-ink btn-mini" :disabled="character.gold < i.goldCost">購入</button>
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
          <button @click="resolveMercenary(true)" class="btn-ink" :disabled="character.gold < 7">💖 治療して味方にする (金貨7枚消費)</button>
          <button @click="resolveMercenary(false)" class="btn-ink btn-secondary">無視して進む</button>
        </div>

        <!-- Captive NPC -->
        <div v-else-if="activeEvent.npcType === 'captive' || activeEvent.title === '逃亡中の捕虜'" class="button-group">
          <button @click="resolveCaptive(true)" class="btn-ink">⛓️ ロープで縛って捕虜にする</button>
          <button @click="resolveCaptive(false)" class="btn-ink btn-secondary">無視して進む</button>
        </div>

        <!-- Fallback explore room clear -->
        <div v-else>
          <button @click="confirmEventResolution" class="btn-ink">次の小部屋へ進む</button>
        </div>
      </div>
      </div>
    </div>

    <!-- Normal exploration deck -->
    <div v-else class="exploration-deck">
      <div class="adventure-text">
        <p>d66ダイスを振ってその「できごと」を確認してください。</p>
      </div>

      <button @click="exploreNextRoom" class="btn-ink btn-large btn-explore">
        🎲 d66を振って次の部屋を探索する
      </button>
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
  font-size: 1rem;
  line-height: 1.5;
  color: #4a3c31;
  margin-bottom: 25px;
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
</style>
