<script setup lang="ts">
import { onMounted } from 'vue';
import { useHallOfFame } from '../composables/useHallOfFame';

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const { hallOfFameList, isLoading, fetchError, isCooldown, cooldownRemaining, lastFetchedAt, fetchRecentClears } = useHallOfFame();

onMounted(async () => {
  // 初回マウント時はキャッシュがあればFirestoreへのreadを行わず即座に表示
  await fetchRecentClears(false);
});

function handleRefresh() {
  fetchRecentClears(true);
}

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

      <div class="header-desc-row">
        <p class="subtitle">
          数々の死線を乗り越え、迷宮最深部のボスを打ち倒した英雄たちの記録です。
        </p>
        <span v-if="lastFetchedAt > 0" class="cache-badge">
          ⚡ キャッシュ有効 (5分間)
        </span>
      </div>

      <div v-if="isLoading && hallOfFameList.length === 0" class="loading-state">
        📜 迷宮の記録板を読み込んでいます...
      </div>

      <div v-else-if="fetchError && hallOfFameList.length === 0" class="error-state">
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
        <button 
          @click="handleRefresh" 
          class="btn-ink btn-mini" 
          :disabled="isLoading || isCooldown"
        >
          <span v-if="isLoading">取得中...</span>
          <span v-else-if="isCooldown">🔄 更新待機中 ({{ cooldownRemaining }}秒)</span>
          <span v-else>🔄 最新情報に更新</span>
        </button>
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
  font-size: 1.25rem;
  cursor: pointer;
  color: var(--ink-dark);
  line-height: 1;
}

.header-desc-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
  flex-wrap: wrap;
  gap: 8px;
}

.subtitle {
  font-size: 0.85rem;
  color: var(--ink-light);
  margin: 0;
}

.cache-badge {
  font-size: 0.75rem;
  color: #2e7d32;
  background: #e8f5e9;
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: bold;
}

.loading-state, .error-state, .empty-state {
  padding: 30px 15px;
  text-align: center;
  color: var(--ink-light);
  font-style: italic;
}

.error-state {
  color: #c62828;
}

.entries-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding-right: 5px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.hall-card {
  display: flex;
  flex-shrink: 0;
  min-height: 84px;
  border: 1px solid var(--ink-dark);
  background: rgba(255, 255, 255, 0.5);
  border-radius: 4px;
  overflow: hidden;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
}

.card-rank {
  background: var(--ink-dark);
  color: var(--paper-bg);
  width: 45px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Noto Serif JP', serif;
  font-weight: 900;
  font-size: 1.1rem;
}

.card-body {
  padding: 10px 14px;
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.hero-name-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.hero-name {
  font-size: 1.05rem;
  color: var(--ink-dark);
}

.badge-archetype {
  font-size: 0.8rem;
  background: rgba(0,0,0,0.06);
  padding: 2px 6px;
  border-radius: 4px;
}

.badge-level {
  font-size: 0.8rem;
  background: var(--gold-accent, #c5a059);
  color: #fff;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: bold;
}

.scenario-name {
  font-size: 0.9rem;
  color: var(--ink-dark);
  font-weight: bold;
}

.details-row {
  display: flex;
  justify-content: space-between;
  font-size: 0.85rem;
  color: var(--ink-light);
  margin-top: 2px;
}

.equip-text {
  font-size: 0.8rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 250px;
}

.date-text {
  font-size: 0.75rem;
  color: #888;
  text-align: right;
}

.btn-ink {
  background: var(--paper-bg);
  border: 1px solid var(--ink-dark);
  color: var(--ink-dark);
  padding: 6px 14px;
  font-family: inherit;
  font-size: 0.9rem;
  font-weight: bold;
  cursor: pointer;
  border-radius: 3px;
  transition: all 0.2s ease;
}

.btn-ink:hover:not(:disabled) {
  background: var(--ink-dark);
  color: var(--paper-bg);
}

.btn-ink:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-mini {
  font-size: 0.8rem;
  padding: 4px 10px;
}
</style>
