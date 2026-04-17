import { useState } from 'react'
import { X, Users, Lock, Plus, Check } from 'lucide-react'
import type { V2Lobby } from '../types'

type LobbySelectorProps = {
  lobbies: V2Lobby[]
  currentLobbyId: string
  subscribedLobbyIds: string[]
  onJoin: (lobbyId: string, pass?: string) => boolean
  onCreate: (lobbyId: string, pass: string, isPrivate: boolean) => boolean
  onClose: () => void
}

export function LobbySelector({
  lobbies,
  currentLobbyId,
  subscribedLobbyIds,
  onJoin,
  onCreate,
  onClose,
}: LobbySelectorProps) {
  const [joinPassInputs, setJoinPassInputs] = useState<Record<string, string>>({})
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPass, setNewPass] = useState('')
  const [newPrivate, setNewPrivate] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleJoin = (lobby: V2Lobby) => {
    if (subscribedLobbyIds.includes(lobby.name)) return
    const pass = joinPassInputs[lobby.name] || ''
    const ok = onJoin(lobby.name, pass)
    if (ok) onClose()
  }

  const handleCreate = () => {
    const name = newName.trim()
    if (!name || name.length < 2) {
      setError('Lobby name must be at least 2 characters.')
      return
    }
    const ok = onCreate(name, newPass.trim(), newPrivate)
    if (ok) onClose()
    else setError('Could not create lobby. Make sure you are connected.')
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
    >
      {/* Panel — fixed size */}
      <div
        className="relative flex flex-col rounded-xl border shadow-2xl"
        style={{
          background: 'var(--v2-surface)',
          borderColor: 'var(--v2-border)',
          width: 680,
          height: 560,
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Title bar */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b shrink-0"
          style={{ borderColor: 'var(--v2-border)' }}
        >
          <div>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--v2-text)' }}>
              Lobbies
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--v2-muted)' }}>
              {lobbies.length} {lobbies.length === 1 ? 'lobby' : 'lobbies'} available
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded transition-colors"
            style={{ color: 'var(--v2-muted)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--v2-hover)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <X size={14} />
          </button>
        </div>

        {/* Lobby list — scrollable */}
        <div className="flex-1 overflow-y-auto p-4 space-y-1.5 min-h-0">
          {lobbies.length === 0 && (
            <div className="h-full flex items-center justify-center">
              <p className="text-sm" style={{ color: 'var(--v2-muted)' }}>
                No lobbies available yet.
              </p>
            </div>
          )}
          {lobbies.map(lobby => {
            const isSubscribed = subscribedLobbyIds.includes(lobby.name)
            const isActive = lobby.name === currentLobbyId
            const needsPass = lobby.isPrivate
            const passwordShowing = lobby.name in joinPassInputs

            return (
              <div
                key={lobby.name}
                className="rounded-lg border px-4 py-3"
                style={{
                  borderColor: isActive ? 'var(--v2-accent)' : 'var(--v2-border)',
                  background: isActive
                    ? 'color-mix(in srgb, var(--v2-accent) 6%, transparent)'
                    : isSubscribed
                    ? 'color-mix(in srgb, var(--v2-hover) 60%, transparent)'
                    : 'transparent',
                }}
              >
                <div className="flex items-center gap-3">
                  {/* Lock icon */}
                  {needsPass ? (
                    <Lock size={13} className="shrink-0" style={{ color: 'var(--v2-muted)' }} />
                  ) : (
                    <div className="w-3.25 shrink-0" />
                  )}

                  {/* Name */}
                  <span
                    className="flex-1 text-sm font-medium truncate min-w-0"
                    style={{ color: 'var(--v2-text)' }}
                  >
                    {lobby.name}
                  </span>

                  {/* User count */}
                  <div className="flex items-center gap-1 shrink-0">
                    <Users size={12} style={{ color: 'var(--v2-muted)' }} />
                    <span className="text-xs tabular-nums" style={{ color: 'var(--v2-muted)' }}>
                      {lobby.users}
                    </span>
                  </div>

                  {/* Action */}
                  {isSubscribed ? (
                    <div
                      className="flex items-center gap-1 text-xs px-2.5 py-1 rounded shrink-0"
                      style={{
                        background: 'color-mix(in srgb, var(--v2-accent) 15%, transparent)',
                        color: 'var(--v2-accent)',
                        border: '1px solid color-mix(in srgb, var(--v2-accent) 30%, transparent)',
                      }}
                    >
                      <Check size={11} />
                      {isActive ? 'Active' : 'Joined'}
                    </div>
                  ) : (
                    <button
                      onClick={() =>
                        needsPass && !passwordShowing
                          ? setJoinPassInputs(prev => ({ ...prev, [lobby.name]: '' }))
                          : handleJoin(lobby)
                      }
                      className="text-xs px-2.5 py-1 rounded transition-colors shrink-0"
                      style={{ background: 'var(--v2-accent)', color: 'var(--v2-accent-fg)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--v2-accent-hover)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'var(--v2-accent)')}
                    >
                      Join
                    </button>
                  )}
                </div>

                {/* Password input — only for non-subscribed private lobbies */}
                {needsPass && !isSubscribed && passwordShowing && (
                  <div className="flex gap-2 mt-2.5">
                    <input
                      type="password"
                      placeholder="Password"
                      value={joinPassInputs[lobby.name]}
                      onChange={e =>
                        setJoinPassInputs(prev => ({ ...prev, [lobby.name]: e.target.value }))
                      }
                      onKeyDown={e => e.key === 'Enter' && handleJoin(lobby)}
                      className="flex-1 text-xs px-2.5 py-1.5 rounded border outline-none"
                      style={{
                        background: 'var(--v2-hover)',
                        borderColor: 'var(--v2-border)',
                        color: 'var(--v2-text)',
                      }}
                      onFocus={e => (e.currentTarget.style.borderColor = 'var(--v2-accent)')}
                      onBlur={e => (e.currentTarget.style.borderColor = 'var(--v2-border)')}
                      autoFocus
                    />
                    <button
                      onClick={() => handleJoin(lobby)}
                      className="text-xs px-3 py-1.5 rounded transition-colors"
                      style={{ background: 'var(--v2-accent)', color: 'var(--v2-accent-fg)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--v2-accent-hover)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'var(--v2-accent)')}
                    >
                      Go
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Create lobby footer */}
        <div className="border-t p-4 space-y-3 shrink-0" style={{ borderColor: 'var(--v2-border)' }}>
          {!creating ? (
            <button
              onClick={() => setCreating(true)}
              className="w-full flex items-center justify-center gap-1.5 text-xs py-2.5 rounded border transition-colors"
              style={{ borderColor: 'var(--v2-border)', color: 'var(--v2-muted)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--v2-hover)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <Plus size={12} /> Create new lobby
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-medium" style={{ color: 'var(--v2-text)' }}>
                New lobby
              </p>

              {error && (
                <p className="text-xs" style={{ color: '#f87171' }}>
                  {error}
                </p>
              )}

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Lobby name"
                  value={newName}
                  onChange={e => { setNewName(e.target.value); setError(null) }}
                  className="flex-1 text-xs px-2.5 py-1.5 rounded border outline-none"
                  style={{
                    background: 'var(--v2-hover)',
                    borderColor: 'var(--v2-border)',
                    color: 'var(--v2-text)',
                  }}
                  onFocus={e => (e.currentTarget.style.borderColor = 'var(--v2-accent)')}
                  onBlur={e => (e.currentTarget.style.borderColor = 'var(--v2-border)')}
                  autoFocus
                />
                <input
                  type="password"
                  placeholder="Password (optional)"
                  value={newPass}
                  onChange={e => setNewPass(e.target.value)}
                  className="flex-1 text-xs px-2.5 py-1.5 rounded border outline-none"
                  style={{
                    background: 'var(--v2-hover)',
                    borderColor: 'var(--v2-border)',
                    color: 'var(--v2-text)',
                  }}
                  onFocus={e => (e.currentTarget.style.borderColor = 'var(--v2-accent)')}
                  onBlur={e => (e.currentTarget.style.borderColor = 'var(--v2-border)')}
                />
              </div>

              <div className="flex items-center justify-between gap-4">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={newPrivate}
                    onChange={e => setNewPrivate(e.target.checked)}
                    className="w-3.5 h-3.5 accent-(--v2-accent)"
                  />
                  <span className="text-xs" style={{ color: 'var(--v2-muted)' }}>
                    Private (invite only)
                  </span>
                </label>

                <div className="flex gap-2">
                  <button
                    onClick={() => { setCreating(false); setError(null) }}
                    className="text-xs px-3 py-1.5 rounded border transition-colors"
                    style={{ borderColor: 'var(--v2-border)', color: 'var(--v2-muted)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--v2-hover)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreate}
                    className="text-xs px-3 py-1.5 rounded transition-colors"
                    style={{ background: 'var(--v2-accent)', color: 'var(--v2-accent-fg)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--v2-accent-hover)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'var(--v2-accent)')}
                  >
                    Create
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
