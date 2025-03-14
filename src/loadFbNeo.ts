const { spawn } = require('child_process')
import { Config } from './config'

export function launchGGPOSpawn(command: string, callBack: () => any) {
    try {
        const [cmd, ...args] = command.split(' ')
        let child
        switch (process.platform) {
            case 'darwin':
                child = spawn(cmd, args, { shell: true, stdio: ['ignore', 'pipe', 'pipe'] })
            case 'linux':
                child = spawn(cmd, args, { shell: true, stdio: ['ignore', 'pipe', 'pipe'] })
            default:
                child = spawn(cmd, args, { shell: true, stdio: ['ignore', 'pipe', 'pipe'] })
        }

        // Capture stdout (logs from emulator)
        child.stdout.on('data', (data) => {
            console.log(`[Fightcade-FBNeo]: ${data.toString()}`)
        })

        // Capture stderr (errors)
        child.stderr.on('data', (data) => {
            console.error(`[Fightcade-FBNeo Error]: ${data.toString()}`)
        })

        // Listen for process exit
        child.on('exit', (code, signal) => {
            // call the kill code
            if (callBack) {
                console.log('emulator callback', callBack)
                callBack()
            }

            if (code !== null) {
                console.log(`FBNeo exited with code ${code}`)
            } else {
                console.log(`FBNeo terminated by signal ${signal}`)
            }
        })

        // Listen for errors
        child.on('error', (error) => {
            console.error(`Failed to start Fightcade-FBNeo: ${error.message}`)
        })

        return child // Return process reference
    } catch (error) {
        console.error(`Launch error: ${error}`)
    }
}

function fightcadeCmd(config: Config) {
    const { fightcadePath } = config.emulator
    console.log({ platform: process.platform })
    switch (process.platform) {
        case 'darwin':
            return `wine "${fightcadePath}"`
        case 'linux':
            return `wine "${fightcadePath}"`
        default:
            return `"${fightcadePath}"`
    }
}

/**
 * for these file paths like fightcade path and lua path, we need some way to access this directly through electron so we do no need to update all of the time.
 */
export function startPlayingOnline({
    config,
    localPort,
    remoteIp,
    remotePort,
    player,
    delay,
    isTraining = false,
    callBack,
}: {
    config: Config
    localPort: number
    remoteIp: string
    remotePort: number
    player: number
    delay: number
    isTraining: boolean
    callBack: () => any
}) {
    console.log('starting EMULATOR FOR ===>>>', localPort, remoteIp, remotePort)
    console.log('emulator target might be listening on', remotePort + 1)
    let luaPath = config.emulator.luaPath
    if (isTraining) {
        luaPath = config.emulator.trainingLuaPath
    }
    const directCommand = `${fightcadeCmd(config)} quark:direct,sfiii3nr1,${localPort},${remoteIp},${remotePort},${player},${delay},0 ${luaPath}`
    switch (process.platform) {
        case 'darwin':
            return launchGGPOSpawn(directCommand, callBack)
        // return launchGGPOSpawn(directCommand, () => {})
        case 'linux':
            return launchGGPOSpawn(directCommand, callBack)
        default:
            return launchGGPOSpawn(directCommand, callBack)
    }
}

export function startSoloMode({ config, callBack }: { config: Config; callBack: () => any }) {
    const directCommand = `${fightcadeCmd(config)} -game sfiii3nr1 ${config.emulator.trainingLuaPath}`
    return launchGGPOSpawn(directCommand, callBack)
}

module.exports = {
    startPlayingOnline,
}
