<script setup lang="ts">
import { useGameState } from '../composables/useGameState';

const { diceTray } = useGameState();

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
  <div class="dice-box">
    <div class="dice-title">📜 ダイストレイ</div>
    <div class="dice-tray">
      <!-- Outer Wooden Tray Border -->
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
          <div v-if="diceTray.d1 === 0" class="no-die">
            ダイスは振られていません
          </div>
        </div>
      </div>
    </div>
    <div class="dice-result" :class="{ 'crit-text': diceTray.isCritical, 'fumble-text': diceTray.isFumble }">
      {{ diceTray.resultText || 'ダイストレイは静まり、次なる一投を待つ。' }}
    </div>
  </div>
</template>

<style scoped>
.dice-box {
  background: var(--paper-bg);
  border: 3px double var(--ink-dark);
  padding: 15px;
  box-shadow: var(--card-shadow);
  border-radius: 4px;
  text-align: center;
  position: relative;
}

.dice-title {
  font-family: 'Noto Serif JP', serif;
  font-weight: 700;
  font-size: 1.1rem;
  color: var(--ink-dark);
  margin-bottom: 10px;
  border-bottom: 1px dashed var(--ink-dark);
  padding-bottom: 5px;
}

.dice-tray {
  background: #382516; /* Dark felt bottom */
  border: 8px solid #201207; /* Thick wood rim */
  border-radius: 6px;
  padding: 10px 20px;
  box-shadow: inset 0 4px 8px rgba(0,0,0,0.6);
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 10px;
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
  width: 60px;
  height: 60px;
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

.no-die {
  font-family: 'Noto Serif JP', serif;
  font-size: 0.9rem;
  color: #8c7664;
  font-style: italic;
}

.dice-result {
  font-family: 'Noto Serif JP', serif;
  font-weight: bold;
  color: var(--ink-dark);
  font-size: 1rem;
  min-height: 24px;
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
  padding: 8px;
  box-sizing: border-box;
}

.pip-slot {
  display: flex;
  align-items: center;
  justify-content: center;
}

.pip {
  width: 10px;
  height: 10px;
  background-color: var(--ink-dark);
  border-radius: 50%;
  display: inline-block;
  box-shadow: inset 0 1px 2px rgba(0,0,0,0.6);
}

.pip.red-pip {
  background-color: #d32f2f !important;
  width: 14px;
  height: 14px;
  box-shadow: inset 0 1px 2px rgba(0,0,0,0.3);
}

/* Color overrides for critical/fumble die */
.die-face.critical .pip {
  background-color: #9c6c0c;
  box-shadow: inset 0 1px 2px rgba(0,0,0,0.3);
}

/* Ruby red pip inside golden critical die */
.die-face.critical .pip.red-pip {
  background-color: #d32f2f !important;
  width: 14px;
  height: 14px;
}

.die-face.fumble .pip {
  background-color: #fff;
  box-shadow: inset 0 1px 2px rgba(0,0,0,0.6);
}

/* White pip on crimson fumble die */
.die-face.fumble .pip.red-pip {
  background-color: #fff !important;
  width: 14px;
  height: 14px;
}
</style>
