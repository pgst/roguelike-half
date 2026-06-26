import { useGameState } from './useGameState';
import type { Enemy } from '../types';

export function useDungeon() {
  const { 
    character, 
    followers, 
    activeEvent, 
    dungeonDepth, 
    totalRoomsToClear, 
    addLog, 
    rollD66, 
    rollD6,
    combatState,
    currentScreen,
    clearDiceTray,
    activeScenario
  } = useGameState();

  // Action: Explore next room
  async function exploreNextRoom() {
    if (currentScreen.value !== 'explore') return;
    if (!activeScenario.value) {
      addLog('シナリオが選択されていません。', 'error');
      return;
    }
    clearDiceTray();

    if (dungeonDepth.value >= totalRoomsToClear.value) {
      // Final Boss Room
      activeEvent.value = JSON.parse(JSON.stringify(activeScenario.value.bossEvent));
      addLog('最後の部屋に到達しました！ ボスとの死闘が始まります。', 'error');
      startEncounter();
      return;
    }

    addLog('次の部屋へ向けて通路を進みます...', 'info');
    const { value } = await rollD66();
    let event = activeScenario.value.d66EventTable[value.toString()];

    if (!event) {
      // Fallback
      event = activeScenario.value.d66EventTable['11'] || Object.values(activeScenario.value.d66EventTable)[0];
    }

    // Clone event to avoid editing global state
    activeEvent.value = JSON.parse(JSON.stringify(event));

    addLog(`部屋発見: [d66: ${value}] ${activeEvent.value!.title}`, 'info');

    // Trigger event effect
    if (activeEvent.value!.type === 'encounter') {
      startEncounter();
    } else if (
      activeEvent.value!.type !== 'trap' &&
      activeEvent.value!.type !== 'treasure' &&
      activeEvent.value!.type !== 'rest' &&
      activeEvent.value!.type !== 'npc'
    ) {
      // For standard rooms with no action required, resolve immediately
      (activeEvent.value as any).isResolved = true;
      (activeEvent.value as any).resolutionText = activeEvent.value!.description;
    } else {
      // For traps, rests, treasure, we stay in 'explore' screen but render activeEvent UI
    }
  }

  function startEncounter() {
    if (!activeEvent.value || !activeEvent.value.enemies) return;
    clearDiceTray();

    // Reset combat state
    combatState.active = true;
    combatState.round = 0;
    combatState.log = [];
    combatState.hasRangedFired = false;
    combatState.buffs.defenseBonus = 0;
    combatState.buffs.damageIgnoreCount = 0;
    combatState.isEscaping = false;
    combatState.combatType = 'melee';
    combatState.hasReactionChecked = false;
    combatState.isBribeAllowed = false;
    combatState.reactionResult = null;

    // Populate enemies with IDs
    combatState.enemies = activeEvent.value.enemies.map(e => ({
      ...e,
      id: Math.random().toString(36).substring(2, 9),
    })) as Enemy[];

    addLog(`クリーチャーと遭遇！戦闘に入ります。 (${combatState.enemies.length}体の敵)`, 'combat');
    currentScreen.value = 'combat';
  }

  // Handle Trap Roll Resolution
  async function resolveTrapCheck(): Promise<boolean> {
    if (!activeEvent.value || activeEvent.value.type !== 'trap') return false;

    const stat = activeEvent.value.trapStat || 'dexterity';
    const target = activeEvent.value.trapTarget || 4;
    const damage = activeEvent.value.trapDamage !== undefined ? activeEvent.value.trapDamage : 1;

    addLog(`トラップ判定開始: 【${stat.toUpperCase()}】判定ロール (目標値: ${target})`, 'info');

    // Roll d6
    const roll = await rollD6(true);
    let modifier = 0;

    // Lantern penalty
    const carries = followers.value.some(f => f.type === 'lantern') || character.value.items.some(i => i.type === 'lantern');
    if (!carries) {
      modifier -= 2;
      addLog('暗闇での探索により判定に -2 のペナルティ！', 'error');
    }

    // Armor bonuses
    if (stat === 'dexterity' && character.value.equippedArmor) {
      const arm = character.value.equippedArmor;
      if (arm.modDex > 0) {
        modifier += arm.modDex;
        addLog(`防具 [${arm.name}] の効果で器用判定に +${arm.modDex}`, 'success');
      }
    }

    // Determine stat value
    let statVal = 0;
    let isUsingSubStat = false;

    if (stat === 'skill') {
      statVal = character.value.skillCurrent;
    } else {
      // Check if sub-stat matches
      const isSubMatch = character.value.subStatType === stat;
      if (isSubMatch) {
        if (character.value.subStatCurrent > 0) {
          statVal = character.value.subStatCurrent;
          isUsingSubStat = true;
          addLog(`得意な副能力値【${stat.toUpperCase()}】を技量点の代わりに使用します。(現在値: ${statVal})`, 'success');
        } else {
          statVal = character.value.skillCurrent;
          addLog(`副能力値が0点以下のため、技量点を使用します。`, 'error');
        }
      } else {
        statVal = character.value.skillCurrent;
        addLog(`技量点を使用して判定を行います。(現在値: ${statVal})`, 'info');
      }
    }

    const total = roll === 6 ? 99 : roll === 1 ? -99 : roll + statVal + modifier;
    const isSuccess = roll === 6 || (roll !== 1 && total >= target);

    if (isUsingSubStat) {
      // Consume 1 point after roll (Rule 9)
      character.value.subStatCurrent--;
      addLog(`判定終了後、副能力値を1点消費しました。(残り: ${character.value.subStatCurrent}点)`, 'info');
    }

    if (isSuccess) {
      addLog(`🎉 トラップ判定に成功しました！ (ロール計: ${roll === 6 ? 'クリティカル' : total} >= 目標: ${target})`, 'success');
      if (activeEvent.value) {
        (activeEvent.value as any).isResolved = true;
        (activeEvent.value as any).resolutionText = `🎉 トラップ判定に成功しました！
判定能力: ${stat.toUpperCase()} (目標値: ${target})
判定ロール: 🎲出目 [ ${roll} ] + 補正等 [ ${statVal + modifier} ] = [ ${roll === 6 ? 'クリティカル成功' : total} ]

無事に罠を感知・回避し、無傷で先へ進むことができます！`;
      }
      return true;
    } else {
      addLog(`💥 トラップ判定に失敗しました！ (ロール計: ${roll === 1 ? 'ファンブル' : total} < 目標: ${target})`, 'error');
      let damageTaken = 0;
      if (damage > 0) {
        character.value.lifeCurrent = Math.max(0, character.value.lifeCurrent - damage);
        damageTaken = damage;
        addLog(`主人公は ${damage} 点のダメージを受けました。(現在生命力: ${character.value.lifeCurrent})`, 'damage');
        if (character.value.lifeCurrent <= 0) {
          currentScreen.value = 'gameover';
          return false;
        }
      }
      if (activeEvent.value) {
        (activeEvent.value as any).isResolved = true;
        (activeEvent.value as any).resolutionText = `💥 トラップ判定に失敗しました！
判定能力: ${stat.toUpperCase()} (目標値: ${target})
判定ロール: 🎲出目 [ ${roll} ] + 補正等 [ ${statVal + modifier} ] = [ ${roll === 1 ? 'ファンブル失敗' : total} ]

罠を発動させてしまい、${damageTaken > 0 ? `生命力に ${damageTaken} 点のダメージを受けました！` : '何も起こりませんでした。'} (残り生命力: ${character.value.lifeCurrent})`;
      }
      return false;
    }
  }

  return {
    exploreNextRoom,
    resolveTrapCheck,
  };
}
