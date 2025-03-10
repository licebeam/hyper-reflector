const dgram = require('dgram')
let proxyListener: null | any = null // This is a socket server that is used to handle proxying data to the emulator.
let currentTargetIp = '127.0.0.1' // We change this if we get a message from player and try to target that ip.
let currentTargetPort = 7000 // We change this when we recieve a message from a player on a different port, this means one is not using upnp.

export default async function startProxyListener(
    proxyPort: number,
    mainWindow: any,
) {
    mainWindow.webContents.send('message-from-main', `attempting proxy listener`)
    proxyListener = dgram.createSocket('udp4')
    mainWindow.webContents.send('message-from-main', `socket created`)

    proxyListener.bind(proxyPort, () => {
        console.log(`proxy listening on port ${proxyPort}...`)
        mainWindow.webContents.send('message-from-main', `proxy listening on port ${proxyPort}...`)
    })

    // we use this to send traffic from 7000 to 7001
    proxyListener.on('message', (msg, rinfo) => {
        console.log('proxy listener got a message')
        if (!rinfo) return
        // we should check that we aren't getting requests from random IPs

        if (rinfo.port !== 7000) {
            currentTargetPort = rinfo.port
            console.log('Player isnt using upnp -> changing target port to: ', rinfo.port)
            console.log('currentTargetPort = ', currentTargetPort)
        }

        // prevent keep alive from being forwarded to the emulator - it crashes
        const messageContent = msg.toString()
        console.log('testing for failure ---- ', messageContent)
        if (messageContent === 'ping' || messageContent === 'keep-ping') {
            console.log(`Ignoring keep-alive message from ${rinfo.address}:${rinfo.port}`)
            mainWindow.webContents.send(
                'message-from-main',
                `Ignoring keep-alive message from ${rinfo.address}:${rinfo.port}`
            )
            return
        }
        // debug to see realtime packets from your opponents emulator.
        console.log(`proxy recieved packet: ${msg} from ${rinfo.address}:${rinfo.port}`)

        // Forward packet to emulator on or listen port + 1 on localhost
        // supposedly this shouldn't add much overhead in lag, we'll need to run some tests.
        mainWindow.webContents.send(
            'message-from-main',
            `proxy is forwarding message: ${messageContent} from:  ${rinfo.address}:${rinfo.port}`
        )
        forwardPacket(msg, 7001, '127.0.0.1')
    })

    function forwardPacket(data, targetPort, targetIP) {
        const socket = dgram.createSocket('udp4')
        socket.send(data, targetPort, targetIP, (err) => {
            if (err) console.log(`Proxy forwarding Error: ${err.message}`)
            // do we need to close this?
            socket.close()
        })
    }
}

// we must initialize the client here or nothing works correctly.
// console.log('Starting listener...')
// stun_port = port
// expected_peer_ip = ip
// console.log(`STUN Port: ${stun_port}, Expected Peer: ${expected_peer_ip}`)
// // Ensure we don't create multiple listeners
// if (listener) {
//     console.log('Closing existing listener...')
//     listener.close()
// }
// // Create a fresh listener
// listener = dgram.createSocket('udp4')
// function openNatPath(targetIP, targetPort) {
//     const socket = dgram.createSocket('udp4')
//     const msg = Buffer.from('ping')
//     function sendKeepAlive() {
//         socket.send(msg, targetPort, targetIP, (err) => {
//             if (err) console.error(`Error sending NAT punch: ${err.message}`)
//             else console.log(`NAT punch sent to ${targetIP}:${targetPort}`)
//         })
//     }
//     // Send first punch
//     sendKeepAlive()
//     // Listen for responses and immediately reply to complete the hole punch
//     socket.on('message', (msg, rinfo) => {
//         console.log(`Received from ${rinfo.address}:${rinfo.port}`)
//         // Reply immediately (force NAT to open the path)
//         socket.send(msg, rinfo.port, rinfo.address)
//     })
//     // Send keep-alive packets every 5 seconds
//     const keepAliveInterval = setInterval(sendKeepAlive, 5000)
//     // Clean up socket when app closes
//     socket.on('close', () => clearInterval(keepAliveInterval))
// }
// // Punch NAT hole to the external STUN-mapped port
// openNatPath(expected_peer_ip, extPort)
// // Start listening on the STUN port for incoming packets
// listener.bind(stun_port, () => {
//     console.log(`Listening on STUN port ${stun_port}...`)
// })
// listener.on('message', (msg, rinfo) => {
//     console.log(rinfo)
//     if (rinfo.address === expected_peer_ip) {
//         // prevent keep alive from being forwarded to the emulator - it crashes
//         const messageContent = msg.toString()
//         if (messageContent === 'ping') {
//             console.log(`Ignoring keep-alive message from ${rinfo.address}:${rinfo.port}`)
//             return
//         }
//         console.log(`Received packet from ${rinfo.address}:${rinfo.port}`)
//         // Forward packet to local emulator on port + 1
//         forwardPacket(msg, emulatorPort + 1, '127.0.0.1')
//     }
// })
// function forwardPacket(data, targetPort, targetIP) {
//     const socket = dgram.createSocket('udp4')
//     socket.send(data, targetPort, targetIP, (err) => {
//         if (err) console.log(`Forwarding Error: ${err.message}`)
//         socket.close()
//     })
// }
// listener.on('error', (err) => {
//     console.error(`UDP Listener Error: ${err.message}`)
//     listener.close()
// })
