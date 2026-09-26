<script setup lang="ts">
import { onMounted } from 'vue';
import { useHallOfFame } from '../composables/useHallOfFame';

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const { hallOfFameList, isLoading, fetchError, fetchRecentClears } = useHallOfFame();

onMounted(async () => {
  await fetchRecentClears();
});

function formatDate(date: Date | null): string {
  if (!date) return '-';
  return date.toLocaleDateString('ja-JP', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function getArchetypeIcon(subStat: string): string {
  switch (subStat) {
    case 'magic': return '🔮 魔術';
    case 'luck': return '✨ 幸運';
    case 'strength': return '💪 筋力';
    case 'dexterity': return '🏹 器用';
    default: return '冒険者';
  }
}
</script>

<template>
  <div class="modal-overlay" @click.self="emit('close')">
    <div class="hall-modal paper-sheet">
      <div class="modal-header">
        <h2>🏆 迷宮踏破の殿堂 (最新クリア記録)</h2>
        <button @click="emit('close')" class="btn-close">✕</button>
      </div>

      <p class="subtitle" style="font-size: 0.85rem; color: var(--ink-light); margin: 0 0 15px 0;">
        数々の死線を乗り越え、迷宮最深部の魔将を打ち倒した英雄たちの記録です。
      </p>

      <div v-if="isLoading" class="loading-state">
        📜 迷宮の記録板を読み込んでいます...
      </div>

      <div v-else-if="fetchError" class="error-state">
        ⚠️ 殿堂記録の読み込みに失敗しました: {{ fetchError }}
      </div>

      <div v-else-if="hallOfFameList.length === 0" class="empty-state">
        まだ殿堂に記録された冒険者はいません。あなたが最初の踏破者になりましょう！
      </div>

      <div v-else class="entries-list">
        <div v-for="(entry, index) in hallOfFameList" :key="entry.id" class="hall-card">
          <div class="card-rank">
            <span class="rank-num">#{{ index + 1 }}</span>
          </div>

          <div class="card-body">
            <div class="hero-name-row">
              <span class="hero-name"><b>{{ entry.adventurerName }}</b></span>
              <span class="badge-archetype">{{ getArchetypeIcon(entry.subStatType) }}</span>
              <span class="badge-level">Lv.{{ entry.level }}</span>
            </div>

            <div class="scenario-name">
              🗺️ {{ entry.scenarioTitle }}
            </div>

            <div class="details-row">
              <span>🪙 金貨: <b>{{ entry.gold }}</b> 枚</span>
              <span class="equip-text">{{ entry.equipmentSummary }}</span>
            </div>

            <div class="date-text">
              踏破日時: {{ formatDate(entry.clearedAt) }}
            </div>
          </div>
        </div>
      </div>

      <div class="modal-footer" style="margin-top: 20px; display: flex; justify-content: space-between; align-items: center;">
        <button @click="fetchRecentClears" class="btn-ink btn-mini" :disabled="isLoading">🔄 最新情報に更新</button>
        <button @click="emit('close')" class="btn-ink">閉じる</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 99999;
  padding: 15px;
}

.hall-modal {
  max-width: 600px;
  width: 100%;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  border: 3px double var(--ink-dark);
  border-radius: 8px;
  padding: 25px;
  background: #fffcf5;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 2px solid var(--ink-dark);
  padding-bottom: 8px;
  margin-bottom: 8px;
}

.modal-header h2 {
  font-family: 'Noto Serif JP', serif;
  font-size: 1.25rem;
  margin: 0;
  color: var(--ink-dark);
}

.btn-close {
  background: transparent;
  border: none;
  font-size: 1.2rem;
  cursor: pointer;
  color: var(--ink-dark);
}

.entries-list {
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-right: 5px;
}

.hall-card {
  display: flex;
  gap: 12px;
  align-items: center;
  border: 1px solid #c2b09a;
  background: rgba(255, 255, 255, 0.7);
  border-radius: 6px;
  padding: 10px 14px;
}

.card-rank {
  font-family: 'Noto Serif JP', serif;
  font-size: 1.2rem;
  font-weight: bold;
  color: #8c1c1c;
  min-width: 35px;
}

.card-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.hero-name-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.hero-name {
  font-size: 1rem;
  color: var(--ink-dark);
}

.badge-archetype {
  font-size: 0.75rem;
  background: #f0e6d6;
  padding: 1px 6px;
  border-radius: 3px;
  color: #5c4b3d;
}

.badge-level {
  font-size: 0.75rem;
  background: #8c1c1c;
  color: white;
  padding: 1px 6px;
  border-radius: 3px;
  font-weight: bold;
}

.scenario-name {
  font-size: 0.85rem;
  font-weight: bold;
  color: var(--ink-dark);
}

.details-row {
  display: flex;
  justify-content: space-between;
  font-size: 0.8rem;
  color: #555;
  gap: 10px;
  flex-wrap: wrap;
}

.date-text {
  font-size: 0.75rem;
  color: #888;
  font-style: italic;
}

.loading-state, .error-state, .empty-state {
  padding: 30px;
  text-align: center;
  font-size: 0.95rem;
  color: var(--ink-light);
  font-style: italic;
}
</style>
