import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { 
  disableAnimations, 
  setupMockRandom,
  selectScenarioInUI, 
  clickButtonByText,
  rollD66AndSkipPerception
} from '../helpers/test-utils';

test.describe('1st公式シナリオ『黄昏の騎士』JSONデータ & シナリオエディタ完全整合性検証', () => {

  const twilightKnightJsonPath = path.resolve(process.cwd(), 'scenarios/twilight_knight.json');
  const rawTwilightJson = fs.readFileSync(twilightKnightJsonPath, 'utf-8');
  const twilightScenario = JSON.parse(rawTwilightJson);

  test.beforeEach(async ({ page }) => {
    page.on('dialog', dialog => dialog.accept());
    await page.addInitScript(() => localStorage.clear());
  });

  test('【JSON整合性】全36部屋・Room4中間イベント・3段階ボスフェーズ・トラップ宝箱・NPC標準オントロジーの検証', async () => {
    // 1. トップレベル属性
    expect(twilightScenario.id).toBe('twilight_knight');
    expect(twilightScenario.title).toContain('黄昏の騎士');
    expect(twilightScenario.totalRoomsToClear).toBe(8);
    expect(twilightScenario.explorationMode).toBe('linear');
    expect(twilightScenario.recommendedLevel).toContain('10-11');

    // 2. d66イベント表が36部屋完全に定義されているか
    const codes = Object.keys(twilightScenario.d66EventTable);
    expect(codes.length).toBe(36);

    // 11〜16: 隠された何か (search, stat: dexterity, target: 4)
    for (const code of ['11', '12', '13', '14', '15', '16']) {
      const room = twilightScenario.d66EventTable[code];
      expect(room.type).toBe('search');
      expect(room.searchStat).toBe('dexterity');
      expect(room.searchTarget).toBe(4);
      expect(room.searchRewardItem).toBeTruthy();
    }

    // 21〜26: NPC（標準オントロジーへの適合）
    expect(twilightScenario.d66EventTable['21'].npcType).toBe('neutral');
    expect(twilightScenario.d66EventTable['21'].reactionType).toBe('friendly');
    expect(twilightScenario.d66EventTable['22'].npcType).toBe('neutral');
    expect(twilightScenario.d66EventTable['23'].npcType).toBe('mercenary'); // 冒険者の一団
    expect(twilightScenario.d66EventTable['24'].npcType).toBe('merchant');  // 沼エルフの行商人
    expect(twilightScenario.d66EventTable['25'].npcType).toBe('neutral');
    expect(twilightScenario.d66EventTable['26'].npcType).toBe('neutral');

    // 31〜36: イベント
    // 出目31: トラップの仕掛けられた宝箱（trapかつlootModifier: 1）
    const room31 = twilightScenario.d66EventTable['31'];
    expect(room31.type).toBe('trap');
    expect(room31.trapStat).toBe('dexterity');
    expect(room31.trapTarget).toBe(4);
    expect(room31.trapDamage).toBe(1);
    expect(room31.lootModifier).toBe(1);

    expect(twilightScenario.d66EventTable['32'].type).toBe('npc'); // 放浪の狩猟者
    expect(twilightScenario.d66EventTable['32'].npcType).toBe('quest');
    expect(twilightScenario.d66EventTable['33'].type).toBe('search'); // 簡素な祭壇
    expect(twilightScenario.d66EventTable['34'].type).toBe('rest'); // 迷宮の野営地
    expect(twilightScenario.d66EventTable['35'].type).toBe('treasure'); // イケてる彫像

    // 41〜46: トラップ
    for (const code of ['41', '42', '43', '44', '45', '46']) {
      const room = twilightScenario.d66EventTable[code];
      expect(room.type).toBe('trap');
      expect(room.trapDamage).toBeGreaterThanOrEqual(1);
    }

    // 51〜56: 弱いクリーチャー
    for (const code of ['51', '52', '53', '54', '55', '56']) {
      const room = twilightScenario.d66EventTable[code];
      expect(room.type).toBe('encounter');
      expect(room.enemies[0].tags).toContain('weak');
    }
    // ゴブリンの突撃兵の自爆
    expect(twilightScenario.d66EventTable['51'].enemies[0].selfDestructDamage).toBe(2);

    // 61〜66: 強いクリーチャー
    for (const code of ['61', '62', '63', '64', '65', '66']) {
      const room = twilightScenario.d66EventTable[code];
      expect(room.type).toBe('encounter');
      expect(room.enemies[0].tags).toContain('strong');
    }

    // 3. 中間イベント
    expect(twilightScenario.midpointEvent).toBeDefined();
    expect(twilightScenario.midpointEvent.roomNumber).toBe(4);
    expect(twilightScenario.midpointEvent.event.title).toContain('真夜中の盗賊');
    expect(twilightScenario.midpointEvent.event.enemies[0].count).toBe(3);

    // 4. 決戦ボスフェーズ (3段階)
    expect(twilightScenario.bossPhases).toHaveLength(3);
    expect(twilightScenario.bossPhases[0].bossEvent.enemies[0].name).toContain('黄昏の騎士');
    expect(twilightScenario.bossPhases[1].bossEvent.enemies[0].name).toContain('不死者');
    expect(twilightScenario.bossPhases[2].bossEvent.enemies[0].name).toContain('セグラス');

    // 5. 完全クリアメッセージ (少女のエピローグ)
    expect(twilightScenario.completeClearMessage).toContain('野の花');
    expect(twilightScenario.completeClearMessage).toContain('三度クリア');
  });

  test('【エディタ完全整合性】ScenarioEditorで黄昏の騎士を開き、シナリオID・トラップ宝箱・NPC種別/反応が完全にUIへバインドされること', async ({ page }) => {
    // localStorageに直接投入し、シナリオ選択画面での認識をテスト
    await page.addInitScript((scenario) => {
      localStorage.setItem('roguelike_half_custom_scenarios', JSON.stringify([scenario]));
    }, twilightScenario);

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await disableAnimations(page);

    // 黄昏の騎士シナリオが表示されていることを確認
    const scenarioCard = page.locator('.custom-card', { hasText: '黄昏の騎士' });
    await expect(scenarioCard).toBeVisible({ timeout: 5000 });
    await expect(scenarioCard).toContainText('全 3 周');

    // 編集ボタンをクリックしてシナリオエディタを起動
    const editBtn = scenarioCard.locator('button.btn-action-tool', { hasText: '編集' });
    await editBtn.click();

    // シナリオエディタが表示されること
    await expect(page.locator('.editor-window')).toBeVisible({ timeout: 5000 });

    // 基本設定タブ (TAB 1): シナリオID入力欄に 'twilight_knight' が保持されていること
    const idInput = page.locator('.editor-window input[placeholder*="custom_"]');
    await expect(idInput).toHaveValue('twilight_knight');

    // タイトルと部屋数
    const titleInput = page.locator('.editor-window input[type="text"]').first();
    await expect(titleInput).toHaveValue('「ローグライクハーフ」1stシナリオ『黄昏の騎士』');
    const roomsInput = page.locator('.editor-window input[type="number"]').first();
    await expect(roomsInput).toHaveValue('8');

    // ボス戦タブ (TAB 2): 段階的ボス
    await clickButtonByText(page, '2. 決戦ボス設定');
    const multiPhaseCheckbox = page.locator('.editor-window input[type="checkbox"]').first();
    await expect(multiPhaseCheckbox).toBeChecked();
    const phaseBtns = page.locator('.phase-tabs-row button:has-text("周目")');
    await expect(phaseBtns).toHaveCount(3);

    // d66イベント表タブ (TAB 3): 部屋設定
    await clickButtonByText(page, '3. d66イベント表');
    const d66GridCells = page.locator('.grid-cell');
    await expect(d66GridCells).toHaveCount(36);

    // 出目21（里人: NPC neutral, reactionType friendly）の確認
    const cell21 = page.locator('.grid-cell:has-text("21")');
    await cell21.click();
    // 0: room.type ('npc'), 1: room.npcType ('neutral'), 2: room.reactionType ('friendly')
    await expect(page.locator('.room-editor-pane select').nth(1)).toHaveValue('neutral');
    await expect(page.locator('.room-editor-pane select').nth(2)).toHaveValue('friendly');

    // 出目24（行商人: NPC merchant）の確認
    const cell24 = page.locator('.grid-cell:has-text("24")');
    await cell24.click();
    await expect(page.locator('.room-editor-pane select').nth(1)).toHaveValue('merchant');

    // 出目31（トラップ宝箱: trapかつlootModifier: 1）の確認
    const cell31 = page.locator('.grid-cell:has-text("31")');
    await cell31.click();
    const trapChestCheckbox = page.locator('.room-editor-pane input[type="checkbox"]');
    await expect(trapChestCheckbox).toBeChecked();
    const lootModInput = page.locator('.room-editor-pane input[type="number"]').last();
    await expect(lootModInput).toHaveValue('1');

    // エディタを閉じる
    await clickButtonByText(page, 'キャンセル');
    await expect(page.locator('.editor-window')).toBeHidden();
  });

  test('【実機プレイ検証】出目31のトラップ宝箱遭遇時に「立ち去る」「失敗時の再挑戦」「成功時の宝物獲得」が動作すること', async ({ page }) => {
    // 出目31のトラップ宝箱のみをテストするシナリオ
    const trapChestScenario = {
      ...twilightScenario,
      id: 'custom_trap_chest_test',
      totalRoomsToClear: 3
    };

    await page.addInitScript((sc) => {
      localStorage.setItem('roguelike_half_custom_scenarios', JSON.stringify([sc]));
    }, trapChestScenario);

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await disableAnimations(page);

    // シナリオ選択
    await selectScenarioInUI(page, '黄昏の騎士');

    // キャラクター作成（器用アーキタイプ、器用点3, 生命力10）
    await page.fill('#char-name', '宝箱破り');
    await page.locator('.archetype-card').nth(3).click({ force: true });
    await page.locator('button:has-text("キャラクターの命運を紡ぎ出す")').click({ force: true });
    await page.waitForSelector('.levelup-card', { state: 'visible', timeout: 5000 });
    await page.locator('button:has-text("冒険を開始する")').click({ force: true });
    await page.waitForSelector('.explorer-card', { state: 'visible', timeout: 5000 });

    // 判定ロールをモック（部屋31、1回目出目1失敗、2回目出目6クリティカル成功、宝物表ロール出目4）
    await setupMockRandom(page, 31, [1, 6, 4]);

    // 部屋31（トラップ宝箱）に進む
    await rollD66AndSkipPerception(page);
    await page.waitForTimeout(500);

    // 部屋タイトル・説明文の確認
    const eventTitle = page.locator('.event-title');
    await expect(eventTitle).toContainText('トラップの仕掛けられた宝箱');

    // 「🏃 宝箱を開けずに立ち去る」ボタンが存在すること
    const passBtn = page.locator('button:has-text("宝箱を開けずに立ち去る")');
    await expect(passBtn).toBeVisible();

    // 罠判定ボタンをクリック（副能力値【器用点】で挑戦）
    const challengeBtn = page.locator('button:has-text("副能力値【器用点】で挑戦")');
    await challengeBtn.click();

    // 1回目判定失敗（出目1） -> 生命力が9に減り、「🔄 もう一度開錠を試みる (再挑戦)」と「🏃 諦めて先へ進む (立ち去る)」が表示されること
    const retryBtn = page.locator('button:has-text("もう一度開錠を試みる")');
    const giveUpBtn = page.locator('button:has-text("諦めて先へ進む")');
    await expect(retryBtn).toBeVisible({ timeout: 5000 });
    await expect(giveUpBtn).toBeVisible({ timeout: 5000 });

    // 「もう一度開錠を試みる」をクリック（再挑戦）
    await retryBtn.click();

    // 2回目判定成功（出目6） -> 「💎 宝箱を開けて宝物を入手する」が表示されること
    const openChestBtn = page.locator('button:has-text("宝箱を開けて宝物を入手する")');
    await expect(openChestBtn).toBeVisible({ timeout: 5000 });

    // 宝物を開ける
    await openChestBtn.click();

    // 宝物表がロールされ、部屋が解決済みになり「次の小部屋へ進む」ボタンが表示されること
    await expect(page.locator('button:has-text("次の小部屋へ進む")')).toBeVisible({ timeout: 5000 });
  });

  test('【Round-trip可逆性】ScenarioEditorで黄昏の騎士をロードして保存した際、シナリオID・出目31のlootModifier・敵IDが欠落せず保持されること', async ({ page }) => {
    // localStorageに投入
    await page.addInitScript((scenario) => {
      localStorage.setItem('roguelike_half_custom_scenarios', JSON.stringify([scenario]));
    }, twilightScenario);

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await disableAnimations(page);

    // 編集モーダルを開く
    const scenarioCard = page.locator('.custom-card', { hasText: '黄昏の騎士' });
    await scenarioCard.locator('button.btn-action-tool', { hasText: '編集' }).click();
    await expect(page.locator('.editor-window')).toBeVisible({ timeout: 5000 });

    // そのまま「✓ 保存して閉じる」をクリック
    await clickButtonByText(page, '保存して閉じる');
    await expect(page.locator('.editor-window')).toBeHidden({ timeout: 5000 });

    // localStorage内の保存データを検証
    const savedScenarios = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('roguelike_half_custom_scenarios') || '[]');
    });

    expect(savedScenarios.length).toBe(1);
    const saved = savedScenarios[0];

    // 1. シナリオIDが 'twilight_knight' のまま維持されていること (custom_ 接頭辞の強制なし)
    expect(saved.id).toBe('twilight_knight');

    // 2. 出目31のトラップ宝箱属性 (trapかつlootModifier: 1) が維持されていること
    expect(saved.d66EventTable['31'].type).toBe('trap');
    expect(saved.d66EventTable['31'].lootModifier).toBe(1);

    // 3. 出目21（里人）のNPC属性 (neutral, friendly) が維持されていること
    expect(saved.d66EventTable['21'].npcType).toBe('neutral');
    expect(saved.d66EventTable['21'].reactionType).toBe('friendly');

    // 4. 出目51（ゴブリン突撃兵）の自爆ダメージが維持されていること
    expect(saved.d66EventTable['51'].enemies[0].selfDestructDamage).toBe(2);

    // 5. 決戦ボスのフェーズ数と完全クリアメッセージが維持されていること
    expect(saved.bossPhases).toHaveLength(3);
    expect(saved.completeClearMessage).toContain('三度クリア');
  });
});
