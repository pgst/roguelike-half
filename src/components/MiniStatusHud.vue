<script setup lang="ts">
import { ref, computed } from 'vue';
import { useGameState } from '../composables/useGameState';
import AdventureSheet from './AdventureSheet.vue';
import SettingsHelpModal from './SettingsHelpModal.vue';
import LogbookModal from './LogbookModal.vue';

const {
  character,
  followers,
  dungeonDepth,
  totalRoomsToClear,
  currentScreen,
  logs,
  showLogbookModal,
  showDetailModal,
  activeScenario
} = useGameState();

const isLinearMode = computed(() => activeScenario.value?.explorationMode === 'linear');

const showRecordModal = ref(false);
const activeRecordTab = ref<'status' | 'logbook'>('status');

function openRecordModal(tab: 'status' | 'logbook' = 'status') {
  activeRecordTab.value = tab;
  showRecordModal.value = true;
  showDetailModal.value = true;
}

function closeRecordModal() {
  showRecordModal.value = false;
  showDetailModal.value = false;
}

const showSettingsHelpModal = ref(false);
const settingsHelpInitialTab = ref<'settings' | 'help'>('settings');

function openSettingsHelpModal(tab: 'settings' | 'help' = 'settings') {
  settingsHelpInitialTab.value = tab;
  showSettingsHelpModal.value = true;
}

const hpRatio = computed(() => {
  if (!character.value.lifeMax) return 1;
  return character.value.lifeCurrent / character.value.lifeMax;
});

const hpColorClass = computed(() => {
  if (hpRatio.value <= 0.25) return 'hp-danger';
  if (hpRatio.value <= 0.5) return 'hp-warning';
  return 'hp-normal';
});

const subStatIcon = computed(() => {
  switch (character.value.subStatType) {
    case 'magic': return '🔮 魔術';
    case 'luck': return '✨ 幸運';
    case 'strength': return '💪 腕力';
    case 'dexterity': return '⚡ 敏捷';
    default: return '副能力';
  }
});

const livingFollowers = computed(() => followers.value.filter(f => f.lifeCurrent > 0));
</script>

<template>
  <header class="mini-status-hud">
    <div class="hud-inner">
      <!-- Left: Hero Overview & Depth -->
      <div class="hud-left">
        <span class="hero-name-badge">
          🛡️ <b>{{ character.name || '冒険者' }}</b> <small>Lv.{{ character.level }}</small>
        </span>
        <span v-if="currentScreen === 'explore' || currentScreen === 'combat'" class="depth-badge">
          🧭 <b>第 {{ dungeonDepth }} / {{ totalRoomsToClear }} 部屋</b>
          <span class="hud-mode-pill" :class="isLinearMode ? 'pill-linear' : 'pill-tile'" :title="isLinearMode ? '一本道モード（逃走時に部屋数維持）' : '固定マップ/通常モード（逃走時に1部屋後退）'">
            {{ isLinearMode ? '🚶 一本道' : '🗺️ 通常' }}
          </span>
        </span>
      </div>

      <!-- Center: Key Vital Chips -->
      <div class="hud-vitals">
        <!-- HP Chip with Mini Bar -->
        <div class="vital-chip hp-chip" :class="hpColorClass" title="生命力 (HP)">
          <span class="vital-icon">❤️</span>
          <span class="vital-val"><b>{{ character.lifeCurrent }}</b>/{{ character.lifeMax }}</span>
          <div class="mini-bar-track">
            <div class="mini-bar-fill" :style="{ width: `${Math.max(0, Math.min(100, hpRatio * 100))}%` }"></div>
          </div>
        </div>

        <!-- Skill Chip -->
        <div class="vital-chip" title="技量点">
          <span class="vital-icon">⚔️</span>
          <span class="vital-val"><b>{{ character.skillCurrent }}</b>/{{ character.skillMax }}</span>
        </div>

        <!-- SubStat Chip -->
        <div class="vital-chip" :title="subStatIcon">
          <span class="vital-icon">{{ subStatIcon.slice(0, 2) }}</span>
          <span class="vital-val"><b>{{ character.subStatCurrent }}</b>/{{ character.subStatMax }}</span>
        </div>

        <!-- Food Chip -->
        <div class="vital-chip" :class="{ 'warning-food': character.food <= 1 }" title="食料">
          <span class="vital-icon">🍞</span>
          <span class="vital-val"><b>{{ character.food }}</b></span>
        </div>

        <!-- Gold Chip -->
        <div class="vital-chip gold-chip" title="所持金貨">
          <span class="vital-icon">💰</span>
          <span class="vital-val"><b>{{ character.gold }}</b>g</span>
        </div>

        <!-- Followers Chip -->
        <div 
          v-if="livingFollowers.length > 0" 
          class="vital-chip follower-chip" 
          :title="`同行中の従者: ${livingFollowers.map(f => f.name).join('、')} (クリックで詳細)`"
          @click="showDetailModal = true"
          style="cursor: pointer;"
        >
          <span class="vital-icon">👥</span>
          <span class="vital-val">
            <template v-if="livingFollowers.length === 1">
              <b>{{ livingFollowers[0].name }}</b>
            </template>
            <template v-else>
              <b>{{ livingFollowers.length }}</b>人
            </template>
          </span>
        </div>
      </div>

      <!-- Right: Detailed Sheet Toggle Button, Logbook, Settings & Help -->
      <div class="hud-right">
        <button @click="openRecordModal('status')" class="btn-hud-record btn-hud-detail" title="冒険記録（ステータス詳細・冒険の足跡）">
          📜 <span class="btn-text">冒険記録</span>
        </button>
        <button @click="openSettingsHelpModal('settings')" class="btn-hud-settings-help btn-hud-settings" title="設定・ヘルプ">
          ⚙️ <span class="btn-text">設定・ヘルプ</span>
        </button>
      </div>
    </div>

    <!-- 冒険記録モーダル（ステータス詳細 & 冒険の足跡 タブ統合） -->
    <Teleport to="body">
      <div v-if="showDetailModal || showRecordModal" class="hud-detail-overlay" @click.self="closeRecordModal">
        <div class="hud-detail-modal paper-sheet animate-fade-in">
          <div class="modal-header">
            <div class="header-tab-group">
              <button 
                type="button"
                class="hud-tab-btn" 
                :class="{ active: activeRecordTab === 'status' }"
                @click="activeRecordTab = 'status'"
              >
                📜 ステータス詳細
              </button>
              <button 
                type="button"
                class="hud-tab-btn" 
                :class="{ active: activeRecordTab === 'logbook' }"
                @click="activeRecordTab = 'logbook'"
              >
                📖 冒険の足跡 (全 {{ logs.length }} 件)
              </button>
            </div>
            <button @click="closeRecordModal" class="btn-close-hud">✕ 閉じる</button>
          </div>
          <div class="modal-body custom-scrollbar">
            <AdventureSheet v-show="activeRecordTab === 'status'" />
            <div v-if="activeRecordTab === 'logbook'" class="logbook-tab-view">
              <div class="logbook-entries custom-scrollbar">
                <div 
                  v-for="log in logs" 
                  :key="log.id" 
                  class="log-entry" 
                  :class="log.type"
                >
                  <span class="log-bullet">■</span>
                  <span class="log-text">{{ log.text }}</span>
                </div>
                <div v-if="logs.length === 0" class="empty-logs">
                  迷宮の扉が開かれました。あなたの歩みがここに記されます...
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- 冒険の足跡モーダル（E2Eテスト互換性のためv-showで常時DOM保持） -->
    <LogbookModal v-show="showLogbookModal" @close="showLogbookModal = false" />

    <!-- 統合 設定・ヘルプモーダル -->
    <SettingsHelpModal 
      v-if="showSettingsHelpModal" 
      :initialTab="settingsHelpInitialTab"
      @close="showSettingsHelpModal = false" 
    />
  </header>
</template>

<style scoped>
.mini-status-hud {
  position: sticky;
  top: 0;
  z-index: 1000;
  width: 100%;
  background: rgba(247, 243, 233, 0.94);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border-bottom: 2px solid var(--ink-dark);
  box-shadow: 0 4px 12px rgba(44, 30, 14, 0.15);
  font-family: 'Noto Serif JP', serif;
  transition: all 0.2s ease;
}

.hud-inner {
  max-width: 1200px;
  margin: 0 auto;
  padding: 6px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.hud-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.hero-name-badge {
  font-size: 0.95rem;
  color: var(--ink-dark);
}

.hero-name-badge small {
  color: #705844;
  font-weight: bold;
}

.depth-badge {
  background: rgba(44, 30, 14, 0.08);
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.85rem;
  border: 1px dashed var(--ink-dark);
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.hud-mode-pill {
  font-size: 0.7rem;
  font-weight: bold;
  padding: 0 5px;
  border-radius: 3px;
  white-space: nowrap;
}

.pill-tile {
  background: rgba(41, 128, 185, 0.15);
  color: #1a5276;
  border: 1px solid rgba(41, 128, 185, 0.3);
}

.pill-linear {
  background: rgba(211, 84, 0, 0.15);
  color: #933800;
  border: 1px solid rgba(211, 84, 0, 0.3);
}

.hud-vitals {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.vital-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: #fffcf5;
  border: 1px solid #c2b09a;
  border-radius: 4px;
  padding: 3px 8px;
  font-size: 0.85rem;
  box-shadow: 1px 1px 0 rgba(0,0,0,0.05);
}

.vital-val {
  font-family: monospace, sans-serif;
  color: var(--ink-dark);
}

.vital-val b {
  font-size: 0.95rem;
}

/* HP Bar inside chip */
.hp-chip {
  position: relative;
  overflow: hidden;
  padding-bottom: 5px;
}

.mini-bar-track {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: rgba(0, 0, 0, 0.1);
}

.mini-bar-fill {
  height: 100%;
  transition: width 0.3s ease, background-color 0.3s ease;
  background-color: #28a745;
}

.hp-warning .mini-bar-fill {
  background-color: #e67e22;
}

.hp-danger {
  border-color: #c0392b;
  background: #fdf2f2;
}

.hp-danger .mini-bar-fill {
  background-color: #c0392b;
}

.warning-food {
  border-color: #e67e22;
  background: #fff8f0;
}

.gold-chip {
  border-color: #d4af37;
  background: #fffdf5;
}

.hud-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn-hud-detail, .btn-hud-logbook, .btn-hud-settings, .btn-hud-help {
  background: var(--paper-bg);
  border: 1.5px solid var(--ink-dark);
  color: var(--ink-dark);
  font-family: 'Noto Serif JP', serif;
  font-size: 0.8rem;
  font-weight: bold;
  padding: 4px 10px;
  border-radius: 4px;
  cursor: pointer;
  box-shadow: 2px 2px 0 var(--ink-dark);
  transition: all 0.15s ease;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.btn-hud-detail:hover, .btn-hud-logbook:hover, .btn-hud-settings:hover, .btn-hud-help:hover {
  transform: translate(-1px, -1px);
  box-shadow: 3px 3px 0 var(--ink-dark);
  background: #fff;
}

.btn-hud-detail:active, .btn-hud-logbook:active, .btn-hud-settings:active, .btn-hud-help:active, .btn-hud-record:active, .btn-hud-settings-help:active {
  transform: translate(1px, 1px);
  box-shadow: 1px 1px 0 var(--ink-dark);
}

.btn-hud-record, .btn-hud-settings-help {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: rgba(255, 255, 255, 0.8);
  border: 1px solid var(--ink-dark);
  border-radius: 4px;
  padding: 4px 10px;
  font-family: inherit;
  font-size: 0.85rem;
  font-weight: bold;
  color: var(--ink-dark);
  cursor: pointer;
  box-shadow: 2px 2px 0 var(--ink-dark);
  transition: all 0.15s ease;
}

.btn-hud-record:hover, .btn-hud-settings-help:hover {
  background: var(--ink-dark);
  color: var(--paper-bg);
}

/* Detail Modal Overlay */
.hud-detail-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  z-index: 99999;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 15px;
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
  background: rgba(0,0,0,0.03);
  flex-shrink: 0;
}

.header-tab-group {
  display: inline-flex;
  background: rgba(92, 75, 61, 0.08);
  border: 1px solid rgba(92, 75, 61, 0.2);
  border-radius: 8px;
  padding: 3px;
  gap: 4px;
  max-width: calc(100% - 90px);
}

.hud-tab-btn {
  background: transparent;
  border: none;
  border-radius: 6px;
  padding: 5px 12px;
  font-family: 'Noto Serif JP', serif;
  font-weight: 500;
  font-size: 0.85rem;
  color: var(--ink-light);
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.hud-tab-btn:hover:not(.active) {
  background: rgba(255, 255, 255, 0.5);
  color: var(--ink-dark);
}

.hud-tab-btn.active {
  background: var(--ink-dark);
  color: var(--paper-bg);
  font-weight: bold;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.25);
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

/* Logbook Tab View inside modal */
.logbook-tab-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 350px;
  max-height: 60vh;
}

.logbook-entries {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.4);
  border: 1px dashed rgba(92, 75, 61, 0.3);
  border-radius: 4px;
}

.log-entry {
  display: flex;
  gap: 8px;
  font-size: 0.85rem;
  line-height: 1.5;
  color: var(--ink-dark);
}

.log-bullet {
  font-size: 0.6rem;
  color: var(--ink-light);
  margin-top: 4px;
}

.log-entry.success .log-bullet { color: #2e7d32; }
.log-entry.error .log-bullet { color: #c62828; }
.log-entry.combat .log-bullet { color: #b71c1c; }
.log-entry.info .log-bullet { color: #0277bd; }

.empty-logs {
  text-align: center;
  color: var(--ink-light);
  font-style: italic;
  padding: 30px 10px;
}

/* Mobile Responsiveness */
@media (max-width: 640px) {
  .hud-inner {
    padding: 4px 8px;
    gap: 6px;
  }
  .hero-name-badge {
    font-size: 0.85rem;
  }
  .depth-badge {
    display: none; /* Hide depth on ultra-small to keep single line */
  }
  .vital-chip {
    padding: 2px 6px;
    font-size: 0.75rem;
  }
  .btn-text {
    display: none; /* Icon only on mobile */
  }
  .btn-hud-detail, .btn-hud-settings, .btn-hud-help, .btn-hud-record, .btn-hud-settings-help {
    padding: 4px 8px;
  }
}
</style>
