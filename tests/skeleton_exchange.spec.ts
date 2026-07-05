import { test, expect } from '@playwright/test';
import { disableAnimations, setupMockRandom, safeClick } from './helpers/test-utils';

test.describe('砂掃きの骸骨 (Sand Cleaning Skeleton) 取引＆アドバイス機能テスト', () => {

  test('骸骨との接触、片手武器（斬撃）の交換、そして次の部屋の十の位出目操作が正しく動作すること', async ({ page }) => {
    // 自動的にダイアログ（未習得の呪文・奇跡スロットに関する確認メッセージ等）を承認する
    page.on('dialog', async dialog => {
      console.log(`[Dialog Handler] Accepting dialog: ${dialog.message()}`);
      await dialog.accept();
    });

    await page.goto('/');
    await disableAnimations(page);

    // 1. シナリオ選択 - 刻の悪魔のピラミッド
    const scenarioCard = page.locator('.scenario-card').filter({ hasText: '刻の悪魔のピラミッド' }).first();
    await scenarioCard.waitFor({ state: 'visible', timeout: 5000 });
    await scenarioCard.click({ force: true });
    await page.waitForTimeout(500);

    // 2. キャラクター作成（運/Luck アーキタイプを選択。初期装備に片手武器(斬撃)が含まれる）
    await page.fill('#char-name', 'テスト骸骨交換');
    await page.locator('.archetype-card').nth(1).click({ force: true }); // luck = 1
    await page.locator('button:has-text("キャラクターの命運を紡ぎ出す")').click({ force: true });
    await page.waitForSelector('.levelup-card', { state: 'visible', timeout: 5000 });

    // 奇跡スロットを埋めるため、適当な奇跡を1つ習得する
    const miracleBtn = page.locator('.spell-learning-section button.btn-mini:not([disabled])').first();
    if (await miracleBtn.isVisible({ timeout: 1000 })) {
      await miracleBtn.click({ force: true });
      await page.waitForTimeout(200);
    }

    // 3. 冒険開始
    const startBtn = page.locator('button:has-text("冒険を開始する")');
    await expect(startBtn).toBeVisible({ timeout: 5000 });
    await startBtn.click({ force: true });
    await page.waitForSelector('.explorer-card', { state: 'visible', timeout: 5000 });

    // 4. d66 = 33 (砂掃きの骸骨), 反応チェックの出目を 2 (友好的) に固定
    await setupMockRandom(page, 33, 2);

    // 次の部屋を探索
    await page.locator('button:has-text("d66を振って次の部屋を探索する")').click({ force: true });
    await page.waitForTimeout(500);

    // 察知せずに部屋に入る
    const skipPerceptionBtn = page.locator('button:has-text("察知せずに部屋に入る")');
    if (await skipPerceptionBtn.count() > 0 && await skipPerceptionBtn.isVisible()) {
      await skipPerceptionBtn.click({ force: true });
      await page.waitForTimeout(500);
    }

    // 接触を試みる (反応チェック)
    const contactBtn = page.locator('button:has-text("接触を試みる")');
    await expect(contactBtn).toBeVisible({ timeout: 5000 });
    await contactBtn.click({ force: true });
    await page.waitForTimeout(1000);

    // 反応が【友好的】になっていることを確認
    const resultBox = page.locator('.reaction-result-box');
    await expect(resultBox).toContainText('【友好的】');

    // 武器交換
    const tradeBtn = page.locator('button:has-text("交換を申し出る")').first();
    await expect(tradeBtn).toBeVisible({ timeout: 5000 });
    await tradeBtn.click({ force: true });
    await page.waitForTimeout(500);

    // 古竜の肋骨剣が手に入ったことを確認
    const advSheet = page.locator('.adventure-sheet');
    await expect(advSheet).toContainText('古竜の肋骨剣');

    // 次の部屋の十の位を「1」に指定（これにより自動的にイベント解決に遷移します）
    const roomAdviceBtn = page.locator('button:has-text("1の部屋へ")');
    await expect(roomAdviceBtn).toBeVisible({ timeout: 5000 });
    await roomAdviceBtn.click({ force: true });
    await page.waitForTimeout(500);

    // 次の小部屋へ進む
    const proceedBtn = page.locator('button:has-text("次の小部屋へ進む")');
    await expect(proceedBtn).toBeVisible({ timeout: 5000 });
    await proceedBtn.click({ force: true });
    await page.waitForTimeout(1000);

    // 5. 次の部屋探索の際に、十の位が1となり、一の位が1であれば d66=11 (ゴールデンポップコーン) が出現することを確認
    // d1は案内効果で固定されているので、d2の出目のみスタブする
    await page.evaluate(() => {
      let callCount = 0;
      window.Math.random = () => {
        callCount++;
        // 3番目のコール（d2のランダムダイス）の時に 0.0 を返し、出目を 1 に固定する
        if (callCount === 3) return 0.0;
        return 0.5;
      };
    });

    // 次の部屋を探索
    await page.locator('button:has-text("d66を振って次の部屋を探索する")').click({ force: true });
    await page.waitForTimeout(1000);

    // ゴールデンポップコーン部屋が出現していることを確認
    const eventPanel = page.locator('.event-panel');
    await expect(eventPanel).toContainText('ゴールデンポップコーン');
  });

});
