// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
    // server and online
    loginUser: (loginObject: { email: string; name: string; pass: string }) =>
        ipcRenderer.send('login-user', loginObject),
    logOut: () => ipcRenderer.send('log-out'),
    getLoggedInUser: (uid: string) => ipcRenderer.send('check-logged-in', uid),
    sendMessage: (text: string) => ipcRenderer.send('sendMessage', text),
    sendRoomMessage: (text: string) => ipcRenderer.send('roomMessage', text),
    addUserToRoom: (user: any) => ipcRenderer.send('addUserToRoom', user),
    removeUserFromRoom: (user: any) => ipcRenderer.send('removeUserFromRoom', user),
    addUserGroupToRoom: (users: [any]) => ipcRenderer.send('addUserGroupToRoom', users),
    handShake: (type: string) => ipcRenderer.send('hand-shake-users', type),
    sendDataChannel: (data: string) => ipcRenderer.send('send-data-channel', data),
    updateStun: (data) => ipcRenderer.send('updateStun', data),
    // sends text to the emulator using the fbneo_commands.txt
    setEmulatorPath: () => ipcRenderer.send('setEmulatorPath'),
    sendText: (text: string) => ipcRenderer.send('send-text', text),
    sendCommand: (command: string) => ipcRenderer.send('send-command', command),
    serveMatch: (ip: string, port: number, player: number, delay: number, myPort: number) =>
        ipcRenderer.send('startOnlineMatch', { ip, port, player, delay, myPort }),
    startSoloTraining: () => ipcRenderer.send('start-solo-mode'),
    // ipc call stuff
    on: (channel, callback) => {
        ipcRenderer.on(channel, (event, ...args) => callback(...args))
    },
    removeListener: (channel, callback) => {
        ipcRenderer.removeListener(channel, callback)
    },
    removeAllListeners: (channel, callback) => {
        ipcRenderer.removeAllListeners(channel, callback)
    },
    removeExtraListeners: (channel, callback) => {
        console.log(
            'we have this many listeners on ',
            channel,
            ipcRenderer.rawListeners(channel).length
        )
        ipcRenderer.rawListeners(channel).forEach((listener, index) => {
            console.log(listener)
            if (ipcRenderer.rawListeners(channel).length > 1) {
                // we need to make sure we always keep alive our first index here, its the one we use in renderer.ts
                if (index === 0) return
                return ipcRenderer.removeListener(channel, listener)
            }
            return console.log('saving last listener')
        })
    },
})

// // testing sending messages from ipc main to ipcrenderer
// ipcRenderer.on('message-from-main', (event, message) => {
//     console.log('Received:', message);
// });

ipcRenderer.on('stats-from-main', (event, message) => {
    console.log('Stats to update the UI with:', message)
})
