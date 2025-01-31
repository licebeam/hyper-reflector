local command_file = "fbneo_commands.txt"

function check_commands()
    local file = io.open(command_file, "r")
    if file then
        local command = file:read("*l")  -- Read first line
        file:close()

        if command == "width" then
            local value = emu.romname()
            print('The game is: ', value)
        elseif command == "resume" then
            print('un-pausing')
            emu.unpause()
        elseif command == "exit" then
            os.exit()
        end
        -- Clear the file after each input.
        io.open(command_file,"w"):close()
    end
end

emu.registerafter(check_commands) -- Runs after each frame