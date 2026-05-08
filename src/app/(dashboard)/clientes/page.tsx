'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Search, Filter, Trash2, CheckSquare, Square, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Table, Pagination } from '@/components/ui/table'
import { Avatar } from '@/components/ui/avatar'
import { Modal } from '@/components/ui/modal'
import { ClientForm } from '@/components/clients/client-form'
import { ExportMenu } from '@/components/clients/export-menu'
import { formatCurrency, CLIENT_STATUS_LABELS, CLIENT_STATUS_COLORS, COUNTRIES } from '@/lib/utils'
import { useAuthStore } from '@/store/auth-store'
import type { Client, ClientFilters } from '@/types'
import toast from 'react-hot-toast'

const STATUS_OPTIONS = [
  { value: '', label: 'Todos los estados' },
  { value: 'ACTIVE', label: 'Activo' },
  { value: 'PENDING_PAYMENT', label: 'Pago Pendiente' },
  { value: 'EXPIRED', label: 'Vencido' },
  { value: 'INACTIVE', label: 'Inactivo' },
  { value: 'PROSPECT', label: 'Prospecto' },
]

const TYPE_OPTIONS = [
  { value: '', label: 'B2B y B2C' },
  { value: 'B2B', label: 'B2B (Empresa)' },
  { value: 'B2C', label: 'B2C (Consumidor)' },
]

const ENABLED_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'true', label: 'Habilitados' },
  { value: 'false', label: 'Deshabilitados' },
]

const COUNTRY_OPTIONS = [
  { value: '', label: 'Todos los países' },
  ...COUNTRIES.map((c) => ({ value: c, label: c })),
]

export default function ClientesPage() {
  const router = useRouter()
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const [filters, setFilters] = useState<ClientFilters>({ page: 1, limit: 20 })
  const [showForm, setShowForm] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [deletingBulk, setDeletingBulk] = useState(false)

  const canDelete = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN'

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['clients', filters],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (filters.search) params.set('search', filters.search)
      if (filters.status) params.set('status', filters.status)
      if (filters.country) params.set('country', filters.country)
      if (filters.clientType) params.set('clientType', filters.clientType)
      if (filters.isEnabled !== null && filters.isEnabled !== undefined) params.set('isEnabled', String(filters.isEnabled))
      params.set('page', String(filters.page ?? 1))
      params.set('limit', String(filters.limit ?? 20))
      const res = await fetch(`/api/clients?${params}`)
      if (!res.ok) throw new Error('Error al cargar clientes')
      return res.json()
    },
    staleTime: 30 * 1000,
  })

  const clients: Client[] = data?.data ?? []
  const total: number = data?.total ?? 0
  const totalPages: number = data?.totalPages ?? 1

  const updateFilter = (key: keyof ClientFilters, value: string | number | boolean | null) => {
    setFilters((f) => ({ ...f, [key]: value, page: 1 }))
    setSelectedIds(new Set())
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === clients.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(clients.map((c) => c.id)))
    }
  }

  const handleBulkDelete = async () => {
    setDeletingBulk(true)
    try {
      const res = await fetch('/api/clients/bulk', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error); return }
      toast.success(json.message)
      setSelectedIds(new Set())
      setBulkDeleteOpen(false)
      qc.invalidateQueries({ queryKey: ['clients'] })
    } catch {
      toast.error('Error al eliminar')
    } finally {
      setDeletingBulk(false)
    }
  }

  const activeFilterCount = [
    filters.status, filters.country, filters.clientType,
    filters.isEnabled !== null && filters.isEnabled !== undefined ? '1' : '',
  ].filter(Boolean).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">Clientes</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
            {total > 0 ? `${total} clientes en total` : 'Sin clientes aún'}
          </p>
        </div>
        <div className="flex gap-2">
          <ExportMenu clients={clients} />
          <Button leftIcon={<Plus size={16} />} onClick={() => setShowForm(true)}>
            Nuevo Cliente
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="surface rounded-2xl p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <Input
            placeholder="Buscar por nombre, email, empresa o teléfono..."
            leftIcon={<Search size={16} />}
            className="sm:max-w-sm"
            value={filters.search ?? ''}
            onChange={(e) => updateFilter('search', e.target.value)}
          />
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[var(--color-border)] text-sm text-[var(--color-text-muted)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-text)] transition-all"
          >
            <Filter size={15} />
            Filtros
            {activeFilterCount > 0 && (
              <span className="w-5 h-5 rounded-full gradient-bg text-white text-xs flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex flex-col sm:flex-row flex-wrap gap-3 pt-1 overflow-hidden"
            >
              <Select options={STATUS_OPTIONS} value={filters.status ?? ''} onChange={(e) => updateFilter('status', e.target.value)} className="sm:max-w-[180px]" />
              <Select options={TYPE_OPTIONS} value={filters.clientType ?? ''} onChange={(e) => updateFilter('clientType', e.target.value)} className="sm:max-w-[160px]" />
              <Select options={ENABLED_OPTIONS} value={filters.isEnabled === null || filters.isEnabled === undefined ? '' : String(filters.isEnabled)} onChange={(e) => updateFilter('isEnabled', e.target.value === '' ? null : e.target.value === 'true')} className="sm:max-w-[150px]" />
              <Select options={COUNTRY_OPTIONS} value={filters.country ?? ''} onChange={(e) => updateFilter('country', e.target.value)} className="sm:max-w-[180px]" />
              {activeFilterCount > 0 && (
                <button
                  onClick={() => { setFilters({ page: 1, limit: 20 }); setSelectedIds(new Set()) }}
                  className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] underline underline-offset-2 transition-colors"
                >
                  Limpiar filtros
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bulk actions bar */}
      <AnimatePresence>
        {selectedIds.size > 0 && canDelete && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="surface rounded-2xl p-3 flex items-center justify-between border border-[var(--color-primary)]/30 bg-[var(--color-primary-light)]"
          >
            <div className="flex items-center gap-3">
              <button onClick={() => setSelectedIds(new Set())} className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
                <X size={16} />
              </button>
              <span className="text-sm font-medium text-[var(--color-text)]">
                {selectedIds.size} cliente{selectedIds.size !== 1 ? 's' : ''} seleccionado{selectedIds.size !== 1 ? 's' : ''}
              </span>
            </div>
            <Button variant="danger" size="sm" leftIcon={<Trash2 size={14} />} onClick={() => setBulkDeleteOpen(true)}>
              Eliminar seleccionados
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Table */}
      <Table<Client>
        loading={isLoading}
        data={clients}
        onRowClick={(client) => router.push(`/clientes/${client.id}`)}
        emptyMessage="No hay clientes que coincidan con los filtros"
        columns={[
          ...(canDelete ? [{
            key: '_select' as keyof Client,
            header: (
              <button onClick={(e) => { e.stopPropagation(); toggleSelectAll() }} className="text-[var(--color-text-subtle)] hover:text-[var(--color-text)]">
                {selectedIds.size === clients.length && clients.length > 0 ? <CheckSquare size={16} className="text-[var(--color-primary)]" /> : <Square size={16} />}
              </button>
            ) as unknown as string,
            render: (row: Client) => (
              <button
                onClick={(e) => { e.stopPropagation(); toggleSelect(row.id) }}
                className="text-[var(--color-text-subtle)] hover:text-[var(--color-text)]"
              >
                {selectedIds.has(row.id) ? <CheckSquare size={16} className="text-[var(--color-primary)]" /> : <Square size={16} />}
              </button>
            ),
          }] : []),
          {
            key: 'name',
            header: 'Cliente',
            render: (row) => (
              <div className="flex items-center gap-3">
                <Avatar name={row.name} size="sm" />
                <div>
                  <p className="font-medium text-[var(--color-text)]">{row.name}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">{row.email}</p>
                </div>
              </div>
            ),
          },
          { key: 'company', header: 'Empresa', render: (row) => <span className="text-[var(--color-text-muted)]">{row.company ?? '—'}</span> },
          {
            key: 'clientType',
            header: 'Tipo',
            render: (row) => (
              <Badge variant={row.clientType === 'B2B' ? 'info' : 'warning'} size="sm">{row.clientType}</Badge>
            ),
          },
          { key: 'country', header: 'País', render: (row) => <span className="text-[var(--color-text-muted)]">{row.country ?? '—'}</span> },
          { key: 'serviceType', header: 'Servicio', render: (row) => <span className="text-[var(--color-text-muted)]">{row.serviceType ?? '—'}</span> },
          {
            key: 'mrr',
            header: 'MRR',
            align: 'right',
            render: (row) => (
              <span className="font-semibold text-[var(--color-text)]">
                {row.mrr > 0 ? formatCurrency(row.mrr) : '—'}
              </span>
            ),
          },
          {
            key: 'status',
            header: 'Estado',
            align: 'center',
            render: (row) => (
              <div className="flex flex-col items-center gap-1">
                <Badge variant={CLIENT_STATUS_COLORS[row.status] as 'success' | 'warning' | 'danger' | 'info' | 'neutral'} dot>
                  {CLIENT_STATUS_LABELS[row.status]}
                </Badge>
                {!row.isEnabled && <Badge variant="neutral" size="sm">Deshabilitado</Badge>}
              </div>
            ),
          },
        ]}
      />

      {totalPages > 1 && (
        <Pagination
          page={filters.page ?? 1}
          totalPages={totalPages}
          total={total}
          limit={filters.limit ?? 20}
          onPageChange={(p) => setFilters((f) => ({ ...f, page: p }))}
        />
      )}

      <Modal open={showForm} onClose={() => setShowForm(false)} title="Nuevo Cliente" size="lg">
        <ClientForm onSuccess={() => { setShowForm(false); qc.invalidateQueries({ queryKey: ['clients'] }) }} onCancel={() => setShowForm(false)} />
      </Modal>

      <Modal open={bulkDeleteOpen} onClose={() => setBulkDeleteOpen(false)} title="Eliminar en lote" size="sm">
        <p className="text-sm text-[var(--color-text-muted)] mb-6">
          ¿Estás seguro de eliminar <strong className="text-[var(--color-text)]">{selectedIds.size} clientes</strong>? Esta acción no se puede deshacer.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setBulkDeleteOpen(false)}>Cancelar</Button>
          <Button variant="danger" loading={deletingBulk} onClick={handleBulkDelete}>
            Eliminar {selectedIds.size} clientes
          </Button>
        </div>
      </Modal>
    </div>
  )
}
