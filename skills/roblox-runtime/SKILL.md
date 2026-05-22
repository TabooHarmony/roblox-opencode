     1|---
     2|name: roblox-runtime
     3|description: Task scheduler, replication, streaming, network ownership, performance optimization.
     4|last_reviewed: 2026-05-21
     5|---
     6|
     7|<!-- Source: brockmartin/roblox-game-skill (MIT) -->
     8|
     9|# Roblox Runtime
    10|
    11|# Roblox Performance Optimization Reference
    12|
    13|## 1. Overview
    14|
    15|Load this reference when:
    16|
    17|- A game runs slowly or hitches during play (frame drops, lag spikes).
    18|- Optimizing for mobile devices or low-end hardware.
    19|- Conducting a performance audit before release or after adding major features.
    20|- Players report high memory usage, disconnects, or long load times.
    21|- Scaling a game to support more concurrent players.
    22|
    23|Performance optimization is not a one-time task. It should be revisited after every significant content addition and tested across the full range of target devices.
    24|
    25|---
    26|
    27|## 2. Performance Targets
    28|
    29|| Metric | Desktop | Mobile |
    30||---|---|---|
    31|| Frame Rate | 60 fps | 30 fps minimum |
    32|| Memory Budget | ~1 GB | ~500 MB |
    33|| Network | Minimize remote frequency | Same, with smaller payloads |
    34|| Load Time | Under 10 seconds | Under 15 seconds |
    35|
    36|**Key principles:**
    37|
    38|- Always measure against the *lowest-spec target device*, not your development machine.
    39|- Frame budget at 60 fps is ~16.6 ms per frame. At 30 fps it is ~33.3 ms.
    40|- Network: keep RemoteEvent calls under 50 per second per client. Prefer batching.
    41|
    42|---
    43|
    44|## 3. Part Count Optimization
    45|
    46|### Limits
    47|
    48|- **Per model:** aim for a maximum of ~500 parts.
    49|- **Total scene:** keep the visible scene under 10,000 parts.
    50|- Fewer parts means less physics simulation, less rendering overhead, and faster replication.
    51|
    52|### MeshParts Over Unions
    53|
    54|- `UnionOperation` recalculates collision geometry at runtime and is more expensive.
    55|- Export unions as MeshParts in Studio (right-click > Export Selection) and re-import.
    56|- MeshParts use a fixed collision fidelity that is cheaper to compute.
    57|
    58|### StreamingEnabled
    59|
    60|For large maps, enable `Workspace.StreamingEnabled`:
    61|
    62|- `StreamingTargetRadius` — the radius (in studs) the engine tries to keep loaded around the player. Start at 256 and tune.
    63|- `StreamingMinRadius` — the minimum guaranteed radius. Set to ~64 to ensure nearby content is always present.
    64|- `StreamingPauseMode` controls what happens when content is not yet loaded (Default, Disabled, ClientPhysicsPause).
    65|- Mark critical models with `ModelStreamingMode = Persistent` so they are never streamed out.
    66|
    67|### Anchoring
    68|
    69|- **Anchor every static part.** Unanchored parts enter the physics solver even if they are not moving, consuming CPU every frame.
    70|- Use `BasePart.Anchored = true` for terrain decorations, buildings, props, and anything that should not move.
    71|
    72|---
    73|
    74|## 4. Script Optimization
    75|
    76|### Consolidated Heartbeat
    77|
    78|Never scatter `RunService.Heartbeat:Connect(...)` across dozens of scripts. Consolidate into a single manager.
    79|
    80|```lua
    81|-- HeartbeatManager (single Script in ServerScriptService or a ModuleScript)
    82|local RunService = game:GetService("RunService")
    83|
    84|local HeartbeatManager = {}
    85|HeartbeatManager._callbacks = {} :: { [string]: (dt: number) -> () }
    86|
    87|function HeartbeatManager:Register(id: string, callback: (dt: number) -> ())
    88|	self._callbacks[id] = callback
    89|end
    90|
    91|function HeartbeatManager:Unregister(id: string)
    92|	self._callbacks[id] = nil
    93|end
    94|
    95|RunService.Heartbeat:Connect(function(dt: number)
    96|	for _, callback in self._callbacks do
    97|		callback(dt)
    98|	end
    99|end)
   100|
   101|return HeartbeatManager
   102|```
   103|
   104|Usage from other modules:
   105|
   106|```lua
   107|local HeartbeatManager = require(path.to.HeartbeatManager)
   108|
   109|HeartbeatManager:Register("EnemyAI", function(dt: number)
   110|	-- update all enemies
   111|end)
   112|
   113|-- When no longer needed:
   114|HeartbeatManager:Unregister("EnemyAI")
   115|```
   116|
   117|### Cache GetService Calls
   118|
   119|```lua
   120|-- GOOD: cache at the top of the script
   121|local Players = game:GetService("Players")
   122|local ReplicatedStorage = game:GetService("ReplicatedStorage")
   123|local RunService = game:GetService("RunService")
   124|
   125|-- BAD: calling GetService repeatedly
   126|RunService.Heartbeat:Connect(function()
   127|	local players = game:GetService("Players"):GetPlayers() -- wasteful
   128|end)
   129|```
   130|
   131|### Avoid FindFirstChild in Tight Loops
   132|
   133|```lua
   134|-- BAD: searching the hierarchy every frame
   135|RunService.Heartbeat:Connect(function()
   136|	local hrp = workspace:FindFirstChild("Player1"):FindFirstChild("HumanoidRootPart")
   137|end)
   138|
   139|-- GOOD: cache the reference once
   140|local hrp = character:WaitForChild("HumanoidRootPart")
   141|RunService.Heartbeat:Connect(function()
   142|	if hrp and hrp.Parent then
   143|		-- use cached reference
   144|	end
   145|end)
   146|```
   147|
   148|### Table Pre-allocation
   149|
   150|```lua
   151|-- Pre-allocate a table with 100 slots
   152|local results = table.create(100)
   153|for i = 1, 100 do
   154|	results[i] = computeValue(i)
   155|end
   156|```
   157|
   158|### String Concatenation
   159|
   160|```lua
   161|-- BAD: creates a new string object every iteration
   162|local result = ""
   163|for i = 1, 1000 do
   164|	result = result .. tostring(i) .. ","
   165|end
   166|
   167|-- GOOD: build a table, join once
   168|local parts = table.create(1000)
   169|for i = 1, 1000 do
   170|	parts[i] = tostring(i)
   171|end
   172|local result = table.concat(parts, ",")
   173|```
   174|
   175|---
   176|
   177|## 5. Memory Management
   178|
   179|### Disconnect Events
   180|
   181|Every `:Connect()` call returns a `RBXScriptConnection`. Store it and disconnect when done.
   182|
   183|```lua
   184|-- Event Cleanup Pattern
   185|local Cleaner = {}
   186|Cleaner.__index = Cleaner
   187|
   188|function Cleaner.new()
   189|	local self = setmetatable({}, Cleaner)
   190|	self._connections = {} :: { RBXScriptConnection }
   191|	self._instances = {} :: { Instance }
   192|	return self
   193|end
   194|
   195|function Cleaner:Add(connection: RBXScriptConnection)
   196|	table.insert(self._connections, connection)
   197|	return connection
   198|end
   199|
   200|function Cleaner:AddInstance(instance: Instance)
   201|	table.insert(self._instances, instance)
   202|	return instance
   203|end
   204|
   205|function Cleaner:Clean()
   206|	for _, conn in self._connections do
   207|		if conn.Connected then
   208|			conn:Disconnect()
   209|		end
   210|	end
   211|	table.clear(self._connections)
   212|
   213|	for _, inst in self._instances do
   214|		inst:Destroy()
   215|	end
   216|	table.clear(self._instances)
   217|end
   218|
   219|return Cleaner
   220|```
   221|
   222|Usage:
   223|
   224|```lua
   225|local Cleaner = require(path.to.Cleaner)
   226|local cleaner = Cleaner.new()
   227|
   228|cleaner:Add(workspace.ChildAdded:Connect(function(child)
   229|	print(child.Name, "added")
   230|end))
   231|
   232|cleaner:Add(Players.PlayerRemoving:Connect(function(player)
   233|	print(player.Name, "left")
   234|end))
   235|
   236|-- When this system shuts down or the player leaves:
   237|cleaner:Clean()
   238|```
   239|
   240|### Destroy Instances Properly
   241|
   242|- Always call `:Destroy()` rather than setting `Parent = nil`. `:Destroy()` locks the instance, disconnects all events on it, and marks it for garbage collection.
   243|- Setting `Parent = nil` keeps the instance alive if anything still references it.
   244|
   245|### Avoid Reference Cycles
   246|
   247|```lua
   248|-- BAD: mutual references prevent garbage collection
   249|local a = {}
   250|local b = {}
   251|a.ref = b
   252|b.ref = a
   253|-- Neither a nor b can be collected until both references are broken
   254|```
   255|
   256|Break references explicitly when done: `a.ref = nil; b.ref = nil`.
   257|
   258|### Instance.Destroying
   259|
   260|Use `Instance.Destroying` to run cleanup when an instance is about to be destroyed:
   261|
   262|```lua
   263|local part = Instance.new("Part")
   264|part.Destroying:Connect(function()
   265|	-- clean up related data, disconnect connections, etc.
   266|end)
   267|```
   268|
   269|### Debris Service
   270|
   271|For timed cleanup of temporary instances (projectiles, effects):
   272|
   273|```lua
   274|local Debris = game:GetService("Debris")
   275|local bullet = Instance.new("Part")
   276|bullet.Parent = workspace
   277|Debris:AddItem(bullet, 5) -- destroyed after 5 seconds
   278|```
   279|
   280|---
   281|
   282|## 6. Network Optimization
   283|
   284|### Minimize RemoteEvent Data Size
   285|
   286|- Send only what changed, not full state.
   287|- Use numeric IDs instead of long string keys when possible.
   288|- Avoid sending Instance references when a name or ID suffices.
   289|
   290|### Batch Related Remotes
   291|
   292|```lua
   293|-- BAD: three separate remote calls
   294|remoteHealth:FireClient(player, health)
   295|remoteAmmo:FireClient(player, ammo)
   296|remoteStamina:FireClient(player, stamina)
   297|
   298|-- GOOD: one call with a table
   299|remotePlayerState:FireClient(player, {
   300|	health = health,
   301|	ammo = ammo,
   302|	stamina = stamina,
   303|})
   304|```
   305|
   306|### UnreliableRemoteEvent
   307|
   308|For high-frequency, non-critical data such as position or rotation updates, use `UnreliableRemoteEvent`. Dropped packets are acceptable because the next update will correct the state.
   309|
   310|```lua
   311|-- In ReplicatedStorage, create an UnreliableRemoteEvent named "PositionSync"
   312|local posSync = ReplicatedStorage:WaitForChild("PositionSync")
   313|
   314|-- Server: fire frequently without guaranteeing delivery
   315|RunService.Heartbeat:Connect(function()
   316|	for _, player in Players:GetPlayers() do
   317|		posSync:FireClient(player, npcPositions)
   318|	end
   319|end)
   320|```
   321|
   322|### Compress Large Data
   323|
   324|- Strip unnecessary keys before sending.
   325|- Use short key names (`hp` instead of `hitPoints`).
   326|- Consider delta compression: send only values that changed since the last update.
   327|
   328|### Reduce Replication
   329|
   330|- Set visual-only properties on the client (particle colors, UI tweens).
   331|- Properties changed on the server replicate to all clients automatically, which consumes bandwidth.
   332|
   333|---
   334|
   335|## 7. Rendering Optimization
   336|
   337|### Level of Detail (LOD)
   338|
   339|Create multiple versions of a model at different detail levels and swap based on distance:
   340|
   341|```lua
   342|local function setLOD(model: Model, playerPosition: Vector3)
   343|	local distance = (model:GetPivot().Position - playerPosition).Magnitude
   344|	if distance < 100 then
   345|		-- show high-detail version
   346|	elseif distance < 300 then
   347|		-- show medium-detail version
   348|	else
   349|		-- show low-detail version or hide
   350|	end
   351|end
   352|```
   353|
   354|Roblox also has built-in `MeshPart.RenderFidelity` (Automatic, Performance, Precise) which controls mesh LOD.
   355|
   356|### Draw Distance Limits
   357|
   358|- Use `BasePart.CastShadow = false` on distant or small parts.
   359|- Disable unnecessary `SurfaceLight`, `PointLight`, `SpotLight` on distant objects.
   360|- With StreamingEnabled, the engine handles draw distance automatically.
   361|
   362|### Particle Count Budgets
   363|
   364|| Property | Recommended Max |
   365||---|---|
   366|| Particles per emitter (`Rate`) | ~200 |
   367|| Total active emitters in view | ~20 |
   368|| Beam segments (`Segments`) | 10-20 |
   369|| Trail `MaxLength` | Keep short for mobile |
   370|
   371|- Set `ParticleEmitter.Enabled = false` when off-screen or far away.
   372|- Use fewer, larger particles instead of many small ones.
   373|
   374|### Texture Resolution
   375|
   376|| Use Case | Max Resolution |
   377||---|---|
   378|| General props, walls, floors | 512x512 |
   379|| Hero assets (player characters, key items) | 1024x1024 |
   380|| UI icons, decals | 256x256 to 512x512 |
   381|| Sky/environment | 1024x1024 |
   382|
   383|- Use `Decal` over `Texture` when the surface only needs one face covered. Decals are simpler to render.
   384|- Compress textures before uploading. Avoid PNG when JPEG quality is acceptable.
   385|
   386|---
   387|
   388|## 8. Mobile-Specific Optimization
   389|
   390|### Part Counts
   391|
   392|- Target 30-50% fewer parts than desktop. If the desktop budget is 10K parts, aim for 5-7K on mobile.
   393|- Use `UserInputService:GetPlatform()` or screen size to detect mobile and reduce detail.
   394|
   395|### Simplified Particle Effects
   396|
   397|- Halve the `Rate` of particle emitters on mobile.
   398|- Reduce `Lifetime` to keep fewer active particles.
   399|- Disable non-essential emitters entirely.
   400|
   401|### Touch-Optimized UI
   402|
   403|- Minimum touch target size: **44x44 points** (following Apple HIG).
   404|- Add padding between interactive elements.
   405|- Use `GuiObject.Active = true` to ensure touch events register.
   406|- Avoid hover-dependent UI (mobile has no hover state).
   407|
   408|### Reduced Draw Distance
   409|
   410|```lua
   411|if UserInputService.TouchEnabled then
   412|	workspace.StreamingTargetRadius = 128 -- lower than desktop
   413|	workspace.StreamingMinRadius = 48
   414|end
   415|```
   416|
   417|### Memory-Efficient Assets
   418|
   419|- Use lower-resolution textures on mobile (256x256 where desktop uses 512x512).
   420|- Reduce mesh polygon counts for mobile LOD models.
   421|- Monitor memory with `Stats():GetTotalMemoryUsageMb()` and warn/act if approaching 500 MB.
   422|
   423|### Test on Low-End Devices
   424|
   425|- Test on devices with 2-3 GB RAM (older iPads, budget Android phones).
   426|- Use the Roblox mobile emulator in Studio, but always verify on real hardware.
   427|- Check for thermal throttling during extended play sessions.
   428|
   429|---
   430|
   431|## 9. Profiling Tools
   432|
   433|### MicroProfiler (Ctrl+F6 in Studio)
   434|
   435|The MicroProfiler displays a real-time flame graph of what the engine is doing each frame.
   436|
   437|**How to read it:**
   438|
   439|1. Press `Ctrl+F6` to open. Press `Ctrl+P` to pause and inspect a frame.
   440|2. Each horizontal bar is a task. Width represents time spent.
   441|3. Look for bars that are unusually wide — these are your hot frames.
   442|4. Common labels to watch:
   443|   - `Heartbeat` — your Heartbeat scripts. If wide, your per-frame logic is too heavy.
   444|   - `Physics` — collision and simulation. Reduce unanchored parts.
   445|   - `Render/Perform` — GPU-bound. Reduce draw calls, textures, particles.
   446|   - `Replication` — network overhead. Reduce remote calls and replicated property changes.
   447|5. Click a bar to see details: script name, line number, time in microseconds.
   448|6. Use the `microprofiler` dump (`Ctrl+F6` > `Dump`) to save a `.html` file for offline analysis.
   449|
   450|### F9 Developer Console
   451|
   452|- Press `F9` in-game or in Studio to open.
   453|- **Log** tab: errors, warnings, print output.
   454|- **Memory** tab: breakdown by category (Instances, PhysicsParts, Sounds, Scripts, Signals, etc.).
   455|- **Stats** tab: FPS, ping, data send/receive rates.
   456|- **Server Stats** (in-game): server heartbeat time, physics step time.
   457|
   458|### Stats Service (Programmatic)
   459|
   460|```lua
   461|local Stats = game:GetService("Stats")
   462|
   463|-- Total memory in MB
   464|local totalMemory = Stats:GetTotalMemoryUsageMb()
   465|
   466|-- Specific categories
   467|local instanceMemory = Stats:GetMemoryUsageMbForTag(Enum.DeveloperMemoryTag.Instances)
   468|local scriptMemory = Stats:GetMemoryUsageMbForTag(Enum.DeveloperMemoryTag.LuaHeap)
   469|
   470|print(string.format("Total: %.1f MB | Instances: %.1f MB | Lua: %.1f MB",
   471|	totalMemory, instanceMemory, scriptMemory))
   472|```
   473|
   474|---
   475|
   476|## 10. Best Practices
   477|
   478|### Profile Before Optimizing
   479|
   480|Never guess where the bottleneck is. Use the MicroProfiler and memory stats to find the actual hot path before changing code.
   481|
   482|### Optimize Hot Paths First
   483|
   484|Focus effort on code that runs every frame (Heartbeat, RenderStepped) or on every player action. Code that runs once at startup is rarely worth optimizing.
   485|
   486|### Spatial Queries Over Brute Force
   487|
   488|```lua
   489|-- BAD: loop over every part in workspace
   490|for _, part in workspace:GetDescendants() do
   491|	if (part.Position - origin).Magnitude < 50 then
   492|		-- ...
   493|	end
   494|end
   495|
   496|-- GOOD: spatial query
   497|local params = OverlapParams.new()
   498|params.FilterType = Enum.RaycastFilterType.Include
   499|params.FilterDescendantsInstances = { workspace.Enemies }
   500|
   501|