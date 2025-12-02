import { invoke } from '@tauri-apps/api/core'
import { dirname, join, normalize } from '@tauri-apps/api/path'
import { useSettingsStore } from '../state/store'
import { isTauriEnv } from './pathSettings'

const normalizeRomPath = (path: string) => {
    if (!path) return ''
    const trimmed = path.trim()
    if (!trimmed.length) return ''
    const converted = trimmed.replace(/\//g, '\\')
    if (converted.endsWith('\\')) {
        return converted
    }
    return `${converted}\\`
}

async function resolveConfigFilePath() {
    const emulatorPath = useSettingsStore.getState().emulatorPath
    if (!emulatorPath) {
        throw new Error('Set an emulator path before configuring ROM directories.')
    }
    const normalizedExe = await normalize(emulatorPath)
    const exeDir = await dirname(normalizedExe)
    const configPath = await normalize(await join(exeDir, 'config', 'fs-fbneo.ini'))
    return configPath
}

export async function applyRomPath(path: string) {
    if (!isTauriEnv()) {
        throw new Error('ROM path editing is only available inside the desktop app.')
    }
    const sanitized = normalizeRomPath(path)
    const replacementLine = `szAppRomPaths[0] ${sanitized}`
    const configPath = await resolveConfigFilePath()
    try {
        const current = await invoke<string>('read_files_text', {
            relativePath: configPath,
        })
        const pattern = /^szAppRomPaths\[0\].*$/m
        let nextContents: string
        if (typeof current === 'string' && current.length) {
            nextContents = pattern.test(current)
                ? current.replace(pattern, replacementLine)
                : `${replacementLine}\n${current}`
        } else {
            nextContents = `${replacementLine}\n`
        }
        await invoke('write_files_text', {
            relativePath: configPath,
            contents: nextContents,
        })
    } catch (error) {
        console.error('Failed to update ROM path', error)
        throw error
    }
}

export function formatRomPathDisplay(path: string) {
    return normalizeRomPath(path)
}
