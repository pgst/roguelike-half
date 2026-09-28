<script setup lang="ts">
import { computed, ref } from 'vue';
import { useGameState } from '../composables/useGameState';
import { useCombat } from '../composables/useCombat';
import MessageWindow from './MessageWindow.vue';

const {
  character,
  followers,
  combatState,
  addLog,
  dungeonDepth,
  totalRoomsToClear,
  isSwitchingWeapons,
  diceTray,
  isMessageWaiting,
  showDetailModal
} = useGameState();

const showSummonSelector = ref(false);

const selectedEnemyId = ref<string>('');
const targetEnemy = computed(() => {
  if (selectedEnemyId.value) {
    const found = combatState.enemies.find(e => e.id === selectedEnemyId.value);
    if (found) return found;
  }
  return combatState.enemies[0] || null;
});
const showMagicSubmenu = ref(false);

const isBossRoom = computed(() => dungeonDepth.value >= totalRoomsToClear.value);

const showShireenClueAction = computed(() => {
  const hasShireen = combatState.enemies.some((e: any) => e.name === '異端者シーリーン');
  const clueSpent = (combatState as any).shireenClueSpent;
  const hasClue = character.value.items.some((i: any) => i.type === 'clue');
  return hasShireen && !clueSpent && hasClue;
});

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
  useHolyWater,
  applyFriendshipReaction,
  skipDeflect,
  executeDeflect,
  fireHolyArrow,
  resolveChronovalsRoar,
  resolveCreateWeaponSpell,
  castFollowerSpell
} = useCombat();

const magesWithMagic = computed(() => {
  return followers.value.filter(f => 
    f.type === 'mage' && 
    f.magicCurrent !== undefined && 
    f.magicCurrent > 0 && 
    f.lifeCurrent > 0 && 
    !(f.statusEffects && (f.statusEffects.includes('麻痺') || f.statusEffects.includes('石化')))
  );
});

const activeAttacks = computed(() => (combatState as any).activeAttacks || []);

const hasHolyWater = computed(() => character.value.items.some(i => i.type === 'holywater'));

function spendShireenClue() {
  const clueIdx = character.value.items.findIndex(i => i.type === 'clue');
  if (clueIdx !== -1) {
    character.value.items.splice(clueIdx, 1);
    (combatState as any).shireenClueSpent = true;
    addLog('🔍 手がかりを消費して、シーリーンの未来視（回避能力）を無効化しました！', 'success');
  }
}

const isRound0SpellDisabled = computed(() => {
  if (combatState.round !== 0) return false;
  if (isBossRoom.value) return combatState.hasRangedFired;
  
  if (combatState.reactionResult) {
    const isFightPossible = combatState.reactionResult.actionType === 'hostile' || 
                            combatState.reactionResult.actionType === 'outnumbered_hostile' || 
                            combatState.reactionResult.actionType === 'bribe';
                      
    if (!isFightPossible) return true;
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

const isHolyWaterAvailable = computed(() => {
  if (!hasHolyWater.value) return false;
  if (activeAttacks.value.length > 0 || combatState.pendingHolyArrow > 0) return false;
  if (isSwitchingWeapons.value) return false;

  if (combatState.round === 0) {
    if (combatState.hasRangedFired) return false;
    if (isBossRoom.value) return true;
    if (!combatState.hasReactionChecked) return false;
    if (combatState.reactionResult) {
      const isFightPossible = combatState.reactionResult.actionType === 'hostile' || 
                              combatState.reactionResult.actionType === 'outnumbered_hostile' || 
                              combatState.reactionResult.actionType === 'bribe';
      if (!isFightPossible) return false;
    }
  }

  return true;
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
    <!-- CHRONOVALS ROAR RESISTANCE OVERLAY -->
    <div v-if="combatState.pendingRoarCheck" class="roar-overlay" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.85); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 20px;">
      <div class="roar-box paper-sheet" style="max-width: 500px; width: 100%; border: 3px double #8c1c1c; padding: 25px; text-align: center; background: #fffcf5; box-shadow: var(--card-shadow); border-radius: 6px;">
        <h3 style="color: #8c1c1c; font-family: 'Noto Serif JP', serif; font-size: 1.3rem; margin-bottom: 15px; font-weight: bold;">
          😈 ボス特殊能力：時喰いの咆哮
        </h3>
        <p style="font-size: 0.95rem; line-height: 1.6; color: var(--ink-dark); margin-bottom: 20px;">
          強大な魔物が空間を引き裂き、時間を巻き戻す魔力の咆哮を放ちました！<br/>
          対魔法ロール（目標値: 5）に失敗すると、これまでの時間が巻き戻されてしまいます！
        </p>
        <div v-if="character.items.some(i => i.name === '水晶の薔薇') || (character.equippedArmor && character.equippedArmor.name === '天使のヘルメット')" style="margin-bottom: 15px; padding: 8px; background: rgba(40, 167, 69, 0.05); border: 1px dashed green; border-radius: 4px; font-size: 0.85rem; color: green; font-weight: bold;">
          🛡️ 特殊加算対象：
          <span v-if="character.items.some(i => i.name === '水晶の薔薇')">「水晶の薔薇」(+2) </span>
          <span v-if="character.equippedArmor && character.equippedArmor.name === '天使のヘルメット'">「天使のヘルメット」(+2) </span>
        </div>
        <button @click="resolveChronovalsRoar" class="btn-ink btn-large btn-primary-ink" style="width: 100%; font-size: 1.1rem; justify-content: center;">
          🎲 抵抗判定を行う (対魔法ロール)
        </button>
      </div>
    </div>
    <div class="combat-header">
      <h2>⚔️ 戦闘シーン</h2>
      <div class="badge-round">
        {{ combatState.round === 0 ? '第 0 ラウンド (遠距離戦)' : `第 ${combatState.round} ラウンド (接近戦)` }}
      </div>
    </div>

    <!-- Dynamic Inline Dice Banner Overlay -->
    <div v-if="diceTray.isRolling || diceTray.d1 > 0" class="combat-dice-banner" :class="{ 'banner-crit': diceTray.isCritical, 'banner-fumble': diceTray.isFumble }">
      <div v-if="diceTray.isRolling" class="dice-rolling-indicator">
        <span class="rolling-dice-icon">🎲</span> <b>ダイス判定中...</b>
      </div>
      <div v-else class="dice-result-indicator">
        <span class="dice-value-chip">
          🎲 出目: <b>{{ diceTray.d1 }}</b><span v-if="diceTray.d2 > 0"> + <b>{{ diceTray.d2 }}</b></span>
        </span>
        <span class="dice-result-text">{{ diceTray.resultText }}</span>
      </div>
    </div>

    <!-- Party Roster (Followers in Combat) -->
    <div v-if="followers.length > 0" class="combat-party-roster" style="margin-bottom: 15px; background: rgba(92, 75, 61, 0.06); border: 1px dashed var(--ink-light); padding: 8px 12px; border-radius: 4px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
        <span style="font-size: 0.85rem; font-weight: bold; color: var(--ink-dark); font-family: 'Noto Serif JP', serif;">
          🛡️ 同行中のパーティ・従者 ({{ followers.length }}人)
        </span>
        <button @click="showDetailModal = true" class="btn-ink btn-mini" style="font-size: 0.75rem; padding: 2px 6px;">
          📜 従者管理
        </button>
      </div>
      <div style="display: flex; gap: 8px; flex-wrap: wrap;">
        <div 
          v-for="fol in followers" 
          :key="fol.id" 
          class="follower-roster-chip"
          @click="showDetailModal = true"
          :title="`${fol.name}: ${fol.description || ''} (クリックで詳細)`"
          style="cursor: pointer; display: inline-flex; align-items: center; gap: 6px; background: #fff; border: 1px solid var(--ink-light); padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; box-shadow: 1px 1px 0 rgba(0,0,0,0.1);"
        >
          <span>{{ fol.type === 'captive' ? '⛓️' : fol.type === 'swordbearer' ? '🗡️' : fol.type === 'mage' ? '🔮' : fol.type === 'scout' ? '🧭' : '👥' }}</span>
          <span style="font-weight: bold; color: var(--ink-dark);">{{ fol.name }}</span>
          <span 
            style="font-size: 0.7rem; padding: 1px 4px; border-radius: 3px;"
            :style="fol.isCombatant ? 'background: #e8f5e9; color: #2e7d32;' : 'background: #fff3e0; color: #e65100;'"
          >
            {{ fol.isCombatant ? `⚔️ 技量:${fol.skill}` : (fol.type === 'captive' ? '⛓️ 身代わり' : '🛡️ 非戦闘') }}
          </span>
          <span style="font-size: 0.75rem; color: #8c1c1c; font-weight: bold;">
            ❤️ {{ fol.lifeCurrent }}/{{ fol.lifeMax }}
          </span>
        </div>
      </div>
    </div>

    <!-- Active Enemies Row -->
    <div class="enemies-section">
      <h3 class="section-title">👾 出現したクリーチャー</h3>
      <div class="enemies-grid">
        <div 
          v-for="enemy in combatState.enemies" 
          :key="enemy.id" 
          class="enemy-card"
          :class="{ 'is-selected-target': (targetEnemy && targetEnemy.id === enemy.id) }"
          @click="selectedEnemyId = enemy.id"
          title="クリックで攻撃目標に指定"
        >
          <div class="enemy-header">
            <span class="enemy-name">
              <span v-if="targetEnemy && targetEnemy.id === enemy.id" class="target-indicator">👉 </span>
              {{ enemy.name }}
            </span>
            <span class="enemy-level">Lv.{{ enemy.level }}</span>
          </div>
          <div class="enemy-stats">
            <span>生命力: <b>{{ enemy.lifeCurrent }} / {{ enemy.lifeMax }}</b></span>
            <span v-if="enemy.tags.includes('weak')"> (群れ数: {{ enemy.count }})</span>
          </div>
          <!-- 敵ライフゲージ (HPバー) -->
          <div class="enemy-hp-container">
            <div 
              class="enemy-hp-bar" 
              :class="{
                'hp-crit': (enemy.lifeCurrent / enemy.lifeMax) <= 0.25,
                'hp-warn': (enemy.lifeCurrent / enemy.lifeMax) > 0.25 && (enemy.lifeCurrent / enemy.lifeMax) <= 0.5
              }"
              :style="{ width: `${Math.max(0, Math.min(100, (enemy.lifeCurrent / enemy.lifeMax) * 100))}%` }"
            ></div>
          </div>
          <div class="enemy-tags">
            <span v-for="tag in enemy.tags" :key="tag" class="tag-badge" :class="tag">
              {{ tag === 'undead' ? '💀 アンデッド' : tag === 'golem' ? '🤖 ゴーレム' : tag === 'weak' ? '雑魚' : '強敵' }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- DEFENSE ASSIGNMENT PANEL (Stage Alert Banner) -->
    <div v-if="activeAttacks.length > 0 && !combatState.isOver" class="defense-overlay">
      <div class="defense-box">
        <template v-if="combatState.pendingDeflect">
          <h3 class="alert-title">✨ 奇跡【そらし】発動の好機！</h3>
          <p class="alert-desc">
            👾 <b>{{ combatState.pendingDeflect.enemy.name }}</b> からの攻撃が
            <b>{{ combatState.pendingDeflect.defenderId === 'hero' ? '主人公' : '従者' }}</b> に直撃しようとしています！<br/>
            <small style="color: var(--ink-light);">※ 下部コマンドウィンドウから【そらし】の発動を選択してください。</small>
          </p>
        </template>

        <template v-else-if="combatState.pendingCover">
          <h3 class="alert-title">🛡️ 従者をかばう！</h3>
          <p class="alert-desc">
            従者 <b>{{ combatState.pendingCover.followerName }}</b> が被弾しました！<br/>
            <small style="color: var(--ink-light);">※ 下部コマンドウィンドウから「かばう」の実行を選択してください。</small>
          </p>
        </template>

        <template v-else>
          <h3 class="alert-title">🚨 クリーチャーの猛攻を防御しろ！</h3>
          <p class="alert-desc">
            未適用の攻撃回数: <b>{{ activeAttacks.length }}</b> 回。<br/>
            👾 <b>{{ activeAttacks[0].source.name }}</b> の攻撃 (防御目標値: <b>{{ activeAttacks[0].source.level }}</b>)<br/>
            <small style="color: var(--ink-light);">※ 下部コマンドウィンドウから防御を行う味方を選択してください。</small>
          </p>
        </template>
      </div>
    </div>

    <!-- COMBAT RESULT RESOLUTION LEDGER (Stage Resolution Notice) -->
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
        <div v-if="combatState.getLootAfterVictory && !combatState.lootRolled" style="margin-bottom: 15px;">
          <p style="font-size: 1rem; color: var(--ink-dark); margin-bottom: 5px;">
            敵の遺品や宝箱から戦利品を獲得できます。<br/>
            <small style="color: var(--ink-light);">※ 下部コマンドウィンドウの「宝箱を開ける」を押してください。</small>
          </p>
        </div>
        <div v-else>
          <p v-if="combatState.lootText" class="event-description resolved-desc" style="white-space: pre-line; background: rgba(255,255,255,0.4); padding: 15px; border-radius: 4px; border: 1px dashed rgba(92, 75, 61, 0.4); font-size: 0.95rem; color: var(--ink-light); line-height: 1.6; text-align: left; margin-bottom: 15px;">
            🎁 獲得した戦利品: {{ combatState.lootText }}
          </p>
          <p v-else style="font-size: 0.95rem; color: var(--ink-light); margin-bottom: 15px; opacity: 0.8;">
            この戦闘での追加の戦利品はありません。
          </p>
        </div>
      </div>

      <!-- Escape Screen -->
      <div v-else-if="combatState.resultType === 'escaped'">
        <p class="event-description resolved-desc" style="white-space: pre-line; background: rgba(255,255,255,0.4); padding: 15px; border-radius: 4px; border: 1px dashed rgba(92, 75, 61, 0.4); font-size: 0.95rem; color: var(--ink-light); line-height: 1.6; text-align: left; margin-bottom: 15px;">
          敵の追撃を受け流し、無事安全な場所まで退却しました。
        </p>
      </div>

      <!-- Peaceful Screen -->
      <div v-else-if="combatState.resultType === 'peaceful'">
        <p class="event-description resolved-desc" style="white-space: pre-line; background: rgba(255,255,255,0.4); padding: 15px; border-radius: 4px; border: 1px dashed rgba(92, 75, 61, 0.4); font-size: 0.95rem; color: var(--ink-light); line-height: 1.6; text-align: left; margin-bottom: 15px;">
          {{ combatState.peacefulText || '敵と争うことなく、穏便に交渉（中立/歓待/ワイロ）するか、敵の撤退に成功しました。' }}
        </p>
      </div>
    </div>

    <!-- DRAGON QUEST III CONSOLE DOCK (Left: Command Window, Right: Message Window) -->
    <div class="dq3-console-dock">
      <!-- LEFT: Command Window -->
      <div class="dq3-command-window paper-sheet" :class="{ 'waiting-overlay': isMessageWaiting }">
        <div class="cmd-window-header">
          <span>⚔️ コマンド</span>
          <span v-if="targetEnemy && !combatState.isOver" class="target-badge">🎯 {{ targetEnemy.name }}</span>
        </div>

        <div class="cmd-window-body">
          <!-- 1. 戦闘終了時 -->
          <div v-if="combatState.isOver" class="cmd-single-action">
            <div v-if="combatState.resultType === 'victory' && combatState.getLootAfterVictory && !combatState.lootRolled">
              <button @click="resolveLoot" class="btn-ink btn-large btn-primary-ink" style="width: 100%;">
                💎 宝箱を開ける (ダイスを振る)
              </button>
            </div>
            <div v-else-if="combatState.resultType === 'escaped'">
              <button @click="confirmCombatResult" class="btn-ink btn-large btn-primary-ink" style="width: 100%;">
                🚪 結果を承認して1つ前の部屋に戻る
              </button>
            </div>
            <div v-else>
              <button @click="confirmCombatResult" class="btn-ink btn-large btn-primary-ink" style="width: 100%;">
                🚪 結果を承認して次の部屋へ進む
              </button>
            </div>
          </div>

          <!-- 2. 防御・かばう割り当て発生時 -->
          <div v-else-if="activeAttacks.length > 0" class="cmd-def-action">
            <!-- そらし待機時 -->
            <div v-if="combatState.pendingDeflect" class="cmd-btn-grid" style="grid-template-columns: 1fr;">
              <button @click="executeDeflect" class="btn-ink cmd-btn btn-miracle">
                ✨ そらしを発動する (幸運1消費)
              </button>
              <button @click="skipDeflect" class="btn-ink cmd-btn btn-secondary">
                見送る (通常被弾を解決)
              </button>
            </div>
            <!-- かばう待機時 -->
            <div v-else-if="combatState.pendingCover" class="cmd-btn-grid" style="grid-template-columns: 1fr;">
              <button @click="executeCover(false)" class="btn-ink cmd-btn btn-def">
                🛡️ 技量点でかばう (値: {{ character.skillCurrent }})
              </button>
              <button v-if="character.subStatCurrent >= 1" @click="executeCover(true)" class="btn-ink cmd-btn btn-def btn-strength">
                💪 筋力点でかばう (値: {{ character.subStatCurrent }})
              </button>
              <button @click="cancelCover" class="btn-ink cmd-btn btn-secondary">
                😢 見送る (従者は死亡)
              </button>
            </div>
            <!-- 通常の防御選択時 -->
            <div v-else class="cmd-btn-grid" style="grid-template-columns: 1fr;">
              <button @click="resolveDefense(activeAttacks[0].id, 'hero')" class="btn-ink cmd-btn btn-def" :disabled="diceTray.isRolling">
                🛡️ 主人公が防御する
              </button>
              <button 
                v-if="character.subStatType === 'strength' && character.subStatCurrent > 0"
                @click="resolveDefense(activeAttacks[0].id, 'hero', true)" 
                class="btn-ink cmd-btn btn-def btn-strength"
                :disabled="diceTray.isRolling"
              >
                💪 全力防御 (筋力1消費)
              </button>
              <button 
                v-for="fol in activeCombatFollowers" 
                :key="fol.id"
                @click="resolveDefense(activeAttacks[0].id, fol.id)" 
                class="btn-ink cmd-btn btn-def btn-secondary"
                :disabled="diceTray.isRolling"
              >
                👤 従者 [{{ fol.name }}] が受ける (技量: {{ fol.skill }})
              </button>
            </div>
          </div>

          <!-- 3. 武器持ち替え中 -->
          <div v-else-if="isSwitchingWeapons" class="cmd-single-action">
            <button @click="resolveWeaponSwitch" class="btn-ink btn-large btn-primary-ink" style="width: 100%;">
              ⚔️ 武器を持ち替える
            </button>
          </div>

          <!-- 4. 聖なる矢フェーズ -->
          <div v-else-if="combatState.pendingHolyArrow > 0" class="cmd-single-action">
            <button 
              @click="fireHolyArrow(targetEnemy?.id)" 
              class="btn-ink cmd-btn btn-miracle" 
              style="width: 100%;"
              :disabled="!targetEnemy?.tags.includes('undead')"
            >
              ⚡ 聖なる矢を放つ (残: {{ combatState.pendingHolyArrow }}本)
            </button>
          </div>

          <!-- 5. 魔法サブメニュー展開中 -->
          <div v-else-if="showMagicSubmenu" class="cmd-magic-menu">
            <div style="font-size: 0.8rem; font-weight: bold; margin-bottom: 6px; color: var(--ink-dark); display: flex; justify-content: space-between; align-items: center;">
              <span>🔮 詠唱する呪文・奇跡</span>
              <button @click="showMagicSubmenu = false" class="btn-mini btn-ink" style="font-size: 0.7rem; padding: 2px 6px;">✕ 戻る</button>
            </div>
            <div class="cmd-btn-grid">
              <template v-if="character.subStatType === 'magic'">
                <button v-if="character.spells.includes('炎球')" @click="castSpell('炎球'); showMagicSubmenu = false" class="btn-ink cmd-btn btn-spell" :disabled="isRound0SpellDisabled">
                  🔮 炎球
                </button>
                <button v-if="character.spells.includes('速撃')" @click="castSpell('速撃'); showMagicSubmenu = false" class="btn-ink cmd-btn btn-spell" :disabled="isQuickStrikeDisabled">
                  🔮 速撃
                </button>
                <button v-if="character.spells.includes('氷槍')" @click="castSpell('氷槍', targetEnemy?.id); showMagicSubmenu = false" class="btn-ink cmd-btn btn-spell">
                  🔮 氷槍
                </button>
                <button v-if="character.spells.includes('気絶') && targetEnemy?.tags.includes('weak')" @click="castSpell('気絶', targetEnemy?.id); showMagicSubmenu = false" class="btn-ink cmd-btn btn-spell">
                  🔮 気絶
                </button>
                <button v-if="character.spells.includes('武具創造')" @click="showSummonSelector = !showSummonSelector; showMagicSubmenu = false" class="btn-ink cmd-btn btn-spell" :disabled="isRound0SpellDisabled">
                  🔮 武具創造
                </button>
              </template>
              <template v-if="character.subStatType === 'luck'">
                <button v-if="character.miracles.includes('防衛')" @click="castMiracle('防衛'); showMagicSubmenu = false" class="btn-ink cmd-btn btn-miracle" :disabled="isRound0SpellDisabled">
                  ✨ 防衛
                </button>
                <button v-if="character.miracles.includes('祝福')" @click="castMiracle('祝福'); showMagicSubmenu = false" class="btn-ink cmd-btn btn-miracle">
                  ✨ 祝福
                </button>
                <button v-if="character.miracles.includes('招天')" @click="castMiracle('招天'); showMagicSubmenu = false" class="btn-ink cmd-btn btn-miracle" :disabled="isRound0SpellDisabled">
                  ✨ 招天
                </button>
                <button v-if="character.miracles.includes('聖洗脳') && combatState.enemies.length === 1" @click="castMiracle('聖洗脳'); showMagicSubmenu = false" class="btn-ink cmd-btn btn-miracle" :disabled="isRound0SpellDisabled">
                  ✨ 聖洗脳
                </button>
              </template>
            </div>
          </div>

          <!-- 武具創造サブメニュー展開中 -->
          <div v-else-if="showSummonSelector" class="cmd-magic-menu">
            <div style="font-size: 0.8rem; font-weight: bold; margin-bottom: 6px; color: var(--ink-dark); display: flex; justify-content: space-between; align-items: center;">
              <span>🪄 武具創造 (魔術点1消費)</span>
              <button @click="showSummonSelector = false" class="btn-mini btn-ink" style="font-size: 0.7rem; padding: 2px 6px;">✕ 戻る</button>
            </div>
            <div class="cmd-btn-grid" style="grid-template-columns: repeat(3, 1fr); gap: 4px;">
              <button @click="resolveCreateWeaponSpell('weapon', 'light'); showSummonSelector = false" class="btn-ink cmd-btn" style="font-size: 0.75rem;">軽い武器</button>
              <button @click="resolveCreateWeaponSpell('weapon', 'oneHanded'); showSummonSelector = false" class="btn-ink cmd-btn" style="font-size: 0.75rem;">片手武器</button>
              <button @click="resolveCreateWeaponSpell('weapon', 'twoHanded'); showSummonSelector = false" class="btn-ink cmd-btn" style="font-size: 0.75rem;">両手武器</button>
              <button @click="resolveCreateWeaponSpell('armor', 'leather'); showSummonSelector = false" class="btn-ink cmd-btn" style="font-size: 0.75rem;">革鎧</button>
              <button @click="resolveCreateWeaponSpell('shield', 'wood'); showSummonSelector = false" class="btn-ink cmd-btn" style="font-size: 0.75rem;">木盾</button>
              <button @click="resolveCreateWeaponSpell('shield', 'round'); showSummonSelector = false" class="btn-ink cmd-btn" style="font-size: 0.75rem;">丸盾</button>
            </div>
          </div>

          <!-- 6. 第0ラウンド（遠距離戦・反応チェック） -->
          <div v-else-if="combatState.round === 0" class="cmd-action-group">
            <template v-if="combatState.reactionResult">
              <div v-if="combatState.reactionResult.actionType === 'bribe'" style="display: flex; flex-direction: column; gap: 6px;">
                <button @click="payBribe(false)" class="btn-ink btn-mini" :disabled="character.gold < 5">
                  🪙 ワイロを支払う (金貨5枚)
                </button>
                <button @click="refuseBribeAndFight" class="btn-ink btn-mini btn-danger-ink" style="background: #8c1c1c; color: white;">
                  ⚔️ 拒否して戦闘する
                </button>
              </div>
              <div v-else style="display: flex; flex-direction: column; gap: 6px;">
                <!-- 魔法【友情】での出目調整 -->
                <div v-if="character.subStatType === 'magic' && character.spells.includes('友情') && character.subStatCurrent >= 1" style="display: flex; gap: 6px;">
                  <button @click="applyFriendshipReaction(1)" class="btn-ink btn-mini btn-spell" style="flex: 1;" :disabled="combatState.reactionResult.roll >= 6">
                    出目+1 (上限6)
                  </button>
                  <button @click="applyFriendshipReaction(-1)" class="btn-ink btn-mini btn-spell" style="flex: 1;" :disabled="combatState.reactionResult.roll <= 1">
                    出目-1 (下限1)
                  </button>
                </div>
                <button @click="confirmReactionResult" class="btn-ink btn-mini" style="width: 100%;">
                  結果を承認して進む
                </button>
              </div>
            </template>
            <template v-else>
              <div class="cmd-btn-grid">
                <button 
                  @click="playerAttack(targetEnemy?.id)" 
                  class="btn-ink cmd-btn" 
                  :disabled="!isRangedAvailable || combatState.hasRangedFired"
                >
                  🎯 弓・スリングで射撃攻撃
                </button>
                <button 
                  v-if="character.subStatType === 'dexterity' && character.subStatCurrent > 0"
                  @click="playerAttack(targetEnemy?.id, true)" 
                  class="btn-ink cmd-btn btn-strength" 
                  :disabled="!isRangedAvailable || combatState.hasRangedFired"
                >
                  🎯 全力射撃
                </button>
                <button 
                  @click="rollReactionCheck" 
                  class="btn-ink cmd-btn" 
                  :disabled="combatState.hasReactionChecked || combatState.hasRangedFired || isBossRoom"
                >
                  🎲 反応表を振る
                </button>
                <button 
                  @click="payBribe(false)" 
                  class="btn-ink cmd-btn btn-secondary" 
                  :disabled="!combatState.isBribeAllowed || character.gold < 5"
                >
                  🪙 ワイロ
                </button>
                <button 
                  v-if="['magic', 'luck'].includes(character.subStatType) && character.subStatCurrent > 0"
                  @click="showMagicSubmenu = true"
                  class="btn-ink cmd-btn btn-spell"
                  :disabled="isRound0SpellDisabled"
                >
                  🔮 じゅもん
                </button>
              </div>
              <button @click="closeRangedRound" class="btn-ink btn-mini btn-melee-shift" style="width: 100%; margin-top: 6px;">
                ⚔️ 接近戦へ移行する
              </button>
            </template>
          </div>

          <!-- 7. 近接戦（Round >= 1） -->
          <div v-else class="cmd-action-group">
            <div v-if="showShireenClueAction" style="margin-bottom: 6px;">
              <button @click="spendShireenClue" class="btn-ink btn-mini" style="width: 100%; background: #e1f5fe; border-color: #29b6f6; color: #0288d1; font-weight: bold;">
                🔍 手がかりを消費して未来視を見破る
              </button>
            </div>

            <div class="cmd-btn-grid">
              <button 
                @click="playerAttack(targetEnemy?.id)" 
                class="btn-ink cmd-btn btn-main-attack"
                :disabled="character.equippedWeapon?.type === 'ranged'"
              >
                ⚔️ 通常攻撃
              </button>

              <button 
                v-if="character.subStatType === 'strength' && character.subStatCurrent > 0"
                @click="playerAttack(targetEnemy?.id, true)" 
                class="btn-ink cmd-btn btn-strength"
                :disabled="character.equippedWeapon?.type === 'ranged'"
              >
                💪 全力攻撃
              </button>

              <button 
                v-if="['magic', 'luck'].includes(character.subStatType) && character.subStatCurrent > 0"
                @click="showMagicSubmenu = true"
                class="btn-ink cmd-btn btn-spell"
              >
                🔮 じゅもん
              </button>

              <button 
                @click="escapeCombat" 
                class="btn-ink cmd-btn btn-flee"
              >
                🏃 戦闘から逃走する
              </button>
            </div>

            <!-- 聖水が使える場合 -->
            <div v-if="isHolyWaterAvailable && (targetEnemy?.tags.includes('weak') || targetEnemy?.tags.includes('undead'))" style="margin-top: 6px;">
              <button 
                @click="useHolyWater(targetEnemy?.id)" 
                class="btn-ink btn-mini" 
                style="width: 100%; background: #e0f2f1; border-color: #4db6ac; color: #00796b;"
              >
                🧪 聖水を使用 (対象: {{ targetEnemy?.name }})
              </button>
            </div>

            <!-- 従者魔術師呪文 -->
            <div v-if="magesWithMagic.length > 0" style="margin-top: 6px; display: flex; gap: 4px; flex-wrap: wrap;">
              <button 
                v-for="mage in magesWithMagic" 
                :key="mage.id"
                @click="castFollowerSpell(mage.id)"
                class="btn-ink btn-mini btn-spell"
                style="flex: 1;"
              >
                🔮 {{ mage.name }} [{{ mage.magicList && mage.magicList[0] ? mage.magicList[0] : '炎球' }}]
              </button>
            </div>
          </div>

          <!-- メッセージ待ちウェイト表示マスク -->
          <div v-if="isMessageWaiting" class="cmd-wait-mask" title="メッセージ確認中">
            <span>▼ メッセージを読み進めてください</span>
          </div>
        </div>
      </div>

      <!-- RIGHT: Message Window -->
      <div class="dq3-message-slot">
        <MessageWindow :embedded="true" />
      </div>
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

/* Dynamic Inline Dice Banner Overlay */
.combat-dice-banner {
  background: #fffdf8;
  border: 2px solid var(--ink-dark);
  box-shadow: 2px 2px 0 var(--ink-dark);
  border-radius: 6px;
  padding: 8px 14px;
  margin-bottom: 15px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  font-family: 'Noto Serif JP', serif;
  transition: all 0.3s ease;
}

.dice-rolling-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.95rem;
  color: var(--ink-dark);
}

.rolling-dice-icon {
  display: inline-block;
  animation: spin-dice 0.6s linear infinite;
}

@keyframes spin-dice {
  0% { transform: rotate(0deg) scale(1); }
  50% { transform: rotate(180deg) scale(1.15); }
  100% { transform: rotate(360deg) scale(1); }
}

.dice-result-indicator {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: center;
}

.dice-value-chip {
  background: rgba(44, 30, 14, 0.08);
  border: 1px dashed var(--ink-dark);
  border-radius: 4px;
  padding: 2px 8px;
  font-size: 0.9rem;
  font-weight: bold;
}

.dice-result-text {
  font-size: 0.95rem;
  font-weight: bold;
  color: var(--ink-dark);
}

.banner-crit {
  border-color: #2e7d32 !important;
  background: #f1f8e9 !important;
  color: #2e7d32 !important;
  box-shadow: 2px 2px 0 #2e7d32 !important;
}

.banner-fumble {
  border-color: #c62828 !important;
  background: #ffebee !important;
  color: #c62828 !important;
  box-shadow: 2px 2px 0 #c62828 !important;
}


/* Enemy HP Bar Container */
.enemy-hp-container {
  width: 100%;
  height: 6px;
  background: #e0d8c9;
  border-radius: 3px;
  overflow: hidden;
  margin: 6px 0;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.15);
}

.enemy-hp-bar {
  height: 100%;
  background-color: #388e3c;
  transition: width 0.35s ease, background-color 0.35s ease;
  border-radius: 3px;
}

.enemy-hp-bar.hp-warn {
  background-color: #f57c00;
}

.enemy-hp-bar.hp-crit {
  background-color: #d32f2f;
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

/* DRAGON QUEST III CONSOLE DOCK */
.dq3-console-dock {
  display: flex;
  gap: 15px;
  margin-top: 25px;
  align-items: stretch;
  min-height: 220px;
}

.dq3-command-window {
  flex: 0 0 320px;
  display: flex;
  flex-direction: column;
  border: 3px double var(--ink-dark);
  background: #fffcf5;
  border-radius: 6px;
  padding: 12px;
  position: relative;
  box-shadow: 3px 3px 0 rgba(27, 22, 18, 0.2);
}

.cmd-window-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-family: 'Noto Serif JP', serif;
  font-weight: bold;
  font-size: 0.95rem;
  color: var(--ink-dark);
  border-bottom: 2px solid var(--ink-dark);
  padding-bottom: 6px;
  margin-bottom: 10px;
}

.target-badge {
  font-size: 0.75rem;
  background: rgba(140, 28, 28, 0.1);
  color: #8c1c1c;
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid rgba(140, 28, 28, 0.3);
  max-width: 160px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cmd-window-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  position: relative;
}

.cmd-btn-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  width: 100%;
}

.cmd-btn {
  font-size: 0.85rem;
  padding: 8px 6px;
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1.2;
}

.cmd-wait-mask {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 252, 245, 0.85);
  backdrop-filter: blur(1px);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  z-index: 5;
  font-size: 0.85rem;
  font-weight: bold;
  color: var(--ink-dark);
  animation: pulse-mask 1.5s infinite ease-in-out;
}

@keyframes pulse-mask {
  0%, 100% { opacity: 0.85; }
  50% { opacity: 0.55; }
}

.dq3-message-slot {
  flex: 1;
  display: flex;
  min-width: 0;
}

.is-selected-target {
  border-color: #8c1c1c !important;
  box-shadow: 0 0 8px rgba(140, 28, 28, 0.4), inset 0 0 6px rgba(140, 28, 28, 0.1) !important;
  transform: translateY(-2px);
  background: #fffbfb !important;
}

.target-indicator {
  color: #8c1c1c;
  font-weight: bold;
  animation: blink-target 1s infinite alternate;
}

@keyframes blink-target {
  from { opacity: 0.4; }
  to { opacity: 1; }
}

@media (max-width: 768px) {
  .dq3-console-dock {
    flex-direction: column;
  }
  .dq3-command-window {
    flex: none;
    width: 100%;
  }
}

</style>
