// Golang proxy setup and path
// let proxyProc = null // used to spawn the goProxy

// function resolveGoProxyPath() {
//     const exe = process.platform === 'win32' ? 'goProxy.exe' : 'goProxy'
//     const isProd = app.isPackaged

//     if (isProd) {
//         const p = path.join(process.resourcesPath, 'emulator', exe)
//         return p
//     }

//     const projectRoot = path.resolve(__dirname, '..', '..')
//     const p = path.join(projectRoot, 'src', 'emulator', exe)
//     return p
// }

// const goProxyPath = resolveGoProxyPath()

// package main

// import (
// 	"fmt"
// )

// func main() {
// 	fmt.Print("test")
// }

// New Golang proxy code
// const args = [
//     `-serverHost=${keys.COTURN_IP}`,
//     `-serverPort=${keys.PUNCH_PORT}`,
//     `-uid=${userUID}`,
//     `-peerUID=${proxyStartData.opponentUID}`,
//     `-emuIn=7004`,
//     `-emuOut=7005`,
// ]

// try {
//     proxyProc = spawn(goProxyPath, args, {
//         cwd: process.cwd(),
//     })

//     proxyProc.stdout.on('data', (data) => {
//         console.log(`prxy data: ${data.toString()}`)
//     })

//     proxyProc.stderr.on('data', (data) => {
//         console.error(`prxy error: ${data.toString()}`)
//         return 'prxy error'
//     })

//     // Listen for process exit
//     proxyProc.on('exit', (code, signal) => {
//         if (code !== null) {
//             console.log(`prxy exit ${code}`)
//         } else {
//             console.log(`prxy exit signal ${signal}`)
//         }
//     })

//     proxyProc.on('error', (error) => {
//         console.error(`prxy error: ${error.message}`)
//     })
// } catch (error) {
//     console.error(`Launch error prxy: ${error}`)
// }