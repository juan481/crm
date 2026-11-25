'use client'

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Building2, Plus, Search } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import toast from 'react-hot-toast'

// Asignar el cliente (Empresa) a una cotización que quedó sin empresa — sin
// esto no se puede emitir la factura (pedido de Abba, 2026-11, caso "Poder
// Judicial": cotizado a un destinatario suelto con mail de relleno).
export function AsignarClienteModal({ cotizacionId, sugerido, onClose, onDone }: {
  cotizacionId: string
  /** Nombre del destinatario de la cotización — se ofrece para crear la empresa. */
  sugerido: string
  onClose: () => void
  onDone: () => void
}) {
  const [q, setQ] = useState(sugerido)
  const [debounced, setDebounced] = useState(sugerido)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 300)
    return () => clearTimeout(t)
  }, [q])

  const { data: empresas, isFetching } = useQuery<{ id: string; name: string; isCliente?: boolean }[]>({
    queryKey: ['asignar-cliente-empresas', debounced],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: '10' })
      if (debounced.length >= 2) params.set('search', debounced)
      const res = await fetch(`/api/empresas?${params}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error')
      return json.data
    },
  })

  const asignar = async (body: { empresaId?: string; crearEmpresa?: string }) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/cotizaciones/${cotizacionId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(json.error ?? 'No se pudo asignar'); return }
      toast.success('Cliente asignado a la cotización')
      onDone()
    } catch {
      toast.error('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  const nombreNuevo = q.trim()
  const existeIgual = (empresas ?? []).some((e) => e.name.trim().toLowerCase() === nombreNuevo.toLowerCase())

  return (
    <Modal open onClose={onClose} title="Asignar cliente" size="md">
      <div className="space-y-3">
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          Elegí la empresa a la que se le factura esta cotización, o creala si todavía no existe.
        </p>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-subtle)] pointer-events-none" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar empresa..."
            className="w-full pl-8 pr-3 py-2 text-sm rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
          />
        </div>
        <div className="space-y-1.5 max-h-64 overflow-y-auto">
          {(empresas ?? []).map((e) => (
            <button
              key={e.id}
              disabled={saving}
              onClick={() => asignar({ empresaId: e.id })}
              className="w-full flex items-center gap-2 p-2.5 rounded-xl border border-[var(--color-border)] hover:border-[var(--color-primary)]/50 text-left text-sm transition-all"
              style={{ color: 'var(--color-text)' }}
            >
              <Building2 size={14} className="text-[var(--color-text-subtle)] shrink-0" />
              <span className="flex-1 truncate">{e.name}</span>
              {e.isCliente && <span className="text-[10px] font-medium text-emerald-500">cliente</span>}
            </button>
          ))}
          {!isFetching && (empresas ?? []).length === 0 && (
            <p className="text-xs text-center py-3" style={{ color: 'var(--color-text-muted)' }}>No hay empresas con ese nombre.</p>
          )}
        </div>
        {nombreNuevo.length >= 2 && !existeIgual && (
          <Button variant="outline" className="w-full" loading={saving} leftIcon={<Plus size={14} />} onClick={() => asignar({ crearEmpresa: nombreNuevo })}>
            Crear empresa “{nombreNuevo}” y asignarla
          </Button>
        )}
      </div>
    </Modal>
  )
}
