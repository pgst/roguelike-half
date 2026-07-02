import { defineConfig, devices } from '@playwright/test';
// 【TypeScript】 '@playwright/test' から型安全な設定を行うための `defineConfig` と、デバイス情報を取得するための `devices` をインポートしています。
// 【Playwright】 テストの動作条件や環境を一元管理するための設定用モジュールです。

/**
 * Playwright 全体の設定を定義します。
 * 
 * 【TypeScript】
 * - `export default` を使用して、この設定オブジェクトをデフォルトエクスポートしています。
 * - `defineConfig` 関数でラップすることで、設定オブジェクトに対してエディタ上での入力補完や
 *   型チェック（TypeScriptの型定義 `PlaywrightTestConfig`）が有効になります。
 */
export default defineConfig({
  timeout: 60000,
  /**
   * テストファイルが配置されているディレクトリのパスを指定します。
   * 【Playwright】 このディレクトリ配下にあるテストファイル（例: `*.spec.ts` など）が自動検出されます。
   */
  testDir: './tests',

  /**
   * テストファイル内のテストを並列で実行するかどうかを設定します。
   * 【Playwright】
   * - `true` にすると、1つのファイル内の複数の `test(...)` ブロックが並行して実行されます。
   * - `false` にすると、ファイル内のテストは上から順に直列で実行されます。ここでは `false`（直列実行）に設定されています。
   */
  fullyParallel: false,

  /**
   * ソースコード内に `test.only` が残っている場合にテスト実行を強制終了（失敗）させるかどうか。
   * 【TypeScript】 `!!process.env.CI` は、環境変数 `CI` の有無を boolean 値（真偽値）に二重否定でキャストしています。
   * 【Playwright】 開発中にローカルで特定のテストのみを実行するために `test.only` を使用することがありますが、
   *              CI環境（GitHub Actions等）でこれが残っていると他のテストが実行されなくなってしまうため、CI上ではエラーにして防ぎます。
   */
  forbidOnly: !!process.env.CI,

  /**
   * テストが失敗した場合の自動リトライ回数を指定します。
   * 【TypeScript】 三項演算子を使用し、CI環境であれば `2`、それ以外（ローカル環境など）であれば `0` を設定しています。
   * 【Playwright】 不安定なテスト（Flaky test）がある場合、自動でリトライさせることで一時的なエラーによるCIの失敗を防ぎます。
   */
  retries: process.env.CI ? 2 : 0,

  /**
   * 同時に実行する並列テストプロセス（ワーカー）の最大数を指定します。
   * 【Playwright】 ここでは `1` に制限されているため、すべてのテストファイルが1つずつ順番に実行されます。
   */
  workers: 1,

  /**
   * テスト結果の出力レポート形式を指定します。
   * 【Playwright】 `'html'` を指定すると、テスト完了後に詳細な結果を確認できるHTML形式のレポートが生成されます。
   */
  reporter: [
    ['html', { host: '0.0.0.0', port: 9323 }]
  ],

  /**
   * すべてのテストプロジェクトで共有されるグローバルな設定です。
   * 【TypeScript】 `use` オブジェクトには `PlaywrightTestOptions` 型に準拠したプロパティを設定できます。
   */
  use: {
    /**
     * テスト内で `await page.goto('/')` のように相対パスで遷移する際のベースとなるURLです。
     * 【Playwright】 ローカル開発サーバーのURL（`http://localhost:5173`）を起点としてテストを実行します。
     */
    baseURL: 'http://127.0.0.1:5173',

    /**
     * テスト実行時のトレース（実行ログ、スクリーンショット、DOMのスナップショットなど）をどのように収集するかを指定します。
     * 【Playwright】 `'on-first-retry'` を設定しているため、最初のテスト失敗によるリトライが実行されたときのみトレースが記録されます。
     */
    trace: 'on-first-retry',
  },

  /**
   * テストを実行するブラウザ環境（プロジェクト）を設定します。
   * 【TypeScript】 オブジェクトの配列として定義され、それぞれのプロジェクトに対して個別の設定を行うことができます。
   */
  projects: [
    {
      name: 'chromium',
      use: { 
        /**
         * 【TypeScript】 スプレッド構文（`...`）を使用して、`devices['Desktop Chrome']` オブジェクトを展開し、プロパティをマージしています。
         * 【Playwright】 Google Chrome や Chromium ブラウザのデフォルト設定（画面サイズ、ユーザーエージェント等）を適用します。
         */
        ...devices['Desktop Chrome'],
        /**
         * テストを実行するブラウザのチャンネルを指定します。
         * 【Playwright】 ここではオープンソース版の `chromium` を使用するように指定しています。
         */
        channel: 'chromium'
      },
    },

    {
      name: 'firefox',
      /**
       * 【Playwright】 Mozilla Firefox デスクトップ環境のデフォルト設定を適用します。
       */
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      /**
       * 【Playwright】 Apple Safari で使われている WebKit レンダリングエンジンのデフォルト設定を適用します。
       */
      use: { ...devices['Desktop Safari'] },
    },
  ],

  /**
   * テストを実行する前に、ローカルで開発用サーバーを自動起動するための設定です。
   * 【Playwright】 テストの開始時にサーバーを自動で立ち上げ、テスト終了時に自動でシャットダウンします。
   */
  webServer: {
    /**
     * 開発用サーバーを起動するためのコマンドを指定します。
     * 【Playwright】 `npm run dev` を実行して、ローカルの開発サーバーを起動します。
     */
    command: 'npm run dev',

    /**
     * サーバーの起動完了を検知するために Playwright が監視するURLです。
     * 【Playwright】 このURLへの接続が成功した段階で、開発サーバーが起動したと判断してテストを開始します。
     */
    url: 'http://127.0.0.1:5173',

    /**
     * すでにサーバーが起動している場合に、そのサーバーを再利用するかどうかを指定します。
     * 【TypeScript】 論理否定演算子 `!` を使用して `process.env.CI` の真偽値を反転させています。
     * 【Playwright】 ローカル開発環境では `true` になり、すでに自分で `npm run dev` などを実行している場合に二重起動を防ぎます。
     *              CI環境（`process.env.CI` が真）では `false` になり、常にクリーンな状態で新しくサーバーを起動します。
     */
    reuseExistingServer: !process.env.CI,
  },
});

