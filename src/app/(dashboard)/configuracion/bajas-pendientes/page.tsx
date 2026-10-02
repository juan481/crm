'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ShieldCheck, Trash2, Check, X, Building2, UserCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatDateTime, timeAgo } from '@/lib/utils'
import toast from 'react-hot-toast'

interface SolicitudRow {
  id: string
  entityType: 'empresa' | 'contacto'
  entityId: string
  entityLabel: string
  createdAt: string
  requestedBy: { id: string; name: string }
}

// Bandeja de maker-checker para Eliminar (pedido de Abba, Seba 2026-10-02):
// un ADMIN que pide borrar una Empresa/Contacto deja esto acá en vez de
// borrar directo — sólo un SUPER_ADMIN resuelve (ver middleware de rol en
// api/deletion-requests). Page gateada a SUPER_ADMIN en sidebar.tsx, mismo
// criterio que /configuracion/permisos.
export default function BajasPendientesPage() {
  const qc = useQueryClient()
  const [resolvingId, setResolvingId] = useState<string | null>(null)

  const { data, isLoading } = useQuery<SolicitudRow[]>({
    queryKey: ['deletion-requests'],
    queryFn: async () => {
      const res = await fetch('/api/deletion-requests')
      if (!res.ok) return []
      return (await res.json()).data ?? []
    },
    staleTime: 20_000,
  })

  const solicitudes = data ?? []

  const resolve = async (id: string, action: 'approve' | 'reject') => {
    setResolvingId(id)
    try {
      const res = await fetch(`/api/deletion-requests/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'Error'); return }
      toast.success(json.message)
      qc.invalidateQueries({ queryKey: ['deletion-requests'] })
      qc.invalidateQueries({ queryKey: ['empresas'] })
      qc.invalidateQueries({ queryKey: ['contactos'] })
    } catch { toast.error('Error de conexión') }
    finally { setResolvingId(null) }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl gradient-bg flex items-center justify-center"><ShieldCheck size={18} className="text-white" /></div>
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>Bajas pendientes</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            Pedidos de eliminación de Empresas y Contactos que necesitan tu confirmación
          </p>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-center py-12" style={{ color: 'var(--color-text-muted)' }}>Cargando...</p>
      ) : solicitudes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <ShieldCheck size={28} className="mb-3 opacity-30" style={{ color: 'var(--color-text-muted)' }} />
          <p className="text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>No hay pedidos pendientes</p>
        </div>
      ) : (
        <div className="space-y-2">
          {solicitudes.map((s) => {
            const resolving = resolvingId === s.id
            return (
              <div key={s.id} className="flex items-center gap-3 rounded-2xl px-4 py-3 flex-wrap"
                style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)' }}>
                  {s.entityType === 'empresa'
                    ? <Building2 size={15} style={{ color: 'var(--color-primary)' }} />
                    : <UserCircle2 size={15} style={{ color: 'var(--color-primary)' }} />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                    <Trash2 size={12} className="inline mr-1 opacity-60" />
                    {s.entityType === 'empresa' ? 'Eliminar empresa' : 'Eliminar contacto'}: {s.entityLabel}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    Pedido por {s.requestedBy?.name ?? '—'} · {timeAgo(s.createdAt)} ({formatDateTime(s.createdAt)})
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button size="sm" variant="outline" disabled={resolving} onClick={() => resolve(s.id, 'reject')}>
                    <X size={13} /> Rechazar
                  </Button>
                  <Button size="sm" variant="danger" disabled={resolving} onClick={() => resolve(s.id, 'approve')}>
                    <Check size={13} /> Confirmar baja
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
