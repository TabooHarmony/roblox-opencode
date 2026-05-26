# roblox-opencode Core Block
# Written to AGENTS.md by /setup-game between version markers.
# Budget: ~1.2k tokens. Every line must earn its place.

## 1. Sync vs MCP

1. Every session: try to read project .luau files at the expected synced paths.
   Found → Sync Mode. Not found → MCP-Only Mode.
2. Sync Mode: read/write/edit scripts via filesystem. Use MCP only for
   verification (run_code, execute_luau), playtest control, scene/instance ops.
3. Sync Mode: never read a script via MCP if its file exists on disk.
4. MCP-Only Mode: minimize file reads. Prefer run_code for inspection.
   Batch related edits behind ChangeHistoryService Recording.
5. MCP-Only Mode: note that MCP ops are slower and token-hungry. If a session
   will be heavy, recommend the user enable Sync.
6. MCP-Only Mode loses LSP diagnostics entirely (luau-check hooks filesystem
   writes only). Surface this when relevant.

## 2. Sharp Edges

| Severity | Issue | Fix |
|----------|-------|-----|
| CRIT | DataStore data loss from no session lock | Use ProfileStore. Never raw SetAsync for player data. |
| CRIT | Client-side currency manipulation | All currency math server-side. Client is display-only. |
| CRIT | ProcessReceipt mishandling (duplicates/refunds) | Grant item THEN return PurchaseGranted. If grant fails, return NotProcessedYet. |
| CRIT | Missing BindToClose | Always implement BindToClose to flush pending saves. |
| HIGH | RemoteEvent flooding | Per-player rate limiting on all remotes. |
| HIGH | Memory leaks from undisconnected events | Use Trove. Every :Connect() must have a corresponding :Disconnect(). |
| HIGH | Assuming instances exist with StreamingEnabled | Check existence before access. Instances may not be loaded yet. |
| MED | Instance.new(class, parent) race | Create first, parent second. Parenting in constructor causes replication race. |
| LOW | :connect typo | It's :Connect() with capital C. |

## 3. Capabilities Boundary

roblox-opencode handles: Luau code, scripts, modules, remotes, data, UI logic, game architecture.
roblox-opencode does NOT handle: 3D model generation, mesh creation, animation authoring, terrain sculpting, pixel-perfect UI design. These are Studio's domain - use blockout Parts with descriptive names and let the user detail visually.

## 4. Skill Routing Corrections

Only for ambiguous cases where two skills overlap:
- streaming/workspace not loaded → roblox-runtime (not roblox-architecture)
- gui/ui layout → roblox-gui (not roblox-architecture)
- data persistence → roblox-data (not roblox-networking)
- remote handler validation → roblox-networking (not roblox-architecture)
- security hardening → roblox-networking (security is folded in)

For everything else, load the skill whose description best matches the task.
Load the Quick Reference section first. Only load the Full Reference if the task requires specific syntax examples or implementation details.

## 5. Asset Trust

- Never suggest asset IDs. Never recommend free-model code (ModuleScripts, Scripts, LocalScripts).
- Free models OK strictly for art assets (Mesh, Texture, Sound, Animation).
- Before any LoadAsset: walk user through audit - inspect children, check for getfenv/loadstring/HttpService/suspicious RemoteEvents.
- Vendored libraries (ProfileStore, Trove, Signal (RbxUtil), Promise, Comm, Component) are the only pre-written code the agent may place.

## 6. Verification

Silence means verified. Surface ⚠️ only when verification was NOT possible:
"⚠️ not verified: [thing], [reason]"
Do not prefix verified responses with "Verified: ..." - that noise trains users to stop reading.

## 7. Luau-LSP

- Diagnostics are signal, not authority. On conflict with documented Roblox behavior, prefer documented behavior.
- Never claim "done, test it" with unresolved diagnostics. Either fix them, justify them, or surface ⚠️.
- Diagnostics fire async after each .luau write. The agent reconciles silently.

## 8. Tiered Library Policy

**Vendored libraries** (auto-placed with mention): ProfileStore, Trove, Signal (RbxUtil), Promise, Comm, Component.
- Agent mentions the choice. User can revert or say "use my own."
- Before auto-placing, query project index for existing equivalents. If found, skip auto-place and mention why.
- Placement mechanic: copy from `.opencode/vendor/<path>` into the project's synced folder. Shared libs → ReplicatedStorage/Packages/. Server-only (ProfileStore) → ServerScriptService/Packages/. Infer sync folder from existing project structure.

**Vendored tools** (recommended when relevant, not auto-placed): t (runtime type checking), TestEZ (testing).
- Agent recommends when the task involves Remote validation, argument checking, or testing.
- Agent does NOT auto-place - requires user buy-in.

**Anything else**: full consent. Agent explains, asks via user prompts, places only on yes.

## 9. Skill & Command Routing

When the user's task matches a command or skill, suggest it:
- First-time project setup → /setup-game (command)
- Sync feels broken → /sync-check (command)
- Code review or audit → load roblox-code-review skill
- Debugging → load roblox-debug skill
- Pre-publish check → load roblox-publish-checklist skill

## Version

roblox-opencode 1.0.0
