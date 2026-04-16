import { useState } from 'react'
import type { V2User } from '../types'
import { CountryFlag } from './CountryFlag'
import { UserTitle } from './UserTitle'

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

// ── Player row ─────────────────────────────────────────────────────────────────

type RowProps = {
  user: V2User
  isSelf: boolean
  clickable: boolean
  onViewProfile?: (uid: string) => void
  currentUser?: V2User | null
}

function PlayerRow({ user, isSelf, clickable, onViewProfile, currentUser }: RowProps) {
  const [hovered, setHovered] = useState(false)
  const expanded = isSelf || hovered

  const { ping, isUnstable } = resolvePing(user, currentUser)
  const pingMs = ping !== null ? Math.round(ping) : null
  const pingLabel = ping === 0 ? '< 1 ms' : pingMs !== null ? `${pingMs} ms` : null
  const pColor = pingColor(ping, isUnstable)

  return (
    <div
      className="flex items-start gap-2.5 px-3 py-1 border-b transition-colors"
      style={{
        cursor: clickable ? 'pointer' : 'default',
        background: hovered || isSelf ? 'var(--v2-hover)' : 'transparent',
        borderColor: 'var(--v2-border)',
      }}
      onClick={() => clickable && onViewProfile!(user.uid)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <UserAvatar user={user} />

      <div className="flex-1 min-w-0">
        {/* Always visible: name + (you) + flag */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span
            className="text-sm font-medium truncate"
            style={{ color: isSelf ? 'var(--v2-name-self)' : 'var(--v2-text)' }}
          >
            {user.userName}
          </span>
          {isSelf && (
            <span className="text-[10px] shrink-0" style={{ color: 'var(--v2-muted)' }}>(you)</span>
          )}
          <CountryFlag code={user.countryCode} className="shrink-0" />
        </div>

        {/*
          Expandable section.
          transition-[grid-template-rows] is the Tailwind v4 arbitrary-property syntax.
          Both row values appear as complete literals here so the scanner picks them up.
        */}
        <div
          className={`grid overflow-hidden transition-[grid-template-rows] duration-200 ease-out ${
            expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
          }`}
        >
          <div className="overflow-hidden">
            <div className="pt-1 pb-0.5 space-y-1">
              {user.userTitle?.title && (
                <UserTitle title={user.userTitle} />
              )}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px]" style={{ color: 'var(--v2-muted)' }}>
                  {user.accountElo} ELO
                </span>
                {!isSelf && (
                  pingLabel !== null ? (
                    <span
                      className="text-[10px]"
                      style={{ color: pColor }}
                      title={isUnstable ? 'Unstable connection' : undefined}
                    >
                      {isUnstable ? `~${pingLabel}` : pingLabel}
                    </span>
                  ) : (
                    <span className="text-[10px]" style={{ color: 'var(--v2-muted)' }}>ping —</span>
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── List ───────────────────────────────────────────────────────────────────────

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
          const clickable = !isSelf && !!onViewProfile
          return (
            <PlayerRow
              key={user.uid}
              user={user}
              isSelf={isSelf}
              clickable={clickable}
              onViewProfile={onViewProfile}
              currentUser={currentUser}
            />
          )
        })}
      </div>
    </div>
  )
}
