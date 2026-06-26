# SPA Status & Walkthrough

The Vue 3 + TypeScript + Vite Single Page Application has been successfully launched and verified.

## 🚀 Status Summary

- **Development Server:** Active & Running (Exposed for Container environments)
  - **URL:** [http://localhost:5173/](http://localhost:5173/)
  - **Command:** `npm run dev -- --host`
  - **Verification:** Successfully responded with `HTTP/1.1 200 OK` (bound to `0.0.0.0`)
- **Build Status:** Verified (Compilation Successful)
  - **Command:** `npm run build` (`vue-tsc -b && vite build`)
  - **Output:** Built successfully without any TypeScript or styling errors.

---

## 🏗️ SPA Architecture & Features

This application is an engaging, detailed roguelike / RPG adventure tool based on standard board/card game mechanisms (such as *Four Against Darkness* / *Roguelike Half*). Here is a breakdown of the key modules:

### 1. **Character Creator (`CharacterCreator.vue`)**
- Allows the user to initialize their hero character.
- Select class/sub-stat types (such as `magic` or `luck`).
- Equips starting items, spells, or miracles based on the chosen path.

### 2. **Adventure Sheet (`AdventureSheet.vue`)**
- Tracks character stats in real-time (Skill, Life, Gold, Food, Level, EXP).
- Manages equipment (weapons, armors, shields, general items).
- Manages hireable and active followers (soldier, swordsman, archer, mage, scout, lantern bearer, etc.).

### 3. **Dungeon Explorer (`DungeonExplorer.vue`)**
- Handles movement through dungeon depths and rooms.
- Keeps track of room encounters, treasure discovery, and depth-level rules.

### 4. **Combat Simulator (`CombatSimulator.vue`)**
- Runs turn-based combat encounters against monsters/enemies.
- Integrates combat mechanics, modifying attributes based on equipped weapons/armors, spells, or follower assistance.

### 5. **Dice Roller (`DiceRoller.vue`)**
- A general helper component to roll dice (d6, d20, etc.) for skill checks, combat, or custom encounters.

---

## 🛠️ Management Commands

You can use the following commands to manage this development environment if needed:

| Command | Action |
|---|---|
| `npm run dev` | Starts the local Vite development server |
| `npm run build` | Compiles the production bundle with TypeScript checks |
| `npm run preview` | Previews the compiled production build locally |

> [!NOTE]
> The development server is currently running as a background task. You do not need to start it again! You can access it directly at [http://localhost:5173/](http://localhost:5173/).
