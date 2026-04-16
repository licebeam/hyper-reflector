import { useCallback, useEffect, useRef, useState } from 'react'
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
  }
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useWebSocket(user: V2User | null) {
  const socketRef = useRef<WebSocket | null>(null)
  const userRef = useRef(user)
  const lobbyUsersRef = useRef<V2User[]>([])

  const [status, setStatus] = useState<ConnectionStatus>('disconnected')
  const [lobbyUsers, setLobbyUsers] = useState<V2User[]>([])
  const [messages, setMessages] = useState<V2Message[]>([])
  const [currentLobbyId, setCurrentLobbyId] = useState(DEFAULT_LOBBY_ID)
  const [lobbyList, setLobbyList] = useState<V2Lobby[]>([])
  const [isInMatch, setIsInMatch] = useState(false)

  // Stable refs for async/socket callbacks
  const currentLobbyIdRef = useRef(DEFAULT_LOBBY_ID)
  const isInMatchRef = useRef(false)
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null)
  const opponentUidRef = useRef<string | null>(null)
  // messageId → {from, offer}
  const pendingOffersRef = useRef(new Map<string, { from: string; offer: RTCSessionDescriptionInit }>())
  // fromUid → messageId
  const pendingByUserRef = useRef(new Map<string, string>())
  // fromUid → queued ICE candidates
  const pendingCandidatesRef = useRef(new Map<string, RTCIceCandidateInit[]>())
  const sentMatchRequestRef = useRef(new Set<string>())

  // Keep user ref in sync
  useEffect(() => {
    userRef.current = user
  }, [user])

  // Sync lobbyUsers into ref
  useEffect(() => {
    lobbyUsersRef.current = lobbyUsers
  }, [lobbyUsers])

  // ── Helpers (stable via refs, safe to call from inside effect) ──────────────

  const updateLobbyUsers = useCallback((users: V2User[]) => {
    lobbyUsersRef.current = users
    setLobbyUsers(users)
  }, [])

  const setCurrentLobbyIdBoth = useCallback((id: string) => {
    currentLobbyIdRef.current = id
    setCurrentLobbyId(id)
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
    setMessages(prev => {
      const msg: V2Message = {
        id: `sys-${Date.now()}-${Math.random()}`,
        role: 'system',
        text,
        timeStamp: Date.now(),
      }
      const next = [...prev, msg]
      return next.length > MAX_MESSAGES ? next.slice(-MAX_MESSAGES) : next
    })
  }, [])

  // ── Socket lifecycle ────────────────────────────────────────────────────────

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
      setStatus('connected')
      socket.send(JSON.stringify({
        type: 'join',
        user: { ...userRef.current, lobbyId: currentLobbyIdRef.current },
      }))
    }

    socket.onerror = () => setStatus('error')

    socket.onclose = () => {
      if (socketRef.current === socket) socketRef.current = null
      setStatus('disconnected')
    }

    socket.onmessage = async (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data as string)
        if (!payload?.type) return

        const myUid = userRef.current?.uid

        switch (payload.type) {

          case 'connected-users': {
            if (Array.isArray(payload.users)) {
              const normalized = (payload.users as any[])
                .map((u: any) => normalizeUser(u))
                .filter((u: V2User | null): u is V2User => u !== null)
              const withMocks = injectMockUsers(normalized, currentLobbyIdRef.current, userRef.current)
              updateLobbyUsers(withMocks)
            }
            break
          }

          case 'getRoomMessage': {
            const sender = payload.sender || {}
            const msg: V2Message = {
              id: payload.id || `msg-${Date.now()}`,
              role: 'user',
              text: String(payload.message || ''),
              timeStamp: typeof payload.timeStamp === 'number' ? payload.timeStamp : Date.now(),
              senderUid: sender.uid,
              userName: sender.userName || sender.name || sender.uid || 'Unknown',
            }
            setMessages(prev => {
              const next = [...prev, msg]
              return next.length > MAX_MESSAGES ? next.slice(-MAX_MESSAGES) : next
            })
            break
          }

          case 'lobby-user-counts': {
            if (!Array.isArray(payload.lobbies)) break
            const lobbyMap = new Map<string, V2Lobby>()
            for (const entry of payload.lobbies) {
              if (typeof entry?.name === 'string' && entry.name.trim()) {
                const name = entry.name.trim()
                lobbyMap.set(name, {
                  name,
                  users: typeof entry.users === 'number' ? entry.users : 0,
                  isPrivate: entry.isPrivate === true,
                })
              }
            }
            if (!lobbyMap.has(DEFAULT_LOBBY_ID)) {
              lobbyMap.set(DEFAULT_LOBBY_ID, { name: DEFAULT_LOBBY_ID, users: 0 })
            }
            setLobbyList(Array.from(lobbyMap.values()))
            break
          }

          case 'lobby-joined': {
            if (typeof payload.lobbyId === 'string' && payload.lobbyId.trim()) {
              const newId = payload.lobbyId.trim()
              setCurrentLobbyIdBoth(newId)
              setMessages([])
              updateLobbyUsers(injectMockUsers([], newId, userRef.current))
            }
            break
          }

          case 'lobby-closed': {
            if (typeof payload.lobbyId === 'string') {
              const closedId = payload.lobbyId.trim()
              setLobbyList(prev => {
                const next = prev.filter(l => l.name !== closedId)
                if (!next.some(l => l.name === DEFAULT_LOBBY_ID)) {
                  next.push({ name: DEFAULT_LOBBY_ID, users: 0 })
                }
                return next
              })
              if (currentLobbyIdRef.current === closedId) {
                setCurrentLobbyIdBoth(DEFAULT_LOBBY_ID)
                setMessages([])
                updateLobbyUsers([])
              }
            }
            break
          }

          case 'update-user-pinged': {
            if (payload.user?.uid) {
              updateLobbyUsers(
                lobbyUsersRef.current.map((u: V2User) =>
                  u.uid === payload.user.uid
                    ? { ...u, lastKnownPings: payload.user.lastKnownPings ?? u.lastKnownPings }
                    : u
                )
              )
            }
            break
          }

          case 'webrtc-ping-offer': {
            if (!myUid || !payload.from || !payload.offer) break

            // Auto-decline if currently in a match
            if (isInMatchRef.current) {
              try {
                socket.send(JSON.stringify({ type: 'webrtc-ping-decline', to: payload.from, from: myUid }))
              } catch {}
              break
            }

            const existingMsgId = pendingByUserRef.current.get(payload.from as string)
            const messageId = existingMsgId || `incoming-challenge-${payload.from}-${Date.now()}`

            pendingOffersRef.current.set(messageId, { from: payload.from, offer: payload.offer })
            pendingByUserRef.current.set(payload.from as string, messageId)
            pendingCandidatesRef.current.set(payload.from as string, [])

            const challenger = lobbyUsersRef.current.find(u => u.uid === payload.from)
            const challengerName = challenger?.userName || String(payload.from)

            if (existingMsgId) {
              setMessages(prev => prev.map(m =>
                m.id === existingMsgId
                  ? { ...m, timeStamp: Date.now(), challengeStatus: undefined, challengeResponder: undefined }
                  : m
              ))
            } else {
              const msg: V2Message = {
                id: messageId,
                role: 'challenge',
                text: `${challengerName} wants to challenge you!`,
                timeStamp: Date.now(),
                userName: challengerName,
                senderUid: payload.from as string,
                challengeChallengerId: payload.from as string,
                challengeOpponentId: myUid,
              }
              setMessages(prev => {
                const next = [...prev, msg]
                return next.length > MAX_MESSAGES ? next.slice(-MAX_MESSAGES) : next
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
              }
            } catch (err) {
              console.error('[v2] Failed to set remote description from answer:', err)
            }

            // Challenger sends request-match once we have the answer
            const activeLobbyId = currentLobbyIdRef.current || DEFAULT_LOBBY_ID
            const inferredGameName =
              activeLobbyId.trim().toLowerCase() === 'vampire' ? 'vsavj' : undefined
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
                lobbyId: activeLobbyId,
                gameName: inferredGameName,
              }))
              sentMatchRequestRef.current.add(payload.from as string)
            }
            break
          }

          case 'webrtc-ping-candidate': {
            if (!payload.candidate) break
            try {
              if (peerConnectionRef.current && payload.from && opponentUidRef.current === payload.from) {
                await peerConnectionRef.current.addIceCandidate(
                  new RTCIceCandidate(payload.candidate as RTCIceCandidateInit)
                )
              } else if (payload.from) {
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
              if (opponentUidRef.current === payload.from) {
                closePeerConnection()
              }
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
      socket.close()
      if (socketRef.current === socket) socketRef.current = null
    }
  }, [user?.uid, updateLobbyUsers, setCurrentLobbyIdBoth, setIsInMatchBoth, closePeerConnection, addSystemMessage])

  // ── Public API ─────────────────────────────────────────────────────────────

  const sendMessage = useCallback((text: string): boolean => {
    const socket = socketRef.current
    const currentUser = userRef.current
    if (!socket || socket.readyState !== WebSocket.OPEN || !currentUser) return false
    try {
      socket.send(JSON.stringify({
        type: 'sendMessage',
        message: text,
        messageId: `${currentUser.uid}-${Date.now()}`,
        sender: { ...currentUser, lobbyId: currentLobbyIdRef.current },
      }))
      return true
    } catch {
      return false
    }
  }, [])

  const joinLobby = useCallback((lobbyId: string, pass?: string): boolean => {
    const socket = socketRef.current
    const currentUser = userRef.current
    if (!socket || socket.readyState !== WebSocket.OPEN || !currentUser) return false
    try {
      socket.send(JSON.stringify({
        type: 'changeLobby',
        newLobbyId: lobbyId,
        pass: pass || '',
        isPrivate: false,
        user: { ...currentUser, lobbyId },
      }))
      return true
    } catch {
      return false
    }
  }, [])

  const createLobby = useCallback((lobbyId: string, pass: string, isPrivate: boolean): boolean => {
    const socket = socketRef.current
    const currentUser = userRef.current
    if (!socket || socket.readyState !== WebSocket.OPEN || !currentUser) return false
    try {
      socket.send(JSON.stringify({
        type: 'createLobby',
        lobbyId,
        pass,
        isPrivate,
        user: { ...currentUser, lobbyId },
      }))
      return true
    } catch {
      return false
    }
  }, [])

  const sendChallenge = useCallback(async (targetUid: string): Promise<void> => {
    const currentUser = userRef.current
    if (!currentUser?.uid || isInMatchRef.current) return

    if (isMockUserId(targetUid)) {
      const lobbyId = currentLobbyIdRef.current
      const gameName = lobbyId.trim().toLowerCase() === 'vampire' ? 'vsavj' : null
      const mockUser = getMockUser(targetUid)
      setIsInMatchBoth(true)
      try {
        await startMockMatch({
          matchId: `mock-${Date.now()}`,
          opponentName: mockUser?.userName ?? 'Bot',
          gameName,
          playerSlot: 0,
        })
      } catch (err) {
        console.error('[v2] Failed to start mock match:', err)
        setIsInMatchBoth(false)
      }
      return
    }

    const socket = socketRef.current
    if (!socket || socket.readyState !== WebSocket.OPEN) return

    // Close any existing connection first
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

    // Optimistic UI update
    setMessages(prev => prev.map(m =>
      m.id === messageId
        ? { ...m, challengeStatus: 'accepted' as const, challengeResponder: currentUser.userName }
        : m
    ))

    if (!pendingOffer) return

    const { from, offer } = pendingOffer

    // Mock challenger path
    if (isMockUserId(from)) {
      pendingOffersRef.current.delete(messageId)
      pendingByUserRef.current.delete(from)
      pendingCandidatesRef.current.delete(from)

      const mockUser = getMockUser(from)
      const gameName = currentLobbyIdRef.current.trim().toLowerCase() === 'vampire' ? 'vsavj' : null

      setIsInMatchBoth(true)
      try {
        await startMockMatch({
          matchId: messageId,
          opponentName: mockUser?.userName ?? 'Bot',
          gameName,
          playerSlot: 1,
        })
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

    // Close any existing peer connection
    if (peerConnectionRef.current) {
      try { peerConnectionRef.current.close() } catch {}
      peerConnectionRef.current = null
    }

    try {
      const peer = await initWebRTC(currentUser.uid, from, socket)
      peerConnectionRef.current = peer
      opponentUidRef.current = from

      await peer.setRemoteDescription(new RTCSessionDescription(offer))

      // Flush queued ICE candidates
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
  }, [setIsInMatchBoth, closePeerConnection])

  const declineChallenge = useCallback(async (messageId: string): Promise<void> => {
    const currentUser = userRef.current
    const pendingOffer = pendingOffersRef.current.get(messageId)

    setMessages(prev => prev.map(m =>
      m.id === messageId
        ? { ...m, challengeStatus: 'declined' as const, challengeResponder: currentUser?.userName }
        : m
    ))

    if (!pendingOffer) return

    const { from } = pendingOffer
    const socket = socketRef.current

    if (socket && socket.readyState === WebSocket.OPEN && currentUser?.uid) {
      try {
        await webrtcDeclineCall(socket, from, currentUser.uid)
      } catch (err) {
        console.error('[v2] Failed to send decline:', err)
      }
    }

    pendingOffersRef.current.delete(messageId)
    pendingByUserRef.current.delete(from)
    pendingCandidatesRef.current.delete(from)
  }, [])

  const markMatchEnded = useCallback(() => {
    setIsInMatchBoth(false)
    closePeerConnection()
  }, [setIsInMatchBoth, closePeerConnection])

  return {
    status,
    lobbyUsers,
    messages,
    currentLobbyId,
    lobbyList,
    isInMatch,
    sendMessage,
    joinLobby,
    createLobby,
    sendChallenge,
    acceptChallenge,
    declineChallenge,
    markMatchEnded,
  }
}
