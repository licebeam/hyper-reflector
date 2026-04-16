import { LogOut } from 'lucide-react'
import { logout } from '../../src/utils/firebase'
import { useSettingsStore } from '../../src/state/store'
import { useV2Theme } from '../ThemeContext'
import { THEMES, CHAT_MSG_SWATCHES, NAME_SELF_SWATCHES, NAME_OTHER_SWATCHES, GRAD_FROM_SWATCHES, GRAD_TO_SWATCHES } from '../theme'
import type { V2User } from '../types'

type SettingsPageProps = {
  user: V2User
  onLogout: () => void
}

const DELAYS = ['0', '1', '2', '3', '4', '5', '6', '7']

// ── Sub-components ─────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg overflow-hidden border" style={{ borderColor: 'var(--v2-border)' }}>
      <div
        className="px-4 py-3 border-b"
        style={{ borderColor: 'var(--v2-border)', background: 'var(--v2-surface)' }}
      >
        <h2 className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--v2-muted)' }}>
          {title}
        </h2>
      </div>
      <div className="px-4 py-3 space-y-3" style={{ background: 'var(--v2-surface)' }}>
        {children}
      </div>
    </section>
  )
}

function Row({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <div>
        <p className="text-sm" style={{ color: 'var(--v2-text)' }}>{label}</p>
        {sub && <p className="text-xs mt-0.5" style={{ color: 'var(--v2-muted)' }}>{sub}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function ColorSwatch({
  label,
  current,
  swatches,
  onChange,
}: {
  label: string
  current: string
  swatches: string[]
  onChange: (color: string) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <span className="text-sm" style={{ color: 'var(--v2-text)' }}>{label}</span>
      <div className="flex items-center gap-1.5">
        {swatches.map(color => (
          <button
            key={color}
            title={color}
            onClick={() => onChange(color)}
            className="w-5 h-5 rounded-full transition-transform hover:scale-110"
            style={{
              backgroundColor: color,
              outline: current.toLowerCase() === color.toLowerCase() ? '2px solid white' : '2px solid transparent',
              outlineOffset: '1px',
            }}
          />
        ))}
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function SettingsPage({ user, onLogout }: SettingsPageProps) {
  const ggpoDelay = useSettingsStore(s => s.ggpoDelay)
  const setGgpoDelay = useSettingsStore(s => s.setGgpoDelay)
  const { theme, overrides, setThemeId, setOverride } = useV2Theme()

  const handleLogout = async () => {
    await logout()
    onLogout()
  }

  const currentChatColor  = overrides['--v2-chat-msg']   ?? theme.vars['--v2-chat-msg']
  const currentSelfColor  = overrides['--v2-name-self']  ?? theme.vars['--v2-name-self']
  const currentOtherColor = overrides['--v2-name-other'] ?? theme.vars['--v2-name-other']
  const currentGradFrom      = overrides['--v2-grad-from']       ?? theme.vars['--v2-grad-from']
  const currentGradTo        = overrides['--v2-grad-to']         ?? theme.vars['--v2-grad-to']
  const currentPatternOpacity = overrides['--v2-pattern-opacity'] ?? theme.vars['--v2-pattern-opacity']

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-lg mx-auto p-6 space-y-4">

        {/* Account */}
        <Section title="Account">
          <Row label="Username">
            <span className="text-sm font-medium" style={{ color: 'var(--v2-accent)' }}>
              {user.userName}
            </span>
          </Row>
          {user.userEmail && (
            <Row label="Email">
              <span className="text-sm" style={{ color: 'var(--v2-text)' }}>{user.userEmail}</span>
            </Row>
          )}
          <Row label="ELO">
            <span className="text-sm" style={{ color: 'var(--v2-text)' }}>{user.accountElo}</span>
          </Row>

          <div className="pt-2 border-t" style={{ borderColor: 'var(--v2-border)' }}>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-sm text-red-400 hover:text-red-300 transition-colors"
            >
              <LogOut size={14} />
              Sign out
            </button>
          </div>
        </Section>

        {/* Appearance — theme picker */}
        <Section title="Appearance">
          <div className="space-y-4">
            <div>
              <p className="text-sm mb-2" style={{ color: 'var(--v2-text)' }}>Theme</p>
              <div className="grid grid-cols-2 gap-2">
                {THEMES.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setThemeId(t.id)}
                    className="flex flex-col items-start p-3 rounded border text-left transition-all"
                    style={{
                      borderColor: theme.id === t.id ? 'var(--v2-accent)' : 'var(--v2-border)',
                      background: theme.id === t.id ? 'var(--v2-hover)' : 'transparent',
                    }}
                  >
                    <span className="text-lg mb-1">{t.emoji}</span>
                    <span className="text-sm font-medium" style={{ color: 'var(--v2-text)' }}>
                      {t.name}
                    </span>
                    {/* Mini color preview */}
                    <div className="flex gap-1 mt-1.5">
                      {(['--v2-bg', '--v2-accent', '--v2-name-self'] as const).map(k => (
                        <span
                          key={k}
                          className="w-3 h-3 rounded-full border border-white/10"
                          style={{ background: t.vars[k] }}
                        />
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Fun overrides */}
            <div className="pt-3 border-t space-y-3" style={{ borderColor: 'var(--v2-border)' }}>
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--v2-muted)' }}>
                Chat Colors
              </p>
              <ColorSwatch
                label="Chat text"
                current={currentChatColor}
                swatches={CHAT_MSG_SWATCHES}
                onChange={c => setOverride('--v2-chat-msg', c)}
              />
              <ColorSwatch
                label="My username"
                current={currentSelfColor}
                swatches={NAME_SELF_SWATCHES}
                onChange={c => setOverride('--v2-name-self', c)}
              />
              <ColorSwatch
                label="Others' names"
                current={currentOtherColor}
                swatches={NAME_OTHER_SWATCHES}
                onChange={c => setOverride('--v2-name-other', c)}
              />

              {/* Chat preview */}
              <div
                className="text-xs rounded px-3 py-2 border"
                style={{ borderColor: 'var(--v2-border)', background: 'var(--v2-hover)' }}
              >
                <span style={{ color: currentSelfColor }}>YourName</span>
                <span style={{ color: 'var(--v2-muted)' }}> 12:00 </span>
                <span style={{ color: currentChatColor }}>Hello lobby!</span>
                {'  '}
                <span style={{ color: currentOtherColor }}>Opponent</span>
                <span style={{ color: 'var(--v2-muted)' }}> 12:01 </span>
                <span style={{ color: currentChatColor }}>GG!</span>
              </div>
            </div>

            {/* Background gradient overrides */}
            <div className="pt-3 border-t space-y-3" style={{ borderColor: 'var(--v2-border)' }}>
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--v2-muted)' }}>
                Background
              </p>
              <ColorSwatch
                label="Gradient top"
                current={currentGradFrom}
                swatches={GRAD_FROM_SWATCHES}
                onChange={c => setOverride('--v2-grad-from', c)}
              />
              <ColorSwatch
                label="Gradient bottom"
                current={currentGradTo}
                swatches={GRAD_TO_SWATCHES}
                onChange={c => setOverride('--v2-grad-to', c)}
              />
              <Row label="Pattern overlay" sub="Tiled texture visibility">
                <select
                  value={currentPatternOpacity}
                  onChange={e => setOverride('--v2-pattern-opacity', e.target.value)}
                  className="rounded px-3 py-1.5 text-sm border outline-none"
                  style={{
                    background: 'var(--v2-hover)',
                    borderColor: 'var(--v2-border)',
                    color: 'var(--v2-text)',
                  }}
                >
                  <option value="0">Off</option>
                  <option value="0.06">Subtle</option>
                  <option value="0.12">Medium</option>
                  <option value="0.22">Strong</option>
                </select>
              </Row>
            </div>
          </div>
        </Section>

        {/* Gameplay */}
        <Section title="Gameplay">
          <Row label="GGPO Delay" sub="Frame delay for netplay (0 – 7)">
            <select
              value={ggpoDelay}
              onChange={e => setGgpoDelay(e.target.value)}
              className="rounded px-3 py-1.5 text-sm border outline-none"
              style={{
                background: 'var(--v2-hover)',
                borderColor: 'var(--v2-border)',
                color: 'var(--v2-text)',
              }}
            >
              {DELAYS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </Row>
        </Section>

        {/* App */}
        <Section title="App">
          <Row label="Version">
            <div
              className="flex rounded overflow-hidden border text-xs font-medium"
              style={{ borderColor: 'var(--v2-border)' }}
            >
              <button
                className="px-2.5 py-1 transition-colors"
                style={{ background: 'var(--v2-hover)', color: 'var(--v2-muted)' }}
                onClick={() => { localStorage.setItem('appVersion', 'v1'); window.location.reload() }}
              >
                V1
              </button>
              <span className="px-2.5 py-1" style={{ background: 'var(--v2-accent)', color: 'var(--v2-accent-fg)' }}>
                V2
              </span>
            </div>
          </Row>
        </Section>

      </div>
    </div>
  )
}
