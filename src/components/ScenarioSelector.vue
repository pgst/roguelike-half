<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useGameState } from '../composables/useGameState';
import type { Scenario } from '../types';

const { availableScenarios, activeScenario, currentScreen, isCharacterCreated, hasSavedSession, loadSession } = useGameState();

const hasSaved = ref(false);
const savedScenarioTitle = ref('');
const savedDepth = ref(1);

onMounted(() => {
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
</script>

<template>
  <div class="scenario-selector paper-sheet animate-fade-in">
    <h1 class="game-title">⚔️ ローグライクハーフ ⚔️</h1>
    <p class="subtitle">- 冒険の舞台を選択せよ -</p>
    
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
    
    <div class="scenarios-grid">
      <div 
        v-for="scenario in availableScenarios" 
        :key="scenario.id" 
        class="scenario-card"
        @click="selectScenario(scenario)"
      >
        <div class="scenario-header">
          <h2 class="scenario-title">{{ scenario.title }}</h2>
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
