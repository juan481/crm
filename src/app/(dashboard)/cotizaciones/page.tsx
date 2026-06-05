'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Search, FileText, Building2, Calendar, DollarSign, CheckCircle2, Clock, Send } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Pagination } from '@/components/ui/table'
import { formatCurrency } from '@/lib/utils'

interface CotizacionItem {
  id:            string
  ref:           string
  recipientName: string
  recipientEmail:string
  total:         number
  currency:      string
  status:        string
  createdAt:     string
  notes:         string | null
  items:         Array<{ name: string; quantity: number; price: number; currency: string; billingCycle: string }>
  empresa:       { id: string; name: string } | null
  user:          { id: string; name: string } | null
}

const STATUS_LABELS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  GUARDADA: { label: 'Guardada',  color: 'text-slate-400',   icon: <Clock    size={11} /> },
  ENVIADA:  { label: 'Enviada',   color: 'text-blue-400',    icon: <Send     size={11} /> },
  ACEPTADA: { label: 'Aceptada',  color: 'text-emerald-400', icon: <CheckCircle2 size={11} /> },
}

export default function CotizacionesPage() {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)

  // Debounce search
  const handleSearch = (val: string) => {
    setSearch(val)
    setPage(1)
    clearTimeout((window as any).__cSearch)
    ;(window as any).__cSearch = setTimeout(() => setDebouncedSearch(val), 300)
  }

  const { data, isLoading } = useQuery({
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
          onChange={e => handleSearch(e.target.value)}
          leftIcon={<Search size={15} />}
        />
      </div>

      {/* Table */}
      <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: 'var(--color-surface-raised)', borderBottom: '1px solid var(--color-border)' }}>
              <th className="px-4 py-3 text-left font-semibold" style={{ color: 'var(--color-text-muted)' }}>Ref</th>
              <th className="px-4 py-3 text-left font-semibold hidden md:table-cell" style={{ color: 'var(--color-text-muted)' }}>Empresa / Destinatario</th>
              <th className="px-4 py-3 text-left font-semibold hidden lg:table-cell" style={{ color: 'var(--color-text-muted)' }}>Servicios</th>
              <th className="px-4 py-3 text-right font-semibold" style={{ color: 'var(--color-text-muted)' }}>Total</th>
              <th className="px-4 py-3 text-center font-semibold hidden sm:table-cell" style={{ color: 'var(--color-text-muted)' }}>Estado</th>
              <th className="px-4 py-3 text-left font-semibold hidden xl:table-cell" style={{ color: 'var(--color-text-muted)' }}>Fecha</th>
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
                <td colSpan={6} className="px-4 py-12 text-center" style={{ color: 'var(--color-text-muted)' }}>
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
                  <tr key={c.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
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
                        {formatCurrency(c.total, c.currency)}
                      </span>
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
    </div>
  )
}
