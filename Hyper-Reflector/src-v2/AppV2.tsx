import './styles.css'
import { useState } from 'react'
import { NavRail } from './components/NavRail'
import { Header } from './components/Header'
import { LobbyPage } from './pages/LobbyPage'
import { useWebSocket } from './hooks/useWebSocket'
import type { V2User } from './types'

type Page = 'lobby' | 'home' | 'settings'

const STORAGE_KEY = 'v2_user'
const DEFAULT_LOBBY = 'Hyper Reflector'

function loadStoredUser(): V2User | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as V2User
  } catch {
    return null
  }
}

function createGuestUser(userName: string): V2User {
  return {
    uid: crypto.randomUUID(),
    userName: userName.trim(),
    accountElo: 1200,
    countryCode: '',
    lastKnownPings: [],
    knownAliases: [],
    userProfilePic: '',
    gravEmail: '',
    userEmail: '',
  }
}

function GuestSetup({ onJoin }: { onJoin: (user: V2User) => void }) {
  const [name, setName] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    const user = createGuestUser(trimmed)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
    onJoin(user)
  }

  return (
    <div className="h-screen bg-gray-900 flex items-center justify-center">
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-8 w-80 shadow-xl">
        <h1 className="text-orange-500 text-xl font-bold mb-1">Hyper Reflector</h1>
        <p className="text-gray-400 text-sm mb-6">V2 — Simple Lobby</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            autoFocus
            type="text"
            value={name}
            maxLength={24}
            onChange={e => setName(e.target.value)}
            placeholder="Enter your username..."
            className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-orange-500 transition-colors"
          />
          <button
            type="submit"
            disabled={!name.trim()}
            className="bg-orange-500 text-white rounded py-2 font-medium hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Join Lobby
          </button>
        </form>

        {/* Allow switching back to v1 even from setup screen */}
        <button
          className="mt-4 w-full text-xs text-gray-500 hover:text-gray-300 transition-colors"
          onClick={() => { localStorage.setItem('appVersion', 'v1'); window.location.reload() }}
        >
          Switch to V1
        </button>
      </div>
    </div>
  )
}

export default function AppV2() {
  const [user, setUser] = useState<V2User | null>(() => loadStoredUser())
  const [page, setPage] = useState<Page>('lobby')

  const { status, lobbyUsers, messages, sendMessage } = useWebSocket(user, DEFAULT_LOBBY)

  if (!user) {
    return <GuestSetup onJoin={setUser} />
  }

  return (
    <div className="flex h-screen bg-gray-900 text-gray-100 overflow-hidden">
      <NavRail currentPage={page} onNavigate={setPage} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          lobbyId={DEFAULT_LOBBY}
          status={status}
          userName={user.userName}
        />

        <main className="flex-1 overflow-hidden">
          {page === 'lobby' && (
            <LobbyPage
              messages={messages}
              lobbyUsers={lobbyUsers}
              currentUser={user}
              onSendMessage={sendMessage}
            />
          )}
          {page === 'home' && (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-500">Home — coming soon</p>
            </div>
          )}
          {page === 'settings' && (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-500">Settings — coming soon</p>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
