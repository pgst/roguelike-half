---
name: session-migration-helper
description: Provides guidelines and checklists for expanding the GameSession and PlayerCharacter domain models while maintaining backward compatibility of serialized localStorage saves.
---

# Session Expansion & Save Migration Helper Skill

This skill ensures that whenever you add new attributes, items, or states to the domain layer, you preserve backward compatibility for users' existing save files stored in `localStorage`.

---

## 1. Context: Autosave & Serialization Architecture
The game saves state as a serialized JSON string under the key `roguelike_half_saved_session` in `localStorage`. 
- **Serialization**: Handled via custom `.toJSON()` methods in [domain/index.ts](file:///workspaces/roguelike-half/src/domain/index.ts) on `GameSession` and `PlayerCharacter`.
- **Deserialization**: Handled via `GameSession.deserialize(json)` and `PlayerCharacter.fromJSON(data)`.

Adding a new property to the classes without handling fallback logic *will* cause the application to crash or behave incorrectly when deserializing older save files that lack this property.

---

## 2. Mandatory Schema Expansion Checklist
When expanding domain state:

### Step 1: Interface & Domain Class Update
Add the property to:
1. The TypeScript interface definitions in [types/index.ts](file:///workspaces/roguelike-half/src/types/index.ts).
2. The class fields in `PlayerCharacter` and `GameSession` inside [domain/index.ts](file:///workspaces/roguelike-half/src/domain/index.ts).

### Step 2: Safe Deserialization (Crucial!)
You **MUST** provide a fallback value for any newly added fields during deserialization.
* **Bad**: `this.statusEffects = data.statusEffects;` (If `data.statusEffects` is undefined, `this.statusEffects` becomes `undefined` which may crash array methods like `.includes()`).
* **Good**:
  ```typescript
  // For Arrays
  this.statusEffects = data.statusEffects || [];

  // For Booleans / Numbers
  this.hasActiveLantern = data.hasActiveLantern ?? false;
  this.pyramidRunCount = data.pyramidRunCount ?? 0;
  ```

### Step 3: Serialize Update (`toJSON`)
Ensure the new field is outputted inside the class's `toJSON()` method so it is saved in future cycles:
```typescript
toJSON() {
  return {
    // ... existing fields
    statusEffects: this.statusEffects, // Include the new field
  };
}
```

### Step 4: Reactive Bridge Check
Verify if the new property needs to be accessed by Vue components. If so, update [composables/useGameState.ts](file:///workspaces/roguelike-half/src/composables/useGameState.ts) to expose it via a computed ref or ensure the Proxy maps to it correctly.

---

## 3. How to Verify Compatibility
1. **Locate or Create a Mock Save**: Create a mock JSON string representing an *old* save file (missing the new property).
2. **Manual Test Instruction**: Ask the user to run the app, paste the old save into `localStorage` (via DevTools console), reload the page, and click "Resume". 
3. Verify that the application initializes successfully and defaults the new property correctly without throwing errors.
