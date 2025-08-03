// This is just prototype code.

// used for spectator
const WebSocket = require('ws')

let latestSnapshot = null
const inputBuffer = []
const MAX_INPUT_HISTORY = 300 // this will need to be adjusted
const LOCAL_UDP_PORT_IN = 7005 // C++ host listening socket
const LOCAL_UDP_PORT_OUT = 7006 // Client port sent to by relay
const REMOTE_WS_SERVER_URL = 'ws://127.0.0.1:8080' // Relay server for sending to users.

// Udp server for listening to c++
const udpServer = dgram.createSocket('udp4')

udpServer.on('error', (err) => {
    console.error(`UDP server error:\n${err.stack}`)
    udpServer.close()
})

udpServer.on('message', (msg, rinfo) => {
    try {
        const data = JSON.parse(msg.toString())
        if (data.type === 'spectator_init') {
            console.log(`Spectator init received from ${rinfo.address}:${rinfo.port}`)

            if (latestSnapshot) {
                const snapshotStr = JSON.stringify(latestSnapshot)
                const chunkSize = 60000 // This shouldn't really be chunked, but it's massive 2.5 megs without.
                const totalChunks = Math.ceil(snapshotStr.length / chunkSize)

                for (let i = 0; i < totalChunks; i++) {
                    const chunkData = snapshotStr.slice(i * chunkSize, (i + 1) * chunkSize)
                    const chunkMsg = {
                        type: 'snapshot_chunk',
                        frame: latestSnapshot.frame,
                        chunk_index: i,
                        total_chunks: totalChunks,
                        data: chunkData,
                    }

                    const udpMsg = Buffer.from(JSON.stringify(chunkMsg))
                    udpClient.send(udpMsg, rinfo.port, rinfo.address, (err) => {
                        if (err) console.error(`Error sending chunk ${i}:`, err.message)
                    })
                }

                for (const input of inputBuffer) {
                    udpClient.send(Buffer.from(JSON.stringify(input)), rinfo.port, rinfo.address)
                }

                console.log(
                    `Sent snapshot in ${totalChunks} chunks and ${inputBuffer.length} inputs.`
                )
            } else {
                console.warn('No snapshot available to send.')
            }

            return
        } else if (data.type === 'game_snapshot') {
            latestSnapshot = data

            const snapshotStr = JSON.stringify(latestSnapshot)
            const chunkSize = 60000
            const totalChunks = Math.ceil(snapshotStr.length / chunkSize)

            for (let i = 0; i < totalChunks; i++) {
                const chunkData = snapshotStr.slice(i * chunkSize, (i + 1) * chunkSize)
                const chunkMsg = {
                    type: 'snapshot_chunk',
                    frame: latestSnapshot.frame,
                    chunk_index: i,
                    total_chunks: totalChunks,
                    data: chunkData,
                }

                wsClient.send(JSON.stringify(chunkMsg)) // sent to relay server
            }
        }

        // forward to websockets
        if (wsClient && wsClient.readyState === WebSocket.OPEN) {
            wsClient.send(JSON.stringify(data))
        } else {
            console.warn('WebSocket not connected, cannot forward.')
        }
    } catch (e) {
        console.error('UDP message parse error:', e.message)
    }
})

udpServer.on('listening', () => {
    const address = udpServer.address()
    console.log(`UDP server listening on ${address.address}:${address.port}`)
})

udpServer.bind(LOCAL_UDP_PORT_IN)

// Client socket
const udpClient = dgram.createSocket('udp4')
let wsClient
let reconnectInterval

function connectWebSocket() {
    if (
        wsClient &&
        (wsClient.readyState === WebSocket.OPEN || wsClient.readyState === WebSocket.CONNECTING)
    ) {
        return
    }

    console.log(`Attempting to connect to remote WebSocket server: ${REMOTE_WS_SERVER_URL}`)
    wsClient = new WebSocket(REMOTE_WS_SERVER_URL)

    wsClient.onopen = () => {
        console.log('Connected to remote WebSocket server.')
        clearInterval(reconnectInterval)
    }

    wsClient.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data)
            console.log('data type', data.type)

            if (data.type === 'game_snapshot') {
                latestSnapshot = data

                // Chunk and forward over UDP to local spectator
                const snapshotStr = JSON.stringify(latestSnapshot)
                const chunkSize = 1400
                const totalChunks = Math.ceil(snapshotStr.length / chunkSize)

                for (let i = 0; i < totalChunks; i++) {
                    const chunkData = snapshotStr.slice(i * chunkSize, (i + 1) * chunkSize)
                    const chunkMsg = {
                        type: 'snapshot_chunk',
                        frame: latestSnapshot.frame,
                        chunk_index: i,
                        total_chunks: totalChunks,
                        data: chunkData,
                    }

                    // Send to spectator's emulator via UDP
                    udpClient.send(
                        Buffer.from(JSON.stringify(chunkMsg)),
                        LOCAL_UDP_PORT_OUT,
                        '127.0.0.1',
                        (err) => {
                            if (err) console.error('Error sending snapshot_chunk to C++:', err)
                        }
                    )
                }

                console.log(`Forwarded ${totalChunks} snapshot chunks to C++`)
                return
            }
            if (data.type === 'game_input') {
                inputBuffer.push(data)
                if (inputBuffer.length > MAX_INPUT_HISTORY) {
                    inputBuffer.shift() // Keep buffer from growing unbounded
                }
            }

            udpClient.send(event.data, LOCAL_UDP_PORT_OUT, '127.0.0.1', (err) => {
                if (err) console.error('Error sending UDP to C++:', err)
            })
        } catch (e) {
            console.error('Error parsing WS message:', e.message)
        }
    }

    wsClient.onclose = () => {
        console.log('Disconnected from remote WebSocket server. Reconnecting...')
        if (!reconnectInterval) {
            reconnectInterval = setInterval(connectWebSocket, 3000)
        }
    }

    wsClient.onerror = (err) => {
        console.error('WebSocket error:', err.message)
        wsClient.close()
    }
}

// Initial WebSocket connection attempt
connectWebSocket()

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('Shutting down local proxy...')
    if (udpServer) udpServer.close()
    if (wsClient) wsClient.close()
    clearInterval(reconnectInterval)
    process.exit()
})

const relayServer = new WebSocket.Server({ port: 8080 })

let peers = []

relayServer.on('connection', (ws) => {
    console.log('New WebSocket client connected.')
    peers.push(ws)

    ws.on('message', (message) => {
        for (const peer of peers) {
            if (peer.readyState === WebSocket.OPEN) {
                peer.send(message) // send to all, including self
            }
        }
    })

    ws.on('close', () => {
        peers = peers.filter((p) => p !== ws)
        console.log('WebSocket client disconnected.')
    })
})

// For now we need to read from a snapshot file, this is not ideal
// Remember to change the file path
fs.watchFile('somefolder/fbneo_snapshot_out.json', (curr, prev) => {
    const contents = fs.readFileSync('somefolder/fbneo_snapshot_out.json', 'utf8')

    if (wsClient && wsClient.readyState === WebSocket.OPEN) {
        wsClient.send(contents)
        console.log('Sent snapshot to relay via WebSocket')
    } else {
        console.warn('WebSocket not open, couldn’t send snapshot')
    }
})
