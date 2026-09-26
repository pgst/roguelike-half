import { ref, computed } from 'vue';
import { doc, getDoc, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from './useAuth';
import { GameSession } from '../domain';

const syncStatus = ref<'idle' | 'syncing' | 'saved' | 'error'>('idle');
const lastSyncedAt = ref<Date | null>(null);
const syncError = ref<string | null>(null);
const cloudSaveMetadata = ref<{
  updatedAt: Date | null;
  scenarioTitle: string;
  depth: number;
  heroName: string;
  heroLevel: number;
} | null>(null);

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
const DEBOUNCE_INTERVAL_MS = 30000; // 30秒の最小同期間隔（課金防止）

export function useCloudSync() {
  const { currentUser } = useAuth();

  const isCloudAvailable = computed(() => db !== null && currentUser.value !== null);

  // Firestore 用にセーブデータを軽量化（過去全ログをカット）
  function sanitizeForCloud(session: GameSession): any {
    const serialized = session.toJSON();
    // 巨大化するログ履歴を除外してドキュメントサイズを数KBに抑える
    return {
      sessionId: serialized.sessionId,
      currentScreen: serialized.currentScreen,
      isCharacterCreated: serialized.isCharacterCreated,
      dungeonDepth: serialized.dungeonDepth,
      activeScenario: serialized.activeScenario,
      character: serialized.character,
      followers: serialized.followers,
      activeEvent: serialized.activeEvent,
      combatState: serialized.combatState,
      pyramidRunCount: serialized.pyramidRunCount,
      // ログは最新5件のみ保持
      logs: (serialized.logs || []).slice(-5),
      updatedAt: serverTimestamp(),
      clientTimestamp: Date.now()
    };
  }

  // クラウドへの即時またはデバウンス保存
  async function saveToCloud(session: GameSession, immediate = false): Promise<boolean> {
    if (!isCloudAvailable.value || !currentUser.value) {
      return false;
    }

    if (!immediate) {
      if (debounceTimer) return true; // すでに待機中の場合はスキップ
      debounceTimer = setTimeout(async () => {
        debounceTimer = null;
        await executeSaveToCloud(session);
      }, DEBOUNCE_INTERVAL_MS);
      return true;
    } else {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
      return await executeSaveToCloud(session);
    }
  }

  async function executeSaveToCloud(session: GameSession): Promise<boolean> {
    if (!db || !currentUser.value) return false;
    syncStatus.value = 'syncing';
    syncError.value = null;

    try {
      const cleanData = sanitizeForCloud(session);
      const userSaveRef = doc(db, 'users', currentUser.value.uid, 'saves', 'latest');
      await setDoc(userSaveRef, cleanData);

      lastSyncedAt.value = new Date();
      syncStatus.value = 'saved';
      return true;
    } catch (e: any) {
      console.warn('[useCloudSync] Save to cloud failed (offline or quota exceeded):', e);
      syncError.value = e.message;
      syncStatus.value = 'error';
      return false;
    }
  }

  // クラウド上のセーブデータ情報を確認
  async function checkCloudSave(): Promise<boolean> {
    if (!db || !currentUser.value) return false;

    try {
      const userSaveRef = doc(db, 'users', currentUser.value.uid, 'saves', 'latest');
      const snap = await getDoc(userSaveRef);

      if (snap.exists()) {
        const data = snap.data();
        let updatedDate: Date | null = null;
        if (data.updatedAt instanceof Timestamp) {
          updatedDate = data.updatedAt.toDate();
        } else if (typeof data.clientTimestamp === 'number') {
          updatedDate = new Date(data.clientTimestamp);
        }

        cloudSaveMetadata.value = {
          updatedAt: updatedDate,
          scenarioTitle: data.activeScenario?.title || '不明なシナリオ',
          depth: data.dungeonDepth || 1,
          heroName: data.character?.name || '無名の冒険者',
          heroLevel: data.character?.level || 1
        };
        return true;
      } else {
        cloudSaveMetadata.value = null;
        return false;
      }
    } catch (e: any) {
      console.warn('[useCloudSync] Failed to check cloud save:', e);
      return false;
    }
  }

  // クラウドからセーブデータを復元
  async function loadFromCloud(): Promise<GameSession | null> {
    if (!db || !currentUser.value) return null;
    syncStatus.value = 'syncing';

    try {
      const userSaveRef = doc(db, 'users', currentUser.value.uid, 'saves', 'latest');
      const snap = await getDoc(userSaveRef);

      if (snap.exists()) {
        const data = snap.data();
        const restored = new GameSession(data);
        syncStatus.value = 'saved';
        lastSyncedAt.value = new Date();
        return restored;
      }
      syncStatus.value = 'idle';
      return null;
    } catch (e: any) {
      console.error('[useCloudSync] Load from cloud failed:', e);
      syncError.value = e.message;
      syncStatus.value = 'error';
      return null;
    }
  }

  return {
    syncStatus,
    lastSyncedAt,
    syncError,
    cloudSaveMetadata,
    isCloudAvailable,
    saveToCloud,
    checkCloudSave,
    loadFromCloud
  };
}
