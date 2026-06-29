<script setup lang="ts">
import { computed } from 'vue';
import { useGameState } from '../composables/useGameState';
import { useCombat } from '../composables/useCombat';

const {
  character,
  followers,
  combatState,
  addLog,
  logs,
  dungeonDepth,
  totalRoomsToClear,
  isSwitchingWeapons
} = useGameState();

const isBossRoom = computed(() => dungeonDepth.value >= totalRoomsToClear.value);

const {
  rollReactionCheck,
  payBribe,
  refuseBribeAndFight,
  escapeCombat,
  playerAttack,
  castSpell,
  castMiracle,
  resolveDefense,
  resolveLoot,
  confirmCombatResult,
  confirmReactionResult,
  resolveWeaponSwitch,
  executeCover,
  cancelCover,
  applyFriendshipReaction
} = useCombat();

const activeAttacks = computed(() => (combatState as any).activeAttacks || []);

const isRound0SpellDisabled = computed(() => {
  if (combatState.round !== 0) return false;
  if (isBossRoom.value) return combatState.hasRangedFired;
  
  if (!combatState.hasReactionChecked) return true;
  
  if (combatState.reactionResult) {
    const isHostile = combatState.reactionResult.actionType === 'hostile' || 
                      combatState.reactionResult.actionType === 'outnumbered_hostile' || 
                      combatState.reactionResult.actionType === 'bribe';
                      
    if (!isHostile) return true;
    if (!combatState.hasQuickStrikeActive) return true;
  }
  
  return combatState.hasRangedFired;
});

const isQuickStrikeDisabled = computed(() => {
  if (combatState.round !== 0) return true;
  if (isBossRoom.value) return true;
  if (!combatState.hasReactionChecked) return true;
  
  const isHostile = combatState.reactionResult?.actionType === 'hostile' || 
                    combatState.reactionResult?.actionType === 'outnumbered_hostile' || 
                    combatState.reactionResult?.actionType === 'bribe';
                    
  return !isHostile || combatState.hasQuickStrikeActive;
});

const activeCombatFollowers = computed(() => {
  // Only show followers with life > 0
  return followers.value.filter(f => f.lifeCurrent > 0);
});

const isRangedAvailable = computed(() => {
  return character.value.equippedWeapon?.type === 'ranged';
});

const hasWeaponEquipped = computed(() => {
  return character.value.equippedWeapon !== null;
});

function closeRangedRound() {
  combatState.round = 1;
  addLog('🏹 遠距離戦闘フェーズ(第0ラウンド)を終了し、接近戦へ移行します。', 'info');

  const hasSwordbearer = followers.value.some(f => f.type === 'swordbearer');
  const freeSwitch = !combatState.playerHasFiredRanged || hasSwordbearer;

  if (freeSwitch && character.value.equippedWeapon?.type === 'ranged') {
    const meleeWeapon = character.value.weapons.find(w => w.type !== 'ranged');
    if (meleeWeapon) {
      character.value.equippedWeapon = meleeWeapon;
      addLog(`⚔️ 瞬時に武器を【${meleeWeapon.name}】に持ち替えました！`, 'success');
    } else {
      character.value.equippedWeapon = null;
      addLog('⚔️ 接近戦用の武器が他にないため、素手になりました。', 'error');
    }
  }
}
</script>

<template>
  <div class="combat-card paper-sheet">
    <div class="combat-header">
      <h2>⚔️ 戦闘シーン</h2>
      <div class="badge-round">
        {{ combatState.round === 0 ? '第 0 ラウンド (遠距離戦)' : `第 ${combatState.round} ラウンド (接近戦)` }}
      </div>
    </div>

    <!-- Recent Combat Log -->
    <div v-if="logs.length > 0" class="recent-event-box" style="margin: 0 0 20px 0; padding: 10px; border: 1px dashed var(--ink-light); background: rgba(255,255,255,0.5); border-radius: 4px; font-family: 'Noto Serif JP', serif; font-size: 0.95rem; text-align: center;">
      ⚔️ <b>戦況報告:</b> <span :class="logs[logs.length - 1]?.type">{{ logs[logs.length - 1]?.text }}</span>
    </div>

    <!-- Active Enemies Row -->
    <div class="enemies-section">
      <h3 class="section-title">👾 出現したクリーチャー</h3>
      <div class="enemies-grid">
        <div v-for="enemy in combatState.enemies" :key="enemy.id" class="enemy-card">
          <div class="enemy-header">
            <span class="enemy-name">{{ enemy.name }}</span>
            <span class="enemy-level">Lv.{{ enemy.level }}</span>
          </div>
          <div class="enemy-stats">
            <span>生命力: <b>{{ enemy.lifeCurrent }} / {{ enemy.lifeMax }}</b></span>
            <span v-if="enemy.tags.includes('weak')"> (群れ数: {{ enemy.count }})</span>
          </div>
          <div class="enemy-tags">
            <span v-for="tag in enemy.tags" :key="tag" class="tag-badge" :class="tag">
              {{ tag === 'undead' ? '💀 アンデッド' : tag === 'golem' ? '🤖 ゴーレム' : tag === 'weak' ? '雑魚' : '強敵' }}
            </span>
          </div>

          <!-- Melee Attack Controls -->
          <div v-if="combatState.round > 0 && activeAttacks.length === 0" class="combat-actions">
            <template v-if="isSwitchingWeapons">
              <span class="badge-switching" style="font-size: 0.85rem; color: #8c1c1c; font-weight: bold; background: rgba(140, 28, 28, 0.05); padding: 5px 10px; border-radius: 4px; border: 1px dashed #f5c6cb; width: 100%; display: block; text-align: center;">
                ⚔️ 武器の持ち替え中...
              </span>
            </template>
            <template v-else>
              <button 
                @click="playerAttack(enemy.id)" 
                class="btn-ink btn-mini"
                :disabled="character.equippedWeapon?.type === 'ranged'"
              >
                {{ character.equippedWeapon?.type === 'ranged' ? '❌ 飛び道具接近戦使用不可' : '⚔️ 通常攻撃' }}
              </button>
              <button 
                v-if="character.subStatType === 'strength' && character.subStatCurrent > 0"
                @click="playerAttack(enemy.id, true)" 
                class="btn-ink btn-mini btn-strength"
                :disabled="character.equippedWeapon?.type === 'ranged'"
              >
                💪 全力攻撃 (筋力1)
              </button>
            </template>
            
            <!-- Target-specific Spells -->
            <div v-if="!isSwitchingWeapons && character.subStatType === 'magic' && character.subStatCurrent > 0" class="spell-targets">
              <button 
                v-if="character.spells.includes('気絶') && enemy.tags.includes('weak')"
                @click="castSpell('気絶', enemy.id)" 
                class="btn-ink btn-mini btn-spell"
              >
                🔮 気絶
              </button>
              <button 
                v-if="character.spells.includes('氷槍')"
                @click="castSpell('氷槍', enemy.id)" 
                class="btn-ink btn-mini btn-spell"
              >
                🔮 氷槍
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- DEFENSE ASSIGNMENT PANEL (High Priority overlay/warning) -->
    <div v-if="activeAttacks.length > 0 && !combatState.isOver" class="defense-overlay">
      <div class="defense-box">
        <template v-if="combatState.pendingCover">
          <h3 class="alert-title">🛡️ 従者をかばう！</h3>
          <p class="alert-desc">
            従者 <b>{{ combatState.pendingCover.followerName }}</b> が被弾しました！主人公は「かばう」を使用できます。
          </p>

          <div class="active-attack-row" style="flex-direction: column; align-items: stretch; gap: 15px;">
            <div class="attacker-desc" style="text-align: center; border-bottom: 1px dashed rgba(92,75,61,0.2); padding-bottom: 10px; margin-bottom: 5px;">
              👾 <b>{{ combatState.pendingCover.enemyName }}</b> の攻撃 (防御目標値: <b>{{ combatState.pendingCover.enemyLevel }}</b>)
            </div>
            
            <p style="font-size: 0.85rem; color: var(--ink-light); text-align: center; margin: 0; font-style: italic;">
              ※「かばう」と、主人公が代わりに防御判定を行います。成否に関わらず筋力点を1点消費します。(残り筋力点: <b>{{ character.subStatCurrent }}</b>)
            </p>

            <div class="assign-buttons" style="display: flex; flex-direction: column; width: 100%; gap: 10px;">
              <button @click="executeCover(false)" class="btn-ink btn-large btn-def" style="width: 100%; justify-content: center;">
                🛡️ 技量点 (値: {{ character.skillCurrent }}) を基準にしてかばう
              </button>
              <button v-if="character.subStatCurrent >= 1" @click="executeCover(true)" class="btn-ink btn-large btn-def btn-strength" style="width: 100%; justify-content: center;">
                💪 筋力点 (値: {{ character.subStatCurrent }}) を基準にしてかばう
              </button>
              <button @click="cancelCover" class="btn-ink btn-large btn-secondary" style="width: 100%; justify-content: center; background: rgba(0,0,0,0.05);">
                😢 かばうのを見送る (従者は死亡)
              </button>
            </div>
          </div>
        </template>

        <template v-else>
          <h3 class="alert-title">🚨 クリーチャーの猛攻を防御しろ！</h3>
          <p class="alert-desc">未適用の攻撃回数: <b>{{ activeAttacks.length }}</b> 回。味方を選択してダイスを振り、防御ロールを解決してください。</p>
          
          <div class="active-attack-row">
            <div class="attacker-desc">
              👾 <b>{{ activeAttacks[0].source.name }}</b> の攻撃 
              (防御目標値: <b>{{ activeAttacks[0].source.level }}</b>)
            </div>

            <div class="assign-buttons">
              <!-- Hero Defends -->
              <div class="assign-group">
                <button @click="resolveDefense(activeAttacks[0].id, 'hero')" class="btn-ink btn-def">
                  🛡️ 主人公が防御する (技量: {{ character.skillCurrent }})
                </button>
                <button 
                  v-if="character.subStatType === 'strength' && character.subStatCurrent > 0"
                  @click="resolveDefense(activeAttacks[0].id, 'hero', true)" 
                  class="btn-ink btn-def btn-strength"
                >
                  💪 全力防御 (筋力1消費)
                </button>
              </div>

              <!-- Followers Defend -->
              <button 
                v-for="fol in activeCombatFollowers" 
                :key="fol.id"
                @click="resolveDefense(activeAttacks[0].id, fol.id)" 
                class="btn-ink btn-def btn-secondary"
              >
                👤 従者 [{{ fol.name }}] が受ける (技量: {{ fol.skill }})
              </button>
            </div>
          </div>
        </template>
      </div>
    </div>

    <!-- COMBAT RESULT RESOLUTION LEDGER (High priority overlay when combat is over) -->
    <div v-else-if="combatState.isOver" class="combat-result-overlay" style="border: 2px solid rgba(27, 22, 18, 0.4); background: rgba(225, 218, 205, 0.4); padding: 25px; border-radius: 6px; box-shadow: var(--card-shadow); text-align: center; margin-top: 20px; margin-bottom: 20px;">
      <div class="clear-stamp-container" style="margin-bottom: 12px;">
        <span v-if="combatState.resultType === 'victory'" class="clear-stamp success">勝利 VICTORY</span>
        <span v-else-if="combatState.resultType === 'escaped'" class="clear-stamp danger">撤退 RETREAT</span>
        <span v-else class="clear-stamp warning">和解 CLEAR</span>
      </div>
      <h3 class="event-title resolved-title" style="border-bottom: 1px dashed rgba(92, 75, 61, 0.3); padding-bottom: 8px; margin-bottom: 15px; font-family: 'Noto Serif JP', serif; color: var(--ink-light); font-size: 1.1rem; opacity: 0.8;">
        📜 戦闘の解決記録
      </h3>
      
      <!-- Victory Screen -->
      <div v-if="combatState.resultType === 'victory'">
        <!-- Loot rolling block -->
        <div v-if="combatState.getLootAfterVictory && !combatState.lootRolled" style="margin-bottom: 15px;">
          <p style="font-size: 1rem; color: var(--ink-dark); margin-bottom: 15px;">
            敵の遺品や宝箱から戦利品を獲得できます。ダイスを振って宝物表をロールしましょう。
          </p>
          <button @click="resolveLoot" class="btn-ink btn-large btn-primary-ink">
            💎 宝箱を開ける (ダイスを振る)
          </button>
        </div>
        
        <!-- Loot confirmed block -->
        <div v-else>
          <p v-if="combatState.lootText" class="event-description resolved-desc" style="white-space: pre-line; background: rgba(255,255,255,0.4); padding: 15px; border-radius: 4px; border: 1px dashed rgba(92, 75, 61, 0.4); font-size: 0.95rem; color: var(--ink-light); line-height: 1.6; text-align: left; margin-bottom: 20px;">
            🎁 獲得した戦利品: {{ combatState.lootText }}
          </p>
          <p v-else style="font-size: 0.95rem; color: var(--ink-light); margin-bottom: 15px; opacity: 0.8;">
            この戦闘での追加の戦利品はありません。
          </p>
          
          <button @click="confirmCombatResult" class="btn-ink btn-large btn-primary-ink" style="width: 100%;">
            🚪 結果を承認して次の部屋へ進む
          </button>
        </div>
      </div>

      <!-- Escape Screen -->
      <div v-else-if="combatState.resultType === 'escaped'">
        <p class="event-description resolved-desc" style="white-space: pre-line; background: rgba(255,255,255,0.4); padding: 15px; border-radius: 4px; border: 1px dashed rgba(92, 75, 61, 0.4); font-size: 0.95rem; color: var(--ink-light); line-height: 1.6; text-align: left; margin-bottom: 20px;">
          敵の追撃を受け流し、無事安全な場所まで退却しました。
        </p>
        <button @click="confirmCombatResult" class="btn-ink btn-large btn-primary-ink" style="width: 100%;">
          🚪 結果を承認して1つ前の部屋に戻る
        </button>
      </div>

      <!-- Peaceful Screen -->
      <div v-else-if="combatState.resultType === 'peaceful'">
        <p class="event-description resolved-desc" style="white-space: pre-line; background: rgba(255,255,255,0.4); padding: 15px; border-radius: 4px; border: 1px dashed rgba(92, 75, 61, 0.4); font-size: 0.95rem; color: var(--ink-light); line-height: 1.6; text-align: left; margin-bottom: 20px;">
          {{ combatState.peacefulText || '敵と争うことなく、穏便に交渉（中立/歓待/ワイロ）するか、敵の撤退に成功しました。' }}
        </p>
        <button @click="confirmCombatResult" class="btn-ink btn-large btn-primary-ink" style="width: 100%;">
          🚪 結果を承認して次の部屋へ進む
        </button>
      </div>
    </div>

    <!-- Normal Actions Panel (Only visible when no pending enemy attacks and combat is not over) -->
    <div v-else class="actions-panel">
      <!-- Round 0 (Ranged/Magic only) -->
      <div v-if="combatState.round === 0" class="ranged-phase">
        <h3 class="section-title">🏹 第0ラウンド行動 (遠距離攻撃 & 先制呪文)</h3>
        
        <!-- Reaction Check Result Panel -->
        <div v-if="combatState.reactionResult" class="reaction-result-panel paper-sheet" style="margin-bottom: 20px; border: 2px solid var(--ink-dark); padding: 20px; border-radius: 6px; background: #fffcf5; box-shadow: var(--card-shadow); text-align: center;">
          <div style="font-size: 1.1rem; font-weight: bold; font-family: 'Noto Serif JP', serif; color: var(--ink-dark); border-bottom: 1px dashed var(--ink-dark); padding-bottom: 8px; margin-bottom: 15px;">
            🎲 反応チェックの結果
          </div>
          <div style="font-size: 1rem; margin-bottom: 15px; color: var(--ink-dark);">
            判定ダイスの出目: <span style="font-weight: 900; font-size: 1.4rem; color: #8c1c1c;">🎲 {{ combatState.reactionResult.roll }}</span>
          </div>

          <!-- Friendship (友情) Adjust Buttons -->
          <div 
            v-if="character.subStatType === 'magic' && character.spells.includes('友情') && character.subStatCurrent >= 1" 
            class="friendship-adjust-group" 
            style="margin-bottom: 15px; border-bottom: 1px dashed rgba(92,75,61,0.2); padding-bottom: 15px;"
          >
            <p style="font-size: 0.85rem; color: var(--ink-light); margin: 0 0 10px 0; font-style: italic;">
              🔮 魔法【友情】（魔術点1消費）で反応出目を調整できます：
            </p>
            <div style="display: flex; gap: 8px;">
              <button @click="applyFriendshipReaction(1)" class="btn-ink btn-mini btn-spell" style="flex: 1;" :disabled="combatState.reactionResult.roll >= 6">
                出目+1 (上限6)
              </button>
              <button @click="applyFriendshipReaction(-1)" class="btn-ink btn-mini btn-spell" style="flex: 1;" :disabled="combatState.reactionResult.roll <= 1">
                出目-1 (下限1)
              </button>
            </div>
          </div>

          <p style="font-size: 1rem; line-height: 1.6; color: #8c1c1c; font-weight: bold; background: rgba(0,0,0,0.03); padding: 12px; border-radius: 4px; border: 1px dashed #c2b09a; margin-bottom: 20px; text-align: left;">
            {{ combatState.reactionResult.text }}
          </p>
          
          <div v-if="combatState.reactionResult.actionType === 'bribe'" class="bribe-choice-group" style="display: flex; flex-direction: column; gap: 10px; width: 100%;">
            <div style="display: flex; gap: 10px; width: 100%;">
              <button @click="payBribe(false)" class="btn-ink btn-large" style="flex: 1;" :disabled="character.gold < 5">
                🪙 ワイロを支払う (金貨5枚)
              </button>
              <button 
                v-if="character.subStatType === 'magic' && character.spells.includes('友情') && character.subStatCurrent >= 1"
                @click="payBribe(true)" 
                class="btn-ink btn-large btn-spell" 
                style="flex: 1;" 
                :disabled="character.gold < 1"
              >
                🔮 友情で支払う (金貨1枚, 魔術1)
              </button>
            </div>
            <button @click="refuseBribeAndFight" class="btn-ink btn-large btn-danger-ink" style="width: 100%; background: #8c1c1c; color: white; border-color: #8c1c1c;">
              ⚔️ 拒否して戦闘する (敵先制)
            </button>
          </div>
          <button v-else @click="confirmReactionResult" class="btn-ink btn-large" style="width: 100%;">
            結果を承認して進む
          </button>
        </div>

        <template v-else>
          <!-- Reaction Check (Roll prior to combat starting) -->
          <div v-if="isBossRoom" class="boss-disallow-panel" style="font-size: 0.9rem; font-weight: bold; color: #8c1c1c; background: rgba(140, 28, 28, 0.05); border: 1px dashed #f5c6cb; padding: 10px 15px; border-radius: 4px; margin-bottom: 15px; text-align: center;">
            ⚠️ ボス戦のため、反応チェックやワイロによる交渉は行えません。
          </div>
          <div v-else class="reaction-bribe-group">
            <button @click="rollReactionCheck" class="btn-ink" :disabled="combatState.hasReactionChecked">🎲 反応チェックを行う</button>
            <button @click="payBribe(false)" class="btn-ink btn-secondary" :disabled="!combatState.isBribeAllowed || character.gold < 5">🪙 ワイロで済ませる (金貨5枚)</button>
          </div>

          <div class="divider"></div>

          <div class="button-group" style="display: flex; gap: 10px; flex-wrap: wrap;">
            <button 
              @click="playerAttack(combatState.enemies[0]?.id)" 
              class="btn-ink" 
              style="flex: 1; min-width: 150px;"
              :disabled="!isRangedAvailable || combatState.hasRangedFired"
            >
              🎯 弓・スリングで射撃攻撃
            </button>
            <button 
              v-if="character.subStatType === 'dexterity' && character.subStatCurrent > 0"
              @click="playerAttack(combatState.enemies[0]?.id, true)" 
              class="btn-ink btn-strength" 
              style="flex: 1; min-width: 150px;"
              :disabled="!isRangedAvailable || combatState.hasRangedFired"
            >
              🎯 全力射撃 (器用1消費)
            </button>
            <button @click="closeRangedRound" class="btn-ink btn-secondary" style="flex: 1; min-width: 150px;">
              ⚔️ 接近戦へ移行する
            </button>
          </div>
        </template>
      </div>

      <!-- Round >= 1 Melee Phase Actions (e.g. Weapon Switch) -->
      <div v-else-if="isSwitchingWeapons" class="weapon-switch-box" style="border: 2px dashed #8c1c1c; padding: 20px; background: rgba(140, 28, 28, 0.05); border-radius: 6px; text-align: center; margin-bottom: 20px;">
        <p style="font-size: 1rem; font-weight: bold; color: #8c1c1c; margin-bottom: 15px; font-family: 'Noto Serif JP', serif;">
          🏹 遠距離武器を使用したため、接近戦武器への持ち替えに1ラウンド必要です。<br>
          <span style="font-size: 0.85rem; opacity: 0.9; font-weight: normal;">※「太刀持ち従者」がいれば、この持ち替え時間を省略できます。</span>
        </p>
        <button @click="resolveWeaponSwitch" class="btn-ink btn-large btn-primary-ink" style="width: 100%;">
          ⚔️ 武器を持ち替える (1ラウンド消費して手番終了)
        </button>
      </div>

      <!-- Spells & Miracles (Magic / Luck archetypes) & Flee Section -->
      <template v-if="!isSwitchingWeapons">
        <div v-if="character.subStatCurrent > 0 && activeAttacks.length === 0" class="magic-phase">
          <h3 class="section-title">🔮 魔法・奇跡の詠唱 (残り魔力/幸運: {{ character.subStatCurrent }})</h3>
          
          <div class="spell-buttons">
            <!-- Magic spells -->
            <template v-if="character.subStatType === 'magic'">
              <button 
                v-if="character.spells.includes('炎球')"
                @click="castSpell('炎球')" 
                class="btn-ink btn-spell"
                :disabled="isRound0SpellDisabled"
              >
                🔮 炎球 (全体攻撃)
              </button>
              <button 
                v-if="character.spells.includes('武具創造') && !hasWeaponEquipped"
                @click="castSpell('武具創造')" 
                class="btn-ink btn-spell"
                :disabled="isRound0SpellDisabled"
              >
                🔮 武具創造 (光の剣)
              </button>
              <button 
                v-if="character.spells.includes('速撃')"
                @click="castSpell('速撃')" 
                class="btn-ink btn-spell"
                :disabled="isQuickStrikeDisabled"
              >
                🔮 速撃 (先制攻撃)
              </button>
            </template>

            <!-- Luck miracles -->
            <template v-if="character.subStatType === 'luck'">
              <button 
                v-if="character.miracles.includes('防衛')"
                @click="castMiracle('防衛')" 
                class="btn-ink btn-miracle"
                :disabled="isRound0SpellDisabled"
              >
                🕊️ 防衛 (+1防御バフ)
              </button>
              <button 
                v-if="character.miracles.includes('そらし')"
                @click="castMiracle('そらし')" 
                class="btn-ink btn-miracle"
                :disabled="isRound0SpellDisabled"
              >
                🕊️ そらし (射撃無効)
              </button>
              <button 
                v-if="character.miracles.includes('聖洗脳') && combatState.enemies.length === 1"
                @click="castMiracle('聖洗脳')" 
                class="btn-ink btn-miracle"
                :disabled="isRound0SpellDisabled"
              >
                🕊️ 聖洗脳 (従者にする)
              </button>
              <button 
                v-if="character.miracles.includes('招天')"
                @click="castMiracle('招天')" 
                class="btn-ink btn-miracle"
                :disabled="isRound0SpellDisabled"
              >
                🕊️ 招天 (アンデッド光矢)
              </button>
            </template>
          </div>
        </div>

        <div class="divider"></div>

        <div class="flee-section">
          <button @click="escapeCombat" class="btn-ink btn-flee">
            🏃 戦闘から逃走する (無防備な一撃を受ける)
          </button>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.combat-card {
  padding: 30px;
  border-radius: 6px;
  box-shadow: var(--card-shadow);
  border: 3px double var(--ink-dark);
}

.combat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 2px solid var(--ink-dark);
  margin-bottom: 20px;
  padding-bottom: 10px;
}

.combat-header h2 {
  font-family: 'Noto Serif JP', serif;
  font-size: 1.4rem;
  color: var(--ink-dark);
  margin: 0;
}

.badge-round {
  background: #8c1c1c;
  color: #fff;
  font-family: 'Noto Serif JP', serif;
  font-weight: bold;
  font-size: 0.9rem;
  padding: 4px 10px;
  border-radius: 4px;
}

.section-title {
  font-family: 'Noto Serif JP', serif;
  font-size: 1rem;
  font-weight: bold;
  color: var(--ink-dark);
  border-bottom: 1px dashed #c2b09a;
  margin-bottom: 15px;
  padding-bottom: 3px;
}

.enemies-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 15px;
  margin-bottom: 25px;
}

.enemy-card {
  border: 2px solid var(--ink-dark);
  background: #fbf8f3;
  padding: 15px;
  border-radius: 6px;
  position: relative;
  box-shadow: var(--card-shadow);
}

.enemy-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #c2b09a;
  padding-bottom: 5px;
  margin-bottom: 8px;
}

.enemy-name {
  font-family: 'Noto Serif JP', serif;
  font-weight: bold;
  font-size: 1.05rem;
  color: var(--ink-dark);
}

.enemy-level {
  font-size: 0.95rem;
  font-weight: bold;
  color: #8c1c1c;
}

.enemy-stats {
  font-size: 0.9rem;
  color: #5c4b3d;
  margin-bottom: 8px;
}

.enemy-tags {
  display: flex;
  gap: 5px;
  margin-bottom: 12px;
}

.tag-badge {
  font-size: 0.75rem;
  padding: 1px 6px;
  border-radius: 3px;
  color: #fff;
  background: #888;
}

.tag-badge.undead { background: #8c1c1c; }
.tag-badge.golem { background: #4682b4; }
.tag-badge.weak { background: #8c715c; }
.tag-badge.strong { background: #b8860b; }

.combat-actions {
  display: flex;
  gap: 5px;
  flex-wrap: wrap;
}

.btn-strength {
  border-color: #8b4513 !important;
  color: #8b4513 !important;
}

.btn-strength:hover {
  background: #fdfaf2 !important;
}

.btn-spell {
  border-color: #4b0082 !important;
  color: #4b0082 !important;
}

.btn-spell:hover {
  background: #faf5ff !important;
}

.btn-miracle {
  border-color: #b8860b !important;
  color: #b8860b !important;
}

.btn-miracle:hover {
  background: #fffff0 !important;
}

.spell-targets {
  display: flex;
  gap: 5px;
  margin-top: 5px;
  width: 100%;
}

.defense-overlay {
  background: rgba(140, 28, 28, 0.05);
  border: 2px solid #8c1c1c;
  padding: 20px;
  border-radius: 6px;
  box-shadow: 0 4px 15px rgba(140,28,28,0.15);
  margin-bottom: 20px;
}

.alert-title {
  color: #8c1c1c;
  font-family: 'Noto Serif JP', serif;
  margin-top: 0;
  margin-bottom: 8px;
}

.alert-desc {
  font-size: 0.9rem;
  color: #555;
  margin-bottom: 15px;
}

.active-attack-row {
  border-top: 1px dashed #d9534f;
  padding-top: 15px;
}

.attacker-desc {
  font-size: 1.1rem;
  color: var(--ink-dark);
  margin-bottom: 15px;
  font-family: 'Noto Serif JP', serif;
}

.assign-buttons {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.assign-group {
  display: flex;
  gap: 10px;
}

.btn-def {
  width: 100%;
  font-weight: bold;
}

.reaction-bribe-group {
  display: flex;
  gap: 15px;
  justify-content: center;
  margin-bottom: 15px;
}

.button-group {
  display: flex;
  gap: 15px;
  justify-content: center;
}

.spell-buttons {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: center;
}

.divider {
  height: 1px;
  border-top: 1px dashed #c2b09a;
  margin: 15px 0;
}

.btn-flee {
  display: block;
  margin: 0 auto;
  border-color: #8c1c1c !important;
  color: #8c1c1c !important;
  font-size: 0.95rem;
}

.clear-stamp {
  font-family: 'Noto Serif JP', serif;
  font-weight: 900;
  font-size: 1.1rem;
  color: #5b7052;
  border: 2px solid #5b7052;
  padding: 3px 12px;
  display: inline-block;
  transform: rotate(-3deg);
  border-radius: 4px;
  letter-spacing: 0.1em;
  background: rgba(91, 112, 82, 0.05);
  box-shadow: 0 0 3px rgba(91, 112, 82, 0.15);
}

.clear-stamp.danger {
  color: #8c1c1c;
  border-color: #8c1c1c;
  background: rgba(140, 28, 28, 0.05);
}

.clear-stamp.warning {
  color: #b8860b;
  border-color: #b8860b;
  background: rgba(184, 134, 11, 0.05);
}

.btn-primary-ink {
  background: var(--ink-dark) !important;
  color: var(--paper-bg) !important;
  border-color: var(--ink-dark) !important;
  box-shadow: 2px 2px 0 rgba(0,0,0,0.3) !important;
}

.btn-primary-ink:hover:not(:disabled) {
  background: var(--ink-light) !important;
  box-shadow: 3px 3px 0 rgba(0,0,0,0.3) !important;
}

@media (max-width: 600px) {
  .combat-card {
    padding: 20px 15px;
  }
  .combat-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }
  .enemies-grid {
    grid-template-columns: 1fr;
    gap: 10px;
  }
  .button-group, .spell-buttons, .reaction-bribe-group {
    flex-direction: column;
    gap: 10px;
    width: 100%;
  }
  .button-group .btn-ink, .spell-buttons .btn-ink, .reaction-bribe-group .btn-ink {
    width: 100%;
  }
  .assign-group {
    flex-direction: column;
    gap: 8px;
  }
  .btn-primary-ink {
    width: 100%;
  }
}
</style>
