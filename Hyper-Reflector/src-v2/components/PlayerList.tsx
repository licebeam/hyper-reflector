import { useState } from 'react'
import type { V2User } from '../types'

// ── Ping helpers ───────────────────────────────────────────────────────────────

type PingResult = { ping: number | null; isUnstable?: boolean }

function toNum(v: unknown): number | null {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function resolvePing(user: V2User, viewer: V2User | null | undefined): PingResult {
  if (!viewer || viewer.uid === user.uid) return { ping: null }
  const vr = (viewer.lastKnownPings as any[])?.find(p => p?.id === user.uid)
  if (vr) return { ping: toNum(vr.ping), isUnstable: vr.isUnstable }
  const ur = (user.lastKnownPings as any[])?.find(p => p?.id === viewer.uid)
  if (ur) return { ping: toNum(ur.ping), isUnstable: ur.isUnstable }
  return { ping: null }
}

function pingColor(ping: number | null, isUnstable?: boolean): string {
  if (ping === null) return 'var(--v2-muted)'
  if (isUnstable) return '#fb923c'
  if (ping <= 30) return '#34d399'
  if (ping <= 80) return '#fbbf24'
  if (ping <= 150) return '#fb923c'
  return '#f87171'
}

// ── Country flag emoji ─────────────────────────────────────────────────────────

function toFlagEmoji(code?: string): string {
  if (!code || code.length < 2) return ''
  const base = 0x1F1E6 - 65
  return code.toUpperCase().split('').map(c => String.fromCodePoint(base + c.charCodeAt(0))).join('')
}

// ── Avatar ─────────────────────────────────────────────────────────────────────

function UserAvatar({ user }: { user: V2User }) {
  const [imgFailed, setImgFailed] = useState(false)
  const showImg = !!user.userProfilePic && !imgFailed
  return (
    <div
      className="w-8 h-8 rounded-full overflow-hidden shrink-0 flex items-center justify-center text-xs font-bold"
      style={{ background: 'var(--v2-accent)', color: 'var(--v2-accent-fg)' }}
    >
      {showImg ? (
        <img
          src={user.userProfilePic}
          alt=""
          className="w-full h-full object-cover"
          onError={() => setImgFailed(true)}
        />
      ) : (
        user.userName.slice(0, 2).toUpperCase()
      )}
    </div>
  )
}

// ── Component ──────────────────────────────────────────────────────────────────

type PlayerListProps = {
  users: V2User[]
  currentUser?: V2User | null
  onViewProfile?: (uid: string) => void
}

export function PlayerList({ users, currentUser, onViewProfile }: PlayerListProps) {
  return (
    <div className="flex flex-col h-full border-l" style={{ borderColor: 'var(--v2-border)' }}>
      <div className="px-3 py-2 border-b shrink-0" style={{ borderColor: 'var(--v2-border)' }}>
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--v2-muted)' }}>
          Players ({users.length})
        </span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {users.length === 0 && (
          <p className="text-xs text-center pt-6 px-3" style={{ color: 'var(--v2-muted)' }}>
            No players in lobby
          </p>
        )}

        {users.map(user => {
          const isSelf = user.uid === currentUser?.uid
          const { ping, isUnstable } = resolvePing(user, currentUser)
          const pingMs = ping !== null ? Math.round(ping) : null
          const pingLabel = ping === 0 ? '< 1 ms' : pingMs !== null ? `${pingMs} ms` : null
          const pColor = pingColor(ping, isUnstable)
          const flag = toFlagEmoji(user.countryCode)
          const clickable = !isSelf && !!onViewProfile

          return (
            <div
              key={user.uid}
              className="flex items-center gap-2.5 px-3 py-2 transition-colors"
              style={{
                cursor: clickable ? 'pointer' : 'default',
                background: isSelf ? 'var(--v2-hover)' : undefined,
              }}
              onClick={() => clickable && onViewProfile!(user.uid)}
              onMouseEnter={e => { if (clickable) (e.currentTarget as HTMLElement).style.background = 'var(--v2-hover)' }}
              onMouseLeave={e => { if (clickable && !isSelf) (e.currentTarget as HTMLElement).style.background = '' }}
            >
              <UserAvatar user={user} />

              <div className="flex-1 min-w-0">
                {/* Name row */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span
                    className="text-sm font-medium truncate"
                    style={{ color: isSelf ? 'var(--v2-name-self)' : 'var(--v2-text)' }}
                  >
                    {user.userName}
                  </span>
                  {isSelf && (
                    <span className="text-xs shrink-0" style={{ color: 'var(--v2-muted)' }}>(you)</span>
                  )}
                  {flag && <span className="text-xs shrink-0">{flag}</span>}
                </div>

                {/* Stats row */}
                <div className="flex items-center gap-2">
                  <span className="text-xs" style={{ color: 'var(--v2-muted)' }}>
                    {user.accountElo} ELO
                  </span>
                  {!isSelf && (
                    pingLabel !== null ? (
                      <span
                        className="text-xs"
                        style={{ color: pColor }}
                        title={isUnstable ? 'Unstable connection' : undefined}
                      >
                        {isUnstable ? `~${pingLabel}` : pingLabel}
                      </span>
                    ) : (
                      <span className="text-xs" style={{ color: 'var(--v2-muted)' }}>ping —</span>
                    )
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
