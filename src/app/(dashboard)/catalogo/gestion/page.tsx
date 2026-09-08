'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Boxes, Wrench, ArrowLeft, AlertTriangle } from 'lucide-react'
import { SimpleProductsManager } from '@/components/configuracion/simple-products-manager'
import { KitsManager } from '@/components/configuracion/kits-manager'
import { ServicesManager } from '@/components/configuracion/services-manager'
import { Skeleton } from '@/components/ui/skeleton'
import { useModuleAccess } from '@/hooks/use-module-access'

type Tab = 'PRODUCTOS' | 'SERVICIOS'

// Gestión de catálogo accesible fuera de Configuración — para que un rol como
// Técnico, al que un Super Admin le habilitó "Catálogo · cargar productos y
// stock" en el panel de Permisos, pueda cargar/editar productos y ajustar
// stock sin entrar a Configuración (que sigue siendo sólo ADMIN). NO incluye
// el sync con el Google Sheet del proveedor — eso queda en /configuracion/catalogo.
export default function CatalogoGestionPage() {
  const [tab, setTab] = useState<Tab>('PRODUCTOS')
  const allowed = useModuleAccess('catalogo-gestion')

  if (allowed === undefined) {
    return <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}</div>
  }

  if (allowed === false) {
    return (
      <div className="surface rounded-2xl p-6 flex items-center gap-3 text-sm text-[var(--color-text-muted)]">
        <AlertTriangle size={16} className="text-amber-500" />
        No tenés permiso para cargar productos ni stock. Pedile a un administrador que te habilite
        &quot;Catálogo · cargar productos y stock&quot; en Configuración → Permisos.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/catalogo" className="w-9 h-9 rounded-xl surface flex items-center justify-center hover:border-[var(--color-border-strong)]">
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>Gestionar catálogo</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            Cargá y editá productos propios, kits y servicios, y ajustá el stock.
          </p>
        </div>
      </div>

      <div className="flex rounded-xl overflow-hidden p-0.5 w-fit"
        style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)' }}>
        {([
          { type: 'PRODUCTOS' as Tab, label: 'Productos', icon: <Boxes size={14} /> },
          { type: 'SERVICIOS' as Tab, label: 'Servicios', icon: <Wrench size={14} /> },
        ]).map((t) => (
          <button key={t.type} onClick={() => setTab(t.type)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
              tab === t.type ? 'gradient-bg text-white shadow-sm' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
            }`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === 'PRODUCTOS' ? (
        <div className="space-y-8">
          <SimpleProductsManager />
          <div className="h-px" style={{ background: 'var(--color-border)' }} />
          <KitsManager />
        </div>
      ) : (
        <ServicesManager />
      )}
    </div>
  )
}
