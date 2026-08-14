'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { KeyRound, Lock, AlertTriangle } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuthStore } from '@/store/auth-store'
import { ROLES } from '@/lib/modules'
import { ROLE_LABELS } from '@/lib/utils'
import type { Role } from '@/types'
import toast from 'react-hot-toast'

interface ModulePermissionRow {
  id: string
  label: string
  minRole: Role
  roles: Record<Role, boolean>
}

// Jerarquía idéntica a canAccess()/roleAtLeast() — sólo para pintar en gris
// las celdas que el backend igual rechazaría, no reemplaza esa validación.
const ROLE_LEVEL: Record<Role, number> = { SUPER_ADMIN: 4, ADMIN: 3, SELLER: 2, HR: 1, TECHNICIAN: 0 }
const meetsFloor = (role: Role, minRole: Role) => ROLE_LEVEL[role] >= ROLE_LEVEL[minRole]

export default function PermisosPage() {
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const isSuperAdmin = user?.role === 'SUPER_ADMIN'

  const { data, isLoading, isError } = useQuery<ModulePermissionRow[]>({
    queryKey: ['module-permissions'],
    queryFn: async () => {
      const res = await fetch('/api/module-permissions')
      const json = await res.json()
      return json.data ?? []
    },
    staleTime: 5 * 60 * 1000,
  })

  const rows = data ?? []

  const toggle = async (moduleId: string, role: Role, current: boolean) => {
    if (!isSuperAdmin) { toast.error('Solo el Super Admin puede gestionar permisos'); return }
    if (role === 'SUPER_ADMIN') return
    const row = rows.find((r) => r.id === moduleId)
    if (row && !meetsFloor(role, row.minRole)) {
      toast.error(`${ROLE_LABELS[role]} no puede acceder a ${row.label} — es un límite de seguridad, no de este panel`)
      return
    }
    const enabled = !current
    qc.setQueryData<ModulePermissionRow[]>(['module-permissions'], (old) =>
      old?.map((r) => (r.id === moduleId ? { ...r, roles: { ...r.roles, [role]: enabled } } : r)) ?? []
    )
    const res = await fetch('/api/module-permissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ moduleId, role, enabled }),
    })
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      toast.error(json.error ?? 'Error al actualizar')
      qc.invalidateQueries({ queryKey: ['module-permissions'] })
      return
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl gradient-bg flex items-center justify-center"><KeyRound size={20} className="text-white" /></div>
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">Permisos por rol</h1>
          <p className="text-sm text-[var(--color-text-muted)]">Elegí qué módulos ve cada rol en el menú lateral.</p>
        </div>
      </div>

      {!isSuperAdmin && (
        <div className="surface rounded-2xl p-4 border-l-4 border-amber-500 bg-amber-500/5">
          <p className="text-sm text-amber-400">Solo el Super Admin puede modificar estos permisos.</p>
        </div>
      )}

      <div className="surface rounded-2xl p-4 border-l-4 border-[var(--color-primary)] bg-[var(--color-primary-light)]">
        <p className="text-sm text-[var(--color-text)]">
          Esto sólo controla qué aparece en el menú — nunca puede darle a un rol acceso a algo que el sistema ya le bloquea
          por seguridad (esas celdas quedan deshabilitadas). Un rol sin un módulo en el menú que igual conoce la URL directa
          sigue protegido por el mismo control de siempre, no por este panel.
        </p>
      </div>

      {isError && (
        <div className="flex items-center gap-3 p-4 rounded-xl text-sm" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
          <AlertTriangle size={16} />
          Error al cargar los datos. Intentá de nuevo.
        </div>
      )}

      <Card className="overflow-x-auto p-0">
        {isLoading ? (
          <div className="p-4 space-y-2">{Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-10 rounded-lg" />)}</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)]">
                <th className="text-left font-medium text-[var(--color-text-muted)] px-4 py-3">Módulo</th>
                {ROLES.map((role) => (
                  <th key={role} className="text-center font-medium text-[var(--color-text-muted)] px-3 py-3 whitespace-nowrap">
                    {role === 'SUPER_ADMIN' && <Lock size={11} className="inline mr-1 mb-0.5" />}
                    {ROLE_LABELS[role]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <motion.tr
                  key={row.id}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                  className="border-b border-[var(--color-border)] last:border-0"
                >
                  <td className="px-4 py-3 font-medium text-[var(--color-text)]">{row.label}</td>
                  {ROLES.map((role) => {
                    const isSuper = role === 'SUPER_ADMIN'
                    const belowFloor = !isSuper && !meetsFloor(role, row.minRole)
                    const checked = row.roles[role]
                    return (
                      <td key={role} className="px-3 py-3 text-center">
                        <button
                          onClick={() => toggle(row.id, role, checked)}
                          disabled={!isSuperAdmin || isSuper || belowFloor}
                          title={isSuper ? 'Super Admin siempre ve todo' : belowFloor ? 'Bloqueado por seguridad, no editable acá' : undefined}
                          className={`relative rounded-full transition-all duration-300 disabled:cursor-not-allowed ${
                            checked ? 'gradient-bg' : 'bg-[var(--color-surface-raised)] border border-[var(--color-border-strong)]'
                          } ${belowFloor ? 'opacity-30' : isSuper ? 'opacity-70' : 'disabled:opacity-50'}`}
                          style={{ width: 36, height: 20 }}
                        >
                          <div className={`absolute top-[3px] w-3.5 h-3.5 rounded-full bg-white shadow-sm transition-all duration-300 ${checked ? 'left-[19px]' : 'left-[3px]'}`} />
                        </button>
                      </td>
                    )
                  })}
                </motion.tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}
