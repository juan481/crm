'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2, Receipt, LifeBuoy, CheckCircle2, AlertTriangle } from 'lucide-react'

interface Resumen {
  empresaName: string
  servicios: { id: string; nombre: string; monto: number; moneda: string; cicloLabel: string; estado: string; incluyeMonitoreo: boolean }[]
  facturasPendientes: number
  saldoPorMoneda: Record<string, number>
}

function money(n: number, cur: string) {
  try { return new Intl.NumberFormat('es-AR', { style: 'currency', currency: cur, minimumFractionDigits: 2 }).format(n) }
  catch { return `${cur} ${n.toFixed(2)}` }
}

export default function PortalInicioPage() {
  const [data, setData] = useState<Resumen | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/portal/resumen').then((r) => r.json()).then((j) => setData(j.data)).catch(() => {}).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="animate-spin" style={{ color: 'var(--color-text-subtle)' }} /></div>
  if (!data) return <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No pudimos cargar tu información.</p>

  const saldos = Object.entries(data.saldoPorMoneda).filter(([, v]) => v > 0)
  const alDia = saldos.length === 0

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>Hola</h1>
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{data.empresaName}</p>
      </div>

      <div className="rounded-2xl p-5" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Estado de cuenta</p>
        {alDia ? (
          <div className="flex items-center gap-2">
            <CheckCircle2 size={20} style={{ color: '#10b981' }} />
            <span className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>Estás al día</span>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={18} style={{ color: '#f59e0b' }} />
              <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                {data.facturasPendientes} factura{data.facturasPendientes !== 1 ? 's' : ''} pendiente{data.facturasPendientes !== 1 ? 's' : ''}
              </span>
            </div>
            {saldos.map(([cur, v]) => (
              <p key={cur} className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>{money(v, cur)}</p>
            ))}
            <Link href="/portal/facturas" className="inline-flex items-center gap-1.5 mt-3 text-sm font-semibold px-4 py-2 rounded-xl text-white" style={{ background: 'var(--color-primary)' }}>
              <Receipt size={14} /> Ver y pagar
            </Link>
          </>
        )}
      </div>

      <div>
        <p className="text-xs font-medium mb-2" style={{ color: 'var(--color-text-muted)' }}>Tus servicios</p>
        {data.servicios.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--color-text-subtle)' }}>No hay servicios cargados.</p>
        ) : (
          <div className="space-y-2">
            {data.servicios.map((s) => (
              <div key={s.id} className="rounded-xl p-4 flex items-center justify-between" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>{s.nombre}</p>
                  <p className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>
                    {s.cicloLabel}{s.incluyeMonitoreo ? ' · con monitoreo' : ''}{s.estado === 'PAUSADO' ? ' · pausado' : ''}
                  </p>
                </div>
                <span className="text-sm font-semibold shrink-0 ml-3" style={{ color: 'var(--color-text)' }}>{money(s.monto, s.moneda)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <Link href="/portal/soporte" className="flex items-center gap-2 text-sm px-4 py-3 rounded-xl" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}>
        <LifeBuoy size={16} /> ¿Necesitás ayuda? Abrí un ticket de soporte
      </Link>
    </div>
  )
}
