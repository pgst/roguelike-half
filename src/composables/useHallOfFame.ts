import { ref } from 'vue';
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

const hallOfFameList = ref<HallOfFameEntry[]>([]);
const isLoading = ref<boolean>(false);
const fetchError = ref<string | null>(null);

export function useHallOfFame() {
  const { currentUser } = useAuth();

  // 迷宮踏破時にクリア記録を登録
  async function registerClearRecord(character: Character, scenario: Scenario): Promise<boolean> {
    if (!db || !currentUser.value) return false;

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
      return true;
    } catch (e: any) {
      console.warn('[useHallOfFame] Failed to register clear record (offline or rules violation):', e);
      return false;
    }
  }

  // 最新の踏破者記録20件を取得
  async function fetchRecentClears(): Promise<HallOfFameEntry[]> {
    if (!db) return [];
    isLoading.value = true;
    fetchError.value = null;

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
      return list;
    } catch (e: any) {
      console.warn('[useHallOfFame] Failed to fetch Hall of Fame entries:', e);
      fetchError.value = e.message;
      return [];
    } finally {
      isLoading.value = false;
    }
  }

  return {
    hallOfFameList,
    isLoading,
    fetchError,
    registerClearRecord,
    fetchRecentClears
  };
}
