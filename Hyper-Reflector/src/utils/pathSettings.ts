import { invoke } from '@tauri-apps/api/core'
import { dirname, executableDir, join, normalize, resolve } from '@tauri-apps/api/path'
import { useSettingsStore } from '../state/store'

const isProd = () => import.meta.env.PROD
export const isTauriEnv = () => {
    if (typeof window === 'undefined') {
        return false
    }
    // Tauri 2 exposes __TAURI_INTERNALS__ instead of __TAURI__ during early boot
    return '__TAURI__' in window || '__TAURI_INTERNALS__' in window
}

const toCliPath = (path: string) => path.replace(/\\/g, '/')
const dedupeSrcTauriSegments = (path: string) => path.replace(/src-tauri\/src-tauri/g, 'src-tauri')
const hasValue = (value?: string | null): value is string => Boolean(value && value.trim().length)
const needsDefault = (value?: string | null) =>
    !hasValue(value) || value.startsWith('../') || value.startsWith('..\\')

const DEV_BASE = 'src-tauri/files'
const DEV_SEGMENTS = {
    emulator: ['emu', 'hyper-screw-fbneo', 'fs-fbneo.exe'],
    training: ['lua', '3rd_training_lua', '3rd_training.lua'],
    match: ['lua', '3rd_training_lua', 'hyper_reflector.lua'],
    challenge: ['sounds', 'challenge.mp3'],
    mention: ['sounds', 'message.wav'],
}

type PreparedResources = {
    emulator_path: string
    emulator_dir: string
    lua_dir: string
    sounds_dir: string
    files_dir: string
}

type DefaultPaths = {
    emulator: string
    training: string
    match: string
    challenge: string
    mention: string
}

let cachedDefaults: DefaultPaths | null = null
let cachedFilesBase: string | null = null

async function toAbsolute(path: string): Promise<string> {
    const resolved = await resolve(path)
    const normalized = await normalize(resolved)
    return dedupeSrcTauriSegments(toCliPath(normalized))
}

async function buildDevDefaults(): Promise<DefaultPaths> {
    const build = (segments: string[]) => toAbsolute([DEV_BASE, ...segments].join('/'))

    return {
        emulator: await build(DEV_SEGMENTS.emulator),
        training: await build(DEV_SEGMENTS.training),
        match: await build(DEV_SEGMENTS.match),
        challenge: await build(DEV_SEGMENTS.challenge),
        mention: await build(DEV_SEGMENTS.mention),
    }
}

async function buildProdDefaults(): Promise<DefaultPaths> {
    const filesBase = await resolveFilesBase()

    const build = async (segments: string[]) => toCliPath(await normalize(await join(filesBase, ...segments)))

    return {
        emulator: await build(DEV_SEGMENTS.emulator),
        training: await build(DEV_SEGMENTS.training),
        match: await build(DEV_SEGMENTS.match),
        challenge: await build(DEV_SEGMENTS.challenge),
        mention: await build(DEV_SEGMENTS.mention),
    }
}

async function getDefaults(): Promise<DefaultPaths> {
    if (!cachedDefaults) {
        cachedDefaults = isProd() ? await buildProdDefaults() : await buildDevDefaults()
    }
    return cachedDefaults
}

async function resolveFilesBase(): Promise<string> {
    if (cachedFilesBase) {
        return cachedFilesBase
    }

    if (!isTauriEnv()) {
        cachedFilesBase = await toAbsolute('src-tauri/files')
        return cachedFilesBase
    }

    try {
        const prepared = await invoke<PreparedResources>('prepare_user_resources')
        cachedFilesBase = await normalize(prepared.files_dir)
        return cachedFilesBase
    } catch {
        try {
            const exeDir = await executableDir()
            cachedFilesBase = await normalize(await join(exeDir, 'files'))
            return cachedFilesBase
        } catch {
            cachedFilesBase = await toAbsolute('files')
            return cachedFilesBase
        }
    }
}

async function deriveRelative(
    baseEmulatorPath: string | null | undefined,
    segments: string[]
): Promise<string | null> {
    if (!hasValue(baseEmulatorPath)) {
        return null
    }

    try {
        const normalized = await normalize(baseEmulatorPath)
        const dir = await dirname(normalized)
        const derived = await normalize(await join(dir, '..', '..', ...segments))
        return toCliPath(derived)
    } catch {
        return null
    }
}

export async function ensureDefaultEmulatorPath(force = false) {
    const { emulatorPath, setEmulatorPath } = useSettingsStore.getState()
    if (!force && hasValue(emulatorPath) && !needsDefault(emulatorPath)) {
        return
    }

    const defaults = await getDefaults()
    setEmulatorPath(defaults.emulator)
}

export async function ensureDefaultTrainingPath(
    emulatorPathSetting?: string | null,
    force = false
) {
    const { trainingPath, setTrainingPath } = useSettingsStore.getState()
    if (!force && hasValue(trainingPath) && !needsDefault(trainingPath)) {
        return
    }

    const derived = await deriveRelative(emulatorPathSetting, DEV_SEGMENTS.training)
    if (derived) {
        setTrainingPath(derived)
        return
    }

    const defaults = await getDefaults()
    setTrainingPath(defaults.training)
}

async function ensureSound(
    currentValue: string,
    setter: (path: string) => void,
    emulatorPathSetting: string | null | undefined,
    segments: string[],
    fallback: string
) {
    if (hasValue(currentValue) && !needsDefault(currentValue)) {
        return
    }

    const derived = await deriveRelative(emulatorPathSetting, segments)
    if (derived) {
        setter(derived)
        return
    }

    setter(fallback)
}

export async function ensureDefaultChallengeSound(emulatorPathSetting?: string | null) {
    const { notifChallengeSoundPath, setNotifChallengeSoundPath } = useSettingsStore.getState()
    const defaults = await getDefaults()
    await ensureSound(
        notifChallengeSoundPath,
        setNotifChallengeSoundPath,
        emulatorPathSetting,
        DEV_SEGMENTS.challenge,
        defaults.challenge
    )
}

export async function ensureDefaultMentionSound(emulatorPathSetting?: string | null) {
    const { notifAtSoundPath, setNotifAtSoundPath } = useSettingsStore.getState()
    const defaults = await getDefaults()
    await ensureSound(
        notifAtSoundPath,
        setNotifAtSoundPath,
        emulatorPathSetting,
        DEV_SEGMENTS.mention,
        defaults.mention
    )
}

export async function resolveMatchLuaPath(emulatorPathSetting?: string | null) {
    const derived = await deriveRelative(emulatorPathSetting, DEV_SEGMENTS.match)
    if (derived) {
        return derived
    }

    const defaults = await getDefaults()
    return defaults.match
}

export async function resolveFilesPath(...segments: string[]) {
    const base = await resolveFilesBase()
    const combined = await join(base, ...segments)
    const normalized = await normalize(combined)
    return toCliPath(normalized)
}
