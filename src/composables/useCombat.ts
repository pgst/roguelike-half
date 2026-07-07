import { useGameState } from './useGameState';
import type { Enemy, GeneralItem } from '../types';

export function useCombat() {
  const {
    character,
    followers,
    activeEvent,
    combatState,
    rollD6,
    addLog,
    currentScreen,
    dungeonDepth,
    totalRoomsToClear,
    handleDeath,
    clearDiceTray,
    carriesLantern,
    playerActiveStatusEffectRules,
    pyramidRunCount,
    restorePyramidBossSnapshot,
    castCreateWeaponSpell,
    activeScenario
  } = useGameState();

  // Helper: check if enemy group is Undead, Golem, etc.
  function hasTag(enemy: Enemy, tag: string): boolean {
    return enemy.tags.includes(tag as any);
  }

  function calculateFollowerHit(follower: any, target: Enemy, roll: number, baseModifier: number) {
    let modifier = baseModifier;
    
    // Heracles modifier for followers
    if (target.name === 'ヘラクレオス像' || target.name === '至高のヘラクレオス') {
      if (follower.weaponAttribute === 'slash') {
        modifier -= 2;
        addLog(`🤖 ヘラクレオス像に対する ${follower.name} の【斬撃】ペナルティ -2！`, 'error');
      }
      if (target.name === '至高のヘラクレオス' && follower.weaponAttribute === 'strike') {
        modifier += 1;
        addLog(`🤖 至高のヘラクレオスに対する ${follower.name} の【打撃】ボーナス +1！`, 'success');
      }
    }
    
    // Ant-man acid spit penalty for followers
    if ((combatState as any).followerAccuracyModifiers && (combatState as any).followerAccuracyModifiers[follower.name]) {
      const penalty = (combatState as any).followerAccuracyModifiers[follower.name];
      modifier += penalty;
      addLog(`🤢 ギ酸の唾による ${follower.name} の視界不良ペナルティ ${penalty}！`, 'error');
    }

    const total = roll === 6 ? 99 : roll === 1 ? -99 : roll + follower.skill + modifier;
    let hit = roll === 6 || (roll !== 1 && total >= target.level);
    
    // Shireen future sight check
    if (target.name === '異端者シーリーン') {
      const isCritical = roll === 6;
      const canHit = isCritical || (combatState as any).shireenClueSpent;
      if (!canHit && hit) {
        hit = false;
        addLog(`🔮 シーリーンは未来を垣間見て ${follower.name} の攻撃を回避した！`, 'error');
      }
    }
    
    return { hit, total };
  }

  // Check if enemies should retreat (half health or count, rule 38)
  function checkEnemyRetreat() {
    if (combatState.isOver) return;
    if (combatState.enemies.length === 0) return;
    if (!activeEvent.value) return;
    
    // Check if the battle event is "Fight to Death" (死ぬまで戦う)
    const isFightToDeath = activeEvent.value.title.includes('決戦') || activeEvent.value.title.includes('魔将');
    if (isFightToDeath) return;

    // Calculate total starting health vs current health
    let totalStartLife = 0;
    let totalCurrentLife = 0;
    
    // In our event table, we can calculate based on activeEvent enemies
    activeEvent.value.enemies?.forEach(e => {
      totalStartLife += e.lifeMax;
    });

    combatState.enemies.forEach(e => {
      totalCurrentLife += e.lifeCurrent;
    });

    if (totalCurrentLife <= totalStartLife / 2) {
      addLog('⚔️ 敵の生命力/人数が初期の半分以下になったため、敵は恐怖して【逃走】しました！', 'success');
      endCombat(true);
    }
  }

  // Combat reaction roll before fighting (Rule 35)
  async function rollReactionCheck() {
    if (dungeonDepth.value >= totalRoomsToClear.value) {
      addLog('⚠️ ボス戦では反応チェックを行えません。', 'error');
      return;
    }
    if (combatState.hasReactionChecked) return;
    combatState.hasReactionChecked = true;
    combatState.isBribeAllowed = false;

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
      const enemySize = combatState.enemies.reduce((sum, e) => sum + e.count, 0);
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
  }

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
      const enemySize = combatState.enemies.reduce((sum, e) => sum + e.count, 0);
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
    const { actionType } = combatState.reactionResult;

    // Clear reaction result to dismiss UI
    combatState.reactionResult = null;

    // Apply outcome effects
    if (actionType === 'hostile' || actionType === 'outnumbered_hostile') {
      if (combatState.hasQuickStrikeActive) {
        addLog('【速撃】の効果により、クリーチャーの先制攻撃を防ぎました！(プレイヤー先制)', 'success');
      } else {
        await executeEnemyAttacks();
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

  // Escaping combat manually (Rule 42)
  async function escapeCombat() {
    if (combatState.isOver) return;
    if (combatState.enemies.length === 0) return;

    // 最もレベルの高い敵のレベルを目標値にする
    const targetLevel = Math.max(...combatState.enemies.map(e => e.level));

    addLog(`🏃 戦闘からの【逃走】を試みます！逃亡判定ロール... (目標値: ${targetLevel})`, 'info');

    const roll = await rollD6(true);
    const skill = character.value.skillCurrent;
    let modifier = 0;
    if (!carriesLantern.value) {
      modifier -= 2;
      addLog('暗闇のため逃亡判定に -2 のペナルティ！', 'error');
    }

    const total = roll === 6 ? 99 : roll === 1 ? -99 : roll + skill + modifier;
    const success = roll === 6 || (roll !== 1 && total >= targetLevel);

    if (success) {
      combatState.isOver = true;
      combatState.resultType = 'escaped';
      (combatState as any).activeAttacks = [];
      addLog(`🏃 逃亡に成功しました！「結果を承認」して1つ前の部屋に戻ってください。(ロール計: ${roll === 6 ? 'クリティカル' : total} >= ${targetLevel})`, 'success');
    } else {
      // Damage hero and continue combat
      character.value.lifeCurrent = Math.max(0, character.value.lifeCurrent - 1);
      addLog(`💥 逃亡失敗！敵に回り込まれてダメージを被りました。戦闘が続行されます。(ロール計: ${roll === 1 ? 'ファンブル' : total} < ${targetLevel})`, 'error');

      if (character.value.lifeCurrent <= 0) {
        handleDeath();
        return;
      }

      // 逃亡失敗したため、敵の手番を実行する
      await executeEnemyAttacks();
    }
  }

  // Player attacks an enemy in close combat (Rule 36)
  async function playerAttack(enemyId: string, isAllOut = false) {
    if (combatState.isOver) return;
    const enemyIndex = combatState.enemies.findIndex(e => e.id === enemyId);
    if (enemyIndex === -1) return;
    const enemy = combatState.enemies[enemyIndex];

    if (combatState.round === 0) {
      combatState.hasRangedFired = true;
      combatState.playerHasFiredRanged = true;
      addLog('第0ラウンドの射撃攻撃が完了しました。', 'info');
    }

    let isPrevented = false;
    playerActiveStatusEffectRules.value.forEach(rule => {
      if (rule.preventsAttack) {
        addLog(`⚠️ 状態異常により攻撃行動を行うことができません！ (理由: ${rule.description})`, 'error');
        isPrevented = true;
      }
    });
    if (isPrevented) return;

    addLog(`⚔️ ${enemy.name} への攻撃ロール！`, 'combat');
    
    // Choose stat
    let attackStat = character.value.skillCurrent;
    let isStrengthAttack = false;
    let isDexterityAttack = false;

    if (isAllOut) {
      if (character.value.subStatType === 'strength' && character.value.subStatCurrent > 0) {
        attackStat = character.value.subStatCurrent;
        isStrengthAttack = true;
        addLog('筋力点を使用した【全力攻撃】を発動！', 'success');
      } else if (character.value.subStatType === 'dexterity' && character.value.subStatCurrent > 0) {
        attackStat = character.value.subStatCurrent;
        isDexterityAttack = true;
        addLog('器用点を使用した【全力射撃】を発動！', 'success');
      } else {
        addLog('全力攻撃/全力射撃を発動できません！(能力値が不足しています)', 'error');
        return;
      }
    }

    const roll = await rollD6(true);
    let modifier = 0;

    // Chronovals wind attack penalty modifier
    if ((combatState as any).chronovalsWindPenalty) {
      modifier -= 1;
      (combatState as any).chronovalsWindPenalty = false;
      addLog('🌪️ 斬撃風による体勢崩れペナルティ -1！', 'error');
    }

    // Heracles modifiers
    if (enemy.name === 'ヘラクレオス像' || enemy.name === '至高のヘラクレオス') {
      if (character.value.equippedWeapon?.attribute === 'slash') {
        modifier -= 2;
        addLog('🤖 ヘラクレオス像に対する【斬撃】武器ペナルティ -2！', 'error');
      }
      if (enemy.name === '至高のヘラクレオス' && character.value.equippedWeapon?.attribute === 'strike') {
        modifier += 1;
        addLog('🤖 至高のヘラクレオスに対する【打撃】武器ボーナス +1！', 'success');
      }
    }

    // Shireen confusion berserk modifier
    if ((combatState as any).isBerserk) {
      modifier += 2;
      addLog('🌀 狂気効果：半狂乱による攻撃ボーナス +2！', 'success');
    }

    // Shireen evil eye modifier
    if ((combatState as any).isCharmed) {
      modifier -= 2;
      addLog('👁️ 邪視による攻撃ペナルティ -2！', 'error');
    }

    // Ant-man acid spit penalty
    if ((combatState as any).antSpitPenalty) {
      modifier -= 1;
      addLog('🤢 ギ酸の唾による視界不良ペナルティ -1！', 'error');
    }

    // Custom Scenario Weapons modifier
    if (character.value.equippedWeapon?.name === '悪魔殺しの剣' && enemy.tags.includes('demon')) {
      modifier += 1;
      addLog('⚔️ 悪魔殺しの剣の特効ボーナス：攻撃ロール +1！', 'success');
    }
    if (character.value.equippedWeapon?.name === 'シルバーダガー' && (enemy.tags.includes('demon') || enemy.tags.includes('undead'))) {
      modifier += 1;
      addLog('⚔️ シルバーダガーの特効ボーナス：攻撃ロール +1！', 'success');
    }

    // Lantern penalty
    if (!carriesLantern.value) {
      modifier -= 2;
      addLog('暗闇での戦闘により攻撃判定に -2 のペナルティ！', 'error');
    }

    // Apply status effect modifiers
    playerActiveStatusEffectRules.value.forEach(rule => {
      if (rule.modAttack) {
        modifier += rule.modAttack;
        addLog(`状態異常ペナルティにより攻撃判定に ${rule.modAttack} の修正が入ります。`, 'error');
      }
      if (rule.modSkill) {
        modifier += rule.modSkill;
        addLog(`状態異常ペナルティにより攻撃判定に ${rule.modSkill} の修正が入ります。`, 'error');
      }
    });

    // Weapon modifiers
    if (character.value.equippedWeapon) {
      modifier += character.value.equippedWeapon.modAttack;
    } else {
      modifier -= 2; // Unarmed penalty (Rule 29)
      addLog('素手での攻撃によるペナルティ -2', 'error');
    }

    // Magic weapon first strike modifier (+1)
    if (character.value.equippedWeapon?.isMagic && combatState.round === 1) {
      modifier += 1;
      addLog('魔法の武器の初撃ボーナス +1！', 'success');
    }

    const total = roll === 6 ? 99 : roll === 1 ? -99 : roll + attackStat + modifier;
    let hit = roll === 6 || (roll !== 1 && total >= enemy.level);

    if (enemy.name === '異端者シーリーン') {
      const isMagicWeapon = character.value.equippedWeapon?.isMagic;
      const isCritical = roll === 6;
      const canHit = isMagicWeapon || isCritical || (combatState as any).shireenClueSpent;
      if (!canHit && hit) {
        hit = false;
        addLog('🔮 シーリーンは未来を垣間見てあなたの通常攻撃を軽々と回避した！', 'error');
      }
    }

    // --- CUSTOM LOGIC: Ancient Dragon's Rib-Sword Fumble Check ---
    if (roll === 1 && character.value.equippedWeapon?.name === '古竜の肋骨剣') {
      const weapon = character.value.equippedWeapon;
      weapon.fumblesCount = (weapon.fumblesCount || 0) + 1;
      addLog(`⚠️ 古竜の肋骨剣に負荷がかかりました！ (通算ファンブル回数: ${weapon.fumblesCount}/5)`, 'error');
      if (weapon.fumblesCount >= 5) {
        addLog('💀 古竜の肋骨剣は激しい負荷に耐えきれず、粉々に砕け散りました！', 'error');
        const idx = character.value.weapons.findIndex(w => w.name === '古竜の肋骨剣');
        if (idx !== -1) {
          character.value.weapons.splice(idx, 1);
        }
        character.value.equippedWeapon = null;
      }
    }
    // -------------------------------------------------------------

    if (isStrengthAttack) {
      character.value.subStatCurrent--;
      addLog(`全力攻撃により、筋力点を1点消費。(残り: ${character.value.subStatCurrent})`, 'info');
    }
    if (isDexterityAttack) {
      character.value.subStatCurrent--;
      addLog(`全力射撃により、器用点を1点消費。(残り: ${character.value.subStatCurrent})`, 'info');
    }

    if (hit) {
      let damage = 1;

      // Custom Scenario Weapons damage bonus
      if (character.value.equippedWeapon?.name === '悪魔殺しの剣' && enemy.tags.includes('demon')) {
        damage += 1;
        addLog('⚔️ 悪魔殺しの剣の特効ボーナス：ダメージ +1！', 'success');
      }
      if (character.value.equippedWeapon?.name === 'シルバーダガー' && (enemy.tags.includes('demon') || enemy.tags.includes('undead'))) {
        damage += 1;
        addLog('⚔️ シルバーダガーの特効ボーナス：ダメージ +1！', 'success');
      }

      // Ranged combat special arrows damage bonus and consumption
      if (combatState.round === 0 && character.value.equippedWeapon?.type === 'ranged') {
        const silverArrow = character.value.items.find(i => i.name === '白銀の矢');
        const lavaArrow = character.value.items.find(i => i.name === '溶岩の矢');

        const consumeArrowLocal = (arrowItem: any) => {
          if (arrowItem.charges !== undefined && arrowItem.charges > 0) {
            arrowItem.charges--;
            if (arrowItem.charges <= 0) {
              character.value.items = character.value.items.filter(i => i.id !== arrowItem.id);
              addLog(`🏹 『${arrowItem.name}』を使い果たしました。`, 'info');
            } else {
              addLog(`🏹 『${arrowItem.name}』を1本消費しました。(残り: ${arrowItem.charges}本)`, 'info');
            }
          } else {
            character.value.items = character.value.items.filter(i => i.id !== arrowItem.id);
            addLog(`🏹 『${arrowItem.name}』を消費しました。`, 'info');
          }
        };

        if (enemy.tags.includes('demon') || enemy.tags.includes('undead')) {
          if (silverArrow) {
            consumeArrowLocal(silverArrow);
            damage += 1;
            addLog('🏹 白銀の矢を放ち、悪魔/アンデッドの肉体を浄化した！ (追加ダメージ +1)', 'success');
          } else if (lavaArrow) {
            consumeArrowLocal(lavaArrow);
            damage += 1;
            addLog('🏹 溶岩の矢を放ち、熱風が敵を包み込んだ！ (追加ダメージ +1)', 'success');
          }
        } else {
          if (lavaArrow) {
            consumeArrowLocal(lavaArrow);
            damage += 1;
            addLog('🏹 溶岩の矢を放ち、熱風が敵を包み込んだ！ (追加ダメージ +1)', 'success');
          } else if (silverArrow) {
            consumeArrowLocal(silverArrow);
            addLog('🏹 白銀の矢を放った。(通常ダメージ)', 'info');
          }
        }
      }

      enemy.lifeCurrent = Math.max(0, enemy.lifeCurrent - damage);
      addLog(`🎯 命中！ ${enemy.name} に ${damage} 点のダメージを与えた！ (ロール計: ${roll === 6 ? 'クリティカル' : total} >= ${enemy.level})`, 'success');
      
      // Check if enemy died (Move before critical double attack)
      if (enemy.lifeCurrent <= 0) {
        addLog(`💀 ${enemy.name} を撃破しました！`, 'success');
        combatState.enemies.splice(enemyIndex, 1);
      }

      // --- CUSTOM LOGIC: Ancient Dragon's Rib-Sword Shockwave ---
      if (roll === 6 && character.value.equippedWeapon?.name === '古竜の肋骨剣' && enemy.tags.includes('weak')) {
        const addKillCount = Math.floor(Math.random() * 3) + 1;
        addLog(`✨ 古竜の肋骨剣の衝撃波が発生！ 1d3体をさらに撃破します (ロール: ${addKillCount}体)`, 'success');
        
        let killed = 0;
        for (let i = combatState.enemies.length - 1; i >= 0; i--) {
          if (killed >= addKillCount) break;
          const targetEnemy = combatState.enemies[i];
          if (targetEnemy.tags.includes('weak')) {
            addLog(`💥 衝撃波の波動が ${targetEnemy.name} を切り裂き、即座に撃破した！`, 'success');
            combatState.enemies.splice(i, 1);
            killed++;
          }
        }
      }
      // ----------------------------------------------------------

      if (combatState.enemies.length === 0) {
        endCombat(true);
        return;
      }

      // Critical double attack rule (Rule 8)
      if (roll === 6) {
        if (combatState.round === 0) {
          combatState.hasRangedFired = false;
        }
        addLog('✨ クリティカル成功！ 即座にもう一度攻撃を行えます！', 'success');
        return; 
      }
    } else {
      addLog(`💨 ミス！ 攻撃が届かなかった。(ロール計: ${roll === 1 ? 'ファンブル' : total} < ${enemy.level})`, 'error');
    }

    // Trigger follower attacks
    await executeFollowerAttacks();

    // Check retreats
    checkEnemyRetreat();

    if (combatState.enemies.length === 0) {
      endCombat(true);
      return;
    }

    // Enemy turn response
    await executeEnemyAttacks();
  }

  // Follower combatant attacks (Rule 33)
  async function executeFollowerAttacks() {
    if (combatState.isOver) return;
    const combatants = followers.value.filter(f => {
      const isAlive = f.isCombatant && f.lifeCurrent > 0;
      const isParalyzedOrPetrified = f.statusEffects && (f.statusEffects.includes('麻痺') || f.statusEffects.includes('石化'));
      return isAlive && !isParalyzedOrPetrified;
    });
    for (const follower of combatants) {
      if (combatState.enemies.length === 0) break;
      const target = combatState.enemies[0]; // Auto-target first enemy
      


      // Archer specific rules (Rule 271)
      if (follower.type === 'archer') {
        if (combatState.round === 0) {
          addLog(`🏹 従者の弓兵 ${follower.name} が弓矢で射撃攻撃を行います！ (目標: ${target.name})`, 'combat');
          combatState.archerHasFiredRanged = true;
          const roll = await rollD6(true);
          let modifier = 1; // Ranged bonus
          if (!carriesLantern.value) {
            modifier -= 2;
            addLog('暗闇のため従者の攻撃判定に -2 のペナルティ！', 'error');
          }
          const { hit, total } = calculateFollowerHit(follower, target, roll, modifier);
          if (hit) {
            target.lifeCurrent = Math.max(0, target.lifeCurrent - 1);
            addLog(`🎯 従者弓兵の射撃が命中！ ${target.name} に1点のダメージ。(ロール計: ${roll === 6 ? 'クリティカル' : total})`, 'success');
            if (target.lifeCurrent <= 0) {
              addLog(`💀 ${target.name} は撃破されました。`, 'success');
              combatState.enemies.shift();
            }
          } else {
            addLog(`💨 従者弓兵の射撃は外れた。(ロール計: ${roll === 1 ? 'ファンブル' : total})`, 'info');
          }
        } else if (combatState.round === 1 && combatState.archerHasFiredRanged) {
          addLog(`⚔️ 従者の弓兵 ${follower.name} は、接近戦用武器への持ち替え中のため、このラウンドは攻撃できません。`, 'info');
        } else {
          addLog(`🛡️ 従者の弓兵 ${follower.name} が接近戦用の軽い武器で攻撃します！ (目標: ${target.name})`, 'combat');
          const roll = await rollD6(true);
          let modifier = -1; // Light weapon penalty
          if (!carriesLantern.value) {
            modifier -= 2;
            addLog('暗闇のため従者の攻撃判定に -2 のペナルティ！', 'error');
          }
          const { hit, total } = calculateFollowerHit(follower, target, roll, modifier);
          if (hit) {
            target.lifeCurrent = Math.max(0, target.lifeCurrent - 1);
            addLog(`🎯 従者の攻撃が命中！ ${target.name} に1点のダメージ。(ロール計: ${roll === 6 ? 'クリティカル' : total})`, 'success');
            if (target.lifeCurrent <= 0) {
              addLog(`💀 ${target.name} は撃破されました。`, 'success');
              combatState.enemies.shift();
            }
          } else {
            addLog(`💨 従者の攻撃は外れた。(ロール計: ${roll === 1 ? 'ファンブル' : total})`, 'info');
          }
        }
        continue;
      }

      // 遠距離戦ラウンド（第0ラウンド）では、弓兵および魔術師以外の近接従者は攻撃不可
      if (combatState.round === 0) {
        continue;
      }

      addLog(`🛡️ 従者 ${follower.name} の援護攻撃！ (目標: ${target.name})`, 'combat');
      const roll = await rollD6(true);
      let modifier = 0;

      // Mage light weapon penalty (-1)
      if (follower.type === 'mage') {
        modifier -= 1;
      }
      if (!carriesLantern.value) {
        modifier -= 2;
        addLog('暗闇のため従者の攻撃判定に -2 のペナルティ！', 'error');
      }

      const { hit } = calculateFollowerHit(follower, target, roll, modifier);

      if (hit) {
        target.lifeCurrent = Math.max(0, target.lifeCurrent - 1);
        addLog(`🎯 従者の攻撃が命中！ ${target.name} に1ダメージ。`, 'success');
        if (target.lifeCurrent <= 0) {
          addLog(`💀 ${target.name} は崩れ落ちた。`, 'success');
          combatState.enemies.shift();
        }
      } else {
        addLog(`💨 従者の攻撃は外れた。`, 'info');
      }
    }
  }

  // Enemy Attacks Turn - distributes and asks player to assign
  async function executeEnemyAttacks() {
    if (combatState.isOver) return;
    combatState.round++;
    combatState.hasCoveredInRound = false;
    combatState.hasWeaponCreatedThisRound = false;
    addLog(`--- ラウンド ${combatState.round}: クリーチャーの反撃フェーズ ---`, 'info');

    // Gather all enemy attacks
    const attackQueue: { source: Enemy; id: string }[] = [];
    combatState.enemies.forEach(e => {
      if (e.name === '刻の悪魔クロノヴァルス') {
        // Chronovals has 2 attacks: 1 wind (鴉の黒翼), 1 Spacetime Fang (targets hero and follower, or hero twice)
        attackQueue.push({
          source: e,
          id: Math.random().toString(36).substring(2, 9),
          type: 'wind'
        } as any);
        
        const activeFollowers = followers.value.filter(f => f.lifeCurrent > 0);
        if (activeFollowers.length > 0) {
          const chosenFollower = activeFollowers[Math.floor(Math.random() * activeFollowers.length)];
          attackQueue.push({
            source: e,
            id: Math.random().toString(36).substring(2, 9),
            type: 'spacetime_fang_hero',
            targetName: '主人公'
          } as any);
          attackQueue.push({
            source: e,
            id: Math.random().toString(36).substring(2, 9),
            type: 'spacetime_fang_follower',
            targetName: `従者 ${chosenFollower.name}`,
            targetFollowerId: chosenFollower.id
          } as any);
        } else {
          attackQueue.push({
            source: e,
            id: Math.random().toString(36).substring(2, 9),
            type: 'spacetime_fang_hero',
            targetName: '主人公 (1回目)'
          } as any);
          attackQueue.push({
            source: e,
            id: Math.random().toString(36).substring(2, 9),
            type: 'spacetime_fang_hero_2',
            targetName: '主人公 (2回目)'
          } as any);
        }
      } else if (e.name === '異端者シーリーン') {
        const round = combatState.round;
        if (round === 1) {
          attackQueue.push({ source: e, id: Math.random().toString(36).substring(2, 9), type: 'evil_eye' } as any);
        } else if (round === 2) {
          attackQueue.push({ source: e, id: Math.random().toString(36).substring(2, 9), type: 'slash_eye' } as any);
        } else if (round === 3) {
          attackQueue.push({ source: e, id: Math.random().toString(36).substring(2, 9), type: 'mad_eye' } as any);
        } else {
          for (let i = 0; i < 3; i++) {
            attackQueue.push({ source: e, id: Math.random().toString(36).substring(2, 9), type: 'normal' } as any);
          }
        }
      } else {
        const count = e.name === '砂漠ワニ' && (combatState as any).isCrocodileClamped
          ? 0
          : (e.tags.includes('weak') ? e.count : e.attackCount);
        for (let i = 0; i < count; i++) {
          attackQueue.push({ source: e, id: Math.random().toString(36).substring(2, 9), type: 'normal' } as any);
        }
      }
    });

    if (attackQueue.length === 0) return;

    addLog(`敵の総攻撃回数: ${attackQueue.length} 回。可能な限り均等に防御キャラクターを割り振ってください。`, 'error');

    // Auto-resolve: we can let players choose the defender for each attack one by one,
    // or simulate it by asking player to click to defend.
    // For a smooth flow, we will let players execute the defense rolls sequentially!
    // We store the attackQueue in combatState and let player roll defense for each.
    (combatState as any).activeAttacks = attackQueue;
  }

  // Resolve one specific queued enemy attack against a defender (Hero or Follower)
  async function resolveDefense(attackId: string, defenderId: 'hero' | string, isAllOut = false, skipDeflect = false) {
    const queue = (combatState as any).activeAttacks || [];
    const idx = queue.findIndex((a: any) => a.id === attackId);
    if (idx === -1) return;
    const attack = queue[idx];
    const enemy = attack.source;

    let skill = 0;
    let defName = '主人公';
    let isHero = defenderId === 'hero';
    let isStrengthDef = false;

    if (isHero) {
      skill = character.value.skillCurrent;
      if (isAllOut && character.value.subStatType === 'strength' && character.value.subStatCurrent > 0) {
        skill = character.value.subStatCurrent;
        isStrengthDef = true;
        addLog('筋力点を使用した【全力防御】を発動！', 'success');
      }
    } else {
      const f = followers.value.find(fol => fol.id === defenderId);
      if (!f) return;
      skill = f.skill;
      defName = f.name;
    }

    let isPrevented = false;
    if (isHero) {
      if ((combatState as any).isStunned) {
        addLog('⚠️ 狂気効果によりスタン状態です！ 防御判定は自動失敗となります。', 'error');
        isPrevented = true;
      }
      playerActiveStatusEffectRules.value.forEach(rule => {
        if (rule.preventsDefense) {
          addLog(`⚠️ 状態異常により防御することができません！防御は自動失敗となります。 (理由: ${rule.description})`, 'error');
          isPrevented = true;
        }
      });
    }

    let roll = 1;
    let modifier = 0;
    let total = -99;
    let defSuccess = false;

    // Spacetime fang target checks
    if (attack.type === 'spacetime_fang_hero' || attack.type === 'spacetime_fang_hero_2') {
      if (!isHero) {
        // Hero is targeted
        return;
      }
    }
    if (attack.type === 'spacetime_fang_follower') {
      if (defenderId !== attack.targetFollowerId) {
        // Specified follower is targeted
        return;
      }
    }

    if (!isPrevented) {
      const displayTitle = attack.targetName ? `${enemy.name} の〈時空牙〉 (対象: ${attack.targetName})` : enemy.name;
      addLog(`🛡️ ${defName} が ${displayTitle} の攻撃を防御します！ (目標値: ${enemy.level})`, 'combat');
      roll = await rollD6(true);
      if (isHero) {
        if (character.value.equippedArmor) modifier += character.value.equippedArmor.modDef;
        if (character.value.equippedShield) modifier += 1; // shield armor block
        // Protection Miracle buff
        modifier += combatState.buffs.defenseBonus;

        // Apply confusion berserk modifier
        if (attack.type === 'slash_eye' && (combatState as any).isBerserk) {
          modifier -= 2;
          (combatState as any).isBerserk = false; // consume berserk
          addLog('👁️ シーリーンの【斬視】に対し狂乱ペナルティ -2！', 'error');
        }

        // Apply confusion clinging modifier
        if ((combatState as any).isClinging) {
          modifier -= 2;
          addLog('🌀 狂気効果：しがみつかれているため防御判定に -2！', 'error');
        }
        
        // Apply status effect modifiers
        playerActiveStatusEffectRules.value.forEach(rule => {
          if (rule.modDefense) {
            modifier += rule.modDefense;
            addLog(`状態異常ペナルティにより防御判定に ${rule.modDefense} の修正が入ります。`, 'error');
          }
          if (rule.modSkill) {
            modifier += rule.modSkill;
            addLog(`状態異常ペナルティにより防御判定に ${rule.modSkill} の修正が入ります。`, 'error');
          }
        });
      } else {
        const f = followers.value.find(fol => fol.id === defenderId);
        if (f && f.isCombatant) {
          modifier += combatState.buffs.defenseBonus;
        }
      }
      if (!carriesLantern.value) {
        modifier -= 2;
        addLog(`暗闇のため${defName}の防御判定に -2 のペナルティ！`, 'error');
      }
      total = roll === 6 ? 99 : roll === 1 ? -99 : roll + skill + modifier;
      defSuccess = roll === 6 || (roll !== 1 && total >= enemy.level);
    } else {
      addLog(`💥 自動被弾: ${defName} は防御行動を取れず、攻撃が直撃しました。`, 'error');
    }

    if (isStrengthDef) {
      character.value.subStatCurrent--;
      addLog(`全力防御により、筋力点を1点消費。(残り: ${character.value.subStatCurrent})`, 'info');
    }

    if (defSuccess) {
      addLog(`🛡️ 防御成功！ ${defName} は無傷です。(ロール計: ${roll === 6 ? 'クリティカル' : total} >= ${enemy.level})`, 'success');
    } else {
      addLog(`💥 防御失敗！ ${defName} が被弾しました。(ロール計: ${roll === 1 ? 'ファンブル' : total} < ${enemy.level})`, 'error');

      // 【そらし】の奇跡チェック
      // 敵が飛び道具タイプであるか、または第0ラウンド（遠距離フェーズ）の攻撃であること
      const isRangedAttack = enemy.isRanged || combatState.round === 0;
      const hasDeflect = character.value.miracles.includes('そらし');
      const canDeflect = !skipDeflect && isRangedAttack && hasDeflect && character.value.subStatCurrent >= 1;

      if (canDeflect) {
        combatState.pendingDeflect = {
          attackId,
          defenderId,
          enemy
        };
        addLog(`🏹 飛び道具の攻撃が直撃！ 奇跡【そらし】を割り込んで行使できます。`, 'error');
        return;
      }

      // Check if War Doll ignores damage
      if (isHero && combatState.buffs.damageIgnoreCount > 0) {
        combatState.buffs.damageIgnoreCount--;
        addLog('✨ ウォー・ドールの身代わり魔術により、生命力へのダメージを無視しました！', 'success');
      } else {
        if (isHero) {
          character.value.lifeCurrent = Math.max(0, character.value.lifeCurrent - 1);
          addLog(`主人公の生命力残り: ${character.value.lifeCurrent}`, 'damage');
          if (character.value.lifeCurrent <= 0) {
            handleDeath();
            return;
          }
        } else {
          // Check if Strength cover skill can be triggered (Rule 22)
          const canCover = character.value.subStatType === 'strength' &&
                            character.value.subStatCurrent >= 1 &&
                            !combatState.hasCoveredInRound;

          if (canCover) {
            combatState.pendingCover = {
              attackId,
              followerId: defenderId,
              followerName: defName,
              enemyName: enemy.name,
              enemyLevel: enemy.level
            };
            addLog(`🛡️ 従者 ${defName} が被弾！ 主人公は「かばう」を使用できます。`, 'error');
            return;
          } else {
            // Followers have only 1 HP and immediately die (Rule 33)
            const fIdx = followers.value.findIndex(fol => fol.id === defenderId);
            if (fIdx !== -1) {
              addLog(`💀 従者 ${followers.value[fIdx].name} は致命傷を受け、息絶えました...`, 'error');
              followers.value.splice(fIdx, 1);
            }
          }
        }
      }
    }

    // Remove from queue
    queue.splice(idx, 1);
    (combatState as any).activeAttacks = queue;

    if (!defSuccess) {
      // 1. Crocodile Clamp Check
      if (roll === 1 && enemy.name === '砂漠ワニ') {
        (combatState as any).isCrocodileClamped = true;
        addLog('🐊 砂漠ワニが噛みついたまま離れなくなりました！ (毎ラウンド終了時にダメージ2を受けます)', 'error');
      }

      // 2. Chronovals Slash Wind Check
      if (enemy.name === '刻の悪魔クロノヴァルス' && attack.type === 'wind') {
        (combatState as any).chronovalsWindPenalty = true;
        addLog('🌪️ 斬撃風の直撃により体勢が崩れました！ 次回の攻撃ロールに -1 のペナルティが課されます。', 'error');

        addLog('🌪️ 壺の破損チェックを行います。1d6を振り、1（ファンブル）が出ると封印の壺が破損します。', 'info');
        const potRoll = await rollD6(true);
        if (potRoll === 1) {
          const hasRose = character.value.items.some(i => i.name === '水晶の薔薇');
          const hasAmulet = character.value.items.some(i => i.name === '天使の護符');
          const hasOfuda = character.value.items.some(i => i.name === '八百万のお札');

          let saved = false;
          if (hasAmulet && !hasRose) {
            addLog('👼 天使の護符の加護により、封印の壺は守られました！', 'success');
            saved = true;
          } else if (hasOfuda) {
            const ofudaIdx = character.value.items.findIndex(i => i.name === '八百万のお札');
            character.value.items.splice(ofudaIdx, 1);
            addLog('📜 八百万のお札が身代わりとなり消滅しました。封印の壺は無事です！', 'success');
            saved = true;
          }

          if (!saved) {
            const potIdx = character.value.items.findIndex(i => i.name === '封印の壺');
            if (potIdx !== -1) {
              character.value.items[potIdx].name = '割れた封印の壺';
              character.value.items[potIdx].description = '💀 粉々に割れてしまい、もう悪魔の封印には使えなくなってしまった粘土の壺。';
              addLog('💀 封印の壺が砕け散って「割れた封印の壺」になってしまいました！', 'error');
            }
          }
        }
      }

      // 3. Shireen Evil Eye Check
      if (attack.type === 'evil_eye') {
        const res = await rollSpellResistance(5);
        if (!res.success) {
          if (isHero) {
            (combatState as any).isCharmed = true;
            addLog('👁️ シーリーンの【邪視】により魅了されました！ 戦闘終了まで攻撃ロールに -2。', 'error');
          } else {
            const f = followers.value.find(fol => fol.id === defenderId);
            if (f) {
              f.lifeCurrent = 0;
              const charmedLevel = f.skill + 4;
              combatState.enemies.push({
                id: Math.random().toString(36).substring(2, 9),
                name: `魅了された${f.name}`,
                level: charmedLevel,
                lifeMax: 2,
                lifeCurrent: 2,
                attackCount: 1,
                tags: ["strong"],
                count: 1
              });
              addLog(`👁️ 従者 ${f.name} は【邪視】に魅了され、敵に寝返って襲いかかってきました！`, 'error');
            }
          }
        }
      }

      // 4. Shireen Slash Eye Check
      if (attack.type === 'slash_eye') {
        addLog('👁️ シーリーンの【斬視】が走りました！ 防具の損壊チェックを行います。', 'info');
        const res = await rollSpellResistance(5);
        if (!res.success) {
          if (character.value.equippedArmor) {
            addLog(`💀 装備していた防具 [${character.value.equippedArmor.name}] が破壊されました！`, 'error');
            const idx = character.value.armors.findIndex(a => a.name === character.value.equippedArmor!.name);
            if (idx !== -1) character.value.armors.splice(idx, 1);
            character.value.equippedArmor = null;
          } else if (character.value.equippedShield) {
            addLog(`💀 装備していた盾 [${character.value.equippedShield.name}] が破壊されました！`, 'error');
            const idx = character.value.shields.findIndex(s => s.name === character.value.equippedShield!.name);
            if (idx !== -1) character.value.shields.splice(idx, 1);
            character.value.equippedShield = null;
          }
        }
      }

      // 5. Shireen Mad Eye Check
      if (attack.type === 'mad_eye') {
        addLog('👁️ シーリーンの【狂視】により、精神が狂気に侵されます！', 'error');
        const res = await rollSpellResistance(5);
        if (!res.success) {
          const cRoll = Math.floor(Math.random() * 6) + 1;
          addLog(`🎲 狂気ロール: 出目 ${cRoll}`, 'info');
          if (cRoll === 1) {
            (combatState as any).isStunned = true;
            addLog('🌀 狂気効果：狂乱状態で行動不能になりました！ 次のラウンドは攻撃も防御もできません。', 'error');
          } else if (cRoll === 2) {
            character.value.hasActiveLantern = false;
            addLog('🌀 狂気効果：恐怖のあまりランタンの火を消してしまいました！ 周囲が暗闇に包まれます。', 'error');
          } else if (cRoll === 3) {
            if (character.value.items.length > 0) {
              const itemIdx = Math.floor(Math.random() * character.value.items.length);
              const lostItem = character.value.items[itemIdx];
              character.value.items.splice(itemIdx, 1);
              addLog(`🌀 狂気効果：狂乱して所持品を投げ捨ててしまいました！ [${lostItem.name}] を破壊。`, 'error');
            } else {
              addLog('🌀 狂気効果：所持品がないため、破壊効果は発生しませんでした。', 'info');
            }
          } else if (cRoll === 4) {
            (combatState as any).isClinging = true;
            addLog('🌀 狂気効果：狂乱して仲間に抱きつき、攻撃の邪魔をします！ 全員の判定ロールに -2。', 'error');
          } else if (cRoll === 5) {
            character.value.lifeCurrent = Math.max(0, character.value.lifeCurrent - 1);
            addLog(`🌀 狂気効果：自傷行為に走り、生命力に1点のダメージを受けました！ (生命力: ${character.value.lifeCurrent})`, 'error');
            if (character.value.lifeCurrent <= 0) {
              handleDeath();
              return;
            }
          } else if (cRoll === 6) {
            (combatState as any).isBerserk = true;
            addLog('🌀 狂気効果：半狂乱状態で興奮状態になり、攻撃ロールに +2 のボーナス！ しかし次の防御で強制的に斬視を受けます！', 'success');
          }
        }
      }
    }

    if (queue.length === 0) {
      await handleRoundEndEffects();
    }
  }

  // Cast follower spells manually (Rule 33)
  async function castFollowerSpell(followerId: string, targetEnemyId?: string) {
    if (combatState.isOver) return;
    const follower = followers.value.find(f => f.id === followerId);
    if (!follower || follower.type !== 'mage') return;
    if (follower.lifeCurrent <= 0) return;
    if (follower.statusEffects && (follower.statusEffects.includes('麻痺') || follower.statusEffects.includes('石化'))) {
      addLog(`⚠️ 従者の魔術師 ${follower.name} は動けないため、魔法を唱えられません！`, 'error');
      return;
    }
    if (follower.magicCurrent === undefined || follower.magicCurrent < 1) {
      addLog(`従者の魔術師 ${follower.name} の魔術点が足りません！`, 'error');
      return;
    }

    const spellName = (follower.magicList && follower.magicList.length > 0) ? follower.magicList[0] : '炎球';
    addLog(`🔮 従者の魔術師 ${follower.name} が呪文 [${spellName}] を唱えた！ (魔術点消費。残り: ${follower.magicCurrent - 1})`, 'success');
    
    follower.magicCurrent--;

    const enemies = combatState.enemies;

    if (spellName === '気絶') {
      const target = targetEnemyId ? enemies.find(e => e.id === targetEnemyId) : enemies[0];
      if (!target) {
        follower.magicCurrent++; // refund
        return;
      }
      if (!target.tags.includes('weak')) {
        addLog('【気絶】は「弱いクリーチャー」にしか効果がありません。', 'error');
        follower.magicCurrent++; // refund
        return;
      }
      if (hasTag(target, 'undead') || hasTag(target, 'golem') || hasTag(target, 'plant')) {
        addLog('アンデッドやゴーレム、植物などには【気絶】の効果はありません！', 'error');
        follower.magicCurrent++; // refund
        return;
      }

      const spellRoll = await rollD6(true);
      let modifier = 0;
      if (!carriesLantern.value) {
        modifier -= 2;
        addLog('暗闇のため従者の魔術判定に -2 のペナルティ！', 'error');
      }
      const spellTotal = spellRoll === 6 ? 99 : spellRoll === 1 ? -99 : spellRoll + 0 + modifier;
      const spellHit = spellRoll === 6 || (spellRoll !== 1 && spellTotal >= target.level);

      if (spellHit) {
        addLog(`💤 成功！ ${target.name} は深い眠りに落ちた。(撃破扱い)`, 'success');
        const idx = enemies.findIndex(e => e.id === target.id);
        enemies.splice(idx, 1);
        
        let excess = spellTotal - target.level;
        while (excess >= 2 && enemies.length > 0) {
          const nextWeak = enemies.find(e => e.tags.includes('weak') && !hasTag(e, 'undead') && !hasTag(e, 'golem') && !hasTag(e, 'plant'));
          if (nextWeak) {
            addLog(`💤 追加で ${nextWeak.name} も眠りに落ちた。`, 'success');
            const nIdx = enemies.findIndex(e => e.id === nextWeak.id);
            enemies.splice(nIdx, 1);
            excess -= 2;
          } else {
            break;
          }
        }
      } else {
        addLog(`💨 呪文は抵抗された！`, 'error');
      }

    } else if (spellName === '氷槍') {
      const target = targetEnemyId ? enemies.find(e => e.id === targetEnemyId) : enemies[0];
      if (!target) {
        follower.magicCurrent++; // refund
        return;
      }

      const spellRoll = await rollD6(true);
      let modifier = 0;
      if (!carriesLantern.value) {
        modifier -= 2;
        addLog('暗闇のため従者の魔術判定に -2 のペナルティ！', 'error');
      }
      const spellTotal = spellRoll === 6 ? 99 : spellRoll === 1 ? -99 : spellRoll + 0 + modifier;
      const spellHit = spellRoll === 6 || (spellRoll !== 1 && spellTotal >= target.level);

      if (spellHit) {
        target.lifeCurrent = Math.max(0, target.lifeCurrent - 2);
        addLog(`❄️ 直撃！ ${target.name} に極大の2点ダメージ！`, 'success');
        if (target.lifeCurrent <= 0) {
          addLog(`💀 ${target.name} は砕け散った！`, 'success');
          const idx = enemies.findIndex(e => e.id === target.id);
          enemies.splice(idx, 1);
        }
      } else {
        addLog(`💨 氷槍は回避された。`, 'error');
      }

    } else if (spellName === '速撃') {
      combatState.hasQuickStrikeActive = true;
      addLog('【速撃】の効果により、戦闘の主導権を奪取します！', 'success');

    } else if (spellName === '炎球') {
      addLog('火炎球を放ちます！魔術判定ロール...', 'info');
      // Check narrow space
      let isNarrow = false;
      const spaceRoll = await rollD6();
      if (spaceRoll <= 3) {
        isNarrow = true;
        addLog('廊下のような【狭い場所】のため、炎球の威力が高まります！', 'success');
      } else {
        addLog('ホールのような【広い場所】のため、炎球の威力が拡散します。', 'info');
      }

      const spellRoll = await rollD6(true);
      let modifier = 0;
      if (!carriesLantern.value) {
        modifier -= 2;
        addLog('暗闇のため従者の魔術判定に -2 のペナルティ！', 'error');
      }
      const spellTotal = spellRoll === 6 ? 99 : spellRoll === 1 ? -99 : spellRoll + 0 + modifier;

      if (isNarrow) {
        let hits = 1;
        if (enemies.length > 0) {
          const firstEnemy = enemies[0];
          if (spellRoll === 6) {
            hits = 99;
          } else if (spellRoll !== 1 && spellTotal >= firstEnemy.level) {
            hits = 1 + (spellTotal - firstEnemy.level);
          } else {
            hits = 0;
          }
        } else {
          hits = 0;
        }

        if (hits > 0) {
          let hitCount = 0;
          for (let i = 0; i < enemies.length; i++) {
            if (hitCount >= hits) break;
            const e = enemies[i];
            e.lifeCurrent = Math.max(0, e.lifeCurrent - 1);
            addLog(`🔥 ${e.name} に炎球が炸裂！ 1点ダメージを与えた！`, 'success');
            hitCount++;
          }
        } else {
          addLog('💨 炎球は不発、または回避された！', 'error');
        }
      } else {
        if (enemies.length > 0) {
          const firstEnemy = enemies[0];
          let totalHits = 0;
          if (spellRoll === 6) {
            totalHits = 99;
          } else if (spellRoll !== 1 && spellTotal >= firstEnemy.level) {
            totalHits = Math.floor(spellTotal / firstEnemy.level);
          }
          
          if (totalHits > 0) {
            let hitCount = 0;
            for (let i = 0; i < enemies.length; i++) {
              if (hitCount >= totalHits) break;
              const e = enemies[i];
              e.lifeCurrent = Math.max(0, e.lifeCurrent - 1);
              addLog(`🔥 ${e.name} に炎球が直撃！ 1点ダメージ！`, 'success');
              hitCount++;
            }
          } else {
            addLog(`💨 炎球は ${firstEnemy.name} に回避された。(ロール計: ${spellRoll === 1 ? 'ファンブル' : spellTotal} < ${firstEnemy.level})`, 'info');
          }
        }
      }

      combatState.enemies = enemies.filter(e => {
        if (e.lifeCurrent <= 0) {
          addLog(`💀 ${e.name} は力尽きた。`, 'success');
          return false;
        }
        return true;
      });
    }

    if (combatState.enemies.length === 0) {
      endCombat(true);
    }
  }

  // Cast spells in Round 0 or close combat (Rule 19)
  async function castSpell(spellName: string, targetEnemyId?: string) {
    if (combatState.isOver) return;
    if (character.value.spells.length === 0) return;
    if (character.value.subStatCurrent < 1) {
      addLog('魔術点が足りないため、呪文を唱えられません！', 'error');
      return;
    }

    let isMagicPrevented = false;
    playerActiveStatusEffectRules.value.forEach(rule => {
      if (rule.preventsMagic) {
        addLog(`⚠️ 状態異常により魔法を唱えることができません！ (理由: ${rule.description})`, 'error');
        isMagicPrevented = true;
      }
    });
    if (isMagicPrevented) return;

    addLog(`✨ 呪文【${spellName}】を唱えます！`, 'success');
    
    // Cast consumes 1 mana
    character.value.subStatCurrent--;

    const enemies = combatState.enemies;

    if (spellName === '気絶') {
      // Target must be "weak"
      if (!targetEnemyId) return;
      const target = enemies.find(e => e.id === targetEnemyId);
      if (!target) return;

      if (!target.tags.includes('weak')) {
        addLog('【気絶】は「弱いクリーチャー」にしか効果がありません。', 'error');
        return;
      }
      
      if (hasTag(target, 'undead') || hasTag(target, 'golem') || hasTag(target, 'plant')) {
        addLog('アンデッドやゴーレム、植物などには【気絶】の効果はありません！', 'error');
        return;
      }

      addLog(`眠りの呪文を放ちます！魔術判定ロール...`, 'info');
      const roll = await rollD6(true);
      const val = character.value.skillCurrent; // Casts with skill or magic stat if using.
      let modifier = 0;
      if (!carriesLantern.value) {
        modifier -= 2;
        addLog('暗闇のため魔術判定に -2 のペナルティ！', 'error');
      }
      const total = roll === 6 ? 99 : roll === 1 ? -99 : roll + val + modifier;
      const success = roll === 6 || (roll !== 1 && total >= target.level);

      if (success) {
        addLog(`💤 成功！ ${target.name} は深い眠りに落ちた。(撃破扱い)`, 'success');
        const idx = enemies.findIndex(e => e.id === targetEnemyId);
        enemies.splice(idx, 1);

        // Sleep extra enemies if exceeded by multiples of 2
        let excess = total - target.level;
        while (excess >= 2 && enemies.length > 0) {
          const nextWeak = enemies.find(e => e.tags.includes('weak') && !hasTag(e, 'undead') && !hasTag(e, 'golem'));
          if (nextWeak) {
            addLog(`💤 追加で ${nextWeak.name} も眠りに落ちた。`, 'success');
            const nIdx = enemies.findIndex(e => e.id === nextWeak.id);
            enemies.splice(nIdx, 1);
            excess -= 2;
          } else {
            break;
          }
        }
      } else {
        addLog('💨 呪文は抵抗された！', 'error');
      }

    } else if (spellName === '炎球') {
      addLog('火炎球を放ちます！魔術判定ロール...', 'info');
      // Check narrow space
      let isNarrow = false;
      const spaceRoll = await rollD6();
      if (spaceRoll <= 3) {
        isNarrow = true;
        addLog('廊下のような【狭い場所】のため、炎球の威力が高まります！', 'success');
      } else {
        addLog('ホールのような【広い場所】のため、炎球の威力が拡散します。', 'info');
      }

      const roll = await rollD6(true);
      const val = character.value.skillCurrent;
      let modifier = 0;
      if (!carriesLantern.value) {
        modifier -= 2;
        addLog('暗闇のため魔術判定に -2 のペナルティ！', 'error');
      }
      const total = roll === 6 ? 99 : roll === 1 ? -99 : roll + val + modifier;

      if (isNarrow) {
        // Deals 1 damage to each enemy whose level is <= total
        // Exceeding by 1 lets you hit another enemy
        let hits = 1;
        enemies.forEach(e => {
          if (hits > 0 && total >= e.level) {
            e.lifeCurrent = Math.max(0, e.lifeCurrent - 1);
            addLog(`🔥 ${e.name} に炎球が炸裂！ 1点ダメージを与えた！`, 'success');
            hits--;
          }
        });
      } else {
        // Deals 1 damage on level multiples
        enemies.forEach(e => {
          if (total >= e.level) {
            e.lifeCurrent = Math.max(0, e.lifeCurrent - 1);
            addLog(`🔥 ${e.name} に炎球が直撃！ 1点ダメージ！`, 'success');
          }
        });
      }

      // Filter dead enemies
      combatState.enemies = enemies.filter(e => {
        if (e.lifeCurrent <= 0) {
          addLog(`💀 ${e.name} は焼き尽くされた。`, 'success');
          return false;
        }
        return true;
      });

    } else if (spellName === '氷槍') {
      if (!targetEnemyId) return;
      const target = enemies.find(e => e.id === targetEnemyId);
      if (!target) return;

      addLog(`氷の槍を放ちます！魔術判定ロール...`, 'info');
      const roll = await rollD6(true);
      const val = character.value.skillCurrent;
      let modifier = 0;
      if (!carriesLantern.value) {
        modifier -= 2;
        addLog('暗闇のため魔術判定に -2 のペナルティ！', 'error');
      }
      const total = roll === 6 ? 99 : roll === 1 ? -99 : roll + val + modifier;

      if (roll === 6 || (roll !== 1 && total >= target.level)) {
        target.lifeCurrent = Math.max(0, target.lifeCurrent - 2);
        addLog(`❄️ 直撃！ ${target.name} に極大の2点ダメージ！`, 'success');
        if (target.lifeCurrent <= 0) {
          addLog(`💀 ${target.name} は氷結して砕け散った！`, 'success');
          const idx = enemies.findIndex(e => e.id === targetEnemyId);
          enemies.splice(idx, 1);
        }
      } else {
        addLog('💨 氷槍は回避された。', 'error');
      }

    } else if (spellName === '速撃') {
      combatState.hasQuickStrikeActive = true;
      addLog('【速撃】の魔術効果により、戦闘の主導権を奪取します！', 'success');
      if (combatState.reactionResult) {
        combatState.reactionResult.text = `【速撃】を発動中！ 敵の先制攻撃を阻止し、こちらが先制（第0ラウンド）を行います。`;
      }
    }

    addLog(`現在の残り魔術点: ${character.value.subStatCurrent}`, 'info');
    checkEnemyRetreat();

    if (combatState.enemies.length === 0) {
      endCombat(true);
      return;
    }

    const isOffensive = ['気絶', '炎球', '氷槍'].includes(spellName);
    if (isOffensive) {
      if (combatState.round === 0) {
        combatState.hasRangedFired = true;
        addLog('第0ラウンドの魔術詠唱が完了しました。', 'info');
      } else {
        await executeFollowerAttacks();
        checkEnemyRetreat();
        if (combatState.enemies.length === 0) {
          endCombat(true);
          return;
        }
        await executeEnemyAttacks();
      }
    }
  }

  async function resolveCreateWeaponSpell(category: 'weapon' | 'armor' | 'shield', itemKey: string) {
    castCreateWeaponSpell(category, itemKey);
    if (combatState.active) {
      if (combatState.round === 0) {
        combatState.hasRangedFired = true;
        addLog('第0ラウンドの魔術詠唱が完了しました。', 'info');
      } else {
        await executeFollowerAttacks();
        checkEnemyRetreat();
        if (combatState.enemies.length === 0) {
          endCombat(true);
          return;
        }
        await executeEnemyAttacks();
      }
    }
  }

  // Cast miracles (Rule 20)
  async function castMiracle(miracleName: string, _targetEnemyId?: string) {
    if (combatState.isOver) return;
    if (character.value.miracles.length === 0) return;
    if (character.value.subStatCurrent < 1) {
      addLog('幸運点が足りないため、奇跡を発動できません！', 'error');
      return;
    }

    let isMagicPrevented = false;
    playerActiveStatusEffectRules.value.forEach(rule => {
      if (rule.preventsMagic) {
        addLog(`⚠️ 状態異常により奇跡を行使することができません！ (理由: ${rule.description})`, 'error');
        isMagicPrevented = true;
      }
    });
    if (isMagicPrevented) return;

    addLog(`✨ 奇跡【${miracleName}】を発動！`, 'success');
    character.value.subStatCurrent--;

    if (miracleName === '防衛') {
      combatState.buffs.defenseBonus += 1;
      addLog('🛡️ 天使の加護が味方全員を包み込みました！ 【防御ロール】に+1のボーナスを得ます。(戦闘終了まで持続)', 'success');

    } else if (miracleName === 'そらし') {
      addLog('【そらし】は敵の飛び道具を被弾した際にのみ、割り込んで発動できます。', 'error');
      character.value.subStatCurrent++; // 返還
      return;

    } else if (miracleName === '祝福') {
      let healed = false;
      if (character.value.statusEffects && character.value.statusEffects.length > 0) {
        const removed = character.value.statusEffects.shift();
        addLog(`✨ 祝福の光により、主人公の【${removed}】を治療しました！`, 'success');
        healed = true;
      } else {
        for (const f of followers.value) {
          if (f.statusEffects && f.statusEffects.length > 0) {
            const removed = f.statusEffects.shift();
            addLog(`✨ 祝福の光により、従者 ${f.name} の【${removed}】を治療しました！`, 'success');
            healed = true;
            break;
          }
        }
      }
      if (!healed) {
        addLog('味方に治療すべき状態異常（呪い・石化・麻痺）はありません。', 'info');
        character.value.subStatCurrent++; // 返還
        return;
      }

    } else if (miracleName === '聖洗脳') {
      if (combatState.enemies.length !== 1) {
        addLog('【聖洗脳】は敵が残り1体のときしか発動できません！', 'error');
        character.value.subStatCurrent++; // Refund
        return;
      }
      const target = combatState.enemies[0];
      if (!target.tags.includes('weak') || hasTag(target, 'undead')) {
        addLog('このクリーチャーは洗脳できません。', 'error');
        character.value.subStatCurrent++; // Refund
        return;
      }

      addLog(`洗脳の念を送ります！幸運判定ロール...`, 'info');
      const roll = await rollD6(true);
      const val = character.value.subStatCurrent; // 幸運点の現在値（修正点：skillCurrentから変更）
      let modifier = 0;
      if (!carriesLantern.value) {
        modifier -= 2;
        addLog('暗闇のため幸運判定に -2 のペナルティ！', 'error');
      }
      const total = roll === 6 ? 99 : roll === 1 ? -99 : roll + val + modifier;

      if (roll === 6 || (roll !== 1 && total >= target.level)) {
        addLog(`✨ 成功！ ${target.name} は改心し、【捕虜】の従者として同行することになりました！`, 'success');
        followers.value.push({
          id: Math.random().toString(36).substring(2, 9),
          name: `捕虜の${target.name}`,
          type: 'captive',
          isCombatant: false,
          skill: 0,
          lifeMax: 1,
          lifeCurrent: 1,
          weaponAttribute: 'strike',
          goldCost: 0,
          description: '聖洗脳した敵。戦わない従者。常に判定ロールは失敗するが、身代わりに使える。',
          statusEffects: [],
        });
        combatState.enemies = [];
        endCombat(true);
      } else {
        addLog('💨 奇跡は弾かれた！', 'error');
      }

    } else if (miracleName === '招天') {
      const hasUndead = combatState.enemies.some(e => hasTag(e, 'undead'));
      if (!hasUndead) {
        addLog('戦闘フィールドにアンデッドの敵が存在しないため、招天を発動できません。', 'error');
        character.value.subStatCurrent++; // Refund
        return;
      }

      combatState.pendingHolyArrow = 2;
      addLog('⚡ 光り輝く2本の聖なる矢があなたの周囲に出現しました！ 対象のアンデッドを選択して発射してください。', 'success');
    }

    addLog(`現在の残り幸運点: ${character.value.subStatCurrent}`, 'info');
    checkEnemyRetreat();

    if (combatState.enemies.length === 0) {
      endCombat(true);
      return;
    }

    const isActionMiracle = ['防衛', '聖洗脳'].includes(miracleName); // 招天は手動で対象選択して放つため、アクションの終了をトリガーさせない
    if (isActionMiracle) {
      if (combatState.round === 0) {
        combatState.hasRangedFired = true;
        addLog('第0ラウンドの奇跡発動が完了しました。', 'info');
      } else {
        await executeFollowerAttacks();
        checkEnemyRetreat();
        if (combatState.enemies.length === 0) {
          endCombat(true);
          return;
        }
        await executeEnemyAttacks();
      }
    }
  }

  // 奇跡【そらし】の割り込みをスキップ（見送り）してダメージを適用
  async function skipDeflect() {
    const pending = combatState.pendingDeflect;
    if (!pending) return;
    combatState.pendingDeflect = null;
    await resolveDefense(pending.attackId, pending.defenderId, false, true);
  }

  // 奇跡【そらし】を発動して飛び道具を無効化
  async function executeDeflect() {
    const pending = combatState.pendingDeflect;
    if (!pending) return;

    character.value.subStatCurrent--;
    addLog(`✨ 奇跡【そらし】を発動！ 飛び道具をそらし、ダメージを回避しました。(残り幸運点: ${character.value.subStatCurrent})`, 'success');
    combatState.pendingDeflect = null;

    // 攻撃キューから今回の攻撃を取り除く
    const queue = (combatState as any).activeAttacks || [];
    const idx = queue.findIndex((a: any) => a.id === pending.attackId);
    if (idx !== -1) {
      queue.splice(idx, 1);
    }

    checkEnemyRetreat();
    if (combatState.enemies.length === 0) {
      endCombat(true);
    }
  }

  // 奇跡【招天】の光の矢を1本放つ
  async function fireHolyArrow(targetEnemyId: string) {
    if (combatState.isOver) return;
    if (combatState.pendingHolyArrow <= 0) return;
    const target = combatState.enemies.find(e => e.id === targetEnemyId);
    if (!target) return;

    if (!hasTag(target, 'undead')) {
      addLog(`${target.name} はアンデッドではないため、聖なる矢の効果がありません。`, 'error');
      return;
    }

    combatState.pendingHolyArrow--;
    addLog(`⚡ ${target.name} に聖なる矢を放ちます！(残り矢数: ${combatState.pendingHolyArrow})`, 'combat');

    const roll = await rollD6(true);
    const val = character.value.subStatCurrent; // 幸運点の現在値
    let modifier = 0;
    if (!carriesLantern.value) {
      modifier -= 2;
      addLog('暗闇のため判定に -2 のペナルティ！', 'error');
    }
    const total = roll === 6 ? 99 : roll === 1 ? -99 : roll + val + modifier;
    const success = roll === 6 || (roll !== 1 && total >= target.level);

    if (success) {
      const isWeak = target.tags.includes('weak');
      if (isWeak) {
        target.lifeCurrent = 0;
        addLog(`💀 聖なる光が貫き、${target.name} は浄化され塵に還った！`, 'success');
      } else {
        target.lifeCurrent = Math.max(0, target.lifeCurrent - 1);
        addLog(`💥 直撃！ ${target.name} に1点の聖なるダメージを与えました。`, 'success');
      }
    } else {
      addLog('💨 矢は外れるか、邪悪な闇に弾かれた！', 'error');
    }

    if (roll === 6) {
      combatState.pendingHolyArrow++;
      addLog('✨ クリティカル！ 聖なる奇跡の矢が1本追加されました！', 'success');
    }

    // 敵の死亡をフィルタリング
    combatState.enemies = combatState.enemies.filter(e => e.lifeCurrent > 0);
    checkEnemyRetreat();

    if (combatState.enemies.length === 0) {
      combatState.pendingHolyArrow = 0;
      endCombat(true);
    }

    if (combatState.pendingHolyArrow === 0 && combatState.enemies.length > 0) {
      if (combatState.round === 0) {
        combatState.hasRangedFired = true;
        addLog('第0ラウンドの奇跡発動が完了しました。', 'info');
      } else {
        await executeFollowerAttacks();
        checkEnemyRetreat();
        if (combatState.enemies.length === 0) {
          endCombat(true);
          return;
        }
        await executeEnemyAttacks();
      }
    }
  }

  // End Combat and trigger treasure reward or escape
  function endCombat(isVictory: boolean, getLoot = true) {
    if (combatState.isOver) return;

    // Time-Eating Roar check at death
    if (isVictory && activeEvent.value?.d66Code === 'Final3' && !(combatState as any).roarCheckedThisCombat) {
      (combatState as any).pendingRoarCheck = 'death';
      addLog('😈 刻の悪魔クロノヴァルスは生命力が0になりましたが、その歪んだ肉体から最後の『時喰いの咆哮』を放ちました！', 'error');
      return;
    }

    (combatState as any).activeAttacks = [];
    combatState.isOver = true;

    if (isVictory) {
      combatState.resultType = 'victory';
      combatState.getLootAfterVictory = getLoot;
      addLog('⚔️ 戦闘勝利！ 迷宮の脅威を排除しました！結果を承認してください。', 'success');
    } else {
      combatState.resultType = 'escaped';
      addLog('🏃 戦闘から逃れました。結果を承認してください。', 'info');
    }
  }



  async function rollSpellResistance(target = 5) {
    const isMagic = character.value.subStatType === 'magic';
    const subStatVal = isMagic ? character.value.subStatCurrent : 0;
    const hasRose = character.value.items.some(i => i.name === '水晶の薔薇');
    const hasHelmet = character.value.equippedArmor?.name === '天使のヘルメット';
    
    let bonus = 0;
    if (activeEvent.value?.d66Code === 'Final3') {
      if (hasRose) bonus += 2;
      if (hasHelmet) bonus += 2;
    }
    
    addLog(`🔮 対魔法判定ロール開始 (目標値: ${target}, サブ魔力: +${subStatVal}, 特殊加算: +${bonus})`, 'info');
    const roll = await rollD6(true);
    const total = roll + subStatVal + bonus;
    
    if (roll === 1) {
      addLog(`🎲 ファンブル！ (出目: 1)`, 'error');
      return { success: false, fumble: true, roll, total };
    }
    
    if (total >= target) {
      addLog(`✨ 判定成功！ (ロール計: ${total} >= ${target})`, 'success');
      return { success: true, fumble: false, roll, total };
    } else {
      addLog(`😢 判定失敗... (ロール計: ${total} < ${target})`, 'error');
      return { success: false, fumble: false, roll, total };
    }
  }

  async function resolveChronovalsRoar() {
    const checkType = (combatState as any).pendingRoarCheck;
    if (!checkType) return;
    
    const res = await rollSpellResistance(5);
    if (!res.success) {
      const rewindAmount = res.fumble ? 2 : 1;
      (combatState as any).pendingRoarCheck = null;
      combatState.active = false;
      restorePyramidBossSnapshot(rewindAmount);
    } else {
      addLog(`🛡️ 悪魔の『時喰いの咆哮』を精神力で耐え抜いた！`, 'success');
      if (checkType === 'start') {
        (combatState as any).pendingRoarCheck = null;
      } else if (checkType === 'death') {
        (combatState as any).pendingRoarCheck = null;
        (combatState as any).roarCheckedThisCombat = true;
        
        const sealingPotIdx = character.value.items.findIndex(i => i.name === '封印の壺');
        if (sealingPotIdx !== -1) {
          character.value.items.splice(sealingPotIdx, 1);
          addLog(`🏺 封印の壺の古代文字が光り輝き、刻の悪魔クロノヴァルスを壺の中へ吸い込んで封印しました！`, 'success');
          (activeEvent.value as any).isResolved = true;
          (activeEvent.value as any).resolutionText = "🏺 刻の悪魔クロノヴァルスを封印の壺に封じ込め、ピラミッドのクリスタルの光は消え去りました。\n宿願は果たされ、ポロメイア王国とアルマシウダの双方が平和を分かち合う未来が訪れます！";
          endCombat(true, false);
        } else {
          addLog(`⚠️ 封印の壺を所持していない（または壊れている）ため、悪魔を完全に封印できませんでした。`, 'error');
          (activeEvent.value as any).isResolved = true;
          (activeEvent.value as any).resolutionText = "⚠️ 封印の壺が手元にないため、クロノヴァルスは時を置いて再び復活しました。これまでの冒険の時間は悪魔の力によってすべて奪われ、消失してしまいました...";
          endCombat(true, false);
        }
      }
    }
  }

  async function handleRoundEndEffects() {
    const hasIceMist = combatState.enemies.some(e => e.name === '氷霧の精霊');
    if (hasIceMist) {
      addLog('❄️ 氷霧の精霊の凍てつく霧が部屋全体に充満しています！ 全員防御判定ロールを行います。', 'error');
      const rollHero = await rollD6(true);
      if (rollHero < 3) {
        character.value.lifeCurrent = Math.max(0, character.value.lifeCurrent - 1);
        addLog(`😢 主人公は寒冷ダメージを受けました。(生命力: ${character.value.lifeCurrent})`, 'damage');
        if (character.value.lifeCurrent <= 0) {
          handleDeath();
          return;
        }
      } else {
        addLog('🛡️ 主人公は寒冷ダメージを防ぎました。', 'success');
      }
      const activeFollowers = followers.value.filter(f => f.lifeCurrent > 0);
      for (const f of activeFollowers) {
        const rollF = await rollD6(true);
        if (rollF < 3) {
          f.lifeCurrent = 0;
          addLog(`💀 従者 ${f.name} は凍死しました。`, 'error');
        } else {
          addLog(`🛡️ 従者 ${f.name} は寒冷ダメージを防ぎました。`, 'success');
        }
      }
    }

    if ((combatState as any).isCrocodileClamped) {
      addLog('🐊 砂漠ワニの噛みつき回転攻撃が発生！', 'error');
      character.value.lifeCurrent = Math.max(0, character.value.lifeCurrent - 2);
      addLog(`💥 主人公は噛みつき回転により 2 点のダメージを受けました。(生命力: ${character.value.lifeCurrent})`, 'damage');
      if (character.value.lifeCurrent <= 0) {
        handleDeath();
        return;
      }
    }
  }

  function endCombatPeaceful(text = '敵と争うことなく、穏便に交渉するか、敵の撤退に成功しました。') {
    if (combatState.isOver) return;
    (combatState as any).activeAttacks = [];
    combatState.isOver = true;
    combatState.resultType = 'peaceful';
    combatState.peacefulText = text;
    addLog('🕊️ 平和的に解決しました。結果を承認してください。', 'success');
  }

  // Treasure Table Roll (Rule 40)
  async function resolveLoot(): Promise<string> {
    addLog('💰 宝箱を開けるか、敵の遺品から戦利品（宝物表ロール）を獲得します！', 'info');
    const roll = await rollD6();
    let mod = 0;

    // Dexterity "Treasure Hunter" (+1)
    if (character.value.subStatType === 'dexterity' && character.value.subStatCurrent > 0) {
      const useDex = confirm('器用点【宝物の獲得】を発動して、出目を+1しますか？ (器用点1消費)');
      if (useDex) {
        character.value.subStatCurrent--;
        mod += 1;
        addLog('器用点【宝物の獲得】の効果により、宝物ロールの出目に +1', 'success');
      }
    }

    const total = Math.max(1, roll + mod);
    addLog(`宝物ロール決定: [ ${roll} ] + 補正 [ ${mod} ] = [ ${total} ]`, 'success');

    let summary = '';
    if (total <= 1) {
      character.value.gold += 1;
      summary = '金貨 1 枚';
      addLog('金貨1枚を獲得した。', 'success');
    } else if (total === 2) {
      const g = await rollD6();
      character.value.gold += g;
      summary = `金貨 ${g} 枚`;
      addLog(`金貨 ${g} 枚を獲得した！`, 'success');
    } else if (total === 3) {
      const g1 = await rollD6();
      const g2 = await rollD6();
      const sum = Math.max(5, g1 + g2);
      character.value.gold += sum;
      summary = `金貨 ${sum} 枚 (下限5枚)`;
      addLog(`金貨 ${sum} 枚を獲得した！ (下限5枚)`, 'success');
    } else if (total === 4) {
      // Accessory (value d6 * d6)
      const d1 = await rollD6();
      const d2 = await rollD6();
      const value = d1 * d2;
      const item: GeneralItem = {
        id: Math.random().toString(36).substring(2, 9),
        name: '魔除けのアクセサリー',
        type: 'accessory',
        goldCost: 0,
        value,
        description: `金貨 ${value} 枚の価値がある宝飾品。`,
      };
      character.value.items.push(item);
      summary = `魔除けのアクセサリー (価値: 金貨${value}枚)`;
      addLog(`美しい宝飾アクセサリーを獲得！ (売却価値: 金貨${value}枚)`, 'success');
    } else if (total === 5) {
      // Gem small (value d6 * 5, lower bound 15)
      const d = await rollD6();
      const value = Math.max(15, d * 5);
      const item: GeneralItem = {
        id: Math.random().toString(36).substring(2, 9),
        name: '宝石（小）',
        type: 'gem_small',
        goldCost: 0,
        value,
        description: `金貨 ${value} 枚の価値がある煌めく小宝石。`,
      };
      character.value.items.push(item);
      summary = `宝石（小） (価値: 金貨${value}枚)`;
      addLog(`煌めく宝石(小)を獲得！ (売却価値: 金貨${value}枚)`, 'success');
    } else if (total === 6) {
      // Gem large (value 2d6 * 5, lower bound 30)
      const d1 = await rollD6();
      const d2 = await rollD6();
      const value = Math.max(30, (d1 + d2) * 5);
      const item: GeneralItem = {
        id: Math.random().toString(36).substring(2, 9),
        name: '宝石（大）',
        type: 'gem_large',
        goldCost: 0,
        value,
        description: `金貨 ${value} 枚の価値がある巨大な宝石。`,
      };
      character.value.items.push(item);
      summary = `宝石（大） (価値: 金貨${value}枚)`;
      addLog(`まばゆい大宝石を獲得！ (売却価値: 金貨${value}枚)`, 'success');
    } else if (total >= 7) {
      // Magic Treasure Table!
      summary = await rollMagicTreasure();
    }

    combatState.lootText = summary;
    combatState.lootRolled = true;
    return summary;
  }

  // Magic Treasure Table (Rule 40)
  async function rollMagicTreasure(): Promise<string> {
    addLog('✨ レア！ 【魔法の宝物表】でダイスロールを行います！', 'success');
    const roll = await rollD6();
    let item: GeneralItem;
    let descText = '';

    if (roll === 1) {
      item = {
        id: Math.random().toString(36).substring(2, 9),
        name: '貫きの石弾 (5個)',
        type: 'holywater', // behaves like combat consumable
        goldCost: 15,
        value: 12,
        chargesCurrent: 5,
        chargesMax: 5,
        description: 'スリング用の魔法石弾。使用時に攻撃判定+2ボーナス。魔法武器属性。',
      };
      descText = '魔法の石弾『貫きの石弾 (5個)』';
      addLog('✨ 『貫きの石弾(5回分)』を獲得！ (攻撃時に+2ボーナス)', 'success');
    } else if (roll === 2) {
      item = {
        id: Math.random().toString(36).substring(2, 9),
        name: '安らぎのフルート',
        type: 'magic_flute',
        goldCost: 60,
        value: 60,
        chargesCurrent: 3,
        chargesMax: 3,
        description: '演奏すると【気絶】の魔術をノーコストで発動可能(3回まで)。魔術点所持者のみ使用可能。',
      };
      descText = '魔法の楽器『安らぎのフルート (3回分)』';
      addLog('✨ 『安らぎのフルート』を獲得！ (ノーコストで「気絶」を詠唱可能、3回制限)', 'success');
    } else if (roll === 3) {
      item = {
        id: Math.random().toString(36).substring(2, 9),
        name: '換石の杖',
        type: 'magic_staff',
        goldCost: 60,
        value: 60,
        chargesCurrent: 3,
        chargesMax: 3,
        description: '戦闘時、広い部屋の空間を狭い部屋に変える魔力壁を生成する(3回)。',
      };
      descText = '魔法の杖『換石の杖 (3回分)』';
      addLog('✨ 『換石の杖』を獲得！ (広い戦闘エリアを狭いエリアに変更可能、3回制限)', 'success');
    } else if (roll === 4) {
      item = {
        id: Math.random().toString(36).substring(2, 9),
        name: '看破の片眼鏡',
        type: 'magic_monocle',
        goldCost: 60,
        value: 60,
        chargesCurrent: 3,
        chargesMax: 6, // 1d6 charges (we will roll it)
        description: '探索・隠し部屋発見などの判定ロールに+1修正。',
      };
      const charges = await rollD6();
      item.chargesCurrent = charges;
      item.chargesMax = charges;
      descText = `魔法の眼鏡『看破の片眼鏡 (${charges}回分)』`;
      addLog(`✨ 『看破の片眼鏡』を獲得！ (${charges}回分、判定に+1修正)`, 'success');
    } else if (roll === 5) {
      item = {
        id: Math.random().toString(36).substring(2, 9),
        name: '魔法の大盾',
        type: 'magic_shield',
        goldCost: 60,
        value: 60,
        description: '戦う従者のための盾。装備中、従者は飛び道具攻撃に対して防御判定+1修正。',
      };
      descText = '従者用魔法防具『魔法の大盾』';
      addLog('✨ 従者専用 『魔法の大盾』を獲得！', 'success');
    } else {
      // War doll (Golem Follower)
      item = {
        id: Math.random().toString(36).substring(2, 9),
        name: 'ウォー・ドール (未起動)',
        type: 'magic_doll',
        goldCost: 60,
        value: 60,
        description: '魔法の人形。経験点1を消費して起動すると「戦う従者」として同行する。',
      };
      descText = '魔法の人形『ウォー・ドール (未起動)』';
      addLog('✨ 精巧な魔法の人形 『ウォー・ドール』を獲得！ (経験点1で起動可能)', 'success');
    }

    character.value.items.push(item);
    return descText;
  }

  // Activate War Doll follower using 1 EXP
  function activateWarDoll(itemId: string) {
    if (character.value.exp < 1) {
      addLog('経験点が足りないため、ウォー・ドールを起動できません！', 'error');
      return;
    }
    const idx = character.value.items.findIndex(i => i.id === itemId);
    if (idx === -1) return;
    
    // Check follower capacity
    if (followers.value.length >= character.value.followerCurrent) {
      addLog('従者枠がいっぱいです。', 'error');
      return;
    }

    character.value.exp--;
    character.value.items.splice(idx, 1);

    followers.value.push({
      id: Math.random().toString(36).substring(2, 9),
      name: 'ウォー・ドール',
      type: 'soldier', // treats as soldier for slot, but has Golem traits
      isCombatant: true,
      skill: 1,
      lifeMax: 1,
      lifeCurrent: 1,
      weaponAttribute: 'slash',
      goldCost: 0,
      description: '【ゴーレム】。接近戦2回攻撃。1冒険に1回だけダメージ無視。罠無効。',
    });

    addLog('✨ 経験点1を注ぎ込み、ウォー・ドールを起動しました！ 「戦う従者」としてパーティに加入。', 'success');
  }

  // Weapon switching resolution (costs 1 round)
  async function resolveWeaponSwitch() {
    addLog('主人公は弓矢から接近戦用武器への持ち替えに1ラウンドを費やしました。', 'info');
    combatState.playerHasFiredRanged = false; // switch completed

    // Find the first melee weapon in inventory and equip it
    const meleeWeapon = character.value.weapons.find(w => w.type !== 'ranged');
    if (meleeWeapon) {
      character.value.equippedWeapon = meleeWeapon;
      addLog(`⚔️ 武器を【${meleeWeapon.name}】に持ち替えました。`, 'success');
    } else {
      character.value.equippedWeapon = null;
      addLog('⚔️ 接近戦用の武器が他にないため、素手になりました。', 'error');
    }

    // Archer also skips if they shot in Round 0
    await executeFollowerAttacks();

    // Check retreats
    checkEnemyRetreat();
    if (combatState.enemies.length === 0) {
      endCombat(true);
      return;
    }

    // Enemies attack
    await executeEnemyAttacks();
  }

  // Confirm combat and move back or forward in the dungeon
  function confirmCombatResult() {
    if (activeEvent.value?.d66Code === 'Final2' && combatState.resultType === 'victory') {
      const scenarioData = activeScenario.value;
      const origin = (character.value as any).pyramidOrigin || 'polomeia';
      const epilogue = (scenarioData as any)?.epilogues?.["2"]?.[origin];

      let goldReward = 30;
      if (epilogue && epilogue.goldBase && epilogue.goldDiceCount) {
        goldReward = epilogue.goldBase;
        const rolls = [];
        for (let i = 0; i < epilogue.goldDiceCount; i++) {
          const d = Math.floor(Math.random() * 6) + 1;
          rolls.push(d);
          goldReward += d;
        }
        addLog(`🎲 金貨ロール (3d6: ${rolls.join('+')})`, 'roll');
      }

      character.value.gold += goldReward;
      character.value.exp += epilogue?.exp || 1;
      character.value.items.push({
        name: 'プラチナコイン',
        type: 'gem_large',
        goldCost: 0,
        description: '異端者シーリーンや悪魔と取引するためのプラチナの硬貨。価値はないが極めて貴重。',
        value: 0
      } as any);

      if (epilogue) {
        const paragraphs = epilogue.text.split('\n');
        paragraphs.forEach((p: string) => {
          if (p.trim()) {
            addLog(p.trim(), 'info');
          }
        });
      }

      pyramidRunCount.value = 3;
      dungeonDepth.value = 0;
      activeEvent.value = null;
      combatState.active = false;
      combatState.isOver = false;
      combatState.resultType = null;
      currentScreen.value = 'levelup';
      addLog(`🎉 異端者シーリーンまたは至高のヘラクレオスを撃破し、2回目の冒険をクリアしました！ 金貨${goldReward}枚、1 Exp、プラチナコインを獲得し、レベルアップ画面へ移行します。`, 'success');
      return;
    }

    if (activeEvent.value?.d66Code === 'Final3' && combatState.resultType === 'victory') {
      if ((combatState as any).isAnotherEnding) {
        pyramidRunCount.value = 1;
        dungeonDepth.value = 0;
        activeEvent.value = null;
        combatState.active = false;
        combatState.isOver = false;
        combatState.resultType = null;
        (combatState as any).isAnotherEnding = false;
        currentScreen.value = 'levelup';

        const epilogue = (activeScenario.value as any)?.epilogues?.["3"]?.another;
        if (epilogue) {
          const paragraphs = epilogue.text.split('\n');
          paragraphs.forEach((p: string) => {
            if (p.trim()) {
              addLog(p.trim(), 'error');
            }
          });
        }
        addLog('🌀 悪魔を封印できなかったため、世界線がリセットされ、1回目の冒険から再挑戦となります...', 'error');
        return;
      } else {
        const epilogue = (activeScenario.value as any)?.epilogues?.["3"]?.success;
        if (epilogue) {
          const paragraphs = epilogue.text.split('\n');
          paragraphs.forEach((p: string) => {
            if (p.trim()) {
              addLog(p.trim(), 'success');
            }
          });
        }
        character.value.exp += epilogue?.exp || 2;

        clearDiceTray();
        activeEvent.value = null;
        combatState.active = false;
        combatState.isOver = false;
        combatState.resultType = null;
        currentScreen.value = 'success';
        return;
      }
    }

    clearDiceTray();
    activeEvent.value = null; // Clear active event so explore screen is ready for next room roll
    combatState.active = false;
    combatState.isOver = false;
    const isVictory = combatState.resultType === 'victory';
    const isPeaceful = combatState.resultType === 'peaceful';
    combatState.resultType = null;
    combatState.lootText = null;
    combatState.lootRolled = false;
    combatState.peacefulText = null;

    // Clear summon weapons
    character.value.weapons = character.value.weapons.filter(w => w.name !== '創られた魔法の剣');
    if (character.value.equippedWeapon?.name === '創られた魔法の剣') {
      character.value.equippedWeapon = null;
    }

    if (isVictory || isPeaceful) {
      dungeonDepth.value++;
      if (dungeonDepth.value > totalRoomsToClear.value) {
        currentScreen.value = 'success';
      } else {
        currentScreen.value = 'explore';
      }
    } else {
      // Escaped (retreat to previous room)
      dungeonDepth.value = Math.max(0, dungeonDepth.value - 1);
      currentScreen.value = 'explore';
    }
  }

  async function executeCover(useStrength: boolean) {
    const pending = combatState.pendingCover;
    if (!pending) return;

    const { attackId, followerId, followerName, enemyLevel } = pending;
    const queue = (combatState as any).activeAttacks || [];
    const idx = queue.findIndex((a: any) => a.id === attackId);

    let isCoverPrevented = false;
    playerActiveStatusEffectRules.value.forEach(rule => {
      if (rule.preventsCover) {
        addLog(`⚠️ 状態異常により従者をかばうことができません！ (理由: ${rule.description})`, 'error');
        isCoverPrevented = true;
      }
    });
    if (isCoverPrevented) {
      cancelCover();
      return;
    }

    // Roll defense for hero
    addLog(`🛡️ 主人公が身を挺して 従者 ${followerName} をかばいます！ (目標値: ${enemyLevel})`, 'combat');
    const roll = await rollD6(true);
    let modifier = 0;
    
    if (character.value.equippedArmor) modifier += character.value.equippedArmor.modDef;
    if (character.value.equippedShield) modifier += 1;
    modifier += combatState.buffs.defenseBonus;

    // Apply status effect modifiers to cover check
    playerActiveStatusEffectRules.value.forEach(rule => {
      if (rule.modDefense) {
        modifier += rule.modDefense;
        addLog(`状態異常ペナルティにより防御判定に ${rule.modDefense} の修正が入ります。`, 'error');
      }
      if (rule.modSkill) {
        modifier += rule.modSkill;
        addLog(`状態異常ペナルティにより防御判定に ${rule.modSkill} の修正が入ります。`, 'error');
      }
    });
    if (!carriesLantern.value) {
      modifier -= 2;
      addLog(`暗闇のため主人公の防御判定に -2 のペナルティ！`, 'error');
    }

    const baseSkill = useStrength ? character.value.subStatCurrent : character.value.skillCurrent;
    const total = roll === 6 ? 99 : roll === 1 ? -99 : roll + baseSkill + modifier;
    const coverSuccess = roll === 6 || (roll !== 1 && total >= enemyLevel);

    // Consume 1 Strength point
    character.value.subStatCurrent = Math.max(0, character.value.subStatCurrent - 1);
    combatState.hasCoveredInRound = true;
    addLog(`かばうにより筋力点を1点消費。(残り: ${character.value.subStatCurrent})`, 'info');

    if (coverSuccess) {
      addLog(`🛡️ かばう成功！ 主人公が攻撃を防ぎきり、従者 ${followerName} は無傷です。(ロール計: ${roll === 6 ? 'クリティカル' : total} >= ${enemyLevel})`, 'success');
    } else {
      addLog(`💥 かばう失敗！ 主人公は攻撃を防げませんでした。(ロール計: ${roll === 1 ? 'ファンブル' : total} < ${enemyLevel})`, 'error');
      // Follower dies
      const fIdx = followers.value.findIndex(fol => fol.id === followerId);
      if (fIdx !== -1) {
        addLog(`💀 従者 ${followers.value[fIdx].name} は致命傷を受け、息絶えました...`, 'error');
        followers.value.splice(fIdx, 1);
      }
    }

    // Clear pending state and remove attack from queue
    combatState.pendingCover = null;
    if (idx !== -1) {
      queue.splice(idx, 1);
      (combatState as any).activeAttacks = queue;
    }
  }

  function cancelCover() {
    const pending = combatState.pendingCover;
    if (!pending) return;

    const { attackId, followerId } = pending;
    const queue = (combatState as any).activeAttacks || [];
    const idx = queue.findIndex((a: any) => a.id === attackId);

    addLog(`主人公はかばうのを見送りました。`, 'info');
    // Follower dies
    const fIdx = followers.value.findIndex(fol => fol.id === followerId);
    if (fIdx !== -1) {
      addLog(`💀 従者 ${followers.value[fIdx].name} は致命傷を受け、息絶えました...`, 'error');
      followers.value.splice(fIdx, 1);
    }

    // Clear pending state and remove attack from queue
    combatState.pendingCover = null;
    if (idx !== -1) {
      queue.splice(idx, 1);
      (combatState as any).activeAttacks = queue;
    }
  }

  async function useHolyWater(targetEnemyId: string) {
    if (combatState.isOver) return;

    const idx = character.value.items.findIndex(i => i.type === 'holywater');
    if (idx === -1) {
      addLog('聖水を所持していません！', 'error');
      return;
    }

    const target = combatState.enemies.find(e => e.id === targetEnemyId);
    if (!target) return;

    addLog(`🧪 聖水を ${target.name} に投げつけた！`, 'success');
    character.value.items.splice(idx, 1);

    const isUndead = hasTag(target, 'undead');
    const isWeak = target.tags.includes('weak');

    if (isUndead || !isWeak) {
      // アンデッドや強い敵には2点ダメージ
      target.lifeCurrent = Math.max(0, target.lifeCurrent - 2);
      addLog(`✨ 聖水が清浄なる炎をあげた！ ${target.name} に2点ダメージ！`, 'success');
      if (target.lifeCurrent <= 0) {
        addLog(`💀 ${target.name} は浄化され、崩れ去った。`, 'success');
        const tIdx = combatState.enemies.findIndex(e => e.id === targetEnemyId);
        if (tIdx !== -1) combatState.enemies.splice(tIdx, 1);
      }
    } else {
      // 弱い敵なら2体を一撃で倒す
      addLog(`✨ 聖水が炸裂し、清浄な霧が広がった！ ${target.name} は即座に浄化された！`, 'success');
      const tIdx = combatState.enemies.findIndex(e => e.id === targetEnemyId);
      if (tIdx !== -1) combatState.enemies.splice(tIdx, 1);

      // もう1体弱い敵がいればそれも一撃で倒す
      const nextWeakIdx = combatState.enemies.findIndex(e => e.tags.includes('weak'));
      if (nextWeakIdx !== -1) {
        const nextWeak = combatState.enemies[nextWeakIdx];
        addLog(`✨ さらに ${nextWeak.name} も聖水の霧に包まれ、浄化された！`, 'success');
        combatState.enemies.splice(nextWeakIdx, 1);
      }
    }

    checkEnemyRetreat();

    if (combatState.enemies.length === 0) {
      endCombat(true);
      return;
    }

    // 聖水の使用は「通常攻撃等の代わり（行動）」として処理される
    if (combatState.round === 0) {
      combatState.hasRangedFired = true;
    } else {
      await executeFollowerAttacks();
      checkEnemyRetreat();
      if (combatState.enemies.length === 0) {
        endCombat(true);
        return;
      }
      await executeEnemyAttacks();
    }
  }

  return {
    rollReactionCheck,
    payBribe,
    refuseBribeAndFight,
    escapeCombat,
    playerAttack,
    castSpell,
    castMiracle,
    resolveDefense,
    resolveLoot,
    activateWarDoll,
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
    castFollowerSpell,
  };
}
