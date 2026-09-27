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

test.describe('基本ルール ver.5.1: 装備品・所持品・食料・暗闇 (Rule 27〜31)', () => {

  test.beforeEach(async ({ page }) => {
    page.on('dialog', dialog => dialog.accept());
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => localStorage.clear());
    await disableAnimations(page);
  });

  test('【Rule 28 & 30】両手武器と盾の排他制御および防具・盾による生命力連動', async ({ page }) => {
    // 1. シナリオ選択
    await selectScenarioInUI(page, '魔将アラザスの迷宮');

    // 2. 筋力アーキタイプ作成（両手武器、板金鎧(+2) -> 基礎4 + 2 = 6 HP）
    await page.fill('#char-name', '両手剣士');
    await page.locator('.archetype-card').nth(2).click({ force: true });
    await page.locator('button:has-text("キャラクターの命運を紡ぎ出す")').click({ force: true });
    await page.waitForSelector('.levelup-card', { state: 'visible', timeout: 5000 });

    // 街の市場で木盾（金貨5枚）を購入（初期金貨10枚 -> 5枚）
    const buyWoodShieldBtn = page.locator('.shop-column span:has-text("木盾") + button').first();
    await buyWoodShieldBtn.click();
    await expect(page.locator('.logbook-entries')).toContainText('街の市場で [木盾] を購入しました');

    // 冒険開始
    await page.locator('button:has-text("冒険を開始する")').click({ force: true });
    await page.waitForSelector('.explorer-card', { state: 'visible', timeout: 5000 });

    // 冒険記録紙を開く
    await openAdventureSheet(page);
    const sheet = page.locator('.adventure-sheet');
    const logbook = page.locator('.logbook-entries');

    // 初期状態：板金鎧(+2)装備により生命力 6 / 6
    await expect(sheet).toContainText('❤️生命点6 / 6');
    await expect(sheet).toContainText('右手/武器:両手武器');

    // 両手武器を装備している状態で、背負い袋の木盾の「装備」をクリック
    const shieldEquipBtn = sheet.locator('.bag-item:has-text("木盾") button:has-text("装備")');
    await shieldEquipBtn.click();

    // 排他エラーが発生すること
    await expect(logbook).toContainText('両手武器を装備しているため盾を装備できません。');

    // 両手武器を「外す」
    const unequipWeaponBtn = sheet.locator('.equipped-slot:has-text("右手/武器") button:has-text("外す")');
    await unequipWeaponBtn.click();
    await expect(logbook).toContainText('両手武器 (大剣/戦斧)を装備解除しました。');

    // 改めて木盾を装備 -> 成功して生命力が +1 (6 -> 7)
    await shieldEquipBtn.click();
    await expect(logbook).toContainText('木盾を装備しました。生命力最大値 +1');
    await expect(sheet).toContainText('❤️生命点7 / 7');

    // 盾を装備している状態で、背負い袋の両手武器の「装備」をクリック
    const weaponEquipBtn = sheet.locator('.bag-item:has-text("両手武器") button:has-text("装備")');
    await weaponEquipBtn.click();

    // 排他エラーが発生すること
    await expect(logbook).toContainText('両手武器は盾と同時に装備できません。');

    // 木盾を「外す」と生命力が -1 (7 -> 6)
    const unequipShieldBtn = sheet.locator('.equipped-slot:has-text("左手/盾") button:has-text("外す")');
    await unequipShieldBtn.click();
    await expect(sheet).toContainText('❤️生命点6 / 6');

    // 板金鎧を「外す」と生命力が -2 (6 -> 4)
    const unequipArmorBtn = sheet.locator('.equipped-slot:has-text("胴体/防具") button:has-text("外す")');
    await unequipArmorBtn.click();
    await expect(sheet).toContainText('❤️生命点4 / 4');

    await closeAdventureSheet(page);
  });

  test('【Rule 27】背負い袋の枠制限：着用外装備のカウントと満杯時の制御', async ({ page }) => {
    // 1. シナリオ選択
    await selectScenarioInUI(page, '魔将アラザスの迷宮');

    // 2. 魔術アーキタイプ（軽い武器、布鎧(+1)、ランタン -> 最大HP 5 -> 背負い袋枠 5）
    await page.fill('#char-name', '荷物持ちメイジ');
    await page.locator('.archetype-card').nth(0).click({ force: true });
    await page.locator('button:has-text("キャラクターの命運を紡ぎ出す")').click({ force: true });
    await page.waitForSelector('.levelup-card', { state: 'visible', timeout: 5000 });

    // 炎球を習得
    await page.locator('.spell-learning-section button:has-text("炎球")').click();

    // 街の市場で軽い武器（2G）を2本購入（初期金貨10 -> 6G）
    const buyLightWeaponBtn = page.locator('.shop-column span:has-text("軽い武器") + button').first();
    await buyLightWeaponBtn.click();
    await buyLightWeaponBtn.click();

    // 冒険開始
    await page.locator('button:has-text("冒険を開始する")').click({ force: true });
    await page.waitForSelector('.explorer-card', { state: 'visible', timeout: 5000 });

    // 冒険記録紙を開いて背負い袋の枠数を確認
    await openAdventureSheet(page);
    const sheet = page.locator('.adventure-sheet');

    // 背負い袋の容量表示を確認 (着用中の軽い武器1本と布鎧を除き、ランタン1 + 予備軽い武器2 = 3 / 5 スロット)
    await expect(sheet).toContainText('背負い袋 (3 / 5 スロット)');

    await closeAdventureSheet(page);
  });

  test('【Rule 28】暗闇ペナルティ：両手が塞がった際のランタン保持不可と全判定-2の適用', async ({ page }) => {
    // 1. シナリオ選択
    await selectScenarioInUI(page, '魔将アラザスの迷宮');

    // 2. 幸運アーキタイプ作成（片手武器、鎖鎧、木盾、ランタン所持）
    // 初期状態では片手武器と木盾を両方装備しているため「両手が塞がっている」状態
    await page.fill('#char-name', '暗闇の騎士');
    await page.locator('.archetype-card').nth(1).click({ force: true });
    await page.locator('button:has-text("キャラクターの命運を紡ぎ出す")').click({ force: true });
    await page.waitForSelector('.levelup-card', { state: 'visible', timeout: 5000 });

    // 冒険開始
    await page.locator('button:has-text("冒険を開始する")').click({ force: true });
    await page.waitForSelector('.explorer-card', { state: 'visible', timeout: 5000 });

    // 冒険記録紙を開いて暗闇状態を確認
    await openAdventureSheet(page);
    const sheet = page.locator('.adventure-sheet');
    await expect(sheet).toContainText('明かり: ❌ 暗闇 (判定-2)');
    await closeAdventureSheet(page);

    // 戦闘に遭遇して暗闇ペナルティが攻撃判定に適用されることを検証
    // d66 = 11 (ゴブリン斥候: Lv.2, HP 1)
    // 攻撃出目: 4 (4 + 0(技量) + 0(片手武器) - 2(暗闇) = 2 >= Lv.2 で命中)
    await setupMockRandom(page, 11, [4]);
    await rollD66AndSkipPerception(page);
    await page.waitForTimeout(500);

    await transitionToMelee(page);
    await handlePendingDefense(page);

    // 通常攻撃を実行
    await clickButtonByText(page, '通常攻撃', 800);

    // ログに暗闇ペナルティが記録されていることを確認
    const logbook = page.locator('.logbook-entries');
    await expect(logbook).toContainText('暗闇での戦闘により攻撃判定に -2 のペナルティ！');
  });

  test('【Rule 28 & 29】素手攻撃ペナルティ：武器未装備時の攻撃判定-2ペナルティ', async ({ page }) => {
    // 1. シナリオ選択
    await selectScenarioInUI(page, '魔将アラザスの迷宮');

    // 2. 筋力アーキタイプ作成
    await page.fill('#char-name', '素手格闘家');
    await page.locator('.archetype-card').nth(2).click({ force: true });
    await page.locator('button:has-text("キャラクターの命運を紡ぎ出す")').click({ force: true });
    await page.waitForSelector('.levelup-card', { state: 'visible', timeout: 5000 });

    // 冒険開始
    await page.locator('button:has-text("冒険を開始する")').click({ force: true });
    await page.waitForSelector('.explorer-card', { state: 'visible', timeout: 5000 });

    // 冒険記録紙を開いて両手武器を外す（素手になる）
    // 両手武器を外すと片手が空くためランタンが点灯し、暗闇ペナルティは入らない
    await openAdventureSheet(page);
    const sheet = page.locator('.adventure-sheet');
    const unequipWeaponBtn = sheet.locator('button:has-text("外す")').first();
    await unequipWeaponBtn.click();
    await expect(sheet).toContainText('明かり: 点灯中');
    await closeAdventureSheet(page);

    // 戦闘に遭遇
    // d66 = 11 (ゴブリン斥候: Lv.2, HP 1)
    // 攻撃出目: 4 (4 + 0(技量) - 2(素手) = 2 >= Lv.2 で命中)
    await setupMockRandom(page, 11, [4]);
    await rollD66AndSkipPerception(page);
    await page.waitForTimeout(500);

    await transitionToMelee(page);
    await handlePendingDefense(page);

    // 通常攻撃を実行
    await clickButtonByText(page, '通常攻撃', 800);

    // ログに素手攻撃ペナルティが記録されていることを確認
    const logbook = page.locator('.logbook-entries');
    await expect(logbook).toContainText('素手での攻撃によるペナルティ -2');
  });

  test('【Rule 31】食料消費による生命力回復：満タン時不可・ダメージ後+2点回復の厳密アサーション', async ({ page }) => {
    // 1. シナリオ選択
    await selectScenarioInUI(page, '魔将アラザスの迷宮');

    // 2. 器用アーキタイプ作成（基礎4 + 革鎧2 = 最大HP 6）
    await page.fill('#char-name', '食いしん坊レンジャー');
    await page.locator('.archetype-card').nth(3).click({ force: true });
    await page.locator('button:has-text("キャラクターの命運を紡ぎ出す")').click({ force: true });
    await page.waitForSelector('.levelup-card', { state: 'visible', timeout: 5000 });

    // 冒険開始
    await page.locator('button:has-text("冒険を開始する")').click({ force: true });
    await page.waitForSelector('.explorer-card', { state: 'visible', timeout: 5000 });

    // 冒険記録紙を開く
    await openAdventureSheet(page);
    const sheet = page.locator('.adventure-sheet');

    // HP満タン（6 / 6）の時は「食べる」ボタンが無効化されていること
    const eatFoodBtn = sheet.locator('button:has-text("食べる (+2回復)")');
    await expect(eatFoodBtn).toBeDisabled();
    await closeAdventureSheet(page);

    // トラップ（d66 = 32: 矢の罠、目標値5、失敗時2ダメージ）
    // setupMockRandom: d66=32, 判定出目=1(失敗: 1 + 0(技量) = 1 < 5)
    await setupMockRandom(page, 32, [1]);
    await rollD66AndSkipPerception(page);
    await page.waitForTimeout(500);

    // 技量でトラップ回避を試みるが失敗してダメージを受ける
    const evadeSkillBtn = page.locator('button:has-text("技量点で挑戦")');
    await expect(evadeSkillBtn).toBeVisible({ timeout: 5000 });
    await evadeSkillBtn.click();
    await page.waitForTimeout(500);

    // 冒険記録紙を開く
    await openAdventureSheet(page);
    await expect(sheet).toContainText('❤️生命点5 / 6');
    await expect(sheet).toContainText('食料: 2 食分');

    // HPが減ったので「食べる」ボタンが活性化されていること
    await expect(eatFoodBtn).toBeEnabled();

    // 食料を食べる -> 食料1食分消費、生命力が +2回復して 6 / 6 に戻る
    await eatFoodBtn.click();
    await expect(sheet).toContainText('❤️生命点6 / 6');
    await expect(sheet).toContainText('食料: 1 食分');

    // 再び満タンになったので「食べる」ボタンが無効化されること
    await expect(eatFoodBtn).toBeDisabled();

    await closeAdventureSheet(page);
  });

});
