'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  BellRing, ArrowLeft, AlertTriangle, Info, CheckCircle2, X, Plus, Users,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuthStore } from '@/store/auth-store'
import toast from 'react-hot-toast'

interface NotifUser { id: string; name: string | null; email: string; role: string }
interface RecipientRef { userId?: string; email?: string }
interface NotifSetting {
  type: string
  label: string
  description: string
  roleFallback: string
  configured: boolean
  enabled: boolean
  recipients: RecipientRef[]
}
interface Loaded { settings: NotifSetting[]; users: NotifUser[] }

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: 'Dueño', ADMIN: 'Admin', SELLER: 'Ventas', HR: 'RRHH', TECHNICIAN: 'Técnico',
}
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function NotificacionesConfigPage() {
  const { user } = useAuthStore()
  const isAdmin = user && (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN')

  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [state, setState] = useState<Record<string, { enabled: boolean; userIds: string[]; emails: string[] }>>({})
  const [emailDraft, setEmailDraft] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!isAdmin) return
    ;(async () => {
      try {
        const res = await fetch('/api/notificaciones/config')
        const json = await res.json()
        if (!res.ok) { setErr(json.error || 'No se pudo cargar'); return }
        const d: Loaded = json.data
        setLoaded(d)
        const init: typeof state = {}
        for (const s of d.settings) {
          init[s.type] = {
            enabled: s.enabled,
            userIds: s.recipients.filter(r => r.userId).map(r => r.userId!),
            emails: s.recipients.filter(r => r.email).map(r => r.email!),
          }
        }
        setState(init)
      } catch { setErr('Error de conexión') }
    })()
  }, [isAdmin])

  const patch = (type: string, next: Partial<{ enabled: boolean; userIds: string[]; emails: string[] }>) =>
    setState(s => ({ ...s, [type]: { ...s[type], ...next } }))

  const toggleUser = (type: string, id: string) => {
    const cur = state[type]?.userIds ?? []
    patch(type, { userIds: cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id] })
  }

  const addEmail = (type: string) => {
    const raw = (emailDraft[type] ?? '').trim().toLowerCase()
    if (!raw) return
    if (!EMAIL_RE.test(raw)) { toast.error('Ese email no parece válido'); return }
    const cur = state[type]?.emails ?? []
    if (!cur.includes(raw)) patch(type, { emails: [...cur, raw] })
    setEmailDraft(d => ({ ...d, [type]: '' }))
  }

  const removeEmail = (type: string, email: string) =>
    patch(type, { emails: (state[type]?.emails ?? []).filter(e => e !== email) })

  const handleSave = async () => {
    setSaving(true)
    try {
      const settings = (loaded?.settings ?? []).map(s => {
        const st = state[s.type]
        return {
          type: s.type,
          enabled: st?.enabled ?? false,
          recipients: [
            ...(st?.userIds ?? []).map(userId => ({ userId })),
            ...(st?.emails ?? []).map(email => ({ email })),
          ],
        }
      })
      const res = await fetch('/api/notificaciones/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error || 'No se pudo guardar'); return }
      toast.success('Notificaciones guardadas')
      setLoaded(l => l ? {
        ...l,
        settings: l.settings.map(s => ({
          ...s,
          configured: true,
          enabled: state[s.type]?.enabled ?? false,
          recipients: [
            ...(state[s.type]?.userIds ?? []).map(userId => ({ userId })),
            ...(state[s.type]?.emails ?? []).map(email => ({ email })),
          ],
        })),
      } : l)
    } catch { toast.error('Error de conexión') } finally { setSaving(false) }
  }

  if (!isAdmin) {
    return <div className="surface rounded-2xl p-6 text-sm text-[var(--color-text-muted)]">Solo un administrador puede configurar las notificaciones.</div>
  }
  if (err) {
    return (
      <div className="surface rounded-2xl p-6 flex items-center gap-3 text-sm text-red-400">
        <AlertTriangle size={16} /> {err}
      </div>
    )
  }
  if (!loaded) {
    return <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-56 rounded-2xl" />)}</div>
  }

  return (
    <div className="space-y-6 pb-24">
      <div className="flex items-center gap-3">
        <Link href="/configuracion" className="w-9 h-9 rounded-xl surface flex items-center justify-center hover:border-[var(--color-border-strong)]">
          <ArrowLeft size={16} />
        </Link>
        <div className="w-10 h-10 rounded-xl gradient-bg flex items-center justify-center"><BellRing size={20} className="text-white" /></div>
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">Notificaciones automáticas</h1>
          <p className="text-sm text-[var(--color-text-muted)]">Elegí qué correos automáticos salen y a quién le llegan.</p>
        </div>
      </div>

      <div className="surface rounded-2xl p-4 border-l-4 border-[var(--color-primary)] bg-[var(--color-primary)]/5 text-sm text-[var(--color-text-muted)] flex items-start gap-2">
        <Info size={15} className="text-[var(--color-primary)] mt-0.5 shrink-0" />
        <span>
          Mientras un aviso esté <b>sin configurar acá</b>, sigue funcionando como antes
          (según el rol de cada persona). Apenas lo guardás, manda esta lista y ninguna otra.
          El recordatorio de tareas es aparte: a cada persona le llegan sus propias tareas, no se configura acá.
        </span>
      </div>

      {loaded.settings.map(s => {
        const st = state[s.type] ?? { enabled: false, userIds: [], emails: [] }
        return (
          <Card key={s.type} className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="font-semibold text-[var(--color-text)]">{s.label}</h2>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5 leading-relaxed">{s.description}</p>
                {!s.configured && (
                  <p className="text-xs text-[var(--color-text-subtle)] mt-1">Hoy le llega a: {s.roleFallback}</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-[var(--color-text-muted)]">{st.enabled ? 'Activo' : 'Apagado'}</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={st.enabled}
                  aria-label={`${st.enabled ? 'Desactivar' : 'Activar'} ${s.label}`}
                  onClick={() => patch(s.type, { enabled: !st.enabled })}
                  className={`relative w-10 h-6 rounded-full transition-colors ${st.enabled ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-border-strong)]'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${st.enabled ? 'translate-x-4' : ''}`} />
                </button>
              </div>
            </div>

            {st.enabled && (
              <div className="flex flex-col gap-4 border-t border-[var(--color-border)] pt-4">
                <div>
                  <p className="text-xs font-medium text-[var(--color-text-muted)] mb-2 flex items-center gap-1.5">
                    <Users size={13} /> Personas del CRM
                  </p>
                  <div className="grid sm:grid-cols-2 gap-1.5">
                    {loaded.users.map(u => (
                      <label key={u.id} className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-surface-raised)] cursor-pointer transition-colors">
                        <input
                          type="checkbox"
                          checked={st.userIds.includes(u.id)}
                          onChange={() => toggleUser(s.type, u.id)}
                          className="w-4 h-4 accent-[var(--color-primary)] shrink-0"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm text-[var(--color-text)] truncate">{u.name || u.email}</span>
                          <span className="block text-[11px] text-[var(--color-text-subtle)] truncate">{u.email}</span>
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--color-surface-overlay)] text-[var(--color-text-muted)] shrink-0">
                          {ROLE_LABEL[u.role] ?? u.role}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-medium text-[var(--color-text-muted)] mb-2">Otros correos (personas que no usan el CRM)</p>
                  {st.emails.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {st.emails.map(email => (
                        <span key={email} className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)] text-xs">
                          {email}
                          <button type="button" onClick={() => removeEmail(s.type, email)} className="hover:bg-[var(--color-primary)]/20 rounded-full p-0.5">
                            <X size={11} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={emailDraft[s.type] ?? ''}
                      onChange={e => setEmailDraft(d => ({ ...d, [s.type]: e.target.value }))}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addEmail(s.type) } }}
                      placeholder="nombre@correo.com"
                      className="flex-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)]"
                    />
                    <Button type="button" variant="outline" size="sm" leftIcon={<Plus size={14} />} onClick={() => addEmail(s.type)}>
                      Agregar
                    </Button>
                  </div>
                </div>

                {st.userIds.length === 0 && st.emails.length === 0 && (
                  <p className="text-xs text-amber-500 flex items-center gap-1.5">
                    <AlertTriangle size={13} /> Está activo pero sin destinatarios — no va a mandar nada.
                  </p>
                )}
              </div>
            )}
          </Card>
        )
      })}

      <div className="fixed bottom-0 left-0 right-0 lg:left-64 border-t border-[var(--color-border)] bg-[var(--color-bg)]/95 backdrop-blur px-6 py-3 flex items-center justify-end gap-3 z-20">
        <span className="text-xs text-[var(--color-text-subtle)] flex items-center gap-1 mr-auto">
          <CheckCircle2 size={13} className="text-emerald-400" /> Los cambios se aplican en el próximo envío (a la mañana).
        </span>
        <Button onClick={handleSave} loading={saving}>Guardar</Button>
      </div>
    </div>
  )
}
