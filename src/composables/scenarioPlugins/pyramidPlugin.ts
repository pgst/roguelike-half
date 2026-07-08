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
      (character.value as any).pyramidIntroRead = false;
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

  async onExploreRoom(event: DungeonEvent, character: Ref<Character>, followers: Ref<Follower[]>) {
    const d66 = event.d66Code;

    // Room 21: Boro
    if (d66 === '21' && !(event as any).choicesInitialized) {
      (event as any).choicesInitialized = true;
      setupBoroChoices(event, character);
    }

    // Room 22: Wandering Merchant
    if (d66 === '22' && !(event as any).choicesInitialized) {
      (event as any).choicesInitialized = true;
      setupWanderingMerchantChoices(event, character, followers);
    }

    // Room 24: Repairing Ant Folk
    if (d66 === '24' && !(event as any).choicesInitialized) {
      (event as any).choicesInitialized = true;
      setupAntFolkChoices(event, character);
    }

    // Room 26: Chatty Sphinx
    if (d66 === '26' && !(event as any).choicesInitialized) {
      (event as any).choicesInitialized = true;
      setupChattySphinxChoices(event, character, followers);
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
  },

  onAdventureEnd(character: Ref<Character>, followers: Ref<Follower[]>) {
    // Return Golden Brooch to king
    const beforeLen = character.value.items.length;
    character.value.items = character.value.items.filter(i => i.id !== 'golden_brooch');
    if (character.value.items.length < beforeLen) {
      addLogFn('👑 冒険が無事終了したため、『黄金虫のブローチ』を王へ返却しました。', 'info');
    }

    // Wandering Merchant farewell
    if (followers && followers.value) {
      const idx = followers.value.findIndex(f => f.id === 'wandering_merchant_wandaros');
      if (idx !== -1) {
        followers.value.splice(idx, 1);
        character.value.items.push({
          id: 'holywater',
          name: '聖水',
          type: 'holywater',
          goldCost: 10,
          value: 0,
          description: 'アンデッドや強い敵に2ダメージ、弱い敵なら2体を一撃で倒す消耗品。'
        } as any);
        addLogFn('👥 彷徨える商人ワンダロスが無事にピラミッドから生還し、感謝のしるしに『聖水』を受け取って別れました。', 'success');
      }
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

// -------------------------------------------------------------
// Room 21: Boro Choice Builder
// -------------------------------------------------------------
function setupBoroChoices(event: DungeonEvent, character: Ref<Character>) {
  const customChoices: any[] = [];

  const hasPotion = character.value.items.some(i => i.id === 'potion');
  customChoices.push({
    id: 'boro_potion',
    label: hasPotion ? '💖 『治療のポーション』を1個使用して彼を治療する' : '💖 『治療のポーション』を使用する (不所持)',
    disabled: !hasPotion,
    onSelect: () => {
      const idx = character.value.items.findIndex(i => i.id === 'potion');
      if (idx !== -1) {
        character.value.items.splice(idx, 1);
      }
      giveBoroClue(event, character, 'ポロメイアの若きボロに治療のポーションを与え、治療しました！');
    }
  });

  customChoices.push({
    id: 'boro_food',
    label: `🍞 『食料』を1食分分け与えて彼を介抱する (所持食料: ${character.value.food}食)`,
    disabled: character.value.food < 1,
    onSelect: () => {
      character.value.food = Math.max(0, character.value.food - 1);
      giveBoroClue(event, character, 'ポロメイアの若きボロに食料を分け与え、体力を回復させました！');
    }
  });

  customChoices.push({
    id: 'boro_leave',
    label: '🏃 何もしないで立ち去る',
    onSelect: () => {
      addLogFn('🏃 ボロをそのままにして部屋を立ち去りました。', 'info');
      event.isResolved = true;
      event.resolutionText = '彼をそのままにして部屋を立ち去りました。';
      (event as any).customChoices = null;
    }
  });

  (event as any).customChoices = customChoices;
}

function giveBoroClue(event: DungeonEvent, character: Ref<Character>, actionLog: string) {
  addLogFn(actionLog, 'success');
  
  // Add clue item
  character.value.items.push({
    id: 'shireen_clue',
    name: 'シーリーンの手がかり',
    type: 'clue',
    goldCost: 0,
    value: 0,
    description: '異端者シーリーンの行動パターンに関する重要な手がかり。戦闘中に消費することで、彼女の未来予知を無効化できる。'
  } as any);
  addLogFn('🎁 シーリーンの未来予知に関する『手がかり』を獲得しました！ (背負い袋に追加)', 'success');

  // Log story
  addLogFn('ボロ:「自分は非力で、臆病でした。王女の身を救うため、クロノシア教徒に挑みましたが、まったく役に立ちませんでした。彼らを率いるシーリーンは、すでに悪魔に魂を捧げています。その恐ろしい双眸から、死の視線が放たれます。決して直視しないことです」', 'info');
  addLogFn('ボロ:「彼女は少し先の未来を見るため、まともに攻撃が当たらないのです。私は勝てる気はしない。もしあなたがその状況に陥ったら、なるべく相手の目を見ず戦うのです」', 'info');

  event.isResolved = true;
  event.resolutionText = 'ボロを治療し、シーリーンの未来予知に関する『手がかり』を獲得しました。\n\n【ボロの話した情報】\n・シーリーンは少し先の未来を見るため、まともに攻撃が当たらない。\n・戦う際は彼女の目を直視せず（手がかりアイテムを消費して）戦うとよい。';
  (event as any).customChoices = null;
}

// -------------------------------------------------------------
// Room 22: Wandering Merchant Choice Builder
// -------------------------------------------------------------
function setupWanderingMerchantChoices(event: DungeonEvent, character: Ref<Character>, followers: Ref<Follower[]>) {
  const customChoices: any[] = [];

  const canHire = followers.value.length < character.value.followerCurrent;
  customChoices.push({
    id: 'wanderer_hire',
    label: canHire ? '👥 従者として同行させる (ランタン・治療のポーション獲得)' : '👥 従者として同行させる (従者枠満杯のため選択不可)',
    disabled: !canHire,
    onSelect: () => {
      followers.value.push({
        id: 'wandering_merchant_wandaros',
        name: '彷徨える商人ワンダロス',
        type: 'wandering_merchant',
        isCombatant: false,
        skill: 0,
        lifeMax: 1,
        lifeCurrent: 1,
        goldCost: 0,
        desc: '【シナリオ限定】戦わない従者。持っているランタンと治療のポーションを1個ずつ提供。冒険終了時に別れ、聖水をくれる。'
      } as any);

      character.value.items.push({
        id: 'lantern',
        name: 'ランタン',
        type: 'lantern',
        goldCost: 2,
        value: 0,
        description: '暗闇を照らす。手元に明かりがないと全判定に-2の修正を受ける。使用する場合は片手が塞がる。'
      } as any);

      character.value.items.push({
        id: 'potion',
        name: '治療のポーション',
        type: 'healingpotion',
        goldCost: 50,
        value: 0,
        description: '生命力を最大値まで回復する。1回の冒険で1個のみ使用可能。'
      } as any);

      addLogFn('👥 商人ワンダロスが従者として同行します！『ランタン』1個と『治療のポーション』1個を受け取りました。(背負い袋に追加)', 'success');
      addLogFn('ワンダロス:「ああ、やっと人と出会えた。私はワンダロス、旅する商人だ。本当に、私は昔から方向音痴なんだ。とても自分一人じゃ、ここから出られそうにない。どうか私も一緒に連れてってくれないか？なんならこのランタンと治療のポーションを使ってくれていいから」', 'info');

      event.isResolved = true;
      event.resolutionText = '商人ワンダロスを従者として同行させました。お礼に彼の『ランタン』と『治療のポーション』を獲得しました。（冒険終了時まで同行し、生還すれば『聖水』をくれます）';
      (event as any).customChoices = null;
    }
  });

  customChoices.push({
    id: 'wanderer_trade',
    label: '🪙 物資を購入する',
    onSelect: () => {
      addLogFn('ワンダロス:「同行しない場合でも、金貨を払ってくれるなら物資を売るよ。こんな状況でも商人根性は捨ててないからね！」', 'info');
      setupWanderingMerchantShopChoices(event, character, followers);
    }
  });

  customChoices.push({
    id: 'wanderer_leave',
    label: '🏃 取引せず立ち去る',
    onSelect: () => {
      addLogFn('🏃 ワンダロスと別れ、部屋を立ち去りました。', 'info');
      event.isResolved = true;
      event.resolutionText = 'ワンダロスの誘いを断り、そのまま部屋を立ち去りました。';
      (event as any).customChoices = null;
    }
  });

  (event as any).customChoices = customChoices;
}

function setupWanderingMerchantShopChoices(event: DungeonEvent, character: Ref<Character>, followers: Ref<Follower[]>) {
  const shopChoices: any[] = [];

  shopChoices.push({
    id: 'wanderer_buy_lantern',
    label: `🏮 『ランタン』を購入する (金貨 5 枚 / 所持: ${character.value.gold}枚)`,
    disabled: character.value.gold < 5,
    onSelect: () => {
      character.value.gold = Math.max(0, character.value.gold - 5);
      character.value.items.push({
        id: 'lantern',
        name: 'ランタン',
        type: 'lantern',
        goldCost: 2,
        value: 0,
        description: '暗闇を照らす。手元に明かりがないと全判定に-2の修正を受ける。使用する場合は片手が塞がる。'
      } as any);
      addLogFn('🏮 ワンダロスから『ランタン』を金貨5枚で購入しました。', 'success');
      setupWanderingMerchantShopChoices(event, character, followers);
    }
  });

  shopChoices.push({
    id: 'wanderer_buy_potion',
    label: `🧪 『治療のポーション』を購入する (金貨 70 枚 / 所持: ${character.value.gold}枚)`,
    disabled: character.value.gold < 70,
    onSelect: () => {
      character.value.gold = Math.max(0, character.value.gold - 70);
      character.value.items.push({
        id: 'potion',
        name: '治療のポーション',
        type: 'healingpotion',
        goldCost: 50,
        value: 0,
        description: '生命力を最大値まで回復する。1回の冒険で1個のみ使用可能。'
      } as any);
      addLogFn('🧪 ワンダロスから『治療のポーション』を金貨70枚で購入しました。', 'success');
      setupWanderingMerchantShopChoices(event, character, followers);
    }
  });

  shopChoices.push({
    id: 'wanderer_buy_holywater',
    label: `💧 『聖水』を購入する (金貨 15 枚 / 所持: ${character.value.gold}枚)`,
    disabled: character.value.gold < 15,
    onSelect: () => {
      character.value.gold = Math.max(0, character.value.gold - 15);
      character.value.items.push({
        id: 'holywater',
        name: '聖水',
        type: 'holywater',
        goldCost: 10,
        value: 0,
        description: 'アンデッドや強い敵に2ダメージ、弱い敵なら2体を一撃で倒す消耗品。'
      } as any);
      addLogFn('💧 ワンダロスから『聖水』を金貨15枚で購入しました。', 'success');
      setupWanderingMerchantShopChoices(event, character, followers);
    }
  });

  shopChoices.push({
    id: 'wanderer_shop_leave',
    label: '🚪 取引を終えて部屋を進む',
    onSelect: () => {
      addLogFn('🚪 ワンダロスとの取引を終えて部屋を進みます。', 'info');
      event.isResolved = true;
      event.resolutionText = 'ワンダロスとの取引を終え、先に進みました。';
      (event as any).customChoices = null;
    }
  });

  (event as any).customChoices = shopChoices;
}

// -------------------------------------------------------------
// Room 23: Jill-Mega Choice Builder
// -------------------------------------------------------------
// Room 26: Chatty Sphinx Choice Builder
// -------------------------------------------------------------
function setupChattySphinxChoices(event: DungeonEvent, character: Ref<Character>, _followers: Ref<Follower[]>) {
  const customChoices = [
    {
      id: 'sphinx_listen',
      label: '💬 スフィンクスの話を聞く (反応表判定)',
      onSelect: async () => {
        const reactRoll = Math.floor(Math.random() * 6) + 1;
        addLogFn(`🦁 スフィンクスの反応チェック (1d6ロール: ${reactRoll})`, 'roll');
        
        if (reactRoll === 6) {
          addLogFn('🦁 反応: 【敵対的】 (出目: 6) - スフィンクスは話をする様子がなく、襲いかかってきました！', 'error');
          event.type = 'encounter';
          event.enemies = [
            {
              name: 'おしゃべりスフィンクス',
              level: 3,
              lifeMax: 5,
              lifeCurrent: 5,
              attackCount: 2,
              tags: ['monster'],
              count: 1,
              weaponAttribute: 'strike'
            } as any
          ];
          (event as any).customChoices = null;
          startEncounterFn();
        } else if (reactRoll <= 2) {
          addLogFn(`🦁 反応: 【友好的】 (出目: ${reactRoll}) - 話が丁寧で聞き取りやすく、頭痛もありませんでした！`, 'success');
          giveSphinxClue(event, character);
        } else {
          addLogFn(`🦁 反応: 【中立】 (出目: ${reactRoll}) - 言葉遣いが荒く、理解が極めて難解な長話をされました。`, 'info');
          const hasEarrings = character.value.items.some(i => i.id === 'cactus_earrings');
          if (hasEarrings) {
            addLogFn('🌵 『サボテンの耳飾り』を装着しているため、退屈な長話による頭痛の災難を完全に回避しました！', 'success');
            giveSphinxClue(event, character);
          } else {
            addLogFn('🤯 難解な長話により激しい頭痛に襲われました！判定が必要です。', 'error');
            setupSphinxHeadacheChoice(event, character);
          }
        }
      }
    },
    {
      id: 'sphinx_fight',
      label: '⚔️ スフィンクスを力ずくで排除する (戦う)',
      onSelect: () => {
        addLogFn('⚔️ おしゃべりスフィンクスと戦闘に入ります！', 'info');
        event.type = 'encounter';
        event.enemies = [
          {
            name: 'おしゃべりスフィンクス',
            level: 3,
            lifeMax: 5,
            lifeCurrent: 5,
            attackCount: 2,
            tags: ['monster'],
            count: 1,
            weaponAttribute: 'strike'
          } as any
        ];
        (event as any).customChoices = null;
        startEncounterFn();
      }
    },
    {
      id: 'sphinx_leave',
      label: '🏃 相手にせず立ち去る',
      onSelect: () => {
        addLogFn('🏃 スフィンクスを無視して部屋を立ち去りました。', 'info');
        event.isResolved = true;
        event.resolutionText = 'スフィンクスには構わず、部屋を立ち去りました。';
        (event as any).customChoices = null;
      }
    }
  ];

  (event as any).customChoices = customChoices;
}

function giveSphinxClue(event: DungeonEvent, character: Ref<Character>) {
  character.value.items.push({
    id: 'sphinx_clue',
    name: 'スフィンクスの手がかり',
    type: 'clue',
    goldCost: 0,
    value: 0,
    description: 'おしゃべりスフィンクスから聞いた、兄（謎かけスフィンクス）の好きななぞなぞや弱点に関する手がかり。'
  } as any);
  addLogFn('🎁 なぞなぞに関する『手がかり』を獲得しました！ (背負い袋に追加)', 'success');
  addLogFn('スフィンクス:「おお、久しぶりの客人だ。兄弟といっても性格はそれぞれだ。私は温厚だが、兄たちは意地悪だからな。なぞなぞの答え？そうだ、答えは【足跡】だ。覚えておけ」', 'info');

  event.isResolved = true;
  event.resolutionText = 'スフィンクスの長話に耐え、兄（謎かけスフィンクス）のなぞなぞに関する『手がかり』を獲得しました。\n\n【スフィンクスの話した情報】\n・兄が出すなぞなぞの答えは「足跡」である。';
  (event as any).customChoices = null;
}

function setupSphinxHeadacheChoice(event: DungeonEvent, character: Ref<Character>) {
  (event as any).customChoices = [
    {
      id: 'sphinx_headache_roll',
      label: '🤯 頭痛に耐えるため生命判定を行う 【目標値: 8 / 技量点判定】',
      checkStat: 'skill',
      checkTarget: 8,
      onSelect: (res: { success: boolean; roll: number }) => {
        if (res.roll === 1) {
          character.value.lifeCurrent = Math.max(0, character.value.lifeCurrent - 1);
          character.value.subStatCurrent = Math.max(0, character.value.subStatCurrent - 1);
          addLogFn('💀 ファンブル！激しい頭痛により生命力を1点失い、さらに幸運点を1点失いました！', 'error');
        } else if (res.success) {
          addLogFn('🛡️ 判定成功！頭痛を気合いで耐え抜きました。', 'success');
        } else {
          character.value.lifeCurrent = Math.max(0, character.value.lifeCurrent - 1);
          addLogFn('💥 判定失敗！頭痛により生命力を1点失いました。', 'error');
        }
        
        giveSphinxClue(event, character);
      }
    }
  ];
}


