<script setup lang="ts">
import { computed } from 'vue';
import { useGameState } from '../composables/useGameState';
import { useCombat } from '../composables/useCombat';

const {
  currentScreen,
  character,
  followers,
  carriesLantern,
  isBackpackFull,
  equipWeapon,
  equipArmor,
  equipShield,
  sellItem,
  useFood,
  useHealingPotion,
  dismissFollower,
  currentBackpackCount
} = useGameState();

const { activateWarDoll } = useCombat();

const activeFollowerCount = computed(() => followers.value.length);

const maxBackpackSlots = computed(() => {
  const porterBonus = followers.value.filter(f => f.type === 'porter').length * 3;
  return character.value.lifeMax + porterBonus;
});


</script>

<template>
  <div class="adventure-sheet paper-sheet">
    <div class="sheet-header">
      <h2>冒険記録紙</h2>
      <p class="hero-name">冒険者: {{ character.name }} (Lv.{{ character.level }})</p>
    </div>

    <!-- Core Stats Grid -->
    <div class="stats-grid">
      <!-- Skill (技量点) -->
      <div class="stat-card">
        <span class="stat-icon">🧍</span>
        <span class="stat-label">技量点</span>
        <span class="stat-value">{{ character.skillCurrent }} / {{ character.skillMax }}</span>
      </div>

      <!-- Life (生命点) -->
      <div class="stat-card" :class="{ danger: character.lifeCurrent <= 1 }">
        <span class="stat-icon">❤️</span>
        <span class="stat-label">生命点</span>
        <span class="stat-value">{{ character.lifeCurrent }} / {{ character.lifeMax }}</span>
      </div>

      <!-- Sub-stat (副能力値) -->
      <div class="stat-card substat-highlight">
        <span class="stat-icon" v-if="character.subStatType === 'magic'">🔮</span>
        <span class="stat-icon" v-else-if="character.subStatType === 'luck'">🕊️</span>
        <span class="stat-icon" v-else-if="character.subStatType === 'strength'">💪</span>
        <span class="stat-icon" v-else-if="character.subStatType === 'dexterity'">🏹</span>
        
        <span class="stat-label" style="text-transform: capitalize;">
          {{ character.subStatType === 'magic' ? '魔術点' : character.subStatType === 'luck' ? '幸運点' : character.subStatType === 'strength' ? '筋力点' : '器用点' }}
        </span>
        <span class="stat-value">{{ character.subStatCurrent }} / {{ character.subStatMax }}</span>
      </div>

      <!-- Follower slots (従者点) -->
      <div class="stat-card">
        <span class="stat-icon">👥</span>
        <span class="stat-label">従者点</span>
        <span class="stat-value">{{ activeFollowerCount }} / {{ character.followerCurrent }}</span>
      </div>
    </div>

    <!-- Supplies & Inventory -->
    <div class="section-title">📦 物資・財産</div>
    <div class="supplies-box">
      <div class="supply-item">
        <span>🪙 <b>金貨:</b> {{ character.gold }} 枚</span>
      </div>
      <div class="supply-item" style="display: flex; align-items: center; gap: 5px; flex-wrap: wrap;">
        <span>🍞 <b>食料:</b> {{ character.food }} 食分</span>
        <button @click="useFood(false)" class="btn-ink btn-mini" :disabled="character.food <= 0">食べる (+2回復)</button>
        <button 
          v-if="character.subStatType === 'luck' && character.miracles.includes('聖餐') && character.subStatCurrent >= 1"
          @click="useFood(true)" 
          class="btn-ink btn-mini btn-strength" 
          :disabled="character.food <= 0"
        >
          🕊️ 聖餐 (+3回復, 幸運1)
        </button>
      </div>
      <div class="supply-item alert-supply">
        <span>🪔 <b>明かり:</b> {{ carriesLantern ? '点灯中' : '❌ 暗闇 (判定-2)' }}</span>
      </div>
    </div>

    <!-- Equipped Items -->
    <div class="section-title">🛡️ 着用装備</div>
    <div class="equipped-box">
      <div class="equipped-slot">
        <span class="slot-label">右手/武器:</span>
        <span class="slot-val">{{ character.equippedWeapon?.name || '素手 (攻撃力-2)' }}</span>
        <button v-if="character.equippedWeapon" @click="equipWeapon(character.equippedWeapon)" class="btn-ink btn-mini">外す</button>
      </div>
      <div class="equipped-slot">
        <span class="slot-label">胴体/防具:</span>
        <span class="slot-val">{{ character.equippedArmor?.name || '衣服のみ' }}</span>
        <button v-if="character.equippedArmor" @click="equipArmor(character.equippedArmor)" class="btn-ink btn-mini">外す</button>
      </div>
      <div class="equipped-slot">
        <span class="slot-label">左手/盾:</span>
        <span class="slot-val">{{ character.equippedShield?.name || 'なし' }}</span>
        <button v-if="character.equippedShield" @click="equipShield(character.equippedShield)" class="btn-ink btn-mini">外す</button>
      </div>
    </div>

    <!-- Backpack Slots (LifeMax slots limit) -->
    <div class="section-title">
      🎒 背負い袋 ({{ currentBackpackCount }} / {{ maxBackpackSlots }} スロット)
      <span v-if="isBackpackFull" class="full-badge">満杯！</span>
    </div>
    
    <div class="backpack-list">
      <!-- Weapons in bag -->
      <div v-for="w in character.weapons" :key="w.name" class="bag-item" v-show="character.equippedWeapon?.name !== w.name">
        <span class="item-name">⚔️ {{ w.name }}</span>
        <button @click="equipWeapon(w)" class="btn-ink btn-mini" :disabled="isBackpackFull && !character.equippedWeapon">装備</button>
      </div>

      <!-- Armors in bag -->
      <div v-for="a in character.armors" :key="a.name" class="bag-item" v-show="character.equippedArmor?.name !== a.name">
        <span class="item-name">🛡️ {{ a.name }}</span>
        <button @click="equipArmor(a)" class="btn-ink btn-mini" :disabled="isBackpackFull && !character.equippedArmor">装備</button>
      </div>

      <!-- Shields in bag -->
      <div v-for="s in character.shields" :key="s.name" class="bag-item" v-show="character.equippedShield?.name !== s.name">
        <span class="item-name">🛡️ [盾] {{ s.name }}</span>
        <button @click="equipShield(s)" class="btn-ink btn-mini" :disabled="isBackpackFull && !character.equippedShield">装備</button>
      </div>

      <!-- General Items in bag -->
      <div v-for="i in character.items" :key="i.id" class="bag-item">
        <span class="item-name">
          <span v-if="i.type === 'lantern'">🪔</span>
          <span v-else-if="i.type === 'rope'">🪢</span>
          <span v-else>🧪</span>
          {{ i.name }} <span class="val-sub" v-if="i.value > 0">(価値:{{ i.value }}g)</span>
        </span>
        <div class="item-actions">
          <button v-if="i.type === 'healingpotion'" @click="useHealingPotion" class="btn-ink btn-mini">飲む</button>
          <button v-if="i.type === 'magic_doll'" @click="activateWarDoll(i.id)" class="btn-ink btn-mini">起動(1EXP)</button>
          <button v-if="i.value > 0 && currentScreen === 'levelup'" @click="sellItem(i.id)" class="btn-ink btn-mini sell-btn">売却</button>
        </div>
      </div>

      <!-- Gold and Food slot weight indicators (Rule 27) -->
      <div v-if="Math.floor(character.gold / 100) > 0" class="bag-item system-item" style="color: #705844; border-color: rgba(112, 88, 68, 0.2); font-style: italic;">
        <span class="item-name">🪙 金貨の重み ({{ Math.floor(character.gold / 100) }} スロット分)</span>
        <span style="font-size: 0.8rem; opacity: 0.8;">※金貨100枚ごとに1スロット</span>
      </div>
      <div v-if="Math.floor(character.food / 10) > 0" class="bag-item system-item" style="color: #705844; border-color: rgba(112, 88, 68, 0.2); font-style: italic;">
        <span class="item-name">🍞 食料の重み ({{ Math.floor(character.food / 10) }} スロット分)</span>
        <span style="font-size: 0.8rem; opacity: 0.8;">※食料10個ごとに1スロット</span>
      </div>

      <div v-if="currentBackpackCount === 0" class="empty-text">背負い袋は空です。</div>
    </div>

    <!-- Active Followers -->
    <div class="section-title">👥 同行する従者 (Followers)</div>
    <div class="followers-list">
      <div v-for="f in followers" :key="f.id" class="follower-card">
        <div class="fol-header">
          <span class="fol-name">👤 {{ f.name }}</span>
          <span class="fol-type">({{ f.type === 'mage' ? '魔術師' : f.type === 'soldier' ? '兵士' : f.type === 'swordsman' ? '剣士' : f.type === 'archer' ? '弓兵' : '非戦闘員' }})</span>
        </div>
        <div class="fol-stats">
          <span>技量: {{ f.skill }} | 生命: {{ f.lifeCurrent }}/{{ f.lifeMax }}</span>
          <span v-if="f.type === 'mage'"> | 魔術: {{ f.magicCurrent }}/{{ f.magicMax }}</span>
        </div>
        <div class="fol-desc">{{ f.description }}</div>
        <button @click="dismissFollower(f.id)" class="btn-ink btn-mini dismiss-btn">解雇</button>
      </div>

      <div v-if="followers.length === 0" class="empty-text">従者はいません。(街で雇うことができます)</div>
    </div>
  </div>
</template>

<style scoped>
.adventure-sheet {
  background: var(--paper-bg);
  border: 3px double var(--ink-dark);
  padding: 20px;
  box-shadow: var(--card-shadow);
  border-radius: 4px;
  max-height: calc(100vh - 120px);
  overflow-y: auto;
}

.sheet-header {
  border-bottom: 2px solid var(--ink-dark);
  margin-bottom: 15px;
  padding-bottom: 10px;
}

.sheet-header h2 {
  font-family: 'Noto Serif JP', serif;
  font-size: 1.2rem;
  margin: 0;
  color: var(--ink-dark);
}

.hero-name {
  font-family: 'Noto Serif JP', serif;
  font-size: 0.95rem;
  font-weight: bold;
  color: #705844;
  margin: 5px 0 0 0;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  margin-bottom: 20px;
}

.stat-card {
  border: 1px solid #c2b09a;
  background: rgba(255, 255, 255, 0.4);
  padding: 6px;
  border-radius: 4px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-card.danger {
  border-color: #8c1c1c;
  background: #fdf2f2;
  color: #8c1c1c;
  animation: pulse 1s infinite alternate;
}

@keyframes pulse {
  0% { box-shadow: 0 0 2px #d9534f; }
  100% { box-shadow: 0 0 8px #d9534f; }
}

.substat-highlight {
  border-color: #7c4424;
  background: #fcf8f2;
}

.stat-icon {
  font-size: 1.1rem;
  margin-bottom: 2px;
}

.stat-label {
  font-size: 0.7rem;
  color: #705844;
  font-family: 'Noto Serif JP', serif;
  font-weight: bold;
}

.stat-value {
  font-size: 1rem;
  font-weight: bold;
  color: var(--ink-dark);
}

.section-title {
  font-family: 'Noto Serif JP', serif;
  font-size: 0.95rem;
  font-weight: bold;
  color: var(--ink-dark);
  border-bottom: 1px solid var(--ink-dark);
  margin-top: 20px;
  margin-bottom: 10px;
  padding-bottom: 3px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.full-badge {
  font-size: 0.75rem;
  background: #8c1c1c;
  color: #fff;
  padding: 2px 6px;
  border-radius: 3px;
}

.supplies-box, .equipped-box {
  background: rgba(255, 255, 255, 0.3);
  border: 1px solid #dcd1be;
  border-radius: 4px;
  padding: 10px;
}

.supply-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.85rem;
  margin-bottom: 6px;
}

.supply-item:last-child {
  margin-bottom: 0;
}

.alert-supply {
  border-top: 1px dashed #dcd1be;
  margin-top: 6px;
  padding-top: 6px;
}

.equipped-slot {
  display: flex;
  align-items: center;
  font-size: 0.85rem;
  margin-bottom: 5px;
  border-bottom: 1px dashed #e8e0d4;
  padding-bottom: 5px;
}

.equipped-slot:last-child {
  border-bottom: none;
  padding-bottom: 0;
  margin-bottom: 0;
}

.slot-label {
  font-weight: bold;
  color: #705844;
  min-width: 75px;
}

.slot-val {
  flex-grow: 1;
  color: var(--ink-dark);
  font-style: italic;
}

.backpack-list {
  background: rgba(255, 255, 255, 0.3);
  border: 1px solid #dcd1be;
  border-radius: 4px;
  padding: 10px;
}

.bag-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.85rem;
  border-bottom: 1px dashed #e8e0d4;
  padding: 4px 0;
}

.bag-item:last-child {
  border-bottom: none;
}

.item-name {
  color: var(--ink-dark);
}

.val-sub {
  font-size: 0.75rem;
  color: #8c715c;
  margin-left: 4px;
}

.item-actions {
  display: flex;
  gap: 5px;
}

.sell-btn {
  border-color: #8c715c !important;
  color: #8c715c !important;
}

.empty-text {
  font-size: 0.8rem;
  color: #9c8a7b;
  font-style: italic;
  text-align: center;
  padding: 10px 0;
}

.followers-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.follower-card {
  border: 1px solid #c2b09a;
  background: #fbf8f3;
  padding: 10px;
  border-radius: 4px;
  position: relative;
}

.fol-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #e8e0d4;
  padding-bottom: 3px;
  margin-bottom: 5px;
}

.fol-name {
  font-family: 'Noto Serif JP', serif;
  font-weight: bold;
  font-size: 0.85rem;
  color: var(--ink-dark);
}

.fol-type {
  font-size: 0.75rem;
  color: #705844;
}

.fol-stats {
  font-size: 0.8rem;
  font-weight: bold;
  color: #8c1c1c;
  margin-bottom: 5px;
}

.fol-desc {
  font-size: 0.75rem;
  color: #6c5a4b;
  margin-bottom: 8px;
  line-height: 1.3;
}

.dismiss-btn {
  border-color: #d9534f !important;
  color: #d9534f !important;
  display: block;
  margin-left: auto;
}

@media (max-width: 900px) {
  .adventure-sheet {
    max-height: none;
    overflow-y: visible;
  }
}

@media (max-width: 600px) {
  .adventure-sheet {
    padding: 15px;
  }
  .stats-grid {
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .stat-card {
    padding: 6px;
  }
  .stat-icon {
    font-size: 1.1rem;
  }
  .stat-value {
    font-size: 1rem;
  }
}
</style>
