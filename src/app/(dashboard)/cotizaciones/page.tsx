'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Search, FileText, Building2, Calendar, DollarSign, CheckCircle2, Clock, Send, AlertTriangle, Trash2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Modal, ModalFooter } from '@/components/ui/modal'
import { Pagination } from '@/components/ui/table'
import { formatMoneyExact } from '@/lib/utils'
import { useAuthStore } from '@/store/auth-store'
import toast from 'react-hot-toast'

interface CotizacionItem {
  id:            string
  ref:           string
  recipientName: string
  recipientEmail:string
  total:         number
  finalTotal:    number
  ivaDiscriminado: boolean | null
  currency:      string
  status:        string
  createdAt:     string
  notes:         string | null
  items:         Array<{ name: string; quantity: number; price: number; currency: string; billingCycle: string }>
  empresa:       { id: string; name: string } | null
  user:          { id: string; name: string } | null
}

const STATUS_LABELS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  GUARDADA:  { label: 'Guardada',  color: 'text-slate-400',   icon: <Clock    size={11} /> },
  ENVIADA:   { label: 'Enviada',   color: 'text-blue-400',    icon: <Send     size={11} /> },
  ACEPTADA:  { label: 'Aceptada',  color: 'text-emerald-400', icon: <CheckCircle2 size={11} /> },
  RECHAZADA: { label: 'Rechazada', color: 'text-red-400',     icon: <AlertTriangle size={11} /> },
  VENCIDA:   { label: 'Vencida',  color: 'text-amber-400',   icon: <AlertTriangle size={11} /> },
}

export default function CotizacionesPage() {
  const router = useRouter()
  const qc = useQueryClient()
  const { user } = useAuthStore()
  const isSuperAdmin = user?.role === 'SUPER_ADMIN'
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [deleting, setDeleting] = useState<CotizacionItem | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)

  useEffect(() => {
    debounceRef.current = setTimeout(() => { setDebouncedSearch(search); setPage(1) }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [search])

  const { data, isLoading, isError } = useQuery({
    queryKey: ['cotizaciones', debouncedSearch, page],
    queryFn: async () => {
      const p = new URLSearchParams({ page: String(page), limit: '20' })
      if (debouncedSearch.length >= 2) p.set('search', debouncedSearch)
      const res = await fetch(`/api/cotizaciones?${p}`)
      if (!res.ok) throw new Error('Error al cargar')
      return res.json()
    },
    staleTime: 30_000,
  })

  const cotizaciones: CotizacionItem[] = data?.data ?? []
  const total: number      = data?.total ?? 0
  const totalPages: number = data?.totalPages ?? 1

  const handleDelete = async () => {
    if (!deleting) return
    setDeleteBusy(true)
    try {
      const res = await fetch(`/api/cotizaciones/${deleting.id}`, { method: 'DELETE' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(json.error ?? 'No se pudo borrar'); return }
      toast.success('Cotización borrada')
      setDeleting(null)
      qc.invalidateQueries({ queryKey: ['cotizaciones'] })
    } catch { toast.error('Error de conexión') } finally { setDeleteBusy(false) }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>Cotizaciones</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            Historial de presupuestos emitidos
          </p>
        </div>
        <button
          onClick={() => router.push('/cotizador')}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold gradient-bg text-white"
        >
          <FileText size={15} /> Nueva cotización
        </button>
      </div>

      {/* Search */}
      <div className="max-w-sm">
        <Input
          placeholder="Buscar por empresa, ref o servicio..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          leftIcon={<Search size={15} />}
        />
      </div>

      {isError && (
        <div className="flex items-center gap-3 p-4 rounded-xl text-sm" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
          <AlertTriangle size={16} />
          Error al cargar las cotizaciones. Intentá de nuevo.
        </div>
      )}

      {/* Table */}
      {/* overflow-x-auto, no overflow-hidden — ver mismo comentario en
          empresas/page.tsx. */}
      <div className="rounded-2xl overflow-x-auto" style={{ border: '1px solid var(--color-border)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: 'var(--color-surface-raised)', borderBottom: '1px solid var(--color-border)' }}>
              <th className="px-4 py-3 text-left font-semibold" style={{ color: 'var(--color-text-muted)' }}>Ref</th>
              <th className="px-4 py-3 text-left font-semibold hidden md:table-cell" style={{ color: 'var(--color-text-muted)' }}>Empresa / Destinatario</th>
              <th className="px-4 py-3 text-left font-semibold hidden lg:table-cell" style={{ color: 'var(--color-text-muted)' }}>Servicios</th>
              <th className="px-4 py-3 text-right font-semibold" style={{ color: 'var(--color-text-muted)' }}>Total</th>
              <th className="px-4 py-3 text-center font-semibold hidden sm:table-cell" style={{ color: 'var(--color-text-muted)' }}>Estado</th>
              <th className="px-4 py-3 text-left font-semibold hidden xl:table-cell" style={{ color: 'var(--color-text-muted)' }}>Fecha</th>
              {isSuperAdmin && <th className="px-4 py-3" />}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  {[60, 50, 70, 30, 20, 40].map((w, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 rounded animate-pulse" style={{ background: 'var(--color-border)', width: `${w}%` }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : cotizaciones.length === 0 ? (
              <tr>
                <td colSpan={isSuperAdmin ? 7 : 6} className="px-4 py-12 text-center" style={{ color: 'var(--color-text-muted)' }}>
                  <FileText size={32} className="mx-auto mb-3 opacity-30" />
                  <p className="font-medium">No hay cotizaciones {debouncedSearch ? 'que coincidan con la búsqueda' : 'aún'}</p>
                  <p className="text-xs mt-1">
                    {debouncedSearch ? 'Probá con otro término' : 'Creá tu primera cotización desde el Cotizador'}
                  </p>
                </td>
              </tr>
            ) : (
              cotizaciones.map(c => {
                const statusInfo = STATUS_LABELS[c.status] ?? STATUS_LABELS.GUARDADA
                const serviceNames = Array.isArray(c.items)
                  ? c.items.map(i => i.quantity > 1 ? `${i.name} ×${i.quantity}` : i.name).join(', ')
                  : '—'
                const date = new Date(c.createdAt).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })

                return (
                  <tr key={c.id}
                    onClick={() => router.push(`/cotizaciones/${c.id}`)}
                    className="cursor-pointer hover:bg-[var(--color-surface-raised)] transition-colors"
                    style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs font-semibold" style={{ color: 'var(--color-primary)' }}>
                        {c.ref}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <div>
                        {c.empresa ? (
                          <p className="flex items-center gap-1 text-xs font-semibold" style={{ color: 'var(--color-text)' }}>
                            <Building2 size={11} style={{ color: 'var(--color-primary)' }} />
                            {c.empresa.name}
                          </p>
                        ) : null}
                        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                          {c.recipientName}{c.recipientEmail ? ` · ${c.recipientEmail}` : ''}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <p className="text-xs line-clamp-1" style={{ color: 'var(--color-text-muted)' }}>{serviceNames}</p>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm font-bold" style={{ color: 'var(--color-text)' }}>
                        {formatMoneyExact(c.finalTotal, c.currency)}
                      </span>
                      {c.ivaDiscriminado && (
                        <p className="text-[10px]" style={{ color: 'var(--color-text-subtle)' }}>IVA incl.</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center hidden sm:table-cell">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium ${statusInfo.color}`}>
                        {statusInfo.icon}{statusInfo.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden xl:table-cell">
                      <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        <Calendar size={11} />{date}
                      </span>
                    </td>
                    {isSuperAdmin && (
                      <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => setDeleting(c)}
                          className="p-1.5 rounded-lg text-[var(--color-text-subtle)] hover:text-red-400 hover:bg-red-500/10 transition-all"
                          title="Borrar cotización"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    )}
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <Pagination page={page} totalPages={totalPages} total={total} limit={20} onPageChange={setPage} />
      )}

      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Borrar cotización" size="sm">
        <p className="text-sm text-[var(--color-text-muted)] mb-6">
          ¿Borrar <strong className="text-[var(--color-text)] font-mono">{deleting?.ref}</strong> ({deleting?.recipientName})? Esta acción no se puede deshacer — no se puede borrar si ya tiene una factura emitida.
        </p>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setDeleting(null)}>Cancelar</Button>
          <Button variant="danger" loading={deleteBusy} onClick={handleDelete}>Borrar</Button>
        </ModalFooter>
      </Modal>
    </div>
  )
}
