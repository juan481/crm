'use client'

import { useRef, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Upload, UserCircle2, Mail, Phone, Building2, Trash2, Link2Off } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { ContactoForm } from '@/components/directorio/contacto-form'
import { Pagination } from '@/components/ui/table'
import { useAuthStore } from '@/store/auth-store'
import type { DirectorioContacto } from '@/types'
import toast from 'react-hot-toast'

export default function ContactosPage() {
  const router   = useRouter()
  const qc       = useQueryClient()
  const { user } = useAuthStore()
  const fileRef  = useRef<HTMLInputElement>(null)

  const [searchInput, setSearchInput] = useState('')
  const [search,      setSearch]      = useState('')
  const [page,        setPage]        = useState(1)

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1) }, 300)
    return () => clearTimeout(t)
  }, [searchInput])
  const [showForm,  setShowForm]  = useState(false)
  const [importing, setImporting] = useState(false)
  const [deleteId,  setDeleteId]  = useState<string | null>(null)
  const [deleting,  setDeleting]  = useState(false)

  const canManage = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN'

  const { data, isLoading } = useQuery({
    queryKey: ['contactos', search, page],
    queryFn: async () => {
      const p = new URLSearchParams({ page: String(page), limit: '20' })
      if (search.length >= 2) p.set('search', search)
      const res = await fetch(`/api/contactos?${p}`)
      if (!res.ok) throw new Error('Error al cargar contactos')
      return res.json()
    },
    staleTime: 30_000,
  })

  const contactos: DirectorioContacto[] = data?.data ?? []
  const total: number                   = data?.total ?? 0
  const totalPages: number              = data?.totalPages ?? 1

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    const fd = new FormData()
    fd.append('file', file)
    try {
      const res  = await fetch('/api/contactos/importar', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error); return }
      toast.success(json.message)
      qc.invalidateQueries({ queryKey: ['contactos'] })
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
      const res = await fetch(`/api/contactos/${deleteId}`, { method: 'DELETE' })
      if (res.ok) { toast.success('Contacto eliminado'); qc.invalidateQueries({ queryKey: ['contactos'] }) }
      else { const j = await res.json(); toast.error(j.error) }
    } catch { toast.error('Error de conexión') }
    finally { setDeleting(false); setDeleteId(null) }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>Contactos</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            {total} contactos · CEOs, dueños, técnicos, administrativos — todos vinculables a empresas
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
              <Plus size={15} /> Nuevo contacto
            </Button>
          </div>
        )}
      </div>

      <div className="max-w-sm">
        <Input
          placeholder="Buscar por nombre, mail, cargo, empresa..."
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          leftIcon={<Search size={15} />}
        />
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: 'var(--color-surface-raised)', borderBottom: '1px solid var(--color-border)' }}>
              <th className="px-4 py-3 text-left font-semibold" style={{ color: 'var(--color-text-muted)' }}>Contacto</th>
              <th className="px-4 py-3 text-left font-semibold hidden sm:table-cell" style={{ color: 'var(--color-text-muted)' }}>Cargo</th>
              <th className="px-4 py-3 text-left font-semibold hidden md:table-cell" style={{ color: 'var(--color-text-muted)' }}>Empresa</th>
              <th className="px-4 py-3 text-left font-semibold hidden lg:table-cell" style={{ color: 'var(--color-text-muted)' }}>Mail</th>
              <th className="px-4 py-3 text-left font-semibold hidden xl:table-cell" style={{ color: 'var(--color-text-muted)' }}>Teléfono</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 rounded animate-pulse" style={{ background: 'var(--color-border)', width: j === 0 ? '55%' : '40%' }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : contactos.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center" style={{ color: 'var(--color-text-muted)' }}>
                  <UserCircle2 size={32} className="mx-auto mb-3 opacity-30" />
                  <p className="font-medium">No hay contactos aún</p>
                  <p className="text-xs mt-1">Podés agregar CEOs, técnicos, dueños o cualquier persona de la empresa</p>
                </td>
              </tr>
            ) : (
              contactos.map(c => (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td className="px-4 py-3">
                    <span className="font-medium" style={{ color: 'var(--color-text)' }}>
                      {c.firstName} {c.lastName}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell" style={{ color: 'var(--color-text-muted)' }}>
                    {c.role ?? '—'}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    {c.empresa ? (
                      <button
                        onClick={() => router.push(`/empresas/${c.empresa!.id}`)}
                        className="flex items-center gap-1.5 hover:underline text-left"
                        style={{ color: 'var(--color-primary)' }}
                      >
                        <Building2 size={12} /> {c.empresa.name}
                      </button>
                    ) : c.companyRaw ? (
                      <span className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        <Link2Off size={11} /> {c.companyRaw} (sin vincular)
                      </span>
                    ) : (
                      <span style={{ color: 'var(--color-text-muted)' }}>—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    {c.email ? (
                      <a href={`mailto:${c.email}`} className="flex items-center gap-1.5 hover:underline"
                        style={{ color: 'var(--color-primary)' }}>
                        <Mail size={12} /> {c.email}
                      </a>
                    ) : <span style={{ color: 'var(--color-text-muted)' }}>—</span>}
                  </td>
                  <td className="px-4 py-3 hidden xl:table-cell">
                    {c.phone ? (
                      <a href={`tel:${c.phone}`} className="flex items-center gap-1.5"
                        style={{ color: 'var(--color-text-muted)' }}>
                        <Phone size={12} /> {c.phone}
                      </a>
                    ) : <span style={{ color: 'var(--color-text-muted)' }}>—</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {canManage && (
                      <button
                        onClick={() => setDeleteId(c.id)}
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

      <Modal open={showForm} onClose={() => setShowForm(false)} title="Nuevo contacto" size="md">
        <ContactoForm onSuccess={() => { setShowForm(false); qc.invalidateQueries({ queryKey: ['contactos'] }) }} />
      </Modal>

      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Eliminar contacto" size="sm">
        <p className="text-sm mb-4" style={{ color: 'var(--color-text-muted)' }}>
          ¿Confirmás la eliminación de este contacto?
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
