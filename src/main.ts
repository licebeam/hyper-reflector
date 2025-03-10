import { app, BrowserWindow, ipcMain, dialog, Notification } from 'electron'
import started from 'electron-squirrel-startup'
import { sendCommand, readCommand, readStatFile } from './sendHyperCommands'
import { startPlayingOnline, startSoloMode } from './loadFbNeo'
import { getConfig, type Config } from './config'
// updating automatically
import { updateElectronApp, UpdateSourceType } from 'update-electron-app'
updateElectronApp()
import keys from './private/keys'
// external api
import api from './external-api/requests'
// p2p networking
import { udpHolePunch, killUdpSocket, startHolePunching } from './networking/udpHolePunching'
import { startUPNP, portForUPNP } from './networking/upnpRunner'
let opponentIp = '127.0.0.1' // We change this if we get a message from player and try to target that ip.
let opponentPort = 7000 // We change this when we recieve a message from a player on a different port, this means one is not using upnp.
// Emulator reference
let spawnedEmulator = null //used to handle closing the emulator process
//for testing purposes
let currentEmuPort = 0
let currentProxyPort = 0
//

// - FIREBASE AUTH CODE - easy peasy
import { initializeApp } from 'firebase/app'
import {
    getAuth,
    signInWithEmailAndPassword,
    signOut,
    createUserWithEmailAndPassword,
} from 'firebase/auth'
import { firebaseConfig } from './private/firebase'
import { TLogin } from './types'

// Initialize Firebase
const fbapp = initializeApp(firebaseConfig)

// Initialize Firebase Authentication and get a reference to the service
const auth = getAuth(fbapp)
// END FIREBASE

const fs = require('fs')
const path = require('path')

const isDev = !app.isPackaged

let userUID: string | null = null
let filePathBase = process.resourcesPath
//handle dev mode toggle for file paths.
if (isDev) {
    filePathBase = path.join(app.getAppPath(), 'src')
}

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
    app.quit()
}

let mainWindow: BrowserWindow | null

// helpers
const sendLog = (text: string) => {
    // if (!mainWindow) return
    mainWindow.webContents.send('send-log', text)
}

const createWindow = () => {
    // Create the browser window.
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 700,
        webPreferences: {
            nodeIntegration: true,
            preload: path.join(__dirname, 'preload.js'),
        },
        autoHideMenuBar: true,
    })

    let config: Config

    try {
        config = getConfig()
        console.log({ config })
    } catch (error) {
        mainWindow.webContents.send('message-from-main', error)
        console.error('Failed to read file:', error)
    }

    // Open the DevTools.
    mainWindow.webContents.openDevTools()

    if (!config.app.emuPath) {
        new Notification({
            title: 'error',
            body: 'incorrect file path for your emulator',
        }).show()
    }

    const setEmulatorPath = async () => {
        try {
            await dialog
                .showOpenDialog({ properties: ['openFile', 'openDirectory'] })
                .then((res) => {
                    try {
                        // write our file path to the config.txt file
                        const filePath = path.join(filePathBase, 'config.txt')
                        mainWindow.webContents.send('message-from-main', res)
                        console.log('CONFIG: writing to: ', res)
                        fs.writeFileSync(filePath, `emuPath=${res.filePaths[0]}`, {
                            encoding: 'utf8',
                        })
                    } catch (error) {
                        mainWindow.webContents.send('message-from-main', error)
                        console.error('Failed to write to config file:', error)
                    }
                })
                .catch((err) => console.log(err))
        } catch (error) {
            console.log(error)
        }
    }

    const getEmulatorPath = () => {
        mainWindow.webContents.send('emulatorPath', config.app.emuPath)
    }

    const setEmulatorDelay = async (delayNum: number) => {
        console.log('attempting set delay', delayNum)
        try {
            const filePath = path.join(filePathBase, 'config.txt')
            mainWindow.webContents.send('message-from-main', `Set emulator delay to: ${delayNum}`)

            // Read the existing file
            let fileContent = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : ''

            // Split the file into lines
            let lines = fileContent.split('\n')

            // Find and update the delay line
            let found = false
            lines = lines.map((line: string) => {
                if (line.startsWith('emuDelay=')) {
                    found = true
                    return `emuDelay=${delayNum}` // Replace the delay line
                }
                return line // Keep other lines the same
            })

            // If no emuDelay= line exists, append it
            if (!found) {
                lines.push(`emuDelay=${delayNum}`)
            }

            // Write back the modified content
            fs.writeFileSync(filePath, lines.join('\n'), 'utf8')

            console.log(`CONFIG: Updated delay to ${delayNum}`)
        } catch (error) {
            mainWindow.webContents.send('message-from-main', error)
            console.error('Failed to write to config file:', error)
        }
    }

    const getEmulatorDelay = () => {
        mainWindow.webContents.send('emulatorDelay', config.app.emuDelay)
    }

    // firebase login
    async function handleLogin({ email, pass }: TLogin) {
        mainWindow.webContents.send('logging-in', 'trying to log in')
        try {
            await signInWithEmailAndPassword(auth, email, pass)
                .then(() => {
                    return true
                })
                .catch((error) => {
                    const errorCode = error.code
                    const errorMessage = error.message
                    console.log('failed to log in', errorCode, errorMessage)
                    mainWindow.webContents.send('login-failed', 'login failed')
                })
        } catch (error) {
            console.log(error)
        }
    }

    async function handleLogOut() {
        await signOut(auth)
            .then(() => {
                try {
                    console.log('logout success')
                    mainWindow.webContents.send('loggedOutSuccess', 'user logged out')
                } catch (error) {
                    console.log('sending signal to fe to log out')
                }
            })
            .catch((error) => {
                console.log('user logging out failed', error)
            })
    }

    async function startLoginProcess(login: TLogin) {
        const loginObject = await api
            .getLoggedInUser(login.email)
            .catch((err) => console.log('error checkig if user was loggin in', err))
        if (loginObject && loginObject.loggedIn) {
            // user is already logged in, handle relog
            console.log('user was already logged in', loginObject)
            await handleLogOut()
        }
        await handleLogin({ email: login.email, pass: login.pass }).catch((err) =>
            console.log('failed to log in')
        )
        await api
            .addLoggedInUser(auth)
            .catch((err) => console.log('failed to add user to logged in users list'))
        //test first time log

        const user = await api
            .getUserByAuth(auth)
            .catch((err) => console.log('err getting user by auth'))
        if (user) {
            // send our user object to the front end
            mainWindow.webContents.send('loginSuccess', {
                name: user.userName,
                email: user.userEmail,
                uid: user.uid,
            })
            userUID = user.uid
            console.log('user is: ', user)
        }
    }

    // handle ipc calls
    ipcMain.on('loginUser', async (event, login) => {
        // this line seems to fail on mac??
        await startLoginProcess(login).catch((err) => console.log(err))
    })

    ipcMain.on('createAccount', async (event, info) => {
        await createUserWithEmailAndPassword(auth, info.email, info.pass)
            .then((userCredential) => {
                console.log('creating new account for user', info.email)
                const user = userCredential.user
                // account created successfully, send message to FE
                mainWindow.webContents.send('accountCreationSuccess')
            })
            .catch((error) => {
                const errorCode = error.code
                const errorMessage = error.message
                console.log('error adding user', info.email, error.code, error.message)
                // account creation failed, send message to FE
                return mainWindow.webContents.send('accountCreationFailure')
            })
        await api
            .createAccount(auth, info.name, info.email)
            .catch((err) => console.log('failed to create new account'))
        await startLoginProcess(info).catch((err) => console.log(err))
    })

    ipcMain.on('logOutUser', async (event, login) => {
        console.log('should log out user', userUID)
        await api.removeLoggedInUser(auth).catch((err) => console.log(err))
        await handleLogOut().catch((err) => console.log(err))
    })

    ipcMain.on('getLoggedInUser', async (event, uid) => {
        const isLoggedIn = await api.getLoggedInUser(uid).catch((err) => console.log(err))
        return isLoggedIn
    })

    // Web RTC stuff
    ipcMain.on('hand-shake-users', (event, type) => {
        mainWindow.webContents.send('hand-shake-users', type)
    })

    ipcMain.on('send-data-channel', (event, data) => {
        mainWindow.webContents.send('send-data-channel', data)
    })

    ipcMain.on('setEmulatorPath', () => {
        setEmulatorPath()
    })

    ipcMain.on('getEmulatorPath', () => {
        getEmulatorPath()
    })

    ipcMain.on('setEmulatorDelay', (event, delay) => {
        setEmulatorDelay(delay)
    })

    ipcMain.on('getEmulatorDelay', () => {
        getEmulatorDelay()
    })

    // receives text from front end sends it to emulator
    ipcMain.on('send-text', (event, text: string) => {
        sendCommand(`textinput:${text}`)
        // test functions
        readCommand()
        readStatFile(mainWindow)
    })

    ipcMain.on('send-command', (event, command) => {
        sendCommand(command)
        readCommand()
        // external api testing delete me later
        api.externalApiDoSomething(auth)
    })

    ipcMain.on('setTargetIp', (event, ip) => {
        // This data comes from renderer when we successfully use stun with another person.
        if (ip) {
            console.log('the current target IP = ', ip)
            opponentIp = ip
        }
        // TODO: add error handling this is an important function.
    })

    let localStunPort = 0
    ipcMain.on('serveMatch', async (event, data) => {
        // await startUPNP(mainWindow, sendLog)
        if (!opponentIp) {
            console.log('hey current target ip was not ready, retry')
        }
        mainWindow.webContents.send('message-from-main', 'starting match')
        const { publicPort, publicIp } = await udpHolePunch(data.ip, data.port, mainWindow)
            .then()
            .catch((err) => console.log('error starting udp socket', err))
        sendLog(`Starting the hole punching series ${publicPort}`)
        console.log('about to send stun over socket to renderer --0-0-0-0-0-0-0-0-0')
        try {
            await mainWindow.webContents.send('sendStunOverSocket', { publicIp, publicPort })
        } catch (error) {
            console.log('couldnt send stun over socket')
        }

        localStunPort = publicPort
    })

    ipcMain.on('startGameOnline', async (event, data) => {
        console.log(data)
        //{ ip: undefined, port: undefined, player: 0, delay: 0, myPort: 7000 }
        // try {
        //     await startHolePunching(data.ip, data.port, mainWindow)
        // } catch (error) {
        //     console.log('error starting hole punch', error)
        // }

        const emu = startPlayingOnline({
            config,
            localPort: localStunPort || 7000,
            remoteIp: data.ip || '127.0.0.1',
            remotePort: 7000,
            player: data.player || 0,
            delay: parseInt(config.app.emuDelay) || 0,
            isTraining: false, // Might be used in the future.
            callBack: () => {
                // attempt to kill the emulator
                mainWindow.webContents.send('endMatch', userUID)
                console.log('emulator should die')
                killUdpSocket()
            },
        })
        spawnedEmulator = emu // in the future we can use this to check for online training etc.
        currentEmuPort = portForUPNP
        mainWindow.webContents.send(
            'message-from-main',
            `${currentEmuPort} - current emulator listen port before proxy`
        )
    })

    ipcMain.on('serveMatchOffline', async (event, data) => {
        var dgram = require('dgram')
        let publicEndpointB
        // var keys = require('../private/keys')

        // based on http://www.bford.info/pub/net/p2pnat/index.html

        var socket = dgram.createSocket('udp4')
        var emuListener = dgram.createSocket('udp4')
        emuListener.bind(7001)

        // console.log(keys.default.COTURN_IP)

        socket.on('message', function (message, remote) {
            console.log(remote.address + ':' + remote.port + ' - ' + message)
            // if we don't get a ping we should forward it to the emulator
            // we probably shouldnt do any conversions to save time
            const messageContent = message.toString()
            if (messageContent === 'ping') {
                console.log(`Ignoring keep-alive message from ${remote.address}:${remote.port}`)
                try {
                    publicEndpointB = JSON.parse(message)
                    sendMessageToB(publicEndpointB.address, publicEndpointB.port)
                } catch (err) {}
            } else {
                // we should forward to the emulator if it's not a ping
                socket.send(message, 0, message.length, 7000, '127.0.0.1', (err) => {
                    if (err) console.log(`Forwarding error: ${err.message}`);
                });
            }
        })

        // get messages from our local emulator and send it to the other player socket
        emuListener.on('message', function (message, remote) {
            console.log(remote.address + ':' + remote.port + ' - ' + message)
            sendMessageToB(publicEndpointB.address, publicEndpointB.port, message)
        })

        function sendMessageToS() {
            var serverPort = 33333
            var serverHost = keys.COTURN_IP
            // var serverHost = '127.0.0.1'

            var message = new Buffer('A')
            socket.send(
                message,
                0,
                message.length,
                serverPort,
                serverHost,
                function (err, nrOfBytesSent) {
                    if (err) return console.log(err)
                    console.log('UDP message sent to ' + serverHost + ':' + serverPort)
                    // socket.close();
                }
            )
        }

        sendMessageToS()

        let isEmuOpen = false
        function sendMessageToB(address, port, msg = '') {
            if (!isEmuOpen) {
                isEmuOpen = startEmulator(address, port)
            }

            let message
            if(!msg.length){
                message = new Buffer('ping')
            } else {
                message = new Buffer(msg)
            }
            socket.send(message, 0, message.length, port, address, function (err, nrOfBytesSent) {
                if (err) return console.log(err)
                console.log('UDP message sent to B:', address + ':' + port)
                // This is the keep alive
                // setTimeout(function () {
                //     sendMessageToB(address, port)
                // }, 2000)
            })
        }

        function startEmulator(address, port) {
            console.log('EMULATOR SHOULD BE STARTING')
            console.log('Emulator listener port', emuListener.address().port)
            // console.log(socket.remoteAddress())
            const emu = startPlayingOnline({
                config,
                localPort: 7000,
                remoteIp: '127.0.0.1',
                remotePort: emuListener.address().port,
                player: 0,
                delay: 0,
                isTraining: false, // Might be used in the future.
                callBack: () => {
                    console.log('test')
                    // // attempt to kill the emulator
                    // mainWindow.webContents.send('endMatch', userUID)
                    // console.log('emulator should die')
                    // killUdpSocket()
                },
            })
            return emu
        }
        // console.log('data------------------------', data)
        // opponentIp = data.ip || '127.0.0.1' // we set this here since we aren't using the server, but it's still needed for upnp updating
        // opponentPort = data.port || 7000
        // console.log(`Connecting to ${data.ip}, Port: ${data.port}`)
        // // await startUPNP(mainWindow, sendLog).catch((err) => console.log('error starting upnp server', err))
        // const { publicPort, publicIp } = await udpHolePunch(data.ip, data.port, mainWindow)
        // await mainWindow.webContents.send('sendStunOverSocket', { publicIp, publicPort })

        // if (!opponentIp) {
        //     console.log('hey current target ip was not ready, retry')
        // }

        // mainWindow.webContents.send('message-from-main', 'starting match')
        // const emu = startPlayingOnline({
        //     config,
        //     localPort: publicPort || 7000,
        //     remoteIp: opponentIp || '127.0.0.1',
        //     remotePort: opponentPort || 7000, // if no target, retarget ourselves for testing
        //     player: data.player || 0,
        //     delay: parseInt(config.app.emuDelay) || 0,
        //     isTraining: false, // Might be used in the future.
        //     callBack: () => {
        //         // attempt to kill the emulator
        //         mainWindow.webContents.send('endMatch', userUID)
        //         console.log('emulator should die')
        //         killUdpSocket()
        //     },
        // })
        // spawnedEmulator = emu // in the future we can use this to check for online training etc.
        // currentEmuPort = portForUPNP
        // mainWindow.webContents.send(
        //     'message-from-main',
        //     `${currentEmuPort} - current emulator listen port before proxy`
        // )
    })

    ipcMain.on('killEmulator', () => {
        killUdpSocket()
        mainWindow.webContents.send('message-from-main', 'attempting to gracefully close emu')
        try {
            console.log('trying to close emulator')
            if (spawnedEmulator !== null) {
                spawnedEmulator.kill('SIGTERM')
                mainWindow.webContents.send('message-from-main', 'emulator exists closing')
            }
        } catch {
            mainWindow.webContents.send('message-from-main', 'could not close emu')
            console.log('failed to close emulator')
        }
    })

    // ipcMain.on('sendUDPMessage', () => {
    //     console.log('test')
    //     mainWindow.webContents.send('sendUDPMessage', 'this is a udp message')
    // })

    ipcMain.on('start-solo-mode', (event) => {
        startSoloMode({ config })
    })

    // send a message off to websockets for other users to see and save our message on our front end.
    ipcMain.on('sendMessage', (event, text: string) => {
        // here we can parse the string etc
        console.log('Main process received message:', text)
        mainWindow.webContents.send('sendMessage', text)
    })

    // this is used by websockets to populate our chat room with other peoples messages
    ipcMain.on('sendRoomMessage', (event, messageObject) => {
        mainWindow.webContents.send('sendRoomMessage', messageObject)
    })

    // add a user to the current chat room
    ipcMain.on('addUserToRoom', (event, userObject) => {
        mainWindow.webContents.send('room-users-add', userObject)
    })

    // remove user from the current chat room
    ipcMain.on('removeUserFromRoom', (event, userObject) => {
        mainWindow.webContents.send('room-users-remove', userObject)
    })

    ipcMain.on('addUserGroupToRoom', (event, users) => {
        mainWindow.webContents.send('room-users-add-group', users)
    })

    // PROFILE RELATED IPC CALLS
    ipcMain.on('changeUserName', async (event, name) => {
        const complete = await api.changeUserName(auth, name).catch((err) => console.log(err))
        mainWindow.webContents.send('user-name-changed', complete)
    })

    // matchmaking
    ipcMain.on('callUser', (event, data) => {
        mainWindow.webContents.send('callUser', data)
    })

    ipcMain.on('answerCall', (event, data) => {
        mainWindow.webContents.send('answerCall', { ...data, answererId: userUID })
    })

    ipcMain.on('receivedCall', (event, data) => {
        mainWindow.webContents.send('receivedCall', data)
    })

    // and load the index.html of the app.
    if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
        mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL)
    } else {
        mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`))
    }

    // handle cleanup on closing window
    mainWindow.on('close', async (event) => {
        console.log('closing app as', userUID)
        setTimeout(() => {
            mainWindow?.destroy() // force window to close when we finish
        }, 500)
        event.preventDefault()
    })
}

async function handleExitApp() {
    if (userUID) {
        // remove user from websockets and log them out of firebase on close
        await api.removeLoggedInUser(auth)
        await killUdpSocket()
        // mainWindow?.webContents.send('closingApp', { uid: userUID })
    }
    // if (proxyListener) {
    //     console.log('closing proxy server')
    //     await proxyListener.close()
    //     proxyListener = null
    // }
    // if (upnpClient) {
    //     // TODO fix this
    //     // this request is causing a lot of issues
    //     // await upnpClient
    //     //     .portUnmapping({ public: portForUPNP }, (err) => {
    //     //         if (!err) return
    //     //         console.log('failed to close port', err)
    //     //     })
    //     //     .catch((err) => console.log(err))
    //     setTimeout(() => {
    //         upnpClient.close()
    //     }, 500)
    // }
}

// Listen for a request and respond to it
ipcMain.on('request-data', (event) => {
    event.sender.send('response-data', {
        msg: 'Here is some data from ipcMain',
    })
})

// read files
const readInterval = setInterval(() => {
    // currently we aren't really using this polling, but we will eventually need something like this
    // we also need to set this up so it only works in a match.
    // readCommand()
}, 1000) // read from reflector.text every 1000 ms

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow)

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', async () => {
    if (readInterval) {
        clearInterval(readInterval)
    }
    await handleExitApp()
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

// app.on('before-quit', async () => {
//     console.log('app trying to quit')
// })

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Promise Rejection:', reason)
})

process.on('SIGINT', async () => {
    await handleExitApp()
    console.log('SIGINT received (CTRL+C or process kill)')
    app.quit()
})

process.on('SIGTERM', async () => {
    await handleExitApp()
    console.log('SIGTERM received (system shutdown or process termination)')
    app.quit()
})

app.on('activate', () => {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
    }
})

app.whenReady().then(async () => {
    // HOW THIS APP NETWORKS
    // first we set hit the stun server by logging in.
    // secondly we start listening for messages on port 7000
    // thirdly a user who wishes to connect upnp maps port 7000 for a networked connection
    // fourthly we start the emulator and we proxy incoming data from port 7000 to the emulators port of 7001
    // profit, users should be successfully connecting the emulators together with eachother.

    // UPNP is working! but we need to fix the upnp library so that we can make a build.
    ipcMain.on('updateStun', async (event, data) => {
        console.log('trying hole punching setup')
        // udpHolePunch(data.ip, data.port, mainWindow)
    })
})
