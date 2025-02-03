import { app } from 'electron';
const fs = require("fs");
const path = require("path");


export function sendCommand(command: string = "dummy") {
    try {
        const filePath = path.join(path.join(app.getAppPath(), 'src/fbneo_commands.txt'));
        console.log('writing to: ', filePath)
        fs.writeFileSync(filePath, command, { encoding: 'utf8' });
        console.log(`Command written: ${command}`);
    } catch (error) {
        console.error("Failed to write file:", error);
    }
}

export function readCommand() {
    try {
        const filePath = path.join(path.join(app.getAppPath(), 'src/reflector_commands.txt'));
        // console.log('read from: ', filePath)
        const data = fs.readFileSync(filePath, { encoding: 'utf8' });
        console.log('file read ', data);
    } catch (error) {
        console.error("Failed to read file:", error);
    }
}