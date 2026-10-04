import { type Ref, type WritableComputedRef } from 'vue';
import type { Character, Follower, Scenario, DungeonEvent, LogType } from '../../types';

export interface CombatEnemyDependencies {
  character: Ref<Character> | WritableComputedRef<Character>;
  followers: Ref<Follower[]>;
  combatState: any;
  activeScenario: Ref<Scenario | null>;
  activeEvent: Ref<DungeonEvent | null>;
  dungeonDepth: Ref<number>;
  totalRoomsToClear: Ref<number>;
  addLog: (text: string, type?: LogType | any) => void;
  rollD6: (skipVisual?: boolean) => Promise<number>;
  endCombat: (isVictory: boolean, getLoot?: boolean) => void;
  endCombatPeaceful: (text?: string) => void;
  executeEnemyAttacks: () => Promise<void>;
}

export function useCombatEnemy(deps: CombatEnemyDependencies) {
  const {
    character,
    followers,
    combatState,
    activeScenario: _activeScenario,
    activeEvent,
    dungeonDepth,
    totalRoomsToClear,
    addLog,
    rollD6,
    endCombat,
    endCombatPeaceful,
    executeEnemyAttacks
  } = deps;

  // Check if enemies should retreat (half health or count, Rule 38)
  function checkEnemyRetreat() {
    if (combatState.isOver) return;
    if (combatState.enemies.length === 0) return;
    if (!activeEvent.value) return;

    // Check if the battle event is "Fight to Death" (死ぬまで戦う)
    const isFightToDeath = 
      activeEvent.value.title.includes('決戦') || 
      activeEvent.value.title.includes('ボス') || 
      activeEvent.value.title.includes('魔将') ||
      activeEvent.value.d66Code === 'midpoint' ||
      activeEvent.value.reactionType === 'always_fight_to_death' ||
      combatState.enemies.some((e: any) => e.tags?.includes('fight_to_death'));
    if (isFightToDeath) return;

    // Calculate total starting health vs current health
    let totalStartLife = 0;
    let totalCurrentLife = 0;

    activeEvent.value.enemies?.forEach(e => {
      totalStartLife += e.lifeMax;
    });

    combatState.enemies.forEach((e: any) => {
      totalCurrentLife += e.lifeCurrent;
    });

    if (totalCurrentLife <= totalStartLife / 2) {
      addLog('⚔️ 敵の生命力/人数が初期の半分以下になったため、敵は恐怖して【逃走】しました！', 'success');
      endCombat(true);
    }
  }

  let isRollingReaction = false;

  // Combat reaction roll before fighting (Rule 35)
  async function rollReactionCheck() {
    if (isRollingReaction) return;
    if (dungeonDepth.value >= totalRoomsToClear.value || activeEvent.value?.d66Code === 'midpoint') {
      addLog('⚠️ ボス戦および中間イベントでは反応チェックを行えません。', 'error');
      return;
    }
    if (combatState.hasReactionChecked || combatState.reactionResult) return;
    
    isRollingReaction = true;
    try {
      combatState.hasReactionChecked = true;
      combatState.isBribeAllowed = false;

    // Check reactionType preset
    const preset = activeEvent.value?.reactionType;
    if (preset === 'always_hostile' || preset === 'always_fight_to_death') {
      const isFight = preset === 'always_fight_to_death';
      addLog(isFight ? '💀 常に死ぬまで戦う：敵は命を顧みず襲いかかってきます！' : '⚔️ 常に敵対：敵は容赦なく武器を構えて襲いかかってきました！', 'error');
      combatState.reactionResult = {
        roll: 1,
        text: isFight ? '死ぬまで戦う：敵は退路を断ち、最後の1体まで戦う姿勢です。' : '敵対的：クリーチャーは激しい敵意を示しています。',
        actionType: 'hostile'
      };
      return;
    } else if (preset === 'always_neutral' || preset === 'neutral') {
      addLog('🤝 中立：敵はこちらに敵意を持たず、関心を示していません。', 'success');
      combatState.reactionResult = {
        roll: 5,
        text: '中立：敵は攻撃してきません。立ち去ることができます。',
        actionType: 'neutral'
      };
      return;
    } else if (preset === 'always_friendly' || preset === 'friendly') {
      addLog('😊 友好的：敵は好意的な態度を示しています。', 'success');
      combatState.reactionResult = {
        roll: 6,
        text: '歓待：敵は友好的で、危害を加える様子はありません。',
        actionType: 'hospitable'
      };
      return;
    }

    addLog('敵の反応を確認します。1d6を振ります...', 'info');
    const roll = await rollD6();
    let text = '';
    let actionType: 'hostile' | 'bribe' | 'flee' | 'neutral' | 'hospitable' | 'outnumbered_flee' | 'outnumbered_hostile' = 'hostile';

    if (roll === 1) {
      text = '敵対的：クリーチャーは激しい敵意を示し、即座に襲いかかってきました！(敵先制攻撃)';
      actionType = 'hostile';
      addLog(text, 'error');
    } else if (roll === 2) {
      combatState.isBribeAllowed = true;
      text = 'ワイロ：金貨を要求されました。金貨5枚を支払えば戦闘を回避できます。';
      actionType = 'bribe';
      addLog(text, 'info');
    } else if (roll === 3) {
      const partySize = 1 + followers.value.length;
      const enemySize = combatState.enemies.reduce((sum: number, e: any) => sum + e.count, 0);
      if (partySize > enemySize) {
        text = '劣勢のため逃走：味方の数が敵より多いため、敵は逃げ出しました！';
        actionType = 'outnumbered_flee';
        addLog(text, 'success');
      } else {
        text = '数で劣っていないため、敵は強気になり襲いかかってきました！';
        actionType = 'outnumbered_hostile';
        addLog(text, 'error');
      }
    } else if (roll === 4) {
      text = '逃走：敵は怯えて逃げ出しました！勝利と同様に宝物を手に入れられます。';
      actionType = 'flee';
      addLog(text, 'success');
    } else if (roll === 5) {
      text = '中立：敵は攻撃してきません。エリアを自由に横切って立ち去ることができます。';
      actionType = 'neutral';
      addLog(text, 'success');
    } else if (roll === 6) {
      text = '歓待：食事と休息を提供してくれました！全員の生命力が1点回復し、敵は立ち去ります。';
      actionType = 'hospitable';
      addLog(text, 'success');
    }

    combatState.reactionResult = {
      roll,
      text,
      actionType
    };
    } finally {
      isRollingReaction = false;
    }
  }

  // 魔術【友情】による出目調整 (Rule 19)
  async function applyFriendshipReaction(adjustment: number) {
    if (!combatState.reactionResult) return;

    // Consume Magic point
    character.value.subStatCurrent = Math.max(0, character.value.subStatCurrent - 1);

    let roll = combatState.reactionResult.roll;
    roll = Math.max(1, Math.min(6, roll + adjustment));

    let text = '';
    let actionType: 'hostile' | 'bribe' | 'flee' | 'neutral' | 'hospitable' | 'outnumbered_flee' | 'outnumbered_hostile' = 'hostile';

    if (roll === 1) {
      text = '敵対的：クリーチャーは激しい敵意を示し、即座に襲いかかってきました！(敵先制攻撃)';
      actionType = 'hostile';
    } else if (roll === 2) {
      combatState.isBribeAllowed = true;
      text = 'ワイロ：金貨を要求されました。金貨5枚を支払えば戦闘を回避できます。';
      actionType = 'bribe';
    } else if (roll === 3) {
      const partySize = 1 + followers.value.length;
      const enemySize = combatState.enemies.reduce((sum: number, e: any) => sum + e.count, 0);
      if (partySize > enemySize) {
        text = '劣勢のため逃走：味方の数が敵より多いため、敵は逃げ出しました！';
        actionType = 'outnumbered_flee';
      } else {
        text = '数で劣っていないため、敵は強気になり襲いかかってきました！';
        actionType = 'outnumbered_hostile';
      }
    } else if (roll === 4) {
      text = '逃走：敵は怯えて逃げ出しました！勝利と同様に宝物を手に入れられます。';
      actionType = 'flee';
    } else if (roll === 5) {
      text = '中立：敵は攻撃してきません。エリアを自由に横切って立ち去ることができます。';
      actionType = 'neutral';
    } else if (roll === 6) {
      text = '歓待：食事と休息を提供してくれました！全員の生命力が1点回復し、敵は立ち去ります。';
      actionType = 'hospitable';
    }

    addLog(`🔮 魔法【友情】を発動！ 出目を ${adjustment > 0 ? '+' : ''}${adjustment} して【 ${roll} 】に変更しました。(魔術点残り: ${character.value.subStatCurrent})`, 'success');
    addLog(`反応再評価: ${text}`, 'info');

    combatState.reactionResult = {
      roll,
      text,
      actionType
    };
  }

  async function confirmReactionResult() {
    if (!combatState.reactionResult) return;
    const { actionType, roll } = combatState.reactionResult;

    combatState.reactionResult = null;

    if (actionType === 'hostile' || actionType === 'outnumbered_hostile') {
      const hasPreemptiveEnemy = combatState.enemies.some((e: any) => e.tags?.includes('preemptive'));
      const isSurprise = roll === 1 || hasPreemptiveEnemy;
      if (isSurprise) {
        if (hasPreemptiveEnemy) {
          addLog('⚡ 敵の【先制攻撃】特性が発動しました！', 'error');
        }
        if (combatState.hasQuickStrikeActive) {
          addLog('【速撃】の効果により、クリーチャーの先制攻撃を防ぎました！(プレイヤー先制)', 'success');
        } else {
          await executeEnemyAttacks();
        }
      }
    } else if (actionType === 'flee' || actionType === 'outnumbered_flee') {
      endCombat(true);
    } else if (actionType === 'neutral') {
      endCombatPeaceful('中立：敵は攻撃してきません。戦うことなく安全に立ち去ることができました。');
    } else if (actionType === 'hospitable') {
      character.value.lifeCurrent = Math.min(character.value.lifeMax, character.value.lifeCurrent + 1);
      followers.value.forEach(f => f.lifeCurrent = 1);
      endCombatPeaceful('歓待：クリーチャーは食事と休息を提供してくれました！全員の生命力が1点回復し、敵は立ち去りました。');
    }
  }

  // Pay bribe to escape combat
  function payBribe(useFriendship = false) {
    if (dungeonDepth.value >= totalRoomsToClear.value) {
      addLog('⚠️ ボス戦ではワイロを支払えません。', 'error');
      return;
    }

    let cost = 5;
    if (useFriendship) {
      character.value.subStatCurrent = Math.max(0, character.value.subStatCurrent - 1);
      cost = 1;
      addLog('🔮 魔法【友情】を発動！ 魔術点1を消費し、ワイロの額を金貨1枚に減額しました。', 'success');
    }

    // エール酒の大瓶による人間型クリーチャーへのワイロ減額 (最低1枚)
    const aleItem = character.value.items.find(it => it.name === 'エール酒の大瓶');
    const isHumanEvent = ['21', '22', '23', '24', '25', '26', '51', '53', '63', '64', '65'].includes(activeEvent.value?.d66Code || '') ||
      ['里人', '末裔', '冒険者', '行商人', 'ホブゴブリン', 'コビット', '突撃兵', 'ゴートマン', '狙撃手', '警備隊長', 'ウォー・ジェスター'].some(k => activeEvent.value?.title.includes(k) || activeEvent.value?.description.includes(k));

    if (aleItem && isHumanEvent && cost > 1) {
      const discount = Math.min(cost - 1, aleItem.charges || 1);
      if (discount > 0) {
        cost -= discount;
        if (aleItem.charges !== undefined) {
          aleItem.charges -= discount;
          if (aleItem.charges <= 0) {
            character.value.items = character.value.items.filter(it => it.id !== aleItem.id);
            addLog(`🍺 【エール酒の大瓶】を振る舞い、ワイロ額を金貨 ${cost} 枚に減額しました！ (エール酒を使い果たしました)`, 'success');
          } else {
            addLog(`🍺 【エール酒の大瓶】を ${discount} 回分振る舞い、ワイロ額を金貨 ${cost} 枚に減額しました！ (残り: ${aleItem.charges}回分)`, 'success');
          }
        }
      }
    }

    // カチカチのチーズによる食料ポイントでのワイロ提供
    const cheeseItem = character.value.items.find(it => it.name === 'カチカチになったチーズ');
    if (cheeseItem && character.value.gold < cost && (cheeseItem.charges || 0) >= cost) {
      cheeseItem.charges = (cheeseItem.charges || 0) - cost;
      if (cheeseItem.charges <= 0) {
        character.value.items = character.value.items.filter(it => it.id !== cheeseItem.id);
        addLog(`🧀 【カチカチになったチーズ】をワイロとして差し出しました！ (チーズを使い果たしました)`, 'success');
      } else {
        addLog(`🧀 【カチカチになったチーズ】をワイロとして ${cost} pt分差し出しました！ (残り: ${cheeseItem.charges}pt)`, 'success');
      }
      combatState.reactionResult = null;
      endCombatPeaceful(`ワイロ：カチカチのチーズを差し出し、安全に見逃してもらいました。`);
      return;
    }

    if (character.value.gold < cost) {
      addLog('金貨が足りないため、ワイロを支払えません！', 'error');
      return;
    }
    character.value.gold -= cost;
    addLog(`金貨 ${cost} 枚のワイロを支払い、安全に離脱しました。`, 'success');
    combatState.reactionResult = null;
    endCombatPeaceful(`ワイロ：金貨${cost}枚のワイロを支払い、穏便に道を通して（見逃して）もらいました。`);
  }

  // Refuse bribe and fight (Enemy attacks first)
  async function refuseBribeAndFight() {
    combatState.reactionResult = null;
    addLog('ワイロの支払いを拒否しました。敵は敵対的になり、襲いかかってきました！(敵先制攻撃)', 'error');
    if (combatState.hasQuickStrikeActive) {
      addLog('【速撃】の効果により、クリーチャーの先制攻撃を防ぎました！(プレイヤー先制)', 'success');
    } else {
      await executeEnemyAttacks();
    }
  }

  return {
    checkEnemyRetreat,
    rollReactionCheck,
    applyFriendshipReaction,
    confirmReactionResult,
    payBribe,
    refuseBribeAndFight
  };
}
