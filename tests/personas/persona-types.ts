/**
 * ペルソナ別E2Eシミュレーションテスト用 型定義
 */

export type Archetype = 'warrior' | 'archer' | 'mage' | 'cleric';

export interface PersonaConfig {
  /** ペルソナ識別名 */
  id: string;
  /** キャラクター名 */
  name: string;
  /** 選択するアーキタイプ */
  archetype: Archetype;
  /** アーキタイプの表示名（選択用） */
  archetypeCardText: string;
  /** 食料回復を行う残り生命力の閾値 */
  healHpThreshold: number;
  /** 戦闘時の行動嗜好 */
  combatPreference: 'melee_focused' | 'ranged_focused' | 'spell_focused' | 'balanced';
  /** トラップ・判定時の副能力値消費ポリシー */
  preferSubStatForChecks: boolean;
  /** 察知判定を行うかどうか（器用射手など） */
  preferPerception: boolean;
  /** 従者に対するかばう行動を行うかどうか */
  preferCover: boolean;
}
