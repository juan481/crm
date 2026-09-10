'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2, Eye, CheckCircle2, AlertTriangle, Receipt, LifeBuoy } from 'lucide-react'

interface Preview {
  empresaName: string
  tieneAcceso: boolean
  emailsConAcceso: string[]
  servicios: { id: string; nombre: string; monto: number; moneda: string; cicloLabel: string; estado: string; incluyeMonitoreo: boolean }[]
  saldoPorMoneda: Record<string, number>
  facturasPendientes: number
  facturas: { id: string; numero: string; concepto: string; amount: number; currency: string; status: string; dueDate: string; paidAt: string | null; payToken: string | null }[]
  tickets: { id: string; number: number; title: string; status: string; category: string; createdAt: string }[]
}

function money(n: number, cur: string) {
  try { return new Intl.NumberFormat('es-AR', { style: 'currency', currency: cur, minimumFractionDigits: 2 }).format(n) }
  catch { return `${cur} ${n.toFixed(2)}` }
}
const STATUS: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Pendiente', color: '#f59e0b' }, OVERDUE: { label: 'Vencida', color: '#ef4444' },
  PAID: { label: 'Pagada', color: '#10b981' }, CANCELLED: { label: 'Anulada', color: '#94a3b8' },
}
const TICKET_STATUS: Record<string, string> = {
  ABIERTO: 'Abierto', EN_PROCESO: 'En proceso', ESPERANDO: 'Esperando', RESUELTO: 'Resuelto', CERRADO: 'Cerrado',
}

export default function PortalPreviewPage() {
  const { id } = useParams<{ id: string }>()
  const [d, setD] = useState<Preview | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/portal-preview/${id}`).then((r) => r.json()).then((j) => setD(j.data ?? null)).catch(() => {}).finally(() => setLoading(false))
  }, [id])

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin" style={{ color: 'var(--color-text-subtle)' }} /></div>
  if (!d) return <p className="text-sm text-[var(--color-text-muted)]">No se pudo cargar.</p>

  const saldos = Object.entries(d.saldoPorMoneda).filter(([, v]) => v > 0)

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <Link href={`/empresas/${id}`} className="text-sm flex items-center gap-1 text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
          <ArrowLeft size={14} /> {d.empresaName}
        </Link>
        <div className="flex items-center gap-2 mt-2">
          <Eye size={18} className="text-[var(--color-primary)]" />
          <h1 className="text-xl font-bold text-[var(--color-text)]">Así ve el cliente su portal</h1>
        </div>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">
          Vista de sólo lectura de <code>crm.justcreate.com.ar/portal</code>.{' '}
          {d.tieneAcceso
            ? <>Acceso dado a: {d.emailsConAcceso.join(', ')}</>
            : <span className="text-amber-500">Todavía nadie tiene acceso — dale acceso desde la ficha.</span>}
        </p>
      </div>

      {/* Inicio */}
      <div className="surface rounded-2xl p-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-subtle)] mb-3">Inicio</p>
        <p className="text-xs text-[var(--color-text-muted)] mb-1">Estado de cuenta</p>
        {saldos.length === 0 ? (
          <div className="flex items-center gap-2"><CheckCircle2 size={18} className="text-emerald-500" /><span className="font-semibold text-[var(--color-text)]">Al día</span></div>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-1"><AlertTriangle size={16} className="text-amber-500" /><span className="text-sm text-[var(--color-text-muted)]">{d.facturasPendientes} factura{d.facturasPendientes !== 1 ? 's' : ''} pendiente{d.facturasPendientes !== 1 ? 's' : ''}</span></div>
            {saldos.map(([cur, v]) => <p key={cur} className="text-xl font-bold text-[var(--color-text)]">{money(v, cur)}</p>)}
          </>
        )}
        <p className="text-xs text-[var(--color-text-muted)] mt-4 mb-1">Servicios</p>
        {d.servicios.length === 0 ? <p className="text-sm text-[var(--color-text-subtle)]">Sin servicios cargados.</p> : (
          <div className="space-y-1.5">
            {d.servicios.map((s) => (
              <div key={s.id} className="flex justify-between text-sm">
                <span className="text-[var(--color-text)]">{s.nombre}<span className="text-[var(--color-text-subtle)]"> · {s.cicloLabel}{s.estado === 'PAUSADO' ? ' · pausado' : ''}</span></span>
                <span className="font-medium text-[var(--color-text)]">{money(s.monto, s.moneda)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Facturas */}
      <div className="surface rounded-2xl p-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-subtle)] mb-3 flex items-center gap-1.5"><Receipt size={13} /> Facturas</p>
        {d.facturas.length === 0 ? <p className="text-sm text-[var(--color-text-subtle)]">Sin facturas.</p> : (
          <div className="space-y-2">
            {d.facturas.map((f) => {
              const st = STATUS[f.status] ?? { label: f.status, color: '#94a3b8' }
              return (
                <div key={f.id} className="flex items-start justify-between gap-3 py-2 border-b border-[var(--color-border)] last:border-0">
                  <div>
                    <p className="text-sm text-[var(--color-text)]">{f.concepto}</p>
                    <p className="text-xs text-[var(--color-text-subtle)]">{f.numero} · vence {new Date(f.dueDate).toLocaleDateString('es-AR')}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-[var(--color-text)]">{money(f.amount, f.currency)}</p>
                    <span className="text-[11px] font-medium" style={{ color: st.color }}>{st.label}</span>
                    {f.payToken && (f.status === 'PENDING' || f.status === 'OVERDUE') && <p className="text-[10px] text-[var(--color-primary)]">botón "Pagar" visible</p>}
                    {f.payToken && f.status === 'PAID' && <p className="text-[10px] text-[var(--color-text-subtle)]">"Ver comprobante" visible</p>}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Soporte */}
      <div className="surface rounded-2xl p-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-subtle)] mb-3 flex items-center gap-1.5"><LifeBuoy size={13} /> Soporte</p>
        {d.tickets.length === 0 ? <p className="text-sm text-[var(--color-text-subtle)]">El cliente no abrió ningún ticket.</p> : (
          <div className="space-y-1.5">
            {d.tickets.map((t) => (
              <div key={t.id} className="flex justify-between text-sm">
                <span className="text-[var(--color-text)]">#{String(t.number).padStart(4, '0')} · {t.title}</span>
                <span className="text-xs text-[var(--color-text-muted)]">{TICKET_STATUS[t.status] ?? t.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
