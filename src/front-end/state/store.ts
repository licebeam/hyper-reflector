import { create } from 'zustand'

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
  pushUser: (user) => set((state) => ({ userList: [...state.userList, user] })),
  removeUser: (user) => set((state) => ({ userList: [...state.userList.filter(u => u === user)] })),
  clearUserList: () => set((state) => ({ userList: [] })),
}))