import keys from './private/keys'
import './index.css'
// Load our react app
import './front-end/app'

let connectPort = 0
let connectIp = '0.0.0.0'

// document.getElementById("testBtn").addEventListener("click", () => {
//     window.api.sendCommand("game_name");
//     sendGameData('some number etc')
// });

// document.getElementById("start-solo-btn").addEventListener("click", () => {
//     console.log('starting solo training')
//     window.api.startSoloTraining();
// });

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
// temp
// `stun:${keys.COTURN_IP}:${keys.COTURN_PORT}`
const peerConnection = new RTCPeerConnection({
    iceServers: [
        {
            urls: [...googleStuns],
        },
        {
            urls: [`turn:${keys.COTURN_IP}:${keys.COTURN_PORT}`],
            username: 'turn',
            credential: 'turn',
        },
    ],
})

let dataChannel // Will store the game data channel

window.api.on('login-success', (user) => {
    if (user) {
        console.log('User logged in:', user.email)
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
            await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer))
            const answer = await peerConnection.createAnswer()
            await peerConnection.setLocalDescription(answer)
            signalServerSocket.send(JSON.stringify({ type: 'answer', answer }))
            console.log('hey we got offer')

            setTimeout(async () => {
                const stats = await peerConnection.getStats()
                stats.forEach((report) => {
                    if (report.type === 'host' || report.candidateType === 'host') return
                    if (report.type === 'local-candidate') {
                        console.log('Local Candidate:', report)
                    }
                    if (report.type === 'remote-candidate') {
                        console.log('Remote Candidate:', report)
                    }
                })
                if (peerConnection.iceConnectionState !== 'connected') {
                    console.warn('ICE is not connected yet! Waiting...')
                }
            }, 3000)
        }
        if (data.type === 'answer') {
            console.log('hey we got answer')
            console.log(JSON.stringify(candidateList))
            await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer))
        }
        if (data.type === 'ice-candidate') {
            console.log('candidate:', data.candidate)
            await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate))
        }
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
        dataChannel = peerConnection.createDataChannel('game', { reliable: true })
        dataChannel.onopen = () => console.log('Data Channel Open!')
        dataChannel.onmessage = (event) => console.log('Received:', event.data)
    }

    // handle recieve data from channel
    peerConnection.ondatachannel = (event) => {
        dataChannel = event.channel
        dataChannel.onopen = () => console.log('Data Channel Open!')
        dataChannel.onmessage = (event) => console.log('Received:', event.data)
    }

    // send new ice candidates from the coturn server
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            signalServerSocket.send(
                JSON.stringify({ type: 'ice-candidate', candidate: event.candidate })
            )
            if (event.candidate.type === 'srflx') {
                // if we only require the stun server then we can break out of here.
                console.log('STUN ICE Candidate:', event.candidate)
                connectPort = event.candidate.port
                connectIp = event.candidate.address
                candidateList.push({
                    type: 'stun',
                    stunAddress: event.candidate.relatedAddress,
                    port: event.candidate.port,
                    address: event.candidate.address,
                })
            }
            // if the below is true it means we've successfully udp tunnelled to the candidate on the turn server
            if (event.candidate.type === 'relay') {
                // we should be able use the below information on relayed players to connect via fbneo
                console.log('TURN ICE Candidate:', event.candidate)
                console.log(event.candidate.address, event.candidate.port)
                connectPort = event.candidate.port
                connectIp = event.candidate.address
                candidateList.push({
                    type: 'turn',
                    stunAddress: event.candidate.relatedAddress,
                    port: event.candidate.port,
                    address: event.candidate.address,
                })
            }
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

    peerConnection.oniceconnectionstatechange = () => {
        console.log('ICE State:', peerConnection.iceConnectionState)
    }
    // Create an offer and send it to the other peer
    async function startCall() {
        createDataChannel()
        const offer = await peerConnection.createOffer()
        await peerConnection.setLocalDescription(offer)

        // Wait for ICE gathering to complete before sending the offer
        peerConnection.onicegatheringstatechange = () => {
            if (peerConnection.iceGatheringState === 'complete') {
                signalServerSocket.send(JSON.stringify({ type: 'offer', offer }))
            }
        }
        setTimeout(async () => {
            const stats = await peerConnection.getStats()
            stats.forEach((report) => {
                if (report.type === 'candidate-pair' && report.nominated) {
                    console.log('Active Candidate Pair:', report)
                }
            })
        }, 3000)
        // signalServerSocket.send(JSON.stringify({ type: 'offer', offer }))
    }

    window.api.on('hand-shake-users', (text: string) => {
        startCall()
        // if(text.length){
        //     signalServerSocket.send(JSON.stringify({ type: 'user-message', message: `${text}`, sender: user.name }))
        // }
    })

    // Send Game Data
    function sendGameData(data) {
        console.log('sending data')
        if (dataChannel && dataChannel.readyState === 'open') {
            dataChannel.send(JSON.stringify(data))
        }
    }
}
