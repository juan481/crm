'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Search, Building2, Truck, MapPin, CreditCard } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Pagination } from '@/components/ui/table'
import type { Empresa } from '@/types'

// Calcada de /clientes — misma tabla, mismo endpoint (GET /api/empresas), sólo
// que filtra por ?esProveedor=true. Un proveedor es una Empresa del directorio
// con el flag `esProveedor`; se marca desde el formulario de empresa.
export default function ProveedoresPage() {
  const router = useRouter()
  const [searchInput, setSearchInput] = useState('')
  const [search,      setSearch]      = useState('')
  const [page,        setPage]        = useState(1)

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1) }, 300)
    return () => clearTimeout(t)
  }, [searchInput])

  const { data, isLoading } = useQuery({
    queryKey: ['empresas-proveedores', search, page],
    queryFn: async () => {
      const p = new URLSearchParams({ esProveedor: 'true', page: String(page), limit: '20' })
      if (search.length >= 2) p.set('search', search)
      const res = await fetch(`/api/empresas?${p}`)
      if (!res.ok) throw new Error('Error al cargar')
      return res.json()
    },
    staleTime: 30_000,
  })

  const proveedores: Empresa[] = data?.data ?? []
  const total: number       = data?.total ?? 0
  const totalPages: number  = data?.totalPages ?? 1

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>Proveedores</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
          Empresas del directorio marcadas como proveedor · {total} en total
        </p>
      </div>

      <div className="max-w-sm">
        <Input
          placeholder="Buscar proveedor..."
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          leftIcon={<Search size={15} />}
        />
      </div>

      <div className="rounded-2xl overflow-x-auto" style={{ border: '1px solid var(--color-border)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: 'var(--color-surface-raised)', borderBottom: '1px solid var(--color-border)' }}>
              <th className="px-4 py-3 text-left font-semibold" style={{ color: 'var(--color-text-muted)' }}>Proveedor</th>
              <th className="px-4 py-3 text-left font-semibold hidden md:table-cell" style={{ color: 'var(--color-text-muted)' }}>Actividad</th>
              <th className="px-4 py-3 text-left font-semibold hidden lg:table-cell" style={{ color: 'var(--color-text-muted)' }}>Localidad</th>
              <th className="px-4 py-3 text-left font-semibold hidden lg:table-cell" style={{ color: 'var(--color-text-muted)' }}>Pago</th>
              <th className="px-4 py-3 text-left font-semibold hidden xl:table-cell" style={{ color: 'var(--color-text-muted)' }}>CUIT</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  {Array.from({ length: 5 }).map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 rounded animate-pulse" style={{ background: 'var(--color-border)', width: j === 0 ? '60%' : '40%' }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : proveedores.length === 0 && total === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-16 text-center" style={{ color: 'var(--color-text-muted)' }}>
                  <Truck size={36} className="mx-auto mb-3 opacity-25" />
                  <p className="font-medium text-base">No hay proveedores aún</p>
                  <p className="text-xs mt-1 mb-4 max-w-xs mx-auto">
                    Marcá una empresa del directorio como proveedor (desde su ficha) para que aparezca acá.
                  </p>
                  <Button size="sm" onClick={() => router.push('/empresas')}>
                    <Building2 size={14} /> Ver empresas
                  </Button>
                </td>
              </tr>
            ) : proveedores.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-16 text-center" style={{ color: 'var(--color-text-muted)' }}>
                  <Search size={36} className="mx-auto mb-3 opacity-25" />
                  <p className="font-medium text-base">Sin resultados</p>
                  <p className="text-xs mt-1">Probá con otra búsqueda</p>
                </td>
              </tr>
            ) : (
              proveedores.map(e => (
                <tr
                  key={e.id}
                  className="cursor-pointer transition-colors hover:bg-[var(--color-surface-raised)]"
                  style={{ borderBottom: '1px solid var(--color-border)' }}
                  onClick={() => router.push(`/empresas/${e.id}`)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                        style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)' }}>
                        <Truck size={14} style={{ color: 'var(--color-primary)' }} />
                      </div>
                      <div className="min-w-0">
                        <span className="font-medium block truncate" style={{ color: 'var(--color-text)' }}>{e.name}</span>
                        {e.isCliente && (
                          <span className="text-[11px]" style={{ color: 'var(--color-text-subtle)' }}>También cliente</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell" style={{ color: 'var(--color-text-muted)' }}>{e.activity ?? '—'}</td>
                  <td className="px-4 py-3 hidden lg:table-cell" style={{ color: 'var(--color-text-muted)' }}>
                    {e.city && e.province
                      ? <span className="flex items-center gap-1"><MapPin size={12} /> {e.city}, {e.province}</span>
                      : e.city || e.province || '—'}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell" style={{ color: 'var(--color-text-muted)' }}>
                    {e.cbu || e.alias
                      ? <span className="flex items-center gap-1"><CreditCard size={12} /> {e.alias || `CBU ${String(e.cbu).slice(0, 6)}…`}</span>
                      : '—'}
                  </td>
                  <td className="px-4 py-3 hidden xl:table-cell text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    {e.cuit ?? '—'}
                  </td>
                </tr>
              ))
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
