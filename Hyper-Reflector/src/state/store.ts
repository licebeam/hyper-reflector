import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { TUser } from '../types/user'

export const DEFAULT_LOBBY_ID = 'Hyper Reflector'

export type LobbySummary = {
    name: string
    users: number
    pass?: string
    isPrivate?: boolean
}

const MAX_CHAT_MESSAGES = 50

type SettingsState = {
    ggpoDelay: string
    setGgpoDelay: (d: string) => void
    notifChallengeSound: boolean
    setNotifChallengeSound: (on: boolean) => void
    notifChallengeSoundPath: string
    setNotifChallengeSoundPath: (path: string) => void
    notifiAtSound: boolean
    setNotifAtSound: (on: boolean) => void
    notifAtSoundPath: string
    setNotifAtSoundPath: (path: string) => void
    notificationsMuted: boolean
    setNotificationsMuted: (on: boolean) => void
    darkMode: boolean
    setDarkMode: (on: boolean) => void
    theme: { colorPalette: string, name: string }
    setTheme: (t: { colorPalette: string, name: string }) => void
    emulatorPath: string
    setEmulatorPath: (path: string) => void
    trainingPath: string
    setTrainingPath: (path: string) => void
    appLanguage: string
    setAppLanguage: (code: string) => void
    mutedUsers: string[]
    toggleMutedUser: (uid: string) => void
    isUserMuted: (uid: string) => boolean
}

type SignalStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

type UserState = {
    globalUser: TUser | undefined
    globalLoggedIn: boolean
    lobbyUsers: TUser[]
    signalStatus: SignalStatus
    currentLobbyId: string
    lobbies: LobbySummary[]
    setGlobalUser: (user: TUser | undefined) => void
    setGlobalLoggedIn: (info: boolean) => void
    setLobbyUsers: (users: TUser[]) => void
    setSignalStatus: (status: SignalStatus) => void
    setCurrentLobbyId: (id: string) => void
    setLobbies: (lobbies: LobbySummary[]) => void
}

export type TMessage = {
    id: string
    role: 'user' | 'system' | 'challenge'
    text: string
    timeStamp: number
    status?: 'sending' | 'sent' | 'failed'
    userName?: string
    senderUid?: string
    challengeStatus?: 'accepted' | 'declined'
    challengeResponder?: string
    challengeChallengerId?: string
    challengeOpponentId?: string
}

type MessageState = {
    chatMessages: TMessage[]
    addChatMessage: (msg: TMessage) => void
    addBatch: (msgs: TMessage[]) => void
    updateMessage: (id: string, patch: Partial<TMessage>) => void
    removeMessage: (id: string) => void
    clear: () => void
    removeMessagesByIds: (ids: string[]) => void
}

const trimMessages = (messages: TMessage[]) =>
    messages.length > MAX_CHAT_MESSAGES ? messages.slice(-MAX_CHAT_MESSAGES) : messages

export const useMessageStore = create<MessageState>()((set) => ({
    chatMessages: [],
    addChatMessage: (msg) =>
        set((s) => ({ chatMessages: trimMessages([...s.chatMessages, msg]) })),
    addBatch: (msgs) =>
        set((s) => ({ chatMessages: trimMessages([...s.chatMessages, ...msgs]) })),
    updateMessage: (id, patch) =>
        set((s) => ({
            chatMessages: s.chatMessages.map((m) => (m.id === id ? { ...m, ...patch } : m)),
        })),
    removeMessage: (id) =>
        set((s) => ({ chatMessages: s.chatMessages.filter((m) => m.id !== id) })),
    clear: () => set({ chatMessages: [] }),
    removeMessagesByIds: (ids) =>
        set((s) => ({
            chatMessages: s.chatMessages.filter((m) => !ids.includes(m.id)),
        })),
}))

export const useUserStore = create<UserState>((set) => ({
    globalUser: undefined,
    globalLoggedIn: false,
    lobbyUsers: [],
    signalStatus: 'disconnected',
    currentLobbyId: DEFAULT_LOBBY_ID,
    lobbies: [],
    setGlobalUser: (user) => set({ globalUser: user }),
    setGlobalLoggedIn: (info) => set({ globalLoggedIn: info }),
    setLobbyUsers: (users) => set({ lobbyUsers: users }),
    setSignalStatus: (status) => set({ signalStatus: status }),
    setCurrentLobbyId: (id) => set({ currentLobbyId: id || DEFAULT_LOBBY_ID }),
    setLobbies: (lobbies) => set({ lobbies }),
}))


export const useSettingsStore = create<SettingsState>()(
    persist(
        (set, get) => ({
            ggpoDelay: '0',
            setGgpoDelay: (d) => set({ ggpoDelay: d }),
            notifChallengeSound: true,
            setNotifChallengeSound: (on) => set({ notifChallengeSound: on }),
            notifChallengeSoundPath: '',
            setNotifChallengeSoundPath: (path) => set({ notifChallengeSoundPath: path }),
            notifiAtSound: true,
            setNotifAtSound: (on) => set({ notifiAtSound: on }),
            notifAtSoundPath: '',
            setNotifAtSoundPath: (path) => set({ notifAtSoundPath: path }),
            notificationsMuted: false,
            setNotificationsMuted: (on) => set({ notificationsMuted: on }),
            emulatorPath: '',
            setEmulatorPath: (path) => set({ emulatorPath: path }),
            darkMode: true,
            setDarkMode: (on) => set({ darkMode: on }),
            theme: { colorPalette: 'orange', name: 'Orange Soda' },
            setTheme: (t) => set({ theme: t }),
            trainingPath: '',
            setTrainingPath: (path) => set({ trainingPath: path }),
            appLanguage: 'en',
            setAppLanguage: (code) => set({ appLanguage: code }),
            mutedUsers: [],
            toggleMutedUser: (uid) =>
                set((state) => {
                    if (!uid) return state
                    const current = state.mutedUsers || []
                    if (current.includes(uid)) {
                        return { mutedUsers: current.filter((userId) => userId !== uid) }
                    }
                    return { mutedUsers: [...current, uid] }
                }),
            isUserMuted: (uid) => {
                if (!uid) return false
                const current = get().mutedUsers || []
                return current.includes(uid)
            },
        }),
        {
            name: 'settings',
            storage: createJSONStorage(() => localStorage),
            // optional: only persist selected fields
            // partialize: (s) => ({ theme: s.theme }),
        }
    )
)

