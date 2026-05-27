<p align="center">
  <img src="https://img.shields.io/badge/Roblox-OpenCode-blue?style=for-the-badge&logo=roblox&logoColor=white" alt="roblox-opencode" />
   [BETA]
</p>

<p align="center">
  <img src="https://img.shields.io/npm/v/roblox-opencode?style=flat-square&color=blue" alt="npm version" />
  <img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="MIT license" />
  <img src="https://img.shields.io/badge/Luau-100%25-purple?style=flat-square" alt="Luau" />
  <img src="https://img.shields.io/badge/Fusion-0.3-orange?style=flat-square" alt="Fusion 0.3" />
</p>

<p align="center">
  An OpenCode plugin that gives AI assistants deep knowledge of Roblox development.<br/>
  17 skills, production-ready vendor libraries, and complete UI references. The AI writes code that actually works in Studio.
</p>

<br/>

## Install

```bash
opencode plugin roblox-opencode
```

Then run `/setup-game` in your project.

> **⚠️ This is the only way to install.** There is no "compiled loader," no binary download, no .exe. If something asks you to download a file, it's malware impersonating this project.

## What it does

Without this plugin, AI assistants treat Roblox like a generic Lua environment. They miss session locking, write exploitable remotes, ignore mobile players, and produce UI that breaks on phones.

With it, the AI knows:

- How to structure a game (services, lifecycle, module patterns)
- How to persist data safely (ProfileStore, session locking, migrations)
- How to build reactive UI (Fusion 0.3, with complete shop/inventory/settings references)
- How to secure remotes (validation, rate limiting, type checking)
- How to ship (analytics, monetization, TOS compliance, publish checklist)
- What NOT to do (13 documented production footguns ranked by severity)

## Skills

Loaded on-demand based on what you're working on. The AI picks the right ones automatically.

| Domain | Skill | Covers |
|--------|-------|--------|
| **Language** | `roblox-luau-mastery` | Syntax, idioms, type system, strict mode |
| **UI** | `roblox-gui` | Layout fundamentals, mobile-first, responsive patterns |
| **UI** | `roblox-gui-fusion` | Fusion 0.3 reactive UI with full screen references |
| **VFX** | `roblox-animation-vfx` | Tweens, particles, trails, highlights, camera shake |
| **Networking** | `roblox-networking` | Security hardening, validation, rate limiting |
| **Data** | `roblox-data` | ProfileStore, schema design, migrations, BindToClose |
| **Testing** | `roblox-testing` | TestEZ, BDD patterns, test strategy |
| **Tooling** | `roblox-tooling` | Studio MCP, luau-lsp, diagnostics |
| **Architecture** | `roblox-architecture` | Service hierarchy, 7 foundational patterns |
| **Runtime** | `roblox-runtime` | RunService, StreamingEnabled, memory |
| **Gotchas** | `roblox-sharp-edges` | 13 production footguns by severity |
| **Money** | `roblox-monetization` | GamePasses, DevProducts, subscriptions, TOS |
| **Sync** | `roblox-sync` | Script Sync setup and troubleshooting |
| **Analytics** | `roblox-analytics` | Events, economy tracking, funnels |
| **Review** | `roblox-code-review` | Security, performance, networking, data lenses |
| **Debug** | `roblox-debug` | Iterative debug loop for Luau issues |
| **Ship** | `roblox-publish-checklist` | Pre-ship verification gauntlet |

## Vendor libraries

Copied to your project on setup. No Wally required.

| Library | Purpose |
|---------|---------|
| **Fusion** | Reactive UI framework (dphfox, 0.3) |
| **ProfileStore** | Data persistence with session locking |
| **Promise** | Async flow control (evaera) |
| **Signal** | Typed custom signals (Sleitnick) |
| **Trove** | Cleanup/lifecycle management |
| **Comm** | Typed client-server remotes |
| **Component** | CollectionService tag binding |
| **t** | Runtime type checking |
| **TestEZ** | BDD testing framework |
| **RbxUtil** | 25 additional utility packages available on demand |

## Commands

| Command | What it does |
|---------|--------------|
| `/setup-game` | One-time project config: skills, vendor, LSP, MCP servers, AGENTS.md |
| `/sync-check` | Verify Script Sync is working correctly |

## How it works

1. Plugin installs via npm on OpenCode startup
2. You run `/setup-game` once per project
3. Setup copies skills + vendor libs to `.opencode/`, writes LSP config, generates `.luaurc` aliases, and injects a core block into `AGENTS.md`
4. Setup also detects your environment and recommends MCP servers (Roblox API docs, web search, code analysis). You pick which ones to install — no forced dependencies.
5. After that, the plugin handles updates automatically. When the plugin version changes, skills and vendor libs refresh on next OpenCode restart.

The AI loads relevant skills on-demand based on your prompt. Ask it to build a shop and it pulls in `roblox-gui-fusion`. Ask it to review security and it loads `roblox-code-review` with the networking lens.

## Prerequisites

- [OpenCode](https://opencode.ai)
- [Roblox Studio](https://www.roblox.com/create) with Script Sync enabled
- `uvx` (optional, for MCP servers like Roblox API docs and web search)

## Update

The plugin auto-syncs on version change. Just restart OpenCode — skills, vendor libs, and AGENTS.md refresh automatically. Content outside managed markers in `AGENTS.md` is preserved.

To force a refresh: run `/setup-game` again.

## Contributors

- [MrFearTick](https://github.com/MrFearTick): Highlight reference, parent destruction patterns, networking lens, monetization expansion

## License

MIT
