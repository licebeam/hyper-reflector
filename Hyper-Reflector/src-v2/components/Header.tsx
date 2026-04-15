import type { ConnectionStatus } from '../types'

const STATUS_DOT: Record<ConnectionStatus, string> = {
  connected: 'bg-green-500',
  connecting: 'bg-yellow-500 animate-pulse',
  disconnected: 'bg-gray-500',
  error: 'bg-red-500',
}

const STATUS_LABEL: Record<ConnectionStatus, string> = {
  connected: 'Connected',
  connecting: 'Connecting...',
  disconnected: 'Disconnected',
  error: 'Connection error',
}

type HeaderProps = {
  lobbyId: string
  status: ConnectionStatus
  userName?: string
}

export function Header({ lobbyId, status, userName }: HeaderProps) {
  const switchTo = (version: string) => {
    localStorage.setItem('appVersion', version)
    window.location.reload()
  }

  return (
    <header className="h-12 flex items-center justify-between px-4 bg-gray-800 border-b border-gray-700 shrink-0">
      <div className="flex items-center gap-3">
        <span className="text-orange-500 font-medium text-sm">
          Lobby: {lobbyId}
        </span>
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${STATUS_DOT[status]}`} />
          <span className="text-gray-400 text-xs">{STATUS_LABEL[status]}</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {userName && (
          <span className="text-gray-300 text-sm">{userName}</span>
        )}
        <div className="flex rounded overflow-hidden border border-gray-600 text-xs font-medium">
          <button
            className="px-2.5 py-1 bg-gray-700 text-gray-400 hover:bg-gray-600 transition-colors"
            onClick={() => switchTo('v1')}
          >
            V1
          </button>
          <button
            className="px-2.5 py-1 bg-orange-500 text-white cursor-default"
          >
            V2
          </button>
        </div>
      </div>
    </header>
  )
}
