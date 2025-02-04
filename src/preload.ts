// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
    // sends text to the emulator using the fbneo_commands.txt
    setEmulatorPath: () => ipcRenderer.send('setEmulatorPath'),
    sendText: (text: string) => ipcRenderer.send("send-text", text),
    sendCommand: (command: string) => ipcRenderer.send("send-command", command),
    serveMatch: (ip: string, port: number) => ipcRenderer.send('startP1', { ip, port }),
    connectMatch: (ip: string, port: number) => ipcRenderer.send('startP2', { ip, port }),
    startSoloTraining: () => ipcRenderer.send("start-solo-mode"),
});

// testing sending messages from ipc main to ipcrenderer
ipcRenderer.on('message-from-main', (event, message) => {
    console.log('Received:', message);
});

ipcRenderer.on('stats-from-main', (event, message) => {
    console.log('Stats to update the UI with:', message);
});