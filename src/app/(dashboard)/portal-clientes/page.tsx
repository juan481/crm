'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2, Users, CheckCircle2, AlertTriangle, ChevronRight } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'

interface Row {
  id: string
  name: string
  tieneAcceso: boolean
  facturasPendientes: number
  saldoPorMoneda: Record<string, number>
  servicios: number
}

function money(n: number, cur: string) {
  try { return new Intl.NumberFormat('es-AR', { style: 'currency', currency: cur, minimumFractionDigits: 2 }).format(n) }
  catch { return `${cur} ${n.toFixed(2)}` }
}

export default function PortalClientesPage() {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [q, setQ] = useState('')

  useEffect(() => {
    fetch('/api/portal-preview').then((r) => r.json()).then((j) => setRows(j.data ?? [])).catch(() => setRows([]))
  }, [])

  if (!rows) return <div className="flex justify-center py-20"><Loader2 className="animate-spin" style={{ color: 'var(--color-text-subtle)' }} /></div>

  const filtered = q.trim() ? rows.filter((r) => r.name.toLowerCase().includes(q.trim().toLowerCase())) : rows

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl gradient-bg flex items-center justify-center shrink-0"><Users size={20} className="text-white" /></div>
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">Portal de clientes</h1>
          <p className="text-sm text-[var(--color-text-muted)]">Lo que ve cada cliente — estado de cuenta, facturas y soporte</p>
        </div>
      </div>

      <input
        type="text" placeholder="Buscar cliente..." value={q} onChange={(e) => setQ(e.target.value)}
        className="w-full sm:w-64 text-sm rounded-xl px-3 py-2 outline-none"
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-strong)', color: 'var(--color-text)' }}
      />

      {filtered.length === 0 ? (
        <p className="text-sm text-[var(--color-text-muted)]">No hay clientes.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => {
            const saldos = Object.entries(r.saldoPorMoneda).filter(([, v]) => v > 0)
            return (
              <Link
                key={r.id}
                href={`/empresas/${r.id}/portal`}
                className="surface rounded-xl p-4 flex items-center gap-3 hover:border-[var(--color-primary)]/50 transition-colors"
                style={{ border: '1px solid var(--color-border)' }}
              >
                <Avatar name={r.name} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-[var(--color-text)] truncate">{r.name}</p>
                  <p className="text-xs text-[var(--color-text-subtle)] flex items-center gap-1.5 mt-0.5">
                    {r.tieneAcceso
                      ? <span className="text-emerald-500 flex items-center gap-1"><CheckCircle2 size={11} /> con acceso</span>
                      : <span className="text-amber-500 flex items-center gap-1"><AlertTriangle size={11} /> sin acceso</span>}
                    <span>· {r.servicios} servicio{r.servicios !== 1 ? 's' : ''}</span>
                  </p>
                </div>
                <div className="text-right shrink-0">
                  {saldos.length === 0 ? (
                    <span className="text-xs text-emerald-500">al día</span>
                  ) : (
                    <>
                      {saldos.map(([cur, v]) => <p key={cur} className="text-sm font-bold text-amber-500">{money(v, cur)}</p>)}
                      <p className="text-[11px] text-[var(--color-text-subtle)]">{r.facturasPendientes} pend.</p>
                    </>
                  )}
                </div>
                <ChevronRight size={16} className="text-[var(--color-text-subtle)] shrink-0" />
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
