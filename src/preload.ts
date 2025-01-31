// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
    sendCommand: (command: string) => ipcRenderer.send("send-command", command),
    openGGPO: () => ipcRenderer.send("open-ggpo"),
    hitApi: () => ipcRenderer.send('hit-api'),
    serveMatch: () => ipcRenderer.send('serve-api'),
    connectMatch: () => ipcRenderer.send('connect-api'),
});