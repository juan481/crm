'use client'

import { useState } from 'react'
import { Boxes, Wrench } from 'lucide-react'
import { SimpleProductsManager } from '@/components/configuracion/simple-products-manager'
import { SupplierCatalogManager } from '@/components/configuracion/supplier-catalog-manager'
import { ServicesManager } from '@/components/configuracion/services-manager'

type Tab = 'PRODUCTOS' | 'SERVICIOS'

// Punto único de administración de todo lo que se puede vender — antes
// repartido en 3 pantallas sin conexión entre sí (/configuracion/productos,
// /configuracion/servicios, y /configuracion/catalogo huérfano, sin link
// en ningún lado del menú). Misma estructura de pestañas que la vidriera
// pública (/catalogo) y el paso 1 del Cotizador, para que sea el mismo
// mapa mental en todos lados.
export default function ConfiguracionCatalogoPage() {
  const [tab, setTab] = useState<Tab>('PRODUCTOS')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>Catálogo</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
          Administrá todo lo que se vende: productos propios, el catálogo del proveedor y los servicios
        </p>
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
          <SupplierCatalogManager />
        </div>
      ) : (
        <ServicesManager />
      )}
    </div>
  )
}
