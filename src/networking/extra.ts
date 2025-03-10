// export async function udpHolePunch(remoteIp: string, remotePort: number, mainWindow: any) {
//     try {
//         if (udpSocket) {
//             await udpSocket.close()
//         }
//         udpSocket = dgram.createSocket({ type: 'udp4', reuseAddr: true })
//     } catch (error) {
//         console.log(error)
//     }

//     const { publicIp, publicPort } = await getExternalAddress(udpSocket).catch((err) =>
//         console.log("couldn't get public stun address", err)
//     )

//     console.log(publicIp, publicPort)
//     try {
//         udpSocket.bind(publicPort, () => {
//             if (!udpSocket) return
//             const { port } = udpSocket.address() // Get the actual assigned port
//             console.log(`UDP socket bound to ${port}`)
//             mainWindow.webContents.send('message-from-main', `UDP socket bound to ${port}`)
//         })
//     } catch (error) {
//         console.log('failed to bind socket', error)
//     }

//     udpSocket.on('message', (msg, rinfo) => {
//         if (!udpSocket) return
//         console.log(`Received packet: ${msg} from ${rinfo.address}:${rinfo.port}`)

//         const messageContent = msg.toString()
//         if (messageContent === 'ping' || messageContent === 'keep-ping') {
//             console.log(`Ignoring keep-alive message from ${rinfo.address}:${rinfo.port}`)
//             mainWindow.webContents.send(
//                 'message-from-main',
//                 `Ignoring keep-alive message from ${rinfo.address}:${rinfo.port}`
//             )
//             return
//         }

//         // If we detect a response, NAT hole is punched.
//         mainWindow.webContents.send(
//             'message-from-main',
//             `Connected with ${rinfo.address}:${rinfo.port}`
//         )

//         // Forward the packet to the emulator
//         forwardPacket(msg, publicPort + 1, LOCAL_EMULATOR_IP)
//     })

//     // Handle errors
//     udpSocket.on('error', (err) => {
//         if (!udpSocket) return
//         console.error('UDP socket error:', err)
//         udpSocket.close()
//     })

//     function forwardPacket(data, targetPort, targetIP) {
//         if (!udpSocket) return
//         console.log('forwarding message to', targetIP, targetPort)
//         udpSocket.send(data, targetPort, targetIP, (err) => {
//             if (err) console.log(`Proxy forwarding Error: ${err.message}`)
//         })
//     }
//     // udpSocket.close()
//     // udpSocket = null;
//     return { publicIp, publicPort }
// }