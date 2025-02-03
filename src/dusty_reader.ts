import { app } from 'electron';
const fs = require("fs");
const path = require("path");

const isDev = !app.isPackaged;

let filePathBase = process.resourcesPath;
//handle dev mode toggle for file paths.
if (isDev) {
    filePathBase = app.getAppPath()
}

export function sendCommand(command: string = "dummy") {
    try {
        const filePath = path.join(filePathBase, 'fbneo_commands.txt');
        console.log('writing to: ', filePath)
        fs.writeFileSync(filePath, command, { encoding: 'utf8' });
        console.log(`Command written: ${command}`);
    } catch (error) {
        console.error("Failed to write file:", error);
    }
}

export function readCommand() {
    try {
        const filePath = path.join(filePathBase, 'reflector_commands.txt');
        // console.log('read from: ', filePath)
        const data = fs.readFileSync(filePath, { encoding: 'utf8' });
        console.log('file read ', data);
    } catch (error) {
        console.error("Failed to read file:", error);
    }
}