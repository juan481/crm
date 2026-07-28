'use client'

import { LogOut } from 'lucide-react'
import { useAuthStore } from '@/store/auth-store'

export function AdminLogoutButton() {
  const { logout } = useAuthStore()
  return (
    <button
      onClick={() => logout()}
      className="ml-auto flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors hover:bg-[var(--color-surface-raised)]"
      style={{ color: 'var(--color-text-muted)' }}
    >
      <LogOut size={13} /> Cerrar sesión
    </button>
  )
}
