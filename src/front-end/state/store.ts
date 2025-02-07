import { create } from 'zustand'

export const useLoginStore = create((set) => ({
  isLoggedIn: false,
  successLogin: () => set({isLoggedIn: true}),
  failedLogin: () => set({isLoggedIn: false}),
}))