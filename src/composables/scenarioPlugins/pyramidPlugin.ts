import type { Ref } from 'vue';
import { generateId, randomInt } from '../../domain/random';
import type { Character, DungeonEvent, Follower } from '../../types';
import type { ScenarioPluginContext } from './index';

// Expose reactive functions to trigger combat or logs
let addLogFn: (msg: string, type: 'info' | 'success' | 'error' | 'damage' | 'roll') => void = () => {};
let startEncounterFn: () => void = () => {};

async function handleFinal1Jump(context: ScenarioPluginContext) {
  const { character, activeEvent, rollD6, handleDeath, activeScenario } = context;
  const step = (character.value as any).pyramidFinal1Step || 1;
  const target = step === 3 ? 4 : 3;

  addLogFn(`🏃 崩落する床の器用判定ロール (目標値: ${target}, 現在回数: ${step}/3)`, 'info');
  const roll = await rollD6!(true);
  const total = roll + character.value.skillCurrent;
  const success = roll === 6 || (roll !== 1 && total >= target);

  if (success) {
    addLogFn(`✨ ${step}回目の跳躍成功！ (ロール計: ${roll === 6 ? 'クリティカル' : total} >= ${target})`, 'success');
  } else {
    character.value.lifeCurrent = Math.max(0, character.value.lifeCurrent - 1);
    addLogFn(`😢 ${step}回目の跳躍失敗... 足元の床が崩れ落ち、生命力に1点のダメージ！ (生命力残り: ${character.value.lifeCurrent})`, 'error');
    if (character.value.lifeCurrent <= 0) {
      handleDeath!();
      return;
    }
  }

  if (step < 3) {
    const nextStep = step + 1;
    (character.value as any).pyramidFinal1Step = nextStep;
    const nextTarget = nextStep === 3 ? 4 : 3;
    if (!activeEvent.value) return;
    activeEvent.value.description = `ドワーフの魔道士ミロスの過去の幻影に出会いました。話している最中、足元の床が崩落を始めます！\n崩れ去る床を跳び越えるため、3回の【器用度判定】を行ってください。\n\n🏃 床の崩落を跳び越える (器用判定 ${nextStep}回目 / 3回中)\n${nextStep}回目目標値: ${nextTarget} (失敗時: 生命力 -1)`;
  } else {
    const scenarioData = activeScenario.value;
    const origin = (character.value as any).pyramidOrigin || 'polomeia';
    const epilogue = (scenarioData as any)?.epilogues?.["1"]?.[origin];

    let goldReward = 20;
    if (epilogue && epilogue.goldBase && epilogue.goldDiceCount) {
      goldReward = epilogue.goldBase;
      const rolls = [];
      for (let i = 0; i < epilogue.goldDiceCount; i++) {
        const d = randomInt(1, 6);
        rolls.push(d);
        goldReward += d;
      }
      addLogFn(`🎲 金貨ロール (3d6: ${rolls.join('+')})`, 'roll');
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
          addLogFn(p.trim(), 'info');
        }
      });
    }

    const rText = `🎉 無事に崩落する床を渡りきりました！\n金貨 ${goldReward} 枚、1 Exp、そしてプラチナコインを獲得し、次の冒険の準備へ向かいます。`;
    if (!activeEvent.value) return;
    activeEvent.value.isResolved = true;
    activeEvent.value.resolutionText = rText;
    activeEvent.value.customChoices = undefined;
    addLogFn(rText, 'success');
  }
}

async function handleCrocodileBribe(context: ScenarioPluginContext, type: 'food' | 'follower') {
  const { character, followers, rollD6, activeEvent } = context;
  if (type === 'food') {
    character.value.food = Math.max(0, character.value.food - 2);
    addLogFn('💸 食料2食分をワイロとして投げ与えました。', 'info');
  } else {
    const idx = followers.value.findIndex((f: any) => f.goldCost <= 10);
    if (idx !== -1) {
      const name = followers.value[idx].name;
      followers.value.splice(idx, 1);
      addLogFn(`👥 雇い賃金貨10枚以下の弱い従者 [${name}] を生贄として差し出しました...`, 'error');
    }
  }

  addLogFn('🐊 ワニの反応チェックロール開始 (1-3で友好回避)...', 'info');
  const roll = await rollD6!(true);
  if (roll <= 3) {
    addLogFn(`🤝 成功！ ワニは満腹になり、静かに水底へ去っていきました。 (出目: ${roll})`, 'success');
    if (!activeEvent.value) return;
    activeEvent.value.isResolved = true;
    activeEvent.value.resolutionText = '🐊 ワニは満腹になり、水底へ去っていきました。無事にホークを救出し、彼が同行します。';
    activeEvent.value.customChoices = undefined;
    
    followers.value.push({
      id: 'hawk',
      name: 'ホーク (ハンター)',
      type: 'hunter',
      lifeMax: 4,
      lifeCurrent: 4,
      skill: 4,
      goldCost: 0
    } as any);
    addLogFn('👥 救出した [ホーク (ハンター)] が従者として仲間に加わりました！', 'success');
  } else {
    addLogFn(`😢 失敗... ワニは差し出されたものだけでは満足せず、襲いかかってきました！ (出目: ${roll})`, 'error');
    handleCrocodileFight(context);
  }
}

function handleCrocodileFight(context: ScenarioPluginContext) {
  const { combatState, startEncounter } = context;
  startEncounter!();
  combatState.active = true;
  combatState.round = 0;
}

export const pyramidPlugin = {
  id: 'pyramid_of_chronodemon',

  updateHelpers(context: ScenarioPluginContext) {
    if (context.addLog) {
      addLogFn = context.addLog;
    }
    if (context.startEncounter) {
      startEncounterFn = context.startEncounter;
    }
  },

  onAdventureStart(context: ScenarioPluginContext) {
    const { character } = context;
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

  onCombatStart(context: ScenarioPluginContext) {
    const { combatState, followers, activeEvent } = context;
    const hasAnts = combatState.enemies.some((e: any) => e.name.includes('アリ人'));
    if (hasAnts && (combatState as any).antSpitCheckPending === undefined) {
      (combatState as any).antSpitCheckPending = true;
      const numAnts = combatState.enemies.length;
      const spitAntsCount = Math.floor(numAnts / 2);
      addLogFn(`🐜 アリ人の群れがギ酸の唾を飛ばしてきました！ (第0ラウンド・遠距離攻撃 - 射手: ${spitAntsCount}体)`, 'error');
      
      if (spitAntsCount > 0) {
        const pRoll = randomInt(1, 6);
        addLogFn(`🧍 主人公の防御ロール: 出目 ${pRoll} (目標値: 4)`, 'roll');
        if (pRoll < 4) {
          addLogFn('🤢 ギ酸の唾が目に入り、視界がかすんだ！ (戦闘終了まで攻撃ロール-1ペナルティ)', 'damage');
          (combatState as any).antSpitPenalty = true;
        } else {
          addLogFn('🛡️ 主人公はギ酸の唾を回避しました！', 'success');
        }
        
        followers.value.forEach(f => {
          if (f.lifeCurrent > 0 && f.isCombatant) {
            const fRoll = randomInt(1, 6);
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

    // Final3 Chronodemon initial setup
    if (activeEvent.value?.d66Code === 'Final3') {
      (combatState as any).pendingRoarCheck = 'start';
      addLogFn('👿 刻の悪魔クロノヴァルスが降臨し、空間が歪む『時喰いの咆哮』を放ちました！', 'error');
    }
  },

  async onExploreRoomOverride(context: ScenarioPluginContext) {
    const {
      character,
      followers,
      combatState,
      dungeonDepth,
      activeEvent,
      activeScenario,
      addLog,
      pyramidRunCount,
      savePyramidBossSnapshot,
      rollD66,
      activateRoomEvent,
      startEncounter
    } = context;

    if (!activeScenario.value) return false;

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
            {
              name: "ヘラクレオス像",
              level: 5,
              lifeMax: 6,
              lifeCurrent: 6,
              attackCount: 2,
              tags: ["golem", "strong"],
              count: 1,
              resistances: [{ attribute: "slash", modifier: -2 }]
            }
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
          customChoices: [
            ...(character.value.food >= 2 ? [{
              id: "crocodile_bribe_food",
              label: `💸 食料 2 個を差し出してワイロを試みる (現在の食料: ${character.value.food}個)`,
              onSelect: () => handleCrocodileBribe(context, 'food')
            }] : []),
            ...(followers.value.some((f: any) => f.goldCost <= 10) ? [{
              id: "crocodile_bribe_follower",
              label: "👥 弱い従者 1 体を差し出してワイロを試みる",
              onSelect: () => handleCrocodileBribe(context, 'follower')
            }] : []),
            {
              id: "crocodile_fight",
              label: "⚔️ 交渉決裂！戦う！",
              onSelect: () => handleCrocodileFight(context)
            }
          ],
          enemies: [
            { name: "砂漠ワニ", level: 4, lifeMax: 9, lifeCurrent: 9, attackCount: 1, tags: ["weak"], count: 1, weaponAttribute: "slash" }
          ]
        };
      }
      activeEvent.value = middleEvent;
      addLog(`中間イベント発生！ [第4の部屋] (${run}回目の冒険)`, 'error');
      if (middleEvent.type === 'encounter') {
        startEncounter!();
      }
      return true;
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
      const res = await rollD66!();
      rolledValue = res.value;
      if (depth === 5 && rolledValue >= 11 && rolledValue <= 16) triggerFinal = true;
      else if (depth === 6 && rolledValue >= 11 && rolledValue <= 26) triggerFinal = true;
      else if (depth === 7 && rolledValue >= 11 && rolledValue <= 36) triggerFinal = true;
      else if (depth === 8 && rolledValue >= 11 && rolledValue <= 46) triggerFinal = true;
      else if (depth === 9 && rolledValue >= 11 && rolledValue <= 56) triggerFinal = true;
    }

    if (triggerFinal) {
      let finalEvent: any;
      if (run === 1) {
        (character.value as any).pyramidFinal1Step = 1;
        finalEvent = {
          title: "【決戦】崩落する床 (1回目の冒険)",
          d66Code: "Final1",
          description: "ドワーフの魔道士ミロスの過去の幻影に出会いました。話している最中、足元の床が崩落を始めます！\n崩れ去る床を跳び越えるため、3回の【器用度判定】を行ってください。\n\n🏃 床の崩落を跳び越える (器用判定 1回目 / 3回中)\n1回目目標値: 3 (失敗時: 生命力 -1)",
          type: "npc",
          customChoices: [
            {
              id: "final1_jump",
              label: `🎲 器用判定ロールを行う (能力値: ${character.value.skillCurrent})`,
              onSelect: () => handleFinal1Jump(context)
            }
          ],
          isResolved: false
        };
      } else if (run === 2) {
        finalEvent = {
          title: "【決戦】大広間の対峙 (2回目の冒険)",
          d66Code: "Final2",
          description: "大広間でシーリーンとバーランドが対峙しています。背後の巨像「至高のヘラクレオス」が動き出しました！\nどちらを相手にするか選んでください。",
          type: "npc",
          customChoices: [
            {
              id: "heracles",
              label: "🤖 至高のヘラクレオスと戦う (Level 5 / Life 12)",
              onSelect: () => {
                startEncounterFn();
                combatState.enemies = [
                  {
                    name: "至高のヘラクレオス",
                    level: 5,
                    lifeMax: 12,
                    lifeCurrent: 12,
                    attackCount: 1,
                    tags: ["golem", "strong"],
                    count: 1,
                    resistances: [
                      { attribute: "slash", modifier: -2 },
                      { attribute: "strike", modifier: 1 }
                    ]
                  }
                ];
                combatState.active = true;
                combatState.round = 0;
                addLogFn("⚔️ 至高のヘラクレオスとの戦闘を開始しました！ (石化/麻痺無効、打撃武器は攻撃判定ロールに -1 修正)", "info");
              }
            },
            {
              id: "shireen",
              label: "🔮 異端者シーリーンと戦う (Level 5 / Life 5)",
              onSelect: () => {
                startEncounterFn();
                combatState.enemies = [
                  {
                    name: "異端者シーリーン",
                    level: 5,
                    lifeMax: 5,
                    lifeCurrent: 5,
                    attackCount: 3,
                    tags: ["strong"],
                    count: 1,
                    evasionRule: "shireen_future_sight"
                  }
                ];
                combatState.active = true;
                combatState.round = 0;
                addLogFn("⚔️ 異端者シーリーンとの戦闘を開始しました！ (彼女は予知能力で攻撃を完全に回避するため、通常武器は手がかりアイテムを消費しなければ無効化されます)", "info");
              }
            }
          ],
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
      savePyramidBossSnapshot!();
      activeEvent.value = finalEvent;
      addLog(`決戦イベント発生！ (${run}回目の冒険)`, 'error');
      if (finalEvent.type === 'encounter') {
        startEncounter!();
      }
      return true;
    }

    // If we didn't trigger final, proceed with normal d66 roll
    // If we rolled a value but it didn't trigger final, we reuse that value!
    let value = rolledValue;
    if (value === 0) {
      addLog('次の部屋へ向けて通路を進みます...', 'info');
      const res = await rollD66!();
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
      activateRoomEvent!(event);
    }
    return true;
  },

  onGenerateEnemyAttacks(context: ScenarioPluginContext, enemy: any, attackQueue: any[]) {
    if (enemy.name === '刻の悪魔クロノヴァルス') {
      attackQueue.push({
        source: enemy,
        id: generateId(),
        type: 'wind'
      } as any);
      
      const activeFollowers = context.followers.value.filter(f => f.lifeCurrent > 0);
      if (activeFollowers.length > 0) {
        const chosenFollower = activeFollowers[randomInt(0, activeFollowers.length - 1)];
        attackQueue.push({
          source: enemy,
          id: generateId(),
          type: 'spacetime_fang_hero',
          targetName: '主人公'
        } as any);
        attackQueue.push({
          source: enemy,
          id: generateId(),
          type: 'spacetime_fang_follower',
          targetName: `従者 ${chosenFollower.name}`,
          targetFollowerId: chosenFollower.id
        } as any);
      } else {
        attackQueue.push({
          source: enemy,
          id: generateId(),
          type: 'spacetime_fang_hero_1',
          targetName: '主人公 (1回目)'
        } as any);
        attackQueue.push({
          source: enemy,
          id: generateId(),
          type: 'spacetime_fang_hero_2',
          targetName: '主人公 (2回目)'
        } as any);
      }
      return true;
    }
    
    if (enemy.name === '異端者シーリーン') {
      const round = context.combatState.round;
      if (round === 1) {
        attackQueue.push({ source: enemy, id: generateId(), type: 'evil_eye' } as any);
      } else if (round === 2) {
        attackQueue.push({ source: enemy, id: generateId(), type: 'slash_eye' } as any);
      } else if (round === 3) {
        attackQueue.push({ source: enemy, id: generateId(), type: 'mad_eye' } as any);
      } else {
        for (let i = 0; i < 3; i++) {
          attackQueue.push({ source: enemy, id: generateId(), type: 'normal' } as any);
        }
      }
      return true;
    }
    
    return false;
  },

  onDetermineEnemyAttackCount(context: ScenarioPluginContext, enemy: any) {
    if (enemy.name === '砂漠ワニ' && context.combatState.isCrocodileClamped) {
      return 0;
    }
    return undefined;
  },

  async onResolveDefenseAttack(
    context: ScenarioPluginContext,
    enemy: any,
    attack: any,
    defSuccess: boolean,
    roll: number,
    _total: number,
    isHero: boolean,
    defenderId: string
  ) {
    const { character, followers, combatState, addLog, rollD6, endCombat } = context;

    if (!defSuccess) {
      if (isHero && enemy.name.includes('シルバー・ゴーレム')) {
        combatState.silverGolemHitsCount = (combatState.silverGolemHitsCount || 0) + 1;
        addLog(`🤖 シルバー・ゴーレムの攻撃が主人公に命中！ (通算 ${combatState.silverGolemHitsCount} 回目/3回中)`, 'error');
        if (combatState.silverGolemHitsCount === 3) {
          addLog('🤖 シルバー・ゴーレムは床を踏み抜いてしまい、遥か下の階に落下しました！戦闘を終了します。', 'success');
          endCombat!(true, false);
          return;
        }
      }

      if (roll === 1 && enemy.name === '砂漠ワニ') {
        combatState.isCrocodileClamped = true;
        addLog('🐊 砂漠ワニが噛みついたまま離れなくなりました！ (毎ラウンド終了時にダメージ2を受けます)', 'error');
      }

      if (enemy.name === '刻の悪魔クロノヴァルス' && attack.type === 'wind') {
        combatState.chronovalsWindPenalty = true;
        addLog('🌪️ 斬撃風の直撃により体勢が崩れました！ 次回の攻撃ロールに -1 のペナルティが課されます。', 'error');

        addLog('🌪️ 壺の破損チェックを行います。1d6を振り、1（ファンブル）が出ると封印の壺が破損します。', 'info');
        const potRoll = await rollD6!(true);
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

      if (attack.type === 'evil_eye') {
        const res = await context.rollSpellResistance!(5);
        if (!res.success) {
          if (isHero) {
            combatState.isCharmed = true;
            addLog('👁️ シーリーンの【邪視】により魅了されました！ 戦闘終了まで攻撃ロールに -2。', 'error');
          } else {
            const f = followers.value.find(fol => fol.id === defenderId);
            if (f) {
              f.lifeCurrent = 0;
              const charmedLevel = f.skill + 4;
              combatState.enemies.push({
                id: generateId(),
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

      if (attack.type === 'slash_eye') {
        addLog('👁️ シーリーンの【斬視】が走りました！ 防具の損壊チェックを行います。', 'info');
        const res = await context.rollSpellResistance!(5);
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

      if (attack.type === 'mad_eye') {
        addLog('👁️ シーリーンの【狂視】により、精神が狂気に侵されます！', 'error');
        const res = await context.rollSpellResistance!(5);
        if (!res.success) {
          const cRoll = randomInt(1, 6);
          addLogFn(`🎲 狂気ロール: 出目 ${cRoll}`, 'info');
          if (cRoll === 1) {
            combatState.isStunned = true;
            addLog('🌀 狂気効果：狂乱状態で行動不能になりました！ 次のラウンドは攻撃も防御もできません。', 'error');
          } else if (cRoll === 2) {
            character.value.hasActiveLantern = false;
            addLog('🌀 狂気効果：恐怖のあまりランタンの火を消してしまいました！ 周囲が暗闇に包まれます。', 'error');
          } else if (cRoll === 3) {
            if (character.value.items.length > 0) {
              const itemIdx = randomInt(0, character.value.items.length - 1);
              const lostItem = character.value.items[itemIdx];
              character.value.items.splice(itemIdx, 1);
              addLog(`🌀 狂気効果：狂乱して所持品を投げ捨ててしまいました！ [${lostItem.name}] を破壊。`, 'error');
            } else {
              addLog('🌀 狂気効果：所持品がないため、破壊効果は発生しませんでした。', 'info');
            }
          } else if (cRoll === 4) {
            combatState.isClinging = true;
            addLog('🌀 狂気効果：狂乱して仲間に抱きつき、攻撃の邪魔をします！ 全員の判定ロールに -2。', 'error');
          } else if (cRoll === 5) {
            character.value.lifeCurrent = Math.max(0, character.value.lifeCurrent - 1);
            addLog(`🌀 狂気効果：自傷行為に走り、生命力に1点のダメージを受けました！ (生命力: ${character.value.lifeCurrent})`, 'error');
            if (character.value.lifeCurrent <= 0) {
              context.handleDeath!();
              return;
            }
          } else if (cRoll === 6) {
            combatState.isBerserk = true;
            addLog('🌀 狂気効果：半狂乱状態で興奮状態になり、攻撃ロールに +2 のボーナス！ しかし次の防御で強制的に斬視を受けます！', 'success');
          }
        }
      }
    }
  },

  onGetSpellResistanceBonus(context: ScenarioPluginContext, _target: number) {
    const { activeEvent, character } = context;
    if (activeEvent.value?.d66Code === 'Final3') {
      const hasRose = character.value.items.some(i => i.name === '水晶の薔薇');
      const hasHelmet = character.value.equippedArmor?.name === '天使のヘルメット';
      let bonus = 0;
      if (hasRose) bonus += 2;
      if (hasHelmet) bonus += 2;
      return bonus;
    }
    return 0;
  },

  onBeforeCombatEnd(context: ScenarioPluginContext, isVictory: boolean, _getLoot: boolean) {
    const { activeEvent, combatState, addLog } = context;
    if (isVictory && activeEvent.value?.d66Code === 'Final3' && !combatState.roarCheckedThisCombat) {
      combatState.pendingRoarCheck = 'death';
      addLog('😈 刻の悪魔クロノヴァルスは生命力が0になりましたが、その歪んだ肉体から最後の『時喰いの咆哮』を放ちました！', 'error');
      return true;
    }
    return false;
  },

  async onResolveChronovalsRoar(context: ScenarioPluginContext, checkType: 'start' | 'death') {
    const { combatState, character, activeEvent, addLog, endCombat } = context;
    const res = await context.rollSpellResistance!(5);
    if (!res.success) {
      const rewindAmount = res.fumble ? 2 : 1;
      combatState.pendingRoarCheck = null;
      combatState.active = false;
      context.restorePyramidBossSnapshot!(rewindAmount);
    } else {
      addLog(`🛡️ 悪魔の『時喰いの咆哮』を精神力で耐え抜いた！`, 'success');
      if (checkType === 'start') {
        combatState.pendingRoarCheck = null;
      } else if (checkType === 'death') {
        combatState.pendingRoarCheck = null;
        combatState.roarCheckedThisCombat = true;
        
        const sealingPotIdx = character.value.items.findIndex(i => i.name === '封印の壺');
        if (sealingPotIdx !== -1) {
          character.value.items.splice(sealingPotIdx, 1);
          addLog(`🏺 封印の壺の古代文字が光り輝き、刻の悪魔クロノヴァルスを壺の中へ吸い込んで封印しました！`, 'success');
          (activeEvent.value as any).isResolved = true;
          (activeEvent.value as any).resolutionText = "🏺 刻の悪魔クロノヴァルスを封印の壺に封じ込め、ピラミッドのクリスタルの光は消え去りました。\n宿願は果たされ、ポロメイア王国とアルマシウダの双方が平和を分かち合う未来が訪れます！";
          endCombat!(true, false);
        } else {
          addLog(`⚠️ 封印の壺を所持していない（または壊れている）ため、悪魔を完全に封印できませんでした。`, 'error');
          (activeEvent.value as any).isResolved = true;
          (activeEvent.value as any).resolutionText = "⚠️ 封印の壺が手元にないため、クロノヴァルスは時を置いて再び復活しました。これまでの冒険の時間は悪魔の力によってすべて奪われ、消失してしまいました...";
          endCombat!(true, false);
        }
      }
    }
    return true;
  },

  async onCombatRoundEnd(context: ScenarioPluginContext) {
    const { combatState, character, followers, addLog, rollD6, handleDeath } = context;
    const hasIceMist = combatState.enemies.some((e: any) => e.name === '氷霧の精霊');
    if (hasIceMist) {
      addLog('❄️ 氷霧の精霊の凍てつく霧が部屋全体に充満しています！ 全員防御判定ロールを行います。', 'error');
      const rollHero = await rollD6!(true);
      if (rollHero < 3) {
        character.value.lifeCurrent = Math.max(0, character.value.lifeCurrent - 1);
        addLog(`😢 主人公は寒冷ダメージを受けました。(生命力: ${character.value.lifeCurrent})`, 'damage');
        if (character.value.lifeCurrent <= 0) {
          handleDeath!();
          return;
        }
      } else {
        addLog('🛡️ 主人公は寒冷ダメージを防ぎました。', 'success');
      }
      const activeFollowers = followers.value.filter(f => f.lifeCurrent > 0);
      for (const f of activeFollowers) {
        const rollF = await rollD6!(true);
        if (rollF < 3) {
          f.lifeCurrent = 0;
          addLog(`💀 従者 ${f.name} は凍死しました。`, 'error');
        } else {
          addLog(`🛡️ 従者 ${f.name} は寒冷ダメージを防ぎました。`, 'success');
        }
      }
    }

    if (combatState.isCrocodileClamped) {
      addLog('🐊 砂漠ワニの毎ラウンド終了時の噛みつきダメージが発生！', 'error');
      character.value.lifeCurrent = Math.max(0, character.value.lifeCurrent - 2);
      addLog(`💥 主人公は噛みつき回転により 2 点のダメージを受けました。(生命力: ${character.value.lifeCurrent})`, 'damage');
      if (character.value.lifeCurrent <= 0) {
        handleDeath!();
        return;
      }
    }
  },

  onExploreRoom(context: ScenarioPluginContext) {
    const { activeEvent: eventRef, character, followers } = context;
    if (!eventRef.value) return;
    const event = eventRef.value;
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

  onAdventureEnd(context: ScenarioPluginContext) {
    const { character, followers } = context;
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
  },

  async onCombatVictory(context: ScenarioPluginContext): Promise<boolean | void> {
    const { character, combatState, dungeonDepth, activeEvent, activeScenario, pyramidRunCount } = context;
    
    if (activeEvent.value?.d66Code === '23') {
      const run = pyramidRunCount.value;
      if (run === 1) {
        character.value.items.push({
          id: 'strong_pill',
          name: '剛力丸',
          type: 'accessory',
          goldCost: 15,
          value: 15,
          description: '【シナリオ限定】強壮剤。【筋力ロール】時に服用すると、＋1のボーナスが受けられる。１回分（使い捨て）。'
        } as any);
        addLogFn('🎁 ジル＝メガから手助けの礼として『剛力丸』を受け取りました！', 'success');
      } else if (run === 2) {
        character.value.items.push({
          id: 'substitute_amulet',
          name: '身代わりのアミュレット',
          type: 'accessory',
          goldCost: 30,
          value: 30,
          description: '【打撃】により生命点１点を失う際、身代わりになって生命力の減少を無効化する。残り3回分。',
          charges: 3
        } as any);
        addLogFn('🎁 ジル＝メガから手助けの礼として『身代わりのアミュレット』を受け取りました！', 'success');
      } else {
        addLogFn('🎁 ジル＝メガは自分に託された使命として『封印の壺』を君に託しました！', 'success');
      }
    }

    if (activeEvent.value?.d66Code === '25') {
      character.value.items.push({
        id: 'adamantite',
        name: 'アダマンタイト',
        type: 'quest',
        goldCost: 20,
        value: 20,
        description: '頑強な地下鉱物の原石。武具の素材として使われる。原石のまま投擲武器としても使用できるが、大きく重いため【判定ロール】に−２の修正が入る。代わりに命中すればダメージに＋１される。１回の戦闘で１度しか使用できない。逃走した場合は失われる。'
      } as any);
      addLogFn('🎁 アランに勝利し、見事に『アダマンタイト』を獲得しました！', 'success');
    }

    if (activeEvent.value?.d66Code === 'Final2') {
      const scenarioData = activeScenario.value;
      const origin = (character.value as any).pyramidOrigin || 'polomeia';
      const epilogue = (scenarioData as any)?.epilogues?.["2"]?.[origin];

      let goldReward = 30;
      if (epilogue && epilogue.goldBase && epilogue.goldDiceCount) {
        goldReward = epilogue.goldBase;
        const rolls = [];
        for (let i = 0; i < epilogue.goldDiceCount; i++) {
          const d = randomInt(1, 6);
          rolls.push(d);
          goldReward += d;
        }
        addLogFn(`🎲 金貨ロール (3d6: ${rolls.join('+')})`, 'roll');
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
            addLogFn(p.trim(), 'info');
          }
        });
      }

      pyramidRunCount.value = 3;
      dungeonDepth.value = 0;
      activeEvent.value = null;
      combatState.active = false;
      combatState.isOver = false;
      combatState.resultType = null;
      context.triggerLevelUp();
      addLogFn(`🎉 異端者シーリーンまたは至高のヘラクレオスを撃破し、2回目の冒険をクリアしました！ 金貨${goldReward}枚、1 Exp、プラチナコインを獲得し、レベルアップ画面へ移行します。`, 'success');
      return true;
    }

    if (activeEvent.value?.d66Code === 'Final3') {
      if ((combatState as any).isAnotherEnding) {
        pyramidRunCount.value = 1;
        dungeonDepth.value = 0;
        activeEvent.value = null;
        combatState.active = false;
        combatState.isOver = false;
        combatState.resultType = null;
        (combatState as any).isAnotherEnding = false;
        context.triggerLevelUp();

        const epilogue = (activeScenario.value as any)?.epilogues?.["3"]?.another;
        if (epilogue) {
          const paragraphs = epilogue.text.split('\n');
          paragraphs.forEach((p: string) => {
            if (p.trim()) {
              addLogFn(p.trim(), 'error');
            }
          });
        }
        addLogFn('🌀 悪魔を封印できなかったため、世界線がリセットされ、1回目の冒険から再挑戦となります...', 'error');
        return true;
      } else {
        const epilogue = (activeScenario.value as any)?.epilogues?.["3"]?.success;
        if (epilogue) {
          const paragraphs = epilogue.text.split('\n');
          paragraphs.forEach((p: string) => {
            if (p.trim()) {
              addLogFn(p.trim(), 'success');
            }
          });
        }
        character.value.exp += epilogue?.exp || 2;

        activeEvent.value = null;
        combatState.active = false;
        combatState.isOver = false;
        combatState.resultType = null;
        context.transitionToSuccess();
        return true;
      }
    }

  },

  onCustomSetupSelect(context: ScenarioPluginContext, choiceId: string) {
    const { character, activeScenario } = context;
    (character.value as any).pyramidOriginChosen = true;
    (character.value as any).pyramidOrigin = choiceId;
    (character.value as any).customSetupChosen = true;

    const scenarioData = activeScenario.value;
    if (scenarioData && (scenarioData as any).prologues) {
      const prologue = (scenarioData as any).prologues["1"]?.[choiceId];
      if (prologue) {
        const paragraphs = prologue.text.split('\n');
        paragraphs.forEach((p: string) => {
          if (p.trim()) {
            addLogFn(p.trim(), 'info');
          }
        });
      }
    }

    if (choiceId === 'polomeia') {
      character.value.items.push({
        id: 'golden_brooch',
        name: '黄金虫のブローチ',
        type: 'accessory',
        goldCost: 0,
        description: 'これを身につけていると、副能力値が【器用点】でなくても『察知』を行うことができる。副能力値が【器用点】の場合は、判定ロールに＋１の修正を加えることができる。２回の使用で、ブローチにはヒビが入り効果を失う。また冒険が終わったとき残っていたら、王に返却すること。',
        value: 0,
        charges: 2
      } as any);
    }

    (character.value as any).pyramidPrepRun = 1;
    (character.value as any).prepRunCompleted = 1;
    (character.value as any).pyramidSliderShopDone = true;
    (character.value as any).sliderShopDone = true;
  },

  onPrepPhaseStart(context: ScenarioPluginContext) {
    const { character, activeScenario, pyramidRunCount } = context;
    const run = pyramidRunCount.value;
    const origin = (character.value as any).pyramidOrigin || 'polomeia';
    const scenarioData = activeScenario.value;
    if (!scenarioData || !(scenarioData as any).prologues) return;

    let storyText = '';
    if (run === 1) {
      storyText = (scenarioData as any).prologues["1"]?.[origin]?.text || '';
    } else if (run === 2) {
      storyText = (scenarioData as any).prologues["2"]?.[origin]?.text || '';
    } else if (run === 3) {
      const commonText = (scenarioData as any).prologues["3"]?.common?.text || '';
      const uniqueText = (scenarioData as any).prologues["3"]?.[origin]?.text || '';
      storyText = commonText + '\n\n' + uniqueText;
    }

    if (storyText) {
      const paragraphs = storyText.split('\n');
      paragraphs.forEach((p: string) => {
        if (p.trim()) {
          addLogFn(p.trim(), 'info');
        }
      });
    }

    if (run === 3) {
      const rewardKey = origin === 'polomeia' ? 'rewardItemsPolomeia' : 'rewardItemsAlmaciuda';
      const rewards = (scenarioData as any).prologues["3"]?.common?.[rewardKey];
      if (rewards) {
        rewards.forEach((r: any) => {
          if (r.type === 'one-handed') {
            if (!character.value.weapons.some(w => w.name === r.name)) {
              character.value.weapons.push({ ...r });
              addLogFn(`⚔️ 支給品 『${r.name}』 を受け取りました！`, 'success');
            }
          } else {
            if (!character.value.items.some(i => i.id === r.id)) {
              character.value.items.push({ ...r });
              addLogFn(`🎒 支給品 『${r.name}』 を受け取りました！`, 'success');
            }
          }
        });
      }
    }

    (character.value as any).pyramidPrepRun = run;
    (character.value as any).prepRunCompleted = run;

    if (run === 3) {
      (character.value as any).pyramidSliderShopDone = false;
      (character.value as any).sliderShopDone = false;
    } else {
      (character.value as any).pyramidSliderShopDone = true;
      (character.value as any).sliderShopDone = true;
    }
  },

  onSliderShopFinish(context: ScenarioPluginContext) {
    (context.character.value as any).pyramidSliderShopDone = true;
    (context.character.value as any).sliderShopDone = true;
  },

  onResolveEventOverride(context: ScenarioPluginContext) {
    const { activeEvent, pyramidRunCount, dungeonDepth, currentScreen } = context;
    if (activeEvent.value?.d66Code === 'Final1' || activeEvent.value?.d66Code === 'Final2') {
      if (activeEvent.value?.d66Code === 'Final1') {
        pyramidRunCount.value = 2;
      } else if (activeEvent.value?.d66Code === 'Final2') {
        pyramidRunCount.value = 3;
      }
      dungeonDepth.value = 0;
      activeEvent.value = null;
      currentScreen.value = 'levelup';
      addLogFn(`🧭 冒険を終え、無事に砂漠の迷宮から帰還しました！ (次の周回: ${pyramidRunCount.value}回目 / 3)`, 'success');
      return true;
    }
    return false;
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
  if ((event as any).customChoices) {
    (event as any).customChoices = (event as any).customChoices.filter((c: any) => c.id !== choiceId);
  }

  // If no choices left, resolve room
  if ((event as any).customChoices && (event as any).customChoices.filter((c: any) => c.id !== 'web_leave').length === 0) {
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
  const reactRoll = randomInt(1, 6);
  addLogFn(`🐜 アリ人の反応チェック (1d6ロール: ${reactRoll})`, 'roll');
  const numAnts = randomInt(1, 6) + 3;
  
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
        const reactRoll = randomInt(1, 6);
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


