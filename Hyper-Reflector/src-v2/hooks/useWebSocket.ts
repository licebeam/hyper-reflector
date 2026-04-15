import { useCallback, useEffect, useRef, useState } from 'react'
// @ts-ignore
import keys from '../../src/private/keys'
import type { V2User, V2Message, ConnectionStatus } from '../types'

const DEFAULT_LOBBY_ID = 'Hyper Reflector'
const MAX_MESSAGES = 50

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

export function useWebSocket(user: V2User | null, lobbyId = DEFAULT_LOBBY_ID) {
  const socketRef = useRef<WebSocket | null>(null)
  const userRef = useRef(user)
  const [status, setStatus] = useState<ConnectionStatus>('disconnected')
  const [lobbyUsers, setLobbyUsers] = useState<V2User[]>([])
  const [messages, setMessages] = useState<V2Message[]>([])

  useEffect(() => {
    userRef.current = user
  }, [user])

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
        user: { ...userRef.current, lobbyId },
      }))
    }

    socket.onerror = () => {
      setStatus('error')
    }

    socket.onclose = () => {
      socketRef.current = null
      setStatus('disconnected')
    }

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data)
        if (!payload?.type) return

        switch (payload.type) {
          case 'connected-users': {
            if (Array.isArray(payload.users)) {
              const normalized = payload.users
                .map((u: any) => normalizeUser(u))
                .filter((u): u is V2User => u !== null)
              setLobbyUsers(normalized)
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
        }
      } catch {
        // ignore parse errors
      }
    }

    return () => {
      socket.close()
    }
  }, [user?.uid, lobbyId])

  const sendMessage = useCallback((text: string): boolean => {
    const socket = socketRef.current
    const currentUser = userRef.current
    if (!socket || socket.readyState !== WebSocket.OPEN || !currentUser) return false

    const messageId = `${currentUser.uid}-${Date.now()}`
    try {
      socket.send(JSON.stringify({
        type: 'sendMessage',
        message: text,
        messageId,
        sender: { ...currentUser, lobbyId },
      }))
      return true
    } catch {
      return false
    }
  }, [lobbyId])

  return { status, lobbyUsers, messages, sendMessage }
}
