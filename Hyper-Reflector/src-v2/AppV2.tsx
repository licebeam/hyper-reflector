import './styles.css'
import { useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { NavRail } from './components/NavRail'
import { Header } from './components/Header'
import { LobbyPage } from './pages/LobbyPage'
import { LoginPage } from './pages/LoginPage'
import { SettingsPage } from './pages/SettingsPage'
import { useWebSocket } from './hooks/useWebSocket'
import { auth } from '../src/utils/firebase'
import api from '../src/external-api/requests'
import type { V2User } from './types'

type Page = 'lobby' | 'home' | 'settings'
type AuthState = 'loading' | 'unauthenticated' | 'authenticated'

const DEFAULT_LOBBY = 'Hyper Reflector'

function mapToV2User(data: any, fallbackEmail?: string | null): V2User {
  return {
    uid: data.uid || '',
    userName: data.userName || 'Player',
    accountElo: typeof data.accountElo === 'number' ? data.accountElo : 1200,
    countryCode: data.countryCode || '',
    userTitle: data.userTitle,
    lastKnownPings: Array.isArray(data.lastKnownPings) ? data.lastKnownPings : [],
    knownAliases: Array.isArray(data.knownAliases) ? data.knownAliases : [],
    userProfilePic: data.userProfilePic || '',
    gravEmail: data.gravEmail || '',
    userEmail: data.userEmail || fallbackEmail || '',
  }
}

export default function AppV2() {
  const [authState, setAuthState] = useState<AuthState>('loading')
  const [user, setUser] = useState<V2User | null>(null)
  const [page, setPage] = useState<Page>('lobby')

  // WebSocket — hook is always called; internally skips connection when user is null
  const { status, lobbyUsers, messages, sendMessage } = useWebSocket(user, DEFAULT_LOBBY)

  useEffect(() => {
    return onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null)
        setAuthState('unauthenticated')
        return
      }

      try {
        // Register session with backend, then fetch full profile
        await api.addLoggedInUser(auth)
        const userData = await api.getUserByAuth(auth)

        if (userData && userData.uid) {
          setUser(mapToV2User(userData, firebaseUser.email))
        } else {
          throw new Error('Empty user profile from backend')
        }
      } catch (err) {
        // Backend unreachable or no profile — construct minimal user from Firebase data
        console.warn('[v2] Backend unavailable, using Firebase identity as fallback', err)
        setUser({
          uid: firebaseUser.uid,
          userName:
            firebaseUser.displayName ||
            firebaseUser.email?.split('@')[0] ||
            'Player',
          accountElo: 1200,
          countryCode: '',
          lastKnownPings: [],
          knownAliases: [],
          userProfilePic: '',
          gravEmail: '',
          userEmail: firebaseUser.email || '',
        })
      } finally {
        setAuthState('authenticated')
      }
    })
  }, [])

  const handleLogout = () => {
    // Firebase signOut is called by SettingsPage; this clears local state immediately
    setUser(null)
    setAuthState('unauthenticated')
    setPage('lobby')
  }

  // ── Auth states ──────────────────────────────────────────────────────────────

  if (authState === 'loading') {
    return (
      <div className="h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-orange-500 font-bold text-lg">Hyper Reflector</p>
          <p className="text-gray-500 text-sm animate-pulse">Loading...</p>
        </div>
      </div>
    )
  }

  if (authState === 'unauthenticated') {
    return <LoginPage />
  }

  // ── Authenticated layout ─────────────────────────────────────────────────────

  return (
    <div className="flex h-screen bg-gray-900 text-gray-100 overflow-hidden">
      <NavRail currentPage={page} onNavigate={setPage} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          lobbyId={DEFAULT_LOBBY}
          status={status}
          userName={user?.userName}
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
              <p className="text-gray-500 text-sm">Home — coming soon</p>
            </div>
          )}
          {page === 'settings' && user && (
            <SettingsPage user={user} onLogout={handleLogout} />
          )}
        </main>
      </div>
    </div>
  )
}
