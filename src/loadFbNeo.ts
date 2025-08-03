const { spawn } = require('child_process')
import { Config } from './config'
import path from 'path'


export function launchGGPOSpawn(command: string, callBack: (isOnOpen?: boolean) => any) {
    try {
        const [cmd, ...args] = command.split(' ')
        const child = spawn(cmd, args, { shell: true, stdio: ['ignore', 'pipe', 'pipe'] })

        child.stdout.on('data', (data) => {
            console.log(`[FBNeo]: ${data.toString()}`)
        })

        // Capture stderr (errors)
        child.stderr.on('data', (data) => {
            console.error(`[FBNeo Error]: ${data.toString()}`)
            return 'test error'
        })

        // Listen for process exit
        child.on('exit', (code, signal) => {
            // call the kill code
            if (callBack) {
                console.log('emulator callback', callBack, code, signal)
                callBack()
            }

            if (code !== null) {
                console.log(`FBNeo exited with code ${code}`)
                if (code === 1 && callBack) {
                    callBack(true) // failed to open
                }
            } else {
                console.log(`FBNeo terminated by signal ${signal}`)
            }
        })

        // Listen for errors
        child.on('error', (error) => {
            console.error(`Failed to start FBNeo: ${error.message}`)
        })

        return child // Return process reference
    } catch (error) {
        console.error(`Launch error: ${error}`)
    }
}

function fbNeoCommand(config: Config) {
    const { fbNeoPath } = config.emulator
    console.log({ platform: process.platform })
    switch (process.platform) {
        case 'darwin':
            return `wine "${fbNeoPath}"`
        case 'linux':
            return `wine "${fbNeoPath}"`
        default:
            return `"${fbNeoPath}"`
    }
}

/**
 * for these file paths like fbneo path and lua path, we need some way to access this directly through electron so we do no need to update all of the time.
 */
export function startPlayingOnline({
    config,
    localPort,
    remoteIp,
    remotePort,
    player,
    playerName,
    delay,
    isTraining = false,
    callBack,
}: {
    config: Config
    localPort: number
    remoteIp: string
    remotePort: number
    player: number
    playerName: string
    delay: number
    isTraining: boolean
    callBack: (isOnOpen?: boolean) => any
}) {
    // TODO actually implement this
    let luaPath = config.emulator.luaPath
    if (isTraining) {
        luaPath = config.emulator.trainingLuaPath
    }

    const pathEnd = config.emulator.fbNeoPath
    const slicedPathEnd = pathEnd && path.basename(pathEnd)
    let directCommand

    if (slicedPathEnd === 'fs-fbneo.exe') {
        directCommand = `${fbNeoCommand(config)} --rom sfiii3nr1 --lua ${luaPath} direct --player ${player} -n ${playerName} -l 127.0.0.1:7000 -r 127.0.0.1:7001 -d ${delay}` //fs verison
    } else if (slicedPathEnd === 'fcadefbneo.exe') {
        directCommand = `${fbNeoCommand(config)} quark:direct,sfiii3nr1,${localPort},127.0.0.1,${7001},${player},${delay},0 --lua ${luaPath}` // for fc version
    }
    // console.log("starting game on ", `${"127.0.0.1" + ':' + localPort}`, 'sending to: ', `${remoteIp + ':' + remotePort}`, player, playerName)

    switch (process.platform) {
        case 'darwin':
            return launchGGPOSpawn(directCommand, callBack)
        case 'linux':
            return launchGGPOSpawn(directCommand, callBack)
        default:
            return launchGGPOSpawn(directCommand, callBack)
    }
}

// Current Path: C:\Users\dusti\Desktop\hyper-reflector\out\hyper-reflector-win32-x64\resources\emu\hyper-screw-fbneo

export function startSoloMode({
    config,
    callBack,
}: {
    config: Config
    callBack: (isOnOpen?: boolean) => any
}) {
    const pathEnd = config.emulator.fbNeoPath
    const slicedPathEnd = pathEnd && path.basename(pathEnd)
    let directCommand

    // uncomment to send use the match data sender
    // let luaPath = config.emulator.luaPath
    // directCommand = `${fbNeoCommand(config)} --rom sfiii3nr1 --lua ${luaPath}`

    if (slicedPathEnd === 'fs-fbneo.exe') {
        directCommand = `${fbNeoCommand(config)} --rom sfiii3nr1 --lua ${config.emulator.trainingLuaPath}` // fs fbneo
    } else if (slicedPathEnd === 'fcadefbneo.exe') {
        directCommand = `${fbNeoCommand(config)} -game sfiii3nr1 ${config.emulator.trainingLuaPath}`
    }
    return launchGGPOSpawn(directCommand, callBack)
}

module.exports = {
    startPlayingOnline,
}
