import { invoke } from '@tauri-apps/api/core'
// @ts-ignore
import keys from '../private/keys'
import { useSettingsStore, useUserStore } from '../state/store'
import { resolveMatchLuaPath } from '../utils/pathSettings'
import { DEFAULT_GAME_ROM } from '../games'

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

type SpectateRelayInfo = {
    relayHost: string
    relayUdpPort: number
    relayTcpPort: number
    matchId: string
}

export function isMockUserId(uid?: string | null): boolean {
    if (!uid) return false
    return uid.startsWith('mock-')
}

export async function startProxyMatch({
    matchId,
    playerSlot,
    opponentUid,
    serverHost,
    serverPort,
    gameName,
}: ProxyMatchArgs): Promise<void> {
    const { emulatorPath, ggpoDelay, trainingPath, labMusicMuted } = useSettingsStore.getState()
    const { globalUser } = useUserStore.getState()

    if (!globalUser?.uid) {
        console.error('[v2] startProxyMatch: no logged in user')
        return
    }

    if (!emulatorPath || !emulatorPath.trim().length) {
        console.error('[v2] startProxyMatch: emulator path not set')
        return
    }

    const resolvedServerHost = serverHost || keys.COTURN_IP
    const parsedServerPort = Number(serverPort ?? keys.PUNCH_PORT ?? 33334)
    const romName = typeof gameName === 'string' && gameName.trim().length ? gameName.trim() : DEFAULT_GAME_ROM
    const playerIndex = (playerSlot + 1) as 1 | 2
    const delayValue = Number.parseInt(ggpoDelay || '0', 10) || 0

    const matchLuaPath = romName === DEFAULT_GAME_ROM
        ? ((await resolveMatchLuaPath(emulatorPath)) || trainingPath)
        : undefined

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

    if (matchLuaPath) {
        await invoke('write_hyper_settings_cmd', {
            luaPath: matchLuaPath,
            musicVolume: labMusicMuted ? 0 : 127,
        }).catch(() => {})
    }

    await invoke('stop_proxy').catch(() => {})
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
            net_delay: 'off',
        },
    })
}

export async function startMockMatch({
    matchId,
    opponentName,
    gameName,
    playerSlot,
}: MockMatchArgs): Promise<void> {
    const { emulatorPath, ggpoDelay, trainingPath, labMusicMuted } = useSettingsStore.getState()
    const { globalUser } = useUserStore.getState()

    if (!emulatorPath || !emulatorPath.trim().length) {
        console.error('[v2] startMockMatch: emulator path not set')
        return
    }

    const playerName = globalUser?.userName || globalUser?.userEmail || 'Player 1'
    const opponentDisplayName = opponentName || 'Mock Opponent'
    const romName = typeof gameName === 'string' && gameName.trim().length ? gameName.trim() : DEFAULT_GAME_ROM
    const delay = Number.parseInt(ggpoDelay || '0', 10) || 0

    const primaryPorts = playerSlot === 0 ? { local: 7000, remote: 7001 } : { local: 7001, remote: 7000 }
    const opponentPorts = playerSlot === 0 ? { local: 7001, remote: 7000 } : { local: 7000, remote: 7001 }

    const matchLuaPath = romName === DEFAULT_GAME_ROM
        ? ((await resolveMatchLuaPath(emulatorPath)) || trainingPath)
        : undefined

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

    // TODO: temp — opponent runs without Lua to test for desyncs
    const opponentArgs = buildEmulatorArgs({
        emulatorPath,
        playerIndex: (playerSlot === 0 ? 2 : 1) as 1 | 2,
        localPort: opponentPorts.local,
        remotePort: opponentPorts.remote,
        playerName: opponentDisplayName,
        delay,
        luaPath: undefined,
        rom: romName,
    })

    const musicVolume = labMusicMuted ? 0 : 127
    await invoke('kill_mock_emulators').catch(() => {})
    await Promise.all([
        invoke('launch_emulator', { exePath: emulatorPath, args: playerArgs, matchId, musicVolume }),
        invoke('launch_emulator', { exePath: emulatorPath, args: opponentArgs, matchId, musicVolume }),
    ])
}

type MockSpectateMatchArgs = {
    gameName?: string | null
}

// Dev/test tool: spins up a complete spectating pipeline with no real opponent or backend
// matchmaking involved — two local bot processes play each other (mirrors startMockMatch
// above), the playerSlot-0 one publishes to the spectate relay, and a third local process
// watches it. Requires the relay to actually be running (`npm run spectate-relay` in the
// backend repo) and reachable at keys.SPECTATE_RELAY_HOST — this only launches emulator
// processes, it doesn't start or check the relay itself.
export async function startMockSpectateMatch({ gameName }: MockSpectateMatchArgs = {}): Promise<void> {
    const { emulatorPath, ggpoDelay, trainingPath, labMusicMuted } = useSettingsStore.getState()

    if (!emulatorPath || !emulatorPath.trim().length) {
        console.error('[v2] startMockSpectateMatch: emulator path not set')
        return
    }

    const romName = typeof gameName === 'string' && gameName.trim().length ? gameName.trim() : DEFAULT_GAME_ROM
    const delay = Number.parseInt(ggpoDelay || '0', 10) || 0
    const matchId = `mock-spectate-${Date.now()}`
    const relay: SpectateRelayInfo = {
        relayHost: keys.SPECTATE_RELAY_HOST || keys.COTURN_IP,
        relayUdpPort: Number(keys.SPECTATE_RELAY_UDP_PORT ?? 33335),
        relayTcpPort: Number(keys.SPECTATE_RELAY_TCP_PORT ?? 33336),
        matchId,
    }

    const matchLuaPath = romName === DEFAULT_GAME_ROM
        ? ((await resolveMatchLuaPath(emulatorPath)) || trainingPath)
        : undefined

    // Host (playerSlot 0) publishes the match; the opponent just plays normally.
    const hostArgs = buildEmulatorArgs({
        emulatorPath,
        playerIndex: 1,
        localPort: 7000,
        remotePort: 7001,
        playerName: 'Mock Host',
        delay,
        luaPath: matchLuaPath,
        rom: romName,
        spectate: { ...relay, uid: 'mock-spectate-host' },
    })
    const opponentArgs = buildEmulatorArgs({
        emulatorPath,
        playerIndex: 2,
        localPort: 7001,
        remotePort: 7000,
        playerName: 'Mock Opponent',
        delay,
        luaPath: undefined,
        rom: romName,
    })
    const watcherArgs = buildSpectateWatchArgs({
        emulatorPath,
        rom: romName,
        uid: 'mock-spectate-viewer',
        userName: 'Mock Viewer',
        relay,
    })

    const musicVolume = labMusicMuted ? 0 : 127
    await invoke('kill_mock_emulators').catch(() => {})
    await Promise.all([
        invoke('launch_emulator', { exePath: emulatorPath, args: hostArgs, matchId, musicVolume }),
        invoke('launch_emulator', { exePath: emulatorPath, args: opponentArgs, matchId, musicVolume }),
    ])

    // Give the host a moment to register with the relay and start publishing before the
    // spectator tries to fetch a snapshot — otherwise the very first connection attempt is
    // almost guaranteed to hit "no publisher yet" on the relay.
    await new Promise(resolve => setTimeout(resolve, 1500))

    await invoke('launch_emulator', {
        exePath: emulatorPath,
        args: watcherArgs,
        matchId: `${matchId}-viewer`,
        musicVolume,
    })
}

type SpectateWatchArgsOptions = {
    emulatorPath: string
    rom: string
    uid: string
    userName?: string
    relay: SpectateRelayInfo
}

function buildSpectateWatchArgs({ emulatorPath, rom, uid, userName, relay }: SpectateWatchArgsOptions): string[] {
    const normalizedPath = emulatorPath.toLowerCase()
    if (!normalizedPath.endsWith('fs-fbneo.exe') && !normalizedPath.endsWith('fs-fbneo')) {
        console.warn('[v2] Spectating is only supported by hyper-reflector-fs-fbneo; the configured emulator path does not look like it.')
    }
    return [
        '--rom', rom,
        'spectate',
        '--relay-host', relay.relayHost,
        '--relay-udp-port', String(relay.relayUdpPort),
        '--relay-tcp-port', String(relay.relayTcpPort),
        '--match-id', relay.matchId,
        '--uid', uid,
        '-n', userName || uid,
    ]
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
    // Publishes this match to the spectate relay. Only meaningful (and only wired up here)
    // when playerIndex === 1 — see fbn_spectate.cpp: the relay's publisher is always
    // playerSlot 0. Ignored entirely for emulator paths other than fs-fbneo, since spectating
    // is a hyper-reflector-fs-fbneo-only feature.
    spectate?: SpectateRelayInfo & { uid: string }
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
    spectate,
}: BuildArgsOptions): string[] {
    const normalizedPath = emulatorPath.toLowerCase()
    const args: string[] = []

    if (normalizedPath.endsWith('fs-fbneo.exe') || normalizedPath.endsWith('fs-fbneo')) {
        args.push('--rom', rom)
        if(rom ==='sfiii3nr1'){
            if (luaPath && luaPath.trim().length) {
                args.push('--lua', luaPath)
            }
        }
        args.push(
            'direct',
            '--player', String(playerIndex),
            '-n', playerName,
            '-l', `127.0.0.1:${localPort}`,
            '-r', `127.0.0.1:${remotePort}`,
            '-d', String(delay),
            '--net-delay', String("off")
        )
        if (spectate && playerIndex === 1) {
            args.push(
                '--spectate',
                '--relay-host', spectate.relayHost,
                '--relay-udp-port', String(spectate.relayUdpPort),
                '--relay-tcp-port', String(spectate.relayTcpPort),
                '--match-id', spectate.matchId,
                '--uid', spectate.uid,
            )
        }
        return args
    }

    if (normalizedPath.endsWith('fcadefbneo.exe') || normalizedPath.endsWith('fcadefbneo')) {
        const connection = `quark:direct,${rom},${localPort},127.0.0.1,${remotePort},${playerIndex},${delay},0`
        args.push(connection)
        args.push('--net-delay', "off")
        if (luaPath && luaPath.trim().length) {
            args.push('--lua', luaPath)
        }
        return args
    }

    if (luaPath && luaPath.trim().length) {
        args.push('--lua', luaPath)
    }
    args.push(
        '--rom', rom,
        '--player', String(playerIndex),
        '-n', playerName,
        '-l', `127.0.0.1:${localPort}`,
        '-r', `127.0.0.1:${remotePort}`,
        '-d', String(delay),
        '--net-delay', String("off")
    )

    return args
}
