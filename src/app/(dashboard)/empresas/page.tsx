'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Upload, Building2, Users, Globe, MapPin, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { EmpresaForm } from '@/components/directorio/empresa-form'
import { Pagination } from '@/components/ui/table'
import { useAuthStore } from '@/store/auth-store'
import type { Empresa } from '@/types'
import toast from 'react-hot-toast'

export default function EmpresasPage() {
  const router     = useRouter()
  const qc         = useQueryClient()
  const { user }   = useAuthStore()
  const fileRef    = useRef<HTMLInputElement>(null)

  const [search,     setSearch]     = useState('')
  const [page,       setPage]       = useState(1)
  const [showForm,   setShowForm]   = useState(false)
  const [importing,  setImporting]  = useState(false)
  const [deleteId,   setDeleteId]   = useState<string | null>(null)
  const [deleting,   setDeleting]   = useState(false)

  const canManage = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN'

  const { data, isLoading } = useQuery({
    queryKey: ['empresas', search, page],
    queryFn: async () => {
      const p = new URLSearchParams({ page: String(page), limit: '20' })
      if (search.length >= 2) p.set('search', search)
      const res = await fetch(`/api/empresas?${p}`)
      if (!res.ok) throw new Error('Error al cargar empresas')
      return res.json()
    },
    staleTime: 30_000,
  })

  const empresas: Empresa[] = data?.data ?? []
  const total: number       = data?.total ?? 0
  const totalPages: number  = data?.totalPages ?? 1

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    const fd = new FormData()
    fd.append('file', file)
    try {
      const res  = await fetch('/api/empresas/importar', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error); return }
      toast.success(json.message)
      qc.invalidateQueries({ queryKey: ['empresas'] })
    } catch {
      toast.error('Error al importar')
    } finally {
      setImporting(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/empresas/${deleteId}`, { method: 'DELETE' })
      if (res.ok) { toast.success('Empresa eliminada'); qc.invalidateQueries({ queryKey: ['empresas'] }) }
      else { const j = await res.json(); toast.error(j.error) }
    } catch { toast.error('Error de conexión') }
    finally { setDeleting(false); setDeleteId(null) }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>Empresas</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            Directorio de empresas y sus técnicos vinculados
          </p>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} />
            <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={importing}>
              <Upload size={15} />
              {importing ? 'Importando...' : 'Importar Excel'}
            </Button>
            <Button onClick={() => setShowForm(true)}>
              <Plus size={15} /> Nueva empresa
            </Button>
          </div>
        )}
      </div>

      {/* Search */}
      <div className="max-w-sm">
        <Input
          placeholder="Buscar por nombre, actividad, ciudad..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
          leftIcon={<Search size={15} />}
        />
      </div>

      {/* Table */}
      <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: 'var(--color-surface-raised)', borderBottom: '1px solid var(--color-border)' }}>
              <th className="px-4 py-3 text-left font-semibold" style={{ color: 'var(--color-text-muted)' }}>Empresa</th>
              <th className="px-4 py-3 text-left font-semibold hidden md:table-cell" style={{ color: 'var(--color-text-muted)' }}>Actividad</th>
              <th className="px-4 py-3 text-left font-semibold hidden lg:table-cell" style={{ color: 'var(--color-text-muted)' }}>Localidad</th>
              <th className="px-4 py-3 text-left font-semibold hidden lg:table-cell" style={{ color: 'var(--color-text-muted)' }}>Web</th>
              <th className="px-4 py-3 text-center font-semibold" style={{ color: 'var(--color-text-muted)' }}>Técnicos</th>
              <th className="px-4 py-3" />
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
            ) : empresas.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center" style={{ color: 'var(--color-text-muted)' }}>
                  <Building2 size={32} className="mx-auto mb-3 opacity-30" />
                  <p className="font-medium">No hay empresas aún</p>
                  <p className="text-xs mt-1">Cargá una manualmente o importá un Excel</p>
                </td>
              </tr>
            ) : (
              empresas.map(e => (
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
                        <Building2 size={14} style={{ color: 'var(--color-text-muted)' }} />
                      </div>
                      <span className="font-medium" style={{ color: 'var(--color-text)' }}>{e.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell" style={{ color: 'var(--color-text-muted)' }}>
                    {e.activity ?? '—'}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell" style={{ color: 'var(--color-text-muted)' }}>
                    {e.city && e.province ? (
                      <span className="flex items-center gap-1">
                        <MapPin size={12} /> {e.city}, {e.province}
                      </span>
                    ) : e.city || e.province || '—'}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell" style={{ color: 'var(--color-text-muted)' }}>
                    {e.website ? (
                      <a
                        href={e.website.startsWith('http') ? e.website : `https://${e.website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={ev => ev.stopPropagation()}
                        className="flex items-center gap-1 hover:underline"
                        style={{ color: 'var(--color-primary)' }}
                      >
                        <Globe size={12} /> {e.website.replace(/^https?:\/\//, '')}
                      </a>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full"
                      style={{ background: 'var(--color-surface-raised)', color: 'var(--color-text-muted)' }}>
                      <Users size={11} /> {e._count?.tecnicos ?? 0}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right" onClick={ev => ev.stopPropagation()}>
                    {canManage && (
                      <button
                        onClick={() => setDeleteId(e.id)}
                        className="p-1.5 rounded-lg transition-colors hover:bg-red-500/10 hover:text-red-400"
                        style={{ color: 'var(--color-text-muted)' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
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

      {/* Create modal */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title="Nueva empresa" size="md">
        <EmpresaForm onSuccess={() => { setShowForm(false); qc.invalidateQueries({ queryKey: ['empresas'] }) }} />
      </Modal>

      {/* Delete confirm */}
      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Eliminar empresa" size="sm">
        <p className="text-sm mb-4" style={{ color: 'var(--color-text-muted)' }}>
          ¿Eliminás esta empresa? Los técnicos vinculados quedarán sin vínculo.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => setDeleteId(null)}>Cancelar</Button>
          <Button variant="danger" onClick={handleDelete} disabled={deleting}>
            {deleting ? 'Eliminando...' : 'Eliminar'}
          </Button>
        </div>
      </Modal>
    </div>
  )
}
