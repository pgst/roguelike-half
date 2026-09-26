# シナリオ定義・エディタ ＆ プラグイン仕様書 (Scenario System Specification)

本ドキュメントは、`roguelike-half` におけるシナリオデータ構造、ブラウザ版シナリオ工房（エディタ）、適正レベル自動計算アルゴリズム、およびシナリオ拡張プラグイン機構について定義する技術仕様書です。

---

## 1. シナリオデータ仕様 (JSON Schema)

本ゲームのシナリオはすべて独立した JSON 形式で定義され、外部ファイルからのインポートやエクスポート、および動的な追加が可能です。

### 1.1 シナリオのルート構造 (`Scenario` 型)

```typescript
export interface Scenario {
  id: string;                      // シナリオの一意識別子 (例: "catacombs_of_the_dead", "custom_xxx")
  title: string;                   // シナリオ名
  author?: string;                 // 作者名
  description: string;             // シナリオのあらすじ・解説
  totalRoomsToClear: number;       // クリアに必要な踏破部屋数 (標準: 8部屋)
  recommendedLevel: string;        // 適正レベル帯 (例: "適正レベル：11-12")
  theme?: string;                  // ダンジョンの雰囲気・テーマ
  d66EventTable: Record<string, DungeonEvent>; // d66 (11〜66) の部屋イベント辞書
  bossEvent: DungeonEvent;         // 最終部屋で発生する決戦ボスイベント
}
```

### 1.2 部屋イベント定義 (`DungeonEvent` 型)

```typescript
export interface DungeonEvent {
  id: string;                      // イベントID (例: "room_11", "boss_event")
  name: string;                    // 部屋名 / イベント名
  description: string;             // 部屋の状況・情景描写テキスト
  type: 'combat' | 'trap' | 'loot' | 'special'; // イベント種別
  enemies?: Enemy[];               // 遭遇する敵のリスト
  trap?: TrapEvent;                // 発生する罠・危険
  rewards?: Reward[];              // 部屋クリア時に得られる報酬
  choices?: EventChoice[];         // プレイヤーの選択肢分岐
  specialActionId?: string;        // プラグインで処理する特殊アクションID
}
```

### 1.3 エネミー定義 (`Enemy` 型)

```typescript
export interface Enemy {
  id: string;                      // エネミーID
  name: string;                    // エネミー名
  level: number;                   // モンスターレベル (戦闘判定の基準値)
  attackCount?: number;            // 攻撃回数 (通常: 1回, 強敵ボス: 2回以上)
  lifeMax?: number;                // 生命力 (ボスまたは強敵用, 雑魚敵は通常1撃)
  lifeCurrent?: number;            // 現在生命力
  tags?: string[];                 // 属性タグ (例: ["undead", "strong", "boss"])
  specialAbility?: string;         // 特殊能力の説明テキスト
}
```

---

## 2. シナリオ工房（エディタ機能）

ブラウザ上でオリジナルシナリオを直感的に作成・編集・検証できる統合エディタ環境（`ScenarioEditor.vue`）を提供しています。

### 2.1 主な機能
- **ビジュアル編集**:
  - タイトル、説明文、クリア部屋数（6〜15部屋）の設定。
  - d66テーブル（全36部屋）の個別設定（敵・罠・宝物・特殊イベント）。
  - 最深部ボスイベントのパラメータ設定（HP、レベル、攻撃回数、属性タグ）。
- **リアルタイム適正レベル診断**:
  - 編集中の部屋数、敵の強さ、ボスの脅威度から適正レベルをリアルタイムに自動計算し、ワンクリックでシナリオデータに反映。
- **インポート / エクスポート**:
  - 作成したシナリオを標準 `.json` ファイルとしてローカル保存。
  - 配布されたJSONシナリオの読み込みと即時プレイ。
- **データ永続化**:
  - `localStorage` に自動保存され、Google連携時は Firestore（`users/{uid}/custom_scenarios`）を介して別端末とも自動同期。

---

## 3. 適正レベル自動計算アルゴリズム

シナリオの難易度（適正レベル帯）は、客観的なゲームバランス指標に基づき以下の数理モデル（`calculateRecommendedLevel`）によって自動算出されます。

```typescript
export function calculateRecommendedLevel(scenario: Partial<Scenario>): string {
  const rooms = scenario.totalRoomsToClear || 8;
  const boss = scenario.bossEvent?.enemies?.[0] || {};
  const bHp = Math.max(boss.lifeMax || 5, 1);
  const bAtk = Math.max(boss.attackCount || 1, 1);
  const bLvl = Math.max(boss.level || 5, 1);
  const bTags = boss.tags || [];

  // アンデッド強敵ボスは聖水（器用目標4で大ダメージ）が有効なためHP負担が軽減される
  const isUndeadBoss = bTags.includes('undead') && bTags.includes('strong');
  const effectiveHp = isUndeadBoss ? bHp * 0.5 : bHp;

  // 36部屋の道中敵の平均レベルと強敵数
  const levels: number[] = [];
  let strongMooks = 0;
  if (scenario.d66EventTable) {
    for (const ev of Object.values(scenario.d66EventTable)) {
      if (ev?.enemies) {
        for (const e of ev.enemies) {
          levels.push(e.level || 2);
          if (e.tags?.includes('strong') || (e.lifeMax && e.lifeMax >= 2)) {
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

  if (score < 11.2) return '適正レベル：10-11';
  if (score < 12.5) return '適正レベル：11-12';
  if (score < 14.0) return '適正レベル：12-13';
  if (score < 18.0) return '適正レベル：13-15';
  return '適正レベル：15以上';
}
```

### スコアリング要素の解説:
1. **リソース消耗度（部屋数）**: 部屋数が増えるほど食料・生命力・技量点の消耗リスクが高まるため、基準（6部屋）からの増加に応じてスコアを加算。
2. **道中エンカウント率**: 36部屋全体の平均レベルおよび複数HPを持つ強敵の出現頻度を評価。
3. **ボスの撃破難度**: ボスの最大HP、攻撃回数、基本レベルから算出。特効アイテム（聖水等）が有効なアンデッド属性については実効HPを半減補正して評価。

---

## 4. シナリオ拡張プラグイン機構 (`scenarioPlugins`)

標準のゲームルールでは表現できないシナリオ固有の特殊ギミック（例: 周回要素、特殊ボスのHP引き継ぎ、特定部屋の環境効果）を実現するため、フックディスパッチャーによるプラグインアーキテクチャを採用しています。

### 4.1 プラグインインターフェース (`ScenarioPlugin`)

```typescript
export interface ScenarioPlugin {
  scenarioId: string;
  onSessionInit?(session: GameSession): void;
  onRoomEnter?(context: { roomNumber: number; session: GameSession }): void;
  onCombatRoundStart?(context: { combatState: CombatState; session: GameSession }): void;
  onCombatVictory?(context: { enemy: Enemy; session: GameSession }): void;
  onAdventureSuccess?(session: GameSession): void;
  customActionHandler?(actionId: string, context: { session: GameSession }): boolean;
}
```

### 4.2 実装例: 『刻の悪魔のピラミッド』プラグイン (`pyramidPlugin.ts`)
- **周回カウント管理**: ピラミッド迷宮からの脱出回数（`pyramidRunCount`）をセッション内で追跡。
- **ボスのHP引き継ぎ**: 途中で脱出した場合でも、過去の周回でボスに与えたダメージを次回探索へ維持（スナップショット機能）。
- **特殊環境効果**: 毎ラウンド開始時に「時の砂」による技量・生命力スリップダメージをプラグインフック内で自動判定。
