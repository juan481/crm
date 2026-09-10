'use client'

// Adonde vuelve el comprador después del checkout de Whop / Mercado Pago.
// El estado real de la factura lo confirma el webhook (puede tardar unos
// segundos) — esta pantalla NO afirma que el pago se acreditó.

import { CheckCircle2 } from 'lucide-react'

export default function GraciasPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 16px' }}>
      <div style={{ maxWidth: 380, width: '100%', textAlign: 'center', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 16, padding: 32 }}>
        <CheckCircle2 size={40} style={{ color: '#10b981', margin: '0 auto 14px' }} />
        <h1 style={{ color: 'var(--color-text)', fontSize: 18, fontWeight: 600 }}>Recibimos tu pago</h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 14, marginTop: 8, lineHeight: 1.6 }}>
          En unos minutos vas a ver la confirmación. Si ya lo pagaste, no hace
          falta que lo hagas de nuevo — podés cerrar esta ventana.
        </p>
      </div>
    </div>
  )
}
