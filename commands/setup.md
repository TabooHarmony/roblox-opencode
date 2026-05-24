---
description: "Initialize roblox-opencode environment — config, skills, sync verification"
agent: build
---

# /setup

Orchestrates the roblox-opencode environment. Idempotent. Re-runnable. Self-updating.

Skills and commands are auto-copied by the plugin when it detects a Roblox project. /setup handles the remaining configuration: MCP, LSP, AGENTS.md core block, and sync verification.

---

## Step 1: Check prerequisites

Run these checks:

- `which luau-lsp` — needed for Luau diagnostics
- `which uvx` — needed for mcp-roblox-docs

If luau-lsp is missing: point user to https://github.com/JohnnyMorganz/luau-lsp/releases and guide install. If declined, note: "Reduced safety net. Install luau-lsp later and re-run /setup."

If uvx is missing: prompt "mcp-roblox-docs needs uv (Python package manager). Install it? (y/n)". If yes: `curl -LsSf https://astral.sh/uv/install.sh | sh`. If no: skip roblox-docs MCP server.

## Step 2: Write MCP config

Write to `opencode.json` (merge with existing):

```json
{
  "mcp": {
    "studio": {
      "type": "local",
      "command": ["npx", "-y", "@anthropic/studio-mcp"],
      "enabled": true
    }
  }
}
```

If uvx is available, also add:

```json
{
  "mcp": {
    "roblox-docs": {
      "type": "local",
      "command": ["uvx", "mcp-roblox-docs"],
      "enabled": true
    }
  }
}
```

Note to user: "Enable the Studio MCP server in Studio: open the Assistant widget (View → Assistant), click the MCP toggle. One click."

## Step 3: Download globalTypes.d.luau

If luau-lsp is installed, download the pinned `globalTypes.d.luau` from the luau-lsp repo and place it in the project root. Configure `.luaurc` to reference it if needed.

## Step 4: Write core block to AGENTS.md

Read `core/roblox-core.md` from the roblox-opencode package directory.

Write it to the project's `./AGENTS.md` between managed markers:

```
<!-- roblox-opencode 1.0.0 BEGIN — managed block, edits inside will be overwritten -->
... content from core/roblox-core.md ...
<!-- roblox-opencode END -->
```

If AGENTS.md already has managed markers (roblox-opencode or old roblox-pi), replace the content between them. If AGENTS.md has content outside the markers, preserve it.

## Step 5: Sync setup + sentinel verification

Hand off Script Sync setup to the user with these instructions:

"Enable Script Sync in Roblox Studio:
1. File → Beta Features → Script Sync → toggle on → restart Studio
2. In Explorer, right-click each top-level container with scripts (ServerScriptService, ReplicatedStorage, etc.) → Start Sync → pick a folder

Suggested folder layout: ~/projects/<game-name>/src/<container-name>/"

When the user confirms sync is enabled:

1. Write `_sync_check.luau` to the synced folder with content: `-- roblox-opencode sync verification sentinel`
2. Ask user: "Did `_sync_check.luau` appear in Studio's Explorer?"
3. If yes: clean up the sentinel file. Sync is confirmed.
4. If no: "Sync doesn't seem to be working. Check that you right-clicked the correct container and picked the right folder. Re-run /setup when ready."
5. Do NOT claim sync is working without this confirmation.

## Step 6: Print the command tour

"roblox-opencode is ready. Here's what you can do:
- /init — bootstrap a new project or scan an existing one
- /code-review — review code with security/performance/monetization lenses
- /publish-checklist — pre-ship gauntlet before publishing to Roblox
- /debug — debugging helper for Luau/Roblox issues
- /diagnose — check if Script Sync is working properly

The harness is loaded. Prompt normally — the AI will suggest commands when relevant."
