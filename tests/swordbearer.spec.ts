import { test, expect } from '@playwright/test';

// Helper to mock random rolls
async function setupMockRandom(page: any, d66Result: number, normalRoll: number) {
  await page.evaluate(({ d66Result, normalRoll }) => {
    let callCount = 0;
    const d1 = Math.floor(d66Result / 10);
    const d2 = d66Result % 10;
    
    window.Math.random = () => {
      callCount++;
      // Call 1 is log ID
      if (callCount === 1) return 0.5;
      // Call 2 & 3 are d66 roll digits
      if (callCount === 2) return (d1 - 1) / 6;
      if (callCount === 3) return (d2 - 1) / 6;
      // Subsequent rolls return normalRoll (e.g. 0.9 for 6)
      return (normalRoll - 1) / 6 + 0.01;
    };
  }, { d66Result, normalRoll });
}

// Helper to process all pending defense rolls
async function handlePendingDefense(page: any) {
  const defendBtn = page.locator('button:has-text("主人公が防御する")');
  try {
    await defendBtn.waitFor({ state: 'visible', timeout: 1500 });
  } catch (e) {
    return;
  }
  while (await defendBtn.isVisible()) {
    await defendBtn.click({ force: true });
    await page.waitForTimeout(800);
  }
}

async function disableAnimations(page: any) {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        transition: none !important;
        animation: none !important;
        transition-duration: 0s !important;
        animation-duration: 0s !important;
      }
    `
  });
}

test.describe('太刀持ち従者の武器持ち替え省略＆リセット判定テスト', () => {
  
  test('太刀持ち従者あり：射撃後の接近戦武器への持ち替えラウンドが省略されること', async ({ page }) => {
    await page.goto('/');
    await disableAnimations(page);

    // 1. シナリオ選択
    await page.locator('.scenario-card').first().click({ force: true });
    await page.waitForTimeout(500);

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

    // Set mock random just before d66 roll
    await setupMockRandom(page, 11, 6);

    // 4. ダンジョン探索：d66を振る
    await page.locator('button:has-text("d66を振って次の部屋を探索する")').click({ force: true });
    
    // 察知せずに部屋に入るを待ってクリック
    const skipPerceptionBtn = page.locator('button:has-text("察知せずに部屋に入る")');
    await skipPerceptionBtn.waitFor({ state: 'visible', timeout: 5000 });
    await skipPerceptionBtn.click({ force: true });
    await page.waitForTimeout(1000);

    // 直接射撃攻撃を行う
    await expect(page.locator('.combat-header')).toBeVisible();
    
    // 装備武器が「弓と十分な矢」であることを確認
    const equippedWeaponText = await page.locator('.equipped-slot:has-text("右手/武器:")').textContent();
    expect(equippedWeaponText).toContain('弓と十分な矢');

    // 第0ラウンドで通常攻撃（射撃）を実行
    await page.locator('button:has-text("射撃攻撃")').click({ force: true });
    await page.waitForTimeout(1000);

    // 接近戦へ移行するをクリック
    await page.locator('button:has-text("接近戦へ移行する")').click({ force: true });
    await page.waitForTimeout(1000);

    // 太刀持ちがいるため、第1ラウンドの移行時に自動で「軽い武器 (短剣等)」へ持ち替えられており、持ち替え中（isSwitchingWeapons）の表示がないことを確認
    const combatBoxText = await page.locator('.combat-card').textContent();
    expect(combatBoxText).not.toContain('武器の持ち替え中');
    expect(combatBoxText).not.toContain('武器を持ち替える');

    // 武器が軽い武器になっていることを確認
    const weaponAfterTransition = await page.locator('.equipped-slot:has-text("右手/武器:")').textContent();
    expect(weaponAfterTransition).toContain('軽い武器 (短剣等)');

    // 接近戦通常攻撃ボタンがすぐに活性化していることを確認
    const attackBtn = page.locator('button:has-text("通常攻撃")').first();
    await expect(attackBtn).toBeVisible();
    await expect(attackBtn).toBeEnabled();
  });

  test('太刀持ち従者なし：射撃後の接近戦武器への持ち替えに1ラウンド要すること', async ({ page }) => {
    await page.goto('/');
    await disableAnimations(page);

    // 1. シナリオ選択
    await page.locator('.scenario-card').first().click({ force: true });
    await page.waitForTimeout(500);

    // 2. キャラクター作成（器用/Dexterity アーキタイプを選択）
    await page.fill('#char-name', 'テスト太刀持ちなし');
    await page.locator('.archetype-card').nth(3).click({ force: true });
    await page.locator('button:has-text("キャラクターの命運を紡ぎ出す")').click({ force: true });
    await page.waitForSelector('.levelup-card', { state: 'visible', timeout: 5000 });

    // 3. レベルアップ・雇用画面（雇用せずに冒険開始）
    await page.locator('button:has-text("冒険を開始する")').click({ force: true });
    await page.waitForSelector('.explorer-card', { state: 'visible', timeout: 5000 });

    // Set mock random just before d66 roll
    await setupMockRandom(page, 11, 6);

    // 4. ダンジョン探索：d66を振る
    await page.locator('button:has-text("d66を振って次の部屋を探索する")').click({ force: true });
    
    // 察知せずに部屋に入るを待ってクリック
    const skipPerceptionBtn = page.locator('button:has-text("察知せずに部屋に入る")');
    await skipPerceptionBtn.waitFor({ state: 'visible', timeout: 5000 });
    await skipPerceptionBtn.click({ force: true });
    await page.waitForTimeout(1000);

    // 直接射撃攻撃を行う
    await page.locator('button:has-text("射撃攻撃")').click({ force: true });
    await page.waitForTimeout(1000);

    // 接近戦へ移行するをクリック
    await page.locator('button:has-text("接近戦へ移行する")').click({ force: true });
    await page.waitForTimeout(1000);

    // 太刀持ちがいないため、第1ラウンドで「武器の持ち替え中」の表示が出ること
    const combatBoxText = await page.locator('.combat-card').textContent();
    expect(combatBoxText).toContain('武器の持ち替え中');
    
    const switchWeaponBtn = page.locator('button:has-text("武器を持ち替える")');
    await expect(switchWeaponBtn).toBeVisible();

    // 武器を持ち替えるボタンをクリックして1ラウンド消費
    await switchWeaponBtn.click({ force: true });
    
    // 持ち替えラウンド消費に伴う敵の攻撃を防ぐ
    await handlePendingDefense(page);

    // 持ち替え完了後、武器が軽い武器になり通常攻撃が押せるようになることを確認
    const weaponAfterSwitch = await page.locator('.equipped-slot:has-text("右手/武器:")').textContent();
    expect(weaponAfterSwitch).toContain('軽い武器 (短剣等)');

    const attackBtn = page.locator('button:has-text("通常攻撃")').first();
    await expect(attackBtn).toBeVisible();
  });

  test('戦闘をまたいだ射撃フラグのリセット判定：1戦目で射撃しても、2戦目で射撃していなければ持ち替えラウンドが発生しないこと', async ({ page }) => {
    await page.goto('/');
    await disableAnimations(page);

    // 1. シナリオ選択
    await page.locator('.scenario-card').first().click({ force: true });
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
    await setupMockRandom(page, 11, 6);

    // 4. 【1戦目の戦闘】 d66を振る
    await page.locator('button:has-text("d66を振って次の部屋を探索する")').click({ force: true });
    
    // 察知せずに部屋に入るを待ってクリック
    const skipPerceptionBtn = page.locator('button:has-text("察知せずに部屋に入る")');
    await skipPerceptionBtn.waitFor({ state: 'visible', timeout: 5000 });
    await skipPerceptionBtn.click({ force: true });
    await page.waitForTimeout(1000);

    // 射撃して接近戦へ
    await page.locator('button:has-text("射撃攻撃")').click({ force: true });
    await page.waitForTimeout(1000);
    await page.locator('button:has-text("接近戦へ移行する")').click({ force: true });
    await page.waitForTimeout(1000);

    // 武器を持ち替える
    await page.locator('button:has-text("武器を持ち替える")').click({ force: true });
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

    // 戦闘終了
    await page.locator('button:has-text("結果を承認")').click({ force: true });
    await page.waitForTimeout(1000);

    // Set mock random just before second d66 roll
    await setupMockRandom(page, 11, 6);

    // 5. 【2戦目の戦闘】
    await page.locator('button:has-text("d66を振って次の部屋を探索する")').click({ force: true });
    
    // 察知せずに部屋に入るを待ってクリック
    await skipPerceptionBtn.waitFor({ state: 'visible', timeout: 5000 });
    await skipPerceptionBtn.click({ force: true });
    await page.waitForTimeout(1000);

    // 2戦目の第0ラウンドでは射撃を行わずに「接近戦へ移行する」をクリック
    await page.locator('button:has-text("接近戦へ移行する")').click({ force: true });
    await page.waitForTimeout(1000);

    // 1戦目の射撃フラグがリセットされていれば、2戦目で射撃していないため、持ち替え中にならずに即攻撃可能になるはず
    const combatBoxText = await page.locator('.combat-card').textContent();
    expect(combatBoxText).not.toContain('武器の持ち替え中');
    expect(combatBoxText).not.toContain('武器を持ち替える');

    const attackBtn = page.locator('button:has-text("通常攻撃")').first();
    await expect(attackBtn).toBeVisible();
    await expect(attackBtn).toBeEnabled();
  });
});
