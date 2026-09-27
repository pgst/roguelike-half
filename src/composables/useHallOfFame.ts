import { ref, computed } from 'vue';
import { collection, addDoc, getDocs, query, orderBy, limit, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from './useAuth';
import type { Character, Scenario } from '../types';

export interface HallOfFameEntry {
  id: string;
  adventurerName: string;
  scenarioTitle: string;
  level: number;
  gold: number;
  subStatType: string;
  clearedAt: Date | null;
  equipmentSummary: string;
}

// モジュールレベルでの状態保持（複数コンポーネント間で共有）
const hallOfFameList = ref<HallOfFameEntry[]>([]);
const isLoading = ref<boolean>(false);
const fetchError = ref<string | null>(null);
const lastFetchedAt = ref<number>(0);
const lastManualRefreshAt = ref<number>(0);
const cooldownRemaining = ref<number>(0);

let cooldownTimer: ReturnType<typeof setInterval> | null = null;
let activeFetchPromise: Promise<HallOfFameEntry[]> | null = null;

const CACHE_TTL_MS = 5 * 60 * 1000; // 5分間キャッシュ
const COOLDOWN_MS = 30 * 1000;       // 手動更新の最小間隔（30秒）

export function useHallOfFame() {
  const { currentUser, isLoggedIn } = useAuth();

  const isCooldown = computed(() => cooldownRemaining.value > 0);

  function startCooldown() {
    lastManualRefreshAt.value = Date.now();
    cooldownRemaining.value = Math.ceil(COOLDOWN_MS / 1000);

    if (cooldownTimer) clearInterval(cooldownTimer);
    cooldownTimer = setInterval(() => {
      const elapsed = Date.now() - lastManualRefreshAt.value;
      const left = Math.ceil((COOLDOWN_MS - elapsed) / 1000);
      if (left <= 0) {
        cooldownRemaining.value = 0;
        if (cooldownTimer) clearInterval(cooldownTimer);
        cooldownTimer = null;
      } else {
        cooldownRemaining.value = left;
      }
    }, 1000);
  }

  // 迷宮踏破時にクリア記録を登録（Googleログイン済みユーザーのみ）
  async function registerClearRecord(character: Character, scenario: Scenario): Promise<boolean> {
    if (!db || !isLoggedIn.value || !currentUser.value) {
      // 未ログイン（ゲスト）時は登録スキップ
      return false;
    }

    try {
      const weaponName = character.equippedWeapon?.name || '素手';
      const armorName = character.equippedArmor?.name || '平服';
      const shieldName = character.equippedShield?.name ? ` / ${character.equippedShield.name}` : '';
      const summary = `武器: ${weaponName} / 防具: ${armorName}${shieldName}`;

      const entryData = {
        userId: currentUser.value.uid,
        adventurerName: character.name || '無名の英雄',
        scenarioTitle: scenario.title,
        level: character.level,
        gold: character.gold,
        subStatType: character.subStatType,
        equipmentSummary: summary,
        clearedAt: serverTimestamp(),
        clientTimestamp: Date.now()
      };

      await addDoc(collection(db, 'hall_of_fame'), entryData);
      
      // 自分が踏破した直後はキャッシュを無効化（次回開いた時に最新の自分の記録を取得できるようにする）
      lastFetchedAt.value = 0;
      return true;
    } catch (e: any) {
      console.warn('[useHallOfFame] Failed to register clear record (offline or rules violation):', e);
      return false;
    }
  }

  // 最新の踏破者記録20件を取得（5分間TTLキャッシュ ＆ 手動更新 ＆ In-flight重複排除）
  async function fetchRecentClears(forceRefresh = false): Promise<HallOfFameEntry[]> {
    if (!db) return [];

    const now = Date.now();
    const isCacheValid = lastFetchedAt.value > 0 && (now - lastFetchedAt.value) < CACHE_TTL_MS;

    // 強制更新でない場合、キャッシュが有効なら即座に返却（Firestore読み取りゼロ）
    if (!forceRefresh && isCacheValid && hallOfFameList.value.length > 0) {
      return hallOfFameList.value;
    }

    // 強制更新時のクールダウンチェック
    if (forceRefresh && isCooldown.value) {
      return hallOfFameList.value;
    }

    // 既にリクエスト処理中の場合はその Promise を再利用（In-flight 重複排除）
    if (activeFetchPromise) {
      return activeFetchPromise;
    }

    if (forceRefresh) {
      startCooldown();
    }

    isLoading.value = true;
    fetchError.value = null;

    activeFetchPromise = (async () => {
      try {
        const q = query(
          collection(db, 'hall_of_fame'),
          orderBy('clearedAt', 'desc'),
          limit(20)
        );

        const querySnapshot = await getDocs(q);
        const list: HallOfFameEntry[] = [];

        querySnapshot.forEach((docSnap) => {
          const d = docSnap.data();
          let clearedDate: Date | null = null;
          if (d.clearedAt instanceof Timestamp) {
            clearedDate = d.clearedAt.toDate();
          } else if (typeof d.clientTimestamp === 'number') {
            clearedDate = new Date(d.clientTimestamp);
          }

          list.push({
            id: docSnap.id,
            adventurerName: d.adventurerName || '無名の英雄',
            scenarioTitle: d.scenarioTitle || '不明な迷宮',
            level: d.level || 1,
            gold: d.gold || 0,
            subStatType: d.subStatType || 'magic',
            clearedAt: clearedDate,
            equipmentSummary: d.equipmentSummary || '軽装'
          });
        });

        hallOfFameList.value = list;
        lastFetchedAt.value = Date.now();
        return list;
      } catch (e: any) {
        console.warn('[useHallOfFame] Failed to fetch Hall of Fame entries:', e);
        fetchError.value = e.message;
        // エラー時も既存のキャッシュリストは破棄せず維持（SWR フォールバック）
        return hallOfFameList.value;
      } finally {
        isLoading.value = false;
        activeFetchPromise = null;
      }
    })();

    return activeFetchPromise;
  }

  return {
    hallOfFameList,
    isLoading,
    fetchError,
    isCooldown,
    cooldownRemaining,
    lastFetchedAt,
    registerClearRecord,
    fetchRecentClears
  };
}
