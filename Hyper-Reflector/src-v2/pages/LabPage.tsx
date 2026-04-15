import { useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import { FlaskConical, FolderOpen, Play, Trash2 } from 'lucide-react'
import { useSettingsStore } from '../../src/state/store'
import {
  ensureDefaultEmulatorPath,
  ensureDefaultTrainingPath,
} from '../../src/utils/pathSettings'

export function LabPage() {
  const emulatorPath = useSettingsStore(s => s.emulatorPath)
  const setEmulatorPath = useSettingsStore(s => s.setEmulatorPath)
  const trainingPath = useSettingsStore(s => s.trainingPath)
  const setTrainingPath = useSettingsStore(s => s.setTrainingPath)
  const [launching, setLaunching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [launched, setLaunched] = useState(false)

  const handleLaunch = async () => {
    setLaunching(true)
    setError(null)
    setLaunched(false)
    try {
      await ensureDefaultEmulatorPath()
      const { emulatorPath: resolved } = useSettingsStore.getState()

      if (!resolved?.trim()) {
        setError('No emulator path configured. Browse for the emulator below.')
        return
      }

      await ensureDefaultTrainingPath(resolved)
      const { trainingPath: resolvedTraining } = useSettingsStore.getState()

      const args = ['--rom', 'sfiii3nr1']
      if (resolvedTraining?.trim()) {
        args.push('--lua', resolvedTraining)
      }

      await invoke('start_training_mode', {
        useSidecar: false,
        exePath: resolved,
        args,
      })
      setLaunched(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to launch emulator.')
    } finally {
      setLaunching(false)
    }
  }

  const pickEmulator = async () => {
    try {
      const res = await open({
        multiple: false,
        directory: false,
        title: 'Select emulator executable',
        filters: [{ name: 'Executable', extensions: ['exe'] }],
      })
      if (typeof res === 'string') setEmulatorPath(res)
    } catch { /* dialog dismissed */ }
  }

  const pickLua = async () => {
    try {
      const res = await open({
        multiple: false,
        directory: false,
        title: 'Select Lua training script',
        filters: [{ name: 'Lua scripts', extensions: ['lua', 'luac'] }],
      })
      if (typeof res === 'string') setTrainingPath(res, 'custom')
    } catch { /* dialog dismissed */ }
  }

  const sectionCls = 'rounded-lg overflow-hidden border'
  const sectionStyle = { borderColor: 'var(--v2-border)' }
  const headerCls = 'px-4 py-3 border-b'
  const headerStyle = { borderColor: 'var(--v2-border)', background: 'var(--v2-surface)' }
  const bodyStyle = { background: 'var(--v2-surface)' }
  const labelCls = 'text-xs font-semibold uppercase tracking-wide'

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-lg mx-auto p-6 space-y-4">

        <div className="flex items-center gap-2 mb-2">
          <FlaskConical size={18} style={{ color: 'var(--v2-accent)' }} />
          <h1 className="text-lg font-semibold" style={{ color: 'var(--v2-text)' }}>Lab</h1>
        </div>

        {/* Launch */}
        <div className={sectionCls} style={sectionStyle}>
          <div className={headerCls} style={headerStyle}>
            <span className={labelCls} style={{ color: 'var(--v2-muted)' }}>Training Mode</span>
          </div>
          <div className="px-4 py-4 space-y-3" style={bodyStyle}>
            <button
              onClick={handleLaunch}
              disabled={launching}
              className="flex items-center gap-2 px-4 py-2 rounded font-medium text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: 'var(--v2-accent)', color: 'var(--v2-accent-fg)' }}
              onMouseEnter={e => { if (!launching) e.currentTarget.style.background = 'var(--v2-accent-hover)' }}
              onMouseLeave={e => (e.currentTarget.style.background = 'var(--v2-accent)')}
            >
              <Play size={14} />
              {launching ? 'Launching...' : 'Launch Training Mode'}
            </button>

            {error && (
              <p className="text-red-400 text-xs">{error}</p>
            )}
            {launched && !error && (
              <p className="text-green-400 text-xs">Emulator launched successfully.</p>
            )}
          </div>
        </div>

        {/* Emulator path */}
        <div className={sectionCls} style={sectionStyle}>
          <div className={headerCls} style={headerStyle}>
            <span className={labelCls} style={{ color: 'var(--v2-muted)' }}>Emulator</span>
          </div>
          <div className="px-4 py-4 space-y-2" style={bodyStyle}>
            <p className="text-xs font-mono break-all" style={{ color: 'var(--v2-muted)' }}>
              {emulatorPath || 'Using default bundled path'}
            </p>
            <button
              onClick={pickEmulator}
              className="flex items-center gap-1.5 text-xs transition-colors"
              style={{ color: 'var(--v2-muted)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--v2-text)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--v2-muted)')}
            >
              <FolderOpen size={13} />
              Browse for emulator...
            </button>
          </div>
        </div>

        {/* Lua script */}
        <div className={sectionCls} style={sectionStyle}>
          <div className={headerCls} style={headerStyle}>
            <span className={labelCls} style={{ color: 'var(--v2-muted)' }}>Lua Script</span>
          </div>
          <div className="px-4 py-4 space-y-2" style={bodyStyle}>
            <p className="text-xs font-mono break-all" style={{ color: 'var(--v2-muted)' }}>
              {trainingPath || 'Default'}
            </p>
            <div className="flex items-center gap-4">
              <button
                onClick={pickLua}
                className="flex items-center gap-1.5 text-xs transition-colors"
                style={{ color: 'var(--v2-muted)' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--v2-text)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--v2-muted)')}
              >
                <FolderOpen size={13} />
                Browse for script...
              </button>
              {trainingPath && (
                <button
                  onClick={() => setTrainingPath('', 'auto')}
                  className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition-colors"
                >
                  <Trash2 size={13} />
                  Reset to default
                </button>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
