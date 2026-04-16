import './styles.css'
import { useEffect, useState } from 'react'
import bgImage from '../src/assets/bgImage.svg'
import { onAuthStateChanged } from 'firebase/auth'
import { ThemeProvider, useV2Theme } from './ThemeContext'
import { NavRail, type Page } from './components/NavRail'
import { Header } from './components/Header'
import { LobbyPage } from './pages/LobbyPage'
import { LoginPage } from './pages/LoginPage'
import { SignupPage } from './pages/SignupPage'
import { SettingsPage } from './pages/SettingsPage'
import { LabPage } from './pages/LabPage'
import { HomePage } from './pages/HomePage'
import { useWebSocket } from './hooks/useWebSocket'
import { auth } from '../src/utils/firebase'
import api from '../src/external-api/requests'
import type { V2User } from './types'

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

// ── Inner app — has access to ThemeContext ────────────────────────────────────

function AppV2Inner() {
  const { vars } = useV2Theme()

  const [authState, setAuthState] = useState<AuthState>('loading')
  const [authView, setAuthView] = useState<'login' | 'signup'>('login')
  const [user, setUser] = useState<V2User | null>(null)
  const [page, setPage] = useState<Page>('lobby')

  // Hook always called — internally skips WS connection when user is null
  const { status, lobbyUsers, messages, sendMessage } = useWebSocket(user, DEFAULT_LOBBY)

  useEffect(() => {
    return onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null)
        setAuthState('unauthenticated')
        return
      }

      try {
        await api.addLoggedInUser(auth)
        const userData = await api.getUserByAuth(auth)

        if (userData && userData.uid) {
          setUser(mapToV2User(userData, firebaseUser.email))
        } else {
          throw new Error('Empty profile from backend')
        }
      } catch (err) {
        console.warn('[v2] Backend unavailable, using Firebase identity', err)
        // During signup, onAuthStateChanged fires before api.createAccount completes,
        // so the backend has no record yet. Read the name stashed in sessionStorage.
        const pendingName = sessionStorage.getItem('v2_pending_display_name')
        setUser({
          uid: firebaseUser.uid,
          userName: pendingName || firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Player',
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
    setUser(null)
    setAuthState('unauthenticated')
    setPage('lobby')
  }

  // CSS vars applied here cascade to every child via inheritance
  return (
    <div
      className="relative h-screen overflow-hidden v2-animated-bg"
      style={{
        ...(vars as unknown as React.CSSProperties),
        '--v2-bg-image': `url(${bgImage})`,
        color: 'var(--v2-text)',
      } as React.CSSProperties}
    >
      {authState === 'loading' && (
        <div className="h-full flex items-center justify-center">
          <div className="text-center space-y-2">
            <p className="font-bold text-lg" style={{ color: 'var(--v2-accent)' }}>
              Hyper Reflector
            </p>
            <p className="text-sm animate-pulse" style={{ color: 'var(--v2-muted)' }}>
              Loading...
            </p>
          </div>
        </div>
      )}

      {authState === 'unauthenticated' && (
        <div className="h-full">
          {authView === 'signup'
            ? <SignupPage onBack={() => setAuthView('login')} />
            : <LoginPage onSignup={() => setAuthView('signup')} />
          }
        </div>
      )}

      {authState === 'authenticated' && (
        <div className="flex h-full">
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
              {page === 'home' && <HomePage currentUser={user} />}
              {page === 'lab' && <LabPage />}
              {page === 'settings' && user && (
                <SettingsPage user={user} onLogout={handleLogout} />
              )}
            </main>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Root export — provides theme context ──────────────────────────────────────

export default function AppV2() {
  return (
    <ThemeProvider>
      <AppV2Inner />
    </ThemeProvider>
  )
}
