<script setup lang="ts">
import { ref } from 'vue';

const emit = defineEmits<{
  (e: 'close'): void;
}>();

type HelpTab = 'basics' | 'explore' | 'combat' | 'growth' | 'sync' | 'workshop';

const activeTab = ref<HelpTab>('basics');

const tabs: { id: HelpTab; label: string; icon: string }[] = [
  { id: 'basics', label: '基本ルール', icon: '📖' },
  { id: 'explore', label: '探索とイベント', icon: '🧭' },
  { id: 'combat', label: '戦闘コマンド', icon: '⚔️' },
  { id: 'growth', label: '成長と装備', icon: '🛡️' },
  { id: 'sync', label: 'セーブと設定', icon: '☁️' },
  { id: 'workshop', label: 'シナリオ工房', icon: '🛠️' }
];
</script>

<template>
  <div class="modal-overlay" @click.self="emit('close')">
    <div class="help-modal paper-sheet animate-fade-in">
      <!-- Header -->
      <div class="modal-header">
        <div class="header-title-group">
          <h2>❓ 冒険の手引き・操作ガイド</h2>
          <span class="header-subtitle">ローグライクハーフ 公式手引書</span>
        </div>
        <button @click="emit('close')" class="btn-close" title="閉じる">✕</button>
      </div>

      <!-- Tab Navigation Bar -->
      <div class="help-tab-bar custom-scrollbar">
        <button
          v-for="t in tabs"
          :key="t.id"
          class="tab-btn"
          :class="{ active: activeTab === t.id }"
          @click="activeTab = t.id"
        >
          <span class="tab-icon">{{ t.icon }}</span>
          <span class="tab-label">{{ t.label }}</span>
        </button>
      </div>

      <!-- Content Body (Single Scroll Container) -->
      <div class="help-body custom-scrollbar">
        <!-- 1. 基本ルール -->
        <div v-if="activeTab === 'basics'" class="tab-content animate-fade-in">
          <div class="help-section">
            <h3>📜 ローグライクハーフとは？</h3>
            <p>
              「ローグライクハーフ」は、FT書房が制作した1人用テーブルトークRPG（TRPG）です。
              本アプリは、紙とペンとサイコロで行う本来のゲームブック体験を、ブラウザ上で直感的に遊べるように再現したデジタルゲームブックです。
            </p>
          </div>

          <div class="help-section">
            <h3>👤 冒険者の3大能力値</h3>
            <ul class="help-list">
              <li>
                <strong>🧍 技量点 (Skill):</strong>
                ダンジョン内の行動全般、罠の解除、戦闘での命中・攻撃力に影響する最重要ステータスです。
              </li>
              <li>
                <strong>❤️ 生命点 (Life):</strong>
                冒険者の体力（HP）です。ダメージを受けると減少し、<code>0</code> になると力尽きて冒険失敗（ゲームオーバー）となります。
              </li>
              <li>
                <strong>✨ 副能力値 (Sub-Stat):</strong>
                キャラクター作成時に選んだ得意分野です。
                <ul>
                  <li><strong>🔮 魔術:</strong> 強力な呪文の詠唱や、即座に武器を召喚する【武具創造】に使用。</li>
                  <li><strong>✨ 幸運:</strong> 運命を捻じ曲げる奇跡の発動や、危機回避に使用。</li>
                  <li><strong>💪 腕力:</strong> 瓦礫の撤去や強引な罠突破、重い荷物の運搬に使用。</li>
                  <li><strong>⚡ 敏捷:</strong> 素早い罠回避や隠密行動、先制攻撃に使用。</li>
                </ul>
              </li>
            </ul>
          </div>

          <div class="help-section">
            <h3>🎲 ダイスロールと判定ルール</h3>
            <p>
              本ゲームでは主に <strong>6面ダイス（d6）</strong> を振って行動の成否を判定します。
            </p>
            <div class="rule-highlight-box">
              <p><b>基本成功条件:</b> <code>サイコロの出目 ＋ 能力値 ≧ 目標値</code></p>
              <p>目標値以上の値が出れば「成功」、下回ると「失敗」となります。</p>
            </div>
            <ul class="help-list">
              <li><strong>★ クリティカル（会心の一撃）:</strong> 出目が <code>6</code> の場合、目標値に関わらず大成功となり、追加効果や大ダメージを与えます。</li>
              <li><strong>💀 ファンブル（痛恨の失敗）:</strong> 出目が <code>1</code> の場合、自動的に失敗となり、武器の破損や手痛い反撃を受ける場合があります。</li>
            </ul>
          </div>
        </div>

        <!-- 2. 探索とイベント -->
        <div v-if="activeTab === 'explore'" class="tab-content animate-fade-in">
          <div class="help-section">
            <h3>🧭 迷宮探索の流れ</h3>
            <p>
              ダンジョンは複数の部屋（通常8〜10部屋）で構成されています。
              「次の部屋へ進む」ボタンを押すと、<strong>d66（十の位と一の位を2個のサイコロで決定）</strong> が振られ、36通りの部屋イベントがランダムに発生します。
            </p>
          </div>

          <div class="help-section">
            <h3>🚪 部屋イベントの主な種類</h3>
            <ul class="help-list">
              <li><strong>⚔️ モンスター遭遇:</strong> 魔物が立ち塞がります。戦闘に突入し、討伐または逃走するまで先へ進めません。</li>
              <li><strong>⚠️ 罠・危険:</strong> 落とし穴、毒矢、転石などの罠です。指定された能力値で判定を行い、失敗すると生命力や食料を失います。</li>
              <li><strong>💎 宝物部屋:</strong> 金貨や貴重なポーション、武器・防具などの戦利品を獲得できます。</li>
              <li><strong>❓ 特殊イベント:</strong> 泉での休息、怪しげな商人、謎解きなど、選択肢によって運命が分かれるイベントです。</li>
            </ul>
          </div>

          <div class="help-section">
            <h3>🍞 食料とランタン（たいまつ）</h3>
            <p>
              迷宮内での生存にはリソース管理が不可欠です。
            </p>
            <ul class="help-list">
              <li><strong>食料:</strong> 探索中に空腹イベントが発生した際、食料がないと生命力が徐々に減少します。</li>
              <li><strong>ランタン / たいまつ:</strong> 暗闇の部屋では明かりがないと技量判定にペナルティを受けることがあります。</li>
            </ul>
          </div>
        </div>

        <!-- 3. 戦闘コマンド -->
        <div v-if="activeTab === 'combat'" class="tab-content animate-fade-in">
          <div class="help-section">
            <h3>⚔️ ターン制ダイスバトル</h3>
            <p>
              戦闘はラウンド進行のターン制です。プレイヤーが行動コマンドを選択したあと、敵が攻撃を行ってきます。
            </p>
          </div>

          <div class="help-section">
            <h3>🎯 主な戦闘コマンド</h3>
            <ul class="help-list">
              <li>
                <strong>⚔️ 通常攻撃:</strong>
                サイコロを振り、<code>出目 ＋ 装備武器修正 ≧ 敵レベル</code> で攻撃命中。命中すると敵のHPを減らします（通常の雑魚敵は1撃で討伐）。
              </li>
              <li>
                <strong>🔮 魔法呪文 / 奇跡:</strong>
                魔術点や幸運点を消費し、高威力の攻撃呪文や回復魔法を唱えます。必中呪文や防御無視呪文も存在します。
              </li>
              <li>
                <strong>🧪 道具を使う:</strong>
                傷薬で生命力を回復したり、「聖水」を投げてアンデッドの強敵に大ダメージを与えることができます。
              </li>
              <li>
                <strong>🏃 逃走する:</strong>
                強敵や絶体絶命のピンチから命からがら逃げ出します。逃走判定に失敗すると手痛い一撃を受けるリスクがあります。
              </li>
              <li>
                <strong>👥 従者の支援:</strong>
                雇っている従者がいる場合、戦闘中に自動で追加攻撃や援護防御を行ってくれます。
              </li>
            </ul>
          </div>
        </div>

        <!-- 4. 成長と装備 -->
        <div v-if="activeTab === 'growth'" class="tab-content animate-fade-in">
          <div class="help-section">
            <h3>📜 冒険記録紙（シート）の確認</h3>
            <p>
              画面上部の固定バーにある <strong>［📜 ステータス詳細］</strong> ボタンを押すと、いつでも冒険記録紙を開いて現在の持ち物や装備、従者を確認できます。
            </p>
          </div>

          <div class="help-section">
            <h3>🛡️ 装備の切り替えルール</h3>
            <ul class="help-list">
              <li><strong>武器:</strong> 攻撃時の命中判定を底上げします。「両手武器」を装備すると、自動的に「盾」が外れるため防御面とのバランスが重要です。</li>
              <li><strong>防具:</strong> 装備すると最大生命力（HP）が増加し、耐久力が底上げされます。</li>
              <li><strong>盾:</strong> 片手武器と同時に装備でき、敵の攻撃を弾く確率を高めます。</li>
            </ul>
          </div>

          <div class="help-section">
            <h3>📈 経験点（Exp）と能力強化</h3>
            <p>
              シナリオを踏破して生還すると、<strong>経験点（1点〜）</strong> を獲得します。
              宿屋画面で経験点を消費し、技量点・生命点・副能力値を恒久的にレベルアップさせることができます。
            </p>
          </div>
        </div>

        <!-- 5. セーブと設定 -->
        <div v-if="activeTab === 'sync'" class="tab-content animate-fade-in">
          <div class="help-section">
            <h3>💾 自動セーブ（オートセーブ）</h3>
            <p>
              探索の1部屋ごと、戦闘の各ターンごとに、進行状況はブラウザ（LocalStorage）へ自動保存されます。
              ブラウザを誤って閉じたりリロードしても、タイトル画面の「進行中の冒険を再開する」から直前の状態へ復帰できます。
            </p>
          </div>

          <div class="help-section">
            <h3>☁️ クラウド同期とGoogle連携</h3>
            <p>
              上部バーの <strong>［☁️ クラウド同期］</strong> からGoogleアカウントと連携すると、セーブデータをクラウドへ安全にバックアップできます。
            </p>
            <ul class="help-list">
              <li><strong>端末間共有:</strong> PCで進めた冒険の続きを、外出先でスマートフォンから復元して遊べます。</li>
              <li><strong>バックアップと復元:</strong> 「今すぐバックアップ」でクラウドへ最新データを送信し、「クラウドから復元」で別端末のデータを取り込みます。</li>
            </ul>
          </div>

          <div class="help-section">
            <h3>⚙️ 環境設定（運命のダイス演出）</h3>
            <p>
              上部バーの <strong>［⚙️ 設定］</strong> から、ダイスロール時の3Dアニメーショントレイ表示を ON / OFF できます。
              OFFに設定すると、ダイス演出がスキップされ、テキストログ中心で快適に高速周回プレイが行えます。
            </p>
          </div>
        </div>

        <!-- 6. シナリオ工房 -->
        <div v-if="activeTab === 'workshop'" class="tab-content animate-fade-in">
          <div class="help-section">
            <h3>🛠️ シナリオ工房（自作ダンジョン）</h3>
            <p>
              タイトル画面の「🛠️ カスタムシナリオ」から、オリジナルのダンジョンを自由自在に創作できます。
            </p>
          </div>

          <div class="help-section">
            <h3>📊 適正レベル自動計算機能</h3>
            <p>
              部屋数、出現するエネミーの平均レベル、強敵の数、ボスの生命力や攻撃回数をもとに、シナリオの難易度（例:「適正レベル：11-12」）をリアルタイムに自動判定します。
              初心者向けダンジョンから超高難度の凶悪迷宮まで、バランスの取れた設計が簡単に行えます。
            </p>
          </div>

          <div class="help-section">
            <h3>📤 シナリオの配布と共有</h3>
            <ul class="help-list">
              <li><strong>エクスポート:</strong> 作成したシナリオは、ボタン1つで標準 JSON ファイルとしてダウンロードできます。</li>
              <li><strong>インポート:</strong> 友人やコミュニティで配布された JSON ファイルを読み込むだけで、即座にその冒険に挑むことができます。</li>
            </ul>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="modal-footer">
        <button @click="emit('close')" class="btn-ink btn-close-footer">閉じる</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.65);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  backdrop-filter: blur(2px);
  padding: 15px;
}

.help-modal {
  max-width: 720px;
  width: 100%;
  max-height: 88vh;
  display: flex;
  flex-direction: column;
  border: 3px double var(--ink-dark);
  border-radius: 8px;
  background: var(--paper-bg);
  box-shadow: 0 12px 35px rgba(0, 0, 0, 0.6);
  overflow: hidden;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 20px;
  border-bottom: 2px solid var(--ink-dark);
  background: rgba(0, 0, 0, 0.03);
  flex-shrink: 0;
}

.header-title-group {
  display: flex;
  align-items: baseline;
  gap: 10px;
  flex-wrap: wrap;
}

.modal-header h2 {
  font-family: 'Noto Serif JP', serif;
  font-size: 1.25rem;
  margin: 0;
  color: var(--ink-dark);
}

.header-subtitle {
  font-size: 0.8rem;
  color: #705844;
  font-style: italic;
}

.btn-close {
  background: none;
  border: 1px solid var(--ink-dark);
  color: var(--ink-dark);
  border-radius: 4px;
  padding: 4px 10px;
  font-size: 0.85rem;
  cursor: pointer;
  font-weight: bold;
}

.btn-close:hover {
  background: #8c1c1c;
  color: #fff;
  border-color: #8c1c1c;
}

/* Tab Navigation Bar */
.help-tab-bar {
  display: flex;
  gap: 6px;
  padding: 10px 16px;
  background: rgba(92, 75, 61, 0.05);
  border-bottom: 1px solid #c2b09a;
  overflow-x: auto;
  flex-shrink: 0;
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1px solid #c2b09a;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.6);
  color: #705844;
  font-family: 'Noto Serif JP', serif;
  font-size: 0.85rem;
  font-weight: bold;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s ease;
}

.tab-btn:hover {
  background: #fff;
  border-color: var(--ink-dark);
  color: var(--ink-dark);
}

.tab-btn.active {
  background: var(--ink-dark);
  color: #fff;
  border-color: var(--ink-dark);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

/* Content Body */
.help-body {
  padding: 20px 24px;
  overflow-y: auto;
  flex: 1;
}

.help-section {
  margin-bottom: 22px;
}

.help-section:last-child {
  margin-bottom: 0;
}

.help-section h3 {
  font-family: 'Noto Serif JP', serif;
  font-size: 1.05rem;
  color: var(--ink-dark);
  margin: 0 0 8px 0;
  border-left: 3px solid var(--ink-dark);
  padding-left: 8px;
}

.help-section p {
  font-size: 0.9rem;
  color: #3b2c1a;
  line-height: 1.6;
  margin: 0 0 8px 0;
}

.help-list {
  padding-left: 20px;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 0.88rem;
  color: #3b2c1a;
  line-height: 1.5;
}

.help-list li strong {
  color: var(--ink-dark);
}

.help-list ul {
  padding-left: 18px;
  margin-top: 4px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.rule-highlight-box {
  background: rgba(255, 255, 255, 0.7);
  border: 1px dashed #8c6d46;
  padding: 10px 14px;
  border-radius: 4px;
  margin: 8px 0 10px 0;
  font-size: 0.88rem;
}

.rule-highlight-box p {
  margin: 0 0 4px 0;
}

.rule-highlight-box p:last-child {
  margin: 0;
}

code {
  background: rgba(0, 0, 0, 0.06);
  padding: 2px 5px;
  border-radius: 3px;
  font-family: monospace;
  font-weight: bold;
}

/* Footer */
.modal-footer {
  padding: 12px 20px;
  border-top: 1px solid #c2b09a;
  background: rgba(0, 0, 0, 0.02);
  display: flex;
  justify-content: flex-end;
  flex-shrink: 0;
}

.btn-close-footer {
  padding: 6px 20px;
  font-size: 0.9rem;
}

/* Mobile Responsiveness */
@media (max-width: 640px) {
  .modal-header {
    padding: 10px 14px;
  }
  .modal-header h2 {
    font-size: 1.1rem;
  }
  .help-body {
    padding: 14px 16px;
  }
  .tab-btn {
    padding: 5px 8px;
    font-size: 0.8rem;
  }
}
</style>
