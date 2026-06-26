# 🧠 Implementation Plan & Specification: Roguelike Half ver.5.1 SPA

この実装計画・実績書は、テーブルトークRPG「ローグライクハーフ (Roguelike Half) ver.5.1」をベースにした、プレミアムなヴィンテージ・アナログゲームブック風の Vue 3 + TypeScript シングルページアプリケーション（SPA）の開発実績および仕様についてまとめたものです。

---

## 🛠️ Step 1: Initialize the Project **[Status: Completed]**

Vite + Vue 3 + TypeScript 構成のクリーンな開発環境の初期化と依存関係の構築を行いました。

1. **プロジェクトの初期化**: Viteの Vue-TS テンプレートを利用し、カレントディレクトリに初期化。
2. **フォルダ構造の整備**:
   - `src/components/`: 各ゲームUIコンポーネント
   - `src/composables/`: ゲームロジックを管理するリアクティブなステート（GameState, Dungeon, Combat）
   - `src/types/`: 各種 TypeScript の厳密なインターフェース型定義
   - `src/assets/`: グローバルスタイルシート等
3. **依存関係の構築**: `npm install` による Vue 3 開発パッケージの完全なセットアップ。

---

## 🎨 Step 2: Vintage Analog Styling & Assets **[Status: Completed]**

`src/style.css` をベースに、高級感溢れるアナログゲームブックの世界観を表現するCSSデザインシステムを構築しました。

- **背景フレーム**: 高級感のある木製デスク背景（ウッドグレイン調のグラデーションとシャドウ）。
- **ゲームブックコンテナ**: 開いた羊皮紙の書物（Parchment style `#f5ebe0`〜`#e3d4b6`）を模し、美しいドロップシャドウやアンティークな二重枠線、めくれたページのような立体感を設定。
- **タイポグラフィ**: 味わい深いセリフ体（`'Noto Serif JP'`, `'Georgia'`, serif）とインク調 of ディープチャコール（`#1a1512`）カラー。
- **コンポーネント装飾**: 手書き風の不規則な角丸（`border-radius`）やアンティークな見出しリボン、羊皮紙をちぎったようなダメージ加工。
- **インタラクティブ要素**: 押し心地にこだわったレタープレス/刻印風のボタンエフェクト（ホバー時の浮き上がり、アクティブ時の沈み込み）。

---

## 📝 Step 3: TypeScript Core Interface Types (`src/types/index.ts`) **[Status: Completed]**

ゲーム内のデータ構造を厳密に管理するため、実際のコードベースと100%整合した完全な型定義を構築しました。

```typescript
export interface Weapon {
  name: string;
  type: 'light' | 'one-handed' | 'two-handed' | 'ranged';
  modAttack: number; // e.g. -1 for light, +1 for two-handed
  attribute: 'strike' | 'slash';
  goldCost: number;
  isMagic: boolean;
  magicChargesCurrent?: number;
  magicChargesMax?: number;
  description: string;
}

export interface Armor {
  name: string;
  type: 'cloth' | 'leather' | 'chain' | 'plate' | 'magic';
  modLife: number; // life increase
  modDex: number;  // dexterity roll modifier
  modDef: number;  // defense roll modifier
  goldCost: number;
  description: string;
}

export interface Shield {
  name: string;
  type: 'wood' | 'round' | 'magic';
  modLife: number; // life increase
  modDefRanged: number; // ranged defense modifier
  goldCost: number;
  description: string;
}

export interface GeneralItem {
  id: string;
  name: string;
  type: 'lantern' | 'rope' | 'holywater' | 'healingpotion' | 'accessory' | 'gem_small' | 'gem_large' | 'magic_flute' | 'magic_staff' | 'magic_monocle' | 'magic_shield' | 'magic_doll' | 'clue';
  goldCost: number;
  chargesCurrent?: number;
  chargesMax?: number;
  value: number; // Sell value, 0 if not sellable
  description: string;
}

export interface Character {
  name: string;
  level: number;
  exp: number; // level progress / allocation
  gold: number;
  food: number;
  skillMax: number;
  skillCurrent: number;
  lifeMax: number;
  lifeCurrent: number;
  subStatType: 'magic' | 'luck' | 'strength' | 'dexterity';
  subStatMax: number;
  subStatCurrent: number;
  followerMax: number;
  followerCurrent: number;
  spells: string[];
  miracles: string[];
  weapons: Weapon[];
  armors: Armor[];
  shields: Shield[];
  items: GeneralItem[];
  equippedWeapon: Weapon | null;
  equippedArmor: Armor | null;
  equippedShield: Shield | null;
  hasActiveLantern: boolean;
}

export interface Follower {
  id: string;
  name: string;
  type: 'soldier' | 'swordsman' | 'archer' | 'mage' | 'lantern' | 'swordbearer' | 'porter' | 'scout' | 'captive';
  isCombatant: boolean;
  skill: number;
  lifeMax: number; // always 1
  lifeCurrent: number; // always 1, dies if 0
  magicMax?: number;
  magicCurrent?: number;
  magicList?: string[];
  weaponAttribute: 'strike' | 'slash';
  goldCost: number;
  description: string;
}

export interface Enemy {
  id: string;
  name: string;
  level: number;
  lifeMax: number;
  lifeCurrent: number;
  attackCount: number;
  tags: ('undead' | 'golem' | 'weak' | 'strong' | 'plant' | 'weapon' | 'structure')[];
  special?: string;
  count: number; // for groups of weak enemies
}

export interface DungeonEvent {
  title: string;
  d66Code: string;
  description: string;
  type: 'encounter' | 'trap' | 'rest' | 'treasure' | 'empty' | 'npc';
  enemies?: Omit<Enemy, 'id'>[];
  trapStat?: 'dexterity' | 'strength' | 'magic' | 'luck' | 'skill';
  trapTarget?: number;
  trapDamage?: number;
  lootModifier?: number;
}
```

---

## 🧠 Step 4: Reactive Game Logic Engine (Composables) **[Status: Completed]**

ゲーム全体の複雑なゲーム内規則・ライフサイクルを厳密に管理するため、3つのモジュール化された composable を開発・統合しました。

### 1. `useGameState.ts` (コア状態管理)
- **主要なリアクティブ変数**:
  - `character`: 主人公のステータス・装備・所持品・魔法リスト
  - `followers`: 雇用中の同行フォロワー一覧
  - `currentScreen`: 現在の画面（`creator`, `explorer`, `combat`, `levelup`, `gameover` 等）
  - `dungeonDepth`: 現在の踏破階層・クリア部屋数
  - `logs`: 冒険中に発生したイベントや戦闘のテキストログ履歴
  - `diceTray`: ダイスロールの出目・結果、クリティカル/ファンブルの状態
  - `combatState`: アクティブな戦闘におけるフェーズや状態
- **主要メソッド**:
  - `initNewCharacter()`: 新規キャラクター作成と初期アイテムの付与
  - `spendExpForStat()`: 経験値を消費したレベルアップ時の基礎パラメータ成長
  - `buyFollower()` / `dismissFollower()`: フォロワーの新規雇用と解雇
  - `equipWeapon()` / `equipArmor()` / `equipShield()`: 各装備の着脱処理
  - `useFood()` / `useHealingPotion()`: 食料や回復薬の消費とHP回復
  - `rollD6()` / `rollD3()` / `rollD66()`: トレイ連動型のランダムダイス処理
  - `addLog()`: バトルログ・イベントメッセージの追加

### 2. `useDungeon.ts` (ダンジョン探索システム)
- **主要メソッド**:
  - `exploreNextRoom()`: d66テーブルに基づいたランダム部屋の生成、遭遇イベント（罠、神殿、店、敵グループなど）の構築
  - `resolveTrapCheck()`: プレイヤーの副能力値（敏捷、腕力、幸運、魔力、技術）による罠回避判定とダメージ計算

### 3. `useCombat.ts` (フェーズ進行型戦闘システム)
- **主要メソッド**:
  - `rollReactionCheck()`: 敵グループの初期反応（逃走、友好的、即時戦闘など）のロール判定
  - `playerAttack()`: プレイヤー側の攻撃フェーズ（命中判定、武器属性に応じたダメージ算出）
  - `resolveDefense()`: 敵からの攻撃に対する防御ロールと、ダメージをフォロワーに割り当てる戦術的インターフェースの解決
  - `castSpell()` / `castMiracle()`: 呪文や奇跡の消費・効果処理
  - `activateWarDoll()`: 身代わり人形（magic_doll）による被弾無効化
  - `escapeCombat()`: 技術値に基づいた逃走判定
  - `payBribe()`: 賄賂（所持ゴールドや食料の供出）による戦闘の平和的解決
  - `confirmCombatResult()` / `resolveLoot()`: 戦闘勝利後の戦利品獲得（一般品・魔法の武具）と経験値獲得

---

## 🖼️ Step 5: Visual Components **[Status: Completed]**

プレミアムなヴィンテージ・アナログ質感を再現したコンポーネント群を実装しました。

1. **`DiceRoller.vue` (ダイストレイ)**
   - 木製のダイストレイを模した3D調のインターフェース。
   - 1D6 または 2D6 のダイスロールに対応し、クリティカル（出目6）発生時は金色の豪華なエフェクト、ファンブル（出目1）発生時はひび割れたインクエフェクトを表示します。
2. **`CharacterCreator.vue` (冒険者登録カード)**
   - 羊皮紙にインクで手書きするスタイルのキャラクター作成画面。
   - 10ポイントの初期EXPを使っての能力値割り振り、サブスタットのアーキタイプ選択、初期資金による基本的な武器・防具・アイテムの選択購入。
3. **`AdventureSheet.vue` (冒険手帳)**
   - 主人公のステータス・装備状況、インベントリ、習得した呪文・奇跡のリスト、および雇用しているフォロワーをカード形式で手帳風に美しく表示。
4. **`DungeonExplorer.vue` (ゲームブックのページ)**
   - ゲームブックの見開きを忠実に再現。進行深度、現在発生しているイベントの文章、d66ダイスを振るための一連のアクションをヴィンテージなレイアウトで構築。
5. **`CombatSimulator.vue` (戦闘盤面)**
   - プレイヤー対複数の敵グループの戦闘シミュレーター。
   - 各敵カードにはステータス、レベル、HP、弱点タグなどがアンティークカード風に表示され、攻撃・魔法・逃走・賄賂といったコマンドボタン、被ダメージ時のフォロワー選択UIを搭載。

---

## 🚀 Step 6: App Assembly & Launch **[Status: Completed]**

- `src/App.vue` をメインキャンバスとして、左側に「ゲームブックのページ（DungeonExplorer または CombatSimulator）」、右側に「冒険者手帳（AdventureSheet & DiceRoller）」を配置する二画面レイアウトを統合。
- まるで本物の木製デスクの上にゲームブックとキャラクターシートを並べて遊んでいるかのような、没入感の高いシングルページアプリケーションを実現しました。
