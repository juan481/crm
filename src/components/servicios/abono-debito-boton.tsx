'use client'

import { useState } from 'react'
import { Repeat, Loader2, Copy, X } from 'lucide-react'
import toast from 'react-hot-toast'

type SubStatus = 'PENDIENTE_AUTORIZACION' | 'ACTIVO' | 'PAUSADO' | 'CANCELADO' | null

const LABEL: Record<string, string> = {
  PENDIENTE_AUTORIZACION: 'Esperando autorización del cliente',
  ACTIVO: 'Débito automático activo',
  PAUSADO: 'Débito pausado',
  CANCELADO: 'Débito cancelado',
}

// Control de débito automático de un abono (Pagos & Portal, Fase 4). Genera el
// link de autorización (Whop / Mercado Pago según la moneda) para mandárselo
// al cliente una vez; después el proveedor cobra solo cada ciclo.
export function AbonoDebitoBoton({
  abonoId,
  subStatus,
  subAuthUrl,
  ciclo,
  canManage,
  onChange,
}: {
  abonoId: string
  subStatus: SubStatus
  subAuthUrl: string | null
  ciclo: string
  canManage: boolean
  onChange: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [authUrl, setAuthUrl] = useState<string | null>(subAuthUrl)

  const soportaDebito = ['MENSUAL', 'TRIMESTRAL', 'SEMESTRAL', 'ANUAL'].includes(ciclo)
  if (!soportaDebito) return null

  const generate = async () => {
    setBusy(true)
    try {
      const res = await fetch(`/api/servicios-recurrentes/${abonoId}/suscripcion`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'No se pudo generar el link'); return }
      setAuthUrl(json.data.authUrl)
      toast.success('Link generado — copiáselo al cliente')
      onChange()
    } catch { toast.error('Error de conexión') } finally { setBusy(false) }
  }

  const cancel = async () => {
    setBusy(true)
    try {
      const res = await fetch(`/api/servicios-recurrentes/${abonoId}/suscripcion`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setAuthUrl(null)
      toast.success('Débito cancelado — vuelve a facturarse normal')
      onChange()
    } catch { toast.error('Error al cancelar') } finally { setBusy(false) }
  }

  const copy = async () => {
    if (!authUrl) return
    try { await navigator.clipboard.writeText(authUrl); toast.success('Link copiado') }
    catch { toast.error(authUrl) }
  }

  const active = subStatus === 'ACTIVO'
  const pending = subStatus === 'PENDIENTE_AUTORIZACION'

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-2">
      {subStatus && subStatus !== 'CANCELADO' ? (
        <span className="inline-flex items-center gap-1 text-[10px] font-medium" style={{ color: active ? '#10b981' : 'var(--color-text-subtle)' }}>
          <Repeat size={10} /> {LABEL[subStatus]}
        </span>
      ) : canManage ? (
        <button
          onClick={generate}
          disabled={busy}
          className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md"
          style={{ color: 'var(--color-primary)', border: '1px solid var(--color-border)' }}
        >
          {busy ? <Loader2 size={10} className="animate-spin" /> : <Repeat size={10} />} Activar débito automático
        </button>
      ) : null}

      {(pending || (authUrl && !active)) && canManage && (
        <>
          <button onClick={copy} className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md" style={{ color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}>
            <Copy size={10} /> Copiar link
          </button>
          <button onClick={generate} disabled={busy} className="text-[10px]" style={{ color: 'var(--color-text-subtle)' }}>regenerar</button>
        </>
      )}

      {(active || pending) && canManage && (
        <button onClick={cancel} disabled={busy} className="inline-flex items-center gap-0.5 text-[10px]" style={{ color: 'var(--color-text-subtle)' }}>
          <X size={10} /> cancelar
        </button>
      )}
    </div>
  )
}
