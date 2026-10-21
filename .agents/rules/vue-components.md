---
trigger: glob
globs:
  - "src/**/*.vue"
---

# Vue Component Development Guidelines

Vue 3 Single File Components (`.vue`) を作成・変更する際の制約事項です。

## 1. Composition API and Script Setup
- すべてのVueコンポーネントで `<script setup lang="ts">` を使用してください。
- Options APIは使用せず、リアクティブ状態は `ref`, `computed` を用いて構築してください。

## 2. Browser Environment & No Node.js Globals
- ブラウザ環境で実行されるコンポーネント内では、Node.jsグローバル（`process` 等）を直接参照してはいけません。
- 環境変数は `import.meta.env` を使用し、万一アクセスが必要な場合は `(globalThis as any).process` 等の安全なフォールバックを必ず実装してください。

## 3. UI/UX & Design Consistency
- 羊皮紙（Paper Sheet）、インクカラー（Ink Dark / Ink Light）、手書き古書風フォント（`'Noto Serif JP', serif`）による中世ファンタジーTRPGの世界観・デザインテーマを維持してください。
- スタイルは `<style scoped>` を使用してコンポーネント内にカプセル化してください。

## 4. XSS Prevention & Text Formatting
- シナリオ説明文やユーザー入力・外部データを画面に描画する際、`v-html` を不用意に使用してはいけません（XSS脆弱性の防止）。
- フレーバーテキストやイタリック表現を表示する場合は、トークン分割レンダラーである `FormattedScenarioText` コンポーネントを使用してください。

