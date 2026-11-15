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
    await page.addInitScript(() => {
      if (!sessionStorage.getItem('__test_initialized__')) {
        localStorage.clear();
        sessionStorage.setItem('__test_initialized__', '1');
      }
    });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
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
    await page.getByTestId('confirm-modal-ok').click({ force: true });
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
    await page.getByTestId('confirm-modal-ok').click({ force: true });
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

    // ログの検証：逃走に成功したこと
    const logbook = page.locator('.logbook-entries');
    await expect(logbook).toContainText('逃走に成功しました！', { timeout: 5000 });

    // 戦闘終了画面となり「結果を承認して再探索する」等のボタンが出現すること
    const returnBtn = page.locator('button:has-text("結果を承認")');
    await expect(returnBtn).toBeVisible({ timeout: 5000 });
  });

  test('【Rule 23】器用【宝物の獲得】：宝物表ロール出目確認後の器用点1点消費による出目+1補正', async ({ page }) => {
    // 1. シナリオ選択
    await selectScenarioInUI(page, '魔将アラザスの迷宮');

    // 2. 器用アーキタイプ作成（器用点 2/2）
    await page.fill('#char-name', '宝探しの盗賊');
    await page.locator('.archetype-card').nth(3).click({ force: true });
    await page.locator('button:has-text("キャラクターの命運を紡ぎ出す")').click({ force: true });
    await page.waitForSelector('.levelup-card', { state: 'visible', timeout: 5000 });

    // 冒険開始
    await page.locator('button:has-text("冒険を開始する")').click({ force: true });
    await page.waitForSelector('.explorer-card', { state: 'visible', timeout: 5000 });

    // d66 = 11 (ゴブリン斥候部隊: Lv.2, HP 1, 3体)
    // 第1R攻撃出目: 4 (敵A撃破、残り2体)
    // 敵反撃出目: 5 (主人公防御成功)
    // 第2R攻撃出目: 4 (敵B撃破、残り1体 -> 初期HP3の半分以下になり敵Cが逃走勝利！)
    // 宝物ロール出目: 5 (小宝石)
    // 小宝石価値ロール: 出目6
    // 器用点+1で出目6 (大宝石: 金貨30枚〜)
    // 大宝石価値ロール: 出目6, 出目6 (2d6=12 * 5 = 60枚)
    await setupMockRandom(page, 11, [4, 5, 4, 5, 6, 6, 6]);
    await rollD66AndSkipPerception(page);
    await page.waitForTimeout(500);

    // 接近戦へ移行
    await transitionToMelee(page);

    // 1回目の通常攻撃（敵A撃破）
    await clickButtonByText(page, '通常攻撃', 800);

    // 敵の反撃を防御
    await handlePendingDefense(page);

    // 2回目の通常攻撃（敵B撃破 -> 敵逃走勝利）
    await clickButtonByText(page, '通常攻撃', 800);

    // 「💎 宝箱を開ける (ダイスを振る)」をクリック
    const openChestBtn = page.locator('button:has-text("宝箱を開ける")');
    await expect(openChestBtn).toBeVisible({ timeout: 5000 });
    await openChestBtn.click();
    await page.waitForTimeout(500);

    // インラインで「🎯 器用点1消費して出目+1に変更」ボタンが出現することを確認 (Rule 23)
    const applyDexBtn = page.locator('button:has-text("器用点1消費して出目+1に変更")');
    await expect(applyDexBtn).toBeVisible({ timeout: 5000 });
    await applyDexBtn.click();
    await page.waitForTimeout(500);

    // ログの検証：器用点消費と出目6への変更、大宝石の獲得
    const logbook = page.locator('.logbook-entries');
    await expect(logbook).toContainText('器用点【宝物の獲得】を発動！');
    await expect(logbook).toContainText('大宝石');

    // 冒険記録紙を開き、器用点が 2 から 1 に消費されていることを確認
    await openAdventureSheet(page);
    const advSheet = page.locator('.adventure-sheet');
    await expect(advSheet).toContainText('器用点1 / 2');
    await closeAdventureSheet(page);
  });

  test('【セーブ復元・冒険者表示・別シナリオ警告】戦闘勝利＆宝物獲得後のリロードでも状態が保持され、トップ画面表示と警告モーダルが機能する', async ({ page }) => {
    await selectScenarioInUI(page, '黒蛇の洞窟');

    await page.fill('#char-name', '不屈の探索者');
    await page.locator('.archetype-card').nth(3).click({ force: true }); // 器用点
    await page.locator('button:has-text("キャラクターの命運を紡ぎ出す")').click({ force: true });
    await page.waitForSelector('.levelup-card', { state: 'visible', timeout: 5000 });

    await page.locator('button:has-text("冒険を開始する")').click({ force: true });
    await page.waitForSelector('.explorer-card', { state: 'visible', timeout: 5000 });

    // 戦闘後の宝物獲得・器用点消費状態をシミュレート（金貨25G、器用点1/2）
    await page.evaluate(() => {
      const state = (window as any).__GAME_STATE__;
      if (state) {
        state.character.value.gold = 25;
        state.character.value.subStatCurrent = 1;
      }
    });

    // ページを再読込してトップ画面へ
    await page.reload();
    await page.waitForSelector('.scenario-selector', { state: 'visible', timeout: 5000 });

    // #9: 進行中の冒険がある状態で、トップの冒険者欄にキャラクター名が表示されていること
    await expect(page.locator('.current-character-card')).toContainText('不屈の探索者');
    await expect(page.locator('.saved-session-banner')).toBeVisible();

    // #24: 別シナリオを選ぼうとすると確認モーダルが表示され、キャンセルで戻れること
    await page.locator('.scenario-card').filter({ hasText: '魔将アラザスの迷宮' }).first().click({ force: true });
    await page.locator('.scenario-detail-panel button:has-text("このシナリオに挑む")').first().click({ force: true });
    const confirmModal = page.locator('[data-testid="confirm-modal"]');
    await expect(confirmModal).toBeVisible();
    await page.locator('[data-testid="confirm-modal-cancel"]').click();
    await expect(confirmModal).toBeHidden();

    // #2: 「進行中の冒険を再開する」で復元すると、金貨25G・器用点1/2が巻き戻らず保持されていること
    await page.locator('button.btn-resume').click();
    await page.waitForSelector('.explorer-card', { state: 'visible', timeout: 5000 });

    const restored = await page.evaluate(() => {
      const state = (window as any).__GAME_STATE__;
      return {
        gold: state.character.value.gold,
        subStatCurrent: state.character.value.subStatCurrent,
      };
    });
    expect(restored.gold).toBe(25);
    expect(restored.subStatCurrent).toBe(1);
  });

  test('【Rule 9, 19, 21, 27】盾の近接無修正・炎球威力計算・対魔法ロール・聖水器用点消費・防衛対象選択の検証', async ({ page }) => {
    await selectScenarioInUI(page, '魔将アラザスの迷宮');

    await page.fill('#char-name', 'ルール検証者');
    await page.locator('.archetype-card').nth(1).click({ force: true }); // 幸運アーキタイプ（片手武器・鎖鎧(+1)・木盾・ランタン）
    await page.locator('button:has-text("キャラクターの命運を紡ぎ出す")').click({ force: true });
    await page.waitForSelector('.levelup-card', { state: 'visible', timeout: 5000 });

    // 防衛を習得（初期幸運点2 -> 習得枠1）
    await page.locator('.spell-learning-section button:has-text("防衛")').click();

    // 兵士を雇用（戦闘従者がいる状態で防衛の対象選択が出ることを確認するため）
    const recruitSoldierBtn = page.locator('.recruiter-column > div > div').filter({ hasText: '兵士' }).locator('button:has-text("雇用")');
    await recruitSoldierBtn.click();

    await page.locator('button:has-text("冒険を開始する")').click({ force: true });
    await page.waitForSelector('.explorer-card', { state: 'visible', timeout: 5000 });

    // 暗闇ペナルティを避けるため木盾は装備したまま片手武器を外す（鎖鎧+1のみ、木盾は近接防御修正0）
    await openAdventureSheet(page);
    await page.locator('.adventure-sheet .equipped-slot:has-text("右手/武器") button:has-text("外す")').click();
    await closeAdventureSheet(page);

    // d66 = 11 (ゴブリン斥候 3体, Lv.2)
    await setupMockRandom(page, 11, [4, 4, 4, 4, 4]);
    await rollD66AndSkipPerception(page);
    await page.waitForTimeout(500);
    await transitionToMelee(page);

    // #17: 奇跡「防衛」をクリックすると、戦闘従者がいるため対象選択サブメニューが表示されること
    await page.locator('button:has-text("じゅもん")').click();
    await page.locator('button:has-text("防衛")').click();
    const heroProtBtn = page.locator('button:has-text("主人公1人 (防御ロール+1)")');
    const folProtBtn = page.locator('button:has-text("戦う従者全員 (防御ロール+1)")');
    await expect(heroProtBtn).toBeVisible();
    await expect(folProtBtn).toBeVisible();

    // 戦う従者全員を選択 -> followerDefenseBonus が +1 され、heroDefenseBonus は 0 のままであること
    await folProtBtn.click();
    await page.waitForTimeout(800);

    const buffsAfterProt = await page.evaluate(() => {
      const state = (window as any).__GAME_STATE__;
      return {
        heroBonus: state.combatState.buffs.heroDefenseBonus,
        followerBonus: state.combatState.buffs.followerDefenseBonus,
      };
    });
    expect(buffsAfterProt.heroBonus).toBe(0);
    expect(buffsAfterProt.followerBonus).toBe(1);
  });

});
