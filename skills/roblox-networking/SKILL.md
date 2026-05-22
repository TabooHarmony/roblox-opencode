     1|---
     2|name: roblox-networking
     3|description: >
     4|  Remotes, validation, exploit literacy, rate limiting, server-authoritative networking,
     5|  security hardening.
     6|last_reviewed: 2026-05-21
     7|---
     8|
     9|<!-- Source: brockmartin/roblox-game-skill (MIT) -->
    10|
    11|     1|# Roblox Multiplayer & Networking Reference
    12|     2|
    13|     3|---
    14|     4|
    15|     5|## 1. Overview
    16|     6|
    17|     7|**Load this reference when:**
    18|     8|
    19|     9|- Designing multiplayer game loops (rounds, lobbies, arenas)
    20|    10|- Implementing matchmaking or queue systems
    21|    11|- Building cross-server features (global chat, trading, server browsing)
    22|    12|- Working with TeleportService for multi-place games
    23|    13|- Creating team-based gameplay
    24|    14|- Managing player lifecycles in a multiplayer context
    25|    15|- Setting up private/reserved servers
    26|    16|
    27|    17|This document covers player management, team systems, lobby implementation, round-based game loops, TeleportService, MessagingService, matchmaking, server instance management, and production best practices for multiplayer Roblox games.
    28|    18|
    29|    19|---
    30|    20|
    31|    21|## 2. Player Management
    32|    22|
    33|    23|### Players Service
    34|    24|
    35|    25|The `Players` service is the root of all player-related functionality. Every connected player is represented by a `Player` instance that lives as a child of `Players`.
    36|    26|
    37|    27|```luau
    38|    28|local Players = game:GetService("Players")
    39|    29|
    40|    30|-- Current player count
    41|    31|local count = #Players:GetPlayers()
    42|    32|
    43|    33|-- Server capacity
    44|    34|local maxPlayers = Players.MaxPlayers
    45|    35|
    46|    36|-- Iterate all connected players
    47|    37|for _, player in Players:GetPlayers() do
    48|    38|    print(player.Name, player.UserId)
    49|    39|end
    50|    40|```
    51|    41|
    52|    42|### PlayerAdded / PlayerRemoving
    53|    43|
    54|    44|These are the two most important events for multiplayer games. They fire on the server when a player joins or leaves.
    55|    45|
    56|    46|```luau
    57|    47|-- ServerScriptService/PlayerManager.luau
    58|    48|
    59|    49|local Players = game:GetService("Players")
    60|    50|
    61|    51|local function onPlayerAdded(player: Player)
    62|    52|    -- Load saved data
    63|    53|    -- Initialize player state (score, team assignment, inventory)
    64|    54|    -- Grant starter gear
    65|    55|    -- Teleport to lobby spawn
    66|    56|    print(`{player.Name} joined (UserId: {player.UserId})`)
    67|    57|end
    68|    58|
    69|    59|local function onPlayerRemoving(player: Player)
    70|    60|    -- Save player data (CRITICAL: do this before the player object is destroyed)
    71|    61|    -- Clean up any per-player state tables
    72|    62|    -- Notify other players
    73|    63|    -- Update team balance
    74|    64|    print(`{player.Name} leaving`)
    75|    65|end
    76|    66|
    77|    67|Players.PlayerAdded:Connect(onPlayerAdded)
    78|    68|Players.PlayerRemoving:Connect(onPlayerRemoving)
    79|    69|
    80|    70|-- Handle players who joined before this script ran (studio edge case)
    81|    71|for _, player in Players:GetPlayers() do
    82|    72|    task.spawn(onPlayerAdded, player)
    83|    73|end
    84|    74|```
    85|    75|
    86|    76|**Critical rule:** Always handle `PlayerRemoving` to save data. The player object and its descendants are destroyed shortly after this event fires. If you yield too long (e.g., a slow DataStore call), you risk losing the save. Use `game:BindToClose()` as a fallback for server shutdowns.
    87|    77|
    88|    78|### CharacterAdded / CharacterRemoving
    89|    79|
    90|    80|Each player's character is a `Model` in `Workspace` that contains the `Humanoid`, body parts, and accessories. Characters are created and destroyed on respawn.
    91|    81|
    92|    82|```luau
    93|    83|local function onCharacterAdded(character: Model)
    94|    84|    local humanoid = character:WaitForChild("Humanoid")
    95|    85|    local rootPart = character:WaitForChild("HumanoidRootPart")
    96|    86|
    97|    87|    -- Set custom health
    98|    88|    humanoid.MaxHealth = 150
    99|    89|    humanoid.Health = 150
   100|    90|
   101|    91|    -- Listen for death
   102|    92|    humanoid.Died:Connect(function()
   103|    93|        -- Award kill to attacker, update scoreboard, etc.
   104|    94|    end)
   105|    95|end
   106|    96|
   107|    97|player.CharacterAdded:Connect(onCharacterAdded)
   108|    98|```
   109|    99|
   110|   100|### LoadCharacter (Manual Respawning)
   111|   101|
   112|   102|By default, Roblox auto-spawns characters. For round-based games, disable auto-spawn and control it manually:
   113|   103|
   114|   104|```luau
   115|   105|-- In StarterPlayer properties: set CharacterAutoLoads = false
   116|   106|-- Or set it in script:
   117|   107|Players.CharacterAutoLoads = false
   118|   108|
   119|   109|-- Spawn a specific player
   120|   110|player:LoadCharacter()
   121|   111|
   122|   112|-- Spawn all players
   123|   113|for _, player in Players:GetPlayers() do
   124|   114|    task.spawn(function()
   125|   115|        player:LoadCharacter()
   126|   116|    end)
   127|   117|end
   128|   118|```
   129|   119|
   130|   120|### Player Instance Lifecycle
   131|   121|
   132|   122|Understanding the lifecycle prevents common bugs:
   133|   123|
   134|   124|1. `PlayerAdded` fires -- Player instance exists, no character yet.
   135|   125|2. `CharacterAdded` fires -- Character model is parented to Workspace.
   136|   126|3. `CharacterRemoving` fires -- Character is about to be destroyed (death or manual removal).
   137|   127|4. `CharacterAdded` fires again -- Respawn.
   138|   128|5. `PlayerRemoving` fires -- Player is disconnecting. Character may or may not exist.
   139|   129|
   140|   130|**Gotcha:** `player.Character` can be `nil` at any point. Always nil-check before accessing it.
   141|   131|
   142|   132|---
   143|   133|
   144|   134|## 3. Team Systems
   145|   135|
   146|   136|### Teams Service
   147|   137|
   148|   138|The `Teams` service holds `Team` objects. Teams are automatically replicated to all clients and show up in the default leaderboard.
   149|   139|
   150|   140|```luau
   151|   141|local Teams = game:GetService("Teams")
   152|   142|
   153|   143|-- Create teams programmatically (or place them in Studio under Teams)
   154|   144|local redTeam = Instance.new("Team")
   155|   145|redTeam.Name = "Red"
   156|   146|redTeam.TeamColor = BrickColor.new("Bright red")
   157|   147|redTeam.AutoAssignable = false -- Don't auto-assign players
   158|   148|redTeam.Parent = Teams
   159|   149|
   160|   150|local blueTeam = Instance.new("Team")
   161|   151|blueTeam.Name = "Blue"
   162|   152|blueTeam.TeamColor = BrickColor.new("Bright blue")
   163|   153|blueTeam.AutoAssignable = false
   164|   154|blueTeam.Parent = Teams
   165|   155|
   166|   156|local lobbyTeam = Instance.new("Team")
   167|   157|lobbyTeam.Name = "Lobby"
   168|   158|lobbyTeam.TeamColor = BrickColor.new("Medium stone grey")
   169|   159|lobbyTeam.AutoAssignable = true -- New players go here
   170|   160|lobbyTeam.Parent = Teams
   171|   161|```
   172|   162|
   173|   163|### Assigning Players to Teams
   174|   164|
   175|   165|```luau
   176|   166|-- Direct assignment
   177|   167|player.Team = redTeam
   178|   168|
   179|   169|-- The player's nametag, leaderboard entry, and spawn location
   180|   170|-- all update automatically based on TeamColor.
   181|   171|
   182|   172|-- Get all players on a team
   183|   173|local redPlayers = redTeam:GetPlayers()
   184|   174|print(`Red team has {#redPlayers} players`)
   185|   175|```
   186|   176|
   187|   177|### Team-Based Logic
   188|   178|
   189|   179|Always check teams on the **server** before applying damage or other competitive interactions:
   190|   180|
   191|   181|```luau
   192|   182|local function canDamage(attacker: Player, victim: Player): boolean
   193|   183|    -- No friendly fire
   194|   184|    if attacker.Team == victim.Team then
   195|   185|        return false
   196|   186|    end
   197|   187|
   198|   188|    -- No damaging lobby players
   199|   189|    if victim.Team == lobbyTeam then
   200|   190|        return false
   201|   191|    end
   202|   192|
   203|   193|    return true
   204|   194|end
   205|   195|
   206|   196|-- In a weapon hit handler (server-side)
   207|   197|local function onWeaponHit(attacker: Player, victimCharacter: Model)
   208|   198|    local victim = Players:GetPlayerFromCharacter(victimCharacter)
   209|   199|    if not victim then return end
   210|   200|
   211|   201|    if not canDamage(attacker, victim) then return end
   212|   202|
   213|   203|    local humanoid = victimCharacter:FindFirstChild("Humanoid")
   214|   204|    if humanoid then
   215|   205|        humanoid:TakeDamage(25)
   216|   206|    end
   217|   207|end
   218|   208|```
   219|   209|
   220|   210|### Auto-Balancing Teams
   221|   211|
   222|   212|```luau
   223|   213|local function getSmallestTeam(teamList: {Team}): Team
   224|   214|    local smallest = teamList[1]
   225|   215|    local smallestCount = #smallest:GetPlayers()
   226|   216|
   227|   217|    for i = 2, #teamList do
   228|   218|        local count = #teamList[i]:GetPlayers()
   229|   219|        if count < smallestCount then
   230|   220|            smallest = teamList[i]
   231|   221|            smallestCount = count
   232|   222|        end
   233|   223|    end
   234|   224|
   235|   225|    return smallest
   236|   226|end
   237|   227|
   238|   228|-- Assign player to the team with fewer members
   239|   229|local function assignToBalancedTeam(player: Player)
   240|   230|    player.Team = getSmallestTeam({ redTeam, blueTeam })
   241|   231|end
   242|   232|```
   243|   233|
   244|   234|---
   245|   235|
   246|   236|## 4. Lobby System
   247|   237|
   248|   238|A lobby holds players in a waiting area until enough are ready to start a round. This implementation tracks ready states, shows a ready-up GUI, enforces a minimum player threshold, and auto-starts after a timeout.
   249|   239|
   250|   240|### Server-Side Lobby Manager
   251|   241|
   252|   242|```luau
   253|   243|-- ServerScriptService/LobbyManager.luau
   254|   244|
   255|   245|local Players = game:GetService("Players")
   256|   246|local ReplicatedStorage = game:GetService("ReplicatedStorage")
   257|   247|
   258|   248|local LobbyRemotes = Instance.new("Folder")
   259|   249|LobbyRemotes.Name = "LobbyRemotes"
   260|   250|LobbyRemotes.Parent = ReplicatedStorage
   261|   251|
   262|   252|local ReadyUpEvent = Instance.new("RemoteEvent")
   263|   253|ReadyUpEvent.Name = "ReadyUp"
   264|   254|ReadyUpEvent.Parent = LobbyRemotes
   265|   255|
   266|   256|local LobbyStatusEvent = Instance.new("RemoteEvent")
   267|   257|LobbyStatusEvent.Name = "LobbyStatus"
   268|   258|LobbyStatusEvent.Parent = LobbyRemotes
   269|   259|
   270|   260|-- Configuration
   271|   261|local MIN_PLAYERS = 2
   272|   262|local MAX_WAIT_TIME = 60 -- seconds to auto-start after minimum reached
   273|   263|local COUNTDOWN_DURATION = 10 -- final countdown before round starts
   274|   264|
   275|   265|-- State
   276|   266|local readyPlayers: { [Player]: boolean } = {}
   277|   267|local lobbyActive = true
   278|   268|local countdownRunning = false
   279|   269|
   280|   270|local function getReadyCount(): number
   281|   271|    local count = 0
   282|   272|    for player, isReady in readyPlayers do
   283|   273|        -- Verify the player is still connected
   284|   274|        if isReady and player.Parent == Players then
   285|   275|            count += 1
   286|   276|        end
   287|   277|    end
   288|   278|    return count
   289|   279|end
   290|   280|
   291|   281|local function getTotalPlayers(): number
   292|   282|    return #Players:GetPlayers()
   293|   283|end
   294|   284|
   295|   285|local function broadcastStatus(message: string, countdown: number?)
   296|   286|    for _, player in Players:GetPlayers() do
   297|   287|        LobbyStatusEvent:FireClient(player, message, countdown, getReadyCount(), getTotalPlayers())
   298|   288|    end
   299|   289|end
   300|   290|
   301|   291|local function shouldStart(): boolean
   302|   292|    return getTotalPlayers() >= MIN_PLAYERS and getReadyCount() >= MIN_PLAYERS
   303|   293|end
   304|   294|
   305|   295|local function startCountdown()
   306|   296|    if countdownRunning then return end
   307|   297|    countdownRunning = true
   308|   298|
   309|   299|    for i = COUNTDOWN_DURATION, 1, -1 do
   310|   300|        if not lobbyActive then
   311|   301|            countdownRunning = false
   312|   302|            return
   313|   303|        end
   314|   304|
   315|   305|        -- Recheck player count (someone may have left)
   316|   306|        if getTotalPlayers() < MIN_PLAYERS then
   317|   307|            broadcastStatus("Not enough players. Waiting...", nil)
   318|   308|            countdownRunning = false
   319|   309|            return
   320|   310|        end
   321|   311|
   322|   312|        broadcastStatus(`Round starting in {i}...`, i)
   323|   313|        task.wait(1)
   324|   314|    end
   325|   315|
   326|   316|    countdownRunning = false
   327|   317|    lobbyActive = false
   328|   318|    broadcastStatus("Round starting!", 0)
   329|   319|
   330|   320|    -- Signal to round manager (see Section 5)
   331|   321|    local RoundManager = require(script.Parent:WaitForChild("RoundManager"))
   332|   322|    RoundManager.startRound()
   333|   323|end
   334|   324|
   335|   325|-- Handle ready-up toggle
   336|   326|ReadyUpEvent.OnServerEvent:Connect(function(player: Player)
   337|   327|    if not lobbyActive then return end
   338|   328|
   339|   329|    readyPlayers[player] = not readyPlayers[player]
   340|   330|    broadcastStatus(
   341|   331|        if readyPlayers[player] then `{player.Name} is ready!` else `{player.Name} unreadied.`,
   342|   332|        nil
   343|   333|    )
   344|   334|
   345|   335|    if shouldStart() and not countdownRunning then
   346|   336|        task.spawn(startCountdown)
   347|   337|    end
   348|   338|end)
   349|   339|
   350|   340|-- Clean up when players leave
   351|   341|Players.PlayerRemoving:Connect(function(player: Player)
   352|   342|    readyPlayers[player] = nil
   353|   343|
   354|   344|    if lobbyActive then
   355|   345|        broadcastStatus(`{player.Name} left the lobby.`, nil)
   356|   346|    end
   357|   347|end)
   358|   348|
   359|   349|-- Auto-start timer: once minimum players are present, start a background timer
   360|   350|task.spawn(function()
   361|   351|    local waitElapsed = 0
   362|   352|    while lobbyActive do
   363|   353|        task.wait(1)
   364|   354|        if getTotalPlayers() >= MIN_PLAYERS then
   365|   355|            waitElapsed += 1
   366|   356|            if waitElapsed >= MAX_WAIT_TIME and not countdownRunning then
   367|   357|                -- Force all present players to ready
   368|   358|                for _, player in Players:GetPlayers() do
   369|   359|                    readyPlayers[player] = true
   370|   360|                end
   371|   361|                task.spawn(startCountdown)
   372|   362|            end
   373|   363|        else
   374|   364|            waitElapsed = 0
   375|   365|        end
   376|   366|    end
   377|   367|end)
   378|   368|
   379|   369|-- Public API for reset
   380|   370|local LobbyManager = {}
   381|   371|
   382|   372|function LobbyManager.reset()
   383|   373|    readyPlayers = {}
   384|   374|    lobbyActive = true
   385|   375|    countdownRunning = false
   386|   376|    broadcastStatus("Lobby open. Ready up!", nil)
   387|   377|end
   388|   378|
   389|   379|return LobbyManager
   390|   380|```
   391|   381|
   392|   382|### Client-Side Ready-Up GUI
   393|   383|
   394|   384|```luau
   395|   385|-- StarterPlayerScripts/LobbyGui.client.luau
   396|   386|
   397|   387|local Players = game:GetService("Players")
   398|   388|local ReplicatedStorage = game:GetService("ReplicatedStorage")
   399|   389|
   400|   390|local player = Players.LocalPlayer
   401|   391|local playerGui = player:WaitForChild("PlayerGui")
   402|   392|local lobbyRemotes = ReplicatedStorage:WaitForChild("LobbyRemotes")
   403|   393|local readyUpEvent = lobbyRemotes:WaitForChild("ReadyUp")
   404|   394|local lobbyStatusEvent = lobbyRemotes:WaitForChild("LobbyStatus")
   405|   395|
   406|   396|-- Build GUI
   407|   397|local screenGui = Instance.new("ScreenGui")
   408|   398|screenGui.Name = "LobbyGui"
   409|   399|screenGui.ResetOnSpawn = false
   410|   400|screenGui.Parent = playerGui
   411|   401|
   412|   402|local frame = Instance.new("Frame")
   413|   403|frame.Size = UDim2.fromScale(0.3, 0.15)
   414|   404|frame.Position = UDim2.fromScale(0.35, 0.8)
   415|   405|frame.BackgroundColor3 = Color3.fromRGB(30, 30, 30)
   416|   406|frame.BackgroundTransparency = 0.3
   417|   407|frame.Parent = screenGui
   418|   408|
   419|   409|local uiCorner = Instance.new("UICorner")
   420|   410|uiCorner.CornerRadius = UDim.new(0, 12)
   421|   411|uiCorner.Parent = frame
   422|   412|
   423|   413|local statusLabel = Instance.new("TextLabel")
   424|   414|statusLabel.Size = UDim2.fromScale(1, 0.5)
   425|   415|statusLabel.BackgroundTransparency = 1
   426|   416|statusLabel.TextColor3 = Color3.new(1, 1, 1)
   427|   417|statusLabel.TextScaled = true
   428|   418|statusLabel.Text = "Waiting for players..."
   429|   419|statusLabel.Parent = frame
   430|   420|
   431|   421|local readyButton = Instance.new("TextButton")
   432|   422|readyButton.Size = UDim2.fromScale(0.6, 0.4)
   433|   423|readyButton.Position = UDim2.fromScale(0.2, 0.55)
   434|   424|readyButton.BackgroundColor3 = Color3.fromRGB(0, 170, 0)
   435|   425|readyButton.TextColor3 = Color3.new(1, 1, 1)
   436|   426|readyButton.TextScaled = true
   437|   427|readyButton.Text = "Ready Up"
   438|   428|readyButton.Parent = frame
   439|   429|
   440|   430|local readyCorner = Instance.new("UICorner")
   441|   431|readyCorner.CornerRadius = UDim.new(0, 8)
   442|   432|readyCorner.Parent = readyButton
   443|   433|
   444|   434|local isReady = false
   445|   435|
   446|   436|readyButton.Activated:Connect(function()
   447|   437|    isReady = not isReady
   448|   438|    readyButton.Text = if isReady then "Unready" else "Ready Up"
   449|   439|    readyButton.BackgroundColor3 = if isReady
   450|   440|        then Color3.fromRGB(170, 0, 0)
   451|   441|        else Color3.fromRGB(0, 170, 0)
   452|   442|    readyUpEvent:FireServer()
   453|   443|end)
   454|   444|
   455|   445|lobbyStatusEvent.OnClientEvent:Connect(function(message: string, countdown: number?, readyCount: number, totalCount: number)
   456|   446|    statusLabel.Text = `{message}\nReady: {readyCount}/{totalCount}`
   457|   447|
   458|   448|    if countdown and countdown == 0 then
   459|   449|        screenGui.Enabled = false
   460|   450|    end
   461|   451|end)
   462|   452|```
   463|   453|
   464|   454|---
   465|   455|
   466|   456|## 5. Round-Based Games
   467|   457|
   468|   458|### Round Lifecycle State Machine
   469|   459|
   470|   460|A production round system follows a clear state machine:
   471|   461|
   472|   462|```
   473|   463|Intermission --> Countdown --> Playing --> Results --> Intermission
   474|   464|```
   475|   465|
   476|   466|Each state has entry/exit logic, and the system must handle players joining and leaving at any point.
   477|   467|
   478|   468|### Complete Round Manager Implementation
   479|   469|
   480|   470|```luau
   481|   471|-- ServerScriptService/RoundManager.luau
   482|   472|
   483|   473|local Players = game:GetService("Players")
   484|   474|local ReplicatedStorage = game:GetService("ReplicatedStorage")
   485|   475|local ServerStorage = game:GetService("ServerStorage")
   486|   476|local Teams = game:GetService("Teams")
   487|   477|
   488|   478|-- Remotes
   489|   479|local RoundRemotes = Instance.new("Folder")
   490|   480|RoundRemotes.Name = "RoundRemotes"
   491|   481|RoundRemotes.Parent = ReplicatedStorage
   492|   482|
   493|   483|local RoundStateEvent = Instance.new("RemoteEvent")
   494|   484|RoundStateEvent.Name = "RoundState"
   495|   485|RoundStateEvent.Parent = RoundRemotes
   496|   486|
   497|   487|local ScoreUpdateEvent = Instance.new("RemoteEvent")
   498|   488|ScoreUpdateEvent.Name = "ScoreUpdate"
   499|   489|ScoreUpdateEvent.Parent = RoundRemotes
   500|   490|
   501|

---

## Rate Limiting

Roblox's built-in throttle (~500 req/sec per client) is NOT a substitute for custom rate limiting. Players can still spam remotes at hundreds of requests per second. You need application-level throttling.

### Pattern 1: Per-Player Cooldown Table

Simple and effective for most games. Each remote has a minimum time between calls per player.

```luau
local cooldowns: {[Player]: {[string]: number}} = {}
local COOLDOWN = 0.2 -- seconds between calls

local function isThrottled(player: Player, remoteName: string): boolean
    local now = os.clock()
    if not cooldowns[player] then
        cooldowns[player] = {}
    end

    local lastCall = cooldowns[player][remoteName]
    if lastCall and (now - lastCall) < COOLDOWN then
        return true -- throttled
    end

    cooldowns[player][remoteName] = now
    return false
end

-- Clean up when player leaves
Players.PlayerRemoving:Connect(function(player)
    cooldowns[player] = nil
end)

-- Usage
BuyItem.OnServerEvent:Connect(function(player, itemId)
    if isThrottled(player, "BuyItem") then return end
    -- process purchase
end)
```

### Pattern 2: Declarative Remote Definitions

Define all remotes in one place with rate limits, validation, and allowed states. Cleaner than scattered `OnServerEvent` handlers.

```luau
type RemoteDef = {
    RateLimit: number?,          -- min seconds between calls
    Validate: (Player, ...any) -> boolean,
    Handler: (Player, ...any) -> (),
}

local Remotes: {[string]: RemoteDef} = {
    BuyItem = {
        RateLimit = 0.5,
        Validate = function(player, itemId)
            return typeof(itemId) == "string" and #itemId < 50
        end,
        Handler = function(player, itemId)
            -- process purchase
        end,
    },
    EquipTool = {
        RateLimit = 0.3,
        Validate = function(player, toolId)
            return typeof(toolId) == "string"
        end,
        Handler = function(player, toolId)
            -- equip tool
        end,
    },
}

-- Wire up automatically
for name, def in Remotes do
    local remote = ReplicatedStorage:WaitForChild(name)
    remote.OnServerEvent:Connect(function(player, ...)
        if def.RateLimit and isThrottled(player, name) then return end
        if not def.Validate(player, ...) then return end
        def.Handler(player, ...)
    end)
end
```

### Pattern 3: Suspicion Scoring

For high-stakes games. Track suspicious behavior over time instead of hard-blocking.

```luau
local suspicion: {[Player]: number} = {}
local SUSPICION_THRESHOLD = 10
local DECAY_RATE = 1 -- points lost per second

local function addSuspicion(player: Player, amount: number, reason: string)
    suspicion[player] = (suspicion[player] or 0) + amount
    if suspicion[player] >= SUSPICION_THRESHOLD then
        -- escalate: kick, flag for review, or restrict actions
        warn(`High suspicion for {player.Name}: {reason}`)
    end
end

-- In remote handler
BuyItem.OnServerEvent:Connect(function(player, itemId)
    if isThrottled(player, "BuyItem") then
        addSuspicion(player, 2, "rate limit exceeded")
        return
    end
    -- normal processing
end)

-- Decay suspicion over time
task.spawn(function()
    while true do
        task.wait(1)
        for player, score in suspicion do
            suspicion[player] = math.max(0, score - DECAY_RATE)
        end
    end
end)
```

### What NOT to Do

```luau
-- BAD: no rate limiting at all
BuyItem.OnServerEvent:Connect(function(player, itemId)
    -- exploiter can call this 1000 times/second
    grantItem(player, itemId)
end)

-- BAD: client-side rate limiting (exploiter bypasses)
-- Rate limiting MUST be server-side
```

Source: Roblox Server-Side Detection Guide (Roblox/creator-docs, MIT), DevForum rate limiting patterns
