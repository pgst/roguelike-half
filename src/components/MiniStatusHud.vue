<script setup lang="ts">
import { ref, computed } from 'vue';
import { useGameState } from '../composables/useGameState';
import AdventureSheet from './AdventureSheet.vue';
import SettingsModal from './SettingsModal.vue';

const {
  character,
  followers,
  dungeonDepth,
  totalRoomsToClear,
  currentScreen
} = useGameState();

const showDetailModal = ref(false);
const showSettingsModal = ref(false);

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
        <div v-if="followers.length > 0" class="vital-chip" title="同行中の従者">
          <span class="vital-icon">👥</span>
          <span class="vital-val"><b>{{ followers.length }}</b>人</span>
        </div>
      </div>

      <!-- Right: Detailed Sheet Toggle Button & Settings -->
      <div class="hud-right">
        <button @click="showDetailModal = true" class="btn-hud-detail" title="冒険者シートの詳細を表示">
          📜 <span class="btn-text">ステータス詳細</span>
        </button>
        <button @click="showSettingsModal = true" class="btn-hud-settings" title="環境設定">
          ⚙️ <span class="btn-text">設定</span>
        </button>
      </div>
    </div>

    <!-- Mobile / Floating Detail Modal Drawer -->
    <Teleport to="body">
      <div v-if="showDetailModal" class="hud-detail-overlay" @click.self="showDetailModal = false">
        <div class="hud-detail-modal paper-sheet">
          <div class="modal-header">
            <h3>📜 冒険者シート・詳細</h3>
            <button @click="showDetailModal = false" class="btn-close-hud">✕ 閉じる</button>
          </div>
          <div class="modal-body">
            <AdventureSheet />
          </div>
        </div>
      </div>
    </Teleport>

    <!-- 環境設定モーダル -->
    <SettingsModal v-if="showSettingsModal" @close="showSettingsModal = false" />
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

.btn-hud-detail, .btn-hud-settings {
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

.btn-hud-detail:hover, .btn-hud-settings:hover {
  transform: translate(-1px, -1px);
  box-shadow: 3px 3px 0 var(--ink-dark);
  background: #fff;
}

.btn-hud-detail:active, .btn-hud-settings:active {
  transform: translate(1px, 1px);
  box-shadow: 1px 1px 0 var(--ink-dark);
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
  padding: 12px 18px;
  border-bottom: 2px solid var(--ink-dark);
  background: rgba(0,0,0,0.03);
  flex-shrink: 0;
}

.modal-header h3 {
  margin: 0;
  font-size: 1.1rem;
  color: var(--ink-dark);
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
  padding: 18px 22px 24px;
  overflow-y: auto;
  flex: 1;
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
  .btn-hud-detail {
    padding: 4px 8px;
  }
}
</style>
