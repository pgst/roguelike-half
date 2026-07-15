---
name: vue3-typescript-guide
description: Guarantees safe usage of Vue 3 Composition API and TypeScript within the project, especially surrounding the computed/proxy state bridge and reactive reactivity rules.
---

# Vue 3 Composition API & TypeScript Guide

This skill guides the agent in writing safe, clean, and bug-free Vue 3 Composition API code using TypeScript, customized to the reactive bridge architecture of the `roguelike-half` codebase.

---

## 1. Vue Reactivity & OOP Bridge Rules
Our codebase encapsulates business logic in pure class instances (`PlayerCharacter` and `GameSession`), exposing them reactively via `useGameState.ts` using `computed` and `Proxy`.

### Rule 1: Writable computed Modification
Do **NOT** overwrite the underlying object directly unless utilizing the computed setter interface.
* **Bad**: `activeSession.value.character = newCharacter` (Trashes reactivity/guards)
* **Good**: `character.value = { ... }` (Triggers the custom Computed setter, which automatically converts the plain object back into a `PlayerCharacter` instance).

### Rule 2: Keep Proxy Reactivity Intact
Do **NOT** destructure reactive objects (`reactive(...)` or proxies like `combatState` or `diceTray`). Destructuring loses Vue reactivity tracking.
* **Bad**: `const { active, turn } = combatState;`
* **Good**: Access properties directly `combatState.active` or use `toRefs(combatState)`.

---

## 2. TypeScript Guidelines
1. **Explicit Types**: Avoid using `any` inside Vue components and composables. Reference types from [src/types/index.ts](file:///workspaces/roguelike-half/src/types/index.ts).
2. **Prop Definitions**: When writing Vue components, declare props with strict TypeScript typing using `defineProps<Props>()`.
3. **Ref Typing**: Explicitly type refs containing non-primitive objects, e.g., `ref<Character | null>(null)`.

---

## 3. Best Practices for Composable State
- Composables like `useCombat.ts` and `useDungeon.ts` must obtain state from `useGameState.ts` (e.g. `const { character, combatState } = useGameState()`).
- Do **NOT** create duplicate reactive state variables for data that belongs inside the global `GameSession`.
