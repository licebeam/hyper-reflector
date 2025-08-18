import keys from './private/keys'
import './index.css'
// Load the react application
import './front-end/app'
import {
    answerCall,
    closeAllPeers,
    declineCall,
    initWebRTC,
    pingUser,
    sendDataChannelMessage,
    startCall,
    webCheckData,
} from './webRTC/WebPeer'

let signalServerSocket: WebSocket = null // socket reference
let candidateList = []
let callerIdState = null
let userName: string | null = null
let myUserData: any | null = null
let myUID: string | null = null
let opponentUID: string | null = null
let playerNum: number | null = null
let currentLobbyID: string | null = 'Hyper Reflector' // set to default lobby at start

let peerConnection: RTCPeerConnection = null
let currentUsers: any[] = [] // we use this to map through all users in a room

// Updates for online
const SOCKET_ADDRESS = `ws://${keys.COTURN_IP}:3003` // set for online env

const gows = new WebSocket(`ws://${keys.COTURN_IP}:8890/ws`) // go web socks

function resetState() {
    candidateList = []
    callerIdState = null
    userName = null
    opponentUID = null
}

window.api.on('loginSuccess', (user) => {
    if (user) {
        myUID = user.uid
        userName = user.email
        myUserData = user
        connectWebSocket(user)
    } else {
        if (signalServerSocket) {
            signalServerSocket.close()
            signalServerSocket = null
        }
    }
})

window.api.on('login-failed', () => {
    // kill the socket connection
    if (signalServerSocket) {
        signalServerSocket.close()
        signalServerSocket = null
    }
})

window.api.on('loggedOutSuccess', async (user) => {
    // kill the socket connection
    if (signalServerSocket) {
        await signalServerSocket.send(JSON.stringify({ type: 'userDisconnect', user }))
        signalServerSocket.close()
        signalServerSocket = null
    }
})

// below code causes some app hanging
window.api.on('closingApp', async (user) => {
    closeAllPeers(peerConnection)
    peerConnection = null
    // kill the socket connection
    // if (signalServerSocket) {
    //     console.log('we are killing the socket user')
    //     await signalServerSocket.send(JSON.stringify({ type: 'userDisconnect', user }))
    //     signalServerSocket.close()
    //     signalServerSocket = null
    // }
})

window.api.on(
    'callUser',
    async ({ callerId, calleeId }: { callerId: string; calleeId: string }) => {
        peerConnection = await initWebRTC(myUID, calleeId, signalServerSocket)
        startCall(peerConnection, signalServerSocket, calleeId, callerId, true)
    }
)

// handle update away status
window.api.on(
    'updateSocketState',
    async ({ key, value }: { key: string; value: string | number | boolean }) => {
        if (signalServerSocket) {
            await signalServerSocket.send(
                JSON.stringify({
                    type: 'updateSocketState',
                    data: { lobbyId: currentLobbyID, uid: myUID, stateToUpdate: { key, value } },
                })
            )
        }
    }
)

// handle send answer to specific user
window.api.on('answerCall', async ({ from }: { from: string }) => {
    let gameName = null
    if (currentLobbyID === 'vampire') {
        gameName = 'vsavj'
    }
    answerCall(peerConnection, signalServerSocket, from, myUID)
    callerIdState = from
    opponentUID = from
    playerNum = 1 // if we answer a call we are always player 1
    window.api.startGameOnline(opponentUID, playerNum, '', gameName)
})

window.api.on('declineCall', async ({ from }: { from: string }) => {
    console.log('trying to decline a call', from)
    declineCall(signalServerSocket, from, myUID)
})

function connectWebSocket(user) {
    if (signalServerSocket) return // Prevent duplicate ws connections from same client
    // signalServerSocket = new WebSocket(`ws://127.0.0.1:3000`) // for testing server
    signalServerSocket = new WebSocket(SOCKET_ADDRESS)
    signalServerSocket.onopen = () => {
        signalServerSocket.send(JSON.stringify({ type: 'join', user }))
    }

    signalServerSocket.onclose = async (user) => {
        if (signalServerSocket) {
            await signalServerSocket.send(JSON.stringify({ type: 'userDisconnect', user }))
        }
        signalServerSocket = null
    }

    signalServerSocket.onerror = (error) => {
        console.error('WebSocket Error:', error)
    }

    // allow users to chat
    window.api.on('sendMessage', async (messageObject: { text: string; user: any }) => {
        // Send message to all
        // probably need more validation
        if (messageObject.text.length) {
            // Below is debug code for starting web rtc stuff
            if (messageObject.text === 'close' && peerConnection) {
                await closeAllPeers(peerConnection) // TODO fix this we will have an array
                peerConnection = null
            }
            if (messageObject.text === 'ping' && peerConnection) {
                pingUser(user.uid)
            }
            // testing new go socket server
            if (messageObject.text === 'golang') {
                console.log('sending message to golang server')
                gows.onmessage = (e) => console.log('From server:', e.data)
                gows.send('Hello Go!')
            }
            if (messageObject.text === 'vid') {
                try {
                } catch (error) {
                    console.log(error)
                }
            }
            signalServerSocket.send(
                JSON.stringify({
                    type: 'sendMessage',
                    message: `${messageObject.text}`,
                    sender: {
                        name: messageObject.user.name,
                        uid: myUID,
                        lobbyId: messageObject.user.currentLobbyId || 'Hyper Reflector',
                    },
                })
            )
        }
        sendDataChannelMessage('Hey transmitting on data channel whats up')
    })

    window.api.on('createNewLobby', (lobbyInfo) => {
        console.log('sending lobby data', lobbyInfo)
        currentLobbyID = lobbyInfo.name || null
        signalServerSocket.send(
            JSON.stringify({
                type: 'createLobby',
                lobbyId: lobbyInfo.name,
                pass: lobbyInfo.pass,
                isPrivate: lobbyInfo.isPrivate,
                user: lobbyInfo.user, // this is our full user object
            })
        )
    })

    window.api.on('userChangeLobby', (lobbyInfo) => {
        console.log('hey we changed lobbies', lobbyInfo)
        currentLobbyID = lobbyInfo.newLobbyId || null
        signalServerSocket.send(
            JSON.stringify({
                type: 'changeLobby',
                newLobbyId: lobbyInfo.newLobbyId,
                pass: lobbyInfo.pass,
                isPrivate: lobbyInfo.isPrivate,
                user: lobbyInfo.user, // this is our full user object
            })
        )
    })

    // This is a function for handling messages from the websocket server
    async function convertBlob(event: any) {
        try {
            // check if event is not JSON but is blob
            if (event.data instanceof Blob) {
                const text = await event.data.text()
                const data = JSON.parse(text)
                return data
            } else {
                const data = JSON.parse(event.data)
                return data
            }
        } catch (error) {
            console.error('could not convert data:', event.data, error)
        }
    }

    function checkConnectionStability() {
        const connection =
            navigator.connection || navigator.mozConnection || navigator.webkitConnection
        if (connection) {
            const isUnstable =
                connection.effectiveType === '4g' &&
                connection.rtt < 100 &&
                connection.downlink > 10
            return isUnstable
        }
        return false
    }

    signalServerSocket.onmessage = async (message) => {
        const data = await convertBlob(message).then((res) => res)
        if (data.type === 'connected-users') {
            if (data.users.length) {
                currentUsers = data.users
                // console.log('current user list', currentUsers)
                // The timing issue is here.
                data.users.forEach(async (user) => {
                    if (user.uid !== myUID) {
                        console.log(data.users)
                        signalServerSocket.send(
                            JSON.stringify({
                                type: 'estimate-ping-users',
                                data: {
                                    userA: {
                                        id: myUserData.uid,
                                        stability: checkConnectionStability(),
                                    },
                                    userB: {
                                        id: user.uid,
                                    },
                                },
                            })
                        )
                    }
                })
                window.api.addUserGroupToRoom(data.users)
            }
        }

        if (data.type === 'update-user-pinged') {
            console.log('hey the user has a ping, lets update all that data----------------', data)
            window.api.updateUserData(data?.data)
        }

        if (data.type === 'userDisconnect') {
            // TODO this isn't actually being used anymore?
            // Here we want to close the Peer connection if a user leaves if the connection already exists.
            console.log('user DCed from socket server')
        }

        if (data.type === 'lobby-user-counts') {
            // console.log('lobby update', data.updates)
            window.api.updateLobbyStats(data.updates)
        }

        if (data.type === 'matchEndedClose') {
            console.log('match end code', opponentUID, data)
            //user the userUID and close all matches.
            if (opponentUID === data.userUID) {
                window.api.killEmulator()
                resetState()
            }
            if (!opponentUID) {
                resetState()
            }
        }

        if (data.type === 'getRoomMessage') {
            window.api.sendRoomMessage(data)
            webCheckData(peerConnection)
        }

        if (data.type === 'webrtc-ping-decline') {
            // closePeerConnection(data.data.answererId)
            window.api.callDeclined(data.from)
        }

        // new web rtc
        if (data.type === 'webrtc-ping-offer') {
            if (!data?.from) return
            peerConnection = await initWebRTC(myUID, data.from, signalServerSocket)
            if (peerConnection) {
                await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer))
            }
            window.api.receivedCall(data)
        } else if (data.type === 'webrtc-ping-answer') {
            if (!data.from) return
            opponentUID = data.from;
            const acceptMessage = {
                sender: data.from,
                message: 'Accepted',
                type: 'accept',
                declined: false,
                accepted: true,
                id: Date.now(), // TODO this is not a long lasting solution
            }
            window.api.sendRoomMessage(acceptMessage)
            let gameName = null
            if (currentLobbyID === 'vampire') {
                gameName = 'vsavj'
            }
            playerNum = 0 // if we answer a call we are always player 1
            window.api.startGameOnline(data?.from, playerNum, '', gameName)
            try {
                // there is a timing issue here that nees to be fixed.
                await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer))
            } catch (error) {
                console.warn(error)
            }
        } else if (data.type === 'webrtc-ping-candidate') {
            const candidate = new RTCIceCandidate(data.candidate)
            //console.log('Received ICE candidate:', candidate)
            try {
                await peerConnection.addIceCandidate(candidate)
            } catch (error) {
                console.warn('Failed to add ICE candidate:', error)
            }
        }
    }
}

//ends match with any player who has an active connection with you, this should also close the rtc connection
window.api.on('endMatch', (userUID: string) => {
    if (userUID) {
        signalServerSocket.send(
            JSON.stringify({
                type: 'matchEnd',
                userUID,
            })
        )
    }
})
