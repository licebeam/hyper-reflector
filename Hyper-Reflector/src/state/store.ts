import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { TUser } from '../types/user'
import type { MatchSummary } from '../types/match'
import { DEFAULT_THEME_ID, getThemeById } from '../theme/registry'
import { toThemePreference, type ThemePreference } from '../theme/utils'

export const DEFAULT_LOBBY_ID = 'Hyper Reflector'

export type LobbySummary = {
    name: string
    users: number
    pass?: string
    isPrivate?: boolean
}

const MAX_CHAT_MESSAGES = 50

type TrainingPathSource = 'auto' | 'custom'

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
    winSound: boolean
    setWinSound: (on: boolean) => void
    winSoundPath: string
    setWinSoundPath: (path: string) => void
    notificationsMuted: boolean
    setNotificationsMuted: (on: boolean) => void
    darkMode: boolean
    setDarkMode: (on: boolean) => void
    theme: ThemePreference
    setTheme: (t: ThemePreference) => void
    emulatorPath: string
    setEmulatorPath: (path: string) => void
    trainingPath: string
    trainingPathSource: TrainingPathSource
    setTrainingPath: (path: string, source?: TrainingPathSource) => void
    // Per-game Lua script paths for the Lab page
    luaScripts: Record<string, string>
    luaScriptSources: Record<string, TrainingPathSource>
    setLuaScriptForGame: (rom: string, path: string, source?: TrainingPathSource) => void
    // Last selected game in Lab page
    labSelectedGame: string
    setLabSelectedGame: (rom: string) => void
    appLanguage: string
    setAppLanguage: (code: string) => void
    mutedUsers: string[]
    toggleMutedUser: (uid: string) => void
    isUserMuted: (uid: string) => boolean
    romPath: string
    setRomPath: (path: string) => void
    rankQueueGame: string
    setRankQueueGame: (rom: string) => void
}

type SignalStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

type UserState = {
    globalUser: TUser | undefined
    globalLoggedIn: boolean
    lobbyUsers: TUser[]
    currentMatches: MatchSummary[]
    signalStatus: SignalStatus
    currentLobbyId: string
    lobbies: LobbySummary[]
    setGlobalUser: (user: TUser | undefined) => void
    setGlobalLoggedIn: (info: boolean) => void
    setLobbyUsers: (users: TUser[]) => void
    setCurrentMatches: (matches: MatchSummary[]) => void
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
    challengeKind?: 'match' | 'rps'
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
    currentMatches: [],
    signalStatus: 'disconnected',
    currentLobbyId: DEFAULT_LOBBY_ID,
    lobbies: [],
    setGlobalUser: (user) => set({ globalUser: user }),
    setGlobalLoggedIn: (info) => set({ globalLoggedIn: info }),
    setLobbyUsers: (users) => set({ lobbyUsers: users }),
    setCurrentMatches: (matches) => set({ currentMatches: matches }),
    setSignalStatus: (status) => set({ signalStatus: status }),
    setCurrentLobbyId: (id) => set({ currentLobbyId: id || DEFAULT_LOBBY_ID }),
    setLobbies: (lobbies) => set({ lobbies }),
}))


const defaultTheme = getThemeById(DEFAULT_THEME_ID)
const defaultThemePreference = toThemePreference(defaultTheme)

const normalizeThemePreference = (pref?: Partial<ThemePreference>): ThemePreference => {
    if (!pref?.id) {
        return defaultThemePreference
    }
    const definition = getThemeById(pref.id)
    return toThemePreference(definition)
}

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
            winSound: true,
            setWinSound: (on) => set({ winSound: on }),
            winSoundPath: '',
            setWinSoundPath: (path) => set({ winSoundPath: path }),
            notificationsMuted: false,
            setNotificationsMuted: (on) => set({ notificationsMuted: on }),
            emulatorPath: '',
            setEmulatorPath: (path) => set({ emulatorPath: path }),
            darkMode: true,
            setDarkMode: (on) => set({ darkMode: on }),
            theme: defaultThemePreference,
            setTheme: (t) => set({ theme: normalizeThemePreference(t) }),
            trainingPath: '',
            trainingPathSource: 'auto',
            setTrainingPath: (path, source = 'auto') => set({ trainingPath: path, trainingPathSource: source }),
            luaScripts: {},
            luaScriptSources: {},
            setLuaScriptForGame: (rom, path, source = 'auto') =>
                set((s) => ({
                    luaScripts: { ...s.luaScripts, [rom]: path },
                    luaScriptSources: { ...s.luaScriptSources, [rom]: source },
                })),
            labSelectedGame: 'sfiii3nr1',
            setLabSelectedGame: (rom) => set({ labSelectedGame: rom }),
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
            romPath: '',
            setRomPath: (path) => set({ romPath: path }),
            rankQueueGame: 'sfiii3nr1',
            setRankQueueGame: (rom) => set({ rankQueueGame: rom }),
        }),
        {
            name: 'settings',
            storage: createJSONStorage(() => localStorage),
            merge: (persistedState, currentState) => {
                const persisted = persistedState as Partial<SettingsState> | undefined
                const next = {
                    ...currentState,
                    ...persisted,
                }
                next.theme = normalizeThemePreference(persisted?.theme)
                return next
            },
            // optional: only persist selected fields
            // partialize: (s) => ({ theme: s.theme }),
        }
    )
)
