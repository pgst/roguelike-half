---
name: playwright-test-writer
description: Directs the generation, refactoring, and debugging of Playwright E2E test scripts for the roguelike-half SPA game interface while honoring test execution rules.
---

# Playwright Test Writer & Debugger Skill

This skill provides guidelines and templates for writing, enhancing, and debugging E2E tests using Playwright for the `roguelike-half` web application.

---

## 1. Compliance with Test Execution Policies
Under the rules of [AGENTS.md](file:///workspaces/roguelike-half/.agents/AGENTS.md), the AI agent **MUST NOT** run Playwright tests automatically (e.g., `npx playwright test` or `npm run test:e2e`). 
- Generate, edit, and fix test scripts as requested.
- Explain the logic clearly.
- Instruct the user to run the tests in their own terminal and report the output back if issues occur.

---

## 2. Writing E2E Tests for the Game Interface
The game consists of several distinct screens: Character Creation, Inn/Shop, Dungeon Exploration, and Combat. 

### Best Practices for Selectors & Locators
1. **Interactive Elements**: Use unique IDs or test-ids where possible. Avoid brittle CSS hierarchies.
2. **Text Content**: Since the UI displays game log texts and buttons like "Explore Room" or "Attack", use text-based locators carefully:
   - Prefer: `page.getByRole('button', { name: '部屋を探索する' })` or `page.locator('#btn-explore')`.
3. **Asynchronous Waiting**: The combat simulation may involve CSS transitions or timers. Use explicit waiting for UI state changes rather than hardcoded sleep timeouts:
   - Example: `await expect(page.locator('#combat-log')).toContainText('戦闘開始');`

### Basic Test Template
```typescript
import { test, expect } from '@playwright/test';

test.describe('Dungeon Run Flow', () => {
  test('should create character, buy items, and enter dungeon', async ({ page }) => {
    // Go to local development URL (configured in playwright.config.ts)
    await page.goto('/');

    // Character Creation
    await page.fill('#input-char-name', 'Hero');
    await page.click('#btn-create-character');

    // Verify view transitioned to Inn/Shop
    await expect(page.locator('#inn-title')).toBeVisible();

    // Buy an item (example)
    await page.click('.btn-buy-potion');

    // Start adventure
    await page.click('#btn-start-adventure');

    // Verify transitioned to Dungeon Explorer
    await expect(page.locator('#dungeon-explorer-view')).toBeVisible();
  });
});
```

---

## 3. Debugging Failed Tests
If the user reports that a Playwright test failed, follow these steps to diagnose:
1. **Locate Failures**: Read the console trace or HTML report path provided by the user.
2. **Check Selector Visibility**: Check if the element was detached or covered by another modal (e.g., an active event popup or game-over overlay).
3. **Re-evaluate State**: Check if the mock session state was initialized correctly if starting in the middle of a dungeon run.
