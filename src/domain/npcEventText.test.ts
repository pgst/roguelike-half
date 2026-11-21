import { describe, it, expect } from 'vitest';
import {
  getNpcDisplayName,
  buildBribePaymentMessages,
  buildBribeCombatEncounter,
  buildPriestResolutionText,
  buildMercenaryResolutionText,
} from './npcEventText';

describe('npcEventText helpers (Issue #8)', () => {
  describe('getNpcDisplayName', () => {
    it('uses trimmed event title when present and falls back when empty or undefined', () => {
      expect(getNpcDisplayName('雪男の門番', 'ゴブリンの交渉人')).toBe('雪男の門番');
      expect(getNpcDisplayName('  雪男の門番  ', 'ゴブリンの交渉人')).toBe('雪男の門番');
      expect(getNpcDisplayName('', 'ゴブリンの交渉人')).toBe('ゴブリンの交渉人');
      expect(getNpcDisplayName('   ', 'ゴブリンの交渉人')).toBe('ゴブリンの交渉人');
      expect(getNpcDisplayName(undefined, 'ゴブリンの交渉人')).toBe('ゴブリンの交渉人');
    });
  });

  describe('bribe NPC messages and enemy', () => {
    it('preserves exact wording for Aranzas (ゴブリンの交渉人)', () => {
      const payment = buildBribePaymentMessages('ゴブリンの交渉人');
      expect(payment.logText).toBe('ゴブリンの交渉人に金貨5枚のワイロを支払いました。');
      expect(payment.resolutionText).toBe(
        '🪙 ゴブリンの交渉人に金貨5枚のワイロを支払い、穏便に道を通して（見逃して）もらいました。'
      );

      const combat = buildBribeCombatEncounter('ゴブリンの交渉人', 'enemy-1');
      expect(combat.enemy).toEqual({
        id: 'enemy-1',
        name: 'ゴブリンの交渉人',
        level: 3,
        lifeMax: 2,
        lifeCurrent: 2,
        attackCount: 1,
        tags: ['strong'],
        count: 1,
      });
      expect(combat.logText).toBe('⚔️ 交渉決裂！ゴブリンの交渉人が襲いかかってきました！');
    });

    it('uses scenario title for Ice Tower (雪男の門番) and Black Serpent (知性あるコボルドの隠者)', () => {
      const icePayment = buildBribePaymentMessages('雪男の門番');
      expect(icePayment.logText).toBe('雪男の門番に金貨5枚のワイロを支払いました。');
      expect(icePayment.resolutionText).toBe(
        '🪙 雪男の門番に金貨5枚のワイロを支払い、穏便に道を通して（見逃して）もらいました。'
      );

      const iceCombat = buildBribeCombatEncounter('雪男の門番', 'enemy-ice');
      expect(iceCombat.enemy.name).toBe('雪男の門番');
      expect(iceCombat.enemy.level).toBe(3);
      expect(iceCombat.enemy.lifeMax).toBe(2);
      expect(iceCombat.logText).toBe('⚔️ 交渉決裂！雪男の門番が襲いかかってきました！');

      const serpentCombat = buildBribeCombatEncounter('知性あるコボルドの隠者', 'enemy-serpent');
      expect(serpentCombat.enemy.name).toBe('知性あるコボルドの隠者');
      expect(serpentCombat.logText).toBe(
        '⚔️ 交渉決裂！知性あるコボルドの隠者が襲いかかってきました！'
      );
    });
  });

  describe('priest NPC resolution text', () => {
    it('uses scenario event title for heal and holywater choices', () => {
      expect(buildPriestResolutionText('幽閉された雪原の司祭', 'heal')).toBe(
        '幽閉された雪原の司祭から神聖な癒やしを施され、パーティの生命力が全回復しました！'
      );
      expect(buildPriestResolutionText('幽閉された雪原の司祭', 'holywater')).toBe(
        '幽閉された雪原の司祭から魔を退ける「聖水」を1つ譲り受けました！'
      );
      expect(buildPriestResolutionText(undefined, 'heal')).toBe(
        '巡礼の僧侶から神聖な癒やしを施され、パーティの生命力が全回復しました！'
      );
    });
  });

  describe('mercenary NPC resolution text', () => {
    it('uses scenario event title for ignore and save choices while preserving Aranzas ignore wording', () => {
      expect(buildMercenaryResolutionText('傷ついた傭兵', false)).toBe(
        '傷ついた傭兵を見捨てて先を急ぎます。アランツァの冷酷な現実です。'
      );
      expect(buildMercenaryResolutionText('遭難した雪山猟師', false)).toBe(
        '遭難した雪山猟師を見捨てて先を急ぎます。アランツァの冷酷な現実です。'
      );
      expect(buildMercenaryResolutionText('遭難した雪山猟師', true)).toBe(
        '金貨7枚を払い遭難した雪山猟師を治療しました！ 新たに従者「剣士」が仲間に加わりました。'
      );
    });
  });
});
