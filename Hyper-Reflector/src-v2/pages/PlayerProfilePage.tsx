import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  RefreshCcw,
  Save,
} from 'lucide-react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import {
  RegExpMatcher,
  englishDataset,
  englishRecommendedTransformers,
} from 'obscenity'
import api from '../../src/external-api/requests'
import { auth } from '../../src/utils/firebase'
import type { V2User } from '../types'

// ── Types ──────────────────────────────────────────────────────────────────────

type SuperArtStats = { wins?: number; losses?: number }
type PlayerCharacterStats = {
  picks: number
  superChoice?: SuperArtStats[] | Record<string, SuperArtStats>
}
type PlayerStats = {
  totalWins?: number
  totalLosses?: number
  totalGames?: number
  longestWinStreak?: number
  winStreak?: number
  accountElo?: number
  characters?: Record<string, PlayerCharacterStats>
}
type PlayerMatch = {
  id?: string
  sessionId?: string
  timestamp?: number
  player1Name?: string
  player2Name?: string
  p1Wins?: number
  p2Wins?: number
}
type ProfileData = {
  uid?: string
  userName?: string
  accountElo?: number
  countryCode?: string
  userTitle?: { title: string; color: string; textColor: string }
  userProfilePic?: string
  knownAliases?: string[]
  winStreak?: number
  longestWinStreak?: number
  assignedFlairs?: { title: string; color: string; textColor: string }[]
}
type TitleOption = { title: string; color: string; textColor: string }

// ── Constants ──────────────────────────────────────────────────────────────────

const SA_COLORS: [string, string, string] = ['#ECC94B', '#ED8936', '#4299E1']

const matcher = new RegExpMatcher({
  ...englishDataset.build(),
  ...englishRecommendedTransformers,
})

// ── Helpers ────────────────────────────────────────────────────────────────────

function normalizeSuperChoices(choice?: PlayerCharacterStats['superChoice']): SuperArtStats[] {
  if (!choice) return []
  if (Array.isArray(choice)) return choice
  return Object.values(choice)
}

function toFlagEmoji(code?: string): string {
  if (!code || code.length < 2) return ''
  const base = 0x1F1E6 - 65
  return code.toUpperCase().split('').map(c => String.fromCodePoint(base + c.charCodeAt(0))).join('')
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Avatar({ user }: { user: ProfileData }) {
  const [failed, setFailed] = useState(false)
  const show = !!user.userProfilePic && !failed
  return (
    <div
      className="w-20 h-20 rounded-full overflow-hidden shrink-0 flex items-center justify-center text-xl font-bold"
      style={{ background: 'var(--v2-accent)', color: 'var(--v2-accent-fg)' }}
    >
      {show
        ? <img src={user.userProfilePic} alt="" className="w-full h-full object-cover" onError={() => setFailed(true)} />
        : (user.userName || '?').slice(0, 2).toUpperCase()}
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg p-4 border" style={{ background: 'var(--v2-surface)', borderColor: 'var(--v2-border)' }}>
      <p className="text-xs mb-1" style={{ color: 'var(--v2-muted)' }}>{label}</p>
      <p className="text-xl font-bold" style={{ color: 'var(--v2-accent)' }}>{value}</p>
    </div>
  )
}

function CharSADonut({ name, stats }: { name: string; stats: PlayerCharacterStats }) {
  const superChoices = normalizeSuperChoices(stats.superChoice)
  const data = [0, 1, 2].map(i => {
    const e = superChoices[i]
    return { name: `SA ${i + 1}`, value: (e?.wins || 0) + (e?.losses || 0), color: SA_COLORS[i] }
  })
  const hasData = data.some(d => d.value > 0)
  return (
    <div
      className="flex flex-col items-center gap-2 rounded-lg border p-4"
      style={{ background: 'var(--v2-surface)', borderColor: 'var(--v2-border)' }}
    >
      <p className="text-xs font-semibold" style={{ color: 'var(--v2-text)' }}>{name}</p>
      {hasData ? (
        <div className="w-28 h-28">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip
                contentStyle={{ background: 'var(--v2-surface)', border: '1px solid var(--v2-border)', borderRadius: '6px', fontSize: '11px' }}
                itemStyle={{ color: 'var(--v2-text)' }}
                cursor={false}
              />
              <Pie innerRadius={32} outerRadius={48} isAnimationActive={false} data={data} dataKey="value">
                {data.map(item => <Cell key={item.name} fill={item.color} />)}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="text-xs py-4" style={{ color: 'var(--v2-muted)' }}>—</p>
      )}
      <p className="text-xs" style={{ color: 'var(--v2-muted)' }}>{stats.picks || 0} picks</p>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

type PlayerProfilePageProps = {
  profileUid: string
  currentUser: V2User | null
  onBack: () => void
  onUserUpdated?: (updated: Partial<V2User>) => void
}

export function PlayerProfilePage({ profileUid, currentUser, onBack, onUserUpdated }: PlayerProfilePageProps) {
  const isSelf = !!currentUser && currentUser.uid === profileUid
  const canEdit = isSelf

  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [playerStats, setPlayerStats] = useState<PlayerStats | null>(null)
  const [titles, setTitles] = useState<TitleOption[]>([])
  const [matches, setMatches] = useState<PlayerMatch[]>([])
  const [matchCursor, setMatchCursor] = useState<{ last?: string | null; first?: string | null }>({})
  const [profileLoading, setProfileLoading] = useState(true)
  const [matchesLoading, setMatchesLoading] = useState(false)
  const [charOpen, setCharOpen] = useState(false)
  const [matchesOpen, setMatchesOpen] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [nameInvalid, setNameInvalid] = useState(false)
  const [pendingTitle, setPendingTitle] = useState<TitleOption | null>(null)
  const [titlePickerOpen, setTitlePickerOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // ── Load profile ─────────────────────────────────────────────────────────────

  const loadProfile = useCallback(async () => {
    if (!auth.currentUser) return
    setProfileLoading(true)
    try {
      const [userData, statsData, titlesData] = await Promise.all([
        api.getUserData(auth, profileUid),
        api.getPlayerStats(auth, profileUid),
        canEdit ? api.getAllTitles(auth, profileUid) : Promise.resolve(null),
      ])
      if (userData) {
        const p = userData as ProfileData
        setProfile(p)
        setNameDraft(p.userName || '')
        setPendingTitle(p.userTitle || null)
      }
      if (statsData?.playerStatSet) setPlayerStats(statsData.playerStatSet as PlayerStats)
      else if (statsData) setPlayerStats(statsData as PlayerStats)

      if (canEdit) {
        const serverTitles: TitleOption[] = Array.isArray(titlesData?.titleData?.titles)
          ? titlesData.titleData.titles as TitleOption[]
          : []
        const assignedFlairs: TitleOption[] = Array.isArray((userData as ProfileData)?.assignedFlairs)
          ? (userData as ProfileData).assignedFlairs!
          : []
        const merged: TitleOption[] = [...serverTitles]
        const seen = new Set(serverTitles.map(t => t.title))
        for (const f of assignedFlairs) {
          if (!seen.has(f.title)) { merged.push(f); seen.add(f.title) }
        }
        setTitles(merged)
      }
    } catch (err) {
      console.error('[v2] PlayerProfilePage: loadProfile failed', err)
    } finally {
      setProfileLoading(false)
    }
  }, [profileUid, canEdit])

  useEffect(() => { void loadProfile() }, [loadProfile])

  // ── Load matches ─────────────────────────────────────────────────────────────

  // Cursors passed explicitly so this callback is stable and doesn't re-trigger effects
  const fetchMatches = useCallback(async (
    direction: 'initial' | 'next' | 'prev',
    cursorLast: string | null | undefined,
    cursorFirst: string | null | undefined,
  ) => {
    if (!auth.currentUser) return
    setMatchesLoading(true)
    try {
      const nextCursor = direction === 'next' ? cursorLast ?? null : null
      const prevCursor = direction === 'prev' ? cursorFirst ?? null : null
      const res = await (api.getUserMatches as unknown as (
        auth: unknown, uid: string, last?: string | null, first?: string | null
      ) => Promise<any>)(auth, profileUid, nextCursor, prevCursor)
      if (res?.matches) {
        setMatches(res.matches as PlayerMatch[])
        setMatchCursor({ last: res.lastVisible, first: res.firstVisible })
      } else if (direction === 'initial') {
        setMatches([])
        setMatchCursor({})
      }
    } catch (err) {
      console.error('[v2] PlayerProfilePage: fetchMatches failed', err)
    } finally {
      setMatchesLoading(false)
    }
  }, [profileUid])

  useEffect(() => {
    if (matchesOpen && matches.length === 0) void fetchMatches('initial', null, null)
  }, [matchesOpen, fetchMatches, matches.length])

  // ── Name validation ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (!nameDraft.trim()) { setNameInvalid(true); return }
    setNameInvalid(matcher.hasMatch(nameDraft))
  }, [nameDraft])

  // ── Derived ───────────────────────────────────────────────────────────────────

  const winStats = useMemo(() => {
    const totalGames = playerStats?.totalGames ?? 0
    const totalWins = playerStats?.totalWins ?? 0
    const totalLosses = playerStats?.totalLosses ?? 0
    const winRate = totalGames > 0 ? ((totalWins / totalGames) * 100).toFixed(1) : '0.0'
    return { totalGames, totalWins, totalLosses, winRate }
  }, [playerStats])

  const characterEntries = useMemo(() => {
    if (!playerStats?.characters) return []
    return Object.entries(playerStats.characters).sort((a, b) => (b[1]?.picks || 0) - (a[1]?.picks || 0))
  }, [playerStats])

  const elo = playerStats?.accountElo ?? profile?.accountElo
  const displayElo = elo !== undefined && elo !== null ? Math.round(elo) : null

  // ── Save ──────────────────────────────────────────────────────────────────────

  const saveProfile = async () => {
    if (!canEdit || !profile || !auth.currentUser) return
    const payload: Record<string, unknown> = {}
    const trimName = nameDraft.trim()
    if (!nameInvalid && trimName && trimName !== profile.userName) payload.userName = trimName
    if (pendingTitle && pendingTitle.title !== profile.userTitle?.title) payload.userTitle = pendingTitle
    if (!Object.keys(payload).length) return
    setSaving(true)
    setSaveError(null)
    try {
      await api.updateUserData(auth, payload)
      setProfile(prev => prev ? { ...prev, ...payload } : prev)
      onUserUpdated?.(payload as Partial<V2User>)
    } catch (err) {
      console.error('[v2] PlayerProfilePage: saveProfile failed', err)
      setSaveError('Update failed. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  const flag = toFlagEmoji(profile?.countryCode)

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto p-6 space-y-5">

        {/* Nav */}
        <div className="flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm transition-colors"
            style={{ color: 'var(--v2-muted)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--v2-text)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--v2-muted)')}
          >
            <ArrowLeft size={14} /> Back to profiles
          </button>
          <button
            onClick={() => void loadProfile()}
            className="flex items-center gap-1 text-xs px-2 py-1 rounded border transition-colors"
            style={{ borderColor: 'var(--v2-border)', color: 'var(--v2-muted)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--v2-hover)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <RefreshCcw size={12} /> Refresh
          </button>
        </div>

        {/* Profile card */}
        <div className="rounded-lg border p-5" style={{ background: 'var(--v2-surface)', borderColor: 'var(--v2-border)' }}>
          {profileLoading ? (
            <div className="flex justify-center py-10">
              <div className="w-7 h-7 rounded-full border-2 border-t-transparent animate-spin"
                style={{ borderColor: 'var(--v2-accent)', borderTopColor: 'transparent' }} />
            </div>
          ) : profile ? (
            <div className="space-y-5">
              {/* Avatar + identity */}
              <div className="flex gap-5 flex-wrap">
                <Avatar user={profile} />
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-xl font-bold" style={{ color: 'var(--v2-text)' }}>{profile.userName}</h1>
                    {flag && <span>{flag}</span>}
                    {isSelf && <span className="text-xs" style={{ color: 'var(--v2-muted)' }}>(you)</span>}
                  </div>
                  {profile.userTitle?.title && (
                    <span
                      className="inline-block text-xs px-2 py-0.5 rounded"
                      style={{
                        background: profile.userTitle.color || 'var(--v2-hover)',
                        color: profile.userTitle.textColor || 'var(--v2-text)',
                      }}
                    >
                      {profile.userTitle.title}
                    </span>
                  )}
                  <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--v2-muted)' }}>
                    {displayElo !== null && <span>ELO {displayElo}</span>}
                    {(profile.winStreak ?? 0) > 0 && <span>🔥 {profile.winStreak} win streak</span>}
                  </div>
                  {Array.isArray(profile.knownAliases) && profile.knownAliases.length > 0 && (
                    <p className="text-xs" style={{ color: 'var(--v2-muted)' }}>
                      aka {profile.knownAliases.slice(0, 5).join(', ')}
                    </p>
                  )}
                </div>

                {/* Edit panel (self only) */}
                {canEdit && (
                  <div className="w-full sm:w-64 space-y-3 pt-1">
                    <div>
                      <label className="text-xs font-medium block mb-1" style={{ color: 'var(--v2-muted)' }}>
                        Display name
                      </label>
                      <input
                        type="text"
                        value={nameDraft}
                        maxLength={16}
                        onChange={e => setNameDraft(e.target.value)}
                        className="w-full rounded px-3 py-1.5 text-sm border outline-none transition-colors"
                        style={{
                          background: 'var(--v2-hover)',
                          borderColor: nameInvalid ? '#f87171' : 'var(--v2-border)',
                          color: 'var(--v2-text)',
                        }}
                        onFocus={e => (e.currentTarget.style.borderColor = nameInvalid ? '#f87171' : 'var(--v2-accent)')}
                        onBlur={e => (e.currentTarget.style.borderColor = nameInvalid ? '#f87171' : 'var(--v2-border)')}
                      />
                      {nameInvalid && <p className="text-xs mt-0.5" style={{ color: '#f87171' }}>Please choose a different name.</p>}
                    </div>

                    {titles.length > 0 && (
                      <div>
                        <label className="text-xs font-medium block mb-1" style={{ color: 'var(--v2-muted)' }}>Title flair</label>
                        <div className="flex items-center gap-2">
                          {pendingTitle?.title ? (
                            <span
                              className="text-xs px-2 py-0.5 rounded"
                              style={{ background: pendingTitle.color, color: pendingTitle.textColor }}
                            >
                              {pendingTitle.title}
                            </span>
                          ) : (
                            <span className="text-xs" style={{ color: 'var(--v2-muted)' }}>None</span>
                          )}
                          <button
                            onClick={() => setTitlePickerOpen(p => !p)}
                            className="text-xs px-2 py-0.5 rounded border transition-colors"
                            style={{ borderColor: 'var(--v2-border)', color: 'var(--v2-muted)' }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--v2-hover)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                          >
                            Change
                          </button>
                        </div>
                        {titlePickerOpen && (
                          <div
                            className="mt-2 rounded border p-2 space-y-1 max-h-40 overflow-y-auto"
                            style={{ background: 'var(--v2-hover)', borderColor: 'var(--v2-border)' }}
                          >
                            {titles.map(t => (
                              <button
                                key={t.title}
                                onClick={() => { setPendingTitle(t); setTitlePickerOpen(false) }}
                                className="w-full text-left px-2 py-1 rounded text-xs transition-colors"
                                style={{
                                  background: pendingTitle?.title === t.title ? t.color : 'transparent',
                                  color: pendingTitle?.title === t.title ? t.textColor : 'var(--v2-text)',
                                }}
                                onMouseEnter={e => { if (pendingTitle?.title !== t.title) (e.currentTarget as HTMLElement).style.background = 'var(--v2-surface)' }}
                                onMouseLeave={e => { if (pendingTitle?.title !== t.title) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                              >
                                <span className="px-1.5 py-0.5 rounded" style={{ background: t.color, color: t.textColor }}>
                                  {t.title}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {saveError && <p className="text-xs" style={{ color: '#f87171' }}>{saveError}</p>}

                    <button
                      onClick={() => void saveProfile()}
                      disabled={saving || nameInvalid}
                      className="flex items-center gap-1.5 w-full justify-center py-1.5 rounded text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{ background: 'var(--v2-accent)', color: 'var(--v2-accent-fg)' }}
                      onMouseEnter={e => { if (!saving) (e.currentTarget as HTMLElement).style.background = 'var(--v2-accent-hover)' }}
                      onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'var(--v2-accent)')}
                    >
                      <Save size={13} />
                      {saving ? 'Saving…' : 'Save profile'}
                    </button>
                  </div>
                )}
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard label="Total games" value={winStats.totalGames} />
                <StatCard label="Wins" value={winStats.totalWins} />
                <StatCard label="Losses" value={winStats.totalLosses} />
                <StatCard label="Win rate" value={`${winStats.winRate}%`} />
              </div>
            </div>
          ) : (
            <p className="text-sm py-4" style={{ color: 'var(--v2-muted)' }}>Profile unavailable.</p>
          )}
        </div>

        {/* Character usage */}
        <div className="rounded-lg border" style={{ background: 'var(--v2-surface)', borderColor: 'var(--v2-border)' }}>
          <button
            onClick={() => setCharOpen(p => !p)}
            className="w-full flex items-center justify-between px-5 py-3 text-left"
          >
            <span className="text-sm font-semibold" style={{ color: 'var(--v2-text)' }}>Character usage</span>
            {charOpen ? <ChevronUp size={14} style={{ color: 'var(--v2-muted)' }} /> : <ChevronDown size={14} style={{ color: 'var(--v2-muted)' }} />}
          </button>
          {charOpen && (
            <div className="px-5 pb-5">
              {characterEntries.length === 0 ? (
                <p className="text-xs" style={{ color: 'var(--v2-muted)' }}>No character data available yet.</p>
              ) : (
                <>
                  {/* SA legend */}
                  <div className="flex gap-4 mb-4">
                    {(['SA1', 'SA2', 'SA3'] as const).map((sa, i) => (
                      <div key={sa} className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: SA_COLORS[i] }} />
                        <span className="text-xs" style={{ color: 'var(--v2-muted)' }}>{sa}</span>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {characterEntries.map(([name, stats]) => (
                      <CharSADonut key={name} name={name} stats={stats} />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Recent matches */}
        <div className="rounded-lg border" style={{ background: 'var(--v2-surface)', borderColor: 'var(--v2-border)' }}>
          <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: 'var(--v2-border)' }}>
            <button
              onClick={() => setMatchesOpen(p => !p)}
              className="flex items-center gap-2 text-sm font-semibold flex-1 text-left"
              style={{ color: 'var(--v2-text)' }}
            >
              Recent matches
              {matchesOpen ? <ChevronUp size={14} style={{ color: 'var(--v2-muted)' }} /> : <ChevronDown size={14} style={{ color: 'var(--v2-muted)' }} />}
            </button>
            {matchesOpen && (
              <div className="flex gap-2">
                <button
                  onClick={() => void fetchMatches('prev', matchCursor.last, matchCursor.first)}
                  disabled={!matchCursor.first || matchesLoading}
                  className="text-xs px-2 py-1 rounded border transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ borderColor: 'var(--v2-border)', color: 'var(--v2-muted)' }}
                  onMouseEnter={e => { if (!matchesLoading && matchCursor.first) (e.currentTarget as HTMLElement).style.background = 'var(--v2-hover)' }}
                  onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
                >
                  Newer
                </button>
                <button
                  onClick={() => void fetchMatches('next', matchCursor.last, matchCursor.first)}
                  disabled={!matchCursor.last || matchesLoading}
                  className="text-xs px-2 py-1 rounded border transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ borderColor: 'var(--v2-border)', color: 'var(--v2-muted)' }}
                  onMouseEnter={e => { if (!matchesLoading && matchCursor.last) (e.currentTarget as HTMLElement).style.background = 'var(--v2-hover)' }}
                  onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
                >
                  Older
                </button>
              </div>
            )}
          </div>
          {matchesOpen && (
            <div className="p-4 space-y-2">
              {matchesLoading ? (
                <div className="flex justify-center py-4">
                  <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
                    style={{ borderColor: 'var(--v2-accent)', borderTopColor: 'transparent' }} />
                </div>
              ) : matches.length === 0 ? (
                <p className="text-xs py-2" style={{ color: 'var(--v2-muted)' }}>No matches recorded yet.</p>
              ) : (
                matches.map((match, i) => {
                  const date = match.timestamp ? new Date(match.timestamp).toLocaleString() : 'Unknown'
                  return (
                    <div
                      key={match.id ?? `${match.sessionId}-${i}`}
                      className="rounded border p-3"
                      style={{ borderColor: 'var(--v2-border)' }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium" style={{ color: 'var(--v2-text)' }}>
                          Session {match.sessionId || 'unknown'}
                        </span>
                        <span className="text-xs" style={{ color: 'var(--v2-muted)' }}>{date}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold" style={{ color: 'var(--v2-text)' }}>
                            {match.player1Name || 'Player 1'}
                          </p>
                          <p className="text-xs" style={{ color: 'var(--v2-muted)' }}>Wins: {match.p1Wins ?? 0}</p>
                        </div>
                        <span className="text-xs" style={{ color: 'var(--v2-muted)' }}>vs</span>
                        <div className="text-right">
                          <p className="text-sm font-semibold" style={{ color: 'var(--v2-text)' }}>
                            {match.player2Name || 'Player 2'}
                          </p>
                          <p className="text-xs" style={{ color: 'var(--v2-muted)' }}>Wins: {match.p2Wins ?? 0}</p>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
