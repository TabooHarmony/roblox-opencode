--[[
    Settings Menu — Fusion 0.2
    Source patterns: VirtualButFake/fusion-components (MIT), dphfox/Fusion docs
    
    A complete settings menu with:
    - Tabbed sections (Audio, Graphics, Controls)
    - Sliders (volume, render distance)
    - Toggle switches (fullscreen, vsync, show FPS)
    - Dropdown select (quality preset)
    - Tween open/close animation
    - Saves to a settings table (caller persists however they want)
    
    ADAPT THIS:
    - Replace SETTINGS_SCHEMA with your game's actual settings
    - Wire OnSettingChanged to your DataStore or local storage
    - Add/remove tabs and controls as needed
    - Adjust colors to match your game's palette
]]

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Players = game:GetService("Players")

local Fusion = require(ReplicatedStorage.Packages.Fusion)
local New = Fusion.New
local Value = Fusion.Value
local Computed = Fusion.Computed
local ForPairs = Fusion.ForPairs
local Spring = Fusion.Spring
local Children = Fusion.Children
local OnEvent = Fusion.OnEvent

--------------------------------------------------------------------------------
-- Types
--------------------------------------------------------------------------------

type SettingValue = number | boolean | string

type SliderSetting = {
    Type: "slider",
    Label: string,
    Key: string,
    Min: number,
    Max: number,
    Step: number?,
    Default: number,
}

type ToggleSetting = {
    Type: "toggle",
    Label: string,
    Key: string,
    Default: boolean,
}

type DropdownSetting = {
    Type: "dropdown",
    Label: string,
    Key: string,
    Options: { string },
    Default: string,
}

type SettingEntry = SliderSetting | ToggleSetting | DropdownSetting

type SettingsTab = {
    Name: string,
    Icon: string?, -- optional icon id
    Settings: { SettingEntry },
}

type SettingsProps = {
    Visible: Fusion.Value<boolean>,
    Tabs: { SettingsTab },
    Values: { [string]: Fusion.Value<SettingValue> }, -- pre-created Value objects per key
    OnSettingChanged: (key: string, value: SettingValue) -> (),
    OnClose: () -> (),
}

--------------------------------------------------------------------------------
-- Theme
--------------------------------------------------------------------------------

local COLORS = {
    Background = Color3.fromRGB(18, 18, 26),
    Surface = Color3.fromRGB(28, 28, 40),
    SurfaceAlt = Color3.fromRGB(35, 35, 48),
    Primary = Color3.fromRGB(80, 140, 255),
    PrimaryMuted = Color3.fromRGB(50, 80, 140),
    Text = Color3.fromRGB(235, 235, 240),
    TextSecondary = Color3.fromRGB(155, 155, 170),
    TextMuted = Color3.fromRGB(90, 90, 105),
    ToggleOn = Color3.fromRGB(80, 200, 120),
    ToggleOff = Color3.fromRGB(60, 60, 75),
    SliderTrack = Color3.fromRGB(45, 45, 60),
    SliderFill = Color3.fromRGB(80, 140, 255),
    TabActive = Color3.fromRGB(80, 140, 255),
    TabInactive = Color3.fromRGB(60, 60, 75),
}

local FONT = {
    Title = Font.new("rbxasset://fonts/families/GothamSSm.json", Enum.FontWeight.Bold),
    Body = Font.new("rbxasset://fonts/families/GothamSSm.json", Enum.FontWeight.Medium),
    Small = Font.new("rbxasset://fonts/families/GothamSSm.json", Enum.FontWeight.Regular),
}

--------------------------------------------------------------------------------
-- Toggle Switch component
--------------------------------------------------------------------------------

local function ToggleSwitch(
    state: Fusion.Value<boolean>,
    onToggle: (newState: boolean) -> ()
)
    local isHovering = Value(false)

    return New("TextButton")({
        Name = "Toggle",
        BackgroundColor3 = Spring(Computed(function()
            return if state:get() then COLORS.ToggleOn else COLORS.ToggleOff
        end), 25),
        Size = UDim2.fromOffset(40, 22),
        AutoButtonColor = false,
        Text = "",

        [OnEvent("Activated")] = function()
            local newVal = not state:get()
            state:set(newVal)
            onToggle(newVal)
        end,
        [OnEvent("MouseEnter")] = function() isHovering:set(true) end,
        [OnEvent("MouseLeave")] = function() isHovering:set(false) end,

        [Children] = {
            New("UICorner")({ CornerRadius = UDim.new(1, 0) }),

            -- Knob
            New("Frame")({
                Name = "Knob",
                AnchorPoint = Vector2.new(0, 0.5),
                Position = Spring(Computed(function()
                    return if state:get()
                        then UDim2.new(1, -20, 0.5, 0)
                        else UDim2.new(0, 2, 0.5, 0)
                end), 30),
                Size = UDim2.fromOffset(18, 18),
                BackgroundColor3 = COLORS.Text,
                [Children] = { New("UICorner")({ CornerRadius = UDim.new(1, 0) }) },
            }),
        },
    })
end

--------------------------------------------------------------------------------
-- Slider component
--------------------------------------------------------------------------------

local function SettingsSlider(
    value: Fusion.Value<number>,
    min: number,
    max: number,
    step: number?,
    onChange: (newValue: number) -> ()
)
    local sliderRef = Value(nil :: Frame?)
    local isDragging = Value(false)

    local effectiveStep = step or 1
    local range = max - min

    local function updateFromInput(inputX: number)
        local slider = sliderRef:get()
        if not slider then return end

        local relativeX = math.clamp((inputX - slider.AbsolutePosition.X) / slider.AbsoluteSize.X, 0, 1)
        local rawValue = min + relativeX * range

        -- Snap to step
        local snapped = math.round(rawValue / effectiveStep) * effectiveStep
        snapped = math.clamp(snapped, min, max)

        value:set(snapped)
        onChange(snapped)
    end

    local percentage = Computed(function()
        return (value:get() - min) / range
    end)

    return New("Frame")({
        Name = "SliderContainer",
        BackgroundTransparency = 1,
        Size = UDim2.new(1, 0, 0, 20),

        [Children] = {
            -- Track
            New("TextButton")({
                Name = "Track",
                BackgroundColor3 = COLORS.SliderTrack,
                AnchorPoint = Vector2.new(0, 0.5),
                Position = UDim2.new(0, 0, 0.5, 0),
                Size = UDim2.new(1, -40, 0, 6),
                AutoButtonColor = false,
                Text = "",

                [Fusion.Ref] = sliderRef,

                [OnEvent("InputBegan")] = function(input)
                    if input.UserInputType == Enum.UserInputType.MouseButton1
                        or input.UserInputType == Enum.UserInputType.Touch then
                        isDragging:set(true)
                        updateFromInput(input.Position.X)
                    end
                end,

                [Children] = {
                    New("UICorner")({ CornerRadius = UDim.new(1, 0) }),

                    -- Fill
                    New("Frame")({
                        Name = "Fill",
                        BackgroundColor3 = COLORS.SliderFill,
                        Size = Spring(Computed(function()
                            return UDim2.new(percentage:get(), 0, 1, 0)
                        end), 30),
                        [Children] = { New("UICorner")({ CornerRadius = UDim.new(1, 0) }) },
                    }),

                    -- Handle
                    New("Frame")({
                        Name = "Handle",
                        AnchorPoint = Vector2.new(0.5, 0.5),
                        Position = Spring(Computed(function()
                            return UDim2.new(percentage:get(), 0, 0.5, 0)
                        end), 30),
                        Size = UDim2.fromOffset(14, 14),
                        BackgroundColor3 = COLORS.Text,
                        ZIndex = 2,
                        [Children] = { New("UICorner")({ CornerRadius = UDim.new(1, 0) }) },
                    }),
                },
            }),

            -- Value label
            New("TextLabel")({
                Name = "ValueLabel",
                BackgroundTransparency = 1,
                AnchorPoint = Vector2.new(1, 0.5),
                Position = UDim2.new(1, 0, 0.5, 0),
                Size = UDim2.fromOffset(36, 16),
                FontFace = FONT.Small,
                Text = Computed(function()
                    local v = value:get()
                    return if v == math.floor(v) then tostring(math.floor(v)) else string.format("%.1f", v)
                end),
                TextColor3 = COLORS.TextSecondary,
                TextSize = 12,
                TextXAlignment = Enum.TextXAlignment.Right,
            }),
        },
    })
end

--------------------------------------------------------------------------------
-- Dropdown component
--------------------------------------------------------------------------------

local function SettingsDropdown(
    selected: Fusion.Value<string>,
    options: { string },
    onChange: (newValue: string) -> ()
)
    local isOpen = Value(false)
    local isHovering = Value(false)

    return New("Frame")({
        Name = "DropdownContainer",
        BackgroundTransparency = 1,
        Size = UDim2.new(0, 140, 0, 26),
        ClipsDescendants = false,

        [Children] = {
            -- Trigger button
            New("TextButton")({
                Name = "Trigger",
                BackgroundColor3 = COLORS.SurfaceAlt,
                Size = UDim2.new(1, 0, 0, 26),
                AutoButtonColor = false,
                Text = "",
                [OnEvent("Activated")] = function()
                    isOpen:set(not isOpen:get())
                end,
                [Children] = {
                    New("UICorner")({ CornerRadius = UDim.new(0, 4) }),
                    New("UIPadding")({
                        PaddingLeft = UDim.new(0, 8),
                        PaddingRight = UDim.new(0, 8),
                    }),
                    New("TextLabel")({
                        BackgroundTransparency = 1,
                        Size = UDim2.new(1, -16, 1, 0),
                        FontFace = FONT.Small,
                        Text = selected,
                        TextColor3 = COLORS.Text,
                        TextSize = 12,
                        TextXAlignment = Enum.TextXAlignment.Left,
                    }),
                    -- Chevron
                    New("TextLabel")({
                        BackgroundTransparency = 1,
                        AnchorPoint = Vector2.new(1, 0.5),
                        Position = UDim2.new(1, 0, 0.5, 0),
                        Size = UDim2.fromOffset(12, 12),
                        FontFace = FONT.Small,
                        Text = "▼",
                        TextColor3 = COLORS.TextMuted,
                        TextSize = 8,
                    }),
                },
            }),

            -- Options list
            New("Frame")({
                Name = "OptionsList",
                BackgroundColor3 = COLORS.SurfaceAlt,
                Position = UDim2.new(0, 0, 1, 4),
                Size = UDim2.new(1, 0, 0, #options * 24 + 4),
                Visible = isOpen,
                ZIndex = 50,
                ClipsDescendants = true,
                [Children] = {
                    New("UICorner")({ CornerRadius = UDim.new(0, 4) }),
                    New("UIPadding")({ PaddingTop = UDim.new(0, 2), PaddingBottom = UDim.new(0, 2) }),
                    New("UIListLayout")({
                        FillDirection = Enum.FillDirection.Vertical,
                        Padding = UDim.new(0, 0),
                        SortOrder = Enum.SortOrder.LayoutOrder,
                    }),

                    ForPairs(options, function(i, option)
                        return i, New("TextButton")({
                            Name = "Option_" .. option,
                            BackgroundColor3 = COLORS.SurfaceAlt,
                            BackgroundTransparency = 0,
                            Size = UDim2.new(1, 0, 0, 24),
                            AutoButtonColor = false,
                            FontFace = FONT.Small,
                            Text = option,
                            TextColor3 = Computed(function()
                                return if selected:get() == option then COLORS.Primary else COLORS.Text
                            end),
                            TextSize = 12,
                            LayoutOrder = i,
                            [OnEvent("Activated")] = function()
                                selected:set(option)
                                onChange(option)
                                isOpen:set(false)
                            end,
                        })
                    end, Fusion.cleanup),
                },
            }),
        },
    })
end

--------------------------------------------------------------------------------
-- Setting Row (renders one setting entry)
--------------------------------------------------------------------------------

local function SettingRow(entry: SettingEntry, values: { [string]: Fusion.Value<SettingValue> }, onChanged: (string, SettingValue) -> ())
    local valueState = values[entry.Key]

    local control
    if entry.Type == "slider" then
        control = SettingsSlider(valueState :: Fusion.Value<number>, entry.Min, entry.Max, entry.Step, function(v)
            onChanged(entry.Key, v)
        end)
    elseif entry.Type == "toggle" then
        control = ToggleSwitch(valueState :: Fusion.Value<boolean>, function(v)
            onChanged(entry.Key, v)
        end)
    elseif entry.Type == "dropdown" then
        control = SettingsDropdown(valueState :: Fusion.Value<string>, entry.Options, function(v)
            onChanged(entry.Key, v)
        end)
    end

    return New("Frame")({
        Name = "Row_" .. entry.Key,
        BackgroundTransparency = 1,
        Size = UDim2.new(1, 0, 0, 32),

        [Children] = {
            -- Label on left
            New("TextLabel")({
                BackgroundTransparency = 1,
                Size = UDim2.new(0.5, -8, 1, 0),
                FontFace = FONT.Body,
                Text = entry.Label,
                TextColor3 = COLORS.Text,
                TextSize = 13,
                TextXAlignment = Enum.TextXAlignment.Left,
            }),

            -- Control on right
            New("Frame")({
                BackgroundTransparency = 1,
                AnchorPoint = Vector2.new(1, 0.5),
                Position = UDim2.new(1, 0, 0.5, 0),
                Size = UDim2.new(0.5, -8, 0, 26),
                [Children] = {
                    New("UIListLayout")({
                        FillDirection = Enum.FillDirection.Horizontal,
                        HorizontalAlignment = Enum.HorizontalAlignment.Right,
                        VerticalAlignment = Enum.VerticalAlignment.Center,
                    }),
                    control,
                },
            }),
        },
    })
end

--------------------------------------------------------------------------------
-- Settings Screen (main export)
--------------------------------------------------------------------------------

local function SettingsScreen(props: SettingsProps)
    local activeTab = Value(1) -- index into props.Tabs

    return New("ScreenGui")({
        Name = "SettingsScreen",
        ResetOnSpawn = false,
        IgnoreGuiInset = true,
        Enabled = props.Visible,
        DisplayOrder = 20,
        Parent = Players.LocalPlayer:WaitForChild("PlayerGui"),

        [Children] = {
            -- Backdrop
            New("TextButton")({
                Name = "Backdrop",
                BackgroundColor3 = Color3.fromRGB(0, 0, 0),
                BackgroundTransparency = Spring(Computed(function()
                    return if props.Visible:get() then 0.5 else 1
                end), 20),
                Size = UDim2.new(1, 0, 1, 0),
                AutoButtonColor = false,
                Text = "",
                [OnEvent("Activated")] = props.OnClose,
            }),

            -- Settings panel (centered card)
            New("Frame")({
                Name = "SettingsPanel",
                AnchorPoint = Vector2.new(0.5, 0.5),
                Position = UDim2.fromScale(0.5, 0.5),
                Size = UDim2.new(0.85, 0, 0.7, 0),
                BackgroundColor3 = COLORS.Background,

                [Children] = {
                    New("UICorner")({ CornerRadius = UDim.new(0, 12) }),
                    New("UISizeConstraint")({
                        MinSize = Vector2.new(300, 250),
                        MaxSize = Vector2.new(500, 450),
                    }),
                    New("UIPadding")({
                        PaddingTop = UDim.new(0, 16),
                        PaddingBottom = UDim.new(0, 16),
                        PaddingLeft = UDim.new(0, 16),
                        PaddingRight = UDim.new(0, 16),
                    }),
                    New("UIListLayout")({
                        FillDirection = Enum.FillDirection.Vertical,
                        Padding = UDim.new(0, 12),
                        SortOrder = Enum.SortOrder.LayoutOrder,
                    }),

                    -- Header
                    New("Frame")({
                        BackgroundTransparency = 1,
                        Size = UDim2.new(1, 0, 0, 24),
                        LayoutOrder = 1,
                        [Children] = {
                            New("TextLabel")({
                                BackgroundTransparency = 1,
                                Size = UDim2.new(1, -30, 1, 0),
                                FontFace = FONT.Title,
                                Text = "Settings",
                                TextColor3 = COLORS.Text,
                                TextSize = 18,
                                TextXAlignment = Enum.TextXAlignment.Left,
                            }),
                            -- Close button
                            New("TextButton")({
                                AnchorPoint = Vector2.new(1, 0),
                                Position = UDim2.fromScale(1, 0),
                                Size = UDim2.fromOffset(24, 24),
                                BackgroundTransparency = 1,
                                FontFace = FONT.Title,
                                Text = "✕",
                                TextColor3 = COLORS.TextSecondary,
                                TextSize = 16,
                                AutoButtonColor = false,
                                [OnEvent("Activated")] = props.OnClose,
                            }),
                        },
                    }),

                    -- Tab bar
                    New("Frame")({
                        Name = "TabBar",
                        BackgroundTransparency = 1,
                        Size = UDim2.new(1, 0, 0, 28),
                        LayoutOrder = 2,
                        [Children] = {
                            New("UIListLayout")({
                                FillDirection = Enum.FillDirection.Horizontal,
                                Padding = UDim.new(0, 4),
                                VerticalAlignment = Enum.VerticalAlignment.Center,
                            }),

                            ForPairs(props.Tabs, function(i, tab)
                                local isActive = Computed(function()
                                    return activeTab:get() == i
                                end)

                                return i, New("TextButton")({
                                    Name = "Tab_" .. tab.Name,
                                    BackgroundColor3 = Spring(Computed(function()
                                        return if isActive:get() then COLORS.TabActive else COLORS.TabInactive
                                    end), 25),
                                    Size = UDim2.new(0, 70, 0, 26),
                                    AutoButtonColor = false,
                                    FontFace = FONT.Body,
                                    Text = tab.Name,
                                    TextColor3 = Computed(function()
                                        return if isActive:get() then COLORS.Text else COLORS.TextSecondary
                                    end),
                                    TextSize = 11,
                                    LayoutOrder = i,
                                    [OnEvent("Activated")] = function()
                                        activeTab:set(i)
                                    end,
                                    [Children] = { New("UICorner")({ CornerRadius = UDim.new(0, 4) }) },
                                })
                            end, Fusion.cleanup),
                        },
                    }),

                    -- Settings content (scrollable)
                    New("ScrollingFrame")({
                        Name = "SettingsContent",
                        BackgroundTransparency = 1,
                        Size = UDim2.new(1, 0, 1, -76),
                        LayoutOrder = 3,
                        AutomaticCanvasSize = Enum.AutomaticSize.Y,
                        ScrollingDirection = Enum.ScrollingDirection.Y,
                        ScrollBarThickness = 3,
                        ScrollBarImageColor3 = COLORS.TextMuted,
                        CanvasSize = UDim2.new(0, 0, 0, 0),

                        [Children] = {
                            New("UIListLayout")({
                                FillDirection = Enum.FillDirection.Vertical,
                                Padding = UDim.new(0, 8),
                                SortOrder = Enum.SortOrder.LayoutOrder,
                            }),
                            New("UIPadding")({ PaddingTop = UDim.new(0, 4), PaddingBottom = UDim.new(0, 4) }),

                            -- Render settings for active tab
                            Computed(function()
                                local tabIndex = activeTab:get()
                                local tab = props.Tabs[tabIndex]
                                if not tab then return {} end

                                local rows = {}
                                for i, entry in tab.Settings do
                                    rows[i] = SettingRow(entry, props.Values, props.OnSettingChanged)
                                end
                                return rows
                            end),
                        },
                    }),
                },
            }),
        },
    })
end

return SettingsScreen
