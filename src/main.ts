import { app, BrowserWindow, ipcMain, dialog, Notification } from 'electron'
import started from 'electron-squirrel-startup'
import { sendCommand, readCommand, readStatFile } from './sendHyperCommands'
import { startPlayingOnline, startSoloMode } from './loadFbNeo'
import { getConfig, type Config } from './config'
import keys from './private/keys'
// external api
import api from './external-api/requests'

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

const createWindow = () => {
    // Create the browser window.
    const mainWindow = new BrowserWindow({
        width: 1200,
        height: 600,
        webPreferences: {
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
            // getEmulatorPath()
        } catch (error) {
            console.log(error)
        }
    }

    // firebase test
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

    //
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

    ipcMain.on('startOnlineMatch', (event, data) => {
        mainWindow.webContents.send('message-from-main', 'starting match')
        startPlayingOnline({
            config,
            localPort: data.myPort || 7000,
            remoteIp: data.ip || '127.0.0.1',
            remotePort: data.port || 7001,
            player: data.player,
            delay: data.delay,
        })
    })

    ipcMain.on('startP2', (event, data) => {
        startPlayingOnline({
            config,
            localPort: 7001,
            remoteIp: data.ip || '127.0.0.1',
            remotePort: data.port || 7000,
            player: 1,
            delay: 0,
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

    // Open the DevTools.
    mainWindow.webContents.openDevTools()

    // handle cleanup on closing window
    mainWindow.on('close', async (event) => {
        console.log('closing app as', userUID)
        event.preventDefault()
        if (userUID) {
            // remove user from websockets and log them out of firebase on close
            await api.removeLoggedInUser(auth)
            mainWindow?.webContents.send('closing-app', { uid: userUID })
        }
        setTimeout(() => {
            mainWindow?.destroy() // force window to close when we finish
        }, 500)
    })
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
    // readCommand();
}, 1000) // read from reflector.text every 1000 ms

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow)

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

app.on('activate', () => {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
    }
})

// port proxy code
const dgram = require('dgram')
let listener = null // Store the listener globally
let expected_peer_ip = 'x.x.x.x' // Replace with STUN-discovered external IP
let stun_port = 50000 // Default STUN port
let emulatorPort = null // Will update dynamically

app.whenReady().then(() => {
    ipcMain.on('updateStun', async (event, { port, ip }) => {
        console.log('Updating STUN conditions:', port, '-', ip)

        // Close existing listener if it exists
        if (listener) {
            console.log(`Closing previous listener on port ${stun_port}`)
            listener.close()
            listener = null
        }

        // Update STUN variables
        stun_port = port
        expected_peer_ip = ip
        emulatorPort = null

        // Create a new UDP listener
        listener = dgram.createSocket('udp4')

        listener.on('message', (msg, rinfo) => {
            console.log(
                `📥 Received packet from ${rinfo.address}:${rinfo.port} - Size: ${msg.length}`
            )
            // Check if message is from the expected peer
            if (rinfo.address === expected_peer_ip) {
                if (!emulatorPort) {
                    emulatorPort = rinfo.port // Capture the emulator's real port
                    console.log(`Detected emulator port: ${emulatorPort}`)
                }

                // Forward packets to emulator's actual port
                console.log(
                    `🔄 Routing packet from ${rinfo.address}:${rinfo.port} → Emulator ${stun_port}`
                )
                forwardPacket(msg, stun_port, expected_peer_ip)
            }
        })

        listener.on('error', (err) => {
            console.log(`UDP Error: ${err.message}`)
            listener.close()
            listener = null
        })

        // Function to forward packets
        function forwardPacket(data, targetPort, targetIP) {
            const socket = dgram.createSocket('udp4')
            socket.send(data, targetPort, targetIP, (err) => {
                if (err) console.log(`Forwarding Error: ${err.message}`)
                socket.close()
            })
        }

        // Bind to STUN port (initial listening point)
        listener.bind(stun_port, () => {
            console.log(`Listening on STUN port ${stun_port}...`)
        })
    })
})

// app.whenReady().then(() => {
//     //UDP STUFF
//     const dgram = require('dgram')
//     const axios = require('axios')

//     const client = dgram.createSocket('udp4')

//     const SERVER_IP = keys.COTURN_IP // Change to public server IP
//     const UDP_SERVER_PORT = 7000
//     const EXPRESS_API = `http://${keys.COTURN_IP}:7010`

//     const CLIENT_ID = Math.random().toString(36).substring(7)

//     client.on('message', (msg, rinfo) => {
//         // Convert to string and trim any extra whitespace or binary junk
//         const incomingMessage = msg.toString('utf8').trim()

//         // Log any unexpected data to see what is coming in
//         if (!incomingMessage || !incomingMessage.includes(':')) {
//             console.log(
//                 `Received invalid or empty message from ${rinfo.address}:${rinfo.port} - ${incomingMessage}`
//             )
//             return
//         }

//         console.log(`Received message from ${rinfo.address}:${rinfo.port} - ${incomingMessage}`)

//         // Ensure the message is a valid IP:Port format
//         const [peerIp, peerPort] = incomingMessage.split(':')

//         // Validate IP and port
//         if (!peerIp || !peerPort || isNaN(peerPort)) {
//             console.error('Invalid peer data received:', incomingMessage)
//             return
//         }

//         console.log(`Valid peer info received: ${peerIp}:${peerPort}`)

//         // Start hole punching
//         setInterval(() => {
//             console.log(`Punching hole to ${peerIp}:${peerPort}`)
//             client.send('punch', peerPort, peerIp)
//         }, 1000)

//         if (peerIp) {
//             const sendClient = dgram.createSocket('udp4')
//             console.log('Sending packet to', peerIp)
//             setInterval(() => {
//                 const message = Buffer.from('keep-alive')
//                 client.send(message, peerPort, peerIp, (err) => {
//                     if (err) console.error('Error:', err)
//                     else console.log('Keep-alive sent!')
//                 })
//             }, 2000)
//         }
//     })

//     client.on('listening', () => {
//         const address = client.address()
//         console.log(`Client listening on ${address.address}:${address.port}`)

//         // Register with the Express API
//         axios
//             .post(`${EXPRESS_API}/register`, {
//                 id: CLIENT_ID,
//                 ip: address.address,
//                 port: address.port,
//             })
//             .then((response) => {
//                 console.log('Server Response:', response.data)
//             })
//             .catch((err) => console.error(err))

//         // Send initial UDP message to register
//         client.send(CLIENT_ID, UDP_SERVER_PORT, SERVER_IP)
//     })

//     client.bind(0) // Binds to a random port
// })

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
