import { invoke } from '@tauri-apps/api/core'
import { isTauriEnv, resolveFilesPath } from './pathSettings'

type MatchFilePaths = {
    command: string
    stats: string
}

let cachedPaths: MatchFilePaths | null = null
let loggedPaths = false

const DEV_OVERRIDE_BASE =
    import.meta.env.DEV
        ? 'C:/Users/dusti/Desktop/hyper-reflector/Hyper-Reflector/src-tauri/files'
        : null

const normalizePath = (path: string) => path.replace(/\\/g, '/')

async function ensurePaths(): Promise<MatchFilePaths | null> {
    if (!isTauriEnv()) {
        return null
    }
    if (!cachedPaths) {
        if (DEV_OVERRIDE_BASE) {
            cachedPaths = {
                command: normalizePath(`${DEV_OVERRIDE_BASE}/hyper_read_commands.txt`),
                stats: normalizePath(`${DEV_OVERRIDE_BASE}/hyper_track_match.txt`),
            }
        } else {
            const [command, stats] = await Promise.all([
                resolveFilesPath('hyper_read_commands.txt'),
                resolveFilesPath('hyper_track_match.txt'),
            ])
            cachedPaths = { command, stats }
        }
        if (import.meta.env.DEV) {
            console.log('[match-files] monitoring paths', cachedPaths)
        }
    }
    loggedPaths = true
    return cachedPaths
}

export async function readMatchCommandFile(): Promise<string | null> {
    const paths = await ensurePaths()
    if (!paths) return null
    try {
        if (import.meta.env.DEV) {
            console.log('[match-files] reading command', paths.command)
        }
        const contents = await invoke<string>('read_files_text', { relativePath: paths.command })
        console.log('contents', JSON.stringify(contents))
        return contents ?? null
    } catch (error) {
        console.error('Failed to read match command file', error)
        return null
    }
}

export async function clearMatchCommandFile(): Promise<void> {
    const paths = await ensurePaths()
    if (!paths) return
    try {
        await invoke('write_files_text', { relativePath: paths.command, contents: '' })
        if (import.meta.env.DEV) {
            console.log('[match-files] cleared command', paths.command)
        }
    } catch (error) {
        console.error('Failed to clear match command file', error)
    }
}

export async function readMatchStatsFile(): Promise<string | null> {
    const paths = await ensurePaths()
    if (!paths) return null
    try {
        if (import.meta.env.DEV) {
            console.log('[match-files] reading stats', paths.stats)
        }
        const contents = await invoke<string>('read_files_text', { relativePath: paths.stats })
        return contents ?? null
    } catch (error) {
        console.error('Failed to read match stats file', error)
        return null
    }
}

export async function clearMatchStatsFile(): Promise<void> {
    const paths = await ensurePaths()
    if (!paths) return
    try {
        await invoke('write_files_text', { relativePath: paths.stats, contents: '' })
        if (import.meta.env.DEV) {
            console.log('[match-files] cleared stats', paths.stats)
        }
    } catch (error) {
        console.error('Failed to clear match stats file', error)
    }
}
