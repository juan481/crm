'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Truck, Plus, AlertTriangle, PackageCheck, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Modal } from '@/components/ui/modal'
import { Pagination } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { useModuleAccess } from '@/hooks/use-module-access'
import { formatMoneyExact } from '@/lib/utils'
import { EntregaForm } from '@/components/entregas/entrega-form'
import { EntregaDetail } from '@/components/entregas/entrega-detail'

const ESTADO_OPTS = [
  { value: '', label: 'Todos los estados' },
  { value: 'BORRADOR', label: 'Borrador' },
  { value: 'ENTREGADA', label: 'Entregada' },
  { value: 'ANULADA', label: 'Anulada' },
]
const ESTADO_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  BORRADOR:  { label: 'Preparando', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  ENTREGADA: { label: 'Entregada',  color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  ANULADA:   { label: 'Anulada',    color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
}

export default function EntregasPage() {
  const qc = useQueryClient()
  const allowed = useModuleAccess('entregas')
  const searchParams = useSearchParams()

  const [estado, setEstado] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [formOpen, setFormOpen] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(searchParams.get('id'))

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1) }, 300)
    return () => clearTimeout(t)
  }, [searchInput])
  useEffect(() => { setPage(1) }, [estado])

  const { data, isLoading } = useQuery({
    queryKey: ['entregas', estado, search, page],
    queryFn: async () => {
      const p = new URLSearchParams({ page: String(page), limit: '30' })
      if (estado) p.set('estado', estado)
      if (search.length >= 2) p.set('search', search)
      const res = await fetch(`/api/entregas?${p}`)
      if (!res.ok) throw new Error('Error al cargar')
      return res.json()
    },
    enabled: allowed === true,
    staleTime: 15_000,
  })

  const rows = data?.data ?? []
  const total = data?.total ?? 0
  const totalPages = data?.totalPages ?? 1
  const refetch = () => qc.invalidateQueries({ queryKey: ['entregas'] })

  if (allowed === undefined) return <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div>
  if (allowed === false) {
    return (
      <div className="surface rounded-2xl p-6 flex items-center gap-3 text-sm text-[var(--color-text-muted)]">
        <AlertTriangle size={16} className="text-amber-500" />
        No tenés permiso para ver Entregas. Pedile a un administrador que te habilite &quot;Depósito · Entregas&quot; en Configuración → Permisos.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl surface flex items-center justify-center shrink-0">
            <Truck size={18} style={{ color: 'var(--color-primary)' }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>Entregas</h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
              Remitos internos — material que sale del depósito a una obra o mostrador. Descuenta el stock.
            </p>
          </div>
        </div>
        <Button onClick={() => setFormOpen(true)} leftIcon={<Plus size={15} />}>Nueva entrega</Button>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="w-52"><Input placeholder="Buscar por quién retira, motivo..." value={searchInput} onChange={(e) => setSearchInput(e.target.value)} /></div>
        <div className="w-48"><Select value={estado} onChange={(e) => setEstado(e.target.value)} options={ESTADO_OPTS} /></div>
      </div>

      <div className="rounded-2xl overflow-x-auto" style={{ border: '1px solid var(--color-border)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: 'var(--color-surface-raised)', borderBottom: '1px solid var(--color-border)' }}>
              <th className="px-4 py-3 text-left font-semibold" style={{ color: 'var(--color-text-muted)' }}>Entrega</th>
              <th className="px-4 py-3 text-left font-semibold hidden md:table-cell" style={{ color: 'var(--color-text-muted)' }}>Retira</th>
              <th className="px-4 py-3 text-left font-semibold hidden sm:table-cell" style={{ color: 'var(--color-text-muted)' }}>Fecha</th>
              <th className="px-4 py-3 text-right font-semibold" style={{ color: 'var(--color-text-muted)' }}>Unidades</th>
              <th className="px-4 py-3 text-center font-semibold" style={{ color: 'var(--color-text-muted)' }}>Estado</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center" style={{ color: 'var(--color-text-muted)' }}>Cargando...</td></tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-14 text-center">
                  <PackageCheck size={32} className="mx-auto mb-3 opacity-25" />
                  <p className="font-medium" style={{ color: 'var(--color-text)' }}>{estado || search ? 'Sin resultados' : 'Todavía no hay entregas'}</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                    Creá una entrega manual, o preparala desde una cotización aceptada.
                  </p>
                </td>
              </tr>
            ) : rows.map((e: any) => {
              const eb = ESTADO_BADGE[e.estado] ?? ESTADO_BADGE.BORRADOR
              return (
                <tr key={e.id} onClick={() => setDetailId(e.id)}
                  className="cursor-pointer transition-colors hover:bg-[var(--color-surface-raised)]" style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td className="px-4 py-3">
                    <div className="font-medium flex items-center gap-1.5" style={{ color: 'var(--color-text)' }}>
                      {e.numero ? `#${e.numero}` : 'Borrador'}
                      {e.cotizacionId && <FileText size={11} style={{ color: 'var(--color-text-subtle)' }} />}
                    </div>
                    <div className="text-[11px]" style={{ color: 'var(--color-text-subtle)' }}>
                      {e.motivo || (e.empresa?.name ?? 'Entrega')} · {e.itemsCount} ítem{e.itemsCount !== 1 ? 's' : ''}
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-xs" style={{ color: 'var(--color-text-muted)' }}>{e.retiradoPor}</td>
                  <td className="px-4 py-3 hidden sm:table-cell text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    {new Date(e.fecha).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: '2-digit' })}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold" style={{ color: 'var(--color-text)' }}>{e.unidades}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ background: eb.bg, color: eb.color }}>{eb.label}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && <Pagination page={page} totalPages={totalPages} total={total} limit={30} onPageChange={setPage} />}

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title="Nueva entrega" size="lg">
        {formOpen && <EntregaForm onClose={() => setFormOpen(false)} onSaved={(id) => { setFormOpen(false); refetch(); setDetailId(id) }} />}
      </Modal>

      <Modal open={!!detailId} onClose={() => setDetailId(null)} title="Entrega" size="lg">
        {detailId && <EntregaDetail entregaId={detailId} onChanged={refetch} onDeleted={() => { setDetailId(null); refetch() }} />}
      </Modal>
    </div>
  )
}
