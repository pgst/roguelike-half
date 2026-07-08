import { test, expect, type Locator } from '@playwright/test';
import { safeClick, disableAnimations } from './helpers/test-utils';

async function isElementEnabled(locator: Locator): Promise<boolean> {
  try {
    return await locator.isEnabled({ timeout: 50 });
  } catch {
    return false;
  }
}

test('Pyramid of Chronodemon scenario full play-through verification', async ({ page }) => {
  test.setTimeout(300000);

  await page.goto('/');
  await disableAnimations(page);

  const maxActions = 250;
  const maxLoops = 2500;
  
  let actionCount = 0;
  let loopCount = 0;
  let reachedEnd = false;

  console.log('Starting Pyramid of Chronodemon scenario play-through...');

  while (actionCount < maxActions && loopCount < maxLoops) {
    loopCount++;
    
    await page.waitForTimeout(50);

    const screen = await page.evaluate(() => {
      if (document.querySelector('.victory-card')) return 'victory';
      if (document.querySelector('.gameover-card')) return 'gameover';
      if (document.querySelector('.scenario-selector')) return 'selector';
      if (document.querySelector('.creator-card')) return 'creator';
      if (document.querySelector('.levelup-card')) return 'levelup';
      if (document.querySelector('.explorer-card')) return 'explorer';
      if (document.querySelector('.combat-card')) return 'combat';
      return 'unknown';
    });

    if (screen === 'victory') {
      console.log(`🎉 Reached Victory (Success) Screen after ${actionCount} actions (loops: ${loopCount})!`);
      reachedEnd = true;
      break;
    }
    if (screen === 'gameover') {
      console.log(`💀 Reached Game Over Screen after ${actionCount} actions (loops: ${loopCount})!`);
      reachedEnd = true;
      break;
    }

    // 1. Scenario selection - Target "刻の悪魔のピラミッド"
    if (screen === 'selector') {
      const scenarioCard = page.locator('.scenario-card').filter({ hasText: '刻の悪魔のピラミッド' }).first();
      if (await safeClick(scenarioCard, 'Selecting Pyramid of Chronodemon scenario card', 500)) {
        actionCount++;
      }
      continue;
    }

    // 2. Character creation
    if (screen === 'creator') {
      console.log(`[Action ${actionCount}] Filling character details...`);
      await page.fill('#char-name', 'Chronodemon Hero');
      
      const archCard = page.locator('.archetype-card').first();
      await safeClick(archCard, 'First archetype card', 200);

      const submitBtn = page.locator('button:has-text("キャラクターの命運を紡ぎ出す")');
      if (await safeClick(submitBtn, 'Create character button', 500)) {
        actionCount++;
      }
      continue;
    }

    // 3. Level-up / Town Market
    if (screen === 'levelup') {
      const spellBtn = page.locator('.spell-learning-section button.btn-mini:not([disabled])');
      let learnedSpell = false;
      
      while (await spellBtn.first().isVisible({ timeout: 0 }) && await isElementEnabled(spellBtn.first())) {
        const success = await safeClick(spellBtn.first(), 'Learn a spell/miracle', 150);
        if (!success) break;
        learnedSpell = true;
        actionCount++;
        await page.waitForTimeout(50);
      }

      const lifeBtn = page.locator('.ledger-row:has-text("生命点") button:has-text("+1上昇")');
      let clickedLife = false;
      
      while (await lifeBtn.isVisible({ timeout: 0 }) && await isElementEnabled(lifeBtn)) {
        const success = await safeClick(lifeBtn, 'Life increase (+1 Life)', 150);
        if (!success) break;
        clickedLife = true;
        actionCount++;
        await page.waitForTimeout(50);
      }

      if (!clickedLife && !learnedSpell) {
        const startBtn = page.locator('button:has-text("冒煙を開始する"), button:has-text("冒険を開始する")');
        const selectScenarioBtn = page.locator('button:has-text("次のシナリオを選択する")');
        if (await startBtn.isVisible({ timeout: 0 })) {
          if (await safeClick(startBtn, 'Start adventure button', 500)) {
            actionCount++;
          }
        } else if (await selectScenarioBtn.isVisible({ timeout: 0 })) {
          if (await safeClick(selectScenarioBtn, 'Select next scenario button', 500)) {
            actionCount++;
          }
        }
      }
      continue;
    }

    // 4. Dungeon Exploration
    if (screen === 'explorer') {
      const overlimitBanner = page.locator('.overlimit-warning-banner');
      if (await overlimitBanner.isVisible({ timeout: 0 })) {
        const discardBtn = page.locator('.adventure-sheet button:has-text("捨てる")');
        if (await discardBtn.first().isVisible({ timeout: 0 })) {
          if (await safeClick(discardBtn.first(), 'Discarding item to resolve inventory overlimit')) {
            actionCount++;
            continue;
          }
        }
      }

      const proceedBtn = page.locator('button:has-text("次の小部屋へ進む")');
      const trapBtn = page.locator('button:has-text("判定ロールに挑戦する"), button:has-text("で挑戦"), button:has-text("器用判定ロールを行う")');
      const treasureBtn = page.locator('button:has-text("宝物を入手する")');
      const restHealBtn = page.locator('button:has-text("怪我を癒やす"), button:has-text("魔力/運気を回復")');
      const fightBribeBtn = page.locator('button:has-text("交渉決裂！戦う！")');
      const npcMercenaryBtn = page.locator('button:has-text("無視して進む"), button:has-text("治療して味方にする")');
      const npcPriestBtn = page.locator('button:has-text("傷の癒やしを乞う"), button:has-text("聖水を譲り受ける")');
      const leaveMerchantBtn = page.locator('button:has-text("部屋を立ち去る"), button:has-text("取引を終えて部屋を進む")');
      const skipPerceptionBtn = page.locator('button:has-text("察知せずに部屋に入る")');
      const exploreBtn = page.locator('button:has-text("d66を振って次の部屋を探索する")');

      // 準備フェーズ・スライダー商会用ボタン
      const prepBtn = page.locator('button:has-text("状況を確認して支給品を受け取る")');
      const finishSliderBtn = page.locator('button:has-text("取引を終えて探索を開始する")');
      const sliderForgeBtn = page.locator('.slider-shop-panel button:has-text("加工する")');
      const viewOriginChoicesBtn = page.locator('button:has-text("背景を確認し、自分の所属（出自）の選択へ進む")');

      // Custom Choices button
      const customChoiceBtn = page.locator('.custom-choices-panel button.btn-ink:not([disabled])');

      // Pyramid Choice buttons
      const choiceGolemBtn = page.locator('button:has-text("至高のヘラクレオスと戦う")');
      const choiceShireenBtn = page.locator('button:has-text("異端者シーリーンと戦う")');
      const crocodileBribeFood = page.locator('button:has-text("食料 2 個を差し出して")');
      const jillMegaBtn = page.locator('button:has-text("ジル＝メガを手助けする")');

      // New NPC choice buttons
      const rollAlanReactionBtn = page.locator('button:has-text("アランの反応チェックを行う")');
      const alanNeutralDuelBtn = page.locator('button:has-text("1対1の決闘を受ける")');
      const rollPaintingLuckBtn = page.locator('button:has-text("幸運判定ロールを行う")');
      const rollPaintingRangedBtn = page.locator('button:has-text("遠距離攻撃を行う")');
      const useSacredStoneBtn = page.locator('button:has-text("聖石を使用して")');
      const rollArmReactionBtn = page.locator('button:has-text("反応チェックを行う"):not(:has-text("アラン"))');
      const ignoreArmBtn = page.locator('button:has-text("無視して先に進む")');

      // Skeleton Event buttons
      const contactBtn = page.locator('button:has-text("接触を試みる")');
      const skeletonLeaveBtn = page.locator('button:has-text("見つからないように立ち去る"), button:has-text("取引もアドバイスも受けずに立ち去る")');
      const tradeBtn = page.locator('button:has-text("交換を申し出る")');
      const adviceBtn = page.locator('button:has-text("の部屋へ")');
      const skeletonConfirmBtn = page.locator('button:has-text("取引を終了して結果を確定する"), button:has-text("結果を確定する")');

      if (await proceedBtn.isVisible({ timeout: 0 }) && await isElementEnabled(proceedBtn)) {
        if (await safeClick(proceedBtn, 'Proceed to next room')) actionCount++;
      } else if (await jillMegaBtn.isVisible({ timeout: 0 }) && await isElementEnabled(jillMegaBtn)) {
        if (await safeClick(jillMegaBtn, 'Help Jill-Mega')) actionCount++;
      } else if (await rollAlanReactionBtn.isVisible({ timeout: 0 }) && await isElementEnabled(rollAlanReactionBtn)) {
        if (await safeClick(rollAlanReactionBtn, 'Roll Alan reaction check')) actionCount++;
      } else if (await alanNeutralDuelBtn.isVisible({ timeout: 0 }) && await isElementEnabled(alanNeutralDuelBtn)) {
        if (await safeClick(alanNeutralDuelBtn, 'Accept 1-on-1 duel from Alan')) actionCount++;
      } else if (await rollPaintingLuckBtn.isVisible({ timeout: 0 }) && await isElementEnabled(rollPaintingLuckBtn)) {
        if (await safeClick(rollPaintingLuckBtn, 'Roll Painting luck check')) actionCount++;
      } else if (await rollPaintingRangedBtn.isVisible({ timeout: 0 }) && await isElementEnabled(rollPaintingRangedBtn)) {
        if (await safeClick(rollPaintingRangedBtn, 'Attempt ranged attack on painting priest')) actionCount++;
      } else if (await useSacredStoneBtn.first().isVisible({ timeout: 0 }) && await isElementEnabled(useSacredStoneBtn.first())) {
        if (await safeClick(useSacredStoneBtn.first(), 'Use Sacred Stone to save Heracles soul')) actionCount++;
      } else if (await rollArmReactionBtn.isVisible({ timeout: 0 }) && await isElementEnabled(rollArmReactionBtn)) {
        if (await safeClick(rollArmReactionBtn, 'Roll Heracles arm reaction check')) actionCount++;
      } else if (await ignoreArmBtn.first().isVisible({ timeout: 0 }) && await isElementEnabled(ignoreArmBtn.first())) {
        if (await safeClick(ignoreArmBtn.first(), 'Ignore Heracles arm')) actionCount++;
      } else if (await viewOriginChoicesBtn.isVisible({ timeout: 0 }) && await isElementEnabled(viewOriginChoicesBtn)) {
        if (await safeClick(viewOriginChoicesBtn, 'View origin choices after introduction')) actionCount++;
      } else if (await prepBtn.isVisible({ timeout: 0 }) && await isElementEnabled(prepBtn)) {
        if (await safeClick(prepBtn, 'Read prologue and receive rewards')) actionCount++;
      } else if (await sliderForgeBtn.first().isVisible({ timeout: 0 }) && await isElementEnabled(sliderForgeBtn.first())) {
        if (await safeClick(sliderForgeBtn.first(), 'Forge equipment at Slider shop')) actionCount++;
      } else if (await finishSliderBtn.isVisible({ timeout: 0 }) && await isElementEnabled(finishSliderBtn)) {
        if (await safeClick(finishSliderBtn, 'Finish Slider shop and start exploration')) actionCount++;
      } else if (await customChoiceBtn.first().isVisible({ timeout: 0 }) && await isElementEnabled(customChoiceBtn.first())) {
        if (await safeClick(customChoiceBtn.first(), 'Click scenario plugin custom choice')) actionCount++;
      } else if (await contactBtn.isVisible({ timeout: 0 }) && await isElementEnabled(contactBtn)) {
        if (await safeClick(contactBtn, 'Contact skeleton')) actionCount++;
      } else if (await tradeBtn.first().isVisible({ timeout: 0 }) && await isElementEnabled(tradeBtn.first())) {
        if (await safeClick(tradeBtn.first(), 'Offer weapon trade')) actionCount++;
      } else if (await adviceBtn.first().isVisible({ timeout: 0 }) && await isElementEnabled(adviceBtn.first())) {
        if (await safeClick(adviceBtn.first(), 'Select direction advice')) actionCount++;
      } else if (await skeletonConfirmBtn.isVisible({ timeout: 0 }) && await isElementEnabled(skeletonConfirmBtn)) {
        if (await safeClick(skeletonConfirmBtn, 'Confirm skeleton event')) actionCount++;
      } else if (await skeletonLeaveBtn.first().isVisible({ timeout: 0 }) && await isElementEnabled(skeletonLeaveBtn.first())) {
        if (await safeClick(skeletonLeaveBtn.first(), 'Leave skeleton encounter')) actionCount++;
      } else if (await choiceGolemBtn.isVisible({ timeout: 0 }) && await isElementEnabled(choiceGolemBtn)) {
        if (await safeClick(choiceGolemBtn, 'Fight Supreme Heracles')) actionCount++;
      } else if (await choiceShireenBtn.isVisible({ timeout: 0 }) && await isElementEnabled(choiceShireenBtn)) {
        if (await safeClick(choiceShireenBtn, 'Fight Shireen')) actionCount++;
      } else if (await crocodileBribeFood.isVisible({ timeout: 0 }) && await isElementEnabled(crocodileBribeFood)) {
        if (await safeClick(crocodileBribeFood, 'Bribe crocodile with food')) actionCount++;
      } else if (await trapBtn.first().isVisible({ timeout: 0 }) && await isElementEnabled(trapBtn.first())) {
        if (await safeClick(trapBtn.first(), 'Attempt trap roll')) actionCount++;
      } else if (await treasureBtn.isVisible({ timeout: 0 }) && await isElementEnabled(treasureBtn)) {
        if (await safeClick(treasureBtn, 'Loot treasure chest')) actionCount++;
      } else if (await restHealBtn.first().isVisible({ timeout: 0 }) && await isElementEnabled(restHealBtn.first())) {
        if (await safeClick(restHealBtn.first(), 'Select rest healing')) actionCount++;
      } else if (await fightBribeBtn.isVisible({ timeout: 0 }) && await isElementEnabled(fightBribeBtn)) {
        if (await safeClick(fightBribeBtn, 'Fight goblin negotiator / crocodile')) actionCount++;
      } else if (await npcPriestBtn.first().isVisible({ timeout: 0 }) && await isElementEnabled(npcPriestBtn.first())) {
        if (await safeClick(npcPriestBtn.first(), 'Request priest healing')) actionCount++;
      } else if (await npcMercenaryBtn.first().isVisible({ timeout: 0 }) && await isElementEnabled(npcMercenaryBtn.first())) {
        if (await safeClick(npcMercenaryBtn.first(), 'Ignore/Recruit NPC mercenary')) actionCount++;
      } else if (await leaveMerchantBtn.first().isVisible({ timeout: 0 }) && await isElementEnabled(leaveMerchantBtn.first())) {
        if (await safeClick(leaveMerchantBtn.first(), 'Leave merchant/market')) actionCount++;
      } else if (await skipPerceptionBtn.isVisible({ timeout: 0 }) && await isElementEnabled(skipPerceptionBtn)) {
        if (await safeClick(skipPerceptionBtn, 'Skip perception check and enter room')) actionCount++;
      } else if (await exploreBtn.isVisible({ timeout: 0 }) && await isElementEnabled(exploreBtn)) {
        if (await safeClick(exploreBtn, 'Roll d66 to explore next room')) actionCount++;
      }
      continue;
    }

    // 5. Combat
    if (screen === 'combat') {
      const roarBtn = page.locator('button:has-text("抵抗判定を行う")');
      const clueBtn = page.locator('button:has-text("手がかりを消費")');

      const coverBtn = page.locator('button:has-text("を基準にしてかばう")');
      const cancelCoverBtn = page.locator('button:has-text("かばうのを見送る")');
      const defendBtn = page.locator('button:has-text("主人公が防御する")');
      const lootRollBtn = page.locator('button:has-text("宝箱を開ける (ダイスを振る)")');
      const confirmCombatBtn = page.locator('button:has-text("結果を承認")');
      const reactionConfirmBtn = page.locator('button:has-text("結果を承認して進む")');
      const refuseBribeBtn = page.locator('button:has-text("拒否して戦闘する")');
      const reactionRollBtn = page.locator('button:has-text("反応チェックを行う")');
      const closeRangedBtn = page.locator('button:has-text("接近戦へ移行する")');
      const switchWeaponBtn = page.locator('button:has-text("武器を持ち替える")');
      const escapeBtn = page.locator('button:has-text("戦闘から逃走する")');
      const attackBtn = page.locator('button:has-text("通常攻撃")');
      const deflectBtn = page.locator('button:has-text("そらしを発動する")');
      const skipDeflectBtn = page.locator('button:has-text("発動を見送る")');
      const holyArrowBtn = page.locator('button:has-text("聖なる矢を放つ")');

      const sheetText = await page.locator('.adventure-sheet').textContent();
      const cannotAttack = sheetText?.includes('麻痺') || sheetText?.includes('石化') || sheetText?.includes('気絶');

      if (await roarBtn.isVisible({ timeout: 0 }) && await isElementEnabled(roarBtn)) {
        if (await safeClick(roarBtn, 'Attempt Chronovals Roar resistance check')) actionCount++;
      } else if (await clueBtn.isVisible({ timeout: 0 }) && await isElementEnabled(clueBtn)) {
        if (await safeClick(clueBtn, 'Spend Clue to bypass Shireen future sight')) actionCount++;
      } else if (await deflectBtn.isVisible({ timeout: 0 }) && await isElementEnabled(deflectBtn)) {
        if (await safeClick(deflectBtn, 'Use deflect miracle')) actionCount++;
      } else if (await skipDeflectBtn.isVisible({ timeout: 0 }) && await isElementEnabled(skipDeflectBtn)) {
        if (await safeClick(skipDeflectBtn, 'Skip deflect miracle')) actionCount++;
      } else if (await holyArrowBtn.first().isVisible({ timeout: 0 }) && await isElementEnabled(holyArrowBtn.first())) {
        if (await safeClick(holyArrowBtn.first(), 'Fire holy arrow')) actionCount++;
      } else if (await coverBtn.first().isVisible({ timeout: 0 }) && await isElementEnabled(coverBtn.first())) {
        if (await safeClick(coverBtn.first(), 'Perform cover action')) actionCount++;
      } else if (await cancelCoverBtn.isVisible({ timeout: 0 }) && await isElementEnabled(cancelCoverBtn)) {
        if (await safeClick(cancelCoverBtn, 'Decline cover action')) actionCount++;
      } else if (await defendBtn.isVisible({ timeout: 0 }) && await isElementEnabled(defendBtn)) {
        let defenseCount = 0;
        while (await defendBtn.isVisible({ timeout: 0 }) && await isElementEnabled(defendBtn) && defenseCount < 10) {
          const success = await safeClick(defendBtn, 'Player defense roll', 300);
          if (!success) break;
          defenseCount++;
          actionCount++;
          await page.waitForTimeout(50);
        }
      } else if (cannotAttack && await escapeBtn.isVisible({ timeout: 0 }) && await isElementEnabled(escapeBtn)) {
        if (await safeClick(escapeBtn, 'Escape from combat due to paralysis/petrification/faint')) actionCount++;
      } else if (await lootRollBtn.isVisible({ timeout: 0 }) && await isElementEnabled(lootRollBtn)) {
        if (await safeClick(lootRollBtn, 'Roll combat victory loot')) actionCount++;
      } else if (await confirmCombatBtn.isVisible({ timeout: 0 }) && await isElementEnabled(confirmCombatBtn)) {
        if (await safeClick(confirmCombatBtn, 'Confirm combat result')) actionCount++;
      } else if (await reactionConfirmBtn.isVisible({ timeout: 0 }) && await isElementEnabled(reactionConfirmBtn)) {
        if (await safeClick(reactionConfirmBtn, 'Confirm reaction check result')) actionCount++;
      } else if (await refuseBribeBtn.isVisible({ timeout: 0 }) && await isElementEnabled(refuseBribeBtn)) {
        if (await safeClick(refuseBribeBtn, 'Refuse bribe and fight')) actionCount++;
      } else if (await reactionRollBtn.isVisible({ timeout: 0 }) && await isElementEnabled(reactionRollBtn)) {
        if (await safeClick(reactionRollBtn, 'Roll reaction check')) actionCount++;
      } else if (await closeRangedBtn.isVisible({ timeout: 0 }) && await isElementEnabled(closeRangedBtn)) {
        if (await safeClick(closeRangedBtn, 'Transition to melee combat')) actionCount++;
      } else if (await switchWeaponBtn.isVisible({ timeout: 0 }) && await isElementEnabled(switchWeaponBtn)) {
        if (await safeClick(switchWeaponBtn, 'Perform weapon switching transition')) actionCount++;
      } else if (await attackBtn.first().isVisible({ timeout: 0 }) && await isElementEnabled(attackBtn.first())) {
        if (await safeClick(attackBtn.first(), 'Attack first enemy in close combat')) actionCount++;
      }
      continue;
    }
  }

  expect(reachedEnd).toBe(true);
});
