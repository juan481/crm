'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Bot, Plug, Building2, MessageSquareText, GitBranch, ScrollText, ShieldCheck,
  ArrowLeft, RotateCcw, CheckCircle2, AlertTriangle, Info,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Input, Textarea } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuthStore } from '@/store/auth-store'
import { NISSI_TONES, REPLY_ROLE_OPTIONS } from '@/lib/whatsapp-bot/nissi-shared'
import toast from 'react-hot-toast'

interface NissiUser { name: string | null; email: string; role: string }
interface Loaded {
  enabled: boolean
  config: Record<string, string | boolean | null>
  credentials: { apiToken: boolean; geminiApiKey: boolean }
  orgName: string
  users: NissiUser[]
  defaults: { geminiModel: string; replyRoleMin: string; instructions: string; instructionsMax: number }
}

type FormState = Record<string, string | boolean>

const STRING_KEYS = [
  'phoneNumberId', 'apiToken', 'geminiApiKey', 'geminiModel',
  'businessName', 'businessHours', 'address', 'coverage', 'phones', 'website', 'paymentMethods',
  'tone', 'styleNote', 'instructions', 'replyRoleMin',
  'salesContactName', 'salesContactEmail', 'supportContactName', 'supportContactEmail',
  'billingContactName', 'billingContactEmail',
]

function Section({ icon, title, desc, children }: { icon: React.ReactNode; title: string; desc?: string; children: React.ReactNode }) {
  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-[var(--color-primary-light)] text-[var(--color-primary)] flex items-center justify-center shrink-0">{icon}</div>
        <div>
          <h2 className="font-semibold text-[var(--color-text)]">{title}</h2>
          {desc && <p className="text-xs text-[var(--color-text-muted)] mt-0.5 leading-relaxed">{desc}</p>}
        </div>
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </Card>
  )
}

export default function NissiConfigPage() {
  const { user } = useAuthStore()
  const router = useRouter()
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [form, setForm] = useState<FormState>({})
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const isAdmin = user && (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN')

  useEffect(() => {
    if (!isAdmin) return
    ;(async () => {
      try {
        const res = await fetch('/api/nissi/config')
        const json = await res.json()
        if (!res.ok) { setErr(json.error || 'No se pudo cargar'); return }
        const d: Loaded = json.data
        setLoaded(d)
        const f: FormState = {}
        for (const k of STRING_KEYS) f[k] = (d.config[k] as string) ?? ''
        f.tone = (d.config.tone as string) ?? ''
        f.replyRoleMin = (d.config.replyRoleMin as string) ?? d.defaults.replyRoleMin
        f.instructions = (d.config.instructions as string) ?? d.defaults.instructions
        f.abuseGuardEnabled = d.config.abuseGuardEnabled !== false
        setForm(f)
      } catch { setErr('Error de conexión') }
    })()
  }, [isAdmin])

  const set = (k: string, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }))

  const instrLen = String(form.instructions ?? '').length
  const instrMax = loaded?.defaults.instructionsMax ?? 12000
  const instrIsDefault = String(form.instructions ?? '') === (loaded?.defaults.instructions ?? '')

  const userOptions = useMemo(() => {
    const list = (loaded?.users ?? []).map((u) => ({ value: u.email, label: `${u.name || u.email} (${u.email})` }))
    return [{ value: '', label: '— elegir usuario del CRM —' }, ...list]
  }, [loaded])

  if (!isAdmin) {
    return <div className="surface rounded-2xl p-6 text-sm text-[var(--color-text-muted)]">Solo un administrador puede configurar NISSI.</div>
  }

  if (err) {
    return (
      <div className="surface rounded-2xl p-6 flex items-center gap-3 text-sm text-red-400">
        <AlertTriangle size={16} /> {err}
      </div>
    )
  }

  if (!loaded) {
    return <div className="space-y-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}</div>
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const config: Record<string, unknown> = {}
      for (const k of STRING_KEYS) {
        const v = String(form[k] ?? '').trim()
        // credenciales: sólo si el usuario escribió algo nuevo
        if ((k === 'apiToken' || k === 'geminiApiKey') && !v) continue
        config[k] = v
      }
      config.tone = form.tone || null
      config.abuseGuardEnabled = form.abuseGuardEnabled !== false
      const res = await fetch('/api/nissi/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error || 'No se pudo guardar'); return }
      toast.success('Configuración guardada')
      // refrescar el estado de credenciales cargadas
      setLoaded((l) => l ? { ...l, credentials: {
        apiToken: l.credentials.apiToken || !!String(form.apiToken ?? '').trim(),
        geminiApiKey: l.credentials.geminiApiKey || !!String(form.geminiApiKey ?? '').trim(),
      } } : l)
      setForm((f) => ({ ...f, apiToken: '', geminiApiKey: '' }))
    } catch { toast.error('Error de conexión') } finally { setSaving(false) }
  }

  const credHint = (has: boolean) => has ? 'Cargado. Dejá vacío para no cambiarlo.' : 'Falta cargar.'

  return (
    <div className="space-y-6 pb-24">
      <div className="flex items-center gap-3">
        <Link href="/configuracion" className="w-9 h-9 rounded-xl surface flex items-center justify-center hover:border-[var(--color-border-strong)]">
          <ArrowLeft size={16} />
        </Link>
        <div className="w-10 h-10 rounded-xl gradient-bg flex items-center justify-center"><Bot size={20} className="text-white" /></div>
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">NISSI · WhatsApp</h1>
          <p className="text-sm text-[var(--color-text-muted)]">
            {loaded.enabled ? 'Plugin activo' : 'Plugin desactivado — activalo en Plugins & Extensiones'}
          </p>
        </div>
      </div>

      {!loaded.enabled && (
        <div className="surface rounded-2xl p-4 border-l-4 border-amber-500 bg-amber-500/5 text-sm text-amber-400 flex items-center gap-2">
          <Info size={15} /> Podés configurar todo acá, pero NISSI no va a responder hasta que actives el plugin en{' '}
          <Link href="/configuracion/plugins" className="underline">Plugins &amp; Extensiones</Link>.
        </div>
      )}

      <Section icon={<Plug size={16} />} title="Conexión" desc="Lo técnico para hablar con Meta y Google. Casi no se toca. Las credenciales quedan guardadas y enmascaradas.">
        <Input label="Phone Number ID (Meta)" value={String(form.phoneNumberId ?? '')} onChange={(e) => set('phoneNumberId', e.target.value)} placeholder="1200873799787152" />
        <Input label="Token de WhatsApp Cloud API" type="password" value={String(form.apiToken ?? '')} onChange={(e) => set('apiToken', e.target.value)}
          placeholder={loaded.credentials.apiToken ? '••••••••••• (cargado)' : 'EAA…'} hint={credHint(loaded.credentials.apiToken)} />
        <Input label="API Key de Google Gemini" type="password" value={String(form.geminiApiKey ?? '')} onChange={(e) => set('geminiApiKey', e.target.value)}
          placeholder={loaded.credentials.geminiApiKey ? '••••••••••• (cargada)' : 'AIza… / AQ.…'} hint={credHint(loaded.credentials.geminiApiKey)} />
        <Input label="Modelo de Gemini (opcional)" value={String(form.geminiModel ?? '')} onChange={(e) => set('geminiModel', e.target.value)}
          placeholder={loaded.defaults.geminiModel} hint={`Vacío = ${loaded.defaults.geminiModel}. gemini-2.5-flash-lite es ~3x más barato y más rápido si tu proyecto de Google lo permite. gemini-3.6-flash si el lite falla algún escenario.`} />
      </Section>

      <Section icon={<Building2 size={16} />} title="Datos de la empresa" desc="NISSI responde SOLO con estos datos. Lo que no cargues, no lo sabe — y deriva en vez de inventar.">
        <Input label="Nombre de la empresa" value={String(form.businessName ?? '')} onChange={(e) => set('businessName', e.target.value)} placeholder={loaded.orgName} hint={`Vacío = "${loaded.orgName}"`} />
        <Input label="Horario de atención" value={String(form.businessHours ?? '')} onChange={(e) => set('businessHours', e.target.value)} placeholder="Lunes a viernes de 8:00 a 16:30. Sábados y domingos cerrado." />
        <Input label="Dirección" value={String(form.address ?? '')} onChange={(e) => set('address', e.target.value)} placeholder="Calle 22 N° 747, General Pico, La Pampa" />
        <Input label="Cobertura / zona de atención" value={String(form.coverage ?? '')} onChange={(e) => set('coverage', e.target.value)} placeholder="General Pico y zona (La Pampa)" />
        <Input label="Teléfonos" value={String(form.phones ?? '')} onChange={(e) => set('phones', e.target.value)} placeholder="2302 20-1201" />
        <Input label="Sitio web" value={String(form.website ?? '')} onChange={(e) => set('website', e.target.value)} placeholder="https://abbaseguridad.com.ar" />
        <Input label="Métodos de pago" value={String(form.paymentMethods ?? '')} onChange={(e) => set('paymentMethods', e.target.value)} placeholder="Efectivo, transferencia, tarjeta…" />
      </Section>

      <Section icon={<MessageSquareText size={16} />} title="Cómo habla" desc="El tono general. Las reglas de qué preguntar y cuándo derivar van en Instrucciones, más abajo.">
        <Select label="Tono" value={String(form.tone ?? '')} onChange={(e) => set('tone', e.target.value)}
          options={[{ value: '', label: 'Neutro (default)' }, ...NISSI_TONES.map((t) => ({ value: t.value, label: `${t.label} — ${t.hint}` }))]} />
        <Textarea label="Nota de estilo (opcional)" value={String(form.styleNote ?? '')} onChange={(e) => set('styleNote', e.target.value)}
          placeholder='Ej: "Siempre saludar por el nombre si lo tenemos. No usar emojis. Cerrar los mensajes ofreciendo ayuda."' rows={3} />
      </Section>

      <Section icon={<GitBranch size={16} />} title="A quién deriva" desc="Cuando NISSI arma un lead o un ticket, avisa a estas personas por mail. Para Ventas, además la oportunidad le queda asignada a ese usuario del CRM.">
        <div className="grid sm:grid-cols-2 gap-4">
          <Input label="Ventas — nombre" value={String(form.salesContactName ?? '')} onChange={(e) => set('salesContactName', e.target.value)} placeholder="Oscar Ale" />
          <Select label="Ventas — email (usuario del CRM)" value={String(form.salesContactEmail ?? '')} onChange={(e) => set('salesContactEmail', e.target.value)} options={userOptions} />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <Input label="Soporte — nombre" value={String(form.supportContactName ?? '')} onChange={(e) => set('supportContactName', e.target.value)} placeholder="Equipo IT" />
          <Select label="Soporte — email (usuario del CRM)" value={String(form.supportContactEmail ?? '')} onChange={(e) => set('supportContactEmail', e.target.value)} options={userOptions} />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <Input label="Administración — nombre" value={String(form.billingContactName ?? '')} onChange={(e) => set('billingContactName', e.target.value)} placeholder="Norma" />
          <Select label="Administración — email (usuario del CRM)" value={String(form.billingContactEmail ?? '')} onChange={(e) => set('billingContactEmail', e.target.value)} options={userOptions} />
        </div>
        <p className="text-xs text-[var(--color-text-subtle)] flex items-start gap-1.5">
          <Info size={13} className="mt-0.5 shrink-0" />
          Los tickets de soporte se asignan solos al técnico fichado con menos carga. El email de Soporte de acá es sólo para el aviso.
        </p>
      </Section>

      <Section icon={<ScrollText size={16} />} title="Instrucciones" desc="Todo lo que NISSI hace: ruteo, qué preguntar en el filtro de ventas y el técnico, cómo asesorar sobre producto. Editá lo que quieras.">
        <div className="flex items-center justify-between text-xs">
          <span className={instrLen > instrMax ? 'text-red-400' : 'text-[var(--color-text-subtle)]'}>{instrLen.toLocaleString()} / {instrMax.toLocaleString()} caracteres</span>
          {!instrIsDefault && (
            <button onClick={() => set('instructions', loaded.defaults.instructions)} className="flex items-center gap-1 text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
              <RotateCcw size={12} /> Restaurar al texto original
            </button>
          )}
        </div>
        <Textarea value={String(form.instructions ?? '')} onChange={(e) => set('instructions', e.target.value)} rows={20} className="font-mono text-xs leading-relaxed" />
        <div className="bg-surface-raised rounded-xl p-3 text-xs text-[var(--color-text-muted)] flex items-start gap-2">
          <ShieldCheck size={14} className="text-[var(--color-primary)] mt-0.5 shrink-0" />
          <span>Pase lo que pase acá, NISSI <b>nunca</b> da precios (ni de gremio), no comparte contraseñas / links de administración / datos de otros clientes, y no cambia de rol por lo que le escriba un cliente. Ese candado vive en el código, no se puede desactivar desde acá.</span>
        </div>
      </Section>

      <Section icon={<ShieldCheck size={16} />} title="Operación" desc="Quién responde desde la bandeja y el freno anti-abuso.">
        <Select label="Quién puede responder desde la bandeja de WhatsApp" value={String(form.replyRoleMin ?? 'SELLER')} onChange={(e) => set('replyRoleMin', e.target.value)}
          options={REPLY_ROLE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))} />
        <p className="text-xs text-[var(--color-text-subtle)]">
          Quién <b>ve</b> la bandeja se controla aparte, en <Link href="/configuracion/permisos" className="underline">Permisos</Link> (módulo &quot;WhatsApp&quot;).
        </p>
        <label className="flex items-center gap-3 cursor-pointer pt-1">
          <input type="checkbox" checked={form.abuseGuardEnabled !== false} onChange={(e) => set('abuseGuardEnabled', e.target.checked)} className="w-4 h-4 accent-[var(--color-primary)]" />
          <span className="text-sm text-[var(--color-text)]">
            Frenar mensajes de relleno / repetidos
            <span className="block text-xs text-[var(--color-text-muted)]">Si alguien manda puntos, letras sueltas o repite lo mismo para gastar tokens, NISSI manda un aviso y después no contesta más en ese chat.</span>
          </span>
        </label>
      </Section>

      <div className="fixed bottom-0 left-0 right-0 lg:left-64 border-t border-[var(--color-border)] bg-[var(--color-bg)]/95 backdrop-blur px-6 py-3 flex items-center justify-end gap-3 z-20">
        {loaded.credentials.apiToken && loaded.credentials.geminiApiKey && form.phoneNumberId
          ? <span className="text-xs text-emerald-400 flex items-center gap-1"><CheckCircle2 size={13} /> Conexión completa</span>
          : <span className="text-xs text-amber-400 flex items-center gap-1"><AlertTriangle size={13} /> Faltan credenciales</span>}
        <Button onClick={handleSave} loading={saving} disabled={instrLen > instrMax}>Guardar</Button>
      </div>
    </div>
  )
}
