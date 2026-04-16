import { useState } from 'react'
import { X, Users, Lock, Plus, LogIn } from 'lucide-react'
import type { V2Lobby } from '../types'

type LobbySelectorProps = {
  lobbies: V2Lobby[]
  currentLobbyId: string
  onJoin: (lobbyId: string, pass?: string) => boolean
  onCreate: (lobbyId: string, pass: string, isPrivate: boolean) => boolean
  onClose: () => void
}

export function LobbySelector({ lobbies, currentLobbyId, onJoin, onCreate, onClose }: LobbySelectorProps) {
  const [joinPassInputs, setJoinPassInputs] = useState<Record<string, string>>({})
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPass, setNewPass] = useState('')
  const [newPrivate, setNewPrivate] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleJoin = (lobby: V2Lobby) => {
    if (lobby.name === currentLobbyId) return
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
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
    >
      {/* Panel */}
      <div
        className="relative w-full max-w-md rounded-xl border shadow-2xl overflow-hidden"
        style={{ background: 'var(--v2-surface)', borderColor: 'var(--v2-border)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: 'var(--v2-border)' }}
        >
          <h2 className="text-sm font-semibold" style={{ color: 'var(--v2-text)' }}>
            Switch Lobby
          </h2>
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

        {/* Lobby list */}
        <div className="p-4 space-y-2 max-h-72 overflow-y-auto">
          {lobbies.length === 0 && (
            <p className="text-xs text-center py-4" style={{ color: 'var(--v2-muted)' }}>
              No lobbies available.
            </p>
          )}
          {lobbies.map(lobby => {
            const isCurrent = lobby.name === currentLobbyId
            const needsPass = lobby.isPrivate
            return (
              <div
                key={lobby.name}
                className="rounded-lg border p-3 space-y-2"
                style={{
                  borderColor: isCurrent ? 'var(--v2-accent)' : 'var(--v2-border)',
                  background: isCurrent ? 'color-mix(in srgb, var(--v2-accent) 8%, transparent)' : 'transparent',
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {needsPass && <Lock size={11} style={{ color: 'var(--v2-muted)' }} className="shrink-0" />}
                    <span className="text-sm font-medium truncate" style={{ color: 'var(--v2-text)' }}>
                      {lobby.name}
                    </span>
                    {isCurrent && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded shrink-0"
                        style={{ background: 'var(--v2-accent)', color: 'var(--v2-accent-fg)' }}>
                        current
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Users size={11} style={{ color: 'var(--v2-muted)' }} />
                    <span className="text-xs" style={{ color: 'var(--v2-muted)' }}>{lobby.users}</span>
                    {!isCurrent && (
                      <button
                        onClick={() => needsPass && !joinPassInputs[lobby.name]
                          ? setJoinPassInputs(prev => ({ ...prev, [lobby.name]: '' }))
                          : handleJoin(lobby)}
                        className="flex items-center gap-1 text-xs px-2 py-0.5 rounded transition-colors ml-1"
                        style={{ background: 'var(--v2-accent)', color: 'var(--v2-accent-fg)' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--v2-accent-hover)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'var(--v2-accent)')}
                      >
                        <LogIn size={10} /> Join
                      </button>
                    )}
                  </div>
                </div>

                {/* Password input for private lobbies */}
                {needsPass && !isCurrent && lobby.name in joinPassInputs && (
                  <div className="flex gap-2">
                    <input
                      type="password"
                      placeholder="Password"
                      value={joinPassInputs[lobby.name]}
                      onChange={e => setJoinPassInputs(prev => ({ ...prev, [lobby.name]: e.target.value }))}
                      onKeyDown={e => e.key === 'Enter' && handleJoin(lobby)}
                      className="flex-1 text-xs px-2 py-1 rounded border outline-none"
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
                      className="text-xs px-2 py-1 rounded transition-colors"
                      style={{ background: 'var(--v2-accent)', color: 'var(--v2-accent-fg)' }}
                    >
                      Go
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Create lobby section */}
        <div className="border-t p-4 space-y-3" style={{ borderColor: 'var(--v2-border)' }}>
          {!creating ? (
            <button
              onClick={() => setCreating(true)}
              className="w-full flex items-center justify-center gap-1.5 text-xs py-2 rounded border transition-colors"
              style={{ borderColor: 'var(--v2-border)', color: 'var(--v2-muted)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--v2-hover)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <Plus size={12} /> Create private lobby
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-medium" style={{ color: 'var(--v2-text)' }}>New lobby</p>

              {error && (
                <p className="text-xs" style={{ color: '#f87171' }}>{error}</p>
              )}

              <input
                type="text"
                placeholder="Lobby name"
                value={newName}
                onChange={e => { setNewName(e.target.value); setError(null) }}
                className="w-full text-xs px-2 py-1.5 rounded border outline-none"
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
                className="w-full text-xs px-2 py-1.5 rounded border outline-none"
                style={{
                  background: 'var(--v2-hover)',
                  borderColor: 'var(--v2-border)',
                  color: 'var(--v2-text)',
                }}
                onFocus={e => (e.currentTarget.style.borderColor = 'var(--v2-accent)')}
                onBlur={e => (e.currentTarget.style.borderColor = 'var(--v2-border)')}
              />

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={newPrivate}
                  onChange={e => setNewPrivate(e.target.checked)}
                  className="w-3.5 h-3.5 accent-[var(--v2-accent)]"
                />
                <span className="text-xs" style={{ color: 'var(--v2-muted)' }}>Private (invite only)</span>
              </label>

              <div className="flex gap-2">
                <button
                  onClick={handleCreate}
                  className="flex-1 text-xs py-1.5 rounded transition-colors"
                  style={{ background: 'var(--v2-accent)', color: 'var(--v2-accent-fg)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--v2-accent-hover)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'var(--v2-accent)')}
                >
                  Create
                </button>
                <button
                  onClick={() => { setCreating(false); setError(null) }}
                  className="flex-1 text-xs py-1.5 rounded border transition-colors"
                  style={{ borderColor: 'var(--v2-border)', color: 'var(--v2-muted)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--v2-hover)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
