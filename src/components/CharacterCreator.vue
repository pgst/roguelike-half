<script setup lang="ts">
import { ref, watch } from 'vue';
import { useGameState } from '../composables/useGameState';

const { initNewCharacter, currentScreen } = useGameState();

const name = ref('');
const subStat = ref<'magic' | 'luck' | 'strength' | 'dexterity'>('magic');
const strengthOption = ref<'twoHanded' | 'oneHandedShield'>('twoHanded');
const dexterityOption = ref<'bow' | 'sling'>('bow');
const weaponAttribute = ref<'slash' | 'strike'>('strike');

watch(
  subStat,
  (val) => {
    weaponAttribute.value =
      val === 'magic' || val === 'dexterity' ? 'strike' : 'slash';
  },
  { immediate: true },
);

function handleCreate() {
  initNewCharacter(name.value.trim(), subStat.value, {
    strengthOption: strengthOption.value,
    dexterityOption: dexterityOption.value,
    weaponAttribute: weaponAttribute.value,
  });
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
          <div class="arch-header">✨ 幸運点</div>
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
          <div class="arch-gear">【初期装備】板金鎧 ＋ (両手武器 or 片手武器+丸盾)</div>
          <div class="arch-skill">【初期技能】全力攻撃、全力防御、かばう</div>
        </label>

        <!-- Dexterity Option -->
        <label class="archetype-card" :class="{ active: subStat === 'dexterity' }">
          <input type="radio" v-model="subStat" value="dexterity" class="hidden-radio" />
          <div v-if="subStat === 'dexterity'" class="active-badge">✓ 選択中</div>
          <div class="arch-header">🏹 器用点</div>
          <div class="arch-desc">俊敏なレンジャー。飛び道具を射ち、罠を外す。</div>
          <div class="arch-gear">【初期装備】(弓矢 or スリング) ＋ 軽い武器、革鎧</div>
          <div class="arch-skill">【初期技能】全力射撃、宝物獲得、察知</div>
        </label>
      </div>

      <!-- 初期装備・武器属性の選択 (Rule 26 & 28) -->
      <div class="initial-equip-box" data-testid="initial-equip-options">
        <div v-if="subStat === 'strength'" class="equip-option-group">
          <div class="equip-option-title">🛡️ 筋力型の初期武装選択 (Rule 26):</div>
          <label class="equip-radio-label">
            <input
              type="radio"
              v-model="strengthOption"
              value="twoHanded"
              data-testid="strength-opt-twoHanded"
            />
            <span>両手武器 ＋ 板金鎧（攻撃修正+1・両手使用）</span>
          </label>
          <label class="equip-radio-label">
            <input
              type="radio"
              v-model="strengthOption"
              value="oneHandedShield"
              data-testid="strength-opt-oneHandedShield"
            />
            <span>片手武器 ＋ 丸盾 ＋ 板金鎧（生命力最大値+2・片手盾）</span>
          </label>
        </div>

        <div v-if="subStat === 'dexterity'" class="equip-option-group">
          <div class="equip-option-title">🏹 器用型の初期射撃武器選択 (Rule 26):</div>
          <label class="equip-radio-label">
            <input
              type="radio"
              v-model="dexterityOption"
              value="bow"
              data-testid="dexterity-opt-bow"
            />
            <span>弓と十分な矢 ＋ 軽い武器 ＋ 革鎧（射撃修正±0・斬撃）</span>
          </label>
          <label class="equip-radio-label">
            <input
              type="radio"
              v-model="dexterityOption"
              value="sling"
              data-testid="dexterity-opt-sling"
            />
            <span>スリング (投石器) ＋ 軽い武器 ＋ 革鎧（射撃修正-1・打撃・片手）</span>
          </label>
        </div>

        <div class="equip-option-group">
          <div class="equip-option-title">🗡️ 初期近接武器の属性選択 (Rule 28):</div>
          <div class="equip-radio-inline">
            <label class="equip-radio-label">
              <input
                type="radio"
                v-model="weaponAttribute"
                value="slash"
                data-testid="initial-weapon-attr-slash"
              />
              <span>斬撃 (Slash)</span>
            </label>
            <label class="equip-radio-label">
              <input
                type="radio"
                v-model="weaponAttribute"
                value="strike"
                data-testid="initial-weapon-attr-strike"
              />
              <span>打撃 (Strike)</span>
            </label>
          </div>
        </div>
      </div>
    </div>



    <div class="divider"></div>

    <!-- 初期能力値・装備プレビュー (#26-3) -->
    <div class="creator-summary-preview" data-testid="creator-summary-preview">
      <div class="summary-preview-title">📋 作成される冒険者の初期ステータス確認</div>
      <div class="summary-preview-stats">
        <span>🧍 技量点: <b>0</b></span>
        <span>❤️ 基礎生命点: <b>4</b></span>
        <span>🌟 副能力値: <b>2</b></span>
        <span>👥 従者点: <b>7</b></span>
        <span>✨ 初期経験点: <b>10点</b> (次画面で成長可能)</span>
        <span>💰 初期金貨: <b>10G</b></span>
        <span>🍖 携行食料: <b>2食</b> + ランタン</span>
      </div>
      <div class="summary-preview-gear">
        🗡️ <b>初期装備:</b>
        <span v-if="subStat === 'magic'">軽い武器 ({{ weaponAttribute === 'slash' ? '斬撃' : '打撃' }}) ＋ 布鎧 (生命力最大値+1 → 計5)</span>
        <span v-else-if="subStat === 'luck'">片手武器 ({{ weaponAttribute === 'slash' ? '斬撃' : '打撃' }}) ＋ 鎖鎧 ＋ 木盾 (生命力最大値+2 → 計6)</span>
        <span v-else-if="subStat === 'strength' && strengthOption === 'twoHanded'">両手武器 ({{ weaponAttribute === 'slash' ? '斬撃' : '打撃' }}・攻撃+1) ＋ 板金鎧 (生命力最大値+2 → 計6)</span>
        <span v-else-if="subStat === 'strength' && strengthOption === 'oneHandedShield'">片手武器 ({{ weaponAttribute === 'slash' ? '斬撃' : '打撃' }}) ＋ 丸盾 ＋ 板金鎧 (生命力最大値+3 → 計7)</span>
        <span v-else-if="subStat === 'dexterity' && dexterityOption === 'bow'">弓と十分な矢 (斬撃) ＋ 軽い武器 ({{ weaponAttribute === 'slash' ? '斬撃' : '打撃' }}) ＋ 革鎧 (生命力最大値+1 → 計5)</span>
        <span v-else-if="subStat === 'dexterity' && dexterityOption === 'sling'">スリング (打撃) ＋ 軽い武器 ({{ weaponAttribute === 'slash' ? '斬撃' : '打撃' }}) ＋ 革鎧 (生命力最大値+1 → 計5)</span>
      </div>
    </div>

    <div class="submit-section">
      <button @click="currentScreen = 'scenario_select'" class="btn-ink btn-large btn-back">
        🔙 シナリオ選択に戻る
      </button>
      <button @click="handleCreate" class="btn-ink btn-large" data-testid="create-character-btn">
        📜 この内容で作成（キャラクターの命運を紡ぎ出す）
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

.initial-equip-box {
  margin-top: 16px;
  padding: 14px 16px;
  background: rgba(255, 255, 255, 0.45);
  border: 1px dashed var(--ink-dark);
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.equip-option-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.equip-option-title {
  font-weight: bold;
  font-size: 0.9rem;
  color: var(--ink-dark);
}

.equip-radio-inline {
  display: flex;
  gap: 18px;
  flex-wrap: wrap;
}

.equip-radio-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.88rem;
  color: #3e2723;
  cursor: pointer;
}

.creator-summary-preview {
  background: rgba(255, 255, 255, 0.45);
  border: 1px dashed #8d6e63;
  border-radius: 6px;
  padding: 12px 16px;
  margin-bottom: 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  color: #3e2723;
}

.summary-preview-title {
  font-weight: bold;
  font-size: 0.92rem;
}

.summary-preview-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 14px;
  font-size: 0.88rem;
}

.summary-preview-gear {
  font-size: 0.88rem;
  color: #5d4037;
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
