<script setup lang="ts">
import { useSettings } from '../composables/useSettings';

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const { showDiceOverlay, toggleDiceOverlay } = useSettings();
</script>

<template>
  <div class="modal-overlay" @click.self="emit('close')">
    <div class="settings-modal paper-sheet animate-fade-in">
      <div class="modal-header">
        <h2>⚙️ 環境設定</h2>
        <button @click="emit('close')" class="btn-close" title="閉じる">✕</button>
      </div>

      <div class="settings-body">
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
      </div>

      <div class="modal-footer">
        <button @click="emit('close')" class="btn-ink btn-close-footer">完了</button>
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
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  backdrop-filter: blur(2px);
}

.settings-modal {
  max-width: 480px;
  width: 90%;
  padding: 24px;
  border-radius: 8px;
  background: var(--paper-bg);
  border: 2px solid var(--ink-dark);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 2px solid var(--ink-dark);
  padding-bottom: 10px;
  margin-bottom: 20px;
}

.modal-header h2 {
  font-family: 'Noto Serif JP', serif;
  font-size: 1.25rem;
  margin: 0;
  color: var(--ink-dark);
}

.btn-close {
  background: none;
  border: none;
  font-size: 1.2rem;
  cursor: pointer;
  color: var(--ink-dark);
  padding: 2px 6px;
}

.settings-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  background: rgba(255, 255, 255, 0.6);
  border: 1px solid #c2b09a;
  border-radius: 6px;
  padding: 14px 16px;
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
  font-size: 0.8rem;
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

.btn-toggle:hover {
  transform: translateY(-1px);
}

.modal-footer {
  margin-top: 24px;
  display: flex;
  justify-content: flex-end;
}

.btn-close-footer {
  padding: 6px 20px;
  font-size: 0.9rem;
}
</style>
