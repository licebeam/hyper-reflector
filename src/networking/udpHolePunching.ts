const LOCAL_EMULATOR_PORT = 7000
const LOCAL_EMULATOR_IP = '127.0.0.1'
const dgram = require('dgram')
let udpSocket: null | any = null
let keepAliveInterval = null
let holePunchInterval = null

const stun = require('stun')

async function getExternalAddress(udpSocket) {
    const stunServer = 'stun.l.google.com:19302'
    const stunResponse = await stun.request(stunServer, { udpSocket })

    if (!stunResponse || !stunResponse.getXorAddress()) {
        throw new Error('Failed to retrieve public IP and port from STUN')
    }

    // Extract public IP and port
    const { address: publicIp, port: publicPort } = stunResponse.getXorAddress()
    console.log(`Public IP: ${publicIp}, Public Port: ${publicPort}`)

    return { publicIp, publicPort }
}

export async function udpHolePunch(remoteIp: string, remotePort: number, mainWindow: any) {
    try {
        if (udpSocket) {
            await udpSocket.close()
        }
        udpSocket = dgram.createSocket({ type: 'udp4', reuseAddr: true })
    } catch (error) {
        console.log(error)
    }

    const { publicIp, publicPort } = await getExternalAddress(udpSocket).catch((err) =>
        console.log("couldn't get public stun address", err)
    )

    console.log(publicIp, publicPort)
    try {
        udpSocket.bind(publicPort, () => {
            if (!udpSocket) return
            const { port } = udpSocket.address() // Get the actual assigned port
            console.log(`UDP socket bound to ${port}`)
            mainWindow.webContents.send('message-from-main', `UDP socket bound to ${port}`)
        })
    } catch (error) {
        console.log('failed to bind socket', error)
    }

    udpSocket.on('message', (msg, rinfo) => {
        if (!udpSocket) return
        console.log(`Received packet: ${msg} from ${rinfo.address}:${rinfo.port}`)

        const messageContent = msg.toString()
        if (messageContent === 'ping' || messageContent === 'keep-ping') {
            console.log(`Ignoring keep-alive message from ${rinfo.address}:${rinfo.port}`)
            mainWindow.webContents.send(
                'message-from-main',
                `Ignoring keep-alive message from ${rinfo.address}:${rinfo.port}`
            )
            return
        }

        // If we detect a response, NAT hole is punched.
        mainWindow.webContents.send(
            'message-from-main',
            `Connected with ${rinfo.address}:${rinfo.port}`
        )

        // Forward the packet to the emulator
        forwardPacket(msg, publicPort + 1, LOCAL_EMULATOR_IP)
    })

    // Handle errors
    udpSocket.on('error', (err) => {
        if (!udpSocket) return
        console.error('UDP socket error:', err)
        udpSocket.close()
    })

    function forwardPacket(data, targetPort, targetIP) {
        if (!udpSocket) return
        console.log('forwarding message to', targetIP, targetPort)
        udpSocket.send(data, targetPort, targetIP, (err) => {
            if (err) console.log(`Proxy forwarding Error: ${err.message}`)
        })
    }

    return { publicIp, publicPort }
}

export function killUdpSocket() {
    console.log('killing socket')
    if (udpSocket) {
        udpSocket.close()
        udpSocket = null
        clearInterval(holePunchInterval)
        clearInterval(keepAliveInterval)
        holePunchInterval = null
        keepAliveInterval = null
    }
}

// Send periodic keep-alive packets to maintain NAT mapping
function startKeepAlive(targetIp, targetPort) {
    if (!udpSocket) return
    keepAliveInterval = setInterval(() => {
        const message = Buffer.from('ping')
        udpSocket.send(message, 0, message.length, targetPort, targetIp, (err) => {
            if (err) console.error('Failed to send keep-alive:', err)
        })
        console.log('Sent keep-alive packet.')
    }, 5000)
}

export function startHolePunching(peerIP, peerPort, mainWindow: any) {
    console.log(`Attempting UDP hole punching with ${peerIP}:${peerPort}`)
    mainWindow.webContents.send(
        'message-from-main',
        `Attempting UDP hole punching with ${peerIP}:${peerPort}`
    )

    holePunchInterval = setInterval(() => {
        if (!udpSocket) return
        const message = Buffer.from('keep-ping')
        udpSocket.send(message, 0, message.length, peerPort, peerIP, (err) => {
            if (err) console.error('Failed to send hole punching message:', err)
            else console.log(`Sent hole punching message to ${peerIP}:${peerPort}`)
        })
    }, 1000)

    // Start keep-alive
    startKeepAlive(peerIP, peerPort)
}
