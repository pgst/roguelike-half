import { ref, watch } from 'vue';

const STORAGE_KEY_SHOW_DICE = 'rlh_setting_show_dice';
const STORAGE_KEY_AUTO_TRAP = 'rlh_setting_auto_trap_target';
const STORAGE_KEY_AUTO_COMBAT_DEFENSE = 'rlh_setting_auto_combat_defense';

function loadInitialBoolean(key: string, defaultValue: boolean): boolean {
  if (typeof window === 'undefined') return defaultValue;
  const stored = localStorage.getItem(key);
  return stored === null ? defaultValue : stored === 'true';
}

const showDiceOverlay = ref<boolean>(loadInitialBoolean(STORAGE_KEY_SHOW_DICE, true));
const autoTrapTargetAllocation = ref<boolean>(loadInitialBoolean(STORAGE_KEY_AUTO_TRAP, false));
const autoCombatDefenseAllocation = ref<boolean>(loadInitialBoolean(STORAGE_KEY_AUTO_COMBAT_DEFENSE, false));

watch(showDiceOverlay, (val) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY_SHOW_DICE, String(val));
  }
});

watch(autoTrapTargetAllocation, (val) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY_AUTO_TRAP, String(val));
  }
});

watch(autoCombatDefenseAllocation, (val) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY_AUTO_COMBAT_DEFENSE, String(val));
  }
});

export function useSettings() {
  function toggleDiceOverlay() {
    showDiceOverlay.value = !showDiceOverlay.value;
  }

  function setDiceOverlay(val: boolean) {
    showDiceOverlay.value = val;
  }

  function toggleAutoTrapTarget() {
    autoTrapTargetAllocation.value = !autoTrapTargetAllocation.value;
  }

  function setAutoTrapTarget(val: boolean) {
    autoTrapTargetAllocation.value = val;
  }

  function toggleAutoCombatDefense() {
    autoCombatDefenseAllocation.value = !autoCombatDefenseAllocation.value;
  }

  function setAutoCombatDefense(val: boolean) {
    autoCombatDefenseAllocation.value = val;
  }

  return {
    showDiceOverlay,
    toggleDiceOverlay,
    setDiceOverlay,
    autoTrapTargetAllocation,
    toggleAutoTrapTarget,
    setAutoTrapTarget,
    autoCombatDefenseAllocation,
    toggleAutoCombatDefense,
    setAutoCombatDefense
  };
}
