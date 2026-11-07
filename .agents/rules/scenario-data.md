---
trigger: glob
globs: "scenarios/**/*.json"
description: Scenario JSON data integrity and event table constraints
---

# Scenario Data & JSON Guidelines

公式シナリオおよび追加シナリオのJSONデータを編集する際の制約事項です。

## 1. Schema & Structure Compliance

- 各シナリオは以下の必須トップレベル属性を保持している必要があります:
  - `id`: 一意のシナリオID（英数字・アンダースコア）
  - `title`: シナリオ名
  - `totalRoomsToClear`: クリアに必要な部屋数
  - `d66EventTable`: 11〜66の全36部屋をキーとする完全な部屋オブジェクトマップ
  - `midpointEvent` (必要に応じて): 規定部屋数で発生する中間イベント
  - `bossEvent` または `bossPhases`: 決戦ボスのフェーズ定義

## 2. Event Table Rules

- 各部屋の `type`（`encounter`, `trap`, `treasure`, `rest`, `npc`, `search`）に応じたパラメータ（`trapStat`, `searchStat`, `searchTarget`, `enemies` 等）を正確に定義してください。
- 遭遇モンスターのレベル、生命力、攻撃回数、タグ（`weak`, `strong`, `undead`, `fight_to_death` 等）は原作TRPGのルールブックと厳密に整合させてください。

## 3. Flavor Text Formatting

- セリフや背景描写などのフレーバーテキストを記述する場合は、UIレンダラーがパース可能な `{斜体} ... {/斜体}` 記法を使用してください。
