'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Boxes, History, AlertTriangle, PackageX, TrendingDown, Warehouse } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { useModuleAccess } from '@/hooks/use-module-access'
import { formatMoneyExact } from '@/lib/utils'
import { StockActualTab } from '@/components/stock/stock-actual-tab'
import { MovimientosTab } from '@/components/stock/movimientos-tab'

type Tab = 'STOCK' | 'MOVIMIENTOS' | 'ALERTAS'

interface Resumen {
  productosTrackeados: number
  bajoMinimo: number
  sinStock: number
  valorInventario: Record<string, number>
}

export default function StockPage() {
  const [tab, setTab] = useState<Tab>('STOCK')
  const allowed = useModuleAccess('stock')

  // El resumen de las tarjetas se pide una vez acá (lo comparte el header) y
  // la pestaña Stock actual reusa la misma queryKey para su tabla.
  const { data: resumenData } = useQuery<{ resumen: Resumen }>({
    queryKey: ['stock-resumen-cards'],
    queryFn: async () => (await fetch('/api/stock?limit=1')).json(),
    enabled: allowed === true,
    staleTime: 30_000,
  })
  const resumen = resumenData?.resumen

  if (allowed === undefined) {
    return <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}</div>
  }

  if (allowed === false) {
    return (
      <div className="surface rounded-2xl p-6 flex items-center gap-3 text-sm text-[var(--color-text-muted)]">
        <AlertTriangle size={16} className="text-amber-500" />
        No tenés permiso para ver el Depósito. Pedile a un administrador que te habilite
        &quot;Depósito · Stock&quot; en Configuración → Permisos.
      </div>
    )
  }

  const valorInventario = resumen?.valorInventario ?? {}
  const valorStr = Object.keys(valorInventario).length
    ? Object.entries(valorInventario).map(([cur, val]) => formatMoneyExact(val, cur)).join(' · ')
    : '—'

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl surface flex items-center justify-center shrink-0">
          <Warehouse size={18} style={{ color: 'var(--color-primary)' }} />
        </div>
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>Depósito</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            Stock físico propio, movimientos e historial inmutable.
          </p>
        </div>
      </div>

      {/* Tarjetas de resumen */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card icon={<Boxes size={15} />} label="Productos con stock" value={resumen ? String(resumen.productosTrackeados) : '—'} />
        <Card icon={<TrendingDown size={15} />} label="Bajo mínimo" value={resumen ? String(resumen.bajoMinimo) : '—'}
          tone={resumen && resumen.bajoMinimo > 0 ? 'warn' : undefined} />
        <Card icon={<PackageX size={15} />} label="Sin stock" value={resumen ? String(resumen.sinStock) : '—'}
          tone={resumen && resumen.sinStock > 0 ? 'danger' : undefined} />
        <Card icon={<Warehouse size={15} />} label="Valor a costo" value={valorStr} />
      </div>

      {/* Tabs */}
      <div className="flex rounded-xl overflow-hidden p-0.5 w-fit"
        style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)' }}>
        {([
          { type: 'STOCK' as Tab,       label: 'Stock actual', icon: <Boxes size={14} /> },
          { type: 'MOVIMIENTOS' as Tab, label: 'Movimientos',  icon: <History size={14} /> },
          { type: 'ALERTAS' as Tab,     label: 'Alertas',      icon: <AlertTriangle size={14} /> },
        ]).map((t) => (
          <button key={t.type} onClick={() => setTab(t.type)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
              tab === t.type ? 'gradient-bg text-white shadow-sm' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
            }`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === 'STOCK' && <StockActualTab />}
      {tab === 'MOVIMIENTOS' && <MovimientosTab />}
      {tab === 'ALERTAS' && (
        <div className="surface rounded-2xl p-10 text-center">
          <AlertTriangle size={32} className="mx-auto mb-3 opacity-25" />
          <p className="font-medium" style={{ color: 'var(--color-text)' }}>Todavía no hay alertas de costo</p>
          <p className="text-xs mt-1 max-w-sm mx-auto" style={{ color: 'var(--color-text-muted)' }}>
            Cuando cargues una factura de compra o el catálogo del proveedor cambie un costo,
            las diferencias van a aparecer acá para revisar y aplicar.
          </p>
        </div>
      )}
    </div>
  )
}

function Card({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone?: 'warn' | 'danger' }) {
  const color = tone === 'danger' ? '#ef4444' : tone === 'warn' ? '#f59e0b' : 'var(--color-text)'
  return (
    <div className="surface rounded-2xl p-4">
      <div className="flex items-center gap-1.5 text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
        {icon} {label}
      </div>
      <p className="text-xl font-bold mt-1.5 truncate" style={{ color }} title={value}>{value}</p>
    </div>
  )
}
