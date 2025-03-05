import keys from './private/keys'
import './index.css'
// Load our react app
import './front-end/app'

let signalServerSocket: WebSocket = null // socket reference
let candidateList = []
let callerIdState = null
let myUID = null
let isCaller

// const SOCKET_ADDRESS = `ws://127.0.0.1:3000` // debug
const SOCKET_ADDRESS = `ws://${keys.COTURN_IP}:3000` // live

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
    console.log('trying to create a new peer connection with - ', userUID)
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
        // Only the initiator creates a data channel
        dataChannel = peerConnection.createDataChannel('game')
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
        console.log(event)
        if (event.candidate) {
            setupLogging(peerConnection, userName, event)
        } else {
            console.log('ICE Candidate gathering complete!')
        }
    }

    peerConnection.oniceconnectionstatechange = () => {
        if (peerConnection.iceConnectionState === 'connected') {
            console.log('Connected! Ready to send data.')
        } else if (peerConnection.iceConnectionState === 'failed') {
            console.log('ICE connection failed. Check STUN/TURN settings.')
        }
    }

    peerConnection.isInitiator = isInitiator || false // type error but we can fix this later. We'll use this line to make sure we set the correct player number
    peerConnections[userUID] = peerConnection
    return peerConnection
}

function closePeerConnection(userId: string) {
    console.log(peerConnections)
    if (peerConnections[userId]) {
        console.log(`closing peer connection with ${userId}`)
        peerConnections[userId].getSenders().forEach((sender) => {
            peerConnections[userId].removeTrack(sender)
        })
        peerConnections[userId].close()
        delete peerConnections[userId] // delete user from our map
    }
}

function setupLogging(peer, userLabel, event) {
    if (event.candidate) {
        let candidate = event.candidate.candidate

        if (candidate.includes('srflx')) {
            console.log(`${userLabel} STUN Candidate (srflx):`, candidate)

            let matches = candidate.match(/([0-9]{1,3}\.){3}[0-9]{1,3} [0-9]+/)
            if (matches) {
                let [ip, port] = matches[0].split(' ')
                console.log(`${userLabel} External IP: ${ip}, Port: ${port}`)
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

let userName

window.api.on('loginSuccess', (user) => {
    if (user) {
        myUID = user.uid
        console.log('User logged in:', user.email)
        userName = user.email
        connectWebSocket(user)
    } else {
        console.log("User not logged in. WebSocket won't connect.")
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
    console.log('user logged out, kill socket')
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
            console.log(calleeId, calleeId)
            await createNewPeerConnection(calleeId, true).catch((err) => console.log(err))
            console.log('we are trying to make a call to :', calleeId)
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
            let answer = await peerConnections[callerId].createAnswer()
            await peerConnections[callerId].setLocalDescription(answer)

            console.log('we should be answering the call')
            console.log('sending out answer', callerId, answer)
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
        }
    )

    // allow users to chat
    window.api.on('sendMessage', (text: string) => {
        console.log(JSON.stringify(candidateList))
        // sends a message over to another user
        if (text.length) {
            signalServerSocket.send(
                JSON.stringify({ type: 'sendMessage', message: `${text}`, sender: user.name })
            )
        }
    })

    // This is a function for handling messages from the websocket server
    async function convertBlob(event: any) {
        try {
            // check if event is not JSON but is blob
            if (event.data instanceof Blob) {
                const text = await event.data.text()
                const data = JSON.parse(text)
                // console.log(data)
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
        console.log(data)
        if (data.type === 'connected-users') {
            if (data.users.length) {
                // console.log('connected users = ', data.users)
                window.api.addUserGroupToRoom(data.users)
            }
        }

        if (data.type === 'user-connect') {
            signalServerSocket.send(JSON.stringify({ type: 'join', user }))
            // window.api.addUserToRoom(user)
        }

        if (data.type === 'userDisconnect') {
            console.log('should DC users?')
            // Here we want to close the Peer connection if a user leaves if the connection already exists.
            closePeerConnection(data.userUID)
        }

        if (data.type === "matchEndedClose"){
            //user the userUID and close all matches.
            closePeerConnection(data.userUID)
            console.log("killing emulator")
            window.api.killEmulator();
        }

        if (data.type === 'getRoomMessage') {
            console.log('received a message ==============================================')
            window.api.sendRoomMessage(data)
        }

        if (data.type === 'incomingCall') {
            console.log('Incoming call from:', data.callerId)
            console.log(data)
            await createNewPeerConnection(data.callerId, false)
            await peerConnections[data.callerId]
                .setRemoteDescription(new RTCSessionDescription(data.offer))
                .catch((err) => console.log(err))

            console.log('peer connection set')
            window.api.receivedCall(data)
        }

        if (data.type === 'callAnswered') {
            console.log('Call answered:', data)
            await peerConnections[data.data.answererId].setRemoteDescription(
                new RTCSessionDescription(data.data.answer)
            )
            console.log(
                'Answering call, trying to send some data; ',
                data.data.callerId,
                candidateList[0]
            )
            signalServerSocket.send(
                JSON.stringify({
                    type: 'iceCandidate',
                    data: { targetId: data.data.answererId, candidate: candidateList[0] },
                })
            )
        }

        if (data.type === 'iceCandidate') {
            // TODO fix this ugly data stuff
            console.log('Received ICE Candidate from peer:', data.data.candidate.candidate)
            let matches = data.data.candidate.candidate.match(/([0-9]{1,3}\.){3}[0-9]{1,3} [0-9]+/)
            // console.log('matches', matches)
            // console.log(data)
            // console.log(peerConnections[data.data.userUID].isInitiator)
            if (matches) {
                let [ip, port] = matches[0].split(' ')
                // 0 is our delay settings which we'll need to adjust for.
                //TODO set the player number based on who initialized the peer connections
                let playerNum
                if (peerConnections[data.data.userUID]?.isInitiator) {
                    console.log('I am player 1 ------------------------------------->>>>>>')
                    playerNum = 0
                } else {
                    console.log(
                        'I should be set to player 2 --------------------------------->>>>>'
                    )
                    playerNum = 1
                }
                // this should be set by a list of whatever ongoing challenges are running
                await window.api.updateStun()
                console.log(`Connecting to ${ip}, Port: ${port}`)
                await window.api.setTargetIp(ip)
                // this automatically serves the match when we get a successful candidate, we should probably hanges this.
                window.api.serveMatch(ip, 7000, playerNum, 0, 7000)
            }
        }
    }

    // Fix this later, we need to get the actual user IP.
    // window.api.on('send-data-channel', async (data: string) => {
    //     console.log(
    //         ' PEER STATS ',
    //         (await peerConnection.getStats()).forEach((r) => {
    //             if (r.candidateType === 'srflx') {
    //                 console.log(r)
    //             }
    //         })
    //     )
    //     if (dataChannel && dataChannel.readyState === 'open') {
    //         dataChannel.send(JSON.stringify(data))
    //     }
    // })
}

//ends match with any player who has an active connection with you, this should also close the rtc connection
window.api.on('endMatch', (userUID: string) => {
    console.log('ending match', userUID)
    if (userUID) {
        console.log('sending socket signal to close')
        signalServerSocket.send(
            JSON.stringify({
                type: 'matchEnd',
                uid: myUID,
            })
        )
    }
})
