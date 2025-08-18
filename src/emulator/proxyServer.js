import { spawn, exec } from 'child_process'
import dgram from 'dgram'
import { app } from 'electron'
import path from 'path'
import keys from '../private/keys'
import { startPlayingOnline } from '../loadFbNeo'

let mainWindow = null
let spawnedEmulator = null // We use this to store the emulator instance reference.
let config = null // we get a reference to our config and send use it when starting the emulator
let proxyStartData
let keepAliveInterval = null
let localSocket = null // This listens for keep alive requests and collects data to send to the emulator
let emulatorListener = null // This is the emulators listening port when we send data to this it sends data to the emulator
let opponentEndpoint = null // This is the address and port we use to reach our opponent.
let userUID = null // we'll send this in from main.ts
let userName = null
let opponentUID = null
let currentGameName = null

async function runProxyServer(
    data,
    myUID,
    userNameReference,
    configReference,
    mainWindowReference,
    gameNameReference
) {
    // set our matching out sidevariables to be that of main
    mainWindow = mainWindowReference
    userUID = myUID
    userName = userNameReference
    config = configReference
    proxyStartData = data
    currentGameName = gameNameReference

    console.log('socket data: ', data)
    // Make sure we kill everything if it exists as soon as we start a new connection
    await killProxyServer()

    // start our local sockets
    if (!localSocket) {
        console.log('opening localSocket')
        try {
            // This is the port we listen on when we holepunch
            localSocket = dgram.createSocket('udp4')
            localSocket.bind(() => {
                console.log('localSocket bound to random port:', localSocket.address())
            })
        } catch (error) {
            console.error('Error opening localSocket:', error)
        }
    }
    // start the emulator socket
    if (!emulatorListener) {
        console.log('opening emulatorListener')
        try {
            emulatorListener = dgram.createSocket('udp4')
            emulatorListener.bind(7001, () => {
                console.log('emulatorListener bound to port 7001')
            })
        } catch (error) {
            console.error('Error opening emulatorListener:', error)
        }
    }

    if (localSocket && emulatorListener) {
        console.log('STARTING GAME ONLINE')
        try {
            // Read socket messages
            localSocket.on('message', function (message, remote) {
                const messageContent = message.toString()
                // TODO: we should check if after a period of time, we don't get a sucessful message back from the server and kill localSockets etc.
                if (messageContent === 'ping' || message.includes('"port"')) {
                    // if our message contains port we start sending keep alives.
                    if (message.includes('"port"') && !keepAliveInterval) {
                        keepAliveInterval = setInterval(() => {
                            sendMessageToB(
                                opponentEndpoint.peer.address,
                                opponentEndpoint.peer.port,
                                'ping'
                            )
                        }, 1000)
                    }
                } else {
                    // console.log('message from other user', message)
                    // This is a message to the proxy from our opponent, we then send that information directly to the listening port of the emulator.
                    emulatorListener.send(message, 0, message.length, 7000, '127.0.0.1')
                }
                try {
                    opponentEndpoint = JSON.parse(message)
                    currentMatchId = opponentEndpoint.matchId || null
                    sendMessageToB(opponentEndpoint.peer.address, opponentEndpoint.peer.port)
                } catch (err) {}
            })
        } catch (error) {
            console.log('error in socket', error)
        }

        // If the emulator wants to send a message we proxy it to the other player.
        try {
            emulatorListener.on('message', function (message, remote) {
                sendMessageToB(opponentEndpoint.peer.address, opponentEndpoint.peer.port, message)
            })
        } catch (error) {
            console.log('error in emu socket', error)
        }

        sendMessageToS(false)
    }
}

function sendMessageToS(kill) {
    console.log('message to server data', proxyStartData)
    const serverPort = keys.PUNCH_PORT // revert this after killing all of the new services
    const serverHost = keys.COTURN_IP
    console.log(userUID, '- is trying to kill connection? ' + kill)
    const message = new Buffer(
        JSON.stringify({
            uid: userUID || proxyStartData.myId,
            peerUid: proxyStartData.opponentUID,
            kill,
        })
    )
    opponentUID = proxyStartData.opponentUID // used for sending match data to the server
    console.log(
        'sending this message to server',
        JSON.stringify({
            uid: userUID || proxyStartData.myId,
            peerUid: proxyStartData.opponentUID,
            kill,
        })
    )
    try {
        localSocket.send(message, 0, message.length, serverPort, serverHost, function (err) {
            if (err) return console.log(err)
            console.log('UDP message sent Server ' + serverHost + ':' + serverPort)
        })
    } catch (error) {
        console.log('could not send message to server')
        mainWindow.webContents.send('endMatch', userUID)
    }
}

let message = ''
async function sendMessageToB(address, port, msg = '') {
    if (!spawnedEmulator) {
        console.log('Starting emulator...')
        spawnedEmulator = await startEmulator(address, port)
        console.log('Emulator started')
    }

    if (msg.length >= 1) {
        message = new Buffer(msg)
    } else {
        message = new Buffer('ping')
    }
    try {
        if (!localSocket) return
        localSocket.send(message, 0, message.length, port, address, function (err, nrOfBytesSent) {
            if (err) return console.log(err)
            // console.log('UDP message sent to B:', address + ':' + port)
        })
    } catch (error) {
        console.log('could not send message user B')
        killProxyServer()
        // TODO: should we really close the sockets like this?
        mainWindow.webContents.send('endMatch', userUID)
    }
}

async function startEmulator(address, port) {
    console.log('Starting emulator for player:', address, port)
    return await startPlayingOnline({
        config,
        localPort: 7000,
        remoteIp: '127.0.0.1',
        remotePort: emulatorListener.address().port,
        player: proxyStartData.player + 1, // This depends on the emulator
        delay: parseInt(config.app.emuDelay),
        playerName: userName || 'Unknown',
        isTraining: false, // Might be used in the future.
        otherGameName: currentGameName || null, // just for fun
        callBack: (isOnOpen) => {
            if (isOnOpen) {
                mainWindow.webContents.send('sendAlert', {
                    type: 'error',
                    message: {
                        title: 'Emulator failed to open.',
                        description: 'Failed to open emulator, please check your path',
                    },
                })
            }
            console.log('callback firing off')
            sendMessageToS(true)
            killProxyServer()
            mainWindow.webContents.send('endMatch', userUID)
            // get user out of challenge pool
        },
    })
}

async function killProxyServer() {
    if (localSocket) {
        try {
            await localSocket.close()
            localSocket = null
        } catch (error) {
            console.error('Error closing localSocket:', error)
        }
    }
    if (emulatorListener) {
        try {
            await emulatorListener.close()
            emulatorListener = null
        } catch (error) {
            console.error('Error closing emulatorListener:', error)
        }
    }
    if (keepAliveInterval) {
        clearInterval(keepAliveInterval)
        keepAliveInterval = null
    }
}

function killProcessByName(processName) {
    exec(`taskkill /F /IM ${processName}`, (error, stdout, stderr) => {
        if (error) {
            console.error(`Failed to kill ${processName}: ${error.message}`)
            return
        }
        console.log(`${processName} killed successfully:\n${stdout}`)
    })
}

async function killEmulator() {
    await mainWindow?.webContents.send(
        'message-from-main',
        'Attempting to gracefully close emulator'
    )

    if (spawnedEmulator) {
        const pid = spawnedEmulator.pid
        console.log('Attempting to terminate emulator, PID:', pid)

        spawnedEmulator.on('close', (code, signal) => {
            console.log(`Emulator process closed. Code: ${code}, Signal: ${signal}`)
            spawnedEmulator = null
        })

        try {
            spawnedEmulator.kill('SIGTERM')
        } catch (e) {
            console.error('Error sending SIGTERM:', e)
        }

        setTimeout(() => {
            if (spawnedEmulator) {
                console.warn('Process still alive after 2s. Forcing SIGKILL...')
                try {
                    spawnedEmulator.kill('SIGKILL')
                } catch (e) {
                    console.error('Failed to SIGKILL:', e)
                }
            }
        }, 2000)

        if (process.platform === 'win32') {
            exec(`taskkill /PID ${pid} /F /T`, (err, stdout, stderr) => {
                if (err) {
                    console.error(`taskkill failed for PID ${pid}:`, err)
                } else {
                    console.log(`taskkill succeeded for PID ${pid}`)
                }
            })

            const pathEnd = config.emulator.fbNeoPath
            const slicedPathEnd = pathEnd && pathEnd.split('\\').pop()

            if (slicedPathEnd === 'fs-fbneo.exe') {
                killProcessByName('fs-fbneo.exe')
            } else if (slicedPathEnd === 'fcadefbneo.exe') {
                killProcessByName('fcadefbneo.exe')
            }
        }

        await mainWindow?.webContents.send('message-from-main', 'Emulator exists, closing')
    } else {
        console.log('No emulator process found to kill.')
    }

    // killSocketAndEmu();
    clearStatFile()
    mainWindow?.webContents.send('endMatchUI', userUID)
}

export { killEmulator, runProxyServer }
