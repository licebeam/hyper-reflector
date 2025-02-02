-- @util draw
-- This draws things to the screem such as hitboxes in hitbox view mode etc.
local image_tables = require("lua/utils/image_tables")
local colors = require("lua/utils/colors")

local SCREEN_WIDTH = 383
local SCREEN_HEIGHT = 223
local GROUND_OFFSET = 23

local screen_x = 0
local screen_y = 0
local scale = 1

-- TODO: write better descriptions for the functions
local function draw_read()
    -- screen stuff
    screen_x = memory.readwordsigned(0x02026CB0)
    screen_y = memory.readwordsigned(0x02026CB4)
    scale = memory.readwordsigned(0x0200DCBA) -- FBA can't read from 04xxxxxx
    scale = 0x40 / (scale > 0 and scale or 1)
end

-- # Tools
local function game_to_screen_space_x(x) return x - screen_x + emu.screenwidth() / 2 end

local function game_to_screen_space_y(y) return emu.screenheight() - (y - screen_y) - GROUND_OFFSET end

local function game_to_screen_space(x, y) return game_to_screen_space_x(x), game_to_screen_space_y(y) end

local function get_text_width(text)
    if #text == 0 then return 0 end

    return #text * 4
end

-- # Draw functions
-- draws a set of hitboxes
local function draw_hitboxes(pos_x, pos_y, flip_x, boxes, filter, dilation)
    dilation = dilation or 0
    local px, py = game_to_screen_space(pos_x, pos_y)

    for __, box in ipairs(boxes) do
        if filter == nil or filter[box.type] == true then
            local c = colors.hitbox.default
            if (box.type == "attack") then
                c = colors.hitbox.attack
            elseif (box.type == "throwable") then
                c = colors.hitbox.throwable
            elseif (box.type == "throw") then
                c = colors.hitbox.throw
            elseif (box.type == "push") then
                c = colors.hitbox.push
            elseif (box.type == "ext. vulnerability") then
                c = colors.hitbox.vulnerability
            end

            local l, r
            if flip_x == 0 then
                l = px + box.left
            else
                l = px - box.left - box.width
            end
            local r = l + box.width
            local b = py - box.bottom
            local t = b - box.height

            l = l - dilation
            r = r + dilation
            b = b + dilation
            t = t - dilation

            gui.box(l, b, r, t, colors.gui.empty, c)
        end
    end
end

-- draws a point
local function draw_point(x, y, _color)
    local cross_half_size = 4
    local l = x - cross_half_size
    local r = x + cross_half_size
    local t = y - cross_half_size
    local b = y + cross_half_size

    gui.box(l, y, r, y, colors.gui.empty, _color)
    gui.box(x, t, x, b, colors.gui.empty, _color)
end

-- draws a controller representation
local function draw_controller_big(entry, x, y)
    gui.image(x, y, image_tables.img_dir_big[entry.direction])

    local img_LP = image_tables.img_button_big.img_no_button_big
    local img_MP = image_tables.img_button_big.img_no_button_big
    local img_HP = image_tables.img_button_big.img_no_button_big
    local img_LK = image_tables.img_button_big.img_no_button_big
    local img_MK = image_tables.img_button_big.img_no_button_big
    local img_HK = image_tables.img_button_big.img_no_button_big

    if entry.buttons[1] then img_LP = image_tables.img_button_big.img_L_button_big end
    if entry.buttons[2] then img_MP = image_tables.img_button_big.img_M_button_big end
    if entry.buttons[3] then img_HP = image_tables.img_button_big.img_H_button_big end
    if entry.buttons[4] then img_LK = image_tables.img_button_big.img_L_button_big end
    if entry.buttons[5] then img_MK = image_tables.img_button_big.img_M_button_big end
    if entry.buttons[6] then img_HK = image_tables.img_button_big.img_H_button_big end

    gui.image(x + 13, y, img_LP)
    gui.image(x + 18, y, img_MP)
    gui.image(x + 23, y, img_HP)
    gui.image(x + 13, y + 5, img_LK)
    gui.image(x + 18, y + 5, img_MK)
    gui.image(x + 23, y + 5, img_HK)
end

-- draws a controller representation
local function draw_controller_small(entry, x, y, is_right)
    local x_offset = 0
    local sign = 1
    if is_right then
        x_offset = x_offset - 9
        sign = -1
    end

    gui.image(x + x_offset, y, image_tables.img_dir_small[entry.direction])
    x_offset = x_offset + sign * 2

    local interval = 8
    x_offset = x_offset + sign * interval

    if entry.buttons[1] then
        gui.image(x + x_offset, y, image_tables.img_button_small.img_LP_button_small)
        x_offset = x_offset + sign * interval
    end

    if entry.buttons[2] then
        gui.image(x + x_offset, y, image_tables.img_button_small.img_MP_button_small)
        x_offset = x_offset + sign * interval
    end

    if entry.buttons[3] then
        gui.image(x + x_offset, y, image_tables.img_button_small.img_HP_button_small)
        x_offset = x_offset + sign * interval
    end

    if entry.buttons[4] then
        gui.image(x + x_offset, y, image_tables.img_button_small.img_LK_button_small)
        x_offset = x_offset + sign * interval
    end

    if entry.buttons[5] then
        gui.image(x + x_offset, y, image_tables.img_button_small.img_MK_button_small)
        x_offset = x_offset + sign * interval
    end

    if entry.buttons[6] then
        gui.image(x + x_offset, y, image_tables.img_button_small.img_HK_button_small)
        x_offset = x_offset + sign * interval
    end
end

-- draws a gauge
local function draw_gauge(x, y, width, height, fill_ratio, fill_color, bg_color, border_color, reverse_fill)
    bg_color = bg_color or colors.gui.empty
    border_color = border_color or colors.gui.white
    reverse_fill = reverse_fill or false

    width = width + 1
    height = height + 1

    gui.box(x, y, x + width, y + height, bg_color, border_color)
    if reverse_fill then
        gui.box(x + width, y, x + width - width * clamp01(fill_ratio), y + height, fill_color, colors.gui.empty)
    else
        gui.box(x, y, x + width * clamp01(fill_ratio), y + height, fill_color, colors.gui.empty)
    end
end

-- draws an horizontal line
local function draw_horizontal_line(x_start, x_end, y, color, thickness)
    thickness = thickness or 1.0
    local l = x_start - 1
    local b = y + math.ceil(thickness * 0.5)
    local r = x_end + 1
    local t = y - math.floor(thickness * 0.5) - 1
    gui.box(l, b, r, t, color, colors.gui.empty)
end

-- draws a vertical line
local function draw_vertical_line(x, y_start, y_end, color, thickness)
    thickness = thickness or 1.0
    local l = x - math.floor(thickness * 0.5) - 1
    local b = y_end + 1
    local r = x + math.ceil(thickness * 0.5)
    local t = y_start - 1
    gui.box(l, b, r, t, color, colors.gui.empty)
end

return {
    screen_width = SCREEN_WIDTH,
    screen_height = SCREEN_HEIGHT,
    ground_offset = GROUND_OFFSET,
    screen_x = screen_x,
    screen_y = screen_y,
    scale = scale,
    draw_read = draw_read,
    game_to_screen_space_x = game_to_screen_space_x,
    game_to_screen_space_y = game_to_screen_space_y,
    game_to_screen_space = game_to_screen_space,
    get_text_width = get_text_width,
    draw_hitboxes = draw_hitboxes,
    draw_point = draw_point,
    draw_controller_big = draw_controller_big,
    draw_controller_small = draw_controller_small,
    draw_gauge = draw_gauge,
    draw_horizontal_line = draw_horizontal_line,
    draw_vertical_line = draw_vertical_line
}
