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

