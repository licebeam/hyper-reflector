import { useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import { FlaskConical, FolderOpen, Play, Trash2 } from 'lucide-react'
import { useSettingsStore } from '../../state/store'
import {
  ensureDefaultEmulatorPath,
  ensureDefaultTrainingPath,
} from '../../utils/pathSettings'
import { GAMES } from '../games'

const SFIII_ROM = 'sfiii3nr1'

export function LabPage() {
  const emulatorPath = useSettingsStore(s => s.emulatorPath)
  const setEmulatorPath = useSettingsStore(s => s.setEmulatorPath)

  // Legacy sfiii3nr1 auto-resolved path (still used as the default fallback)
  const trainingPath = useSettingsStore(s => s.trainingPath)

  // Per-game custom Lua paths
  const luaScripts = useSettingsStore(s => s.luaScripts)
  const luaScriptSources = useSettingsStore(s => s.luaScriptSources)
  const setLuaScriptForGame = useSettingsStore(s => s.setLuaScriptForGame)

  // Selected game — persisted across sessions
  const labSelectedGame = useSettingsStore(s => s.labSelectedGame)
  const setLabSelectedGame = useSettingsStore(s => s.setLabSelectedGame)

  const [launching, setLaunching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [launched, setLaunched] = useState(false)

  const isSfiii = labSelectedGame === SFIII_ROM
  const customLuaPath = luaScripts[labSelectedGame] ?? ''
  const luaSource = luaScriptSources[labSelectedGame] ?? 'auto'
  // Displayed path: custom if set; for sfiii fall back to auto-resolved default
  const displayedLuaPath = luaSource === 'custom' && customLuaPath
    ? customLuaPath
    : isSfiii
    ? trainingPath
    : ''
  const hasCustomLua = luaSource === 'custom' && !!customLuaPath

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

      const args = ['--rom', labSelectedGame]

      if (hasCustomLua) {
        // Any game: user picked a custom Lua script
        args.push('--lua', customLuaPath)
      } else if (isSfiii) {
        // sfiii3nr1 with no custom: fall back to auto-resolved default training script
        await ensureDefaultTrainingPath(resolved)
        const { trainingPath: resolvedTraining } = useSettingsStore.getState()
        if (resolvedTraining?.trim()) {
          args.push('--lua', resolvedTraining)
        }
      }
      // Other games with no custom script: no --lua argument

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
      if (typeof res === 'string') setLuaScriptForGame(labSelectedGame, res, 'custom')
    } catch { /* dialog dismissed */ }
  }

  const resetLua = () => setLuaScriptForGame(labSelectedGame, '', 'auto')

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

        {/* Game selector */}
        <div className={sectionCls} style={sectionStyle}>
          <div className={headerCls} style={headerStyle}>
            <span className={labelCls} style={{ color: 'var(--v2-muted)' }}>Game</span>
          </div>
          <div className="px-4 py-4" style={bodyStyle}>
            <select
              value={labSelectedGame}
              onChange={e => {
                setLabSelectedGame(e.target.value)
                setError(null)
                setLaunched(false)
              }}
              className="text-sm px-3 py-1.5 rounded border outline-none w-full max-w-xs"
              style={{
                background: 'var(--v2-hover)',
                borderColor: 'var(--v2-border)',
                color: 'var(--v2-text)',
              }}
              onFocus={e => (e.currentTarget.style.borderColor = 'var(--v2-accent)')}
              onBlur={e => (e.currentTarget.style.borderColor = 'var(--v2-border)')}
            >
              {GAMES.map(g => (
                <option key={g.rom} value={g.rom} style={{ background: 'var(--v2-surface)' }}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
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

        {/* Lua script — available for all games */}
        <div className={sectionCls} style={sectionStyle}>
          <div className={headerCls} style={headerStyle}>
            <span className={labelCls} style={{ color: 'var(--v2-muted)' }}>Lua Script</span>
          </div>
          <div className="px-4 py-4 space-y-2" style={bodyStyle}>
            <p className="text-xs font-mono break-all" style={{ color: 'var(--v2-muted)' }}>
              {displayedLuaPath || (isSfiii ? 'Default' : 'None selected')}
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
              {hasCustomLua && (
                <button
                  onClick={resetLua}
                  className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition-colors"
                >
                  <Trash2 size={13} />
                  {isSfiii ? 'Reset to default' : 'Remove script'}
                </button>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
