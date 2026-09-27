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

test.describe('基本ルール ver.5.1: 従者システム・かばう・戦闘・非戦闘従者 (Rule 22, 32, 33)', () => {

  test.beforeEach(async ({ page }) => {
    page.on('dialog', dialog => dialog.accept());
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await disableAnimations(page);
  });

  test('【Rule 32】従者雇用：初期従者枠、市場での雇用、冒険記録紙での解雇による枠回復', async ({ page }) => {
    // 1. シナリオ選択
    await selectScenarioInUI(page, '魔将アラザスの迷宮');

    // 2. キャラクター作成（器用アーキタイプ）
    await page.fill('#char-name', '指揮官勇者');
    await page.locator('.archetype-card').nth(3).click({ force: true });
    await page.locator('button:has-text("キャラクターの命運を紡ぎ出す")').click({ force: true });
    await page.waitForSelector('.levelup-card', { state: 'visible', timeout: 5000 });

    // 市場で兵士（無料）を1人雇用
    const recruitSoldierBtn = page.locator('.recruiter-column > div > div').filter({ hasText: '兵士' }).locator('button:has-text("雇用")');
    await recruitSoldierBtn.click();
    await expect(page.locator('.logbook-entries')).toContainText('新米兵士を雇用しました。');

    // 市場でランタン持ち（無料）を1人雇用
    const recruitLanternBtn = page.locator('.recruiter-column > div > div').filter({ hasText: 'ランタン持ち' }).locator('button:has-text("雇用")');
    await recruitLanternBtn.click();
    await expect(page.locator('.logbook-entries')).toContainText('ランタン持ち従者を雇用しました。');

    // 冒険開始
    await page.locator('button:has-text("冒険を開始する")').click({ force: true });
    await page.waitForSelector('.explorer-card', { state: 'visible', timeout: 5000 });

    // 冒険記録紙を開く
    await openAdventureSheet(page);
    const sheet = page.locator('.adventure-sheet');

    // 従者枠の表示確認 (2 / 7)
    await expect(sheet).toContainText('👥従者点2 / 7');
    await expect(sheet).toContainText('新米兵士');
    await expect(sheet).toContainText('ランタン持ち従者');

    // 兵士を「解雇」する
    const dismissSoldierBtn = sheet.locator('.follower-card').filter({ hasText: '新米兵士' }).locator('button:has-text("解雇")');
    await dismissSoldierBtn.click();

    // 従者点が 1 / 7 に減少し、兵士がいなくなること
    await expect(sheet).toContainText('👥従者点1 / 7');
    await expect(sheet.locator('.follower-card:has-text("新米兵士")')).toHaveCount(0);
    await expect(sheet).toContainText('ランタン持ち従者');

    await closeAdventureSheet(page);
  });

  test('【Rule 33】戦闘従者HP1即死ルール：被弾による従者の死亡とリストからの即時除外', async ({ page }) => {
    // 1. シナリオ選択
    await selectScenarioInUI(page, '魔将アラザスの迷宮');

    // 2. 幸運アーキタイプで作成
    await page.fill('#char-name', '幸運の騎士');
    await page.locator('.archetype-card').nth(1).click({ force: true });
    await page.locator('button:has-text("キャラクターの命運を紡ぎ出す")').click({ force: true });
    await page.waitForSelector('.levelup-card', { state: 'visible', timeout: 5000 });

    // 兵士（無料）を1人雇用
    const recruitSoldierBtn = page.locator('.recruiter-column > div > div').filter({ hasText: '兵士' }).locator('button:has-text("雇用")');
    await recruitSoldierBtn.click();

    // 冒険開始
    await page.locator('button:has-text("冒険を開始する")').click({ force: true });
    await page.waitForSelector('.explorer-card', { state: 'visible', timeout: 5000 });

    // d66 = 11 (ゴブリン斥候部隊: Lv.2, HP 1, 3体)
    // プレイヤー攻撃出目: 4 (命中・敵A撃破) -> 兵士攻撃出目: 1 (ミス) -> 敵反撃の兵士防御出目: 1 (被弾即死)
    await setupMockRandom(page, 11, [4, 1, 1]);
    await rollD66AndSkipPerception(page);
    await page.waitForTimeout(500);

    // 接近戦へ移行
    await transitionToMelee(page);

    // 通常攻撃を実行（敵反撃フェーズを誘発）
    await clickButtonByText(page, '通常攻撃', 800);

    // 防御割り当てが発生：敵の攻撃を「従者 [新米兵士] が受ける」に割り当てる
    const assignFollowerBtn = page.locator('button:has-text("が受ける")').first();
    await expect(assignFollowerBtn).toBeVisible({ timeout: 5000 });
    await assignFollowerBtn.click();
    await page.waitForTimeout(500);

    // かばう画面（または即死画面）が出現した場合、見送るをクリック
    const seeOffBtn = page.locator('button:has-text("かばうのを見送る")');
    if (await seeOffBtn.isVisible({ timeout: 3000 })) {
      await seeOffBtn.click();
      await page.waitForTimeout(500);
    }

    // ログに従者の死亡が記録されていることを確認
    const logbook = page.locator('.logbook-entries');
    await expect(logbook).toContainText('息絶えました');

    // 冒険記録紙を開いて兵士がリストから除外されていることを確認
    await openAdventureSheet(page);
    const sheet = page.locator('.adventure-sheet');
    await expect(sheet).toContainText('👥従者点0 / 7');
    await expect(sheet).toContainText('従者はいません');
    await closeAdventureSheet(page);
  });

  test('【Rule 22】筋力【かばう】：従者への攻撃を筋力1点消費して防ぎ、従者の死亡を阻止すること', async ({ page }) => {
    // 1. シナリオ選択
    await selectScenarioInUI(page, '魔将アラザスの迷宮');

    // 2. 筋力アーキタイプで作成（筋力点 2/2）
    await page.fill('#char-name', '忠義の守護騎士');
    await page.locator('.archetype-card').nth(2).click({ force: true });
    await page.locator('button:has-text("キャラクターの命運を紡ぎ出す")').click({ force: true });
    await page.waitForSelector('.levelup-card', { state: 'visible', timeout: 5000 });

    // 兵士（無料）を1人雇用
    const recruitSoldierBtn = page.locator('.recruiter-column > div > div').filter({ hasText: '兵士' }).locator('button:has-text("雇用")');
    await recruitSoldierBtn.click();

    // 冒険開始
    await page.locator('button:has-text("冒険を開始する")').click({ force: true });
    await page.waitForSelector('.explorer-card', { state: 'visible', timeout: 5000 });

    // d66 = 11 (ゴブリン斥候部隊: Lv.2, 3体)
    // プレイヤー攻撃出目: 4 (命中・敵A撃破) -> 兵士攻撃出目: 1 (ミス) -> 敵反撃の兵士防御出目: 1 (被弾) -> かばう出目: 5 (防衛成功)
    await setupMockRandom(page, 11, [4, 1, 1, 5]);
    await rollD66AndSkipPerception(page);
    await page.waitForTimeout(500);

    // 接近戦へ移行
    await transitionToMelee(page);

    // 通常攻撃を実行（敵反撃フェーズを誘発）
    await clickButtonByText(page, '通常攻撃', 800);

    // 敵の攻撃を「従者 [新米兵士] が受ける」に割り当てる
    const assignFollowerBtn = page.locator('button:has-text("が受ける")').first();
    await expect(assignFollowerBtn).toBeVisible({ timeout: 5000 });
    await assignFollowerBtn.click();
    await page.waitForTimeout(500);

    // 「従者をかばう！」UIが出現することを確認
    const coverPrompt = page.locator('.alert-title:has-text("従者をかばう！")');
    await expect(coverPrompt).toBeVisible({ timeout: 5000 });

    // 「筋力点を基準にしてかばう」をクリック
    const coverWithStrengthBtn = page.locator('button:has-text("筋力点")').filter({ hasText: 'かばう' });
    await coverWithStrengthBtn.click();
    await page.waitForTimeout(500);

    // ログの検証：
    // 1. かばうにより筋力点を1点消費（残り1点）
    // 2. かばう成功！ 従者 新米兵士 は無傷
    const logbook = page.locator('.logbook-entries');
    await expect(logbook).toContainText('かばうにより筋力点を1点消費。(残り: 1)');
    await expect(logbook).toContainText('かばう成功！ 主人公が攻撃を防ぎきり、従者 新米兵士 は無傷です');

    // 冒険記録紙を開いて兵士が生存しており、筋力点が 1 / 2 であることを確認
    await openAdventureSheet(page);
    const sheet = page.locator('.adventure-sheet');
    await expect(sheet).toContainText('💪筋力点1 / 2');
    await expect(sheet).toContainText('👥従者点1 / 7');
    await expect(sheet).toContainText('新米兵士');
    await closeAdventureSheet(page);
  });

  test('【Rule 33】非戦闘従者の恩恵：太刀持ち同行時の武器持ち替え手番消費の省略', async ({ page }) => {
    // 1. シナリオ選択
    await selectScenarioInUI(page, '魔将アラザスの迷宮');

    // 2. 器用アーキタイプで作成（弓矢所持）
    await page.fill('#char-name', '弓騎兵');
    await page.locator('.archetype-card').nth(3).click({ force: true });
    await page.locator('button:has-text("キャラクターの命運を紡ぎ出す")').click({ force: true });
    await page.waitForSelector('.levelup-card', { state: 'visible', timeout: 5000 });

    // 太刀持ち（無料）を雇用
    const recruitSwordbearerBtn = page.locator('.recruiter-column > div > div').filter({ hasText: '太刀持ち' }).locator('button:has-text("雇用")');
    await recruitSwordbearerBtn.click();

    // 冒険開始
    await page.locator('button:has-text("冒険を開始する")').click({ force: true });
    await page.waitForSelector('.explorer-card', { state: 'visible', timeout: 5000 });

    // d66 = 11 (ゴブリン斥候: Lv.2, HP 1)
    // 射撃出目: 4 (4 + 0(器用) = 4 >= 2 で命中、敵A撃破)
    await setupMockRandom(page, 11, [4]);
    await rollD66AndSkipPerception(page);
    await page.waitForTimeout(500);

    // 第0ラウンド：射撃を実行
    const rangedAttackBtn = page.locator('button:has-text("射撃攻撃")').first();
    await expect(rangedAttackBtn).toBeVisible({ timeout: 5000 });
    await rangedAttackBtn.click();
    await page.waitForTimeout(500);

    // 接近戦（第1ラウンド）へ移行
    await transitionToMelee(page);
    await handlePendingDefense(page);

    // 太刀持ちがいるため「武器の持ち替え中...」にならず、即座に通常攻撃ボタンが押せることを検証
    const switchingBadge = page.locator('.badge-switching');
    await expect(switchingBadge).toHaveCount(0);

    const normalAttackBtn = page.locator('button:has-text("通常攻撃")').first();
    await expect(normalAttackBtn).toBeVisible();
    await expect(normalAttackBtn).toBeEnabled();
  });

});
