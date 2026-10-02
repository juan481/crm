'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Plus, Send, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Pagination } from '@/components/ui/table'
import { ESTADO_SOLICITUD_LABEL, ESTADO_SOLICITUD_COLOR } from '@/lib/solicitudes-compra'
import toast from 'react-hot-toast'

interface SolicitudRow {
  id: string
  numero: number | null
  estado: string
  condicionPago: string | null
  createdAt: string
  proveedor: { id: string; name: string } | null
  _count: { items: number }
}

// Pedidos de mercadería al proveedor/importador — distinto de "Compras"
// (que registra una factura que ya llegó). Pedido de Abba, Seba
// 2026-10-02: armar el pedido con el costo real (ya sincronizado del
// catálogo del proveedor) y mandarlo por mail, sin gestionar fechas de
// entrega — la respuesta del importador (disponible / sin stock) se
// registra a mano por ítem en la ficha de cada pedido.
export function SolicitudesCompra() {
  const router = useRouter()
  const [page, setPage] = useState(1)
  const [creating, setCreating] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['solicitudes-compra', page],
    queryFn: async () => {
      const res = await fetch(`/api/solicitudes-compra?page=${page}&limit=20`)
      if (!res.ok) return { data: [], total: 0, totalPages: 1 }
      return res.json()
    },
    staleTime: 20_000,
  })
  const rows: SolicitudRow[] = data?.data ?? []
  const total = data?.total ?? 0
  const totalPages = data?.totalPages ?? 1

  const handleCreate = async () => {
    setCreating(true)
    try {
      const res = await fetch('/api/solicitudes-compra', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'Error al crear'); return }
      router.push(`/compras/solicitudes/${json.data.id}`)
    } catch { toast.error('Error de conexión') } finally { setCreating(false) }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          Pedidos de mercadería armados desde el costo del catálogo — mandalos por mail al proveedor y registrá su respuesta.
        </p>
        <Button onClick={handleCreate} loading={creating} leftIcon={<Plus size={15} />}>
          Nueva solicitud
        </Button>
      </div>

      <div className="rounded-2xl overflow-x-auto" style={{ border: '1px solid var(--color-border)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: 'var(--color-surface-raised)', borderBottom: '1px solid var(--color-border)' }}>
              {['N°', 'Proveedor', 'Condición de pago', 'Ítems', 'Estado', 'Fecha'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold" style={{ color: 'var(--color-text-muted)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <td key={j} className="px-4 py-3"><div className="h-4 rounded animate-pulse" style={{ background: 'var(--color-border)' }} /></td>
                  ))}
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-14 text-center" style={{ color: 'var(--color-text-muted)' }}>
                  <FileText size={28} className="mx-auto mb-2 opacity-30" />
                  <p className="font-medium text-sm">Sin pedidos todavía</p>
                  <p className="text-xs mt-1">Creá uno nuevo para armar la solicitud al proveedor.</p>
                </td>
              </tr>
            ) : (
              rows.map(s => (
                <tr key={s.id} className="cursor-pointer hover:bg-[var(--color-surface-raised)] transition-colors"
                  style={{ borderBottom: '1px solid var(--color-border)' }}
                  onClick={() => router.push(`/compras/solicitudes/${s.id}`)}>
                  <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--color-text-muted)' }}>{s.numero ?? '—'}</td>
                  <td className="px-4 py-3 font-medium" style={{ color: 'var(--color-text)' }}>{s.proveedor?.name ?? '— sin elegir —'}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-text-muted)' }}>{s.condicionPago ?? '—'}</td>
                  <td className="px-4 py-3 text-center" style={{ color: 'var(--color-text-muted)' }}>{s._count.items}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full"
                      style={{ background: `${ESTADO_SOLICITUD_COLOR[s.estado]}1a`, color: ESTADO_SOLICITUD_COLOR[s.estado] }}>
                      {s.estado === 'ENVIADA' && <Send size={10} />}
                      {ESTADO_SOLICITUD_LABEL[s.estado] ?? s.estado}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    {new Date(s.createdAt).toLocaleDateString('es-AR')}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && <Pagination page={page} totalPages={totalPages} total={total} limit={20} onPageChange={setPage} />}
    </div>
  )
}
