import { test, expect } from '@playwright/test';
import { disableAnimations, setupMockRandom, handlePendingDefense, selectScenarioInUI, openAdventureSheet, closeAdventureSheet, rollD66AndSkipPerception, transitionToMelee, proceedToNextRoom, clickButtonByText } from './helpers/test-utils';

test.describe('太刀持ち従者の武器持ち替え省略＆リセット判定テスト', () => {
  
  test.beforeEach(async ({ page }) => {
    page.on('dialog', dialog => dialog.accept());
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await disableAnimations(page);
  });

  test('太刀持ち従者あり：射撃後の接近戦武器への持ち替えラウンドが省略されること', async ({ page }) => {

    // 1. シナリオ選択
    await selectScenarioInUI(page, '魔将アラザスの迷宮');

    // 2. キャラクター作成（器用/Dexterity アーキタイプを選択）
    await page.fill('#char-name', 'テスト太刀持ちあり');
    await page.locator('.archetype-card').nth(3).click({ force: true });
    await page.locator('button:has-text("キャラクターの命運を紡ぎ出す")').click({ force: true });
    await page.waitForSelector('.levelup-card', { state: 'visible', timeout: 5000 });

    // 3. レベルアップ・雇用画面
    // 太刀持ち従者を雇用
    await page.locator('.recruiter-column > div > div').filter({ hasText: '太刀持ち' }).locator('button:has-text("雇用")').click({ timeout: 10000, force: true });
    await page.waitForTimeout(300);
    
    // 冒険開始
    await page.locator('button:has-text("冒険を開始する")').click({ force: true });
    await page.waitForSelector('.explorer-card', { state: 'visible', timeout: 5000 });

    // Set mock random just before d66 roll (4: hit without critical)
    await setupMockRandom(page, 11, [4, 4]);

    // 4. ダンジョン探索：d66を振る（察知スキップ）
    await rollD66AndSkipPerception(page);
    await page.waitForTimeout(500);

    // 直接射撃攻撃を行う
    await expect(page.locator('.combat-header')).toBeVisible();
    
    // 装備武器が「弓と十分な矢」であることを確認
    await openAdventureSheet(page);
    const equippedWeaponText = await page.locator('.equipped-slot:has-text("右手/武器:")').textContent();
    expect(equippedWeaponText).toContain('弓と十分な矢');
    await closeAdventureSheet(page);

    // 第0ラウンドで通常攻撃（射撃）を実行
    await clickButtonByText(page, '射撃攻撃', 1000);
    await page.waitForTimeout(1000);

    // 敵の反撃を防ぐ
    await handlePendingDefense(page);

    // 太刀持ちがいるため、第1ラウンドの移行時に自動で「軽い武器 (短剣等)」へ持ち替えられており、持ち替え中（isSwitchingWeapons）の表示がないことを確認
    const combatBoxText = await page.locator('.combat-card').textContent();
    expect(combatBoxText).not.toContain('武器の持ち替え中');
    expect(combatBoxText).not.toContain('武器を持ち替える');

    // 武器が軽い武器になっていることを確認
    await openAdventureSheet(page);
    const weaponAfterTransition = await page.locator('.equipped-slot:has-text("右手/武器:")').textContent();
    expect(weaponAfterTransition).toContain('軽い武器 (短剣等)');
    await closeAdventureSheet(page);

    // 接近戦通常攻撃ボタンがすぐに活性化していることを確認
    const attackBtn = page.locator('button:has-text("通常攻撃")').first();
    await expect(attackBtn).toBeVisible();
    await expect(attackBtn).toBeEnabled();
  });

  test('太刀持ち従者なし：射撃後の接近戦武器への持ち替えに1ラウンド要すること', async ({ page }) => {
    await page.goto('/');
    await disableAnimations(page);

    // 1. シナリオ選択
    await selectScenarioInUI(page, '魔将アラザスの迷宮');

    // 2. キャラクター作成（器用/Dexterity アーキタイプを選択）
    await page.fill('#char-name', 'テスト太刀持ちなし');
    await page.locator('.archetype-card').nth(3).click({ force: true });
    await page.locator('button:has-text("キャラクターの命運を紡ぎ出す")').click({ force: true });
    await page.waitForSelector('.levelup-card', { state: 'visible', timeout: 5000 });

    // 3. レベルアップ・雇用画面（雇用せずに冒険開始）
    await page.locator('button:has-text("冒険を開始する")').click({ force: true });
    await page.waitForSelector('.explorer-card', { state: 'visible', timeout: 5000 });

    // Set mock random just before d66 roll (4: hit without critical)
    await setupMockRandom(page, 11, [4, 4]);

    // 4. ダンジョン探索：d66を振る（察知スキップ）
    await rollD66AndSkipPerception(page);
    await page.waitForTimeout(500);

    // 直接射撃攻撃を行う
    await clickButtonByText(page, '射撃攻撃', 1000);

    // 敵の反撃を防ぐ
    await handlePendingDefense(page);

    // 太刀持ちがいないため、第1ラウンドで「武器の持ち替え中」の表示が出ること
    const combatBoxText = await page.locator('.combat-card').textContent();
    expect(combatBoxText).toContain('武器の持ち替え中');
    
    const switchWeaponBtn = page.locator('button:has-text("武器を持ち替える")');
    await expect(switchWeaponBtn).toBeVisible();

    // 武器を持ち替えるボタンをクリックして1ラウンド消費
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('武器を持ち替える'));
      if (btn) btn.click();
    });
    await page.waitForTimeout(500);
    
    // 持ち替えラウンド消費に伴う敵の攻撃を防ぐ
    await handlePendingDefense(page);

    // 持ち替え完了後、武器が軽い武器になり通常攻撃が押せるようになることを確認
    await openAdventureSheet(page);
    const weaponAfterSwitch = await page.locator('.equipped-slot:has-text("右手/武器:")').textContent();
    expect(weaponAfterSwitch).toContain('軽い武器 (短剣等)');
    await closeAdventureSheet(page);

    const attackBtn = page.locator('button:has-text("通常攻撃")').first();
    await expect(attackBtn).toBeVisible();
  });

  test('戦闘をまたいだ射撃フラグのリセット判定：1戦目で射撃しても、2戦目で射撃していなければ持ち替えラウンドが発生しないこと', async ({ page }) => {
    await page.goto('/');
    await disableAnimations(page);

    // 1. シナリオ選択
    await selectScenarioInUI(page, '魔将アラザスの迷宮');
    await page.waitForTimeout(500);

    // 2. キャラクター作成（器用/Dexterity アーキタイプを選択）
    await page.fill('#char-name', 'テストリセット確認');
    await page.locator('.archetype-card').nth(3).click({ force: true });
    await page.locator('button:has-text("キャラクターの命運を紡ぎ出す")').click({ force: true });
    await page.waitForSelector('.levelup-card', { state: 'visible', timeout: 5000 });

    // 3. レベルアップ・雇用画面（雇用せずに冒険開始）
    await page.locator('button:has-text("冒険を開始する")').click({ force: true });
    await page.waitForSelector('.explorer-card', { state: 'visible', timeout: 5000 });

    // Set mock random just before first d66 roll
    await setupMockRandom(page, 11, [4, 6]);

    // 4. 【1戦目の戦闘】 d66を振る（察知スキップ）
    await rollD66AndSkipPerception(page);
    await page.waitForTimeout(500);

    // 射撃して第1ラウンドへ
    await clickButtonByText(page, '射撃攻撃', 1000);
    await handlePendingDefense(page);

    // 武器を持ち替える
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('武器を持ち替える'));
      if (btn) btn.click();
    });
    await page.waitForTimeout(500);
    await handlePendingDefense(page);

    // 敵を倒す（出目6固定なので一撃）
    const attackBtnFirst = page.locator('button:has-text("通常攻撃")').first();
    while (await attackBtnFirst.isVisible()) {
      await attackBtnFirst.click({ force: true });
      await handlePendingDefense(page);
      await page.waitForTimeout(1000);
    }

    // 宝箱を開ける（ダイスを振る）
    const lootRollBtn = page.locator('button:has-text("宝箱を開ける")');
    if (await lootRollBtn.isVisible()) {
      await lootRollBtn.click({ force: true });
      await page.waitForTimeout(1500);
    }

    // 戦闘終了（「結果を承認して次の部屋へ進む」で探索画面へ戻る）
    await clickButtonByText(page, '結果を承認', 1000);

    // Set mock random just before second d66 roll
    await setupMockRandom(page, 11, [4, 6]);

    // 5. 【2戦目の戦闘】（察知スキップ）
    await rollD66AndSkipPerception(page);
    await page.waitForTimeout(500);

    // 2戦目の第0ラウンドでは射撃を行わずに「接近戦へ移行する」をクリック
    await transitionToMelee(page);
    await handlePendingDefense(page);

    // 1戦目の射撃フラグがリセットされていれば、2戦目で射撃していないため、持ち替え中にならずに即攻撃可能になるはず
    const combatBoxText = await page.locator('.combat-card').textContent();
    expect(combatBoxText).not.toContain('武器の持ち替え中');
    expect(combatBoxText).not.toContain('武器を持ち替える');

    const attackBtn = page.locator('button:has-text("通常攻撃")').first();
    await expect(attackBtn).toBeVisible();
    await expect(attackBtn).toBeEnabled();
  });
});
