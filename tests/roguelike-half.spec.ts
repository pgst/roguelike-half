import { test, expect, type Locator } from '@playwright/test';

// Helper to safely click an element. If the element disappears or becomes unstable 
// during the click due to re-renders or dice animations, we catch the error 
// and let the main game loop retry in the next tick.
// We also wait for `postWaitMs` (default 1500ms for dice animations) after a successful click 
// to prevent rapid double-clicks from disrupting the application state.
async function safeClick(locator: Locator, description: string, postWaitMs = 1500): Promise<boolean> {
  try {
    if (await locator.isVisible() && await locator.isEnabled({ timeout: 1000 })) {
      console.log(`Attempting click: ${description}`);
      await locator.click({ timeout: 3000, force: true });
      await locator.page().waitForTimeout(postWaitMs);
      return true;
    }
  } catch (e: any) {
    console.log(`[Safe Click Info] Click failed/omitted for "${description}": ${e.message}`);
  }
  return false;
}

test('Roguelike Half full play-through verification', async ({ page }) => {
  // Set a longer timeout because the game rolls many dice with animations
  test.setTimeout(300000);

  // Navigate to the base URL
  await page.goto('/');

  // Maximum limits to prevent infinite loop
  const maxActions = 250; // limit actual clicks
  const maxLoops = 2500;  // limit idle polling loops
  
  let actionCount = 0;
  let loopCount = 0;
  let reachedEnd = false;

  console.log('Starting Roguelike Half automation with safe-clicks...');

  while (actionCount < maxActions && loopCount < maxLoops) {
    loopCount++;
    // Take a small break to allow state updates and animations to settle
    await page.waitForTimeout(100);

    // Check if we reached one of the final screens
    if (await page.locator('.victory-card').isVisible()) {
      console.log(`🎉 Reached Victory (Success) Screen after ${actionCount} actions (loops: ${loopCount})!`);
      reachedEnd = true;
      break;
    }
    if (await page.locator('.gameover-card').isVisible()) {
      console.log(`💀 Reached Game Over Screen after ${actionCount} actions (loops: ${loopCount})!`);
      reachedEnd = true;
      break;
    }

    // 1. Scenario Selector Screen
    if (await page.locator('.scenario-selector').isVisible()) {
      const scenarioCard = page.locator('.scenario-card').first();
      if (await safeClick(scenarioCard, 'Selecting first scenario card', 500)) {
        actionCount++;
      }
      continue;
    }

    // 2. Character Creator Screen
    if (await page.locator('.creator-card').isVisible()) {
      console.log(`[Action ${actionCount}] Filling character details...`);
      await page.fill('#char-name', 'Playwright Hero');
      
      // Select the first archetype card (Magic or any)
      const archCard = page.locator('.archetype-card').first();
      await safeClick(archCard, 'First archetype card', 200);

      // Submit character creation
      const submitBtn = page.locator('button:has-text("キャラクターの命運を紡ぎ出す")');
      if (await safeClick(submitBtn, 'Create character button', 500)) {
        actionCount++;
      }
      continue;
    }

    // 3. Level Up / Town Market Screen
    if (await page.locator('.levelup-card').isVisible()) {
      // Learn spells/miracles if available
      const spellBtn = page.locator('.spell-learning-section button.btn-mini:not([disabled])');
      let learnedSpell = false;
      while (await spellBtn.first().isVisible() && await spellBtn.first().isEnabled({ timeout: 1000 })) {
        const success = await safeClick(spellBtn.first(), 'Learn a spell/miracle', 150);
        if (!success) break;
        learnedSpell = true;
        actionCount++;
        await page.waitForTimeout(50);
      }

      // Spend starting exp for Life if possible
      const lifeBtn = page.locator('.ledger-row:has-text("生命点") button:has-text("+1上昇")');
      let clickedLife = false;
      
      // Keep clicking Life increase as long as it's active in this step
      while (await lifeBtn.isVisible() && await lifeBtn.isEnabled({ timeout: 1000 })) {
        const success = await safeClick(lifeBtn, 'Life increase (+1 Life)', 150);
        if (!success) break;
        clickedLife = true;
        actionCount++;
        await page.waitForTimeout(50);
      }

      if (!clickedLife && !learnedSpell) {
        // Start adventure if we cannot click life increase anymore (no exp left or max reached) and no spells were learned in this step
        const startBtn = page.locator('button:has-text("冒険を開始する")');
        if (await safeClick(startBtn, 'Start adventure button', 500)) {
          actionCount++;
        }
      }
      continue;
    }

    // 4. Dungeon Explorer Screen
    if (await page.locator('.explorer-card').isVisible()) {
      const proceedBtn = page.locator('button:has-text("次の小部屋へ進む")');
      const trapBtn = page.locator('button:has-text("判定ロールに挑戦する"), button:has-text("で挑戦")');
      const treasureBtn = page.locator('button:has-text("宝物を入手する")');
      const restHealBtn = page.locator('button:has-text("怪我を癒やす")');
      const fightBribeBtn = page.locator('button:has-text("交渉決裂！戦う！")');
      const npcMercenaryBtn = page.locator('button:has-text("無視して進む")');
      const npcPriestBtn = page.locator('button:has-text("傷の癒やしを乞う")');
      const leaveMerchantBtn = page.locator('button:has-text("部屋を立ち去る"), button:has-text("取引を終えて部屋を進む")');
      const skipPerceptionBtn = page.locator('button:has-text("察知せずに部屋に入る")');
      const exploreBtn = page.locator('button:has-text("d66を振って次の部屋を探索する")');

      if (await proceedBtn.isVisible()) {
        if (await safeClick(proceedBtn, 'Proceed to next room')) actionCount++;
      } else if (await trapBtn.first().isVisible()) {
        if (await safeClick(trapBtn.first(), 'Attempt trap roll')) actionCount++;
      } else if (await treasureBtn.isVisible()) {
        if (await safeClick(treasureBtn, 'Loot treasure chest')) actionCount++;
      } else if (await restHealBtn.isVisible()) {
        if (await safeClick(restHealBtn, 'Select rest healing')) actionCount++;
      } else if (await fightBribeBtn.isVisible()) {
        if (await safeClick(fightBribeBtn, 'Fight goblin negotiator')) actionCount++;
      } else if (await npcPriestBtn.isVisible()) {
        if (await safeClick(npcPriestBtn, 'Request priest healing')) actionCount++;
      } else if (await npcMercenaryBtn.first().isVisible()) {
        if (await safeClick(npcMercenaryBtn.first(), 'Ignore NPC (mercenary/captive)')) actionCount++;
      } else if (await leaveMerchantBtn.first().isVisible()) {
        if (await safeClick(leaveMerchantBtn.first(), 'Leave merchant/market')) actionCount++;
      } else if (await skipPerceptionBtn.isVisible()) {
        if (await safeClick(skipPerceptionBtn, 'Skip perception check and enter room')) actionCount++;
      } else if (await exploreBtn.isVisible()) {
        if (await safeClick(exploreBtn, 'Roll d66 to explore next room')) actionCount++;
      }
      continue;
    }

    // 5. Combat Simulator Screen
    if (await page.locator('.combat-card').isVisible()) {
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
      const attackBtn = page.locator('button:has-text("通常攻撃")');

      if (await coverBtn.first().isVisible()) {
        if (await safeClick(coverBtn.first(), 'Perform cover action')) actionCount++;
      } else if (await cancelCoverBtn.isVisible()) {
        if (await safeClick(cancelCoverBtn, 'Decline cover action')) actionCount++;
      } else if (await defendBtn.isVisible()) {
        let defenseCount = 0;
        // Resolve all pending defense rolls in one step iteration loop to prevent running out of maxSteps
        while (await defendBtn.isVisible() && defenseCount < 10) {
          const success = await safeClick(defendBtn, 'Player defense roll', 1500);
          if (!success) break;
          defenseCount++;
          actionCount++;
          await page.waitForTimeout(50);
        }
      } else if (await lootRollBtn.isVisible()) {
        if (await safeClick(lootRollBtn, 'Roll combat victory loot')) actionCount++;
      } else if (await confirmCombatBtn.isVisible()) {
        if (await safeClick(confirmCombatBtn, 'Confirm combat result')) actionCount++;
      } else if (await reactionConfirmBtn.isVisible()) {
        if (await safeClick(reactionConfirmBtn, 'Confirm reaction check result')) actionCount++;
      } else if (await refuseBribeBtn.isVisible()) {
        if (await safeClick(refuseBribeBtn, 'Refuse bribe and fight')) actionCount++;
      } else if (await reactionRollBtn.isVisible()) {
        if (await safeClick(reactionRollBtn, 'Roll reaction check')) actionCount++;
      } else if (await closeRangedBtn.isVisible()) {
        if (await safeClick(closeRangedBtn, 'Transition to melee combat')) actionCount++;
      } else if (await switchWeaponBtn.isVisible()) {
        if (await safeClick(switchWeaponBtn, 'Perform weapon switching transition')) actionCount++;
      } else if (await attackBtn.first().isVisible()) {
        if (await safeClick(attackBtn.first(), 'Attack first enemy in close combat')) actionCount++;
      }
      continue;
    }
  }

  // Verify that the game did end up in victory or death
  expect(reachedEnd).toBe(true);
});
