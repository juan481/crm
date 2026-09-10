'use client'

// Página de pago pública — sin login, token-gated (Invoice.payToken).
//  - Factura impaga → botón "Pagar" → checkout hosteado de Whop / Mercado Pago
//  - Factura pagada → comprobante de pago imprimible
// Usa los tokens var(--color-*) de globals.css.

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { CheckCircle2, AlertTriangle, CreditCard, Loader2, Printer } from 'lucide-react'

interface PayInfo {
  numero: string
  concepto: string
  amount: number
  currency: string
  status: 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED'
  dueDate: string
  paidAt: string | null
  metodoPago: string | null
  referenciaPago: string | null
  org: { name: string; logoUrl: string | null; primaryColor: string; secondaryColor: string }
}

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency, minimumFractionDigits: 2 }).format(amount)
  } catch {
    return `${currency} ${amount.toFixed(2)}`
  }
}
const fecha = (iso: string) => new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })

export default function PagarPage() {
  const { token } = useParams<{ token: string }>()
  const [info, setInfo] = useState<PayInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [redirecting, setRedirecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/public/pay/${token}`)
      .then((r) => { if (!r.ok) throw new Error(); return r.json() })
      .then((j) => setInfo(j.data))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [token])

  const pay = async () => {
    setError(null)
    setRedirecting(true)
    try {
      const res = await fetch(`/api/public/pay/${token}`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'No se pudo iniciar el pago'); setRedirecting(false); return }
      window.location.href = json.data.url
    } catch {
      setError('Error de conexión — probá de nuevo.')
      setRedirecting(false)
    }
  }

  if (loading) {
    return <Shell><Loader2 className="animate-spin" size={28} style={{ color: 'var(--color-text-subtle)' }} /></Shell>
  }

  if (notFound || !info) {
    return (
      <Shell>
        <AlertTriangle size={32} style={{ color: 'var(--color-text-subtle)' }} />
        <p style={{ color: 'var(--color-text)', fontWeight: 600, marginTop: 12 }}>Este link no es válido.</p>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 14, marginTop: 4 }}>Pedile a la empresa que te lo confirme.</p>
      </Shell>
    )
  }

  const accent = info.org.primaryColor || 'var(--color-primary)'
  const paid = info.status === 'PAID'
  const cancelled = info.status === 'CANCELLED'

  if (paid) return <Comprobante info={info} accent={accent} />

  return (
    <Shell>
      <Brand org={info.org} accent={accent} />
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 16, padding: 28, width: '100%' }}>
        {cancelled ? (
          <div style={{ textAlign: 'center' }}>
            <AlertTriangle size={36} style={{ color: 'var(--color-text-subtle)', margin: '0 auto 12px' }} />
            <h1 style={{ color: 'var(--color-text)', fontSize: 18, fontWeight: 600 }}>Esta factura fue anulada</h1>
          </div>
        ) : (
          <>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>{info.concepto}</p>
            <p style={{ color: 'var(--color-text)', fontSize: 34, fontWeight: 700, margin: '6px 0 4px' }}>
              {formatMoney(info.amount, info.currency)}
            </p>
            <p style={{ color: 'var(--color-text-subtle)', fontSize: 12, marginBottom: 20 }}>
              Factura {info.numero} · vence el {fecha(info.dueDate)}
            </p>

            {error && (
              <p style={{ color: '#f87171', fontSize: 13, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
                <AlertTriangle size={13} />{error}
              </p>
            )}

            <button
              onClick={pay}
              disabled={redirecting}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                fontSize: 14, fontWeight: 600, color: '#fff', background: accent,
                borderRadius: 12, padding: '12px 0', border: 'none', cursor: redirecting ? 'default' : 'pointer',
                opacity: redirecting ? 0.65 : 1,
              }}
            >
              {redirecting ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}
              {redirecting ? 'Redirigiendo…' : 'Pagar ahora'}
            </button>
            <p style={{ color: 'var(--color-text-subtle)', fontSize: 11, marginTop: 12, textAlign: 'center' }}>
              Pago procesado de forma segura. No guardamos los datos de tu tarjeta.
            </p>
          </>
        )}
      </div>
    </Shell>
  )
}

function Comprobante({ info, accent }: { info: PayInfo; accent: string }) {
  return (
    <Shell wide>
      <style>{`@media print { .noprint { display: none !important } body { background: #fff } }`}</style>
      <div id="cbte" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 16, width: '100%', overflow: 'hidden' }}>
        <div style={{ background: accent, padding: '22px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {info.org.logoUrl
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={info.org.logoUrl} alt={info.org.name} style={{ height: 32, borderRadius: 8, background: '#fff', padding: 4 }} />
            : <span style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>{info.org.name}</span>}
          <span style={{ color: '#fff', fontWeight: 700, fontSize: 12, letterSpacing: 1, opacity: 0.9 }}>COMPROBANTE DE PAGO</span>
        </div>

        <div style={{ padding: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
            <CheckCircle2 size={22} style={{ color: '#10b981' }} />
            <span style={{ color: 'var(--color-text)', fontWeight: 700, fontSize: 17 }}>Pago acreditado</span>
          </div>

          <Row label="Factura" value={info.numero} />
          <Row label="Concepto" value={info.concepto} />
          <Row label="Importe" value={formatMoney(info.amount, info.currency)} strong />
          {info.paidAt && <Row label="Fecha de pago" value={fecha(info.paidAt)} />}
          {info.metodoPago && <Row label="Medio" value={info.metodoPago} />}
          {info.referenciaPago && <Row label="Referencia" value={info.referenciaPago} mono />}

          <button
            className="noprint"
            onClick={() => window.print()}
            style={{ marginTop: 22, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: 'var(--color-text)', background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)', borderRadius: 12, padding: '11px 0', cursor: 'pointer' }}
          >
            <Printer size={15} /> Imprimir / Guardar PDF
          </button>
        </div>
      </div>
      <p className="noprint" style={{ color: 'var(--color-text-subtle)', fontSize: 11, marginTop: 14, textAlign: 'center' }}>
        Emitido por {info.org.name}
      </p>
    </Shell>
  )
}

function Row({ label, value, strong, mono, hide }: { label: string; value?: string; strong?: boolean; mono?: boolean; hide?: boolean }) {
  if (hide || value === undefined) return null
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '9px 0', borderBottom: '1px solid var(--color-border)' }}>
      <span style={{ color: 'var(--color-text-subtle)', fontSize: 13 }}>{label}</span>
      <span style={{ color: 'var(--color-text)', fontSize: strong ? 15 : 13, fontWeight: strong ? 700 : 500, fontFamily: mono ? 'ui-monospace,monospace' : 'inherit', textAlign: 'right', wordBreak: 'break-all' }}>{value}</span>
    </div>
  )
}

function Brand({ org, accent }: { org: PayInfo['org']; accent: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: 24 }}>
      {org.logoUrl
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={org.logoUrl} alt={org.name} style={{ width: 48, height: 48, borderRadius: 12, objectFit: 'contain', marginBottom: 12 }} />
        : <div style={{ width: 48, height: 48, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, background: accent, marginBottom: 12 }}>{org.name.charAt(0)}</div>}
      <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>{org.name}</p>
    </div>
  )
}

function Shell({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 16px' }}>
      <div style={{ maxWidth: wide ? 440 : 380, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {children}
      </div>
    </div>
  )
}
