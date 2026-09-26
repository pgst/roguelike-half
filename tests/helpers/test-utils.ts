import { type Locator } from '@playwright/test';

/**
 * 対象の要素を安全にクリックするための非同期ヘルパー関数です。
 * 画面の再レンダリングやアニメーションによって要素が一時的に無効な状態でも、
 * 例外をキャッチして次のループでの再試行を可能にします。
 */
export async function safeClick(locator: Locator, description: string, postWaitMs = 300): Promise<boolean> {
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
 * 指定したテキストを含むボタンをブラウザ内で直接クリックしてVueのイベントハンドラを確実に発火させます。
 */
export async function clickButtonByText(page: any, text: string, postWaitMs = 500): Promise<void> {
  const btnLocator = page.locator(`button:has-text("${text}")`).first();
  await btnLocator.waitFor({ state: 'visible', timeout: 5000 });
  await page.evaluate((targetText: string) => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const btn = buttons.find(b => b.textContent?.includes(targetText));
    if (btn) btn.click();
  }, text);
  await page.waitForTimeout(postWaitMs);
}

/**
 * マスター・ディテールUIに対応したシナリオ選択ヘルパー。
 * 左リストでシナリオカードを選択し、右詳細パネルの「このシナリオに挑む」をクリックして画面遷移させます。
 */
export async function selectScenarioInUI(page: any, scenarioTitle: string): Promise<boolean> {
  try {
    const scenarioCard = page.locator('.scenario-card').filter({ hasText: scenarioTitle }).first();
    if (await scenarioCard.isVisible({ timeout: 5000 })) {
      await scenarioCard.click({ force: true });
      await page.waitForTimeout(300);

      const startBtn = page.locator('.scenario-detail-panel button:has-text("このシナリオに挑む")');
      if (await startBtn.isVisible({ timeout: 5000 })) {
        await startBtn.click({ force: true });
        await page.waitForTimeout(500);
        return true;
      }
    }
  } catch (e: any) {
    console.log(`[selectScenarioInUI Error] Failed to select scenario "${scenarioTitle}": ${e.message}`);
  }
  return false;
}

/**
 * HUD上の「📜 ステータス詳細」ボタンをクリックして冒険者シートモーダルを開きます。
 */
export async function openAdventureSheet(page: any): Promise<boolean> {
  try {
    const detailBtn = page.locator('.btn-hud-detail');
    await detailBtn.waitFor({ state: 'visible', timeout: 5000 });
    await page.evaluate(() => {
      const btn = document.querySelector('.btn-hud-detail') as HTMLElement | null;
      if (btn) btn.click();
    });
    await page.locator('.hud-detail-modal').waitFor({ state: 'visible', timeout: 5000 });
    await page.waitForTimeout(300);
    return true;
  } catch (e: any) {
    console.log(`[openAdventureSheet Error]: ${e.message}`);
    throw e;
  }
}

/**
 * 冒険者シート詳細モーダルを閉じます。
 */
export async function closeAdventureSheet(page: any): Promise<boolean> {
  try {
    await page.evaluate(() => {
      const btn = document.querySelector('.btn-close-hud') as HTMLElement | null;
      if (btn) btn.click();
    });
    await page.locator('.hud-detail-modal').waitFor({ state: 'hidden', timeout: 5000 });
    await page.waitForTimeout(300);
    return true;
  } catch (e: any) {
    console.log(`[closeAdventureSheet Error]: ${e.message}`);
  }
  return false;
}

/**
 * 第0ラウンドから第1ラウンド（接近戦）へ確実に移行します。
 */
export async function transitionToMelee(page: any): Promise<void> {
  const meleeBtn = page.locator('button:has-text("接近戦へ移行する")');
  await meleeBtn.waitFor({ state: 'visible', timeout: 5000 });
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const btn = buttons.find(b => b.textContent?.includes('接近戦へ移行する'));
    if (btn) btn.click();
  });
  await page.waitForTimeout(500);
}

/**
 * 解決済みイベントから「次の小部屋へ進む」をクリックして通路画面（次の部屋探索可能状態）へ確実に進めます。
 */
export async function proceedToNextRoom(page: any): Promise<void> {
  const proceedBtn = page.locator('button:has-text("次の小部屋へ進む")');
  await proceedBtn.waitFor({ state: 'visible', timeout: 5000 });
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const btn = buttons.find(b => b.textContent?.includes('次の小部屋へ進む'));
    if (btn) btn.click();
  });
  await page.locator('button:has-text("d66を振って次の部屋を探索する")').waitFor({ state: 'visible', timeout: 5000 });
  await page.waitForTimeout(300);
}

/**
 * プレイヤーが麻痺・石化・気絶などの戦闘不能状態にあるか判定します。
 */
export async function checkCannotAttack(page: any): Promise<boolean> {
  return await page.evaluate(() => {
    try {
      const s = localStorage.getItem('roguelike_half_saved_session');
      if (!s) return false;
      const data = JSON.parse(s);
      const effects = data.character?.statusEffects || [];
      return effects.includes('麻痺') || effects.includes('石化') || effects.includes('気絶');
    } catch {
      return false;
    }
  });
}

/**
 * 探索ダイス（d66）を振り、結果が確定するまで待機します。
 * 察知判定画面が表示された場合は、自動的に「察知せずに部屋に入る」を選択して進めます。
 */
export async function rollD66AndSkipPerception(page: any): Promise<void> {
  const exploreBtn = page.locator('button:has-text("d66を振って次の部屋を探索する")');
  await exploreBtn.waitFor({ state: 'visible', timeout: 5000 });
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const btn = buttons.find(b => b.textContent?.includes('d66を振って次の部屋を探索する'));
    if (btn) btn.click();
  });
  
  // ダイスロール完了とUI更新を待つ（rollD66のディレイ900ms以上）
  await page.waitForTimeout(1200);

  const skipPerceptionBtn = page.locator('button:has-text("察知せずに部屋に入る")');
  if (await skipPerceptionBtn.isVisible({ timeout: 1500 })) {
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const btn = buttons.find(b => b.textContent?.includes('察知せずに部屋に入る'));
      if (btn) btn.click();
    });
    await page.waitForTimeout(500);
  }
}

/**
 * ページ遷移やアニメーションによるテストの遅延・不安定さを防ぐため、
 * 全てのアニメーションとトランジションを無効化します。
 */
export async function disableAnimations(page: any) {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        transition: none !important;
        animation: none !important;
        transition-duration: 0s !important;
        animation-duration: 0s !important;
      }
    `
  });
}

/**
 * 乱数（Math.random）をスタブ化し、特定の出目をシミュレートします。
 * 
 * @param page PlaywrightのPageオブジェクト
 * @param d66Result 探索フェーズで振るd66の出目（例: 11, 32）
 * @param rolls 以降の戦闘や判定などで使用される出目のリスト（配列）、または固定の出目（数値）
 */
export async function setupMockRandom(page: any, d66Result: number, rolls: number | number[]) {
  await page.evaluate(({ d66Result, rolls }) => {
    const d1 = Math.floor(d66Result / 10);
    const d2 = d66Result % 10;
    
    const mockRollList: number[] = [d1, d2];
    if (Array.isArray(rolls)) {
      mockRollList.push(...rolls);
    } else {
      mockRollList.push(rolls);
    }
    
    // Inject the mock array to be consumed sequentially by randomInt
    (window as any).__mockRolls = mockRollList;
    
    // Determine the fallback roll value when mockRollList runs out.
    // If rolls is a single number, use it. If array, use its last element. Default to 6.
    const lastRollVal = Array.isArray(rolls)
      ? (rolls.length > 0 ? rolls[rolls.length - 1] : 6)
      : rolls;
    
    // Provide a fallback value directly to prevent Math.random browser inconsistency
    (window as any).__mockRollsFallback = lastRollVal;
    
    // Calculate the Math.random return value to match the desired roll
    const fallbackRandomVal = (lastRollVal - 1) / 6 + 0.01;
    
    // Provide a stable Math.random stub that matches the expected last roll
    window.Math.random = () => fallbackRandomVal;
  }, { d66Result, rolls });
}

/**
 * 敵のターンで「主人公が防御する」ボタンが表示されている間、自動でクリックし続けます。
 */
export async function handlePendingDefense(page: any) {
  const defendBtn = page.locator('button:has-text("主人公が防御する")');
  try {
    await defendBtn.waitFor({ state: 'visible', timeout: 1500 });
  } catch (e) {
    return;
  }
  while (await defendBtn.isVisible()) {
    await defendBtn.click({ force: true });
    await page.waitForTimeout(800);
  }
}

/**
 * 任意のゲームセッション状態をブラウザの localStorage にインジェクションします。
 * ナビゲーション（page.goto）を呼び出す前にこの関数を実行してください。
 * 
 * @param page PlaywrightのPageオブジェクト
 * @param sessionData 部分的なセッション状態。デフォルト状態にマージされます。
 */
export async function injectTestSession(page: any, sessionData: any) {
  const defaultSession = {
    sessionId: `test-session-${Math.random().toString(36).substring(2, 9)}`,
    currentScreen: 'explore',
    isCharacterCreated: true,
    nextRoomTensDigitOverride: null,
    character: {
      name: 'テスト冒険者',
      level: 10,
      exp: 10,
      gold: 50,
      food: 2,
      skillMax: 0,
      skillCurrent: 0,
      lifeMax: 4,
      lifeCurrent: 4,
      subStatType: 'magic',
      subStatMax: 2,
      subStatCurrent: 2,
      followerMax: 7,
      followerCurrent: 7,
      spells: [],
      miracles: [],
      weapons: [],
      armors: [],
      shields: [],
      items: [{ id: 'lantern-id', name: 'ランタン', type: 'lantern', goldCost: 2, value: 0, description: 'ランタン' }],
      equippedWeapon: null,
      equippedArmor: null,
      equippedShield: null,
      hasActiveLantern: true,
      statusEffects: []
    },
    followers: [],
    activeEvent: null,
    dungeonDepth: 1,
    logs: [],
    diceTray: {
      isRolling: false,
      d1: 0,
      d2: 0,
      sides: 6,
      resultText: '',
      isCritical: false,
      isFumble: false
    },
    combatState: {
      active: false,
      enemies: [],
      round: 0,
      pendingRoarCheck: null,
      roarCheckedThisCombat: false,
      shireenClueSpent: false,
      chronovalsWindPenalty: false,
      isCharmed: false,
      isStunned: false,
      isClinging: false,
      isBerserk: false,
      isAnotherEnding: false,
      activeAttacks: [],
      log: [],
      hasQuickStrikeActive: false,
      hasWeaponCreatedThisRound: false,
      hasCoveredInRound: false,
      pendingCover: null,
      lootText: '',
      lootRolled: false
    },
    activeScenario: {
      id: 'aranzas',
      title: '魔将アラザスの迷宮',
      description: 'デモ迷宮',
      recommendedLevel: '10',
      totalRoomsToClear: 8
    },
    pyramidRunCount: 1,
    pyramidBossSnapshot: null,
    seed: `test-seed-${Math.random().toString(36).substring(2, 9)}`
  };

  const mergeDeep = (target: any, source: any) => {
    if (!source) return target;
    for (const key of Object.keys(source)) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        if (!target[key]) target[key] = {};
        mergeDeep(target[key], source[key]);
      } else {
        target[key] = source[key];
      }
    }
    return target;
  };

  const finalSession = mergeDeep(defaultSession, sessionData);

  await page.addInitScript((data: any) => {
    window.localStorage.setItem('roguelike_half_saved_session', JSON.stringify(data));
  }, finalSession);
}

