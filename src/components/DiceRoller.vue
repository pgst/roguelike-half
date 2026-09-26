<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue';
import { useGameState } from '../composables/useGameState';
import { useSettings } from '../composables/useSettings';

const { diceTray } = useGameState();
const { showDiceOverlay } = useSettings();

const isVisible = ref(false);
let hideTimer: ReturnType<typeof setTimeout> | null = null;

function clearTimer() {
  if (hideTimer) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }
}

watch(
  () => diceTray.isRolling,
  (rolling) => {
    clearTimer();
    if (!showDiceOverlay.value) {
      isVisible.value = false;
      return;
    }
    if (rolling) {
      isVisible.value = true;
    } else if (diceTray.d1 > 0) {
      isVisible.value = true;
      // 出目が確定したら1.5秒後に自動フェードアウト
      hideTimer = setTimeout(() => {
        isVisible.value = false;
      }, 1500);
    }
  }
);

function dismiss() {
  clearTimer();
  isVisible.value = false;
}

onUnmounted(() => {
  clearTimer();
});

function isPipActive(value: number, index: number): boolean {
  switch (value) {
    case 1:
      return index === 4;
    case 2:
      return index === 0 || index === 8;
    case 3:
      return index === 0 || index === 4 || index === 8;
    case 4:
      return index === 0 || index === 2 || index === 6 || index === 8;
    case 5:
      return index === 0 || index === 2 || index === 4 || index === 6 || index === 8;
    case 6:
      return index === 0 || index === 2 || index === 3 || index === 5 || index === 6 || index === 8;
    default:
      return false;
  }
}
</script>

<template>
  <Transition name="dice-fade">
    <div v-if="isVisible" class="dice-modal-overlay" @click="dismiss">
      <div class="dice-modal-card" @click.stop>
        <div class="dice-title">📜 運命のダイス</div>
        
        <div class="dice-tray">
          <div class="tray-inner">
            <div v-if="diceTray.isRolling" class="dice-animation">
              <div class="die spinning-die">🎲</div>
              <div v-if="diceTray.sides === 66" class="die spinning-die secondary-die">🎲</div>
            </div>
            <div v-else class="dice-display">
              <div v-if="diceTray.d1 > 0" class="die-face" :class="{ 'critical': diceTray.isCritical, 'fumble': diceTray.isFumble }">
                <div class="pip-grid">
                  <div v-for="i in 9" :key="i" class="pip-slot">
                    <span v-if="isPipActive(diceTray.d1, i - 1)" class="pip" :class="{ 'red-pip': diceTray.d1 === 1 }"></span>
                  </div>
                </div>
              </div>
              <div v-if="diceTray.d2 > 0" class="die-face secondary-die" :class="{ 'critical': diceTray.isCritical, 'fumble': diceTray.isFumble }">
                <div class="pip-grid">
                  <div v-for="i in 9" :key="i" class="pip-slot">
                    <span v-if="isPipActive(diceTray.d2, i - 1)" class="pip" :class="{ 'red-pip': diceTray.d2 === 1 }"></span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="dice-result" :class="{ 'crit-text': diceTray.isCritical, 'fumble-text': diceTray.isFumble }">
          {{ diceTray.resultText || '判定中...' }}
        </div>

        <button type="button" class="btn-dice-dismiss" @click="dismiss">✕ タップで閉じる</button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.dice-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(20, 15, 10, 0.4);
  backdrop-filter: blur(2px);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.dice-modal-card {
  background: var(--paper-bg);
  border: 4px double var(--ink-dark);
  border-radius: 8px;
  padding: 20px 24px;
  box-shadow: 0 12px 35px rgba(0, 0, 0, 0.6);
  text-align: center;
  max-width: 340px;
  width: 90%;
  cursor: default;
  position: relative;
  animation: popIn 0.22s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

@keyframes popIn {
  from { opacity: 0; transform: scale(0.85); }
  to { opacity: 1; transform: scale(1); }
}

.dice-fade-enter-active,
.dice-fade-leave-active {
  transition: opacity 0.25s ease;
}

.dice-fade-enter-from,
.dice-fade-leave-to {
  opacity: 0;
}

.dice-title {
  font-family: 'Noto Serif JP', serif;
  font-weight: 700;
  font-size: 1.1rem;
  color: var(--ink-dark);
  margin-bottom: 12px;
  border-bottom: 1px dashed var(--ink-dark);
  padding-bottom: 6px;
}

.dice-tray {
  background: #382516; /* Dark felt bottom */
  border: 6px solid #201207; /* Thick wood rim */
  border-radius: 6px;
  padding: 12px 20px;
  box-shadow: inset 0 4px 8px rgba(0,0,0,0.6);
  min-height: 70px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12px;
}

.tray-inner {
  display: flex;
  gap: 20px;
  align-items: center;
}

.die {
  font-size: 3rem;
  line-height: 1;
}

.spinning-die {
  animation: spin 0.15s infinite linear;
}

.secondary-die {
  animation-delay: 0.07s;
}

@keyframes spin {
  0% { transform: rotate(0deg) scale(1); }
  50% { transform: rotate(180deg) scale(1.1); }
  100% { transform: rotate(360deg) scale(1); }
}

.dice-display, .dice-animation {
  display: flex;
  gap: 15px;
  justify-content: center;
  align-items: center;
}

.die-face {
  width: 56px;
  height: 56px;
  background: #fff;
  border: 3px solid #000;
  border-radius: 8px;
  color: #000;
  font-size: 2.2rem;
  font-weight: 900;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 6px rgba(0,0,0,0.4);
  font-family: 'Noto Serif JP', serif;
  transition: all 0.3s ease;
}

.die-face.critical {
  background: #f4d068; /* Golden crit */
  border-color: #9c6c0c;
  color: #9c6c0c;
  box-shadow: 0 0 15px #f4d068;
  animation: pop 0.4s ease-out;
}

.die-face.fumble {
  background: #d9534f; /* Crimson fumble */
  border-color: #8c1c1c;
  color: #fff;
  box-shadow: 0 0 15px #d9534f;
  animation: shake 0.4s ease-out;
}

@keyframes pop {
  0% { transform: scale(0.6); }
  80% { transform: scale(1.2); }
  100% { transform: scale(1); }
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  20%, 60% { transform: translateX(-6px); }
  40%, 80% { transform: translateX(6px); }
}

.dice-result {
  font-family: 'Noto Serif JP', serif;
  font-weight: bold;
  color: var(--ink-dark);
  font-size: 0.95rem;
  min-height: 22px;
  line-height: 1.4;
}

.crit-text {
  color: #8a6207;
  text-shadow: 0 0 2px #fdf3d8;
}

.fumble-text {
  color: #8c1c1c;
}

.pip-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(3, 1fr);
  width: 100%;
  height: 100%;
  padding: 6px;
  box-sizing: border-box;
}

.pip-slot {
  display: flex;
  align-items: center;
  justify-content: center;
}

.pip {
  width: 9px;
  height: 9px;
  background-color: var(--ink-dark);
  border-radius: 50%;
  display: inline-block;
  box-shadow: inset 0 1px 2px rgba(0,0,0,0.6);
}

.pip.red-pip {
  background-color: #d32f2f !important;
  width: 13px;
  height: 13px;
  box-shadow: inset 0 1px 2px rgba(0,0,0,0.3);
}

/* Color overrides for critical/fumble die */
.die-face.critical .pip {
  background-color: #9c6c0c;
  box-shadow: inset 0 1px 2px rgba(0,0,0,0.3);
}

.die-face.critical .pip.red-pip {
  background-color: #d32f2f !important;
  width: 13px;
  height: 13px;
}

.die-face.fumble .pip {
  background-color: #fff;
  box-shadow: inset 0 1px 2px rgba(0,0,0,0.6);
}

.die-face.fumble .pip.red-pip {
  background-color: #fff !important;
  width: 13px;
  height: 13px;
}

.btn-dice-dismiss {
  margin-top: 10px;
  background: transparent;
  border: none;
  font-family: 'Noto Serif JP', serif;
  font-size: 0.75rem;
  color: var(--ink-light);
  cursor: pointer;
  padding: 3px 8px;
  border-radius: 4px;
}

.btn-dice-dismiss:hover {
  color: var(--ink-dark);
  text-decoration: underline;
}
</style>
