<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useGameState } from '../composables/useGameState';
import { useAuth } from '../composables/useAuth';
import CloudSyncModal from './CloudSyncModal.vue';
import HallOfFameModal from './HallOfFameModal.vue';
import ScenarioEditor from './ScenarioEditor.vue';
import { useCustomScenarios } from '../composables/useCustomScenarios';
import type { Scenario } from '../types';

const { availableScenarios, activeScenario, currentScreen, isCharacterCreated, hasSavedSession, loadSession } = useGameState();
const { initAuth, userDisplayName } = useAuth();
const { customScenarios, deleteCustomScenario, exportScenarioAsJson, importScenarioFromJson, syncFromCloud } = useCustomScenarios();

const officialScenarios = computed(() => availableScenarios.value.filter(s => !s.id.startsWith('custom_')));

const showCloudModal = ref(false);
const showHallModal = ref(false);
const showEditor = ref(false);
const editingScenario = ref<Scenario | null>(null);
const fileInputRef = ref<HTMLInputElement | null>(null);
const importMessage = ref<string | null>(null);

const isDev = import.meta.env.DEV;
const devReferenceInfo = isDev ? {
  title: '『刻の悪魔のピラミッド』',
  author: '火呂居美智 氏',
  publisher: 'FT書房 (FT新聞 No.4911)',
  url: 'https://ftbooks.xyz/ftnews/gamebook/RogueLikeHalf_ThePyramid_of_ChronoDemon.txt',
} : null;

const hasSaved = ref(false);
const savedScenarioTitle = ref('');
const savedDepth = ref(1);

onMounted(async () => {
  // 認証の初期化（匿名サインイン）
  initAuth();
  syncFromCloud();

  hasSaved.value = hasSavedSession();
  if (hasSaved.value) {
    try {
      const jsonStr = localStorage.getItem('roguelike_half_saved_session');
      if (jsonStr) {
        const data = JSON.parse(jsonStr);
        savedScenarioTitle.value = data.activeScenario?.title || '不明なシナリオ';
        savedDepth.value = data.dungeonDepth || 1;
      }
    } catch (e) {
      console.error('Failed to parse saved session metadata:', e);
    }
  }
});

function resumeAdventure() {
  const success = loadSession();
  if (success) {
    // Session is loaded, Vue reactivity takes care of updating screen and states
  }
}

function selectScenario(scenario: Scenario) {
  activeScenario.value = scenario;
  
  // If the character has not been created yet, go to character creation.
  // Otherwise (e.g., subsequent adventure), proceed directly to level up / town market.
  if (!isCharacterCreated.value) {
    currentScreen.value = 'creator';
  } else {
    currentScreen.value = 'levelup';
  }
}

function handleOpenNewScenario() {
  editingScenario.value = null;
  showEditor.value = true;
}

function handleEditScenario(scenario: Scenario) {
  editingScenario.value = scenario;
  showEditor.value = true;
}

function handleDeleteScenario(scenario: Scenario) {
  if (confirm(`カスタムシナリオ「${scenario.title}」を削除しますか？`)) {
    deleteCustomScenario(scenario.id);
  }
}

function handleExportScenario(scenario: Scenario) {
  exportScenarioAsJson(scenario);
}

function handleTriggerImport() {
  fileInputRef.value?.click();
}

async function handleFileSelected(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  importMessage.value = null;
  const res = await importScenarioFromJson(file);
  if (res.success && res.scenario) {
    importMessage.value = `✨ シナリオ「${res.scenario.title}」を正常にインポートしました！`;
    setTimeout(() => { importMessage.value = null; }, 4000);
  } else {
    alert(`⚠️ インポート失敗: ${res.error || '不明なエラー'}`);
  }
  target.value = '';
}
</script>

<template>
  <div class="scenario-selector paper-sheet animate-fade-in">
    <div class="top-nav-bar" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
      <span class="user-chip" style="font-size: 0.8rem; color: var(--ink-light); background: rgba(0,0,0,0.04); padding: 3px 8px; border-radius: 4px; border: 1px dashed #c2b09a;">
        👤 {{ userDisplayName }}
      </span>
      <div style="display: flex; gap: 8px;">
        <button @click="showHallModal = true" class="btn-ink btn-mini" style="font-size: 0.8rem;">
          🏆 冒険の殿堂
        </button>
        <button @click="showCloudModal = true" class="btn-ink btn-mini" style="font-size: 0.8rem;">
          ☁️ クラウド同期
        </button>
      </div>
    </div>

    <!-- 隠しファイル入力 -->
    <input 
      type="file" 
      ref="fileInputRef" 
      accept=".json,application/json" 
      style="display: none;" 
      @change="handleFileSelected" 
    />

    <!-- インポート成功・通知メッセージ -->
    <div v-if="importMessage" class="import-alert animate-fade-in">
      {{ importMessage }}
    </div>

    <!-- Modals -->
    <CloudSyncModal v-if="showCloudModal" @close="showCloudModal = false" />
    <HallOfFameModal v-if="showHallModal" @close="showHallModal = false" />

    <!-- シナリオ作成・編集モーダル -->
    <ScenarioEditor 
      v-if="showEditor" 
      :initial-scenario="editingScenario" 
      @close="showEditor = false" 
    />

    <h1 class="game-title">⚔️ ローグライクハーフ ⚔️</h1>
    <p class="subtitle">- 冒険の舞台を選択せよ -</p>

    <!-- シナリオ工房ツールバー -->
    <div class="workshop-toolbar">
      <div class="workshop-info">
        <span class="workshop-icon">🛠️</span>
        <div class="workshop-texts">
          <span class="workshop-title">シナリオ工房</span>
          <span class="workshop-desc">自作ダンジョン作成・JSONインポート</span>
        </div>
      </div>
      <div class="workshop-actions">
        <button @click="handleOpenNewScenario" class="btn-ink btn-workshop-create">
          ➕ 新規作成
        </button>
        <button @click="handleTriggerImport" class="btn-ink btn-workshop-import">
          📥 JSON読込
        </button>
      </div>
    </div>
    
    <div class="divider"></div>

    <!-- Resume Saved Adventure Banner -->
    <div v-if="hasSaved" class="saved-session-banner">
      <div class="banner-content">
        <h3>🧭 進行中の冒険データがあります</h3>
        <p>
          シナリオ: <b>{{ savedScenarioTitle }}</b> (探索状況: 第 {{ savedDepth }} 部屋)
        </p>
      </div>
      <button @click="resumeAdventure" class="btn-ink btn-resume">進行中の冒険を再開する</button>
    </div>
    
    <!-- 公式シナリオ -->
    <div class="scenario-section">
      <h2 class="section-title">📜 公式シナリオ</h2>
      <div class="scenarios-grid">
        <div 
          v-for="scenario in officialScenarios" 
          :key="scenario.id" 
          class="scenario-card"
          @click="selectScenario(scenario)"
        >
          <div class="scenario-header">
            <h3 class="scenario-title">{{ scenario.title }}</h3>
            <span class="scenario-level-badge">{{ scenario.recommendedLevel }}</span>
          </div>
          
          <p class="scenario-desc">{{ scenario.description }}</p>
          
          <div class="scenario-footer">
            <span class="scenario-length">🧭 全 {{ scenario.totalRoomsToClear }} 部屋 + 決戦</span>
            <button class="btn-ink btn-select">このシナリオに挑む</button>
          </div>
        </div>
      </div>
    </div>

    <!-- カスタムシナリオ (自作・インポート) -->
    <div class="scenario-section" style="margin-top: 35px;">
      <div class="section-header-row">
        <h2 class="section-title">🛠️ カスタムシナリオ (自作・インポート)</h2>
        <span class="custom-badge-count">{{ customScenarios.length }} 件</span>
      </div>

      <div v-if="customScenarios.length > 0" class="scenarios-grid">
        <div 
          v-for="scenario in customScenarios" 
          :key="scenario.id" 
          class="scenario-card custom-card"
          @click="selectScenario(scenario)"
        >
          <div class="scenario-header">
            <div class="title-with-tag">
              <span class="custom-tag">自作</span>
              <h3 class="scenario-title">{{ scenario.title }}</h3>
            </div>
            <span class="scenario-level-badge">{{ scenario.recommendedLevel }}</span>
          </div>
          
          <p class="scenario-desc">{{ scenario.description }}</p>
          
          <div class="scenario-footer custom-footer">
            <span class="scenario-length">🧭 全 {{ scenario.totalRoomsToClear }} 部屋 + 決戦</span>
            <div class="card-action-buttons">
              <button 
                type="button" 
                class="btn-ink btn-action-tool" 
                title="編集"
                @click.stop="handleEditScenario(scenario)"
              >
                ✏️ 編集
              </button>
              <button 
                type="button" 
                class="btn-ink btn-action-tool" 
                title="JSONファイルとして保存"
                @click.stop="handleExportScenario(scenario)"
              >
                💾 保存
              </button>
              <button 
                type="button" 
                class="btn-ink btn-action-tool btn-danger-tool" 
                title="削除"
                @click.stop="handleDeleteScenario(scenario)"
              >
                🗑️
              </button>
              <button class="btn-ink btn-select">挑む</button>
            </div>
          </div>
        </div>
      </div>

      <div v-else class="custom-empty-card">
        <p>オリジナルのダンジョンを作成したり、配布されたJSONシナリオを読み込んで冒険することができます。</p>
        <button @click="handleOpenNewScenario" class="btn-ink btn-create-first">
          ✨ はじめてのシナリオを作成する
        </button>
      </div>
    </div>

    <div class="divider"></div>

    <!-- 権利表記・クレジット (TOS & Credits) -->
    <div class="tos-credits-container">
      <div class="tos-header">
        <img src="https://ftbooks.xyz/ftnews/article/RLH-100.jpg" alt="RLH ロゴ" class="rlh-logo" />
        <div class="tos-title-group">
          <h3 class="tos-title">🛡️ ローグライクハーフ 二次創作ガイドライン・権利表記</h3>
          <p class="tos-subtitle">本アプリケーションは、FT書房の登録商標・ライセンスに基づくTRPG「ローグライクハーフ」の二次創作デジタルゲームブックです。</p>
        </div>
      </div>

      <div class="tos-content-grid">
        <!-- 必要事項 -->
        <div class="tos-section">
          <h4 class="tos-section-title">📋 作品基本情報（規約に基づく必要事項）</h4>
          <ul class="tos-meta-list">
            <li><span>👤 プレイヤー人数：</span><strong>1人</strong></li>
            <li><span>⏱️ プレイ時間：</span><strong>約10〜30分</strong></li>
            <li><span>👪 対象年齢：</span><strong>15才以上対象</strong></li>
            <li><span>📖 GM有無：</span><strong>無</strong></li>
            <li><span>🏰 ジャンル：</span><strong>ファンタジー</strong></li>
            <li><span>⚔️ 推奨レベル：</span><strong>ビギナー〜中級</strong></li>
            <li><span>⚖️ 難易度：</span><strong>Easy、Normal、Hard</strong></li>
            <li><span>🎲 形式：</span><strong>シナリオ (d66)</strong></li>
            <li><span>🗺️ 世界観：</span><strong>共通世界 (アランツァ)</strong></li>
          </ul>
        </div>

        <!-- ルールとライセンス・参考文献 -->
        <div class="tos-section">
          <h4 class="tos-section-title">📚 公式ルール ＆ 参考文献クレジット</h4>
          
          <div class="tos-rule-box">
            <p><strong>📖 公式基本ルール（PDF無料配布中）：</strong></p>
            <p class="tos-link-text">
              <a href="https://ftbooks.booth.pm/items/4671946" target="_blank" rel="noopener noreferrer">
                https://ftbooks.booth.pm/items/4671946 (FT書房 BOOTH)
              </a>
            </p>
            <p class="tos-note">※再配布そのものを目的としたデータ利用は禁止されています。</p>
          </div>

          <div v-if="devReferenceInfo" class="tos-reference-box" style="margin-top: 10px;">
            <p><strong>🖋️ シナリオ参考文献（d66データ引用元）：</strong></p>
            <ul class="tos-ref-list">
              <li>
                <strong>作品名：</strong>{{ devReferenceInfo.title }}
              </li>
              <li>
                <strong>著者：</strong>{{ devReferenceInfo.author }}
              </li>
              <li>
                <strong>パブリッシャー：</strong>{{ devReferenceInfo.publisher }}
              </li>
              <li>
                <strong>原作ソース：</strong>
                <a :href="devReferenceInfo.url" target="_blank" rel="noopener noreferrer">
                  FT新聞アーカイブで原本を読む
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.scenario-selector {
  max-width: 800px;
  margin: 0 auto;
  padding: 40px;
  border-radius: 8px;
}

.saved-session-banner {
  background: #fdf5e6;
  border: 2px solid var(--ink-dark);
  padding: 20px;
  border-radius: 6px;
  margin-bottom: 25px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
  box-shadow: var(--card-shadow);
}

.banner-content h3 {
  margin: 0 0 5px 0;
  font-family: 'Noto Serif JP', serif;
  font-size: 1.15rem;
  color: #8c1c1c;
}

.banner-content p {
  margin: 0;
  font-size: 0.95rem;
  color: var(--ink-light);
}

.btn-resume {
  background-color: var(--ink-dark);
  color: white;
  border-color: var(--ink-dark);
  padding: 10px 20px;
  font-size: 1.0rem;
  cursor: pointer;
  white-space: nowrap;
}

.btn-resume:hover {
  background-color: #5c4b3d;
  color: white;
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
  margin: 20px 0 30px 0;
}

.scenarios-grid {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.scenario-card {
  border: 2px solid #a39281;
  background: rgba(255, 255, 255, 0.3);
  padding: 20px 25px;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  transition: all 0.25s ease-in-out;
  box-shadow: 1px 1px 3px rgba(0, 0, 0, 0.05);
}

.scenario-card:hover {
  background: #fcf6e8;
  border-color: var(--ink-dark);
  transform: translateY(-2px);
  box-shadow: 0 4px 10px rgba(139, 69, 19, 0.1);
}

.scenario-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.scenario-title {
  font-family: 'Noto Serif JP', serif;
  font-size: 1.3rem;
  font-weight: bold;
  color: var(--ink-dark);
  margin: 0;
}

.scenario-level-badge {
  font-size: 0.85rem;
  font-weight: bold;
  background-color: #f0e6d2;
  color: #705844;
  padding: 4px 10px;
  border-radius: 12px;
  border: 1px solid #c2b09a;
  white-space: nowrap;
}

.scenario-desc {
  font-size: 0.95rem;
  line-height: 1.6;
  color: #614a38;
  margin: 0 0 15px 0;
}

.scenario-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: auto;
  border-top: 1px dashed #c2b09a;
  padding-top: 12px;
}

.scenario-length {
  font-size: 0.85rem;
  font-weight: bold;
  color: #8c715c;
}

.btn-select {
  padding: 8px 16px;
  font-size: 0.9rem;
  font-weight: bold;
}

.animate-fade-in {
  animation: fadeIn 0.4s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

/* TOS & Credits section styling */
.tos-credits-container {
  margin-top: 30px;
  background: rgba(92, 75, 61, 0.04);
  border: 1px solid #c2b09a;
  border-radius: 6px;
  padding: 20px;
  font-family: 'Noto Serif JP', Georgia, serif;
  color: var(--ink-dark);
  text-align: left;
}

.tos-header {
  display: flex;
  align-items: center;
  gap: 15px;
  border-bottom: 1px solid #c2b09a;
  padding-bottom: 12px;
  margin-bottom: 15px;
}

.rlh-logo {
  width: 64px;
  height: 64px;
  border-radius: 4px;
  border: 1px solid #c2b09a;
  object-fit: cover;
  background: white;
}

.tos-title-group {
  flex-grow: 1;
}

.tos-title {
  margin: 0 0 4px 0;
  font-size: 1.1rem;
  font-weight: bold;
}

.tos-subtitle {
  margin: 0;
  font-size: 0.8rem;
  color: #705844;
  line-height: 1.4;
}

.tos-content-grid {
  display: grid;
  grid-template-columns: 1fr 1.2fr;
  gap: 20px;
}

.tos-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.tos-section-title {
  margin: 0 0 5px 0;
  font-size: 0.95rem;
  font-weight: bold;
  border-left: 3px solid var(--ink-dark);
  padding-left: 8px;
}

.tos-meta-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 0.8rem;
}

.tos-meta-list li {
  display: flex;
  justify-content: space-between;
  border-bottom: 1px dashed #e8e0d4;
  padding-bottom: 2px;
}

.tos-meta-list span {
  color: #705844;
}

.tos-meta-list strong {
  font-weight: bold;
}

.tos-rule-box, .tos-reference-box {
  background: rgba(255, 255, 255, 0.4);
  border: 1px dashed #c2b09a;
  padding: 10px;
  border-radius: 4px;
  font-size: 0.8rem;
}

.tos-rule-box p, .tos-reference-box p {
  margin: 0 0 5px 0;
}

.tos-link-text {
  word-break: break-all;
}

.tos-link-text a, .tos-ref-list a {
  color: #8c1c1c;
  text-decoration: underline;
  font-weight: bold;
}

.tos-link-text a:hover, .tos-ref-list a:hover {
  color: #5c4b3d;
}

.tos-note {
  margin: 0;
  font-size: 0.75rem;
  color: #8c715c;
  font-style: italic;
}

.tos-ref-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

/* インポート通知 */
.import-alert {
  background: #e8f4fd;
  color: #1a5276;
  border: 1px solid #a9cce3;
  padding: 10px 16px;
  border-radius: 6px;
  margin-bottom: 15px;
  font-weight: bold;
  text-align: center;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
}

/* シナリオ工房ツールバー */
.workshop-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #fbf7ef;
  border: 2px dashed #b8977e;
  border-radius: 8px;
  padding: 12px 18px;
  margin: 15px 0 25px 0;
  box-shadow: inset 0 1px 3px rgba(0,0,0,0.03);
}

.workshop-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.workshop-icon {
  font-size: 1.6rem;
}

.workshop-texts {
  display: flex;
  flex-direction: column;
}

.workshop-title {
  font-family: 'Noto Serif JP', serif;
  font-weight: bold;
  font-size: 1.05rem;
  color: var(--ink-dark);
}

.workshop-desc {
  font-size: 0.8rem;
  color: var(--ink-light);
}

.workshop-actions {
  display: flex;
  gap: 10px;
}

.btn-workshop-create {
  background: #8b263e;
  color: #fcfbf9;
  border: 1px solid #5c1828;
  font-weight: bold;
  padding: 6px 14px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-workshop-create:hover {
  background: #a3314c;
  transform: translateY(-1px);
}

.btn-workshop-import {
  background: #efe6d8;
  color: var(--ink-dark);
  border: 1px solid #b8977e;
  font-weight: bold;
  padding: 6px 14px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-workshop-import:hover {
  background: #e4d5c0;
}

/* セクション表示 */
.section-title {
  font-family: 'Noto Serif JP', serif;
  font-size: 1.2rem;
  color: var(--ink-dark);
  border-bottom: 2px solid #dfd3c3;
  padding-bottom: 6px;
  margin-bottom: 15px;
}

.section-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 2px solid #dfd3c3;
  padding-bottom: 6px;
  margin-bottom: 15px;
}

.section-header-row .section-title {
  border-bottom: none;
  padding-bottom: 0;
  margin-bottom: 0;
}

.custom-badge-count {
  font-size: 0.8rem;
  background: #efe6d8;
  color: #795548;
  padding: 2px 8px;
  border-radius: 12px;
  border: 1px solid #d7ccc8;
  font-weight: bold;
}

/* カスタムカード */
.custom-card {
  border-color: #a1887f;
  background: #fffdf9;
}

.title-with-tag {
  display: flex;
  align-items: center;
  gap: 8px;
}

.custom-tag {
  font-size: 0.7rem;
  background: #efebe9;
  color: #5d4037;
  border: 1px solid #bcaaa4;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: bold;
  white-space: nowrap;
}

.card-action-buttons {
  display: flex;
  gap: 6px;
  align-items: center;
}

.btn-action-tool {
  font-size: 0.75rem;
  padding: 4px 8px;
  background: #f5eedc;
  color: var(--ink-dark);
  border: 1px solid #c2b09a;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-action-tool:hover {
  background: #e8dcc4;
}

.btn-danger-tool {
  color: #a93226;
  border-color: #e6b0aa;
}

.btn-danger-tool:hover {
  background: #fadbd8;
}

.custom-empty-card {
  text-align: center;
  padding: 30px 20px;
  background: rgba(0,0,0,0.02);
  border: 1px dashed #c2b09a;
  border-radius: 6px;
  color: var(--ink-light);
  font-size: 0.9rem;
}

.btn-create-first {
  margin-top: 12px;
  background: #8b263e;
  color: #fcfbf9;
  border: 1px solid #5c1828;
  padding: 8px 16px;
  font-weight: bold;
  border-radius: 4px;
  cursor: pointer;
}

.btn-create-first:hover {
  background: #a3314c;
}

@media (max-width: 768px) {
  .tos-content-grid {
    grid-template-columns: 1fr;
    gap: 15px;
  }
  .tos-header {
    flex-direction: column;
    text-align: center;
    align-items: center;
  }
}

@media (max-width: 600px) {
  .scenario-selector {
    padding: 20px 15px;
  }
  .game-title {
    font-size: 1.6rem;
  }
  .scenario-card {
    padding: 15px;
  }
  .scenario-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 5px;
  }
  .scenario-footer {
    flex-direction: column;
    gap: 12px;
    align-items: stretch;
    text-align: center;
  }
  .btn-select {
    width: 100%;
  }
}
</style>
