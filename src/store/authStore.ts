import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { apiFetch } from '../api/client'

type AuthState = {
  token: string | null
  username: string | null
  role: 'admin' | 'user' | null
  status: 'unknown' | 'authed' | 'guest'
  error: string | null
  login: (username: string, password: string) => Promise<void>
  logout: () => void
  check: () => Promise<void>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      username: null,
      role: null,
      status: 'unknown',
      error: null,
      login: async (username, password) => {
        set({ error: null })
        const res = await apiFetch<{ token: string; username: string; role: 'admin' | 'user' }>('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ username, password }),
        })
        set({ token: res.token, username: res.username, role: res.role, status: 'authed' })
      },
      logout: () => set({ token: null, username: null, role: null, status: 'guest', error: null }),
      check: async () => {
        const token = get().token
        if (!token) {
          set({ status: 'guest' })
          return
        }
        try {
          const me = await apiFetch<{ username: string; role: 'admin' | 'user' }>('/auth/me', { token })
          set({ username: me.username, role: me.role, status: 'authed' })
        } catch {
          set({ token: null, username: null, role: null, status: 'guest' })
        }
      },
    }),
    { name: 'medical-card:auth:v1', partialize: (s) => ({ token: s.token }) },
  ),
)

