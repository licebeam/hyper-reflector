import { create } from 'zustand'

export const useLayoutStore = create((set) => ({
    selectedTab: 'login',
    setSelectedTab: (tab: string) =>
        set({
            selectedTab: tab,
        }),
}))

export const useLoginStore = create((set) => ({
    userState: { email: '' },
    isLoggedIn: false,
    successLogin: () => set({ isLoggedIn: true }),
    failedLogin: () => set({ isLoggedIn: false }),
    loggedOut: () => set({ isLoggedIn: false }),
    setUserState: (data) => set({ userState: data }),
}))

export const useMessageStore = create((set) => ({
    // room messages
    messageState: [],
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
    removeCallData: (caller) =>
        set((state) => ({
            callData: [...state.callData.filter((call) => call.callerId !== caller.callerId)],
        })),
    clearCallData: (call) => set((state) => ({ callData: [] })),
}))
