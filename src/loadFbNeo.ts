const { exec, spawn } = require('child_process')
import { Config } from './config'

// export default function launchGGPO(command) {
//     try {
//         exec(command, (error, stdout, stderr) => {
//             if (error) {
//                 console.error(`Error starting Fightcade-FBNeo: ${error.message}`)
//                 return
//             }
//             if (stderr) {
//                 console.error(`stderr: ${stderr}`)
//                 return
//             }
//             console.log(`stdout: ${stdout}`)
//         })
//     } catch (error) {
//         console.log(error)
//     }
// }

export function launchGGPOSpawn(command: string, callBack: () => any) {
    try {
        const [cmd, ...args] = command.split(' ')
        const child = spawn(cmd, args, { stdio: 'inherit', shell: true })
        // listening for process exit
        child.on('exit', (code, signal) => {
            if (code !== null) {
                console.log(`Fightcade-FBNeo exited with code ${code}`)
            } else {
                console.log(`Fightcade-FBNeo terminated by signal ${signal}`)
            }
            if (callBack) {
                callBack()
            }
        })

        // listening for for errors
        child.on('error', (error) => {
            console.error(`Failed to start Fightcade-FBNeo: ${error.message}`)
        })

        return child // return the emulator reference so that we can close it if needed.
    } catch (error) {
        console.log(error)
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
    console.log(localPort, remoteIp, remotePort)
    console.log('emulator target might be', remotePort + 1)
    let luaPath = config.emulator.luaPath
    if (isTraining) {
        luaPath = config.emulator.trainingLuaPath
    }
    // we add +1 to local port because when we hole punch nat, the emulator assigns a socket to the next port
    const directCommand = `${fightcadeCmd(config)} quark:direct,sfiii3nr1,${localPort},${remoteIp},${remotePort},${player},${delay},0 ${luaPath}`
    return launchGGPOSpawn(directCommand, callBack)
}

export function startSoloMode({ config, callBack }: { config: Config; callBack: () => any }) {
    const directCommand = `${fightcadeCmd(config)} -game sfiii3nr1 ${config.emulator.trainingLuaPath}`
    return launchGGPOSpawn(directCommand, callBack)
}
