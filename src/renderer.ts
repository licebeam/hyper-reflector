import keys from './private/keys'
import './index.css'
// Load our react app
import './front-end/app'

let signalServerSocket: WebSocket = null // WebSocket reference
let candidateList = []

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
        }
    }
}

let userName
let dataChannel // Will store the game data channel

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
            console.log('we are trying to make a call to :', calleeId)
            const offer = await peerConnection.createOffer()
            await peerConnection.setLocalDescription(offer)
            const localDescription = peerConnection.localDescription
            signalServerSocket.send(
                JSON.stringify({ type: 'callUser', data: { callerId, calleeId, localDescription } })
            )
        }
    )

    // handle send answer to specific user
    window.api.on('answerCall', async ({ callerId }: { callerId: string }) => {
        // Automatically accept call (or prompt user for acceptance)
        let answer = await peerConnection.createAnswer()
        await peerConnection.setLocalDescription(answer)

        console.log('we should be answering the call')
        console.log('sending out call', callerId, answer)
        signalServerSocket.send(
            JSON.stringify({
                type: 'answerCall',
                data: {
                    callerId,
                    answer,
                },
            })
        )
    })

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

    // create data channel
    function createDataChannel() {
        const dataChannel = peerConnection.createDataChannel('game')
        dataChannel.onopen = () => console.log('data chanel open')
        dataChannel.onmessage = (event) => console.log('Received:', event.data)
    }

    // automatically create the data channel
    createDataChannel()

    // handle recieve data from channel
    peerConnection.ondatachannel = (event) => {
        dataChannel = event.channel
        dataChannel.onopen = () => console.log('data channel open')
        dataChannel.onmessage = (event) => console.log('Received peer:', event.data)
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

            await peerConnection
                .setRemoteDescription(new RTCSessionDescription(data.offer))
                .catch((err) => console.log(err))

            console.log('peer connection set')
            window.api.receivedCall(data)
        }

        if (data.type === 'callAnswered') {
            console.log('Call answered:', data.answer)
            await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer))

            // Now send the stored ICE candidates
            while (candidateList.length > 0) {
                let candidate = candidateList.shift()
                signalServerSocket.send(JSON.stringify({ type: 'iceCandidate', candidate }))
            }
        }

        if (data.type === 'iceCandidate') {
            console.log('Received ICE Candidate from peer:', data.candidate)
            try {
                await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate))
                console.log('ICE Candidate added successfully')
            } catch (err) {
                console.error('Failed to add ICE Candidate:', err)
            }
        }
    }

    // async function startCall() {
    //     const offer = await peerConnection.createOffer()
    //     await peerConnection.setLocalDescription(offer)
    //     signalServerSocket.send(JSON.stringify({ type: 'offer', offer }))
    // }

    // window.api.on('hand-shake-users', (type: string) => {
    //     startCall()
    // })

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
