import { ref, watch } from 'vue';

const STORAGE_KEY_SHOW_DICE = 'rlh_setting_show_dice';

function loadInitialShowDice(): boolean {
  if (typeof window === 'undefined') return true;
  const stored = localStorage.getItem(STORAGE_KEY_SHOW_DICE);
  return stored === null ? true : stored === 'true';
}

const showDiceOverlay = ref<boolean>(loadInitialShowDice());

watch(showDiceOverlay, (val) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY_SHOW_DICE, String(val));
  }
});

export function useSettings() {
  function toggleDiceOverlay() {
    showDiceOverlay.value = !showDiceOverlay.value;
  }

  function setDiceOverlay(val: boolean) {
    showDiceOverlay.value = val;
  }

  return {
    showDiceOverlay,
    toggleDiceOverlay,
    setDiceOverlay
  };
}
