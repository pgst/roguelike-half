# Semble - High-Performance Code Search for AI Agents

Semble has been successfully installed and configured in this environment to prevent AI agents from reading unnecessary files and drastically reduce token usage (~98% fewer tokens compared to standard `grep`).

## 🛠️ Installation and Setup Overview

1. **Local Package Manager (`uv`)**: Installed locally inside the project at `/workspaces/vue3-dev-env/.bin/uv` to ensure a self-contained installation.
2. **Semble CLI Tool**: Installed via `uv` and configured across active development agents using `semble install`.
3. **Agent Integration**:
   - **Antigravity (This Agent)**: Registered `semble` in `/home/node/.gemini/config/mcp_config.json` as an MCP server.
   - **VS Code**: Configured in `/home/node/.config/Code/User/mcp.json`.
   - **Gemini CLI**: Registered in `/home/node/.gemini/settings.json`.
   - **Other Agents**: Automatically configured integrations for Claude Code, Cursor, Zed, Windsurf, Codex, and others.

---

## 🔍 Configured Exclusions (`.sembleignore`)

We created a [.sembleignore](file:///workspaces/vue3-dev-env/.sembleignore) file in the workspace root to prevent indexing and searching non-source files, caches, and test artifacts.

Key ignored items:
- **Build & Dependencies**: `node_modules/`, `dist/`, `build/`
- **Lock Files**: `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`
- **Agent Artifacts**: `.antigravitycli/`, `.serena/`, `.gemini/`
- **Test Artifacts**: `playwright-report/`, `test-results/`
- **Common Metadata**: `.vscode/`, `.DS_Store`, `*.log`

---

## 🚀 How to Use Semble

### 1. Natural Language Code Search (via CLI)
Search for code by describing the functionality or searching for symbols/variable names.

```bash
# Search for code related to "App" in the current workspace
/workspaces/vue3-dev-env/.bin/uvx semble search "App" .

# Limit context snippet lines to keep output concise
/workspaces/vue3-dev-env/.bin/uvx semble search "style" . --max-snippet-lines 5
```

### 2. Search Documentation or Configuration Files
You can restrict the search to documentation or configurations using the `--content` flag:

```bash
# Search config files (e.g. tsconfig, playwright, package.json)
/workspaces/vue3-dev-env/.bin/uvx semble search "vite" . --content config

# Search markdown files and other prose
/workspaces/vue3-dev-env/.bin/uvx semble search "guide" . --content docs
```

### 3. Finding Related Code
Once you locate a file and line, you can find other similar functions/classes in the codebase:

```bash
/workspaces/vue3-dev-env/.bin/uvx semble find-related src/App.vue 1 .
```

### 4. Viewing Savings and Stats
To check how many tokens and milliseconds you saved:

```bash
/workspaces/vue3-dev-env/.bin/uvx semble savings
```
