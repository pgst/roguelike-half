# `src/` コードレビューレポート（2026-11-21）

## 冒頭サマリー

### 現状確認（ビルド・単体テスト実行結果）
本レビュー時点での `src/` 全体（TypeScript / Vue ファイル合計 25,002 行）に対するビルドおよび単体テストの実行結果は以下のとおりである。

- **`npm run build`**（`vue-tsc -b && vite build`）: **成功**
  - 101 モジュールを変換（502ms）。
  - ただし出力バンドル `dist/assets/index-C_WuWgHb.js` が `1,110.62 kB`（gzip: `323.91 kB`）となり、Vite の 500 kB チャンクサイズ警告が発生している。
- **`npm run test:unit`**（`vitest run`）: **全件通過（3 ファイル / 15 テスト、1.91s）**
  - `src/domain/random.test.ts`: 7 tests passed
  - `src/domain/index.test.ts`: 7 tests passed
  - `src/domain/balance-simulation.test.ts`: 1 test passed（なお実行ログ上、Node 環境のため `localStorage` 未提供の `ExperimentalWarning` と、Aranzas シナリオ 30 試行で Victories 0 / Defeats 30 の出力が確認された）

### 総評
TRPG『ローグライクハーフ』の複雑な判定・戦闘・周回シナリオ・クラウド同期までブラウザ上で動作する形で網羅されており、基本ルールは E2E スイート（`tests/rules/`）で広く検証されている。一方で、機能追加の積み重ねにより以下の構造的課題が顕在化している。

1. **型境界の崩壊**: `src/` 全体で `any` が **371 件**使用されており（`@ts-ignore` / `@ts-expect-error` / `@ts-nocheck` / `eslint-disable` は 0 件）、特に `pyramidPlugin.ts`（149 件）、`useDungeon.ts`（42 件）、`useCombat.ts`（39 件）、`DungeonExplorer.vue`（36 件）、`useGameState.ts`（28 件）に集中している。結果として未定義プロパティ参照やコンテキスト引数の欠落をコンパイル時に検知できていない。
2. **巨大ファイルとレイヤ境界の曖昧さ**: 1,000 行超のファイルが **10 ファイル**存在し、最長の `src/composables/useGameState.ts` は 2,542 行に達する。また UI コンポーネント（`DungeonExplorer.vue`, `App.vue`, `CombatSimulator.vue`）がドメイン状態の直接書き換えやシナリオ固有ロジックを抱え込んでいる。
3. **ドメインロジック・状態定義の二重化と不整合**: `src/domain/index.ts` と `src/composables/useGameState.ts` の間で `createDefaultCombatState()` や装備・回復ロジックが重複して食い違っているほか、1d6 判定・暗闇ペナルティ・ショップ処理などが複数ファイルにコピペされている。
4. **プラグイン連携・戦闘フロー上の実バグ**: 「そらし」「かばう」「囮の風船」「従者魔術師の速撃」「防具廃棄時の生命力再計算」などに進行不能・効果未発動・状態不整合を引き起こすバグの兆候が複数確認された。
5. **単体テストの空白地帯**: Vitest テストは `src/domain/` の 3 ファイル（15 件）のみで、ゲームの中核を担う `src/composables/` や `src/composables/scenarioPlugins/` には独立した単体テストが一切存在しない。

### 優先的に直すべき Top 5
1. **戦闘フローの進行・状態不整合バグの修正（重要度：高）**
   - `skipDeflect` による防御ダイスの二重ロール、`executeDeflect` の未定義 `combatState.roundActive` 代入によるラウンド終了効果スキップ、`executeCover` / `cancelCover` での `handleRoundEndEffects()` 欠落、`resolveDefense` / `resolveLoot` の連打競合を最優先で修正する。
2. **セーブデータ・ドメインモデル・`combatState` の単一ソース化と永続化漏れ修正（重要度：高）**
   - `domain/index.ts` と `useGameState.ts` で分裂している `createDefaultCombatState()`・装備/消費ロジックを一本化し、モジュール変数（`potionUsedThisAdventure`, `hunterQuestAccepted`, `identificationTagUsed`）を `GameSession` に統合してリロード時のリセット不整合をなくす。
3. **プラグインコンテキストとシナリオ固有ロジックの契約統一（重要度：高）**
   - 5 箇所に散らばる `ScenarioPluginContext` 生成を共通ファクトリ化して `handleDeath` 欠落によるクラッシュを防ぎ、`twilightKnightPlugin.ts` の発動しない「囮の風船」・無効な `modAttack`・HP0 死亡チェック漏れ、および `DungeonExplorer.vue` に混在したピラミッド固有イベントを整理する。
4. **外部境界（Firestore・localStorage・JSON）の型検証とエラーハンドリング強化（重要度：高）**
   - `GameSession.saveToLocalStorage()` / `useSettings.ts` の `try/catch` 追加、Firestore 読み書き時のスキーマ検証（`as any` 排除）と同期失敗の適切な状態通知、`ScenarioSelector.vue` の `await initAuth()` 漏れによる初回同期レースコンディションを解消する。
5. **巨大ファイル（`useGameState.ts`, `DungeonExplorer.vue`, `App.vue`, `pyramidPlugin.ts`, `useCombat.ts`）の責務分割と単体テスト導入（重要度：中〜高）**
   - 純粋計算（d6 判定・ダメージ/修正値計算・バックパック容量）を `src/domain/` に切り出して Vitest で直接テスト可能にし、UI と状態管理を分離する。

---

## 観点ごとの指摘

### 1. 型安全性

> 集計結果：`src/` 配下で `\bany\b` は **371 件**（`@ts-ignore` / `@ts-expect-error` / `@ts-nocheck` / `eslint-disable` は **0 件**）。

#### [重要度：高] Firestore・セーブデータ・JSON 外部境界における無検証の `any` 受け渡し
- **場所**:
  - `src/composables/useCloudSync.ts:46, 57, 178, 188-189`
  - `src/domain/index.ts:239, 285, 290, 293, 300, 366`
  - `src/composables/useCustomScenarios.ts:111, 139, 181, 233, 250-251`
- **根拠**:
  ```ts
  // src/composables/useCloudSync.ts:188-189
  const data = snap.data();
  const restored = new GameSession(data);
  ```
  `GameSession` コンストラクタは `constructor(data?: any)`（`src/domain/index.ts:293`）となっており、`snap.data()` や `JSON.parse(jsonStr)`（`src/domain/index.ts:366`）を構造検証（ランタイム型ガード）なしにそのまま信用している。`useCloudSync.ts:46, 178` も `sanitizeForCloud(session: GameSession): any` や `characterRecord: any` を返すため、クラウド保存データのスキーマ変更や破損が型チェックを通過してしまう。`useCustomScenarios.ts:111` も `validateScenario(data: any)` 内部で `e: any` に依存し、`bossEvent.enemies` や `d66EventTable` の各プロパティを `unknown` として安全に絞り込めていない。
- **改善案**: 外部データ境界（`localStorage`, Firestore, JSON インポート）には `unknown` 型を受け取るランタイムバリデータ（Zod 等の導入または軽量な型ガード関数）を配置し、`GameSession` や `Scenario` の必須フィールド・型・値域を検証したうえで構築する。

#### [重要度：高] `ScenarioPluginContext` と戦闘モジュール間の `any` による未定義プロパティ見逃し
- **場所**:
  - `src/composables/scenarioPlugins/index.ts:16-17, 33, 48, 53, 94-104`
  - `src/composables/combat/useCombatEnemy.ts:7, 12`
  - `src/composables/combat/useCombatLoot.ts:8, 10`
  - `src/composables/combat/useCombatMagic.ts:8, 11`
- **根拠**:
  ```ts
  // src/composables/scenarioPlugins/index.ts:16-17, 99-104
  combatState: any;
  currentScreen: Ref<any>;
  ...
  if ((plugin as any).updateHelpers) {
    (plugin as any).updateHelpers(context);
  }
  const fn = plugin[hook] as any;
  ```
  `combatState` が `ScenarioPluginContext` および全戦闘サブモジュール（`useCombatEnemy`, `useCombatLoot`, `useCombatMagic`）で `any` になっているため、存在しないプロパティ `combatState.roundActive` への代入（`useCombatMagic.ts:645`）や未宣言プロパティへの読み書きを TypeScript が検出できていない。`runScenarioHook` も引数を `...extraArgs: any[]`、戻り値を `any` としておりフックの型契約が機能していない。
- **改善案**: `src/types/index.ts` に `CombatState`, `CombatAttackItem`（`normal` / `wind` / `evil_eye` / `slash_eye` / `mad_eye` / `spacetime_fang_*` の判別共用体）、`CustomChoice`, `ScreenType` を定義し、`ScenarioPluginContext` と `Combat*Dependencies` から `any` を撤廃する。`runScenarioHook` は `Parameters<NonNullable<ScenarioPlugin[K]>>` と `ReturnType` を用いて型推論させる。

#### [重要度：中] 型定義済みのプロパティに対する過剰な `as any` キャストの横行
- **場所**:
  - `src/composables/useDungeon.ts:185-186, 428-436, 466-484, 703-712, 830-839, 892, 974, 1022, 1031`
  - `src/components/DungeonExplorer.vue:142-143, 297-298, 317-318, 618-619, 939, 947, 1077`
  - `src/composables/useCombat.ts:98, 196, 734, 739, 766, 987, 1045, 1095, 1218, 1237, 1286`
  - `src/components/CombatSimulator.vue:148, 190, 198`
- **根拠**: `DungeonEvent`（`src/types/index.ts:137-139`）には既に `isResolved?: boolean`, `resolutionText?: string`, `statusEffect?: string` が定義されており、`createDefaultCombatState()`（`src/composables/useGameState.ts:131-163`）には `shireenClueSpent`, `activeAttacks`, `isStunned`, `pendingRoarCheck`, `pendingCover.isRanged` 等が既に定義されているにもかかわらず、参照側で大量に `(activeEvent.value as any)` や `(combatState as any)` が使われている。一方、`isChestUnlocked`, `isTrapChestFailed`, `trapTargetScope` 等は `DungeonEvent` 型に未定義なため `as any` を増やしている。
- **改善案**: `DungeonEvent` / `Character` / `CombatState` に不足フィールド（またはシナリオプラグイン用の型付き拡張領域 `pluginFlags?: Record<string, unknown>`）を正式に追加し、既存型と重複する `as any` を一括削除する。

#### [重要度：中] `pyramidPlugin.ts`（149 件）および `types/index.ts` の `any` 集中
- **場所**:
  - `src/composables/scenarioPlugins/pyramidPlugin.ts:12, 33, 39-40, 62, 113, 145, 160-197, 236, 322, 451-527, 1090-1747`
  - `src/types/index.ts:140, 197, 199`
- **根拠**: `src/types/index.ts:140, 197, 199` で `customChoices?: any[]`, `recipes: any[]`, `prologues?: any` が `any` のため、`pyramidPlugin.ts` 内でイベント構築・選択肢コールバック・敵攻撃キュー・エピローグ参照が全て型なしになり、結果として存在しない敵タグ `'monster'`（`pyramidPlugin.ts:1669`）、存在しない従者タイプ `'hunter'` / `'wandering_merchant'`（`108, 1512`）、`description` のタイポ `desc:`（`1518`）などを生み出している。
- **改善案**: `CustomChoice`, `SliderRecipe`, `ScenarioPrologue` 型を `src/types/index.ts` に定義し、`pyramidPlugin.ts` の独自拡張データ（`pyramidOrigin`, `pyramidFinal1Step` 等）を専用型で管理する。

#### [重要度：低] `random.ts` と `useGameState.ts` における `window` / `globalThis` の無型キャスト
- **場所**:
  - `src/domain/random.ts:84-90, 103-111`
  - `src/composables/useGameState.ts:967-969, 1010-1011, 1049-1050, 2408-2411, 2525`
- **根拠**: `(window as any).__mockRolls` 等が参照ごとに `as any` でキャストされている。
- **改善案**: `src/types/global.d.ts` 等で `Window` / `globalThis` の拡張プロパティを宣言する。

---

### 2. 肥大化したファイルと責務集中

`src/` には **1,000 行超のファイルが 10 件**（うち 1,300 行超が 8 件）存在する。

| ファイル | 行数 | 主な責務過多の内容 |
| --- | ---: | --- |
| `src/composables/useGameState.ts` | 2,542 | シナリオ読込、全状態の Proxy/Computed ブリッジ、ログキュー、ダイス、装備/消費、従者雇用、成長/払い戻し、ピラミッド固有スナップショット、localStorage/クラウド保存 |
| `src/components/DungeonExplorer.vue` | 1,869 | 探索UI、カスタム設定・加工ショップ、行商人/キノコショップ、ピラミッド固有NPC（アラン/絵画/左右腕/骸骨/ジル＝メガ）のビジネスロジック、汎用判定ロール |
| `src/App.vue` | 1,785 | ルートシェルに加え、レベルアップ・魔術/奇跡習得・街の市場/教会・従者雇用・ゲームオーバー・勝利画面とグローバルCSSを内包 |
| `src/composables/scenarioPlugins/pyramidPlugin.ts` | 1,771 | 周回進行制御、複数ボス固有AI・特殊攻撃、部屋イベント6種以上の選択肢ビルダー、アイテム配布・エピローグ表示 |
| `src/components/ScenarioSelector.vue` | 1,677 | 認証ナビ、キャラクターサマリー、セーブ再開、公式/カスタムシナリオ一覧、JSON入出力、権利表記 |
| `src/composables/useCombat.ts` | 1,466 | プラグイン用 `context` 生成、プレイヤー攻撃（武器特効・特殊矢・固有武器ギミック）、従者攻撃ループ、敵攻撃生成・防御割り振り・かばう、逃走、聖水、戦闘終了 |
| `src/components/CombatSimulator.vue` | 1,363 | 敵カード、自動防御割り振り計算、時喰いの咆哮/シーリーン専用UI、全ラウンド/サブメニュー/戦利品UI |
| `src/components/ScenarioEditor.vue` | 1,343 | ドラフト複製・クリーンアップ、基本設定・中間イベント、単一/マルチフェーズボス、36マスd66エディタ |
| `src/components/AdventureSheet.vue` | 1,100 | 能力値、物資/食料/状態異常、武具創造UI、着用装備、背負い袋管理、従者一覧 |
| `src/composables/useDungeon.ts` | 1,051 | 部屋進行、察知処理、遭遇開始、トラップ判定＋6通りの対象割り振り/自動割り振り、探索判定＋固有アイテム生成 |

#### [重要度：高] `src/composables/useGameState.ts`（2,542 行）の分割案
- **現状の根拠**: デフォルト定義（`339-570`）、シナリオ読込（`24-76`）、メッセージキュー（`899-998`）、ダイス（`1001-1078`）、バックパック/ランタン計算（`1081-1165`）、従者/装備/消費（`1222-1852`）、成長/払い戻し（`1904-2063`）、永続化（`648-815`）が単一ファイルに混在している。
- **分割案**:
  - `src/domain/catalog.ts`: `DEFAULT_WEAPONS`, `DEFAULT_ARMORS`, `DEFAULT_SHIELDS`, `DEFAULT_ITEMS`, 初期装備セット構築関数、呪文/奇跡カタログ
  - `src/domain/characterRules.ts`: `getHandsUsed`, `carriesLantern`, `backpackBreakdown`, 成長・払い戻し計算（`PlayerCharacter` へ集約）
  - `src/composables/useScenarioCatalog.ts`: 公式・モックシナリオの glob 読込とソート（`24-76`）
  - `src/composables/useMessageQueue.ts`: ログ・自動送り・モーダル表示フラグ（`899-998`）
  - `src/composables/useDice.ts`: `diceTray` と `rollD6` / `rollD66` / `rollD3`（`113-123, 1001-1078`）
  - `src/composables/useSessionStorage.ts`: `saveSession`, `loadSession`, `saveCharacterRecord`, `loadCharacterRecord`（`648-861`）

#### [重要度：高] `src/composables/useCombat.ts`（1,466 行）の分割案
- **現状の根拠**: 特に `playerAttack`（`202-560`: 359 行）と `resolveDefense`（`738-1007`: 270 行）が巨大で、ルール計算・状態更新・ログ整形・シナリオ固有条件が1関数に押し込まれている。
- **分割案**:
  - `src/domain/combatCalculator.ts`: 1d6 判定、攻撃/防御修正値集計、従者命中計算（`71-106`）を純粋関数として抽出
  - `src/composables/combat/useCombatPlayerAction.ts`: `playerAttack`, `resolveWeaponSwitch`（`1140-1166`）, `useHolyWater`（`1314-1436`）
  - `src/composables/combat/useCombatFollower.ts`: `executeFollowerAttacks`（`563-686`）
  - `src/composables/combat/useCombatDefense.ts`: `executeEnemyAttacks`（`689-735`）, `resolveDefense`（`738-1007`）, `executeCover` / `cancelCover`（`1213-1312`）, `handleRoundEndEffects`（`1104-1128`）
  - `src/composables/useCombat.ts`（調停層）: ライフサイクル（`escapeCombat`, `endCombat`, `confirmCombatResult`, `rollSpellResistance`）と各サブモジュールの統合

#### [重要度：高] `src/composables/scenarioPlugins/pyramidPlugin.ts`（1,771 行）と `DungeonExplorer.vue` の責務分離
- **現状の根拠**: `pyramidPlugin.ts` にはピラミッドシナリオのフック（`128-1084`）と各部屋ビルダー（`1089-1769`）が同居し、さらにジル＝メガ、アラン、恐怖の絵画、ヘラクレオスの左右腕、砂掃きの骸骨の処理が **`src/components/DungeonExplorer.vue:322-585, 801-881` に流出**している。
- **分割案**:
  - `src/composables/scenarioPlugins/pyramid/` 配下に `index.ts`（フック登録）、`progression.ts`（中間・決戦イベント生成）、`bossMechanics.ts`（クロノヴァルス・シーリーン・砂漠ワニ・氷霧の精霊）、`roomEvents.ts`（部屋 12/21/22/24/26/44 等）へ分割し、`DungeonExplorer.vue` に書かれているアラン・絵画・左右腕・骸骨・ジル＝メガもプラグインまたは汎用イベント定義側へ回収する。

#### [重要度：中] 巨大 `.vue` コンポーネント（`DungeonExplorer.vue`, `App.vue`, `ScenarioSelector.vue`, `CombatSimulator.vue`, `ScenarioEditor.vue`, `AdventureSheet.vue`）の分割案
- **`App.vue`（1,785 行）**: `LevelUpTownScreen.vue`（成長・習得・市場）、`GameOverScreen.vue`、`VictoryScreen.vue` へ画面単位で切り出し、`App.vue` は画面スイッチとグローバルモーダル配置に限定する。
- **`DungeonExplorer.vue`（1,869 行）**: `DungeonMerchantPanel.vue`, `SliderForgeShop.vue`, `PartyRosterBar.vue`, `TrapEventPanel.vue` へ分割し、`handleCustomChoiceClick` 等の判定ロジックは `useDungeon.ts` へ移す。
- **`CombatSimulator.vue`（1,363 行）**: `EnemyGrid.vue`, `CombatDefensePanel.vue`, `CombatCommandMenu.vue`, `CombatResultPanel.vue` へ分割し、自動防御選択・武器持ち替えロジック（`33-91, 259-276`）は `useCombat.ts` 側へ移す。
- **`ScenarioSelector.vue` / `ScenarioEditor.vue` / `AdventureSheet.vue`**: それぞれタブ・セクション単位（`CurrentCharacterCard.vue`, `ScenarioMetaTab.vue`, `ScenarioBossTab.vue`, `ScenarioRoomGridTab.vue`, `EnemyFormList.vue`, `EquipmentAndBackpack.vue`, `FollowerList.vue`）へ分割する。

---

### 3. 重複コード

#### [重要度：高] `domain/index.ts` と `useGameState.ts` 間での状態初期化・装備・消費ロジックの二重実装
- **場所**:
  - `src/domain/index.ts:4-52` vs `src/composables/useGameState.ts:113-211`（`createDefaultDiceTray`, `createDefaultCombatState`）
  - `src/domain/index.ts:177-237`（`PlayerCharacter.useFood`, `equipWeapon`, `equipArmor`, `equipShield`）vs `src/composables/useGameState.ts:1418-1641, 1726-1765`
- **根拠**: 両ファイルに同名の `createDefaultCombatState()` が存在し、しかも定義内容が一致していない。
  - `src/domain/index.ts:45-50`: `buffs: { attackBonus: 0, defenseBonus: 0, heroDefenseBonus: 0, followerDefenseBonus: 0 }`（`damageIgnoreCount` がなく、`pendingPerception`, `pendingDeflect`, `combatType`, `reactionResult`, `pendingTrapDamage` 等も未定義）
  - `src/composables/useGameState.ts:169-174`: `buffs: { defenseBonus: 0, heroDefenseBonus: 0, followerDefenseBonus: 0, damageIgnoreCount: 0 }`（`attackBonus` がない）
  さらに `useGameState.ts` の `equipWeapon`, `equipArmor`, `equipShield`, `useFood` は `PlayerCharacter` の同名メソッドを使わずに `character.value` を直接操作しているため、将来ルール修正時に片方だけ直るリスクが高い。
- **改善案**: `createDefaultDiceTray` / `createDefaultCombatState` を `src/domain/index.ts` に一元化し、`useGameState.ts` からは `PlayerCharacter` メソッドを呼び出した上でログ出力・`useConfirmModal` 等の UI/アプリケーション責務だけを担当する。

#### [重要度：高] 1d6 判定ロジックとランタン暗闇ペナルティ（`-2`）の 20 箇所以上にわたる重複
- **場所**:
  - `src/composables/useCombat.ts:172-179, 358-401, 583-587, 614-618, 659-664, 881-891, 1078-1091, 1256-1263, 1360-1372`
  - `src/composables/combat/useCombatMagic.ts:160-166, 195-201, 238-243, 309-315, 355-360, 380-385, 553-558, 667-673`
  - `src/composables/useDungeon.ts:205-210, 238-256, 357-416, 909-967`
  - `src/components/DungeonExplorer.vue:691-738`
- **根拠**:
  ```ts
  if (!carriesLantern.value) { modifier -= 2; addLog('... -2 ...', 'error'); }
  ...
  const total = roll === 6 ? 99 : roll === 1 ? -99 : roll + statVal + modifier;
  const success = roll === 6 || (roll !== 1 && total >= target);
  ```
  さらに `useDungeon.ts:357-423`（トラップ判定）、`useDungeon.ts:909-972`（探索判定）、`DungeonExplorer.vue:691-743`（カスタム選択肢判定）では、ランタン補正・状態異常 `modSkill`・鎧 `modDex`・副能力値選択/消費の 40 行超のブロックが 3 重にコピペされている（しかも `DungeonExplorer.vue:718` のみ `life` 判定に `Math.max(lifeCurrent, skillCurrent)` を使うなど仕様まで微ズレしている）。
- **改善案**: `src/domain/` に純粋関数 `evaluateD6Check(roll, stat, modifier, target)` と、Composable 共通ヘルパー `executeStatCheck({ stat, target, useSubStat, ... })` を切り出す。

#### [重要度：中] 戦闘中の共通パターン重複（ターン進行・従者攻撃・魔法・反応表・消耗品）
- **場所**:
  - 行動後ターン進行（8 箇所）: `src/composables/useCombat.ts:223-230, 548-559, 1155-1165, 1425-1435`、`src/composables/combat/useCombatMagic.ts:421-432, 440-451, 597-608, 702-713`
  - 従者攻撃クリティカル連鎖ループ（3 箇所）: `src/composables/useCombat.ts:577-604, 608-635, 648-683`
  - 主人公/従者の魔法処理（「気絶」「氷槍」「炎球」）: `src/composables/combat/useCombatMagic.ts:133-253` vs `291-401`
  - 反応表 1〜6 評価: `src/composables/combat/useCombatEnemy.ts:120-153` vs `178-204`
  - トラップ失敗時のダメージ/状態異常/死亡/テキスト生成（6 箇所）: `src/composables/useDungeon.ts:455-720, 790-844`
- **根拠**: 例えば `useCombatEnemy.ts:120-153`（`rollReactionCheck`）と `178-204`（`applyFriendshipReaction`）は出目 1〜6 のテキスト・`actionType`・`isBribeAllowed`・数比較を完全に重複実装している。`useCombatMagic.ts` の `castFollowerSpell` と `castSpell` も全く同じ「狭い/広い場所ロール」「木ゴーレム判定」「気絶余剰計算」を 2 回書いている。
- **改善案**: `advancePlayerActionTurn()`, `runFollowerAttackChain()`, `evaluateReactionRoll(roll)`, `applyTrapImpactToHero()` 等のヘルパー関数へ抽出する。

#### [重要度：中] UI コンポーネント間の重複（市場/行商人・パーティバー・武具創造・設定モーダル・装備除外）
- **場所**:
  - ショップ購入ロジック: `src/App.vue:129-303` vs `src/components/DungeonExplorer.vue:154-246`（`DungeonExplorer.vue` 側は `checkGoldSlotFreed` 通知が欠落）
  - 初期装備付与ロジック: `src/composables/useGameState.ts:2095-2165`（`initNewCharacter`）vs `2322-2362`（`retrySession`）
  - ランタン警告ログ: `src/composables/useGameState.ts:1421-1435`（`equipWeapon`）vs `1553-1567`（`equipShield`）
  - 同行従者パーティバー: `src/components/DungeonExplorer.vue:898-929` vs `src/components/CombatSimulator.vue:324-355`
  - 武具創造メニュー: `src/components/AdventureSheet.vue:290-474`（11 種選択可能）vs `src/components/CombatSimulator.vue:687-700`（6 種のみで不整合）
  - `ScenarioPluginContext` の手動構築（5 箇所）: `src/composables/useCombat.ts:38-64`, `src/composables/useDungeon.ts:35-58, 150-171, 300-314`, `src/App.vue:325-339, 375-389`, `src/components/DungeonExplorer.vue:56-74`
- **改善案**: 共通コンポーネント（`PartyRosterBar.vue`, `CreateWeaponSelector.vue`）と共通ショップ関数、および単一の `createScenarioPluginContext()` ファクトリに統合する。

---

### 4. エラーハンドリング

#### [重要度：高] `localStorage` 読み書き時の `try/catch` 欠落
- **場所**:
  - `src/domain/index.ts:370-374, 389-393`（`GameSession.saveToLocalStorage`, `clearLocalStorage`）
  - `src/composables/useSettings.ts:7-11, 17-33`
- **根拠**:
  ```ts
  // src/domain/index.ts:370-374
  public saveToLocalStorage(): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('roguelike_half_saved_session', this.serialize());
    }
  }
  ```
  `GameSession.loadFromLocalStorage()`（`378-385`）や `useGameState.ts:699-720`（`saveCharacterRecord`）には `try/catch` がある一方、`saveToLocalStorage()` と `useSettings.ts` の `localStorage.getItem` / `setItem` には `try/catch` がない。`useGameState.ts:817-861` の `watch` 内から毎回 `saveSession()` 経由で呼ばれるため、容量超過（`QuotaExceededError`）やブラウザのストレージ制限環境では未捕捉例外が連鎖し、最悪の場合 `useSettings.ts:13-15` のモジュールトップレベル実行でアプリ起動自体が失敗する。
- **改善案**: `localStorage` アクセスをすべて `try/catch` 付きストレージユーティリティにラップし、失敗時は警告ログと非破壊フォールバック（必要ならユーザー通知）を行う。

#### [重要度：高] クラウド同期・Firebase エラーの握りつぶしと `visibilitychange` 保存の未保証
- **場所**:
  - `src/composables/useCloudSync.ts:34-42, 120-125, 168-171`
  - `src/composables/useGameState.ts:659-664, 765-770, 804-809, 2254-2261, 2275-2280`
  - `src/composables/useCustomScenarios.ts:325-335, 347-354`
- **根拠**:
  - `useCloudSync.ts:168-171`（`checkCloudSave`）は通信エラーや権限エラー時でも `syncError.value` を更新せず `return false` のみ返すため、呼び出し元の `CloudSyncModal.vue:50-64` が「クラウドにデータが存在しない」と誤認し、**ログイン直後に既存クラウドデータをローカル初期データで上書きする危険**がある。
  - `useCloudSync.ts:34-42` は `visibilitychange === 'hidden'` 時に `void executeSaveToCloud(latest)` を呼んでいるが、Firestore SDK の `setDoc` は非同期通信でありページ離脱時に完了が保証されない。
  - `useGameState.ts:659-664, 765-770, 804-809, 2254-2261, 2275-2280` はすべて `catch (e) { // Offline silent }` で例外を完全に握りつぶしているうえ、`async` 関数（`saveToCloud`, `registerClearRecord`）を `await` も `.catch()` もせず fire-and-forget 呼び出ししている。
  - `useCustomScenarios.ts:332-334` は Firestore バックアップ失敗時も `{ success: true }` を返し、ローカルとクラウドの不整合を UI に伝えない。
- **改善案**: `checkCloudSave()` は `{ exists: boolean; error?: string }` 等でエラーと未存在を明確に区別し、`CloudSyncModal.vue` で通信失敗時に自動上書きへ進まないガードを設ける。

#### [重要度：高] 起動時認証とクラウド同期のレースコンディション、および非同期 UI ガード欠如
- **場所**:
  - `src/components/ScenarioSelector.vue:135-138, 222-236`
  - `src/components/CloudSyncModal.vue:34-40, 49-51, 79-83`
- **根拠**:
  ```ts
  // src/components/ScenarioSelector.vue:135-138
  onMounted(async () => {
    // 認証の初期化（匿名サインイン）
    initAuth();
    syncFromCloud();
  ```
  `initAuth()` の完了を `await` せずに即 `syncFromCloud()` を呼んでいるため、`onAuthStateChanged` が解決する前に `isLoggedIn.value === false` で早期 return（`useCustomScenarios.ts:516`）し、起動時のカスタムシナリオ同期が空振りする可能性が高い。また `ScenarioSelector.vue:222-236` の `handleFileSelected` には `try/finally` がなく、`importScenarioFromJson` 失敗時に `target.value = ''` が実行されない恐れがある。`CloudSyncModal.vue:36-38, 49-51, 79-83` もローディングフラグ解除に `try/finally` がなく、`CloudSyncModal.vue:76, 107` や `ScenarioSelector.vue:209, 233` で `useConfirmModal()` ではなくネイティブ `confirm()` / `alert()` が混在している。
- **改善案**: `await initAuth()` 後に `await syncFromCloud()` を実行し、非同期 UI 処理へ `try/finally` と `useConfirmModal()` を統一適用する。

#### [重要度：中] 非同期処理・ロール連打に対する競合状態（レースコンディション）防御の欠如
- **場所**:
  - `src/composables/useCombat.ts:738-742, 830, 986`（`resolveDefense`）
  - `src/composables/combat/useCombatLoot.ts:104-126`（`resolveLoot`）
  - `src/components/DungeonExplorer.vue:1447-1460`（`pendingPerception` の察知ボタン）
- **根拠**: `resolveDefense` は `await rollD6(true)`（700ms 待機）の前に `idx = queue.findIndex(...)` を取得して待機後に `queue.splice(idx, 1)` を実行しており、かつ `diceTray.isRolling` ガードがない。連打すると同じ `attackId` に対して二重に防御ロール・カウンタ加算・配列削除ズレが発生する。`resolveLoot` も `if (combatState.lootRolled) return;` 等のガードがなく複数回実行可能。`DungeonExplorer.vue:1447-1460` の察知ボタンにも `:disabled="diceTray.isRolling"` が付いていない。
- **改善案**: アクション単位の排他ロック（`diceTray.isRolling` または専用 `isResolvingAction` フラグ）をドメイン/Composable 側で強制し、`resolveDefense` では `await` 後に `attackId` で再度 `findIndex` する。

---

### 5. 状態管理のリスク

#### [重要度：高] モジュールスコープの可変状態による永続化漏れ・セッション汚染
- **場所**:
  - `src/composables/useGameState.ts:1767`（`let potionUsedThisAdventure = false;`）
  - `src/composables/scenarioPlugins/twilightKnightPlugin.ts:20-21`（`let hunterQuestAccepted = false; let identificationTagUsed = false;`）
  - `src/composables/scenarioPlugins/pyramidPlugin.ts:7-8`（`let addLogFn ...; let startEncounterFn ...;`）
  - `src/composables/combat/useCombatEnemy.ts:70`（`let isRollingReaction = false;`）
  - `src/composables/useGameState.ts:1644`（`let isSellingItem = false;`）
- **根拠**: `potionUsedThisAdventure`（1 冒険 1 回制限）、`hunterQuestAccepted`、`identificationTagUsed` がすべて `GameSession`（`localStorage` / Firestore）ではなくモジュールスコープのローカル変数に保存されている。ブラウザのリロードやクラウド同期復元、途中再開を行うとこれらのフラグが初期値 `false` にリセットされ、ポーションの複数回使用や報酬フラグ消失が起きる。また `pyramidPlugin.ts:7-8` は直近に呼び出されたコンテキストの関数参照をキャッシュするため、古い・不完全な `context`（`startEncounter` を含まない `useCombat.ts` 経由など）で上書きされるリスクがある。
- **改善案**: ゲーム進行に関わるフラグはすべて `GameSession` 内のシリアライズ対象フィールドへ移動し、プラグインはモジュール変数の関数キャッシュを廃して引数 `context` を直接参照する。

#### [重要度：高] `GameSession` / `combatState` リセット不完全とバックアップ・テスト間汚染リスク
- **場所**:
  - `src/composables/useCombat.ts:1183-1190`（`confirmCombatResult`）
  - `src/components/DungeonExplorer.vue:762-793`（`startGoblinFight`）
  - `src/composables/useGameState.ts:875-896`（`restorePyramidBossSnapshot`）
  - `src/composables/useGameState.ts:245, 2407-2412, 2524-2542`
- **根拠**:
  - `DungeonExplorer.vue:762-793` の `startGoblinFight` は `resetCombatState()` を呼ばずに一部フィールドだけを手動初期化しているため、`isOver`, `resultType`, `lootText`, `lootRolled`, `enemiesRetreated`, `pendingCover`, `pendingDeflect`, `pendingHolyArrow` 等が前戦から残留し得る。
  - `useCombat.ts:1183-1190` の `confirmCombatResult` でも `round`, `enemies`, `buffs`, `hasReactionChecked`, `alanDuel`, `isBerserk` 等を初期化していない。
  - `useGameState.ts:889-891` の `restorePyramidBossSnapshot` も `active`, `isOver`, `enemies` しかリセットせず、クロノヴァルス戦中の状態フラグが残る。
  - さらに `useGameState.ts:2407-2412, 2524-2542` は本番ビルドでも `window.character`, `window.activeSession`, `window.__GAME_STATE__`（`transitionToSuccess` 等の変更関数含む）をグローバル公開している。
- **改善案**: 戦闘状態のリセットは常に `resetCombatState()` を経由させ、`window.__GAME_STATE__` の公開は `import.meta.env.DEV` またはテスト環境限定にする。

#### [重要度：中] Vue `computed` 内の副作用と UI 層からの状態直接変更
- **場所**:
  - `src/components/CombatSimulator.vue:51-86`（`currentAttackDefenderId`）
  - `src/components/ScenarioEditor.vue:42-57, 60-74, 183-201`
  - `src/components/DungeonExplorer.vue:310-314, 838-841, 1133, 1151, 1216, 1253, 1261, 1326`
- **根拠**: `CombatSimulator.vue:83-85` は `computed` のゲッター内で `randomInt()` と `autoDefenderMap.value[...] = chosen` の副作用を実行しており、再評価タイミングに依存する。`ScenarioEditor.vue:44-50` も `computed` ゲッター内で `draft.d66EventTable[...]` を新規作成している。また `DungeonExplorer.vue:1133, 1151, 1216, 1253, 1261, 1326` の「立ち去る」ボタン群は `confirmEventResolution()` を通さず直接 `activeEvent = null; dungeonDepth++` を実行するため、`isBackpackOverLimit` ガードと `onResolveEventOverride` フックをバイパスしている。
- **改善案**: `computed` は純粋関数に保ち、対象自動選定や初期オブジェクト生成は `watch` やイベントハンドラへ移す。また部屋離脱はすべて `confirmEventResolution()` に一本化する。

#### [重要度：中] `applyDexLootBonus` の不完全なロールバックと重複確認フロー
- **場所**: `src/composables/combat/useCombatLoot.ts:96-98, 138-145`
- **根拠**: `resolveLoot` は出目確定前にまずゴールド／アイテムを `character.value` へ付与し、後から `applyDexLootBonus` で `gold` を減算・`items` を `filter` で取り消している。しかし `grantLootForTotal` が `total >= 7`（`rollMagicTreasure`）経路に入ると `grantedItem` が設定されない（`97行目`）ため、仮にボーナス前処理が `total >= 7` を含む設計変更を受けた場合にアイテムが回収不能になる（現状の1d6では1〜6だが拡張耐性がない）。
- **改善案**: 器用点所持時は確定前（`pendingDexLootChoice` 解決時）まで実際のインベントリ／ゴールド付与を保留し、出目確定後に 1 回だけ付与する設計に改める。

---

### 6. テストの薄い領域

現在の Vitest 単体テスト（`npm run test:unit`）は **3 ファイル・15 テスト**のみ（`random.test.ts` 7件、`index.test.ts` 7件、`balance-simulation.test.ts` 1件）であり、以下の重要ロジックに単体テストが一切存在しない。

| 対象領域 | 現状 | リスク・不足しているテスト観点 |
| --- | --- | --- |
| **戦闘エンジン全体**<br>(`src/composables/useCombat.ts`, `combat/useCombatEnemy.ts`, `combat/useCombatLoot.ts`, `combat/useCombatMagic.ts`) | 単体テスト **0 件** | 均等防御割り振り、かばう/そらし割り込みとラウンド終了効果連携、敵撤退、呪文/奇跡の事前バリデーションと消費順序、従者攻撃チェーン、宝物表・器用点+1・貫きの石弾/特殊矢消費 |
| **ダンジョン探索・トラップ**<br>(`src/composables/useDungeon.ts`) | 単体テスト **0 件**<br>（`balance-simulation.test.ts` は `exploreNextRoom` の一部経路を呼ぶのみ） | 6 種類の `trapTargetScope`（`all`, `random`, `non_combatants`, `choose_1d3`, `default`, `autoTrapTargetAllocation`）、トラップ宝箱の再挑戦/離脱、十の位固定（`nextRoomTensDigitOverride`）、察知・探索部屋 |
| **状態管理・成長・装備**<br>(`src/composables/useGameState.ts`) | 単体テスト **0 件** | 装備変更/廃棄時の `lifeMax`・`lifeCurrent` 整合性、ランタン片手/両手判定、バッグ容量計算（金貨100枚・食料10食換算）、経験点成長とチェックポイント払い戻し（魔術/奇跡上限超過時の忘却含む）、`retrySession` |
| **カスタムシナリオ検証・同期**<br>(`src/composables/useCustomScenarios.ts`, `useCloudSync.ts`, `useAuth.ts`, `useHallOfFame.ts`, `useSettings.ts`) | 単体テスト **0 件** | 不正 JSON / 破損データの境界値テスト、`sanitizeForCloud` / `loadFromCloud` のマージ・`characterRecord` マイグレーション、キャッシュTTL・クールダウン（`useHallOfFame`）、ストレージ失敗時のフォールバック |
| **シナリオプラグイン**<br>(`src/composables/scenarioPlugins/twilightKnightPlugin.ts`, `pyramidPlugin.ts`, `index.ts`) | 単体テスト **0 件** | `twilightKnightPlugin` の各出目ギミック（認識票・大ネズミ・ゴートマン・囮の風船・油引火・狩猟者依頼）、`pyramidPlugin` の 3 周回分岐・クロノヴァルス咆哮巻き戻し・シーリーン3種魔眼 |
| **シミュレーションの現状**<br>(`src/domain/balance-simulation.test.ts:26-28`) | 1 件（30 試行で勝率 0%） | `balance-simulation.test.ts:26-28` で `spendExpForStat('skill')` を 5 回呼んでいるが、技量点は 1 回 4 EXP（上限+2）のため初期 10 EXP では 2 回しか上がらず残余 2 EXP になる点、かつ結果アサーションが `expect(victories + defeats).toBe(trials)` のみで機能検証になっていない |

---

### 7. その他（明らかなバグの兆候、未使用コード）

#### 明らかなバグの兆候

1. **[重要度：高] 奇跡【そらし】の二重ロールとラウンド終了スキップバグ**
   - **場所**: `src/composables/useCombat.ts:912-920` / `src/composables/combat/useCombatMagic.ts:613-647`
   - **根拠**: `useCombat.ts:913-917` で `pendingDeflect` に保存したあと、`skipDeflect`（`useCombatMagic.ts:618`）が `deps.resolveDefense(p.attackId, p.defenderId, p.isAllOut, true)` を先頭から再呼び出しするため、**防御判定の 1d6 ロールが 2 回実行される**（さらに `pendingDeflect` に `isAllOut` が存在しないため全力防御情報も失われる）。一方 `executeDeflect`（`useCombatMagic.ts:644-646`）はキュー空時に未定義の `combatState.roundActive = false` を代入するだけで `onResolveDefenseAttack` や `handleRoundEndEffects()` を呼ばないため、最後の攻撃を【そらし】で防ぐと敵の自爆やラウンド終了効果が発動しない。
   - **改善案**: 防御失敗後の被弾解決だけを別関数に切り出して `skipDeflect` から呼び出し、`executeDeflect` ではキュー空時に `handleRoundEndEffects()` を実行する。

2. **[重要度：高] 「かばう」(`executeCover` / `cancelCover`) 完了時にラウンド終了処理が発火しない**
   - **場所**: `src/composables/useCombat.ts:961-971, 1282-1288, 1306-1312`
   - **根拠**: `resolveDefense` は `pendingCover` 設定時に早期 return（`971`）するが、その後続となる `executeCover` と `cancelCover` は `queue.splice(idx, 1)` するだけで `resolveDefense:989-1006` にある `onResolveDefenseAttack` と `if (queue.length === 0) await handleRoundEndEffects()` を呼んでいない。
   - **改善案**: 攻撃キュー消費とラウンド終了チェックを共通ヘルパー `completeQueuedAttack(...)` にまとめ、`resolveDefense`, `executeCover`, `cancelCover`, `executeDeflect`, `skipDeflect` から共通利用する。

3. **[重要度：高] `twilightKnightPlugin.ts` の「囮の風船」が絶対に発動しない & HP0 死亡チェック漏れ**
   - **場所**:
     - `src/composables/useCombat.ts:974-990` vs `src/composables/scenarioPlugins/twilightKnightPlugin.ts:640-657`
     - `src/composables/scenarioPlugins/twilightKnightPlugin.ts:569-571, 710-711`
   - **根拠**:
     - `useCombat.ts:974-978` が被弾した従者を `followers.value.splice(fIdx, 1)` で**配列から削除した後**に、`990行目` で `onResolveDefenseAttack` フックを呼んでいる。そのため `twilightKnightPlugin.ts:642` の `followers.value.find(f => f.id === defenderId)` は常に `undefined` になり、「囮の風船」は永遠に発動しない。
     - また `twilightKnightPlugin.ts:569`（闇エルフの不意打ち）および `710`（油の入った壷の火傷）で `character.value.lifeCurrent` を減算し `0` になっても `handleDeath` / `triggerGameOver` を呼ばないため、HP 0 のまま探索・戦闘が続行してしまう。
   - **改善案**: `onResolveDefenseAttack`（または専用の被弾前フック）を `followers.value.splice` より前に呼んでキャンセル可能にし、プラグイン内で HP を減らす全箇所に `lifeCurrent <= 0` 時の死亡遷移を追加する。

4. **[重要度：高] `pyramidPlugin.ts` で `handleDeath` 欠落コンテキストによるランタイムクラッシュリスク**
   - **場所**: `src/composables/scenarioPlugins/pyramidPlugin.ts:26` / `src/composables/useDungeon.ts:35-58`
   - **根拠**: `handleFinal1Jump`（`pyramidPlugin.ts:26`）は HP 0 時に `handleDeath!()` を呼ぶが、`onExploreRoomOverride` を呼び出す `useDungeon.ts:35-58` の `getScenarioContext()` には `handleDeath` が含まれていない（`useDungeon.ts:8-33` で `useGameState()` から取得すらしていない）。このまま崩落する床で HP 0 になると `TypeError: handleDeath is not a function` が発生する。また `pyramidPlugin.ts:611-621`（シーリーンの斬視）で鎧・盾を破壊する際も `lifeMax` から `modLife` を減算し忘れている。
   - **改善案**: 単一の `createScenarioPluginContext()` で全フィールドを確実に渡し、装備破壊時は `PlayerCharacter.equipArmor(null)` / `equipShield(null)` 経由で `lifeMax` を再計算する。

5. **[重要度：高] 防具・盾の廃棄 (`discardArmor` / `discardShield`) で `lifeMax` が減らない**
   - **場所**: `src/composables/useGameState.ts:1692-1714`
   - **根拠**: `discardArmor` / `discardShield` は `equippedArmor = null` / `equippedShield = null` にするだけで、`equipArmor` / `equipShield` のような `modLife` 減算や `recalculateLife()` を行っていない。装備中の防具や盾を捨てると最大生命点が増加したまま残る。
   - **改善案**: `discardArmor` / `discardShield` 内で先に `equipArmor(null)` / `equipShield(null)`（または `recalculateLife()`）を実行する。

6. **[重要度：中] プラグイン・UI・ドメイン間の仕様不一致と未実装機能の露出**
   - **場所 & 根拠**:
     - `src/App.vue:1252` vs `src/composables/combat/useCombatMagic.ts:115-259`: `App.vue` で従者魔術師に「速撃」を習得させられる（また `twilightKnightPlugin.ts:156` では `'精神の盾'` を持たせている）が、`castFollowerSpell` は `'気絶'`, `'氷槍'`, `'炎球'` のみ実装されており、他の呪文は魔術点だけ消費して何も起きない。
     - `src/composables/scenarioPlugins/twilightKnightPlugin.ts:119` vs `129-130`: 選択肢ラベルに `HP20 / 攻撃修正+2` と記載されているが、実データは `skill: 1, lifeMax: 1, lifeCurrent: 1`。
     - `src/composables/scenarioPlugins/twilightKnightPlugin.ts:543, 546`: `goatman.modAttack = ...` および `goatman.weaponAttribute = 'ranged'` は `Enemy` 型（`src/types/index.ts:108-123`）および `useCombat.ts` 側で参照されていない（遠距離敵判定は `enemy.isRanged`）。
     - `src/composables/scenarioPlugins/pyramidPlugin.ts:479` vs `src/composables/useCombat.ts:785, 789` / `src/components/CombatSimulator.vue:36, 45, 57`: `pyramidPlugin.ts` は `type: 'spacetime_fang_hero_1'` を生成するが、`useCombat.ts` と `CombatSimulator.vue` は `spacetime_fang_hero` と `spacetime_fang_hero_2` しか判定していない。
     - `src/composables/useCombat.ts:240-245, 349, 513, 544`: 警備ゴブリンがかばった後（`targetEnemy` に差し替え後）も、特効タグ判定（`349`）・肋骨剣衝撃波（`513`）・ミスログ（`544`）が差し替え前の `enemy` を参照している。
     - `src/composables/combat/useCombatMagic.ts:282, 291-304, 324, 372-375`: `castSpell` は対象チェック前に `subStatCurrent--` してしまい、また `気絶` の余剰対象検索（`324`）だけ `!hasTag(e, 'plant')` が抜けている。
     - `src/components/CombatSimulator.vue:706-708, 756-761` vs `src/composables/combat/useCombatEnemy.ts:249-306`: UI のワイロボタンは `character.gold < 5` で一律無効化されており、チーズ・エール酒による減額/代替や、魔法【友情】でのワイロ減額 `payBribe(true)` を呼ぶ UI 経路が存在しない。
     - `src/App.vue:108, 117` vs `src/composables/useGameState.ts:2018`: 魔法習得上限が `App.vue` では `Math.floor(subStatMax / 2)`、`refundExpForStat` では `Math.floor((subStatMax - 1) / 2)` と式が揃っていない。
     - `src/components/AdventureSheet.vue:551, 578` vs `src/composables/useGameState.ts:1124-1161`: 装備するとバッグ枠消費が減る仕様なのに `:disabled="isBackpackFull && !character.equippedWeapon"` と逆向きの制限がかかっている。
     - `src/components/DungeonExplorer.vue:1238`: 特製キノコエキス（`DEFAULT_ITEMS.potion`）の説明文が「生命力を**2点**回復」となっているが実体は最大値まで全回復する治療のポーション。

7. **[重要度：低] ID 生成の非決定性と乱数バイパス**
   - **場所**: `src/composables/scenarioPlugins/twilightKnightPlugin.ts:125, 147, 172, 208, 210, 229, 248, 267, 445`
   - **根拠**: `generateId()` や `randomInt()`（`src/domain/random.ts`）を使わず `Date.now()` と `Math.random()` を直接使用しており、同ミリ秒内の連続生成による ID 衝突やシード決定性の破壊を招いている。

#### 未使用コード（Dead Code）

| 対象 | 箇所 | 根拠・内容 |
| --- | --- | --- |
| 未使用コンポーネント＆アセット | `src/components/HelloWorld.vue:1-95`<br>`src/assets/hero.png`, `vite.svg`, `vue.svg` | Vite 初期テンプレートの残骸。`src/` 内のどこからも参照されていない（アセット 3 件は `HelloWorld.vue` からのみ import）。 |
| 旧モーダル残骸 | `src/components/SettingsModal.vue:1-170`<br>`src/components/HelpModal.vue:1-487` | `SettingsHelpModal.vue` に統合された後の旧コンポーネント。プロジェクト内のどこからも import されていない。 |
| 未使用依存パッケージ | `package.json:21`（`"pdf-parse": "^2.4.5"`） | `src/`・`tests/` のどこからも参照されていない。 |
| 未使用引数・到達不能コード | `src/composables/combat/useCombatEnemy.ts:8, 24`<br>`src/composables/combat/useCombatLoot.ts:9, 19, 217-218`<br>`src/composables/combat/useCombatMagic.ts:619-621`<br>`src/composables/useCombat.ts:1099-1101` | `_activeScenario` が両サブモジュールで未使用。`useCombatLoot.ts:217-218` の初期値 `3, 6` は直後に上書き。`useCombatMagic.ts:619-621` の `p.deps?.resolveDefense` は型・実体とも不在で到達不能。 |
| 未使用 emit・状態・フラグ | `src/components/MessageWindow.vue:23-25`（`open-logbook`）<br>`src/composables/useGameState.ts:1644`（`isSellingItem`）<br>`src/composables/useGameState.ts:217-243` | `open-logbook` は発火も購読もされていない。`isSellingItem` は同期処理内のためガードとして無意味。1 行固定値返却だけの `createDefault*` 群が散在。 |
