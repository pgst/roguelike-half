import { test, expect } from '@playwright/test';
import type { PersonaConfig } from './persona-types';
import { runPersonaSimulation } from './persona-runner';

test.describe('E2Eペルソナ別プレイスルー・シミュレーション（黒蛇の洞窟）', () => {

  test('【Persona 1】筋力戦士「ヴォルグ」: 重装近接・力押しプレイスタイル', async ({ page }) => {
    const warriorPersona: PersonaConfig = {
      id: 'warrior-vorg',
      name: '戦士ヴォルグ',
      archetype: 'warrior',
      archetypeCardText: '筋力点',
      healHpThreshold: 3,
      combatPreference: 'melee_focused',
      preferSubStatForChecks: true,
      preferPerception: false,
      preferCover: true
    };

    const result = await runPersonaSimulation(page, warriorPersona);
    console.log(`[Result] ヴォルグの冒険結末: ${result.outcome} (${result.steps} ステップ)`);
    expect(['victory', 'gameover']).toContain(result.outcome);
  });

  test('【Persona 2】器用射手「リィレ」: 察知・先制・回避重視プレイスタイル', async ({ page }) => {
    const archerPersona: PersonaConfig = {
      id: 'archer-rille',
      name: '射手リィレ',
      archetype: 'archer',
      archetypeCardText: '器用点',
      healHpThreshold: 2,
      combatPreference: 'ranged_focused',
      preferSubStatForChecks: true,
      preferPerception: true,
      preferCover: false
    };

    const result = await runPersonaSimulation(page, archerPersona);
    console.log(`[Result] リィレの冒険結末: ${result.outcome} (${result.steps} ステップ)`);
    expect(['victory', 'gameover']).toContain(result.outcome);
  });

  test('【Persona 3】魔術師「アルト」: 呪文詠唱・知力駆使プレイスタイル', async ({ page }) => {
    const magePersona: PersonaConfig = {
      id: 'mage-alto',
      name: '魔術師アルト',
      archetype: 'mage',
      archetypeCardText: '魔術点',
      healHpThreshold: 2,
      combatPreference: 'spell_focused',
      preferSubStatForChecks: true,
      preferPerception: false,
      preferCover: false
    };

    const result = await runPersonaSimulation(page, magePersona);
    console.log(`[Result] アルトの冒険結末: ${result.outcome} (${result.steps} ステップ)`);
    expect(['victory', 'gameover']).toContain(result.outcome);
  });

  test('【Persona 4】幸運導師「セレーナ」: 神聖加護・危機回避プレイスタイル', async ({ page }) => {
    const clericPersona: PersonaConfig = {
      id: 'cleric-serena',
      name: '導師セレーナ',
      archetype: 'cleric',
      archetypeCardText: '幸運点',
      healHpThreshold: 3,
      combatPreference: 'balanced',
      preferSubStatForChecks: true,
      preferPerception: false,
      preferCover: true
    };

    const result = await runPersonaSimulation(page, clericPersona);
    console.log(`[Result] セレーナの冒険結末: ${result.outcome} (${result.steps} ステップ)`);
    expect(['victory', 'gameover']).toContain(result.outcome);
  });

});
