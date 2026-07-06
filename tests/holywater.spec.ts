import { test, expect } from '@playwright/test';
import { disableAnimations, setupMockRandom } from './helpers/test-utils';

test.describe('聖水（Holy Water）の戦闘行使テスト', () => {

  test('聖水の購入と戦闘での使用：弱い敵2体を一撃で即座に浄化すること', async ({ page }) => {
    await page.goto('/');
    await disableAnimations(page);

    // 1. シナリオ選択
    await page.locator('.scenario-card').filter({ hasText: '魔将アラザスの迷宮' }).first().click({ force: true });
    await page.waitForTimeout(500);

    // 2. キャラクター作成（器用/Dexterity アーキタイプを選択）
    await page.fill('#char-name', 'テスト聖水使い');
    await page.locator('.archetype-card').nth(3).click({ force: true });
    await page.locator('button:has-text("キャラクターの命運を紡ぎ出す")').click({ force: true });
    await page.waitForSelector('.levelup-card', { state: 'visible', timeout: 5000 });

    // 3. 街の市場で「聖水」を購入
    const holyWaterRow = page.locator('.shop-column > div > div').filter({ hasText: '聖水 (10g)' });
    await holyWaterRow.locator('button:has-text("購入")').click({ timeout: 5000, force: true });
    await page.waitForTimeout(300);

    // 背負い袋に聖水があることを確認
    const advSheetText = await page.locator('.adventure-sheet').textContent();
    expect(advSheetText).toContain('聖水');

    // 4. 冒険開始
    await page.locator('button:has-text("冒険を開始する")').click({ force: true });
    await page.waitForSelector('.explorer-card', { state: 'visible', timeout: 5000 });

    // d66 = 11 (ゴブリン斥候部隊: 雑魚3体との遭遇)
    await setupMockRandom(page, 11, [4, 4]);

    // ダンジョン探索：d66を振る
    await page.locator('button:has-text("d66を振って次の部屋を探索する")').click({ force: true });
    
    // 察知せずに部屋に入る
    const skipPerceptionBtn = page.locator('button:has-text("察知せずに部屋に入る")');
    await skipPerceptionBtn.waitFor({ state: 'visible', timeout: 5000 });
    await skipPerceptionBtn.click({ force: true });
    await page.waitForTimeout(1000);

    // 5. 戦闘フェーズ（第0ラウンド）
    // 第0ラウンドでは反応チェック前は聖水は使えないため、接近戦へ移行する
    const closeRangedBtn = page.locator('button:has-text("接近戦へ移行する")');
    await expect(closeRangedBtn).toBeVisible({ timeout: 5000 });
    await closeRangedBtn.click({ force: true });
    await page.waitForTimeout(300);

    // 第1ラウンド（接近戦）：聖水ボタンが表示されるのを待つ
    const holyWaterBtn = page.locator('button:has-text("聖水を使用")').first();
    await expect(holyWaterBtn).toBeVisible({ timeout: 5000 });

    // 聖水を使用する（弱い敵ゴブリン斥候 A を対象）
    await holyWaterBtn.click({ force: true });

    // ログを確認：弱い敵が2体浄化され、背負い袋から聖水が消えたことを確認
    const logbook = page.locator('.logbook-entries');
    await expect(logbook).toContainText('聖水を ゴブリン斥候 A に投げつけた！', { timeout: 5000 });
    await expect(logbook).toContainText('ゴブリン斥候 A は即座に浄化された！', { timeout: 5000 });
    await expect(logbook).toContainText('さらに ゴブリン斥候 B も聖水の霧に包まれ、浄化された！', { timeout: 5000 });

    // 背負い袋から聖水が消えていることを確認
    const postAdvSheetText = await page.locator('.adventure-sheet').textContent();
    expect(postAdvSheetText).not.toContain('🧪 聖水');
  });

});
