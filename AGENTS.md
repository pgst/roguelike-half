# Antigravity Developer Guide for roguelike-half

TRPG『ローグライクハーフ』のルールを忠実に再現し、ブラウザ上でプレイ可能なシングルページアプリケーション（SPA）ゲームです。

## Architecture Overview

- **Framework & Language**: Vue 3 (Composition API / `<script setup lang="ts">`), TypeScript, Vite
- **Testing**: Playwright (E2E / Persona Playthrough), Vitest (Unit)
- **Directory Structure**:
  - `src/domain/`: 副作用を持たない純粋なドメインロジック、計算、判定、ランダム生成器 (`random.ts`)。
  - `src/composables/`: Vueのリアクティブ状態管理 (`useGameState.ts`)、戦闘制御 (`useCombat.ts`)、ダンジョン進行 (`useDungeon.ts`)、シナリオプラグインシステム (`scenarioPlugins/`)。
  - `src/components/`: UIコンポーネント（羊皮紙テーマ、Noto Serif JPフォント、インク風UI）。
  - `src/types/`: ドメインモデル、キャラクター、アイテム、シナリオデータ等の型定義。
  - `scenarios/`: 公式・追加シナリオのJSON定義（36部屋のd66EventTable、中間イベント、マルチフェーズボス）。
  - `tests/rules/`: PlaywrightによるTRPG公式ルール網羅検証スイート（70項目以上の整合性テスト）。
  - `tests/personas/`: 様々なプレイスタイルのAIペルソナ自動周回テスト。

## Build & Test Commands

- **Build Application**:
  ```bash
  npm run build
  ```
- **Type Check**:
  ```bash
  npm run type-check
  ```
- **Run Rule Verification Tests (Recommended after changes)**:
  ```bash
  npx playwright test tests/rules/
  ```
- **Run Persona Playthrough Tests**:
  ```bash
  npm run test:personas
  ```
- **Format Code**:
  ```bash
  npm run format
  ```

## Development & Automation Rules

1. **Automated Test Runs Encouraged**:
   - AIエージェントはコード修正後、回帰検知のために自動テストスイート（`npm run build` および `npx playwright test tests/rules/`）を自律的に実行することが承認・推奨されています。
2. **TypeScript & Build Compilation Rule**:
   - 変更・追加したすべてのTypeScript/Vueファイルでコンパイル型エラーを発生させないこと。
   - ブラウザ側コンポーネントやComposable内で `process` 等のNode.jsグローバル変数を型定義やフォールバックなしに直接参照しないこと（`(globalThis as any).process` または `import.meta.env` を使用）。
3. **UI Changes & E2E Test Maintenance Rule**:
   - UIのレイアウト、ロケータ、ユーザー操作フロー（ボタン文言、モーダル追加、画面遷移ステップ等）を変更した際は、対応するPlaywrightテストスクリプト（`tests/*.spec.ts` および `tests/helpers/test-utils.ts`）を必ず見直して追従させること。
4. **Auto Commit & Push on Test Success**:
   - 要求されたコード修正が完了し、自動テストスイート（`npm run build` および `npx playwright test tests/rules/`）の全件通過が確認された場合、AIエージェントは簡潔な日本語コミットメッセージで変更をコミットし、`origin/main` にプッシュすることが承認・義務付けられています。

