const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
    // websocket related
    sendIceCandidate: (data: { targetId: string; candidate: any; callerId: string }) =>
        ipcRenderer.send('iceCandidate', data),
    callUser: (data: { callerId: string; calleeId: string }) => ipcRenderer.send('callUser', data),
    answerCall: (data: { callerId: string; answer: any }) => ipcRenderer.send('answerCall', data),
    declineCall: (data: { callerId: string }) => ipcRenderer.send('declineCall', data),
    callDeclined: (data: { callerId: string }) => ipcRenderer.send('callDeclined', data),
    receivedCall: (data: { callerId: string; answer: any }) =>
        ipcRenderer.send('receivedCall', data),
    // server and online
    loginUser: (loginObject: { email: string; name: string; pass: string }) =>
        ipcRenderer.send('loginUser', loginObject),
    createAccount: (accountObject: { email: string; name: string; pass: string }) =>
        ipcRenderer.send('createAccount', accountObject),
    logOutUser: () => ipcRenderer.send('logOutUser'),
    getLoggedInUser: (uid: string) => ipcRenderer.send('getLoggedInUser', uid),
    // room related
    sendMessage: (messageObject: { text: string; user: any }) =>
        ipcRenderer.send('sendMessage', messageObject),
    sendAlert: (alertObject: { type: string; message: { title: string; description: string } }) =>
        ipcRenderer.send('sendMessage', alertObject),
    sendRoomMessage: (text: string) => ipcRenderer.send('sendRoomMessage', text),
    getChallengeQueue: (text: string) => ipcRenderer.send('getChallengeQueue', text),
    addUserToRoom: (user: any) => ipcRenderer.send('addUserToRoom', user),
    removeUserFromRoom: (user: any) => ipcRenderer.send('removeUserFromRoom', user),
    addUserGroupToRoom: (users: [any]) => ipcRenderer.send('addUserGroupToRoom', users),
    handShake: (type: string) => ipcRenderer.send('hand-shake-users', type),
    sendDataChannel: (data: string) => ipcRenderer.send('send-data-channel', data),
    //lobbies
    createNewLobby: (lobbyData: { name: string; pass: string; user: any; isPrivate: boolean }) =>
        ipcRenderer.send('createNewLobby', lobbyData),
    userChangeLobby: (lobbyData: {
        newLobbyId: string
        pass: string
        user: any
        isPrivate: boolean
    }) => ipcRenderer.send('userChangeLobby', lobbyData),
    updateLobbyStats: (lobbyArray: any) => ipcRenderer.send('updateLobbyStats', lobbyArray),
    updateUserData: (userData: any) => ipcRenderer.send('updateUserData', userData),
    // user profile
    getUserMatches: (matches: any) => ipcRenderer.send('getUserMatches', matches),
    getGlobalSet: (matches: any) => ipcRenderer.send('getGlobalSet', matches),
    getAllTitles: (titles: any) => ipcRenderer.send('getAllTitles', titles),
    getUserData: (user: any) => ipcRenderer.send('getUserData', user),
    getGlobalStats: (stats: any) => ipcRenderer.send('getGlobalStats', stats),
    changeUserData: (userData: any) => ipcRenderer.send('changeUserData', userData),

    // config and match
    openEmulatorFolder: () => ipcRenderer.send('openEmulatorFolder'),
    setEmulatorPath: (isResetPath: boolean) => ipcRenderer.send('setEmulatorPath', isResetPath),
    getEmulatorPath: () => ipcRenderer.send('getEmulatorPath'),
    setEmulatorDelay: (delay: number) => ipcRenderer.send('setEmulatorDelay', delay),
    getEmulatorDelay: (delay: number) => ipcRenderer.send('getEmulatorDelay', delay),
    setAppTheme: (themeIndex: number) => ipcRenderer.send('setAppTheme', themeIndex),
    setConfigValue: (key: string, value: string | boolean | number) =>
        ipcRenderer.send('setConfigValue', { key, value }),
    updateSocketState: (key: string, value: string | boolean | number) =>
        ipcRenderer.send('updateSocketState', { key, value }),
    getConfigValue: (key: string, value: string | boolean | number) =>
        ipcRenderer.send('getConfigValue', { key, value }),
    getAppTheme: (themeIndex: number) => ipcRenderer.send('getAppTheme', themeIndex),
    endMatch: (userUID: string) => ipcRenderer.send('endMatch', userUID),
    endMatchUI: (userUID: string) => ipcRenderer.send('endMatch', userUID),
    killEmulator: () => ipcRenderer.send('killEmulator'),
    // sends text to the emulator using the fbneo_commands.txt
    sendText: (text: string) => ipcRenderer.send('send-text', text),
    sendCommand: (command: string) => ipcRenderer.send('send-command', command),
    serveMatch: (ip: string, port: number, player: number, delay: number, myPort: number) =>
        ipcRenderer.send('serveMatch', { ip, port, player, delay, myPort }),
    startGameOnline: (opponentUID: string, player: number, myId?: string, gameName?: string) =>
        ipcRenderer.send('startGameOnline', { opponentUID, player, myId, gameName }),
    startSoloTraining: () => ipcRenderer.send('startTrainingMode'),
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
        ipcRenderer.rawListeners(channel).forEach((listener, index) => {
            if (ipcRenderer.rawListeners(channel).length > 1) {
                // we need to make sure we always keep alive our first index here, its the one we use in renderer.ts
                if (index === 0) return
                return ipcRenderer.removeListener(channel, listener)
            }
            return console.info('saving last listener')
        })
    },
})

ipcRenderer.on('message-from-main', (event, message) => {
    console.info('Stats to update the UI with:', message)
})

ipcRenderer.on('stats-from-main', (event, message) => {
    console.info('Stats to update the UI with:', message)
})

ipcRenderer.on('send-log', (event, message) => {
    console.info('-main- ', message)
})
