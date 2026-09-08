'use client'

import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/store/auth-store'
import type { Role } from '@/types'

interface ModulePermissionRow {
  id: string
  label: string
  minRole: Role
  roles: Record<Role, boolean>
}

export function useModulePermissions(): ModulePermissionRow[] {
  const { data = [] } = useQuery<ModulePermissionRow[]>({
    queryKey: ['module-permissions'],
    queryFn: async () => {
      const res = await fetch('/api/module-permissions')
      if (!res.ok) return []
      return (await res.json()).data ?? []
    },
    staleTime: 5 * 60 * 1000,
  })
  return data
}

// ¿El usuario actual tiene acceso efectivo a este módulo?
// Mientras la lista no resolvió, devuelve `undefined` (no bloquea de golpe;
// mismo criterio fail-open que el sidebar).
export function useModuleAccess(moduleId: string): boolean | undefined {
  const { user } = useAuthStore()
  const rows = useModulePermissions()
  if (!user) return false
  if (user.role === 'SUPER_ADMIN') return true
  if (rows.length === 0) return undefined
  const row = rows.find((r) => r.id === moduleId)
  if (!row) return false
  return row.roles[user.role] === true
}
