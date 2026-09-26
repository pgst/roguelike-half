import { ref } from 'vue';
import type { Scenario, DungeonEvent } from '../types';
import { generateId } from '../domain/random';
import { db } from '../firebase/config';
import { doc, setDoc, deleteDoc, collection, getDocs } from 'firebase/firestore';
import { useAuth } from './useAuth';

const LOCAL_STORAGE_KEY = 'roguelike_half_custom_scenarios';

const customScenarios = ref<Scenario[]>(loadFromLocalStorage());

// LocalStorage から初期読み込み
function loadFromLocalStorage(): Scenario[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        return list;
      }
    }
  } catch (e) {
    console.error('[useCustomScenarios] Failed to load custom scenarios from localStorage:', e);
  }
  return [];
}

// LocalStorage へ保存
function persistToLocalStorage(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(customScenarios.value));
  } catch (e) {
    console.error('[useCustomScenarios] Failed to save custom scenarios to localStorage:', e);
  }
}

// 全36マスの出目コード配列 (11 〜 66)
export const ALL_D66_CODES = [
  '11', '12', '13', '14', '15', '16',
  '21', '22', '23', '24', '25', '26',
  '31', '32', '33', '34', '35', '36',
  '41', '42', '43', '44', '45', '46',
  '51', '52', '53', '54', '55', '56',
  '61', '62', '63', '64', '65', '66'
];

/**
 * シナリオのデータ（部屋数、敵の平均Lv・強敵数、ボスの脅威度）から適正レベル帯を自動計算
 */
export function calculateRecommendedLevel(scenario: Partial<Scenario>): string {
  const rooms = typeof scenario.totalRoomsToClear === 'number' ? scenario.totalRoomsToClear : 8;
  const bossList = scenario.bossEvent?.enemies || [];
  const boss = bossList[0] || {};
  const bHp = Math.max(boss.lifeMax || 5, 1);
  const bAtk = Math.max(boss.attackCount || 1, 1);
  const bLvl = Math.max(boss.level || 5, 1);
  const bTags = boss.tags || [];

  // アンデッドかつ強敵ボスは聖水（器用目標4で大ダメージ）が有効なためHP負担が軽減される
  const isUndeadBoss = bTags.includes('undead') && bTags.includes('strong');
  const effectiveHp = isUndeadBoss ? bHp * 0.5 : bHp;

  // 36部屋の道中敵の平均レベルと強敵数
  const levels: number[] = [];
  let strongMooks = 0;
  if (scenario.d66EventTable) {
    for (const ev of Object.values(scenario.d66EventTable)) {
      if (ev && ev.enemies && Array.isArray(ev.enemies)) {
        for (const e of ev.enemies) {
          levels.push(e.level || 2);
          if ((e.tags && e.tags.includes('strong')) || (e.lifeMax && e.lifeMax >= 2)) {
            strongMooks += (e.count || 1);
          }
        }
      }
    }
  }

  const avgLvl = levels.length > 0 ? levels.reduce((a, b) => a + b, 0) / levels.length : 2.5;

  // 1. 部屋数スコア (6部屋=0, 8部屋=1.4, 11部屋=3.5)
  const rScore = (rooms - 6) * 0.7;

  // 2. 道中敵スコア
  const mScore = (avgLvl - 2.5) * 1.0 + (strongMooks - 6) * 0.05;

  // 3. ボス脅威度スコア
  const bScore = (effectiveHp - 5) * 0.25 + (bAtk - 1) * 0.3 + (bLvl - 5) * 0.2;

  const score = 10.0 + rScore + mScore + bScore;

  if (score < 11.2) {
    return '適正レベル：10-11';
  } else if (score < 12.5) {
    return '適正レベル：11-12';
  } else if (score < 14.0) {
    return '適正レベル：12-13';
  } else if (score < 18.0) {
    return '適正レベル：13-15';
  } else {
    return '適正レベル：15以上';
  }
}

export function useCustomScenarios() {
  const { currentUser } = useAuth();

  // スキーマ検証 ＆ サニタイズ
  function validateScenario(data: any): { isValid: boolean; scenario?: Scenario; error?: string } {
    if (!data || typeof data !== 'object') {
      return { isValid: false, error: 'データがオブジェクト形式ではありません。' };
    }

    if (!data.title || typeof data.title !== 'string' || !data.title.trim()) {
      return { isValid: false, error: 'シナリオのタイトル (title) が必要です。' };
    }

    const totalRooms = Number(data.totalRoomsToClear);
    if (isNaN(totalRooms) || totalRooms < 1) {
      return { isValid: false, error: '踏破部屋数 (totalRoomsToClear) は1以上の数値である必要があります。' };
    }

    // 部屋数を安全な範囲（3〜50）にクランプ
    const clampedRooms = Math.max(3, Math.min(50, totalRooms));

    // IDの検証・安全プレフィックス付与
    let scenarioId = typeof data.id === 'string' && data.id.trim() ? data.id.trim() : '';
    if (!scenarioId.startsWith('custom_')) {
      scenarioId = `custom_${scenarioId || generateId()}`;
    }

    // ボスイベントの検証
    if (!data.bossEvent || typeof data.bossEvent !== 'object') {
      return { isValid: false, error: '決戦ボスイベント (bossEvent) が設定されていません。' };
    }

    const safeBossEnemies = Array.isArray(data.bossEvent.enemies) ? data.bossEvent.enemies.map((e: any, idx: number) => ({
      id: e.id || `boss_${idx}`,
      name: String(e.name || '決戦の魔王'),
      level: Math.max(1, Math.min(20, Number(e.level) || 5)),
      lifeMax: Math.max(1, Math.min(100, Number(e.lifeMax) || 10)),
      lifeCurrent: Math.max(1, Math.min(100, Number(e.lifeMax) || 10)),
      attackCount: Math.max(1, Math.min(5, Number(e.attackCount) || 1)),
      tags: Array.isArray(e.tags) ? e.tags : ['strong'],
      count: 1,
      weaponAttribute: e.weaponAttribute || 'strike'
    })) : [{
      id: 'boss_0',
      name: '迷宮の主',
      level: 5,
      lifeMax: 10,
      lifeCurrent: 10,
      attackCount: 1,
      tags: ['strong'],
      count: 1,
      weaponAttribute: 'strike'
    }];

    const safeBossEvent: DungeonEvent = {
      title: String(data.bossEvent.title || '決戦の扉'),
      d66Code: 'boss',
      description: String(data.bossEvent.description || '最深部に待ち受ける迷宮の主との最終決戦です。'),
      type: 'encounter',
      enemies: safeBossEnemies
    };

    // d66イベント表の検証 ＆ 36部屋完全網羅
    const safeEventTable: Record<string, DungeonEvent> = {};
    const rawTable = data.d66EventTable || {};

    for (const code of ALL_D66_CODES) {
      const room = rawTable[code];
      if (room && typeof room === 'object') {
        const roomType = ['encounter', 'trap', 'rest', 'treasure', 'empty', 'npc'].includes(room.type)
          ? room.type
          : 'empty';

        const safeEnemies = roomType === 'encounter' && Array.isArray(room.enemies)
          ? room.enemies.map((e: any, idx: number) => ({
              id: e.id || `enemy_${code}_${idx}`,
              name: String(e.name || '魔物'),
              level: Math.max(1, Math.min(20, Number(e.level) || 1)),
              lifeMax: Math.max(1, Math.min(100, Number(e.lifeMax) || 1)),
              lifeCurrent: Math.max(1, Math.min(100, Number(e.lifeMax) || 1)),
              attackCount: Math.max(1, Math.min(5, Number(e.attackCount) || 1)),
              tags: Array.isArray(e.tags) ? e.tags : ['weak'],
              count: Math.max(1, Math.min(10, Number(e.count) || 1)),
              weaponAttribute: e.weaponAttribute || 'strike'
            }))
          : undefined;

        safeEventTable[code] = {
          title: String(room.title || `第 ${code} の部屋`),
          d66Code: code,
          description: String(room.description || '静かな石造りの部屋が広がっています。'),
          type: roomType,
          enemies: safeEnemies,
          trapStat: room.trapStat,
          trapTarget: room.trapTarget !== undefined ? Number(room.trapTarget) : undefined,
          trapDamage: room.trapDamage !== undefined ? Number(room.trapDamage) : undefined,
          lootModifier: room.lootModifier !== undefined ? Number(room.lootModifier) : undefined,
          npcType: room.npcType
        };
      } else {
        // 未定義のマスは安全な空室イベントで補完
        safeEventTable[code] = {
          title: `静かな通路 (${code})`,
          d66Code: code,
          description: '苔むした石畳が続く静かな通路です。特に何も見当たりません。',
          type: 'empty'
        };
      }
    }

    const sanitizedScenario: Scenario = {
      id: scenarioId,
      title: data.title.trim(),
      description: String(data.description || 'プレイヤーによって作成されたカスタムシナリオ。'),
      recommendedLevel: String(data.recommendedLevel || '適正レベル：11-12'),
      totalRoomsToClear: clampedRooms,
      d66EventTable: safeEventTable,
      bossEvent: safeBossEvent
    };

    return { isValid: true, scenario: sanitizedScenario };
  }

  // シナリオの保存（作成 or 更新）
  async function saveCustomScenario(scenario: Scenario): Promise<{ success: boolean; error?: string }> {
    const val = validateScenario(scenario);
    if (!val.isValid || !val.scenario) {
      return { success: false, error: val.error || '検証に失敗しました。' };
    }

    const cleanScenario = val.scenario;
    const existingIdx = customScenarios.value.findIndex(s => s.id === cleanScenario.id);

    if (existingIdx !== -1) {
      customScenarios.value[existingIdx] = cleanScenario;
    } else {
      customScenarios.value.push(cleanScenario);
    }

    persistToLocalStorage();

    // Firebase ログイン中なら Firestore にもバックアップ
    if (db && currentUser.value) {
      try {
        const scenarioDocRef = doc(db, 'users', currentUser.value.uid, 'custom_scenarios', cleanScenario.id);
        await setDoc(scenarioDocRef, {
          ...cleanScenario,
          updatedAt: new Date()
        });
      } catch (e: any) {
        console.warn('[useCustomScenarios] Failed to backup to Firestore:', e);
      }
    }

    return { success: true };
  }

  // シナリオの削除
  async function deleteCustomScenario(scenarioId: string): Promise<void> {
    const idx = customScenarios.value.findIndex(s => s.id === scenarioId);
    if (idx !== -1) {
      customScenarios.value.splice(idx, 1);
      persistToLocalStorage();

      if (db && currentUser.value) {
        try {
          const scenarioDocRef = doc(db, 'users', currentUser.value.uid, 'custom_scenarios', scenarioId);
          await deleteDoc(scenarioDocRef);
        } catch (e) {
          console.warn('[useCustomScenarios] Failed to delete from Firestore:', e);
        }
      }
    }
  }

  // JSONファイルとしてダウンロード (エクスポート)
  function exportScenarioAsJson(scenario: Scenario): void {
    const jsonStr = JSON.stringify(scenario, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${scenario.id}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // JSONファイルまたはテキストからインポート
  async function importScenarioFromJson(fileOrText: File | string): Promise<{ success: boolean; scenario?: Scenario; error?: string }> {
    try {
      let content = '';
      if (typeof fileOrText === 'string') {
        content = fileOrText;
      } else {
        // ファイルサイズ制限 (300KB以下)
        if (fileOrText.size > 300 * 1024) {
          return { success: false, error: 'ファイルサイズが大きすぎます (上限: 300KB)。' };
        }
        content = await fileOrText.text();
      }

      const parsed = JSON.parse(content);
      const val = validateScenario(parsed);
      if (!val.isValid || !val.scenario) {
        return { success: false, error: val.error || 'シナリオのデータ形式が不正です。' };
      }

      // ID重複時は新IDを付与
      if (customScenarios.value.some(s => s.id === val.scenario!.id)) {
        val.scenario.id = `custom_${generateId()}`;
      }

      await saveCustomScenario(val.scenario);
      return { success: true, scenario: val.scenario };
    } catch (e: any) {
      return { success: false, error: `JSONの解析に失敗しました: ${e.message}` };
    }
  }

  // 既存シナリオから複製 (クローン)
  function cloneFromExisting(source: Scenario): Scenario {
    const cloned = JSON.parse(JSON.stringify(source));
    cloned.id = `custom_${generateId()}`;
    cloned.title = `${source.title} (コピー)`;
    return cloned;
  }

  // 標準ダンジョン構成で自動生成 (ひな形)
  function createDefaultTemplate(): Scenario {
    const scenarioId = `custom_${generateId()}`;
    const eventTable: Record<string, DungeonEvent> = {};

    ALL_D66_CODES.forEach((code, index) => {
      // 部屋タイプの比率配分 (遭遇40%, 罠25%, 宝物15%, NPC10%, 休息10%)
      const mod = index % 10;
      if (mod <= 3) {
        // モンスター遭遇
        const isUndead = mod % 2 === 0;
        eventTable[code] = {
          title: isUndead ? `墓所の影 (${code})` : `洞窟の徘徊者 (${code})`,
          d66Code: code,
          description: isUndead 
            ? '冷気漂う部屋の隅から、骨のきしむ音が響いてきました！' 
            : '部屋の中央で好戦的な魔物がこちらを威嚇しています！',
          type: 'encounter',
          enemies: [
            {
              name: isUndead ? 'スケルトン歩兵' : '地下ゴブリン',
              level: 2,
              lifeMax: 1,
              lifeCurrent: 1,
              attackCount: 1,
              tags: isUndead ? ['weak', 'undead'] : ['weak'],
              count: 2,
              weaponAttribute: 'slash'
            }
          ]
        };
      } else if (mod <= 5) {
        // 罠
        eventTable[code] = {
          title: `仕掛け罠の部屋 (${code})`,
          d66Code: code,
          description: '足元に巧妙なワイヤーが張り巡らされています！',
          type: 'trap',
          trapStat: 'dexterity',
          trapTarget: 4,
          trapDamage: 1
        };
      } else if (mod <= 7) {
        // 宝物
        eventTable[code] = {
          title: `古い宝箱 (${code})`,
          d66Code: code,
          description: '部屋の奥に頑丈な木箱が残されています。',
          type: 'treasure',
          lootModifier: 0
        };
      } else if (mod === 8) {
        // NPC / 行商人
        eventTable[code] = {
          title: `地下の行商人 (${code})`,
          d66Code: code,
          description: '旅の商人がランプを灯して商品を並べています。',
          type: 'npc',
          npcType: 'merchant'
        };
      } else {
        // 休息
        eventTable[code] = {
          title: `安全な小部屋 (${code})`,
          d66Code: code,
          description: '頑丈な扉で守られた静かな小部屋です。一息つくことができます。',
          type: 'rest'
        };
      }
    });

    const bossEvent: DungeonEvent = {
      title: '決戦の回廊',
      d66Code: 'boss',
      description: '迷宮の最深部。玉座に座る漆黒の騎士が立ち上がりました！',
      type: 'encounter',
      enemies: [
        {
          name: '迷宮の魔将',
          level: 5,
          lifeMax: 8,
          lifeCurrent: 8,
          attackCount: 2,
          tags: ['strong'],
          count: 1,
          weaponAttribute: 'slash'
        }
      ]
    };

    return {
      id: scenarioId,
      title: '名もなき地下迷宮',
      description: '新たに発見された未開の迷宮。未知の脅威とお宝が眠る。',
      recommendedLevel: calculateRecommendedLevel({ totalRoomsToClear: 8, d66EventTable: eventTable, bossEvent }),
      totalRoomsToClear: 8,
      d66EventTable: eventTable,
      bossEvent
    };
  }

  // クラウド（Firestore）からの同期復元
  async function syncFromCloud(): Promise<number> {
    if (!db || !currentUser.value) return 0;
    try {
      const colRef = collection(db, 'users', currentUser.value.uid, 'custom_scenarios');
      const snap = await getDocs(colRef);
      let count = 0;
      snap.forEach(docSnap => {
        const data = docSnap.data();
        const val = validateScenario(data);
        if (val.isValid && val.scenario) {
          const idx = customScenarios.value.findIndex(s => s.id === val.scenario!.id);
          if (idx !== -1) {
            customScenarios.value[idx] = val.scenario;
          } else {
            customScenarios.value.push(val.scenario);
          }
          count++;
        }
      });
      if (count > 0) {
        persistToLocalStorage();
      }
      return count;
    } catch (e) {
      console.warn('[useCustomScenarios] Failed to sync from cloud:', e);
      return 0;
    }
  }

  return {
    customScenarios,
    validateScenario,
    saveCustomScenario,
    deleteCustomScenario,
    exportScenarioAsJson,
    importScenarioFromJson,
    createDefaultTemplate,
    cloneFromExisting,
    syncFromCloud,
    calculateRecommendedLevel
  };
}
