import type { Ref } from 'vue';
import type { Character, Follower, DungeonEvent, Scenario, Enemy } from '../../types';
import { pyramidPlugin } from './pyramidPlugin';

export interface CustomChoice {
  id: string;
  label: string;
  checkStat?: 'strength' | 'dexterity' | 'magic' | 'luck' | 'skill';
  checkTarget?: number;
  onSelect: (result?: { success: boolean; roll: number; total: number }) => void;
  disabled?: boolean;
}

export interface ScenarioPluginContext {
  character: Ref<Character>;
  followers: Ref<Follower[]>;
  combatState: any;
  currentScreen: Ref<any>;
  dungeonDepth: Ref<number>;
  activeEvent: Ref<DungeonEvent | null>;
  activeScenario: Ref<Scenario | null>;
  addLog: (text: string, type?: 'info' | 'roll' | 'combat' | 'error' | 'success' | 'damage') => void;
  pyramidRunCount: Ref<number>;
  triggerLevelUp: () => void;
  transitionToSuccess: () => void;
  transitionToExplore: () => void;
  triggerGameOver: () => void;
  savePyramidBossSnapshot?: () => void;
  restorePyramidBossSnapshot?: (rewindAmount: number) => void;
  rollSpellResistance?: (target?: number) => Promise<{ success: boolean; fumble: boolean; roll: number; total: number }>;
  endCombat?: (isVictory: boolean, getLoot?: boolean) => void;
  rollD6?: (isCheck?: boolean) => Promise<number>;
  rollD66?: () => Promise<{ d1: number; d2: number; value: number }>;
  activateRoomEvent?: (event: any) => void;
  startEncounter?: () => void;
  handleDeath?: () => void;
}

export interface ScenarioPlugin {
  id: string;
  onAdventureStart?: (context: ScenarioPluginContext) => Promise<void> | void;
  onExploreRoomOverride?: (context: ScenarioPluginContext) => Promise<boolean> | boolean;
  onExploreRoom?: (context: ScenarioPluginContext) => Promise<boolean | void> | boolean | void;
  onTrapResolve?: (context: ScenarioPluginContext, result: { success: boolean; roll: number }) => Promise<void> | void;
  onCombatStart?: (context: ScenarioPluginContext) => Promise<void> | void;
  onCombatRoundStart?: (context: ScenarioPluginContext) => Promise<void> | void;
  onCombatRoundEnd?: (context: ScenarioPluginContext) => Promise<void> | void;
  onGenerateEnemyAttacks?: (context: ScenarioPluginContext, enemy: Enemy, attackQueue: any[]) => boolean | void;
  onDetermineEnemyAttackCount?: (context: ScenarioPluginContext, enemy: Enemy) => number | undefined;
  onResolveDefenseAttack?: (
    context: ScenarioPluginContext,
    enemy: Enemy,
    attack: any,
    defSuccess: boolean,
    roll: number,
    total: number,
    isHero: boolean,
    defenderId: string
  ) => Promise<void> | void;
  onGetSpellResistanceBonus?: (context: ScenarioPluginContext, target: number) => number | undefined;
  onBeforeCombatEnd?: (context: ScenarioPluginContext, isVictory: boolean, getLoot: boolean) => boolean | void;
  onResolveChronovalsRoar?: (context: ScenarioPluginContext, checkType: 'start' | 'death') => Promise<boolean> | boolean;
  onCombatVictory?: (context: ScenarioPluginContext) => Promise<boolean | void> | boolean | void;
  onCombatDefeat?: (context: ScenarioPluginContext) => Promise<void> | void;
  onAdventureEnd?: (context: ScenarioPluginContext) => Promise<void> | void;
}

const plugins: Record<string, ScenarioPlugin> = {
  [pyramidPlugin.id]: pyramidPlugin
};

export function registerScenarioPlugin(plugin: ScenarioPlugin) {
  plugins[plugin.id] = plugin;
}

export function getScenarioPlugin(id: string): ScenarioPlugin | undefined {
  return plugins[id];
}

export function runScenarioHook<K extends keyof ScenarioPlugin>(
  activeScenarioId: string | undefined,
  hook: K,
  context: ScenarioPluginContext,
  ...extraArgs: any[]
): any {
  if (!activeScenarioId) return;
  const plugin = getScenarioPlugin(activeScenarioId);
  if (plugin && plugin[hook]) {
    const fn = plugin[hook] as any;
    return fn(context, ...extraArgs);
  }
}
