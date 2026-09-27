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
    :class="{ 'has-unread': isMessageWaiting }"
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
  margin: 0 auto 10px auto;
  max-width: 960px;
  width: 100%;
  background: #0d0f14;
  color: #f5f5f5;
  border: 3px double #d4af37;
  border-radius: 6px;
  padding: 10px 14px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.6), inset 0 0 10px rgba(0, 0, 0, 0.8);
  font-family: 'Hiragino Mincho ProN', 'Yu Mincho', serif;
  user-select: none;
  cursor: default;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
  position: relative;
  z-index: 100;
}

.dq-message-window.has-unread {
  cursor: pointer;
  border-color: #ffd700;
  box-shadow: 0 4px 18px rgba(212, 175, 55, 0.25), inset 0 0 12px rgba(212, 175, 55, 0.15);
}

.window-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 48px;
}

.msg-content {
  flex: 1;
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-size: 1.05rem;
  line-height: 1.6;
  letter-spacing: 0.04em;
  word-break: break-word;
}

.msg-bullet {
  font-size: 0.75rem;
  color: #888;
}

.msg-bullet.roll { color: #5dade2; }
.msg-bullet.combat { color: #ec7063; }
.msg-bullet.damage { color: #e74c3c; }
.msg-bullet.success { color: #58d68d; }
.msg-bullet.error { color: #e74c3c; }

.msg-text {
  color: #f7f3e9;
}

.msg-text.roll { color: #aed6f1; }
.msg-text.combat { color: #f1948a; }
.msg-text.damage { color: #ff6b6b; font-weight: bold; }
.msg-text.success { color: #82e0aa; font-weight: bold; }
.msg-text.error { color: #f5b7b1; font-weight: bold; }

/* ドラクエ風 ▼ アニメーション */
.dq-cursor {
  display: inline-block;
  color: #ffd700;
  font-size: 0.95rem;
  font-weight: bold;
  margin-left: 6px;
  animation: dqBlink 0.65s infinite steps(1, start);
}

@keyframes dqBlink {
  0%, 100% { opacity: 1; transform: translateY(0); }
  50% { opacity: 0; transform: translateY(2px); }
}

/* 操作系ボタン */
.msg-controls {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.unread-badge {
  font-size: 0.75rem;
  background: #8c1c1c;
  color: #fff;
  padding: 2px 7px;
  border-radius: 10px;
  font-weight: bold;
  letter-spacing: 0.02em;
  box-shadow: 0 1px 3px rgba(0,0,0,0.4);
}

.btn-msg-ctrl {
  background: rgba(40, 44, 52, 0.9);
  border: 1px solid #665233;
  color: #dfd7ca;
  font-family: sans-serif;
  font-size: 0.75rem;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.btn-msg-ctrl:hover {
  background: #3a3f4b;
  border-color: #d4af37;
  color: #fff;
}

.btn-msg-ctrl:active {
  transform: translateY(1px);
}

.btn-skip {
  background: rgba(70, 30, 30, 0.8);
  border-color: #933;
  color: #ffcccc;
}

.btn-skip:hover {
  background: #8c1c1c;
  color: #fff;
}

.btn-auto.auto-active {
  background: #1e5a2c;
  border-color: #27ae60;
  color: #a9dfbf;
  animation: pulseAuto 1.5s infinite alternate;
}

@keyframes pulseAuto {
  from { box-shadow: 0 0 2px #27ae60; }
  to { box-shadow: 0 0 8px #2ecc71; }
}

@media (max-width: 600px) {
  .window-inner {
    flex-direction: column;
    align-items: flex-start;
  }
  .msg-controls {
    align-self: flex-end;
    margin-top: 4px;
  }
}
</style>
