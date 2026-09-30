import { type Ref, type ComputedRef, type WritableComputedRef } from 'vue';
import { generateId } from '../../domain/random';
import type { Character, Follower, Enemy, StatusEffectRule, LogType } from '../../types';

export interface CombatMagicDependencies {
  character: Ref<Character> | WritableComputedRef<Character>;
  followers: Ref<Follower[]>;
  combatState: any;
  carriesLantern: ComputedRef<boolean>;
  playerActiveStatusEffectRules: ComputedRef<StatusEffectRule[]>;
  addLog: (text: string, type?: LogType | any) => void;
  rollD6: (skipVisual?: boolean) => Promise<number>;
  hasTag: (enemy: Enemy, tag: string) => boolean;
  checkEnemyRetreat: () => void;
  endCombat: (isVictory: boolean, getLoot?: boolean) => void;
  executeFollowerAttacks: () => Promise<void>;
  executeEnemyAttacks: () => Promise<void>;
  castCreateWeaponSpell: (category: 'weapon' | 'armor' | 'shield', itemKey: string) => boolean | void;
}

export function useCombatMagic(deps: CombatMagicDependencies) {
  const {
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
  } = deps;

  // Follower mage casting spell (Rule 33)
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
      const target = targetEnemyId ? enemies.find((e: Enemy) => e.id === targetEnemyId) : enemies[0];
      if (!target) {
        follower.magicCurrent++;
        return;
      }
      if (!target.tags.includes('weak')) {
        addLog('【気絶】は「弱いクリーチャー」にしか効果がありません。', 'error');
        follower.magicCurrent++;
        return;
      }
      if (hasTag(target, 'undead') || hasTag(target, 'golem') || hasTag(target, 'plant')) {
        addLog('アンデッドやゴーレム、植物などには【気絶】の効果はありません！', 'error');
        follower.magicCurrent++;
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
        const idx = enemies.findIndex((e: Enemy) => e.id === target.id);
        enemies.splice(idx, 1);
        
        let excess = spellTotal - target.level;
        while (excess >= 2 && enemies.length > 0) {
          const nextWeak = enemies.find((e: Enemy) => e.tags.includes('weak') && !hasTag(e, 'undead') && !hasTag(e, 'golem') && !hasTag(e, 'plant'));
          if (nextWeak) {
            addLog(`💤 追加で ${nextWeak.name} も眠りに落ちた。`, 'success');
            const nIdx = enemies.findIndex((e: Enemy) => e.id === nextWeak.id);
            enemies.splice(nIdx, 1);
            excess -= 2;
          } else {
            break;
          }
        }
      } else {
        addLog('💨 呪文は抵抗された！', 'error');
      }

    } else if (spellName === '氷槍') {
      const target = targetEnemyId ? enemies.find((e: Enemy) => e.id === targetEnemyId) : enemies[0];
      if (!target) {
        follower.magicCurrent++;
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
        if (target.name.includes('キャットゴーレム')) {
          addLog(`❄️ ${target.name}は大理石の身体のため、氷のダメージを無効化した！`, 'error');
        } else {
          target.lifeCurrent = Math.max(0, target.lifeCurrent - 2);
          addLog(`❄️ 直撃！ 従者の氷槍が ${target.name} に2点のダメージ！`, 'success');
        }
      } else {
        addLog(`💨 従者の氷槍は ${target.name} に回避された。(ロール計: ${spellRoll === 1 ? 'ファンブル' : spellTotal} < ${target.level})`, 'info');
      }

      combatState.enemies = enemies.filter((e: Enemy) => {
        if (e.lifeCurrent <= 0) {
          addLog(`💀 ${e.name} は力尽きた。`, 'success');
          return false;
        }
        return true;
      });

    } else if (spellName === '炎球') {
      let isNarrow = false;
      const spaceRoll = await rollD6();
      if (spaceRoll <= 3 || enemies.some((e: Enemy) => e.name.includes('木ゴーレム'))) {
        isNarrow = true;
        if (enemies.some((e: Enemy) => e.name.includes('木ゴーレム'))) {
          addLog('🔥 部屋の中に【木ゴーレム】がいるため、炎に弱い木ゴーレムに炎球の効果が高まります！', 'success');
        } else {
          addLog('廊下のような【狭い場所】のため、炎球の威力が高まります！', 'success');
        }
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
        enemies.forEach((e: Enemy) => {
          if (hits > 0 && spellTotal >= e.level) {
            if (e.name.includes('キャットゴーレム')) {
              addLog(`🔥 ${e.name}は大理石の身体のため、炎のダメージを無効化した！`, 'error');
            } else {
              e.lifeCurrent = Math.max(0, e.lifeCurrent - 1);
              addLog(`🔥 ${e.name} に従者の炎球が炸裂！ 1点ダメージ！`, 'success');
            }
            hits--;
          }
        });
      } else {
        if (enemies.length > 0) {
          const firstEnemy = enemies[0];
          const spellHit = spellRoll === 6 || (spellRoll !== 1 && spellTotal >= firstEnemy.level);
          if (spellHit) {
            const totalHits = spellRoll === 6 ? enemies.length : Math.max(1, Math.floor(spellTotal / firstEnemy.level));
            let hitCount = 0;
            for (let i = 0; i < enemies.length; i++) {
              if (hitCount >= totalHits) break;
              const e = enemies[i];
              if (e.name.includes('キャットゴーレム')) {
                addLog(`🔥 ${e.name}は大理石の身体のため、炎のダメージを無効化した！`, 'error');
              } else {
                e.lifeCurrent = Math.max(0, e.lifeCurrent - 1);
                addLog(`🔥 ${e.name} に炎球が直撃！ 1点ダメージ！`, 'success');
              }
              hitCount++;
            }
          } else {
            addLog(`💨 炎球は ${firstEnemy.name} に回避された。(ロール計: ${spellRoll === 1 ? 'ファンブル' : spellTotal} < ${firstEnemy.level})`, 'info');
          }
        }
      }

      combatState.enemies = enemies.filter((e: Enemy) => {
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

    // Rule 9 & 19: 魔術師は消費前の魔術点現在値を用いて魔術ロールを行える
    const magicVal = character.value.subStatType === 'magic'
      ? character.value.subStatCurrent + 1
      : character.value.skillCurrent;

    const enemies = combatState.enemies;

    if (spellName === '気絶') {
      if (!targetEnemyId) return;
      const target = enemies.find((e: Enemy) => e.id === targetEnemyId);
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
      let modifier = 0;
      if (!carriesLantern.value) {
        modifier -= 2;
        addLog('暗闇のため魔術判定に -2 のペナルティ！', 'error');
      }
      const total = roll === 6 ? 99 : roll === 1 ? -99 : roll + magicVal + modifier;
      const success = roll === 6 || (roll !== 1 && total >= target.level);
      addLog(`🔮 魔術ロール: 出目 [${roll}] + 魔術値 [${magicVal}] + 補正 [${modifier}] = 計 [${roll === 6 ? 'クリティカル' : roll === 1 ? 'ファンブル' : total}] (目標値: ${target.level})`, 'info');

      if (success) {
        addLog(`💤 成功！ ${target.name} は深い眠りに落ちた。(撃破扱い)`, 'success');
        const idx = enemies.findIndex((e: Enemy) => e.id === targetEnemyId);
        enemies.splice(idx, 1);

        let excess = total - target.level;
        while (excess >= 2 && enemies.length > 0) {
          const nextWeak = enemies.find((e: Enemy) => e.tags.includes('weak') && !hasTag(e, 'undead') && !hasTag(e, 'golem'));
          if (nextWeak) {
            addLog(`💤 追加で ${nextWeak.name} も眠りに落ちた。`, 'success');
            const nIdx = enemies.findIndex((e: Enemy) => e.id === nextWeak.id);
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
      let isNarrow = false;
      const spaceRoll = await rollD6();
      if (spaceRoll <= 3 || enemies.some((e: Enemy) => e.name.includes('木ゴーレム'))) {
        isNarrow = true;
        if (enemies.some((e: Enemy) => e.name.includes('木ゴーレム'))) {
          addLog('🔥 部屋の中に【木ゴーレム】がいるため、炎に弱い木ゴーレムに炎球の効果が高まります！', 'success');
        } else {
          addLog('廊下のような【狭い場所】のため、炎球の威力が高まります！', 'success');
        }
      } else {
        addLog('ホールのような【広い場所】のため、炎球の威力が拡散します。', 'info');
      }

      const roll = await rollD6(true);
      let modifier = 0;
      if (!carriesLantern.value) {
        modifier -= 2;
        addLog('暗闇のため魔術判定に -2 のペナルティ！', 'error');
      }
      const total = roll === 6 ? 99 : roll === 1 ? -99 : roll + magicVal + modifier;
      addLog(`🔮 魔術ロール: 出目 [${roll}] + 魔術値 [${magicVal}] + 補正 [${modifier}] = 計 [${roll === 6 ? 'クリティカル' : roll === 1 ? 'ファンブル' : total}]`, 'info');

      if (isNarrow) {
        let hits = 1;
        enemies.forEach((e: Enemy) => {
          if (hits > 0 && total >= e.level) {
            if (e.name.includes('キャットゴーレム')) {
              addLog(`🔥 ${e.name}は大理石の身体のため、炎のダメージを無効化した！`, 'error');
            } else {
              e.lifeCurrent = Math.max(0, e.lifeCurrent - 1);
              addLog(`🔥 ${e.name} に炎球が炸裂！ 1点ダメージを与えた！`, 'success');
            }
            hits--;
          }
        });
      } else {
        enemies.forEach((e: Enemy) => {
          if (total >= e.level) {
            if (e.name.includes('キャットゴーレム')) {
              addLog(`🔥 ${e.name}は大理石の身体のため、炎のダメージを無効化した！`, 'error');
            } else {
              e.lifeCurrent = Math.max(0, e.lifeCurrent - 1);
              addLog(`🔥 ${e.name} に炎球が直撃！ 1点ダメージ！`, 'success');
            }
          }
        });
      }

      combatState.enemies = enemies.filter((e: Enemy) => {
        if (e.lifeCurrent <= 0) {
          addLog(`💀 ${e.name} は焼き尽くされた。`, 'success');
          return false;
        }
        return true;
      });

    } else if (spellName === '氷槍') {
      if (!targetEnemyId) return;
      const target = enemies.find((e: Enemy) => e.id === targetEnemyId);
      if (!target) return;

      addLog(`氷の槍を放ちます！魔術判定ロール...`, 'info');
      const roll = await rollD6(true);
      let modifier = 0;
      if (!carriesLantern.value) {
        modifier -= 2;
        addLog('暗闇のため魔術判定に -2 のペナルティ！', 'error');
      }
      const total = roll === 6 ? 99 : roll === 1 ? -99 : roll + magicVal + modifier;
      addLog(`🔮 魔術ロール: 出目 [${roll}] + 魔術値 [${magicVal}] + 補正 [${modifier}] = 計 [${roll === 6 ? 'クリティカル' : roll === 1 ? 'ファンブル' : total}] (目標値: ${target.level})`, 'info');

      if (roll === 6 || (roll !== 1 && total >= target.level)) {
        if (target.name.includes('キャットゴーレム')) {
          addLog(`❄️ ${target.name}は大理石の身体のため、氷のダメージを無効化した！`, 'error');
        } else {
          target.lifeCurrent = Math.max(0, target.lifeCurrent - 2);
          addLog(`❄️ 直撃！ ${target.name} に極大の2点ダメージ！`, 'success');
          if (target.lifeCurrent <= 0) {
            addLog(`💀 ${target.name} は氷結して砕け散った！`, 'success');
            const idx = enemies.findIndex((e: Enemy) => e.id === targetEnemyId);
            enemies.splice(idx, 1);
          }
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
      character.value.subStatCurrent++;
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
        character.value.subStatCurrent++;
        return;
      }

    } else if (miracleName === '聖洗脳') {
      const enemies = combatState.enemies;
      const weakEnemies = enemies.filter((e: Enemy) => e.tags.includes('weak'));
      if (weakEnemies.length !== 1 || enemies.length !== 1) {
        addLog('【聖洗脳】は、敵が「残り1体の弱いクリーチャー」の状況でしか効果を発揮しません。', 'error');
        character.value.subStatCurrent++;
        return;
      }

      const target = weakEnemies[0];
      if (hasTag(target, 'undead')) {
        addLog('アンデッドには聖洗脳の効果はありません！', 'error');
        character.value.subStatCurrent++;
        return;
      }

      addLog(`洗脳の念を送ります！幸運判定ロール...`, 'info');
      const roll = await rollD6(true);
      const val = character.value.subStatCurrent;
      let modifier = 0;
      if (!carriesLantern.value) {
        modifier -= 2;
        addLog('暗闇のため幸運判定に -2 のペナルティ！', 'error');
      }
      const total = roll === 6 ? 99 : roll === 1 ? -99 : roll + val + modifier;

      if (roll === 6 || (roll !== 1 && total >= target.level)) {
        addLog(`✨ 成功！ ${target.name} は改心し、【捕虜】の従者として同行することになりました！`, 'success');
        followers.value.push({
          id: generateId(),
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
      const hasUndead = combatState.enemies.some((e: Enemy) => hasTag(e, 'undead'));
      if (!hasUndead) {
        addLog('戦闘フィールドにアンデッドの敵が存在しないため、招天を発動できません。', 'error');
        character.value.subStatCurrent++;
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

    const isActionMiracle = ['防衛', '聖洗脳'].includes(miracleName);
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

  // Skip deflect miracle
  async function skipDeflect() {
    if (!combatState.pendingDeflect) return;
    const p = combatState.pendingDeflect;
    combatState.pendingDeflect = null;
    (p.deps as any).resolveDefense(p.attackId, p.defenderId, p.isAllOut, true);
  }

  // Execute deflect miracle
  async function executeDeflect() {
    if (!combatState.pendingDeflect) return;
    if (character.value.subStatCurrent < 1) {
      addLog('幸運点が足りないため、【そらし】を発動できません！', 'error');
      await skipDeflect();
      return;
    }

    character.value.subStatCurrent--;
    addLog(`✨ 奇跡【そらし】を発動！ 飛び道具を奇跡の光で弾き、無傷で回避しました！ (残り幸運点: ${character.value.subStatCurrent})`, 'success');

    const attackId = combatState.pendingDeflect.attackId;
    combatState.pendingDeflect = null;

    const queue = combatState.activeAttacks || [];
    const idx = queue.findIndex((a: any) => a.id === attackId);
    if (idx !== -1) {
      queue.splice(idx, 1);
    }
    if (queue.length === 0) {
      combatState.roundActive = false;
    }
  }

  // Fire Holy Arrow (Miracle 招天)
  async function fireHolyArrow(targetEnemyId: string) {
    if (combatState.isOver) return;
    if (combatState.pendingHolyArrow <= 0) return;
    const target = combatState.enemies.find((e: Enemy) => e.id === targetEnemyId);
    if (!target) return;

    if (!hasTag(target, 'undead')) {
      addLog(`${target.name} はアンデッドではないため、聖なる矢の効果がありません。`, 'error');
      return;
    }

    combatState.pendingHolyArrow--;
    addLog(`⚡ ${target.name} に聖なる矢を放ちます！(残り矢数: ${combatState.pendingHolyArrow})`, 'combat');

    const roll = await rollD6(true);
    const val = character.value.subStatCurrent;
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

    combatState.enemies = combatState.enemies.filter((e: Enemy) => e.lifeCurrent > 0);
    checkEnemyRetreat();

    if (combatState.enemies.length === 0) {
      combatState.pendingHolyArrow = 0;
      endCombat(true);
    }

    if (combatState.pendingHolyArrow === 0 && combatState.enemies.length > 0) {
      if (combatState.round === 0) {
        combatState.hasRangedFired = true;
        addLog('第0ラウンドの奇跡【招天】が完了しました。', 'info');
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

  return {
    castSpell,
    resolveCreateWeaponSpell,
    castMiracle,
    skipDeflect,
    executeDeflect,
    fireHolyArrow,
    castFollowerSpell
  };
}
