import { test, expect, type Locator } from '@playwright/test';
// 【TypeScript】 `@playwright/test` モジュールからテスト用のヘルパーをインポートしています。
// - `type Locator` のように `type` 修飾子を用いることで、コンパイル時に型情報のみをインポートし、JavaScriptへの出力時には不要なインポートコードを削除できます。
// 【Playwright】
// - `test`: テストケースを定義するためのメイン関数です。
// - `expect`: アサーション（テストの実行結果が期待通りか検証する）を行うための関数です。
// - `Locator`: ページ上の要素（ボタン、入力欄など）を指し示し、操作するための型定義です。

/**
 * 対象の要素を安全にクリックするための非同期ヘルパー関数です。
 * 
 * 【TypeScript】
 * - `async` を付与した関数は自動的に `Promise` を返します。ここでは `Promise<boolean>` 型を明示しています。
 * - `locator: Locator` や `description: string` で引数の型を制限し、`postWaitMs = 1500` でデフォルト引数（数値型）を設定しています。
 * - `catch (e: any)` は、例外の型が不確定であるため、一時的に `any` 型としてキャッチしています。
 * 
 * 【Playwright / テスト設計】
 * - ダイスアニメーションや画面の再レンダリングによって、クリックした瞬間に要素が消えたり無効化されたりすることがあります。
 * - `try-catch` でエラーを握り潰すことで、一時的な不安定さによるテストの中断を防ぎ、次のゲームループでの再試行を可能にします。
 * - `locator.isVisible()` で表示、`locator.isEnabled({ timeout: 1000 })` で1秒以内に操作可能になるかを事前にチェックします。
 * - `locator.click({ timeout: 3000, force: true })` で、他要素によるオーバーレイを無視して強制クリックを行います。
 * - クリック成功後、連打によるバグを防ぐために `postWaitMs`（デフォルト1.5秒）の間待機します。
 */
async function safeClick(locator: Locator, description: string, postWaitMs = 1500): Promise<boolean> {
  try {
    if (await locator.isVisible() && await locator.isEnabled({ timeout: 1000 })) {
      console.log(`Attempting click: ${description}`);
      await locator.click({ timeout: 3000, force: true });
      await locator.page().waitForTimeout(postWaitMs);
      return true;
    }
  } catch (e: any) {
    console.log(`[Safe Click Info] Click failed/omitted for "${description}": ${e.message}`);
  }
  return false;
}

/**
 * ゲームのプレイを最後まで自動操作で完走できるかを検証するテストケースです。
 * 
 * 【TypeScript】
 * - `async ({ page }) => { ... }` の部分は、アロー関数（無名関数の一種）で非同期処理を記述しています。
 * - `{ page }` は引数のオブジェクトから `page` プロパティを取り出す「分割代入（Destructuring Assignment）」です。
 * 
 * 【Playwright】
 * - `test` 関数の第1引数にテスト名、第2引数に実際のテスト内容（フィクスチャを受け取るコールバック関数）を渡します。
 * - `page` フィクスチャは、このテスト専用に初期化されたブラウザのタブ（ページ）を表します。
 */
test('Roguelike Half full play-through verification', async ({ page }) => {
  /**
   * テストのタイムアウト時間をミリ秒単位で設定します。
   * 【Playwright】 このゲームはダイスロールのアニメーションなどが多く時間がかかるため、
   *              デフォルトのタイムアウト（通常30秒）を300,000ミリ秒（5分）に引き上げています。
   */
  test.setTimeout(300000);

  /**
   * 指定したURLにブラウザを遷移させます。
   * 【Playwright】 `playwright.config.ts` で設定された `baseURL` を起点とした相対パス（`/`）を指定しています。
   */
  await page.goto('/');

  // 【テスト設計】 無限ループに陥るのを防ぐためのセーフティリミットです。
  const maxActions = 250; // 実際のクリックを伴うアクションの上限回数
  const maxLoops = 2500;  // アクションが起きない待機・監視ループの上限回数
  
  let actionCount = 0;
  let loopCount = 0;
  let reachedEnd = false;

  console.log('Starting Roguelike Half automation with safe-clicks...');

  // どちらかの上限値に達するまでループし、ゲーム画面の要素に応じたアクションを繰り返します。
  while (actionCount < maxActions && loopCount < maxLoops) {
    loopCount++;
    
    /**
     * 指定ミリ秒数だけ処理を一時停止します。
     * 【Playwright】 画面の状態遷移やアニメーションが落ち着くのを待つために、ループごとに100ミリ秒待機します。
     */
    await page.waitForTimeout(100);

    /**
     * ゲーム終了画面（勝利または敗北）が表示されているかをチェックします。
     * 【Playwright】 `page.locator(selector)` で要素を特定し、`.isVisible()` で画面上に表示されているかを判定します（非同期処理）。
     */
    if (await page.locator('.victory-card').isVisible()) {
      console.log(`🎉 Reached Victory (Success) Screen after ${actionCount} actions (loops: ${loopCount})!`);
      reachedEnd = true;
      break;
    }
    if (await page.locator('.gameover-card').isVisible()) {
      console.log(`💀 Reached Game Over Screen after ${actionCount} actions (loops: ${loopCount})!`);
      reachedEnd = true;
      break;
    }

    /**
     * 1. シナリオ選択画面の処理
     * 【Playwright】 `.scenario-selector` がある場合、`.scenario-card` の一番最初のカードを取得しクリックします。
     */
    if (await page.locator('.scenario-selector').isVisible()) {
      const scenarioCard = page.locator('.scenario-card').first();
      if (await safeClick(scenarioCard, 'Selecting first scenario card', 500)) {
        actionCount++;
      }
      continue;
    }

    /**
     * 2. キャラクター作成画面の処理
     * 【Playwright】 `.creator-card` がある場合、入力フィールドに入力し、アーキタイプを選択して送信ボタンを押します。
     */
    if (await page.locator('.creator-card').isVisible()) {
      console.log(`[Action ${actionCount}] Filling character details...`);
      /**
       * テキストボックスや入力フォームに値を入力します。
       * 【Playwright】 ID指定 `#char-name` の入力フィールドに `'Playwright Hero'` を入力します。
       */
      await page.fill('#char-name', 'Playwright Hero');
      
      const archCard = page.locator('.archetype-card').first();
      await safeClick(archCard, 'First archetype card', 200);

      /**
       * 特定の文字列を含むボタンを検出します。
       * 【Playwright】 `:has-text("...")` セレクターを使用して、特定のテキストを表示しているボタンを取得します。
       */
      const submitBtn = page.locator('button:has-text("キャラクターの命運を紡ぎ出す")');
      if (await safeClick(submitBtn, 'Create character button', 500)) {
        actionCount++;
      }
      continue;
    }

    /**
     * 3. レベルアップ / 街の市場画面の処理
     * 【Playwright】 スキル（魔法・奇跡）の修得、および生命点の上昇を可能な限り行い、最後に冒険を開始します。
     */
    if (await page.locator('.levelup-card').isVisible()) {
      // 習得可能な魔法・奇跡のボタンを検出します（無効化されていないもの）。
      const spellBtn = page.locator('.spell-learning-section button.btn-mini:not([disabled])');
      let learnedSpell = false;
      
      // 修得可能なスペルボタンが存在し、かつ有効な間ループして修得します。
      while (await spellBtn.first().isVisible() && await spellBtn.first().isEnabled({ timeout: 1000 })) {
        const success = await safeClick(spellBtn.first(), 'Learn a spell/miracle', 150);
        if (!success) break;
        learnedSpell = true;
        actionCount++;
        await page.waitForTimeout(50);
      }

      // 生命点の上昇ボタンを検出します。
      const lifeBtn = page.locator('.ledger-row:has-text("生命点") button:has-text("+1上昇")');
      let clickedLife = false;
      
      // 経験値がある限り、生命点上昇ボタンを繰り返しクリックします。
      while (await lifeBtn.isVisible() && await lifeBtn.isEnabled({ timeout: 1000 })) {
        const success = await safeClick(lifeBtn, 'Life increase (+1 Life)', 150);
        if (!success) break;
        clickedLife = true;
        actionCount++;
        await page.waitForTimeout(50);
      }

      // これ以上成長させる余地（経験値）がなくなったら、冒険を開始します。
      if (!clickedLife && !learnedSpell) {
        const startBtn = page.locator('button:has-text("冒険を開始する")');
        if (await safeClick(startBtn, 'Start adventure button', 500)) {
          actionCount++;
        }
      }
      continue;
    }

    /**
     * 4. ダンジョン探索画面の処理
     * 【Playwright】 部屋の状態（進行、罠判定、宝箱、回復、NPC遭遇、ショップなど）に応じて適切なボタンを押します。
     */
    if (await page.locator('.explorer-card').isVisible()) {
      const proceedBtn = page.locator('button:has-text("次の小部屋へ進む")');
      const trapBtn = page.locator('button:has-text("判定ロールに挑戦する"), button:has-text("で挑戦")');
      const treasureBtn = page.locator('button:has-text("宝物を入手する")');
      const restHealBtn = page.locator('button:has-text("怪我を癒やす")');
      const fightBribeBtn = page.locator('button:has-text("交渉決裂！戦う！")');
      const npcMercenaryBtn = page.locator('button:has-text("無視して進む")');
      const npcPriestBtn = page.locator('button:has-text("傷の癒やしを乞う")');
      const leaveMerchantBtn = page.locator('button:has-text("部屋を立ち去る"), button:has-text("取引を終えて部屋を進む")');
      const skipPerceptionBtn = page.locator('button:has-text("察知せずに部屋に入る")');
      const exploreBtn = page.locator('button:has-text("d66を振って次の部屋を探索する")');

      // 優先度の高い順に画面上の選択肢ボタンを評価し、存在するものをクリックします。
      if (await proceedBtn.isVisible()) {
        if (await safeClick(proceedBtn, 'Proceed to next room')) actionCount++;
      } else if (await trapBtn.first().isVisible()) {
        if (await safeClick(trapBtn.first(), 'Attempt trap roll')) actionCount++;
      } else if (await treasureBtn.isVisible()) {
        if (await safeClick(treasureBtn, 'Loot treasure chest')) actionCount++;
      } else if (await restHealBtn.isVisible()) {
        if (await safeClick(restHealBtn, 'Select rest healing')) actionCount++;
      } else if (await fightBribeBtn.isVisible()) {
        if (await safeClick(fightBribeBtn, 'Fight goblin negotiator')) actionCount++;
      } else if (await npcPriestBtn.isVisible()) {
        if (await safeClick(npcPriestBtn, 'Request priest healing')) actionCount++;
      } else if (await npcMercenaryBtn.first().isVisible()) {
        if (await safeClick(npcMercenaryBtn.first(), 'Ignore NPC (mercenary/captive)')) actionCount++;
      } else if (await leaveMerchantBtn.first().isVisible()) {
        if (await safeClick(leaveMerchantBtn.first(), 'Leave merchant/market')) actionCount++;
      } else if (await skipPerceptionBtn.isVisible()) {
        if (await safeClick(skipPerceptionBtn, 'Skip perception check and enter room')) actionCount++;
      } else if (await exploreBtn.isVisible()) {
        if (await safeClick(exploreBtn, 'Roll d66 to explore next room')) actionCount++;
      }
      continue;
    }

    /**
     * 5. 戦闘画面の処理
     * 【Playwright】 戦闘中の各種アクション（かばう、防御、攻撃、武器の持ち替え、勝敗結果の確認など）を順に評価して実行します。
     */
    if (await page.locator('.combat-card').isVisible()) {
      const coverBtn = page.locator('button:has-text("を基準にしてかばう")');
      const cancelCoverBtn = page.locator('button:has-text("かばうのを見送る")');
      const defendBtn = page.locator('button:has-text("主人公が防御する")');
      const lootRollBtn = page.locator('button:has-text("宝箱を開ける (ダイスを振る)")');
      const confirmCombatBtn = page.locator('button:has-text("結果を承認")');
      const reactionConfirmBtn = page.locator('button:has-text("結果を承認して進む")');
      const refuseBribeBtn = page.locator('button:has-text("拒否して戦闘する")');
      const reactionRollBtn = page.locator('button:has-text("反応チェックを行う")');
      const closeRangedBtn = page.locator('button:has-text("接近戦へ移行する")');
      const switchWeaponBtn = page.locator('button:has-text("武器を持ち替える")');
      const attackBtn = page.locator('button:has-text("通常攻撃")');

      // 戦闘のフェーズに応じたボタンを検出し、処理を実行します。
      if (await coverBtn.first().isVisible()) {
        if (await safeClick(coverBtn.first(), 'Perform cover action')) actionCount++;
      } else if (await cancelCoverBtn.isVisible()) {
        if (await safeClick(cancelCoverBtn, 'Decline cover action')) actionCount++;
      } else if (await defendBtn.isVisible()) {
        let defenseCount = 0;
        // 防御ロールが複数回発生する場合（敵が複数いるなど）、1ループ中に最大10回までまとめて処理して無駄な待機ループを削減します。
        while (await defendBtn.isVisible() && defenseCount < 10) {
          const success = await safeClick(defendBtn, 'Player defense roll', 1500);
          if (!success) break;
          defenseCount++;
          actionCount++;
          await page.waitForTimeout(50);
        }
      } else if (await lootRollBtn.isVisible()) {
        if (await safeClick(lootRollBtn, 'Roll combat victory loot')) actionCount++;
      } else if (await confirmCombatBtn.isVisible()) {
        if (await safeClick(confirmCombatBtn, 'Confirm combat result')) actionCount++;
      } else if (await reactionConfirmBtn.isVisible()) {
        if (await safeClick(reactionConfirmBtn, 'Confirm reaction check result')) actionCount++;
      } else if (await refuseBribeBtn.isVisible() && await refuseBribeBtn.isEnabled({ timeout: 500 })) {
        if (await safeClick(refuseBribeBtn, 'Refuse bribe and fight')) actionCount++;
      } else if (await reactionRollBtn.isVisible() && await reactionRollBtn.isEnabled({ timeout: 500 })) {
        if (await safeClick(reactionRollBtn, 'Roll reaction check')) actionCount++;
      } else if (await closeRangedBtn.isVisible() && await closeRangedBtn.isEnabled({ timeout: 500 })) {
        if (await safeClick(closeRangedBtn, 'Transition to melee combat')) actionCount++;
      } else if (await switchWeaponBtn.isVisible() && await switchWeaponBtn.isEnabled({ timeout: 500 })) {
        if (await safeClick(switchWeaponBtn, 'Perform weapon switching transition')) actionCount++;
      } else if (await attackBtn.first().isVisible() && await attackBtn.first().isEnabled({ timeout: 500 })) {
        if (await safeClick(attackBtn.first(), 'Attack first enemy in close combat')) actionCount++;
      }
      continue;
    }
  }

  /**
   * テスト結果のアサーションを行います。
   * 【Playwright】 `expect(actual).toBe(expected)` を用いて、ゲーム終了画面（勝利または敗北）まで完走できたかを検証します。
   */
  expect(reachedEnd).toBe(true);
});

