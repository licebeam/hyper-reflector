import { create } from 'zustand'

export const useLoginStore = create((set) => ({
  userState: {email: ''},
  isLoggedIn: false,
  successLogin: () => set({ isLoggedIn: true }),
  failedLogin: () => set({ isLoggedIn: false }),
  loggedOut: () => set({ isLoggedIn: false }),
  setUserState: (data) => set({ userState: data}),
}))

export const useMessageStore = create((set) => ({
  messageState: [],
  pushMessage: (message) => set((state) => ({ messageState: [...state.messageState, message] })),
}))