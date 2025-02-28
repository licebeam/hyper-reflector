import keys from './private/keys'
import './index.css'
// Load our react app
import './front-end/app'
import { l } from 'vite/dist/node/types.d-aGj9QkWt'

let signalServerSocket: WebSocket = null // WebSocket reference
let candidateList = []
let callerIdState = null

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
        dataChannel = peerConnection.createDataChannel('game');
        dataChannel.onopen = () => console.log('Data channel open');
        dataChannel.onmessage = (event) => console.log('Received:', event.data);
    } else {
        // Answerer handles data channel event
        peerConnection.ondatachannel = (event) => {
            dataChannel = event.channel;
            dataChannel.onopen = () => console.log('Data channel open');
            dataChannel.onmessage = (event) => console.log('Received peer:', event.data);
        };
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

    peerConnections[userUID] = peerConnection
    return peerConnection
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
                        data: { targetId: callerIdState, candidate: event.candidate },
                    })
                )
            }
        }
    }
}

let userName

window.api.on('login-success', (user) => {
    if (user) {
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

window.api.on('logged-out', (user) => {
    // kill the socket connection
    if (signalServerSocket) {
        signalServerSocket.send(JSON.stringify({ type: 'user-disconnect', user }))
        signalServerSocket.close()
        signalServerSocket = null
    }
})

window.api.on('closing-app', async (user) => {
    // kill the socket connection
    if (signalServerSocket) {
        console.log('we are killing the socket user')
        await signalServerSocket.send(JSON.stringify({ type: 'user-disconnect', user }))
        signalServerSocket.close()
        signalServerSocket = null
    }
})

function connectWebSocket(user) {
    if (signalServerSocket) return // Prevent duplicate ws connections from same client
    // signalServerSocket = new WebSocket(`ws://127.0.0.1:3000`) // for testing server
    signalServerSocket = new WebSocket(`ws://${keys.COTURN_IP}:3000`)
    signalServerSocket.onopen = () => {
        signalServerSocket.send(JSON.stringify({ type: 'join', user }))
        signalServerSocket.send(JSON.stringify({ type: 'user-connect', user }))
    }

    signalServerSocket.onclose = async (user) => {
        if (signalServerSocket) {
            await signalServerSocket.send(JSON.stringify({ type: 'user-disconnect', user }))
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
            // Automatically accept call (or prompt user for acceptance)
            let answer = await peerConnections[answererId].createAnswer()
            await peerConnections[answererId].setLocalDescription(answer)

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

    // window.api.on('iceCandidate', (targetId: string, iceCandidate: any) => {
    //     signalServerSocket.send(
    //         JSON.stringify({ type: 'iceCandidate', data: { targetId, iceCandidate } })
    //     )
    // })

    // allow users to chat
    window.api.on('user-message', (text: string) => {
        console.log(JSON.stringify(candidateList))
        // sends a message over to another user
        if (text.length) {
            signalServerSocket.send(
                JSON.stringify({ type: 'user-message', message: `${text}`, sender: user.name })
            )
        }
    })

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

        if (data.type === 'user-disconnect') {
            signalServerSocket.send(JSON.stringify({ type: 'join', user }))
            // window.api.removeUserFromRoom(user)
        }

        if (data.type === 'user-message') {
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
            console.log('Received ICE Candidate from peer:', data.candidate.candidate)
            let matches = data.candidate.candidate.match(/([0-9]{1,3}\.){3}[0-9]{1,3} [0-9]+/)
            console.log('matches', matches)
            if (matches) {
                let [ip, port] = matches[0].split(' ')
                // 0 is our delay settings which we'll need to adjust for.
                const playerNum = 0 // this should be set by a list of whatever ongoing challenges are running
                console.log(`Connecting to ${ip}, Port: ${port}`)
                window.api.serveMatch(ip, 7000, playerNum, 0, 7000)
            }
            try {
                await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate))
                console.log('ICE Candidate added successfully')
            } catch (err) {
                console.error('Failed to add ICE Candidate:', err)
            }
        }
    }

    window.api.on('send-data-channel', async (data: string) => {
        console.log(
            ' PEER STATS ',
            (await peerConnection.getStats()).forEach((r) => {
                if (r.candidateType === 'srflx') {
                    console.log(r)
                }
            })
        )
        if (dataChannel && dataChannel.readyState === 'open') {
            dataChannel.send(JSON.stringify(data))
        }
    })
}
