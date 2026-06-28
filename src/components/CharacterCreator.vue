<script setup lang="ts">
import { ref } from 'vue';
import { useGameState } from '../composables/useGameState';

const { initNewCharacter, currentScreen } = useGameState();

const name = ref('');
const subStat = ref<'magic' | 'luck' | 'strength' | 'dexterity'>('magic');

function handleCreate() {
  initNewCharacter(name.value.trim(), subStat.value);
}
</script>


<template>
  <div class="creator-card paper-sheet">
    <h1 class="game-title">⚔️ ローグライクハーフ ⚔️</h1>
    <p class="subtitle">- アランツァの影に生きる冒険者たち -</p>
    
    <div class="divider"></div>

    <div class="form-section">
      <label for="char-name" class="label-style">🖋️ 冒険者の名を記せ:</label>
      <input 
        id="char-name"
        type="text" 
        v-model="name" 
        placeholder="名無しの流浪者..." 
        class="input-ink"
        maxlength="20"
      />
    </div>

    <div class="form-section">
      <label class="label-style">🌟 得意とする「副能力値」を選択せよ:</label>
      <p class="section-desc">※副能力値は判定時に「技量点」の代わりに使用でき、使用後に1点消費します。</p>
      
      <div class="archetype-grid">
        <!-- Magic Option -->
        <label class="archetype-card" :class="{ active: subStat === 'magic' }">
          <input type="radio" v-model="subStat" value="magic" class="hidden-radio" />
          <div v-if="subStat === 'magic'" class="active-badge">✓ 選択中</div>
          <div class="arch-header">🔮 魔術点</div>
          <div class="arch-desc">魔法を操る者。呪文を詠唱可能。</div>
          <div class="arch-gear">【初期装備】軽い武器、布鎧</div>
          <div class="arch-skill">【初期技能】魔術（任意の1種を修得）</div>
        </label>

        <!-- Luck Option -->
        <label class="archetype-card" :class="{ active: subStat === 'luck' }">
          <input type="radio" v-model="subStat" value="luck" class="hidden-radio" />
          <div v-if="subStat === 'luck'" class="active-badge">✓ 選択中</div>
          <div class="arch-header">🕊️ 幸運点</div>
          <div class="arch-desc">奇跡と言祝ぎを賜る者。危機をそらす。</div>
          <div class="arch-gear">【初期装備】片手武器、鎖鎧、木盾</div>
          <div class="arch-skill">【初期技能】奇跡（任意の1種を修得）</div>
        </label>

        <!-- Strength Option -->
        <label class="archetype-card" :class="{ active: subStat === 'strength' }">
          <input type="radio" v-model="subStat" value="strength" class="hidden-radio" />
          <div v-if="subStat === 'strength'" class="active-badge">✓ 選択中</div>
          <div class="arch-header">💪 筋力点</div>
          <div class="arch-desc">屈強な肉体を持つ戦士。重い鎧をまとう。</div>
          <div class="arch-gear">【初期装備】両手武器、板金鎧</div>
          <div class="arch-skill">【初期技能】全力攻撃、全力防御、かばう</div>
        </label>

        <!-- Dexterity Option -->
        <label class="archetype-card" :class="{ active: subStat === 'dexterity' }">
          <input type="radio" v-model="subStat" value="dexterity" class="hidden-radio" />
          <div v-if="subStat === 'dexterity'" class="active-badge">✓ 選択中</div>
          <div class="arch-header">🏹 器用点</div>
          <div class="arch-desc">俊敏なレンジャー。弓矢を射ち、罠を外す。</div>
          <div class="arch-gear">【初期装備】軽い武器、弓矢、革鎧</div>
          <div class="arch-skill">【初期技能】全力射撃、宝物獲得、察知</div>
        </label>
      </div>
    </div>



    <div class="divider"></div>

    <div class="submit-section">
      <button @click="currentScreen = 'scenario_select'" class="btn-ink btn-large btn-back">
        🔙 シナリオ選択に戻る
      </button>
      <button @click="handleCreate" class="btn-ink btn-large">
        📜 キャラクターの命運を紡ぎ出す
      </button>
    </div>
  </div>
</template>

<style scoped>
.creator-card {
  max-width: 650px;
  margin: 0 auto;
  padding: 40px;
  border-radius: 8px;
}

.game-title {
  font-family: 'Noto Serif JP', serif;
  font-weight: 900;
  text-align: center;
  font-size: 2.2rem;
  color: var(--ink-dark);
  margin-bottom: 5px;
}

.subtitle {
  font-family: 'Noto Serif JP', serif;
  font-style: italic;
  text-align: center;
  color: #705844;
  margin-top: 0;
  margin-bottom: 25px;
}

.divider {
  height: 4px;
  border-top: 1px solid var(--ink-dark);
  border-bottom: 1px solid var(--ink-dark);
  margin: 20px 0;
}

.form-section {
  margin-bottom: 30px;
}

.label-style {
  display: block;
  font-family: 'Noto Serif JP', serif;
  font-weight: bold;
  font-size: 1.1rem;
  color: var(--ink-dark);
  margin-bottom: 10px;
}

.section-desc {
  font-size: 0.85rem;
  color: #8c1c1c;
  margin-top: -5px;
  margin-bottom: 15px;
  font-style: italic;
}

.input-ink {
  width: 100%;
  padding: 12px;
  font-family: 'Noto Serif JP', serif;
  font-size: 1.1rem;
  background: rgba(255, 255, 255, 0.4);
  border: 2px solid var(--ink-dark);
  color: var(--ink-dark);
  border-radius: 4px;
  box-sizing: border-box;
}

.input-ink:focus {
  outline: none;
  background: rgba(255, 255, 255, 0.7);
  box-shadow: 0 0 5px var(--ink-dark);
}

.select-ink {
  appearance: none;
  background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%233e2723' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
  background-repeat: no-repeat;
  background-position: right 15px center;
  background-size: 15px;
  padding-right: 40px;
  cursor: pointer;
}

.archetype-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 15px;
}

.archetype-card {
  position: relative;
  border: 2px solid #a39281;
  background: rgba(255, 255, 255, 0.3);
  padding: 15px;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  transition: all 0.25s ease;
}

.archetype-card:hover {
  background: rgba(255, 255, 255, 0.6);
  border-color: var(--ink-dark);
}

.archetype-card.active {
  border-color: var(--ink-dark);
  border-width: 3px;
  margin: -1px;
  background: #fdf6e2;
  transform: scale(1.02);
  box-shadow: 0 6px 12px rgba(139, 69, 19, 0.15), inset 0 0 5px rgba(139,69,19,0.1);
}

.active-badge {
  position: absolute;
  top: 10px;
  right: 10px;
  background: var(--ink-dark);
  color: #fff;
  font-size: 0.7rem;
  font-weight: bold;
  padding: 2px 8px;
  border-radius: 20px;
  box-shadow: 1px 1px 3px rgba(0,0,0,0.2);
}

.hidden-radio {
  display: none;
}

.arch-header {
  font-family: 'Noto Serif JP', serif;
  font-weight: bold;
  font-size: 1rem;
  color: var(--ink-dark);
  margin-bottom: 5px;
}

.arch-desc {
  font-size: 0.85rem;
  color: #614a38;
  margin-bottom: 10px;
}

.arch-gear, .arch-skill {
  font-size: 0.8rem;
  font-weight: bold;
  color: #8c715c;
  margin-bottom: 3px;
}

.arch-skill {
  color: #7c4424;
}

.submit-section {
  display: flex;
  gap: 15px;
  justify-content: center;
  margin-top: 20px;
}

.btn-back {
  background: rgba(0,0,0,0.05);
}

.btn-large {
  padding: 15px 30px;
  font-size: 1.2rem;
  font-weight: bold;
}

@media (max-width: 600px) {
  .creator-card {
    padding: 20px 15px;
  }
  .archetype-grid {
    grid-template-columns: 1fr;
    gap: 10px;
  }
  .submit-section {
    flex-direction: column;
    gap: 10px;
  }
  .btn-large {
    width: 100%;
    font-size: 1.05rem;
    padding: 12px 20px;
  }
}
</style>
