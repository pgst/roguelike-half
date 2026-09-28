<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue';
import { useGameState } from '../composables/useGameState';

const {
  logs,
  currentMessage,
  pendingMessages,
  isMessageWaiting,
  isAutoAdvance,
  advanceMessage,
  skipAllMessages,
  toggleAutoAdvance,
  showLogbookModal
} = useGameState();

const props = withDefaults(defineProps<{
  embedded?: boolean;
}>(), {
  embedded: false
});

const emit = defineEmits<{
  (e: 'open-logbook'): void;
}>();

// 表示するメッセージ（承認待機中のメッセージがあればそれ、なければ最新のログ）
const displayMessage = computed(() => {
  if (currentMessage.value) {
    return currentMessage.value;
  }
  if (logs.value.length > 0) {
    return logs.value[logs.value.length - 1];
  }
  return {
    id: 'empty',
    text: '迷宮の扉が開かれました。あなたの歩みがここに記されます...',
    type: 'info' as const
  };
});

// 未読件数（現在表示中含む）
const unreadCount = computed(() => {
  if (!currentMessage.value) return 0;
  return 1 + pendingMessages.value.length;
});

// キーボード操作（Space, Enterで次へ）
function handleKeyDown(e: KeyboardEvent) {
  // input/textarea/select フォーカス時は除外
  const target = e.target as HTMLElement | null;
  if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
    return;
  }
  // モーダル等が開いているかの簡易判定（bodyにmodal-overlayがある場合）
  if (document.querySelector('.modal-overlay:not([style*="display: none"])')) {
    return;
  }

  if (e.code === 'Space' || e.key === 'Enter') {
    if (isMessageWaiting.value) {
      e.preventDefault();
      advanceMessage();
    }
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
});

function handleWindowClick(e: MouseEvent) {
  // 操作ボタンのクリックはバブリングさせない
  const target = e.target as HTMLElement | null;
  if (target && target.closest('.msg-controls')) {
    return;
  }
  if (isMessageWaiting.value) {
    advanceMessage();
  }
}
</script>

<template>
  <div 
    class="dq-message-window" 
    :class="{ 'has-unread': isMessageWaiting, 'is-embedded': embedded }"
    @click="handleWindowClick"
    title="クリックまたは [Space / Enter] で次のメッセージへ"
  >
    <div class="window-inner">
      <!-- メインメッセージ表示領域 -->
      <div class="msg-content">
        <span class="msg-bullet" :class="displayMessage.type">■</span>
        <span class="msg-text" :class="displayMessage.type">{{ displayMessage.text }}</span>
        
        <!-- ドラクエ風 点滅カーソル (▼) -->
        <span v-if="isMessageWaiting" class="dq-cursor" title="次へ進む">▼</span>
      </div>

      <!-- 右側補助コントロール -->
      <div class="msg-controls">
        <span v-if="unreadCount > 1" class="unread-badge">
          あと {{ unreadCount }} 件
        </span>

        <button 
          v-if="isMessageWaiting"
          type="button" 
          @click.stop="skipAllMessages" 
          class="btn-msg-ctrl btn-skip"
          title="未読メッセージを一括送り"
        >
          ⏩ スキップ
        </button>

        <button 
          type="button" 
          @click.stop="toggleAutoAdvance" 
          class="btn-msg-ctrl btn-auto" 
          :class="{ 'auto-active': isAutoAdvance }"
          :title="isAutoAdvance ? '自動送り中 (クリックで解除)' : '自動送り (オート進行)'"
        >
          {{ isAutoAdvance ? '⚡ オート中' : '⏱️ オート' }}
        </button>

        <button 
          type="button" 
          @click.stop="showLogbookModal = true" 
          class="btn-msg-ctrl btn-log" 
          title="過去ログ（冒険の足跡）を開く"
        >
          📖 全履歴
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dq-message-window {
  box-sizing: border-box;
  margin: 0 auto 10px auto;
  max-width: 960px;
  width: 100%;
  background: var(--paper-bg, #f6ebd2);
  background-image: radial-gradient(rgba(0,0,0,0.02) 20%, transparent 20%),
                    radial-gradient(rgba(0,0,0,0.02) 20%, transparent 20%);
  background-size: 16px 16px;
  background-position: 0 0, 8px 8px;
  color: var(--ink-dark, #1b1612);
  border: 3px double var(--ink-dark, #1b1612);
  border-radius: 6px;
  padding: 10px 14px;
  box-shadow: var(--card-shadow, 0 4px 10px rgba(0, 0, 0, 0.4));
  font-family: 'Noto Serif JP', 'Hiragino Mincho ProN', 'Yu Mincho', serif;
  user-select: none;
  cursor: default;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
  position: relative;
  z-index: 100;
}

.dq-message-window.has-unread {
  cursor: pointer;
  border-color: #8c1c1c;
  box-shadow: 0 4px 14px rgba(140, 28, 28, 0.25), inset 0 0 10px rgba(140, 28, 28, 0.08);
}

.dq-message-window.is-embedded {
  box-sizing: border-box;
  margin: 14px 0;
  max-width: 100%;
  width: 100%;
  height: auto;
  min-height: 75px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  border-top: 1px dashed rgba(92, 75, 61, 0.4);
  border-bottom: 1px dashed rgba(92, 75, 61, 0.4);
  border-left: none;
  border-right: none;
  background: rgba(92, 75, 61, 0.03);
  box-shadow: none;
  border-radius: 0;
  padding: 10px 8px;
}

.dq-message-window.is-embedded.has-unread {
  border-top: 1px dashed #8c1c1c;
  border-bottom: 1px dashed #8c1c1c;
  background: rgba(140, 28, 28, 0.02);
  box-shadow: none;
}

.window-inner {
  box-sizing: border-box;
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-height: 54px;
}

.msg-content {
  box-sizing: border-box;
  width: 100%;
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-size: 1.05rem;
  line-height: 1.6;
  letter-spacing: 0.03em;
  word-break: break-word;
  padding-bottom: 28px; /* 右下の固定ボタンと文字が重ならない防御パディング */
}

.msg-bullet {
  font-size: 0.75rem;
  color: var(--ink-light, #5c4b3d);
}

.msg-bullet.roll { color: #0c5460; }
.msg-bullet.combat { color: #8c1c1c; }
.msg-bullet.damage { color: #a71d2a; }
.msg-bullet.success { color: #155724; }
.msg-bullet.error { color: #a71d2a; }

.msg-text {
  color: var(--ink-dark, #1b1612);
  font-weight: 500;
}

.msg-text.roll { color: #0c5460; font-weight: bold; }
.msg-text.combat { color: #8c1c1c; font-weight: bold; }
.msg-text.damage { color: #a71d2a; font-weight: bold; }
.msg-text.success { color: #155724; font-weight: bold; }
.msg-text.error { color: #a71d2a; font-weight: bold; }

/* ドラクエ風 ▼ アニメーション */
.dq-cursor {
  display: inline-block;
  color: #8c1c1c;
  font-size: 0.95rem;
  font-weight: bold;
  margin-left: 6px;
  animation: dqBlink 0.65s infinite steps(1, start);
}

@keyframes dqBlink {
  0%, 100% { opacity: 1; transform: translateY(0); }
  50% { opacity: 0; transform: translateY(2px); }
}

/* 操作系ボタン（右下固定ツールバー） */
.msg-controls {
  position: absolute;
  right: 6px;
  bottom: 6px;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  z-index: 5;
}

.unread-badge {
  font-size: 0.75rem;
  background: rgba(140, 28, 28, 0.12);
  color: #8c1c1c;
  border: 1px solid #8c1c1c;
  padding: 2px 7px;
  border-radius: 10px;
  font-weight: bold;
  letter-spacing: 0.02em;
}

.btn-msg-ctrl {
  background: rgba(92, 75, 61, 0.08);
  border: 1px solid var(--ink-light, #5c4b3d);
  color: var(--ink-dark, #1b1612);
  font-family: 'Noto Serif JP', serif;
  font-size: 0.75rem;
  font-weight: bold;
  padding: 3px 8px;
  border-radius: 3px;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
  box-shadow: 1px 1px 0 var(--ink-dark, #1b1612);
}

.btn-msg-ctrl:hover {
  background: rgba(92, 75, 61, 0.18);
  transform: translateY(-1px);
}

.btn-msg-ctrl:active {
  transform: translateY(1px);
  box-shadow: none;
}

.btn-skip {
  background: rgba(140, 28, 28, 0.1);
  border-color: #8c1c1c;
  color: #8c1c1c;
}

.btn-skip:hover {
  background: #8c1c1c;
  color: #fff;
}

.btn-auto.auto-active {
  background: #b8860b;
  border-color: #8c6508;
  color: #fff;
  animation: pulseAuto 1.5s infinite alternate;
}

@keyframes pulseAuto {
  from { box-shadow: 0 0 2px #b8860b; }
  to { box-shadow: 0 0 6px #d4af37; }
}

@media (max-width: 600px) {
  .btn-msg-ctrl {
    font-size: 0.7rem;
    padding: 2px 6px;
  }
  .unread-badge {
    font-size: 0.7rem;
    padding: 1px 5px;
  }
}
</style>
