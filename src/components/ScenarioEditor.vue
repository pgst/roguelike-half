<script setup lang="ts">
import { ref, reactive, computed } from 'vue';
import type { Scenario, DungeonEvent } from '../types';
import { ALL_D66_CODES, useCustomScenarios } from '../composables/useCustomScenarios';
import { useGameState } from '../composables/useGameState';

const props = defineProps<{
  initialScenario?: Scenario | null;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'saved', scenario: Scenario): void;
}>();

const { saveCustomScenario, createDefaultTemplate, cloneFromExisting, exportScenarioAsJson, calculateRecommendedLevel } = useCustomScenarios();
const { availableScenarios } = useGameState();

// 編集用ドラフトの初期化
const draft = reactive<Scenario>(
  props.initialScenario 
    ? JSON.parse(JSON.stringify(props.initialScenario))
    : createDefaultTemplate()
);

// リアルタイム推奨適正レベルの算出
const computedRecommendedLevel = computed(() => {
  return calculateRecommendedLevel(draft);
});

function applyRecommendedLevel() {
  draft.recommendedLevel = computedRecommendedLevel.value;
}

const activeTab = ref<'meta' | 'boss' | 'grid'>('meta');
const selectedD66Code = ref<string>('11');
const saveError = ref<string | null>(null);

const currentRoom = computed<DungeonEvent>({
  get: () => {
    if (!draft.d66EventTable[selectedD66Code.value]) {
      draft.d66EventTable[selectedD66Code.value] = {
        title: `部屋 ${selectedD66Code.value}`,
        d66Code: selectedD66Code.value,
        description: '静かな小部屋です。',
        type: 'empty'
      };
    }
    return draft.d66EventTable[selectedD66Code.value];
  },
  set: (val) => {
    draft.d66EventTable[selectedD66Code.value] = val;
  }
});

// ボス敵オブジェクトへの参照ヘルパー
const bossEnemy = computed(() => {
  if (!draft.bossEvent.enemies || draft.bossEvent.enemies.length === 0) {
    draft.bossEvent.enemies = [{
      name: '迷宮の魔将',
      level: 5,
      lifeMax: 10,
      lifeCurrent: 10,
      attackCount: 1,
      tags: ['strong'],
      count: 1,
      weaponAttribute: 'strike'
    }];
  }
  return draft.bossEvent.enemies[0]!;
});

// テンプレートの複製
function handleCloneFromOfficial(scenarioId: string) {
  const target = availableScenarios.value.find(s => s.id === scenarioId);
  if (!target) return;
  if (!confirm(`公式シナリオ「${target.title}」を複製してエディタに読み込みますか？（現在の編集内容は上書きされます）`)) {
    return;
  }
  const cloned = cloneFromExisting(target);
  Object.assign(draft, cloned);
  saveError.value = null;
}

// 標準構成で自動生成
function handleGenerateDefault() {
  if (!confirm('標準的なバランスのダンジョン（遭遇40%/罠25%/宝15%/NPC10%/休息10%）で36部屋を自動初期化しますか？')) {
    return;
  }
  const tpl = createDefaultTemplate();
  tpl.id = draft.id;
  tpl.title = draft.title;
  Object.assign(draft, tpl);
  saveError.value = null;
}

// 部屋イベントに敵を追加
function addEnemyToCurrentRoom() {
  if (!currentRoom.value.enemies) {
    currentRoom.value.enemies = [];
  }
  currentRoom.value.enemies.push({
    name: 'ゴブリン',
    level: 2,
    lifeMax: 1,
    lifeCurrent: 1,
    attackCount: 1,
    tags: ['weak'],
    count: 1,
    weaponAttribute: 'strike'
  });
}

function removeEnemyFromCurrentRoom(idx: number) {
  if (currentRoom.value.enemies) {
    currentRoom.value.enemies.splice(idx, 1);
  }
}

// 保存処理
async function handleSave() {
  saveError.value = null;
  const res = await saveCustomScenario(draft);
  if (res.success) {
    emit('saved', draft);
    emit('close');
  } else {
    saveError.value = res.error || '保存に失敗しました。';
  }
}

function handleDownloadJson() {
  exportScenarioAsJson(draft);
}

function getRoomTypeBadge(type: string) {
  switch (type) {
    case 'encounter': return { icon: '👾', text: '遭遇', color: '#c0392b' };
    case 'trap': return { icon: '⚠️', text: '罠', color: '#d35400' };
    case 'treasure': return { icon: '💎', text: '宝物', color: '#27ae60' };
    case 'npc': return { icon: '🛒', text: 'NPC', color: '#8e44ad' };
    case 'rest': return { icon: '🏕️', text: '休息', color: '#2980b9' };
    default: return { icon: '🚪', text: '空室', color: '#7f8c8d' };
  }
}
</script>

<template>
  <div class="editor-overlay">
    <div class="editor-window paper-sheet">
      <!-- Header -->
      <div class="editor-header">
        <div class="header-left">
          <h2>🖋️ シナリオエディタ</h2>
          <span class="editing-id-badge">ID: {{ draft.id }}</span>
        </div>
        
        <div class="header-actions">
          <!-- Template Helpers -->
          <div class="helper-dropdown">
            <select @change="(e: any) => e.target.value && handleCloneFromOfficial(e.target.value)" class="select-tpl">
              <option value="">📋 公式シナリオから複製...</option>
              <option v-for="s in availableScenarios.filter(s => !s.id.startsWith('custom_'))" :key="s.id" :value="s.id">
                {{ s.title }}
              </option>
            </select>
          </div>

          <button @click="handleGenerateDefault" class="btn-ink btn-mini" title="36部屋を標準比率で自動生成">
            🎲 自動初期化
          </button>
          
          <button @click="handleDownloadJson" class="btn-ink btn-mini" title="このシナリオをJSONファイルとして保存">
            💾 JSON出力
          </button>

          <button @click="handleSave" class="btn-ink btn-mini btn-primary-ink">
            ✓ 保存して閉じる
          </button>
          
          <button @click="emit('close')" class="btn-ink btn-mini btn-secondary">
            ✕ キャンセル
          </button>
        </div>
      </div>

      <div v-if="saveError" class="alert-box error" style="margin: 10px 0;">
        ⚠️ {{ saveError }}
      </div>

      <!-- Navigation Tabs -->
      <div class="editor-tabs">
        <button 
          @click="activeTab = 'meta'" 
          class="tab-btn" 
          :class="{ active: activeTab === 'meta' }"
        >
          📜 1. 基本設定
        </button>
        <button 
          @click="activeTab = 'boss'" 
          class="tab-btn" 
          :class="{ active: activeTab === 'boss' }"
        >
          👑 2. 決戦ボス設定
        </button>
        <button 
          @click="activeTab = 'grid'" 
          class="tab-btn" 
          :class="{ active: activeTab === 'grid' }"
        >
          🗺️ 3. d66イベント表 (全36部屋)
        </button>
      </div>

      <!-- TAB 1: Meta Settings -->
      <div v-if="activeTab === 'meta'" class="tab-content">
        <div class="form-group">
          <label>シナリオのタイトル *</label>
          <input v-model="draft.title" type="text" class="input-ink" placeholder="例: 奈落の魔窟" />
        </div>

        <div class="form-group">
          <label>シナリオの説明文</label>
          <textarea v-model="draft.description" rows="3" class="input-ink" placeholder="この冒険の舞台の背景や目的を記入してください"></textarea>
        </div>

        <div class="form-row" style="display: flex; gap: 20px;">
          <div class="form-group" style="flex: 1;">
            <label>適正レベル表示</label>
            <input v-model="draft.recommendedLevel" type="text" class="input-ink" placeholder="例: 適正レベル：11-12" />
            <div class="level-recommend-assistant">
              <span class="recommend-label">💡 推奨算出: <strong>{{ computedRecommendedLevel }}</strong></span>
              <button 
                type="button" 
                class="btn-ink btn-mini btn-apply-level" 
                title="算出された推奨適正レベルを入力欄に反映します"
                @click="applyRecommendedLevel"
              >
                反映
              </button>
            </div>
          </div>

          <div class="form-group" style="flex: 1;">
            <label>決戦までの踏破部屋数 (3〜50) *</label>
            <input v-model.number="draft.totalRoomsToClear" type="number" min="3" max="50" class="input-ink" />
            <small style="color: var(--ink-light);">通常シナリオは 8 部屋程度が標準です。</small>
          </div>
        </div>
      </div>

      <!-- TAB 2: Boss Settings -->
      <div v-if="activeTab === 'boss'" class="tab-content">
        <h3 class="section-title">👑 最深部の決戦ボス</h3>
        <p style="font-size: 0.85rem; color: var(--ink-light); margin-bottom: 15px;">
          規定の部屋数を踏破した後に発生する、最終決戦のイベントとボスのステータスです。
        </p>

        <div class="form-group">
          <label>ボス決戦イベント名</label>
          <input v-model="draft.bossEvent.title" type="text" class="input-ink" placeholder="例: 魔将の玉座" />
        </div>

        <div class="form-group">
          <label>決戦突入時の描写テキスト</label>
          <textarea v-model="draft.bossEvent.description" rows="2" class="input-ink"></textarea>
        </div>

        <div class="boss-card paper-sheet" style="padding: 15px; border: 2px dashed #8c1c1c; background: #fffcf8; margin-top: 15px;">
          <h4 style="margin: 0 0 10px 0; color: #8c1c1c;">👾 ボスクリーチャーデータ</h4>
          
          <div class="form-row" style="display: flex; gap: 15px; flex-wrap: wrap;">
            <div class="form-group" style="flex: 2; min-width: 180px;">
              <label>ボス名 *</label>
              <input v-model="bossEnemy.name" type="text" class="input-ink" />
            </div>

            <div class="form-group" style="flex: 1; min-width: 90px;">
              <label>レベル (目標値)</label>
              <input v-model.number="bossEnemy.level" type="number" min="1" max="20" class="input-ink" />
            </div>

            <div class="form-group" style="flex: 1; min-width: 90px;">
              <label>生命力 (HP)</label>
              <input v-model.number="bossEnemy.lifeMax" @input="bossEnemy.lifeCurrent = bossEnemy.lifeMax" type="number" min="1" max="100" class="input-ink" />
            </div>

            <div class="form-group" style="flex: 1; min-width: 90px;">
              <label>攻撃回数 / R</label>
              <input v-model.number="bossEnemy.attackCount" type="number" min="1" max="5" class="input-ink" />
            </div>

            <div class="form-group" style="flex: 1; min-width: 120px;">
              <label>攻撃属性</label>
              <select v-model="bossEnemy.weaponAttribute" class="input-ink">
                <option value="strike">打撃 (strike)</option>
                <option value="slash">斬撃 (slash)</option>
              </select>
            </div>
          </div>

          <div class="form-group" style="margin-top: 10px;">
            <label>特殊タグ</label>
            <div style="display: flex; gap: 15px; flex-wrap: wrap; margin-top: 5px;">
              <label><input type="checkbox" value="undead" v-model="bossEnemy.tags" /> 💀 アンデッド (聖水・招天有効)</label>
              <label><input type="checkbox" value="golem" v-model="bossEnemy.tags" /> 🤖 ゴーレム (気絶無効)</label>
              <label><input type="checkbox" value="demon" v-model="bossEnemy.tags" /> 😈 悪魔</label>
            </div>
          </div>
        </div>
      </div>

      <!-- TAB 3: 36 Rooms Grid -->
      <div v-if="activeTab === 'grid'" class="tab-content grid-tab-layout">
        <!-- Left: 6x6 d66 Grid Selector -->
        <div class="grid-selector-pane">
          <h4 style="margin: 0 0 10px 0; font-size: 0.95rem;">🎲 d66 出目マップ (全36マス)</h4>
          <div class="d66-grid">
            <div 
              v-for="code in ALL_D66_CODES" 
              :key="code"
              class="grid-cell"
              :class="{ selected: selectedD66Code === code }"
              @click="selectedD66Code = code"
            >
              <div class="cell-code">{{ code }}</div>
              <div class="cell-badge" :style="{ backgroundColor: getRoomTypeBadge(draft.d66EventTable[code]?.type || 'empty').color }">
                {{ getRoomTypeBadge(draft.d66EventTable[code]?.type || 'empty').icon }}
              </div>
            </div>
          </div>
        </div>

        <!-- Right: Current Room Detail Editor -->
        <div class="room-editor-pane paper-sheet">
          <div class="room-editor-header">
            <h3>🚪 出目【{{ selectedD66Code }}】の部屋設定</h3>
            <span class="badge-type" :style="{ backgroundColor: getRoomTypeBadge(currentRoom.type).color, color: '#fff' }">
              {{ getRoomTypeBadge(currentRoom.type).icon }} {{ getRoomTypeBadge(currentRoom.type).text }}
            </span>
          </div>

          <div class="form-group">
            <label>イベント名</label>
            <input v-model="currentRoom.title" type="text" class="input-ink" />
          </div>

          <div class="form-group">
            <label>部屋の種類 (イベント種別)</label>
            <select v-model="currentRoom.type" class="input-ink">
              <option value="encounter">👾 モンスター遭遇 (encounter)</option>
              <option value="trap">⚠️ 罠・トラップ (trap)</option>
              <option value="treasure">💎 宝物・遺品 (treasure)</option>
              <option value="npc">🛒 NPC・行商人・出会い (npc)</option>
              <option value="rest">🏕️ 休息・安全地帯 (rest)</option>
              <option value="empty">🚪 空室・静かな部屋 (empty)</option>
            </select>
          </div>

          <div class="form-group">
            <label>部屋の描写・メッセージ</label>
            <textarea v-model="currentRoom.description" rows="2" class="input-ink"></textarea>
          </div>

          <!-- Type: Encounter Editor -->
          <div v-if="currentRoom.type === 'encounter'" class="type-detail-box">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <b>👾 出現クリーチャー一覧:</b>
              <button @click="addEnemyToCurrentRoom" class="btn-ink btn-mini">+ 敵を追加</button>
            </div>

            <div v-for="(enemy, eIdx) in currentRoom.enemies" :key="eIdx" class="sub-card">
              <div style="display: flex; gap: 8px; align-items: center; margin-bottom: 6px;">
                <input v-model="enemy.name" type="text" placeholder="敵の名前" class="input-ink" style="flex: 2;" />
                <button @click="removeEnemyFromCurrentRoom(eIdx)" class="btn-del">✕</button>
              </div>

              <div style="display: flex; gap: 8px; font-size: 0.8rem; flex-wrap: wrap;">
                <label>Lv: <input v-model.number="enemy.level" type="number" min="1" max="20" style="width: 40px;" /></label>
                <label>HP: <input v-model.number="enemy.lifeMax" @input="enemy.lifeCurrent = enemy.lifeMax" type="number" min="1" max="50" style="width: 40px;" /></label>
                <label>数: <input v-model.number="enemy.count" type="number" min="1" max="10" style="width: 40px;" /></label>
                <label>
                  属性: 
                  <select v-model="enemy.weaponAttribute">
                    <option value="strike">打撃</option>
                    <option value="slash">斬撃</option>
                  </select>
                </label>
                <label><input type="checkbox" value="weak" v-model="enemy.tags" /> 雑魚</label>
                <label><input type="checkbox" value="strong" v-model="enemy.tags" /> 強敵</label>
                <label><input type="checkbox" value="undead" v-model="enemy.tags" /> アンデッド</label>
              </div>
            </div>
            <div v-if="!currentRoom.enemies || currentRoom.enemies.length === 0" style="color: var(--ink-light); font-size: 0.85rem; font-style: italic;">
              敵が設定されていません。「+ 敵を追加」を押してください。
            </div>
          </div>

          <!-- Type: Trap Editor -->
          <div v-if="currentRoom.type === 'trap'" class="type-detail-box">
            <b>⚠️ 罠のパラメータ設定:</b>
            <div style="display: flex; gap: 10px; margin-top: 8px; flex-wrap: wrap;">
              <div class="form-group" style="flex: 1;">
                <label>解除能力値</label>
                <select v-model="currentRoom.trapStat" class="input-ink">
                  <option value="dexterity">敏捷 (dexterity)</option>
                  <option value="strength">腕力 (strength)</option>
                  <option value="magic">魔術 (magic)</option>
                  <option value="luck">幸運 (luck)</option>
                  <option value="skill">技量 (skill)</option>
                </select>
              </div>
              <div class="form-group" style="flex: 1;">
                <label>目標値 (通常は4)</label>
                <input v-model.number="currentRoom.trapTarget" type="number" min="1" max="10" class="input-ink" />
              </div>
              <div class="form-group" style="flex: 1;">
                <label>失敗時ダメージ</label>
                <input v-model.number="currentRoom.trapDamage" type="number" min="1" max="10" class="input-ink" />
              </div>
            </div>
          </div>

          <!-- Type: Treasure Editor -->
          <div v-if="currentRoom.type === 'treasure'" class="type-detail-box">
            <b>💎 宝物設定:</b>
            <div class="form-group" style="margin-top: 8px;">
              <label>宝物表の出目修正 (lootModifier)</label>
              <input v-model.number="currentRoom.lootModifier" type="number" min="-2" max="5" class="input-ink" placeholder="通常は 0" />
            </div>
          </div>

          <!-- Type: NPC Editor -->
          <div v-if="currentRoom.type === 'npc'" class="type-detail-box">
            <b>🛒 NPCの種類:</b>
            <select v-model="currentRoom.npcType" class="input-ink" style="margin-top: 8px;">
              <option value="merchant">行商人 (武器・防具・聖水の販売)</option>
              <option value="priest">司祭 (治療または聖水の譲渡)</option>
              <option value="mercenary">負傷した傭兵 (治療で剣士雇用)</option>
              <option value="bribe">通行税の徴収人 (ワイロ交渉)</option>
            </select>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<style scoped>
.editor-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.75);
  z-index: 100000;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 15px;
}

.editor-window {
  max-width: 1000px;
  width: 100%;
  max-height: 94vh;
  display: flex;
  flex-direction: column;
  border: 3px double var(--ink-dark);
  border-radius: 8px;
  background: #fffcf5;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.6);
  font-family: 'Noto Serif JP', serif;
}

.editor-header {
  padding: 12px 20px;
  border-bottom: 2px solid var(--ink-dark);
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  background: rgba(0,0,0,0.02);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-left h2 {
  margin: 0;
  font-size: 1.25rem;
  color: var(--ink-dark);
}

.editing-id-badge {
  font-size: 0.75rem;
  background: #e8e0d4;
  padding: 2px 6px;
  border-radius: 3px;
  color: var(--ink-light);
  font-family: monospace;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.select-tpl {
  padding: 4px 8px;
  border: 1px solid var(--ink-dark);
  border-radius: 4px;
  background: #fff;
  font-size: 0.8rem;
  color: var(--ink-dark);
  cursor: pointer;
}

.editor-tabs {
  display: flex;
  background: #ede6d8;
  border-bottom: 1px solid var(--ink-dark);
}

.tab-btn {
  flex: 1;
  padding: 10px;
  border: none;
  background: none;
  font-family: 'Noto Serif JP', serif;
  font-size: 0.95rem;
  font-weight: bold;
  color: var(--ink-light);
  cursor: pointer;
  transition: all 0.15s ease;
  border-right: 1px solid #d4c8b5;
}

.tab-btn:last-child {
  border-right: none;
}

.tab-btn.active {
  background: #fffcf5;
  color: var(--ink-dark);
  border-top: 2px solid var(--ink-dark);
}

.tab-content {
  padding: 20px;
  overflow-y: auto;
  flex-grow: 1;
}

.form-group {
  margin-bottom: 14px;
}

.form-group label {
  display: block;
  font-weight: bold;
  font-size: 0.85rem;
  color: var(--ink-dark);
  margin-bottom: 4px;
}

.input-ink {
  width: 100%;
  padding: 6px 10px;
  border: 1px solid #c2b09a;
  border-radius: 4px;
  background: #fff;
  font-family: inherit;
  font-size: 0.9rem;
  color: var(--ink-dark);
  box-sizing: border-box;
}

.input-ink:focus {
  outline: none;
  border-color: var(--ink-dark);
  box-shadow: 0 0 3px rgba(44, 30, 14, 0.3);
}

/* Grid Layout for Tab 3 */
.grid-tab-layout {
  display: grid;
  grid-template-columns: 240px 1fr;
  gap: 15px;
  padding: 15px;
}

.d66-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 4px;
}

.grid-cell {
  background: #fff;
  border: 1px solid #c2b09a;
  border-radius: 4px;
  padding: 4px 2px;
  text-align: center;
  cursor: pointer;
  transition: all 0.1s ease;
  user-select: none;
}

.grid-cell:hover {
  transform: scale(1.05);
  border-color: var(--ink-dark);
}

.grid-cell.selected {
  border: 2px solid var(--ink-dark);
  background: #fffae8;
  box-shadow: 0 2px 4px rgba(0,0,0,0.15);
}

.cell-code {
  font-size: 0.75rem;
  font-weight: bold;
  font-family: monospace;
  color: var(--ink-dark);
}

.cell-badge {
  font-size: 0.65rem;
  border-radius: 2px;
  color: #fff;
  margin-top: 2px;
  padding: 1px 0;
}

.room-editor-pane {
  padding: 15px;
  border: 1px solid #c2b09a;
  border-radius: 6px;
  background: #fff;
  overflow-y: auto;
}

.room-editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px dashed #c2b09a;
  padding-bottom: 8px;
  margin-bottom: 12px;
}

.room-editor-header h3 {
  margin: 0;
  font-size: 1.05rem;
}

.badge-type {
  font-size: 0.8rem;
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: bold;
}

.type-detail-box {
  background: #faf7f0;
  border: 1px dashed #c2b09a;
  border-radius: 4px;
  padding: 10px;
  margin-top: 10px;
}

.sub-card {
  background: #fff;
  border: 1px solid #e0d8c9;
  border-radius: 4px;
  padding: 8px;
  margin-bottom: 8px;
}

.btn-del {
  background: #c0392b;
  color: #fff;
  border: none;
  border-radius: 3px;
  padding: 2px 6px;
  cursor: pointer;
  font-size: 0.8rem;
}

.level-recommend-assistant {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 6px;
  padding: 5px 10px;
  background: #fbf7ed;
  border: 1px dashed #c2b09a;
  border-radius: 4px;
  font-size: 0.8rem;
}

.recommend-label {
  color: #5d4037;
}

.recommend-label strong {
  color: #8b263e;
}

.btn-apply-level {
  font-size: 0.75rem;
  padding: 2px 8px;
  background: #efe6d8;
  color: var(--ink-dark);
  border: 1px solid #b8977e;
  border-radius: 3px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s;
}

.btn-apply-level:hover {
  background: #e4d5c0;
}

@media (max-width: 768px) {
  .grid-tab-layout {
    grid-template-columns: 1fr;
  }
}
</style>
