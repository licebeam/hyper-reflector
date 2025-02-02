-- @util colors
-- This maintains all colors used for drawing on screen
local gui = {empty = 0x00000000, white = 0xFFFFFFFF}

local hitbox = {
    default = 0x0000FFFF,
    attack = 0xFF0000FF,
    throwable = 0x00FF00FF,
    throw = 0xFFFF00FF,
    push = 0xFF00FFFF,
    vulnerability = 0x00FFFFFF -- what is this??
}

local input_history = {unknown1 = 0xd6e3efff, unknown2 = 0x101000ff}
return {gui = gui, hitbox = hitbox, input_history = input_history}
