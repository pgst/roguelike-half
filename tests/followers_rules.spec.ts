import { test, expect } from '@playwright/test';

// Helper to mock sequential random rolls
async function setupMockSequence(page: any, d66Result: number, rolls: number[]) {
  await page.evaluate(({ d66Result, rolls }) => {
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
      
      // Subsequent rolls use the rolls array
      const rollIndex = callCount - 4;
      if (rollIndex >= 0 && rollIndex < rolls.length) {
        return (rolls[rollIndex] - 1) / 6 + 0.01;
      }
      return 0.5; // default middle roll
    };
  }, { d66Result, rolls });
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

test.describe('従者魔術師（Mage）の呪文カスタマイズ＆戦闘行使テスト', () => {

  test('魔術師従者：氷槍を習得して雇用し、戦闘で氷槍（2点ダメージ）を唱えること', async ({ page }) => {
    await page.goto('/');
    await disableAnimations(page);

    // 1. シナリオ選択
    await page.locator('.scenario-card').first().click({ force: true });
    await page.waitForTimeout(500);

    // 2. キャラクター作成（器用/Dexterity アーキタイプを選択）
    await page.fill('#char-name', 'テスト魔術師氷槍');
    await page.locator('.archetype-card').nth(3).click({ force: true });
    await page.locator('button:has-text("キャラクターの命運を紡ぎ出す")').click({ force: true });
    await page.waitForSelector('.levelup-card', { state: 'visible', timeout: 5000 });

    // 3. レベルアップ・雇用画面
    // 魔術師の呪文を「氷槍」に変更
    const mageRecruiter = page.locator('.recruiter-column > div > div').filter({ hasText: '魔術師' });
    await mageRecruiter.locator('select').first().selectOption('氷槍', { timeout: 10000 });
    await page.waitForTimeout(200);

    // 武器属性を「斬撃」にする
    await mageRecruiter.locator('input[value="slash"]').check({ timeout: 10000, force: true });
    await page.waitForTimeout(200);

    // 魔術師を雇用
    await mageRecruiter.locator('button:has-text("雇用")').click({ timeout: 10000, force: true });
    await page.waitForTimeout(300);

    // アベンジャーシートの表示を確認
    const advSheetText = await page.locator('.adventure-sheet').textContent();
    expect(advSheetText).toContain('属性: 斬撃');
    expect(advSheetText).toContain('習得: 氷槍');

    // 冒険開始
    await page.locator('button:has-text("冒険を開始する")').click({ force: true });
    await page.waitForSelector('.explorer-card', { state: 'visible', timeout: 5000 });

    // d66 = 11 (Goblin Fight). Hero rolls 1 (fumble), Mage rolls 6 (critical)
    await setupMockSequence(page, 11, [1, 6]);

    // ダンジョン探索：d66を振る
    await page.locator('button:has-text("d66を振って次の部屋を探索する")').click({ force: true });
    
    // 察知せずに部屋に入る
    const skipPerceptionBtn = page.locator('button:has-text("察知せずに部屋に入る")');
    await skipPerceptionBtn.waitFor({ state: 'visible', timeout: 5000 });
    await skipPerceptionBtn.click({ force: true });
    await page.waitForTimeout(1000);

    // 接近戦へ移行する
    await page.locator('button:has-text("接近戦へ移行する")').click({ force: true });
    await page.waitForTimeout(1000);

    // 通常攻撃を行う（これで従者のターンがトリガーされる）
    const attackBtn = page.locator('button:has-text("通常攻撃")').first();
    await attackBtn.click({ force: true });
    await page.waitForTimeout(1500);

    // ログに氷槍のキャストとダメージが記録されていることを確認
    const logsText = await page.locator('.logbook-entries').textContent();
    expect(logsText).toContain('氷槍');
    expect(logsText).toContain('2点ダメージ');
  });

  test('魔術師従者：気絶を習得して雇用し、弱い敵に対して気絶を唱えること', async ({ page }) => {
    await page.goto('/');
    await disableAnimations(page);

    // 1. シナリオ選択
    await page.locator('.scenario-card').first().click({ force: true });
    await page.waitForTimeout(500);

    // 2. キャラクター作成（器用/Dexterity アーキタイプを選択）
    await page.fill('#char-name', 'テスト魔術師気絶');
    await page.locator('.archetype-card').nth(3).click({ force: true });
    await page.locator('button:has-text("キャラクターの命運を紡ぎ出す")').click({ force: true });
    await page.waitForSelector('.levelup-card', { state: 'visible', timeout: 5000 });

    // 3. レベルアップ・雇用画面
    // 魔術師の呪文を「気絶」に変更
    const mageRecruiter = page.locator('.recruiter-column > div > div').filter({ hasText: '魔術師' });
    await mageRecruiter.locator('select').first().selectOption('気絶');
    await page.waitForTimeout(200);

    // 魔術師を雇用
    await mageRecruiter.locator('button:has-text("雇用")').click({ timeout: 10000, force: true });
    await page.waitForTimeout(300);

    // アベンジャーシートの表示を確認
    const advSheetText = await page.locator('.adventure-sheet').textContent();
    expect(advSheetText).toContain('属性: 打撃');
    expect(advSheetText).toContain('習得: 気絶');

    // 冒険開始
    await page.locator('button:has-text("冒険を開始する")').click({ force: true });
    await page.waitForSelector('.explorer-card', { state: 'visible', timeout: 5000 });

    // d66 = 11 (Goblin Fight). Hero rolls 1 (fumble), Mage rolls 6 (critical)
    await setupMockSequence(page, 11, [1, 6]);

    // ダンジョン探索：d66を振る
    await page.locator('button:has-text("d66を振って次の部屋を探索する")').click({ force: true });
    
    // 察知せずに部屋に入る
    const skipPerceptionBtn = page.locator('button:has-text("察知せずに部屋に入る")');
    await skipPerceptionBtn.waitFor({ state: 'visible', timeout: 5000 });
    await skipPerceptionBtn.click({ force: true });
    await page.waitForTimeout(1000);

    // 接近戦へ移行する
    await page.locator('button:has-text("接近戦へ移行する")').click({ force: true });
    await page.waitForTimeout(1000);

    // 通常攻撃を行う（これで従者の気絶呪文が発動）
    const attackBtn = page.locator('button:has-text("通常攻撃")').first();
    await attackBtn.click({ force: true });
    await page.waitForTimeout(1500);

    // ログに気絶成功と眠りに落ちたログが記録されていることを確認
    const logsText = await page.locator('.logbook-entries').textContent();
    expect(logsText).toContain('気絶');
    expect(logsText).toContain('深い眠りに落ちた');
  });

});
