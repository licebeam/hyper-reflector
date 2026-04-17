import { useCallback, useEffect, useRef, useState } from 'react'
import { listen } from '@tauri-apps/api/event'
// @ts-ignore
import keys from '../../src/private/keys'
import type { V2User, V2Message, V2Lobby, ConnectionStatus } from '../types'
import {
  initWebRTC,
  startCall,
  answerCall,
  declineCall as webrtcDeclineCall,
  closeConnectionWithUser,
} from '../../src/webRTC/WebPeer'
import { isMockUserId, startMockMatch, startProxyMatch } from '../../src/match'

const DEFAULT_LOBBY_ID = 'Hyper Reflector'
const MAX_MESSAGES = 50
const MAX_SUBSCRIPTIONS = 5
const STORAGE_KEY = 'v2_subscribed_lobbies'

// ── Mock users for the debug/bot lobby ────────────────────────────────────────

const MOCK_USER_1: V2User = {
  uid: 'mock-opponent',
  userName: 'Mock Opponent',
  accountElo: 1625,
  countryCode: 'US',
  userTitle: { bgColor: '#1f1f24', border: '#37373f', color: '#f2f2f7', title: 'Training Partner' },
  lastKnownPings: [{ id: 'mock-opponent-2', ping: 92 }],
  knownAliases: ['TrainingBot', 'MockOpponent'],
  userProfilePic: '',
  gravEmail: '',
  userEmail: 'mock@hyper-reflector.test',
  isRankQueued: false,
}

const MOCK_USER_2: V2User = {
  uid: 'mock-opponent-2',
  userName: 'Mock Challenger',
  accountElo: 1580,
  countryCode: 'JP',
  userTitle: { bgColor: '#1f1f24', border: '#37373f', color: '#f2f2f7', title: 'Training Rival' },
  lastKnownPings: [{ id: 'mock-opponent', ping: 92 }],
  knownAliases: ['PracticeBot', 'MockChallenger'],
  userProfilePic: '',
  gravEmail: '',
  userEmail: 'mock2@hyper-reflector.test',
  isRankQueued: false,
}

function getMockUser(uid: string): V2User | null {
  if (uid === MOCK_USER_1.uid) return MOCK_USER_1
  if (uid === MOCK_USER_2.uid) return MOCK_USER_2
  return null
}

function injectMockUsers(users: V2User[], lobbyId: string, viewer: V2User | null): V2User[] {
  if (lobbyId.trim().toLowerCase() !== 'debug') return users
  const existing = new Set(users.map(u => u.uid))
  const result = [...users]
  const mockDefs: [V2User, number][] = [
    [MOCK_USER_1, 46],
    [MOCK_USER_2, 128],
  ]
  for (const [mock, ping] of mockDefs) {
    if (!existing.has(mock.uid)) {
      const clone: V2User = {
        ...mock,
        lastKnownPings: viewer
          ? [...mock.lastKnownPings, { id: viewer.uid, ping }]
          : mock.lastKnownPings,
      }
      result.push(clone)
      existing.add(mock.uid)
    }
  }
  return result
}

// ── User normalizer ───────────────────────────────────────────────────────────

function normalizeUser(data: any): V2User | null {
  if (!data || (!data.uid && !data.id)) return null
  return {
    uid: data.uid || data.id || 'unknown',
    userName: data.userName || data.name || data.uid || 'Unknown',
    accountElo: typeof data.accountElo === 'number' ? data.accountElo : 1200,
    countryCode: typeof data.countryCode === 'string' ? data.countryCode : '',
    userTitle: data.userTitle,
    lastKnownPings: Array.isArray(data.lastKnownPings) ? data.lastKnownPings : [],
    knownAliases: Array.isArray(data.knownAliases) ? data.knownAliases : [],
    userProfilePic: data.userProfilePic || '',
    gravEmail: data.gravEmail || '',
    userEmail: data.userEmail || '',
    isRankQueued: data.isRankQueued === true,
  }
}

function loadSavedLobbies(): string[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    const parsed = saved ? (JSON.parse(saved) as string[]) : []
    const valid = Array.isArray(parsed)
      ? parsed.filter(id => typeof id === 'string' && id.trim())
      : []
    if (!valid.includes(DEFAULT_LOBBY_ID)) valid.unshift(DEFAULT_LOBBY_ID)
    return valid.slice(0, MAX_SUBSCRIPTIONS)
  } catch {
    return [DEFAULT_LOBBY_ID]
  }
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useWebSocket(user: V2User | null) {
  const socketRef = useRef<WebSocket | null>(null)
  const userRef = useRef(user)

  // Per-lobby message/user state (plain objects for easy spread-clone)
  const allLobbyMessagesRef = useRef<Record<string, V2Message[]>>({})
  const allLobbyUsersRef = useRef<Record<string, V2User[]>>({})
  const [allLobbyMessages, setAllLobbyMessages] = useState<Record<string, V2Message[]>>({})
  const [allLobbyUsers, setAllLobbyUsers] = useState<Record<string, V2User[]>>({})

  const initialLobbies = useRef(loadSavedLobbies())
  const [subscribedLobbyIds, setSubscribedLobbyIds] = useState<string[]>(initialLobbies.current)
  // Always start on the default lobby tab regardless of saved tab order
  const [activeLobbyId, setActiveLobbyId] = useState(DEFAULT_LOBBY_ID)
  const [status, setStatus] = useState<ConnectionStatus>('disconnected')
  const [lobbyList, setLobbyList] = useState<V2Lobby[]>([])
  const [isInMatch, setIsInMatch] = useState(false)
  const [selfPings, setSelfPings] = useState<Array<{ id: string; ping: number | string; isUnstable?: boolean }>>([])

  // Reconnect state
  const [reconnectTick, setReconnectTick] = useState(0)
  const reconnectAttemptRef = useRef(0)
  const reconnectStartRef = useRef<number | null>(null)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const intentionalCloseRef = useRef(false)
  const MAX_RECONNECT_MS = 5 * 60 * 1000

  // Stable refs for use inside async/socket callbacks
  const lobbyListRef = useRef<V2Lobby[]>([])
  const subscribedLobbyIdsRef = useRef(initialLobbies.current)
  const activeLobbyIdRef = useRef(DEFAULT_LOBBY_ID)
  const isInMatchRef = useRef(false)
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null)
  const opponentUidRef = useRef<string | null>(null)
  const pendingOffersRef = useRef(new Map<string, { from: string; offer: RTCSessionDescriptionInit }>())
  const pendingByUserRef = useRef(new Map<string, string>())
  const pendingCandidatesRef = useRef(new Map<string, RTCIceCandidateInit[]>())
  const sentMatchRequestRef = useRef(new Set<string>())

  // Keep user ref in sync
  useEffect(() => { userRef.current = user }, [user])

  // Persist subscribed lobbies to localStorage whenever they change
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(subscribedLobbyIds)) } catch {}
  }, [subscribedLobbyIds])

  // ── Helpers ──────────────────────────────────────────────────────────────────

  const setLobbyUsersForId = useCallback((lobbyId: string, users: V2User[]) => {
    allLobbyUsersRef.current = { ...allLobbyUsersRef.current, [lobbyId]: users }
    setAllLobbyUsers(prev => ({ ...prev, [lobbyId]: users }))
  }, [])

  const addMessageToLobby = useCallback((lobbyId: string, msg: V2Message) => {
    const existing = allLobbyMessagesRef.current[lobbyId] ?? []
    const next = [...existing, msg].slice(-MAX_MESSAGES)
    allLobbyMessagesRef.current = { ...allLobbyMessagesRef.current, [lobbyId]: next }
    setAllLobbyMessages(prev => ({ ...prev, [lobbyId]: next }))
  }, [])

  const setActiveLobbyIdBoth = useCallback((id: string) => {
    activeLobbyIdRef.current = id
    setActiveLobbyId(id)
  }, [])

  const setIsInMatchBoth = useCallback((val: boolean) => {
    isInMatchRef.current = val
    setIsInMatch(val)
  }, [])

  const closePeerConnection = useCallback(() => {
    if (opponentUidRef.current) {
      closeConnectionWithUser(opponentUidRef.current).catch(() => {})
      opponentUidRef.current = null
    }
    if (peerConnectionRef.current) {
      try { peerConnectionRef.current.close() } catch {}
      peerConnectionRef.current = null
    }
  }, [])

  const addSystemMessage = useCallback((text: string) => {
    addMessageToLobby(activeLobbyIdRef.current, {
      id: `sys-${Date.now()}-${Math.random()}`,
      role: 'system',
      text,
      timeStamp: Date.now(),
    })
  }, [addMessageToLobby])

  // Patch a challenge message wherever it lives across all lobbies
  const updateChallengeMessage = useCallback((messageId: string, patch: Partial<V2Message>) => {
    setAllLobbyMessages(prev => {
      const next = { ...prev }
      for (const lid of Object.keys(next)) {
        if (next[lid].some(m => m.id === messageId)) {
          next[lid] = next[lid].map(m => m.id === messageId ? { ...m, ...patch } : m)
          allLobbyMessagesRef.current = next
          break
        }
      }
      return next
    })
  }, [])

  // ── Socket lifecycle ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!user) {
      setStatus('disconnected')
      if (socketRef.current) {
        socketRef.current.close()
        socketRef.current = null
      }
      return
    }

    setStatus('connecting')
    const url = `ws://${keys.COTURN_IP}:${keys.SIGNAL_PORT ?? '3004'}`
    const socket = new WebSocket(url)
    socketRef.current = socket

    socket.onopen = () => {
      // Successful connection — clear reconnect state
      reconnectAttemptRef.current = 0
      reconnectStartRef.current = null
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }
      setStatus('connected')
      const primaryLobby = subscribedLobbyIdsRef.current[0] ?? DEFAULT_LOBBY_ID
      socket.send(JSON.stringify({
        type: 'join',
        user: { ...userRef.current, lobbyId: primaryLobby },
      }))
      // Re-subscribe to any additional saved lobbies
      for (const lobbyId of subscribedLobbyIdsRef.current.slice(1)) {
        try {
          socket.send(JSON.stringify({
            type: 'subscribeLobby',
            lobbyId,
            pass: '',
            user: { ...userRef.current, lobbyId },
          }))
        } catch {}
      }
    }

    socket.onerror = () => setStatus('error')
    socket.onclose = () => {
      if (socketRef.current === socket) socketRef.current = null
      setStatus('disconnected')

      // Don't reconnect if the close was intentional (user logout / effect cleanup)
      if (intentionalCloseRef.current || !userRef.current) {
        intentionalCloseRef.current = false
        return
      }

      // Start the 5-minute reconnect window on first failure
      const now = Date.now()
      if (reconnectStartRef.current === null) reconnectStartRef.current = now
      const elapsed = now - reconnectStartRef.current

      if (elapsed < MAX_RECONNECT_MS) {
        const delay = Math.min(2000 * Math.pow(2, reconnectAttemptRef.current), 30_000)
        reconnectAttemptRef.current++
        reconnectTimerRef.current = setTimeout(() => setReconnectTick(t => t + 1), delay)
      } else {
        // 5 minutes elapsed — give up and reset so a future login starts fresh
        reconnectStartRef.current = null
        reconnectAttemptRef.current = 0
      }
    }

    socket.onmessage = async (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data as string)
        if (!payload?.type) return

        const myUid = userRef.current?.uid

        switch (payload.type) {

          case 'connected-users': {
            if (!Array.isArray(payload.users)) break
            const targetLobby =
              typeof payload.lobbyId === 'string' && payload.lobbyId.trim()
                ? payload.lobbyId.trim()
                : activeLobbyIdRef.current
            const normalized = (payload.users as any[])
              .map((u: any) => normalizeUser(u))
              .filter((u: V2User | null): u is V2User => u !== null)
            setLobbyUsersForId(targetLobby, injectMockUsers(normalized, targetLobby, userRef.current))
            break
          }

          case 'getRoomMessage': {
            const sender = payload.sender || {}
            const msgLobbyId =
              typeof sender.lobbyId === 'string' && sender.lobbyId.trim()
                ? sender.lobbyId.trim()
                : activeLobbyIdRef.current
            addMessageToLobby(msgLobbyId, {
              id: payload.id || `msg-${Date.now()}`,
              role: 'user',
              text: String(payload.message || ''),
              timeStamp: typeof payload.timeStamp === 'number' ? payload.timeStamp : Date.now(),
              senderUid: sender.uid,
              userName: sender.userName || sender.name || sender.uid || 'Unknown',
            })
            break
          }

          case 'lobby-user-counts': {
            const rawLobbies = payload.updates ?? payload.lobbies
            if (!Array.isArray(rawLobbies)) break
            const lobbyMap = new Map<string, V2Lobby>()
            for (const entry of rawLobbies) {
              if (typeof entry?.name === 'string' && entry.name.trim()) {
                const name = entry.name.trim()
                lobbyMap.set(name, {
                  name,
                  users: typeof entry.users === 'number' ? entry.users : 0,
                  isPrivate: entry.isPrivate === true,
                  gameName: typeof entry.gameName === 'string' && entry.gameName ? entry.gameName : undefined,
                  ownerUid: typeof entry.ownerUid === 'string' && entry.ownerUid ? entry.ownerUid : undefined,
                })
              }
            }
            if (!lobbyMap.has(DEFAULT_LOBBY_ID)) {
              lobbyMap.set(DEFAULT_LOBBY_ID, { name: DEFAULT_LOBBY_ID, users: 0 })
            }
            const nextList = Array.from(lobbyMap.values())
            lobbyListRef.current = nextList
            setLobbyList(nextList)
            break
          }

          case 'lobby-joined': {
            const newId = typeof payload.lobbyId === 'string' ? payload.lobbyId.trim() : ''
            if (!newId) break

            if (payload.isSubscription) {
              // Multi-lobby: add a new tab without clearing existing data
              setSubscribedLobbyIds(prev => {
                if (prev.includes(newId)) return prev
                const next = [...prev, newId].slice(0, MAX_SUBSCRIPTIONS)
                subscribedLobbyIdsRef.current = next
                return next
              })
              setActiveLobbyIdBoth(newId)
              if (!allLobbyMessagesRef.current[newId]) {
                allLobbyMessagesRef.current = { ...allLobbyMessagesRef.current, [newId]: [] }
                setAllLobbyMessages(prev => ({ ...prev, [newId]: [] }))
              }
              if (!allLobbyUsersRef.current[newId]) {
                const withMocks = injectMockUsers([], newId, userRef.current)
                allLobbyUsersRef.current = { ...allLobbyUsersRef.current, [newId]: withMocks }
                setAllLobbyUsers(prev => ({ ...prev, [newId]: withMocks }))
              }
            } else {
              // Single-lobby switch (changeLobby / createLobby): replace everything
              subscribedLobbyIdsRef.current = [newId]
              setSubscribedLobbyIds([newId])
              setActiveLobbyIdBoth(newId)
              allLobbyMessagesRef.current = { [newId]: [] }
              setAllLobbyMessages({ [newId]: [] })
              allLobbyUsersRef.current = { [newId]: injectMockUsers([], newId, userRef.current) }
              setAllLobbyUsers({ [newId]: injectMockUsers([], newId, userRef.current) })
            }
            break
          }

          case 'lobby-closed': {
            if (typeof payload.lobbyId !== 'string') break
            const closedId = payload.lobbyId.trim()
            setLobbyList(prev => {
              const next = prev.filter(l => l.name !== closedId)
              if (!next.some(l => l.name === DEFAULT_LOBBY_ID)) {
                next.push({ name: DEFAULT_LOBBY_ID, users: 0 })
              }
              return next
            })
            setSubscribedLobbyIds(prev => {
              const next = prev.filter(id => id !== closedId)
              if (next.length === 0) next.push(DEFAULT_LOBBY_ID)
              subscribedLobbyIdsRef.current = next
              return next
            })
            if (activeLobbyIdRef.current === closedId) {
              setActiveLobbyIdBoth(subscribedLobbyIdsRef.current[0] ?? DEFAULT_LOBBY_ID)
            }
            break
          }

          case 'update-user-pinged': {
            const data = payload.data
            if (!data || typeof data !== 'object') break
            if (data.isNewPing) {
              if (typeof data.id === 'string' || typeof data.id === 'number') {
                const peerId = String(data.id)
                setSelfPings(prev => {
                  const filtered = prev.filter(p => p.id !== peerId)
                  return [...filtered, { id: peerId, ping: data.ping ?? 0, isUnstable: Boolean(data.isUnstable) }]
                })
              }
            } else if (Array.isArray(data.lastKnownPings)) {
              setSelfPings(data.lastKnownPings)
              const myUid = userRef.current?.uid
              if (myUid) {
                for (const [lid, users] of Object.entries(allLobbyUsersRef.current)) {
                  if (users.some(u => u.uid === myUid)) {
                    setLobbyUsersForId(lid, users.map(u =>
                      u.uid === myUid ? { ...u, lastKnownPings: data.lastKnownPings } : u
                    ))
                  }
                }
              }
            }
            break
          }

          case 'rank-queue-matched':
            // Server found a ranked match — match-start will follow
            break

          case 'webrtc-ping-offer': {
            if (!myUid || !payload.from || !payload.offer) break
            if (isInMatchRef.current) {
              try { socket.send(JSON.stringify({ type: 'webrtc-ping-decline', to: payload.from, from: myUid })) } catch {}
              break
            }

            const existingMsgId = pendingByUserRef.current.get(payload.from as string)
            const messageId = existingMsgId || `incoming-challenge-${payload.from}-${Date.now()}`

            pendingOffersRef.current.set(messageId, { from: payload.from, offer: payload.offer })
            pendingByUserRef.current.set(payload.from as string, messageId)
            pendingCandidatesRef.current.set(payload.from as string, [])

            let challengerName = String(payload.from)
            for (const users of Object.values(allLobbyUsersRef.current)) {
              const found = users.find(u => u.uid === payload.from)
              if (found) { challengerName = found.userName; break }
            }

            const activeLobbyGame = lobbyListRef.current.find(l => l.name === activeLobbyIdRef.current)?.gameName

            if (existingMsgId) {
              updateChallengeMessage(existingMsgId, {
                timeStamp: Date.now(),
                challengeStatus: undefined,
                challengeResponder: undefined,
                challengeGameName: activeLobbyGame,
              })
            } else {
              addMessageToLobby(activeLobbyIdRef.current, {
                id: messageId,
                role: 'challenge',
                text: `${challengerName} wants to challenge you!`,
                timeStamp: Date.now(),
                userName: challengerName,
                senderUid: payload.from as string,
                challengeChallengerId: payload.from as string,
                challengeOpponentId: myUid,
                challengeGameName: activeLobbyGame,
              })
            }
            break
          }

          case 'webrtc-ping-answer': {
            if (!payload.from || !payload.answer) break
            try {
              if (peerConnectionRef.current) {
                await peerConnectionRef.current.setRemoteDescription(
                  new RTCSessionDescription(payload.answer as RTCSessionDescriptionInit)
                )
                opponentUidRef.current = payload.from as string

                // Flush queued ICE candidates now that remote description is set
                const queued = pendingCandidatesRef.current.get(payload.from as string) || []
                for (const candidate of queued) {
                  try { await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate)) } catch {}
                }
                pendingCandidatesRef.current.delete(payload.from as string)
              }
            } catch (err) {
              console.error('[v2] Failed to set remote description from answer:', err)
            }

            const lobbyForMatch = activeLobbyIdRef.current || DEFAULT_LOBBY_ID
            const inferredGameName = lobbyListRef.current.find(l => l.name === lobbyForMatch)?.gameName
            const requesterUid = userRef.current?.uid

            if (
              requesterUid &&
              payload.from &&
              !isMockUserId(payload.from as string) &&
              !sentMatchRequestRef.current.has(payload.from as string)
            ) {
              socket.send(JSON.stringify({
                type: 'request-match',
                challengerId: requesterUid,
                opponentId: payload.from,
                requestedBy: requesterUid,
                lobbyId: lobbyForMatch,
                gameName: inferredGameName,
              }))
              sentMatchRequestRef.current.add(payload.from as string)
            }
            break
          }

          case 'webrtc-ping-candidate': {
            if (!payload.candidate || !payload.from) break
            try {
              const pc = peerConnectionRef.current
              const knownOpponent = opponentUidRef.current === payload.from
              const hasRemoteDesc = !!pc?.remoteDescription
              if (pc && knownOpponent && hasRemoteDesc) {
                await pc.addIceCandidate(
                  new RTCIceCandidate(payload.candidate as RTCIceCandidateInit)
                )
              } else {
                // Queue: remote description not yet set, or opponent not yet identified
                const queued = pendingCandidatesRef.current.get(payload.from as string) || []
                queued.push(payload.candidate as RTCIceCandidateInit)
                pendingCandidatesRef.current.set(payload.from as string, queued)
              }
            } catch (err) {
              console.error('[v2] Failed to add ICE candidate:', err)
            }
            break
          }

          case 'webrtc-ping-decline': {
            if (payload.from) {
              if (opponentUidRef.current === payload.from) closePeerConnection()
              sentMatchRequestRef.current.delete(payload.from as string)
              addSystemMessage('Challenge was declined.')
            }
            break
          }

          case 'match-start': {
            const matchId = typeof payload.matchId === 'string' ? payload.matchId : undefined
            const opponentUid = typeof payload.opponentUid === 'string' ? payload.opponentUid : undefined
            const rawSlot = payload.playerSlot !== undefined ? Number(payload.playerSlot) : undefined
            if (!matchId || !opponentUid || rawSlot === undefined) break
            const playerSlot: 0 | 1 = rawSlot === 0 ? 0 : 1
            const serverHost = typeof payload.serverHost === 'string' && payload.serverHost ? payload.serverHost : undefined
            const serverPort = payload.serverPort !== undefined ? Number(payload.serverPort) : undefined
            const gameName = typeof payload.gameName === 'string' && payload.gameName ? payload.gameName : undefined
            setIsInMatchBoth(true)
            try {
              await startProxyMatch({ matchId, opponentUid, playerSlot, serverHost, serverPort, gameName })
            } catch (err) {
              console.error('[v2] Failed to start proxy match:', err)
              setIsInMatchBoth(false)
            }
            sentMatchRequestRef.current.delete(opponentUid)
            break
          }

          case 'match-force-close':
          case 'matchEndedClose': {
            setIsInMatchBoth(false)
            closePeerConnection()
            break
          }

          case 'match-start-error': {
            setIsInMatchBoth(false)
            if (typeof payload.opponentId === 'string') sentMatchRequestRef.current.delete(payload.opponentId)
            if (typeof payload.challengerId === 'string') sentMatchRequestRef.current.delete(payload.challengerId)
            addSystemMessage('Match failed to start. Please try again.')
            break
          }

          default:
            break
        }
      } catch (err) {
        console.error('[v2] Failed to process socket message:', err)
      }
    }

    return () => {
      intentionalCloseRef.current = true
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }
      socket.close()
      if (socketRef.current === socket) socketRef.current = null
    }
  }, [user?.uid, reconnectTick, setLobbyUsersForId, addMessageToLobby, setActiveLobbyIdBoth, setIsInMatchBoth, closePeerConnection, addSystemMessage, updateChallengeMessage])

  // ── Mock challenge interval (debug lobby only) ────────────────────────────

  useEffect(() => {
    if (!user?.uid) return

    const MOCK_INTERVAL_MS = 8000
    const MOCK_CHALLENGE_LINES = [
      'wants to run a FT3 if you are up for it.',
      'is sending over a challenge request right now.',
      'thinks you owe them a rematch.',
    ]

    const tick = () => {
      const lobbyId = activeLobbyIdRef.current
      if (lobbyId.trim().toLowerCase() !== 'debug') return
      if (isInMatchRef.current) return
      if (Math.random() >= 0.4) return

      const mockUser = Math.random() < 0.5 ? MOCK_USER_1 : MOCK_USER_2
      const line = MOCK_CHALLENGE_LINES[Math.floor(Math.random() * MOCK_CHALLENGE_LINES.length)]
      const now = Date.now()
      const messageId = `mock-challenge-${mockUser.uid}-${now}`
      const myUid = userRef.current?.uid
      if (!myUid) return

      // Already has an unresolved challenge from this mock user? Skip.
      const existing = allLobbyMessagesRef.current[lobbyId] ?? []
      const hasPending = existing.some(
        m => m.role === 'challenge' && m.senderUid === mockUser.uid && !m.challengeStatus
      )
      if (hasPending) return

      const activeLobbyGame = lobbyListRef.current.find(l => l.name === lobbyId)?.gameName

      // Register a fake pending offer so acceptChallenge can route to startMockMatch
      pendingOffersRef.current.set(messageId, {
        from: mockUser.uid,
        offer: {} as RTCSessionDescriptionInit,
      })
      pendingByUserRef.current.set(mockUser.uid, messageId)

      addMessageToLobby(lobbyId, {
        id: messageId,
        role: 'challenge',
        text: `${mockUser.userName} ${line}`,
        timeStamp: now,
        userName: mockUser.userName,
        senderUid: mockUser.uid,
        challengeChallengerId: mockUser.uid,
        challengeOpponentId: myUid,
        challengeGameName: activeLobbyGame,
      })
    }

    const id = window.setInterval(tick, MOCK_INTERVAL_MS)
    return () => window.clearInterval(id)
  }, [user?.uid, addMessageToLobby])

  // ── Tauri emulator-exit listener ─────────────────────────────────────────

  useEffect(() => {
    if (typeof (window as any).__TAURI_INTERNALS__ === 'undefined') return
    let unlistenEnd: (() => void) | null = null
    let unlistenEndUi: (() => void) | null = null

    const handleEnd = () => {
      setIsInMatchBoth(false)
      closePeerConnection()
    }

    listen('endMatch', handleEnd).then(fn => { unlistenEnd = fn }).catch(() => {})
    listen('endMatchUI', handleEnd).then(fn => { unlistenEndUi = fn }).catch(() => {})

    return () => {
      unlistenEnd?.()
      unlistenEndUi?.()
    }
  }, [setIsInMatchBoth, closePeerConnection])

  // ── Public API ────────────────────────────────────────────────────────────────

  const sendMessage = useCallback((text: string): boolean => {
    const socket = socketRef.current
    const currentUser = userRef.current
    if (!socket || socket.readyState !== WebSocket.OPEN || !currentUser) return false
    try {
      socket.send(JSON.stringify({
        type: 'sendMessage',
        message: text,
        messageId: `${currentUser.uid}-${Date.now()}`,
        sender: { ...currentUser, lobbyId: activeLobbyIdRef.current },
      }))
      return true
    } catch { return false }
  }, [])

  const subscribeLobby = useCallback((lobbyId: string, pass?: string): boolean => {
    const socket = socketRef.current
    const currentUser = userRef.current
    if (!socket || socket.readyState !== WebSocket.OPEN || !currentUser) return false
    if (subscribedLobbyIdsRef.current.includes(lobbyId)) {
      setActiveLobbyIdBoth(lobbyId)
      return true
    }
    if (subscribedLobbyIdsRef.current.length >= MAX_SUBSCRIPTIONS) return false
    try {
      socket.send(JSON.stringify({
        type: 'subscribeLobby',
        lobbyId,
        pass: pass ?? '',
        user: { ...currentUser, lobbyId },
      }))
      return true
    } catch { return false }
  }, [setActiveLobbyIdBoth])

  const unsubscribeLobby = useCallback((lobbyId: string): void => {
    const socket = socketRef.current
    if (socket?.readyState === WebSocket.OPEN) {
      try { socket.send(JSON.stringify({ type: 'unsubscribeLobby', lobbyId })) } catch {}
    }
    setSubscribedLobbyIds(prev => {
      const next = prev.filter(id => id !== lobbyId)
      if (next.length === 0) next.push(DEFAULT_LOBBY_ID)
      subscribedLobbyIdsRef.current = next
      return next
    })
    if (activeLobbyIdRef.current === lobbyId) {
      setActiveLobbyIdBoth(subscribedLobbyIdsRef.current[0] ?? DEFAULT_LOBBY_ID)
    }
    setAllLobbyMessages(prev => { const n = { ...prev }; delete n[lobbyId]; allLobbyMessagesRef.current = n; return n })
    setAllLobbyUsers(prev => { const n = { ...prev }; delete n[lobbyId]; allLobbyUsersRef.current = n; return n })
  }, [setActiveLobbyIdBoth])

  const createLobby = useCallback((lobbyId: string, pass: string, isPrivate: boolean, gameName?: string): boolean => {
    const socket = socketRef.current
    const currentUser = userRef.current
    if (!socket || socket.readyState !== WebSocket.OPEN || !currentUser) return false
    try {
      socket.send(JSON.stringify({
        type: 'createLobby',
        lobbyId,
        pass,
        isPrivate,
        gameName: gameName || undefined,
        user: { ...currentUser, lobbyId },
      }))
      return true
    } catch { return false }
  }, [])

  const sendChallenge = useCallback(async (targetUid: string): Promise<void> => {
    const currentUser = userRef.current
    if (!currentUser?.uid || isInMatchRef.current) return

    if (isMockUserId(targetUid)) {
      const lobbyId = activeLobbyIdRef.current
      const gameName = lobbyListRef.current.find(l => l.name === lobbyId)?.gameName ?? null
      const mockUser = getMockUser(targetUid)
      setIsInMatchBoth(true)
      try {
        await startMockMatch({ matchId: `mock-${Date.now()}`, opponentName: mockUser?.userName ?? 'Bot', gameName, playerSlot: 0 })
      } catch (err) {
        console.error('[v2] Failed to start mock match:', err)
        setIsInMatchBoth(false)
      }
      return
    }

    const socket = socketRef.current
    if (!socket || socket.readyState !== WebSocket.OPEN) return
    closePeerConnection()
    sentMatchRequestRef.current.delete(targetUid)

    try {
      const peer = await initWebRTC(currentUser.uid, targetUid, socket)
      peerConnectionRef.current = peer
      opponentUidRef.current = targetUid
      await startCall(peer, socket, targetUid, currentUser.uid, true)
    } catch (err) {
      console.error('[v2] Failed to initiate challenge:', err)
      closePeerConnection()
    }
  }, [setIsInMatchBoth, closePeerConnection])

  const acceptChallenge = useCallback(async (messageId: string): Promise<void> => {
    const currentUser = userRef.current
    if (!currentUser?.uid) return

    const pendingOffer = pendingOffersRef.current.get(messageId)
    updateChallengeMessage(messageId, { challengeStatus: 'accepted', challengeResponder: currentUser.userName })

    if (!pendingOffer) return
    const { from, offer } = pendingOffer

    if (isMockUserId(from)) {
      pendingOffersRef.current.delete(messageId)
      pendingByUserRef.current.delete(from)
      pendingCandidatesRef.current.delete(from)
      const mockUser = getMockUser(from)
      const gameName = lobbyListRef.current.find(l => l.name === activeLobbyIdRef.current)?.gameName ?? null
      setIsInMatchBoth(true)
      try {
        await startMockMatch({ matchId: messageId, opponentName: mockUser?.userName ?? 'Bot', gameName, playerSlot: 1 })
      } catch (err) {
        console.error('[v2] Failed to start mock match from accept:', err)
        setIsInMatchBoth(false)
      }
      return
    }

    const socket = socketRef.current
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      pendingOffersRef.current.delete(messageId)
      pendingByUserRef.current.delete(from)
      pendingCandidatesRef.current.delete(from)
      return
    }

    if (peerConnectionRef.current) {
      try { peerConnectionRef.current.close() } catch {}
      peerConnectionRef.current = null
    }

    try {
      const peer = await initWebRTC(currentUser.uid, from, socket)
      peerConnectionRef.current = peer
      opponentUidRef.current = from

      await peer.setRemoteDescription(new RTCSessionDescription(offer))

      const queued = pendingCandidatesRef.current.get(from) || []
      for (const candidate of queued) {
        try { await peer.addIceCandidate(new RTCIceCandidate(candidate)) } catch {}
      }
      pendingCandidatesRef.current.delete(from)

      await answerCall(peer, socket, from, currentUser.uid)
    } catch (err) {
      console.error('[v2] Failed to accept challenge:', err)
      closePeerConnection()
    } finally {
      pendingOffersRef.current.delete(messageId)
      pendingByUserRef.current.delete(from)
    }
  }, [setIsInMatchBoth, closePeerConnection, updateChallengeMessage])

  const declineChallenge = useCallback(async (messageId: string): Promise<void> => {
    const currentUser = userRef.current
    const pendingOffer = pendingOffersRef.current.get(messageId)
    updateChallengeMessage(messageId, { challengeStatus: 'declined', challengeResponder: currentUser?.userName })

    if (!pendingOffer) return
    const { from } = pendingOffer
    const socket = socketRef.current

    if (socket?.readyState === WebSocket.OPEN && currentUser?.uid) {
      try { await webrtcDeclineCall(socket, from, currentUser.uid) } catch (err) {
        console.error('[v2] Failed to send decline:', err)
      }
    }

    pendingOffersRef.current.delete(messageId)
    pendingByUserRef.current.delete(from)
    pendingCandidatesRef.current.delete(from)
  }, [updateChallengeMessage])

  const markMatchEnded = useCallback(() => {
    setIsInMatchBoth(false)
    closePeerConnection()
  }, [setIsInMatchBoth, closePeerConnection])

  const toggleRankQueue = useCallback((isQueue: boolean): void => {
    const socket = socketRef.current
    const currentUser = userRef.current
    if (!socket || socket.readyState !== WebSocket.OPEN || !currentUser) return
    try {
      socket.send(JSON.stringify({
        type: 'updateSocketState',
        data: {
          uid: currentUser.uid,
          lobbyId: activeLobbyIdRef.current,
          stateToUpdate: { key: 'isRankQueued', value: isQueue },
        },
      }))
    } catch {}
  }, [])

  const reorderLobbies = useCallback((newOrder: string[]) => {
    subscribedLobbyIdsRef.current = newOrder
    setSubscribedLobbyIds(newOrder)
  }, [])

  const updateLobbyGame = useCallback((lobbyId: string, gameName: string): void => {
    const socket = socketRef.current
    if (!socket || socket.readyState !== WebSocket.OPEN) return
    try {
      socket.send(JSON.stringify({ type: 'updateLobbyGame', lobbyId, gameName }))
    } catch {}
  }, [])

  // Derived: active-tab slice
  const lobbyUsers = allLobbyUsers[activeLobbyId] ?? []
  const messages = allLobbyMessages[activeLobbyId] ?? []

  const isReconnecting = status === 'disconnected' && reconnectAttemptRef.current > 0

  return {
    status,
    isReconnecting,
    subscribedLobbyIds,
    activeLobbyId,
    setActiveLobbyId: setActiveLobbyIdBoth,
    lobbyUsers,
    messages,
    allLobbyMessages,
    allLobbyUsers,
    lobbyList,
    isInMatch,
    selfPings,
    sendMessage,
    subscribeLobby,
    unsubscribeLobby,
    reorderLobbies,
    updateLobbyGame,
    createLobby,
    sendChallenge,
    acceptChallenge,
    declineChallenge,
    markMatchEnded,
    toggleRankQueue,
  }
}
