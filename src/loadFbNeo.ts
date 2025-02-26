const { exec } = require('child_process')
const path = require('path')

import { Config } from './config'

export default function launchGGPO(command) {
    try {
        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error starting Fightcade-FBNeo: ${error.message}`)
                return
            }
            if (stderr) {
                console.error(`stderr: ${stderr}`)
                return
            }
            console.log(`stdout: ${stdout}`)
        })
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
}: {
    config: Config
    localPort: number
    remoteIp: string
    remotePort: number
    player: number
    delay: number
}) {
    console.log(localPort, remoteIp, remotePort)
    console.log('emulator target might be', remotePort + 1)

    // we add +1 to local port because when we hole punch nat, the emulator assigns a socket to the next port
    const directCommand = `${fightcadeCmd(config)} quark:direct,sfiii3nr1,${localPort},${remoteIp},${remotePort},${player},${delay},0 ${config.emulator.luaPath}`
    console.log({ directCommand })

    launchGGPO(directCommand)
}

export function startSoloMode({ config }: { config: Config }) {
    const directCommand = `${fightcadeCmd(config)} -game sfiii3nr1 ${config.emulator.luaPath}`
    console.log({ directCommand })
    launchGGPO(directCommand)
}
