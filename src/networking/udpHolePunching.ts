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
    console.log(`🔹 Public IP: ${publicIp}, Public Port: ${publicPort}`)

    return { publicIp, publicPort }
}

export async function udpHolePunch(remoteIp: string, remotePort: number, mainWindow: any) {
    udpSocket = dgram.createSocket({ type: 'udp4', reuseAddr: true })
    // Example usage:
    const { publicIp, publicPort } = await getExternalAddress(udpSocket)

    console.log(publicIp, publicPort)

    udpSocket.bind(publicPort, () => {
        if (!udpSocket) return
        const { port } = udpSocket.address() // Get the actual assigned port
        console.log(`UDP socket bound to ${port}`)
        mainWindow.webContents.send('message-from-main', `UDP socket bound to ${port}`)

        // Start hole punching
        startHolePunching(remoteIp, publicPort)
    })

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

    function startHolePunching(peerIP, peerPort) {
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
    }

    // Start keep-alive
    startKeepAlive(remoteIp, publicPort)
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

// async function udpHolePunch(
//     remoteIp: string,
//     remotePort: number,
//     localStunPort: number,
//     mylocalRealPort: number
// ) {
//     const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true })

//     socket.bind(7000)

//     socket.on('listening', () => {
//         console.log(`UDP socket listening on ${7000}`)
//         mainWindow.webContents.send('message-from-main', `UDP socket listening on ${7000}`)
//     })

//     // Handle incoming messages & forward them to the emulator
//     // startProxyListener(localStunPort)
//     // socket.on('message', (msg, rinfo) => {
//     //     console.log(`Received message from ${rinfo.address}:${rinfo.port} - ${msg.toString('hex')}`)

//     //     // **Forward the packet to the local emulator**
//     //     socket.send(msg, 0, msg.length, LOCAL_EMULATOR_PORT, LOCAL_EMULATOR_IP, (err) => {
//     //         if (err) console.error('Failed to forward packet to emulator:', err)
//     //         else
//     //             console.log(
//     //                 `Forwarded packet to emulator at ${LOCAL_EMULATOR_IP}:${LOCAL_EMULATOR_PORT}`
//     //             )
//     //     })
//     // })

//     socket.on('message', (msg, rinfo) => {
//         mainWindow.webContents.send(
//             'message-from-main',
//             `✅ Received packet: ${msg} from ${rinfo.address}:${rinfo.port}`
//         )
//         console.log(`✅ Received packet: ${msg} from ${rinfo.address}:${rinfo.port}`)
//         if (!rinfo) return
//         // we should check that we aren't getting requests from random IPs

//         if (rinfo.port !== 7000) {
//             currentTargetPort = rinfo.port
//             console.log('Player isnt using upnp -> changing target port to: ', rinfo.port)
//             console.log('currentTargetPort = ', currentTargetPort)
//         }

//         // prevent keep alive from being forwarded to the emulator - it crashes
//         const messageContent = msg.toString()
//         if (messageContent === 'ping') {
//             console.log(`Ignoring keep-alive message from ${rinfo.address}:${rinfo.port}`)
//             mainWindow.webContents.send(
//                 'message-from-main',
//                 `Ignoring keep-alive message from ${rinfo.address}:${rinfo.port}`
//             )
//             return
//         }
//         // debug to see realtime packets from your opponents emulator.
//         console.log(`proxy recieved packet: ${msg} from ${rinfo.address}:${rinfo.port}`)

//         // Forward packet to emulator on or listen port + 1 on localhost
//         // supposedly this shouldn't add much overhead in lag, we'll need to run some tests.
//         mainWindow.webContents.send(
//             'message-from-main',
//             `proxy is forwarding message: ${messageContent} from:  ${rinfo.address}:${rinfo.port}`
//         )
//         forwardPacket(msg, 7000 + 1, '127.0.0.1')
//     })

//     const proxySocket = dgram.createSocket('udp4')

//     function forwardPacket(data, targetPort, targetIP) {
//         proxySocket.send(data, targetPort, targetIP, (err) => {
//             if (err) console.log(`Proxy forwarding Error: ${err.message}`)
//             // do we need to close this?
//             // proxySocket.close()
//         })
//     }

//     // Handle errors
//     socket.on('error', (err) => {
//         console.error('UDP socket error:', err)
//         socket.close()
//     })

//     // Send periodic keep-alive packets to maintain NAT mapping
//     function startKeepAlive() {
//         setInterval(() => {
//             const message = Buffer.from('ping')
//             socket.send(message, 0, message.length, remotePort, remoteIp, (err) => {
//                 if (err) console.error('Failed to send keep-alive:', err)
//             })
//             console.log('Sent keep-alive packet.')
//         }, 5000)
//     }

//     // Attempt to establish a direct peer-to-peer connection
//     function attemptHolePunching(peerIP, peerPort) {
//         console.log(`Attempting UDP hole punching with peer ${peerIP}:${peerPort}`)
//         mainWindow.webContents.send(
//             'message-from-main',
//             `Attempting UDP hole punching with peer ${peerIP}:${peerPort}`
//         )
//         const message = Buffer.from('keep-ping')
//         socket.send(message, 0, message.length, peerPort, peerIP, (err) => {
//             if (err) console.error('Failed to send hole punching message:', err)
//             else console.log(`Sent hole punching message to ${peerIP}:${peerPort}`)
//         })
//     }

//     // Start the process
//     startKeepAlive()

//     // Simulate a hole punch attempt (Replace with real peer IP & port)
//     setTimeout(() => {
//         attemptHolePunching(remoteIp, 7000) // Use actual peer IP/Port
//     }, 5000)
// }

// async function udpHolePunch(remoteIp: string, remotePort: string) {
//     // const STUN_SERVER = 'stun.l.google.com:19302' // Public STUN server
//     const socket = dgram.createSocket('udp4')

//     // start proxy
//     // await startProxyListener()

//     // Start the UDP socket on a random port
//     socket.bind(() => {
//         const address = socket.address()
//         console.log(`UDP socket listening on ${address.address}:${address.port}`)
//     })

//     // Handle incoming messages
//     socket.on('message', (msg, rinfo) => {
//         console.log(`Received message from ${rinfo.address}:${rinfo.port} - ${msg.toString('hex')}`)
//     })

//     // Handle errors
//     socket.on('error', (err) => {
//         console.error('UDP socket error:', err)
//         socket.close()
//     })

//     // Send periodic keep-alive packets to maintain NAT mapping
//     function startKeepAlive() {
//         setInterval(() => {
//             const message = Buffer.from('ping')
//             socket.send(message, 0, message.length, remotePort, remoteIp, (err) => {
//                 if (err) console.error('Failed to send keep-alive:', err)
//             })
//             console.log('Sent keep-alive packet.')
//         }, 1000)
//     }

//     // Attempt to establish a direct peer-to-peer connection
//     function attemptHolePunching(peerIP, peerPort) {
//         currentTargetIp = peerIP
//         // currentTargetPort = peerPort
//         // if (natType === 'Symmetric NAT') {
//         //     console.log('Symmetric NAT detected. Falling back to TURN.');
//         //     return useTURN(peerIP, peerPort);
//         // }

//         console.log(`Attempting UDP hole punching with peer ${peerIP}:${peerPort}`)
//         const message = Buffer.from('ping')
//         socket.send(message, 0, message.length, peerPort, peerIP, (err) => {
//             if (err) console.error('Failed to send hole punching message:', err)
//             else console.log(`Sent hole punching message to ${peerIP}:${peerPort}`)
//         })
//     }

//     // // Use TURN relay if UDP fails
//     // function useTURN(peerIP, peerPort) {
//     //     console.log(`Falling back to TURN relay via ${TURN_SERVER.host}:${TURN_SERVER.port}`);
//     //     const relayMessage = Buffer.from('relay me');
//     //     socket.send(relayMessage, 0, relayMessage.length, TURN_SERVER.port, TURN_SERVER.host, (err) => {
//     //         if (err) console.error('Failed to send TURN relay request:', err);
//     //         else console.log('Sent TURN relay request.');
//     //     });
//     // }

//     // Start NAT detection
//     // detectNATType().then(() => {

//     startKeepAlive()
//     // })

//     // Simulate a hole punch attempt (Replace with real peer IP & port)
//     setTimeout(() => {
//         attemptHolePunching(remoteIp, 7000) // Replace with actual peer IP/Port
//     }, 5000)
// }
