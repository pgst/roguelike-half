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

          <div class="tos-reference-box" style="margin-top: 10px;">
            <p><strong>🖋️ シナリオ参考文献（d66データ引用元）：</strong></p>
            <ul class="tos-ref-list">
              <li>
                <strong>作品名：</strong>『刻の悪魔のピラミッド』
              </li>
              <li>
                <strong>著者：</strong>火呂居美智 氏
              </li>
              <li>
                <strong>パブリッシャー：</strong>FT書房 (FT新聞 No.4911)
              </li>
              <li>
                <strong>原作ソース：</strong>
                <a href="https://ftbooks.xyz/ftnews/gamebook/RogueLikeHalf_ThePyramid_of_ChronoDemon.txt" target="_blank" rel="noopener noreferrer">
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

.tos-ref-list li {
  line-height: 1.4;
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
