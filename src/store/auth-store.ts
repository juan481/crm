'use client'

import { create } from 'zustand'
import type { User } from '@/types'

interface AuthState {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean

  setUser:    (user: User | null) => void
  setLoading: (loading: boolean)  => void
  logout:     () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user:            null,
  isLoading:       true,
  isAuthenticated: false,

  setUser:    (user) => set({ user, isAuthenticated: !!user, isLoading: false }),
  setLoading: (isLoading) => set({ isLoading }),

  logout: async () => {
    // Limpia qué organización estaba activa ANTES de cerrar sesión — así la
    // próxima persona que loguee en esta compu arranca en su propia org de
    // origen, no en la que dejó elegida quien se fue. Best-effort: si falla
    // (offline, lo que sea) no bloquea el logout.
    try { await fetch('/api/session/active-org', { method: 'DELETE' }) } catch { /* ignore */ }
    // El signOut ahora pasa por el server (POST /api/auth/logout) en vez de
    // supabase.auth.signOut() directo en el cliente — así el mismo endpoint
    // puede loguear el evento de LOGOUT (log real de accesos, ver
    // LoginEvent) MIENTRAS la sesión todavía es válida; una vez cerrada acá
    // ya no habría a quién atribuirle el evento. El endpoint limpia las
    // cookies de sesión desde la respuesta.
    try { await fetch('/api/auth/logout', { method: 'POST' }) } catch { /* ignore — igual redirige a /login abajo */ }
    set({ user: null, isAuthenticated: false })
    window.location.href = '/login'
  },
}))
