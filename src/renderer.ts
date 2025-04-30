import keys from './private/keys'
import './index.css'
// Load the react application
import './front-end/app'

let signalServerSocket: WebSocket = null // socket reference
let candidateList = []
let callerIdState = null
let userName: string | null = null
let myUID: string | null = null
let opponentUID: string | null = null
let playerNum: number | null = null

// const SOCKET_ADDRESS = `ws://127.0.0.1:3001` // debug
const SOCKET_ADDRESS = `ws://${keys.COTURN_IP}:3001`

// handle connection to remote turn server
const googleStuns = [
    'stun:stun.l.google.com:19302',
    'stun:stun.l.google.com:5349',
    'stun:stun1.l.google.com:3478',
    'stun:stun1.l.google.com:5349',
    'stun:stun2.l.google.com:19302',
    'stun:stun2.l.google.com:5349',
    'stun:stun3.l.google.com:3478',
    'stun:stun3.l.google.com:5349',
    'stun:stun4.l.google.com:19302',
    'stun:stun4.l.google.com:5349',
]

const peerConnections: Record<string, RTCPeerConnection> = {}

async function createNewPeerConnection(userUID: string, isInitiator: boolean) {
    const peerConnection = new RTCPeerConnection({
        iceServers: [
            {
                urls: 'stun:stun.l.google.com:19302',
                // urls: [`stun:${keys.COTURN_IP}:${keys.COTURN_PORT}`],
            },
            {
                urls: [`turn:${keys.COTURN_IP}:${keys.COTURN_PORT}`],
                username: 'turn',
                credential: 'turn',
            },
        ],
        iceTransportPolicy: 'all',
    })

    let dataChannel // Will store the game data channel

    // create data channel
    if (isInitiator) {
        // console.log('creating a data channel')
        // Only the initiator creates a data channel
        dataChannel = peerConnection.createDataChannel('updForwarding')
        dataChannel.onopen = () => console.log('Data channel open')
        dataChannel.onmessage = (event) => console.log('Received:', event.data)
    } else {
        // Answerer handles data channel event
        peerConnection.ondatachannel = (event) => {
            dataChannel = event.channel
            dataChannel.onopen = () => console.log('Data channel open')
            dataChannel.onmessage = (event) => console.log('Received peer:', event.data)
        }
    }

    // send new ice candidates from the coturn server
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            setupLogging(peerConnection, userName, event)
        } else {
            // console.log('ICE Candidate gathering complete!')
        }
    }

    peerConnection.oniceconnectionstatechange = () => {
        if (peerConnection.iceConnectionState === 'connected') {
            // console.log('Connected! Ready to send data.')
        } else if (peerConnection.iceConnectionState === 'failed') {
            // console.log('ICE connection failed. Check STUN/TURN settings.')
        }
    }

    peerConnection.isInitiator = isInitiator || false // type error but we can fix this later. We'll use this line to make sure we set the correct player number
    peerConnection.dataChannel = dataChannel
    peerConnections[userUID] = peerConnection

    return peerConnection
}

function closePeerConnection(userId: string) {
    if (peerConnections[userId]) {
        peerConnections[userId].getSenders().forEach((sender) => {
            peerConnections[userId].removeTrack(sender)
        })
        peerConnections[userId].close()
        delete peerConnections[userId] // delete user from our map
    }
}

function resetState() {
    candidateList = []
    callerIdState = null
    userName = null
    opponentUID = null
}

function setupLogging(peer, userLabel, event) {
    if (event.candidate) {
        let candidate = event.candidate.candidate

        if (candidate.includes('srflx')) {
            let regex = /([0-9]{1,3}\.){3}[0-9]{1,3} (\d+) typ srflx raddr ([0-9\.]+) rport (\d+)/
            let matches = candidate.match(regex)
            if (matches) {
                let ip = matches[1] // The public IP (e.g., 133.32.4.39)
                let port = matches[2] // The port (e.g., 50133)
                let raddr = matches[3] // The private IP address (e.g., 192.168.11.2)
                let rport = matches[4] // The rport (e.g., 50133)
            }
            candidateList.push(event.candidate)
            if (callerIdState) {
                signalServerSocket.send(
                    JSON.stringify({
                        type: 'iceCandidate',
                        data: {
                            targetId: callerIdState,
                            candidate: event.candidate,
                            callerId: myUID,
                        },
                    })
                )
            }
        }
    }
}

window.api.on('loginSuccess', (user) => {
    if (user) {
        myUID = user.uid
        userName = user.email
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
// window.api.on('closingApp', async (user) => {
//     // kill the socket connection
//     if (signalServerSocket) {
//         console.log('we are killing the socket user')
//         await signalServerSocket.send(JSON.stringify({ type: 'userDisconnect', user }))
//         signalServerSocket.close()
//         signalServerSocket = null
//     }
// })

function connectWebSocket(user) {
    if (signalServerSocket) return // Prevent duplicate ws connections from same client
    // signalServerSocket = new WebSocket(`ws://127.0.0.1:3000`) // for testing server
    signalServerSocket = new WebSocket(SOCKET_ADDRESS)
    signalServerSocket.onopen = () => {
        signalServerSocket.send(JSON.stringify({ type: 'join', user }))
        signalServerSocket.send(JSON.stringify({ type: 'user-connect', user }))
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

    // handle matchmaking
    // handle send call to specific user
    window.api.on(
        'callUser',
        async ({ callerId, calleeId }: { callerId: string; calleeId: string }) => {
            await createNewPeerConnection(calleeId, true).catch((err) => console.warn(err))

            const offer = await peerConnections[calleeId].createOffer()

            await peerConnections[calleeId].setLocalDescription(offer)
            const localDescription = peerConnections[calleeId].localDescription
            signalServerSocket.send(
                JSON.stringify({ type: 'callUser', data: { callerId, calleeId, localDescription } })
            )
        }
    )

    // handle send answer to specific user
    window.api.on(
        'answerCall',
        async ({ callerId, answererId }: { callerId: string; answererId: string }) => {
            console.log('is this actually firing off?', callerId, answererId)
            let answer = await peerConnections[callerId]?.createAnswer()
            await peerConnections[callerId].setLocalDescription(answer)

            signalServerSocket.send(
                JSON.stringify({
                    type: 'answerCall',
                    data: {
                        callerId,
                        answer,
                        answererId,
                    },
                })
            )
            callerIdState = callerId
            opponentUID = callerId
            playerNum = 1 // if we answer a call we are always player 1
            window.api.startGameOnline(opponentUID, playerNum)
        }
    )

    window.api.on(
        'declineCall',
        async ({ callerId, answererId }: { callerId: string; answererId: string }) => {
            await signalServerSocket.send(
                JSON.stringify({
                    type: 'declineCall',
                    data: {
                        callerId,
                        answererId,
                    },
                })
            )
            await closePeerConnection(callerId) // close the peer connection when we decline
        }
    )

    // allow users to chat
    window.api.on('sendMessage', (messageObject: { text: string; user: any }) => {
        // sends a message over to another user
        // probably need more validation
        if (messageObject.text.length) {
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
    })

    window.api.on('createNewLobby', (lobbyInfo) => {
        console.log('sending lobby data', lobbyInfo)
        signalServerSocket.send(
            JSON.stringify({
                type: 'createLobby',
                lobbyId: lobbyInfo.name,
                pass: lobbyInfo.pass,
                private: lobbyInfo.private,
                user: lobbyInfo.user, // this is our full user object
            })
        )
    })

    window.api.on('userChangeLobby', (lobbyInfo) => {
        console.log('hey we changed lobbies', lobbyInfo)
        signalServerSocket.send(
            JSON.stringify({
                type: 'changeLobby',
                newLobbyId: lobbyInfo.newLobbyId,
                pass: lobbyInfo.pass,
                private: lobbyInfo.private,
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

    signalServerSocket.onmessage = async (message) => {
        const data = await convertBlob(message).then((res) => res)
        if (data.type === 'connected-users') {
            if (data.users.length) {
                window.api.addUserGroupToRoom(data.users)
            }
        }

        if (data.type === 'user-connect') {
            signalServerSocket.send(JSON.stringify({ type: 'join', user }))
            // window.api.addUserToRoom(user)
        }

        if (data.type === 'userDisconnect') {
            // Here we want to close the Peer connection if a user leaves if the connection already exists.
            closePeerConnection(data.userUID)
        }

        if (data.type === 'lobby-user-counts') {
            window.api.updateLobbyStats(data.updates)
        }

        if (data.type === 'matchEndedClose') {
            //user the userUID and close all matches.
            if (opponentUID === data.userUID) {
                closePeerConnection(data.userUID)
                window.api.killEmulator()
                resetState()
            }
            if (!opponentUID) {
                resetState()
            }
        }

        if (data.type === 'getRoomMessage') {
            window.api.sendRoomMessage(data)
        }

        if (data.type === 'incomingCall') {
            await createNewPeerConnection(data.callerId, false)
            await peerConnections[data.callerId]
                .setRemoteDescription(new RTCSessionDescription(data.offer))
                .catch((err) => console.warn(err))
            console.log(data)
            window.api.receivedCall(data)
        }

        if (data.type === 'callAnswered') {
            await peerConnections[data.data.answererId].setRemoteDescription(
                new RTCSessionDescription(data.data.answer)
            )
            opponentUID = data.data.answererId // set the current opponent so we can get them from the peer list.
            signalServerSocket.send(
                JSON.stringify({
                    type: 'iceCandidate',
                    data: { targetId: data.data.answererId, candidate: candidateList[0] },
                })
            )
            playerNum = 0 // if our call is answered we are always player 0
            window.api.startGameOnline(opponentUID, playerNum)
        }

        if (data.type === 'callDeclined') {
            closePeerConnection(data.data.answererId)
            window.api.callDeclined(data.data.answererId)
        }

        if (data.type === 'iceCandidate') {
            console.info(
                'made a connection with someone, probably need to initialize some data channel stuff'
            )
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
