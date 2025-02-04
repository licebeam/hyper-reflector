-- BEFORE BUILDING COPY THIS FILE TO lua/3rd_training_lua/ in order for the scripts to use the same root directories.
local third_training = require("3rd_training")
local util_draw = require("src/utils/draw");
local util_colors = require("src/utils/colors")
require("src/tools") -- TODO: refactor tools to export;
local command_file = "../../hyper_write_commands.txt"
local ext_command_file = "../../hyper_read_commands.txt" -- this is for sending back commands to electron.

local game_name = ""

function check_commands()
    local file = io.open(command_file, "r")
    if file then
        local command = file:read("*l") -- Read first line
        file:close()

        if command == "game_name" then
            local value = emu.romname()
            memory.writebyte(0x02011388, 1)
            -- read from the current lua file and make a return an answer to fbneo_commands_commands.txt maybe better to have another file for commands sent to electron.
            local file2 = io.open(ext_command_file, "w")
            if file2 then
                file2:write(value)
                file2:close()
            end
            print('The game is: ', value)
        elseif command == "resume" then
            local value = emu.sourcename()
            -- read from the current lua file and make a return an answer to fbneo_commands_commands.txt maybe better to have another file for commands sent to electron.
            local file2 = io.open(ext_command_file, "w")
            if file2 then
                file2:write(value)
                file2:close()
            end
        elseif command and string.find(command, "textinput:") then
            game_name = string.sub(command, 11) -- cut the first 11 characters from string
            -- read from the current lua file and make a return an answer to fbneo_commands_commands.txt maybe better to have another file for commands sent to electron.
            local file2 = io.open(ext_command_file, "w")
            if file2 then
                file2:write('we wrote to game')
                file2:close()
            end
        elseif command == "exit" then
            os.exit()
        end
        -- Clear the file after each input.
        -- io.open(command_file, "w"):close()
    end
end

-- hyper-reflector commands -- this is actually global state
GLOBAL_isHyperReflectorOnline = true

emu.registerbefore(check_commands) -- Runs after each frame
-- gui.register(on_gui)

-- registers for 3rd training
-- emu.registerstart(third_training.on_start())

-- UNCOMMENT below lines  for training mode online
-- emu.registerbefore(third_training.before_frame)
-- gui.register(third_training.on_gui)
-- pressing start should not pause the emulator this is not good =0
