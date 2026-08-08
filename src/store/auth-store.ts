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
    // Import dynamically to avoid SSR issues with browser client
    const { createClient } = await import('@/lib/supabase/client')
    const supabase = createClient()
    // Limpia qué organización estaba activa ANTES de cerrar sesión — así la
    // próxima persona que loguee en esta compu arranca en su propia org de
    // origen, no en la que dejó elegida quien se fue. Best-effort: si falla
    // (offline, lo que sea) no bloquea el logout.
    try { await fetch('/api/session/active-org', { method: 'DELETE' }) } catch { /* ignore */ }
    await supabase.auth.signOut()
    set({ user: null, isAuthenticated: false })
    window.location.href = '/login'
  },
}))
