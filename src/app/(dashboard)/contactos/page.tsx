'use client'

import { useRef, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Upload, UserCircle2, Mail, Phone, Building2, Trash2, Link2Off, Pencil, CheckCircle2, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { ContactoForm } from '@/components/directorio/contacto-form'
import { Pagination } from '@/components/ui/table'
import { useAuthStore } from '@/store/auth-store'
import type { DirectorioContacto } from '@/types'
import * as XLSX from 'xlsx'
import toast from 'react-hot-toast'

const CHUNK = 20

interface ImportProgress {
  processed: number
  total:     number
  created:   number
  dupes:     number
  skipped:   number
  done?:     boolean
  error?:    string
}

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
  const [showForm,     setShowForm]     = useState(false)
  const [editContact,  setEditContact]  = useState<DirectorioContacto | null>(null)
  const [importing,    setImporting]    = useState(false)
  const [progress,     setProgress]     = useState<ImportProgress | null>(null)
  const [deleteId,     setDeleteId]     = useState<string | null>(null)
  const [deleting,     setDeleting]     = useState(false)

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
    if (fileRef.current) fileRef.current.value = ''

    const buffer = await file.arrayBuffer()
    const wb   = XLSX.read(buffer, { type: 'buffer' })
    const ws   = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })

    if (rows.length === 0) { toast.error('El archivo está vacío'); return }

    setImporting(true)
    setProgress({ processed: 0, total: rows.length, created: 0, dupes: 0, skipped: 0 })

    let created = 0
    let dupes   = 0
    let skipped = 0

    try {
      for (let i = 0; i < rows.length; i += CHUNK) {
        const chunk = rows.slice(i, i + CHUNK)
        const res   = await fetch('/api/contactos/importar', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ rows: chunk }),
        })

        if (!res.ok) {
          const j = await res.json().catch(() => ({}))
          setProgress(p => p ? { ...p, error: j.error ?? 'Error en el servidor' } : null)
          return
        }

        const result = await res.json()
        created += result.created ?? 0
        dupes   += result.dupes   ?? 0
        skipped += result.skipped ?? 0

        setProgress({ processed: Math.min(i + CHUNK, rows.length), total: rows.length, created, dupes, skipped })

        if (i + CHUNK < rows.length) await new Promise(r => setTimeout(r, 300))
      }

      setProgress(p => p ? { ...p, processed: rows.length, done: true } : null)
      qc.invalidateQueries({ queryKey: ['contactos'] })
    } catch {
      toast.error('Error de conexión')
      setProgress(p => p ? { ...p, error: 'Error de conexión' } : null)
    } finally {
      setImporting(false)
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

  const pct = progress && progress.total > 0
    ? Math.round((progress.processed / progress.total) * 100)
    : 0

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
                      <a
                        href={`https://wa.me/${c.phone.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 hover:underline"
                        style={{ color: '#22c55e' }}
                      >
                        <MessageCircle size={12} /> {c.phone}
                      </a>
                    ) : <span style={{ color: 'var(--color-text-muted)' }}>—</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {canManage && (
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setEditContact(c)}
                          className="p-1.5 rounded-lg transition-colors hover:bg-[var(--color-primary)]/10 hover:text-[var(--color-primary)]"
                          style={{ color: 'var(--color-text-muted)' }}
                          title="Editar"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => setDeleteId(c.id)}
                          className="p-1.5 rounded-lg transition-colors hover:bg-red-500/10 hover:text-red-400"
                          style={{ color: 'var(--color-text-muted)' }}
                          title="Eliminar"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
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

      <Modal open={!!editContact} onClose={() => setEditContact(null)} title="Editar contacto" size="md">
        {editContact && (
          <ContactoForm
            contacto={editContact}
            onSuccess={() => { setEditContact(null); qc.invalidateQueries({ queryKey: ['contactos'] }) }}
          />
        )}
      </Modal>

      {/* Import progress modal */}
      <Modal
        open={!!progress}
        onClose={() => { if (progress?.done || progress?.error) setProgress(null) }}
        title="Importando contactos"
        size="sm"
        showClose={!!(progress?.done || progress?.error)}
      >
        {progress && (
          <div className="space-y-5">
            <div>
              <div className="flex justify-between text-xs mb-2" style={{ color: 'var(--color-text-muted)' }}>
                <span>{progress.done ? 'Completado' : `Procesando fila ${progress.processed} de ${progress.total}...`}</span>
                <span>{pct}%</span>
              </div>
              <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'var(--color-border)' }}>
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${pct}%`,
                    background: progress.error ? '#ef4444' : progress.done ? '#10b981' : 'var(--color-primary)',
                  }}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Contactos creados', value: progress.created, color: 'var(--color-primary)' },
                { label: 'Duplicados',         value: progress.dupes,   color: 'var(--color-text-muted)' },
                { label: 'Filas omitidas',     value: progress.skipped, color: 'var(--color-text-muted)' },
              ].map(s => (
                <div key={s.label} className="rounded-xl p-3 text-center"
                  style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)' }}>
                  <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{s.label}</p>
                </div>
              ))}
            </div>

            {progress.done && (
              <div className="flex items-center gap-2 text-sm font-medium" style={{ color: '#10b981' }}>
                <CheckCircle2 size={16} /> Importación completada exitosamente
              </div>
            )}

            {progress.error && (
              <div className="text-sm" style={{ color: '#ef4444' }}>
                Error: {progress.error}
              </div>
            )}
          </div>
        )}
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
