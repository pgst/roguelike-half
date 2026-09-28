<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useGameState } from '../composables/useGameState';
import { useAuth } from '../composables/useAuth';
import CloudSyncModal from './CloudSyncModal.vue';
import HallOfFameModal from './HallOfFameModal.vue';
import ScenarioEditor from './ScenarioEditor.vue';
import SettingsHelpModal from './SettingsHelpModal.vue';
import AdventureSheet from './AdventureSheet.vue';
import { useCustomScenarios } from '../composables/useCustomScenarios';
import type { Scenario } from '../types';

const { 
  availableScenarios, 
  activeScenario, 
  currentScreen, 
  character,
  isCharacterCreated, 
  hasSavedSession, 
  loadSession, 
  skipAllMessages,
  resetSessionForNewCharacter
} = useGameState();
const { initAuth, userDisplayName, userPhotoURL } = useAuth();
const avatarLoadError = ref(false);
watch(userPhotoURL, () => {
  avatarLoadError.value = false;
});
const { customScenarios, deleteCustomScenario, exportScenarioAsJson, importScenarioFromJson, syncFromCloud } = useCustomScenarios();

const officialScenarios = computed(() => availableScenarios.value.filter(s => !s.id.startsWith('custom_')));

const selectedOfficialId = ref<string>('');
const detailPanelRef = ref<HTMLElement | null>(null);

const selectedOfficialScenario = computed<Scenario | null>(() => {
  if (!officialScenarios.value.length) return null;
  const found = officialScenarios.value.find(s => s.id === selectedOfficialId.value);
  return found || officialScenarios.value[0] || null;
});

function handleSelectListItem(scenario: Scenario) {
  selectedOfficialId.value = scenario.id;
  if (typeof window !== 'undefined' && window.innerWidth < 768) {
    detailPanelRef.value?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

const showCloudModal = ref(false);
const showHallModal = ref(false);
const showSettingsHelpModal = ref(false);
const showDetailModal = ref(false);
const settingsHelpInitialTab = ref<'settings' | 'help'>('settings');

function openSettingsHelpModal(tab: 'settings' | 'help' = 'settings') {
  settingsHelpInitialTab.value = tab;
  showSettingsHelpModal.value = true;
}

function getSubStatIcon(subType: string): string {
  switch (subType) {
    case 'strength': return '💪 筋力戦士';
    case 'dexterity': return '🏹 器用射手';
    case 'magic': return '🔮 魔術師';
    case 'luck': return '✨ 幸運導師';
    default: return '冒険者';
  }
}

function handleStartNewCharacter() {
  if (hasSaved.value) {
    const ok = confirm(`⚠️ 進行中の冒険データ（${savedScenarioTitle.value}・第${savedDepth.value}部屋）があります。\n新しい冒険者を作成すると、現在のキャラクターおよび進行中の冒険データは破棄されます。\n本当に新しい冒険者を作成しますか？`);
    if (!ok) return;
  } else if (character.value.name) {
    const ok = confirm(`現在の冒険者「${character.value.name} (Lv.${character.value.level})」をリセットし、新しい冒険者を作成しますか？`);
    if (!ok) return;
  }
  resetSessionForNewCharacter();
}

const showEditor = ref(false);
const editingScenario = ref<Scenario | null>(null);
const fileInputRef = ref<HTMLInputElement | null>(null);
const importMessage = ref<string | null>(null);
const showTosDetails = ref(false);

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
  skipAllMessages();
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
      <span class="user-chip">
        <img 
          v-if="userPhotoURL && !avatarLoadError" 
          :src="userPhotoURL" 
          alt="Avatar" 
          class="user-avatar-tiny"
          referrerpolicy="no-referrer"
          @error="avatarLoadError = true"
        />
        <span v-else class="user-avatar-fallback">👤</span>
        <span class="user-name-text">{{ userDisplayName }}</span>
      </span>
      <div style="display: flex; gap: 8px;">
        <button @click="showHallModal = true" class="btn-ink btn-mini" style="font-size: 0.8rem;">
          🏆 冒険の殿堂
        </button>
        <button @click="showCloudModal = true" class="btn-ink btn-mini" style="font-size: 0.8rem;">
          ☁️ クラウド同期
        </button>
        <button @click="openSettingsHelpModal('settings')" class="btn-ink btn-mini" style="font-size: 0.8rem;">
          ⚙️ 設定・ヘルプ
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
    <SettingsHelpModal 
      v-if="showSettingsHelpModal" 
      :initialTab="settingsHelpInitialTab"
      @close="showSettingsHelpModal = false" 
    />

    <!-- シナリオ作成・編集モーダル -->
    <ScenarioEditor 
      v-if="showEditor" 
      :initial-scenario="editingScenario" 
      @close="showEditor = false" 
    />

    <h1 class="game-title">⚔️ ローグライクハーフ ⚔️</h1>
    <p class="subtitle">- 冒険の舞台を選択せよ -</p>
    
    <div class="divider"></div>

    <!-- 👤 Current Character Card -->
    <div class="current-character-card paper-sheet">
      <div v-if="isCharacterCreated && character.name" class="character-info-box">
        <div class="char-header-row">
          <div class="char-identity">
            <span class="char-name">👤 <b>{{ character.name }}</b></span>
            <span class="badge-archetype">{{ getSubStatIcon(character.subStatType) }}</span>
            <span class="badge-level">Lv.{{ character.level }}</span>
          </div>
          <div class="char-actions">
            <button @click="showDetailModal = true" class="btn-ink btn-mini" title="冒険者シートの詳細を表示">
              📜 ステータス詳細
            </button>
            <button @click="handleStartNewCharacter" class="btn-ink btn-mini btn-danger-ink" title="現在のキャラクターをリセットして新しく作り直す">
              🔄 新規作成
            </button>
          </div>
        </div>

        <div class="char-vitals-row">
          <span class="vital-tag">❤️ 生命力: <b>{{ character.lifeCurrent }}</b>/{{ character.lifeMax }}</span>
          <span class="vital-tag">⚔️ 技量点: <b>{{ character.skillCurrent }}</b>/{{ character.skillMax }}</span>
          <span class="vital-tag">⚡ 副能力: <b>{{ character.subStatCurrent }}</b>/{{ character.subStatMax }}</span>
          <span class="vital-tag">💰 金貨: <b>{{ character.gold }}</b>g</span>
          <span class="vital-tag">🍞 食料: <b>{{ character.food }}</b></span>
        </div>

        <div class="char-equip-row">
          <span>🗡️ 武器: <b>{{ character.equippedWeapon?.name || '素手' }}</b></span>
          <span class="equip-sep">|</span>
          <span>🛡️ 鎧: <b>{{ character.equippedArmor?.name || '平服' }}</b></span>
          <span v-if="character.equippedShield" class="equip-sep">|</span>
          <span v-if="character.equippedShield">🛡️ 盾: <b>{{ character.equippedShield.name }}</b></span>
        </div>
      </div>

      <div v-else class="character-empty-box">
        <span class="empty-icon">👤</span>
        <div class="empty-text">
          <b>冒険者はまだ作成されていません</b>
          <p>シナリオを選択して「このシナリオに挑む」を押すと、新しいキャラクターを作成できます。</p>
        </div>
      </div>
    </div>

    <!-- 冒険者シート詳細モーダル -->
    <Teleport to="body">
      <div v-if="showDetailModal" class="hud-detail-overlay" @click.self="showDetailModal = false">
        <div class="hud-detail-modal paper-sheet animate-fade-in">
          <div class="modal-header">
            <h3>📜 冒険者シート・詳細</h3>
            <button @click="showDetailModal = false" class="btn-close-hud">✕ 閉じる</button>
          </div>
          <div class="modal-body custom-scrollbar">
            <AdventureSheet />
          </div>
        </div>
      </div>
    </Teleport>

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
    
    <!-- シナリオ一覧 (マスター・ディテール) -->
    <div class="scenario-section">
      <h2 class="section-title">📜 シナリオ</h2>
      
      <div class="master-detail-container">
        <!-- 左カラム: シナリオ一覧リスト（固定最大高さ＆スクロール） -->
        <div class="scenario-master-list custom-scrollbar">
          <div 
            v-for="scenario in officialScenarios" 
            :key="scenario.id" 
            class="scenario-list-item scenario-card"
            :class="{ active: selectedOfficialScenario?.id === scenario.id }"
            @click="handleSelectListItem(scenario)"
          >
            <div class="list-item-header">
              <h3 class="list-item-title">{{ scenario.title }}</h3>
              <span class="scenario-level-badge list-badge">{{ scenario.recommendedLevel }}</span>
            </div>
          </div>
        </div>

        <!-- 右カラム: 選択中シナリオの詳細プレビューボード -->
        <div ref="detailPanelRef" class="scenario-detail-panel paper-sheet">
          <div v-if="selectedOfficialScenario" class="detail-content animate-fade-in">
            <div class="detail-header">
              <div class="detail-title-group">
                <h3 class="detail-title">{{ selectedOfficialScenario.title }}</h3>
                <span class="scenario-level-badge detail-badge">{{ selectedOfficialScenario.recommendedLevel }}</span>
              </div>
              <span class="detail-rooms-badge">🧭 全 {{ selectedOfficialScenario.totalRoomsToClear }} 部屋 + 決戦</span>
            </div>

            <div class="detail-body">
              <p class="detail-desc">{{ selectedOfficialScenario.description }}</p>
            </div>

            <div class="detail-footer">
              <button @click="selectScenario(selectedOfficialScenario)" class="btn-ink btn-select btn-start-adventure">
                ⚔️ このシナリオに挑む
              </button>
            </div>
          </div>

          <div v-else class="detail-empty-placeholder">
            <p>左のリストから挑戦するシナリオを選択してください。</p>
          </div>
        </div>
      </div>
    </div>

    <!-- カスタムシナリオ -->
    <div class="scenario-section" style="margin-top: 35px;">
      <div class="section-header-row custom-section-header">
        <div class="header-title-group">
          <h2 class="section-title">🛠️ カスタムシナリオ</h2>
          <span class="custom-badge-count">{{ customScenarios.length }} 件</span>
        </div>
        <div class="custom-header-actions">
          <button @click="handleOpenNewScenario" class="btn-ink btn-mini btn-workshop-create">
            ➕ 新規作成
          </button>
          <button @click="handleTriggerImport" class="btn-ink btn-mini btn-workshop-import">
            📥 JSON読込
          </button>
        </div>
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
    <div class="tos-credits-container" :class="{ 'tos-collapsed': !showTosDetails }">
      <!-- 閉じている時のコンパクトバー -->
      <div v-if="!showTosDetails" class="tos-collapsed-bar animate-fade-in">
        <img src="https://ftbooks.xyz/ftnews/article/RLH-100.jpg" alt="RLH ロゴ" class="rlh-logo-mini" />
        <button 
          type="button" 
          class="btn-ink btn-mini btn-tos-open"
          @click="showTosDetails = true"
        >
          🛡️ 二次創作ガイドライン・権利表記を表示
        </button>
      </div>

      <!-- 展開時の詳細パネル -->
      <div v-else class="tos-expanded-panel animate-fade-in">
        <div class="tos-expanded-header">
          <div class="tos-expanded-title-row">
            <img src="https://ftbooks.xyz/ftnews/article/RLH-100.jpg" alt="RLH ロゴ" class="rlh-logo" />
            <div class="tos-title-group">
              <h3 class="tos-title">🛡️ ローグライクハーフ 二次創作ガイドライン・権利表記</h3>
              <p class="tos-subtitle">
                本アプリケーションは、FT書房のライセンス規約に基づくTRPG「ローグライクハーフ」の二次創作デジタルゲームブックです。
              </p>
            </div>
          </div>
          <button 
            type="button" 
            class="btn-ink btn-mini btn-tos-toggle"
            @click="showTosDetails = false"
          >
            ▲ 閉じる
          </button>
        </div>

        <div class="tos-content-grid" style="margin-top: 15px;">
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
            <li><span>🎲 形式：</span><strong>デジタルゲームブック / d66シナリオ</strong></li>
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

/* マスター・ディテール レイアウト */
.master-detail-container {
  display: grid;
  grid-template-columns: minmax(260px, 38%) 1fr;
  gap: 20px;
  align-items: stretch;
}

.scenario-master-list {
  max-height: 440px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-right: 6px;
}

.scenario-list-item.scenario-card {
  padding: 8px 12px;
  border-width: 1px;
  border-color: #cbbba9;
  background: #fffcf8;
  gap: 0;
  transform: none;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  min-height: 38px;
  display: flex;
  justify-content: center;
}

.scenario-list-item.scenario-card:hover {
  background: #faf2e3;
  border-color: #8b263e;
  transform: translateX(2px);
  box-shadow: 0 2px 5px rgba(139, 38, 62, 0.08);
}

.scenario-list-item.scenario-card.active {
  background: #fbf3e6;
  border-color: #8b263e;
  border-left: 5px solid #8b263e;
  box-shadow: inset 0 1px 3px rgba(0,0,0,0.06);
}

.list-item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.list-item-title {
  margin: 0;
  font-family: 'Noto Serif JP', serif;
  font-size: 0.95rem;
  font-weight: bold;
  color: var(--ink-dark);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
  flex: 1;
}

.list-badge {
  font-size: 0.75rem;
  padding: 1px 6px;
  white-space: nowrap;
  flex-shrink: 0;
}

/* 詳細パネル (ボード風) */
.scenario-detail-panel {
  padding: 20px 24px;
  border: 2px solid #5c4b3d;
  background: #fefdfa;
  min-height: 280px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  border-radius: 6px;
  box-shadow: 2px 2px 8px rgba(0, 0, 0, 0.08);
}

.detail-content {
  display: flex;
  flex-direction: column;
  height: 100%;
  justify-content: space-between;
}

.detail-header {
  border-bottom: 2px solid #dfd3c3;
  padding-bottom: 10px;
  margin-bottom: 12px;
}

.detail-title-group {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 6px;
}

.detail-title {
  margin: 0;
  font-family: 'Noto Serif JP', serif;
  font-size: 1.35rem;
  font-weight: bold;
  color: var(--ink-dark);
}

.detail-badge {
  font-size: 0.85rem;
  padding: 3px 10px;
}

.detail-rooms-badge {
  font-size: 0.85rem;
  color: #705844;
  font-weight: bold;
}

.detail-body {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.detail-desc {
  font-size: 0.95rem;
  line-height: 1.6;
  color: var(--ink-dark);
  margin: 0;
}

.detail-footer {
  margin-top: 18px;
  padding-top: 12px;
  border-top: 1px dashed #d4c5b3;
}

.btn-start-adventure {
  width: 100%;
  padding: 11px 20px;
  font-size: 1.05rem;
  font-weight: bold;
  background: #8b263e;
  color: #fff;
  border: 1px solid #5c1828;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.btn-start-adventure:hover {
  background: #a3314c;
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(139, 38, 62, 0.2);
}

.detail-empty-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--ink-light);
  font-style: italic;
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
  transition: all 0.2s ease-in-out;
}

.tos-credits-container.tos-collapsed {
  padding: 10px 16px;
  background: rgba(92, 75, 61, 0.02);
  border: 1px dashed #c2b09a;
}

.tos-collapsed-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.rlh-logo-mini {
  width: 32px;
  height: 32px;
  border-radius: 4px;
  border: 1px solid #c2b09a;
  object-fit: cover;
  background: white;
}

.btn-tos-open {
  background: rgba(255, 255, 255, 0.8);
  border: 1px solid #8c6d46;
  color: #3b2c1a;
  font-weight: bold;
  padding: 6px 14px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-tos-open:hover {
  background: #f4ede2;
  border-color: #5c4327;
  transform: translateY(-1px);
}

.tos-expanded-panel {
  display: flex;
  flex-direction: column;
}

.tos-expanded-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 15px;
  border-bottom: 1px solid #c2b09a;
  padding-bottom: 12px;
}

.tos-expanded-title-row {
  display: flex;
  align-items: center;
  gap: 15px;
  flex: 1;
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

/* カスタムセクション ヘッダー & 工房アクション */
.custom-section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.header-title-group {
  display: flex;
  align-items: center;
  gap: 10px;
}

.custom-header-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.btn-workshop-create {
  background: #8b263e;
  color: #fcfbf9;
  border: 1px solid #5c1828;
  font-weight: bold;
  padding: 5px 12px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 0.8rem;
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
  padding: 5px 12px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 0.8rem;
}

.btn-workshop-import:hover {
  background: #e4d5c0;
}

/* TOS アコーディオン・トグル */
.btn-tos-toggle {
  white-space: nowrap;
  font-size: 0.75rem;
  padding: 4px 10px;
  background: #efe6d8;
  color: var(--ink-dark);
  border: 1px solid #c2b09a;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-tos-toggle:hover {
  background: #e4d5c0;
}

.tos-official-inline-link {
  display: inline-block;
  margin-left: 8px;
  color: #8c1c1c;
  font-weight: bold;
  text-decoration: underline;
}

.tos-official-inline-link:hover {
  color: #5c4b3d;
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
  .master-detail-container {
    grid-template-columns: 1fr;
    gap: 16px;
  }
  .scenario-master-list {
    max-height: 200px;
  }
  .scenario-list-item.scenario-card {
    padding: 9px 12px;
  }
  .scenario-detail-panel {
    min-height: auto;
    padding: 16px;
  }
  .tos-content-grid {
    grid-template-columns: 1fr;
    gap: 15px;
  }
  .tos-expanded-header {
    flex-direction: column;
    text-align: center;
    align-items: center;
    gap: 12px;
  }
  .tos-expanded-title-row {
    flex-direction: column;
    text-align: center;
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

/* Current Character Card */
.current-character-card {
  margin-bottom: 20px;
  padding: 14px 18px;
  background: rgba(255, 255, 255, 0.65);
  border: 1px solid var(--ink-dark);
  border-radius: 6px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
}

.character-info-box {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.char-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  border-bottom: 1px dashed rgba(92, 75, 61, 0.3);
  padding-bottom: 8px;
}

.char-identity {
  display: flex;
  align-items: center;
  gap: 8px;
}

.char-name {
  font-size: 1.1rem;
  color: var(--ink-dark);
  font-family: 'Noto Serif JP', serif;
}

.badge-archetype {
  font-size: 0.8rem;
  background: rgba(0, 0, 0, 0.06);
  padding: 2px 8px;
  border-radius: 4px;
  color: var(--ink-dark);
  font-weight: bold;
}

.badge-level {
  font-size: 0.8rem;
  background: var(--gold-accent, #c5a059);
  color: #fff;
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: bold;
}

.char-actions {
  display: flex;
  gap: 8px;
}

.btn-danger-ink {
  border-color: #8c1c1c;
  color: #8c1c1c;
}

.btn-danger-ink:hover {
  background: #8c1c1c;
  color: #fff;
}

.char-vitals-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.vital-tag {
  background: rgba(0, 0, 0, 0.04);
  border: 1px solid #dcd3c4;
  border-radius: 4px;
  padding: 3px 8px;
  font-size: 0.82rem;
  color: var(--ink-dark);
}

.char-equip-row {
  font-size: 0.85rem;
  color: var(--ink-light);
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.equip-sep {
  opacity: 0.4;
}

.character-empty-box {
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 6px 4px;
  color: var(--ink-light);
}

.empty-icon {
  font-size: 2rem;
  opacity: 0.5;
}

.empty-text b {
  font-size: 0.95rem;
  color: var(--ink-dark);
  display: block;
  margin-bottom: 2px;
}

.empty-text p {
  margin: 0;
  font-size: 0.8rem;
  line-height: 1.4;
}

/* Adventure Sheet Modal Overlay & Box */
.hud-detail-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  z-index: 99999;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 15px;
  backdrop-filter: blur(2px);
}

.hud-detail-modal {
  max-width: 640px;
  width: 100%;
  max-height: 88vh;
  display: flex;
  flex-direction: column;
  border: 3px double var(--ink-dark);
  border-radius: 8px;
  box-shadow: 0 10px 35px rgba(0, 0, 0, 0.6);
  background: var(--paper-bg);
  overflow: hidden;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 16px;
  border-bottom: 2px solid var(--ink-dark);
  background: rgba(0, 0, 0, 0.03);
  flex-shrink: 0;
}

.modal-header h3 {
  margin: 0;
  font-size: 1.1rem;
  color: var(--ink-dark);
  font-family: 'Noto Serif JP', serif;
}

.btn-close-hud {
  background: none;
  border: 1px solid var(--ink-dark);
  color: var(--ink-dark);
  border-radius: 4px;
  padding: 4px 10px;
  font-size: 0.8rem;
  cursor: pointer;
  font-weight: bold;
  transition: all 0.15s ease;
}

.btn-close-hud:hover {
  background: #8c1c1c;
  color: #fff;
  border-color: #8c1c1c;
}

.modal-body {
  padding: 16px;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}

/* User Profile Header Chip */
.user-chip {
  font-size: 0.8rem;
  color: var(--ink-light);
  background: rgba(0, 0, 0, 0.04);
  padding: 3px 8px;
  border-radius: 4px;
  border: 1px dashed #c2b09a;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 240px;
}

.user-avatar-tiny {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  object-fit: cover;
  border: 1px solid rgba(0, 0, 0, 0.2);
  flex-shrink: 0;
  display: block;
}

.user-avatar-fallback {
  font-size: 0.85rem;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
}

.user-name-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
