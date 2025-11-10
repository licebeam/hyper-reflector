import { create } from 'zustand'
import { getThemeList } from '../utils/theme'

export const useLayoutStore = create((set) => ({
    selectedTab: 'login',
    setSelectedTab: (tab: string) =>
        set({
            selectedTab: tab,
        }),
    appTheme: getThemeList()[0],
    setTheme: (themeName: string) =>
        set((state) => ({
            appTheme:
                getThemeList().find((t) => {
                    return t.name === themeName
                }) || getThemeList()[0], // fallback to a default theme
        })),
}))

export const useLoginStore = create((set) => ({
    userState: { email: '' },
    isLoggedIn: false,
    successLogin: () => set({ isLoggedIn: true }),
    failedLogin: () => set({ isLoggedIn: false }),
    loggedOut: () => set({ isLoggedIn: false }),
    setUserState: (data) => set({ userState: data }),
    updateUserState: (data) =>
        set((state) => ({
            userState: { ...state.userState, ...data },
        })),
}))

export const useConfigStore = create((set) => ({
    configState: { appSoundOn: 'true', isAway: 'false' },
    setConfigState: (data) => set({ configState: data }),
    updateConfigState: (data) =>
        set((state) => ({
            configState: { ...state.configState, ...data },
        })),
}))

export const useMessageStore = create((set) => ({
    // current lobby
    currentLobbyState: { name: 'Hyper Reflector', id: 0, pass: null, isPrivate: false, users: 1 },
    setCurrentLobbyState: (lobby) => set((state) => ({ currentLobbyState: lobby })),
    currentLobbiesState: [
        { name: 'Hyper Reflector', id: 0, pass: null, isPrivate: false, users: 1 },
    ],
    setCurrentLobbiesState: (lobbies) => set((state) => ({ currentLobbiesState: lobbies })),
    // room messages
    messageState: [],
    updateMessage: (message) =>
        set((state) => ({
            messageState: [
                ...state.messageState.map((msg) => {
                    if (msg.id === message.id) {
                        return message
                    }
                    return msg
                }),
            ],
        })),
    pushMessage: (message) => set((state) => ({ messageState: [...state.messageState, message] })),
    clearMessageState: () => set((state) => ({ messageState: [] })),
    //room users
    userList: [],
    setUsersList: (usersArray) => set((state) => ({ userList: [...usersArray] })),
    pushUser: (user) => set((state) => ({ userList: [...state.userList, user] })),
    removeUser: (user) =>
        set((state) => ({
            userList: [...state.userList.filter((u) => u !== user)],
        })),
    clearUserList: () => set((state) => ({ userList: [] })),
    //matchmaking
    callData: [],
    setCallData: (call) => set((state) => ({ callData: [...state.callData, call] })),
    removeCallData: (callRef) =>
        set((state) => ({
            callData: [...state.callData.filter((call) => call.callerId !== callRef.callerId)],
        })),
    clearCallData: (call) => set((state) => ({ callData: [] })),
}))
