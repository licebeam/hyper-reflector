import { invoke } from '@tauri-apps/api/core'
//@ts-ignore // keys exists
import keys from '../private/keys'
import { toaster } from '../components/chakra/ui/toaster'
import { useSettingsStore, useUserStore } from '../state/store'
import { resolveMatchLuaPath } from '../utils/pathSettings'
import {
    MOCK_CHALLENGE_USER,
    MOCK_CHALLENGE_USER_TWO,
} from '../layout/helpers/mockUsers'

type ProxyMatchArgs = {
    matchId: string
    playerSlot: 0 | 1
    opponentUid: string
    serverHost?: string
    serverPort?: number
    gameName?: string | null
}

type MockMatchArgs = {
    matchId?: string
    opponentName?: string
    gameName?: string | null
    playerSlot: 0 | 1
}

const MOCK_USER_MAP = new Map([
    [MOCK_CHALLENGE_USER.uid, MOCK_CHALLENGE_USER],
    [MOCK_CHALLENGE_USER_TWO.uid, MOCK_CHALLENGE_USER_TWO],
])

export function isMockUserId(uid?: string | null): boolean {
    if (!uid) return false
    return uid.startsWith('mock-') || MOCK_USER_MAP.has(uid)
}

export async function startProxyMatch({
    matchId,
    playerSlot,
    opponentUid,
    serverHost,
    serverPort,
    gameName,
}: ProxyMatchArgs): Promise<void> {
    const { emulatorPath, ggpoDelay, trainingPath } = useSettingsStore.getState()
    const { globalUser } = useUserStore.getState()

    if (!globalUser?.uid) {
        toaster.error({
            title: 'Unable to start match',
            description: 'No logged in user detected.',
        })
        return
    }

    if (!emulatorPath || !emulatorPath.trim().length) {
        toaster.error({
            title: 'Emulator path missing',
            description: 'Set your emulator path in settings before starting a match.',
        })
        return
    }

    const resolvedServerHost = serverHost || keys.COTURN_IP
    const parsedServerPort = Number(serverPort ?? keys.PUNCH_PORT ?? 33334)
    const romName =
        typeof gameName === 'string' && gameName.trim().length ? gameName.trim() : 'sfiii3nr1'
    const playerIndex = (playerSlot + 1) as 1 | 2
    const delayValue = Number.parseInt(ggpoDelay || '0', 10) || 0

    const matchLuaPath = (await resolveMatchLuaPath(emulatorPath)) || trainingPath

    const emulatorArgs = buildEmulatorArgs({
        emulatorPath,
        playerIndex,
        localPort: 7000,
        remotePort: 7001,
        playerName: globalUser.userName || globalUser.userEmail || 'Player',
        delay: delayValue,
        luaPath: matchLuaPath,
        rom: romName,
    })

    try {
        await invoke('start_proxy', {
            args: {
                match_id: matchId,
                my_uid: globalUser.uid,
                peer_uid: opponentUid,
                server_host: resolvedServerHost,
                server_port: parsedServerPort,
                emulator_path: emulatorPath,
                emulator_game_port: 7000,
                emulator_listen_port: 7001,
                emulator_args: emulatorArgs,
                player: playerIndex,
                delay: delayValue,
                user_name: globalUser.userName || globalUser.userEmail || 'Player',
                game_name: romName,
            },
        })
    } catch (error) {
        console.error('Failed to start proxy match:', error)
        const fallbackMessage =
            typeof error === 'string'
                ? error
                : error && typeof error === 'object' && 'message' in error
                  ? String((error as any).message)
                  : 'Unknown error starting proxy'
        toaster.error({
            title: 'Failed to start match',
            description: fallbackMessage,
        })
    }
}

export async function startMockMatch({
    matchId,
    opponentName,
    gameName,
    playerSlot,
}: MockMatchArgs): Promise<void> {
    const { emulatorPath, ggpoDelay, trainingPath } = useSettingsStore.getState()
    const { globalUser } = useUserStore.getState()

    if (!emulatorPath || !emulatorPath.trim().length) {
        toaster.error({
            title: 'Emulator path missing',
            description: 'Set your emulator path in settings before starting a mock match.',
        })
        return
    }

    const playerName = globalUser?.userName || globalUser?.userEmail || 'Player 1'
    const opponentDisplayName = opponentName || 'Mock Opponent'
    const romName =
        typeof gameName === 'string' && gameName.trim().length ? gameName.trim() : 'sfiii3nr1'
    const delay = Number.parseInt(ggpoDelay || '0', 10) || 0

    const primaryPorts =
        playerSlot === 0
            ? { local: 7000, remote: 7001 }
            : { local: 7001, remote: 7000 }
    const opponentPorts =
        playerSlot === 0
            ? { local: 7001, remote: 7000 }
            : { local: 7000, remote: 7001 }

    const matchLuaPath = (await resolveMatchLuaPath(emulatorPath)) || trainingPath

    const playerArgs = buildEmulatorArgs({
        emulatorPath,
        playerIndex: (playerSlot === 0 ? 1 : 2) as 1 | 2,
        localPort: primaryPorts.local,
        remotePort: primaryPorts.remote,
        playerName,
        delay,
        luaPath: matchLuaPath,
        rom: romName,
    })

    const opponentArgs = buildEmulatorArgs({
        emulatorPath,
        playerIndex: (playerSlot === 0 ? 2 : 1) as 1 | 2,
        localPort: opponentPorts.local,
        remotePort: opponentPorts.remote,
        playerName: opponentDisplayName,
        delay,
        luaPath: matchLuaPath,
        rom: romName,
    })

    try {
        await Promise.all([
            invoke('launch_emulator', {
                exePath: emulatorPath,
                args: playerArgs,
            }),
            invoke('launch_emulator', {
                exePath: emulatorPath,
                args: opponentArgs,
            }),
        ])
        toaster.success({
            title: 'Mock match started',
            description: 'Launched two local emulator instances.',
        })
    } catch (error) {
        console.error('Failed to start mock match:', error)
        toaster.error({
            title: 'Failed to start mock match',
            description: error instanceof Error ? error.message : 'Unknown error launching emulator',
        })
    }
}

type BuildArgsOptions = {
    emulatorPath: string
    playerIndex: 1 | 2
    localPort: number
    remotePort: number
    playerName: string
    delay: number
    luaPath?: string
    rom: string
}

function buildEmulatorArgs({
    emulatorPath,
    playerIndex,
    localPort,
    remotePort,
    playerName,
    delay,
    luaPath,
    rom,
}: BuildArgsOptions): string[] {
    const normalizedPath = emulatorPath.toLowerCase()
    const args: string[] = []

    if (normalizedPath.endsWith('fs-fbneo.exe') || normalizedPath.endsWith('fs-fbneo')) {
        args.push('--rom', rom)
        if (luaPath && luaPath.trim().length) {
            args.push('--lua', luaPath)
        }
        args.push(
            'direct',
            '--player',
            String(playerIndex),
            '-n',
            playerName,
            '-l',
            `127.0.0.1:${localPort}`,
            '-r',
            `127.0.0.1:${remotePort}`,
            '-d',
            String(delay)
        )
        return args
    }

    if (normalizedPath.endsWith('fcadefbneo.exe') || normalizedPath.endsWith('fcadefbneo')) {
        const connection = `quark:direct,${rom},${localPort},127.0.0.1,${remotePort},${playerIndex},${delay},0`
        args.push(connection)
        if (luaPath && luaPath.trim().length) {
            args.push('--lua', luaPath)
        }
        return args
    }

    if (luaPath && luaPath.trim().length) {
        args.push('--lua', luaPath)
    }

    args.push(
        '--rom',
        rom,
        '--player',
        String(playerIndex),
        '-n',
        playerName,
        '-l',
        `127.0.0.1:${localPort}`,
        '-r',
        `127.0.0.1:${remotePort}`,
        '-d',
        String(delay)
    )

    return args
}
