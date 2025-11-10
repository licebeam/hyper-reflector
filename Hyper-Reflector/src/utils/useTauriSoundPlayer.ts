import { useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'

/**
 * Small utility hook that proxies audio playback through the Tauri backend.
 * Ensures we only attempt playback when a path is available and surfaces errors in dev logs.
 */
export function useTauriSoundPlayer() {
    const playSound = useCallback(async (path?: string | null) => {
        if (!path) return

        try {
            await invoke('play_sound', { path })
        } catch (error) {
            console.error('Failed to play sound via Tauri:', error)
        }
    }, [])

    return { playSound }
}

export type PlayableSoundType = 'challenge' | 'at'
