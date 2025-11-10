import { ReactElement, useCallback, useEffect, useMemo, useRef, useState } from 'react'
//@ts-ignore // keys exists
import keys from '../private/keys'
import { useNavigate } from '@tanstack/react-router'
import {
    Box,
    Stack,
    IconButton,
    Image,
    Text,
    Flex,
    Drawer,
    useDisclosure,
    VStack,
    HStack,
    Button,
    Switch,
} from '@chakra-ui/react'
import { DEFAULT_LOBBY_ID, useMessageStore, useSettingsStore, useUserStore } from '../state/store'
import type { LobbySummary, TMessage } from '../state/store'
import type { TUser } from '../types/user'
import { useTranslation } from 'react-i18next'
import bgImage from '../assets/bgImage.svg'
import hrLogo from '../assets/logo.svg'
import {
    Bell,
    BellOff,
    FlaskConical,
    LucideHome,
    MessageCircle,
    Settings,
    Swords,
    UserRound,
} from 'lucide-react'
import UserCard from '../components/UserCard.tsx/UserCard'
import { LobbyManagerDialog } from './components/LobbyManagerDialog'
import { useTauriSoundPlayer } from '../utils/useTauriSoundPlayer'
import { buildMentionRegexes } from '../utils/chatFormatting'
import { toaster } from '../components/chakra/ui/toaster'
import { RegExpMatcher, englishDataset, englishRecommendedTransformers } from 'obscenity'
import {
    cancelPendingChallengesForChallenger,
    cancelPendingChallengesInvolving,
    normalizeChallengeParticipants,
} from './helpers/challenges'
import {
    appendMockUsers,
    buildMockForLobby,
    MOCK_ACTION_INTERVAL_MS,
    MOCK_CHALLENGE_LINES,
    MOCK_CHALLENGE_USER,
    MOCK_CHALLENGE_USER_TWO,
    MOCK_CHAT_LINES,
    normalizeSocketUser,
} from './helpers/mockUsers'
import { formatTimestamp } from './helpers/time'
import { STATUS_COLOR_MAP, STATUS_LABEL_MAP } from './helpers/status'
import {
    AUTO_DECLINE_RESPONDER,
    AUTO_RESOLVE_RESPONDER,
    CHALLENGE_ACCEPT_LABEL,
    CHALLENGE_DECLINE_LABEL,
    LOBBY_NAME_MAX_LENGTH,
    LOBBY_NAME_MIN_LENGTH,
    NOTIFICATIONS_TITLE,
    NO_NOTIFICATIONS_MESSAGE,
} from './helpers/constants'

import {
    initWebRTC,
    startCall,
    answerCall,
    declineCall as webrtcDeclineCall,
    closeConnectionWithUser,
} from '../webRTC/WebPeer'
import { isMockUserId, startMockMatch, startProxyMatch } from '../match'
import { SOCKET_STATE_EVENT, type SocketStateUpdateDetail } from './helpers/socketBridge'
import { auth } from '../utils/firebase'
import api from '../external-api/requests'
import {
    clearMatchCommandFile,
    clearMatchStatsFile,
    readMatchCommandFile,
    readMatchStatsFile,
} from '../utils/matchFiles'
import { parseMatchData } from '../utils/matchParser'
import { isTauriEnv, resolveFilesPath } from '../utils/pathSettings'

const DEV_MATCH_ID = 'dev-matches-and-bugs'

const lobbyNameMatcher = new RegExpMatcher({
    ...englishDataset.build(),
    ...englishRecommendedTransformers,
})

function resolveMockDisplayName(uid?: string | null) {
    if (!uid) return 'Mock Opponent'
    if (uid === MOCK_CHALLENGE_USER.uid) return MOCK_CHALLENGE_USER.userName
    if (uid === MOCK_CHALLENGE_USER_TWO.uid) return MOCK_CHALLENGE_USER_TWO.userName
    return 'Mock Opponent'
}

const MAX_METER_EVENTS = 200
const MAX_RAW_PAYLOAD_LENGTH = 450_000

function coerceBooleanFlag(value: unknown): boolean | undefined {
    if (typeof value === 'boolean') {
        return value
    }
    if (typeof value === 'number') {
        if (!Number.isFinite(value)) return undefined
        return value !== 0
    }
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase()
        if (!normalized.length) return undefined
        return normalized === 'true' || normalized === '1'
    }
    return undefined
}

const coerceNumber = (value: unknown): number | undefined => {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value
    }
    if (typeof value === 'string') {
        const num = Number(value)
        return Number.isFinite(num) ? num : undefined
    }
    return undefined
}

const coerceString = (value: unknown): string | undefined => {
    if (typeof value === 'string' && value.trim().length) {
        return value.trim()
    }
    if (typeof value === 'number') {
        return String(value)
    }
    return undefined
}

const limitArray = (value: unknown, limit = MAX_METER_EVENTS) => {
    if (!Array.isArray(value)) return []
    const mapped = value
        .map((entry) => coerceNumber(entry))
        .filter((entry): entry is number => typeof entry === 'number')
    if (mapped.length <= limit) return mapped
    return mapped.slice(mapped.length - limit)
}

const buildCondensedMatchPayload = (source: Record<string, unknown>) => {
    const matchUuid = coerceString(source['match-uuid'])
    const createdAt = coerceNumber(source['created-at']) ?? Date.now()
    const explicitP1Win = coerceBooleanFlag(source['p1-win'])
    const explicitP2Win = coerceBooleanFlag(source['p2-win'])

    let resolvedWinner: 'player1' | 'player2'
    if (explicitP1Win === true) {
        resolvedWinner = 'player1'
    } else if (explicitP2Win === true) {
        resolvedWinner = 'player2'
    } else {
        const fallbackWinner =
            coerceString(source['winner']) ||
            (coerceBooleanFlag(source['p1-win']) ? 'player1' : 'player2')
        resolvedWinner = fallbackWinner === 'player2' ? 'player2' : 'player1'
    }

    const p1WinFinal = resolvedWinner === 'player1'
    const p2WinFinal = !p1WinFinal

    const safeNumber = (value: unknown) => coerceNumber(value) ?? 0

    return {
        matchUuid,
        createdAt,
        winner: resolvedWinner,
        'p1-win': p1WinFinal,
        'p2-win': p2WinFinal,
        // legacy keys to keep backend parser happy
        'player1-char': safeNumber(source['player1-char']),
        'player2-char': safeNumber(source['player2-char']),
        'player1-super': safeNumber(source['player1-super']),
        'player2-super': safeNumber(source['player2-super']),
        'p1-total-meter-gained': safeNumber(source['p1-total-meter-gained']),
        'p2-total-meter-gained': safeNumber(source['p2-total-meter-gained']),
        'p1-meter-gained': limitArray(source['p1-meter-gained']),
        'p2-meter-gained': limitArray(source['p2-meter-gained']),
        participants: {
            player1: {
                char: safeNumber(source['player1-char']),
                super: safeNumber(source['player1-super']),
                totalMeter: safeNumber(source['p1-total-meter-gained']),
            },
            player2: {
                char: safeNumber(source['player2-char']),
                super: safeNumber(source['player2-super']),
                totalMeter: safeNumber(source['p2-total-meter-gained']),
            },
        },
        meterSamples: {
            player1: limitArray(source['p1-meter-gained']),
            player2: limitArray(source['p2-meter-gained']),
        },
    }
}

type SendMessageEventDetail = {
    text: string
    onSuccess?: () => void
    onError?: (message: string) => void
}

type ChallengeEventDetail = {
    targetUid: string
}

type NotificationEntry = {
    message: TMessage
    kind: 'challenge' | 'mention'
}

type ChallengeResponseDetail = {
    messageId: string
    accepted: boolean
    responderName?: string
}

export default function Layout({ children }: { children: ReactElement[] }) {
    const navigate = useNavigate()
    const globalLoggedIn = useUserStore((s) => s.globalLoggedIn)
    const globalUser = useUserStore((s) => s.globalUser)
    const signalStatus = useUserStore((s) => s.signalStatus)
    const setSignalStatus = useUserStore((s) => s.setSignalStatus)
    const chatMessages = useMessageStore((s) => s.chatMessages)
    const clearChatMessages = useMessageStore((s) => s.clear)
    const currentLobbyId = useUserStore((s) => s.currentLobbyId)
    const setCurrentLobbyId = useUserStore((s) => s.setCurrentLobbyId)
    const lobbyList = useUserStore((s) => s.lobbies)
    const setLobbyList = useUserStore((s) => s.setLobbies)
    const lobbyUsers = useUserStore((s) => s.lobbyUsers)
    const setLobbyUsers = useUserStore((s) => s.setLobbyUsers)
    const theme = useSettingsStore((s) => s.theme)
    const notificationsMuted = useSettingsStore((s) => s.notificationsMuted)
    const setNotificationsMuted = useSettingsStore((s) => s.setNotificationsMuted)
    const notifChallengeSoundEnabled = useSettingsStore((s) => s.notifChallengeSound)
    const notifChallengeSoundPath = useSettingsStore((s) => s.notifChallengeSoundPath)
    const notifMentionSoundEnabled = useSettingsStore((s) => s.notifiAtSound)
    const notifMentionSoundPath = useSettingsStore((s) => s.notifAtSoundPath)
    const mutedUsers = useSettingsStore((s) => s.mutedUsers)
    const accentColor = theme?.colorPalette ?? 'orange'
    const { t } = useTranslation()
    const {
        open: notificationsOpen,
        onOpen: openNotifications,
        onClose: closeNotifications,
    } = useDisclosure()
    const {
        open: lobbyManagerOpen,
        onOpen: openLobbyManager,
        onClose: closeLobbyManager,
    } = useDisclosure()
    const signalSocketRef = useRef<WebSocket | null>(null)
    const { playSound: playSoundFile } = useTauriSoundPlayer()

    const peerConnectionRef = useRef<RTCPeerConnection | null>(null)
    const opponentUidRef = useRef<string | null>(null)
    const mockActionIndexRef = useRef(0)
    const globalUserRef = useRef<TUser | undefined>(globalUser)
    const sentMatchRequestRef = useRef<Set<string>>(new Set())
    const pendingChallengeOffersRef = useRef<
        Map<string, { from: string; offer: RTCSessionDescriptionInit }>
    >(new Map())
    const pendingChallengeByUserRef = useRef<Map<string, string>>(new Map())
    const pendingIceCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map())
    const matchUploadPendingRef = useRef(false)
    const activeMatchIdRef = useRef<string | null>(null)
    const localPlayerSlotRef = useRef<0 | 1>(0)
    const lastMatchUuidRef = useRef<string | null>(null)
    const [isInMatch, setIsInMatch] = useState(false)
    const isInMatchRef = useRef(false)
    const winSoundPathRef = useRef<string | null>(null)
    const declineChallengeWithSocket = useCallback(
        (targetId: string, challengerId: string) => {
            const socket = signalSocketRef.current
            if (!socket) {
                return
            }
            webrtcDeclineCall(socket, targetId, challengerId).catch((error) => {
                console.error('Failed to auto-decline challenge:', error)
            })
        },
        [signalSocketRef]
    )

    useEffect(() => {
        globalUserRef.current = globalUser || undefined
    }, [globalUser])

    useEffect(() => {
        isInMatchRef.current = isInMatch
    }, [isInMatch])

    useEffect(() => {
        if (!isTauriEnv()) return
        let cancelled = false
        ;(async () => {
            try {
                const resolved = await resolveFilesPath('sounds', 'win.wav')
                if (!cancelled) {
                    winSoundPathRef.current = resolved
                }
            } catch (error) {
                console.warn('Failed to resolve win sound path', error)
            }
        })()
        return () => {
            cancelled = true
        }
    }, [])

    const markMatchEnded = useCallback(() => {
        if (!isInMatchRef.current) return
        isInMatchRef.current = false
        setIsInMatch(false)
        sentMatchRequestRef.current.clear()
        lastMatchUuidRef.current = null
        activeMatchIdRef.current = null
        localPlayerSlotRef.current = 0
    }, [])

    const markMatchStarted = useCallback(
        (opponentUid?: string | null, options?: { matchId?: string; playerSlot?: 0 | 1 }) => {
            if (opponentUid) {
                opponentUidRef.current = opponentUid
            }
            if (options?.matchId) {
                activeMatchIdRef.current = options.matchId
            }
            if (typeof options?.playerSlot === 'number') {
                localPlayerSlotRef.current = options.playerSlot
            }
            isInMatchRef.current = true
            setIsInMatch(true)

            const challengerId = globalUser?.uid
            const participantIds = [challengerId, opponentUid].filter((id): id is string =>
                Boolean(id)
            )

            if (participantIds.length) {
                cancelPendingChallengesInvolving({
                    participantIds,
                    excludeMessageIds: [],
                    reason: AUTO_RESOLVE_RESPONDER,
                    currentUserId: globalUser?.uid,
                    declineChallenge: declineChallengeWithSocket,
                })

                const participantSet = new Set(participantIds)
                pendingChallengeOffersRef.current.forEach((pending, messageId) => {
                    if (pending && participantSet.has(pending.from)) {
                        pendingChallengeOffersRef.current.delete(messageId)
                        pendingChallengeByUserRef.current.delete(pending.from)
                        pendingIceCandidatesRef.current.delete(pending.from)
                    }
                })
            }
        },
        [cancelPendingChallengesInvolving, declineChallengeWithSocket, globalUser?.uid]
    )

    const sendSocketMessage = useCallback((payload: Record<string, unknown>) => {
        const socket = signalSocketRef.current
        if (!socket || socket.readyState !== WebSocket.OPEN) {
            console.warn('Signal socket not ready for payload', payload)
            return false
        }

        try {
            socket.send(JSON.stringify(payload))
            return true
        } catch (error) {
            console.error('Failed to send payload to signal server:', error)
            return false
        }
    }, [])

    const handleChallengeResponse = useCallback(
        (messageId: string, accepted: boolean, responderName?: string) => {
            void (async () => {
                const responder =
                    responderName && responderName.trim().length
                        ? responderName.trim()
                        : globalUser?.userName || 'You'
                const status = accepted ? 'accepted' : 'declined'

                const { chatMessages, updateMessage } = useMessageStore.getState()
                const targetMessage = chatMessages.find((message) => message.id === messageId)
                const { challengerId, opponentId } = normalizeChallengeParticipants(
                    targetMessage,
                    globalUser?.uid
                )

                updateMessage(messageId, {
                    challengeStatus: status,
                    challengeResponder: responder,
                    challengeChallengerId: challengerId,
                    challengeOpponentId: opponentId,
                })

                const pendingOffer = pendingChallengeOffersRef.current.get(messageId)
                if (pendingOffer) {
                    const socket = signalSocketRef.current
                    if (!socket || !globalUser?.uid) {
                        pendingChallengeOffersRef.current.delete(messageId)
                        pendingChallengeByUserRef.current.delete(pendingOffer.from)
                        pendingIceCandidatesRef.current.delete(pendingOffer.from)
                        toaster.error({
                            title: 'Unable to respond',
                            description: 'Signal connection unavailable. Please try again.',
                        })
                        return
                    }

                    if (accepted) {
                        try {
                            if (peerConnectionRef.current) {
                                try {
                                    peerConnectionRef.current.close()
                                } catch (error) {
                                    console.error(
                                        'Failed to close existing peer connection:',
                                        error
                                    )
                                }
                                peerConnectionRef.current = null
                            }

                            const peer = await initWebRTC(globalUser.uid, pendingOffer.from, socket)
                            peerConnectionRef.current = peer
                            opponentUidRef.current = pendingOffer.from
                            await peer.setRemoteDescription(
                                new RTCSessionDescription(pendingOffer.offer)
                            )
                            const queuedCandidates =
                                pendingIceCandidatesRef.current.get(pendingOffer.from) || []
                            for (const candidate of queuedCandidates) {
                                try {
                                    await peer.addIceCandidate(new RTCIceCandidate(candidate))
                                } catch (error) {
                                    console.warn('Failed to add queued ICE candidate:', error)
                                }
                            }
                            pendingIceCandidatesRef.current.delete(pendingOffer.from)
                            await answerCall(peer, socket, pendingOffer.from, globalUser.uid)
                        } catch (error) {
                            console.error('Failed to accept incoming challenge:', error)
                            toaster.error({
                                title: 'Unable to accept challenge',
                                description:
                                    error instanceof Error
                                        ? error.message
                                        : 'Unknown error accepting challenge',
                            })
                        } finally {
                            pendingChallengeOffersRef.current.delete(messageId)
                            pendingChallengeByUserRef.current.delete(pendingOffer.from)
                        }
                    } else {
                        try {
                            await webrtcDeclineCall(socket, pendingOffer.from, globalUser.uid)
                        } catch (error) {
                            console.error('Failed to send decline signal:', error)
                        } finally {
                            pendingChallengeOffersRef.current.delete(messageId)
                            pendingChallengeByUserRef.current.delete(pendingOffer.from)
                            pendingIceCandidatesRef.current.delete(pendingOffer.from)
                        }
                    }
                    return
                }

                if (accepted) {
                    toaster.success({
                        title: 'Challenge accepted',
                        description: `${responder} accepted the challenge.`,
                    })

                    const participantIds = [challengerId, opponentId].filter((id): id is string =>
                        Boolean(id)
                    )

                    if (participantIds.length) {
                        cancelPendingChallengesInvolving({
                            participantIds,
                            excludeMessageIds: [messageId],
                            reason: AUTO_RESOLVE_RESPONDER,
                            currentUserId: globalUser?.uid,
                            declineChallenge: declineChallengeWithSocket,
                        })
                    }

                    const activeLobbyId = currentLobbyIdRef.current || DEFAULT_LOBBY_ID
                    const normalizedLobby = activeLobbyId.trim().toLowerCase()
                    const inferredGameName = normalizedLobby === 'vampire' ? 'vsavj' : undefined

                    const involvesMock = isMockUserId(challengerId) || isMockUserId(opponentId)

                    if (involvesMock) {
                        const mockUid = isMockUserId(challengerId) ? challengerId : opponentId
                        const mockName = resolveMockDisplayName(mockUid)
                        const localPlayerSlot: 0 | 1 =
                            globalUser?.uid && globalUser.uid === challengerId ? 0 : 1

                        markMatchStarted(mockUid, {
                            matchId: messageId,
                            playerSlot: localPlayerSlot,
                        })
                        void startMockMatch({
                            matchId: messageId,
                            opponentName: mockName,
                            gameName: inferredGameName ?? null,
                            playerSlot: localPlayerSlot,
                        }).catch((error) => {
                            console.error('Failed to start mock match:', error)
                            markMatchEnded()
                            toaster.error({
                                title: 'Unable to start match',
                                description: 'Encountered an error launching the emulator.',
                            })
                        })
                    } else if (globalUser?.uid && opponentId && globalUser.uid === opponentId) {
                        sendSocketMessage({
                            type: 'request-match',
                            challengerId,
                            opponentId,
                            requestedBy: globalUser.uid,
                            lobbyId: activeLobbyId,
                            gameName: inferredGameName,
                        })
                    }
                } else {
                    toaster.info({
                        title: 'Challenge declined',
                        description: `${responder} declined the challenge.`,
                    })
                }
            })()
        },
        [
            cancelPendingChallengesInvolving,
            declineChallengeWithSocket,
            globalUser?.uid,
            globalUser?.userName,
            markMatchEnded,
            markMatchStarted,
            sendSocketMessage,
        ]
    )

    const mentionHandles = useMemo(() => {
        const handles = new Set<string>()
        const username = globalUser?.userName?.trim()
        if (username) handles.add(username)

        const aliases = Array.isArray(globalUser?.knownAliases)
            ? (globalUser?.knownAliases as string[])
            : []

        aliases.forEach((alias) => {
            if (typeof alias === 'string' && alias.trim()) {
                handles.add(alias.trim())
            }
        })

        return Array.from(handles)
    }, [globalUser?.userName, globalUser?.knownAliases])

    const mentionMatchers = useMemo(
        () => buildMentionRegexes(mentionHandles, 'i'),
        [mentionHandles]
    )

    const [dismissedNotificationIds, setDismissedNotificationIds] = useState<Set<string>>(
        () => new Set()
    )

    const hasRealOpponent = useMemo(() => {
        if (!Array.isArray(lobbyUsers) || !lobbyUsers.length) {
            return false
        }

        return lobbyUsers.some((user) => {
            if (!user || !user.uid || user.uid === globalUser?.uid) {
                return false
            }

            if (user.uid === MOCK_CHALLENGE_USER.uid) {
                return false
            }

            return !user.uid.startsWith('mock-')
        })
    }, [globalUser?.uid, lobbyUsers])

    const availableLobbies = useMemo(() => {
        const entries = new Map<string, LobbySummary>()

        lobbyList.forEach((lobby) => {
            if (!lobby?.name) return
            entries.set(lobby.name, lobby)
        })

        if (!entries.has(DEFAULT_LOBBY_ID)) {
            entries.set(DEFAULT_LOBBY_ID, { name: DEFAULT_LOBBY_ID, users: 0 })
        }

        return Array.from(entries.values()).sort((a, b) => {
            const aUsers = a.users ?? 0
            const bUsers = b.users ?? 0
            if (bUsers !== aUsers) {
                return bUsers - aUsers
            }
            return a.name.localeCompare(b.name)
        })
    }, [lobbyList])

    const currentLobbyIdRef = useRef(currentLobbyId || DEFAULT_LOBBY_ID)

    useEffect(() => {
        currentLobbyIdRef.current = currentLobbyId || DEFAULT_LOBBY_ID
    }, [currentLobbyId])

    const sendSocketStateUpdate = useCallback((update: SocketStateUpdateDetail) => {
        const socket = signalSocketRef.current
        const viewer = globalUserRef.current
        if (!socket || socket.readyState !== WebSocket.OPEN || !viewer?.uid) {
            return
        }
        const lobbyId = currentLobbyIdRef.current || DEFAULT_LOBBY_ID
        try {
            socket.send(
                JSON.stringify({
                    type: 'updateSocketState',
                    data: {
                        lobbyId,
                        uid: viewer.uid,
                        stateToUpdate: update,
                    },
                })
            )
        } catch (error) {
            console.error('Failed to send socket state update:', error)
        }
    }, [])

    useEffect(() => {
        if (typeof window === 'undefined') {
            return
        }
        const handler = (event: Event) => {
            const detail = (event as CustomEvent<SocketStateUpdateDetail>).detail
            if (!detail) return
            sendSocketStateUpdate(detail)
        }
        window.addEventListener(SOCKET_STATE_EVENT, handler as EventListener)
        return () => window.removeEventListener(SOCKET_STATE_EVENT, handler as EventListener)
    }, [sendSocketStateUpdate])

    const syncViewerWinStreak = useCallback((value: number) => {
        const store = useUserStore.getState()
        const viewer = store.globalUser
        if (!viewer?.uid) return
        const updatedViewer = { ...viewer, winstreak: value }
        store.setGlobalUser(updatedViewer)
        store.setLobbyUsers(
            store.lobbyUsers.map((entry) =>
                entry.uid === viewer.uid ? { ...entry, winstreak: value } : entry
            )
        )
    }, [])

    useEffect(() => {
        if (!globalLoggedIn) {
            setCurrentLobbyId(DEFAULT_LOBBY_ID)
            setLobbyList([])
            setLobbyUsers([])
            clearChatMessages()
            closeLobbyManager()
        }
    }, [
        clearChatMessages,
        globalLoggedIn,
        closeLobbyManager,
        setCurrentLobbyId,
        setLobbyList,
        setLobbyUsers,
    ])

    const handleLobbyManagerOpen = useCallback(() => {
        openLobbyManager()
    }, [openLobbyManager])

    const handleMatchStats = useCallback(
        async (rawData: string) => {
            if (!rawData?.trim()) {
                return
            }

            matchUploadPendingRef.current = true
            try {
                const parsed = parseMatchData(rawData)
                if (!parsed) return

                const pickValue = (entry: string | number | Array<string | number>) =>
                    Array.isArray(entry) ? entry[entry.length - 1] : entry

                const matchUuidEntry = parsed['match-uuid']
                const matchUuid = matchUuidEntry ? String(pickValue(matchUuidEntry)) : undefined
                if (matchUuid && lastMatchUuidRef.current === matchUuid) {
                    return
                }
                if (matchUuid) {
                    lastMatchUuidRef.current = matchUuid
                }

                const viewer = globalUserRef.current
                if (!viewer?.uid) return

                const isPlayerOne = localPlayerSlotRef.current === 0
                const resultKey = isPlayerOne ? 'p1-win' : 'p2-win'
                const didWin = coerceBooleanFlag(parsed[resultKey])
                let nextStreakValue: number | null = null

                if (typeof didWin === 'boolean') {
                    sendSocketStateUpdate({ key: 'winStreak', value: didWin ? 1 : 0 })
                    const nextStreak = didWin ? (viewer.winstreak || 0) + 1 : 0
                    nextStreakValue = nextStreak
                    syncViewerWinStreak(nextStreak)
                }

                if (!auth.currentUser) {
                    return
                }

                const opponentUid = opponentUidRef.current || 'unknown-opponent'
                const shouldUseDevMatch =
                    !activeMatchIdRef.current || isMockUserId(opponentUidRef.current || '')
                const matchId =
                    (shouldUseDevMatch ? DEV_MATCH_ID : activeMatchIdRef.current) ||
                    matchUuid ||
                    `local-${viewer.uid}-${Date.now()}`

                const condensed = buildCondensedMatchPayload(parsed)
                const limitedRaw = JSON.stringify(condensed)
                await api.uploadMatchData(auth, {
                    matchId,
                    player1: isPlayerOne ? viewer.uid : opponentUid,
                    player2: isPlayerOne ? opponentUid : viewer.uid,
                    matchData: { raw: limitedRaw },
                })
                if (nextStreakValue !== null) {
                    try {
                        await api.updateUserData(auth, { winStreak: nextStreakValue })
                    } catch (streakError) {
                        console.warn('Failed to persist win streak', streakError)
                    }
                }
            } catch (error) {
                console.error('Failed to upload match data', error)
            } finally {
                matchUploadPendingRef.current = false
            }
        },
        [sendSocketStateUpdate, syncViewerWinStreak]
    )

    useEffect(() => {
        if (!isTauriEnv()) {
            return
        }

        let cancelled = false
        let busy = false

        if (import.meta.env.DEV) {
            console.info('[match-tracker] poller armed')
        }

        const poll = async () => {
            if (cancelled || busy) return
            if (matchUploadPendingRef.current) {
                return
            }
            busy = true
            try {
                const command = await readMatchCommandFile()
                console.log('commands', JSON.stringify(command))
                if (!command || !command.trim().length) {
                    return
                }
                await clearMatchCommandFile()

                console.debug('[match-tracker] command contents:', command)

                if (!command.toLowerCase().includes('read-tracking-file')) {
                    return
                }

                const resolvedWinSound = winSoundPathRef.current
                if (resolvedWinSound) {
                    void playSoundFile(resolvedWinSound)
                }

                const rawStats = await readMatchStatsFile()
                await clearMatchStatsFile()
                if (rawStats && rawStats.trim()) {
                    console.info('[match-tracker] received stats payload; uploading…')
                    await handleMatchStats(rawStats)
                }
            } catch (error) {
                console.error('Failed to process match tracking data', error)
            } finally {
                busy = false
            }
        }

        const intervalId = window.setInterval(() => {
            void poll()
        }, 1000)

        return () => {
            cancelled = true
            window.clearInterval(intervalId)
        }
    }, [globalLoggedIn, globalUser?.uid, handleMatchStats, playSoundFile])

    const handleLobbyManagerClose = useCallback(() => {
        closeLobbyManager()
    }, [closeLobbyManager])

    const handleJoinLobby = useCallback(
        (lobby: LobbySummary, pass: string): string | null => {
            if (!globalUser) {
                toaster.error({
                    title: 'Unable to change lobby',
                    description: 'Please log in before joining a lobby.',
                })
                return 'Please log in before joining a lobby.'
            }

            const trimmedPass = lobby.isPrivate ? pass.trim() : ''
            if (lobby.isPrivate && !trimmedPass.length) {
                return 'Password required for private lobby.'
            }

            const payloadUser = { ...globalUser, lobbyId: lobby.name }
            const sent = sendSocketMessage({
                type: 'changeLobby',
                newLobbyId: lobby.name,
                pass: trimmedPass,
                isPrivate: lobby.isPrivate,
                user: payloadUser,
            })

            if (!sent) {
                return 'Unable to reach lobby server. Please try again.'
            }

            setCurrentLobbyId(lobby.name)
            clearChatMessages()
            setLobbyUsers([])
            toaster.success({
                title: 'Lobby joined',
                description: lobby.name,
            })
            return null
        },
        [clearChatMessages, globalUser, sendSocketMessage, setCurrentLobbyId, setLobbyUsers]
    )

    const startChallenge = useCallback(
        async (targetUid: string) => {
            if (isInMatchRef.current) {
                toaster.info({
                    title: 'Already in a match',
                    description: 'Finish your current match before starting a new challenge.',
                })
                return
            }

            if (!globalUser?.uid) {
                toaster.error({
                    title: 'Unable to challenge',
                    description: 'Please log in before sending challenges.',
                })
                return
            }

            cancelPendingChallengesForChallenger({
                challengerId: globalUser.uid,
                reason: AUTO_DECLINE_RESPONDER,
                currentUserId: globalUser.uid,
                declineChallenge: declineChallengeWithSocket,
            })

            if (isMockUserId(targetUid)) {
                const lobbyId = currentLobbyIdRef.current || DEFAULT_LOBBY_ID
                const normalizedLobby = lobbyId.trim().toLowerCase()
                const inferredGameName = normalizedLobby === 'vampire' ? 'vsavj' : undefined
                const mockName = resolveMockDisplayName(targetUid)

                const mockMatchId = `mock-${Date.now()}`
                markMatchStarted(targetUid, { matchId: mockMatchId, playerSlot: 0 })
                try {
                    await startMockMatch({
                        matchId: mockMatchId,
                        opponentName: mockName,
                        gameName: inferredGameName ?? null,
                        playerSlot: 0,
                    })
                } catch (error) {
                    console.error('Failed to start mock challenge:', error)
                    markMatchEnded()
                    toaster.error({
                        title: 'Unable to start mock match',
                        description: 'Encountered an error launching the emulator.',
                    })
                }
                return
            }

            const socket = signalSocketRef.current
            if (!socket || socket.readyState !== WebSocket.OPEN) {
                toaster.error({
                    title: 'Unable to challenge',
                    description: 'Signal server is not connected.',
                })
                return
            }

            try {
                if (opponentUidRef.current) {
                    closeConnectionWithUser(opponentUidRef.current)
                    opponentUidRef.current = null
                }
                if (peerConnectionRef.current) {
                    try {
                        peerConnectionRef.current.close()
                    } catch (error) {
                        console.error('Failed to close previous peer connection:', error)
                    }
                    peerConnectionRef.current = null
                }

                const peer = await initWebRTC(globalUser.uid, targetUid, socket)
                peerConnectionRef.current = peer
                opponentUidRef.current = targetUid
                sentMatchRequestRef.current.delete(targetUid)
                await startCall(peer, socket, targetUid, globalUser.uid, true)
                toaster.success({
                    title: 'Challenge sent',
                    description: 'Waiting for opponent to respond.',
                })
            } catch (error) {
                console.error('Failed to initiate challenge:', error)
                toaster.error({
                    title: 'Challenge failed',
                    description: 'Unable to initiate WebRTC call.',
                })
            }
        },
        [declineChallengeWithSocket, globalUser?.uid, markMatchEnded, markMatchStarted]
    )

    const handleCreateLobby = useCallback(
        (input: { name: string; isPrivate: boolean; pass: string }): string | null => {
            if (!globalUser) {
                toaster.error({
                    title: 'Unable to create lobby',
                    description: 'Please log in before creating a lobby.',
                })
                return 'Please log in before creating a lobby.'
            }

            const trimmedName = input.name.trim()
            if (!trimmedName.length) {
                return 'Lobby name is required.'
            }
            if (
                trimmedName.length < LOBBY_NAME_MIN_LENGTH ||
                trimmedName.length > LOBBY_NAME_MAX_LENGTH
            ) {
                return `Lobby name must be between ${LOBBY_NAME_MIN_LENGTH} and ${LOBBY_NAME_MAX_LENGTH} characters.`
            }

            if (trimmedName === DEFAULT_LOBBY_ID) {
                return 'Choose a different name from the default lobby.'
            }

            if (lobbyNameMatcher.hasMatch(trimmedName)) {
                return 'Lobby name contains inappropriate language.'
            }

            const trimmedPass = input.isPrivate ? input.pass.trim() : ''
            if (input.isPrivate && !trimmedPass.length) {
                return 'Private lobbies require a password.'
            }

            if (input.isPrivate && trimmedPass.length > 150) {
                return 'Passwords are limited to 150 characters.'
            }

            const exists = availableLobbies.some(
                (lobby) => lobby.name.toLowerCase() === trimmedName.toLowerCase()
            )
            if (exists) {
                return 'A lobby with that name already exists.'
            }

            const payloadUser = { ...globalUser, lobbyId: trimmedName }
            const sent = sendSocketMessage({
                type: 'createLobby',
                lobbyId: trimmedName,
                pass: trimmedPass,
                isPrivate: input.isPrivate,
                user: payloadUser,
            })

            if (!sent) {
                return 'Unable to reach lobby server. Please try again.'
            }

            const optimisticLobby: LobbySummary = {
                name: trimmedName,
                users: 1,
                isPrivate: input.isPrivate,
            }

            const current = useUserStore.getState().lobbies
            const next = [...current.filter((lobby) => lobby.name !== trimmedName), optimisticLobby]
            setLobbyList(next)
            setCurrentLobbyId(trimmedName)
            clearChatMessages()
            setLobbyUsers([])
            toaster.success({
                title: 'Lobby created',
                description: trimmedName,
            })
            return null
        },
        [
            availableLobbies,
            clearChatMessages,
            globalUser,
            sendSocketMessage,
            setCurrentLobbyId,
            setLobbyList,
            setLobbyUsers,
        ]
    )

    const notificationEntries: NotificationEntry[] = useMemo(() => {
        if (!Array.isArray(chatMessages)) return []

        const entries: NotificationEntry[] = []
        const dismissed = dismissedNotificationIds

        chatMessages.forEach((msg) => {
            if (!msg?.id || dismissed.has(msg.id)) {
                return
            }

            const senderId =
                msg.senderUid ||
                msg.challengeChallengerId ||
                (typeof (msg as any).senderId === 'string' ? (msg as any).senderId : undefined)

            if (senderId && mutedUsers.includes(senderId)) {
                return
            }

            if (msg.role === 'challenge') {
                entries.push({ message: msg, kind: 'challenge' })
                return
            }

            if (!msg.text || !mentionMatchers.length) {
                return
            }

            const text = msg.text ?? ''
            const hasMention = mentionMatchers.some((matcher) => {
                matcher.lastIndex = 0
                return matcher.test(text)
            })

            if (hasMention) {
                entries.push({ message: msg, kind: 'mention' })
            }
        })

        return entries.sort((a, b) => {
            const aTime = a.message.timeStamp ?? 0
            const bTime = b.message.timeStamp ?? 0
            return bTime - aTime
        })
    }, [chatMessages, mentionMatchers, dismissedNotificationIds, mutedUsers])

    const handleClearNotifications = useCallback(() => {
        if (!notificationEntries.length) {
            return
        }

        const ids = notificationEntries.map((entry) => entry.message.id)
        if (!ids.length) {
            return
        }

        setDismissedNotificationIds((prev) => {
            const next = new Set(prev)
            ids.forEach((id) => next.add(id))
            return next
        })

        const socket = signalSocketRef.current
        if (socket && globalUser?.uid) {
            const challengeTargets = notificationEntries
                .filter((entry) => entry.kind === 'challenge')
                .map((entry) => {
                    const sender = (entry.message as any).sender || {}
                    return (
                        entry.message.challengeChallengerId ||
                        sender.uid ||
                        sender.userUID ||
                        sender.id ||
                        null
                    )
                })
                .filter((uid): uid is string => typeof uid === 'string' && uid.length > 0)

            challengeTargets.forEach((uid) => {
                webrtcDeclineCall(socket, uid, globalUser.uid).catch((error) => {
                    console.error('Failed to decline challenge for', uid, error)
                })
            })
        }

        closeNotifications()
        toaster.success({ title: 'Notifications cleared' })
    }, [closeNotifications, globalUser?.uid, notificationEntries])

    const unreadCount = notificationEntries.length
    const seenNotificationIdsRef = useRef<Set<string>>(new Set())

    useEffect(() => {
        const seen = seenNotificationIdsRef.current
        const nextSeen = new Set(notificationEntries.map((entry) => entry.message.id))

        if (!notificationsMuted) {
            const newEntries = notificationEntries.filter((entry) => !seen.has(entry.message.id))

            newEntries.forEach((entry) => {
                if (entry.kind === 'challenge') {
                    if (!notifChallengeSoundEnabled || !notifChallengeSoundPath) return
                    void playSoundFile(notifChallengeSoundPath)
                } else {
                    if (!notifMentionSoundEnabled || !notifMentionSoundPath) return
                    void playSoundFile(notifMentionSoundPath)
                }
            })
        }

        seenNotificationIdsRef.current = nextSeen
    }, [
        notificationEntries,
        notificationsMuted,
        notifChallengeSoundEnabled,
        notifChallengeSoundPath,
        notifMentionSoundEnabled,
        notifMentionSoundPath,
        playSoundFile,
    ])

    useEffect(() => {
        if (!globalLoggedIn || !globalUser?.uid || hasRealOpponent) {
            return
        }

        const viewerSnapshot = globalUserRef.current
        const activeLobbyId = currentLobbyIdRef.current || DEFAULT_LOBBY_ID
        if (activeLobbyId.toLowerCase() !== 'debug') {
            return
        }

        const runMockInteraction = () => {
            const mockUser =
                buildMockForLobby(activeLobbyId, mockActionIndexRef.current) || MOCK_CHALLENGE_USER
            const now = Date.now()
            const addChatMessage = useMessageStore.getState().addChatMessage
            const shouldChallenge = Math.random() < 0.4

            if (shouldChallenge && MOCK_CHALLENGE_LINES.length) {
                const challengeLine =
                    MOCK_CHALLENGE_LINES[mockActionIndexRef.current % MOCK_CHALLENGE_LINES.length]
                const challengeMessage: TMessage & { sender: TUser } = {
                    id: `mock-challenge-${now}`,
                    role: 'challenge',
                    text: `${mockUser.userName} ${challengeLine}`,
                    timeStamp: now,
                    userName: mockUser.userName,
                    sender: mockUser,
                    senderUid: mockUser.uid,
                    challengeChallengerId: mockUser.uid,
                    challengeOpponentId: viewerSnapshot?.uid,
                }
                addChatMessage(challengeMessage)
                if (!mutedUsers.includes(mockUser.uid)) {
                    toaster.info({
                        title: 'Challenge incoming',
                        description: `${mockUser.userName} ${challengeLine}`,
                    })
                }
                mockActionIndexRef.current += 1
                return
            }

            if (!MOCK_CHAT_LINES.length) {
                return
            }

            const chatTemplate =
                MOCK_CHAT_LINES[mockActionIndexRef.current % MOCK_CHAT_LINES.length]
            const playerName = (viewerSnapshot?.userName ?? 'friend').trim() || 'friend'
            const chatMessage: TMessage = {
                id: `mock-message-${now}`,
                role: 'user',
                text: chatTemplate.replace('{player}', playerName),
                timeStamp: now,
                userName: mockUser.userName,
                senderUid: mockUser.uid,
            }
            addChatMessage(chatMessage)
            mockActionIndexRef.current += 1
        }

        runMockInteraction()
        const intervalId = window.setInterval(runMockInteraction, MOCK_ACTION_INTERVAL_MS)
        return () => window.clearInterval(intervalId)
    }, [globalLoggedIn, globalUser?.uid, currentLobbyId, hasRealOpponent, mutedUsers])

    const statusColor = STATUS_COLOR_MAP[signalStatus] ?? STATUS_COLOR_MAP.disconnected
    const statusLabel = STATUS_LABEL_MAP[signalStatus] ?? STATUS_LABEL_MAP.disconnected

    useEffect(() => {
        const handler = (event: Event) => {
            const detail = (event as CustomEvent<SendMessageEventDetail>).detail
            if (!detail) return

            const trimmed = detail.text?.trim()
            if (!trimmed) {
                detail.onError?.('Message cannot be empty.')
                return
            }

            if (!globalUser?.uid) {
                detail.onError?.('Please log in before chatting.')
                return
            }

            const messageId = `${globalUser.uid ?? 'message'}-${Date.now()}`
            const payload = {
                type: 'sendMessage',
                message: trimmed,
                messageId,
                sender: { ...globalUser, lobbyId: currentLobbyIdRef.current || DEFAULT_LOBBY_ID },
            }

            const sent = sendSocketMessage(payload)
            if (!sent) {
                detail.onError?.('Unable to reach message server.')
                return
            }

            detail.onSuccess?.()
        }

        window.addEventListener('ws:send-message', handler as EventListener)
        return () => window.removeEventListener('ws:send-message', handler as EventListener)
    }, [globalUser, sendSocketMessage])

    useEffect(() => {
        const handler = (event: Event) => {
            const detail = (event as CustomEvent<ChallengeResponseDetail>).detail
            if (!detail?.messageId) return

            handleChallengeResponse(detail.messageId, detail.accepted, detail.responderName)
        }

        window.addEventListener('lobby:challenge-response', handler as EventListener)
        return () =>
            window.removeEventListener('lobby:challenge-response', handler as EventListener)
    }, [handleChallengeResponse])

    useEffect(() => {
        const handler = (event: Event) => {
            const detail = (event as CustomEvent<ChallengeEventDetail>).detail
            if (!detail?.targetUid) return

            void startChallenge(detail.targetUid)
        }

        window.addEventListener('lobby:challenge-user', handler as EventListener)
        return () => window.removeEventListener('lobby:challenge-user', handler as EventListener)
    }, [startChallenge])

    useEffect(() => {
        const maybeApi = (window as any)?.api
        const handleEndMatch = () => markMatchEnded()

        if (maybeApi?.on && typeof maybeApi.on === 'function') {
            maybeApi.on('endMatchUI', handleEndMatch)
            maybeApi.on('endMatch', handleEndMatch)
        }

        return () => {
            if (maybeApi?.removeListener && typeof maybeApi.removeListener === 'function') {
                maybeApi.removeListener('endMatchUI', handleEndMatch)
                maybeApi.removeListener('endMatch', handleEndMatch)
            }
        }
    }, [markMatchEnded])

    const changeRoute = (route: string) => {
        navigate({ to: route })
    }

    useEffect(() => {
        const userSnapshot = globalUserRef.current

        if (!globalLoggedIn || !userSnapshot) {
            setSignalStatus('disconnected')
            if (signalSocketRef.current) {
                signalSocketRef.current.close()
                signalSocketRef.current = null
            }
            return
        }

        setSignalStatus('connecting')
        const socketUrl = `ws://${keys.COTURN_IP}:${keys.SIGNAL_PORT ?? '3003'}`
        const socket = new WebSocket(socketUrl)
        signalSocketRef.current = socket
        let didError = false

        socket.onopen = () => {
            setSignalStatus('connected')
            const latestUser = globalUserRef.current
            if (!latestUser) {
                console.warn('Socket opened but no user snapshot available')
                socket.close()
                return
            }

            const lobbyToJoin = currentLobbyIdRef.current || DEFAULT_LOBBY_ID
            setCurrentLobbyId(lobbyToJoin)
            try {
                socket.send(
                    JSON.stringify({
                        type: 'join',
                        user: { ...latestUser, lobbyId: lobbyToJoin },
                    })
                )
            } catch (error) {
                console.error('Failed to send join message to signal server:', error)
            }
        }

        socket.onerror = (event) => {
            didError = true
            console.error('Signal server websocket error:', event)
            setSignalStatus('error')
            markMatchEnded()
        }

        socket.onclose = () => {
            signalSocketRef.current = null
            if (peerConnectionRef.current) {
                try {
                    peerConnectionRef.current.close()
                } catch (error) {
                    console.error('Failed to close peer connection:', error)
                }
                peerConnectionRef.current = null
                opponentUidRef.current = null
            }
            markMatchEnded()
            if (!didError) {
                setSignalStatus('disconnected')
            }
        }

        socket.onmessage = async (event) => {
            try {
                const payload = JSON.parse(event.data)
                if (!payload || typeof payload.type !== 'string') return

                const currentUserSnapshot = globalUserRef.current

                switch (payload.type) {
                    case 'connected-users':
                        if (Array.isArray(payload.users)) {
                            const normalizedUsers = payload.users
                                .map((entry: unknown) => normalizeSocketUser(entry))
                                .filter((user: any): user is TUser => Boolean(user)) // TODO this typing is strange
                            const activeLobbyId = currentLobbyIdRef.current || DEFAULT_LOBBY_ID
                            const injections = appendMockUsers(
                                normalizedUsers,
                                activeLobbyId,
                                currentUserSnapshot
                            )
                            setLobbyUsers(injections.users)
                            if (injections.viewer && injections.viewer !== currentUserSnapshot) {
                                useUserStore.getState().setGlobalUser(injections.viewer)
                            }
                        }
                        break
                    case 'getRoomMessage': {
                        if (typeof payload.message === 'undefined') {
                            break
                        }

                        const textMessage = String(payload.message)
                        const sender = payload.sender || {}
                        const normalizedSender = normalizeSocketUser(sender)
                        const timeStamp =
                            typeof payload.timeStamp === 'number' ? payload.timeStamp : Date.now()
                        const messageId =
                            typeof payload.id === 'string' && payload.id.length
                                ? payload.id
                                : normalizedSender?.uid
                                  ? `${normalizedSender.uid}-${timeStamp}`
                                  : `message-${timeStamp}`
                        const message: TMessage = {
                            id: messageId,
                            role: 'user',
                            text: textMessage,
                            timeStamp,
                            senderUid: normalizedSender?.uid,
                            userName:
                                normalizedSender?.userName ||
                                sender.userName ||
                                sender.name ||
                                sender.uid ||
                                'Unknown user',
                        }

                        useMessageStore.getState().addChatMessage(message)
                        break
                    }
                    case 'update-user-pinged': {
                        const data = payload.data
                        if (!data || typeof data !== 'object') {
                            break
                        }

                        const userStore = useUserStore.getState()
                        const currentGlobal = userStore.globalUser

                        if (data.isNewPing) {
                            const peerId =
                                typeof data.id === 'string'
                                    ? data.id
                                    : typeof data.id === 'number'
                                      ? String(data.id)
                                      : undefined
                            if (peerId && currentGlobal) {
                                const existingPings = Array.isArray(currentGlobal.lastKnownPings)
                                    ? currentGlobal.lastKnownPings
                                    : []
                                const filtered = existingPings.filter(
                                    (entry) => entry.id !== peerId
                                )
                                const rawPing = data.ping
                                const numericPing =
                                    typeof rawPing === 'number'
                                        ? rawPing
                                        : typeof rawPing === 'string'
                                          ? Number(rawPing)
                                          : undefined
                                const nextViewer = {
                                    ...currentGlobal,
                                    lastKnownPings: [
                                        ...filtered,
                                        {
                                            id: peerId,
                                            ping:
                                                typeof numericPing === 'number' &&
                                                Number.isFinite(numericPing)
                                                    ? numericPing
                                                    : (rawPing ?? 0),
                                            isUnstable: Boolean(data.isUnstable),
                                            countryCode:
                                                typeof data.countryCode === 'string'
                                                    ? data.countryCode
                                                    : undefined,
                                        },
                                    ],
                                }
                                userStore.setGlobalUser(nextViewer)
                            }
                            break
                        }

                        if (currentGlobal) {
                            const updatedGlobal = {
                                ...currentGlobal,
                                pingLat:
                                    typeof (data as any).pingLat === 'number'
                                        ? (data as any).pingLat
                                        : currentGlobal.pingLat,
                                pingLon:
                                    typeof (data as any).pingLon === 'number'
                                        ? (data as any).pingLon
                                        : currentGlobal.pingLon,
                                countryCode:
                                    typeof (data as any).countryCode === 'string' &&
                                    (data as any).countryCode.length
                                        ? (data as any).countryCode
                                        : currentGlobal.countryCode,
                                lastKnownPings: Array.isArray((data as any).lastKnownPings)
                                    ? (data as any).lastKnownPings
                                    : currentGlobal.lastKnownPings,
                            }
                            userStore.setGlobalUser(updatedGlobal)

                            const updatedLobbyUsers = userStore.lobbyUsers.map((entry) => {
                                if (entry.uid !== updatedGlobal.uid) {
                                    return entry
                                }
                                return {
                                    ...entry,
                                    pingLat: updatedGlobal.pingLat,
                                    pingLon: updatedGlobal.pingLon,
                                    countryCode: updatedGlobal.countryCode,
                                    lastKnownPings: updatedGlobal.lastKnownPings,
                                }
                            })
                            userStore.setLobbyUsers(updatedLobbyUsers)
                        }
                        break
                    }
                    case 'lobby-user-counts': {
                        const updates = Array.isArray(payload.updates) ? payload.updates : []
                        const lobbyMap = new Map<string, LobbySummary>()

                        updates
                            .filter((item: any) => item && typeof item.name === 'string')
                            .forEach((item: any) => {
                                const name = String(item.name).trim()
                                if (!name.length) return

                                const normalized: LobbySummary = {
                                    name,
                                    users: typeof item.users === 'number' ? item.users : 0,
                                    pass:
                                        typeof item.pass === 'string' && item.pass.length
                                            ? item.pass
                                            : undefined,
                                    isPrivate:
                                        typeof item.isPrivate === 'boolean'
                                            ? item.isPrivate
                                            : Boolean(item.pass && item.pass.length),
                                }

                                lobbyMap.set(name, normalized)
                            })

                        if (!lobbyMap.has(DEFAULT_LOBBY_ID)) {
                            lobbyMap.set(DEFAULT_LOBBY_ID, { name: DEFAULT_LOBBY_ID, users: 0 })
                        }

                        setLobbyList(Array.from(lobbyMap.values()))
                        break
                    }
                    case 'lobby-joined':
                        if (typeof payload.lobbyId === 'string' && payload.lobbyId.trim().length) {
                            setCurrentLobbyId(payload.lobbyId.trim())
                            clearChatMessages()
                        }
                        break
                    case 'lobby-closed':
                        if (typeof payload.lobbyId === 'string') {
                            const lobbyId = payload.lobbyId.trim()
                            const current = useUserStore.getState().lobbies
                            const next = current.filter((lobby) => lobby.name !== lobbyId)
                            if (!next.some((lobby) => lobby.name === DEFAULT_LOBBY_ID)) {
                                next.push({ name: DEFAULT_LOBBY_ID, users: 0 })
                            }
                            setLobbyList(next)
                            if (currentLobbyIdRef.current === lobbyId) {
                                setCurrentLobbyId(DEFAULT_LOBBY_ID)
                                clearChatMessages()
                                setLobbyUsers([])
                            }
                        }
                        break
                    case 'webrtc-ping-offer': {
                        if (!currentUserSnapshot?.uid || !payload.from || !payload.offer) {
                            break
                        }

                        if (isInMatchRef.current) {
                            try {
                                webrtcDeclineCall(socket, payload.from, currentUserSnapshot.uid)
                            } catch (error) {
                                console.error(
                                    'Failed to auto-decline incoming challenge while in a match:',
                                    error
                                )
                            }
                            toaster.info({
                                title: 'Already in a match',
                                description: `You are currently busy and cannot accept ${payload.from}'s challenge.`,
                            })
                            break
                        }

                        const challengerUser = useUserStore
                            .getState()
                            .lobbyUsers.find((user) => user.uid === payload.from)
                        const challengerName = challengerUser?.userName || payload.from

                        const existingMessageId = pendingChallengeByUserRef.current.get(
                            payload.from
                        )
                        const messageId =
                            existingMessageId || `incoming-challenge-${payload.from}-${Date.now()}`

                        pendingChallengeOffersRef.current.set(messageId, {
                            from: payload.from,
                            offer: payload.offer,
                        })
                        pendingChallengeByUserRef.current.set(payload.from, messageId)
                        pendingIceCandidatesRef.current.set(payload.from, [])

                        const { addChatMessage, updateMessage } = useMessageStore.getState()
                        if (existingMessageId) {
                            updateMessage(existingMessageId, {
                                timeStamp: Date.now(),
                                text: `${challengerName} challenged you to a match.`,
                                userName: challengerName,
                                challengeStatus: undefined,
                                challengeResponder: undefined,
                            })
                        } else {
                            addChatMessage({
                                id: messageId,
                                role: 'challenge',
                                text: `${challengerName} challenged you to a match.`,
                                timeStamp: Date.now(),
                                userName: challengerName,
                                senderUid: payload.from,
                                challengeChallengerId: payload.from,
                                challengeOpponentId: currentUserSnapshot?.uid,
                            })
                        }

                        if (!mutedUsers.includes(payload.from)) {
                            toaster.info({
                                title: 'Incoming challenge',
                                description: `Accept or decline ${challengerName}'s challenge from the chat.`,
                            })
                        }
                        break
                    }
                    case 'webrtc-ping-answer': {
                        if (!payload.from || !payload.answer) {
                            break
                        }

                        try {
                            if (peerConnectionRef.current) {
                                await peerConnectionRef.current.setRemoteDescription(
                                    new RTCSessionDescription(payload.answer)
                                )
                                opponentUidRef.current = payload.from
                            }
                        } catch (error) {
                            console.error('Failed to handle answer:', error)
                        }

                        const activeLobbyId = currentLobbyIdRef.current || DEFAULT_LOBBY_ID
                        const normalizedLobby = activeLobbyId.trim().toLowerCase()
                        const inferredGameName = normalizedLobby === 'vampire' ? 'vsavj' : undefined
                        const requesterUid = globalUserRef.current?.uid

                        if (
                            requesterUid &&
                            payload.from &&
                            !isMockUserId(payload.from) &&
                            !sentMatchRequestRef.current.has(payload.from)
                        ) {
                            sendSocketMessage({
                                type: 'request-match',
                                challengerId: requesterUid,
                                opponentId: payload.from,
                                requestedBy: requesterUid,
                                lobbyId: activeLobbyId,
                                gameName: inferredGameName,
                            })
                            sentMatchRequestRef.current.add(payload.from)
                        }
                        break
                    }
                    case 'match-start': {
                        const matchId =
                            typeof payload.matchId === 'string' ? payload.matchId : undefined
                        const opponentUid =
                            typeof payload.opponentUid === 'string'
                                ? payload.opponentUid
                                : undefined
                        const rawPlayerSlot =
                            typeof payload.playerSlot === 'number' ||
                            typeof payload.playerSlot === 'string'
                                ? Number(payload.playerSlot)
                                : undefined

                        if (!matchId || !opponentUid || rawPlayerSlot === undefined) {
                            break
                        }

                        const normalizedSlot: 0 | 1 = rawPlayerSlot === 0 ? 0 : 1
                        const serverHost =
                            typeof payload.serverHost === 'string' && payload.serverHost.length
                                ? payload.serverHost
                                : undefined
                        const serverPort =
                            typeof payload.serverPort === 'number' ||
                            typeof payload.serverPort === 'string'
                                ? Number(payload.serverPort)
                                : undefined
                        const gameName =
                            typeof payload.gameName === 'string' && payload.gameName.length
                                ? payload.gameName
                                : undefined

                        try {
                            markMatchStarted(opponentUid, {
                                matchId,
                                playerSlot: normalizedSlot,
                            })
                            await startProxyMatch({
                                matchId,
                                opponentUid,
                                playerSlot: normalizedSlot,
                                serverHost,
                                serverPort,
                                gameName,
                            })
                            sentMatchRequestRef.current.delete(opponentUid)
                        } catch (error) {
                            console.error('Failed to launch proxy match:', error)
                            markMatchEnded()
                            toaster.error({
                                title: 'Unable to start match',
                                description: 'Encountered an error launching the emulator.',
                            })
                        }
                        break
                    }
                    case 'match-start-error': {
                        markMatchEnded()
                        if (typeof payload?.reason === 'string') {
                            toaster.error({
                                title: 'Unable to start match',
                                description: payload.reason,
                            })
                        }
                        if (typeof payload?.opponentId === 'string') {
                            sentMatchRequestRef.current.delete(payload.opponentId)
                        }
                        if (typeof payload?.challengerId === 'string') {
                            sentMatchRequestRef.current.delete(payload.challengerId)
                        }
                        break
                    }
                    case 'webrtc-ping-candidate': {
                        if (!payload.candidate) {
                            break
                        }

                        try {
                            if (
                                peerConnectionRef.current &&
                                payload.from &&
                                opponentUidRef.current === payload.from
                            ) {
                                await peerConnectionRef.current.addIceCandidate(
                                    new RTCIceCandidate(payload.candidate)
                                )
                            } else if (payload.from) {
                                const queued =
                                    pendingIceCandidatesRef.current.get(payload.from) || []
                                queued.push(payload.candidate)
                                pendingIceCandidatesRef.current.set(payload.from, queued)
                            }
                        } catch (error) {
                            console.error('Failed to add ICE candidate:', error)
                        }
                        break
                    }
                    case 'webrtc-ping-decline': {
                        if (payload.from) {
                            closeConnectionWithUser(payload.from)
                            opponentUidRef.current = null
                            sentMatchRequestRef.current.delete(payload.from)
                            toaster.info({
                                title: 'Challenge declined',
                                description: `User ${payload.from} is unavailable.`,
                            })
                        }
                        break
                    }
                    case 'error':
                        if (payload.message) {
                            toaster.error({
                                title: 'Lobby server error',
                                description: payload.message,
                            })
                        }
                        break
                    default:
                        break
                }
            } catch (error) {
                console.error('Failed to process signal server payload:', error)
            }
        }

        return () => {
            socket.close()
            signalSocketRef.current = null
        }
    }, [
        clearChatMessages,
        globalLoggedIn,
        globalUser?.uid,
        markMatchEnded,
        markMatchStarted,
        setCurrentLobbyId,
        setLobbyList,
        setLobbyUsers,
        setSignalStatus,
    ])

    return (
        <>
            <Box display="flex" bgImage={`url(${bgImage})`} bgBlendMode={'color-dodge'}>
                <Stack gap="24px" padding={'12px'} bgColor={'bg.emphasized'}>
                    <Box height={'64px'} alignSelf={'center'} flex="1">
                        <Image src={hrLogo} height={'64px'} />
                    </Box>
                    {globalLoggedIn ? (
                        <Stack alignItems={'center'} gap="24px" flex="2">
                            <IconButton
                                colorPalette={accentColor}
                                width={'40px'}
                                height={'40px'}
                                onClick={() => changeRoute('/home')}
                                aria-label="Home"
                            >
                                <LucideHome />
                            </IconButton>
                            <IconButton
                                colorPalette={accentColor}
                                width={'40px'}
                                height={'40px'}
                                onClick={() => changeRoute('/lobby')}
                                aria-label="Lobby"
                            >
                                <MessageCircle />
                            </IconButton>
                            <IconButton
                                colorPalette={accentColor}
                                width={'40px'}
                                height={'40px'}
                                onClick={() => changeRoute('/lab')}
                                aria-label="Lab"
                            >
                                <FlaskConical />
                            </IconButton>
                            <IconButton
                                colorPalette={accentColor}
                                width={'40px'}
                                height={'40px'}
                                onClick={() => changeRoute('/profile')}
                                aria-label="Profiles"
                            >
                                <UserRound />
                            </IconButton>
                        </Stack>
                    ) : null}
                    {globalLoggedIn ? (
                        <Stack
                            alignItems={'center'}
                            flex="1"
                            gap="24px"
                            justifyContent={'flex-end'}
                        >
                            <IconButton
                                colorPalette={accentColor}
                                width={'40px'}
                                height={'40px'}
                                onClick={() => changeRoute('/settings')}
                                aria-label="Settings"
                            >
                                <Settings />
                            </IconButton>
                        </Stack>
                    ) : null}
                </Stack>
                <Stack flex="1" height={'100vh'}>
                    <Flex
                        height={'48px'}
                        bgColor={'bg.muted'}
                        alignItems={'center'}
                        px="4"
                        gap="3"
                        justifyContent="space-between"
                    >
                        {globalLoggedIn ? (
                            <Button
                                size="sm"
                                variant="outline"
                                colorPalette={accentColor}
                                onClick={handleLobbyManagerOpen}
                            >
                                Lobby: {currentLobbyId || DEFAULT_LOBBY_ID}
                            </Button>
                        ) : null}
                        <Box display="flex">
                            <UserCard />
                            <Box position="relative" top="1.5">
                                <IconButton
                                    colorPalette={accentColor}
                                    width={'40px'}
                                    height={'40px'}
                                    onClick={openNotifications}
                                    aria-label="Open notifications"
                                >
                                    {notificationsMuted ? <BellOff /> : <Bell />}
                                </IconButton>
                                {unreadCount > 0 ? (
                                    <Box
                                        position="absolute"
                                        top="-4px"
                                        right="-4px"
                                        minWidth="18px"
                                        height="18px"
                                        borderRadius="full"
                                        bg={`${accentColor}.500`}
                                        color="white"
                                        fontSize="xs"
                                        display="flex"
                                        alignItems="center"
                                        justifyContent="center"
                                        px="1"
                                    >
                                        {unreadCount > 99 ? '99+' : unreadCount}
                                    </Box>
                                ) : null}
                            </Box>
                        </Box>
                    </Flex>
                    <Box
                        flex="1"
                        display="flex"
                        flexDirection="column"
                        height="calc(100vh - 120px)"
                    >
                        <Box flex="1" overflowY="auto" p="4" scrollbarWidth={'thin'}>
                            {children}
                        </Box>
                    </Box>
                    <Box
                        h="24px"
                        display="flex"
                        justifyContent="space-between"
                        alignItems="center"
                        px="4"
                        flexShrink={0}
                    >
                        {/* These links no longer work, needs to be resolved */}
                        <Box display="flex" gap="8px">
                            <a href="https://hyper-reflector.com/" target="_blank" rel="noreferrer">
                                <Text textStyle="xs">Hyper Reflector on:</Text>
                            </a>
                            <a
                                href="https://discord.gg/fsQEVzXwbt"
                                target="_blank"
                                rel="noreferrer"
                            >
                                <Text textStyle="xs">Discord</Text>
                            </a>
                            <a
                                href="https://github.com/Hyper-Reflector-Team"
                                target="_blank"
                                rel="noreferrer"
                            >
                                <Text textStyle="xs">Github</Text>
                            </a>
                        </Box>

                        <Flex alignItems="center" gap="3">
                            <Box display="flex" alignItems="center" gap="2">
                                <Box
                                    width="10px"
                                    height="10px"
                                    borderRadius="9999px"
                                    backgroundColor={statusColor}
                                />
                                <Text textStyle="xs" color="gray.400">
                                    {statusLabel}
                                </Text>
                            </Box>
                            <Text textStyle="xs">Hyper Reflector version 0.5.1a 2025</Text>
                        </Flex>
                    </Box>
                </Stack>
            </Box>
            <LobbyManagerDialog
                isOpen={lobbyManagerOpen}
                onClose={handleLobbyManagerClose}
                accentColor={accentColor}
                currentLobbyId={currentLobbyId || DEFAULT_LOBBY_ID}
                availableLobbies={availableLobbies}
                lobbyNameMaxLength={LOBBY_NAME_MAX_LENGTH}
                onJoinLobby={handleJoinLobby}
                onCreateLobby={handleCreateLobby}
            />

            <Drawer.Root
                open={notificationsOpen}
                onOpenChange={({ open }) => {
                    if (!open) {
                        closeNotifications()
                    }
                }}
                size="sm"
            >
                <Drawer.Backdrop />
                <Drawer.Positioner>
                    <Drawer.Content>
                        <Drawer.CloseTrigger />
                        <Drawer.Header>
                            <Flex justify="space-between" align="center" gap="3">
                                <Drawer.Title>{NOTIFICATIONS_TITLE}</Drawer.Title>
                                <Button
                                    size="xs"
                                    variant="ghost"
                                    onClick={() => handleClearNotifications()}
                                    disabled={notificationEntries.length === 0}
                                >
                                    Clear
                                </Button>
                            </Flex>
                            <Switch.Root
                                colorPalette={accentColor}
                                size="md"
                                mt="2"
                                display="flex"
                                alignItems="center"
                                justifyContent="space-between"
                                gap="2"
                                checked={notificationsMuted}
                                onCheckedChange={(event) => setNotificationsMuted(event.checked)}
                            >
                                <Switch.HiddenInput />
                                <Switch.Label fontSize="sm" color="gray.400">
                                    Mute notifications
                                </Switch.Label>
                                <Switch.Control>
                                    <Switch.Thumb />
                                </Switch.Control>
                            </Switch.Root>
                        </Drawer.Header>
                        <Drawer.Body>
                            <VStack align="stretch">
                                {notificationEntries.length === 0 ? (
                                    <Text fontSize="sm" color="gray.500">
                                        {NO_NOTIFICATIONS_MESSAGE}
                                    </Text>
                                ) : (
                                    notificationEntries.map(({ message: msg, kind }) => {
                                        const isSelf = msg.userName === globalUser?.userName
                                        const isChallenge =
                                            msg.role === 'challenge' || kind === 'challenge'
                                        const challengeStatus = msg.challengeStatus
                                        const responderLabel =
                                            msg.challengeResponder && msg.challengeResponder.length
                                                ? msg.challengeResponder
                                                : 'Unknown player'

                                        return (
                                            <Stack
                                                key={msg.id}
                                                borderWidth="1px"
                                                borderRadius="md"
                                                padding="3"
                                                bg="bg.canvas"
                                            >
                                                <Flex
                                                    justifyContent="space-between"
                                                    alignItems="center"
                                                >
                                                    <Text
                                                        fontWeight="semibold"
                                                        color={
                                                            isSelf
                                                                ? `${accentColor}.500`
                                                                : undefined
                                                        }
                                                    >
                                                        {msg.userName ?? 'Unknown user'}
                                                    </Text>
                                                    <Text fontSize="xs" color="gray.500">
                                                        {formatTimestamp(msg.timeStamp)}
                                                    </Text>
                                                </Flex>
                                                <Box height="1px" bg="border" />
                                                <Flex alignItems="center" gap="2">
                                                    {isChallenge ? <Swords size={16} /> : null}
                                                    <Text fontSize="sm" whiteSpace="pre-wrap">
                                                        {msg.text || 'No message content'}
                                                    </Text>
                                                </Flex>
                                                {isChallenge ? (
                                                    challengeStatus ? (
                                                        <Text
                                                            fontSize="xs"
                                                            color={
                                                                challengeStatus === 'accepted'
                                                                    ? `${accentColor}.500`
                                                                    : 'red.300'
                                                            }
                                                        >
                                                            {`Challenge ${challengeStatus} by ${responderLabel}.`}
                                                        </Text>
                                                    ) : (
                                                        <HStack pt="1">
                                                            <Button
                                                                size="sm"
                                                                colorPalette={accentColor}
                                                                onClick={() =>
                                                                    handleChallengeResponse(
                                                                        msg.id,
                                                                        true,
                                                                        globalUser?.userName
                                                                    )
                                                                }
                                                            >
                                                                {CHALLENGE_ACCEPT_LABEL}
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() =>
                                                                    handleChallengeResponse(
                                                                        msg.id,
                                                                        false,
                                                                        globalUser?.userName
                                                                    )
                                                                }
                                                            >
                                                                {CHALLENGE_DECLINE_LABEL}
                                                            </Button>
                                                        </HStack>
                                                    )
                                                ) : null}
                                            </Stack>
                                        )
                                    })
                                )}
                            </VStack>
                        </Drawer.Body>
                    </Drawer.Content>
                </Drawer.Positioner>
            </Drawer.Root>
        </>
    )
}
