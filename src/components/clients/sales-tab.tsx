'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, DollarSign, Calendar, User, FileText, TrendingUp } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { Sale } from '@/types'
import toast from 'react-hot-toast'

const CURRENCY_OPTIONS = [
  { value: 'USD', label: 'USD' },
  { value: 'ARS', label: 'ARS' },
  { value: 'EUR', label: 'EUR' },
]

interface SalesTabProps {
  clientId: string
  sales: Sale[]
  onUpdate: () => void
}

interface SaleFormState {
  sellerId: string
  amount: string
  currency: string
  closedAt: string
  notes: string
}

const EMPTY_FORM: SaleFormState = {
  sellerId: '',
  amount: '',
  currency: 'USD',
  closedAt: new Date().toISOString().split('T')[0],
  notes: '',
}

export function SalesTab({ clientId, sales, onUpdate }: SalesTabProps) {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<SaleFormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const { data: usersData } = useQuery({
    queryKey: ['users-list'],
    queryFn: async () => {
      const res = await fetch('/api/settings/users')
      if (!res.ok) return { data: [] }
      return res.json()
    },
    staleTime: 5 * 60 * 1000,
  })

  const users: Array<{ id: string; name: string; role: string }> = usersData?.data ?? []
  const sellerOptions = [
    { value: '', label: 'Seleccionar vendedor...' },
    ...users.map((u) => ({ value: u.id, label: u.name })),
  ]

  const total = sales.reduce((acc, s) => acc + s.amount, 0)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.sellerId) { toast.error('Seleccioná un vendedor'); return }
    if (!form.amount || Number(form.amount) <= 0) { toast.error('El monto debe ser mayor a 0'); return }
    setSaving(true)
    try {
      const res = await fetch(`/api/clients/${clientId}/sales`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sellerId: form.sellerId,
          amount: Number(form.amount),
          currency: form.currency,
          closedAt: form.closedAt || null,
          notes: form.notes.trim() || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error); return }
      toast.success('Venta registrada')
      setForm(EMPTY_FORM)
      setShowForm(false)
      onUpdate()
      qc.invalidateQueries({ queryKey: ['client', clientId] })
      qc.invalidateQueries({ queryKey: ['activity', clientId] })
    } catch {
      toast.error('Error al registrar')
    } finally {
      setSaving(false)
    }
  }

  const field = (key: keyof SaleFormState) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value })),
  })

  return (
    <div className="space-y-4">
      {/* Summary */}
      {sales.length > 0 && (
        <div className="surface rounded-xl p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg gradient-bg flex items-center justify-center shrink-0">
            <TrendingUp size={16} className="text-white" />
          </div>
          <div>
            <p className="text-xs text-[var(--color-text-muted)]">Total en ventas</p>
            <p className="text-lg font-bold text-[var(--color-text)]">{formatCurrency(total)}</p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-xs text-[var(--color-text-muted)]">Ventas registradas</p>
            <p className="text-lg font-bold text-[var(--color-text)]">{sales.length}</p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--color-text-muted)]">
          {sales.length === 0 ? 'Sin ventas registradas' : `${sales.length} venta${sales.length !== 1 ? 's' : ''}`}
        </p>
        <Button size="sm" variant="secondary" leftIcon={<Plus size={14} />} onClick={() => setShowForm(true)}>
          Registrar venta
        </Button>
      </div>

      {/* Sales list */}
      <div className="space-y-2">
        <AnimatePresence initial={false}>
          {sales.map((sale) => (
            <motion.div
              key={sale.id}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="surface rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3"
            >
              <div className="w-9 h-9 rounded-lg bg-yellow-500/15 text-yellow-400 flex items-center justify-center shrink-0">
                <DollarSign size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                  <span className="font-semibold text-sm text-[var(--color-text)]">
                    {formatCurrency(sale.amount, sale.currency)}
                  </span>
                  {sale.seller && (
                    <span className="text-xs text-[var(--color-text-muted)] flex items-center gap-1">
                      <User size={11} />{sale.seller.name}
                    </span>
                  )}
                  <span className="text-xs text-[var(--color-text-muted)] flex items-center gap-1">
                    <Calendar size={11} />{formatDate(sale.closedAt)}
                  </span>
                </div>
                {sale.notes && (
                  <p className="text-xs text-[var(--color-text-subtle)] mt-0.5 flex items-start gap-1">
                    <FileText size={10} className="mt-0.5 shrink-0" />
                    {sale.notes}
                  </p>
                )}
              </div>
              <span className="text-xs font-mono text-[var(--color-text-subtle)] shrink-0">
                {sale.currency}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Register sale modal */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title="Registrar Venta" size="sm">
        <form onSubmit={handleSubmit} className="space-y-3">
          <Select
            label="Vendedor *"
            options={sellerOptions}
            value={form.sellerId}
            onChange={(e) => setForm((f) => ({ ...f, sellerId: e.target.value }))}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Monto *"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              leftIcon={<DollarSign size={14} />}
              {...field('amount')}
            />
            <Select
              label="Moneda"
              options={CURRENCY_OPTIONS}
              value={form.currency}
              onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
            />
          </div>
          <Input
            label="Fecha de cierre"
            type="date"
            leftIcon={<Calendar size={14} />}
            {...field('closedAt')}
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[var(--color-text-muted)]">Notas</label>
            <textarea
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)]"
              placeholder="Detalles de la venta, servicio contratado..."
              rows={3}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" type="button" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button type="submit" loading={saving}>Registrar</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
