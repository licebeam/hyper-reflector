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
    <header
      className="h-12 flex items-center justify-between px-4 shrink-0 border-b"
      style={{ background: 'var(--v2-surface)', borderColor: 'var(--v2-border)' }}
    >
      <div className="flex items-center gap-3">
        <span className="font-medium text-sm" style={{ color: 'var(--v2-accent)' }}>
          Lobby: {lobbyId}
        </span>
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${STATUS_DOT[status]}`} />
          <span className="text-xs" style={{ color: 'var(--v2-muted)' }}>
            {STATUS_LABEL[status]}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {userName && (
          <span className="text-sm" style={{ color: 'var(--v2-text)' }}>
            {userName}
          </span>
        )}
        <div
          className="flex rounded overflow-hidden text-xs font-medium border"
          style={{ borderColor: 'var(--v2-border)' }}
        >
          <button
            className="px-2.5 py-1 transition-colors"
            style={{ background: 'var(--v2-hover)', color: 'var(--v2-muted)' }}
            onClick={() => switchTo('v1')}
          >
            V1
          </button>
          <span
            className="px-2.5 py-1"
            style={{ background: 'var(--v2-accent)', color: 'var(--v2-accent-fg)' }}
          >
            V2
          </span>
        </div>
      </div>
    </header>
  )
}
