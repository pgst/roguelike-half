import { describe, it, expect } from 'vitest';
import { useGameState } from '../composables/useGameState';
import { useDungeon } from '../composables/useDungeon';
import { useCombat } from '../composables/useCombat';
import { setGlobalSeed } from './random';

describe('Game Balance & Playthrough Simulator', () => {
  it('should simulate multiple playthroughs of the Aranzas scenario and gather balance statistics', async () => {
    const trials = 30; // Run 30 simulated dungeon crawls
    let victories = 0;
    let defeats = 0;
    const depthsReached: number[] = [];

    const gameState = useGameState();
    const dungeon = useDungeon();
    const combat = useCombat();

    for (let i = 0; i < trials; i++) {
      // Seed each run uniquely for diversity but keep it deterministic per trial index
      setGlobalSeed(`simulation-run-seed-${i}`);

      // 1. Create character
      gameState.initNewCharacter(`Simulated Hero ${i}`, 'strength');

      // 2. Allocate starting Exp points (10 points total)
      for (let j = 0; j < 5; j++) {
        gameState.spendExpForStat('skill');
      }
      for (let j = 0; j < 5; j++) {
        gameState.spendExpForStat('life');
      }
      gameState.transitionToExplore();

      // 3. Select Scenario
      const aranzas = gameState.availableScenarios.value.find(s => s.id === 'aranzas');
      expect(aranzas).toBeDefined();
      gameState.activeScenario.value = aranzas!;

      // Reset state for run
      gameState.dungeonDepth.value = 1;
      gameState.activeEvent.value = null;

      let loopCount = 0;
      const maxLoops = 1000;

      while (
        gameState.currentScreen.value !== 'gameover' &&
        gameState.currentScreen.value !== 'success' &&
        loopCount < maxLoops
      ) {
        loopCount++;

        const screen = gameState.currentScreen.value;

        if (screen === 'explore') {
          const event = gameState.activeEvent.value;
          if (event) {
            if (event.type === 'trap') {
              // Resolve trap check
              await dungeon.resolveTrapCheck();
              if (!event.isResolved && event.trapDamageTargets) {
                // If it asks for a target to receive damage, choose the hero
                await dungeon.resolveTrapDamageTarget('hero');
              }
            } else if (event.type === 'encounter') {
              // Trigger combat encounter
              dungeon.startEncounter();
            } else {
              // Autocomplete non-trap/non-combat events
              event.isResolved = true;
              gameState.activeEvent.value = null;
            }
          } else {
            // Move to next room
            await dungeon.exploreNextRoom();
          }
        } else if (screen === 'combat') {
          // Automated combat runner
          if (gameState.combatState.active) {
            const activeAttacks = gameState.combatState.activeAttacks || [];
            if (activeAttacks.length > 0) {
              // Automatically resolve queued enemy attacks on the hero
              const attack = activeAttacks[0];
              await combat.resolveDefense(attack.id, 'hero');
            } else {
              // Perform player attack turn
              await combat.playerAttack();
            }
          } else {
            // Resolve victory loot screens
            if (gameState.combatState.lootRolled) {
              combat.confirmCombatResult();
            } else {
              await combat.resolveLoot();
            }
          }
        } else if (screen === 'levelup') {
          // If level up is triggered mid-run, assign stat and transition back to explore
          gameState.spendExpForStat('life');
          gameState.transitionToExplore();
        }
      }

      depthsReached.push(gameState.dungeonDepth.value);
      if (gameState.currentScreen.value === 'success') {
        victories++;
      } else {
        defeats++;
      }
    }

    const averageDepth = depthsReached.reduce((a, b) => a + b, 0) / trials;

    console.log('\n=============================================');
    console.log(`📊 SIMULATION ANALYSIS FOR SCENARIO [aranzas]`);
    console.log(`Total Trials:   ${trials}`);
    console.log(`Victories:      ${victories} (${((victories / trials) * 100).toFixed(1)}%)`);
    console.log(`Defeats:        ${defeats} (${((defeats / trials) * 100).toFixed(1)}%)`);
    console.log(`Average Depth:  ${averageDepth.toFixed(2)} rooms`);
    console.log('=============================================\n');

    expect(victories + defeats).toBe(trials);
  });
});
