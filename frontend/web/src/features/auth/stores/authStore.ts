import { create } from "zustand"
import { User } from "../types"
import { STORAGE_KEYS } from "@/constants"

interface AuthState {
  user: User | null
  token: string | null
  setUser: (user: User | null) => void
  setToken: (token: string | null) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN) : null,
  setUser: (user) => set({ user }),
  setToken: (token) => {
    if (token) {
      localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, token)
    } else {
      localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN)
    }
    set({ token })
  },
  clearAuth: () => {
    localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN)
    set({ user: null, token: null })
  },
}))
