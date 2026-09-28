<script setup lang="ts">
import { ref } from 'vue';
import { useSettings } from '../composables/useSettings';

const props = withDefaults(defineProps<{
  initialTab?: 'settings' | 'help';
}>(), {
  initialTab: 'settings'
});

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const activeMainTab = ref<'settings' | 'help'>(props.initialTab);
const { 
  showDiceOverlay, 
  toggleDiceOverlay,
  autoTrapTargetAllocation,
  toggleAutoTrapTarget,
  autoCombatDefenseAllocation,
  toggleAutoCombatDefense
} = useSettings();

// Help Tabs
type HelpTab = 'basics' | 'explore' | 'combat' | 'growth' | 'sync' | 'workshop';
const activeHelpTab = ref<HelpTab>('basics');

const helpTabs: { id: HelpTab; label: string; icon: string }[] = [
  { id: 'basics', label: '基本ルール', icon: '📖' },
  { id: 'explore', label: '探索とイベント', icon: '🧭' },
  { id: 'combat', label: '戦闘コマンド', icon: '⚔️' },
  { id: 'growth', label: '成長と装備', icon: '🛡️' },
  { id: 'sync', label: 'セーブと設定', icon: '☁️' },
  { id: 'workshop', label: 'シナリオ工房', icon: '🛠️' }
];
</script>

<template>
  <div class="modal-overlay" @click.self="emit('close')">
    <div class="settings-help-modal paper-sheet animate-fade-in">
      <!-- Top Navigation Header with Tabs -->
      <div class="modal-header">
        <div class="main-tabs-group">
          <button 
            type="button"
            class="main-tab-btn" 
            :class="{ active: activeMainTab === 'settings' }"
            @click="activeMainTab = 'settings'"
          >
            ⚙️ 環境設定
          </button>
          <button 
            type="button"
            class="main-tab-btn" 
            :class="{ active: activeMainTab === 'help' }"
            @click="activeMainTab = 'help'"
          >
            ❓ 冒険の手引き
          </button>
        </div>
        <button @click="emit('close')" class="btn-close" title="閉じる">✕</button>
      </div>

      <!-- Main Body Container -->
      <div class="modal-body-container custom-scrollbar">
        <!-- 1. SETTINGS TAB CONTENT -->
        <div v-if="activeMainTab === 'settings'" class="settings-content animate-fade-in">
          <!-- 1. Dice Overlay Toggle -->
          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-title">🎲 運命のダイス演出</span>
              <span class="setting-desc">
                判定時に画面中央へ3Dダイストレイを表示します。<br/>
                OFFにすると演出をスキップして高速に進行します。
              </span>
            </div>
            <div class="setting-control">
              <button 
                type="button" 
                class="btn-toggle" 
                :class="{ active: showDiceOverlay }"
                @click="toggleDiceOverlay"
              >
                {{ showDiceOverlay ? 'ON (表示)' : 'OFF (非表示)' }}
              </button>
            </div>
          </div>

          <!-- 2. Auto Trap Target Allocation Toggle -->
          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-title">🎯 トラップ対象の自動割り振り</span>
              <span class="setting-desc">
                罠の発動時、主人公や同行従者からランダムに対象を自動選定して即座に解決します。<br/>
                OFF（手動）にすると毎回プレイヤーが身代わりや対象を選択できます。
              </span>
            </div>
            <div class="setting-control">
              <button 
                type="button" 
                class="btn-toggle" 
                :class="{ active: autoTrapTargetAllocation }"
                @click="toggleAutoTrapTarget"
              >
                {{ autoTrapTargetAllocation ? 'ON (自動)' : 'OFF (手動)' }}
              </button>
            </div>
          </div>

          <!-- 3. Auto Combat Defense Allocation Toggle -->
          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-title">🛡️ 戦闘防御担当の自動割り振り</span>
              <span class="setting-desc">
                敵の攻撃を受けた際、防御を行うキャラクター（主人公または戦闘従者）をランダムに自動選定します。<br/>
                ダイス判定や【そらし】【かばう】の手動判断はそのまま行えます。
              </span>
            </div>
            <div class="setting-control">
              <button 
                type="button" 
                class="btn-toggle" 
                :class="{ active: autoCombatDefenseAllocation }"
                @click="toggleAutoCombatDefense"
              >
                {{ autoCombatDefenseAllocation ? 'ON (自動)' : 'OFF (手動)' }}
              </button>
            </div>
          </div>
        </div>

        <!-- 2. HELP TAB CONTENT -->
        <div v-else-if="activeMainTab === 'help'" class="help-content animate-fade-in">
          <!-- Sub Help Tab Bar -->
          <div class="help-tab-bar custom-scrollbar">
            <button
              v-for="t in helpTabs"
              :key="t.id"
              type="button"
              class="sub-tab-btn"
              :class="{ active: activeHelpTab === t.id }"
              @click="activeHelpTab = t.id"
            >
              <span class="tab-icon">{{ t.icon }}</span>
              <span class="tab-label">{{ t.label }}</span>
            </button>
          </div>

          <!-- Help Sections -->
          <div class="help-sections custom-scrollbar">
            <!-- 1. 基本ルール -->
            <div v-if="activeHelpTab === 'basics'" class="tab-content animate-fade-in">
              <div class="help-section">
                <h3>📜 ローグライクハーフとは？</h3>
                <p>
                  「ローグライクハーフ」は、FT書房が制作した1人用テーブルトークRPG（TRPG）です。
                  本アプリは、紙とペンとサイコロで行う本来のゲームブック体験を、ブラウザ上で直感的に遊べるように再現したデジタルゲームブックです。
                </p>
              </div>

              <div class="help-section">
                <h3>🎲 判定のルール (1d6 / 2d6)</h3>
                <div class="rule-box">
                  <strong>【行為判定・攻撃判定 (1d6 + 能力値 + 修正)】</strong><br/>
                  6面体サイコロを1個振り、能力値と装備修正を足した合計が【目標値（敵のレベルなど）】以上なら成功です。<br/>
                  ・出目「6」：大成功（クリティカル）！目標値に関わらず必ず成功し、戦闘では即座に追加攻撃を行えます。<br/>
                  ・出目「1」：大失敗（ファンブル）！目標値に関わらず必ず失敗となります。
                </div>
              </div>

              <div class="help-section">
                <h3>❤️ 4大能力値</h3>
                <div class="stat-grid">
                  <div class="stat-card">
                    <span class="stat-icon">❤️</span>
                    <span class="stat-name">生命力 (HP)</span>
                    <span class="stat-desc">生命の源。0になるとキャラクターは死亡（ゲームオーバー）します。</span>
                  </div>
                  <div class="stat-card">
                    <span class="stat-icon">⚔️</span>
                    <span class="stat-name">技量点</span>
                    <span class="stat-desc">近接攻撃や回避、罠解除の基準となる主要な身体能力です。</span>
                  </div>
                  <div class="stat-card">
                    <span class="stat-icon">🍞</span>
                    <span class="stat-name">食料</span>
                    <span class="stat-desc">休息時に消費して生命力を回復します。0の状態で休息すると飢餓ダメージを受けます。</span>
                  </div>
                  <div class="stat-card">
                    <span class="stat-icon">💰</span>
                    <span class="stat-name">金貨</span>
                    <span class="stat-desc">酒場での買い物、従者の雇用、ワイロによる戦闘回避に使います。</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- 2. 探索とイベント -->
            <div v-else-if="activeHelpTab === 'explore'" class="tab-content animate-fade-in">
              <div class="help-section">
                <h3>🧭 部屋の踏破と察知判定</h3>
                <p>
                  迷宮は全10部屋（シナリオによって異なります）で構成されます。<br/>
                  各部屋に入る際、まず【察知判定】が行われます。察知に成功すると部屋の危険や宝を事前に予知でき、奇襲を受けずに有利に立ち回ることができます。
                </p>
              </div>
              <div class="help-section">
                <h3>🏮 カンテラと暗闇</h3>
                <p>
                  カンテラを所持していないと、洞窟内は完全な暗闇となり、あらゆる行動判定に -2 の重いペナルティが課されます。探索前の購入を強く推奨します。
                </p>
              </div>
            </div>

            <!-- 3. 戦闘コマンド -->
            <div v-else-if="activeHelpTab === 'combat'" class="tab-content animate-fade-in">
              <div class="help-section">
                <h3>⚔️ 戦闘の流れ</h3>
                <p>
                  <strong>第0ラウンド（遠距離戦）:</strong> 弓や投擲武器を持っている場合、接近前に先制射撃を行えます。<br/>
                  <strong>第1ラウンド以降（接近戦）:</strong> プレイヤー攻撃 ➔ 従者攻撃 ➔ 敵の反撃の順でラウンドが進みます。
                </p>
              </div>
              <div class="help-section">
                <h3>🛡️ 防御と従者をかばう</h3>
                <p>
                  敵の反撃を受けた際、防御判定を行います。同行中の従者が攻撃対象になった場合、主人公の技量点や腕力を消費して「かばう」ことができます。
                </p>
              </div>
            </div>

            <!-- 4. 成長と装備 -->
            <div v-else-if="activeHelpTab === 'growth'" class="tab-content animate-fade-in">
              <div class="help-section">
                <h3>🛡️ 装備の切り替え</h3>
                <p>
                  冒険者シートから武器や防具の装備変更を行えます。戦闘中の武器切り替えは1手番を消費します。
                </p>
              </div>
              <div class="help-section">
                <h3>⭐ 経験点とレベルアップ</h3>
                <p>
                  迷宮の最深部を攻略して帰還すると、経験点を得てレベルアップできます。能力値の上限アップや強力な副能力スキルの習得が可能です。
                </p>
              </div>
            </div>

            <!-- 5. セーブと設定 -->
            <div v-else-if="activeHelpTab === 'sync'" class="tab-content animate-fade-in">
              <div class="help-section">
                <h3>☁️ クラウド同期と自動セーブ</h3>
                <p>
                  冒険中の状態は常にブラウザのローカルストレージへ自動保存されます。シナリオ選択画面の「クラウド同期」からGoogleアカウントでログインすると、異なる端末間でもセーブデータを共有可能です。
                </p>
              </div>
            </div>

            <!-- 6. シナリオ工房 -->
            <div v-else-if="activeHelpTab === 'workshop'" class="tab-content animate-fade-in">
              <div class="help-section">
                <h3>🛠️ カスタムシナリオ工房</h3>
                <p>
                  シナリオ選択画面の「＋ 新規シナリオ作成」から、独自のイベントテーブルや魔将を設定したカスタム迷宮を作成・プレイ・JSONエクスポートできます。
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Modal Footer -->
      <div class="modal-footer">
        <button @click="emit('close')" class="btn-ink btn-close-footer">閉じる</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  backdrop-filter: blur(2px);
  padding: 15px;
}

.settings-help-modal {
  max-width: 640px;
  width: 100%;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  padding: 20px;
  border-radius: 8px;
  background: #fffcf5;
  border: 2px solid var(--ink-dark);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 2px solid var(--ink-dark);
  padding-bottom: 10px;
  margin-bottom: 15px;
}

.main-tabs-group {
  display: flex;
  gap: 8px;
}

.main-tab-btn {
  background: transparent;
  border: 1px solid var(--ink-light);
  border-bottom: none;
  border-radius: 6px 6px 0 0;
  padding: 6px 14px;
  font-family: 'Noto Serif JP', serif;
  font-weight: bold;
  font-size: 0.95rem;
  color: var(--ink-light);
  cursor: pointer;
  transition: all 0.2s;
}

.main-tab-btn.active {
  background: var(--ink-dark);
  color: var(--paper-bg);
  border-color: var(--ink-dark);
}

.btn-close {
  background: none;
  border: none;
  font-size: 1.2rem;
  cursor: pointer;
  color: var(--ink-dark);
  padding: 2px 6px;
}

.modal-body-container {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

/* Settings Styles */
.settings-content {
  padding: 10px 5px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  background: rgba(255, 255, 255, 0.6);
  border: 1px solid #c2b09a;
  border-radius: 6px;
  padding: 16px;
}

.setting-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}

.setting-title {
  font-family: 'Noto Serif JP', serif;
  font-weight: bold;
  font-size: 1rem;
  color: var(--ink-dark);
}

.setting-desc {
  font-size: 0.85rem;
  color: #705844;
  line-height: 1.4;
}

.btn-toggle {
  min-width: 100px;
  padding: 8px 12px;
  font-family: 'Noto Serif JP', serif;
  font-weight: bold;
  font-size: 0.85rem;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid #c2b09a;
  background: #e8e0d4;
  color: #705844;
}

.btn-toggle.active {
  background: #2e7d32;
  border-color: #1b5e20;
  color: #ffffff;
  box-shadow: 0 2px 4px rgba(46, 125, 50, 0.3);
}

/* Help Styles */
.help-content {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.help-tab-bar {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  padding-bottom: 8px;
  margin-bottom: 12px;
  border-bottom: 1px dashed rgba(92, 75, 61, 0.3);
}

.sub-tab-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: rgba(255, 255, 255, 0.5);
  border: 1px solid #c2b09a;
  border-radius: 4px;
  font-size: 0.8rem;
  font-family: 'Noto Serif JP', serif;
  cursor: pointer;
  white-space: nowrap;
}

.sub-tab-btn.active {
  background: var(--ink-dark);
  color: var(--paper-bg);
  border-color: var(--ink-dark);
  font-weight: bold;
}

.help-sections {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding-right: 5px;
}

.help-section {
  margin-bottom: 16px;
}

.help-section h3 {
  font-size: 0.95rem;
  font-family: 'Noto Serif JP', serif;
  color: var(--ink-dark);
  border-left: 3px solid var(--ink-dark);
  padding-left: 8px;
  margin-bottom: 6px;
}

.help-section p {
  font-size: 0.85rem;
  color: #5c4b3d;
  line-height: 1.5;
  margin: 0;
}

.rule-box {
  background: rgba(0, 0, 0, 0.03);
  border: 1px dashed #bba895;
  border-radius: 4px;
  padding: 8px 12px;
  font-size: 0.82rem;
  line-height: 1.5;
  color: #4a3b2c;
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 8px;
}

.stat-card {
  background: rgba(255, 255, 255, 0.6);
  border: 1px solid #c2b09a;
  border-radius: 4px;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.stat-name {
  font-weight: bold;
  font-size: 0.85rem;
  color: var(--ink-dark);
}

.stat-desc {
  font-size: 0.78rem;
  color: #705844;
}

.modal-footer {
  margin-top: 15px;
  display: flex;
  justify-content: flex-end;
  border-top: 1px solid rgba(92, 75, 61, 0.2);
  padding-top: 10px;
}

.btn-close-footer {
  padding: 6px 18px;
  font-size: 0.9rem;
}
</style>
