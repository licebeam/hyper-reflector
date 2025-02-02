const fs = require("fs");
const path = require("path");


export function sendCommand(command: string = "dummy") {
    try {
        const filePath = "./src/fbneo_commands.txt";
        console.log('writing to: ', filePath)
        fs.writeFileSync(filePath, command, { encoding: 'utf8' });
        console.log(`Command written: ${command}`);
    } catch (error) {
        console.error("Failed to write file:", error);
    }
}

export function readCommand() {
    try {
        const filePath = "./src/reflector_commands.txt";
        // console.log('read from: ', filePath)
        const data = fs.readFileSync(filePath, { encoding: 'utf8' });
        console.log('file read ', data);
    } catch (error) {
        console.error("Failed to read file:", error);
    }
}