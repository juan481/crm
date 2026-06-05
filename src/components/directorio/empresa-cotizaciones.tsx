'use client'

import { useQuery } from '@tanstack/react-query'
import { FileText, Calendar, DollarSign, Send, Clock, CheckCircle2 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface CotizacionRow {
  id: string; ref: string; recipientName: string; total: number
  currency: string; status: string; createdAt: string
  items: Array<{ name: string; quantity: number }>
  user: { name: string } | null
}

const STATUS_INFO: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  GUARDADA: { label: 'Guardada',  color: '#94a3b8', icon: <Clock      size={11} /> },
  ENVIADA:  { label: 'Enviada',   color: '#60a5fa', icon: <Send       size={11} /> },
  ACEPTADA: { label: 'Aceptada',  color: '#34d399', icon: <CheckCircle2 size={11} /> },
}

export function EmpresaCotizaciones({ empresaId }: { empresaId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['cotizaciones-empresa', empresaId],
    queryFn: async () => {
      const res = await fetch(`/api/cotizaciones?empresaId=${empresaId}&limit=20`)
      if (!res.ok) return { data: [] }
      return res.json()
    },
    staleTime: 60_000,
  })

  const cotizaciones: CotizacionRow[] = data?.data ?? []

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <FileText size={16} style={{ color: 'var(--color-primary)' }} />
        <h2 className="text-base font-semibold" style={{ color: 'var(--color-text)' }}>
          Historial de Cotizaciones
        </h2>
        {cotizaciones.length > 0 && (
          <span className="text-xs px-2 py-0.5 rounded-full"
            style={{ background: 'var(--color-surface-raised)', color: 'var(--color-text-muted)' }}>
            {cotizaciones.length}
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2].map(i => (
            <div key={i} className="h-14 rounded-xl animate-pulse" style={{ background: 'var(--color-border)' }} />
          ))}
        </div>
      ) : cotizaciones.length === 0 ? (
        <p className="text-sm py-6 text-center" style={{ color: 'var(--color-text-muted)' }}>
          No hay cotizaciones emitidas para esta empresa aún.
        </p>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--color-surface-raised)', borderBottom: '1px solid var(--color-border)' }}>
                <th className="px-4 py-2.5 text-left text-xs font-semibold" style={{ color: 'var(--color-text-muted)' }}>Ref</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold hidden md:table-cell" style={{ color: 'var(--color-text-muted)' }}>Servicios</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold" style={{ color: 'var(--color-text-muted)' }}>Total</th>
                <th className="px-4 py-2.5 text-center text-xs font-semibold hidden sm:table-cell" style={{ color: 'var(--color-text-muted)' }}>Estado</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold hidden lg:table-cell" style={{ color: 'var(--color-text-muted)' }}>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {cotizaciones.map(c => {
                const info      = STATUS_INFO[c.status] ?? STATUS_INFO.GUARDADA
                const services  = c.items.map(i => i.quantity > 1 ? `${i.name} ×${i.quantity}` : i.name).join(', ')
                const date      = new Date(c.createdAt).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })
                return (
                  <tr key={c.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td className="px-4 py-2.5">
                      <span className="font-mono text-xs font-semibold" style={{ color: 'var(--color-primary)' }}>
                        {c.ref}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 hidden md:table-cell">
                      <p className="text-xs line-clamp-1" style={{ color: 'var(--color-text-muted)' }}>{services}</p>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span className="text-sm font-bold" style={{ color: 'var(--color-text)' }}>
                        {formatCurrency(c.total, c.currency)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-center hidden sm:table-cell">
                      <span className="inline-flex items-center gap-1 text-xs font-medium" style={{ color: info.color }}>
                        {info.icon}{info.label}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 hidden lg:table-cell">
                      <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        <Calendar size={10} />{date}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
