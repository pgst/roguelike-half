<script setup lang="ts">
import { ref } from 'vue';
import { useSettings } from '../composables/useSettings';

const props = withDefaults(defineProps<{
  initialTab?: 'settings' | 'help';
}>(), {
  initialTab: 'settings'
});

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const activeMainTab = ref<'settings' | 'help'>(props.initialTab);
const { 
  showDiceOverlay, 
  toggleDiceOverlay,
  autoTrapTargetAllocation,
  toggleAutoTrapTarget,
  autoCombatDefenseAllocation,
  toggleAutoCombatDefense
} = useSettings();

// Help Tabs
type HelpTab = 'basics' | 'explore' | 'combat' | 'growth' | 'sync' | 'workshop';
const activeHelpTab = ref<HelpTab>('basics');

const helpTabs: { id: HelpTab; label: string; icon: string }[] = [
  { id: 'basics', label: '基本ルール', icon: '📖' },
  { id: 'explore', label: '探索とイベント', icon: '🧭' },
  { id: 'combat', label: '戦闘コマンド', icon: '⚔️' },
  { id: 'growth', label: '成長と装備', icon: '🛡️' },
  { id: 'sync', label: 'セーブと設定', icon: '☁️' },
  { id: 'workshop', label: 'シナリオエディタ', icon: '🛠️' }
];
</script>

<template>
  <div class="modal-overlay" @click.self="emit('close')">
    <div class="settings-help-modal paper-sheet animate-fade-in">
      <!-- Top Navigation Header with Tabs -->
      <div class="modal-header">
        <div class="main-tabs-group">
          <button 
            type="button"
            class="main-tab-btn" 
            :class="{ active: activeMainTab === 'settings' }"
            @click="activeMainTab = 'settings'"
          >
            ⚙️ 環境設定
          </button>
          <button 
            type="button"
            class="main-tab-btn" 
            :class="{ active: activeMainTab === 'help' }"
            @click="activeMainTab = 'help'"
          >
            ❓ 冒険の手引き
          </button>
        </div>
        <button @click="emit('close')" class="btn-close" title="閉じる">✕</button>
      </div>

      <!-- Main Body Container -->
      <div class="modal-body-container custom-scrollbar">
        <!-- 1. SETTINGS TAB CONTENT -->
        <div v-if="activeMainTab === 'settings'" class="settings-content animate-fade-in">
          <!-- 1. Dice Overlay Toggle -->
          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-title">🎲 運命のダイス演出</span>
              <span class="setting-desc">
                判定時に画面中央へ3Dダイストレイを表示します。<br/>
                OFFにすると演出をスキップして高速に進行します。
              </span>
            </div>
            <div class="setting-control">
              <button 
                type="button" 
                class="btn-toggle" 
                :class="{ active: showDiceOverlay }"
                @click="toggleDiceOverlay"
              >
                {{ showDiceOverlay ? 'ON (表示)' : 'OFF (非表示)' }}
              </button>
            </div>
          </div>

          <!-- 2. Auto Trap Target Allocation Toggle -->
          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-title">🎯 トラップ対象の自動割り振り</span>
              <span class="setting-desc">
                罠の発動時、主人公や同行従者からランダムに対象を自動選定して即座に解決します。<br/>
                OFF（手動）にすると毎回プレイヤーが身代わりや対象を選択できます。
              </span>
            </div>
            <div class="setting-control">
              <button 
                type="button" 
                class="btn-toggle" 
                :class="{ active: autoTrapTargetAllocation }"
                @click="toggleAutoTrapTarget"
              >
                {{ autoTrapTargetAllocation ? 'ON (自動)' : 'OFF (手動)' }}
              </button>
            </div>
          </div>

          <!-- 3. Auto Combat Defense Allocation Toggle -->
          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-title">🛡️ 戦闘防御担当の自動割り振り</span>
              <span class="setting-desc">
                敵の攻撃を受けた際、防御を行うキャラクター（主人公または戦闘従者）をランダムに自動選定します。<br/>
                ダイス判定や【そらし】【かばう】の手動判断はそのまま行えます。
              </span>
            </div>
            <div class="setting-control">
              <button 
                type="button" 
                class="btn-toggle" 
                :class="{ active: autoCombatDefenseAllocation }"
                @click="toggleAutoCombatDefense"
              >
                {{ autoCombatDefenseAllocation ? 'ON (自動)' : 'OFF (手動)' }}
              </button>
            </div>
          </div>
        </div>

        <!-- 2. HELP TAB CONTENT -->
        <div v-else-if="activeMainTab === 'help'" class="help-content animate-fade-in">
          <!-- Sub Help Tab Bar -->
          <div class="help-tab-bar custom-scrollbar">
            <button
              v-for="t in helpTabs"
              :key="t.id"
              type="button"
              class="sub-tab-btn"
              :class="{ active: activeHelpTab === t.id }"
              @click="activeHelpTab = t.id"
            >
              <span class="tab-icon">{{ t.icon }}</span>
              <span class="tab-label">{{ t.label }}</span>
            </button>
          </div>

          <!-- Help Sections -->
          <div class="help-sections custom-scrollbar">
            <!-- 1. 基本ルール -->
            <div v-if="activeHelpTab === 'basics'" class="tab-content animate-fade-in">
              <div class="help-section">
                <h3>📜 ローグライクハーフとは？ 【Rule 1〜4】</h3>
                <p>
                  「ローグライクハーフ」は、FT書房が制作した1人用テーブルトークRPG（TRPG）です。<br/>
                  冷徹で無情なファンタジー世界「アランツァ」を舞台に、紙とペンとサイコロで行うゲームブック体験を、ブラウザ上で直感的に遊べるよう完全デジタル化しました。
                </p>
              </div>

              <div class="help-section">
                <h3>🎲 サイコロと判定のルール 【Rule 6, 7, 8】</h3>
                <div class="rule-box">
                  <p><strong>【ダイスの表記】</strong></p>
                  <ul style="margin: 0 0 8px 0; padding-left: 18px; display: flex; flex-direction: column; gap: 2px;">
                    <li><strong>1d6：</strong> 6面体サイコロを1個振ります。</li>
                    <li><strong>d66：</strong> サイコロを2回振り、1個目を十の位、2個目を一の位として11〜66の36通りを求めます（部屋探索イベントなどで使用）。</li>
                  </ul>
                  <p><strong>【判定ロール (1d6 + 技量点 vs 目標値)】</strong></p>
                  <p style="margin-bottom: 6px;">
                    1d6の出目に技量点を足した合計（達成値）が【目標値（敵のレベルなど）】以上なら成功です（特に指定がない場合の目標値は4）。
                  </p>
                  <ul style="margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 2px;">
                    <li><strong>出目「6」（クリティカル）：</strong> 目標値に関わらず自動大成功！攻撃ロールなら即座に追加攻撃を行えます。</li>
                    <li><strong>出目「1」（ファンブル）：</strong> 目標値に関わらず自動大失敗となります。</li>
                  </ul>
                </div>
              </div>

              <div class="help-section">
                <h3>👤 主人公の4大基本能力値 【Rule 13, 14】</h3>
                <div class="stat-grid">
                  <div class="stat-card">
                    <span class="stat-icon">⚔️</span>
                    <span class="stat-name">技量点</span>
                    <span class="stat-desc">主人公の武術・運動能力・知識。あらゆる判定ロールの基準となる基本値です。</span>
                  </div>
                  <div class="stat-card">
                    <span class="stat-icon">❤️</span>
                    <span class="stat-name">生命点</span>
                    <span class="stat-desc">生命力の源。ダメージを受けると減少し、0点になると主人公は死亡（ゲームオーバー）します。</span>
                  </div>
                  <div class="stat-card">
                    <span class="stat-icon">✨</span>
                    <span class="stat-name">副能力値 (4種から1つ)</span>
                    <span class="stat-desc">主人公の得意分野。判定時に技量点の代用として現在値を使用可能（使うと1点消費）。</span>
                  </div>
                  <div class="stat-card">
                    <span class="stat-icon">👥</span>
                    <span class="stat-name">従者点</span>
                    <span class="stat-desc">連れて歩ける従者の上限数（初期7人、冒険者2人プレイ時は0人）。</span>
                  </div>
                </div>
              </div>

              <div class="help-section">
                <h3>✨ 4大副能力値の特徴 【Rule 9, 14】</h3>
                <div class="rule-box">
                  <ul style="margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 4px;">
                    <li><strong>💪 筋力点：</strong> 重い扉の破壊や怪力判定に使用。戦闘中に【筋力点】を1点消費して従者を【かばう】ことができます。</li>
                    <li><strong>🎯 器用点：</strong> 鍵開け、トラップ解除、飛び道具以外の器用判定に使用。器用1点を消費して部屋探索のd66を【察知】で振り直せます。</li>
                    <li><strong>🔮 魔術点：</strong> 呪文の習得と行使に使用（魔術ロール）。魔術点を持つ人数や点数に応じて呪文を行使します。</li>
                    <li><strong>🍀 幸運点：</strong> 奇跡の行使（幸運ロール）や罠・不運の回避判定に使用。</li>
                  </ul>
                  <p style="margin-top: 6px; font-size: 0.8rem; color: #705844;">
                    ※副能力値を使った判定は現在の残数で行うため、使うほど成功率は低下します。0点になっても死亡しませんが、代用判定はできなくなります。
                  </p>
                </div>
              </div>

              <div class="help-section">
                <h3>🍞 食料と金貨（リソース） 【Rule 31】</h3>
                <div class="rule-box">
                  <ul style="margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 4px;">
                    <li><strong>🍞 食料：</strong> 戦闘中以外なら<strong>いつでも</strong>食べることができ、生命点を <strong>2点回復</strong> します（生命点満タン時は食べられません）。通常は冒険ごとに2食支給され、余りを次の冒険へ持ち越すことはできません。</li>
                    <li><strong>💰 金貨：</strong> 酒場・市場での装備品の購入、従者の雇用、一部の遭遇でのワイロによる戦闘回避に使います。</li>
                  </ul>
                </div>
              </div>
            </div>

            <!-- 2. 探索とイベント -->
            <div v-else-if="activeHelpTab === 'explore'" class="tab-content animate-fade-in">
              <div class="help-section">
                <h3>🧭 迷宮探索とd66イベント 【Rule 34】</h3>
                <p>
                  迷宮内を進む際、サイコロを2回振って <strong>d66（11〜66の36通り）</strong> のイベント表を参照します。<br/>
                  敵との遭遇、危険なトラップ、宝箱、休息の場、商人やNPCとの出会いなど、多彩なできごとが発生します。
                </p>
              </div>

              <div class="help-section">
                <h3>👁️ 器用【察知】による危険回避 【Rule 25】</h3>
                <div class="rule-box">
                  <p>
                    副能力値【器用点】を持つキャラクターは、部屋に入った際にd66の出目が危険だと判断した場合、<strong>器用点を1点消費してd66を1回振り直す</strong>ことができます。
                  </p>
                </div>
              </div>

              <div class="help-section">
                <h3>🏮 ランタンと暗闇ペナルティ 【Rule 28】</h3>
                <p>
                  ランタンを所持していない場合、または両手武器を装備して両手が塞がっている場合、洞窟内は「暗闇」となり、<strong>すべての判定ロールに -2 の重いペナルティ</strong>が課されます。探索前の購入や装備の確認が肝要です。
                </p>
              </div>

              <div class="help-section">
                <h3>⚠️ 罠と代用判定 【Rule 9, 26】</h3>
                <p>
                  落とし穴や毒針などの罠に遭遇した場合、技量点または対応する副能力値（器用点・筋力点など）を使って【判定ロール】を行い、被害を回避します。副能力値で判定に成功した場合、該当の副能力値が1点消費されます。
                </p>
              </div>
            </div>

            <!-- 3. 戦闘コマンド -->
            <div v-else-if="activeHelpTab === 'combat'" class="tab-content animate-fade-in">
              <div class="help-section">
                <h3>⚔️ 戦闘の流れ 【Rule 35, 36】</h3>
                <div class="rule-box">
                  <ol style="margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 4px;">
                    <li><strong>【反応表】チェック：</strong> 遭遇時、攻撃する前に敵の反応（1d6）を確認できます。【友好的】【中立】【歓待】なら戦闘を回避可能。【逃走】なら即座に勝利！ただし【敵対的】だった場合は敵からの先制攻撃となります。</li>
                    <li><strong>第0ラウンド（遠距離戦）：</strong> 弓矢やスリング、または遠距離呪文による先制攻撃を1回行えます。</li>
                    <li><strong>第1ラウンド以降（接近戦）：</strong> 主人公攻撃 ➔ 従者攻撃 ➔ 敵の反撃の順でラウンドが進行します。</li>
                  </ol>
                </div>
              </div>

              <div class="help-section">
                <h3>🏃 敵の【逃走】とプレイヤーの【逃走】 【Rule 38, 42】</h3>
                <div class="rule-box">
                  <ul style="margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 4px;">
                    <li><strong>敵の逃走：</strong> 敵の生命点または人数が<strong>初期値の半分以下（端数切り捨て）</strong>になった瞬間、敵は戦意を喪失して自動的に逃走します。この場合も敵を倒した時と同様に勝利となり、【宝物表】を獲得できます。</li>
                    <li><strong>プレイヤーの逃走：</strong> 戦況が不利な場合、ラウンド開始時に逃走を試みることができます。敵から1回ずつ攻撃を受けますが、生き延びれば戦闘を離脱して直前の通路へ戻れます。</li>
                  </ul>
                </div>
              </div>

              <div class="help-section">
                <h3>🛡️ 従者システムと【かばう】 【Rule 22, 32, 33】</h3>
                <div class="rule-box">
                  <ul style="margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 4px;">
                    <li><strong>戦闘従者の生命点：</strong> 兵士・剣士・弓兵・魔術師などの「戦う従者」は生命点が1点しかなく、敵の攻撃を受けると即死します。</li>
                    <li><strong>【かばう】：</strong> 従者が攻撃対象になった際、主人公は<strong>【筋力点】を1点消費して</strong>攻撃を肩代わりし、従者の死亡を阻止できます。</li>
                    <li><strong>太刀持ち（非戦闘従者）：</strong> 太刀持ちが同行していると、弓矢から接近戦武器への持ち替え手番消費（1ラウンド）を省略できます。</li>
                  </ul>
                </div>
              </div>

              <div class="help-section">
                <h3>🔨 武器属性【打撃】と【斬撃】の違い 【Rule 28, 29】</h3>
                <div class="rule-box">
                  <p style="margin-bottom: 6px;">
                    すべての近接武器や従者は<strong>【打撃】</strong>か<strong>【斬撃】</strong>のいずれかの属性を持ちます。
                  </p>
                  <ul style="margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 4px;">
                    <li><strong>基本性能の差はありません：</strong> どちらの属性でも通常与えるダメージは同一（命中時1点）です。</li>
                    <li><strong>モンスターの「耐性・弱点」で差が出ます：</strong> 硬い岩石でできた【ゴーレム】には、刃が通らないため【斬撃】で攻撃判定に -1 のペナルティを受けますが、粉砕する【打撃】なら +1 のボーナスを得られます。</li>
                    <li><strong>射撃武器と素手の特性：</strong> 『弓矢』は【斬撃】、『スリング（投石器）』と素手攻撃は【打撃】として扱われます。</li>
                  </ul>
                </div>
              </div>
            </div>

            <!-- 4. 成長と装備 -->
            <div v-else-if="activeHelpTab === 'growth'" class="tab-content animate-fade-in">
              <div class="help-section">
                <h3>⭐ 経験点と能力値の成長 【Rule 5, 15, 16】</h3>
                <p>
                  「ローグライクハーフ」は、キャラクター作成時（初期EXP10点など）および冒険の合間に、手に入れた【経験点（EXP）】を各能力値に1点単位で自由に割り振る<strong>ポイントバイ方式</strong>を採用しています。<br/>
                  技量点、生命点の最大値、副能力値、従者点の上限を、プレイヤーの好みのビルドに合わせて成長させることができます。
                </p>
              </div>

              <div class="help-section">
                <h3>🎒 背負い袋の制限とアイテム管理 【Rule 27】</h3>
                <div class="rule-box">
                  <p>
                    装備品欄（武器・鎧・盾）以外に持ち歩けるアイテムの上限は、<strong>生命点の最大値（着用防具・盾によるボーナスを含む）と同じ数</strong>です。
                  </p>
                  <ul style="margin: 6px 0 0 0; padding-left: 18px; display: flex; flex-direction: column; gap: 2px;">
                    <li><strong>被弾による影響なし：</strong> 戦闘でダメージを受けて「現在の生命点」が減っても、持ち物上限は減少しません。</li>
                    <li><strong>荷物持ち従者の恩恵：</strong> 「荷物持ち」が1人同行するごとに、持ち物枠が <strong>+3枠</strong> 拡張されます。</li>
                    <li><strong>予備の鎧は不可：</strong> 鎧はかさばるため、着用しているもの以外の鎧を持ち歩くことはできません。</li>
                  </ul>
                </div>
              </div>

              <div class="help-section">
                <h3>⚔️ 武器の種類と武具制限なし 【Rule 28, 29, 30】</h3>
                <div class="rule-box">
                  <ul style="margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 4px;">
                    <li><strong>武具制限なし：</strong> 職業による装備制限はありません。魔術師であっても板金鎧や両手武器を自由に装備可能です。</li>
                    <li><strong>武器の攻撃修正：</strong> 軽い武器（攻撃-1）、片手武器（修正なし）、両手武器（攻撃+1）。武器未装備の素手攻撃は攻撃-2（打撃）。</li>
                    <li><strong>両手武器と盾の排他：</strong> 両手武器を装備している間は、盾を装備したりランタンを手に持つことはできません。</li>
                    <li><strong>防具と生命点：</strong> 鎧（革鎧・鎖帷子・板金鎧など）や盾は、着用者の生命点の最大値を底上げします。</li>
                  </ul>
                </div>
              </div>
            </div>

            <!-- 5. セーブと設定 -->
            <div v-else-if="activeHelpTab === 'sync'" class="tab-content animate-fade-in">
              <div class="help-section">
                <h3>☁️ クラウド同期と自動セーブ</h3>
                <p>
                  冒険中の状態は常にブラウザのローカルストレージへ自動保存されます。シナリオ選択画面の「クラウド同期」からGoogleアカウントでログインすると、異なる端末間でもセーブデータを共有可能です。
                </p>
              </div>
            </div>

            <!-- 6. シナリオエディタ -->
            <div v-else-if="activeHelpTab === 'workshop'" class="tab-content animate-fade-in">
              <div class="help-section">
                <h3>🛠️ シナリオエディタ</h3>
                <p>
                  シナリオ選択画面の「＋ 新規カスタムシナリオ作成」から、独自のイベントテーブルやボスを設定したカスタムシナリオを作成・プレイ・JSONエクスポートできます。
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Modal Footer -->
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
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  backdrop-filter: blur(2px);
  padding: 15px;
}

.settings-help-modal {
  max-width: 640px;
  width: 100%;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  padding: 20px;
  border-radius: 8px;
  background: #fffcf5;
  border: 2px solid var(--ink-dark);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 2px solid var(--ink-dark);
  padding-bottom: 10px;
  margin-bottom: 15px;
}

.main-tabs-group {
  display: inline-flex;
  background: rgba(92, 75, 61, 0.08);
  border: 1px solid rgba(92, 75, 61, 0.2);
  border-radius: 8px;
  padding: 3px;
  gap: 4px;
  max-width: calc(100% - 40px);
}

.main-tab-btn {
  background: transparent;
  border: none;
  border-radius: 6px;
  padding: 6px 14px;
  font-family: 'Noto Serif JP', serif;
  font-weight: 500;
  font-size: 0.9rem;
  color: var(--ink-light);
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.main-tab-btn:hover:not(.active) {
  background: rgba(255, 255, 255, 0.5);
  color: var(--ink-dark);
}

.main-tab-btn.active {
  background: var(--ink-dark);
  color: var(--paper-bg);
  font-weight: bold;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.25);
}

.btn-close {
  background: none;
  border: none;
  font-size: 1.2rem;
  cursor: pointer;
  color: var(--ink-dark);
  padding: 2px 6px;
}

.modal-body-container {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

/* Settings Styles */
.settings-content {
  padding: 10px 5px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  background: rgba(255, 255, 255, 0.6);
  border: 1px solid #c2b09a;
  border-radius: 6px;
  padding: 16px;
}

.setting-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}

.setting-title {
  font-family: 'Noto Serif JP', serif;
  font-weight: bold;
  font-size: 1rem;
  color: var(--ink-dark);
}

.setting-desc {
  font-size: 0.85rem;
  color: #705844;
  line-height: 1.4;
}

.btn-toggle {
  min-width: 100px;
  padding: 8px 12px;
  font-family: 'Noto Serif JP', serif;
  font-weight: bold;
  font-size: 0.85rem;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid #c2b09a;
  background: #e8e0d4;
  color: #705844;
}

.btn-toggle.active {
  background: #2e7d32;
  border-color: #1b5e20;
  color: #ffffff;
  box-shadow: 0 2px 4px rgba(46, 125, 50, 0.3);
}

/* Help Styles */
.help-content {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.help-tab-bar {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  padding: 4px 2px 8px 2px;
  margin-bottom: 12px;
  border-bottom: 1px dashed rgba(92, 75, 61, 0.3);
}

.sub-tab-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 5px 12px;
  background: rgba(255, 255, 255, 0.5);
  border: 1px solid #c2b09a;
  border-radius: 6px;
  font-size: 0.8rem;
  font-family: 'Noto Serif JP', serif;
  color: #5c4b3d;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s ease;
}

.sub-tab-btn:hover:not(.active) {
  background: rgba(255, 255, 255, 0.9);
  border-color: var(--ink-dark);
}

.sub-tab-btn.active {
  background: var(--ink-dark);
  color: var(--paper-bg);
  border-color: var(--ink-dark);
  font-weight: bold;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.25);
  transform: translateY(-1px);
}

.help-sections {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding-right: 5px;
}

.help-section {
  margin-bottom: 16px;
}

.help-section h3 {
  font-size: 0.95rem;
  font-family: 'Noto Serif JP', serif;
  color: var(--ink-dark);
  border-left: 3px solid var(--ink-dark);
  padding-left: 8px;
  margin-bottom: 6px;
}

.help-section p {
  font-size: 0.85rem;
  color: #5c4b3d;
  line-height: 1.5;
  margin: 0;
}

.rule-box {
  background: rgba(0, 0, 0, 0.03);
  border: 1px dashed #bba895;
  border-radius: 4px;
  padding: 8px 12px;
  font-size: 0.82rem;
  line-height: 1.5;
  color: #4a3b2c;
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 8px;
}

.stat-card {
  background: rgba(255, 255, 255, 0.6);
  border: 1px solid #c2b09a;
  border-radius: 4px;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.stat-name {
  font-weight: bold;
  font-size: 0.85rem;
  color: var(--ink-dark);
}

.stat-desc {
  font-size: 0.78rem;
  color: #705844;
}

.modal-footer {
  margin-top: 15px;
  display: flex;
  justify-content: flex-end;
  border-top: 1px solid rgba(92, 75, 61, 0.2);
  padding-top: 10px;
}

.btn-close-footer {
  padding: 6px 18px;
  font-size: 0.9rem;
}
</style>
