# roblox-opencode

OpenCode plugin for Roblox/Luau development. Makes AI coding assistants competent at building Roblox games.

## Install

Add to your `opencode.json`:

```json
{
  "plugin": ["roblox-opencode"]
}
```

Restart opencode. The plugin auto-installs from npm on startup.

Then run `/setup-game` in your project to configure.

## What's included

**16 skills** (loaded on-demand by the AI):
- roblox-luau-mastery — Luau syntax, idioms, type system
- roblox-gui — UI layout, mobile-first design, reactive frameworks
- roblox-animation-vfx — Animation, particles, effects
- roblox-networking — Security hardening, validation, rate limiting
- roblox-data — ProfileStore, DataStores, persistence patterns
- roblox-testing — TestEZ, BDD patterns, test strategy
- roblox-tooling — Studio MCP, luau-lsp, diagnostics
- roblox-architecture — Service hierarchy, 7 foundational patterns
- roblox-runtime — RunService, StreamingEnabled, memory management
- roblox-sharp-edges — 12 production footguns by severity
- roblox-monetization — GamePasses, DevProducts, TOS compliance
- roblox-sync — Script Sync setup and troubleshooting
- roblox-analytics — AnalyticsService, custom events, economy tracking, funnels
- roblox-code-review — Review with security/performance/monetization lenses
- roblox-debug — Iterative debug loop for Luau/Roblox issues
- roblox-publish-checklist — Pre-ship verification gauntlet

**2 commands** (type `/` to use):
- `/setup-game` — One-time project config (skills, vendor, LSP, sync)
- `/sync-check` — Sync sanity check

**Vendor libraries** (auto-placed with mention):
- ProfileStore — Data persistence with session locking
- Trove — Cleanup/lifecycle management
- Signal — Typed custom signals (Sleitnick/RbxUtil)
- Promise — Async flow control (evaera)
- Comm — Typed client-server remotes (Sleitnick/RbxUtil)
- Component — CollectionService tag binding (Sleitnick/RbxUtil)
- t — Runtime type checking (osyrisrblx, recommended)
- TestEZ — BDD testing framework (Roblox, recommended)
- 25+ additional RbxUtil packages available on demand (see .opencode/vendor/README.md)

## How it works

The plugin registers a `roblox_setup` tool and copies 3 commands to your global config on first launch. When you run `/setup-game`, it copies 15 skills and vendor libs to `.opencode/`, writes LSP config to `opencode.json`, generates `.luaurc` with vendor path aliases, and writes the core directives block to `AGENTS.md`.

After setup, the plugin is dormant. The 15 skills do all the work — the AI loads them on-demand based on what you're working on.

## Prerequisites

- [luau-lsp](https://github.com/JohnnyMorganz/luau-lsp) — Luau diagnostics (setup checks and guides install)
- [Roblox Studio](https://www.roblox.com/create) — With Script Sync and MCP server enabled

## Update

Update the version in `opencode.json` (or use `"roblox-opencode"` for latest), then restart opencode.

To force re-setup in a project (overwrites skills, vendor, config):

```
/setup-game
```

Content outside managed markers in AGENTS.md is preserved.

## License

MIT
