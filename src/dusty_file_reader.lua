local util_draw = require("lua/utils/draw");
local util_colors = require("lua/utils/colors")
local command_file = "fbneo_commands.txt"
local ext_command_file = "reflector_commands.txt" -- this is for sending back commands to electron.

local game_name = ""

function check_commands()
    local file = io.open(command_file, "r")
    if file then
        local command = file:read("*l") -- Read first line
        file:close()

        if command == "game_name" then
            local value = emu.romname()
            game_name = value
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

function on_gui()
    gui.text(100, 20, game_name, util_colors.gui.white, util_colors.input_history.unknown2)
end

emu.registerafter(check_commands) -- Runs after each frame
gui.register(on_gui)
