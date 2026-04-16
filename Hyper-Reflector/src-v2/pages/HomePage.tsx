import { useEffect, useMemo, useState } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { BarChart2 } from 'lucide-react'
import api from '../../src/external-api/requests'
import { auth } from '../../src/utils/firebase'
import { useV2Theme } from '../ThemeContext'
import type { V2User } from '../types'

// ── Types ──────────────────────────────────────────────────────────────────────

type SuperArtStats = { wins?: number; losses?: number }
type CharacterChoice = {
  picks: number
  superChoice?: SuperArtStats[] | Record<string, SuperArtStats>
}
type GlobalStats = {
  globalNumberOfMatches?: number
  globalWinCount?: Record<string, number>
  globalCharacterChoice?: Record<string, CharacterChoice>
}

// ── Constants ──────────────────────────────────────────────────────────────────

// Fixed in-game Super Art colors — match v1 (Chakra yellow.500 / orange.500 / blue.500)
const SA_COLORS: [string, string, string] = ['#ECC94B', '#ED8936', '#4299E1']

const CHARACTER_ROSTER = [
  'Alex', 'Ryu', 'Yun', 'Dudley', 'Necro', 'Hugo', 'Ibuki', 'Elena',
  'Oro', 'Yang', 'Ken', 'Sean', 'Urien', 'Gouki', 'Chun-Li',
  'Makoto', 'Q', 'Twelve', 'Remy',
]

// ── Helpers ────────────────────────────────────────────────────────────────────

function normalizeSuperChoices(choice?: CharacterChoice['superChoice']): SuperArtStats[] {
  if (!choice) return []
  if (Array.isArray(choice)) return choice
  return Object.values(choice)
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div
      className="rounded-lg p-4 border"
      style={{ background: 'var(--v2-surface)', borderColor: 'var(--v2-border)' }}
    >
      <p className="text-xs mb-1" style={{ color: 'var(--v2-muted)' }}>{label}</p>
      <p className="text-2xl font-bold" style={{ color: 'var(--v2-accent)' }}>{value}</p>
    </div>
  )
}

function WinSpreadDonut({
  winCount,
  colors,
}: {
  winCount?: Record<string, number>
  colors: [string, string]
}) {
  const data = [
    { name: 'Player 1', value: winCount?.['1'] || 0, color: colors[0] },
    { name: 'Player 2', value: winCount?.['2'] || 0, color: colors[1] },
  ]
  const hasData = data.some(d => d.value > 0)

  if (!hasData) {
    return (
      <p className="text-sm py-4" style={{ color: 'var(--v2-muted)' }}>
        No wins recorded yet.
      </p>
    )
  }

  return (
    <div className="w-64 h-64 mx-auto">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Tooltip
            contentStyle={{ background: 'var(--v2-surface)', border: '1px solid var(--v2-border)', borderRadius: '6px' }}
            itemStyle={{ color: 'var(--v2-text)' }}
            cursor={false}
          />
          <Pie
            innerRadius={75}
            outerRadius={105}
            isAnimationActive={false}
            data={data}
            dataKey="value"
            label={({ name, value }) => `${name}: ${value.toLocaleString()}`}
            labelLine={{ strokeWidth: 1, stroke: 'var(--v2-muted)' }}
          >
            {data.map(item => (
              <Cell key={item.name} fill={item.color} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

function SuperArtDonut({
  name,
  stats,
  colors,
}: {
  name: string
  stats: CharacterChoice
  colors: [string, string, string]
}) {
  const superChoices = normalizeSuperChoices(stats.superChoice)
  const data = [0, 1, 2].map(i => {
    const entry = superChoices[i]
    return { name: `SA ${i + 1}`, value: (entry?.wins || 0) + (entry?.losses || 0), color: colors[i] }
  })
  const hasData = data.some(d => d.value > 0)

  return (
    <div className="flex flex-col items-center gap-1">
      <p className="text-xs font-semibold" style={{ color: 'var(--v2-text)' }}>{name}</p>
      {hasData ? (
        <div className="w-24 h-24">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip
                contentStyle={{ background: 'var(--v2-surface)', border: '1px solid var(--v2-border)', borderRadius: '6px', fontSize: '11px' }}
                itemStyle={{ color: 'var(--v2-text)' }}
                cursor={false}
              />
              <Pie innerRadius={30} outerRadius={44} isAnimationActive={false} data={data} dataKey="value">
                {data.map(item => <Cell key={item.name} fill={item.color} />)}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="text-xs py-2" style={{ color: 'var(--v2-muted)' }}>—</p>
      )}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

type HomePageProps = {
  currentUser: V2User | null
}

export function HomePage({ currentUser }: HomePageProps) {
  const { theme } = useV2Theme()
  const [globalStats, setGlobalStats] = useState<GlobalStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const accent = theme.vars['--v2-accent']
  const nameOther = theme.vars['--v2-name-other']

  useEffect(() => {
    if (!currentUser?.uid) { setGlobalStats(null); return }
    let mounted = true
    setLoading(true)
    setError(null)
    ;(async () => {
      try {
        const result = await api.getGlobalStats(auth, currentUser.uid) as { globalStatSet?: GlobalStats } | undefined
        if (!mounted) return
        setGlobalStats(result?.globalStatSet ?? null)
        if (!result?.globalStatSet) setError('Global stats are not available yet.')
      } catch {
        if (mounted) { setGlobalStats(null); setError('Unable to load stats. Please try again shortly.') }
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [currentUser?.uid])

  const rosterStats = useMemo(() => {
    const base = Object.fromEntries(CHARACTER_ROSTER.map(n => [n, { picks: 0, superChoice: [] as SuperArtStats[] }]))
    if (globalStats?.globalCharacterChoice) {
      for (const [name, stats] of Object.entries(globalStats.globalCharacterChoice)) {
        base[name] = { picks: stats?.picks || 0, superChoice: stats?.superChoice }
      }
    }
    return base as Record<string, CharacterChoice>
  }, [globalStats?.globalCharacterChoice])

  const characterEntries = useMemo(
    () => Object.entries(rosterStats).sort((a, b) => (b[1]?.picks || 0) - (a[1]?.picks || 0)),
    [rosterStats]
  )

  const totalPicks = characterEntries.reduce((s, [, v]) => s + (v?.picks || 0), 0) || 1
  const mostPlayed = characterEntries[0]?.[0]

  if (!currentUser) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-sm" style={{ color: 'var(--v2-muted)' }}>Sign in to view the global stats dashboard.</p>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto p-6 space-y-6">

        {/* Header */}
        <div className="flex items-center gap-2">
          <BarChart2 size={18} style={{ color: 'var(--v2-accent)' }} />
          <h1 className="text-lg font-semibold" style={{ color: 'var(--v2-text)' }}>Global Stats</h1>
          <span className="text-xs ml-1" style={{ color: 'var(--v2-muted)' }}>
            Live match tracking across the Hyper Reflector community
          </span>
        </div>

        {error && (
          <div className="px-4 py-3 rounded-lg border border-yellow-700/50 bg-yellow-900/20 text-yellow-300 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="text-center space-y-2">
              <div
                className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin mx-auto"
                style={{ borderColor: 'var(--v2-accent)', borderTopColor: 'transparent' }}
              />
              <p className="text-sm" style={{ color: 'var(--v2-muted)' }}>Crunching match data…</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Summary stat cards */}
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Total matches" value={(globalStats?.globalNumberOfMatches || 0).toLocaleString()} />
              <StatCard label="Most played" value={mostPlayed || '—'} />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {/* Win spread */}
              <div
                className="rounded-lg border p-5"
                style={{ background: 'var(--v2-surface)', borderColor: 'var(--v2-border)' }}
              >
                <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--v2-text)' }}>
                  Player win spread
                </h2>
                <WinSpreadDonut
                  winCount={globalStats?.globalWinCount}
                  colors={[accent, nameOther]}
                />
                {/* Legend */}
                <div className="flex justify-center gap-6 mt-3">
                  {[['Player 1', accent], ['Player 2', nameOther]].map(([label, color]) => (
                    <div key={label} className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                      <span className="text-xs" style={{ color: 'var(--v2-muted)' }}>{label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Character pick rates */}
              <div
                className="rounded-lg border p-5"
                style={{ background: 'var(--v2-surface)', borderColor: 'var(--v2-border)' }}
              >
                <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--v2-text)' }}>
                  Character pick rates
                </h2>
                {characterEntries.some(([, v]) => v.picks > 0) ? (
                  <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                    {/* Column headers */}
                    <div className="grid grid-cols-[1fr_56px_52px] text-xs pb-1 border-b" style={{ color: 'var(--v2-muted)', borderColor: 'var(--v2-border)' }}>
                      <span>Character</span>
                      <span className="text-right">Matches</span>
                      <span className="text-right">Pick %</span>
                    </div>
                    {characterEntries.map(([name, stats]) => {
                      const pct = ((stats?.picks || 0) / totalPicks) * 100
                      return (
                        <div key={name} className="grid grid-cols-[1fr_56px_52px] items-center gap-2">
                          <div>
                            <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--v2-text)' }}>{name}</p>
                            <div
                              className="h-1.5 rounded-full overflow-hidden"
                              style={{ background: 'var(--v2-hover)' }}
                            >
                              <div
                                className="h-full rounded-full"
                                style={{ width: `${pct}%`, background: accent }}
                              />
                            </div>
                          </div>
                          <p className="text-xs text-right" style={{ color: 'var(--v2-muted)' }}>
                            {(stats?.picks || 0).toLocaleString()}
                          </p>
                          <p className="text-xs text-right" style={{ color: 'var(--v2-muted)' }}>
                            {pct.toFixed(1)}%
                          </p>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-sm" style={{ color: 'var(--v2-muted)' }}>
                    No pick data yet.
                  </p>
                )}
              </div>
            </div>

            {/* Super Art donuts */}
            <div
              className="rounded-lg border p-5"
              style={{ background: 'var(--v2-surface)', borderColor: 'var(--v2-border)' }}
            >
              <h2 className="text-sm font-semibold mb-1" style={{ color: 'var(--v2-text)' }}>
                Super Art usage
              </h2>
              <p className="text-xs mb-5" style={{ color: 'var(--v2-muted)' }}>
                SA1 / SA2 / SA3 breakdown per character
              </p>
              {/* Legend */}
              <div className="flex gap-4 mb-5">
                {(['SA1', 'SA2', 'SA3'] as const).map((sa, i) => (
                  <div key={sa} className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: SA_COLORS[i] }} />
                    <span className="text-xs" style={{ color: 'var(--v2-muted)' }}>{sa}</span>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-4">
                {characterEntries.map(([name, stats]) => (
                  <SuperArtDonut
                    key={name}
                    name={name}
                    stats={stats}
                    colors={SA_COLORS}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
