import { test, expect } from '@playwright/test';
import { 
  disableAnimations, 
  setupMockRandom, 
  selectScenarioInUI, 
  rollD66AndSkipPerception, 
  clickButtonByText, 
  transitionToMelee,
  handlePendingDefense,
  openAdventureSheet,
  closeAdventureSheet
} from '../helpers/test-utils';

test.describe('基本ルール ver.5.1: 判定ロール・出目・副能力消費 (Rule 6〜10)', () => {

  test.beforeEach(async ({ page }) => {
    page.on('dialog', dialog => dialog.accept());
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await disableAnimations(page);
  });

  test('【Rule 7 & 8】攻撃ロール：出目6（クリティカル）で自動命中し、即座に2回目の攻撃機会が発生すること', async ({ page }) => {
    // 1. シナリオ選択
    await selectScenarioInUI(page, '魔将アラザスの迷宮');

    // 2. キャラクター作成（器用アーキタイプ）
    await page.fill('#char-name', 'クリティカル検証勇者');
    await page.locator('.archetype-card').nth(3).click({ force: true });
    await page.locator('button:has-text("キャラクターの命運を紡ぎ出す")').click({ force: true });
    await page.waitForSelector('.levelup-card', { state: 'visible', timeout: 5000 });

    // 冒険開始
    await page.locator('button:has-text("冒険を開始する")').click({ force: true });
    await page.waitForSelector('.explorer-card', { state: 'visible', timeout: 5000 });

    // d66 = 11 (ゴブリンの斥候部隊: Lv.2, HP 1, 3体)
    // 攻撃出目: 6 (クリティカル) -> その後の追加攻撃出目: 4 (通常命中)
    await setupMockRandom(page, 11, [6, 4]);

    // ダンジョン探索（察知スキップ）
    await rollD66AndSkipPerception(page);
    await page.waitForTimeout(500);

    // 接近戦へ移行
    await transitionToMelee(page);
    await handlePendingDefense(page);

    // 1回目の通常攻撃を実行
    await clickButtonByText(page, '通常攻撃', 800);

    // ログにクリティカル成功と即時再攻撃のメッセージが記録されていることを確認
    const logbook = page.locator('.logbook-entries');
    await expect(logbook).toContainText('クリティカル成功！ 即座にもう一度攻撃を行えます！', { timeout: 5000 });

    // 敵Aが撃破され、敵の反撃フェーズにならずに即座に通常攻撃ボタンが再び押せる状態（Round 1のまま）であることを確認
    const attackBtn = page.locator('button:has-text("通常攻撃")').first();
    await expect(attackBtn).toBeVisible();
    await expect(attackBtn).toBeEnabled();

    // 2回目の攻撃を実行（出目4 -> 命中）
    await clickButtonByText(page, '通常攻撃', 800);

    // 2体目の敵も撃破されたことを確認
    await expect(logbook).toContainText('ゴブリン斥候 B を撃破しました！', { timeout: 5000 });
  });

  test('【Rule 8】攻撃ロール：出目1（ファンブル）で目標値に関わらず自動失敗すること', async ({ page }) => {
    await selectScenarioInUI(page, '魔将アラザスの迷宮');

    // キャラクター作成（技量点を成長させて検証）
    await page.fill('#char-name', 'ファンブル検証勇者');
    await page.locator('.archetype-card').nth(3).click({ force: true });
    await page.locator('button:has-text("キャラクターの命運を紡ぎ出す")').click({ force: true });
    await page.waitForSelector('.levelup-card', { state: 'visible', timeout: 5000 });

    // 技量点を+3成長させる（技量点 = 3）
    const skillUpBtn = page.locator('.ledger-row:has-text("技量点") button:has-text("+1上昇")');
    await skillUpBtn.click({ force: true });
    await page.waitForTimeout(100);
    await skillUpBtn.click({ force: true });
    await page.waitForTimeout(100);
    await skillUpBtn.click({ force: true });
    await page.waitForTimeout(100);

    // 冒険開始
    await page.locator('button:has-text("冒険を開始する")').click({ force: true });
    await page.waitForSelector('.explorer-card', { state: 'visible', timeout: 5000 });

    // d66 = 11 (ゴブリン Lv.2) に対して、攻撃出目 1 (ファンブル)
    // 技量3 + 出目1 = 4 >= Lv.2 だが、出目1のためファンブル自動失敗になるべき
    await setupMockRandom(page, 11, [1]);

    // ダンジョン探索（察知スキップ）
    await rollD66AndSkipPerception(page);
    await page.waitForTimeout(500);

    // 接近戦へ移行
    await transitionToMelee(page);
    await handlePendingDefense(page);

    // 通常攻撃を実行
    await clickButtonByText(page, '通常攻撃', 800);

    // ログにファンブル・ミスが記録されていることを確認
    const logbook = page.locator('.logbook-entries');
    await expect(logbook).toContainText('ミス！ 攻撃が届かなかった。(ロール計: ファンブル < 2)', { timeout: 5000 });
  });

  test('【Rule 9】副能力値による代用判定：判定成功後に該当副能力値が厳密に1点消費されること', async ({ page }) => {
    await selectScenarioInUI(page, '魔将アラザスの迷宮');

    // キャラクター作成（器用アーキタイプ: 初期器用点 2）
    await page.fill('#char-name', '副能力消費検証勇者');
    await page.locator('.archetype-card').nth(3).click({ force: true });
    await page.locator('button:has-text("キャラクターの命運を紡ぎ出す")').click({ force: true });
    await page.waitForSelector('.levelup-card', { state: 'visible', timeout: 5000 });

    // 冒険開始
    await page.locator('button:has-text("冒険を開始する")').click({ force: true });
    await page.waitForSelector('.explorer-card', { state: 'visible', timeout: 5000 });

    // HUDで初期器用点が 2/2 であることを確認
    const dexHud = page.locator('.hud-vitals .vital-chip').filter({ hasText: '⚡' });
    await expect(dexHud).toContainText('2/2');

    // d66 = 32 (毒矢トラップ: 器用度判定 Target 5)
    // 出目: 5 (器用点2 + 出目5 = 7 >= 5 で成功)
    await setupMockRandom(page, 32, [5]);

    // ダンジョン探索（察知スキップ）
    await rollD66AndSkipPerception(page);
    await page.waitForTimeout(500);

    // 「副能力値【器用点】で挑戦 (判定値: 2 / 1点消費)」ボタンをクリック
    const challengeBtn = page.locator('button:has-text("副能力値【器用点】で挑戦")');
    await expect(challengeBtn).toBeVisible();
    await clickButtonByText(page, '副能力値【器用点】で挑戦', 1000);

    // 判定成功ログを確認
    const logbook = page.locator('.logbook-entries');
    await expect(logbook).toContainText('トラップ判定に成功しました！', { timeout: 5000 });
    await expect(logbook).toContainText('副能力値を1点消費しました。(残り: 1点)', { timeout: 5000 });

    // 冒険記録紙でも器用点が 1 になっていることを確認
    await openAdventureSheet(page);
    const advSheet = page.locator('.adventure-sheet');
    await expect(advSheet).toContainText('器用点1 / 2');
    await closeAdventureSheet(page);
  });

  test('【Rule 9】副能力値が0になった場合、副能力値での判定ボタンが無効化されること', async ({ page }) => {
    await selectScenarioInUI(page, '魔将アラザスの迷宮');

    // キャラクター作成（初期器用点 2）
    await page.fill('#char-name', '副能力枯渇検証勇者');
    await page.locator('.archetype-card').nth(3).click({ force: true });
    await page.locator('button:has-text("キャラクターの命運を紡ぎ出す")').click({ force: true });
    await page.waitForSelector('.levelup-card', { state: 'visible', timeout: 5000 });

    // 冒険開始
    await page.locator('button:has-text("冒険を開始する")').click({ force: true });
    await page.waitForSelector('.explorer-card', { state: 'visible', timeout: 5000 });

    // 1回目のトラップ (d66=32): 器用点消費 (2 -> 1点)
    await setupMockRandom(page, 32, [5]);
    await rollD66AndSkipPerception(page);
    await page.waitForTimeout(500);
    await clickButtonByText(page, '副能力値【器用点】で挑戦', 1000);

    // 次の部屋へ進む
    await clickButtonByText(page, '次の小部屋へ進む', 1000);

    // 2回目のトラップ (d66=32): 器用点消費 (1 -> 0点)
    await setupMockRandom(page, 32, [5]);
    await rollD66AndSkipPerception(page);
    await page.waitForTimeout(500);
    await clickButtonByText(page, '副能力値【器用点】で挑戦', 1000);

    // 冒険手帳で器用点が 0 になったことを確認
    await openAdventureSheet(page);
    const advSheet = page.locator('.adventure-sheet');
    await expect(advSheet).toContainText('器用点0 / 2');
    await closeAdventureSheet(page);

    // 次の部屋へ進む
    await clickButtonByText(page, '次の小部屋へ進む', 1000);

    // 3回目のトラップ (d66=32): 器用点が 0 のため「副能力値【器用点】で挑戦」ボタンが存在しないことを確認
    await setupMockRandom(page, 32, [5]);
    await rollD66AndSkipPerception(page);
    await page.waitForTimeout(500);

    const subStatChallengeBtn = page.locator('button:has-text("副能力値【器用点】で挑戦")');
    await expect(subStatChallengeBtn).toHaveCount(0);

    const normalChallengeBtn = page.locator('button:has-text("技量点")');
    await expect(normalChallengeBtn).toBeVisible();
  });

});
