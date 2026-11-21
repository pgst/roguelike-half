import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref } from 'vue';

const mockSetDoc = vi.fn().mockResolvedValue(undefined);
const mockGetDoc = vi.fn();
const mockDoc = vi.fn((...args: any[]) => ({ path: args.join('/') }));

vi.mock('firebase/firestore', () => ({
  doc: (...args: any[]) => mockDoc(...args),
  getDoc: (...args: any[]) => mockGetDoc(...args),
  setDoc: (...args: any[]) => mockSetDoc(...args),
  serverTimestamp: () => 'SERVER_TIMESTAMP',
  Timestamp: class {},
}));

vi.mock('../firebase/config', () => ({
  db: { __mockDb: true },
}));

const mockIsLoggedIn = ref(true);
const mockCurrentUser = ref<{ uid: string } | null>({ uid: 'test-uid' });

vi.mock('./useAuth', () => ({
  useAuth: () => ({
    currentUser: mockCurrentUser,
    isLoggedIn: mockIsLoggedIn,
  }),
}));

import { useCloudSync } from './useCloudSync';
import { GameSession } from '../domain';

describe('useCloudSync debounce cancellation & immediate flush (Issue #7)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockSetDoc.mockClear();
    mockGetDoc.mockClear();
    mockDoc.mockClear();
    mockIsLoggedIn.value = true;
    mockCurrentUser.value = { uid: 'test-uid' };
    useCloudSync().cancelPendingCloudSync();
  });

  afterEach(() => {
    useCloudSync().cancelPendingCloudSync();
    vi.useRealTimers();
  });

  it('cancels pending 30s debounced upload when cancelPendingCloudSync is called', async () => {
    const { saveToCloud, cancelPendingCloudSync } = useCloudSync();

    const oldSession = new GameSession({
      currentScreen: 'explore',
      isCharacterCreated: true,
      dungeonDepth: 1,
      activeScenario: { id: 'black_serpent', title: '黒蛇の洞窟' },
      character: { name: '旧キャラ', level: 10 },
    });

    await saveToCloud(oldSession, false);
    expect(mockSetDoc).not.toHaveBeenCalled();

    cancelPendingCloudSync();
    await vi.advanceTimersByTimeAsync(35000);

    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it('immediately flushes cleared session and cancels pending debounced old session when immediate=true', async () => {
    const { saveToCloud } = useCloudSync();

    const oldSession = new GameSession({
      currentScreen: 'explore',
      isCharacterCreated: true,
      dungeonDepth: 1,
      activeScenario: { id: 'black_serpent', title: '黒蛇の洞窟' },
      character: { name: '旧キャラ', level: 10 },
    });

    await saveToCloud(oldSession, false);
    expect(mockSetDoc).not.toHaveBeenCalled();

    const clearedSession = new GameSession({
      currentScreen: 'creator',
      isCharacterCreated: false,
      activeScenario: null,
      character: { name: '' },
    });
    clearedSession.character.name = '';

    const ok = await saveToCloud(clearedSession, true);
    expect(ok).toBe(true);
    expect(mockSetDoc).toHaveBeenCalledTimes(1);
    const savedPayload = mockSetDoc.mock.calls[0][1];
    expect(savedPayload.isCharacterCreated).toBe(false);
    expect(savedPayload.activeScenario).toBeNull();
    expect(savedPayload.characterRecord).toBeNull();

    // Even after 30s passes, the old session must never be uploaded
    await vi.advanceTimersByTimeAsync(35000);
    expect(mockSetDoc).toHaveBeenCalledTimes(1);
  });

  it('cancels pending debounced sync even if cloud becomes unavailable before immediate clear', async () => {
    const { saveToCloud } = useCloudSync();

    const oldSession = new GameSession({
      currentScreen: 'explore',
      isCharacterCreated: true,
      dungeonDepth: 1,
      activeScenario: { id: 'black_serpent', title: '黒蛇の洞窟' },
      character: { name: '旧キャラ', level: 10 },
    });

    await saveToCloud(oldSession, false);

    mockIsLoggedIn.value = false;
    const clearedSession = new GameSession({ currentScreen: 'creator', isCharacterCreated: false });
    const ok = await saveToCloud(clearedSession, true);
    expect(ok).toBe(false);

    mockIsLoggedIn.value = true;
    await vi.advanceTimersByTimeAsync(35000);
    expect(mockSetDoc).not.toHaveBeenCalled();
  });
});
