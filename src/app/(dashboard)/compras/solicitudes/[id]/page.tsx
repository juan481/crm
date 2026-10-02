'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Search, Plus, Trash2, Send, Ban, Check, X, Building2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Modal, ModalFooter } from '@/components/ui/modal'
import { Skeleton } from '@/components/ui/skeleton'
import { formatMoneyExact } from '@/lib/utils'
import { CONDICIONES_PAGO, OTRA_CONDICION_PAGO, ESTADO_SOLICITUD_LABEL, ESTADO_SOLICITUD_COLOR } from '@/lib/solicitudes-compra'
import toast from 'react-hot-toast'

interface ProveedorOption { id: string; name: string }
interface ContactoOption { id: string; firstName: string; lastName: string; email: string | null }
interface CatalogoProduct { id: string; name: string; sku: string | null; costo: number | null; currency: string }
interface SolicitudItem {
  id: string; productId: string | null; sku: string | null; nombre: string
  cantidad: number; costoUnitario: number; moneda: string
  disponible: boolean | null; resueltoAt: string | null
}
interface SolicitudDetail {
  id: string; numero: number | null; estado: string; condicionPago: string | null; notas: string | null
  contactoEmail: string | null; contactoNombre: string | null; createdAt: string; enviadoAt: string | null
  proveedor: { id: string; name: string } | null
  items: SolicitudItem[]
}

export default function SolicitudCompraDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const qc = useQueryClient()

  const [productSearch, setProductSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [addingProductId, setAddingProductId] = useState<string | null>(null)
  const [condicionCustom, setCondicionCustom] = useState('')
  const [sendModalOpen, setSendModalOpen] = useState(false)
  const [sendEmail, setSendEmail] = useState('')
  const [sendNombre, setSendNombre] = useState('')
  const [sending, setSending] = useState(false)
  const [anulando, setAnulando] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(productSearch), 300)
    return () => clearTimeout(t)
  }, [productSearch])

  const { data, isLoading } = useQuery<SolicitudDetail>({
    queryKey: ['solicitud-compra', id],
    queryFn: async () => {
      const res = await fetch(`/api/solicitudes-compra/${id}`)
      if (!res.ok) throw new Error('No encontrada')
      return (await res.json()).data
    },
  })

  const isBorrador = data?.estado === 'BORRADOR'
  const isAnulada = data?.estado === 'ANULADA'

  const { data: proveedores } = useQuery<ProveedorOption[]>({
    queryKey: ['empresas-proveedores'],
    queryFn: async () => {
      const res = await fetch('/api/empresas?esProveedor=true&limit=200')
      const json = await res.json()
      return json.data ?? []
    },
    enabled: isBorrador,
    staleTime: 60_000,
  })

  const { data: contactosProveedor } = useQuery<ContactoOption[]>({
    queryKey: ['contactos-proveedor', data?.proveedor?.id],
    queryFn: async () => {
      const res = await fetch(`/api/contactos?empresaId=${data!.proveedor!.id}&limit=50`)
      const json = await res.json()
      return json.data ?? []
    },
    enabled: !!data?.proveedor?.id,
    staleTime: 30_000,
  })

  const { data: productResults } = useQuery<CatalogoProduct[]>({
    queryKey: ['catalogo-search-compras', debouncedSearch],
    queryFn: async () => {
      const res = await fetch(`/api/catalogo/products?q=${encodeURIComponent(debouncedSearch)}&limit=10&withCount=0`)
      const json = await res.json()
      return json.data ?? []
    },
    enabled: isBorrador && debouncedSearch.trim().length >= 2,
    staleTime: 30_000,
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['solicitud-compra', id] })
    qc.invalidateQueries({ queryKey: ['solicitudes-compra'] })
  }

  const updateProveedor = async (proveedorId: string) => {
    const res = await fetch(`/api/solicitudes-compra/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ proveedorId: proveedorId || null }),
    })
    const json = await res.json()
    if (!res.ok) { toast.error(json.error); return }
    invalidate()
  }

  const updateCondicion = async (condicionPago: string) => {
    const res = await fetch(`/api/solicitudes-compra/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ condicionPago }),
    })
    const json = await res.json()
    if (!res.ok) { toast.error(json.error); return }
    invalidate()
  }

  const addProduct = async (p: CatalogoProduct) => {
    setAddingProductId(p.id)
    try {
      const res = await fetch(`/api/solicitudes-compra/${id}/items`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: p.id }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'No se pudo agregar'); return }
      setProductSearch(''); setDebouncedSearch('')
      invalidate()
    } catch { toast.error('Error de conexión') } finally { setAddingProductId(null) }
  }

  const updateItem = async (itemId: string, body: Record<string, unknown>) => {
    const res = await fetch(`/api/solicitudes-compra/${id}/items/${itemId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json = await res.json()
    if (!res.ok) { toast.error(json.error); return }
    invalidate()
  }

  const removeItem = async (itemId: string) => {
    const res = await fetch(`/api/solicitudes-compra/${id}/items/${itemId}`, { method: 'DELETE' })
    const json = await res.json()
    if (!res.ok) { toast.error(json.error); return }
    invalidate()
  }

  const openSendModal = () => {
    if (!data?.proveedor) { toast.error('Elegí el proveedor primero'); return }
    if (!data.items.length) { toast.error('Agregá al menos un producto'); return }
    const primero = (contactosProveedor ?? []).find(c => c.email)
    setSendEmail(data.contactoEmail ?? primero?.email ?? '')
    setSendNombre(data.contactoNombre ?? (primero ? `${primero.firstName} ${primero.lastName}` : ''))
    setSendModalOpen(true)
  }

  const handleSend = async () => {
    if (!sendEmail.trim()) { toast.error('Falta el mail del proveedor'); return }
    setSending(true)
    try {
      const res = await fetch(`/api/solicitudes-compra/${id}/enviar`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactoEmail: sendEmail.trim(), contactoNombre: sendNombre.trim() || null }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'Error al enviar'); return }
      toast.success(json.message)
      setSendModalOpen(false)
      invalidate()
    } catch { toast.error('Error de conexión') } finally { setSending(false) }
  }

  const handleAnular = async () => {
    setAnulando(true)
    try {
      const res = await fetch(`/api/solicitudes-compra/${id}/anular`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error); return }
      toast.success(json.message)
      invalidate()
    } catch { toast.error('Error de conexión') } finally { setAnulando(false) }
  }

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-40 rounded-lg" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    )
  }

  const totalesPorMoneda = data.items.reduce((acc, it) => {
    acc[it.moneda] = (acc[it.moneda] ?? 0) + it.costoUnitario * it.cantidad
    return acc
  }, {} as Record<string, number>)

  const condicionEsLibre = data.condicionPago && !CONDICIONES_PAGO.includes(data.condicionPago)

  return (
    <div className="space-y-5 max-w-3xl">
      <button onClick={() => router.push('/compras')} className="flex items-center gap-1.5 text-sm hover:underline" style={{ color: 'var(--color-text-muted)' }}>
        <ArrowLeft size={14} /> Compras
      </button>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>
            {data.numero ? `Pedido N° ${data.numero}` : 'Nuevo pedido (borrador)'}
          </h1>
          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full mt-1"
            style={{ background: `${ESTADO_SOLICITUD_COLOR[data.estado]}1a`, color: ESTADO_SOLICITUD_COLOR[data.estado] }}>
            {ESTADO_SOLICITUD_LABEL[data.estado] ?? data.estado}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isBorrador && (
            <Button onClick={openSendModal} leftIcon={<Send size={14} />}>Enviar al proveedor</Button>
          )}
          {!isBorrador && !isAnulada && (
            <Button variant="outline" onClick={handleAnular} loading={anulando} leftIcon={<Ban size={14} />}>Anular</Button>
          )}
        </div>
      </div>

      {/* Proveedor + condición de pago */}
      <div className="rounded-2xl p-4 grid sm:grid-cols-2 gap-3" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>
            <Building2 size={11} className="inline mr-1" />Proveedor
          </label>
          {isBorrador ? (
            <Select
              value={data.proveedor?.id ?? ''}
              onChange={e => updateProveedor(e.target.value)}
              options={[{ value: '', label: '— elegí el proveedor —' }, ...(proveedores ?? []).map(p => ({ value: p.id, label: p.name }))]}
            />
          ) : (
            <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{data.proveedor?.name ?? '—'}</p>
          )}
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Condición de pago</label>
          {isBorrador ? (
            <>
              <Select
                value={condicionEsLibre ? OTRA_CONDICION_PAGO : (data.condicionPago ?? '')}
                onChange={e => {
                  if (e.target.value === OTRA_CONDICION_PAGO) { setCondicionCustom(''); updateCondicion('') }
                  else updateCondicion(e.target.value)
                }}
                options={[
                  { value: '', label: '— sin especificar —' },
                  ...CONDICIONES_PAGO.map(c => ({ value: c, label: c })),
                  { value: OTRA_CONDICION_PAGO, label: OTRA_CONDICION_PAGO },
                ]}
              />
              {(condicionEsLibre || condicionCustom) && (
                <Input
                  className="mt-2"
                  placeholder="Especificar condición de pago"
                  value={condicionEsLibre ? data.condicionPago ?? '' : condicionCustom}
                  onChange={e => { setCondicionCustom(e.target.value); updateCondicion(e.target.value) }}
                />
              )}
            </>
          ) : (
            <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{data.condicionPago ?? '—'}</p>
          )}
        </div>
      </div>

      {/* Buscador de productos (sólo borrador) */}
      {isBorrador && (
        <div className="relative">
          <Input
            placeholder="Buscar producto del catálogo por nombre, SKU, marca..."
            value={productSearch}
            onChange={e => setProductSearch(e.target.value)}
            leftIcon={<Search size={14} />}
          />
          {productSearch.trim().length >= 2 && (
            <div className="absolute left-0 right-0 top-full mt-1 rounded-xl overflow-hidden z-10 max-h-64 overflow-y-auto"
              style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-strong)', boxShadow: '0 20px 60px rgba(0,0,0,0.12)' }}>
              {!productResults || productResults.length === 0 ? (
                <p className="px-4 py-3 text-sm text-center" style={{ color: 'var(--color-text-muted)' }}>Sin resultados</p>
              ) : (
                productResults.map(p => (
                  <button key={p.id} onClick={() => addProduct(p)} disabled={addingProductId === p.id}
                    className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-[var(--color-surface-raised)] transition-colors disabled:opacity-50">
                    <span className="min-w-0">
                      <span className="block text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>{p.name}</span>
                      <span className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>{p.sku ?? 'sin SKU'}</span>
                    </span>
                    <span className="text-xs font-semibold shrink-0" style={{ color: 'var(--color-primary)' }}>
                      {p.costo != null ? formatMoneyExact(p.costo, p.currency) : 'sin costo'}
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* Items */}
      <div className="rounded-2xl overflow-x-auto" style={{ border: '1px solid var(--color-border)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: 'var(--color-surface-raised)', borderBottom: '1px solid var(--color-border)' }}>
              <th className="px-3 py-2.5 text-left text-xs font-semibold" style={{ color: 'var(--color-text-muted)' }}>Código</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold" style={{ color: 'var(--color-text-muted)' }}>Producto</th>
              <th className="px-3 py-2.5 text-center text-xs font-semibold" style={{ color: 'var(--color-text-muted)' }}>Cant.</th>
              <th className="px-3 py-2.5 text-right text-xs font-semibold" style={{ color: 'var(--color-text-muted)' }}>Costo</th>
              <th className="px-3 py-2.5 text-right text-xs font-semibold" style={{ color: 'var(--color-text-muted)' }}>Subtotal</th>
              {!isBorrador && <th className="px-3 py-2.5 text-center text-xs font-semibold" style={{ color: 'var(--color-text-muted)' }}>Disponible</th>}
              {isBorrador && <th className="px-3 py-2.5" />}
            </tr>
          </thead>
          <tbody>
            {data.items.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>Sin productos agregados</td></tr>
            ) : (
              data.items.map(it => (
                <tr key={it.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td className="px-3 py-2.5 font-mono text-xs" style={{ color: 'var(--color-text-muted)' }}>{it.sku ?? '—'}</td>
                  <td className="px-3 py-2.5" style={{ color: 'var(--color-text)' }}>{it.nombre}</td>
                  <td className="px-3 py-2.5 text-center">
                    {isBorrador ? (
                      <input type="number" min="1" value={it.cantidad}
                        onChange={e => updateItem(it.id, { cantidad: Number(e.target.value) || 1 })}
                        className="w-16 text-center rounded-lg px-1 py-1 text-sm outline-none"
                        style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }} />
                    ) : it.cantidad}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {isBorrador ? (
                      <input type="number" min="0" step="0.01" value={it.costoUnitario}
                        onChange={e => updateItem(it.id, { costoUnitario: Number(e.target.value) || 0 })}
                        className="w-24 text-right rounded-lg px-1 py-1 text-sm outline-none"
                        style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }} />
                    ) : formatMoneyExact(it.costoUnitario, it.moneda)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-semibold" style={{ color: 'var(--color-text)' }}>
                    {formatMoneyExact(it.costoUnitario * it.cantidad, it.moneda)}
                  </td>
                  {!isBorrador && (
                    <td className="px-3 py-2.5 text-center">
                      {isAnulada ? (
                        <span style={{ color: 'var(--color-text-subtle)' }}>—</span>
                      ) : (
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => updateItem(it.id, { disponible: true })}
                            className="p-1.5 rounded-lg transition-colors"
                            style={it.disponible === true ? { background: 'rgba(16,185,129,0.15)', color: '#10b981' } : { color: 'var(--color-text-subtle)' }}
                            title="Disponible">
                            <Check size={14} />
                          </button>
                          <button onClick={() => updateItem(it.id, { disponible: false })}
                            className="p-1.5 rounded-lg transition-colors"
                            style={it.disponible === false ? { background: 'rgba(239,68,68,0.15)', color: '#ef4444' } : { color: 'var(--color-text-subtle)' }}
                            title="Sin stock">
                            <X size={14} />
                          </button>
                        </div>
                      )}
                    </td>
                  )}
                  {isBorrador && (
                    <td className="px-3 py-2.5 text-right">
                      <button onClick={() => removeItem(it.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 hover:text-red-400 transition-colors" style={{ color: 'var(--color-text-muted)' }}>
                        <Trash2 size={14} />
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {data.items.length > 0 && (
        <div className="flex justify-end gap-4 text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
          {Object.entries(totalesPorMoneda).map(([moneda, total]) => (
            <span key={moneda}>Total {moneda}: {formatMoneyExact(total, moneda)}</span>
          ))}
        </div>
      )}

      <Modal open={sendModalOpen} onClose={() => setSendModalOpen(false)} title="Enviar al proveedor" size="sm">
        <div className="space-y-3">
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Se manda un mail con código, producto, cantidad y costo de cada ítem — sin adjuntar nada más.
          </p>
          {(contactosProveedor?.length ?? 0) > 0 && (
            <Select
              label="Contacto del proveedor"
              value=""
              onChange={e => {
                const c = (contactosProveedor ?? []).find(x => x.id === e.target.value)
                if (c) { setSendEmail(c.email ?? ''); setSendNombre(`${c.firstName} ${c.lastName}`.trim()) }
              }}
              options={[
                { value: '', label: '— elegir de los contactos —' },
                ...(contactosProveedor ?? []).filter(c => c.email).map(c => ({ value: c.id, label: `${c.firstName} ${c.lastName}` })),
              ]}
            />
          )}
          <Input label="Mail" type="email" value={sendEmail} onChange={e => setSendEmail(e.target.value)} placeholder="compras@importador.com" />
          <Input label="Nombre (opcional)" value={sendNombre} onChange={e => setSendNombre(e.target.value)} />
        </div>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setSendModalOpen(false)}>Cancelar</Button>
          <Button onClick={handleSend} loading={sending} leftIcon={<Send size={14} />}>Enviar</Button>
        </ModalFooter>
      </Modal>
    </div>
  )
}
