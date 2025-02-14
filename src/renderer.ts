import keys from './private/keys'
import './index.css'
// Load our react app
import './front-end/app'

let signalServerSocket: WebSocket = null // WebSocket reference
let candidateList = []

/// NOTES
//there seems to be something going on with port forwarding, if I forward the pc's and have them target the ip it seems to work, opening the game up and starting character select
// the opposite pc isn't able to do so because the ports aren't correctly forewarded or something

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
// temp
// `stun:${keys.COTURN_IP}:${keys.COTURN_PORT}`
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
})

function setupLogging(peer, userLabel, event) {
    if (event.candidate) {
        let candidate = event.candidate.candidate
        // Send the candidate to the remote peer via signaling
        signalServerSocket.send(
            JSON.stringify({ type: 'ice-candidate', candidate: event.candidate })
        )

        if (candidate.includes('srflx')) {
            console.log(`🌍 ${userLabel} STUN Candidate:`, candidate)

            // Extract IP and Port
            let matches = candidate.match(/([0-9]{1,3}\.){3}[0-9]{1,3} [0-9]+/)
            if (matches) {
                let [ip, port] = matches[0].split(' ')
                console.log(`🔍 ${userLabel} IP: ${ip}, Port: ${port}`)
            }
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
    // signalServerSocket = new WebSocket(`ws://127.0.0.1:3000`); // for testing server
    signalServerSocket = new WebSocket(`ws://${keys.COTURN_IP}:3000`)
    signalServerSocket.onopen = () => {
        signalServerSocket.send(JSON.stringify({ type: 'join', user }))
        console.log('WebSocket connected', user.uid)
        signalServerSocket.send(JSON.stringify({ type: 'user-connect', user }))
    }

    signalServerSocket.onclose = async (user) => {
        if (signalServerSocket) {
            await signalServerSocket.send(JSON.stringify({ type: 'user-disconnect', user }))
        }
        console.log('WebSocket disconnected')
        signalServerSocket = null
    }

    signalServerSocket.onerror = (error) => {
        console.error('WebSocket Error:', error)
    }

    //allow users to chat
    window.api.on('user-message', (text: string) => {
        console.log(JSON.stringify(candidateList))
        // sends a message over to another user
        console.log('this should get sent to websockets')
        if (text.length) {
            signalServerSocket.send(
                JSON.stringify({ type: 'user-message', message: `${text}`, sender: user.name })
            )
        }
    })

    // create data channel
    function createDataChannel() {
        const dataChannel = peerConnection.createDataChannel('game')
        dataChannel.onopen = () => console.log('Data Channel Open!')
        dataChannel.onmessage = (event) => console.log('Received:', event.data)
    }

    // automatically create the data channel
    createDataChannel()

    // handle recieve data from channel
    peerConnection.ondatachannel = (event) => {
        dataChannel = event.channel
        dataChannel.onopen = () => console.log('Data Channel Open!')
        dataChannel.onmessage = (event) => console.log('Received:', event.data)
    }

    // send new ice candidates from the coturn server
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            setupLogging(peerConnection, userName, event)
        } else {
            console.log('ICE Candidate gathering complete!')
        }
    }

    peerConnection.oniceconnectionstatechange = () => {
        console.log('ICE Connection State:', peerConnection.iceConnectionState)
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
                console.log(data)
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
                console.log('connected users = ', data.users)
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
        if (data.type === 'offer') {
            console.log('Offer Recieved:', { offer: data.offer.sdp })
            peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer))
            let answer = await peerConnection.createAnswer()
            await peerConnection.setLocalDescription(answer)
            console.log('Answer Being Sent ----', answer.sdp)
            signalServerSocket.send(JSON.stringify({ type: 'answer', answer }))
        } else if (data.type === 'answer') {
            console.log('Answer Recieved:', { offer: data.answer.sdp })
            await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer))
        } else if (data.type === 'ice-candidate') {
            peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate))
            const candidate = data.candidate.candidate
            console.log(`📃 ${'external candidate'} type unknown at this point:`, candidate)
            if (candidate.includes('srflx')) {
                console.log(`🌍 ${'external user'} STUN Candidate:`, candidate)

                // Extract IP and Port
                let matches = candidate.match(/([0-9]{1,3}\.){3}[0-9]{1,3} [0-9]+/)
                if (matches) {
                    let [ip, port] = matches[0].split(' ')
                    console.log(`🔍 ${'external user'} IP: ${ip}, Port: ${port}`)
                }
            }
        }
    }

    async function startCall() {
        const offer = await peerConnection.createOffer()
        await peerConnection.setLocalDescription(offer)
        console.log('Offer Created:', { offer: offer.sdp })
        signalServerSocket.send(JSON.stringify({ type: 'offer', offer }))
    }

    window.api.on('hand-shake-users', (type: string) => {
        startCall()
    })

    window.api.on('send-data-channel', (data: string) => {
        if (dataChannel && dataChannel.readyState === 'open') {
            dataChannel.send(JSON.stringify(data))
        }
    })
}
