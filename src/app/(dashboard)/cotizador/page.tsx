'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, Minus, MessageCircle, ChevronRight, Trash2, Zap, RefreshCw,
  DollarSign, Download, X, Building2, User, FileText, Mail, Send,
  TrendingUp, CheckCircle, Search, Package, Wrench, Tag, Clock,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { formatCurrency } from '@/lib/utils'
import { loadLogoForPdf, drawPdfHeader, drawValidityNote, drawNotesBox, drawBrandedFooter } from '@/lib/pdf-branding'
import type { Service, Product } from '@/types'
import toast from 'react-hot-toast'

// ── Constants ─────────────────────────────────────────────────────────────────

const BILLING_LABELS: Record<string, string> = {
  MONTHLY:  'mes',
  ANNUAL:   'año',
  ONE_TIME: 'único',
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface ExchangeRate { venta: number; compra: number; updatedAt: string }

type ItemType = 'SERVICE' | 'PRODUCT'
interface CartItem {
  type:     ItemType
  item:     Service | Product
  quantity: number
}

const itemKey  = (type: ItemType, id: string) => `${type}_${id}`
const getPrice = (ci: CartItem) => ci.item.price
const getCurrency = (ci: CartItem) => ci.item.currency

interface SavedQuote {
  cotizacionId:   string
  ref:            string
  orgName:        string
  primaryColor:   string
  logoUrl:        string | null
  agentName:      string
  recipientName:  string
  recipientEmail: string
  empresaName?:   string
  cartItems:      CartItem[]
  subtotal:       number
  discount:       number
  finalTotal:     number
  currency:       string
  notes:          string
  validityDays:   number
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CotizadorPage() {
  // ── State ──────────────────────────────────────────────────────────────────
  const [cart,       setCart]       = useState<Record<string, CartItem>>({})
  const [activeTab,  setActiveTab]  = useState<ItemType>('SERVICE')
  const [discount,   setDiscount]   = useState(0)
  const [validityDays, setValidityDays] = useState(30)
  const [validityTouched, setValidityTouched] = useState(false)
  const [itemSearch, setItemSearch] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)

  const [clientMode,              setClientMode]              = useState<'existing' | 'manual'>('existing')
  const [selectedEmpresaId,       setSelectedEmpresaId]       = useState('')
  const [selectedContactEmail,    setSelectedContactEmail]    = useState('')
  const [selectedContactName,     setSelectedContactName]     = useState('')
  const [manualContactInput,      setManualContactInput]      = useState(false)
  const [manualEmail,             setManualEmail]             = useState('')
  const [manualName,              setManualName]              = useState('')
  const [notes,                   setNotes]                   = useState('')
  const [saving,                  setSaving]                  = useState(false)
  const [sendingEmail,            setSendingEmail]            = useState(false)
  const [showArs,                 setShowArs]                 = useState(false)
  const [addingToPipeline,        setAddingToPipeline]        = useState(false)
  const [pipelineAdded,           setPipelineAdded]           = useState(false)

  const [savedQuote,  setSavedQuote]  = useState<SavedQuote | null>(null)
  const [pdfBlobUrl,  setPdfBlobUrl]  = useState<string | null>(null)
  const [pdfBase64,   setPdfBase64]   = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(false)

  useEffect(() => { return () => { if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl) } }, [pdfBlobUrl])

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: servicesData, isLoading: loadingServices } = useQuery({
    queryKey: ['services'],
    queryFn:  async () => (await fetch('/api/services')).json().then(j => j.data as Service[]),
  })
  const { data: productsData, isLoading: loadingProducts } = useQuery({
    queryKey: ['products'],
    queryFn:  async () => (await fetch('/api/products')).json().then(j => j.data as Product[]),
  })
  const { data: empresasData } = useQuery({
    queryKey: ['empresas-cotizador'],
    queryFn:  async () => {
      const r = await fetch('/api/empresas?limit=200')
      if (!r.ok) return []
      return ((await r.json()).data ?? []) as Array<{ id: string; name: string; city?: string | null }>
    },
    staleTime: 5 * 60_000,
  })
  const { data: contactsData } = useQuery({
    queryKey: ['contactos-empresa-cot', selectedEmpresaId],
    queryFn:  async () => {
      const r = await fetch(`/api/contactos?empresaId=${selectedEmpresaId}&limit=50`)
      if (!r.ok) return []
      return ((await r.json()).data ?? []) as Array<{ id: string; firstName: string; lastName: string; email: string | null }>
    },
    enabled:   !!selectedEmpresaId && clientMode === 'existing',
    staleTime: 2 * 60_000,
  })
  const { data: cotizadorConfig } = useQuery({
    queryKey: ['cotizador-config'],
    queryFn:  async () => {
      const r = await fetch('/api/cotizador/config')
      if (!r.ok) return null
      return (await r.json()).data as { quoteValidityDays: number } | null
    },
    staleTime: 5 * 60_000,
  })

  useEffect(() => {
    if (cotizadorConfig?.quoteValidityDays && !validityTouched) {
      setValidityDays(cotizadorConfig.quoteValidityDays)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cotizadorConfig])

  const { data: rateData, isLoading: loadingRate, refetch: refetchRate } = useQuery({
    queryKey: ['exchange-rate'],
    queryFn:  async () => {
      const r = await fetch('/api/exchange-rate')
      if (!r.ok) return null
      return (await r.json()).data as ExchangeRate
    },
    staleTime: 30 * 60_000,
    refetchOnWindowFocus: false,
  })

  const arsRate  = rateData?.venta ?? null
  const services = servicesData ?? []
  const products = productsData ?? []
  const empresas = Array.isArray(empresasData) ? empresasData : []
  const contacts = (Array.isArray(contactsData) ? contactsData : []).filter(c => c.email)

  const cartItems  = Object.values(cart)
  const subtotal   = cartItems.reduce((s, i) => s + getPrice(i) * i.quantity, 0)
  const discountAmt = subtotal * (discount / 100)
  const finalTotal = subtotal - discountAmt
  const currency   = cartItems[0] ? getCurrency(cartItems[0]) : 'USD'

  const selectedEmpresa = empresas.find(e => e.id === selectedEmpresaId)

  const formatPrice = (usd: number, cur: string) => {
    if (!showArs || cur !== 'USD' || !arsRate) return formatCurrency(usd, cur)
    return `${formatCurrency(usd, 'USD')} (${formatCurrency(usd * arsRate, 'ARS')})`
  }

  // ── Cart ops ───────────────────────────────────────────────────────────────
  const addItem = (type: ItemType, item: Service | Product) => {
    const k = itemKey(type, item.id)
    if (cartItems.length > 0 && item.currency !== currency) {
      toast.error(`No se pueden mezclar monedas (el carrito está en ${currency})`)
      return
    }
    setCart(p => ({ ...p, [k]: { type, item, quantity: (p[k]?.quantity ?? 0) + 1 } }))
  }
  const removeItem = (key: string) => setCart(p => {
    const ci = p[key]; if (!ci) return p
    if (ci.quantity <= 1) { const n = { ...p }; delete n[key]; return n }
    return { ...p, [key]: { ...ci, quantity: ci.quantity - 1 } }
  })
  const setQty = (key: string, qty: number) => {
    const n = Math.max(1, isNaN(qty) ? 1 : qty)
    setCart(p => p[key] ? { ...p, [key]: { ...p[key], quantity: n } } : p)
  }
  const clearCart = () => setCart({})

  // Current catalog filtered by tab + search
  const catalog: Array<{ type: ItemType; item: Service | Product }> =
    activeTab === 'SERVICE'
      ? services.map(s => ({ type: 'SERVICE' as const, item: s }))
      : products.map(p => ({ type: 'PRODUCT' as const, item: p }))

  const filteredCatalog = catalog.filter(({ item }) =>
    !itemSearch || item.name.toLowerCase().includes(itemSearch.toLowerCase())
  )

  // ── Recipient ──────────────────────────────────────────────────────────────
  const recipientEmail = clientMode === 'existing'
    ? (manualContactInput ? manualEmail : selectedContactEmail)
    : manualEmail
  const recipientName = clientMode === 'existing'
    ? (manualContactInput ? manualName : selectedContactName)
    : manualName

  // ── PDF ────────────────────────────────────────────────────────────────────
  const buildPdf = async (quote: SavedQuote) => {
    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pw = 210, mg = 18, cw = pw - mg * 2

    const hex = (quote.primaryColor ?? '#6366f1').replace('#', '').padEnd(6, '0')
    const pr = parseInt(hex.slice(0, 2), 16)
    const pg = parseInt(hex.slice(2, 4), 16)
    const pb = parseInt(hex.slice(4, 6), 16)

    // Load logo (rasterized to PNG via canvas so any source format renders correctly)
    const logo = await loadLogoForPdf(quote.logoUrl)
    const today = new Date()

    const headerH = drawPdfHeader(doc, {
      pw, mg, pr, pg, pb, logo,
      orgName:   quote.orgName,
      kicker:    'Presupuesto',
      dateLabel: today.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' }),
    })

    let y = headerH + 12
    doc.setTextColor(148, 163, 184); doc.setFontSize(7.5)
    doc.text(`Ref: ${quote.ref}`, mg, y); y += 10

    doc.setTextColor(30, 41, 59); doc.setFont('helvetica', 'bold'); doc.setFontSize(11)
    doc.text(`Estimado/a ${quote.recipientName}:`, mg, y); y += 7
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(100, 116, 139)
    doc.text('A continuación encontrará el detalle de los ítems cotizados.', mg, y); y += 12

    y = drawValidityNote(doc, { mg, cw, y, pr, pg, pb, validityDays: quote.validityDays, fromDate: today })

    // Table header
    doc.setFillColor(pr, pg, pb)
    doc.rect(mg, y, cw, 8.5, 'F')
    doc.setTextColor(255, 255, 255); doc.setFontSize(7.5); doc.setFont('helvetica', 'bold')
    doc.text('ÍTEM',     mg + 3,        y + 5.8)
    doc.text('TIPO',     mg + cw * 0.52, y + 5.8, { align: 'center' })
    doc.text('CANT.',    mg + cw * 0.70, y + 5.8, { align: 'center' })
    doc.text('TOTAL',    mg + cw - 2,   y + 5.8, { align: 'right' })
    y += 8.5

    quote.cartItems.forEach((ci, idx) => {
      const rowH     = 10
      if (idx % 2 === 1) { doc.setFillColor(246, 248, 252); doc.rect(mg, y, cw, rowH, 'F') }
      const lineTotal = getPrice(ci) * ci.quantity
      const priceStr  = new Intl.NumberFormat('es-AR', { style: 'currency', currency: quote.currency, minimumFractionDigits: 0 }).format(lineTotal)
      const typeLabel = ci.type === 'SERVICE'
        ? (BILLING_LABELS[((ci.item as Service).billingCycle ?? 'MONTHLY')] ?? 'mes')
        : `× ${(ci.item as Product).unit}`

      doc.setTextColor(30, 41, 59); doc.setFontSize(9); doc.setFont('helvetica', 'normal')
      doc.text(ci.item.name, mg + 3, y + 7)

      // Type badge
      doc.setFillColor(ci.type === 'SERVICE' ? pr : 245, ci.type === 'SERVICE' ? pg : 158, ci.type === 'SERVICE' ? pb : 11)
      doc.roundedRect(mg + cw * 0.44, y + 2.5, 22, 5, 1, 1, 'F')
      doc.setTextColor(255, 255, 255); doc.setFontSize(7)
      doc.text(ci.type === 'SERVICE' ? 'SERVICIO' : 'PRODUCTO', mg + cw * 0.55, y + 6.3, { align: 'center' })

      doc.setTextColor(100, 116, 139); doc.setFontSize(8)
      doc.text(`${ci.quantity} ${typeLabel}`, mg + cw * 0.70, y + 7, { align: 'center' })
      doc.setTextColor(30, 41, 59); doc.setFont('helvetica', 'bold'); doc.setFontSize(9)
      doc.text(priceStr, mg + cw - 2, y + 7, { align: 'right' })
      doc.setFont('helvetica', 'normal'); y += rowH
    })

    // Totals section
    y += 4
    doc.setDrawColor(226, 232, 240); doc.line(mg, y, mg + cw, y); y += 6

    const subtotalStr = new Intl.NumberFormat('es-AR', { style: 'currency', currency: quote.currency, minimumFractionDigits: 0 }).format(quote.subtotal)
    const finalStr    = new Intl.NumberFormat('es-AR', { style: 'currency', currency: quote.currency, minimumFractionDigits: 0 }).format(quote.finalTotal)

    const boxW = 74, boxX = mg + cw - boxW
    doc.setFillColor(246, 248, 252)
    doc.roundedRect(boxX, y, boxW, quote.discount > 0 ? 28 : 16, 2, 2, 'F')
    doc.setFillColor(pr, pg, pb)
    doc.rect(boxX, y, 3, quote.discount > 0 ? 28 : 16, 'F')

    doc.setFontSize(8); doc.setTextColor(100, 116, 139); doc.setFont('helvetica', 'normal')
    doc.text('Subtotal', boxX + 7, y + 6)
    doc.setTextColor(30, 41, 59); doc.setFont('helvetica', 'bold')
    doc.text(subtotalStr, boxX + boxW - 4, y + 6, { align: 'right' })

    if (quote.discount > 0) {
      const discAmt = quote.subtotal - quote.finalTotal
      const discStr = new Intl.NumberFormat('es-AR', { style: 'currency', currency: quote.currency, minimumFractionDigits: 0 }).format(discAmt)
      doc.setFont('helvetica', 'normal'); doc.setTextColor(16, 185, 129); doc.setFontSize(8)
      doc.text(`Descuento (${quote.discount}%)`, boxX + 7, y + 13)
      doc.setFont('helvetica', 'bold')
      doc.text(`-${discStr}`, boxX + boxW - 4, y + 13, { align: 'right' })

      doc.setDrawColor(226, 232, 240); doc.line(boxX + 4, y + 16, boxX + boxW - 2, y + 16)
      doc.setFontSize(11); doc.setTextColor(pr, pg, pb); doc.setFont('helvetica', 'bold')
      doc.text('TOTAL', boxX + 7, y + 24)
      doc.text(finalStr, boxX + boxW - 4, y + 24, { align: 'right' })
      y += 36
    } else {
      doc.setFontSize(12); doc.setTextColor(pr, pg, pb); doc.setFont('helvetica', 'bold')
      doc.text('TOTAL', boxX + 7, y + 13)
      doc.text(finalStr, boxX + boxW - 4, y + 13, { align: 'right' })
      y += 24
    }

    // Notes
    if (quote.notes) {
      y = drawNotesBox(doc, { mg, cw, y, pr, pg, pb, notes: quote.notes, maxY: 297 - 18 - 6 })
    }

    // Footer
    drawBrandedFooter(doc, {
      pw, mg, y: 297 - 18, pr, pg, pb,
      leftText: `${quote.agentName} · ${new Date().toLocaleDateString('es-AR')}`,
    })

    return doc
  }

  // ── Save ───────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (cartItems.length === 0) { toast.error('Seleccioná al menos un ítem'); return }
    if (!recipientEmail)        { toast.error('Ingresá el email del destinatario'); return }

    setSaving(true)
    try {
      const items = cartItems.map(ci => ({
        type:         ci.type,
        serviceId:    ci.type === 'SERVICE' ? ci.item.id : undefined,
        productId:    ci.type === 'PRODUCT' ? ci.item.id : undefined,
        name:         ci.item.name,
        price:        ci.item.price,
        currency:     ci.item.currency,
        billingCycle: ci.type === 'SERVICE' ? (ci.item as Service).billingCycle : undefined,
        unit:         ci.type === 'PRODUCT' ? (ci.item as Product).unit : undefined,
        quantity:     ci.quantity,
      }))

      const res  = await fetch('/api/cotizador/send', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items, empresaId: clientMode === 'existing' ? selectedEmpresaId || null : null,
          recipientEmail, recipientName: recipientName || 'Cliente',
          notes, total: subtotal, discount, currency, validityDays,
        }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'Error al guardar'); return }

      const quote: SavedQuote = {
        cotizacionId: json.cotizacionId,
        ref:          json.ref,
        orgName:      json.orgName,
        primaryColor: json.primaryColor,
        logoUrl:      json.logoUrl,
        agentName:    json.agentName,
        recipientName: recipientName || 'Cliente',
        recipientEmail,
        empresaName:  selectedEmpresa?.name,
        cartItems:    [...cartItems],
        subtotal,
        discount:     json.discount,
        finalTotal:   json.finalTotal,
        currency,
        notes,
        validityDays: json.validityDays ?? validityDays,
      }

      const doc     = await buildPdf(quote)
      const blobUrl = doc.output('bloburl') as unknown as string
      const dataUri = doc.output('datauristring') as unknown as string

      setSavedQuote(quote); setPdfBlobUrl(blobUrl); setPdfBase64(dataUri); setShowPreview(true)
    } catch (err) {
      console.error(err); toast.error('Error al generar el presupuesto')
    } finally { setSaving(false) }
  }

  const downloadPdf = () => {
    if (!pdfBlobUrl || !savedQuote) return
    const a = document.createElement('a'); a.href = pdfBlobUrl; a.download = `${savedQuote.ref}.pdf`; a.click()
  }

  const sendByEmail = async () => {
    if (!savedQuote || !pdfBase64) return
    setSendingEmail(true)
    try {
      const res  = await fetch('/api/cotizador/enviar-mail', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cotizacionId: savedQuote.cotizacionId, pdfBase64 }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'Error al enviar'); return }
      toast.success(`Email enviado a ${savedQuote.recipientEmail}`)
    } catch { toast.error('Error de conexión') } finally { setSendingEmail(false) }
  }

  const buildWhatsApp = (quote?: SavedQuote) => {
    const src = quote ?? { recipientName: recipientName || '', cartItems, subtotal, finalTotal, discount, currency, notes: notes || '', ref: '' }
    let t = `*Presupuesto de Servicios*`
    if ((src as any).ref) t += ` · ${(src as any).ref}`
    t += `\n\n`
    if (src.recipientName) t += `Hola ${src.recipientName},\n\nTe comparto el detalle:\n\n`
    src.cartItems.forEach(ci => {
      const lt = getPrice(ci) * ci.quantity
      let l = `• ${ci.item.name}`
      if (ci.quantity > 1) l += ` ×${ci.quantity}`
      if (ci.type === 'SERVICE') {
        const bl = BILLING_LABELS[(ci.item as Service).billingCycle] ?? 'mes'
        l += ` — ${formatCurrency(lt, ci.item.currency)}/${bl}`
      } else {
        l += ` — ${formatCurrency(lt, ci.item.currency)} (${(ci.item as Product).unit})`
      }
      if (showArs && arsRate && ci.item.currency === 'USD') l += ` (${formatCurrency(lt * arsRate, 'ARS')})`
      t += l + '\n'
    })
    t += `\n*Subtotal: ${formatCurrency(src.subtotal, src.currency)}*`
    if (src.discount > 0) {
      const da = src.subtotal * (src.discount / 100)
      t += `\nDescuento (${src.discount}%): -${formatCurrency(da, src.currency)}`
      t += `\n*Total: ${formatCurrency(src.finalTotal, src.currency)}*`
    }
    if (showArs && arsRate && src.currency === 'USD') t += ` (ARS ${formatCurrency(src.finalTotal * arsRate, 'ARS')})`
    if (src.notes) t += `\n\n📝 ${src.notes}`
    t += `\n\nCualquier consulta, estamos a disposición.`
    return `https://wa.me/?text=${encodeURIComponent(t)}`
  }

  const addToPipeline = async () => {
    if (!savedQuote) return
    setAddingToPipeline(true)
    try {
      const res = await fetch('/api/deals', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title:       `${savedQuote.empresaName ?? savedQuote.recipientName} — ${savedQuote.ref}`,
          amount:      savedQuote.finalTotal,
          currency:    savedQuote.currency,
          probability: 50, stage: 'PROPUESTA',
          notes:       `Generado desde cotización ${savedQuote.ref}`,
          empresaId:   clientMode === 'existing' ? selectedEmpresaId || null : null,
        }),
      })
      if (!res.ok) { const j = await res.json(); toast.error(j.error ?? 'Error'); return }
      setPipelineAdded(true); toast.success('Deal creado en Pipeline → Propuesta')
    } catch { toast.error('Error al crear el deal') } finally { setAddingToPipeline(false) }
  }

  const reset = () => {
    if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl)
    setSavedQuote(null); setPdfBlobUrl(null); setPdfBase64(null); setShowPreview(false)
    setCart({}); setManualEmail(''); setManualName(''); setNotes(''); setDiscount(0)
    setSelectedEmpresaId(''); setSelectedContactEmail(''); setSelectedContactName('')
    setManualContactInput(false); setPipelineAdded(false)
  }

  // ── Preview ────────────────────────────────────────────────────────────────
  if (showPreview && savedQuote) {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold" style={{ color: 'var(--color-text)' }}>Vista previa del presupuesto</h2>
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              {savedQuote.ref} · {savedQuote.recipientName} ·{' '}
              {savedQuote.discount > 0
                ? <><s className="opacity-60">{formatCurrency(savedQuote.subtotal, savedQuote.currency)}</s>{' '}<strong>{formatCurrency(savedQuote.finalTotal, savedQuote.currency)}</strong></>
                : formatCurrency(savedQuote.finalTotal, savedQuote.currency)
              }
              {savedQuote.empresaName && ` · ${savedQuote.empresaName}`}
            </p>
          </div>
          <button onClick={reset} className="p-2 rounded-lg hover:bg-[var(--color-surface-raised)]"
            style={{ color: 'var(--color-text-muted)' }}>
            <X size={18} />
          </button>
        </div>

        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--color-border)', height: '520px' }}>
          {pdfBlobUrl
            ? <iframe src={pdfBlobUrl} title="Vista previa" className="w-full h-full" style={{ border: 'none' }} />
            : <div className="w-full h-full flex items-center justify-center" style={{ color: 'var(--color-text-muted)' }}>Generando...</div>
          }
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { onClick: downloadPdf, bg: 'var(--color-primary)', icon: <Download size={18} className="text-white" />, label: 'Descargar Presupuesto', sub: `${savedQuote.ref}.pdf` },
            { onClick: sendByEmail, disabled: sendingEmail, bg: '#6366f1', icon: <Mail size={18} className="text-white" />, label: sendingEmail ? 'Enviando...' : 'Enviar por Mail', sub: 'Con PDF adjunto' },
          ].map((btn, i) => (
            <button key={i} onClick={btn.onClick} disabled={(btn as any).disabled}
              className="flex items-center gap-3 px-4 py-4 rounded-2xl border transition-all hover:border-[var(--color-primary)] hover:bg-[var(--color-primary)]/5 disabled:opacity-60"
              style={{ border: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: btn.bg }}>{btn.icon}</div>
              <div className="text-left">
                <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{btn.label}</p>
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{btn.sub}</p>
              </div>
            </button>
          ))}
          <a href={buildWhatsApp(savedQuote)} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-3 px-4 py-4 rounded-2xl border transition-all hover:border-[#25D366] hover:bg-[#25D366]/5"
            style={{ border: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#25D366' }}><MessageCircle size={18} className="text-white" /></div>
            <div className="text-left">
              <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Enviar por WhatsApp</p>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Con resumen y totales</p>
            </div>
          </a>
        </div>

        {!pipelineAdded ? (
          <div className="flex items-center justify-between gap-4 px-4 py-3 rounded-2xl"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(99,102,241,0.12)' }}>
                <TrendingUp size={16} style={{ color: 'var(--color-primary)' }} />
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>¿Agregar esta cotización al Pipeline?</p>
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  Deal en etapa <strong>Propuesta</strong> por {formatCurrency(savedQuote.finalTotal, savedQuote.currency)}
                  {savedQuote.empresaName && ` · ${savedQuote.empresaName}`}
                </p>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button size="sm" onClick={addToPipeline} loading={addingToPipeline} leftIcon={<TrendingUp size={13} />}>Sí, agregar</Button>
              <Button size="sm" variant="ghost" onClick={() => setPipelineAdded(true)}>No</Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-4 py-3 rounded-2xl text-sm"
            style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', color: '#10b981' }}>
            <CheckCircle size={15} /> Deal agregado al Pipeline en etapa Propuesta.
          </div>
        )}

        <button onClick={reset} className="text-sm" style={{ color: 'var(--color-text-muted)' }}>+ Nuevo presupuesto</button>
      </div>
    )
  }

  // ── Main form ──────────────────────────────────────────────────────────────
  const loadingCatalog = activeTab === 'SERVICE' ? loadingServices : loadingProducts

  return (
    <div className="pb-44 lg:pb-32">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-9 h-9 rounded-xl gradient-bg flex items-center justify-center"><Zap size={17} className="text-white" /></div>
              <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>Cotizador</h1>
            </div>
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Armá un presupuesto mixto en segundos</p>
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
            <button onClick={() => refetchRate()} className="p-1 rounded-lg hover:bg-[var(--color-surface-raised)]" style={{ color: 'var(--color-text-subtle)' }}>
              <RefreshCw size={12} />
            </button>
            {arsRate && (
              <button onClick={() => setShowArs(v => !v)}
                className="px-2 py-1 rounded-lg text-xs font-semibold transition-all"
                style={showArs ? { background: 'var(--color-primary)', color: '#fff' } : { background: 'var(--color-surface-raised)', color: 'var(--color-text-muted)' }}>
                {showArs ? 'ARS ✓' : 'Ver ARS'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── STEP 1: Ítems ─────────────────────────────────────────────────── */}
      <section className="mb-5">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-5 h-5 rounded-full gradient-bg flex items-center justify-center text-[10px] font-bold text-white shrink-0">1</span>
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--color-text-subtle)' }}>Elegí los ítems</p>
        </div>

        {/* Tab selector */}
        <div className="flex rounded-xl overflow-hidden p-0.5 mb-3 w-fit"
          style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)' }}>
          {([
            { type: 'SERVICE' as ItemType, label: 'Servicios', icon: <Wrench size={13} /> },
            { type: 'PRODUCT' as ItemType, label: 'Productos', icon: <Package size={13} /> },
          ]).map(tab => (
            <button key={tab.type} onClick={() => { setActiveTab(tab.type); setItemSearch(''); setShowDropdown(false) }}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                activeTab === tab.type ? 'gradient-bg text-white shadow-sm' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
              }`}>
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {loadingCatalog ? (
          <div className="h-11 rounded-xl animate-pulse" style={{ background: 'var(--color-surface)' }} />
        ) : catalog.length === 0 ? (
          <div className="rounded-2xl p-6 text-center" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            {activeTab === 'SERVICE' ? <Wrench size={28} className="mx-auto mb-2" style={{ color: 'var(--color-text-subtle)' }} />
              : <Package size={28} className="mx-auto mb-2" style={{ color: 'var(--color-text-subtle)' }} />}
            <p className="text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>
              {activeTab === 'SERVICE' ? 'Sin servicios configurados' : 'Sin productos configurados'}
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--color-text-subtle)' }}>
              {activeTab === 'SERVICE' ? 'Configurá en Ajustes → Servicios' : 'Configurá en Ajustes → Catálogo de Productos'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Search dropdown */}
            <div className="relative">
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
                style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-strong)' }}>
                <Search size={14} style={{ color: 'var(--color-text-subtle)' }} />
                <input
                  type="text"
                  placeholder={`Buscar ${activeTab === 'SERVICE' ? 'servicio' : 'producto'}...`}
                  value={itemSearch}
                  onChange={e => { setItemSearch(e.target.value); setShowDropdown(true) }}
                  onFocus={() => setShowDropdown(true)}
                  onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                  className="flex-1 text-sm bg-transparent outline-none"
                  style={{ color: 'var(--color-text)' }}
                />
                {itemSearch && <button onClick={() => { setItemSearch(''); setShowDropdown(false) }} style={{ color: 'var(--color-text-subtle)' }}><X size={13} /></button>}
              </div>

              <AnimatePresence>
                {showDropdown && (
                  <motion.ul
                    initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.1 }}
                    className="absolute z-20 left-0 right-0 mt-1 rounded-xl overflow-hidden shadow-lg max-h-60 overflow-y-auto"
                    style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-strong)' }}
                  >
                    {filteredCatalog.length === 0 ? (
                      <li className="px-4 py-3 text-sm text-center" style={{ color: 'var(--color-text-muted)' }}>
                        Sin resultados para "{itemSearch}"
                      </li>
                    ) : filteredCatalog.map(({ type, item }) => {
                      const k = itemKey(type, item.id)
                      const inCart = cart[k]?.quantity ?? 0
                      const priceLabel = type === 'SERVICE'
                        ? `${formatPrice(item.price, item.currency)}/${BILLING_LABELS[(item as Service).billingCycle] ?? 'mes'}`
                        : `${formatPrice(item.price, item.currency)}/${(item as Product).unit}`
                      return (
                        <li key={k}>
                          <button className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-[var(--color-surface-raised)] transition-colors"
                            onMouseDown={() => { addItem(type, item); setItemSearch(''); setShowDropdown(false) }}>
                            <span>
                              <span className="text-sm font-medium flex items-center gap-1.5" style={{ color: 'var(--color-text)' }}>
                                {type === 'SERVICE' ? <Wrench size={11} style={{ color: 'var(--color-primary)' }} /> : <Package size={11} style={{ color: '#f59e0b' }} />}
                                {item.name}
                                {inCart > 0 && <span className="text-xs px-1.5 py-0.5 rounded-full ml-1" style={{ background: 'var(--color-primary)', color: 'white' }}>{inCart}</span>}
                              </span>
                              {(item as any).description && <span className="text-xs block mt-0.5" style={{ color: 'var(--color-text-subtle)' }}>{(item as any).description}</span>}
                            </span>
                            <span className="text-sm font-bold shrink-0 ml-3" style={{ color: 'var(--color-primary)' }}>{priceLabel}</span>
                          </button>
                        </li>
                      )
                    })}
                  </motion.ul>
                )}
              </AnimatePresence>
            </div>

            {/* Cart items */}
            <AnimatePresence>
              {cartItems.map(ci => {
                const k = itemKey(ci.type, ci.item.id)
                const isService = ci.type === 'SERVICE'
                const priceLabel = isService
                  ? `${formatPrice(ci.item.price * ci.quantity, ci.item.currency)}/${BILLING_LABELS[(ci.item as Service).billingCycle] ?? 'mes'}`
                  : `${formatPrice(ci.item.price * ci.quantity, ci.item.currency)}/${(ci.item as Product).unit}`
                return (
                  <motion.div key={k}
                    initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl"
                    style={{ background: isService ? 'rgba(99,102,241,0.07)' : 'rgba(245,158,11,0.07)',
                             border: `1px solid ${isService ? 'rgba(99,102,241,0.25)' : 'rgba(245,158,11,0.3)'}` }}>
                    <div className="shrink-0">
                      {isService
                        ? <Wrench size={14} style={{ color: 'var(--color-primary)' }} />
                        : <Package size={14} style={{ color: '#f59e0b' }} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: 'var(--color-text)' }}>{ci.item.name}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{priceLabel}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button onClick={() => removeItem(k)}
                        className="w-7 h-7 rounded-full flex items-center justify-center transition-all active:scale-90"
                        style={{ background: 'var(--color-surface-raised)', color: 'var(--color-text-muted)' }}>
                        <Minus size={12} />
                      </button>
                      <input type="number" min="1" value={ci.quantity} onChange={e => setQty(k, parseInt(e.target.value))}
                        className="w-10 text-center text-sm font-bold rounded-lg border outline-none py-0.5"
                        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-strong)', color: 'var(--color-text)' }} />
                      <button onClick={() => addItem(ci.type, ci.item)}
                        className="w-7 h-7 rounded-full flex items-center justify-center transition-all active:scale-90 gradient-bg text-white">
                        <Plus size={12} />
                      </button>
                      <button onClick={() => setCart(p => { const n = { ...p }; delete n[k]; return n })}
                        className="ml-1 p-1 rounded transition-colors hover:text-red-400"
                        style={{ color: 'var(--color-text-subtle)' }}>
                        <X size={13} />
                      </button>
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        )}
      </section>

      {/* ── Descuento ─────────────────────────────────────────────────────── */}
      {cartItems.length > 0 && (
        <motion.section initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
              style={{ background: 'var(--color-surface-overlay)', border: '1px solid var(--color-border-strong)', color: 'var(--color-text-subtle)' }}>%</span>
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--color-text-subtle)' }}>
              Descuento <span className="normal-case font-normal">(opcional)</span>
            </p>
          </div>
          <div className="rounded-2xl px-4 py-3 flex items-center gap-4"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            <div className="flex items-center gap-3 flex-1">
              <Tag size={15} style={{ color: 'var(--color-text-muted)' }} />
              <input
                type="number" min="0" max="100" step="0.5"
                value={discount || ''}
                onChange={e => setDiscount(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                placeholder="0"
                className="w-20 text-center text-lg font-bold rounded-xl border outline-none py-1.5 transition-all focus:ring-2 focus:ring-[var(--color-primary)]/30"
                style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border-strong)', color: 'var(--color-text)' }}
              />
              <span className="text-lg font-bold" style={{ color: 'var(--color-text-muted)' }}>%</span>
            </div>
            {discount > 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-right">
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  Ahorro: <span className="font-semibold text-emerald-400">{formatCurrency(discountAmt, currency)}</span>
                </p>
                <p className="text-sm font-bold" style={{ color: 'var(--color-text)' }}>
                  Total: {formatCurrency(finalTotal, currency)}
                </p>
              </motion.div>
            )}
          </div>
        </motion.section>
      )}

      {/* ── Validez ───────────────────────────────────────────────────────── */}
      {cartItems.length > 0 && (
        <motion.section initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
              style={{ background: 'var(--color-surface-overlay)', border: '1px solid var(--color-border-strong)', color: 'var(--color-text-subtle)' }}>
              <Clock size={11} />
            </span>
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--color-text-subtle)' }}>
              Validez de la cotización
            </p>
          </div>
          <div className="rounded-2xl px-4 py-3 flex items-center gap-3"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            <input
              type="number" min="1" max="365" step="1"
              value={validityDays}
              onChange={e => { setValidityTouched(true); setValidityDays(Math.max(1, Math.min(365, Number(e.target.value) || 1))) }}
              className="w-20 text-center text-lg font-bold rounded-xl border outline-none py-1.5 transition-all focus:ring-2 focus:ring-[var(--color-primary)]/30"
              style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border-strong)', color: 'var(--color-text)' }}
            />
            <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              días — se verá como &quot;Válida por {validityDays} días&quot; en el presupuesto
            </span>
          </div>
        </motion.section>
      )}

      {/* ── STEP 2: Destinatario ──────────────────────────────────────────── */}
      <section className="mb-5">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-5 h-5 rounded-full gradient-bg flex items-center justify-center text-[10px] font-bold text-white shrink-0">2</span>
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--color-text-subtle)' }}>Destinatario</p>
        </div>
        <div className="rounded-2xl p-4 space-y-3" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <div className="flex rounded-xl overflow-hidden border p-0.5" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-raised)' }}>
            {(['existing', 'manual'] as const).map(mode => (
              <button key={mode} onClick={() => { setClientMode(mode); setManualContactInput(false) }}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${clientMode === mode ? 'gradient-bg text-white shadow-sm' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'}`}>
                {mode === 'existing' ? 'Empresa del CRM' : 'Email directo'}
              </button>
            ))}
          </div>

          {clientMode === 'existing' ? (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}><Building2 size={11} className="inline mr-1" />Empresa</label>
                <Select
                  options={[{ value: '', label: 'Seleccionar empresa...' }, ...empresas.map(e => ({ value: e.id, label: e.city ? `${e.name}  (${e.city})` : e.name }))]}
                  value={selectedEmpresaId}
                  onChange={e => { setSelectedEmpresaId(e.target.value); setSelectedContactEmail(''); setSelectedContactName(''); setManualContactInput(false); setManualEmail(''); setManualName('') }}
                />
              </div>
              {selectedEmpresaId && (
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}><User size={11} className="inline mr-1" />Contacto</label>
                  {contacts.length > 0 && !manualContactInput ? (
                    <Select
                      options={[
                        { value: '', label: 'Seleccionar contacto...' },
                        ...contacts.map(c => ({ value: `${c.email}||${c.firstName} ${c.lastName}`, label: `${c.firstName} ${c.lastName} — ${c.email}` })),
                        { value: '__manual__', label: '— Ingresar otro email —' },
                      ]}
                      value={selectedContactEmail ? `${selectedContactEmail}||${selectedContactName}` : ''}
                      onChange={e => {
                        if (e.target.value === '__manual__') { setManualContactInput(true); setSelectedContactEmail(''); setSelectedContactName('') }
                        else { const [em, nm] = e.target.value.split('||'); setSelectedContactEmail(em ?? ''); setSelectedContactName(nm ?? '') }
                      }}
                    />
                  ) : (
                    <div className="space-y-2">
                      {contacts.length > 0 && <button onClick={() => setManualContactInput(false)} className="text-xs" style={{ color: 'var(--color-primary)' }}>← Volver a los contactos</button>}
                      <Input placeholder="Nombre del contacto" value={manualName} onChange={e => setManualName(e.target.value)} leftIcon={<User size={14} />} />
                      <Input type="email" placeholder="email@empresa.com" value={manualEmail} onChange={e => setManualEmail(e.target.value)} />
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <Input placeholder="Nombre del destinatario" value={manualName} onChange={e => setManualName(e.target.value)} leftIcon={<User size={14} />} />
              <Input type="email" placeholder="email@empresa.com" value={manualEmail} onChange={e => setManualEmail(e.target.value)} />
            </div>
          )}

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

      {/* ── STEP 3: Notas ─────────────────────────────────────────────────── */}
      <section className="mb-5">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
            style={{ background: 'var(--color-surface-overlay)', border: '1px solid var(--color-border-strong)', color: 'var(--color-text-subtle)' }}>3</span>
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--color-text-subtle)' }}>
            Notas <span className="normal-case font-normal">(opcional)</span>
          </p>
        </div>
        <textarea
          className="w-full rounded-2xl px-4 py-3.5 text-sm resize-none outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 transition-all"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
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
            initial={{ y: 120, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 120, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 38 }}
            className="fixed bottom-0 left-0 right-0 lg:left-64 z-30 border-t backdrop-blur-sm"
            style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
          >
            <div className="max-w-2xl mx-auto px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{cartItems.length} ítem{cartItems.length !== 1 ? 's' : ''}</p>
                  {cartItems.map(ci => {
                    const k = itemKey(ci.type, ci.item.id)
                    return (
                      <span key={k} className="text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1"
                        style={{ background: 'var(--color-surface-raised)', color: 'var(--color-text-muted)' }}>
                        {ci.type === 'SERVICE' ? <Wrench size={9} /> : <Package size={9} />}
                        {ci.item.name}{ci.quantity > 1 && ` ×${ci.quantity}`}
                      </span>
                    )
                  })}
                </div>
                <button onClick={clearCart} className="p-1.5 rounded-lg hover:text-red-400 hover:bg-red-500/10 transition-all"
                  style={{ color: 'var(--color-text-subtle)' }} title="Vaciar">
                  <Trash2 size={13} />
                </button>
              </div>

              <div className="flex items-center gap-3">
                <div className="shrink-0">
                  {discount > 0 ? (
                    <>
                      <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--color-text-subtle)' }}>Total final</p>
                      <p className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>
                        {formatPrice(finalTotal, currency)}
                        <span className="text-xs font-normal ml-1.5 text-emerald-400">-{discount}%</span>
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--color-text-subtle)' }}>Total</p>
                      <p className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>{formatPrice(subtotal, currency)}</p>
                    </>
                  )}
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

      {cartItems.length === 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 lg:left-auto lg:translate-x-0 lg:right-6 flex items-center gap-2 rounded-full px-4 py-2 text-xs pointer-events-none shadow-card"
          style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}>
          <ChevronRight size={12} style={{ color: 'var(--color-primary)' }} />
          Buscá un <span className="font-semibold mx-1" style={{ color: 'var(--color-primary)' }}>servicio o producto</span> para empezar
        </div>
      )}
    </div>
  )
}
