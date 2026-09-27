<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';
import { useGameState } from '../composables/useGameState';

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const { logs } = useGameState();

const logbookContainerRef = ref<HTMLElement | null>(null);

watch(() => logs.value.length, async () => {
  await nextTick();
  if (logbookContainerRef.value) {
    logbookContainerRef.value.scrollTop = logbookContainerRef.value.scrollHeight;
  }
});
</script>

<template>
  <div class="modal-overlay" @click.self="emit('close')">
    <div class="logbook-modal paper-sheet animate-fade-in">
      <div class="modal-header">
        <div class="header-left">
          <h2>📜 冒険の足跡（全記録）</h2>
          <span class="log-count">全 {{ logs.length }} 件</span>
        </div>
        <button @click="emit('close')" class="btn-close" title="閉じる">✕</button>
      </div>

      <div class="modal-body">
        <div class="logbook-entries" ref="logbookContainerRef">
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
}

.logbook-modal {
  width: 90%;
  max-width: 680px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  background: #fdfaf2;
  border: 2px solid #8b6b4b;
  box-shadow: 0 10px 25px rgba(0,0,0,0.5), inset 0 0 15px rgba(212, 185, 140, 0.4);
  border-radius: 6px;
  padding: 18px 20px;
  color: #2b2b2b;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 2px solid #c4ab80;
  padding-bottom: 10px;
  margin-bottom: 12px;
}

.header-left {
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.modal-header h2 {
  margin: 0;
  font-size: 1.25rem;
  color: #4a2e18;
}

.log-count {
  font-size: 0.85rem;
  color: #666;
}

.btn-close {
  background: none;
  border: none;
  font-size: 1.2rem;
  cursor: pointer;
  color: #8b6b4b;
  font-weight: bold;
  padding: 4px 8px;
}

.btn-close:hover {
  color: #8c1c1c;
}

.modal-body {
  flex: 1;
  min-height: 250px;
  max-height: 60vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.logbook-entries {
  flex: 1;
  overflow-y: auto;
  padding: 10px;
  background: rgba(255, 255, 255, 0.6);
  border: 1px solid #d4c2a5;
  border-radius: 4px;
  font-family: serif;
  font-size: 0.92rem;
  line-height: 1.5;
}

.log-entry {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin-bottom: 6px;
  word-break: break-word;
}

.log-bullet {
  font-size: 0.65rem;
  margin-top: 4px;
  opacity: 0.6;
}

.log-entry.info {
  color: #2b2b2b;
}

.log-entry.roll {
  color: #1a4d8c;
  font-weight: 500;
}

.log-entry.combat {
  color: #7a1d1d;
}

.log-entry.damage {
  color: #b31d1d;
  font-weight: bold;
}

.log-entry.success {
  color: #1e6b2e;
  font-weight: bold;
}

.log-entry.error {
  color: #8b1c1c;
  font-weight: bold;
}

.empty-logs {
  color: #888;
  font-style: italic;
  text-align: center;
  padding: 30px 10px;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  border-top: 1px solid #c4ab80;
  padding-top: 10px;
  margin-top: 12px;
}

.btn-ink {
  background: #3e2723;
  color: #f7f3e9;
  border: 1px solid #2b1d12;
  padding: 6px 18px;
  font-size: 0.9rem;
  cursor: pointer;
  border-radius: 4px;
  font-weight: bold;
}

.btn-ink:hover {
  background: #5d3a24;
}

.animate-fade-in {
  animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-8px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
