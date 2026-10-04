import type { ScenarioPlugin, ScenarioPluginContext } from './index';
import type { Enemy } from '../../types';

// 人間型クリーチャーの判定用
const HUMAN_OR_LAMIA_CODES = ['21', '22', '23', '24', '25', '26', '51', '53', '61', '63', '64', '65'];
const HUMAN_OR_LAMIA_KEYWORDS = [
  '里人', '末裔', '冒険者', '行商人', 'ホブゴブリン', 'コビット',
  '突撃兵', 'ゴートマン', '狙撃手', '警備隊長', 'ウォー・ジェスター', 'ラミア'
];

function isHumanOrLamia(event: any): boolean {
  if (!event) return false;
  if (HUMAN_OR_LAMIA_CODES.includes(event.d66Code)) return true;
  const title = event.title || '';
  const desc = event.description || '';
  return HUMAN_OR_LAMIA_KEYWORDS.some(k => title.includes(k) || desc.includes(k));
}

// 内部状態フラグ
let hunterQuestAccepted = false;
let identificationTagUsed = false;

export const twilightKnightPlugin: ScenarioPlugin = {
  id: 'twilight_knight',

  onAdventureStart() {
    hunterQuestAccepted = false;
    identificationTagUsed = false;
  },

  onExploreRoom(context: ScenarioPluginContext) {
    const { activeEvent, nextRoomTensDigitOverride, addLog, rollD6, character, followers, dungeonDepth } = context;
    if (!activeEvent.value) return;

    const event = activeEvent.value;
    const choices = event.customChoices ? [...event.customChoices] : [];

    // --- 水場ギミック（出目 21〜26 の部屋でのみ水場利用を提供） ---
    const isWaterPlace = ['21', '22', '23', '24', '25', '26'].includes(event.d66Code || '');

    if (isWaterPlace) {
      const hasWashChoice = choices.some(c => c.id === 'tk_wash_oil');
      if (!hasWashChoice) {
        choices.push({
          id: 'tk_wash_oil',
          label: '🌊 水場で身体を洗う (油まみれ状態を洗い流す)',
          onSelect: () => {
            if (character.value.statusEffects && character.value.statusEffects.includes('油まみれ')) {
              character.value.statusEffects = character.value.statusEffects.filter(e => e !== '油まみれ');
              addLog('🌊 清らかな水場で身体を洗い流しました！「油まみれ」の状態異常が解消されました！', 'success');
            } else {
              addLog('🌊 水場で顔や身体を洗い、気分をリフレッシュしました。', 'info');
            }
          }
        });
      }
    }

    // --- 出目 22: 末裔 (生贄の捧げ物 / 隠し通路) ---
    if (event.d66Code === '22') {
      const hasFriendlyChoice = choices.some(c => c.id === 'tk_fish_friendly');
      if (!hasFriendlyChoice) {
        choices.push(
          {
            id: 'tk_fish_friendly',
            label: '🐟 隠し通路を教えてもらう (次回の部屋の十の位を2に指定)',
            onSelect: () => {
              if (nextRoomTensDigitOverride) {
                nextRoomTensDigitOverride.value = 2;
              }
              addLog('🐟 末裔から水場の隠し通路の存在を教えてもらいました！', 'success');
              addLog('🌊 次回の部屋探索の十の位が [ 2 ] (水場のある部屋) に指定されました。', 'info');
              event.isResolved = true;
              event.resolutionText = '🐟 末裔と心を通わせ、水場へと通じる隠し通路を教わりました。\n次回の部屋探索の十の位が [ 2 ] に固定されます。';
            }
          },
          {
            id: 'tk_fish_sacrifice',
            label: '🩸 従者を生贄に捧げて友好的にする (他の従者は激怒して離脱)',
            disabled: followers.value.length === 0,
            onSelect: () => {
              if (followers.value.length === 0) return;
              const sacrificed = followers.value.shift()!;
              addLog(`💀 従者【${sacrificed.name}】を生贄として末裔たちに差し出しました...`, 'error');
              if (followers.value.length > 0) {
                addLog('⚠️ 残りの従者たちはあなたの非人道的な選択に激怒し、全員立ち去ってしまいました！', 'error');
                followers.value = [];
              }
              if (nextRoomTensDigitOverride) {
                nextRoomTensDigitOverride.value = 2;
              }
              addLog('🐟 末裔たちは生贄に満足し、水場の隠し通路（十の位2）を教えてくれました。', 'success');
              event.isResolved = true;
              event.resolutionText = '末裔たちに生贄を捧げ、水場の隠し通路を教えてもらいました。';
            }
          },
          {
            id: 'tk_fish_leave',
            label: '🚶 会話を終えて先へ進む',
            onSelect: () => {
              addLog('末裔たちの部屋を後にしました。', 'info');
              event.isResolved = true;
              event.resolutionText = '末裔たちとの遭遇を終え、先へ進みました。';
            }
          }
        );
      }
    }

    // --- 出目 23: 冒険者の一団 (個別引き抜き雇用) ---
    if (event.d66Code === '23') {
      const activeCount = followers.value.length;
      const maxCount = character.value.followerCurrent;
      const hasSlot = activeCount < maxCount;

      choices.push(
        {
          id: 'tk_hire_swordsman',
          label: '⚔️ 【剣士】を引き抜く (金貨9枚 / HP20 / 攻撃修正+2)',
          disabled: !hasSlot || character.value.gold < 9,
          onSelect: () => {
            if (character.value.gold < 9 || followers.value.length >= character.value.followerCurrent) return;
            character.value.gold -= 9;
            followers.value.push({
              id: 'swordsman_' + Date.now(),
              name: '冒険者の剣士',
              type: 'swordsman',
              isCombatant: true,
              skill: 1,
              lifeMax: 1,
              lifeCurrent: 1,
              weaponAttribute: 'slash',
              goldCost: 9,
              description: '冒険者の一団から引き抜いた剣士。'
            });
            addLog('⚔️ 冒険者の一団から【剣士】を引き抜いて雇用しました！ (金貨9枚消費)', 'success');
          }
        },
        {
          id: 'tk_hire_mage',
          label: '🪄 【魔術師】を引き抜く (金貨12枚 / 炎球・精神の盾)',
          disabled: !hasSlot || character.value.gold < 12,
          onSelect: () => {
            if (character.value.gold < 12 || followers.value.length >= character.value.followerCurrent) return;
            character.value.gold -= 12;
            followers.value.push({
              id: 'mage_' + Date.now(),
              name: '冒険者の魔術師',
              type: 'mage',
              isCombatant: true,
              skill: 0,
              lifeMax: 1,
              lifeCurrent: 1,
              magicMax: 2,
              magicCurrent: 2,
              magicList: ['炎球', '精神の盾'],
              weaponAttribute: 'strike',
              goldCost: 12,
              description: '冒険者の一団から引き抜いた魔術師。'
            });
            addLog('🪄 冒険者の一団から【魔術師】を引き抜いて雇用しました！ (金貨12枚消費)', 'success');
          }
        },
        {
          id: 'tk_hire_scout',
          label: '🏹 【斥候】を引き抜く (金貨7枚 / トラップ解除支援)',
          disabled: !hasSlot || character.value.gold < 7,
          onSelect: () => {
            if (character.value.gold < 7 || followers.value.length >= character.value.followerCurrent) return;
            character.value.gold -= 7;
            followers.value.push({
              id: 'scout_' + Date.now(),
              name: '冒険者の斥候',
              type: 'scout',
              isCombatant: false,
              skill: 0,
              lifeMax: 1,
              lifeCurrent: 1,
              weaponAttribute: 'strike',
              goldCost: 7,
              description: '冒険者の一団から引き抜いた斥候。'
            });
            addLog('🏹 冒険者の一団から【斥候】を引き抜いて雇用しました！ (金貨7枚消費)', 'success');
          }
        },
        {
          id: 'tk_hire_leave',
          label: '🚶 引き抜きを終えて先へ進む',
          onSelect: () => {
            addLog('冒険者の一団と別れ、先へ進みました。', 'info');
            event.isResolved = true;
            event.resolutionText = '冒険者の一団との交渉を終え、部屋を後にしました。';
          }
        }
      );
    }

    // --- 出目 24: 沼エルフの行商人 (固有商品ショップ) ---
    if (event.d66Code === '24') {
      choices.push(
        {
          id: 'tk_buy_ale',
          label: '🍺 【エール酒の大瓶】を購入 (金貨8枚 / 人間型ワイロ軽減)',
          disabled: character.value.gold < 8,
          onSelect: () => {
            if (character.value.gold < 8) return;
            character.value.gold -= 8;
            const charges = Math.max(2, Math.floor(Math.random() * 6) + 1);
            character.value.items.push({
              id: 'ale_' + Date.now(),
              name: 'エール酒の大瓶',
              type: 'consumable',
              charges,
              goldCost: 8,
              value: 4,
              description: `芳醇なエール酒の大瓶（${charges}回分）。人間型クリーチャーへのワイロ支払いを軽減する。`
            });
            addLog(`🍺 沼エルフの行商人から【エール酒の大瓶（${charges}回分）】を購入しました！`, 'success');
          }
        },
        {
          id: 'tk_buy_tag',
          label: '🪪 【認識票】を購入 (金貨5枚 / 人間型・ラミアを友好的にする)',
          disabled: character.value.gold < 5,
          onSelect: () => {
            if (character.value.gold < 5) return;
            character.value.gold -= 5;
            character.value.items.push({
              id: 'tag_' + Date.now(),
              name: '認識票',
              type: 'consumable',
              charges: 1,
              goldCost: 5,
              value: 2,
              description: 'ダンジョン内クリーチャーの認識票。人間型やラミア遭遇時に提示すると友好的になる（1回限り）。'
            });
            addLog('🪪 沼エルフの行商人から【認識票】を購入しました！', 'success');
          }
        },
        {
          id: 'tk_buy_potion',
          label: '🧪 【治療のポーション】を購入 (金貨10枚 / 生命力全回復)',
          disabled: character.value.gold < 10,
          onSelect: () => {
            if (character.value.gold < 10) return;
            character.value.gold -= 10;
            character.value.items.push({
              id: 'potion_' + Date.now(),
              name: '治療のポーション',
              type: 'healingpotion',
              charges: 1,
              goldCost: 10,
              value: 5,
              description: '生命力を最大値まで回復する薬瓶（冒険中1回のみ使用可能）。'
            });
            addLog('🧪 沼エルフの行商人から【治療のポーション】を購入しました！', 'success');
          }
        },
        {
          id: 'tk_buy_balloon',
          label: '🎈 【囮の風船】を購入 (金貨6枚 / 戦わない従者の身代わり)',
          disabled: character.value.gold < 6,
          onSelect: () => {
            if (character.value.gold < 6) return;
            character.value.gold -= 6;
            character.value.items.push({
              id: 'balloon_' + Date.now(),
              name: '囮の風船',
              type: 'consumable',
              charges: 1,
              goldCost: 6,
              value: 3,
              description: '実物大の人形風船。戦わない従者がダメージを受ける時、身代わりとなって破裂する（1回限り）。'
            });
            addLog('🎈 沼エルフの行商人から【囮の風船】を購入しました！', 'success');
          }
        },
        {
          id: 'tk_buy_leave',
          label: '🚶 買い物を終えて先へ進む',
          onSelect: () => {
            addLog('沼エルフの行商人に礼を言い、先へ進みました。', 'info');
            event.isResolved = true;
            event.resolutionText = '沼エルフの行商人との取引を終え、部屋を後にしました。';
          }
        }
      );
    }

    // --- 出目 25: ホブゴブリン (道案内 / 迷宮進行度 +1) ---
    if (event.d66Code === '25') {
      choices.push({
        id: 'tk_hobgoblin_guide',
        label: '🗺️ ホブゴブリンに近道を案内してもらう (迷宮進行度 +1)',
        onSelect: () => {
          dungeonDepth.value = Math.min(8, dungeonDepth.value + 1);
          addLog('🗺️ ホブゴブリンから迷宮の近道を教えてもらい、安全に奥へ進みました！ (迷宮進行度 +1)', 'success');
          event.isResolved = true;
          event.resolutionText = 'ホブゴブリンの案内により、迷宮の奥へとショートカットしました。';
        }
      });
    }

    // --- 出目 26: コビットの旅人 (案内 / 小休止) ---
    if (event.d66Code === '26') {
      choices.push(
        {
          id: 'tk_cobbit_guide',
          label: '🗺️ コビットに安全な抜け道を教えてもらう (迷宮進行度 +1)',
          onSelect: () => {
            dungeonDepth.value = Math.min(8, dungeonDepth.value + 1);
            addLog('🗺️ コビットの旅人から安全な抜け道を教わりました！ (迷宮進行度 +1)', 'success');
            event.isResolved = true;
            event.resolutionText = 'コビットの案内により、安全に先へ進みました。';
          }
        },
        {
          id: 'tk_cobbit_rest',
          label: '☕ コビットと温かい茶を飲んで休む (生命力 +2 回復)',
          onSelect: () => {
            character.value.lifeCurrent = Math.min(character.value.lifeMax, character.value.lifeCurrent + 2);
            addLog('☕ コビットの淹れた薬草茶を飲み、心身が癒やされました！ (生命力 +2 回復)', 'success');
            event.isResolved = true;
            event.resolutionText = 'コビットとお茶を酌み交わし、活力を取り戻しました。';
          }
        }
      );
    }

    // --- 出目 32: 放浪の狩猟者 ---
    if (event.d66Code === '32') {
      choices.push(
        {
          id: 'tk_hunter_accept',
          label: '🤝 依頼を引き受ける (次回の部屋の十の位を5に指定 / 討伐後金貨10枚＆進行度+2)',
          onSelect: () => {
            hunterQuestAccepted = true;
            if (nextRoomTensDigitOverride) {
              nextRoomTensDigitOverride.value = 5;
            }
            addLog('🏹 放浪の狩猟者の依頼を引き受けました！', 'success');
            addLog('🚨 次回の部屋探索の十の位が [ 5 ] に指定されました。敵を倒せば報酬が得られます！', 'info');
            event.isResolved = true;
            event.resolutionText = '🏹 放浪の狩猟者から依頼を受けました。\n「すぐ隣の部屋です。怪物を仕留めてくだされば報酬をお渡しします」\n次回の部屋探索の十の位が [ 5 ] に固定されます。';
          }
        },
        {
          id: 'tk_hunter_decline',
          label: '✋ 今は先を急ぐため断る',
          onSelect: () => {
            addLog('狩猟者の依頼を丁重に断り、先へ進みました。', 'info');
            event.isResolved = true;
            event.resolutionText = '放浪の狩猟者の依頼を断り、先へ進みました。';
          }
        }
      );
    }

    // --- 出目 33: 名もなき英雄の祭壇 ---
    if (event.d66Code === '33') {
      choices.push(
        {
          id: 'tk_altar_pray',
          label: '🙏 祭壇に祈りを捧げる (1d6ロール: 1-3で金貨3枚 / 4-6で生命力+6点回復)',
          onSelect: async () => {
            if (!rollD6) return;
            const roll = await rollD6(false);
            if (roll <= 3) {
              character.value.gold += 3;
              addLog(`🙏 祭壇に祈りを捧げると、台座の隙間から金貨3枚を発見しました！ (出目: [ ${roll} ])`, 'success');
              event.resolutionText = `🙏 名もなき英雄の祭壇に祈りを捧げました。\n出目 [ ${roll} ] (1〜3)\nかつての巡礼者が残した金貨 3 枚を発見しました。`;
            } else {
              const oldLife = character.value.lifeCurrent;
              character.value.lifeCurrent = Math.min(character.value.lifeMax, character.value.lifeCurrent + 6);
              const healed = character.value.lifeCurrent - oldLife;
              addLog(`✨ 祭壇から神聖な光が溢れ、生命力が ${healed} 点回復しました！ (出目: [ ${roll} ])`, 'success');
              event.resolutionText = `✨ 名もなき英雄の祭壇に祈りを捧げました。\n出目 [ ${roll} ] (4〜6)\n暖かな光に包まれ、生命力が ${healed} 点回復しました！`;
            }
            event.isResolved = true;
          }
        },
        {
          id: 'tk_altar_pass',
          label: '🚶 祈らずに通り過ぎる',
          onSelect: () => {
            addLog('祭壇の前を一礼して通り過ぎました。', 'info');
            event.isResolved = true;
            event.resolutionText = '祭壇に一礼し、先を急ぎました。';
          }
        }
      );
    }

    // --- 出目 34: 迷宮の野営地 (既存維持) ---
    if (event.d66Code === '34') {
      choices.push(
        {
          id: 'tk_rest_roll',
          label: '⛺ 小休止を取る (1d6ロール: 2以上で回復 / 1で次回十の位5固定)',
          onSelect: async () => {
            if (!rollD6) return;
            const roll = await rollD6(false);
            if (roll >= 2) {
              const oldLife = character.value.lifeCurrent;
              const oldSub = character.value.subStatCurrent;
              character.value.lifeCurrent = Math.min(character.value.lifeMax, character.value.lifeCurrent + 1);
              character.value.subStatCurrent = Math.min(character.value.subStatMax, character.value.subStatCurrent + 1);
              const recoveredLife = character.value.lifeCurrent - oldLife;
              const recoveredSub = character.value.subStatCurrent - oldSub;
              addLog(`⛺ 迷宮の野営地で休息を取りました！ (出目: [ ${roll} ] >= 2)`, 'success');
              addLog(`❤️ 生命力を ${recoveredLife} 点、副能力値を ${recoveredSub} 点 回復しました！`, 'success');
              event.isResolved = true;
              event.resolutionText = `⛺ 小休止に成功しました！\n出目 [ ${roll} ] (2以上で成功)\n生命力を ${recoveredLife} 点、副能力値を ${recoveredSub} 点回復し、心身を休めました。`;
            } else {
              if (nextRoomTensDigitOverride) {
                nextRoomTensDigitOverride.value = 5;
              }
              addLog(`⚠️ 野営中に物音を立ててしまいました！ (出目: [ 1 ])`, 'error');
              addLog(`🚨 次回の部屋探索の十の位が [ 5 ] に固定されます！`, 'error');
              event.isResolved = true;
              event.resolutionText = `⚠️ 野営中に敵の気配に勘づかれてしまいました！\n出目 [ 1 ] (休息失敗)\n次回部屋探索時の十の位の出目が [ 5 ] に固定されます。`;
            }
          }
        },
        {
          id: 'tk_rest_skip',
          label: '🚶 休息を取らずに先へ進む',
          onSelect: () => {
            addLog('野営地を通り過ぎ、慎重に探索を続けます。', 'info');
            event.isResolved = true;
            event.resolutionText = '休息を取らずに部屋を通り過ぎました。';
          }
        }
      );
    }

    // --- 出目 35: 不吉な彫像 ---
    if (event.d66Code === '35') {
      choices.push(
        {
          id: 'tk_statue_take',
          label: '🗿 彫像を背負って持ち帰る (生還時に金貨50枚で売却可能)',
          onSelect: () => {
            character.value.items.push({
              id: 'statue_' + Date.now(),
              name: '不吉な彫像',
              type: 'consumable',
              goldCost: 0,
              value: 50,
              description: '精巧だが禍々しい彫像。地上に持ち帰れば金貨50枚で好事家に売却できる。'
            });
            addLog('🗿 重厚な『不吉な彫像』を背嚢に詰め込みました！ 生還時に金貨50枚で売却できます。', 'success');
            event.isResolved = true;
            event.resolutionText = '不吉な彫像を手に入れました。生還時に高値で売却できます。';
          }
        },
        {
          id: 'tk_statue_leave',
          label: '✋ 不気味なので触らずに先へ進む',
          onSelect: () => {
            addLog('禍々しい気配を感じ、彫像には手を触れずに通り過ぎました。', 'info');
            event.isResolved = true;
            event.resolutionText = '彫像を無視して先へ進みました。';
          }
        }
      );
    }

    // --- 出目 55: 迷い込んだ愛猫 ---
    if (event.d66Code === '55') {
      choices.push(
        {
          id: 'tk_cat_hug',
          label: '🐈 優しく抱き上げる (心癒やされ生命力 +1 回復 / 戦闘回避)',
          onSelect: () => {
            character.value.lifeCurrent = Math.min(character.value.lifeMax, character.value.lifeCurrent + 1);
            addLog('🐈 猫を優しく抱き上げると、喉を鳴らして擦り寄ってきました。心癒やされ生命力が1点回復しました！', 'success');
            event.isResolved = true;
            event.resolutionText = '迷い込んだ愛猫を優しく保護しました。無用な争いを避け、穏やかな時間が流れました。';
          }
        }
      );
    }

    if (choices.length > 0) {
      event.customChoices = choices;
    }
  },

  async onCombatStart(context: ScenarioPluginContext) {
    const { activeEvent, character, combatState, addLog, endCombat, rollD6 } = context;
    if (!activeEvent.value) return;

    const event = activeEvent.value;

    // --- 出目 12: 認識票の利用 (人間型またはラミア遭遇時に友好的にして回避) ---
    const tagIndex = character.value.items.findIndex(it => it.name === '認識票');
    if (tagIndex !== -1 && !identificationTagUsed && isHumanOrLamia(event)) {
      character.value.items.splice(tagIndex, 1);
      identificationTagUsed = true;
      addLog('🪪 【認識票】を堂々と掲げて見せました！', 'success');
      addLog('🤝 相手はあなたたちを迷宮の仲間だと認識し、敵対を解いて友好的になりました！ (戦闘回避 / 認識票消費)', 'success');
      if (endCombat) {
        endCombat(true, false);
      }
      return;
    }

    // --- 出目 52: 大ネズミの大群 (カチカチのチーズで回避 / 出現数 2d6+2) ---
    if (event.d66Code === '52' || event.title.includes('大ネズミ')) {
      const cheeseItem = character.value.items.find(it => it.name === 'カチカチになったチーズ');
      if (cheeseItem) {
        if (cheeseItem.charges && cheeseItem.charges > 1) {
          cheeseItem.charges--;
          addLog(`🧀 【カチカチになったチーズ】を投げ与えました！ (残り: ${cheeseItem.charges}pt)`, 'success');
        } else {
          character.value.items = character.value.items.filter(it => it.id !== cheeseItem.id);
          addLog('🧀 【カチカチになったチーズ】を投げ与えました！ (チーズを使い果たしました)', 'success');
        }
        addLog('🐀 大ネズミの大群は転がってきたチーズに殺到し、貪り食っています！ その隙に無傷で通り抜けました！', 'success');
        if (endCombat) {
          endCombat(true, false);
        }
        return;
      }
      // 出現数を 2d6+2 に調整
      if (rollD6 && combatState.enemies.length > 0) {
        const r1 = await rollD6(false);
        const r2 = await rollD6(false);
        const totalRats = r1 + r2 + 2;
        combatState.enemies[0].count = totalRats;
        addLog(`🐀 大ネズミの大群が湧き出しました！ (出現数: 2d6 [ ${r1}+${r2} ] + 2 = ${totalRats} 匹)`, 'info');
      }
    }

    // --- 出目 53: ゴートマンの装備ダイス ---
    if (event.d66Code === '53' || combatState.enemies.some((e: Enemy) => e.name.includes('ゴートマン'))) {
      if (rollD6) {
        const roll = await rollD6(false);
        const goatman = combatState.enemies.find((e: Enemy) => e.name.includes('ゴートマン'));
        if (goatman) {
          if (roll === 1) {
            goatman.modAttack = (goatman.modAttack || 0) + 1;
            addLog(`🐐 ゴートマンは【巨大な斧】を構えている！ (出目: [ 1 ] 攻撃力 +1)`, 'error');
          } else if (roll === 2) {
            goatman.weaponAttribute = 'ranged';
            addLog(`🐐 ゴートマンは【狩猟弓】を構えている！ (出目: [ 2 ] 射撃属性)`, 'error');
          } else if (roll === 3) {
            goatman.level += 1;
            addLog(`🐐 ゴートマンは【鉄の盾】を構えて身を固めた！ (出目: [ 3 ] 防御目標値 +1)`, 'error');
          } else {
            addLog(`🐐 ゴートマンは通常の装備で身構えている。(出目: [ ${roll} ])`, 'info');
          }
        }
      }
    }

    // --- 出目 63: 闇エルフの狙撃手 (不意打ち先制射撃 & 反応表不可) ---
    if (event.d66Code === '63' || combatState.enemies.some((e: Enemy) => e.name.includes('闇エルフ'))) {
      if (rollD6) {
        const ambushRoll = await rollD6(false);
        if (ambushRoll <= 5) {
          combatState.hasReactionChecked = true;
          addLog(`🎯 暗闇から闇エルフの狙撃手が不意打ちの矢を放ってきた！ (出目: [ ${ambushRoll} ] <= 5 / 反応判定不可)`, 'error');
          const defRoll = await rollD6(true);
          if (defRoll >= 4 || defRoll === 6) {
            addLog(`🛡️ 矢の飛来を察知し、間一髪で見事に回避した！ (防御ロール: [ ${defRoll} ] >= 4)`, 'success');
          } else {
            character.value.lifeCurrent = Math.max(0, character.value.lifeCurrent - 1);
            addLog(`💥 不意打ちの矢が肩を射抜いた！ 1点のダメージを受けた！ (防御ロール: [ ${defRoll} ] < 4 / 残り生命力: ${character.value.lifeCurrent})`, 'damage');
          }
        } else {
          addLog(`👀 闇エルフの狙撃手はこちらの接近に気づいて身構えた！ (出目: [ ${ambushRoll} ] = 6 / 不意打ちは失敗し、通常遭遇となります)`, 'info');
        }
      }
    }

    // --- 出目 64: ホブゴブリンの警備隊長 (ゴブリン護衛群の召喚) ---
    if (event.d66Code === '64' || combatState.enemies.some((e: Enemy) => e.id === 'captain' || e.name.includes('警備隊長'))) {
      const hasGuards = combatState.enemies.some((e: Enemy) => e.id.includes('guard'));
      if (!hasGuards) {
        combatState.enemies.push(
          {
            id: 'guard_1',
            name: '警備ゴブリンA',
            level: 4,
            lifeMax: 1,
            lifeCurrent: 1,
            attackCount: 1,
            count: 1,
            tags: ['weak'],
            weaponAttribute: 'slash'
          },
          {
            id: 'guard_2',
            name: '警備ゴブリンB',
            level: 4,
            lifeMax: 1,
            lifeCurrent: 1,
            attackCount: 1,
            count: 1,
            tags: ['weak'],
            weaponAttribute: 'slash'
          }
        );
        addLog('📢 警備隊長が号令を下し、2体の警備ゴブリンが護衛として前線に駆けつけた！', 'error');
      }
    }
  },

  async onCombatRoundEnd(context: ScenarioPluginContext) {
    const { combatState, character, addLog } = context;
    
    // --- 出目 51: ゴブリンの突撃兵 (第1ラウンド終了時の自爆) ---
    const assaultGoblinIndex = combatState.enemies.findIndex((e: Enemy) => e.id === 'goblin_assault' || e.name.includes('突撃兵'));
    if (assaultGoblinIndex !== -1 && combatState.round === 1) {
      const goblin = combatState.enemies[assaultGoblinIndex];
      addLog(`💥 【${goblin.name}】が導火線尽きた爆弾を抱えて突撃・自爆した！`, 'error');
      // 誰か1人が2点ダメージ
      character.value.lifeCurrent = Math.max(0, character.value.lifeCurrent - 2);
      addLog(`💥 爆発の直撃を受け、主人公は生命力に 2 点のダメージを受けた！ (残り生命力: ${character.value.lifeCurrent})`, 'damage');
      // 突撃兵自身は死亡
      combatState.enemies.splice(assaultGoblinIndex, 1);
    }
  },

  async onResolveDefenseAttack(
    context: ScenarioPluginContext,
    enemy: Enemy,
    _attack: any,
    defSuccess: boolean,
    _roll: number,
    _total: number,
    isHero: boolean,
    defenderId: string
  ) {
    const { character, followers, addLog, rollD6 } = context;

    // --- 出目 13: 囮の風船による従者の身代わり防御 ---
    if (!defSuccess && !isHero) {
      const balloonIndex = character.value.items.findIndex(it => it.name === '囮の風船');
      const follower = followers.value.find(f => f.id === defenderId);
      const isNonCombatant = follower && (
        follower.type === 'porter' ||
        follower.type === 'lantern' ||
        follower.name.includes('荷運び') ||
        follower.name.includes('ランタン')
      );
      if (balloonIndex !== -1 && isNonCombatant) {
        character.value.items.splice(balloonIndex, 1);
        addLog(`🎈 【囮の風船】が身代わりとなって破裂し、従者【${follower.name}】への致命傷を防ぎました！`, 'success');
        if (follower) {
          follower.lifeCurrent = Math.max(1, follower.lifeCurrent);
        }
        return;
      }
    }

    if (!defSuccess) {
      // --- 出目 54: さまよう死霊の「呪い」付与 ---
      if (enemy.id === 'specter' || enemy.name.includes('死霊')) {
        addLog('👻 死霊の冷気あふれる一撃を受けた！ 【幸運ロール】で呪いに抵抗します (目標値: 4)', 'info');
        if (rollD6) {
          const luckRoll = await rollD6(true);
          if (luckRoll >= 4 || luckRoll === 6) {
            addLog(`✨ 幸運ロール成功！ (出目: [ ${luckRoll} ] >= 4) 死霊の呪いを跳ね返した！`, 'success');
          } else {
            if (!character.value.statusEffects) {
              character.value.statusEffects = [];
            }
            if (!character.value.statusEffects.includes('呪い')) {
              character.value.statusEffects.push('呪い');
              addLog(`💀 幸運ロール失敗！ (出目: [ ${luckRoll} ] < 4) 主人公は【呪い】を受けてしまった！`, 'error');
            }
          }
        }
      }

      // --- 出目 61: ラミアの戦輪使いの吸血 ---
      if (enemy.id === 'lamia' || enemy.name.includes('ラミア')) {
        if (enemy.lifeCurrent < enemy.lifeMax) {
          enemy.lifeCurrent = Math.min(enemy.lifeMax, enemy.lifeCurrent + 1);
          addLog(`🩸 ラミアは流れた血をすすり、生命力を 1 点回復した！ (現在生命力: ${enemy.lifeCurrent}/${enemy.lifeMax})`, 'error');
        }
      }

      // --- 出目 62: バンダースナッチ (HP3の倍数の相手への噛み砕き強打) ---
      if (enemy.id === 'bandersnatch' || enemy.name.includes('バンダースナッチ')) {
        if (character.value.lifeCurrent > 0 && character.value.lifeCurrent % 3 === 0) {
          character.value.lifeCurrent = Math.max(0, character.value.lifeCurrent - 1);
          addLog(`🦷 バンダースナッチの凶悪な牙が骨を砕く！ 追加で 1 点のダメージ！ (残り生命力: ${character.value.lifeCurrent})`, 'damage');
        }
      }
    }
  },

  async onTrapResolve(context: ScenarioPluginContext, result: { success: boolean; roll: number }) {
    const { activeEvent, character, followers, addLog, rollD6 } = context;
    if (!activeEvent.value) return;

    // --- 出目 42: 油の入った壷 (ランタン所持時の火傷 1d3 ダメージ) ---
    if (activeEvent.value.d66Code === '42' && !result.success) {
      const hasLantern = character.value.items.some(it => it.type === 'lantern' || it.name.includes('ランタン')) ||
        followers.value.some(f => f.type === 'lantern' || f.name.includes('ランタン'));

      if (hasLantern && rollD6) {
        addLog('🔥 ランタンの火が全身に被った油に燃え移りました！ 火傷ダメージロール (1d3)...', 'error');
        const d6 = await rollD6(false);
        const burnDamage = Math.ceil(d6 / 2); // 1d3: 1-2->1, 3-4->2, 5-6->3
        character.value.lifeCurrent = Math.max(0, character.value.lifeCurrent - burnDamage);
        addLog(`💥 ランタンの引火により、火傷で ${burnDamage} 点の追加ダメージを受けました！ (出目: [ ${d6} ] -> ${burnDamage}点 / 残り生命力: ${character.value.lifeCurrent})`, 'damage');
      }
    }
  },

  async onCombatVictory(context: ScenarioPluginContext) {
    const { activeEvent, nextRoomTensDigitOverride, addLog, rollD6, character, dungeonDepth } = context;
    if (!activeEvent.value) return;

    // --- 出目 32: 狩猟者の依頼達成 ---
    if (hunterQuestAccepted) {
      hunterQuestAccepted = false;
      character.value.gold += 10;
      dungeonDepth.value = Math.min(8, dungeonDepth.value + 2);
      addLog('🏹 放浪の狩猟者からの依頼を達成しました！', 'success');
      addLog('💰 報酬として金貨 10 枚を受け取り、狩猟者の案内で一気に迷宮の奥へ進みました！ (迷宮進行度 +2)', 'success');
    }

    // --- 出目 51: ゴブリンの突撃兵の爆発音幸運ロール ---
    const hasGoblinAssault = activeEvent.value.enemies?.some(e => e.id === 'goblin_assault') ||
      activeEvent.value.d66Code === '51';

    if (hasGoblinAssault && rollD6) {
      addLog('🍀 ゴブリンの突撃兵が倒れた！ 爆発音を警戒する【幸運ロール】を行います (目標値: 4)', 'info');
      const roll = await rollD6(true);
      if (roll >= 4 || roll === 6) {
        addLog(`✨ 幸運ロール成功！ (出目: [ ${roll} ] >= 4) 爆発音は遠くの怪物には届かなかったようだ。`, 'success');
      } else {
        if (nextRoomTensDigitOverride) {
          nextRoomTensDigitOverride.value = 5;
        }
        addLog(`💥 幸運ロール失敗！ (出目: [ ${roll} ] < 4) 激しい爆発音が迷宮中に響き渡った！`, 'error');
        addLog('🚨 爆発音に引き寄せられ、次回の部屋探索の十の位が [ 5 ] に固定されます！', 'error');
      }
    }
  },

  onAdventureEnd(context: ScenarioPluginContext) {
    const { character, addLog } = context;
    // --- 出目 35: 不吉な彫像の地上売却 (金貨50枚) ---
    const statueIndex = character.value.items.findIndex(it => it.name === '不吉な彫像');
    if (statueIndex !== -1) {
      character.value.items.splice(statueIndex, 1);
      character.value.gold += 50;
      addLog('🗿 地上に戻り、持ち帰った『不吉な彫像』を好事家に売却しました！ 金貨 50 枚を獲得！', 'success');
    }
  }
};
