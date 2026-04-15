import type { V2User } from '../types'

function getInitials(name: string): string {
  return name.slice(0, 2).toUpperCase()
}

type PlayerListProps = {
  users: V2User[]
  currentUserUid?: string
}

export function PlayerList({ users, currentUserUid }: PlayerListProps) {
  return (
    <div
      className="flex flex-col h-full border-l"
      style={{ borderColor: 'var(--v2-border)' }}
    >
      <div
        className="px-3 py-2 border-b shrink-0"
        style={{ borderColor: 'var(--v2-border)' }}
      >
        <span
          className="text-xs font-semibold uppercase tracking-wide"
          style={{ color: 'var(--v2-muted)' }}
        >
          Players ({users.length})
        </span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {users.length === 0 && (
          <p className="text-xs text-center pt-6 px-3" style={{ color: 'var(--v2-muted)' }}>
            No players in lobby
          </p>
        )}
        {users.map(user => (
          <div
            key={user.uid}
            className="flex items-center gap-2.5 px-3 py-2 transition-colors cursor-default"
            style={{
              background: user.uid === currentUserUid ? 'var(--v2-hover)' : undefined,
            }}
            onMouseEnter={e => {
              if (user.uid !== currentUserUid)
                (e.currentTarget as HTMLElement).style.background = 'var(--v2-hover)'
            }}
            onMouseLeave={e => {
              if (user.uid !== currentUserUid)
                (e.currentTarget as HTMLElement).style.background = ''
            }}
          >
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
              style={{ background: 'var(--v2-accent)', color: 'var(--v2-accent-fg)' }}
            >
              {getInitials(user.userName)}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <span
                  className="text-sm truncate"
                  style={{
                    color: user.uid === currentUserUid
                      ? 'var(--v2-name-self)'
                      : 'var(--v2-text)',
                  }}
                >
                  {user.userName}
                </span>
                {user.uid === currentUserUid && (
                  <span className="text-xs shrink-0" style={{ color: 'var(--v2-muted)' }}>
                    (you)
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs" style={{ color: 'var(--v2-muted)' }}>
                  {user.accountElo} ELO
                </span>
                {user.countryCode && (
                  <span className="text-xs" style={{ color: 'var(--v2-muted)' }}>
                    {user.countryCode.toUpperCase()}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
