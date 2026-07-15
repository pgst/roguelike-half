let idCounter = 0;

/**
 * Math.random を使わずに一意な ID を生成します。
 * テスト環境で Math.random の実行回数が変わるのを防ぐため、
 * crypto.randomUUID() またはタイムスタンプとインクリメンタルカウンタを組み合わせます。
 */
export function generateId(): string {
  idCounter++;
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const timestamp = Date.now().toString(36);
  const counterPart = idCounter.toString(36);
  const randomPart = Math.floor(Math.random() * 1000000).toString(36);
  return `id-${timestamp}-${counterPart}-${randomPart}`;
}

/**
 * 簡易的なハッシュ関数。文字列のシード値を数値に変換します。
 */
export function hashSeed(str: string): number {
  let hash = 1779033703;
  for (let i = 0; i < str.length; i++) {
    hash = Math.imul(hash ^ str.charCodeAt(i), 3432918353);
    hash = (hash << 13) | (hash >>> 19);
  }
  return hash >>> 0;
}

/**
 * シード可能な擬似乱数ジェネレータ (Mulberry32)
 */
export class SeededRandom {
  private state: number;

  constructor(seed: string | number) {
    if (typeof seed === 'string') {
      this.state = hashSeed(seed);
    } else {
      this.state = seed >>> 0;
    }
  }

  /**
   * 0 以上 1 未満の決定論的な乱数を生成し、状態を更新します。
   */
  public next(): number {
    let t = (this.state += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * min 以上 max 以下の整数を生成します（両端含む）。
   */
  public nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
}

// グローバルで利用可能な（あるいはテストで上書き可能な）乱数ジェネレータのインスタンス
let activePrng: SeededRandom | null = null;

export function setGlobalSeed(seed: string | number): void {
  activePrng = new SeededRandom(seed);
}

export function clearGlobalSeed(): void {
  activePrng = null;
}

export function getGlobalPrng(): SeededRandom | null {
  return activePrng;
}

/**
 * 0以上1未満の乱数を取得します。
 * モックやグローバルPRNGが設定されていればそれを使用し、
 * 設定されていなければフォールバックとして Math.random() を呼びます。
 */
export function randomFloat(): number {
  if (typeof window !== 'undefined' && (window as any).__mockFloats) {
    if ((window as any).__mockFloats.length > 0) {
      return (window as any).__mockFloats.shift();
    }
    if (typeof (window as any).__mockFloatsFallback === 'number') {
      return (window as any).__mockFloatsFallback;
    }
  }
  if (activePrng) {
    return activePrng.next();
  }
  return Math.random();
}

/**
 * min以上max以下の整数（ダイスロールなど）を取得します。
 */
export function randomInt(min: number, max: number): number {
  if (typeof window !== 'undefined' && (window as any).__mockRolls) {
    if ((window as any).__mockRolls.length > 0) {
      return (window as any).__mockRolls.shift();
    }
    if (typeof (window as any).__mockRollsFallback === 'number') {
      return (window as any).__mockRollsFallback;
    }
  }
  if (activePrng) {
    return activePrng.nextInt(min, max);
  }
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
