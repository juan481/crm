'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Download, Mail, MessageCircle, CheckCircle2,
  Clock, Send, Building2, Calendar, DollarSign, FileText,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'
import toast from 'react-hot-toast'

const BILLING_LABELS: Record<string, string> = {
  MONTHLY:  'mes',
  ANNUAL:   'año',
  ONE_TIME: 'único',
}

const STATUS_CONFIG = {
  GUARDADA: { label: 'Guardada',  color: 'text-slate-400',   icon: <Clock       size={13} /> },
  ENVIADA:  { label: 'Enviada',   color: 'text-blue-400',    icon: <Send        size={13} /> },
  ACEPTADA: { label: 'Aceptada',  color: 'text-emerald-400', icon: <CheckCircle2 size={13} /> },
}

interface CotizacionDetail {
  id:             string
  ref:            string
  recipientName:  string
  recipientEmail: string
  total:          number
  currency:       string
  status:         string
  createdAt:      string
  notes:          string | null
  items:          Array<{ name: string; price: number; currency: string; billingCycle: string; quantity: number }>
  empresa:        { id: string; name: string } | null
  user:           { id: string; name: string } | null
  orgName:        string
  primaryColor:   string
  logoUrl:        string | null
  agentName:      string
  smtpConfigured: boolean
}

export default function CotizacionDetailPage() {
  const { id }   = useParams<{ id: string }>()
  const router   = useRouter()
  const qc       = useQueryClient()

  const [pdfBlobUrl,  setPdfBlobUrl]  = useState<string | null>(null)
  const [pdfBase64,   setPdfBase64]   = useState<string | null>(null)
  const [sendingMail, setSendingMail] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)

  const { data, isLoading, error } = useQuery<CotizacionDetail>({
    queryKey: ['cotizacion', id],
    queryFn:  async () => {
      const res = await fetch(`/api/cotizaciones/${id}`)
      if (!res.ok) throw new Error('No encontrado')
      return (await res.json()).data
    },
  })

  // Build PDF when data loads
  useEffect(() => {
    if (!data) return
    let cancelled = false

    const build = async () => {
      const { jsPDF } = await import('jspdf')
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const pw = 210, mg = 20, cw = pw - mg * 2

      const hex = (data.primaryColor || '#6366f1').replace('#', '')
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
      doc.text(data.orgName, mg, 25)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.text(
        new Date(data.createdAt).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' }),
        mg, 35,
      )

      let y = 56
      doc.setTextColor(148, 163, 184); doc.setFontSize(8)
      doc.text(`REF: ${data.ref}`, mg, y); y += 10

      doc.setTextColor(30, 41, 59); doc.setFont('helvetica', 'bold'); doc.setFontSize(11)
      doc.text(`Estimado/a ${data.recipientName}:`, mg, y); y += 7
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(100, 116, 139)
      doc.text('A continuación encontrará el detalle de los servicios cotizados.', mg, y); y += 12

      // Table header
      doc.setFillColor(241, 245, 249); doc.rect(mg, y, cw, 8, 'F')
      doc.setTextColor(148, 163, 184); doc.setFontSize(7.5); doc.setFont('helvetica', 'bold')
      doc.text('SERVICIO', mg + 2, y + 5.5)
      doc.text('PERÍODO',  mg + cw * 0.6, y + 5.5, { align: 'center' })
      doc.text('PRECIO',   mg + cw - 2,   y + 5.5, { align: 'right' })
      y += 8

      data.items.forEach((item, idx) => {
        if (idx % 2 === 1) { doc.setFillColor(248, 250, 252); doc.rect(mg, y, cw, 9, 'F') }
        const lineTotal = item.price * item.quantity
        const label     = item.quantity > 1 ? `${item.name}  ×${item.quantity}` : item.name
        const period    = BILLING_LABELS[item.billingCycle] ?? 'mes'
        const price     = new Intl.NumberFormat('es-AR', { style: 'currency', currency: item.currency, minimumFractionDigits: 0 }).format(lineTotal)

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
      const totalStr = new Intl.NumberFormat('es-AR', { style: 'currency', currency: data.currency, minimumFractionDigits: 0 }).format(data.total)
      doc.setTextColor(pr, pg, pb); doc.setFontSize(13)
      doc.text(totalStr, mg + cw - 2, y, { align: 'right' }); y += 12

      // Notes
      if (data.notes) {
        doc.setFillColor(248, 250, 252); doc.setDrawColor(pr, pg, pb)
        doc.roundedRect(mg, y, cw, 18, 2, 2, 'FD')
        doc.setTextColor(71, 85, 105); doc.setFontSize(8.5); doc.setFont('helvetica', 'bold')
        doc.text('Notas:', mg + 4, y + 6)
        doc.setFont('helvetica', 'normal')
        doc.text(doc.splitTextToSize(data.notes, cw - 8), mg + 4, y + 12)
        y += 22
      }

      // Footer
      y += 6
      doc.setDrawColor(226, 232, 240); doc.line(mg, y, mg + cw, y); y += 6
      doc.setTextColor(148, 163, 184); doc.setFontSize(8); doc.setFont('helvetica', 'normal')
      doc.text(`Presupuesto preparado por ${data.agentName} · ${data.orgName}`, mg, y); y += 5
      doc.text('Este presupuesto es de carácter informativo y no constituye un contrato.', mg, y)

      if (cancelled) return
      setPdfBlobUrl(doc.output('bloburl') as unknown as string)
      setPdfBase64(doc.output('datauristring') as unknown as string)
    }

    build().catch(console.error)
    return () => { cancelled = true }
  }, [data])

  // Cleanup blob URL
  useEffect(() => {
    return () => { if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl) }
  }, [pdfBlobUrl])

  const downloadPdf = () => {
    if (!pdfBlobUrl || !data) return
    const a = document.createElement('a')
    a.href     = pdfBlobUrl
    a.download = `${data.ref}.pdf`
    a.click()
  }

  const sendByEmail = async () => {
    if (!pdfBase64 || !data) return
    setSendingMail(true)
    try {
      const res  = await fetch('/api/cotizador/enviar-mail', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ cotizacionId: data.id, pdfBase64 }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'Error al enviar'); return }
      toast.success(`Email enviado a ${data.recipientEmail}`)
      qc.invalidateQueries({ queryKey: ['cotizacion', id] })
      qc.invalidateQueries({ queryKey: ['cotizaciones'] })
    } catch {
      toast.error('Error de conexión')
    } finally {
      setSendingMail(false)
    }
  }

  const updateStatus = async (status: string) => {
    if (!data) return
    setUpdatingStatus(true)
    try {
      const res = await fetch(`/api/cotizaciones/${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ status }),
      })
      if (!res.ok) { toast.error('Error al actualizar'); return }
      toast.success('Estado actualizado')
      qc.invalidateQueries({ queryKey: ['cotizacion', id] })
      qc.invalidateQueries({ queryKey: ['cotizaciones'] })
    } catch {
      toast.error('Error de conexión')
    } finally {
      setUpdatingStatus(false)
    }
  }

  const buildWhatsApp = () => {
    if (!data) return '#'
    let t = `*Presupuesto de Servicios · ${data.ref}*\n\n`
    t += `Hola ${data.recipientName},\n\nTe comparto el detalle:\n\n`
    data.items.forEach(i => {
      const lt = i.price * i.quantity
      t += `• ${i.name}${i.quantity > 1 ? ` ×${i.quantity}` : ''} — ${formatCurrency(lt, i.currency)}/${BILLING_LABELS[i.billingCycle] ?? 'mes'}\n`
    })
    t += `\n*Total: ${formatCurrency(data.total, data.currency)}*`
    if (data.notes) t += `\n\n📝 ${data.notes}`
    t += `\n\nCualquier consulta, estamos a disposición.`
    return `https://wa.me/?text=${encodeURIComponent(t)}`
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-40 rounded-xl animate-pulse" style={{ background: 'var(--color-border)' }} />
        <div className="h-[520px] rounded-2xl animate-pulse" style={{ background: 'var(--color-border)' }} />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <FileText size={32} className="opacity-30" style={{ color: 'var(--color-text-muted)' }} />
        <p style={{ color: 'var(--color-text-muted)' }}>Cotización no encontrada</p>
        <Button variant="outline" onClick={() => router.push('/cotizaciones')}>
          <ArrowLeft size={14} /> Volver
        </Button>
      </div>
    )
  }

  const statusCfg = STATUS_CONFIG[data.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.GUARDADA
  const date = new Date(data.createdAt).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/cotizaciones')}
            className="p-2 rounded-xl hover:bg-[var(--color-surface-raised)] transition-colors"
            style={{ color: 'var(--color-text-muted)' }}>
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold font-mono" style={{ color: 'var(--color-primary)' }}>{data.ref}</h1>
              <span className={`inline-flex items-center gap-1 text-xs font-medium ${statusCfg.color}`}>
                {statusCfg.icon}{statusCfg.label}
              </span>
            </div>
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              {data.empresa?.name
                ? <span className="flex items-center gap-1"><Building2 size={11} />{data.empresa.name} · </span>
                : null}
              {data.recipientName} · {date}
            </p>
          </div>
        </div>

        {/* Status changer */}
        <div className="flex items-center gap-2">
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
            <button key={key}
              disabled={updatingStatus || data.status === key}
              onClick={() => updateStatus(key)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium transition-all border ${
                data.status === key
                  ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                  : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-border-strong)]'
              }`}>
              {cfg.icon}{cfg.label}
            </button>
          ))}
        </div>
      </div>

      {/* Info strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: <Building2 size={14} />, label: 'Empresa',      value: data.empresa?.name ?? '—' },
          { icon: <DollarSign size={14} />, label: 'Total',       value: formatCurrency(data.total, data.currency) },
          { icon: <Calendar size={14} />,   label: 'Fecha',       value: date },
          { icon: <Mail size={14} />,       label: 'Destinatario',value: data.recipientEmail },
        ].map(item => (
          <div key={item.label} className="surface rounded-xl p-3">
            <p className="flex items-center gap-1 text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>
              {item.icon}{item.label}
            </p>
            <p className="text-sm font-semibold truncate" style={{ color: 'var(--color-text)' }}>{item.value}</p>
          </div>
        ))}
      </div>

      {/* PDF preview */}
      <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--color-border)', height: '520px' }}>
        {pdfBlobUrl ? (
          <iframe src={pdfBlobUrl} title="Vista previa del presupuesto" className="w-full h-full" style={{ border: 'none' }} />
        ) : (
          <div className="w-full h-full flex items-center justify-center gap-2" style={{ color: 'var(--color-text-muted)' }}>
            <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--color-border)', borderTopColor: 'var(--color-primary)' }} />
            Generando vista previa...
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button onClick={downloadPdf} disabled={!pdfBlobUrl}
          className="flex items-center gap-3 px-4 py-4 rounded-2xl border transition-all hover:border-[var(--color-primary)] hover:bg-[var(--color-primary)]/5 disabled:opacity-40"
          style={{ border: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'var(--color-primary)' }}>
            <Download size={18} className="text-white" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Descargar PDF</p>
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{data.ref}.pdf</p>
          </div>
        </button>

        <button
          onClick={sendByEmail}
          disabled={sendingMail || !pdfBase64 || !data.smtpConfigured}
          className="flex items-center gap-3 px-4 py-4 rounded-2xl border transition-all hover:border-[#6366f1] hover:bg-[#6366f1]/5 disabled:opacity-40"
          style={{ border: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#6366f1' }}>
            <Mail size={18} className="text-white" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
              {sendingMail ? 'Enviando...' : data.smtpConfigured ? 'Reenviar por mail' : 'Email no configurado'}
            </p>
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {data.smtpConfigured ? `A ${data.recipientEmail}` : 'Configurá SMTP en Ajustes'}
            </p>
          </div>
        </button>

        <a href={buildWhatsApp()} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-3 px-4 py-4 rounded-2xl border transition-all hover:border-[#25D366] hover:bg-[#25D366]/5"
          style={{ border: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#25D366' }}>
            <MessageCircle size={18} className="text-white" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Enviar por WhatsApp</p>
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Con resumen y totales</p>
          </div>
        </a>
      </div>
    </div>
  )
}
