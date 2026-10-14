'use client'

import { useState } from 'react'
import { Modal, ModalFooter } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { formatMoneyExact } from '@/lib/utils'
import { MEDIO_PAGO_OPTIONS, type PagoDetalle } from '@/lib/medios-pago'
import { compressImageToDataUri } from '@/lib/compress-image'
import toast from 'react-hot-toast'

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
  invoiceId: string
  amount: number
  currency: string
  empresaName?: string | null
  /** Presente = editar un pago ya registrado (PATCH /api/payments/[id]). Ausente = registrar el pago y marcar la factura como pagada. */
  paymentId?: string | null
  initialMetodo?: string | null
  initialDetalle?: PagoDetalle | null
}

// Modal único para "Registrar pago" (factura PENDING → PAID, pedido de
// Abba: antes de marcar pagada hay que gestionar el pago) y "Editar pago"
// (corregir banco/cuotas/etc. de un pago ya cargado, sin anular la
// factura — Norma confirma sola, sin segunda validación).
export function PaymentDetailsModal({
  open, onClose, onSaved, invoiceId, amount, currency, empresaName,
  paymentId, initialMetodo, initialDetalle,
}: Props) {
  const isEdit = !!paymentId
  const [metodo, setMetodo] = useState(initialMetodo ?? '')
  const [detalle, setDetalle] = useState<PagoDetalle>(initialDetalle ?? {})
  const [saving, setSaving] = useState(false)
  const [uploadingFoto, setUploadingFoto] = useState(false)

  const setField = (patch: Partial<PagoDetalle>) => setDetalle((d) => ({ ...d, ...patch }))

  const handleFoto = async (file: File | undefined) => {
    if (!file) return
    setUploadingFoto(true)
    try {
      const dataUri = await compressImageToDataUri(file)
      setField({ foto: dataUri })
    } catch {
      toast.error('No se pudo procesar la imagen')
    } finally {
      setUploadingFoto(false)
    }
  }

  const submit = async () => {
    if (!metodo) { toast.error('Elegí el medio de pago'); return }
    setSaving(true)
    try {
      const url = isEdit ? `/api/payments/${paymentId}` : `/api/invoices/${invoiceId}`
      const body = isEdit
        ? { metodo, detalle }
        : { status: 'PAID', metodo, detalle }
      const res = await fetch(url, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(json.error ?? 'Error al guardar'); return }
      toast.success(isEdit ? 'Pago actualizado' : 'Pago registrado — factura marcada como pagada')
      onSaved()
    } catch {
      toast.error('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Editar pago' : 'Registrar pago'} size="md">
      <div className="space-y-4">
        <div className="rounded-xl p-3 text-sm" style={{ background: 'var(--color-surface-raised)' }}>
          <p className="font-semibold" style={{ color: 'var(--color-text)' }}>{formatMoneyExact(amount, currency)}</p>
          {empresaName && <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{empresaName}</p>}
        </div>

        <Select
          label="Medio de pago"
          options={[{ value: '', label: 'Seleccionar...' }, ...MEDIO_PAGO_OPTIONS]}
          value={metodo}
          // Al cambiar de medio se limpian los campos del anterior (menos la
          // foto, que puede seguir sirviendo de comprobante) — si no,
          // quedaban campos "fantasma" de, por ej., CHEQUE mandándose igual
          // al backend después de cambiar a TRANSFERENCIA, y el mail de
          // comprobante los mostraba mezclados con el medio nuevo.
          onChange={(e) => { setMetodo(e.target.value); setDetalle((d) => ({ foto: d.foto })) }}
        />

        {metodo === 'EFECTIVO' && (
          <Input label="Nota (opcional)" value={detalle.nota ?? ''} onChange={(e) => setField({ nota: e.target.value })} />
        )}

        {metodo === 'TRANSFERENCIA' && (
          <Input label="Referencia / comprobante" value={detalle.referencia ?? ''} onChange={(e) => setField({ referencia: e.target.value })} placeholder="N° de operación" />
        )}

        {metodo === 'CHEQUE' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Input label="N° de cheque" value={detalle.chequeNumero ?? ''} onChange={(e) => setField({ chequeNumero: e.target.value })} />
              <Input label="Banco" value={detalle.chequeBanco ?? ''} onChange={(e) => setField({ chequeBanco: e.target.value })} />
            </div>
            <Input label="Fecha del cheque" type="date" value={detalle.chequeFecha ?? ''} onChange={(e) => setField({ chequeFecha: e.target.value })} />
          </div>
        )}

        {metodo === 'TARJETA' && (
          <div className="grid grid-cols-2 gap-3">
            <Input label="Banco emisor" value={detalle.tarjetaBancoEmisor ?? ''} onChange={(e) => setField({ tarjetaBancoEmisor: e.target.value })} />
            <Input label="Marca" value={detalle.tarjetaMarca ?? ''} onChange={(e) => setField({ tarjetaMarca: e.target.value })} placeholder="Visa, Mastercard..." />
            <Input label="Cuotas" type="number" min="1" value={detalle.tarjetaCuotas ?? ''} onChange={(e) => setField({ tarjetaCuotas: Number(e.target.value) || undefined })} />
          </div>
        )}

        {metodo && (
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>
              Foto del comprobante {metodo === 'CHEQUE' ? '(del cheque)' : '(opcional)'}
            </label>
            {detalle.foto ? (
              <div className="flex items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={detalle.foto} alt="Comprobante" className="h-16 w-16 object-cover rounded-lg" style={{ border: '1px solid var(--color-border)' }} />
                <button type="button" onClick={() => setField({ foto: undefined })} className="text-xs" style={{ color: '#ef4444' }}>Quitar</button>
              </div>
            ) : (
              <input type="file" accept="image/*" disabled={uploadingFoto} onChange={(e) => handleFoto(e.target.files?.[0])}
                className="text-xs" style={{ color: 'var(--color-text-muted)' }} />
            )}
          </div>
        )}

        <ModalFooter>
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="button" onClick={submit} loading={saving} disabled={uploadingFoto}>
            {isEdit ? 'Guardar' : 'Registrar y marcar pagada'}
          </Button>
        </ModalFooter>
      </div>
    </Modal>
  )
}
