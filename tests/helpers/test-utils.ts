import { type Locator } from '@playwright/test';

/**
 * 対象の要素を安全にクリックするための非同期ヘルパー関数です。
 * 画面の再レンダリングやアニメーションによって要素が一時的に無効な状態でも、
 * 例外をキャッチして次のループでの再試行を可能にします。
 */
export async function safeClick(locator: Locator, description: string, postWaitMs = 1500): Promise<boolean> {
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
    let callCount = 0;
    const d1 = Math.floor(d66Result / 10);
    const d2 = d66Result % 10;
    
    window.Math.random = () => {
      callCount++;
      // Call 1 is log ID
      if (callCount === 1) return 0.5;
      // Call 2 & 3 are d66 roll digits
      if (callCount === 2) return (d1 - 1) / 6;
      if (callCount === 3) return (d2 - 1) / 6;
      
      // Subsequent rolls
      const rollIndex = callCount - 4;
      if (Array.isArray(rolls)) {
        if (rollIndex >= 0 && rollIndex < rolls.length) {
          return (rolls[rollIndex] - 1) / 6 + 0.01;
        }
        return 0.5; // default middle roll
      } else {
        // Single normalRoll value
        return (rolls - 1) / 6 + 0.01;
      }
    };
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
