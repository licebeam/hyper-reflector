import { app, BrowserWindow, ipcMain, dialog, Notification, protocol } from 'electron'
import started from 'electron-squirrel-startup'
import { sendCommand, readCommand, readStatFile } from './sendHyperCommands'
import { startPlayingOnline, startSoloMode } from './loadFbNeo'
import { getConfig, type Config } from './config'
import keys from './private/keys'
// external api
import api from './external-api/requests'
// p2p networking
const dgram = require('dgram')
import upnp from './upnp/nat-upnp'
let upnpClient: null | any = null // This is used for the unpnp object.
let proxyListener: null | any = null // This is a socket server that is used to handle proxying data to the emulator.
const portForUPNP = 7000

let currentTargetIp = '127.0.0.1' // We change this if we get a message from player and try to target that ip.
let currentTargetPort = 7000 // We change this when we recieve a message from a player on a different port, this means one is not using upnp.
let currentPlayerNum = 0 // We change this when we recieve a message first otherwise we are player 1 unless specified somewhere else.

// - FIREBASE AUTH CODE - easy peasy
import { initializeApp } from 'firebase/app'
import { getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { firebaseConfig } from './private/firebase'

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
        height: 600,
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
                        console.log('writing to: ', res)
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

    // firebase login
    async function handleLogin(email: string, password: string) {
        mainWindow.webContents.send('logging-in', 'trying to log in')
        try {
            await signInWithEmailAndPassword(auth, email, password)
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
        try {
            signOut(auth)
                .then(() => {
                    mainWindow.webContents.send('logged-out', 'user logged out')
                })
                .catch((error) => {
                    console.log('user logging out failed', error)
                })
        } catch (error) {
            console.log(error)
        }
    }

    // handle ipc calls
    ipcMain.on('login-user', async (event, login) => {
        // this line seems to fail on mac??
        const loginObject = await api
            .getLoggedInUser(login.email)
            .catch((err) => console.log('error checkig if user was loggin in', err))
        console.log(loginObject)
        if (loginObject && loginObject.loggedIn) return
        await handleLogin(login.email, login.pass).catch((err) => console.log('failed to log in'))
        await api
            .addLoggedInUser(auth)
            .catch((err) => console.log('failed to add user to logged in users list'))
        //test first time log
        await api
            .createAccount(auth, login.name, login.email)
            .catch((err) => console.log('failed to create new account'))
        const user = await api.getUserByAuth(auth)
        if (user) {
            // send our user object to the front end
            mainWindow.webContents.send('login-success', {
                name: user.userName,
                email: user.userEmail,
                uid: user.uid,
            })
            userUID = user.uid
            console.log('user is: ', user)
        }
    })

    ipcMain.on('log-out', async (event, login) => {
        console.log('should log out user', login)
        await api.removeLoggedInUser(auth)
        handleLogOut()
    })

    ipcMain.on('check-logged-in', async (event, uid) => {
        const isLoggedIn = await api.getLoggedInUser(uid)
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
            currentTargetIp = ip
        }
        // TODO: add error handling this is an important function.
    })

    ipcMain.on('startOnlineMatch', (event, data) => {
        if (!currentTargetIp) {
            console.log('hey current target ip was not ready, retry')
        }
        mainWindow.webContents.send('message-from-main', 'starting match')
        startPlayingOnline({
            config,
            localPort: portForUPNP || 7000,
            remoteIp: currentTargetIp || '127.0.0.1',
            remotePort: currentTargetPort || 7001,
            player: data.player,
            delay: data.delay,
            isTraining: false, // Might be used in the future.
        })
    })

    ipcMain.on('start-solo-mode', (event) => {
        startSoloMode({ config })
    })

    // send a message off to websockets for other users to see and save our message on our front end.
    ipcMain.on('sendMessage', (event, text: string) => {
        // here we can parse the string etc
        console.log('Main process received message:', text)
        mainWindow.webContents.send('user-message', text)
    })

    // this is used by websockets to populate our chat room with other peoples messages
    ipcMain.on('roomMessage', (event, messageObject) => {
        mainWindow.webContents.send('room-message', messageObject)
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
        const complete = await api.changeUserName(auth, name)
        mainWindow.webContents.send('user-name-changed', complete)
    })

    // ipcMain.on('createAccount', async (event, name, email) => {
    //     const complete = await api.createAccount(auth, name, email)
    //     // mainWindow.webContents.send('user-account-created', complete)
    // })

    // and load the index.html of the app.
    if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
        mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL)
    } else {
        mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`))
    }

    // handle cleanup on closing window
    mainWindow.on('close', async (event) => {
        console.log('closing app as', userUID)
        await handleExitApp()
        event.preventDefault()
    })
}

async function handleExitApp() {
    if (proxyListener !== null) {
        console.log('closing proxy server')
        await proxyListener.close()
        proxyListener = null
    }
    if (upnpClient !== null) {
        await upnpClient.portUnmapping({ public: portForUPNP }, (err) => {
            if (!err) return
            console.log('failed to close port', err)
        })
        setTimeout(() => {
            upnpClient.close()
        }, 500)
    }
    if (userUID) {
        // remove user from websockets and log them out of firebase on close
        await api.removeLoggedInUser(auth)
        mainWindow?.webContents.send('closing-app', { uid: userUID })
    }
    setTimeout(() => {
        mainWindow?.destroy() // force window to close when we finish
    }, 500)
}

// Listen for a request and respond to it
ipcMain.on('request-data', (event) => {
    event.sender.send('response-data', {
        msg: 'Here is some data from ipcMain',
    })
})

// read files
setInterval(() => {
    // currently we aren't really using this polling, but we will eventually need something like this
    readCommand();
}, 1000) // read from reflector.text every 1000 ms

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow)

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', async () => {
    await handleExitApp()
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

app.on('before-quit', async () => {
    console.log('app trying to quit')
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
    ipcMain.on('updateStun', async (event, { port, ip, extPort }) => {
        // we must initialize the client here or nothing works correctly.
        upnpClient = upnp.createClient()

        await upnpClient?.portUnmapping({ public: portForUPNP }, (err) => {
            if (!err) return
            //console.log('failed to close port', err)
        })

        // listener and proxy.
        proxyListener = dgram.createSocket('udp4')

        proxyListener.bind(portForUPNP, () => {
            console.log(`proxy listening on port ${portForUPNP}...`)
        })

        // we use this to send traffic from 7000 to 7001
        proxyListener.on('message', (msg, rinfo) => {
            // we should check that we aren't getting requests from random IPs

            if (rinfo.port !== 7000) {
                currentTargetPort = rinfo.port
                console.log('Player isnt using upnp -> changing target port to: ', rinfo.port)
            }

            // prevent keep alive from being forwarded to the emulator - it crashes
            const messageContent = msg.toString()
            if (messageContent === 'ping') {
                console.log(`Ignoring keep-alive message from ${rinfo.address}:${rinfo.port}`)
                return
            }
            // debug to see realtime packets from your opponents emulator.
            // console.log(`proxy recieved packet: ${msg} from ${rinfo.address}:${rinfo.port}`)

            // Forward packet to emulator on or listen port + 1 on localhost
            // supposedly this shouldn't add much overhead in lag, we'll need to run some tests.
            forwardPacket(msg, 7000 + 1, '127.0.0.1')
        })

        function forwardPacket(data, targetPort, targetIP) {
            const socket = dgram.createSocket('udp4')
            socket.send(data, targetPort, targetIP, (err) => {
                if (err) console.log(`Proxy forwarding Error: ${err.message}`)
                socket.close()
            })
        }

        // unpn mapping and usage
        upnpClient.portMapping(
            {
                public: portForUPNP,
                private: portForUPNP,
                ttl: 0,
                protocol: 'UDP',
            },
            function (err) {
                if (err) {
                    console.error(`Failed to set up UPnP: ${err.message}`)
                    sendLog(`Failed to set up UPnP: ${err.message}`)
                } else {
                    console.log(`UPnP Port Mapping created: ${portForUPNP} , ${portForUPNP}}`)
                    sendLog(`UPnP Port Mapping created: ${portForUPNP} , ${portForUPNP}}`)
                }
            }
        )

        upnpClient.getMappings({ local: true }, function (err, results) {
            console.log(results)
            sendLog(results)
        })

        upnpClient.externalIp(function (err, ip) {
            console.log(ip)
            if (err) {
                console.log('failed to get external ip')
            }
        })

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
    })
})
