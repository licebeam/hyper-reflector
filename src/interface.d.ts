// used by typescript to make sure global window has the definitions
export interface IElectronAPI {
    // websocket related
    sendIceCandidate: any
    callUser: any
    answerCall: any
    declineCall: any
    callDeclined: any
    receivedCall: any
    // server and online
    loginUser: any
    createAccount: any
    logOutUser: any
    getLoggedInUser: any
    sendMessage: any
    sendAlert: any
    sendRoomMessage: any
    getChallengeQueue: any
    addUserToRoom: any
    removeUserFromRoom: any
    addUserGroupToRoom: any
    //lobbies
    createNewLobby: any
    userChangeLobby: any
    updateLobbyStats: any
    handShake: any
    sendDataChannel: any
    // settings
    setEmulatorPath: any
    getEmulatorPath: any
    setEmulatorDelay: any
    getEmulatorDelay: any
    setAppTheme: any
    getAppTheme: any
    // -
    endMatch: any
    endMatchUI: any
    killEmulator: any
    // sends text to the emulator using the fbneo_commands.txt
    sendText: any
    sendCommand: any
    serveMatch: any
    startGameOnline: any
    startSoloTraining: any

    // ipc call stuff
    on: any
    removeListener: any
    removeAllListeners: any
    removeExtraListeners: any
}

declare global {
    interface Window {
        api: IElectronAPI
    }
}
