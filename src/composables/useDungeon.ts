import { useGameState } from './useGameState';
import type { Enemy } from '../types';

export function useDungeon() {
  const { 
    character, 
    activeEvent, 
    dungeonDepth, 
    totalRoomsToClear, 
    addLog, 
    rollD66, 
    rollD6,
    combatState,
    currentScreen,
    clearDiceTray,
    activeScenario,
    carriesLantern,
    followers
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
      event = activeScenario.value.d66EventTable['11'] || Object.values(activeScenario.value.d66EventTable)[0];
    }

    addLog(`部屋発見: [d66: ${value}] ${event.title}`, 'info');

    // Check if player has options to use Perception (察知) (Rule 25 & Scout Follower)
    const hasScout = followers.value.some(f => f.type === 'scout');
    const hasDexPerception = character.value.subStatType === 'dexterity' && character.value.subStatCurrent > 0;

    if (hasScout || hasDexPerception) {
      // Pause in pending Perception state!
      combatState.pendingPerception = {
        rollValue: value,
        event,
        hasScout,
        hasHero: hasDexPerception
      };
      addLog(`🧭 部屋発見：危険を察知して回避（振り直し）を試みることができます。`, 'error');
    } else {
      // No perception options, proceed immediately to activate the room event
      activateRoomEvent(event);
    }
  }

  function activateRoomEvent(event: any) {
    activeEvent.value = JSON.parse(JSON.stringify(event));
    addLog(`探索対象決定: ${activeEvent.value!.title}`, 'info');

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

  function confirmPerceptionSkip() {
    if (!combatState.pendingPerception) return;
    const { event } = combatState.pendingPerception;
    combatState.pendingPerception = null;
    activateRoomEvent(event);
  }

  async function executePerceptionScout() {
    if (!combatState.pendingPerception) return;
    
    addLog('従者の斥候が【察知】を行います！ (目標値: 4)', 'info');
    const roll = await rollD6(true);
    let modifier = 0;
    if (!carriesLantern.value) {
      modifier -= 2;
      addLog('暗闇のため斥候の察知判定に -2 のペナルティ！', 'error');
    }
    const total = roll === 6 ? 99 : roll === 1 ? -99 : roll + modifier; // scout skill = 0
    const success = roll === 6 || (roll !== 1 && total >= 4);

    if (success) {
      addLog(`🧭 斥候の察知成功！危険を感知し、別の進路を選びます。(ロール計: ${roll === 6 ? 'クリティカル' : total} >= 4)`, 'success');
      combatState.pendingPerception = null;
      // Roll next room d66 again!
      await exploreNextRoom();
    } else {
      addLog(`💥 斥候の察知失敗！安全な別ルートを見つけられませんでした。(ロール計: ${roll === 1 ? 'ファンブル' : total} < 4)`, 'error');
      // Set hasScout to false so they can't click it again
      combatState.pendingPerception.hasScout = false;
    }
  }

  async function executePerceptionHero() {
    if (!combatState.pendingPerception) return;

    // Consume 1 dexterity point
    character.value.subStatCurrent = Math.max(0, character.value.subStatCurrent - 1);
    
    addLog('主人公が器用点【察知】を行います！ (目標値: 4)', 'info');
    const roll = await rollD6(true);
    let modifier = 0;
    if (!carriesLantern.value) {
      modifier -= 2;
      addLog('暗闇のため主人公の察知判定に -2 のペナルティ！', 'error');
    }
    const total = roll === 6 ? 99 : roll === 1 ? -99 : roll + character.value.subStatCurrent + modifier;
    const success = roll === 6 || (roll !== 1 && total >= 4);

    addLog(`察知により器用点を1点消費しました。(残り: ${character.value.subStatCurrent}点)`, 'info');

    if (success) {
      addLog(`🧭 主人公の察知成功！危険を感知し、別の進路を選びます。(ロール計: ${roll === 6 ? 'クリティカル' : total} >= 4)`, 'success');
      combatState.pendingPerception = null;
      // Roll next room d66 again!
      await exploreNextRoom();
    } else {
      addLog(`💥 主人公の察知失敗！安全な別ルートを見つけられませんでした。(ロール計: ${roll === 1 ? 'ファンブル' : total} < 4)`, 'error');
      // Set hasHero to false so they can't click it again
      combatState.pendingPerception.hasHero = false;
    }
  }

  function startEncounter() {
    if (!activeEvent.value || !activeEvent.value.enemies) return;
    clearDiceTray();

    // Reset combat state
    combatState.active = true;
    combatState.round = 0;
    combatState.hasQuickStrikeActive = false;
    combatState.log = [];
    combatState.hasRangedFired = false;
    combatState.buffs.defenseBonus = 0;
    combatState.buffs.damageIgnoreCount = 0;
    combatState.isEscaping = false;
    combatState.combatType = 'melee';
    combatState.hasCoveredInRound = false;
    combatState.pendingCover = null;
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
  async function resolveTrapCheck(useSubStat = true): Promise<boolean> {
    if (!activeEvent.value || activeEvent.value.type !== 'trap') return false;

    const stat = activeEvent.value.trapStat || 'dexterity';
    const target = activeEvent.value.trapTarget || 4;
    const damage = activeEvent.value.trapDamage !== undefined ? activeEvent.value.trapDamage : 1;

    addLog(`トラップ判定開始: 【${stat.toUpperCase()}】判定ロール (目標値: ${target})`, 'info');

    // Roll d6
    const roll = await rollD6(true);
    let modifier = 0;

    // Lantern penalty
    if (!carriesLantern.value) {
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
      // Check if sub-stat matches and player chose to use it
      const isSubMatch = character.value.subStatType === stat;
      if (isSubMatch && useSubStat) {
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
        if (isSubMatch && !useSubStat) {
          addLog(`副能力値【${stat.toUpperCase()}】を使用せず、技量点を使用して判定を行います。(現在値: ${statVal})`, 'info');
        } else {
          addLog(`技量点を使用して判定を行います。(現在値: ${statVal})`, 'info');
        }
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
    confirmPerceptionSkip,
    executePerceptionScout,
    executePerceptionHero,
  };
}
