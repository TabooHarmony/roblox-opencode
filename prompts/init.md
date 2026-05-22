# /init

`npm init` for Roblox. Project bootstrap — greenfield scaffold or existing-project recon.

## Step 1: Inspect the synced folder

Read the project directory. Determine if it's empty (or only has Studio default structure) or has existing scripts.

## Step 2: Branch based on project state

### If empty or Studio defaults only:

Drop the universal scaffold from `skills/roblox-architecture/references/`. Standard layout:

```
ServerScriptService/
  Game/
    Services/        -- Singleton services (DataService, CombatService, etc.)
    init.server.luau -- Main server entry
ReplicatedStorage/
  Game/
    Shared/          -- ModuleScripts both sides need
    Remotes/         -- RemoteEvents / RemoteFunctions
StarterPlayerScripts/
  Game/
    Controllers/     -- Client controllers (InputController, UIController, etc.)
StarterGui/
  Game/
    MainGui/         -- Primary ScreenGui
```

Create placeholder `.luau` files in each location so Script Sync has something to mirror (empty folders don't sync).

Note: "Standard layout dropped. Rename or restructure to taste."

### If non-empty (existing project):

The agent scans the project via context-mode index. Detect existing patterns dynamically:

- What save system is used? (ProfileStore, raw DataStore, custom wrapper)
- What signal/event library? (Signal (RbxUtil), custom, RBXScriptSignal)
- What component system? (CollectionService tags, Knit, custom)
- Naming conventions? (PascalCase modules, camelCase locals, etc.)
- Service architecture? (singleton services, flat scripts, framework)

No static conventions file. The live codebase is the source of truth.

Respect the original developer's structure and conventions unless there are genuine issues or the user requests otherwise. Never drop the opinionated scaffold on top of an existing project.

## Step 3: Sync verification

If sync isn't already detected (no `.luau` files on disk), walk the user through enabling Script Sync:

1. Studio → File → Beta Features → enable "Script Sync" → restart
2. Right-click top-level container → Start Sync → pick folder
3. Repeat for each container with scripts

See `skills/roblox-sync/SKILL.md` for full walkthrough.

## Step 4: Index with context-mode

Run `ctx_index` on the project directory so future sessions can query project structure without re-reading every file.

## Done

The project is bootstrapped. Prompt normally from here — the harness is an assistant, not a wizard.
