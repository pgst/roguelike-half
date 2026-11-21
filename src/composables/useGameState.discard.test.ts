import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { nextTick } from 'vue';
import type { Scenario } from '../types';

const mockCancelPendingCloudSync = vi.fn();
const mockSaveToCloud = vi.fn().mockResolvedValue(true);

vi.mock('./useCloudSync', () => ({
  useCloudSync: () => ({
    cancelPendingCloudSync: mockCancelPendingCloudSync,
    saveToCloud: mockSaveToCloud,
  }),
}));

import { useGameState } from './useGameState';
import { GameSession } from '../domain';

function createMemoryStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
  };
}

function makeScenario(id = 'black_serpent', title = '黒蛇の洞窟'): Scenario {
  return {
    id,
    title,
    recommendedLevel: 'Lv.10〜',
    description: 'テスト用シナリオ',
    totalRoomsToClear: 8,
    d66EventTable: {},
    bossEvent: {
      d66Code: 'boss',
      title: 'ボス',
      type: 'encounter',
      description: 'ボス戦',
      isResolved: false,
      enemies: [],
    },
  };
}

describe('Adventure Discard & Session Persistence (Issue #7)', () => {
  let storage: ReturnType<typeof createMemoryStorage>;

  beforeEach(() => {
    storage = createMemoryStorage();
    vi.stubGlobal('localStorage', storage);
    mockCancelPendingCloudSync.mockClear();
    mockSaveToCloud.mockClear();

    const gs = useGameState();
    gs.resetSessionForNewCharacter();
    mockCancelPendingCloudSync.mockClear();
    mockSaveToCloud.mockClear();
    storage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('resetSessionForNewCharacter clears local saves, cancels pending cloud sync, immediately syncs empty session, and does not resurrect on subsequent scenario selection', async () => {
    const gs = useGameState();
    const blackSerpent = makeScenario('black_serpent', '黒蛇の洞窟');
    const aranzas = makeScenario('aranzas', '魔将アラザスの迷宮');

    // 1. 『黒蛇の洞窟』を開始し、第2の部屋まで進める
    gs.activeScenario.value = blackSerpent;
    gs.initNewCharacter('旧冒険者', 'strength');
    gs.transitionToExplore();
    gs.dungeonDepth.value = 1; // 第2部屋
    await nextTick();

    expect(storage.getItem('roguelike_half_saved_session')).not.toBeNull();
    expect(storage.getItem('roguelike_half_saved_character')).not.toBeNull();
    expect(gs.hasSavedSession()).toBe(true);

    mockCancelPendingCloudSync.mockClear();
    mockSaveToCloud.mockClear();

    // 2. 「新規作成」→「破棄して新規作成」を実行
    gs.resetSessionForNewCharacter();
    await nextTick();

    expect(storage.getItem('roguelike_half_saved_session')).toBeNull();
    expect(storage.getItem('roguelike_half_saved_character')).toBeNull();
    expect(gs.hasSavedSession()).toBe(false);
    expect(mockCancelPendingCloudSync).toHaveBeenCalledTimes(1);
    expect(mockSaveToCloud).toHaveBeenCalledTimes(1);
    const [syncedSession, immediateFlag] = mockSaveToCloud.mock.calls[0];
    expect(immediateFlag).toBe(true);
    expect(syncedSession.isCharacterCreated).toBe(false);
    expect(syncedSession.activeScenario).toBeNull();
    expect(syncedSession.currentScreen).toBe('creator');
    expect(syncedSession.character.name).toBe('');

    // 3. 新規キャラクターを作成してシナリオ選択へ戻る
    gs.initNewCharacter('新冒険者', 'magic');
    await nextTick();
    expect(storage.getItem('roguelike_half_saved_session')).toBeNull();
    expect(storage.getItem('roguelike_half_saved_character')).not.toBeNull();

    gs.returnToScenarioSelect();
    await nextTick();
    expect(gs.hasSavedSession()).toBe(false);

    // 4. 再読み込み相当：activeSession を新規 GameSession にしてキャラクター記録から復元
    gs.activeSession.value = new GameSession();
    expect(gs.activeSession.value.dungeonDepth).toBe(0);
    expect(gs.loadCharacterRecord()).toBe(true);
    expect(gs.hasSavedSession()).toBe(false);

    // 5. 別のシナリオ（または黒蛇の洞窟）で「このシナリオに挑む」（levelup画面へ遷移）
    gs.activeScenario.value = aranzas;
    gs.currentScreen.value = 'levelup';
    await nextTick();

    // 探索開始前の levelup 画面では進行中冒険セーブが作られないこと
    expect(storage.getItem('roguelike_half_saved_session')).toBeNull();
    expect(gs.hasSavedSession()).toBe(false);

    // 6. 「シナリオを変更する」でトップ画面へ戻っても破棄した冒険は復活しないこと
    gs.returnToScenarioSelect();
    await nextTick();
    expect(storage.getItem('roguelike_half_saved_session')).toBeNull();
    expect(gs.hasSavedSession()).toBe(false);
    expect(gs.activeScenario.value).toBeNull();
  });

  it('discardSavedAdventure clears saved session, resets exploration state, cancels pending cloud sync, and preserves character', async () => {
    const gs = useGameState();
    const blackSerpent = makeScenario('black_serpent', '黒蛇の洞窟');
    const aranzas = makeScenario('aranzas', '魔将アラザスの迷宮');

    gs.activeScenario.value = blackSerpent;
    gs.initNewCharacter('継続勇者', 'luck');
    gs.transitionToExplore();
    gs.dungeonDepth.value = 3;
    gs.character.value.lifeCurrent = 2;
    await nextTick();

    expect(gs.hasSavedSession()).toBe(true);
    mockCancelPendingCloudSync.mockClear();
    mockSaveToCloud.mockClear();

    gs.discardSavedAdventure();
    await nextTick();

    expect(storage.getItem('roguelike_half_saved_session')).toBeNull();
    expect(gs.hasSavedSession()).toBe(false);
    expect(gs.dungeonDepth.value).toBe(0);
    expect(gs.activeEvent.value).toBeNull();
    expect(gs.activeScenario.value).toBeNull();
    expect(gs.character.value.name).toBe('継続勇者');
    expect(gs.character.value.lifeCurrent).toBe(gs.character.value.lifeMax);
    expect(mockCancelPendingCloudSync).toHaveBeenCalledTimes(1);
    expect(mockSaveToCloud).toHaveBeenCalledWith(expect.any(GameSession), true);

    // 別シナリオを選択してレベルアップ画面へ進んでも旧進行度は復活しない
    gs.activeScenario.value = aranzas;
    gs.currentScreen.value = 'levelup';
    await nextTick();
    expect(storage.getItem('roguelike_half_saved_session')).toBeNull();
    expect(gs.dungeonDepth.value).toBe(0);
  });

  it('preserves active adventure resume for non-discarded sessions and post-clear character persistence', async () => {
    const gs = useGameState();
    const blackSerpent = makeScenario('black_serpent', '黒蛇の洞窟');

    // 進行中冒険の再開が壊れていないこと
    gs.activeScenario.value = blackSerpent;
    gs.initNewCharacter('生還予定者', 'dexterity');
    gs.transitionToExplore();
    gs.dungeonDepth.value = 1;
    gs.character.value.gold = 35;
    await nextTick();

    expect(gs.hasSavedSession()).toBe(true);

    gs.activeSession.value = new GameSession();
    expect(gs.loadSession()).toBe(true);
    expect(gs.activeScenario.value?.id).toBe('black_serpent');
    expect(gs.dungeonDepth.value).toBe(1);
    expect(gs.character.value.gold).toBe(35);

    // クリア後はセッションのみ消去され、キャラクター記録は永続化されること
    gs.transitionToSuccess();
    await nextTick();

    expect(storage.getItem('roguelike_half_saved_session')).toBeNull();
    expect(gs.hasSavedSession()).toBe(false);
    expect(storage.getItem('roguelike_half_saved_character')).not.toBeNull();

    gs.activeSession.value = new GameSession();
    expect(gs.loadCharacterRecord()).toBe(true);
    expect(gs.character.value.name).toBe('生還予定者');
    expect(gs.character.value.level).toBe(11);
  });
});
