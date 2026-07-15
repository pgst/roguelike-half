# Antigravity Custom Rules for roguelike-half

This file defines project-specific rules and constraints for the AI agent (Antigravity).

## Test Execution Rule
- **No Automatic Test Runs**: Do not automatically execute test suites or test runner commands (such as `npm run test`, `npm run test:e2e`, or `npx playwright test`) under any circumstances unless the user explicitly requests it in their prompt or approves it. The user will handle test execution on their own machine/terminal.

## TypeScript & Build Compilation Rule
- **Prevent Compilation Failures**: Verify that all modified or newly introduced TypeScript/Vue files do not contain compile-time type errors (TS compiler checks). Do not raw-reference Node.js globals like `process` directly inside browser-side components or composables without proper typing or fallback checks (such as `(globalThis as any).process` or `import.meta.env`).

