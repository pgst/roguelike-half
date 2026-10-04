import type { ScenarioPlugin, ScenarioPluginContext } from './index';

export const twilightKnightPlugin: ScenarioPlugin = {
  id: 'twilight_knight',

  onExploreRoom(context: ScenarioPluginContext) {
    const { activeEvent, nextRoomTensDigitOverride, addLog, rollD6, character } = context;
    if (!activeEvent.value) return;

    // 出目 34: 迷宮の野営地 (Dungeon Encampment)
    if (activeEvent.value.d66Code === '34') {
      activeEvent.value.customChoices = [
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
              activeEvent.value!.isResolved = true;
              activeEvent.value!.resolutionText = `⛺ 小休止に成功しました！\n出目 [ ${roll} ] (2以上で成功)\n生命力を ${recoveredLife} 点、副能力値を ${recoveredSub} 点回復し、心身を休めました。`;
            } else {
              if (nextRoomTensDigitOverride) {
                nextRoomTensDigitOverride.value = 5;
              }
              addLog(`⚠️ 野営中に物音を立ててしまいました！ (出目: [ 1 ])`, 'error');
              addLog(`🚨 次回の部屋探索の十の位が [ 5 ] に固定されます！`, 'error');
              activeEvent.value!.isResolved = true;
              activeEvent.value!.resolutionText = `⚠️ 野営中に敵の気配に勘づかれてしまいました！\n出目 [ 1 ] (休息失敗)\n次回部屋探索時の十の位の出目が [ 5 ] に固定されます。`;
            }
          }
        },
        {
          id: 'tk_rest_skip',
          label: '🚶 休息を取らずに先へ進む',
          onSelect: () => {
            addLog('野営地を通り過ぎ、慎重に探索を続けます。', 'info');
            activeEvent.value!.isResolved = true;
            activeEvent.value!.resolutionText = '休息を取らずに部屋を通り過ぎました。';
          }
        }
      ];
    }

    // 出目 32: 放浪の狩猟者 (Wandering Hunter)
    if (activeEvent.value.d66Code === '32') {
      activeEvent.value.customChoices = [
        {
          id: 'tk_hunter_accept',
          label: '🤝 依頼を引き受ける (次回の部屋の十の位を5に指定)',
          onSelect: () => {
            if (nextRoomTensDigitOverride) {
              nextRoomTensDigitOverride.value = 5;
            }
            addLog('🏹 放浪の狩猟者の依頼を引き受けました！', 'success');
            addLog('🚨 次回の部屋探索の十の位が [ 5 ] に指定されました。', 'info');
            activeEvent.value!.isResolved = true;
            activeEvent.value!.resolutionText = '🏹 放浪の狩猟者から依頼を受けました。\n「すぐ隣の部屋です」\n次回の部屋探索の十の位が [ 5 ] に固定されます。';
          }
        },
        {
          id: 'tk_hunter_decline',
          label: '✋ 今は先を急ぐため断る',
          onSelect: () => {
            addLog('狩猟者の依頼を丁重に断り、先へ進みました。', 'info');
            activeEvent.value!.isResolved = true;
            activeEvent.value!.resolutionText = '放浪の狩猟者の依頼を断り、先へ進みました。';
          }
        }
      ];
    }

    // 出目 22: 末裔 (Descendant of Fish God)
    if (activeEvent.value.d66Code === '22') {
      activeEvent.value.customChoices = [
        {
          id: 'tk_fish_friendly',
          label: '🐟 隠し通路を教えてもらう (次回の部屋の十の位を2に指定)',
          onSelect: () => {
            if (nextRoomTensDigitOverride) {
              nextRoomTensDigitOverride.value = 2;
            }
            addLog('🐟 末裔から水場の隠し通路の存在を教えてもらいました！', 'success');
            addLog('🌊 次回の部屋探索の十の位が [ 2 ] (水場のある部屋) に指定されました。', 'info');
            activeEvent.value!.isResolved = true;
            activeEvent.value!.resolutionText = '🐟 末裔と心を通わせ、水場へと通じる隠し通路を教わりました。\n次回の部屋探索の十の位が [ 2 ] に固定されます。';
          }
        },
        {
          id: 'tk_fish_leave',
          label: '🚶 会話を終えて先へ進む',
          onSelect: () => {
            addLog('末裔たちの部屋を後にしました。', 'info');
            activeEvent.value!.isResolved = true;
            activeEvent.value!.resolutionText = '末裔たちとの遭遇を終え、先へ進みました。';
          }
        }
      ];
    }
  },

  async onCombatVictory(context: ScenarioPluginContext) {
    const { activeEvent, nextRoomTensDigitOverride, addLog, rollD6 } = context;
    if (!activeEvent.value) return;

    // 出目 51: ゴブリンの突撃兵 (Goblin Assault)
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
  }
};
