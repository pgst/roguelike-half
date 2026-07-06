import type { Ref } from 'vue';
import type { Character, Follower, DungeonEvent } from '../../types';
import { pyramidPlugin } from './pyramidPlugin';

export interface CustomChoice {
  id: string;
  label: string;
  checkStat?: 'strength' | 'dexterity' | 'magic' | 'luck' | 'skill';
  checkTarget?: number;
  onSelect: (result?: { success: boolean; roll: number; total: number }) => void;
  disabled?: boolean;
}

export interface ScenarioPlugin {
  id: string;
  onAdventureStart?: (character: Ref<Character>, followers: Ref<Follower[]>) => void;
  onExploreRoom?: (event: DungeonEvent, character: Ref<Character>, followers: Ref<Follower[]>) => Promise<boolean | void>;
  onTrapResolve?: (event: DungeonEvent, result: { success: boolean; roll: number }, character: Ref<Character>, followers: Ref<Follower[]>) => void;
  onCombatStart?: (combatState: any, character: Ref<Character>, followers: Ref<Follower[]>) => void;
  onCombatRoundStart?: (combatState: any, character: Ref<Character>, followers: Ref<Follower[]>) => void;
  onCombatRoundEnd?: (combatState: any, character: Ref<Character>, followers: Ref<Follower[]>) => void;
  onCombatVictory?: (character: Ref<Character>, followers: Ref<Follower[]>) => void;
  onCombatDefeat?: (character: Ref<Character>, followers: Ref<Follower[]>) => void;
  onAdventureEnd?: (character: Ref<Character>, followers: Ref<Follower[]>) => void;
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

export async function runScenarioHook<K extends keyof ScenarioPlugin>(
  activeScenarioId: string | undefined,
  hook: K,
  ...args: any[]
): Promise<any> {
  if (!activeScenarioId) return;
  const plugin = getScenarioPlugin(activeScenarioId);
  if (plugin && plugin[hook]) {
    const fn = plugin[hook] as any;
    return await fn(...args);
  }
}
