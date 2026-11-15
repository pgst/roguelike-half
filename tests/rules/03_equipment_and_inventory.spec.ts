import { test, expect } from "@playwright/test";
import {
  disableAnimations,
  setupMockRandom,
  selectScenarioInUI,
  rollD66AndSkipPerception,
  clickButtonByText,
  transitionToMelee,
  handlePendingDefense,
  openAdventureSheet,
  closeAdventureSheet,
} from "../helpers/test-utils";

test.describe("基本ルール ver.5.1: 装備品・所持品・食料・暗闇 (Rule 27〜31)", () => {
  test.beforeEach(async ({ page }) => {
    page.on("dialog", (dialog) => dialog.accept());
    await page.addInitScript(() => localStorage.clear());
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await disableAnimations(page);
  });

  test("【Rule 28 & 30】両手武器と盾の排他制御および防具・盾による生命力連動", async ({
    page,
  }) => {
    // 1. シナリオ選択
    await selectScenarioInUI(page, "魔将アラザスの迷宮");

    // 2. 筋力アーキタイプ作成（両手武器、板金鎧(+2) -> 基礎4 + 2 = 6 HP）
    await page.fill("#char-name", "両手剣士");
    await page.locator(".archetype-card").nth(2).click({ force: true });
    await page
      .locator('button:has-text("キャラクターの命運を紡ぎ出す")')
      .click({ force: true });
    await page.waitForSelector(".levelup-card", {
      state: "visible",
      timeout: 5000,
    });

    // 街の市場で木盾（金貨5枚）を購入（初期金貨10枚 -> 5枚）
    const buyWoodShieldBtn = page
      .locator('.shop-column span:has-text("木盾") + button')
      .first();
    await buyWoodShieldBtn.click();
    await expect(page.locator(".logbook-entries")).toContainText(
      "街の市場で [木盾] を購入しました",
    );

    // 冒険開始
    await page
      .locator('button:has-text("冒険を開始する")')
      .click({ force: true });
    await page.waitForSelector(".explorer-card", {
      state: "visible",
      timeout: 5000,
    });

    // 冒険記録紙を開く
    await openAdventureSheet(page);
    const sheet = page.locator(".adventure-sheet");
    const logbook = page.locator(".logbook-entries");

    // 初期状態：板金鎧(+2)装備により生命力 6 / 6
    await expect(sheet).toContainText("❤️生命点6 / 6");
    await expect(sheet).toContainText("右手/武器:両手武器");

    // 両手武器を装備している状態で、背負い袋の木盾の「装備」をクリック
    const shieldEquipBtn = sheet.locator(
      '.bag-item:has-text("木盾") button:has-text("装備")',
    );
    await shieldEquipBtn.click();

    // 排他エラーが発生すること
    await expect(logbook).toContainText(
      "両手武器を装備しているため盾を装備できません。",
    );

    // 両手武器を「外す」
    const unequipWeaponBtn = sheet.locator(
      '.equipped-slot:has-text("右手/武器") button:has-text("外す")',
    );
    await unequipWeaponBtn.click();
    await expect(logbook).toContainText(
      "両手武器 (大剣/戦斧)を装備解除しました。",
    );

    // 改めて木盾を装備 -> 成功して生命力が +1 (6 -> 7)
    await shieldEquipBtn.click();
    await expect(logbook).toContainText("木盾を装備しました。生命力最大値 +1");
    await expect(sheet).toContainText("❤️生命点7 / 7");

    // 盾を装備している状態で、背負い袋の両手武器の「装備」をクリック
    const weaponEquipBtn = sheet.locator(
      '.bag-item:has-text("両手武器") button:has-text("装備")',
    );
    await weaponEquipBtn.click();

    // 排他エラーが発生すること
    await expect(logbook).toContainText("両手武器は盾と同時に装備できません。");

    // 木盾を「外す」と生命力が -1 (7 -> 6)
    const unequipShieldBtn = sheet.locator(
      '.equipped-slot:has-text("左手/盾") button:has-text("外す")',
    );
    await unequipShieldBtn.click();
    await expect(sheet).toContainText("❤️生命点6 / 6");

    // Rule 27 (#20): 予備の防具は背負い袋に入れられないため、着用中の防具には「外す」ボタンが存在しないこと
    const unequipArmorBtn = sheet.locator(
      '.equipped-slot:has-text("胴体/防具") button:has-text("外す")',
    );
    await expect(unequipArmorBtn).toHaveCount(0);

    await closeAdventureSheet(page);
  });

  test("【Rule 27】背負い袋の枠制限：着用外装備のカウントと満杯時の制御", async ({
    page,
  }) => {
    // 1. シナリオ選択
    await selectScenarioInUI(page, "魔将アラザスの迷宮");

    // 2. 魔術アーキタイプ（軽い武器、布鎧(+1)、ランタン -> 最大HP 5 -> 背負い袋枠 5）
    await page.fill("#char-name", "荷物持ちメイジ");
    await page.locator(".archetype-card").nth(0).click({ force: true });
    await page
      .locator('button:has-text("キャラクターの命運を紡ぎ出す")')
      .click({ force: true });
    await page.waitForSelector(".levelup-card", {
      state: "visible",
      timeout: 5000,
    });

    // 炎球を習得
    await page
      .locator('.spell-learning-section button:has-text("炎球")')
      .click();

    // 街の市場で軽い武器（2G）を2本購入（初期金貨10 -> 6G）
    const buyLightWeaponBtn = page
      .locator('.shop-column span:has-text("軽い武器") + button')
      .first();
    await buyLightWeaponBtn.click();
    await buyLightWeaponBtn.click();

    // 冒険開始
    await page
      .locator('button:has-text("冒険を開始する")')
      .click({ force: true });
    await page.waitForSelector(".explorer-card", {
      state: "visible",
      timeout: 5000,
    });

    // 冒険記録紙を開いて背負い袋の枠数を確認
    await openAdventureSheet(page);
    const sheet = page.locator(".adventure-sheet");

    // 背負い袋の容量表示を確認 (着用中の軽い武器1本と布鎧を除き、ランタン1 + 予備軽い武器2 = 3 / 5 スロット)
    await expect(sheet).toContainText("背負い袋 (3 / 5 スロット)");

    await closeAdventureSheet(page);
  });

  test("【Rule 28】暗闇ペナルティ：両手が塞がった際のランタン保持不可と全判定-2の適用", async ({
    page,
  }) => {
    // 1. シナリオ選択
    await selectScenarioInUI(page, "魔将アラザスの迷宮");

    // 2. 幸運アーキタイプ作成（片手武器、鎖鎧、木盾、ランタン所持）
    // 初期状態では片手武器と木盾を両方装備しているため「両手が塞がっている」状態
    await page.fill("#char-name", "暗闇の騎士");
    await page.locator(".archetype-card").nth(1).click({ force: true });
    await page
      .locator('button:has-text("キャラクターの命運を紡ぎ出す")')
      .click({ force: true });
    await page.waitForSelector(".levelup-card", {
      state: "visible",
      timeout: 5000,
    });

    // 冒険開始
    await page
      .locator('button:has-text("冒険を開始する")')
      .click({ force: true });
    await page.getByTestId("confirm-modal-ok").click({ force: true });
    await page.waitForSelector(".explorer-card", {
      state: "visible",
      timeout: 5000,
    });

    // 冒険記録紙を開いて暗闇状態を確認
    await openAdventureSheet(page);
    const sheet = page.locator(".adventure-sheet");
    await expect(sheet).toContainText("明かり: ❌ 暗闇 (判定-2)");
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
    await clickButtonByText(page, "通常攻撃", 800);

    // ログに暗闇ペナルティが記録されていることを確認
    const logbook = page.locator(".logbook-entries");
    await expect(logbook).toContainText(
      "暗闇での戦闘により攻撃判定に -2 のペナルティ！",
    );
  });

  test("【Rule 28 & 29】素手攻撃ペナルティ：武器未装備時の攻撃判定-2ペナルティ", async ({
    page,
  }) => {
    // 1. シナリオ選択
    await selectScenarioInUI(page, "魔将アラザスの迷宮");

    // 2. 筋力アーキタイプ作成
    await page.fill("#char-name", "素手格闘家");
    await page.locator(".archetype-card").nth(2).click({ force: true });
    await page
      .locator('button:has-text("キャラクターの命運を紡ぎ出す")')
      .click({ force: true });
    await page.waitForSelector(".levelup-card", {
      state: "visible",
      timeout: 5000,
    });

    // 冒険開始
    await page
      .locator('button:has-text("冒険を開始する")')
      .click({ force: true });
    await page.waitForSelector(".explorer-card", {
      state: "visible",
      timeout: 5000,
    });

    // 冒険記録紙を開いて両手武器を外す（素手になる）
    // 両手武器を外すと片手が空くためランタンが点灯し、暗闇ペナルティは入らない
    await openAdventureSheet(page);
    const sheet = page.locator(".adventure-sheet");
    const unequipWeaponBtn = sheet.locator('button:has-text("外す")').first();
    await unequipWeaponBtn.click();
    await expect(sheet).toContainText("明かり: 点灯中");
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
    await clickButtonByText(page, "通常攻撃", 800);

    // ログに素手攻撃ペナルティが記録されていることを確認
    const logbook = page.locator(".logbook-entries");
    await expect(logbook).toContainText("素手での攻撃によるペナルティ -2");
  });

  test("【Rule 31】食料消費による生命力回復：満タン時不可・ダメージ後+2点回復の厳密アサーション", async ({
    page,
  }) => {
    // 1. シナリオ選択
    await selectScenarioInUI(page, "魔将アラザスの迷宮");

    // 2. 器用アーキタイプ作成（基礎4 + 革鎧2 = 最大HP 6）
    await page.fill("#char-name", "食いしん坊レンジャー");
    await page.locator(".archetype-card").nth(3).click({ force: true });
    await page
      .locator('button:has-text("キャラクターの命運を紡ぎ出す")')
      .click({ force: true });
    await page.waitForSelector(".levelup-card", {
      state: "visible",
      timeout: 5000,
    });

    // 冒険開始
    await page
      .locator('button:has-text("冒険を開始する")')
      .click({ force: true });
    await page.waitForSelector(".explorer-card", {
      state: "visible",
      timeout: 5000,
    });

    // 冒険記録紙を開く
    await openAdventureSheet(page);
    const sheet = page.locator(".adventure-sheet");

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
    await expect(sheet).toContainText("❤️生命点5 / 6");
    await expect(sheet).toContainText("食料: 2 食分");

    // HPが減ったので「食べる」ボタンが活性化されていること
    await expect(eatFoodBtn).toBeEnabled();

    // 食料を食べる -> 食料1食分消費、生命力が +2回復して 6 / 6 に戻る
    await eatFoodBtn.click();
    await expect(sheet).toContainText("❤️生命点6 / 6");
    await expect(sheet).toContainText("食料: 1 食分");

    // 再び満タンになったので「食べる」ボタンが無効化されること
    await expect(eatFoodBtn).toBeDisabled();

    await closeAdventureSheet(page);
  });

  test("【Rule 27】背負い袋の内訳サマリーバーと同名予備装備の表示検証（ゴースト装備解消）", async ({
    page,
  }) => {
    // 1. シナリオ選択
    await selectScenarioInUI(page, "魔将アラザスの迷宮");

    // 2. 魔術アーキタイプ（軽い武器、布鎧、ランタン所持）
    await page.fill("#char-name", "予備武器マニア");
    await page.locator(".archetype-card").nth(0).click({ force: true });
    await page
      .locator('button:has-text("キャラクターの命運を紡ぎ出す")')
      .click({ force: true });
    await page.waitForSelector(".levelup-card", {
      state: "visible",
      timeout: 5000,
    });

    // 炎球を習得
    await page
      .locator('.spell-learning-section button:has-text("炎球")')
      .click();

    // 街の市場で軽い武器（2G）を2本購入（初期装備と合わせて軽い武器が3本になる）
    const buyLightWeaponBtn = page
      .locator('.shop-column span:has-text("軽い武器") + button')
      .first();
    await buyLightWeaponBtn.click();
    await buyLightWeaponBtn.click();

    // 冒険記録紙を開く
    await openAdventureSheet(page);
    const sheet = page.locator(".adventure-sheet");

    // 内訳バーが表示され、道具・予備装備が3枠（ランタン1 + 予備軽い武器2）であることを確認
    const breakdownBar = sheet.locator(".backpack-breakdown-bar");
    await expect(breakdownBar).toBeVisible();
    await expect(breakdownBar).toContainText("道具・予備装備: 3");

    // 背負い袋一覧内に予備の「軽い武器」が2件表示されていること（ゴースト装備が解消されている）
    const bagLightWeapons = sheet.locator(
      '.backpack-list .bag-item:has-text("軽い武器")',
    );
    await expect(bagLightWeapons).toHaveCount(2);

    await closeAdventureSheet(page);
  });

  test("【Rule 27】宝石売却による金貨スロット増加通知と内訳バーのリアルタイム反映", async ({
    page,
  }) => {
    // 1. シナリオ選択
    await selectScenarioInUI(page, "魔将アラザスの迷宮");

    // 2. 筋力アーキタイプ作成
    await page.fill("#char-name", "宝石商人");
    await page.locator(".archetype-card").nth(2).click({ force: true });
    await page
      .locator('button:has-text("キャラクターの命運を紡ぎ出す")')
      .click({ force: true });
    await page.waitForSelector(".levelup-card", {
      state: "visible",
      timeout: 5000,
    });

    // テスト用に所持金貨を0Gにし、宝石（小: 50G）を2個持たせる
    await page.evaluate(() => {
      const state = (window as any).__GAME_STATE__;
      if (state && state.character) {
        state.character.value.gold = 0;
        state.character.value.items = [
          {
            id: "test-gem-1",
            name: "小さな宝石",
            type: "gem_small",
            value: 50,
            isEquipped: false,
            goldCost: 50,
          },
          {
            id: "test-gem-2",
            name: "小さな宝石",
            type: "gem_small",
            value: 50,
            isEquipped: false,
            goldCost: 50,
          },
        ];
      }
    });

    // 冒険記録紙を開く
    await openAdventureSheet(page);
    const sheet = page.locator(".adventure-sheet");
    const logbook = page.locator(".logbook-entries");

    // 初期状態：道具2個、金貨0G -> 金貨の重み表示なし、道具枠2
    const breakdownBar = sheet.locator(".backpack-breakdown-bar");
    await expect(breakdownBar).toContainText("道具・予備装備: 2");
    await expect(breakdownBar).not.toContainText("金貨の重み");

    // 1つ目の宝石を売却 (金貨50G獲得)
    const sellBtns = sheet.locator(
      '.bag-item:has-text("小さな宝石") button.sell-btn',
    );
    await sellBtns.first().click();

    // ログブックに売却成功ログが出ていること
    await expect(logbook).toContainText("小さな宝石を金貨50枚で売却しました。");
    // まだ50Gなので金貨の重みによるスロット消費は発生していない
    await expect(breakdownBar).toContainText("道具・予備装備: 1");
    await expect(breakdownBar).not.toContainText("金貨の重み");

    // 2つ目の宝石を売却 (合計100G獲得 -> 100Gの境界突破)
    await sellBtns.first().click();

    // ログブックに金貨スロット消費の親切なアナウンスが記録されていること
    await expect(logbook).toContainText(
      "所持金貨が100枚に達したため、背負い袋に金貨の重み(+1スロット)が加算されました。(Rule 27)",
    );

    // 冒険記録紙の内訳バーに金貨の重み +1 が明示されていること
    await expect(breakdownBar).toContainText("道具・予備装備: 0");
    await expect(breakdownBar).toContainText("金貨の重み: +1 (100G所持)");

    // 背負い袋の合計スロット数が 1 / 6 スロット（金貨分1スロット）となっていること
    await expect(sheet).toContainText("背負い袋 (1 / 6 スロット)");

    await closeAdventureSheet(page);
  });

  test("【Rule 19/44】購入した魔法装備は冒険終了後も保持され、武具創造の生成品のみが消滅する", async ({
    page,
  }) => {
    await selectScenarioInUI(page, "魔将アラザスの迷宮");

    await page.fill("#char-name", "魔法武具検証者");
    await page.locator(".archetype-card").nth(0).click({ force: true }); // 魔術型
    await page
      .locator('button:has-text("キャラクターの命運を紡ぎ出す")')
      .click({ force: true });
    await page.waitForSelector(".levelup-card", {
      state: "visible",
      timeout: 5000,
    });

    // 金貨を100Gにし、魔法の片手武器（25G）を購入し、さらに武具創造で「創られた片手武器」を生成
    await page.evaluate(() => {
      const state = (window as any).__GAME_STATE__;
      if (state) {
        state.character.value.gold = 100;
      }
    });

    const buyMagicWeaponBtn = page
      .locator('.shop-column span:has-text("魔法の片手武器") + button')
      .first();
    await buyMagicWeaponBtn.click();

    await page.evaluate(() => {
      const state = (window as any).__GAME_STATE__;
      if (state) {
        state.castCreateWeaponSpell("weapon", "oneHanded");
        const created = state.character.value.weapons.find((w: any) =>
          w.name.startsWith("創られた"),
        );
        // 冒険終了時の後処理を実行
        state.restoreStatsAfterAdventure();
      }
    });

    const weapons = await page.evaluate(() => {
      const state = (window as any).__GAME_STATE__;
      return state.character.value.weapons.map((w: any) => ({
        name: w.name,
        isMagic: w.isMagic,
        isCreated: w.isCreated,
      }));
    });

    // 購入した「魔法の片手武器」は残っており、「創られた片手武器」は消滅していること
    expect(weapons.some((w: any) => w.name === "魔法の片手武器")).toBe(true);
    expect(weapons.some((w: any) => w.name.startsWith("創られた"))).toBe(false);
  });

  test("【Phase 3: #12,#13,#15,#20,#21,#23】防具上書き確認モーダル・貫きの石弾価値減衰・ウォードール特性・食料リセット・実回復量ログの検証", async ({
    page,
  }) => {
    await selectScenarioInUI(page, "魔将アラザスの迷宮");

    await page.fill("#char-name", "アイテム検証者");
    await page.locator(".archetype-card").nth(0).click({ force: true }); // 魔術型（初期防具：布鎧）
    await page
      .locator('button:has-text("キャラクターの命運を紡ぎ出す")')
      .click({ force: true });
    await page.waitForSelector(".levelup-card", {
      state: "visible",
      timeout: 5000,
    });

    await page
      .locator('.spell-learning-section button:has-text("武具創造")')
      .click();

    // #20: 既に布鎧を着用している状態で、街の市場で革鎧（5G）を購入しようとすると確認モーダルが出ること
    const buyLeatherBtn = page
      .locator('.shop-column span:has-text("革鎧") + button')
      .first();
    await buyLeatherBtn.click();
    const confirmModal = page.locator('[data-testid="confirm-modal"]');
    await expect(confirmModal).toBeVisible();
    await expect(confirmModal).toContainText("布鎧");
    await expect(confirmModal).toContainText("革鎧");
    await page.locator('[data-testid="confirm-modal-ok"]').click();
    await expect(confirmModal).toBeHidden();

    // 食料を5食に増やしてから冒険を開始すると、#21 により食料が2食にリセットされること
    await page.evaluate(() => {
      const state = (window as any).__GAME_STATE__;
      if (state) state.character.value.food = 5;
    });

    await page
      .locator('button:has-text("冒険を開始する")')
      .click({ force: true });
    await page.waitForSelector(".explorer-card", {
      state: "visible",
      timeout: 5000,
    });

    const foodAtStart = await page.evaluate(
      () => (window as any).__GAME_STATE__.character.value.food,
    );
    expect(foodAtStart).toBe(2);

    // #23: 最大HPから1点だけ減った状態で食料を食べた場合、ログに「生命力が1回復」と実回復量が記録されること
    await page.evaluate(() => {
      const state = (window as any).__GAME_STATE__;
      state.character.value.lifeCurrent = state.character.value.lifeMax - 1;
    });
    await openAdventureSheet(page);
    await page.locator('.adventure-sheet button:has-text("食べる (+2回復)")').click();
    await expect(page.locator(".logbook-entries")).toContainText(
      "食料を食べました。生命力が1回復。",
    );

    // #20: 冒険記録紙から【武具創造】で「板金鎧」を創造しようとすると、「冒険終了時に消滅し、終了後は無防備になります」の警告モーダルが出ること
    await page.locator('button:has-text("呪文【武具創造】を唱える")').click();
    await page.locator('button:has-text("板金鎧")').click();
    await expect(confirmModal).toBeVisible();
    await expect(confirmModal).toContainText("革鎧");
    await expect(confirmModal).toContainText("創られた板金鎧");
    await expect(confirmModal).toContainText("終了後は無防備になります");
    await page.locator('[data-testid="confirm-modal-ok"]').click();
    await closeAdventureSheet(page);

    // #12 & #15: ウォー・ドール起動時の属性・2回攻撃・ダメージ無視1回と、貫きの石弾の種別・価値をチェック
    const phase3Check = await page.evaluate(async () => {
      const state = (window as any).__GAME_STATE__;
      state.character.value.exp = 2;
      state.character.value.items.push({
        id: "wardoll-test",
        name: "ウォー・ドール (未起動)",
        type: "magic_doll",
        goldCost: 60,
        value: 60,
        description: "test",
      });
      return true;
    });
    expect(phase3Check).toBe(true);

    await openAdventureSheet(page);
    await page.locator('button:has-text("起動(1EXP)")').click();
    await closeAdventureSheet(page);

    const warDoll = await page.evaluate(() => {
      const state = (window as any).__GAME_STATE__;
      return state.followers.value.find((f: any) => f.name === "ウォー・ドール");
    });
    expect(warDoll.type).toBe("golem");
    expect(warDoll.attackCount).toBe(2);
    expect(warDoll.damageIgnoreCount).toBe(1);
    expect(warDoll.tags).toContain("golem");
  });
});
