// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
    // sends text to the emulator using the fbneo_commands.txt
    sendText: (text: string) => ipcRenderer.send("send-text", text),
    sendCommand: (command: string) => ipcRenderer.send("send-command", command),
    serveMatch: (ip: string, port: number) => ipcRenderer.send('startP1', { ip, port }),
    connectMatch: (ip: string, port: number) => ipcRenderer.send('startP2', { ip, port }),
    startSoloTraining: () => ipcRenderer.send("start-solo-mode"),
});