'use client'

// Página de pago pública — sin login, token-gated (Invoice.payToken). El que
// llega acá es quien paga (a veces administración/contaduría del cliente, sin
// usuario del portal). Muestra sólo el monto y el concepto de ESTA factura y
// redirige al checkout hosteado de Whop / Mercado Pago.
//
// Usa los tokens var(--color-*) de globals.css (mismo criterio que
// soporte/[token]/page.tsx), no depende del layout del dashboard.

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { CheckCircle2, AlertTriangle, CreditCard, Loader2 } from 'lucide-react'

interface PayInfo {
  concepto: string
  amount: number
  currency: string
  status: 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED'
  dueDate: string
  org: { name: string; logoUrl: string | null; primaryColor: string; secondaryColor: string }
}

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency, minimumFractionDigits: 2 }).format(amount)
  } catch {
    return `${currency} ${amount.toFixed(2)}`
  }
}

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

  return (
    <Shell>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: 24 }}>
        {info.org.logoUrl
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={info.org.logoUrl} alt={info.org.name} style={{ width: 48, height: 48, borderRadius: 12, objectFit: 'contain', marginBottom: 12 }} />
          : <div style={{ width: 48, height: 48, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, background: accent, marginBottom: 12 }}>{info.org.name.charAt(0)}</div>}
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>{info.org.name}</p>
      </div>

      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 16, padding: 28, width: '100%' }}>
        {paid ? (
          <div style={{ textAlign: 'center' }}>
            <CheckCircle2 size={40} style={{ color: '#10b981', margin: '0 auto 12px' }} />
            <h1 style={{ color: 'var(--color-text)', fontSize: 18, fontWeight: 600 }}>Esta factura ya fue pagada</h1>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 14, marginTop: 6 }}>{info.concepto}</p>
          </div>
        ) : cancelled ? (
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
              Vencimiento: {new Date(info.dueDate).toLocaleDateString('es-AR')}
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

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 16px' }}>
      <div style={{ maxWidth: 380, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {children}
      </div>
    </div>
  )
}
