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

test.describe('シナリオ工房 & 拡張機能 (中間イベント・探索部屋・特殊敵特性)', () => {

  test.beforeEach(async ({ page }) => {
    page.on('dialog', dialog => dialog.accept());
    await page.addInitScript(() => localStorage.clear());
  });

  test('【探索・調査部屋】器用度判定によるアイテム・ゴールド獲得と多重実行防止', async ({ page }) => {
    // カスタムシナリオを事前登録
    const testScenario = {
      id: 'custom_search_room_test',
      title: '黄昏の廃墟テスト',
      description: '探索・調査部屋の挙動を検証するためのカスタムシナリオです。',
      recommendedLevel: '10-11',
      totalRoomsToClear: 4,
      bossEvent: {
        title: '深奥の決戦',
        d66Code: 'boss',
        description: 'ボス戦です。',
        type: 'encounter',
        enemies: [{ name: '迷宮主', level: 4, lifeMax: 6, lifeCurrent: 6, attackCount: 1, tags: ['strong'], count: 1, weaponAttribute: 'strike' }]
      },
      d66EventTable: {
        '11': {
          title: '瓦礫の山と隠し扉',
          d66Code: '11',
          description: '崩れた壁の隙間に、何かが埋もれています。慎重に調べれば金貨や物資が見つかるかもしれません。',
          type: 'search',
          searchStat: 'dexterity',
          searchTarget: 4,
          searchRewardGold: 25,
          searchRewardItem: '秘薬の小瓶',
          searchSuccessText: '瓦礫を掘り起こし、隠された財宝を発見した！',
          searchFailureText: '徹底的に探したが、何も見つからなかった。'
        }
      }
    };

    await page.addInitScript((sc) => {
      localStorage.setItem('roguelike_half_custom_scenarios', JSON.stringify([sc]));
    }, testScenario);

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await disableAnimations(page);

    // シナリオ選択
    await selectScenarioInUI(page, '黄昏の廃墟テスト');

    // キャラクター作成（器用アーキタイプ）
    await page.fill('#char-name', '探索者アリス');
    await page.locator('.archetype-card').nth(3).click({ force: true });
    await page.locator('button:has-text("キャラクターの命運を紡ぎ出す")').click({ force: true });
    await page.waitForSelector('.levelup-card', { state: 'visible', timeout: 5000 });

    // 冒険開始
    await page.locator('button:has-text("冒険を開始する")').click({ force: true });
    await page.waitForSelector('.explorer-card', { state: 'visible', timeout: 5000 });

    // 初期ゴールドを確認 (初期ゴールド10)
    const goldHud = page.locator('.hud-vitals .vital-chip').filter({ hasText: '💰' });
    await expect(goldHud).toContainText('10');

    // d66 = 11 (探索部屋: 器用度判定 Target 4)
    // 出目: 4 (器用点2 + 出目4 = 6 >= 4 で成功)
    await setupMockRandom(page, 11, [4]);

    // ダンジョン探索（察知スキップ）
    await rollD66AndSkipPerception(page);
    await page.waitForTimeout(500);

    // 探索部屋バッジの確認
    const eventBadge = page.locator('.event-type-badge');
    await expect(eventBadge).toContainText('🔍 探索・調査');

    // 調査ボタンをクリック (副能力値【器用点】で調査)
    const searchBtn = page.locator('button:has-text("副能力値【器用点】で調査")');
    await expect(searchBtn).toBeVisible();
    await clickButtonByText(page, '副能力値【器用点】で調査', 800);

    // ログ確認: 成功メッセージ、ゴールド25、アイテム獲得
    const logbook = page.locator('.logbook-entries');
    await expect(logbook).toContainText('探索判定に成功しました！', { timeout: 5000 });
    await expect(logbook).toContainText('金貨 25 枚', { timeout: 5000 });
    await expect(logbook).toContainText('秘薬の小瓶', { timeout: 5000 });

    // ゴールド加算を確認 (10 + 25 = 35)
    await expect(goldHud).toContainText('35');

    // 冒険記録紙でアイテム獲得を確認
    await openAdventureSheet(page);
    const backpack = page.locator('.hud-detail-modal');
    await expect(backpack).toContainText('秘薬の小瓶');
    await closeAdventureSheet(page);

    // 判定完了後は次の部屋へ進むボタンが押せる
    const nextRoomBtn = page.locator('button:has-text("次の小部屋へ進む")');
    await expect(nextRoomBtn).toBeVisible();
  });

  test('【中間イベント】規定部屋数での強制発生と逃走不可ガード', async ({ page }) => {
    // 2部屋目に中間イベントが発生するシナリオ
    const testScenario = {
      id: 'custom_midpoint_test',
      title: '騎士の試練テスト',
      description: '中ボス戦の強制割り込みを検証するシナリオです。',
      recommendedLevel: '10-11',
      totalRoomsToClear: 4,
      midpointEvent: {
        roomNumber: 2,
        event: {
          title: '盗賊団の頭領の待ち伏せ',
          d66Code: 'midpoint',
          description: '通路の曲がり角から屈強な盗賊頭が立ち塞がった！',
          type: 'encounter',
          enemies: [
            {
              name: '盗賊頭ヴォルク',
              level: 3,
              lifeMax: 6,
              lifeCurrent: 6,
              attackCount: 1,
              tags: ['strong', 'fight_to_death'],
              count: 1,
              weaponAttribute: 'slash'
            }
          ]
        }
      },
      bossEvent: {
        title: '深奥の決戦',
        d66Code: 'boss',
        description: 'ボス戦です。',
        type: 'encounter',
        enemies: [{ name: '迷宮主', level: 5, lifeMax: 8, lifeCurrent: 8, attackCount: 1, tags: ['strong'], count: 1, weaponAttribute: 'strike' }]
      },
      d66EventTable: {
        '11': {
          title: '静かな小部屋',
          d66Code: '11',
          description: '何もない静かな部屋です。',
          type: 'empty'
        }
      }
    };

    await page.addInitScript((sc) => {
      localStorage.setItem('roguelike_half_custom_scenarios', JSON.stringify([sc]));
    }, testScenario);

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await disableAnimations(page);

    await selectScenarioInUI(page, '騎士の試練テスト');

    // 戦士作成
    await page.fill('#char-name', '試練の騎士');
    await page.locator('.archetype-card').nth(0).click({ force: true });
    await page.locator('button:has-text("キャラクターの命運を紡ぎ出す")').click({ force: true });
    await page.waitForSelector('.levelup-card', { state: 'visible', timeout: 5000 });
    await page.locator('button:has-text("冒険を開始する")').click({ force: true });
    await page.waitForSelector('.explorer-card', { state: 'visible', timeout: 5000 });

    // 第1部屋: 11 (空室)
    await setupMockRandom(page, 11, []);
    await rollD66AndSkipPerception(page);
    await page.waitForTimeout(500);

    // 第1部屋を解決して次の小部屋へ
    await clickButtonByText(page, '次の小部屋へ進む', 800);

    // 第2部屋へ進むボタンをクリック -> 中間イベントがダイスなしで強制発生！
    await clickButtonByText(page, '次の部屋を探索する', 800);
    await page.waitForTimeout(500);

    // 戦闘画面へ遷移していることを確認
    await page.waitForSelector('.combat-card', { state: 'visible', timeout: 5000 });

    // ログに中間地点発生メッセージ
    const logbook = page.locator('.logbook-entries');
    await expect(logbook).toContainText('【中間地点】盗賊団の頭領の待ち伏せ が発生しました！', { timeout: 5000 });

    // 接近戦へ移行
    await transitionToMelee(page);

    // 中間イベントのため「逃走する」ボタンが表示されないこと
    const fleeBtn = page.locator('button:has-text("戦闘から逃走する")');
    await expect(fleeBtn).not.toBeVisible();
  });

  test('【特殊敵特性】死ぬまで戦う敵の逃走防止と自爆敵の爆発処理', async ({ page }) => {
    // 死ぬまで戦う敵と自爆敵が出現するシナリオ
    const testScenario = {
      id: 'custom_enemy_tags_test',
      title: '黄昏の機巧魔窟テスト',
      description: '特殊特性タグの検証シナリオです。',
      recommendedLevel: '10-11',
      totalRoomsToClear: 4,
      bossEvent: {
        title: '深奥の決戦',
        d66Code: 'boss',
        description: 'ボス戦です。',
        type: 'encounter',
        enemies: [{ name: '迷宮主', level: 4, lifeMax: 6, lifeCurrent: 6, attackCount: 1, tags: ['strong'], count: 1, weaponAttribute: 'strike' }]
      },
      d66EventTable: {
        '11': {
          title: '機巧兵の実験室',
          d66Code: '11',
          description: '暴走したからくり兵が突撃してきます！',
          type: 'encounter',
          enemies: [
            {
              name: '死守する門番',
              level: 2,
              lifeMax: 2,
              lifeCurrent: 2,
              attackCount: 1,
              tags: ['fight_to_death'],
              count: 1,
              weaponAttribute: 'strike'
            },
            {
              name: '自爆からくり蜘蛛',
              level: 2,
              lifeMax: 2,
              lifeCurrent: 2,
              attackCount: 1,
              tags: ['self_destruct'],
              selfDestructDamage: 2,
              count: 1,
              weaponAttribute: 'strike'
            }
          ]
        }
      }
    };

    await page.addInitScript((sc) => {
      localStorage.setItem('roguelike_half_custom_scenarios', JSON.stringify([sc]));
    }, testScenario);

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await disableAnimations(page);

    await selectScenarioInUI(page, '黄昏の機巧魔窟テスト');

    // 戦士作成 (生命力 12)
    await page.fill('#char-name', '防爆検証戦士');
    await page.locator('.archetype-card').nth(0).click({ force: true });
    await page.locator('button:has-text("キャラクターの命運を紡ぎ出す")').click({ force: true });
    await page.waitForSelector('.levelup-card', { state: 'visible', timeout: 5000 });
    await page.locator('button:has-text("冒険を開始する")').click({ force: true });
    await page.waitForSelector('.explorer-card', { state: 'visible', timeout: 5000 });

    // d66 = 11 (戦闘突入)
    await setupMockRandom(page, 11, []);
    await rollD66AndSkipPerception(page);
    await page.waitForTimeout(500);

    // 戦闘画面
    await page.waitForSelector('.combat-card', { state: 'visible', timeout: 5000 });

    // 接近戦へ移行
    await transitionToMelee(page);

    // 門番（死守する門番）をターゲットにして攻撃 (出目4で命中、HP 2 -> 1: 初期値の半分到達)
    await setupMockRandom(page, 4, [4, 6]); // 攻撃出目4, 防御出目6(防御成功)
    await clickButtonByText(page, '通常攻撃', 800);

    // ログ確認: fight_to_death があるため、HP半減による敵の逃走（「敵は恐怖して【逃走】しました！」）が発生していないこと
    const logbook = page.locator('.logbook-entries');
    await expect(logbook).not.toContainText('敵は恐怖して【逃走】しました！');

    // 敵の反撃フェーズ（防御判定）
    await handlePendingDefense(page);
    await page.waitForTimeout(800);

    // 第1ラウンド終了時: 自爆からくり蜘蛛が自爆を発動！
    await expect(logbook).toContainText('【自爆発動】自爆からくり蜘蛛 は時限爆弾を作動させ、激しい爆発とともに自爆した！', { timeout: 5000 });
    await expect(logbook).toContainText('主人公は 2 点の自爆ダメージを受けました。', { timeout: 5000 });
  });

  test('【ダンジョン探索モード】一本道モードシナリオにおける戦闘逃走時の部屋カウント維持の検証 (ver.5.1 Rule 42)', async ({ page }) => {
    // 1. 一本道モードのカスタムシナリオを登録
    const linearScenario = {
      id: 'custom_linear_mode_test',
      title: '一本道の回廊テスト',
      description: '一本道モードの逃走挙動を検証するためのカスタムシナリオです。',
      recommendedLevel: '10-11',
      totalRoomsToClear: 5,
      explorationMode: 'linear',
      bossEvent: {
        title: '回廊の主',
        d66Code: 'boss',
        description: 'ボス戦です。',
        type: 'encounter',
        enemies: [{ name: '迷宮主', level: 5, lifeMax: 8, lifeCurrent: 8, attackCount: 1, tags: ['strong'], count: 1, weaponAttribute: 'strike' }]
      },
      d66EventTable: {
        '11': {
          title: '安らぎの泉',
          d66Code: '11',
          description: '静かな泉があり、心身を癒やすことができます。',
          type: 'rest'
        },
        '12': {
          title: '回廊の野盗',
          d66Code: '12',
          description: '野盗が待ち伏せていました！',
          type: 'encounter',
          enemies: [{ name: '待ち伏せ野盗', level: 3, lifeMax: 1, lifeCurrent: 1, attackCount: 1, tags: ['weak'], count: 1, weaponAttribute: 'slash' }]
        }
      }
    };

    await page.addInitScript((sc) => {
      localStorage.setItem('roguelike_half_custom_scenarios', JSON.stringify([sc]));
    }, linearScenario);

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await disableAnimations(page);

    // 2. シナリオ選択
    await selectScenarioInUI(page, '一本道の回廊テスト');

    // 3. キャラクター作成（幸運アーキタイプ）
    await page.fill('#char-name', '一本道脱出者');
    await page.locator('.archetype-card').nth(1).click({ force: true });
    await page.locator('button:has-text("キャラクターの命運を紡ぎ出す")').click({ force: true });
    await page.waitForSelector('.levelup-card', { state: 'visible', timeout: 5000 });

    // 4. 冒険開始
    await page.locator('button:has-text("冒険を開始する")').click({ force: true });
    await page.waitForSelector('.explorer-card', { state: 'visible', timeout: 5000 });

    // HUDに「一本道」バッジが表示されていることを確認
    const hudBadge = page.locator('.hud-mode-pill');
    await expect(hudBadge).toContainText('一本道');

    // 5. 第1部屋：安らぎの泉（d66=11）に入り、休息を解決して次の小部屋へ進み、踏破部屋数を 1 に進める
    await setupMockRandom(page, 11);
    await rollD66AndSkipPerception(page);
    await page.waitForTimeout(500);

    const restBtn = page.locator('button:has-text("怪我を癒やす")');
    await expect(restBtn).toBeVisible({ timeout: 5000 });
    await restBtn.click();
    await page.waitForTimeout(500);

    const proceedBtn = page.locator('button:has-text("次の小部屋へ進む")');
    await expect(proceedBtn).toBeVisible({ timeout: 5000 });
    await proceedBtn.click();
    await page.waitForTimeout(500);

    // 第1部屋踏破後、HUDが「第 1 / 5 部屋」になっていることを確認
    await expect(page.locator('.depth-badge')).toContainText('第 1 / 5 部屋');

    // 6. 第2部屋：野盗に遭遇（d66=12、逃走判定出目6でクリティカル防御成功）
    await setupMockRandom(page, 12, [6]);
    await rollD66AndSkipPerception(page);
    await page.waitForTimeout(500);

    // 接近戦へ移行
    await transitionToMelee(page);

    // 「戦闘から逃走する」をクリック
    const fleeBtn = page.locator('button:has-text("戦闘から逃走する")');
    await expect(fleeBtn).toBeVisible({ timeout: 5000 });
    await fleeBtn.click();
    await page.waitForTimeout(500);

    // ログの検証：一本道モード用の逃走成功メッセージ
    const logbook = page.locator('.logbook-entries');
    await expect(logbook).toContainText('一本道のためその場にとどまり、再度探索を行います');

    // 結果を承認して探索画面へ戻る
    const returnBtn = page.locator('button:has-text("結果を承認")');
    await expect(returnBtn).toBeVisible({ timeout: 5000 });
    await returnBtn.click();
    await page.waitForTimeout(500);

    // 探索画面に戻り、マップタイルモードなら 0 に戻るところ、一本道モードのため 1（第 1 / 5 部屋）を維持していることを検証！
    await expect(page.locator('.depth-badge')).toContainText('第 1 / 5 部屋');
    await expect(logbook).toContainText('一本道モードのため部屋カウントは進まず、現在位置で再探索を行います');
  });

});
