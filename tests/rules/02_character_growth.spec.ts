import { test, expect } from '@playwright/test';
import { 
  disableAnimations, 
  selectScenarioInUI, 
  openAdventureSheet,
  closeAdventureSheet
} from '../helpers/test-utils';

test.describe('基本ルール ver.5.1: キャラクター作成・成長・チェックポイント (Rule 13〜16, 18, 20)', () => {

  test.beforeEach(async ({ page }) => {
    page.on('dialog', dialog => dialog.accept());
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => localStorage.clear());
    await disableAnimations(page);
  });

  test('【Rule 13 & 14】初期作成：アーキタイプ別の初期装備・所持金・食料・生命力の厳密アサーション', async ({ page }) => {
    // 1. シナリオ選択
    await selectScenarioInUI(page, '魔将アラザスの迷宮');

    // 2. 幸運アーキタイプで作成（片手武器、鎖鎧(+2)、木盾(+1) -> 基礎4 + 2 + 1 = 7 HP）
    await page.fill('#char-name', '幸運のパラディン');
    // 幸運のカード（インデックス1）
    await page.locator('.archetype-card').nth(1).click({ force: true });
    await page.locator('button:has-text("キャラクターの命運を紡ぎ出す")').click({ force: true });
    await page.waitForSelector('.levelup-card', { state: 'visible', timeout: 5000 });

    // レベルアップ画面での初期表示確認
    // 初期EXP: 10点
    const expText = page.locator('.exp-pool');
    await expect(expText).toContainText('所持経験点: 10 点');

    // 冒険開始ボタンを押してダンジョン画面へ遷移
    await page.locator('button:has-text("冒険を開始する")').click({ force: true });
    await page.waitForSelector('.explorer-card', { state: 'visible', timeout: 5000 });

    // 冒険記録紙を開いてステータスと装備・所持品を精査
    await openAdventureSheet(page);
    const sheet = page.locator('.adventure-sheet');

    // 技量点 0 / 0
    await expect(sheet).toContainText('🧍技量点0 / 0');
    // 生命点 6 / 6 (基礎4 + 鎖鎧1 + 木盾1 = 6)
    await expect(sheet).toContainText('❤️生命点6 / 6');
    // 幸運点 2 / 2
    await expect(sheet).toContainText('✨幸運点2 / 2');
    // 所持金貨 10枚
    await expect(sheet).toContainText('10');
    // 食料 2
    await expect(sheet).toContainText('2');
    // 装備: 片手武器、鎖鎧、木盾
    await expect(sheet).toContainText('片手武器');
    await expect(sheet).toContainText('鎖鎧');
    await expect(sheet).toContainText('木盾');
    // アイテム: ランタン
    await expect(sheet).toContainText('ランタン');

    await closeAdventureSheet(page);
  });

  test('【Rule 15 & 16】経験点の消費と成長：コスト計算・1点単位の反映・成長上限でのボタン非活性化', async ({ page }) => {
    // 1. シナリオ選択
    await selectScenarioInUI(page, '魔将アラザスの迷宮');

    // 2. 筋力アーキタイプで作成
    await page.fill('#char-name', '力持ちウォリアー');
    await page.locator('.archetype-card').nth(2).click({ force: true });
    await page.locator('button:has-text("キャラクターの命運を紡ぎ出す")').click({ force: true });
    await page.waitForSelector('.levelup-card', { state: 'visible', timeout: 5000 });

    const expText = page.locator('.exp-pool');
    await expect(expText).toContainText('所持経験点: 10 点');

    // 技量点 +1上昇 (4 EXP消費) -> 残り 6 EXP
    const skillUpBtn = page.locator('.ledger-row:has-text("技量点") button:has-text("+1上昇")');
    await skillUpBtn.click();
    await expect(expText).toContainText('所持経験点: 6 点');
    await expect(page.locator('.ledger-row:has-text("技量点")')).toContainText('1 / 2');

    // 技量点 +1上昇 (4 EXP消費) -> 残り 2 EXP (技量点 2 / 2 限界値到達)
    await skillUpBtn.click();
    await expect(expText).toContainText('所持経験点: 2 点');
    await expect(page.locator('.ledger-row:has-text("技量点")')).toContainText('2 / 2');
    // 上限到達のためボタンが無効化されること
    await expect(skillUpBtn).toBeDisabled();

    // 生命点 +1上昇 (1 EXP消費) -> 残り 1 EXP
    const lifeUpBtn = page.locator('.ledger-row:has-text("生命点") button:has-text("+1上昇")');
    await lifeUpBtn.click();
    await expect(expText).toContainText('所持経験点: 1 点');
    await expect(page.locator('.ledger-row:has-text("生命点")')).toContainText('5 / 8');

    // 副能力値 +1上昇 (1 EXP消費) -> 残り 0 EXP
    const subUpBtn = page.locator('.ledger-row:has-text("副能力値") button:has-text("+1上昇")');
    await subUpBtn.click();
    await expect(expText).toContainText('所持経験点: 0 点');
    await expect(page.locator('.ledger-row:has-text("副能力値")')).toContainText('3 / 6');

    // EXPが0になったため、すべての+1上昇ボタンが無効化されること
    await expect(skillUpBtn).toBeDisabled();
    await expect(lifeUpBtn).toBeDisabled();
    await expect(subUpBtn).toBeDisabled();
    const followerUpBtn = page.locator('.ledger-row:has-text("従者点") button:has-text("+1上昇")');
    await expect(followerUpBtn).toBeDisabled();
  });

  test('【Rule 16】払い戻し（チェックポイント安全性）：初期値未満への払い戻し防止とEXP正確返還', async ({ page }) => {
    // 1. シナリオ選択
    await selectScenarioInUI(page, '魔将アラザスの迷宮');

    // 2. 器用アーキタイプで作成
    await page.fill('#char-name', '俊敏シーフ');
    await page.locator('.archetype-card').nth(3).click({ force: true });
    await page.locator('button:has-text("キャラクターの命運を紡ぎ出す")').click({ force: true });
    await page.waitForSelector('.levelup-card', { state: 'visible', timeout: 5000 });

    const expText = page.locator('.exp-pool');
    await expect(expText).toContainText('所持経験点: 10 点');

    // 初期状態では「- 戻す」ボタンはすべて disabled
    const refundSkillBtn = page.locator('.ledger-row:has-text("技量点") button:has-text("- 戻す")');
    const refundLifeBtn = page.locator('.ledger-row:has-text("生命点") button:has-text("- 戻す")');
    const refundSubBtn = page.locator('.ledger-row:has-text("副能力値") button:has-text("- 戻す")');
    const refundFollowerBtn = page.locator('.ledger-row:has-text("従者点") button:has-text("- 戻す")');

    await expect(refundSkillBtn).toBeDisabled();
    await expect(refundLifeBtn).toBeDisabled();
    await expect(refundSubBtn).toBeDisabled();
    await expect(refundFollowerBtn).toBeDisabled();

    // 技量点を上げる (10 -> 6 EXP)
    const skillUpBtn = page.locator('.ledger-row:has-text("技量点") button:has-text("+1上昇")');
    await skillUpBtn.click();
    await expect(expText).toContainText('所持経験点: 6 点');
    await expect(refundSkillBtn).toBeEnabled();

    // 技量点を戻す (6 -> 10 EXP)
    await refundSkillBtn.click();
    await expect(expText).toContainText('所持経験点: 10 点');
    await expect(page.locator('.ledger-row:has-text("技量点")')).toContainText('0 / 2');
    // 初期値に戻ったため「- 戻す」ボタンが再び disabled
    await expect(refundSkillBtn).toBeDisabled();

    // 生命点を2回上げる (10 -> 8 EXP)
    const lifeUpBtn = page.locator('.ledger-row:has-text("生命点") button:has-text("+1上昇")');
    await lifeUpBtn.click();
    await lifeUpBtn.click();
    await expect(expText).toContainText('所持経験点: 8 点');
    await expect(refundLifeBtn).toBeEnabled();

    // 生命点を1回戻す (8 -> 9 EXP)
    await refundLifeBtn.click();
    await expect(expText).toContainText('所持経験点: 9 点');
    await expect(refundLifeBtn).toBeEnabled();

    // もう1回戻す (9 -> 10 EXP)
    await refundLifeBtn.click();
    await expect(expText).toContainText('所持経験点: 10 点');
    await expect(refundLifeBtn).toBeDisabled();
  });

  test('【Rule 18】魔術習得スロット：副能力値に応じた習得スロット計算と習得・忘却の整合性', async ({ page }) => {
    // 1. シナリオ選択
    await selectScenarioInUI(page, '魔将アラザスの迷宮');

    // 2. 魔術アーキタイプで作成（初期副能力値 = 2、スロット = 2 / 2 = 1枠）
    await page.fill('#char-name', '天才魔法使い');
    await page.locator('.archetype-card').nth(0).click({ force: true });
    await page.locator('button:has-text("キャラクターの命運を紡ぎ出す")').click({ force: true });
    await page.waitForSelector('.levelup-card', { state: 'visible', timeout: 5000 });

    const spellSection = page.locator('.spell-learning-section');
    await expect(spellSection).toBeVisible();

    // 空きスロットが1つあること
    await expect(spellSection).toContainText('空きスロット: 1つ');

    // 炎球を習得
    const fireballBtn = spellSection.locator('button:has-text("炎球")');
    await fireballBtn.click();

    // 習得済み一覧に炎球が表示され、空きスロット選択UIが消える（0スロット）
    await expect(spellSection).toContainText('1 / 1 スロット使用中');
    await expect(spellSection.locator('.badge-stat:has-text("炎球")')).toBeVisible();

    // 忘却ボタン（✕）を押して取り消しができること
    const cancelSpellBtn = spellSection.locator('.badge-stat:has-text("炎球") button');
    await cancelSpellBtn.click();

    // 空きスロットが再び1つになること
    await expect(spellSection).toContainText('空きスロット: 1つ');
    await expect(spellSection).toContainText('0 / 1 スロット使用中');

    // 改めて「氷槍」を習得
    const iceBtn = spellSection.locator('button:has-text("氷槍")');
    await iceBtn.click();
    await expect(spellSection).toContainText('1 / 1 スロット使用中');

    // 副能力値（魔術点）を2点上げる（2 -> 4、コスト各1EXP）
    const subUpBtn = page.locator('.ledger-row:has-text("副能力値") button:has-text("+1上昇")');
    await subUpBtn.click(); // 3点 (floor(3/2) = 1枠のまま)
    await expect(spellSection).toContainText('1 / 1 スロット使用中');

    await subUpBtn.click(); // 4点 (floor(4/2) = 2枠に増加！)
    // 空きスロットが1つ増えて選択UIが再出現すること
    await expect(spellSection).toContainText('空きスロット: 1つ');
    await expect(spellSection).toContainText('1 / 2 スロット使用中');

    // 2つ目の魔術として「気絶」を習得
    const stunBtn = spellSection.locator('button:has-text("気絶")');
    await stunBtn.click();
    await expect(spellSection).toContainText('2 / 2 スロット使用中');
    await expect(spellSection.locator('.badge-stat:has-text("氷槍")')).toBeVisible();
    await expect(spellSection.locator('.badge-stat:has-text("気絶")')).toBeVisible();
  });

});
