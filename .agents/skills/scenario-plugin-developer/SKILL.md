---
name: scenario-plugin-developer
description: Helps create, validate, and register new scenarios and their corresponding custom plugins (behavior hooks) safely without breaking the core engine.
---

# Scenario & Plugin Developer Skill

This skill provides a systematic checklist and code templates for adding a new game scenario and its associated logic plugin to the `roguelike-half` codebase.

---

## 1. When to Use This Skill
Activate this skill whenever you are tasked with:
- Creating a new scenario JSON file.
- Writing custom rules, boss AI, room event overrides, or status effects for a scenario.
- Integrating a new scenario plugin into the composable layers.

---

## 2. Step 1: Scenario JSON Schema Validation
Before writing any TypeScript code, define the scenario data. You must place the new scenario JSON file in `src/data/scenarios/<scenario_id>.json`.

### Verification Steps
To prevent runtime crashes, you **MUST** statically verify the JSON content against the TypeScript types defined in [types/index.ts](file:///workspaces/roguelike-half/src/types/index.ts). Specifically:
1. **Scenario Interface Check**: Ensure the top-level keys match the `Scenario` type.
2. **Enemy Structure Check**: Ensure each enemy defined in `enemies` matches the `Enemy` type structure (e.g., resistances, attributes, health, etc.).
3. **Event Structure Check**: Validate that all dungeon events and trap modifiers comply with the `DungeonEvent` types.

---

## 3. Step 2: Generate Plugin Template
Create a new plugin file at `src/composables/scenarioPlugins/<scenario_id>Plugin.ts`. 

You **MUST** use the following complete skeleton template. It includes all lifecycle hooks declared in the `ScenarioPlugin` interface of [scenarioPlugins/index.ts](file:///workspaces/roguelike-half/src/composables/scenarioPlugins/index.ts). Delete or keep as empty stubs only the hooks that your specific scenario does not require, but do not omit them from the generated skeleton initially.

```typescript
import type { ScenarioPlugin, ScenarioPluginContext } from './index';
import type { Enemy, DungeonEvent } from '../../types';

export const <scenario_id>Plugin: ScenarioPlugin = {
  id: '<scenario_id>',

  /**
   * Called when the adventure starts (e.g., initialization, custom UI setup, shop configuration).
   */
  onAdventureStart: async (context: ScenarioPluginContext): Promise<void> => {
    // Custom setup logic when the adventure begins
  },

  /**
   * Return true to override the core explore room logic entirely.
   */
  onExploreRoomOverride: (context: ScenarioPluginContext): boolean => {
    return false;
  },

  /**
   * Called when a player enters/explores a room (after standard overrides).
   */
  onExploreRoom: (context: ScenarioPluginContext): boolean | void => {
    // Room-specific event triggers or progress increments
  },

  /**
   * Hook called immediately after a trap resolution is finished.
   */
  onTrapResolve: (context: ScenarioPluginContext, result: { success: boolean; roll: number }): void => {
    // React to trap failure/success
  },

  /**
   * Hook executed at the beginning of a combat encounter.
   */
  onCombatStart: async (context: ScenarioPluginContext): Promise<void> => {
    // Pre-combat buffs, boss dialogue, or field effects
  },

  /**
   * Hook executed at the start of each combat round.
   */
  onCombatRoundStart: async (context: ScenarioPluginContext): Promise<void> => {
    // Round-based status updates or ticks
  },

  /**
   * Hook executed at the end of each combat round.
   */
  onCombatRoundEnd: async (context: ScenarioPluginContext): Promise<void> => {
    // Cleanups or round-end status damage resolution
  },

  /**
   * Build the queue of enemy actions/attacks. Return true if you override the core AI.
   */
  onGenerateEnemyAttacks: (context: ScenarioPluginContext, enemy: Enemy, attackQueue: any[]): boolean | void => {
    return false; // Let core combat simulator handle standard attacks
  },

  /**
   * Return a custom number of attacks for the enemy. Return undefined to use default.
   */
  onDetermineEnemyAttackCount: (context: ScenarioPluginContext, enemy: Enemy): number | undefined => {
    return undefined;
  },

  /**
   * Hook executed during defense rolls (after dice are rolled). Use for def debuffs or death checks.
   */
  onResolveDefenseAttack: async (
    context: ScenarioPluginContext,
    enemy: Enemy,
    attack: any,
    defSuccess: boolean,
    roll: number,
    total: number,
    isHero: boolean,
    defenderId: string
  ): Promise<void> => {
    // Handle special boss attacks that inflict poison, curse, or instant death on defense failure
  },

  /**
   * Calculate a modifier to spell resistance checks. Return undefined to use default.
   */
  onGetSpellResistanceBonus: (context: ScenarioPluginContext, target: number): number | undefined => {
    return undefined;
  },

  /**
   * Return true to interrupt standard combat resolution.
   */
  onBeforeCombatEnd: (context: ScenarioPluginContext, isVictory: boolean, getLoot: boolean): boolean | void => {
    return false;
  },

  /**
   * Custom boss roar/gimmick resolver (e.g., Pyramid Chronovals roar).
   */
  onResolveChronovalsRoar: async (context: ScenarioPluginContext, checkType: 'start' | 'death'): Promise<boolean> => {
    return true;
  },

  /**
   * Custom logic when winning a combat encounter.
   */
  onCombatVictory: (context: ScenarioPluginContext): boolean | void => {
    // Custom drops, experience overrides, or scene transitions
  },

  /**
   * Custom logic when losing a combat encounter.
   */
  onCombatDefeat: async (context: ScenarioPluginContext): Promise<void> => {
    // Game over overrides or resurrection mechanics
  },

  /**
   * Hook executed when the scenario is cleared successfully.
   */
  onAdventureEnd: async (context: ScenarioPluginContext): Promise<void> => {
    // High-score registration or scenario completion flag saving
  },

  /**
   * Handles custom choices chosen during character creation/setup screen.
   */
  onCustomSetupSelect: (context: ScenarioPluginContext, choiceId: string): void => {
    // React to character traits/attributes selected
  },

  /**
   * Hook executed at the start of preparation phases (e.g. at the inn/shop).
   */
  onPrepPhaseStart: (context: ScenarioPluginContext): void => {
    // Adjust store stock or recovery prices
  },

  /**
   * Hook executed when finishing transactions in the shop.
   */
  onSliderShopFinish: (context: ScenarioPluginContext): void => {
    // Deduct gold, finalize items
  },

  /**
   * Overrides event resolution entirely. Return true if handled.
   */
  onResolveEventOverride: (context: ScenarioPluginContext): boolean | void => {
    return false;
  }
};
```

---

## 4. Step 3: Register the Plugin Automagic
The plugin must be registered in [scenarioPlugins/index.ts](file:///workspaces/roguelike-half/src/composables/scenarioPlugins/index.ts).
You **MUST** perform this edit automatically by parsing the file and making the following insertions:

1. **Import Statement**: Insert the import statement pointing to your newly created file at the top of `index.ts`.
   ```typescript
   import { <scenario_id>Plugin } from './<scenario_id>Plugin';
   ```
2. **Registration mapping**: Add the plugin to the `plugins` map dictionary:
   ```typescript
   const plugins: Record<string, ScenarioPlugin> = {
     [pyramidPlugin.id]: pyramidPlugin,
     [<scenario_id>Plugin.id]: <scenario_id>Plugin, // <-- Insert here
   };
   ```

Verify that the file syntax is correct after replacement.

---

## 5. Step 4: Verification and Testing Policy
Under the project's rules defined in [AGENTS.md](file:///workspaces/roguelike-half/.agents/AGENTS.md), you **MUST NOT** run test suites automatically.

- **Do NOT execute commands** such as `npm run test`, `npx playwright test`, or `npm run build` on your own.
- **Instruct the user** in your final response to manually run their test suites (e.g., `npm run test` or `npm run dev`) to verify that Vite compiles the new plugin registration without errors and that the scenario works as intended.
