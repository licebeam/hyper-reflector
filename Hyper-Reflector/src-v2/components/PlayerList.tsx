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
    <div className="flex flex-col h-full border-l border-gray-700">
      <div className="px-3 py-2 border-b border-gray-700 shrink-0">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
          Players ({users.length})
        </span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {users.length === 0 && (
          <p className="text-gray-500 text-xs text-center pt-6 px-3">
            No players in lobby
          </p>
        )}
        {users.map(user => (
          <div
            key={user.uid}
            className={`flex items-center gap-2.5 px-3 py-2 hover:bg-gray-700 transition-colors ${
              user.uid === currentUserUid ? 'bg-gray-700/50' : ''
            }`}
          >
            <div className="w-7 h-7 rounded-full bg-orange-500 flex items-center justify-center text-xs font-bold text-white shrink-0">
              {getInitials(user.userName)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <span
                  className={`text-sm truncate ${
                    user.uid === currentUserUid ? 'text-orange-400' : 'text-gray-100'
                  }`}
                >
                  {user.userName}
                </span>
                {user.uid === currentUserUid && (
                  <span className="text-xs text-gray-500 shrink-0">(you)</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">{user.accountElo} ELO</span>
                {user.countryCode && (
                  <span className="text-xs text-gray-500">
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
