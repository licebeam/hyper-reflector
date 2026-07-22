import { useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import { FlaskConical, FolderOpen, Play, Trash2, Palette, CheckCircle2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useSettingsStore } from '../state/store'
import {
  ensureDefaultEmulatorPath,
  ensureDefaultTrainingPath,
} from '../utils/pathSettings'
import { GAMES } from '../games'

const SFIII_ROM = 'sfiii3nr1'

// Palette extractor has some negative visual side effects — hidden until fixed.
// Flip to true to bring it back for local testing.
const SHOW_PALETTE_EXTRACTOR = false

export function LabPage() {
  const { t } = useTranslation()
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

  const labMusicMuted = useSettingsStore(s => s.labMusicMuted)

  const [launching, setLaunching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [launched, setLaunched] = useState(false)

  // Palette extractor state
  const [palPngPath, setPalPngPath] = useState<string>('')
  const [palColorIndex, setPalColorIndex] = useState<number>(0)
  const [palReplicate, setPalReplicate] = useState<boolean>(true)
  const [palExtracting, setPalExtracting] = useState(false)
  const [palResult, setPalResult] = useState<{
    out_path: string
    previews: [number, [number, number, number]][]
    total_palette_entries: number
  } | null>(null)
  const [palError, setPalError] = useState<string | null>(null)

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
        setError(t('labPage.noEmulatorPath'))
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
        musicVolume: labMusicMuted ? 0 : 127,
      })
      setLaunched(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('labPage.failedToLaunch'))
    } finally {
      setLaunching(false)
    }
  }

  const pickEmulator = async () => {
    try {
      const res = await open({
        multiple: false,
        directory: false,
        title: t('labPage.selectEmulatorExecutable'),
        filters: [{ name: t('labPage.executableFilter'), extensions: ['exe'] }],
      })
      if (typeof res === 'string') setEmulatorPath(res)
    } catch { /* dialog dismissed */ }
  }

  const pickLua = async () => {
    try {
      const res = await open({
        multiple: false,
        directory: false,
        title: t('labPage.selectLuaScript'),
        filters: [{ name: t('labPage.luaScriptsFilter'), extensions: ['lua', 'luac'] }],
      })
      if (typeof res === 'string') setLuaScriptForGame(labSelectedGame, res, 'custom')
    } catch { /* dialog dismissed */ }
  }

  const resetLua = () => setLuaScriptForGame(labSelectedGame, '', 'auto')

  const pickPalettePng = async () => {
    try {
      const res = await open({
        multiple: false,
        directory: false,
        title: t('labPage.selectSpriteSheet'),
        filters: [{ name: t('labPage.pngImagesFilter'), extensions: ['png'] }],
      })
      if (typeof res !== 'string') return
      setPalPngPath(res)
      setPalResult(null)
      setPalError(null)
      // Auto-detect color index from filename (e.g. color1.png → 1)
      const match = res.match(/color(\d+)\.png$/i)
      if (match) setPalColorIndex(parseInt(match[1], 10))
    } catch { /* dismissed */ }
  }

  const handleExtract = async () => {
    if (!palPngPath) return
    setPalExtracting(true)
    setPalResult(null)
    setPalError(null)
    try {
      const result = await invoke<{
        out_path: string
        previews: [number, [number, number, number]][]
        total_palette_entries: number
      }>('extract_palette_to_json', {
        pngPath: palPngPath,
        colorIndex: palColorIndex,
        replicate: palReplicate,
      })
      setPalResult(result)
    } catch (err) {
      setPalError(err instanceof Error ? err.message : String(err))
    } finally {
      setPalExtracting(false)
    }
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
          <h1 className="text-lg font-semibold" style={{ color: 'var(--v2-text)' }}>{t('labPage.title')}</h1>
        </div>

        {/* Game selector */}
        <div className={sectionCls} style={sectionStyle}>
          <div className={headerCls} style={headerStyle}>
            <span className={labelCls} style={{ color: 'var(--v2-muted)' }}>{t('labPage.game')}</span>
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
            <span className={labelCls} style={{ color: 'var(--v2-muted)' }}>{t('labPage.trainingMode')}</span>
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
              {launching ? t('labPage.launching') : t('labPage.launchTrainingMode')}
            </button>

            {error && (
              <p className="text-red-400 text-xs">{error}</p>
            )}
            {launched && !error && (
              <p className="text-green-400 text-xs">{t('labPage.launchedSuccessfully')}</p>
            )}
          </div>
        </div>

        {/* Emulator path */}
        <div className={sectionCls} style={sectionStyle}>
          <div className={headerCls} style={headerStyle}>
            <span className={labelCls} style={{ color: 'var(--v2-muted)' }}>{t('labPage.emulator')}</span>
          </div>
          <div className="px-4 py-4 space-y-2" style={bodyStyle}>
            <p className="text-xs font-mono break-all" style={{ color: 'var(--v2-muted)' }}>
              {emulatorPath || t('labPage.usingDefaultPath')}
            </p>
            <button
              onClick={pickEmulator}
              className="flex items-center gap-1.5 text-xs transition-colors"
              style={{ color: 'var(--v2-muted)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--v2-text)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--v2-muted)')}
            >
              <FolderOpen size={13} />
              {t('labPage.browseForEmulator')}
            </button>
          </div>
        </div>

        {/* Lua script — available for all games */}
        <div className={sectionCls} style={sectionStyle}>
          <div className={headerCls} style={headerStyle}>
            <span className={labelCls} style={{ color: 'var(--v2-muted)' }}>{t('labPage.luaScript')}</span>
          </div>
          <div className="px-4 py-4 space-y-2" style={bodyStyle}>
            <p className="text-xs font-mono break-all" style={{ color: 'var(--v2-muted)' }}>
              {displayedLuaPath || (isSfiii ? t('labPage.default') : t('labPage.noneSelected'))}
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
                {t('labPage.browseForScript')}
              </button>
              {hasCustomLua && (
                <button
                  onClick={resetLua}
                  className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition-colors"
                >
                  <Trash2 size={13} />
                  {isSfiii ? t('labPage.resetToDefault') : t('labPage.removeScript')}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Palette extractor */}
        {SHOW_PALETTE_EXTRACTOR && (
        <div className={sectionCls} style={sectionStyle}>
          <div className={headerCls} style={headerStyle}>
            <div className="flex items-center gap-2">
              <Palette size={13} style={{ color: 'var(--v2-muted)' }} />
              <span className={labelCls} style={{ color: 'var(--v2-muted)' }}>{t('labPage.paletteExtractor')}</span>
            </div>
          </div>
          <div className="px-4 py-4 space-y-3" style={bodyStyle}>

            {/* PNG picker */}
            <div className="space-y-1">
              <p className="text-xs font-mono break-all" style={{ color: palPngPath ? 'var(--v2-text)' : 'var(--v2-muted)' }}>
                {palPngPath || t('labPage.noFileSelected')}
              </p>
              <button
                onClick={pickPalettePng}
                className="flex items-center gap-1.5 text-xs transition-colors"
                style={{ color: 'var(--v2-muted)' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--v2-text)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--v2-muted)')}
              >
                <FolderOpen size={13} />
                {t('labPage.browseForPng')}
              </button>
            </div>

            {/* Color index */}
            {palPngPath && (
              <div className="flex items-center gap-3">
                <label className="text-xs" style={{ color: 'var(--v2-muted)' }}>{t('labPage.colorIndex')}</label>
                <input
                  type="number"
                  min={0}
                  max={9}
                  value={palColorIndex}
                  onChange={e => setPalColorIndex(parseInt(e.target.value, 10) || 0)}
                  className="w-16 text-xs px-2 py-1 rounded border outline-none text-center"
                  style={{
                    background: 'var(--v2-hover)',
                    borderColor: 'var(--v2-border)',
                    color: 'var(--v2-text)',
                  }}
                />
                <span className="text-xs" style={{ color: 'var(--v2-muted)' }}>→ color{palColorIndex}.json</span>
              </div>
            )}

            {/* Replicate toggle */}
            {palPngPath && (
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={palReplicate}
                  onChange={e => setPalReplicate(e.target.checked)}
                  className="rounded"
                />
                <span className="text-xs" style={{ color: 'var(--v2-muted)' }}>
                  {t('labPage.replicateToAllSlots')}
                </span>
              </label>
            )}

            {/* Extract button */}
            {palPngPath && (
              <button
                onClick={handleExtract}
                disabled={palExtracting}
                className="flex items-center gap-2 px-4 py-2 rounded font-medium text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: 'var(--v2-accent)', color: 'var(--v2-accent-fg)' }}
                onMouseEnter={e => { if (!palExtracting) e.currentTarget.style.background = 'var(--v2-accent-hover)' }}
                onMouseLeave={e => (e.currentTarget.style.background = 'var(--v2-accent)')}
              >
                <Palette size={14} />
                {palExtracting ? t('labPage.extracting') : t('labPage.extractPalette')}
              </button>
            )}

            {/* Error */}
            {palError && (
              <p className="text-red-400 text-xs">{palError}</p>
            )}

            {/* Result */}
            {palResult && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs text-green-400">
                  <CheckCircle2 size={13} />
                  <span className="font-mono break-all">{palResult.out_path}</span>
                </div>
                <p className="text-xs" style={{ color: 'var(--v2-muted)' }}>
                  {t('labPage.paletteEntriesFound', { count: palResult.total_palette_entries })}
                </p>
                <div className="flex flex-wrap gap-3">
                  {palResult.previews.map(([slot, [r, g, b]]) => (
                    <div key={slot} className="flex items-center gap-1.5">
                      <div
                        className="w-4 h-4 rounded-sm border"
                        style={{
                          background: `rgb(${r},${g},${b})`,
                          borderColor: 'var(--v2-border)',
                        }}
                      />
                      <span className="text-xs font-mono" style={{ color: 'var(--v2-muted)' }}>
                        {t('labPage.slotRgb', { slot, r, g, b })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>
        )}

      </div>
    </div>
  )
}
