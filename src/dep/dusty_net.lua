local socket = require("luasocket/socket")
local server = assert(socket.bind("localhost", 12345))
local client = server:accept()

print("loading sockets")
while true do
    local command = client:receive()
    if command == "pause" then
        emu.pause()
    elseif command == "resume" then
        emu.unpause()
    end
end