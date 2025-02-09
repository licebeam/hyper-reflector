// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
    // server and online
    loginUser: (loginObject: { name: string, pass: string }) => ipcRenderer.send('login-user', loginObject),
    logOut: () => ipcRenderer.send('log-out'),
    sendMessage: (text: string) => ipcRenderer.send("sendMessage", text),
    sendRoomMessage: (text: string) => ipcRenderer.send("roomMessage", text),
    // sends text to the emulator using the fbneo_commands.txt
    setEmulatorPath: () => ipcRenderer.send('setEmulatorPath'),
    sendText: (text: string) => ipcRenderer.send("send-text", text),
    sendCommand: (command: string) => ipcRenderer.send("send-command", command),
    serveMatch: (ip: string, port: number) => ipcRenderer.send('startP1', { ip, port }),
    connectMatch: (ip: string, port: number) => ipcRenderer.send('startP2', { ip, port }),
    startSoloTraining: () => ipcRenderer.send("start-solo-mode"),
    // ipc call stuff
    on: (channel, callback) => {
        ipcRenderer.on(channel, (event, ...args) => callback(...args));
    },
    removeListener: (channel, callback) => {
        ipcRenderer.removeListener(channel, callback);
    },
    removeAllListeners: (channel, callback) => {
        ipcRenderer.removeAllListeners(channel, callback);
    },
    removeExtraListeners: (channel, callback) => {
        console.log(ipcRenderer.eventNames())
        console.log(ipcRenderer.rawListeners(channel))
        ipcRenderer.rawListeners(channel).forEach(listener => {
            console.log(listener)
            if (ipcRenderer.rawListeners(channel).length >= 1) {
                return ipcRenderer.removeListener(channel, listener);
            }
            return console.log('saving last listener')
        });
    },
});

// // testing sending messages from ipc main to ipcrenderer
// ipcRenderer.on('message-from-main', (event, message) => {
//     console.log('Received:', message);
// });

ipcRenderer.on('stats-from-main', (event, message) => {
    console.log('Stats to update the UI with:', message);
});