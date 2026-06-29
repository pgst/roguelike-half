# PlaywrightによるE2Eテスト解説（Roguelike Half）

このドキュメントでは、本プロジェクト（Vue 3 + Vite で構成されたローグライクゲーム「Roguelike Half」）における **Playwrightを用いたE2E（End-to-End）テスト** の仕組みと実装方法について解説します。

---

## 1. E2EテストとPlaywrightとは？

- **E2E（End-to-End）テスト**: 
  ユーザーが実際にブラウザを使って操作するのと同じように、画面を開いてクリックし、期待通りの画面遷移や結果になるかを「最初から最後まで」通してテストする手法です。
- **Playwright**: 
  Microsoftが開発しているモダンなWebアプリ向けのE2Eテストフレームワークです。Chromium (Chrome系)、Firefox、WebKit (Safari系) といった複数のブラウザでの挙動を、一つのテストコードで自動検証できます。

---

## 2. プロジェクトにおけるPlaywrightの構成

本プロジェクトには、すでにPlaywrightの実行環境が整っています。主なファイルは以下の2つです。

1. **設定ファイル**: [playwright.config.ts](file:///workspaces/roguelike-half/playwright.config.ts)
2. **テストシナリオ**: [tests/roguelike-half.spec.ts](file:///workspaces/roguelike-half/tests/roguelike-half.spec.ts)

それぞれの役割を見ていきましょう。

### ① 設定ファイル：[playwright.config.ts](file:///workspaces/roguelike-half/playwright.config.ts)

このファイルでは、テストを実行する際の設定を記述しています。特に重要なポイントは以下の通りです。

- **開発サーバーとの連携 (`webServer`)**:
  ```typescript
  webServer: {
    command: 'npm run dev',        // テスト開始時に自動でViteサーバーを起動
    url: 'http://localhost:5173',  // サーバーの準備が整うのを待つURL
    reuseExistingServer: !process.env.CI,
  }
  ```
  手動でアプリを立ち上げなくても、Playwrightが自動的に `npm run dev` を裏で実行し、テスト環境を整えてくれます。
- **対象ブラウザの設定 (`projects`)**:
  `chromium`、`firefox`、`webkit` が定義されており、3つの異なるブラウザエンジンで全く同じテストが自動的に実行されます。

---

### ② テストコード：[tests/roguelike-half.spec.ts](file:///workspaces/roguelike-half/tests/roguelike-half.spec.ts)

このファイルには、実際にゲームを自動プレイするためのロジックが書かれています。

ローグライクゲームは「ダイス（サイコロ）の出目」や「ランダムイベント」によって画面が次々と変化するため、このテストでは**「現在の画面状態を判定しながら、自動的に適切なボタンを押して進めるAIプレイヤー」**のような自律的な仕組みを作っています。

#### 💡 重要なコードのポイント

- **Web要素の選択と待機 (`page.locator`, `isVisible`)**:
  Playwrightは、特定のHTML要素（クラス名やテキスト）が存在するかどうかをリアルタイムに監視します。
  ```typescript
  // キャラクター作成画面が表示されているか？
  if (await page.locator('.creator-card').isVisible()) {
    // 名前を入力
    await page.fill('#char-name', 'Playwright Hero');
    // ...
  }
  ```
- **不安定さを回避する工夫 (`safeClick`)**:
  ダイスのアニメーション中や再レンダリング中にボタンを無理にクリックすると、テストが途中でエラー（Flakyテスト）になってしまいます。それを防ぐために、以下のような「安全にクリックを試み、失敗してもスキップしてやり直す」カスタム関数 `safeClick` のような独自ラッパーが定義されています。
  ```typescript
  async function safeClick(locator: Locator, description: string, postWaitMs = 1500) {
    try {
      if (await locator.isVisible() && await locator.isEnabled({ timeout: 1000 })) {
        await locator.click({ timeout: 3000, force: true });
        await locator.page().waitForTimeout(postWaitMs); // アニメーションを待つ
        return true;
      }
    } catch (e) {
      // エラーになってもテストを即座に落とさず、ゲームループの次のステップに処理を譲る
    }
    return false;
  }
  ```
- **最終的な成否判定 (`expect`)**:
  ゲームを進めていき、最終的に「勝利画面 (Victory)」または「ゲームオーバー画面 (Game Over)」のどちらかにたどり着いたことをテストのゴールとして検証しています。
  ```typescript
  // どちらかのエンディング画面に到達したことをアサート（検証）する
  expect(reachedEnd).toBe(true);
  ```

---

## 3. テストの実行方法と結果の分析

コンテナのターミナルで以下のコマンドを実行すると、E2Eテストが始まります。

```bash
npm run test:e2e
```

### 実際の挙動と分析結果

実際にコンテナ上で実行した場合の動作ログは以下のようになります。

1. **Chromium（Chrome系）でのテスト**:
   裏側で自動プレイが行われ、`61`回のアクションを経て、ゲームオーバー画面に到達して正常にパスしました。
   > `💀 Reached Game Over Screen after 61 actions (loops: 56)!`
2. **Firefoxでのテスト**:
   こちらも同様に、`68`回のアクションを経てゲームオーバー画面に到達し、正常にパスしました。
   > `💀 Reached Game Over Screen after 68 actions (loops: 60)!`
3. **WebKit（Safari系）でのテスト**:
   コンテナ（Linux）の環境によっては、WebKitに必要なシステムライブラリ（`libgtk-4.so.1`など）がインストールされておらず、ブラウザの起動自体がエラーになることがあります。

#### 💡 WebKitなどで起動エラーが出た場合の対処法

このようなOSレベルでの依存ライブラリ不足エラーが発生した場合、以下のいずれかの方法で対処します。

- **依存パッケージのインストール**:
  ```bash
  npx playwright install-deps
  ```
  （※コンテナ環境にsudo権限やパッケージマネージャがある場合に実行可能です）
  
- **特定のブラウザだけで実行する**:
  デフォルトですべてのブラウザをテストする代わりに、以下のように特定のブラウザ（例: Chromium）のみを指定して実行することができます。
  ```bash
  npx playwright test --project=chromium
  ```

---

## 4. まとめ

- **Playwright**は、ユーザーと同じ操作をブラウザ上で超高速・高精度に自動実行して検証するツールです。
- 本コンテナでは、**ゲーム画面のHTML構造を検知して自動でゲームをクリア（またはゲームオーバー）まで進める**という、非常に実践的で面白いE2Eテストが組まれています。
- アニメーションやロード時間を考慮した `safeClick` のような実装は、現実のWeb開発におけるE2Eテストでも極めて重要なベストプラクティスです。
