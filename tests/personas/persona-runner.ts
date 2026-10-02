import { type Page, type Locator, expect } from '@playwright/test';
import type { PersonaConfig } from './persona-types';
import { safeClick, disableAnimations, selectScenarioInUI } from '../helpers/test-utils';

async function isElementEnabled(locator: Locator): Promise<boolean> {
  try {
    return await locator.isEnabled({ timeout: 50 });
  } catch {
    return false;
  }
}

export interface SimulationResult {
  outcome: 'victory' | 'gameover' | 'timeout';
  steps: number;
  persona: PersonaConfig;
}

/**
 * ペルソナ設定に従って、キャラクター作成からシナリオ踏破または全滅までを
 * 自律的にシミュレーション実行するコアエンジン。
 */
export async function runPersonaSimulation(
  page: Page,
  persona: PersonaConfig,
  maxSteps = 250
): Promise<SimulationResult> {
  console.log(`\n======================================================`);
  console.log(`[Persona Simulation Start] ID: ${persona.id} | Name: ${persona.name} | Archetype: ${persona.archetype}`);
  console.log(`======================================================\n`);

  // 1. ダイアログ自動承諾・ストレージ事前初期化・クリーンな状態でトップページへ移動
  page.on('dialog', dialog => dialog.accept());
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.locator('#app').waitFor({ state: 'attached', timeout: 10000 });
  await disableAnimations(page);

  let currentStep = 0;
  let reachedEnd = false;
  let finalOutcome: 'victory' | 'gameover' | 'timeout' = 'timeout';
  const simContext = { skipMagicInCombat: false };

  while (currentStep < maxSteps && !reachedEnd) {
    currentStep++;
    await page.waitForTimeout(150);

    // 高速DOM評価による画面状態の検知
    const screen = await page.evaluate(() => {
      if (document.querySelector('.victory-card, .dungeon-victory, .victory-screen')) return 'victory';
      if (document.querySelector('.gameover-card, .game-over-modal')) return 'gameover';
      if (document.querySelector('.scenario-selector')) return 'selector';
      if (document.querySelector('.creator-card, #char-name')) return 'creator';
      if (document.querySelector('.levelup-card')) return 'levelup';
      if (document.querySelector('.combat-card, .combat-simulator')) return 'combat';
      if (document.querySelector('.explorer-card')) return 'explorer';
      return 'unknown';
    });

    if (screen === 'victory') {
      console.log(`🎉 [Step ${currentStep}] シナリオ踏破・勝利画面に到達しました！`);
      const victoryHeader = page.locator('.victory-card, .dungeon-victory, .victory-screen, h2:has-text("シナリオクリア"), h2:has-text("勝利")').first();
      await expect(victoryHeader).toBeVisible({ timeout: 5000 });
      reachedEnd = true;
      finalOutcome = 'victory';
      break;
    }

    if (screen === 'gameover') {
      console.log(`💀 [Step ${currentStep}] ゲームオーバー（名誉ある戦死）画面に到達しました。`);
      const gameoverBanner = page.locator('.gameover-card, .game-over-modal, h2:has-text("ゲームオーバー"), h2:has-text("GAME OVER")').first();
      await expect(gameoverBanner).toBeVisible({ timeout: 5000 });
      reachedEnd = true;
      finalOutcome = 'gameover';
      break;
    }

    if (screen === 'selector') {
      console.log(`[Step ${currentStep}] シナリオ「黒蛇の洞窟」を選択中...`);
      await selectScenarioInUI(page, '黒蛇の洞窟');
      continue;
    }

    if (screen === 'creator') {
      console.log(`[Step ${currentStep}] キャラクター作成中: ${persona.name} (${persona.archetypeCardText})`);
      await page.fill('#char-name', persona.name);
      
      const archCard = page.locator('.archetype-card').filter({ hasText: persona.archetypeCardText }).first();
      await safeClick(archCard, `Archetype: ${persona.archetypeCardText}`, 200);

      const submitBtn = page.locator('button:has-text("キャラクターの命運を紡ぎ出す")');
      await safeClick(submitBtn, 'Create character submit', 400);
      continue;
    }

    if (screen === 'levelup') {
      // 魔術師・導師で呪文習得ボタンが有効な場合は習得
      const spellBtn = page.locator('.spell-learning-section button.btn-mini:not([disabled])').first();
      if (await spellBtn.isVisible({ timeout: 0 }) && await isElementEnabled(spellBtn)) {
        await safeClick(spellBtn, 'Learn initial spell/miracle', 200);
      }

      const startBtn = page.locator('button:has-text("冒険を開始する"), button:has-text("次のシナリオを選択する")').first();
      if (await startBtn.isVisible({ timeout: 0 })) {
        await safeClick(startBtn, 'Start dungeon adventure', 400);
      }
      continue;
    }

    if (screen === 'explorer') {
      simContext.skipMagicInCombat = false;
      await handleExplorerScreen(page, persona, currentStep);
      continue;
    }

    if (screen === 'combat') {
      await handleCombatScreen(page, persona, currentStep, simContext);
      continue;
    }

    // 画面検知ができなかった場合のフェールセーフ
    console.log(`[Step ${currentStep}] 未知の画面状態です。汎用進行ボタンを探索...`);
    const fallbackNext = page.locator('button:has-text("次へ"), button:has-text("進む"), button:has-text("閉じる")').first();
    if (await fallbackNext.isVisible({ timeout: 500 })) {
      await safeClick(fallbackNext, 'Fallback proceed button', 300);
    }
  }

  expect(reachedEnd, `シミュレーションが最大ステップ数 (${maxSteps}) 以内に決着しませんでした (現在: ${finalOutcome})`).toBe(true);

  console.log(`\n======================================================`);
  console.log(`[Persona Simulation End] Result: ${finalOutcome} in ${currentStep} steps`);
  console.log(`======================================================\n`);

  return {
    outcome: finalOutcome,
    steps: currentStep,
    persona
  };
}

/**
 * 探索画面での自律意思決定
 */
async function handleExplorerScreen(page: Page, persona: PersonaConfig, step: number): Promise<void> {
  // 1. ダンジョン潜入・導入・市場離脱などの前進ボタン
  const prepStartBtn = page.locator('button:has-text("ダンジョンへ潜入する"), button:has-text("ダンジョンへ足を踏み入れる"), button:has-text("探索へ向かう"), button:has-text("取引を終えて部屋を進む")').first();
  if (await prepStartBtn.isVisible({ timeout: 0 }) && await isElementEnabled(prepStartBtn)) {
    console.log(`[Step ${step}] ダンジョン準備・潜入ボタンを押下`);
    await safeClick(prepStartBtn, 'Prep start button', 400);
    return;
  }

  // 2. 所持品過多（オーバーリミット）の解決
  const overlimitBanner = page.locator('.overlimit-warning-banner');
  if (await overlimitBanner.isVisible({ timeout: 0 })) {
    console.log(`[Step ${step}] 背負い袋超過警告を検知。アイテムを整理します`);
    const detailBtn = page.locator('.btn-hud-detail, .btn-hud-record').first();
    if (await detailBtn.isVisible({ timeout: 500 })) {
      await safeClick(detailBtn, 'Open detail modal to discard', 300);
      const discardBtn = page.locator('.adventure-sheet button:has-text("捨てる")').filter({ visible: true }).first();
      if (await discardBtn.isVisible({ timeout: 500 })) {
        await safeClick(discardBtn, 'Discarding item', 300);
      }
      await safeClick(page.locator('.btn-close-hud'), 'Close detail modal', 200);
      return;
    }
  }

  // 3. 次の部屋へ進む（イベント完了時）
  const proceedBtn = page.locator('button:has-text("次の小部屋へ進む")').first();
  if (await proceedBtn.isVisible({ timeout: 0 }) && await isElementEnabled(proceedBtn)) {
    console.log(`[Step ${step}] イベント解決: 次の小部屋へ進む`);
    await safeClick(proceedBtn, 'Proceed to next room', 400);
    return;
  }

  // 4. トラップ・判定ロール・探索部屋調査
  const subStatCheckBtn = page.locator('button:has-text("副能力値"), button:has-text("で挑戦"), button:has-text("で調査")').first();
  const normalCheckBtn = page.locator('button:has-text("判定ロールに挑戦する"), button:has-text("調査判定を行う")').first();
  if (persona.preferSubStatForChecks && await subStatCheckBtn.isVisible({ timeout: 0 }) && await isElementEnabled(subStatCheckBtn)) {
    console.log(`[Step ${step}] ペルソナ特性: 副能力値を消費して判定ロール/調査に挑戦`);
    await safeClick(subStatCheckBtn, 'SubStat check roll', 500);
    return;
  } else if (await normalCheckBtn.isVisible({ timeout: 0 }) && await isElementEnabled(normalCheckBtn)) {
    console.log(`[Step ${step}] 通常の判定ロール/調査に挑戦`);
    await safeClick(normalCheckBtn, 'Normal check roll', 500);
    return;
  }

  // 5. トラップダメージ配分（自動または手動選択）
  const trapDamageHeroBtn = page.locator('button:has-text("主人公が受ける")').first();
  if (await trapDamageHeroBtn.isVisible({ timeout: 0 }) && await isElementEnabled(trapDamageHeroBtn)) {
    console.log(`[Step ${step}] トラップダメージを主人公が受傷`);
    await safeClick(trapDamageHeroBtn, 'Trap damage hero', 300);
    return;
  }

  // 6. コボルド隠者・ゴブリンなどの遭遇・交渉選択肢
  const fightBribeBtn = page.locator('button:has-text("交渉決裂！戦う！"), button:has-text("ワイロを払う")').first();
  if (await fightBribeBtn.isVisible({ timeout: 0 }) && await isElementEnabled(fightBribeBtn)) {
    console.log(`[Step ${step}] 遭遇イベント: 戦闘またはワイロ選択`);
    await safeClick(fightBribeBtn, 'Fight / bribe encounter', 400);
    return;
  }

  // 7. 宝箱・休息・NPC
  const treasureBtn = page.locator('button:has-text("宝物を入手する"), button:has-text("宝箱を開ける")').first();
  if (await treasureBtn.isVisible({ timeout: 0 }) && await isElementEnabled(treasureBtn)) {
    console.log(`[Step ${step}] 宝物を入手`);
    await safeClick(treasureBtn, 'Get treasure', 300);
    return;
  }

  const restHealBtn = page.locator('button:has-text("怪我を癒やす"), button:has-text("傷の癒やしを乞う")').first();
  if (await restHealBtn.isVisible({ timeout: 0 }) && await isElementEnabled(restHealBtn)) {
    console.log(`[Step ${step}] 休息: 怪我を癒やす`);
    await safeClick(restHealBtn, 'Rest heal', 300);
    return;
  }

  const leaveRoomBtn = page.locator('button:has-text("部屋を立ち去る"), button:has-text("無視して進む"), button:has-text("放っておいて先に進む")').first();
  if (await leaveRoomBtn.isVisible({ timeout: 0 }) && await isElementEnabled(leaveRoomBtn)) {
    console.log(`[Step ${step}] 部屋を立ち去る / 無視して進む`);
    await safeClick(leaveRoomBtn, 'Leave room', 300);
    return;
  }

  // 8. 汎用イベント選択肢
  const genericChoiceBtn = page.locator('.custom-choices-panel button.btn-ink:not([disabled]), .event-choices button.btn-ink:not([disabled])').first();
  if (await genericChoiceBtn.isVisible({ timeout: 0 }) && await isElementEnabled(genericChoiceBtn)) {
    console.log(`[Step ${step}] 汎用イベント選択肢を押下`);
    await safeClick(genericChoiceBtn, 'Generic choice button', 300);
    return;
  }

  // 9. 察知判定
  const skipPerceptionBtn = page.locator('button:has-text("察知せずに部屋に入る")').first();
  const doPerceptionBtn = page.locator('button:has-text("察知判定を行う"), button:has-text("危険を察知する")').first();
  if (persona.preferPerception && await doPerceptionBtn.isVisible({ timeout: 0 }) && await isElementEnabled(doPerceptionBtn)) {
    console.log(`[Step ${step}] ペルソナ特性: 危険察知を実行`);
    await safeClick(doPerceptionBtn, 'Do perception check', 400);
    return;
  } else if (await skipPerceptionBtn.isVisible({ timeout: 0 }) && await isElementEnabled(skipPerceptionBtn)) {
    console.log(`[Step ${step}] 察知せずに部屋に入る`);
    await safeClick(skipPerceptionBtn, 'Skip perception', 300);
    return;
  }

  // 10. 部屋探索ダイスを振る
  const exploreBtn = page.locator('button:has-text("d66を振って次の部屋を探索する")').first();
  if (await exploreBtn.isVisible({ timeout: 0 }) && await isElementEnabled(exploreBtn)) {
    console.log(`[Step ${step}] d66を振って次の部屋を探索開始`);
    await safeClick(exploreBtn, 'Explore room with d66', 800);
    return;
  }
}

/**
 * 戦闘画面での自律意思決定
 */
async function handleCombatScreen(
  page: Page, 
  persona: PersonaConfig, 
  step: number, 
  simContext: { skipMagicInCombat: boolean }
): Promise<void> {
  // 1. 反応チェック
  const reactionRollBtn = page.locator('button:has-text("反応チェックを行う"), button:has-text("遭遇反応ロール")').first();
  if (await reactionRollBtn.isVisible({ timeout: 0 }) && await isElementEnabled(reactionRollBtn)) {
    console.log(`[Step ${step}] 戦闘: 反応チェックを実施`);
    await safeClick(reactionRollBtn, 'Reaction check', 500);
    return;
  }

  const reactionConfirmBtn = page.locator('button:has-text("結果を承認して進む"), button:has-text("反応結果を確定")').first();
  if (await reactionConfirmBtn.isVisible({ timeout: 0 }) && await isElementEnabled(reactionConfirmBtn)) {
    console.log(`[Step ${step}] 戦闘: 反応結果を確定`);
    await safeClick(reactionConfirmBtn, 'Confirm reaction', 300);
    return;
  }

  const refuseBribeBtn = page.locator('button:has-text("拒否して戦闘する")').first();
  if (await refuseBribeBtn.isVisible({ timeout: 0 }) && await isElementEnabled(refuseBribeBtn)) {
    console.log(`[Step ${step}] 戦闘: 交渉を拒否して戦闘開始`);
    await safeClick(refuseBribeBtn, 'Refuse bribe and fight', 300);
    return;
  }

  // 2. 武器持ち替え（弓から接近戦への切り替え）
  const switchWeaponBtn = page.locator('button:has-text("武器を持ち替える")').first();
  if (await switchWeaponBtn.isVisible({ timeout: 0 }) && await isElementEnabled(switchWeaponBtn)) {
    console.log(`[Step ${step}] 戦闘: 武器を持ち替える`);
    await safeClick(switchWeaponBtn, 'Switch weapons', 400);
    return;
  }

  // 3. 聖なる矢
  const holyArrowBtn = page.locator('button:has-text("聖なる矢を放つ")').first();
  if (await holyArrowBtn.isVisible({ timeout: 0 }) && await isElementEnabled(holyArrowBtn)) {
    console.log(`[Step ${step}] 戦闘: 聖なる矢を放つ`);
    await safeClick(holyArrowBtn, 'Fire holy arrow', 400);
    return;
  }

  // 4. 主人公防御
  const defendBtn = page.locator('button:has-text("主人公が防御する")').first();
  if (await defendBtn.isVisible({ timeout: 0 }) && await isElementEnabled(defendBtn)) {
    console.log(`[Step ${step}] 戦闘: 主人公の防御判定`);
    await safeClick(defendBtn, 'Hero defense roll', 400);
    return;
  }

  // 5. かばう
  const coverBtn = page.locator('button:has-text("を基準にしてかばう")').first();
  const cancelCoverBtn = page.locator('button:has-text("かばうのを見送る"), button:has-text("かばうをキャンセル")').first();
  if (persona.preferCover && await coverBtn.isVisible({ timeout: 0 }) && await isElementEnabled(coverBtn)) {
    console.log(`[Step ${step}] ペルソナ特性: 従者をかばう`);
    await safeClick(coverBtn, 'Execute cover', 400);
    return;
  } else if (await cancelCoverBtn.isVisible({ timeout: 0 }) && await isElementEnabled(cancelCoverBtn)) {
    await safeClick(cancelCoverBtn, 'Cancel cover', 300);
    return;
  }

  // 6. 戦闘勝利・戦利品確定
  const lootRollBtn = page.locator('button:has-text("戦利品を獲得する"), button:has-text("宝箱を開ける (ダイスを振る)"), button:has-text("宝箱を開ける")').first();
  if (await lootRollBtn.isVisible({ timeout: 0 }) && await isElementEnabled(lootRollBtn)) {
    console.log(`[Step ${step}] 戦闘勝利: 戦利品を獲得`);
    await safeClick(lootRollBtn, 'Roll combat loot', 400);
    return;
  }

  // 6-1. 器用点【宝物の獲得】（出目調整の選択ダイアログ）
  const dexLootModifyBtn = page.locator('button:has-text("器用点1消費して出目+1に変更")').first();
  const dexLootKeepBtn = page.locator('button:has-text("出目そのままで確定")').first();
  if (await dexLootModifyBtn.isVisible({ timeout: 0 }) && await isElementEnabled(dexLootModifyBtn)) {
    console.log(`[Step ${step}] ペルソナ特性: 器用点を消費して戦利品出目を+1に変更`);
    await safeClick(dexLootModifyBtn, 'Modify loot roll with Dexterity', 400);
    return;
  }
  if (await dexLootKeepBtn.isVisible({ timeout: 0 }) && await isElementEnabled(dexLootKeepBtn)) {
    console.log(`[Step ${step}] 戦利品出目を確定`);
    await safeClick(dexLootKeepBtn, 'Confirm loot roll without modification', 400);
    return;
  }

  const confirmCombatBtn = page.locator('button:has-text("戦闘に勝利した！"), button:has-text("戦闘勝利！次の部屋へ進む"), button:has-text("結果を承認")').first();
  if (await confirmCombatBtn.isVisible({ timeout: 0 }) && await isElementEnabled(confirmCombatBtn)) {
    console.log(`[Step ${step}] 戦闘勝利確定: 次の部屋へ進む`);
    simContext.skipMagicInCombat = false;
    await safeClick(confirmCombatBtn, 'Confirm combat victory', 400);
    return;
  }

  // 7. 状態異常（石化・麻痺）チェック
  const cannotAttack = await page.evaluate(() => {
    try {
      const s = localStorage.getItem('roguelike_half_saved_session');
      if (!s) return false;
      const data = JSON.parse(s);
      const effects = data.character?.statusEffects || [];
      return effects.includes('麻痺') || effects.includes('石化') || effects.includes('気絶');
    } catch {
      return false;
    }
  });

  if (cannotAttack) {
    const spellBackBtn = page.locator('.cmd-magic-menu button:has-text("戻る")').first();
    if (await spellBackBtn.isVisible({ timeout: 0 })) {
      console.log(`[Step ${step}] 状態異常中: 魔法メニューを閉じる`);
      await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('.cmd-magic-menu button')).find(b => b.textContent?.includes('戻る')) as HTMLElement | undefined;
        if (btn) btn.click();
      });
      await page.waitForTimeout(300);
      return;
    }
    const closeRangedBtn = page.locator('button:has-text("接近戦へ移行する")').first();
    if (await closeRangedBtn.isVisible({ timeout: 0 }) && await isElementEnabled(closeRangedBtn)) {
      console.log(`[Step ${step}] 状態異常中 (第0ラウンド): 接近戦へ移行`);
      await safeClick(closeRangedBtn, 'Transition to melee during status effect', 400);
      return;
    }
    const fleeBtn = page.locator('button:has-text("戦闘から逃走する")').first();
    if (await fleeBtn.isVisible({ timeout: 0 }) && await isElementEnabled(fleeBtn)) {
      console.log(`[Step ${step}] 状態異常中: 逃走を試行`);
      await safeClick(fleeBtn, 'Flee from combat', 400);
      return;
    }
    const forceAttackBtn = page.locator('button:has-text("通常攻撃"), button:has-text("攻撃する"), button:has-text("攻撃")').first();
    if (await forceAttackBtn.isVisible({ timeout: 0 }) && await isElementEnabled(forceAttackBtn)) {
      console.log(`[Step ${step}] 状態異常中: 攻撃実行により手番スキップ・敵ターン進行`);
      await safeClick(forceAttackBtn, 'Skip turn attack', 400);
      return;
    }
  }

  // 8. 魔法サブメニュー
  const spellBackBtn = page.locator('.cmd-magic-menu button:has-text("戻る")').first();
  const spellActionBtn = page.locator('.cmd-magic-menu button.btn-spell:not([disabled])').first();
  if (await spellActionBtn.isVisible({ timeout: 0 }) && await isElementEnabled(spellActionBtn)) {
    console.log(`[Step ${step}] ペルソナ特性: 呪文を詠唱`);
    await safeClick(spellActionBtn, 'Cast offensive spell', 500);
    return;
  } else if (await spellBackBtn.isVisible({ timeout: 0 }) && await isElementEnabled(spellBackBtn)) {
    console.log(`[Step ${step}] 詠唱可能な呪文がないためメニューを閉じて通常攻撃へ移行`);
    simContext.skipMagicInCombat = true;
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('.cmd-magic-menu button')).find(b => b.textContent?.includes('戻る')) as HTMLElement | undefined;
      if (btn) btn.click();
    });
    await page.waitForTimeout(300);
    const closeRanged = page.locator('button:has-text("接近戦へ移行する")').first();
    if (await closeRanged.isVisible({ timeout: 200 }) && await isElementEnabled(closeRanged)) {
      await safeClick(closeRanged, 'Transition to melee after closing magic menu', 400);
    }
    const fallbackAtk = page.locator('button:has-text("通常攻撃"), button:has-text("攻撃する"), button:has-text("攻撃")').first();
    if (await fallbackAtk.isVisible({ timeout: 300 }) && await isElementEnabled(fallbackAtk)) {
      await safeClick(fallbackAtk, 'Fallback attack after closing magic menu', 400);
    }
    return;
  }

  if (persona.combatPreference === 'spell_focused' && !simContext.skipMagicInCombat) {
    const openMagicBtn = page.locator('button:has-text("じゅもん")').first();
    if (await openMagicBtn.isVisible({ timeout: 0 }) && await isElementEnabled(openMagicBtn)) {
      console.log(`[Step ${step}] じゅもんメニューを開く`);
      await safeClick(openMagicBtn, 'Open magic menu', 300);
      return;
    }
  }

  // 9. 第0ラウンド（遠距離戦から接近戦への移行）
  const closeRangedBtn = page.locator('button:has-text("接近戦へ移行する")').first();
  const attackBtn = page.locator('button:has-text("通常攻撃"), button:has-text("攻撃する"), button:has-text("攻撃")').first();

  if (await attackBtn.isVisible({ timeout: 0 }) && await isElementEnabled(attackBtn)) {
    console.log(`[Step ${step}] 戦闘: 通常攻撃を実行`);
    await safeClick(attackBtn, 'Execute normal attack', 500);
    return;
  }

  if (await closeRangedBtn.isVisible({ timeout: 0 }) && await isElementEnabled(closeRangedBtn)) {
    console.log(`[Step ${step}] 第0ラウンド終了: 接近戦へ移行`);
    await safeClick(closeRangedBtn, 'Transition to melee', 400);
    return;
  }

  // 10. 逃走ボタン
  const escapeBtn = page.locator('button:has-text("戦闘から逃走する")').first();
  if (await escapeBtn.isVisible({ timeout: 0 }) && await isElementEnabled(escapeBtn)) {
    console.log(`[Step ${step}] 戦闘から逃走を実行`);
    await safeClick(escapeBtn, 'Escape combat', 400);
    return;
  }
}
