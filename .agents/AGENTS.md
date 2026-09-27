# Antigravity Custom Rules for roguelike-half

This file defines project-specific rules and constraints for the AI agent (Antigravity).

## Test Execution Rule
- **Automated Test Runs Allowed**: The AI agent is authorized and encouraged to automatically execute test suites (such as `npx playwright test tests/rules/` or unit tests) to verify code correctness, detect regressions, and report results to the user.

## TypeScript & Build Compilation Rule
- **Prevent Compilation Failures**: Verify that all modified or newly introduced TypeScript/Vue files do not contain compile-time type errors (TS compiler checks). Do not raw-reference Node.js globals like `process` directly inside browser-side components or composables without proper typing or fallback checks (such as `(globalThis as any).process` or `import.meta.env`).

## UI Changes & E2E Test Maintenance Rule
- **Maintain E2E Test Alignment on UI Changes**: Whenever UI layouts, locators, or user interaction flows are changed (such as transitioning from single-click to master-detail selection, adding modals, or modifying navigation steps), the corresponding Playwright test scripts (`tests/*.spec.ts` and `tests/helpers/test-utils.ts`) MUST be reviewed and updated to reflect the new interaction flow. This prevents CI hangs and timeouts.

