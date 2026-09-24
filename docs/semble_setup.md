# Semble - AIエージェント向け高性能コード検索ツール

Semble はこの環境に正常にインストールおよび設定されており、AIエージェントが必要のないファイルを読み込むのを防ぎ、トークンの使用量を劇的に削減します（通常の `grep` と比較してトークン使用量を約98%削減）。

## 🛠️ インストールおよびセットアップの概要

1. **パッケージマネージャー (`uv`)**: ホストの `mise` 環境またはシステム上の `uv` / `uvx` を利用します。
2. **Semble CLI ツール**: `uvx semble` を使用して実行します。

---

## 🔍 除外設定 (`.sembleignore`)

ソース以外のファイル、キャッシュ、テスト成果物がインデックスおよび検索の対象にならないよう、ワークスペースのルートに [.sembleignore](../.sembleignore) ファイルを作成しました。

主な除外項目:
- **ビルドと依存関係**: `node_modules/`, `dist/`, `build/`
- **ロックファイル**: `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`
- **エージェントの成果物**: `.antigravitycli/`, `.serena/`, `.gemini/`
- **テスト成果物**: `playwright-report/`, `test-results/`
- **一般的なメタデータ**: `.vscode/`, `.DS_Store`, `*.log`

---

## 🚀 Semble の使い方

### 1. 自然言語によるコード検索 (CLI経由)
機能の説明を記述するか、シンボル名や変数名を指定してコードを検索します。

```bash
# 現在のワークスペースで "App" に関連するコードを検索する
uvx semble search "App" .

# 出力を簡潔に保つため、コンテキストのスニペット行数を制限する
uvx semble search "style" . --max-snippet-lines 5
```

### 2. ドキュメントや設定ファイルの検索
`--content` フラグを使用することで、検索対象を設定ファイルやドキュメントに制限できます。

```bash
# 設定ファイル（tsconfig、playwright、package.json など）を検索する
uvx semble search "vite" . --content config

# マークダウンファイルなどの文章を検索する
uvx semble search "guide" . --content docs
```

### 3. 関連するコードの検索
ファイルと行を指定することで、コードベース内の他の類似する関数やクラスを検索できます。

```bash
uvx semble find-related src/App.vue 1 .
```

### 4. 削減効果と統計の表示
節約されたトークン数や処理時間（ミリ秒）を確認するには、以下を実行します。

```bash
uvx semble savings
```
