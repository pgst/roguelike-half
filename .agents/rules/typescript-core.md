---
trigger: glob
globs:
  - "src/**/*.ts"
---

# TypeScript Core & Domain Guidelines

TypeScriptファイル（ドメインモデル、Composable、型定義、ユーティリティ）を変更する際の制約事項です。

## 1. Domain Logic Purity (`src/domain/`)
- `src/domain/` 配下のコードはUIやVueフレームワークに依存せず、純粋な関数・型定義・ロジックとして設計してください。
- ダイスロール計算、ステータス計算、ルール判定は単体テスト可能なピュア関数として維持してください。

## 2. Composable & State Management (`src/composables/`)
- グローバル状態は `useGameState.ts` を中心に管理し、循環依存を避けてください。
- コンポーネント間で共有されるリアクティブ変数のプロキシや参照渡しを壊さないよう、分割代入（destructuring）の際には `toRefs` を使用するか、ステートホルダーを経由して更新してください。

## 3. Backward Compatibility of Save Data
- `localStorage` にシリアライズされるセーブデータ（`GameSession`, `PlayerCharacter`）のスキーマを変更する場合は、古いバージョンのセーブデータをロードした際にクラッシュしないよう、安全なマイグレーションまたはデフォルト値の補完を必ず実装してください。

## 4. Strict Type Safety
- `npm run type-check`（`vue-tsc --noEmit`）で型エラーを一切出さないこと。
- 不可避な場合を除き、無秩序な `any` の使用を避け、`src/types/index.ts` の型定義を活用してください。

