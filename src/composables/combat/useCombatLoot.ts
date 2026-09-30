import { type Ref, type WritableComputedRef } from 'vue';
import { generateId } from '../../domain/random';
import type { Character, Follower, Scenario, GeneralItem, LogType } from '../../types';

export interface CombatLootDependencies {
  character: Ref<Character> | WritableComputedRef<Character>;
  followers: Ref<Follower[]>;
  combatState: any;
  activeScenario: Ref<Scenario | null>;
  addLog: (text: string, type?: LogType | any) => void;
  rollD6: (skipVisual?: boolean) => Promise<number>;
}

export function useCombatLoot(deps: CombatLootDependencies) {
  const {
    character,
    followers,
    combatState,
    activeScenario: _activeScenario,
    addLog,
    rollD6
  } = deps;

  // Helper to grant loot for a given total roll on Treasure Table (Rule 40)
  async function grantLootForTotal(total: number): Promise<{ summary: string; grantedItem?: GeneralItem; grantedGold?: number }> {
    let summary = '';
    let grantedItem: GeneralItem | undefined;
    let grantedGold: number | undefined;

    if (total <= 1) {
      character.value.gold += 1;
      grantedGold = 1;
      summary = '金貨 1 枚';
      addLog('金貨1枚を獲得した。', 'success');
    } else if (total === 2) {
      const g = await rollD6();
      character.value.gold += g;
      grantedGold = g;
      summary = `金貨 ${g} 枚`;
      addLog(`金貨 ${g} 枚を獲得した！`, 'success');
    } else if (total === 3) {
      const g1 = await rollD6();
      const g2 = await rollD6();
      const sum = Math.max(5, g1 + g2);
      character.value.gold += sum;
      grantedGold = sum;
      summary = `金貨 ${sum} 枚 (下限5枚)`;
      addLog(`金貨 ${sum} 枚を獲得した！ (下限5枚)`, 'success');
    } else if (total === 4) {
      const d1 = await rollD6();
      const d2 = await rollD6();
      const value = d1 * d2;
      const item: GeneralItem = {
        id: generateId(),
        name: '魔除けのアクセサリー',
        type: 'accessory',
        goldCost: 0,
        value,
        description: `金貨 ${value} 枚の価値がある宝飾品。`,
      };
      character.value.items.push(item);
      grantedItem = item;
      summary = `魔除けのアクセサリー (価値: 金貨${value}枚)`;
      addLog(`美しい宝飾アクセサリーを獲得！ (売却価値: 金貨${value}枚)`, 'success');
    } else if (total === 5) {
      const d = await rollD6();
      const value = Math.max(15, d * 5);
      const item: GeneralItem = {
        id: generateId(),
        name: '宝石（小）',
        type: 'gem_small',
        goldCost: 0,
        value,
        description: `金貨 ${value} 枚の価値がある煌めく小宝石。`,
      };
      character.value.items.push(item);
      grantedItem = item;
      summary = `宝石（小） (価値: 金貨${value}枚)`;
      addLog(`煌めく宝石(小)を獲得！ (売却価値: 金貨${value}枚)`, 'success');
    } else if (total === 6) {
      const d1 = await rollD6();
      const d2 = await rollD6();
      const value = Math.max(30, (d1 + d2) * 5);
      const item: GeneralItem = {
        id: generateId(),
        name: '宝石（大）',
        type: 'gem_large',
        goldCost: 0,
        value,
        description: `金貨 ${value} 枚の価値がある巨大な宝石。`,
      };
      character.value.items.push(item);
      grantedItem = item;
      summary = `宝石（大） (価値: 金貨${value}枚)`;
      addLog(`まばゆい大宝石を獲得！ (売却価値: 金貨${value}枚)`, 'success');
    } else if (total >= 7) {
      summary = await rollMagicTreasure();
    }

    return { summary, grantedItem, grantedGold };
  }

  // Treasure Table Roll (Rule 40 & Rule 23)
  async function resolveLoot(): Promise<string> {
    addLog('💰 宝箱を開けるか、敵の遺品から戦利品（宝物表ロール）を獲得します！', 'info');
    const roll = await rollD6();
    addLog(`宝物ロール決定: [ ${roll} ]`, 'info');

    const result = await grantLootForTotal(roll);
    combatState.lootText = result.summary;
    combatState.lootRolled = true;

    // Rule 23: 器用点を持つキャラクターは出目確認後に+1を選択可能
    if (character.value.subStatType === 'dexterity' && character.value.subStatCurrent > 0) {
      combatState.pendingDexLootChoice = {
        baseRoll: roll,
        grantedGold: result.grantedGold,
        grantedItemId: result.grantedItem?.id
      };
      addLog(`🎯 器用点【宝物の獲得】を発動可能です。(出目を ${roll} から ${roll + 1} に変更可能。残り器用点: ${character.value.subStatCurrent})`, 'info');
    } else {
      combatState.pendingDexLootChoice = null;
    }

    return result.summary;
  }

  // Apply Dexterity +1 bonus to loot (Rule 23)
  async function applyDexLootBonus(): Promise<string> {
    if (!combatState.pendingDexLootChoice) return '';
    if (character.value.subStatCurrent <= 0) {
      addLog('器用点が足りないため、【宝物の獲得】を発動できません。', 'error');
      return '';
    }

    const { baseRoll, grantedGold, grantedItemId } = combatState.pendingDexLootChoice;

    // Deduct previously granted loot
    if (grantedGold) {
      character.value.gold = Math.max(0, character.value.gold - grantedGold);
    }
    if (grantedItemId) {
      character.value.items = character.value.items.filter(i => i.id !== grantedItemId);
    }

    // Consume 1 dexterity point
    character.value.subStatCurrent--;
    combatState.pendingDexLootChoice = null;

    const newTotal = baseRoll + 1;
    addLog(`🎯 器用点【宝物の獲得】を発動！ 出目を [ ${baseRoll} ] → [ ${newTotal} ] に変更しました！(残り器用点: ${character.value.subStatCurrent})`, 'success');

    const result = await grantLootForTotal(newTotal);
    combatState.lootText = result.summary;
    return result.summary;
  }

  // Confirm loot without using Dexterity
  function confirmLootWithoutDex() {
    combatState.pendingDexLootChoice = null;
    addLog('現在の宝物結果を確定しました。', 'info');
  }

  // Magic Treasure Table (Rule 40)
  async function rollMagicTreasure(): Promise<string> {
    addLog('✨ レア！ 【魔法の宝物表】でダイスロールを行います！', 'success');
    const roll = await rollD6();
    let item: GeneralItem;
    let descText = '';

    if (roll === 1) {
      item = {
        id: generateId(),
        name: '貫きの石弾 (5個)',
        type: 'holywater',
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
        id: generateId(),
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
        id: generateId(),
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
        id: generateId(),
        name: '看破の片眼鏡',
        type: 'magic_monocle',
        goldCost: 60,
        value: 60,
        chargesCurrent: 3,
        chargesMax: 6,
        description: '探索・隠し部屋発見などの判定ロールに+1修正。',
      };
      const charges = await rollD6();
      item.chargesCurrent = charges;
      item.chargesMax = charges;
      descText = `魔法の眼鏡『看破の片眼鏡 (${charges}回分)』`;
      addLog(`✨ 『看破の片眼鏡』を獲得！ (${charges}回分、判定に+1修正)`, 'success');
    } else if (roll === 5) {
      item = {
        id: generateId(),
        name: '魔法の大盾',
        type: 'magic_shield',
        goldCost: 60,
        value: 60,
        description: '戦う従者のための盾。装備中、従者は飛び道具攻撃に対して防御判定+1修正。',
      };
      descText = '従者用魔法防具『魔法の大盾』';
      addLog('✨ 従者専用 『魔法の大盾』を獲得！', 'success');
    } else {
      item = {
        id: generateId(),
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

  // Activate War Doll follower using 1 EXP (Rule 40)
  function activateWarDoll(itemId: string) {
    if (character.value.exp < 1) {
      addLog('経験点が足りないため、ウォー・ドールを起動できません！', 'error');
      return;
    }
    const idx = character.value.items.findIndex(i => i.id === itemId);
    if (idx === -1) return;
    
    if (followers.value.length >= character.value.followerCurrent) {
      addLog('従者枠がいっぱいです。', 'error');
      return;
    }

    character.value.exp--;
    character.value.items.splice(idx, 1);

    followers.value.push({
      id: generateId(),
      name: 'ウォー・ドール',
      type: 'soldier',
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

  return {
    resolveLoot,
    applyDexLootBonus,
    confirmLootWithoutDex,
    rollMagicTreasure,
    activateWarDoll
  };
}
