import { useGameState } from './useGameState';
import type { Enemy } from '../types';
import { runScenarioHook } from './scenarioPlugins';
import { generateId, randomInt } from '../domain/random';
import { useCombatEnemy } from './combat/useCombatEnemy';
import { useCombatLoot } from './combat/useCombatLoot';
import { useCombatMagic } from './combat/useCombatMagic';

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
    hasSwordbearer,
    playerActiveStatusEffectRules,
    pyramidRunCount,
    restorePyramidBossSnapshot,
    castCreateWeaponSpell,
    activeScenario,
    transitionToSuccess,
    transitionToExplore,
    triggerLevelUp,
    triggerGameOver,
    savePyramidBossSnapshot,
    diceTray
  } = useGameState();

  const context = {
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
    activeScenario,
    transitionToSuccess,
    transitionToExplore,
    triggerLevelUp,
    triggerGameOver,
    rollSpellResistance,
    endCombat,
    savePyramidBossSnapshot
  };

  // Helper: check if enemy group is Undead, Golem, etc.
  function hasTag(enemy: Enemy, tag: string): boolean {
    return enemy.tags.includes(tag as any);
  }

  function calculateFollowerHit(follower: any, target: Enemy, roll: number, baseModifier: number) {
    let modifier = baseModifier;
    
    // Apply enemy resistances for followers
    const followerAttr = follower.type === 'archer' ? 'ranged' : follower.weaponAttribute;
    if (target.resistances) {
      target.resistances.forEach(res => {
        if (res.attribute === followerAttr) {
          modifier += res.modifier;
          addLog(`🤖 ${target.name} に対する ${follower.name} の【${res.attribute === 'slash' ? '斬撃' : res.attribute === 'strike' ? '打撃' : '射撃'}】修正 ${res.modifier >= 0 ? '+' : ''}${res.modifier}！`, res.modifier >= 0 ? 'success' : 'error');
        }
      });
    }

    // Ant-man acid spit penalty for followers
    if ((combatState as any).followerAccuracyModifiers && (combatState as any).followerAccuracyModifiers[follower.name]) {
      const penalty = (combatState as any).followerAccuracyModifiers[follower.name];
      modifier += penalty;
      addLog(`🤢 ギ酸の唾による ${follower.name} の視界不良ペナルティ ${penalty}！`, 'error');
    }

    const total = roll === 6 ? 99 : roll === 1 ? -99 : roll + follower.skill + modifier;
    let hit = roll === 6 || (roll !== 1 && total >= target.level);
    
    // Apply evasion rules
    if (target.evasionRule === 'shireen_future_sight') {
      const isCritical = roll === 6;
      const canHit = isCritical || (combatState as any).shireenClueSpent;
      if (!canHit && hit) {
        hit = false;
        addLog(`🔮 ${target.name} は未来を垣間見て ${follower.name} の攻撃を回避した！`, 'error');
      }
    }
    
    return { hit, total };
  }

  // Enemy and reaction sub-module
  const enemyModule = useCombatEnemy({
    character,
    followers,
    combatState,
    activeScenario,
    activeEvent,
    dungeonDepth,
    totalRoomsToClear,
    addLog,
    rollD6,
    endCombat,
    endCombatPeaceful,
    executeEnemyAttacks
  });

  const checkEnemyRetreat = enemyModule.checkEnemyRetreat;
  const rollReactionCheck = enemyModule.rollReactionCheck;
  const applyFriendshipReaction = enemyModule.applyFriendshipReaction;
  const confirmReactionResult = enemyModule.confirmReactionResult;
  const payBribe = enemyModule.payBribe;
  const refuseBribeAndFight = enemyModule.refuseBribeAndFight;

  // Loot sub-module
  const lootModule = useCombatLoot({
    character,
    followers,
    combatState,
    activeScenario,
    addLog,
    rollD6
  });

  const resolveLoot = lootModule.resolveLoot;
  const applyDexLootBonus = lootModule.applyDexLootBonus;
  const confirmLootWithoutDex = lootModule.confirmLootWithoutDex;
  const rollMagicTreasure = lootModule.rollMagicTreasure;
  const activateWarDoll = lootModule.activateWarDoll;

  // Escaping combat (Rule 42: 各敵から1回ずつ攻撃を受け、耐え切れば1部屋後退)
  async function escapeCombat() {
    if (combatState.isOver) return;
    if (combatState.enemies.length === 0) return;

    const isBossFight = dungeonDepth.value >= totalRoomsToClear.value;
    const isMidpointFight = activeScenario.value?.midpointEvent && 
      (activeEvent.value?.d66Code === 'midpoint' || activeEvent.value?.title === activeScenario.value.midpointEvent.event.title);

    if (isBossFight || isMidpointFight) {
      addLog('⚠️ 決戦ボスおよび中間イベントの敵からは逃走することができません！', 'error');
      return;
    }

    addLog('🏃 戦闘からの【逃走】を決断しました！ 敵からそれぞれ一度ずつ反撃を受けます。(Rule 42)', 'info');

    for (const enemy of [...combatState.enemies]) {
      if (character.value.lifeCurrent <= 0) break;
      addLog(`⚔️ ${enemy.name} の離脱追撃！ (目標値: ${enemy.level})`, 'combat');
      const roll = await rollD6(true);
      let modifier = 0;
      if (character.value.equippedArmor) modifier += character.value.equippedArmor.modDef;
      if (character.value.equippedShield) modifier += 1;
      if (!carriesLantern.value) modifier -= 2;

      const total = roll === 6 ? 99 : roll === 1 ? -99 : roll + character.value.skillCurrent + modifier;
      const defSuccess = roll === 6 || (roll !== 1 && total >= enemy.level);

      if (defSuccess) {
        addLog(`🛡️ 防御成功！ ${enemy.name} の追撃をかわした。(出目: ${roll})`, 'success');
      } else {
        character.value.lifeCurrent = Math.max(0, character.value.lifeCurrent - 1);
        addLog(`💥 被弾！ ${enemy.name} の追撃を受け、生命点1点を失った！(残り生命点: ${character.value.lifeCurrent})`, 'error');
        if (character.value.lifeCurrent <= 0) {
          handleDeath();
          return;
        }
      }
    }

    if (character.value.lifeCurrent > 0) {
      combatState.isOver = true;
      combatState.resultType = 'escaped';
      (combatState as any).activeAttacks = [];
      addLog('🏃 敵の追撃を耐え抜き、逃走に成功しました！ 一本道のためその場にとどまり、再度探索を行います。(Rule 42)', 'success');
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
    if (isPrevented) {
      // Trigger follower attacks and enemy turn to advance the round
      await executeFollowerAttacks();
      checkEnemyRetreat();
      if (combatState.enemies.length === 0) {
        endCombat(true);
        return;
      }
      await executeEnemyAttacks();
      return;
    }

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

    // Alan Duel Bonus in round 1
    if (combatState.round === 1 && (combatState as any).alanDuel) {
      modifier += 1;
      addLog('⚔️ 決闘エールによる攻撃ロール +1 ボーナス！', 'success');
    }

    // Chronovals wind attack penalty modifier
    if ((combatState as any).chronovalsWindPenalty) {
      modifier -= 1;
      (combatState as any).chronovalsWindPenalty = false;
      addLog('🌪️ 斬撃風による体勢崩れペナルティ -1！', 'error');
    }

    // Apply enemy resistances for player
    if (enemy.resistances && character.value.equippedWeapon) {
      const weaponAttr = character.value.equippedWeapon.type === 'ranged' ? 'ranged' : character.value.equippedWeapon.attribute;
      const isMagic = character.value.equippedWeapon.isMagic;
      enemy.resistances.forEach(res => {
        if (res.attribute === weaponAttr) {
          if (res.ignoreIfMagic && isMagic) {
            // ignore
          } else {
            modifier += res.modifier;
            addLog(`🤖 ${enemy.name} に対する【${res.attribute === 'slash' ? '斬撃' : res.attribute === 'strike' ? '打撃' : '射撃'}】武器修正 ${res.modifier >= 0 ? '+' : ''}${res.modifier}！`, res.modifier >= 0 ? 'success' : 'error');
          }
        }
      });
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

    // Apply slayer weapon tag modifiers
    if (character.value.equippedWeapon && character.value.equippedWeapon.tagModifiers) {
      const weapon = character.value.equippedWeapon;
      Object.keys(weapon.tagModifiers!).forEach(tag => {
        if (enemy.tags.includes(tag as any)) {
          const tagBonus = weapon.tagModifiers![tag];
          modifier += tagBonus;
          addLog(`⚔️ ${weapon.name}の特効ボーナス：攻撃ロール ${tagBonus >= 0 ? '+' : ''}${tagBonus}！`, 'success');
        }
      });
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

    // Apply evasion rules
    if (enemy.evasionRule === 'shireen_future_sight') {
      const isMagicWeapon = character.value.equippedWeapon?.isMagic;
      const isCritical = roll === 6;
      const canHit = isMagicWeapon || isCritical || (combatState as any).shireenClueSpent;
      if (!canHit && hit) {
        hit = false;
        addLog(`🔮 ${enemy.name} は未来を垣間見てあなたの通常攻撃を軽々と回避した！`, 'error');
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

      // Apply slayer weapon tag damage modifiers
      if (character.value.equippedWeapon && character.value.equippedWeapon.tagDamageModifiers) {
        const weapon = character.value.equippedWeapon;
        Object.keys(weapon.tagDamageModifiers!).forEach(tag => {
          if (enemy.tags.includes(tag as any)) {
            const tagBonus = weapon.tagDamageModifiers![tag];
            damage += tagBonus;
            addLog(`⚔️ ${weapon.name}の特効ボーナス：ダメージ ${tagBonus >= 0 ? '+' : ''}${tagBonus}！`, 'success');
          }
        });
      }
      if ((character.value as any).heraclesRightBuff && enemy.tags.includes('demon')) {
        damage += 1;
        addLog('✊ 怪力王の右腕の魂：悪魔へのダメージ +1！', 'success');
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
        const addKillCount = randomInt(1, 3);
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
    const prevRound = combatState.round;
    combatState.round++;
    combatState.hasCoveredInRound = false;
    combatState.hasWeaponCreatedThisRound = false;
    addLog(`--- ラウンド ${combatState.round}: クリーチャーの反撃フェーズ ---`, 'info');

    // 太刀持ち従者がいる場合、第0ラウンドの射撃後の第1ラウンド移行時に自動で接近戦用武器に持ち替える
    if (prevRound === 0 && hasSwordbearer.value && character.value.equippedWeapon?.type === 'ranged') {
      const meleeWeapon = character.value.weapons.find(w => w.type !== 'ranged');
      if (meleeWeapon) {
        character.value.equippedWeapon = meleeWeapon;
        addLog(`⚔️ 太刀持ち従者の手助けにより、瞬時に武器を【${meleeWeapon.name}】に持ち替えました！`, 'success');
      } else {
        character.value.equippedWeapon = null;
        addLog('⚔️ 接近戦用の武器が他にないため、素手になりました。', 'error');
      }
    }

    // Gather all enemy attacks
    const attackQueue: { source: Enemy; id: string }[] = [];
    combatState.enemies.forEach(e => {
      const attacksHandled = runScenarioHook(activeScenario.value?.id, 'onGenerateEnemyAttacks', context, e, attackQueue);
      if (!attacksHandled) {
        const overrideCount = runScenarioHook(activeScenario.value?.id, 'onDetermineEnemyAttackCount', context, e);
        const count = overrideCount !== undefined
          ? overrideCount
          : (e.tags.includes('weak') ? e.count : e.attackCount);
        for (let i = 0; i < count; i++) {
          attackQueue.push({ source: e, id: generateId(), type: 'normal' } as any);
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
        if ((character.value as any).heraclesLeftBuff && enemy.tags.includes('demon')) {
          modifier += 1;
          addLog('✊ 怪力王の左腕の魂：悪魔への防御ロール +1！', 'success');
        }
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
          const amulet = character.value.items.find(i => i.id === 'substitute_amulet' && i.charges !== undefined && i.charges > 0);
          const isStrikeAttack = enemy.weaponAttribute === 'strike' ||
                                 enemy.name.includes('ゴーレム') ||
                                 enemy.name.includes('ヘラクレオス') ||
                                 enemy.name.includes('スフィンクス') ||
                                 enemy.name.includes('骸骨');
          if (amulet && isStrikeAttack && amulet.charges !== undefined) {
            amulet.charges--;
            addLog(`🛡️ 『身代わりのアミュレット』が身代わりになり、打撃ダメージを無効化しました！ (残り使用可能回数: ${amulet.charges}回)`, 'success');
            if (amulet.charges <= 0) {
              character.value.items = character.value.items.filter(i => i !== amulet);
              addLog('💥 『身代わりのアミュレット』は使い果たされて崩れ落ちました。', 'error');
            }
          } else {
            character.value.lifeCurrent = Math.max(0, character.value.lifeCurrent - 1);
            addLog(`主人公の生命力残り: ${character.value.lifeCurrent}`, 'damage');
            if (character.value.lifeCurrent <= 0) {
              handleDeath();
              return;
            }
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
      await runScenarioHook(
        activeScenario.value?.id,
        'onResolveDefenseAttack',
        context,
        enemy,
        attack,
        defSuccess,
        roll,
        total,
        isHero,
        defenderId
      );
    }

    if (queue.length === 0) {
      await handleRoundEndEffects();
    }
  }

  // Magic and miracles sub-module
  const magicModule = useCombatMagic({
    character,
    followers,
    combatState,
    carriesLantern,
    playerActiveStatusEffectRules,
    addLog,
    rollD6,
    hasTag,
    checkEnemyRetreat,
    endCombat,
    executeFollowerAttacks,
    executeEnemyAttacks,
    castCreateWeaponSpell
  });

  const castSpell = magicModule.castSpell;
  const resolveCreateWeaponSpell = magicModule.resolveCreateWeaponSpell;
  const castMiracle = magicModule.castMiracle;
  const skipDeflect = magicModule.skipDeflect;
  const executeDeflect = magicModule.executeDeflect;
  const fireHolyArrow = magicModule.fireHolyArrow;
  const castFollowerSpell = magicModule.castFollowerSpell;

  // End Combat and trigger treasure reward or escape
  function endCombat(isVictory: boolean, getLoot = true) {
    if (combatState.isOver) return;

    // Time-Eating Roar check at death
    const endIntercepted = runScenarioHook(activeScenario.value?.id, 'onBeforeCombatEnd', context, isVictory, getLoot);
    if (endIntercepted) {
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
    
    const pluginBonus = runScenarioHook(activeScenario.value?.id, 'onGetSpellResistanceBonus', context, target);
    let bonus = pluginBonus !== undefined ? pluginBonus : 0;
    
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
    
    const handled = await runScenarioHook(activeScenario.value?.id, 'onResolveChronovalsRoar', context, checkType);
    if (handled) {
      return;
    }
  }

  async function handleRoundEndEffects() {
    await runScenarioHook(activeScenario.value?.id, 'onCombatRoundEnd', context);

    // Self-destruct enemies (e.g. self_destruct tag in Twilight Knight)
    if (combatState.round >= 1) {
      const selfDestructEnemies = combatState.enemies.filter((e: any) => e.tags?.includes('self_destruct'));
      if (selfDestructEnemies.length > 0) {
        for (const enemy of selfDestructEnemies) {
          const dmg = enemy.selfDestructDamage !== undefined ? enemy.selfDestructDamage : 2;
          addLog(`💥 【自爆発動】${enemy.name} は時限爆弾を作動させ、激しい爆発とともに自爆した！`, 'error');
          character.value.lifeCurrent = Math.max(0, character.value.lifeCurrent - dmg);
          addLog(`主人公は ${dmg} 点の自爆ダメージを受けました。(現在生命力: ${character.value.lifeCurrent})`, 'damage');
          // Remove enemy from combat
          combatState.enemies = combatState.enemies.filter((e: any) => e.id !== enemy.id);
          if (character.value.lifeCurrent <= 0) {
            handleDeath();
            return;
          }
        }
        if (combatState.enemies.length === 0) {
          endCombat(true);
        }
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
  async function confirmCombatResult() {
    // Run scenario plugin victory hook
    const hookResult = runScenarioHook(activeScenario.value?.id, 'onCombatVictory', context);
    if (hookResult instanceof Promise) {
      const handledByPlugin = await hookResult;
      if (handledByPlugin) {
        return;
      }
    } else if (hookResult) {
      return;
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
        transitionToSuccess();
      } else {
        transitionToExplore();
      }
    } else {
      // 逃走時 (Escaped: Rule 42)
      // 一本道モード：冒険を進めたことにならず、部屋数は維持（ver.5.1 Rule 42）
      addLog('🚶 一本道モードのため部屋カウントは進まず、現在位置で再探索を行います。(Rule 42)', 'info');
      transitionToExplore();
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
    if (diceTray.isRolling) return;

    const idx = character.value.items.findIndex(i => i.type === 'holywater');
    if (idx === -1) {
      addLog('聖水を所持していません！', 'error');
      return;
    }

    const target = combatState.enemies.find(e => e.id === targetEnemyId);
    if (!target) return;

    const isUndead = hasTag(target, 'undead');
    const isWeak = target.tags.includes('weak');

    // 強い敵かつアンデッドではない場合は効果なし（UIでも防ぐが二重保護）
    if (!isWeak && !isUndead) {
      addLog(`⚠️ ${target.name} はアンデッドではない強敵のため、聖水は効果がありません！`, 'error');
      return;
    }

    // 聖水を消費
    character.value.items.splice(idx, 1);
    addLog(`🧪 聖水を ${target.name} に投げつけた！`, 'success');

    // 【器用ロール】の実行 (目標値: 4)
    clearDiceTray();
    diceTray.sides = 6;

    // 器用修正値の計算: 敏捷(dexterity)を持つ場合はその現在値、それ以外は技量点
    const dexSkill = (character.value.subStatType === 'dexterity' && character.value.subStatCurrent > 0)
      ? character.value.subStatCurrent
      : character.value.skillCurrent;

    let modifier = dexSkill;

    // 布鎧・革鎧の器用ボーナス (+1)
    if (character.value.equippedArmor?.name === '布鎧' || character.value.equippedArmor?.name === '革鎧') {
      modifier += 1;
    }

    // ランタンなしペナルティ (-2)
    if (!carriesLantern.value) {
      modifier -= 2;
    }

    const roll = await rollD6(true);
    const isCritical = roll === 6;
    const isFumble = roll === 1;
    const total = roll + modifier;
    const isSuccess = !isFumble && (isCritical || total >= 4);

    if (isFumble) {
      diceTray.isFumble = true;
      diceTray.resultText = `痛恨のファンブル！ (出目: 1)`;
      addLog(`💀 判定出目: 1 (ファンブル！) 聖水の瓶は手元から滑り落ち、砕け散ってしまった！`, 'error');
    } else if (isCritical) {
      diceTray.isCritical = true;
      diceTray.resultText = `会心のクリティカル！ (出目: 6)`;
      addLog(`✨ 判定出目: 6 (クリティカル！) 聖水は完璧な放物線を描き直撃した！`, 'success');
    } else if (isSuccess) {
      diceTray.resultText = `器用判定成功！ 威力: ${total} (目標値: 4)`;
      addLog(`🎲 【器用ロール】 達成値 ${total} (出目${roll} + 修正${modifier}) >= 目標値 4 : 命中成功！`, 'success');
    } else {
      diceTray.resultText = `器用判定失敗... 威力: ${total} (目標値: 4)`;
      addLog(`💨 【器用ロール】 達成値 ${total} (出目${roll} + 修正${modifier}) < 目標値 4 : 命中失敗！ 聖水の瓶は外れて床で砕け散った...`, 'error');
    }

    // 命中時のみ効果を発揮
    if (isSuccess) {
      if (isUndead && !isWeak) {
        // アンデッドかつ強い敵には2点ダメージ
        target.lifeCurrent = Math.max(0, target.lifeCurrent - 2);
        addLog(`✨ 聖水が清浄なる炎をあげた！ ${target.name} に2点ダメージ！`, 'success');
        if (target.lifeCurrent <= 0) {
          addLog(`💀 ${target.name} は浄化され、崩れ去った。`, 'success');
          const tIdx = combatState.enemies.findIndex(e => e.id === targetEnemyId);
          if (tIdx !== -1) combatState.enemies.splice(tIdx, 1);
        }
      } else if (isWeak) {
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
    applyDexLootBonus,
    confirmLootWithoutDex,
    rollMagicTreasure,
  };
}
