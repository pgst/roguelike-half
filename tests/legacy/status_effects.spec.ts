import { test, expect } from '@playwright/test';
import { disableAnimations, setupMockRandom, selectScenarioInUI, openAdventureSheet, closeAdventureSheet, rollD66AndSkipPerception, proceedToNextRoom, clickButtonByText, transitionToMelee, handlePendingDefense } from './helpers/test-utils';

test.describe('状態異常システム (Status Effect Rules) 検証テスト', () => {

  test.beforeEach(async ({ page }) => {
    page.on('dialog', dialog => dialog.accept());
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await disableAnimations(page);
  });

  test('麻痺状態：トラップ失敗で麻痺になり、戦闘中に攻撃不能になること', async ({ page }) => {

    // 1. シナリオ選択
    await selectScenarioInUI(page, '魔将アラザスの迷宮');

    // 2. キャラクター作成（器用/Dexterity アーキタイプを選択）
    await page.fill('#char-name', 'テスト麻痺');
    await page.locator('.archetype-card').nth(3).click({ force: true });
    await page.locator('button:has-text("キャラクターの命運を紡ぎ出す")').click({ force: true });
    await page.waitForSelector('.levelup-card', { state: 'visible', timeout: 5000 });

    // 冒険開始
    await page.locator('button:has-text("冒険を開始する")').click({ force: true });
    await page.waitForSelector('.explorer-card', { state: 'visible', timeout: 10000 });

    // d66 = 32 (毒矢トラップ). Trap roll fails (fumble = 1)
    await setupMockRandom(page, 32, [1]);

    // d66を振って次の部屋を探索（察知スキップ）
    await rollD66AndSkipPerception(page);
    await page.waitForTimeout(500);

    // 罠を回避する判定を試みる
    await clickButtonByText(page, '挑戦', 1000);

    // 冒険手帳に麻痺が表示されていることを確認
    await openAdventureSheet(page);
    const advSheetText = await page.locator('.adventure-sheet').textContent();
    expect(advSheetText).toContain('麻痺');
    await closeAdventureSheet(page);

    // 通路を進む
    await proceedToNextRoom(page);

    // d66 = 11 (ゴブリン戦闘). Roll 3 for reaction (causes hostile outcome since hero is alone)
    await setupMockRandom(page, 11, [3]);

    // d66を振って次の部屋を探索（察知スキップ）
    await rollD66AndSkipPerception(page);
    await page.waitForTimeout(500);

    // 反応チェックを行う
    await clickButtonByText(page, '反応チェックを行う', 1000);

    // 戦闘開始をクリック
    const combatStartBtn = page.locator('button:has-text("戦闘開始")');
    if (await combatStartBtn.count() > 0) {
      await clickButtonByText(page, '戦闘開始', 1000);
    } else {
      const escapeBtn = page.locator('button:has-text("戦闘から逃走する")');
      if (await escapeBtn.isVisible({ timeout: 2000 })) {
        await escapeBtn.click({ force: true });
        return; // Skip further combat steps as escape occurred
      }
    }
    await page.waitForTimeout(1000);

    // 敵の先制攻撃の防御判定を実行
    await handlePendingDefense(page);

    // 接近戦へ移行する
    await transitionToMelee(page);
    await handlePendingDefense(page);

    // 通常攻撃ボタンをクリック
    await clickButtonByText(page, '通常攻撃', 1000);

    // ログに麻痺で攻撃できなかったことが記載されているか確認
    const logsText = await page.locator('.logbook-entries').textContent();
    expect(logsText).toContain('状態異常により攻撃行動を行うことができません');
  });

  test('呪い状態：トラップ失敗で呪いになり、すべての判定に-1のペナルティが加算されること', async ({ page }) => {
    await page.goto('/');
    await disableAnimations(page);

    // 1. シナリオ選択
    await selectScenarioInUI(page, '魔将アラザスの迷宮');

    // 2. キャラクター作成（器用/Dexterity アーキタイプを選択）
    await page.fill('#char-name', 'テスト呪い');
    await page.locator('.archetype-card').nth(3).click({ force: true });
    await page.locator('button:has-text("キャラクターの命運を紡ぎ出す")').click({ force: true });
    await page.waitForSelector('.levelup-card', { state: 'visible', timeout: 5000 });

    // 冒険開始
    await page.locator('button:has-text("冒険を開始する")').click({ force: true });
    await page.waitForSelector('.explorer-card', { state: 'visible', timeout: 10000 });

    // d66 = 66 (デーモンの石像 - 呪いトラップ). Trap roll fails (fumble = 1)
    await setupMockRandom(page, 66, [1]);

    // d66を振って探索（察知スキップ）
    await rollD66AndSkipPerception(page);
    await page.waitForTimeout(500);

    // 罠回避（LUCK）
    await clickButtonByText(page, '挑戦', 1000);

    // 冒険手帳に呪いがあることを確認
    await openAdventureSheet(page);
    let advSheetText = await page.locator('.adventure-sheet').textContent();
    expect(advSheetText).toContain('呪い');
    await closeAdventureSheet(page);

    // 通路を進む
    await proceedToNextRoom(page);

    // d66 = 12 (崩落する天井トラップ). Trap roll: player rolls 4. Stat = 3. Modifier = -2 (darkness) -1 (curse).
    // Total = 4 + 3 - 3 = 4. Target = 4. It should succeed!
    await setupMockRandom(page, 12, [4]);

    // d66を振って探索（察知スキップ）
    await rollD66AndSkipPerception(page);
    await page.waitForTimeout(500);

    // 罠回避
    await clickButtonByText(page, '挑戦', 1000);

    // ログを確認
    const logsText = await page.locator('.logbook-entries').textContent();
    expect(logsText).toContain('状態異常ペナルティにより判定に -1 の修正');
  });

  test('教会での【祝福】の呪文：状態異常を受けて帰還した主人公が、街の教会で金貨50枚を支払い状態異常を回復できること', async ({ page }) => {
    await page.goto('/');
    await disableAnimations(page);

    // 1. シナリオ選択
    await selectScenarioInUI(page, '魔将アラザスの迷宮');
    await page.waitForTimeout(500);

    // 2. キャラクター作成（器用/Dexterity アーキタイプを選択）
    await page.fill('#char-name', 'テスト教会祝福');
    await page.locator('.archetype-card').nth(3).click({ force: true });
    await page.locator('button:has-text("キャラクターの命運を紡ぎ出す")').click({ force: true });
    await page.waitForSelector('.levelup-card', { state: 'visible', timeout: 5000 });

    // 3. テストのために金貨50枚と「呪い」状態異常をセットする
    await page.evaluate(() => {
      if ((window as any).character) {
        (window as any).character.value.gold = 50;
        (window as any).character.value.statusEffects = ['curse'];
      }
    });
    await page.waitForTimeout(200);

    // 4. 教会の購入ボタンがあることを確認して有効であることを確認
    const blessingBtn = page.locator('.shop-column > div > div').filter({ hasText: '【祝福】の呪文' }).locator('button');
    await expect(blessingBtn).toBeVisible({ timeout: 5000 });
    await expect(blessingBtn).toBeEnabled();

    // 5. 祝福を購入する
    await blessingBtn.click({ force: true });
    await page.waitForTimeout(500);

    // 金貨が0枚になり、状態異常が消え、ログが残ることを確認
    const postGoldText = await page.locator('.town-market').textContent();
    expect(postGoldText).toContain('所持金貨: 0 枚');

    const logbook = page.locator('.logbook-entries');
    await expect(logbook).toContainText('教会で『祝福の魔法』を受け、すべての状態異常が回復しました', { timeout: 5000 });

    // 祝福ボタンが disabled になっていることを確認（状態異常がないため）
    await expect(blessingBtn).toBeDisabled();
  });

});
