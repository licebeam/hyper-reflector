const LOCAL_EMULATOR_PORT = 7000
const LOCAL_EMULATOR_IP = '127.0.0.1'
const dgram = require('dgram')
const stun = require('stun')

let udpSocket: dgram.Socket | null = null
let keepAliveInterval: NodeJS.Timeout | null = null
let holePunchInterval: NodeJS.Timeout | null = null
let localPort = 0

export async function getExternalAddress(udpSocket) {
    const stunServer = 'stun.l.google.com:19302'
    const stunResponse = await stun.request(stunServer, { udpSocket })

    if (!stunResponse || !stunResponse.getXorAddress()) {
        throw new Error('Failed to retrieve public IP and port from STUN')
    }

    const { address: publicIp, port: publicPort } = stunResponse.getXorAddress()
    console.log(`STUN Public IP: ${publicIp}, Public Port: ${publicPort}`)
    return { publicIp, publicPort }
}

export async function getExternalAddress2() {
    const stunServer = 'stun.l.google.com:19302'
    const stunResponse = await stun.request(stunServer)

    if (!stunResponse || !stunResponse.getXorAddress()) {
        throw new Error('Failed to retrieve public IP and port from STUN')
    }

    const { address: publicIp, port: publicPort } = stunResponse.getXorAddress()
    console.log(`STUN Public IP: ${publicIp}, Public Port: ${publicPort}`)
    return { publicIp, publicPort }
}

export async function udpHolePunch(remoteIp: string, remotePort: number, mainWindow: any) {
    if (udpSocket) {
        console.log('Closing existing UDP socket...')
        udpSocket.close()
    }

    udpSocket = dgram.createSocket({ type: 'udp4', reuseAddr: true })

    // Get external STUN-discovered IP & port
    const { publicIp, publicPort } = await getExternalAddress(udpSocket).catch((err) => {
        console.log("Couldn't get public STUN address", err)
        return { publicIp: null, publicPort: null }
    })

    if (!publicIp || !publicPort) {
        console.log('STUN discovery failed.')
        return
    }

    udpSocket.bind(() => {
        if (!udpSocket) return

        localPort = udpSocket.address().port // Get local port assigned by OS
        console.log(`UDP socket bound locally to port ${localPort}`)

        mainWindow.webContents.send(
            'message-from-main',
            `UDP socket bound locally to ${localPort} (STUN mapped to ${publicPort})`
        )

        // Send initial hole punching message immediately after binding
        sendHolePunchMessage(remoteIp, remotePort)

        // Start sending periodic hole-punching messages
        holePunchInterval = setInterval(() => sendHolePunchMessage(remoteIp, remotePort), 1000)
    })

    udpSocket.on('message', (msg, rinfo) => {
        if (!udpSocket) return
        console.log(`Received packet: ${msg} from ${rinfo.address}:${rinfo.port}`)

        const messageContent = msg.toString()
        if (messageContent === 'ping' || messageContent === 'keep-ping') {
            console.log(`Ignoring keep-alive message from ${rinfo.address}:${rinfo.port}`)
            return
        }

        mainWindow.webContents.send(
            'message-from-main',
            `Connected with ${rinfo.address}:${rinfo.port}`
        )

        // Forward the packet to the emulator
        forwardPacket(msg, LOCAL_EMULATOR_PORT, LOCAL_EMULATOR_IP)
    })

    udpSocket.on('error', (err) => {
        console.error('UDP socket error:', err)
        udpSocket?.close()
    })

    return { publicIp, publicPort }
}

function forwardPacket(data: Buffer, targetPort: number, targetIP: string) {
    if (!udpSocket) return
    console.log(`Forwarding message to ${targetIP}:${targetPort}`)
    udpSocket.send(data, targetPort, targetIP, (err) => {
        if (err) console.log(`Proxy forwarding Error: ${err.message}`)
    })
}

function sendHolePunchMessage(peerIP: string, peerPort: number) {
    if (!udpSocket) return
    const message = Buffer.from('hole-punch')
    udpSocket.send(message, peerPort, peerIP, (err) => {
        if (err) console.error('Failed to send hole punching message:', err)
        else console.log(`Sent hole punching message to ${peerIP}:${peerPort}`)
    })
}

export function killUdpSocket() {
    console.log('Killing socket...')
    if (udpSocket) {
        udpSocket.close()
        udpSocket = null
    }
    clearInterval(holePunchInterval!)
    clearInterval(keepAliveInterval!)
    holePunchInterval = null
    keepAliveInterval = null
}

export function startHolePunching(peerIP: string, peerPort: number) {
    console.log(`Attempting UDP hole punching with ${peerIP}:${peerPort}`)

    // Send initial hole punching message
    sendHolePunchMessage(peerIP, peerPort)

    // Start periodic hole-punching messages
    holePunchInterval = setInterval(() => sendHolePunchMessage(peerIP, peerPort), 1000)

    // Start keep-alive messages
    startKeepAlive(peerIP, peerPort)
}

function startKeepAlive(targetIp: string, targetPort: number) {
    if (!udpSocket) return
    keepAliveInterval = setInterval(() => {
        const message = Buffer.from('keep-alive')
        udpSocket!.send(message, targetPort, targetIp, (err) => {
            if (err) console.error('Failed to send keep-alive:', err)
        })
        console.log('Sent keep-alive packet.')
    }, 5000)
}
