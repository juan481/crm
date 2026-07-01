'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Search, Building2, Users, Globe, MapPin, UserCheck } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Pagination } from '@/components/ui/table'
import type { Empresa } from '@/types'

export default function ClientesPage() {
  const router = useRouter()
  const [searchInput, setSearchInput] = useState('')
  const [search,      setSearch]      = useState('')
  const [page,        setPage]        = useState(1)

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1) }, 300)
    return () => clearTimeout(t)
  }, [searchInput])

  const { data, isLoading } = useQuery({
    queryKey: ['empresas-clientes', search, page],
    queryFn: async () => {
      const p = new URLSearchParams({ isCliente: 'true', page: String(page), limit: '20' })
      if (search.length >= 2) p.set('search', search)
      const res = await fetch(`/api/empresas?${p}`)
      if (!res.ok) throw new Error('Error al cargar')
      return res.json()
    },
    staleTime: 30_000,
  })

  const clientes: Empresa[] = data?.data ?? []
  const total: number       = data?.total ?? 0
  const totalPages: number  = data?.totalPages ?? 1

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>Clientes</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
          Empresas marcadas como cliente · {total} en total
        </p>
      </div>

      <div className="max-w-sm">
        <Input
          placeholder="Buscar cliente..."
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          leftIcon={<Search size={15} />}
        />
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: 'var(--color-surface-raised)', borderBottom: '1px solid var(--color-border)' }}>
              <th className="px-4 py-3 text-left font-semibold" style={{ color: 'var(--color-text-muted)' }}>Empresa</th>
              <th className="px-4 py-3 text-left font-semibold hidden md:table-cell" style={{ color: 'var(--color-text-muted)' }}>Actividad</th>
              <th className="px-4 py-3 text-left font-semibold hidden lg:table-cell" style={{ color: 'var(--color-text-muted)' }}>Localidad</th>
              <th className="px-4 py-3 text-left font-semibold hidden lg:table-cell" style={{ color: 'var(--color-text-muted)' }}>Web</th>
              <th className="px-4 py-3 text-center font-semibold" style={{ color: 'var(--color-text-muted)' }}>Contactos</th>
              <th className="px-4 py-3 text-left font-semibold hidden xl:table-cell" style={{ color: 'var(--color-text-muted)' }}>Cliente desde</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 rounded animate-pulse" style={{ background: 'var(--color-border)', width: j === 0 ? '60%' : '40%' }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : clientes.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-16 text-center" style={{ color: 'var(--color-text-muted)' }}>
                  <UserCheck size={36} className="mx-auto mb-3 opacity-25" />
                  <p className="font-medium text-base">No hay clientes aún</p>
                  <p className="text-xs mt-1 max-w-xs mx-auto">
                    Entrá a una empresa en el directorio y marcala como cliente con el botón correspondiente.
                  </p>
                </td>
              </tr>
            ) : (
              clientes.map(e => (
                <tr
                  key={e.id}
                  className="cursor-pointer transition-colors hover:bg-[var(--color-surface-raised)]"
                  style={{ borderBottom: '1px solid var(--color-border)' }}
                  onClick={() => router.push(`/clientes/${e.id}`)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                        style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)' }}>
                        <Building2 size={14} style={{ color: 'var(--color-primary)' }} />
                      </div>
                      <span className="font-medium" style={{ color: 'var(--color-text)' }}>{e.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell" style={{ color: 'var(--color-text-muted)' }}>{e.activity ?? '—'}</td>
                  <td className="px-4 py-3 hidden lg:table-cell" style={{ color: 'var(--color-text-muted)' }}>
                    {e.city && e.province
                      ? <span className="flex items-center gap-1"><MapPin size={12} /> {e.city}, {e.province}</span>
                      : e.city || e.province || '—'}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    {e.website
                      ? <a href={e.website.startsWith('http') ? e.website : `https://${e.website}`}
                           target="_blank" rel="noopener noreferrer"
                           onClick={ev => ev.stopPropagation()}
                           className="flex items-center gap-1 hover:underline" style={{ color: 'var(--color-primary)' }}>
                          <Globe size={12} /> {e.website.replace(/^https?:\/\//, '')}
                        </a>
                      : <span style={{ color: 'var(--color-text-muted)' }}>—</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full"
                      style={{ background: 'var(--color-surface-raised)', color: 'var(--color-text-muted)' }}>
                      <Users size={11} /> {e._count?.contactos ?? 0}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden xl:table-cell text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    {e.clienteDesde
                      ? new Date(e.clienteDesde).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' })
                      : '—'}
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
