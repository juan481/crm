'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Fingerprint, Trash2, Pencil, AlertTriangle, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { Pagination } from '@/components/ui/table'
import { LegajoForm } from '@/components/legajos/legajo-form'
import { daysUntilDateOnly, fmtDateOnly as fmtDate } from '@/lib/timezone'
import { useAuthStore } from '@/store/auth-store'
import toast from 'react-hot-toast'

interface Vigilador {
  id: string
  nombre: string
  apellido: string
  dni: string
  fechaIngreso: string | null
  carnetVencimiento: string | null
  art: string | null
  lugarTrabajo: string | null
  notas: string | null
  activo: boolean
}

// Legajo de vigiladores (ABBA FISICA, reestructuración 2026-10) — mismo
// patrón que Contactos (listado + ficha + form reusable en modal/detalle),
// sin importación masiva (no se pidió).
export default function LegajosPage() {
  const router = useRouter()
  const qc = useQueryClient()
  const { user } = useAuthStore()

  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1) }, 300)
    return () => clearTimeout(t)
  }, [searchInput])

  const [showForm, setShowForm] = useState(false)
  const [editVigilador, setEditVigilador] = useState<Vigilador | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const canDelete = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN'

  const { data, isLoading, isError } = useQuery({
    queryKey: ['legajos', search, page],
    queryFn: async () => {
      const p = new URLSearchParams({ page: String(page), limit: '20' })
      if (search.length >= 2) p.set('search', search)
      const res = await fetch(`/api/legajos?${p}`)
      if (!res.ok) throw new Error('Error al cargar legajos')
      return res.json()
    },
    staleTime: 30_000,
  })

  const vigiladores: Vigilador[] = data?.data ?? []
  const total: number = data?.total ?? 0
  const totalPages: number = data?.totalPages ?? 1

  const handleDelete = async () => {
    if (!deleteId) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/legajos/${deleteId}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'Error al eliminar'); return }
      toast.success('Legajo eliminado')
      qc.invalidateQueries({ queryKey: ['legajos'] })
      setDeleteId(null)
    } catch { toast.error('Error de conexión') } finally { setDeleting(false) }
  }

  // Comparación por día-calendario (ver daysUntilDateOnly) — comparar el
  // ISO crudo contra Date.now() corría el resultado ~3hs por el huso
  // horario, desacordando con el cron (que sí es Argentina-aware) cerca
  // del borde del día (bug real encontrado en code-review). Un solo
  // cálculo por fila, no uno por cada chequeo (vencido/por vencer).
  const carnetStatus = (iso: string | null): 'vencido' | 'por-vencer' | 'ok' | null => {
    if (!iso) return null
    const dias = daysUntilDateOnly(iso)
    if (dias < 0) return 'vencido'
    if (dias <= 30) return 'por-vencer'
    return 'ok'
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>Legajos</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            Control de personal de seguridad física — documentación, carnet y turnos
          </p>
        </div>
        <Button leftIcon={<Plus size={16} />} onClick={() => setShowForm(true)}>
          Nuevo legajo
        </Button>
      </div>

      <div className="max-w-sm">
        <Input
          placeholder="Buscar por nombre, apellido, DNI..."
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          leftIcon={<Search size={15} />}
        />
      </div>

      {isError && (
        <div className="flex items-center gap-3 p-4 rounded-xl text-sm" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
          <AlertTriangle size={16} />
          Error al cargar los datos. Intentá de nuevo.
        </div>
      )}

      <div className="rounded-2xl overflow-x-auto" style={{ border: '1px solid var(--color-border)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: 'var(--color-surface-raised)', borderBottom: '1px solid var(--color-border)' }}>
              <th className="px-4 py-3 text-left font-semibold" style={{ color: 'var(--color-text-muted)' }}>Vigilador</th>
              <th className="px-4 py-3 text-left font-semibold hidden sm:table-cell" style={{ color: 'var(--color-text-muted)' }}>DNI</th>
              <th className="px-4 py-3 text-left font-semibold hidden md:table-cell" style={{ color: 'var(--color-text-muted)' }}>Lugar de trabajo</th>
              <th className="px-4 py-3 text-left font-semibold" style={{ color: 'var(--color-text-muted)' }}>Carnet vence</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  {Array.from({ length: 5 }).map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 rounded animate-pulse" style={{ background: 'var(--color-border)', width: j === 0 ? '55%' : '40%' }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : vigiladores.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center" style={{ color: 'var(--color-text-muted)' }}>
                  <Fingerprint size={32} className="mx-auto mb-3 opacity-30" />
                  <p className="font-medium">No hay legajos aún</p>
                  <p className="text-xs mt-1">Agregá el primer vigilador para empezar a llevar su legajo</p>
                </td>
              </tr>
            ) : (
              vigiladores.map(v => {
                const status = carnetStatus(v.carnetVencimiento)
                return (
                <tr key={v.id} style={{ borderBottom: '1px solid var(--color-border)', opacity: v.activo ? 1 : 0.5 }}>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => router.push(`/legajos/${v.id}`)}
                      className="font-medium hover:underline text-left"
                      style={{ color: 'var(--color-text)' }}
                    >
                      {v.apellido}, {v.nombre}
                    </button>
                    {!v.activo && <span className="ml-2 text-xs" style={{ color: 'var(--color-text-subtle)' }}>(inactivo)</span>}
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell" style={{ color: 'var(--color-text-muted)' }}>{v.dni}</td>
                  <td className="px-4 py-3 hidden md:table-cell" style={{ color: 'var(--color-text-muted)' }}>{v.lugarTrabajo ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1.5" style={{ color: status === 'vencido' ? '#ef4444' : status === 'por-vencer' ? '#f59e0b' : 'var(--color-text-muted)' }}>
                      <Calendar size={12} /> {fmtDate(v.carnetVencimiento)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setEditVigilador(v)}
                        className="p-1.5 rounded-lg transition-colors hover:bg-[var(--color-primary)]/10 hover:text-[var(--color-primary)]"
                        style={{ color: 'var(--color-text-muted)' }}
                        title="Editar"
                      >
                        <Pencil size={14} />
                      </button>
                      {canDelete && (
                        <button
                          onClick={() => setDeleteId(v.id)}
                          className="p-1.5 rounded-lg transition-colors hover:bg-red-500/10 hover:text-red-400"
                          style={{ color: 'var(--color-text-muted)' }}
                          title="Eliminar"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <Pagination page={page} totalPages={totalPages} total={total} limit={20} onPageChange={setPage} />
      )}

      <Modal open={showForm} onClose={() => setShowForm(false)} title="Nuevo legajo" size="md">
        <LegajoForm onSuccess={() => { setShowForm(false); qc.invalidateQueries({ queryKey: ['legajos'] }) }} />
      </Modal>

      <Modal open={!!editVigilador} onClose={() => setEditVigilador(null)} title="Editar legajo" size="md">
        {editVigilador && (
          <LegajoForm
            vigilador={editVigilador}
            onSuccess={() => { setEditVigilador(null); qc.invalidateQueries({ queryKey: ['legajos'] }) }}
          />
        )}
      </Modal>

      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Eliminar legajo" size="sm">
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          Esto borra el legajo y todos sus documentos, cursos y turnos cargados. No se puede deshacer.
        </p>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="ghost" onClick={() => setDeleteId(null)}>Cancelar</Button>
          <Button variant="danger" onClick={handleDelete} loading={deleting}>Eliminar</Button>
        </div>
      </Modal>
    </div>
  )
}
