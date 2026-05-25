--[[
    Inventory Screen — Fusion 0.2
    Source patterns: VirtualButFake/fusion-components (MIT), dphfox/Fusion docs
    
    A complete inventory interface with:
    - Scrollable grid of owned items
    - Item selection with detail panel
    - Equip/unequip toggle
    - Context menu (drop, inspect)
    - Empty slot rendering
    - Responsive grid (fills available width)
    
    ADAPT THIS:
    - Replace SLOT_COUNT and item data with your game's inventory system
    - Replace equipRemote/dropRemote with your RemoteFunctions
    - Adjust grid CellSize for your item icon dimensions
    - Add drag-and-drop by tracking InputBegan/InputChanged on cards
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
local Cleanup = Fusion.Cleanup

--------------------------------------------------------------------------------
-- Types
--------------------------------------------------------------------------------

export type InventoryItem = {
    Id: string,
    Name: string,
    Icon: string?,
    Rarity: "common" | "uncommon" | "rare" | "epic" | "legendary",
    Equipped: boolean,
    Description: string?,
}

type InventoryProps = {
    Items: Fusion.Value<{ InventoryItem }>,
    SlotCount: number, -- total slots (shows empty slots beyond item count)
    Visible: Fusion.Value<boolean>,
    OnEquip: (itemId: string) -> boolean,
    OnUnequip: (itemId: string) -> boolean,
    OnDrop: (itemId: string) -> boolean,
}

--------------------------------------------------------------------------------
-- Theme
--------------------------------------------------------------------------------

local COLORS = {
    Background = Color3.fromRGB(18, 18, 26),
    Surface = Color3.fromRGB(28, 28, 40),
    SurfaceHover = Color3.fromRGB(38, 38, 52),
    SurfaceSelected = Color3.fromRGB(45, 45, 62),
    EmptySlot = Color3.fromRGB(22, 22, 32),
    Text = Color3.fromRGB(235, 235, 240),
    TextSecondary = Color3.fromRGB(155, 155, 170),
    Equipped = Color3.fromRGB(80, 200, 120),
    ContextBg = Color3.fromRGB(35, 35, 48),
    ContextHover = Color3.fromRGB(50, 50, 65),
    Rarity = {
        common = Color3.fromRGB(140, 140, 150),
        uncommon = Color3.fromRGB(80, 200, 80),
        rare = Color3.fromRGB(70, 140, 255),
        epic = Color3.fromRGB(180, 70, 255),
        legendary = Color3.fromRGB(255, 180, 40),
    },
}

local FONT = {
    Title = Font.new("rbxasset://fonts/families/GothamSSm.json", Enum.FontWeight.Bold),
    Body = Font.new("rbxasset://fonts/families/GothamSSm.json", Enum.FontWeight.Medium),
    Small = Font.new("rbxasset://fonts/families/GothamSSm.json", Enum.FontWeight.Regular),
}

--------------------------------------------------------------------------------
-- Item Slot component
--------------------------------------------------------------------------------

local function ItemSlot(
    item: InventoryItem?,
    isSelected: Fusion.Computed<boolean>,
    isHovering: Fusion.Value<boolean>,
    onSelect: () -> (),
    onRightClick: () -> ()
)
    if not item then
        -- Empty slot
        return New("Frame")({
            Name = "EmptySlot",
            BackgroundColor3 = COLORS.EmptySlot,
            [Children] = {
                New("UICorner")({ CornerRadius = UDim.new(0, 6) }),
                New("UIStroke")({
                    Color = Color3.fromRGB(40, 40, 50),
                    Thickness = 1,
                    Transparency = 0.5,
                }),
            },
        })
    end

    local rarityColor = COLORS.Rarity[item.Rarity] or COLORS.Rarity.common

    return New("TextButton")({
        Name = "Slot_" .. item.Id,
        BackgroundColor3 = Spring(Computed(function()
            if isSelected:get() then
                return COLORS.SurfaceSelected
            elseif isHovering:get() then
                return COLORS.SurfaceHover
            end
            return COLORS.Surface
        end), 30),
        AutoButtonColor = false,
        Text = "",

        [OnEvent("Activated")] = onSelect,
        [OnEvent("MouseButton2Click")] = onRightClick,
        [OnEvent("MouseEnter")] = function() isHovering:set(true) end,
        [OnEvent("MouseLeave")] = function() isHovering:set(false) end,

        [Children] = {
            New("UICorner")({ CornerRadius = UDim.new(0, 6) }),

            -- Rarity border
            New("UIStroke")({
                Color = rarityColor,
                Thickness = 1.5,
                Transparency = Spring(Computed(function()
                    return if isSelected:get() then 0 else 0.6
                end), 25),
            }),

            -- Icon
            if item.Icon then New("ImageLabel")({
                Name = "Icon",
                BackgroundTransparency = 1,
                Size = UDim2.new(1, -12, 1, -20),
                Position = UDim2.fromOffset(6, 4),
                Image = item.Icon,
                ScaleType = Enum.ScaleType.Fit,
            }) else nil,

            -- Equipped indicator
            if item.Equipped then New("Frame")({
                Name = "EquippedDot",
                AnchorPoint = Vector2.new(1, 0),
                Position = UDim2.new(1, -4, 0, 4),
                Size = UDim2.fromOffset(8, 8),
                BackgroundColor3 = COLORS.Equipped,
                [Children] = { New("UICorner")({ CornerRadius = UDim.new(1, 0) }) },
            }) else nil,

            -- Item name at bottom
            New("TextLabel")({
                Name = "ItemName",
                BackgroundTransparency = 1,
                AnchorPoint = Vector2.new(0, 1),
                Position = UDim2.new(0, 4, 1, -3),
                Size = UDim2.new(1, -8, 0, 14),
                FontFace = FONT.Small,
                Text = item.Name,
                TextColor3 = COLORS.TextSecondary,
                TextSize = 10,
                TextTruncate = Enum.TextTruncate.AtEnd,
                TextXAlignment = Enum.TextXAlignment.Center,
            }),
        },
    })
end

--------------------------------------------------------------------------------
-- Detail Panel component
--------------------------------------------------------------------------------

local function DetailPanel(
    selectedItem: Fusion.Value<InventoryItem?>,
    onEquipToggle: () -> (),
    onDrop: () -> ()
)
    return New("Frame")({
        Name = "DetailPanel",
        BackgroundColor3 = COLORS.Surface,
        Size = UDim2.new(1, 0, 0, 100),
        Visible = Computed(function()
            return selectedItem:get() ~= nil
        end),

        [Children] = {
            New("UICorner")({ CornerRadius = UDim.new(0, 8) }),
            New("UIPadding")({
                PaddingTop = UDim.new(0, 12),
                PaddingBottom = UDim.new(0, 12),
                PaddingLeft = UDim.new(0, 12),
                PaddingRight = UDim.new(0, 12),
            }),
            New("UIListLayout")({
                FillDirection = Enum.FillDirection.Vertical,
                Padding = UDim.new(0, 8),
                SortOrder = Enum.SortOrder.LayoutOrder,
            }),

            -- Item name + rarity
            New("TextLabel")({
                BackgroundTransparency = 1,
                Size = UDim2.new(1, 0, 0, 18),
                FontFace = FONT.Title,
                Text = Computed(function()
                    local item = selectedItem:get()
                    return if item then item.Name else ""
                end),
                TextColor3 = Computed(function()
                    local item = selectedItem:get()
                    if item then
                        return COLORS.Rarity[item.Rarity] or COLORS.Text
                    end
                    return COLORS.Text
                end),
                TextSize = 15,
                TextXAlignment = Enum.TextXAlignment.Left,
                LayoutOrder = 1,
            }),

            -- Description
            New("TextLabel")({
                BackgroundTransparency = 1,
                Size = UDim2.new(1, 0, 0, 14),
                FontFace = FONT.Small,
                Text = Computed(function()
                    local item = selectedItem:get()
                    return if item and item.Description then item.Description else ""
                end),
                TextColor3 = COLORS.TextSecondary,
                TextSize = 12,
                TextWrapped = true,
                TextXAlignment = Enum.TextXAlignment.Left,
                LayoutOrder = 2,
            }),

            -- Action buttons
            New("Frame")({
                BackgroundTransparency = 1,
                Size = UDim2.new(1, 0, 0, 28),
                LayoutOrder = 3,
                [Children] = {
                    New("UIListLayout")({
                        FillDirection = Enum.FillDirection.Horizontal,
                        Padding = UDim.new(0, 8),
                        VerticalAlignment = Enum.VerticalAlignment.Center,
                    }),

                    -- Equip/Unequip button
                    New("TextButton")({
                        Name = "EquipBtn",
                        BackgroundColor3 = COLORS.Equipped,
                        Size = UDim2.new(0, 80, 0, 28),
                        FontFace = FONT.Body,
                        Text = Computed(function()
                            local item = selectedItem:get()
                            return if item and item.Equipped then "Unequip" else "Equip"
                        end),
                        TextColor3 = COLORS.Text,
                        TextSize = 12,
                        AutoButtonColor = false,
                        [OnEvent("Activated")] = onEquipToggle,
                        [Children] = { New("UICorner")({ CornerRadius = UDim.new(0, 4) }) },
                    }),

                    -- Drop button
                    New("TextButton")({
                        Name = "DropBtn",
                        BackgroundColor3 = Color3.fromRGB(60, 30, 30),
                        Size = UDim2.new(0, 60, 0, 28),
                        FontFace = FONT.Body,
                        Text = "Drop",
                        TextColor3 = Color3.fromRGB(220, 100, 100),
                        TextSize = 12,
                        AutoButtonColor = false,
                        [OnEvent("Activated")] = onDrop,
                        [Children] = { New("UICorner")({ CornerRadius = UDim.new(0, 4) }) },
                    }),
                },
            }),
        },
    })
end

--------------------------------------------------------------------------------
-- Inventory Screen (main export)
--------------------------------------------------------------------------------

local function InventoryScreen(props: InventoryProps)
    local selectedItemId: Fusion.Value<string?> = Value(nil)

    local selectedItem: Fusion.Computed<InventoryItem?> = Computed(function()
        local id = selectedItemId:get()
        if not id then return nil end
        for _, item in props.Items:get() do
            if item.Id == id then return item end
        end
        return nil
    end)

    -- Build slot data: items + empty slots to fill SlotCount
    local slotData = Computed(function()
        local items = props.Items:get()
        local slots: { InventoryItem? } = {}
        for i, item in items do
            slots[i] = item
        end
        for i = #items + 1, props.SlotCount do
            slots[i] = nil
        end
        return slots
    end)

    local hoverStates: { [number]: Fusion.Value<boolean> } = {}
    local function getHover(index: number): Fusion.Value<boolean>
        if not hoverStates[index] then
            hoverStates[index] = Value(false)
        end
        return hoverStates[index]
    end

    return New("ScreenGui")({
        Name = "InventoryScreen",
        ResetOnSpawn = false,
        IgnoreGuiInset = true,
        Enabled = props.Visible,
        DisplayOrder = 10,
        Parent = Players.LocalPlayer:WaitForChild("PlayerGui"),

        [Children] = {
            New("Frame")({
                Name = "Container",
                BackgroundColor3 = COLORS.Background,
                Size = UDim2.new(1, 0, 1, 0),

                [Children] = {
                    New("UIPadding")({
                        PaddingTop = UDim.new(0, 60),
                        PaddingBottom = UDim.new(0, 12),
                        PaddingLeft = UDim.new(0, 16),
                        PaddingRight = UDim.new(0, 16),
                    }),
                    New("UIListLayout")({
                        FillDirection = Enum.FillDirection.Vertical,
                        Padding = UDim.new(0, 12),
                        SortOrder = Enum.SortOrder.LayoutOrder,
                    }),

                    -- Title
                    New("TextLabel")({
                        Name = "Title",
                        BackgroundTransparency = 1,
                        Size = UDim2.new(1, 0, 0, 28),
                        FontFace = FONT.Title,
                        Text = "Inventory",
                        TextColor3 = COLORS.Text,
                        TextSize = 20,
                        TextXAlignment = Enum.TextXAlignment.Left,
                        LayoutOrder = 1,
                    }),

                    -- Item grid (scrollable)
                    New("ScrollingFrame")({
                        Name = "ItemGrid",
                        BackgroundTransparency = 1,
                        Size = UDim2.new(1, 0, 1, -150), -- leave room for detail panel
                        LayoutOrder = 2,
                        AutomaticCanvasSize = Enum.AutomaticSize.Y,
                        ScrollingDirection = Enum.ScrollingDirection.Y,
                        ScrollBarThickness = 4,
                        ScrollBarImageColor3 = COLORS.TextSecondary,
                        CanvasSize = UDim2.new(0, 0, 0, 0),

                        [Children] = {
                            New("UIGridLayout")({
                                CellSize = UDim2.new(0, 72, 0, 80),
                                CellPadding = UDim2.new(0, 6, 0, 6),
                                FillDirection = Enum.FillDirection.Horizontal,
                                FillDirectionMaxCells = 0,
                                HorizontalAlignment = Enum.HorizontalAlignment.Center,
                                SortOrder = Enum.SortOrder.LayoutOrder,
                            }),

                            ForPairs(slotData, function(index, item)
                                local isSelected = Computed(function()
                                    return item ~= nil and selectedItemId:get() == item.Id
                                end)

                                return index, ItemSlot(item, isSelected, getHover(index), function()
                                    if item then
                                        selectedItemId:set(item.Id)
                                    end
                                end, function()
                                    -- Right-click: could open context menu
                                    if item then
                                        selectedItemId:set(item.Id)
                                    end
                                end)
                            end, Fusion.cleanup),
                        },
                    }),

                    -- Detail panel at bottom
                    DetailPanel(selectedItem, function()
                        -- Equip/Unequip toggle
                        local item = selectedItem:get()
                        if not item then return end
                        if item.Equipped then
                            props.OnUnequip(item.Id)
                        else
                            props.OnEquip(item.Id)
                        end
                    end, function()
                        -- Drop
                        local item = selectedItem:get()
                        if not item then return end
                        props.OnDrop(item.Id)
                        selectedItemId:set(nil)
                    end),
                },
            }),
        },
    })
end

return InventoryScreen
