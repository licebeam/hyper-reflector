import keys from '../private/keys' // for stun server
// init webrtc
const iceServers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: `stun:${keys.COTURN_IP}:${keys.COTURN_PORT}` },
    // {
    //     urls: [`turn:${keys.COTURN_IP}:${keys.COTURN_PORT}?transport=udp`],
    //     username: 'turn',
    //     credential: 'turn',
    //     credentialType: 'password',
    // },
]

var clients: { to: string; peer: RTCPeerConnection }[] = []
var dataChannels: { to: string; from: string; channel: RTCDataChannel }[] = []

export async function initWebRTC(
    myUID: string,
    toUID: string,
    signalingSocket: WebSocket
): Promise<RTCPeerConnection> {
    const peer = new RTCPeerConnection({
        iceServers,
        //iceTransportPolicy: 'relay',
    })

    addDataChannel(peer, toUID, myUID)

    // send new ice candidates from the coturn server
    peer.onicecandidate = (event) => {
        if (event.candidate) {
            signalingSocket.send(
                JSON.stringify({
                    type: 'webrtc-ping-candidate',
                    to: toUID,
                    from: myUID,
                    candidate: event.candidate,
                })
            )
            if (event.candidate.type === 'srflx' || event.candidate.type === 'host') {
                // if we only require the stun server then we can break out of here.
                // console.log('STUN ICE Candidate:', event.candidate)
            }
            // if the below is true it means we've successfully udp tunnelled to the candidate on the turn server
            if (event.candidate.type === 'relay') {
                // console.log('TURN ICE Candidate:', event.candidate)
                // console.log(event.candidate.address, event.candidate.port)
                // console.log('UDP tunneled through TURN server!')
            }
        }
    }

    peer.oniceconnectionstatechange = () => {
        // console.log('ICE connection state:', peer.iceConnectionState)
        if (peer.iceConnectionState === 'connected') {
            console.log('-------------------------- > Peer connection established!')
        }
    }

    return peer
}

export async function startCall(
    peerConnection: RTCPeerConnection,
    signalingSocket: WebSocket,
    to: string,
    from: string,
    isCaller?: boolean // debug feature
) {
    if (!isCaller) return

    console.log('starting call with: ', to)
    if (peerConnection) {
        clients.push({ to: to, peer: peerConnection })
        // console.log('current clients after push', clients)
        const offer = await peerConnection.createOffer()
        await peerConnection.setLocalDescription(offer)
        signalingSocket.send(
            JSON.stringify({
                type: 'webrtc-ping-offer',
                to,
                from,
                offer,
            })
        )
    }
}

export async function answerCall(
    peerConnection: RTCPeerConnection,
    signalingSocket: WebSocket,
    to: string,
    from: string
) {
    console.log('answering call', to, from)
    const answer = await peerConnection.createAnswer()
    await peerConnection.setLocalDescription(answer)
    signalingSocket.send(
        JSON.stringify({
            type: 'webrtc-ping-answer',
            to,
            from,
            answer,
        })
    )
}

export async function declineCall(signalingSocket: WebSocket, to: string, from: string) {
    console.log('declining call -> ', to, from)
    await closeConnectionWithUser(to)
    console.log('did it decline?')
    signalingSocket.send(
        JSON.stringify({
            type: 'webrtc-ping-decline',
            to,
            from,
        })
    )
}

async function addDataChannel(peerConnection: RTCPeerConnection, to: string, from: string) {
    dataChannels = dataChannels.filter((entry) => entry.to !== to)

    const channel = peerConnection.createDataChannel('chat', {
        negotiated: true,
        id: 0,
    })

    channel.onopen = () => {
        console.log('Data channel opened to', to)
        channel.send('Hi!')
    }

    // channel.onmessage = (event) => {
    //     console.log('Data message from', to, '=>', event.data)
    // }

    channel.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data)
            if (data.type === 'ping') {
                // Echo back the ping with type 'pong'
                channel.send(JSON.stringify({ type: 'pong', time: data.time }))
            } else if (data.type === 'pong') {
                const now = Date.now()
                const rtt = now - data.time
                console.log(`Ping RTT from ${to}: ${rtt} ms`)
            } else {
                console.log('Data message from', to, '=>', data)
            }
        } catch (e) {
            console.log('Raw message from', to, '=>', event.data)
        }
    }

    dataChannels.push({ to, from, channel })
}

export function webCheckData(peerConnection: RTCPeerConnection) {
    // This is for debug purposes
    // if (peerConnection) {
    //     console.log('signalling state', peerConnection.signalingState)
    //     console.log('ice gathering state', peerConnection.iceGatheringState)
    //     console.log('ice connection state', peerConnection.iceConnectionState)
    //     console.log('remote state', peerConnection.currentRemoteDescription)
    //     console.log('local state', peerConnection.currentLocalDescription)
    //     if (dataChannels && dataChannels.length) {
    //         console.log('data channel id? ', dataChannels[0]?.channel?.id || 'no id')
    //         console.log(
    //             'data channel is ready? ',
    //             dataChannels[0]?.channel?.readyState || 'no channel'
    //         )
    //         console.log('data channels ', dataChannels)
    //     }
    //     console.log('peer connections ', peerConnection)
    // }
}

export function sendDataChannelMessage(message: string) {
    console.log('attempting to send a data channel message', dataChannels)
    if (dataChannels.length && dataChannels[0]?.channel?.readyState === 'open') {
        console.log('sending message along')
        dataChannels[0].channel.send(message)
    } else {
        console.log('no channel to send on, state: ', dataChannels[0]?.channel || 'null channel')
    }
}

export async function closeConnectionWithUser(toUID: string) {
    console.log(`Closing connection with user: ${toUID}`)

    // Close and remove the peer connection
    const clientIndex = clients.findIndex((client) => client.to === toUID)
    if (clientIndex !== -1) {
        const peer = clients[clientIndex].peer
        if (peer.signalingState !== 'closed') {
            peer.close()
            console.log(`Peer connection with ${toUID} closed.`)
        }
        clients.splice(clientIndex, 1)
    } else {
        console.warn(`No peer connection found for user: ${toUID}`)
    }

    // Close and remove the data channel
    const dataIndex = dataChannels.findIndex((entry) => entry.to === toUID)
    if (dataIndex !== -1) {
        const channel = dataChannels[dataIndex].channel
        if (channel.readyState === 'open' || channel.readyState === 'connecting') {
            channel.close()
            console.log(`Data channel with ${toUID} closed.`)
        }
        dataChannels.splice(dataIndex, 1)
    } else {
        console.warn(`No data channel found for user: ${toUID}`)
    }
}

export async function closeAllPeers(peerConnection: RTCPeerConnection) {
    console.log('closing peers')
    peerConnection.close()
    clients = [] // todo replace this with actual logic
    dataChannels = []
}

export function pingUser(toUID: string) {
    const entry = dataChannels[0] // todo update this to search
    if (!entry || entry.channel.readyState !== 'open') {
        console.warn(`No open data channel to ${toUID} to ping.`)
        return
    }

    const timestamp = Date.now()
    const message = {
        type: 'ping',
        time: timestamp,
    }

    entry.channel.send(JSON.stringify(message))
    console.log(`Sent ping to ${toUID} at ${timestamp}`)
}
