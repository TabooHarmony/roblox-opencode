# Vendor Libraries

AI routing table for vendored libraries. The harness ships these so studio-native users
don't need Wally. Two tiers:

## Core (auto-placed with mention)

These are placed into the project automatically when relevant. The agent mentions the choice;
user can veto. Context-mode queries check for existing equivalents before auto-placing.

| Library | Path | Source | License | Use Instead Of |
|---------|------|--------|---------|----------------|
| **ProfileStore** | `profilestore/init.luau` | loleris/MadStudioRoblox | Apache 2.0 | Raw DataStoreService |
| **Trove** | `rbxutil/trove/` | Sleitnick/RbxUtil | MIT | Manual connection tracking |
| **Signal** | `rbxutil/signal/` | Sleitnick/RbxUtil | MIT | BindableEvent for module-to-module |
| **Promise** | `promise/init.luau` | evaera/roblox-lua-promise | MIT | Raw coroutines for async |
| **Comm** | `rbxutil/comm/` | Sleitnick/RbxUtil | MIT | Raw RemoteEvent/RemoteFunction |
| **Component** | `rbxutil/component/` | Sleitnick/RbxUtil | MIT | Manual CollectionService tag listeners |

## Recommended (not auto-placed, suggest when relevant)

These require user buy-in. Recommend when the task calls for them.

| Library | Path | Source | License | Use For |
|---------|------|--------|---------|---------|
| **t** | `t/t.lua` | osyrisrblx/t v3.1.1 | MIT | Runtime type checking, RemoteEvent validation, function args |
| **TestEZ** | `testez/` | Roblox/testez v0.4.2 | Apache 2.0 | BDD testing (.spec files) |

## Available (use when specifically needed)

Additional RbxUtil packages. Don't recommend proactively - use when the task specifically
calls for their functionality.

| Library | Path | Purpose |
|---------|------|---------|
| **Streamable** | `rbxutil/streamable/` | Safe instance access with StreamingEnabled |
| **Net** | `rbxutil/net/` | Typed networking wrapper |
| **Timer** | `rbxutil/timer/` | Repeating/countdown timers with pause/resume |
| **Shake** | `rbxutil/shake/` | Camera/UI shake effects |
| **Spring** | `rbxutil/spring/` | Physics-based spring animations |
| **Input** | `rbxutil/input/` | Gamepad/keyboard/mouse/touch abstraction |
| **TableUtil** | `rbxutil/table-util/` | Table manipulation utilities (deep copy, merge, etc.) |
| **Option** | `rbxutil/option/` | Rust-style Option type for nil safety |
| **Concur** | `rbxutil/concur/` | Structured concurrency primitives |
| **Silo** | `rbxutil/silo/` | State management (Redux-like) |
| **Log** | `rbxutil/log/` | Structured logging with levels |
| **Loader** | `rbxutil/loader/` | Module loader with Init/Start lifecycle |
| **Query** | `rbxutil/query/` | Instance query builder |
| **Find** | `rbxutil/find/` | Safe instance finding with type narrowing |
| **WaitFor** | `rbxutil/wait-for/` | Promise-based WaitForChild |
| **BufferUtil** | `rbxutil/buffer-util/` | Binary buffer read/write |
| **Quaternion** | `rbxutil/quaternion/` | Quaternion math for rotations |
| **PID** | `rbxutil/pid/` | PID controller for smooth following |
| **Stream** | `rbxutil/stream/` | Reactive data streams |
| **Sequent** | `rbxutil/sequent/` | Sequential task execution |
| **TaskQueue** | `rbxutil/task-queue/` | Deferred task batching |
| **EnumList** | `rbxutil/enum-list/` | Custom enum definitions |
| **Symbol** | `rbxutil/symbol/` | Unique symbol identifiers |
| **Ser** | `rbxutil/ser/` | Instance serialization |
| **Tree** | `rbxutil/tree/` | Instance tree traversal utilities |
| **TypedRemote** | `rbxutil/typed-remote/` | Type-safe remote events |

## Licenses

All license files are in `LICENSES/`. Every vendored library is MIT or Apache 2.0.

## Require Paths

When placing vendored libraries into a project, use ReplicatedStorage for shared modules:

```luau
-- Core libraries (auto-placed into ReplicatedStorage.Packages/)
local Trove = require(game.ReplicatedStorage.Packages.Trove)
local Signal = require(game.ReplicatedStorage.Packages.Signal)
local Promise = require(game.ReplicatedStorage.Packages.Promise)
local Comm = require(game.ReplicatedStorage.Packages.Comm)
local Component = require(game.ReplicatedStorage.Packages.Component)

-- ProfileStore (server-only, placed in ServerScriptService)
local ProfileStore = require(game.ServerScriptService.Packages.ProfileStore) -- profilestore/init.luau
```

Note: Vendor source lives in `.opencode/vendor/` on disk. The require paths above
reference where Script Sync maps them in the DataModel - not the filesystem path.