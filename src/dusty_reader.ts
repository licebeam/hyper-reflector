const fs = require("fs");
const path = require("path");


export default function sendCommand(command = 1234) {
    try {
        const filePath = "./src/fbneo_commands.txt";
        console.log('writing to: ', filePath)
        fs.writeFileSync(filePath, command, { encoding: 'utf8' });
        console.log(`Command written: ${command}`);
    } catch (error) {
        console.error("Failed to write file:", error);
    }
}