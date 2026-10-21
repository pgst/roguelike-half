---
trigger: glob
globs:
  - "tests/**/*.ts"
  - "tests/**/*.spec.ts"
---

# Playwright Test Suite Guidelines

Playwright E2Eテストおよびルール検証テストスクリプトを作成・更新する際の制約事項です。

## 1. UI Flow Alignment
- UIのレイアウト、ロケータ（ボタンテキスト、クラス名、セレクタ）、操作手順（モーダル、マスター・ディテール選択等）を変更した場合は、必ず対応するテスト（`tests/*.spec.ts` および `tests/helpers/test-utils.ts`）を更新してください。
- ロケータのタイムアウトによるCIハングを防ぐため、存在確認には適切な `waitFor` や `expect(...).toBeVisible()` を使用してください。

## 2. Browser Compatibility & WebKit Support
- WebKit（Safari）やCI環境では、アニメーションによる操作遅延や初期化のタイミング差異が発生しやすいため、`await disableAnimations(page)` を呼び出してください。
- シナリオをUIから選択するテストでは、`page.addInitScript` を用いて必要なシナリオデータを `localStorage` に事前注入し、レンダリング待機のタイムアウトを防いでください。

## 3. Strict CI Quality
- コード内に `test.only` を残したままコミットしてはいけません（CI設定 `forbidOnly` でブロックされます）。
- モック乱数を使用する場合は `setupMockRandom` を活用し、決定論的でFlaky（不安定）にならないテストを記述してください。

