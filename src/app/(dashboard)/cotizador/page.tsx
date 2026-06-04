'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, Minus, MessageCircle, ChevronRight, Trash2, Zap, RefreshCw,
  DollarSign, Download, X, Building2, User, FileText, Mail, Send,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Modal } from '@/components/ui/modal'
import { formatCurrency } from '@/lib/utils'
import type { Service } from '@/types'
import toast from 'react-hot-toast'

const BILLING_LABELS: Record<string, string> = {
  MONTHLY:  'mes',
  ANNUAL:   'año',
  ONE_TIME: 'único',
}

interface ExchangeRate { venta: number; compra: number; updatedAt: string }
interface CartItem      { service: Service; quantity: number }

interface SavedQuote {
  cotizacionId: string
  ref:          string
  orgName:      string
  primaryColor: string
  logoUrl:      string | null
  agentName:    string
  recipientName:  string
  recipientEmail: string
  empresaName?:   string
  cartItems:    CartItem[]
  total:        number
  currency:     string
  notes:        string
}

export default function CotizadorPage() {
  const [cart, setCart]                         = useState<Record<string, CartItem>>({})
  const [clientMode, setClientMode]             = useState<'existing' | 'manual'>('existing')
  const [selectedEmpresaId, setSelectedEmpresaId] = useState('')
  const [selectedContactEmail, setSelectedContactEmail] = useState('')
  const [selectedContactName,  setSelectedContactName]  = useState('')
  const [manualContactInput,   setManualContactInput]   = useState(false)  // "ingresar otro email"
  const [manualEmail, setManualEmail]           = useState('')
  const [manualName,  setManualName]            = useState('')
  const [notes,       setNotes]                 = useState('')
  const [saving,      setSaving]                = useState(false)
  const [sendingEmail, setSendingEmail]         = useState(false)
  const [showArs,     setShowArs]               = useState(false)

  // Post-save state
  const [savedQuote, setSavedQuote]   = useState<SavedQuote | null>(null)
  const [pdfBlobUrl, setPdfBlobUrl]   = useState<string | null>(null)
  const [pdfBase64,  setPdfBase64]    = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(false)

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => { if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl) }
  }, [pdfBlobUrl])

  // ── Queries ───────────────────────────────────────────────────────────────
  const { data: servicesData, isLoading: loadingServices } = useQuery({
    queryKey: ['services'],
    queryFn: async () => (await (await fetch('/api/services')).json()).data as Service[],
  })

  const { data: empresasData } = useQuery({
    queryKey: ['empresas-cotizador'],
    queryFn: async () => {
      const r = await fetch('/api/empresas?limit=200')
      if (!r.ok) return []
      return ((await r.json()).data ?? []) as Array<{ id: string; name: string; city?: string | null }>
    },
    staleTime: 5 * 60 * 1000,
  })

  const { data: contactsData } = useQuery({
    queryKey: ['contactos-empresa-cot', selectedEmpresaId],
    queryFn: async () => {
      const r = await fetch(`/api/contactos?empresaId=${selectedEmpresaId}&limit=50`)
      if (!r.ok) return []
      return ((await r.json()).data ?? []) as Array<{ id: string; firstName: string; lastName: string; email: string | null }>
    },
    enabled: !!selectedEmpresaId && clientMode === 'existing',
    staleTime: 2 * 60 * 1000,
  })

  const { data: rateData, isLoading: loadingRate, refetch: refetchRate } = useQuery({
    queryKey: ['exchange-rate'],
    queryFn: async () => {
      const r = await fetch('/api/exchange-rate')
      if (!r.ok) return null
      return (await r.json()).data as ExchangeRate
    },
    staleTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  const arsRate   = rateData?.venta ?? null
  const services  = servicesData ?? []
  const empresas  = Array.isArray(empresasData) ? empresasData : []
  const contacts  = (Array.isArray(contactsData) ? contactsData : []).filter(c => c.email)
  const cartItems = Object.values(cart)
  const total     = cartItems.reduce((s, i) => s + i.service.price * i.quantity, 0)
  const currency  = cartItems[0]?.service.currency ?? 'USD'

  const selectedEmpresa = empresas.find(e => e.id === selectedEmpresaId)

  const formatPrice = (usd: number, cur: string) => {
    if (!showArs || cur !== 'USD' || !arsRate) return formatCurrency(usd, cur)
    return `${formatCurrency(usd, 'USD')} (${formatCurrency(usd * arsRate, 'ARS')})`
  }

  // ── Cart ──────────────────────────────────────────────────────────────────
  const addItem    = (s: Service) => setCart(p => ({ ...p, [s.id]: { service: s, quantity: (p[s.id]?.quantity ?? 0) + 1 } }))
  const removeItem = (id: string) => setCart(p => {
    const item = p[id]; if (!item) return p
    if (item.quantity <= 1) { const n = { ...p }; delete n[id]; return n }
    return { ...p, [id]: { ...item, quantity: item.quantity - 1 } }
  })
  const setQuantity = (id: string, qty: number) => {
    const n = Math.max(1, isNaN(qty) ? 1 : qty)
    setCart(p => p[id] ? { ...p, [id]: { ...p[id], quantity: n } } : p)
  }
  const clearCart  = () => setCart({})

  // ── Recipient ─────────────────────────────────────────────────────────────
  const recipientEmail = clientMode === 'existing'
    ? (manualContactInput ? manualEmail : selectedContactEmail)
    : manualEmail
  const recipientName = clientMode === 'existing'
    ? (manualContactInput ? manualName : selectedContactName)
    : manualName

  // ── PDF generation ────────────────────────────────────────────────────────
  const buildPdf = async (quote: SavedQuote) => {
    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pw = 210, mg = 20, cw = pw - mg * 2

    const hex = quote.primaryColor.replace('#', '')
    const pr  = parseInt(hex.slice(0, 2), 16)
    const pg  = parseInt(hex.slice(2, 4), 16)
    const pb  = parseInt(hex.slice(4, 6), 16)

    // Header
    doc.setFillColor(pr, pg, pb)
    doc.rect(0, 0, pw, 42, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.text('PRESUPUESTO DE SERVICIOS', mg, 13)
    doc.setFontSize(20)
    doc.text(quote.orgName, mg, 25)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.text(new Date().toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' }), mg, 35)

    let y = 56
    doc.setTextColor(148, 163, 184); doc.setFontSize(8)
    doc.text(`REF: ${quote.ref}`, mg, y); y += 10

    doc.setTextColor(30, 41, 59); doc.setFont('helvetica', 'bold'); doc.setFontSize(11)
    doc.text(`Estimado/a ${quote.recipientName}:`, mg, y); y += 7
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(100, 116, 139)
    doc.text('A continuación encontrará el detalle de los servicios cotizados.', mg, y); y += 12

    // Table header
    doc.setFillColor(241, 245, 249); doc.rect(mg, y, cw, 8, 'F')
    doc.setTextColor(148, 163, 184); doc.setFontSize(7.5); doc.setFont('helvetica', 'bold')
    doc.text('SERVICIO', mg + 2, y + 5.5)
    doc.text('PERÍODO',  mg + cw * 0.6, y + 5.5, { align: 'center' })
    doc.text('PRECIO',   mg + cw - 2,   y + 5.5, { align: 'right' })
    y += 8

    quote.cartItems.forEach((item, idx) => {
      if (idx % 2 === 1) { doc.setFillColor(248, 250, 252); doc.rect(mg, y, cw, 9, 'F') }
      const lineTotal = item.service.price * item.quantity
      const label  = item.quantity > 1 ? `${item.service.name}  ×${item.quantity}` : item.service.name
      const period = BILLING_LABELS[item.service.billingCycle] ?? 'mes'
      const price  = new Intl.NumberFormat('es-AR', { style: 'currency', currency: item.service.currency, minimumFractionDigits: 0 }).format(lineTotal)

      doc.setTextColor(30, 41, 59); doc.setFontSize(9); doc.setFont('helvetica', 'normal')
      doc.text(label, mg + 2, y + 6)
      doc.setTextColor(100, 116, 139); doc.setFontSize(8.5)
      doc.text(period, mg + cw * 0.6, y + 6, { align: 'center' })
      doc.setTextColor(30, 41, 59); doc.setFont('helvetica', 'bold')
      doc.text(price, mg + cw - 2, y + 6, { align: 'right' })
      doc.setFont('helvetica', 'normal'); y += 9
    })

    // Total
    y += 2
    doc.setDrawColor(226, 232, 240); doc.line(mg, y, mg + cw, y); y += 6
    doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 41, 59)
    doc.text('Total', mg + 2, y)
    const totalStr = new Intl.NumberFormat('es-AR', { style: 'currency', currency: quote.currency, minimumFractionDigits: 0 }).format(quote.total)
    doc.setTextColor(pr, pg, pb); doc.setFontSize(13)
    doc.text(totalStr, mg + cw - 2, y, { align: 'right' }); y += 12

    // Notes
    if (quote.notes) {
      doc.setFillColor(248, 250, 252); doc.setDrawColor(pr, pg, pb)
      doc.roundedRect(mg, y, cw, 18, 2, 2, 'FD')
      doc.setTextColor(71, 85, 105); doc.setFontSize(8.5); doc.setFont('helvetica', 'bold')
      doc.text('Notas:', mg + 4, y + 6)
      doc.setFont('helvetica', 'normal')
      doc.text(doc.splitTextToSize(quote.notes, cw - 8), mg + 4, y + 12)
      y += 22
    }

    // Footer
    y += 6
    doc.setDrawColor(226, 232, 240); doc.line(mg, y, mg + cw, y); y += 6
    doc.setTextColor(148, 163, 184); doc.setFontSize(8); doc.setFont('helvetica', 'normal')
    doc.text(`Presupuesto preparado por ${quote.agentName} · ${quote.orgName}`, mg, y); y += 5
    doc.text('Este presupuesto es de carácter informativo y no constituye un contrato.', mg, y)

    return doc
  }

  // ── Save + generate PDF ───────────────────────────────────────────────────
  const handleSave = async () => {
    if (cartItems.length === 0) { toast.error('Seleccioná al menos un servicio'); return }
    if (!recipientEmail)        { toast.error('Ingresá el email del destinatario'); return }

    setSaving(true)
    try {
      const res = await fetch('/api/cotizador/send', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cartItems.map(i => ({
            serviceId:    i.service.id,
            name:         i.service.name,
            price:        i.service.price,
            currency:     i.service.currency,
            billingCycle: i.service.billingCycle,
            quantity:     i.quantity,
          })),
          empresaId:     clientMode === 'existing' ? selectedEmpresaId || null : null,
          recipientEmail,
          recipientName: recipientName || 'Cliente',
          notes,
          total,
          currency,
        }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'Error al guardar'); return }

      const quote: SavedQuote = {
        cotizacionId:  json.cotizacionId,
        ref:           json.ref,
        orgName:       json.orgName,
        primaryColor:  json.primaryColor,
        logoUrl:       json.logoUrl,
        agentName:     json.agentName,
        recipientName: recipientName || 'Cliente',
        recipientEmail,
        empresaName:   selectedEmpresa?.name,
        cartItems:     [...cartItems],
        total,
        currency,
        notes,
      }

      // Generate PDF immediately
      const doc        = await buildPdf(quote)
      const blobUrl    = doc.output('bloburl') as unknown as string
      const dataUri    = doc.output('datauristring') as unknown as string

      setSavedQuote(quote)
      setPdfBlobUrl(blobUrl)
      setPdfBase64(dataUri)
      setShowPreview(true)
    } catch (err) {
      console.error(err)
      toast.error('Error al generar el presupuesto')
    } finally {
      setSaving(false)
    }
  }

  // ── Download PDF ──────────────────────────────────────────────────────────
  const downloadPdf = () => {
    if (!pdfBlobUrl || !savedQuote) return
    const a = document.createElement('a')
    a.href     = pdfBlobUrl
    a.download = `${savedQuote.ref}.pdf`
    a.click()
  }

  // ── Send by email ─────────────────────────────────────────────────────────
  const sendByEmail = async () => {
    if (!savedQuote || !pdfBase64) return
    setSendingEmail(true)
    try {
      const res = await fetch('/api/cotizador/enviar-mail', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cotizacionId: savedQuote.cotizacionId, pdfBase64 }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'Error al enviar'); return }
      toast.success(`Email enviado a ${savedQuote.recipientEmail}`)
    } catch {
      toast.error('Error de conexión')
    } finally {
      setSendingEmail(false)
    }
  }

  // ── WhatsApp ──────────────────────────────────────────────────────────────
  const buildWhatsApp = (quote?: SavedQuote) => {
    const src = quote ?? { recipientName: recipientName || '', cartItems, total, currency, notes: notes || '', ref: '' }
    let t = `*Presupuesto de Servicios*`
    if (src.ref) t += ` · ${src.ref}`
    t += `\n\n`
    if (src.recipientName) t += `Hola ${src.recipientName},\n\nTe comparto el detalle:\n\n`
    src.cartItems.forEach(i => {
      const lt = i.service.price * i.quantity
      let l = `• ${i.service.name}`
      if (i.quantity > 1) l += ` ×${i.quantity}`
      l += ` — ${formatCurrency(lt, i.service.currency)}/${BILLING_LABELS[i.service.billingCycle] ?? 'mes'}`
      if (showArs && arsRate && i.service.currency === 'USD') l += ` (${formatCurrency(lt * arsRate, 'ARS')})`
      t += l + '\n'
    })
    t += `\n*Total: ${formatCurrency(src.total, src.currency)}*`
    if (showArs && arsRate && src.currency === 'USD') t += ` (ARS ${formatCurrency(src.total * arsRate, 'ARS')})`
    if (src.notes) t += `\n\n📝 ${src.notes}`
    t += `\n\nCualquier consulta, estamos a disposición.`
    return `https://wa.me/?text=${encodeURIComponent(t)}`
  }

  // ── Reset ─────────────────────────────────────────────────────────────────
  const reset = () => {
    if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl)
    setSavedQuote(null); setPdfBlobUrl(null); setPdfBase64(null); setShowPreview(false)
    setCart({}); setManualEmail(''); setManualName(''); setNotes('')
    setSelectedEmpresaId(''); setSelectedContactEmail(''); setSelectedContactName('')
    setManualContactInput(false)
  }

  // ── PDF Preview Modal ─────────────────────────────────────────────────────
  if (showPreview && savedQuote) {
    return (
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold" style={{ color: 'var(--color-text)' }}>Vista previa del presupuesto</h2>
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              {savedQuote.ref} · {savedQuote.recipientName} · {formatCurrency(savedQuote.total, savedQuote.currency)}
              {savedQuote.empresaName && ` · ${savedQuote.empresaName}`}
            </p>
          </div>
          <button onClick={reset} className="p-2 rounded-lg transition-colors hover:bg-[var(--color-surface-raised)]"
            style={{ color: 'var(--color-text-muted)' }}>
            <X size={18} />
          </button>
        </div>

        {/* PDF iframe preview */}
        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--color-border)', height: '520px' }}>
          {pdfBlobUrl ? (
            <iframe
              src={pdfBlobUrl}
              title="Vista previa del presupuesto"
              className="w-full h-full"
              style={{ border: 'none' }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center" style={{ color: 'var(--color-text-muted)' }}>
              Generando vista previa...
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Descargar */}
          <button
            onClick={downloadPdf}
            className="flex items-center gap-3 px-4 py-4 rounded-2xl border transition-all hover:border-[var(--color-primary)] hover:bg-[var(--color-primary)]/5"
            style={{ border: '1px solid var(--color-border)', background: 'var(--color-surface)' }}
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'var(--color-primary)' }}>
              <Download size={18} className="text-white" />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Descargar Presupuesto</p>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{savedQuote.ref}.pdf</p>
            </div>
          </button>

          {/* Enviar por Mail */}
          <button
            onClick={sendByEmail}
            disabled={sendingEmail}
            className="flex items-center gap-3 px-4 py-4 rounded-2xl border transition-all hover:border-[var(--color-primary)] hover:bg-[var(--color-primary)]/5 disabled:opacity-60"
            style={{ border: '1px solid var(--color-border)', background: 'var(--color-surface)' }}
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: '#6366f1' }}>
              <Mail size={18} className="text-white" />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                {sendingEmail ? 'Enviando...' : 'Enviar por Mail'}
              </p>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Con PDF adjunto</p>
            </div>
          </button>

          {/* WhatsApp */}
          <a
            href={buildWhatsApp(savedQuote)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-4 py-4 rounded-2xl border transition-all hover:border-[#25D366] hover:bg-[#25D366]/5"
            style={{ border: '1px solid var(--color-border)', background: 'var(--color-surface)' }}
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#25D366' }}>
              <MessageCircle size={18} className="text-white" />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Enviar por WhatsApp</p>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Con resumen y totales</p>
            </div>
          </a>
        </div>

        <button onClick={reset} className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          + Nuevo presupuesto
        </button>
      </div>
    )
  }

  // ── Main form ─────────────────────────────────────────────────────────────
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
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Armá un presupuesto en segundos</p>
          </div>

          {/* Dólar widget */}
          <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl shrink-0"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            <div className="flex items-center gap-1.5">
              <DollarSign size={14} style={{ color: 'var(--color-primary)' }} />
              <span className="text-xs font-semibold" style={{ color: 'var(--color-text-muted)' }}>USD oficial</span>
            </div>
            {loadingRate ? (
              <span className="text-sm font-bold animate-pulse" style={{ color: 'var(--color-text-subtle)' }}>—</span>
            ) : arsRate ? (
              <span className="text-sm font-bold" style={{ color: 'var(--color-text)' }}>
                ${arsRate.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            ) : <span className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>N/A</span>}
            <button onClick={() => refetchRate()} className="p-1 rounded-lg hover:bg-[var(--color-surface-raised)]"
              style={{ color: 'var(--color-text-subtle)' }}>
              <RefreshCw size={12} />
            </button>
            {arsRate && (
              <button onClick={() => setShowArs(v => !v)}
                className="px-2 py-1 rounded-lg text-xs font-semibold transition-all"
                style={showArs
                  ? { background: 'var(--color-primary)', color: '#fff' }
                  : { background: 'var(--color-surface-raised)', color: 'var(--color-text-muted)' }}>
                {showArs ? 'ARS ✓' : 'Ver ARS'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── STEP 1: Servicios ─────────────────────────────────────────── */}
      <section className="mb-7">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-5 h-5 rounded-full gradient-bg flex items-center justify-center text-[10px] font-bold text-white shrink-0">1</span>
          <p className="text-xs font-semibold text-[var(--color-text-subtle)] uppercase tracking-widest">Elegí los servicios</p>
        </div>

        {loadingServices ? (
          <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-20 surface rounded-2xl animate-pulse" />)}</div>
        ) : services.length === 0 ? (
          <div className="surface rounded-2xl p-8 text-center">
            <FileText size={32} className="mx-auto mb-3 text-[var(--color-text-subtle)]" />
            <p className="text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>Sin servicios configurados</p>
            <p className="text-xs mt-1" style={{ color: 'var(--color-text-subtle)' }}>Configurá los servicios en Ajustes → Servicios</p>
          </div>
        ) : (
          <div className="space-y-2">
            {services.map(service => {
              const qty      = cart[service.id]?.quantity ?? 0
              const selected = qty > 0
              return (
                <div key={service.id}
                  className={`rounded-2xl p-4 flex items-center gap-4 transition-all duration-150 border ${
                    selected ? 'bg-[var(--color-primary)]/8 border-[var(--color-primary)]/30'
                             : 'bg-[var(--color-surface)] border-[var(--color-border)]'
                  }`}>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[15px]" style={{ color: 'var(--color-text)' }}>{service.name}</p>
                    {service.description && <p className="text-xs mt-0.5 line-clamp-1" style={{ color: 'var(--color-text-muted)' }}>{service.description}</p>}
                    <p className="mt-1.5 flex items-baseline gap-1">
                      <span className={`text-base font-bold ${selected ? 'text-[var(--color-primary)]' : 'text-[var(--color-text)]'}`}>
                        {formatPrice(service.price, service.currency)}
                      </span>
                      <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>/{BILLING_LABELS[service.billingCycle] ?? 'mes'}</span>
                    </p>
                  </div>

                  {/* [ − ] [input] [ + ] */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <AnimatePresence>
                      {selected && (
                        <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
                          className="flex items-center gap-1.5">
                          <button onClick={() => removeItem(service.id)}
                            className="w-9 h-9 rounded-full flex items-center justify-center active:scale-90 transition-all"
                            style={{ background: 'var(--color-surface-raised)', color: 'var(--color-text-muted)' }}>
                            <Minus size={14} />
                          </button>
                          <input type="number" min="1" value={qty}
                            onChange={e => setQuantity(service.id, parseInt(e.target.value))}
                            className="w-14 text-center text-sm font-bold rounded-lg border outline-none py-1.5"
                            style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border-strong)', color: 'var(--color-text)' }}
                          />
                        </motion.div>
                      )}
                    </AnimatePresence>
                    <button onClick={() => addItem(service)}
                      className={`w-10 h-10 rounded-full flex items-center justify-center active:scale-90 transition-all font-bold ${
                        selected ? 'gradient-bg text-white shadow-glow'
                                 : 'bg-[var(--color-surface-raised)] text-[var(--color-text-muted)] hover:bg-[var(--color-primary)]/15 hover:text-[var(--color-primary)]'
                      }`}>
                      <Plus size={18} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* ── STEP 2: Destinatario ──────────────────────────────────────── */}
      <section className="mb-7">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-5 h-5 rounded-full gradient-bg flex items-center justify-center text-[10px] font-bold text-white shrink-0">2</span>
          <p className="text-xs font-semibold text-[var(--color-text-subtle)] uppercase tracking-widest">Destinatario</p>
        </div>

        <div className="surface rounded-2xl p-4 space-y-3">
          {/* Mode toggle */}
          <div className="flex rounded-xl overflow-hidden border border-[var(--color-border)] p-0.5 bg-[var(--color-surface-raised)]">
            {(['existing', 'manual'] as const).map(mode => (
              <button key={mode} onClick={() => { setClientMode(mode); setManualContactInput(false) }}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                  clientMode === mode ? 'gradient-bg text-white shadow-sm' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                }`}>
                {mode === 'existing' ? 'Empresa del CRM' : 'Email directo'}
              </button>
            ))}
          </div>

          {clientMode === 'existing' ? (
            <div className="space-y-3">
              {/* Empresa selector */}
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>
                  <Building2 size={11} className="inline mr-1" />Empresa
                </label>
                <Select
                  options={[
                    { value: '', label: 'Seleccionar empresa...' },
                    ...empresas.map(e => ({ value: e.id, label: e.city ? `${e.name}  (${e.city})` : e.name })),
                  ]}
                  value={selectedEmpresaId}
                  onChange={e => {
                    setSelectedEmpresaId(e.target.value)
                    setSelectedContactEmail(''); setSelectedContactName('')
                    setManualContactInput(false); setManualEmail(''); setManualName('')
                  }}
                />
              </div>

              {/* Contact picker */}
              {selectedEmpresaId && (
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>
                    <User size={11} className="inline mr-1" />Contacto destinatario
                  </label>

                  {contacts.length > 0 && !manualContactInput ? (
                    <Select
                      options={[
                        { value: '', label: 'Seleccionar contacto...' },
                        ...contacts.map(c => ({ value: `${c.email}||${c.firstName} ${c.lastName}`, label: `${c.firstName} ${c.lastName} — ${c.email}` })),
                        { value: '__manual__', label: '— Ingresar otro email —' },
                      ]}
                      value={selectedContactEmail ? `${selectedContactEmail}||${selectedContactName}` : ''}
                      onChange={e => {
                        if (e.target.value === '__manual__') {
                          setManualContactInput(true)
                          setSelectedContactEmail(''); setSelectedContactName('')
                        } else {
                          const [email, name] = e.target.value.split('||')
                          setSelectedContactEmail(email ?? '')
                          setSelectedContactName(name ?? '')
                        }
                      }}
                    />
                  ) : (
                    <div className="space-y-2">
                      {contacts.length > 0 && (
                        <button onClick={() => setManualContactInput(false)}
                          className="text-xs" style={{ color: 'var(--color-primary)' }}>
                          ← Volver a los contactos registrados
                        </button>
                      )}
                      <Input placeholder="Nombre del contacto" value={manualName}
                        onChange={e => setManualName(e.target.value)} leftIcon={<User size={14} />} />
                      <Input type="email" placeholder="email@empresa.com" value={manualEmail}
                        onChange={e => setManualEmail(e.target.value)} />
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <Input placeholder="Nombre del destinatario" value={manualName}
                onChange={e => setManualName(e.target.value)} leftIcon={<User size={14} />} />
              <Input type="email" placeholder="email@empresa.com" value={manualEmail}
                onChange={e => setManualEmail(e.target.value)} />
            </div>
          )}

          {/* Preview chip */}
          {recipientEmail && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
              className="flex items-center gap-2 px-3 py-2 rounded-xl"
              style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
              <span className="text-xs font-medium" style={{ color: '#10b981' }}>
                {recipientName && `${recipientName} — `}{recipientEmail}
              </span>
            </motion.div>
          )}
        </div>
      </section>

      {/* ── STEP 3: Notas ─────────────────────────────────────────────── */}
      <section className="mb-7">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-[var(--color-text-subtle)] shrink-0"
            style={{ background: 'var(--color-surface-overlay)', border: '1px solid var(--color-border-strong)' }}>3</span>
          <p className="text-xs font-semibold text-[var(--color-text-subtle)] uppercase tracking-widest">
            Notas <span className="normal-case font-normal">(opcional)</span>
          </p>
        </div>
        <textarea
          className="w-full surface rounded-2xl px-4 py-3.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 transition-all"
          style={{ color: 'var(--color-text)' }}
          rows={3}
          placeholder="Condiciones especiales, validez del presupuesto, próximos pasos..."
          value={notes}
          onChange={e => setNotes(e.target.value)}
        />
      </section>

      {/* ── Sticky bottom bar ─────────────────────────────────────────── */}
      <AnimatePresence>
        {cartItems.length > 0 && (
          <motion.div
            initial={{ y: 120, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 120, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 38 }}
            className="fixed bottom-0 left-0 right-0 lg:left-64 z-30 border-t backdrop-blur-sm"
            style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
          >
            <div className="max-w-2xl mx-auto px-4 py-3">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    {cartItems.length} servicio{cartItems.length !== 1 ? 's' : ''}
                  </p>
                  <div className="flex gap-1 flex-wrap">
                    {cartItems.map(i => (
                      <span key={i.service.id} className="text-[10px] px-2 py-0.5 rounded-full"
                        style={{ background: 'var(--color-surface-raised)', color: 'var(--color-text-muted)' }}>
                        {i.service.name}{i.quantity > 1 && ` ×${i.quantity}`}
                      </span>
                    ))}
                  </div>
                </div>
                <button onClick={clearCart} className="p-1.5 rounded-lg hover:text-red-400 hover:bg-red-500/10 transition-all"
                  style={{ color: 'var(--color-text-subtle)' }} title="Vaciar selección">
                  <Trash2 size={13} />
                </button>
              </div>

              <div className="flex items-center gap-3">
                <div className="shrink-0">
                  <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--color-text-subtle)' }}>Total</p>
                  <p className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>{formatPrice(total, currency)}</p>
                </div>
                <div className="flex gap-2 flex-1">
                  <Button className="flex-1" onClick={handleSave} loading={saving} leftIcon={<Send size={15} />}>
                    Generar Presupuesto
                  </Button>
                  <a href={buildWhatsApp()} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm active:scale-95 transition-all whitespace-nowrap"
                    style={{ background: 'rgba(37,211,102,0.1)', color: '#25D366', border: '1px solid rgba(37,211,102,0.2)' }}>
                    <MessageCircle size={15} />
                    <span className="hidden sm:inline">WhatsApp</span>
                  </a>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {cartItems.length === 0 && services.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 lg:left-auto lg:translate-x-0 lg:right-6 flex items-center gap-2 rounded-full px-4 py-2 text-xs pointer-events-none shadow-card"
          style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}>
          <ChevronRight size={12} style={{ color: 'var(--color-primary)' }} />
          Tocá <span className="font-semibold mx-1" style={{ color: 'var(--color-primary)' }}>+</span> para agregar servicios
        </div>
      )}
    </div>
  )
}
