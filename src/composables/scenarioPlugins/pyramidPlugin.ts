import type { Ref } from 'vue';
import type { Character, DungeonEvent, Follower } from '../../types';

// Expose reactive functions to trigger combat or logs
let addLogFn: (msg: string, type: 'info' | 'success' | 'error' | 'damage' | 'roll') => void = () => {};
let startEncounterFn: () => void = () => {};

export function setPyramidHelpers(
  log: typeof addLogFn,
  startEnc: typeof startEncounterFn
) {
  addLogFn = log;
  startEncounterFn = startEnc;
}

export const pyramidPlugin = {
  id: 'pyramid_of_chronodemon',

  onAdventureStart(character: Ref<Character>) {
    // Reset food to 2 at the start of each adventure run (cannot carry over, max 2)
    character.value.food = 2;

    const run = (character.value as any).pyramidRunCount || 1;
    
    // Clear previous scenario items to prevent duplicates
    character.value.items = character.value.items.filter(
      i => i.id !== 'golden_brooch' && i.id !== 'sealing_pot' && i.id !== 'cactus_earrings' &&
           i.id !== 'angels_helmet' && i.id !== 'angels_amulet' && i.id !== 'demon_slayer_sword'
    );
    character.value.weapons = character.value.weapons.filter(
      w => w.name !== '悪魔殺しの剣' && w.name !== 'シルバーダガー'
    );
    character.value.shields = character.value.shields.filter(
      s => s.name !== '大地の大盾'
    );

    if (run === 1) {
      (character.value as any).pyramidOriginChosen = false;
    }

    // Reset preparation state for the new run
    (character.value as any).pyramidPrepRun = 0;
    (character.value as any).pyramidSliderShopDone = false;
  },

  onCombatStart(combatState: any, _character: Ref<Character>, followers: Ref<Follower[]>) {
    const hasAnts = combatState.enemies.some((e: any) => e.name.includes('アリ人'));
    if (hasAnts && (combatState as any).antSpitCheckPending === undefined) {
      (combatState as any).antSpitCheckPending = true;
      const numAnts = combatState.enemies.length;
      const spitAntsCount = Math.floor(numAnts / 2);
      addLogFn(`🐜 アリ人の群れがギ酸の唾を飛ばしてきました！ (第0ラウンド・遠距離攻撃 - 射手: ${spitAntsCount}体)`, 'error');
      
      if (spitAntsCount > 0) {
        const pRoll = Math.floor(Math.random() * 6) + 1;
        addLogFn(`🧍 主人公の防御ロール: 出目 ${pRoll} (目標値: 4)`, 'roll');
        if (pRoll < 4) {
          addLogFn('🤢 ギ酸の唾が目に入り、視界がかすんだ！ (戦闘終了まで攻撃ロール-1ペナルティ)', 'damage');
          (combatState as any).antSpitPenalty = true;
        } else {
          addLogFn('🛡️ 主人公はギ酸の唾を回避しました！', 'success');
        }
        
        followers.value.forEach(f => {
          if (f.lifeCurrent > 0 && f.isCombatant) {
            const fRoll = Math.floor(Math.random() * 6) + 1;
            addLogFn(`👥 従者 [${f.name}] の防御ロール: 出目 ${fRoll} (目標値: 4)`, 'roll');
            if (fRoll < 4) {
              addLogFn(`🤢 従者 [${f.name}] は視界がかすんだ！ (戦闘終了まで攻撃ロール-1ペナルティ)`, 'damage');
              if (!(combatState as any).followerAccuracyModifiers) {
                (combatState as any).followerAccuracyModifiers = {};
              }
              (combatState as any).followerAccuracyModifiers[f.name] = -1;
            } else {
              addLogFn(`🛡️ 従者 [${f.name}] はギ酸の唾を回避しました！`, 'success');
            }
          }
        });
      }
    }
  },

  async onExploreRoom(event: DungeonEvent, character: Ref<Character>) {
    const d66 = event.d66Code;

    // Room 24: Repairing Ant Folk
    if (d66 === '24' && !(event as any).choicesInitialized) {
      (event as any).choicesInitialized = true;
      setupAntFolkChoices(event, character);
    }

    // Room 12: Giant Spider Web
    if (d66 === '12' && !(event as any).choicesInitialized) {
      (event as any).choicesInitialized = true;
      setupSpiderWebChoices(event, character);
    }

    // Room 44: Riddle Sphinx
    if (d66 === '44' && !(event as any).choicesInitialized) {
      (event as any).choicesInitialized = true;
      setupSphinxRiddleChoices(event, character);
    }

    // Room 26: Chatty Sphinx (headache damage unless player has cactus earrings)
    if (d66 === '26' && !event.isResolved) {
      const hasEarrings = character.value.items.some(i => i.id === 'cactus_earrings');
      if (hasEarrings) {
        addLogFn('🌵 『サボテンの耳飾り』を装着しているため、スフィンクスの退屈な長話による頭痛の災難を回避しました！', 'success');
      } else {
        addLogFn('🤯 スフィンクスの支離滅裂な長話により、激しい頭痛に襲われました！', 'error');
        // Simple D6 roll for headache
        addLogFn('生命ロール（目標値: 8 / 技量点判定）を開始します...', 'info');
      }
    }
  },

  onAdventureEnd(character: Ref<Character>) {
    // Return Golden Brooch to king
    const beforeLen = character.value.items.length;
    character.value.items = character.value.items.filter(i => i.id !== 'golden_brooch');
    if (character.value.items.length < beforeLen) {
      addLogFn('👑 冒険が無事終了したため、『黄金虫のブローチ』を王へ返却しました。', 'info');
    }
  }
};

// -------------------------------------------------------------
// Room 12: Spider Web Choice Builder
// -------------------------------------------------------------
function setupSpiderWebChoices(event: DungeonEvent, character: Ref<Character>) {
  (event as any).customChoices = [
    {
      id: 'web_mace',
      label: '🗡️ 片手武器（打撃）を獲る 【筋力判定: 3】',
      checkStat: 'strength',
      checkTarget: 3,
      onSelect: (res: any) => handleWebRetrieve(event, 'mace', res, character)
    },
    {
      id: 'web_axe',
      label: '🪓 両手武器（斬撃）を獲る 【器用判定: 3】',
      checkStat: 'dexterity',
      checkTarget: 3,
      onSelect: (res: any) => handleWebRetrieve(event, 'axe', res, character)
    },
    {
      id: 'web_scimitar',
      label: '⚔️ 円月刀（斬撃）を獲る 【器用判定: 5】',
      checkStat: 'dexterity',
      checkTarget: 5,
      onSelect: (res: any) => handleWebRetrieve(event, 'scimitar', res, character)
    },
    {
      id: 'web_arrow',
      label: '🏹 影縫いの矢を獲る 【幸運判定: 6】',
      checkStat: 'luck',
      checkTarget: 6,
      onSelect: (res: any) => handleWebRetrieve(event, 'arrow', res, character)
    },
    {
      id: 'web_leave',
      label: '🏃 このまま部屋を立ち去る',
      onSelect: () => {
        event.isResolved = true;
        event.resolutionText = '蜘蛛の巣の武器には手を出さず、静かに部屋を立ち去りました。';
        (event as any).customChoices = null;
      }
    }
  ];
}

function handleWebRetrieve(
  event: DungeonEvent,
  itemType: 'mace' | 'axe' | 'scimitar' | 'arrow',
  res: { success: boolean; roll: number; total: number },
  character: Ref<Character>
) {
  // If fumble (roll 1), spawn Giant Spiders!
  if (res.roll === 1) {
    addLogFn('💀 ファンブル！ 蜘蛛の巣が激しく揺れ、潜んでいた大グモの群れが襲いかかってきました！', 'error');
    // Lose equipped weapon if they had one
    loseEquippedMeleeWeapon(character);
    
    // Set event to encounter
    event.type = 'encounter';
    event.enemies = [
      { name: '大グモ A', level: 4, lifeMax: 3, lifeCurrent: 3, attackCount: 1, tags: ['weak'], count: 1, weaponAttribute: 'slash' },
      { name: '大グモ B', level: 4, lifeMax: 3, lifeCurrent: 3, attackCount: 1, tags: ['weak'], count: 1, weaponAttribute: 'slash' }
    ];
    (event as any).customChoices = null;
    startEncounterFn();
    return;
  }

  if (res.success) {
    let itemName = '';
    if (itemType === 'mace') {
      itemName = '片手武器 (長剣/メイス)';
      character.value.weapons.push({
        name: itemName,
        type: 'one-handed',
        modAttack: 0,
        attribute: 'strike',
        goldCost: 5,
        isMagic: false,
        description: '標準的な片手用近接武器。攻撃特性：打撃。'
      });
    } else if (itemType === 'axe') {
      itemName = '両手武器 (大剣/戦斧)';
      character.value.weapons.push({
        name: itemName,
        type: 'two-handed',
        modAttack: 1,
        attribute: 'slash',
        goldCost: 15,
        isMagic: false,
        description: '標準的な両手用近接武器。攻撃特性：斬撃。'
      });
    } else if (itemType === 'scimitar') {
      itemName = '円月刀';
      character.value.weapons.push({
        name: itemName,
        type: 'one-handed',
        modAttack: 0,
        attribute: 'slash',
        goldCost: 25,
        isMagic: true,
        description: '【シナリオ限定】片手武器（斬撃）。斬撃弱点の敵へのクリティカルが出目5,6で発生する。'
      });
    } else if (itemType === 'arrow') {
      itemName = '影縫いの矢';
      character.value.items.push({
        id: 'shadow_arrow',
        name: '影縫いの矢',
        type: 'consumable',
        goldCost: 30,
        value: 30,
        description: '【シナリオ限定】魔・精・神属性の敵を1ラウンド行動不能にする矢。使い捨て。'
      } as any);
    }

    addLogFn(`🎉 判定成功！ 蜘蛛の巣から [${itemName}] を無事に引き抜きました！`, 'success');
  } else {
    addLogFn('😢 判定失敗... 蜘蛛の巣の粘着糸に武器が絡まり、引き抜くことができませんでした。', 'error');
    loseEquippedMeleeWeapon(character);
  }

  // Remove the choice that was just tried
  const choiceId = `web_${itemType}`;
  (event as any).customChoices = (event as any).customChoices.filter((c: any) => c.id !== choiceId);

  // If no choices left, resolve room
  if ((event as any).customChoices.filter((c: any) => c.id !== 'web_leave').length === 0) {
    event.isResolved = true;
    event.resolutionText = '蜘蛛の巣の探索を終えました。';
    (event as any).customChoices = null;
  }
}

function loseEquippedMeleeWeapon(character: Ref<Character>) {
  if (character.value.equippedWeapon && character.value.equippedWeapon.type !== 'ranged') {
    const wp = character.value.equippedWeapon;
    character.value.weapons = character.value.weapons.filter(w => w.name !== wp.name);
    character.value.equippedWeapon = null;
    addLogFn(`⚠️ 装備していた近接武器 [${wp.name}] が蜘蛛の巣に絡め取られて失われました！`, 'error');
  }
}

// -------------------------------------------------------------
// Room 44: Riddle Sphinx Choice Builder
// -------------------------------------------------------------
function setupSphinxRiddleChoices(event: DungeonEvent, character: Ref<Character>) {
  (event as any).customChoices = [
    {
      id: 'sphinx_solve',
      label: '🧠 なぞなぞを解く 【幸運判定: 5】 (初挑戦成功でアクセサリー獲得)',
      checkStat: 'luck',
      checkTarget: 5,
      onSelect: (res: any) => handleSphinxRiddle(event, true, res, character)
    },
    {
      id: 'sphinx_fight',
      label: '⚔️ 力づくで排除する (スフィンクスとの戦闘)',
      onSelect: () => handleSphinxRiddle(event, false, undefined, character)
    }
  ];
}

function handleSphinxRiddle(
  event: DungeonEvent,
  isSolve: boolean,
  res: { success: boolean; roll: number; total: number } | undefined,
  character: Ref<Character>
) {
  if (isSolve && res) {
    if (res.success) {
      // Earn Cactus Earrings!
      character.value.items.push({
        id: 'cactus_earrings',
        name: 'サボテンの耳飾り',
        type: 'accessory',
        goldCost: 15,
        value: 15,
        description: '【シナリオ限定】反応表ロール-1補正。長話による頭痛生命ダメージを自動回避する耳飾り。'
      } as any);
      addLogFn('🦁 スフィンクス:「素晴らしい！見事な知恵者だ。これを受け取るが良い」', 'success');
      addLogFn('🌵 『サボテンの耳飾り』を入手しました！ (背負い袋に追加)', 'success');
      
      event.isResolved = true;
      event.resolutionText = 'スフィンクスのなぞなぞを解き明かし、サボテンの耳飾りを受け取って先へ進みました。';
      (event as any).customChoices = null;
    } else {
      addLogFn('🦁 スフィンクス:「違うな！もう一度考えてみるが良い」', 'error');
      // They can try again, but flag that they failed once (so no accessory reward)
      (event as any).sphinxFailedOnce = true;
    }
  } else {
    // Fight sphinx!
    addLogFn('⚔️ スフィンクスと力づくで決着をつけることを選びました！', 'error');
    event.type = 'encounter';
    event.enemies = [
      { name: 'スフィンクス', level: 5, lifeMax: 8, lifeCurrent: 8, attackCount: 2, tags: ['strong'], count: 1 }
    ];
    (event as any).customChoices = null;
    startEncounterFn();
  }
}

// -------------------------------------------------------------
// Room 24: Repairing Ant Folk Choice Builder & Combat Helper
// -------------------------------------------------------------
function setupAntFolkChoices(event: DungeonEvent, character: Ref<Character>) {
  const reactRoll = Math.floor(Math.random() * 6) + 1;
  addLogFn(`🐜 アリ人の反応チェック (1d6ロール: ${reactRoll})`, 'roll');
  const numAnts = (Math.floor(Math.random() * 6) + 1) + 3;
  
  if (reactRoll <= 4) {
    event.description = `ピラミッドの壁や床を〈アリ人〉の修繕部隊（${numAnts}体）が修繕しています。彼らは君たちに気付くと、修繕を手伝ってほしいと身振り手振りで持ちかけてきました。（反応: 【中立】）`;
    (event as any).customChoices = [
      {
        id: 'ant_help',
        label: '🤝 手伝いを申し出る 【器用判定: 4】',
        checkStat: 'dexterity',
        checkTarget: 4,
        onSelect: (res?: { success: boolean; roll: number; total: number }) => {
          if (!res) return;
          if (res.success) {
            addLogFn('🤝 修繕作業は完璧に終わりました！ アリ人の一族は感謝のしるしにお礼を差し出してきました。', 'success');
            event.description = '修繕の手伝いに大成功しました！ お礼の品を1つ選んで受け取ってください。';
            (event as any).customChoices = [
              {
                id: 'reward_compass',
                label: '🧭 『ピラミッドのコンパス』を受け取る (出目操作の魔力アイテム)',
                onSelect: () => {
                  character.value.items.push({
                    id: 'pyramid_compass',
                    name: 'ピラミッドのコンパス',
                    type: 'accessory',
                    goldCost: 3,
                    value: 3,
                    description: '【シナリオ限定/使い捨て】針が不穏さを感知し、d66探索時に十の位を+1または-1できる。'
                  } as any);
                  addLogFn('🧭 『ピラミッドのコンパス』を受け取りました！ (背負い袋に追加)', 'success');
                  event.isResolved = true;
                  event.resolutionText = 'アリ人の修繕を手伝い、お礼にピラミッドのコンパスを受け取りました。';
                  (event as any).customChoices = null;
                }
              },
              {
                id: 'reward_bomb',
                label: '🧪 『ギ酸爆弾』を受け取る (防御+1爆弾)',
                onSelect: () => {
                  character.value.items.push({
                    id: 'formic_acid_bomb',
                    name: 'ギ酸爆弾',
                    type: 'accessory',
                    goldCost: 5,
                    value: 5,
                    description: '【シナリオ限定/使い捨て】第0ラウンドで遠距離攻撃として投げ、敵全体に影響を与えてその戦闘中防御ロール+1修正。'
                  } as any);
                  addLogFn('🧪 『ギ酸爆弾』を受け取りました！ (背負い袋に追加)', 'success');
                  event.isResolved = true;
                  event.resolutionText = 'アリ人の修繕を手伝い、お礼にギ酸爆弾を受け取りました。';
                  (event as any).customChoices = null;
                }
              }
            ];
          } else {
            if (res.roll === 1) {
              addLogFn('💀 ファンブル！ 修繕した床が崩れ落ちました！ 出来栄えのひどさに激怒したアリ人たちが襲いかかってきます！', 'error');
              startAntCombat(event, numAnts);
            } else {
              addLogFn('😅 修繕作業はうまく進みませんでした。アリ人たちはがっかりしていますが、敵対はせず見逃してくれました。', 'info');
              event.isResolved = true;
              event.resolutionText = 'アリ人の修繕を手伝いましたが、失敗に終わりました。特に何も得られませんでした。';
              (event as any).customChoices = null;
            }
          }
        }
      },
      {
        id: 'ant_leave',
        label: '🏃 無視して先を急ぐ',
        onSelect: () => {
          addLogFn('🏃 アリ人たちを無視して部屋を立ち去りました。', 'info');
          event.isResolved = true;
          event.resolutionText = '修繕するアリ人たちを無視して通り過ぎました。';
          (event as any).customChoices = null;
        }
      }
    ];
  } else if (reactRoll === 5) {
    const requiredFood = Math.ceil(numAnts / 2);
    event.description = `ピラミッドの壁や床を〈アリ人〉の修繕部隊（${numAnts}体）が修繕しています。彼らは行く手を通す代わりとして、ワイロを要求してきました。（反応: 【ワイロ】食料 ${requiredFood} 個要求）`;
    (event as any).customChoices = [
      {
        id: 'ant_bribe',
        label: `🌾 食料を差し出す (食料 ${requiredFood} 個消費)`,
        disabled: character.value.food < requiredFood,
        onSelect: () => {
          character.value.food -= requiredFood;
          addLogFn(`🌾 食料 ${requiredFood} 個を差し出し、アリ人たちの見守る中を安全に通り抜けました。`, 'success');
          event.isResolved = true;
          event.resolutionText = `アリ人たちに食料 ${requiredFood} 個をワイロとして渡し、平和的に通り抜けました。`;
          (event as any).customChoices = null;
        }
      },
      {
        id: 'ant_fight',
        label: '⚔️ 要求を拒否して戦う！',
        onSelect: () => {
          addLogFn('⚔️ ワイロの要求を拒否し、アリ人たちと力づくで決着をつけることを選びました！', 'error');
          startAntCombat(event, numAnts);
        }
      }
    ];
  } else {
    event.description = `ピラミッドの壁や床を〈アリ人〉の修繕部隊（${numAnts}体）が修繕しています。彼らは侵入者を認めるなり、激しい敵意を示して襲いかかってきました！（反応: 【敵対的】）`;
    (event as any).customChoices = [
      {
        id: 'ant_fight_immediate',
        label: '⚔️ 武器を抜いて迎え撃つ！',
        onSelect: () => {
          startAntCombat(event, numAnts);
        }
      }
    ];
  }
}

function startAntCombat(event: DungeonEvent, numAnts: number) {
  event.type = 'encounter';
  event.enemies = [];
  for (let i = 0; i < numAnts; i++) {
    event.enemies.push({
      name: `アリ人 ${String.fromCharCode(65 + i)}`,
      level: 4,
      lifeMax: 3,
      lifeCurrent: 3,
      attackCount: 1,
      tags: ['weak'],
      count: 1
    } as any);
  }
  (event as any).customChoices = null;
  startEncounterFn();
}


