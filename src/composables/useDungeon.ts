import { useGameState } from './useGameState';
import type { Enemy } from '../types';
import { runScenarioHook } from './scenarioPlugins';
import { setPyramidHelpers } from './scenarioPlugins/pyramidPlugin';

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
    followers,
    playerActiveStatusEffectRules,
    pyramidRunCount,
    savePyramidBossSnapshot
  } = useGameState();

  setPyramidHelpers(addLog, startEncounter);

  // Action: Explore next room
  async function exploreNextRoom() {
    if (currentScreen.value !== 'explore') return;
    if (!activeScenario.value) {
      addLog('シナリオが選択されていません。', 'error');
      return;
    }
    clearDiceTray();

    // Chronodemon scenario custom tile/run progression
    if (activeScenario.value.id === 'pyramid_of_chronodemon') {
      const run = pyramidRunCount.value;
      const depth = dungeonDepth.value; // 0-indexed room index



      // 1. Room 4 (depth 3) is always the Middle Event
      if (depth === 3) {
        let middleEvent: any;
        if (run === 1) {
          middleEvent = {
            title: "【中間】ヘラクレオス像 (1回目の冒険)",
            d66Code: "Middle1",
            description: "階段の踊り場でポロメイア兵士団とアルマシウダの黒蜘蛛隊が鉢合わせ、一触即発の状況に遭遇しました。そこに突如、動き出した「ヘラクレオス像」が襲いかかってきます！\n※打撃属性の攻撃特性を持つゴーレムに対しては、【斬撃】武器での攻撃ロールに -2 のペナルティを受けます。戦闘から逃走することはできません。",
            type: "encounter",
            enemies: [
              { name: "ヘラクレオス像", level: 5, lifeMax: 6, lifeCurrent: 6, attackCount: 2, tags: ["golem", "strong"], count: 1 }
            ]
          };
        } else if (run === 2) {
          middleEvent = {
            title: "【中間】氷霧の精霊 (2回目の冒険)",
            d66Code: "Middle2",
            description: "バーランドが黒蜘蛛隊に冷たい霧を撒き散らし、逃げ去りました。霧が実体化した「氷霧の精霊」が目の前に立ち塞がります！\n※全体攻撃特性：すべてのキャラクターは毎ラウンド終了時に防御ロール（目標値: 3）を行い、失敗すると生命点1を失います。精霊のため【氷】特性攻撃は無効です。逃走不可。",
            type: "encounter",
            enemies: [
              { name: "氷霧の精霊", level: 3, lifeMax: 6, lifeCurrent: 6, attackCount: 1, tags: ["strong"], count: 1, special: "ice_mist" }
            ]
          };
        } else {
          middleEvent = {
            title: "【中間】砂漠ワニ (3回目の冒険)",
            d66Code: "Middle3",
            description: "落とし穴の底にある無数の針にぶら下がっていたホークを救助するため、下から登ってきた巨大な「砂漠ワニ」の注意を引いて戦闘に入ります！\n※食料2つまたは弱い従者1体のワイロ（1-3で友好）が可能です。防御判定ファンブル時、噛みつき（毎ラウンド終了時ダメージ2）が発生。逃走不可。",
            type: "npc",
            npcType: "desert_crocodile",
            enemies: [
              { name: "砂漠ワニ", level: 4, lifeMax: 9, lifeCurrent: 9, attackCount: 1, tags: ["weak"], count: 1, weaponAttribute: "slash" }
            ]
          };
        }
        activeEvent.value = middleEvent;
        addLog(`中間イベント発生！ [第4の部屋] (${run}回目の冒険)`, 'error');
        if (middleEvent.type === 'encounter') {
          startEncounter();
        }
        return;
      }

      // 2. Final Boss/Event check (from Room 5 / depth 4 onwards)
      let triggerFinal = false;
      let rolledValue = 0;

      if (depth >= 10) {
        // Room 11 (depth 10) is always the final event
        triggerFinal = true;
      } else if (depth >= 4) {
        // Roll d66 to check probability
        addLog('次の部屋へ向けて通路を進みます...', 'info');
        const res = await rollD66();
        rolledValue = res.value;
        // Rules:
        // Room 5 (depth 4) -> never
        // Room 6 (depth 5) -> 11-16
        // Room 7 (depth 6) -> 11-26
        // Room 8 (depth 7) -> 11-36
        // Room 9 (depth 8) -> 11-46
        // Room 10 (depth 9) -> 11-56
        if (depth === 5 && rolledValue >= 11 && rolledValue <= 16) triggerFinal = true;
        else if (depth === 6 && rolledValue >= 11 && rolledValue <= 26) triggerFinal = true;
        else if (depth === 7 && rolledValue >= 11 && rolledValue <= 36) triggerFinal = true;
        else if (depth === 8 && rolledValue >= 11 && rolledValue <= 46) triggerFinal = true;
        else if (depth === 9 && rolledValue >= 11 && rolledValue <= 56) triggerFinal = true;
      }

      if (triggerFinal) {
        let finalEvent: any;
        if (run === 1) {
          finalEvent = {
            title: "【決戦】崩落する床 (1回目の冒険)",
            d66Code: "Final1",
            description: "ドワーフの魔道士ミロスの過去の幻影に出会いました。話している最中、足元の床が崩落を始めます！\n崩れ去る床を跳び越えるため、3回の【器用度判定】を行ってください。",
            type: "trap",
            trapStat: "dexterity",
            trapTarget: 3,
            trapDamage: 1,
            isResolved: false
          };
        } else if (run === 2) {
          finalEvent = {
            title: "【決戦】大広間の対峙 (2回目の冒険)",
            d66Code: "Final2",
            description: "大広間でシーリーンとバーランドが対峙しています。背後の巨像「至高のヘラクレオス」が動き出しました！\nどちらを相手にするか選んでください。",
            type: "npc",
            npcType: "final2_choice",
            isResolved: false
          };
        } else {
          finalEvent = {
            title: "【決戦】刻の悪魔クロノヴァルス (3回目の冒険)",
            d66Code: "Final3",
            description: "ピラミッド最上階。心臓のように脈動する巨大なクリスタルから、ついに『刻の悪魔クロノヴァルス』が降臨しました！\n時の巻き戻しを切り抜け、悪魔を『封印の壺』へ封じ込めるのです！",
            type: "encounter",
            enemies: [
              { name: "刻の悪魔クロノヴァルス", level: 5, lifeMax: 12, lifeCurrent: 12, attackCount: 2, tags: ["strong", "demon"], count: 1 }
            ]
          };
        }
        savePyramidBossSnapshot();
        activeEvent.value = finalEvent;
        addLog(`決戦イベント発生！ (${run}回目の冒険)`, 'error');
        if (finalEvent.type === 'encounter') {
          startEncounter();
        }
        return;
      }

      // If we didn't trigger final, proceed with normal d66 roll
      // If we rolled a value but it didn't trigger final, we reuse that value!
      let value = rolledValue;
      if (value === 0) {
        addLog('次の部屋へ向けて通路を進みます...', 'info');
        const res = await rollD66();
        value = res.value;
      }

      let event = activeScenario.value.d66EventTable[value.toString()];
      if (!event) {
        event = activeScenario.value.d66EventTable['11'] || Object.values(activeScenario.value.d66EventTable)[0];
      }

      addLog(`部屋発見: [d66: ${value}] ${event.title}`, 'info');

      // Check perception
      const hasScout = followers.value.some(f => f.type === 'scout');
      const hasBrooch = character.value.items.some(i => i.id === 'golden_brooch' && i.charges !== undefined && i.charges > 0);
      const hasDexPerception = (character.value.subStatType === 'dexterity' && character.value.subStatCurrent > 0) || hasBrooch;

      if (hasScout || hasDexPerception) {
        combatState.pendingPerception = {
          rollValue: value,
          event,
          hasScout,
          hasHero: hasDexPerception
        };
        addLog(`🧭 部屋発見：危険を察知して回避（振り直し）を試みることができます。`, 'error');
      } else {
        activateRoomEvent(event);
      }
      return;
    }

    // Default room exploration for other scenarios
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
    const hasBrooch = character.value.items.some(i => i.id === 'golden_brooch' && i.charges !== undefined && i.charges > 0);
    const hasDexPerception = (character.value.subStatType === 'dexterity' && character.value.subStatCurrent > 0) || hasBrooch;

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

    // Run scenario plugin explore room hook!
    runScenarioHook(activeScenario.value?.id, 'onExploreRoom', activeEvent.value, character, followers);

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

    const brooch = character.value.items.find(i => i.id === 'golden_brooch' && i.charges !== undefined && i.charges > 0);
    const isDex = character.value.subStatType === 'dexterity';
    
    if (brooch) {
      addLog('お守り『黄金虫のブローチ』の力で【察知】を行います！ (目標値: 4)', 'info');
    } else {
      addLog('主人公が器用点【察知】を行います！ (目標値: 4)', 'info');
    }
    
    const roll = await rollD6(true);
    let modifier = 0;
    if (!carriesLantern.value) {
      modifier -= 2;
      addLog('暗闇のため主人公の察知判定に -2 のペナルティ！', 'error');
    }
    
    let val = 0;
    if (isDex) {
      val = character.value.subStatCurrent; // 消費前の器用点を用いて判定
      if (brooch) {
        modifier += 1;
        addLog('ブローチの魔力により、器用点判定に +1 のボーナス！', 'success');
      }
    } else {
      val = character.value.skillCurrent;
      addLog('副能力値が器用点ではないため、技量点を使用して判定します。', 'info');
    }
    
    const total = roll === 6 ? 99 : roll === 1 ? -99 : roll + val + modifier;
    const success = roll === 6 || (roll !== 1 && total >= 4);

    if (brooch) {
      brooch.charges = (brooch.charges || 2) - 1;
      addLog(`黄金虫のブローチの魔力を消費しました。(残り耐久: ${brooch.charges}/2)`, 'info');
      if (brooch.charges <= 0) {
        character.value.items = character.value.items.filter(i => i.id !== 'golden_brooch');
        addLog('💥 黄金虫のブローチは激しいヒビが入り、砕け散ってしまいました！', 'error');
      }
    } else {
      // 判定後に器用点を1点消費
      character.value.subStatCurrent = Math.max(0, character.value.subStatCurrent - 1);
      addLog(`察知により器用点を1点消費しました。(残り: ${character.value.subStatCurrent}点)`, 'info');
    }

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
    combatState.playerHasFiredRanged = false;
    combatState.archerHasFiredRanged = false;
    combatState.buffs.defenseBonus = 0;
    combatState.buffs.damageIgnoreCount = 0;
    combatState.isEscaping = false;
    combatState.combatType = 'melee';
    combatState.hasCoveredInRound = false;
    combatState.pendingCover = null;
    combatState.pendingHolyArrow = 0;
    combatState.pendingDeflect = null;
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

    if (activeEvent.value.d66Code === 'Final3') {
      (combatState as any).pendingRoarCheck = 'start';
      addLog('👿 刻の悪魔クロノヴァルスが降臨し、空間が歪む『時喰いの咆哮』を放ちました！', 'error');
    }
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

    // Apply 剛力丸 (strong_pill) bonus
    const pillIdx = character.value.items.findIndex(i => i.id === 'strong_pill');
    if (stat === 'strength' && pillIdx !== -1) {
      modifier += 1;
      character.value.items.splice(pillIdx, 1);
      addLog('💊 『剛力丸』を服用し、筋力判定に +1 ボーナスを得ました！(アイテムを消費)', 'success');
    }

    // Lantern penalty
    if (!carriesLantern.value) {
      modifier -= 2;
      addLog('暗闇での探索により判定に -2 のペナルティ！', 'error');
    }

    // Apply status effect modifiers
    playerActiveStatusEffectRules.value.forEach(rule => {
      if (rule.modSkill) {
        modifier += rule.modSkill;
        addLog(`状態異常ペナルティにより判定に ${rule.modSkill} の修正が入ります。`, 'error');
      }
    });

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

      const scope = getTrapTargetScope(activeEvent.value);
      const validFollowers = followers.value.filter(f => f.lifeCurrent > 0 && f.name !== 'ウォー・ドール');

      if (scope === 'all') {
        if (damage > 0) {
          character.value.lifeCurrent = Math.max(0, character.value.lifeCurrent - damage);
          addLog(`主人公は ${damage} 点のダメージを受けました。(現在生命力: ${character.value.lifeCurrent})`, 'damage');
          
          validFollowers.forEach(f => {
            f.lifeCurrent = 0;
            addLog(`💀 従者 ${f.name} は罠のダメージを受け、死亡しました...`, 'error');
          });
        }

        if (activeEvent.value && (activeEvent.value as any).statusEffect) {
          const eff = (activeEvent.value as any).statusEffect;
          if (!character.value.statusEffects) {
            character.value.statusEffects = [];
          }
          if (!character.value.statusEffects.includes(eff)) {
            character.value.statusEffects.push(eff);
            addLog(`主人公は状態異常【${eff}】を受けました！`, 'error');
          }
        }

        if (character.value.lifeCurrent <= 0) {
          currentScreen.value = 'gameover';
          return false;
        }

        if (activeEvent.value) {
          (activeEvent.value as any).isResolved = true;
          (activeEvent.value as any).resolutionText = `💥 トラップ判定に失敗しました！
判定能力: ${stat.toUpperCase()} (目標値: ${target})
判定ロール: 🎲出目 [ ${roll} ] + 補正等 [ ${statVal + modifier} ] = [ ${roll === 1 ? 'ファンブル失敗' : total} ]

全体トラップが発動し、主人公と生存しているすべての従者がダメージを受けました。`;
        }
        return false;
      } else if (scope === 'random') {
        const candidates = ['hero', ...validFollowers.map(f => f.id)];
        const randIndex = Math.floor(Math.random() * candidates.length);
        const chosenId = candidates[randIndex];
        
        let targetName = '主人公';
        if (chosenId === 'hero') {
          if (damage > 0) {
            character.value.lifeCurrent = Math.max(0, character.value.lifeCurrent - damage);
            addLog(`主人公はランダム対象に選ばれ、${damage} 点のダメージを受けました。(現在生命力: ${character.value.lifeCurrent})`, 'damage');
          }
          if (activeEvent.value && (activeEvent.value as any).statusEffect) {
            const eff = (activeEvent.value as any).statusEffect;
            if (!character.value.statusEffects) {
              character.value.statusEffects = [];
            }
            if (!character.value.statusEffects.includes(eff)) {
              character.value.statusEffects.push(eff);
              addLog(`主人公は状態異常【${eff}】を受けました！`, 'error');
            }
          }
          if (character.value.lifeCurrent <= 0) {
            currentScreen.value = 'gameover';
            return false;
          }
        } else {
          const follower = validFollowers.find(f => f.id === chosenId);
          if (follower) {
            targetName = follower.name;
            follower.lifeCurrent = 0;
            addLog(`💀 従者 ${follower.name} がランダム対象に選ばれ、ダメージを受けて死亡しました...`, 'error');
          }
        }

        if (activeEvent.value) {
          (activeEvent.value as any).isResolved = true;
          (activeEvent.value as any).resolutionText = `💥 トラップ判定に失敗しました！
判定能力: ${stat.toUpperCase()} (目標値: ${target})
判定ロール: 🎲出目 [ ${roll} ] + 補正等 [ ${statVal + modifier} ] = [ ${roll === 1 ? 'ファンブル失敗' : total} ]

ランダム選択の罠により、${targetName} がダメージを受けました。`;
        }
        return false;
      } else if (scope === 'non_combatants') {
        const nonCombatants = validFollowers.filter(f => f.isCombatant === false || f.type === 'captive');
        let chosenId = 'hero';
        
        if (nonCombatants.length > 0) {
          const randIndex = Math.floor(Math.random() * nonCombatants.length);
          chosenId = nonCombatants[randIndex].id;
        } else {
          // Fallback to random 1 from general pool
          const candidates = ['hero', ...validFollowers.map(f => f.id)];
          const randIndex = Math.floor(Math.random() * candidates.length);
          chosenId = candidates[randIndex];
        }

        let targetName = '主人公';
        if (chosenId === 'hero') {
          if (damage > 0) {
            character.value.lifeCurrent = Math.max(0, character.value.lifeCurrent - damage);
            addLog(`主人公は対象に選ばれ、${damage} 点のダメージを受けました。(現在生命力: ${character.value.lifeCurrent})`, 'damage');
          }
          if (activeEvent.value && (activeEvent.value as any).statusEffect) {
            const eff = (activeEvent.value as any).statusEffect;
            if (!character.value.statusEffects) {
              character.value.statusEffects = [];
            }
            if (!character.value.statusEffects.includes(eff)) {
              character.value.statusEffects.push(eff);
              addLog(`主人公は状態異常【${eff}】を受けました！`, 'error');
            }
          }
          if (character.value.lifeCurrent <= 0) {
            currentScreen.value = 'gameover';
            return false;
          }
        } else {
          const follower = validFollowers.find(f => f.id === chosenId);
          if (follower) {
            targetName = follower.name;
            follower.lifeCurrent = 0;
            if (follower.type === 'captive') {
              addLog(`💀 捕虜 ${follower.name} が優先対象に選ばれ、身代わりとなって死亡しました。`, 'error');
            } else {
              addLog(`💀 従者 ${follower.name} が対象に選ばれ、死亡しました...`, 'error');
            }
          }
        }

        if (activeEvent.value) {
          (activeEvent.value as any).isResolved = true;
          (activeEvent.value as any).resolutionText = `💥 トラップ判定に失敗しました！
判定能力: ${stat.toUpperCase()} (目標値: ${target})
判定ロール: 🎲出目 [ ${roll} ] + 補正等 [ ${statVal + modifier} ] = [ ${roll === 1 ? 'ファンブル失敗' : total} ]

非戦闘員優先の罠により、${targetName} がダメージを受けました。`;
        }
        return false;
      } else if (scope === 'choose_1d3') {
        // Roll 1d3 to determine number of targets
        const countRoll = Math.floor(Math.random() * 3) + 1;
        addLog(`🎯 罠の対象者数を決定するため 1d3 をロール: 出目 ${countRoll}`, 'roll');
        
        const totalValidTargets = 1 + validFollowers.length; // Hero + valid followers
        
        if (totalValidTargets <= countRoll) {
          // Everyone is affected
          if (damage > 0) {
            character.value.lifeCurrent = Math.max(0, character.value.lifeCurrent - damage);
            addLog(`主人公は全員対象となり、${damage} 点のダメージを受けました。(現在生命力: ${character.value.lifeCurrent})`, 'damage');
            
            validFollowers.forEach(f => {
              f.lifeCurrent = 0;
              addLog(`💀 従者 ${f.name} は全員対象となり、死亡しました...`, 'error');
            });
          }

          if (activeEvent.value && (activeEvent.value as any).statusEffect) {
            const eff = (activeEvent.value as any).statusEffect;
            if (!character.value.statusEffects) {
              character.value.statusEffects = [];
            }
            if (!character.value.statusEffects.includes(eff)) {
              character.value.statusEffects.push(eff);
              addLog(`主人公は状態異常【${eff}】を受けました！`, 'error');
            }
          }

          if (character.value.lifeCurrent <= 0) {
            currentScreen.value = 'gameover';
            return false;
          }

          if (activeEvent.value) {
            (activeEvent.value as any).isResolved = true;
            (activeEvent.value as any).resolutionText = `💥 トラップ判定に失敗しました！
判定能力: ${stat.toUpperCase()} (目標値: ${target})
判定ロール: 🎲出目 [ ${roll} ] + 補正等 [ ${statVal + modifier} ] = [ ${roll === 1 ? 'ファンブル失敗' : total} ]

対象者数（1d3: ${countRoll}人）がパーティメンバー数以上のための全員が対象となり、ダメージを受けました。`;
          }
          return false;
        } else {
          // Pause and request user choice for countRoll targets
          combatState.pendingTrapDamage = {
            damage,
            statusEffect: (activeEvent.value as any).statusEffect,
            stat,
            target,
            roll,
            total,
            chooseCount: countRoll,
            chosenIds: []
          };
          addLog(`⚠️ 罠が作動しました！ ${countRoll} 人の対象者を順に選択してください。`, 'error');
          return false;
        }
      } else {
        // Default / 1-person choose
        if (validFollowers.length > 0) {
          combatState.pendingTrapDamage = {
            damage,
            statusEffect: (activeEvent.value as any).statusEffect,
            stat,
            target,
            roll,
            total
          };
          addLog('⚠️ 罠が作動しました！ダメージを受けるキャラクター（主人公または従者）を選択してください。', 'error');
          return false;
        } else {
          let damageTaken = 0;
          if (damage > 0) {
            character.value.lifeCurrent = Math.max(0, character.value.lifeCurrent - damage);
            damageTaken = damage;
            addLog(`主人公は ${damage} 点のダメージを受けました。(現在生命力: ${character.value.lifeCurrent})`, 'damage');
          }

          let effectApplied = '';
          if (activeEvent.value && (activeEvent.value as any).statusEffect) {
            const eff = (activeEvent.value as any).statusEffect;
            if (!character.value.statusEffects) {
              character.value.statusEffects = [];
            }
            if (!character.value.statusEffects.includes(eff)) {
              character.value.statusEffects.push(eff);
              effectApplied = eff;
              addLog(`主人公は状態異常【${eff}】を受けました！`, 'error');
            }
          }

          if (character.value.lifeCurrent <= 0) {
            currentScreen.value = 'gameover';
            return false;
          }

          if (activeEvent.value) {
            (activeEvent.value as any).isResolved = true;
            (activeEvent.value as any).resolutionText = `💥 トラップ判定に失敗しました！
判定能力: ${stat.toUpperCase()} (目標値: ${target})
判定ロール: 🎲出目 [ ${roll} ] + 補正等 [ ${statVal + modifier} ] = [ ${roll === 1 ? 'ファンブル失敗' : total} ]

罠を発動させてしまい、${damageTaken > 0 ? `生命力に ${damageTaken} 点のダメージを受けました！` : ''}${effectApplied ? `さらに状態異常【${effectApplied}】を受けました！` : ''}${damageTaken === 0 && !effectApplied ? '何も起こりませんでした。' : ''} (残り生命力: ${character.value.lifeCurrent})`;
          }
          return false;
        }
      }
    }
  }

  // Helper to determine target scope of trap (e.g. from JSON or description keywords)
  function getTrapTargetScope(event: any): 'random' | 'choose_1d3' | 'all' | 'non_combatants' | 'default' {
    if (!event) return 'default';
    if (event.trapTargetScope) {
      return event.trapTargetScope;
    }
    const desc = event.description || '';
    const title = event.title || '';
    if (desc.includes('全員') || desc.includes('全員が対象') || desc.includes('全員に')) {
      return 'all';
    }
    if (desc.includes('非戦闘') || desc.includes('戦闘に参加しない従者') || desc.includes('戦闘外の従者')) {
      return 'non_combatants';
    }
    if (desc.includes('1d3人') || desc.includes('1d3名') || title.includes('矢狭間') || desc.includes('矢狭間')) {
      return 'choose_1d3';
    }
    if (desc.includes('ランダム') || desc.includes('ランダムで') || desc.includes('ランダムに1人') || desc.includes('ランダムに１人') || title.includes('投げ槍') || title.includes('油の入った壷') || title.includes('警報')) {
      return 'random';
    }
    return 'default';
  }

  function resolveTrapDamageTarget(targetId: 'hero' | string) {
    if (!combatState.pendingTrapDamage || !activeEvent.value) return;

    const pending = combatState.pendingTrapDamage;
    const { damage, statusEffect, stat, target, roll, total } = pending;

    // Check if it's a multi-choice trap
    if (pending.chooseCount && pending.chooseCount > 1) {
      if (!pending.chosenIds) {
        pending.chosenIds = [];
      }
      if (!pending.chosenIds.includes(targetId)) {
        pending.chosenIds.push(targetId);
      }
      
      // Reduce chooseCount
      pending.chooseCount--;
      
      // Log selection
      let selectedName = '主人公';
      if (targetId !== 'hero') {
        const follower = followers.value.find(f => f.id === targetId);
        if (follower) selectedName = follower.name;
      }
      addLog(`🎯 対象選択: ${selectedName} が対象に選ばれました。 (あと ${pending.chooseCount} 人)`, 'info');
      
      // Still need to choose more targets, keep UI open
      return;
    }

    // This is the final or only target!
    let allTargets = [targetId];
    if (pending.chosenIds) {
      allTargets = [...pending.chosenIds, targetId];
    }

    combatState.pendingTrapDamage = null;

    let resolutionNames: string[] = [];

    allTargets.forEach(tid => {
      if (tid === 'hero') {
        resolutionNames.push('主人公');
        if (damage > 0) {
          character.value.lifeCurrent = Math.max(0, character.value.lifeCurrent - damage);
          addLog(`主人公は罠のダメージを受けました。(現在生命力: ${character.value.lifeCurrent})`, 'damage');
        }
        if (statusEffect) {
          if (!character.value.statusEffects) {
            character.value.statusEffects = [];
          }
          if (!character.value.statusEffects.includes(statusEffect)) {
            character.value.statusEffects.push(statusEffect);
            addLog(`主人公は状態異常【${statusEffect}】を受けました！`, 'error');
          }
        }
      } else {
        const follower = followers.value.find(f => f.id === tid);
        if (follower) {
          resolutionNames.push(follower.name);
          follower.lifeCurrent = 0;
          if (follower.type === 'captive') {
            addLog(`💀 捕虜の ${follower.name} を罠の身代わりにし、ダメージを肩代わりさせました。(捕虜は死亡)`, 'error');
          } else {
            addLog(`💀 従者 ${follower.name} が罠のダメージを引き受け、身代わりとなって死亡しました...`, 'error');
          }
        }
      }
    });

    if (character.value.lifeCurrent <= 0) {
      currentScreen.value = 'gameover';
      return;
    }

    // Set trap event as resolved
    (activeEvent.value as any).isResolved = true;
    (activeEvent.value as any).resolutionText = `💥 トラップ判定に失敗しました！
判定能力: ${stat.toUpperCase()} (目標値: ${target})
判定ロール: 🎲出目 [ ${roll} ] + 補正等 [ ${total - roll} ] = [ ${roll === 1 ? 'ファンブル失敗' : total} ]

罠を発動させてしまい、${resolutionNames.join('、')} がダメージを受けました！`;
  }

  return {
    exploreNextRoom,
    resolveTrapCheck,
    confirmPerceptionSkip,
    executePerceptionScout,
    executePerceptionHero,
    startEncounter,
    resolveTrapDamageTarget,
  };
}
