'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Plus, CreditCard, DollarSign, AlertCircle, CheckCircle, Filter, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { Table } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar } from '@/components/ui/avatar'
import { InvoiceForm } from '@/components/invoices/invoice-form'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useAuthStore } from '@/store/auth-store'
import toast from 'react-hot-toast'

interface RecurringClient {
  id: string; name: string; email: string; mrr: number
  serviceType: string | null; service: { name: string; currency: string } | null
}
interface RecurringPreview {
  pending: RecurringClient[]; alreadyBilled: RecurringClient[]; month: string
}

function RecurringModal({ open, onClose, onGenerated }: { open: boolean; onClose: () => void; onGenerated: () => void }) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [generating, setGenerating] = useState(false)
  const { data, isLoading } = useQuery<RecurringPreview>({
    queryKey: ['recurring-preview'],
    queryFn: async () => { const res = await fetch('/api/invoices/generate-recurring'); if (!res.ok) throw new Error(); return (await res.json()).data },
    enabled: open, staleTime: 0,
  })
  const toggle = (id: string) => setSelected((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next })
  const generate = async () => {
    if (!selected.size) return
    setGenerating(true)
    try {
      const res = await fetch('/api/invoices/generate-recurring', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientIds: Array.from(selected) }) })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error); return }
      toast.success(json.message); onGenerated(); onClose()
    } catch { toast.error('Error al generar facturas') } finally { setGenerating(false) }
  }
  return (
    <Modal open={open} onClose={onClose} title="Generar Facturas del Mes" size="md">
      {isLoading ? <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}</div> : !data ? null : (
        <div className="space-y-4">
          <p className="text-sm text-[var(--color-text-muted)]">Mes: <strong className="text-[var(--color-text)] capitalize">{data.month}</strong></p>
          {data.pending.length === 0 ? (
            <div className="text-center py-8"><CheckCircle size={32} className="text-emerald-400 mx-auto mb-3" /><p className="font-medium text-[var(--color-text)]">¡Todo al día!</p></div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-[var(--color-text)]">{data.pending.length} clientes pendientes</p>
                <button onClick={() => setSelected(selected.size === data.pending.length ? new Set() : new Set(data.pending.map((c) => c.id)))} className="text-xs text-[var(--color-primary)] hover:underline">
                  {selected.size === data.pending.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
                </button>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {data.pending.map((c) => (
                  <label key={c.id} className="flex items-center gap-3 p-3 rounded-xl border border-[var(--color-border)] hover:border-[var(--color-primary)]/50 cursor-pointer transition-all">
                    <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} className="accent-[var(--color-primary)]" />
                    <Avatar name={c.name} size="sm" />
                    <div className="flex-1 min-w-0"><p className="text-sm font-medium text-[var(--color-text)] truncate">{c.name}</p><p className="text-xs text-[var(--color-text-muted)]">{c.service?.name ?? c.serviceType ?? 'Servicio'}</p></div>
                    <span className="text-sm font-bold text-[var(--color-text)] shrink-0">{formatCurrency(c.mrr, c.service?.currency ?? 'USD')}</span>
                  </label>
                ))}
              </div>
              <div className="flex justify-end gap-3 pt-2 border-t border-[var(--color-border)]">
                <Button variant="ghost" onClick={onClose}>Cancelar</Button>
                <Button onClick={generate} loading={generating} disabled={selected.size === 0} leftIcon={<RefreshCw size={14} />}>Generar {selected.size > 0 ? `${selected.size} ` : ''}factura{selected.size !== 1 ? 's' : ''}</Button>
              </div>
            </>
          )}
        </div>
      )}
    </Modal>
  )
}

interface InvoiceRow {
  id: string; amount: number; currency: string; status: string
  description: string | null; dueDate: string; paidAt: string | null; createdAt: string
  client: { id: string; name: string; email: string }
}
interface InvoicesResponse {
  data: InvoiceRow[]; total: number; totalPages: number
  summary: { pendingTotal: number; paidThisMonth: number; overdueCount: number }
}

const STATUS_OPTIONS = [
  { value: '', label: 'Todos los estados' }, { value: 'PENDING', label: 'Pendientes' },
  { value: 'PAID', label: 'Pagadas' }, { value: 'OVERDUE', label: 'Vencidas' }, { value: 'CANCELLED', label: 'Canceladas' },
]
const STATUS_LABELS: Record<string, string> = { PENDING: 'Pendiente', PAID: 'Pagada', OVERDUE: 'Vencida', CANCELLED: 'Cancelada' }
const STATUS_VARIANTS: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = { PENDING: 'warning', PAID: 'success', OVERDUE: 'danger', CANCELLED: 'neutral' }

function isOverdue(row: InvoiceRow) { return row.status === 'OVERDUE' || (row.status === 'PENDING' && new Date(row.dueDate) < new Date()) }

export default function FacturasPage() {
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [showCreate, setShowCreate] = useState(false)
  const [showRecurring, setShowRecurring] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const canManage = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN'

  const params = new URLSearchParams({ page: String(page), limit: '20' })
  if (statusFilter) params.set('status', statusFilter)

  const { data, isLoading } = useQuery<InvoicesResponse>({
    queryKey: ['invoices', statusFilter, page],
    queryFn: async () => { const res = await fetch(`/api/invoices?${params}`); if (!res.ok) throw new Error(); return res.json() },
    staleTime: 60 * 1000,
  })

  const invoices = data?.data ?? []
  const summary = data?.summary

  const markAsPaid = async (id: string) => {
    try {
      const res = await fetch(`/api/invoices/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'PAID' }) })
      if (!res.ok) throw new Error()
      toast.success('Factura marcada como pagada')
      qc.invalidateQueries({ queryKey: ['invoices'] })
    } catch { toast.error('Error al actualizar') }
  }

  const deleteInvoice = async (id: string) => {
    try {
      const res = await fetch(`/api/invoices/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('Factura eliminada')
      qc.invalidateQueries({ queryKey: ['invoices'] })
      setDeletingId(null)
    } catch { toast.error('Error al eliminar') }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl gradient-bg flex items-center justify-center shrink-0"><CreditCard size={20} className="text-white" /></div>
          <div><h1 className="text-2xl font-bold text-[var(--color-text)]">Facturación</h1><p className="text-sm text-[var(--color-text-muted)]">Gestión de facturas y cobros</p></div>
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            <Button variant="secondary" leftIcon={<RefreshCw size={16} />} onClick={() => setShowRecurring(true)}>Generar del Mes</Button>
            <Button leftIcon={<Plus size={16} />} onClick={() => setShowCreate(true)}>Nueva Factura</Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {isLoading ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />) : (
          <>
            {[
              { label: 'Por cobrar', value: formatCurrency(summary?.pendingTotal ?? 0), icon: <DollarSign size={20} />, color: '#f59e0b' },
              { label: 'Cobrado este mes', value: formatCurrency(summary?.paidThisMonth ?? 0), icon: <CheckCircle size={20} />, color: '#22c55e' },
              { label: 'Facturas vencidas', value: String(summary?.overdueCount ?? 0), icon: <AlertCircle size={20} />, color: '#ef4444' },
            ].map((stat, i) => (
              <motion.div key={stat.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="surface rounded-2xl p-5 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${stat.color}1a`, color: stat.color }}>{stat.icon}</div>
                <div><p className="text-xl font-bold text-[var(--color-text)]">{stat.value}</p><p className="text-sm text-[var(--color-text-muted)]">{stat.label}</p></div>
              </motion.div>
            ))}
          </>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Filter size={15} className="text-[var(--color-text-subtle)]" />
        <Select options={STATUS_OPTIONS} value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }} className="max-w-[200px]" />
      </div>

      <Table<InvoiceRow>
        loading={isLoading}
        data={invoices}
        emptyMessage="No hay facturas que coincidan con los filtros"
        columns={[
          { key: 'client', header: 'Cliente', render: (row) => <div className="flex items-center gap-3"><Avatar name={row.client.name} size="sm" /><div><p className="font-medium text-[var(--color-text)]">{row.client.name}</p><p className="text-xs text-[var(--color-text-muted)]">{row.client.email}</p></div></div> },
          { key: 'description', header: 'Descripción', render: (row) => <span className="text-[var(--color-text-muted)]">{row.description ?? 'Servicio'}</span> },
          { key: 'amount', header: 'Monto', align: 'right', render: (row) => <span className="font-semibold text-[var(--color-text)]">{formatCurrency(row.amount, row.currency)}</span> },
          { key: 'dueDate', header: 'Vencimiento', render: (row) => <span className={isOverdue(row) && row.status !== 'PAID' ? 'text-red-400 font-medium' : 'text-[var(--color-text-muted)]'}>{formatDate(row.dueDate)}</span> },
          { key: 'status', header: 'Estado', align: 'center', render: (row) => { const v = isOverdue(row) && row.status !== 'PAID' && row.status !== 'CANCELLED' ? 'danger' : STATUS_VARIANTS[row.status] ?? 'neutral'; const l = isOverdue(row) && row.status === 'PENDING' ? 'Vencida' : STATUS_LABELS[row.status] ?? row.status; return <Badge variant={v} dot size="sm">{l}</Badge> } },
          ...(canManage ? [{ key: 'actions' as keyof InvoiceRow, header: 'Acciones', align: 'right' as const, render: (row: InvoiceRow) => (
            <div className="flex items-center gap-2 justify-end">
              {row.status !== 'PAID' && row.status !== 'CANCELLED' && <button onClick={(e) => { e.stopPropagation(); markAsPaid(row.id) }} className="text-xs text-emerald-400 hover:text-emerald-300 border border-emerald-400/30 hover:border-emerald-400 px-2.5 py-1 rounded-lg transition-all">Marcar pagada</button>}
              <button onClick={(e) => { e.stopPropagation(); setDeletingId(row.id) }} className="text-xs text-red-400 hover:text-red-300 border border-red-400/30 hover:border-red-400 px-2.5 py-1 rounded-lg transition-all">Eliminar</button>
            </div>
          ) }] : []),
        ]}
      />

      <RecurringModal open={showRecurring} onClose={() => setShowRecurring(false)} onGenerated={() => qc.invalidateQueries({ queryKey: ['invoices'] })} />
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Nueva Factura" size="md">
        <InvoiceForm onSuccess={() => { setShowCreate(false); qc.invalidateQueries({ queryKey: ['invoices'] }) }} onCancel={() => setShowCreate(false)} />
      </Modal>
      <Modal open={!!deletingId} onClose={() => setDeletingId(null)} title="Eliminar Factura" size="sm">
        <p className="text-sm text-[var(--color-text-muted)] mb-6">¿Estás seguro de eliminar esta factura?</p>
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setDeletingId(null)}>Cancelar</Button>
          <Button variant="danger" onClick={() => deletingId && deleteInvoice(deletingId)}>Eliminar</Button>
        </div>
      </Modal>
    </div>
  )
}
