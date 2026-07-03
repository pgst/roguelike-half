import { test, expect } from '@playwright/test';
import { disableAnimations, setupMockRandom, handlePendingDefense } from './helpers/test-utils';

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
    await setupMockRandom(page, 11, [1, 6]);

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
    const logbook = page.locator('.logbook-entries');
    await expect(logbook).toContainText('氷槍', { timeout: 5000 });
    await expect(logbook).toContainText('2点ダメージ', { timeout: 5000 });
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
    await setupMockRandom(page, 11, [1, 6]);

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
    const logbook = page.locator('.logbook-entries');
    await expect(logbook).toContainText('気絶', { timeout: 5000 });
    await expect(logbook).toContainText('深い眠りに落ちた', { timeout: 5000 });
  });

});
