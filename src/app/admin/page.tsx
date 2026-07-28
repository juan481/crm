'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Building2, Users, ShieldOff, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Modal, ModalFooter } from '@/components/ui/modal'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'

interface AdminOrg {
  id:          string
  name:        string
  domain:      string | null
  crmName:     string
  suspended:   boolean
  suspendedAt: string | null
  createdAt:   string
  _count:      { users: number }
}

export default function AdminOrganizationsPage() {
  const qc = useQueryClient()
  const [actionOrg, setActionOrg] = useState<AdminOrg | null>(null)

  const { data, isLoading, isError } = useQuery<AdminOrg[]>({
    queryKey: ['admin-organizations'],
    queryFn: async () => {
      const res = await fetch('/api/admin/organizations')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error al cargar organizaciones')
      return json.data
    },
  })

  const orgs = data ?? []

  const toggleSuspend = async (org: AdminOrg) => {
    const res = await fetch(`/api/admin/organizations/${org.id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ suspended: !org.suspended }),
    })
    const json = await res.json()
    if (!res.ok) { toast.error(json.error ?? 'Error al actualizar'); return }
    toast.success(org.suspended ? 'Organización reactivada' : 'Organización suspendida')
    qc.invalidateQueries({ queryKey: ['admin-organizations'] })
    setActionOrg(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl gradient-bg flex items-center justify-center">
          <Building2 size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">Organizaciones</h1>
          <p className="text-sm text-[var(--color-text-muted)]">{orgs.length} organizaciones en el sistema</p>
        </div>
      </div>

      <div className="surface rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="divide-y divide-[var(--color-border)]">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-5 animate-pulse">
                <Skeleton className="w-10 h-10 rounded-xl" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-56" />
                </div>
              </div>
            ))}
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-16">
            <p className="text-sm text-[var(--color-text-muted)]">Error al cargar las organizaciones</p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--color-border)]">
            {orgs.map((org) => (
              <div key={org.id} className="flex items-center gap-4 p-5 hover:bg-[var(--color-surface-raised)] transition-colors">
                <div className="w-10 h-10 rounded-xl gradient-bg flex items-center justify-center text-white shrink-0">
                  <Building2 size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-[var(--color-text)]">{org.name}</p>
                    <Badge variant={org.suspended ? 'danger' : 'success'} size="sm" dot>
                      {org.suspended ? 'Suspendida' : 'Activa'}
                    </Badge>
                  </div>
                  <p className="text-sm text-[var(--color-text-muted)] truncate">
                    {org.domain ?? 'sin dominio'} · {org.crmName}
                  </p>
                </div>
                <div className="hidden sm:flex items-center gap-4 shrink-0">
                  <div className="flex items-center gap-1.5 text-sm text-[var(--color-text-muted)]">
                    <Users size={14} />{org._count.users}
                  </div>
                  <div className="text-xs text-[var(--color-text-subtle)] text-right">
                    <p>Desde {formatDate(org.createdAt)}</p>
                    {org.suspended && org.suspendedAt && <p>Suspendida desde {formatDate(org.suspendedAt)}</p>}
                  </div>
                </div>
                <button
                  onClick={() => setActionOrg(org)}
                  className={`p-2 rounded-lg transition-all ${
                    org.suspended
                      ? 'text-[var(--color-text-subtle)] hover:bg-emerald-500/10 hover:text-emerald-400'
                      : 'text-[var(--color-text-subtle)] hover:bg-amber-500/10 hover:text-amber-400'
                  }`}
                  title={org.suspended ? 'Reactivar' : 'Suspender'}
                >
                  {org.suspended ? <ShieldCheck size={16} /> : <ShieldOff size={16} />}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal
        open={!!actionOrg}
        onClose={() => setActionOrg(null)}
        title={actionOrg?.suspended ? 'Reactivar organización' : 'Suspender organización'}
        size="sm"
      >
        <p className="text-sm text-[var(--color-text-muted)] mb-4">
          {actionOrg?.suspended
            ? <>¿Reactivar a <strong className="text-[var(--color-text)]">{actionOrg?.name}</strong>? Todos sus usuarios van a poder volver a iniciar sesión.</>
            : <>¿Suspender a <strong className="text-[var(--color-text)]">{actionOrg?.name}</strong>? Ningún usuario de esta organización va a poder iniciar sesión hasta que la reactives — no se borra ningún dato.</>}
        </p>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setActionOrg(null)}>Cancelar</Button>
          <Button
            variant={actionOrg?.suspended ? 'success' : 'danger'}
            onClick={() => actionOrg && toggleSuspend(actionOrg)}
          >
            {actionOrg?.suspended ? 'Reactivar' : 'Suspender'}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  )
}
