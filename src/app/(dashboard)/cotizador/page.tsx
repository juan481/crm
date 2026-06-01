'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion' // solo para sticky bar
import {
  Plus, Minus, Send, MessageCircle, CheckCircle,
  User, FileText, ChevronRight, Trash2, Zap, RefreshCw,
  DollarSign,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { formatCurrency } from '@/lib/utils'
import type { Service } from '@/types'
import toast from 'react-hot-toast'

const BILLING_LABELS: Record<string, string> = {
  MONTHLY: 'mes',
  ANNUAL:  'año',
  ONE_TIME: 'único',
}

interface ExchangeRate {
  venta: number
  compra: number
  updatedAt: string
}

interface CartItem {
  service: Service
  quantity: number
}

export default function CotizadorPage() {
  const [cart, setCart]                   = useState<Record<string, CartItem>>({})
  const [clientMode, setClientMode]       = useState<'existing' | 'manual'>('existing')
  const [selectedClientId, setSelectedClientId] = useState('')
  const [manualEmail, setManualEmail]     = useState('')
  const [manualName, setManualName]       = useState('')
  const [notes, setNotes]                 = useState('')
  const [sending, setSending]             = useState(false)
  const [sent, setSent]                   = useState(false)
  const [showArs, setShowArs]             = useState(false)

  const { data: servicesData, isLoading: loadingServices } = useQuery({
    queryKey: ['services'],
    queryFn: async () => {
      const res = await fetch('/api/services')
      const json = await res.json()
      return json.data as Service[]
    },
  })

  const { data: clientsData } = useQuery({
    queryKey: ['clients-cotizador'],
    queryFn: async () => {
      const res = await fetch('/api/clients?limit=100')
      if (!res.ok) return []
      const json = await res.json()
      return (json.data ?? []) as Array<{ id: string; name: string; email: string }>
    },
    staleTime: 5 * 60 * 1000,
  })

  const { data: rateData, isLoading: loadingRate, refetch: refetchRate } = useQuery({
    queryKey: ['exchange-rate'],
    queryFn: async () => {
      const res = await fetch('/api/exchange-rate')
      if (!res.ok) return null
      const json = await res.json()
      return json.data as ExchangeRate
    },
    staleTime: 30 * 60 * 1000, // 30 min — same as server cache
    refetchOnWindowFocus: false,
  })

  const arsRate = rateData?.venta ?? null

  // Format a price in USD, optionally also showing ARS equivalent
  const formatPrice = (usd: number, cur: string) => {
    if (!showArs || cur !== 'USD' || !arsRate) return formatCurrency(usd, cur)
    const ars = usd * arsRate
    return `${formatCurrency(usd, 'USD')} (${formatCurrency(ars, 'ARS')})`
  }

  const services = servicesData ?? []
  const clients  = Array.isArray(clientsData) ? clientsData : []

  const cartItems = Object.values(cart)
  const total     = cartItems.reduce((sum, i) => sum + i.service.price * i.quantity, 0)
  const currency  = cartItems[0]?.service.currency ?? 'USD'

  const selectedClient = clients.find(c => c.id === selectedClientId)

  const addItem = (service: Service) => {
    setCart(prev => ({
      ...prev,
      [service.id]: { service, quantity: (prev[service.id]?.quantity ?? 0) + 1 },
    }))
  }

  const removeItem = (serviceId: string) => {
    setCart(prev => {
      const item = prev[serviceId]
      if (!item) return prev
      if (item.quantity <= 1) {
        const next = { ...prev }
        delete next[serviceId]
        return next
      }
      return { ...prev, [serviceId]: { ...item, quantity: item.quantity - 1 } }
    })
  }

  const clearCart = () => setCart({})

  const recipientEmail = clientMode === 'existing' ? selectedClient?.email : manualEmail
  const recipientName  = clientMode === 'existing' ? selectedClient?.name  : manualName

  const handleSend = async () => {
    if (cartItems.length === 0) { toast.error('Seleccioná al menos un servicio'); return }
    if (!recipientEmail)        { toast.error('Ingresá el email del cliente');     return }

    setSending(true)
    try {
      const res = await fetch('/api/cotizador/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cartItems.map(i => ({
            serviceId:   i.service.id,
            name:        i.service.name,
            price:       i.service.price,
            currency:    i.service.currency,
            billingCycle:i.service.billingCycle,
            quantity:    i.quantity,
          })),
          clientId:      clientMode === 'existing' ? selectedClientId : null,
          recipientEmail,
          recipientName: recipientName || 'Cliente',
          notes,
          total,
          currency,
        }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'Error al enviar'); return }
      setSent(true)
    } catch {
      toast.error('Error al enviar el presupuesto')
    } finally {
      setSending(false)
    }
  }

  const buildWhatsApp = () => {
    let text = `*Presupuesto de Servicios*\n\n`
    if (recipientName) text += `Hola ${recipientName},\n\nTe comparto el detalle:\n\n`
    cartItems.forEach(i => {
      const lineTotal = i.service.price * i.quantity
      let lineStr = `• ${i.service.name}`
      if (i.quantity > 1) lineStr += ` ×${i.quantity}`
      lineStr += ` — ${formatCurrency(lineTotal, i.service.currency)}/${BILLING_LABELS[i.service.billingCycle] ?? 'mes'}`
      if (showArs && arsRate && i.service.currency === 'USD') {
        lineStr += ` (${formatCurrency(lineTotal * arsRate, 'ARS')})`
      }
      text += lineStr + '\n'
    })
    text += `\n*Total: ${formatCurrency(total, currency)}*`
    if (showArs && arsRate && currency === 'USD') {
      text += ` _(ARS ${formatCurrency(total * arsRate, 'ARS')})_`
    }
    if (notes) text += `\n\n📝 ${notes}`
    text += `\n\nCualquier consulta, estamos a disposición.`
    return `https://wa.me/?text=${encodeURIComponent(text)}`
  }

  const reset = () => {
    setSent(false)
    setCart({})
    setManualEmail('')
    setManualName('')
    setNotes('')
    setSelectedClientId('')
  }

  // ── Success screen ────────────────────────────────────────────────────────
  if (sent) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-6 text-center px-4">
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          className="w-24 h-24 rounded-full bg-emerald-500/10 flex items-center justify-center"
        >
          <CheckCircle size={48} className="text-emerald-400" />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <h2 className="text-2xl font-bold text-[var(--color-text)] mb-2">¡Presupuesto enviado!</h2>
          <p className="text-[var(--color-text-muted)]">
            {recipientName ? `${recipientName} recibirá` : 'El cliente recibirá'} el detalle por email.
          </p>
        </motion.div>
        <Button onClick={reset} leftIcon={<Plus size={16} />}>
          Nuevo presupuesto
        </Button>
      </div>
    )
  }

  // ── Main layout ───────────────────────────────────────────────────────────
  return (
    <div className="pb-44 lg:pb-32">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-9 h-9 rounded-xl gradient-bg flex items-center justify-center">
                <Zap size={17} className="text-white" />
              </div>
              <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>Cotizador</h1>
            </div>
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              Armá un presupuesto en segundos y envialo en el momento
            </p>
          </div>

          {/* Dólar oficial widget */}
          <div
            className="flex items-center gap-3 px-4 py-2.5 rounded-2xl shrink-0"
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
            }}
          >
            <div className="flex items-center gap-1.5">
              <DollarSign size={14} style={{ color: 'var(--color-primary)' }} />
              <span className="text-xs font-semibold" style={{ color: 'var(--color-text-muted)' }}>
                USD oficial
              </span>
            </div>
            {loadingRate ? (
              <span className="text-sm font-bold animate-pulse" style={{ color: 'var(--color-text-subtle)' }}>
                —
              </span>
            ) : arsRate ? (
              <span className="text-sm font-bold" style={{ color: 'var(--color-text)' }}>
                ${arsRate.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            ) : (
              <span className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>N/A</span>
            )}
            <button
              onClick={() => refetchRate()}
              className="p-1 rounded-lg transition-colors hover:bg-[var(--color-surface-raised)]"
              title="Actualizar cotización"
              style={{ color: 'var(--color-text-subtle)' }}
            >
              <RefreshCw size={12} />
            </button>

            {/* ARS toggle */}
            {arsRate && (
              <button
                onClick={() => setShowArs(v => !v)}
                className="px-2 py-1 rounded-lg text-xs font-semibold transition-all"
                style={
                  showArs
                    ? { background: 'var(--color-primary)', color: '#fff' }
                    : { background: 'var(--color-surface-raised)', color: 'var(--color-text-muted)' }
                }
              >
                {showArs ? 'ARS ✓' : 'Ver ARS'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── STEP 1: Servicios ──────────────────────────────────────────────── */}
      <section className="mb-7">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-5 h-5 rounded-full gradient-bg flex items-center justify-center text-[10px] font-bold text-white shrink-0">1</span>
          <p className="text-xs font-semibold text-[var(--color-text-subtle)] uppercase tracking-widest">Elegí los servicios</p>
        </div>

        {loadingServices ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 surface rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : services.length === 0 ? (
          <div className="surface rounded-2xl p-8 text-center">
            <FileText size={32} className="mx-auto mb-3 text-[var(--color-text-subtle)]" />
            <p className="text-sm text-[var(--color-text-muted)] font-medium">Sin servicios configurados</p>
            <p className="text-xs text-[var(--color-text-subtle)] mt-1">
              Configurá los servicios en Ajustes → Servicios
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {services.map((service) => {
              const qty = cart[service.id]?.quantity ?? 0
              const selected = qty > 0
              return (
                <div
                  key={service.id}
                  className={`list-appear rounded-2xl p-4 flex items-center gap-4 transition-all duration-150 border ${
                    selected
                      ? 'bg-[var(--color-primary)]/8 border-[var(--color-primary)]/30'
                      : 'bg-[var(--color-surface)] border-[var(--color-border)]'
                  }`}
                >
                  {/* Service info */}
                  <div className="flex-1 min-w-0">
                    <p className={`font-semibold text-[15px] leading-tight ${selected ? 'text-[var(--color-text)]' : 'text-[var(--color-text)]'}`}>
                      {service.name}
                    </p>
                    {service.description && (
                      <p className="text-xs text-[var(--color-text-muted)] mt-0.5 line-clamp-1">{service.description}</p>
                    )}
                    <p className="mt-1.5 flex items-baseline gap-1 flex-wrap">
                      <span className={`text-base font-bold ${selected ? 'text-[var(--color-primary)]' : 'text-[var(--color-text)]'}`}>
                        {formatPrice(service.price, service.currency)}
                      </span>
                      <span className="text-xs text-[var(--color-text-muted)]">
                        /{BILLING_LABELS[service.billingCycle] ?? 'mes'}
                      </span>
                    </p>
                  </div>

                  {/* Quantity controls */}
                  <div className="flex items-center gap-2 shrink-0">
                    <AnimatePresence>
                      {selected && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          className="flex items-center gap-2"
                        >
                          <button
                            onClick={() => removeItem(service.id)}
                            className="w-9 h-9 rounded-full bg-[var(--color-surface-raised)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] flex items-center justify-center active:scale-90 transition-all"
                          >
                            <Minus size={15} />
                          </button>
                          <span className="w-6 text-center text-sm font-bold text-[var(--color-text)]">{qty}</span>
                        </motion.div>
                      )}
                    </AnimatePresence>
                    <button
                      onClick={() => addItem(service)}
                      className={`w-10 h-10 rounded-full flex items-center justify-center active:scale-90 transition-all font-bold ${
                        selected
                          ? 'gradient-bg text-white shadow-glow'
                          : 'bg-[var(--color-surface-raised)] text-[var(--color-text-muted)] hover:bg-[var(--color-primary)]/15 hover:text-[var(--color-primary)]'
                      }`}
                    >
                      <Plus size={18} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* ── STEP 2: Cliente ───────────────────────────────────────────────── */}
      <section className="mb-7">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-5 h-5 rounded-full gradient-bg flex items-center justify-center text-[10px] font-bold text-white shrink-0">2</span>
          <p className="text-xs font-semibold text-[var(--color-text-subtle)] uppercase tracking-widest">Destinatario</p>
        </div>

        <div className="surface rounded-2xl p-4 space-y-3">
          {/* Mode toggle */}
          <div className="flex rounded-xl overflow-hidden border border-[var(--color-border)] p-0.5 bg-[var(--color-surface-raised)]">
            {(['existing', 'manual'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setClientMode(mode)}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                  clientMode === mode
                    ? 'gradient-bg text-white shadow-sm'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                }`}
              >
                {mode === 'existing' ? 'Cliente existente' : 'Email directo'}
              </button>
            ))}
          </div>

          {clientMode === 'existing' ? (
            <Select
              options={[
                { value: '', label: 'Seleccionar cliente...' },
                ...clients.map(c => ({ value: c.id, label: c.name })),
              ]}
              value={selectedClientId}
              onChange={e => setSelectedClientId(e.target.value)}
            />
          ) : (
            <div className="space-y-2">
              <Input
                placeholder="Nombre del cliente"
                value={manualName}
                onChange={e => setManualName(e.target.value)}
                leftIcon={<User size={14} />}
              />
              <Input
                type="email"
                placeholder="email@empresa.com"
                value={manualEmail}
                onChange={e => setManualEmail(e.target.value)}
              />
            </div>
          )}

          {/* Preview */}
          {(selectedClient || manualEmail) && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="flex items-center gap-2 px-3 py-2 bg-emerald-500/8 border border-emerald-500/20 rounded-xl"
            >
              <CheckCircle size={14} className="text-emerald-400 shrink-0" />
              <p className="text-xs text-emerald-400 font-medium">
                {recipientName && `${recipientName} — `}{recipientEmail}
              </p>
            </motion.div>
          )}
        </div>
      </section>

      {/* ── STEP 3: Notas ────────────────────────────────────────────────── */}
      <section className="mb-7">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-5 h-5 rounded-full bg-[var(--color-surface-overlay)] border border-[var(--color-border-strong)] flex items-center justify-center text-[10px] font-bold text-[var(--color-text-subtle)] shrink-0">3</span>
          <p className="text-xs font-semibold text-[var(--color-text-subtle)] uppercase tracking-widest">Notas <span className="normal-case font-normal">(opcional)</span></p>
        </div>
        <textarea
          className="w-full surface rounded-2xl px-4 py-3.5 text-sm text-[var(--color-text)] placeholder-[var(--color-text-subtle)] resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] transition-all"
          rows={3}
          placeholder="Condiciones especiales, validez del presupuesto, próximos pasos..."
          value={notes}
          onChange={e => setNotes(e.target.value)}
        />
      </section>

      {/* ── Sticky bottom bar ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {cartItems.length > 0 && (
          <motion.div
            initial={{ y: 120, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 120, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 38 }}
            className="fixed bottom-0 left-0 right-0 lg:left-64 z-30 bg-[var(--color-surface)] border-t border-[var(--color-border)] backdrop-blur-sm"
          >
            <div className="max-w-2xl mx-auto px-4 py-3">
              {/* Summary line */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {cartItems.length} servicio{cartItems.length !== 1 ? 's' : ''}
                  </p>
                  <div className="flex gap-1">
                    {cartItems.map(i => (
                      <span key={i.service.id} className="text-[10px] bg-[var(--color-surface-raised)] text-[var(--color-text-muted)] px-2 py-0.5 rounded-full">
                        {i.service.name} {i.quantity > 1 && `×${i.quantity}`}
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  onClick={clearCart}
                  className="p-1.5 rounded-lg text-[var(--color-text-subtle)] hover:text-red-400 hover:bg-red-500/10 transition-all"
                  title="Vaciar selección"
                >
                  <Trash2 size={13} />
                </button>
              </div>

              {/* Total + Actions */}
              <div className="flex items-center gap-3">
                <div className="shrink-0">
                  <p className="text-[10px] text-[var(--color-text-subtle)] uppercase tracking-wide">Total</p>
                  <p className="text-xl font-bold text-[var(--color-text)] leading-tight">
                    {formatPrice(total, currency)}
                  </p>
                </div>
                <div className="flex gap-2 flex-1">
                  <Button
                    className="flex-1"
                    onClick={handleSend}
                    loading={sending}
                    leftIcon={<Send size={15} />}
                  >
                    Enviar Email
                  </Button>
                  <a
                    href={buildWhatsApp()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#25D366]/10 text-[#25D366] border border-[#25D366]/20 font-semibold text-sm hover:bg-[#25D366]/20 active:scale-95 transition-all whitespace-nowrap"
                  >
                    <MessageCircle size={15} />
                    <span className="hidden sm:inline">WhatsApp</span>
                  </a>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty state when no cart */}
      {cartItems.length === 0 && services.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 lg:left-auto lg:translate-x-0 lg:right-6 flex items-center gap-2 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-full px-4 py-2 text-xs text-[var(--color-text-muted)] shadow-card pointer-events-none">
          <ChevronRight size={12} className="text-[var(--color-primary)]" />
          Tocá <span className="font-semibold text-[var(--color-primary)] mx-1">+</span> para agregar servicios
        </div>
      )}
    </div>
  )
}
