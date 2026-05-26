---
description: "Sync sanity check - diagnose when files aren't appearing in Studio"
agent: build
---

# /sync-check

On-demand sync sanity check. Run when files aren't appearing in Studio or edits aren't landing on disk.

---

## Step 1: Check mode detection

Try to read any `.luau` file from the project's synced folder. If files exist on disk, you're in Sync Mode. If not, you're in MCP-Only Mode.

Report which mode is active.

## Step 2: Sentinel round-trip (Sync Mode only)

1. Write `_sync_check.luau` to the synced folder with content: `-- roblox-opencode sync verification sentinel`
2. Ask user: "Did `_sync_check.luau` appear in Studio's Explorer?"
3. If yes: clean up the sentinel file. Report: "Sync is healthy."
4. If no: proceed to Step 3.

## Step 3: Troubleshooting (if sentinel failed)

Walk through these in order:

1. "Is Script Sync still enabled? Check File → Beta Features → Script Sync."
2. "Did you right-click the container and Start Sync to the correct folder?"
3. "Is Studio focused? Script Sync pauses when Studio is minimized or in the background."
4. "Try: stop sync on the container, re-start sync, pick the same folder."

If none of these resolve it:

- "Script Sync may have silently disconnected. Restart Studio and re-run /sync-check."
- Do NOT suggest switching to MCP as a fix. Sync is the canonical path.

## Step 4: MCP-Only Mode check

If in MCP-Only Mode (no files on disk):

1. Check if Studio MCP is registered in opencode.json.
2. Try a simple MCP call (e.g., list scripts in ServerScriptService).
3. If MCP responds: "MCP-Only mode is working, but sync is recommended for heavy sessions. Run /setup-game to enable sync."
4. If MCP fails: "Neither sync nor MCP is working. Run /setup-game to configure the environment."

## Behavior rules

- One diagnostic pass. Don't loop.
- If sync works, say so and stop. No upselling.
- If sync is broken, help fix it. Don't suggest MCP as a replacement.
- Clean up the sentinel file whether the check passes or fails.
