import type { Enemy } from '../types';

/**
 * Resolve an NPC display name from the scenario event title, falling back to a default label.
 */
export function getNpcDisplayName(eventTitle: string | undefined, fallback: string): string {
  const trimmed = eventTitle?.trim();
  return trimmed || fallback;
}

/**
 * Build log and resolution messages when paying a bribe to a `bribe` NPC.
 */
export function buildBribePaymentMessages(eventTitle: string | undefined): {
  logText: string;
  resolutionText: string;
} {
  const npcName = getNpcDisplayName(eventTitle, 'ゴブリンの交渉人');
  return {
    logText: `${npcName}に金貨5枚のワイロを支払いました。`,
    resolutionText: `🪙 ${npcName}に金貨5枚のワイロを支払い、穏便に道を通して（見逃して）もらいました。`,
  };
}

/**
 * Build the enemy instance and combat-start log when rejecting a `bribe` NPC.
 */
export function buildBribeCombatEncounter(
  eventTitle: string | undefined,
  enemyId: string
): {
  enemy: Enemy;
  logText: string;
} {
  const enemyName = getNpcDisplayName(eventTitle, 'ゴブリンの交渉人');
  return {
    enemy: {
      id: enemyId,
      name: enemyName,
      level: 3,
      lifeMax: 2,
      lifeCurrent: 2,
      attackCount: 1,
      tags: ['strong'],
      count: 1,
    },
    logText: `⚔️ 交渉決裂！${enemyName}が襲いかかってきました！`,
  };
}

/**
 * Build the resolution text for a `priest` NPC encounter.
 */
export function buildPriestResolutionText(
  eventTitle: string | undefined,
  choice: 'heal' | 'holywater'
): string {
  const npcName = getNpcDisplayName(eventTitle, '巡礼の僧侶');
  if (choice === 'heal') {
    return `${npcName}から神聖な癒やしを施され、パーティの生命力が全回復しました！`;
  }
  return `${npcName}から魔を退ける「聖水」を1つ譲り受けました！`;
}

/**
 * Build the resolution text for a `mercenary` NPC encounter.
 */
export function buildMercenaryResolutionText(
  eventTitle: string | undefined,
  save: boolean
): string {
  const npcName = getNpcDisplayName(eventTitle, '傷ついた傭兵');
  if (save) {
    return `金貨7枚を払い${npcName}を治療しました！ 新たに従者「剣士」が仲間に加わりました。`;
  }
  return `${npcName}を見捨てて先を急ぎます。アランツァの冷酷な現実です。`;
}
