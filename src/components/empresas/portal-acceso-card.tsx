'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { KeyRound, Plus, Trash2, Loader2, Mail, Eye, RefreshCw, Hash, Lock } from 'lucide-react'
import toast from 'react-hot-toast'

interface PortalUser { id: string; name: string; email: string; numeroAbonado: string | null; status: string; createdAt: string }

// Tarjeta de "Portal de clientes" en la ficha de la Empresa (Pagos & Portal).
// Da/quita acceso al portal (/portal) de dos formas:
//  - Email: el cliente entra por enlace de un solo uso, y después puede
//    configurarse una contraseña en "Mi cuenta" del portal.
//  - Número de abonado: para clientes sin email real (pedido de Abba/Smart
//    Panic, 2026-10-05) — el admin elige acá mismo el número (o lo deja
//    vacío para que se genere solo) y una contraseña inicial (ej. el DNI del
//    cliente). Sin mail de por medio, el acceso queda listo al toque.
export function PortalAccesoCard({ empresaId, canManage }: { empresaId: string; canManage: boolean }) {
  const [users, setUsers] = useState<PortalUser[] | null>(null)
  const [adding, setAdding] = useState(false)
  const [mode, setMode] = useState<'email' | 'abonado'>('email')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [numeroAbonado, setNumeroAbonado] = useState('')
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [resendingId, setResendingId] = useState<string | null>(null)
  const [resettingId, setResettingId] = useState<string | null>(null)
  const [resetPassword, setResetPassword] = useState('')
  const [savingReset, setSavingReset] = useState(false)

  const load = () =>
    fetch(`/api/empresas/${empresaId}/portal-acceso`)
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((j) => setUsers(j.data ?? []))
      .catch(() => setUsers([]))

  useEffect(() => { load() }, [empresaId])

  const resetAddForm = () => { setEmail(''); setName(''); setNumeroAbonado(''); setPassword(''); setAdding(false); setMode('email') }

  const add = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = mode === 'email'
        ? { mode: 'email', email, name }
        : { mode: 'abonado', name, numeroAbonado: numeroAbonado || undefined, password }
      const res = await fetch(`/api/empresas/${empresaId}/portal-acceso`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'No se pudo dar el acceso'); return }
      if (mode === 'abonado') {
        toast.success(`Acceso creado — N° de abonado ${json.data.numeroAbonado}, ya puede entrar en /portal/login`)
      } else if (json.emailWarning) {
        // Bug real (reporte de Abba, 2026-10-02): antes esto decía "se le
        // mandó el link" aunque el envío hubiera fallado — el usuario de
        // portal SÍ se crea siempre (eso no depende del mail), pero si
        // `emailWarning` viene seteado el mail no salió y hay que avisarlo
        // explícitamente, no festejar un envío que no pasó.
        toast.error(`Acceso creado, pero el mail no se pudo enviar: ${json.emailWarning}. Usá "Reenviar" o compartile el link por WhatsApp.`, { duration: 7000 })
      } else {
        toast.success('Acceso creado — se le mandó el link por email')
      }
      resetAddForm(); load()
    } catch { toast.error('Error de conexión') } finally { setSaving(false) }
  }

  const resend = async (userId: string) => {
    setResendingId(userId)
    try {
      const res = await fetch(`/api/empresas/${empresaId}/portal-acceso`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'No se pudo reenviar'); return }
      toast.success('Enlace reenviado')
    } catch { toast.error('Error de conexión') } finally { setResendingId(null) }
  }

  const submitReset = async (userId: string) => {
    if (resetPassword.length < 4) { toast.error('La contraseña debe tener al menos 4 caracteres'); return }
    setSavingReset(true)
    try {
      const res = await fetch(`/api/empresas/${empresaId}/portal-acceso`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, newPassword: resetPassword }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'No se pudo cambiar la contraseña'); return }
      toast.success('Contraseña actualizada')
      setResettingId(null); setResetPassword('')
    } catch { toast.error('Error de conexión') } finally { setSavingReset(false) }
  }

  const revoke = async (userId: string) => {
    try {
      const res = await fetch(`/api/empresas/${empresaId}/portal-acceso?userId=${userId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('Acceso revocado')
      load()
    } catch { toast.error('Error al revocar') }
  }

  return (
    <div className="rounded-2xl p-5" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <KeyRound size={15} style={{ color: 'var(--color-text-muted)' }} />
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--color-text-subtle)' }}>
            Portal de clientes
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Link
            href={`/empresas/${empresaId}/portal`}
            className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-raised)]"
          >
            <Eye size={13} /> Ver el portal
          </Link>
          {canManage && !adding && (
            <button
              onClick={() => setAdding(true)}
              className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10"
            >
              <Plus size={13} /> Dar acceso
            </button>
          )}
        </div>
      </div>

      {adding && (
        <form onSubmit={add} className="mb-3 space-y-2">
          <div className="flex gap-1 p-0.5 rounded-lg" style={{ background: 'var(--color-surface-raised)' }}>
            {([
              { id: 'email', label: 'Email' },
              { id: 'abonado', label: 'N° de abonado' },
            ] as const).map((opt) => (
              <button
                key={opt.id} type="button" onClick={() => setMode(opt.id)}
                className="flex-1 text-xs font-medium py-1.5 rounded-md transition-colors"
                style={mode === opt.id
                  ? { background: 'var(--color-surface)', color: 'var(--color-text)' }
                  : { color: 'var(--color-text-muted)' }}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {mode === 'email' ? (
            <>
              <input
                type="email" required placeholder="email del cliente" value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full text-sm rounded-lg px-3 py-2 outline-none"
                style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
              />
              <input
                type="text" placeholder="nombre (opcional)" value={name} onChange={(e) => setName(e.target.value)}
                className="w-full text-sm rounded-lg px-3 py-2 outline-none"
                style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
              />
              <p className="text-[11px]" style={{ color: 'var(--color-text-subtle)' }}>Le llega un enlace de acceso por mail — después puede configurarse una contraseña en &quot;Mi cuenta&quot;.</p>
            </>
          ) : (
            <>
              <input
                type="text" required placeholder="nombre del cliente" value={name} onChange={(e) => setName(e.target.value)}
                className="w-full text-sm rounded-lg px-3 py-2 outline-none"
                style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
              />
              <input
                type="text" inputMode="numeric" placeholder="número de abonado (vacío = automático)" value={numeroAbonado}
                onChange={(e) => setNumeroAbonado(e.target.value.replace(/\D/g, ''))}
                className="w-full text-sm rounded-lg px-3 py-2 outline-none"
                style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
              />
              <input
                type="text" required placeholder="contraseña inicial (ej: DNI del cliente)" value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full text-sm rounded-lg px-3 py-2 outline-none"
                style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
              />
              <p className="text-[11px]" style={{ color: 'var(--color-text-subtle)' }}>Sin mail — el acceso queda usable al toque con el número de abonado y esta contraseña. El cliente la puede cambiar después en &quot;Mi cuenta&quot;.</p>
            </>
          )}

          <div className="flex justify-end gap-2">
            <button type="button" onClick={resetAddForm} className="text-xs px-3 py-1.5 rounded-lg" style={{ color: 'var(--color-text-muted)' }}>Cancelar</button>
            <button type="submit" disabled={saving} className="flex items-center gap-1.5 text-xs font-semibold text-white px-3 py-1.5 rounded-lg" style={{ background: 'var(--color-primary)', opacity: saving ? 0.6 : 1 }}>
              {saving && <Loader2 size={12} className="animate-spin" />} Crear acceso
            </button>
          </div>
        </form>
      )}

      {users === null ? (
        <div className="flex justify-center py-3"><Loader2 size={16} className="animate-spin" style={{ color: 'var(--color-text-subtle)' }} /></div>
      ) : users.length === 0 ? (
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          Nadie tiene acceso todavía. Dale acceso a un contacto para que pueda ver y pagar sus facturas y pedir soporte desde <code>/portal</code>.
        </p>
      ) : (
        <div className="space-y-2">
          {users.map((u) => (
            <div key={u.id} className="rounded-xl px-3 py-2 group" style={{ border: '1px solid var(--color-border)' }}>
              <div className="flex items-center gap-3">
                {u.numeroAbonado ? <Hash size={13} style={{ color: 'var(--color-text-subtle)' }} /> : <Mail size={13} style={{ color: 'var(--color-text-subtle)' }} />}
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate" style={{ color: 'var(--color-text)' }}>
                    {u.numeroAbonado ? `Abonado N° ${u.numeroAbonado}` : u.email}
                  </p>
                  {u.name && (u.numeroAbonado || u.name !== u.email.split('@')[0]) && <p className="text-[11px]" style={{ color: 'var(--color-text-subtle)' }}>{u.name}</p>}
                </div>
                {canManage && (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {u.numeroAbonado ? (
                      <button onClick={() => { setResettingId(resettingId === u.id ? null : u.id); setResetPassword('') }}
                        className="p-1.5 rounded-lg text-[var(--color-text-subtle)] hover:text-[var(--color-primary)]" title="Resetear contraseña">
                        <Lock size={13} />
                      </button>
                    ) : (
                      <button onClick={() => resend(u.id)} disabled={resendingId === u.id}
                        className="p-1.5 rounded-lg text-[var(--color-text-subtle)] hover:text-[var(--color-primary)] disabled:opacity-50" title="Reenviar enlace — el anterior vence en 1 hora y es de un solo uso">
                        {resendingId === u.id ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                      </button>
                    )}
                    <button onClick={() => revoke(u.id)} className="p-1.5 rounded-lg text-[var(--color-text-subtle)] hover:text-red-400" title="Revocar acceso">
                      <Trash2 size={13} />
                    </button>
                  </div>
                )}
              </div>

              {resettingId === u.id && (
                <div className="flex items-center gap-2 mt-2 pt-2" style={{ borderTop: '1px solid var(--color-border)' }}>
                  <input
                    type="text" autoFocus placeholder="nueva contraseña" value={resetPassword}
                    onChange={(e) => setResetPassword(e.target.value)}
                    className="flex-1 text-sm rounded-lg px-3 py-1.5 outline-none"
                    style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
                  />
                  <button onClick={() => submitReset(u.id)} disabled={savingReset}
                    className="flex items-center gap-1 text-xs font-semibold text-white px-3 py-1.5 rounded-lg shrink-0" style={{ background: 'var(--color-primary)', opacity: savingReset ? 0.6 : 1 }}>
                    {savingReset && <Loader2 size={12} className="animate-spin" />} Guardar
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
