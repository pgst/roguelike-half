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

test.describe('基本ルール ver.5.1: 遭遇・戦闘・逃走・察知・ダンジョン進行 (Rule 25, 35, 36, 38, 42)', () => {

  test.beforeEach(async ({ page }) => {
    page.on('dialog', dialog => dialog.accept());
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => localStorage.clear());
    await disableAnimations(page);
  });

  test('【Rule 25】器用【察知】：危険な部屋の察知による器用点1点消費とd66の振り直し', async ({ page }) => {
    // 1. シナリオ選択
    await selectScenarioInUI(page, '魔将アラザスの迷宮');

    // 2. 器用アーキタイプで作成（器用点 2/2）
    await page.fill('#char-name', '察知の盗賊');
    await page.locator('.archetype-card').nth(3).click({ force: true });
    await page.locator('button:has-text("キャラクターの命運を紡ぎ出す")').click({ force: true });
    await page.waitForSelector('.levelup-card', { state: 'visible', timeout: 5000 });

    // 冒険開始
    await page.locator('button:has-text("冒険を開始する")').click({ force: true });
    await page.waitForSelector('.explorer-card', { state: 'visible', timeout: 5000 });

    // 初期出目: d66=32 (矢の罠) -> 察知ロール出目: 4 (器用点2 + 出目4 = 6 >= 目標値4 で察知成功)
    await setupMockRandom(page, 32, [4]);

    // 通路を進む（d66をロール）
    const advanceBtn = page.locator('button:has-text("d66を振って次の部屋を探索する")');
    await expect(advanceBtn).toBeVisible({ timeout: 5000 });
    await advanceBtn.click();
    await page.waitForTimeout(500);

    // 「危険を察知しました！」パネルが出現することを確認
    const perceptionTitle = page.locator('h3:has-text("危険を察知しました！")');
    await expect(perceptionTitle).toBeVisible({ timeout: 5000 });

    // 「主人公が【察知】を行う」をクリック
    const heroPerceptionBtn = page.locator('button:has-text("主人公が【察知】を行う")');
    await heroPerceptionBtn.click();
    await page.waitForTimeout(500);

    // ログの検証：
    // 1. 察知に成功し、器用点を1点消費したこと（残り1点）
    // 2. 部屋を回避して振り直したこと
    const logbook = page.locator('.logbook-entries');
    await expect(logbook).toContainText('察知');
    await expect(logbook).toContainText('器用点を1点消費しました。(残り: 1点)');

    // 冒険記録紙を開いて器用点が 1 / 2 に減少していることを確認
    await openAdventureSheet(page);
    const sheet = page.locator('.adventure-sheet');
    await expect(sheet).toContainText('🏹器用点1 / 2');
    await closeAdventureSheet(page);
  });

  test('【Rule 35】遭遇反応チェック：出目に応じた分岐（中立：戦闘回避）の厳密検証', async ({ page }) => {
    // 1. シナリオ選択
    await selectScenarioInUI(page, '魔将アラザスの迷宮');

    // 2. キャラクター作成
    await page.fill('#char-name', '平和主義者');
    await page.locator('.archetype-card').nth(1).click({ force: true });
    await page.locator('button:has-text("キャラクターの命運を紡ぎ出す")').click({ force: true });
    await page.waitForSelector('.levelup-card', { state: 'visible', timeout: 5000 });

    // 冒険開始
    await page.locator('button:has-text("冒険を開始する")').click({ force: true });
    await page.waitForSelector('.explorer-card', { state: 'visible', timeout: 5000 });

    // d66 = 11 (ゴブリン斥候部隊: 3体)
    // 反応チェック出目: 5 (中立: 敵は攻撃してこず立ち去る)
    await setupMockRandom(page, 11, [5]);
    await rollD66AndSkipPerception(page);
    await page.waitForTimeout(500);

    // 遭遇画面で「クリーチャーの反応を確認する」をクリック
    const reactionBtn = page.locator('button:has-text("反応表を振る")');
    if (!await reactionBtn.isVisible({ timeout: 2000 })) {
      const altReactionBtn = page.locator('button:has-text("反応")');
      await altReactionBtn.click();
    } else {
      await reactionBtn.click();
    }
    await page.waitForTimeout(500);

    // ログの検証：出目5により中立となり平和的に通過
    const logbook = page.locator('.logbook-entries');
    await expect(logbook).toContainText('中立：敵は攻撃してきません。エリアを自由に横切って立ち去ることができます。');

    // 戦闘にならず、進むボタンが表示されていること
    const nextRoomBtn = page.locator('button:has-text("結果を承認して進む")');
    await expect(nextRoomBtn).toBeVisible({ timeout: 5000 });
  });

  test('【Rule 38】敵の【逃走】：敵HPが初期値の半分以下になった時点での自動逃走と戦闘勝利', async ({ page }) => {
    // 1. シナリオ選択
    await selectScenarioInUI(page, '魔将アラザスの迷宮');

    // 2. 筋力アーキタイプ作成
    await page.fill('#char-name', '圧倒的狂戦士');
    await page.locator('.archetype-card').nth(2).click({ force: true });
    await page.locator('button:has-text("キャラクターの命運を紡ぎ出す")').click({ force: true });
    await page.waitForSelector('.levelup-card', { state: 'visible', timeout: 5000 });

    // 冒険開始
    await page.locator('button:has-text("冒険を開始する")').click({ force: true });
    await page.waitForSelector('.explorer-card', { state: 'visible', timeout: 5000 });

    // d66 = 11 (ゴブリン斥候部隊: Lv.2, HP 1, 3体 = 初期合計HP 3)
    // 第1R攻撃出目: 4 (敵A撃破、残り2体)
    // 敵反撃出目: 5 (主人公防御成功)
    // 第2R攻撃出目: 4 (敵B撃破、残り1体 -> 初期HP3の半分以下(1 <= 1.5)になり敵Cが逃走！)
    await setupMockRandom(page, 11, [4, 5, 4]);
    await rollD66AndSkipPerception(page);
    await page.waitForTimeout(500);

    // 接近戦へ移行
    await transitionToMelee(page);

    // 1回目の通常攻撃（敵A撃破）
    await clickButtonByText(page, '通常攻撃', 800);

    // 敵の反撃を防御
    await handlePendingDefense(page);

    // 2回目の通常攻撃（敵B撃破 -> 残り1体となり敵が逃走！）
    await clickButtonByText(page, '通常攻撃', 800);

    // ログの検証：敵の逃走が記録されていること
    const logbook = page.locator('.logbook-entries');
    await expect(logbook).toContainText('敵の生命力/人数が初期の半分以下になったため、敵は恐怖して【逃走】しました！', { timeout: 5000 });

    // 戦闘終了画面となり、宝箱を開けるボタン等が出現すること
    const victoryClaimBtn = page.locator('button:has-text("宝箱を開ける")');
    const claimResultBtn = page.locator('button:has-text("結果を承認")');
    await expect(victoryClaimBtn.or(claimResultBtn)).toBeVisible({ timeout: 5000 });
  });

  test('【Rule 42】プレイヤーの【逃走】：戦闘からの離脱判定と逃走成功の検証', async ({ page }) => {
    // 1. シナリオ選択
    await selectScenarioInUI(page, '魔将アラザスの迷宮');

    // 2. 幸運アーキタイプ作成
    await page.fill('#char-name', '疾風のエスケーパー');
    await page.locator('.archetype-card').nth(1).click({ force: true });
    await page.locator('button:has-text("キャラクターの命運を紡ぎ出す")').click({ force: true });
    await page.waitForSelector('.levelup-card', { state: 'visible', timeout: 5000 });

    // 冒険開始
    await page.locator('button:has-text("冒険を開始する")').click({ force: true });
    await page.waitForSelector('.explorer-card', { state: 'visible', timeout: 5000 });

    // d66 = 11 (ゴブリン斥候部隊: Lv.2)
    // 逃走判定出目: 6 (クリティカル自動成功)
    await setupMockRandom(page, 11, [6]);
    await rollD66AndSkipPerception(page);
    await page.waitForTimeout(500);

    // 接近戦へ移行
    await transitionToMelee(page);

    // 「戦闘から逃走する (無防備な一撃を受ける)」をクリック
    const fleeBtn = page.locator('button:has-text("戦闘から逃走する")');
    await expect(fleeBtn).toBeVisible({ timeout: 5000 });
    await fleeBtn.click();
    await page.waitForTimeout(500);

    // ログの検証：逃亡に成功したこと
    const logbook = page.locator('.logbook-entries');
    await expect(logbook).toContainText('逃亡に成功しました！', { timeout: 5000 });

    // 戦闘終了画面となり「結果を承認して1つ前の部屋に戻る」等のボタンが出現すること
    const returnBtn = page.locator('button:has-text("結果を承認")');
    await expect(returnBtn).toBeVisible({ timeout: 5000 });
  });

});
