'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Mail, CheckCircle, XCircle, Eye, EyeOff, Info,
  Copy, Check, ChevronDown, ChevronRight, ExternalLink,
  Zap, Server,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import toast from 'react-hot-toast'

type Provider = 'SMTP' | 'SES'

const smtpSchema = z.object({
  smtpHost: z.string().min(1, 'Requerido'),
  smtpPort: z.coerce.number().int().min(1).max(65535),
  smtpUser: z.string().min(1, 'Requerido'),
  smtpPass: z.string().optional(),
  smtpFrom: z.string().optional(),
})
type SmtpData = z.infer<typeof smtpSchema>

const sesSchema = z.object({
  sesRegion:      z.string().min(1, 'Requerido'),
  sesAccessKeyId: z.string().min(1, 'Requerido'),
  sesSecretKey:   z.string().optional(),
  sesFrom:        z.string().email('Email inválido'),
  sesConfigSet:   z.string().optional(),
})
type SesData = z.infer<typeof sesSchema>

const SMTP_PROVIDERS = [
  { label: 'Brevo',   host: 'smtp-relay.brevo.com',  port: 587, note: 'Usá una API Key de Brevo (xkeysib-...) como contraseña' },
  { label: 'Gmail',   host: 'smtp.gmail.com',          port: 587, note: 'Requiere contraseña de aplicación (no tu contraseña de Gmail)' },
  { label: 'Outlook', host: 'smtp-mail.outlook.com',  port: 587, note: '' },
  { label: 'SendGrid',host: 'smtp.sendgrid.net',       port: 587, note: 'Usuario: apikey · Contraseña: tu API Key de SendGrid' },
  { label: 'Custom',  host: '',                        port: 587, note: '' },
]

const SES_REGIONS = [
  { v: 'us-east-1',      l: 'us-east-1 — Virginia' },
  { v: 'us-east-2',      l: 'us-east-2 — Ohio' },
  { v: 'us-west-2',      l: 'us-west-2 — Oregon' },
  { v: 'eu-west-1',      l: 'eu-west-1 — Irlanda' },
  { v: 'eu-west-2',      l: 'eu-west-2 — Londres' },
  { v: 'eu-central-1',   l: 'eu-central-1 — Frankfurt' },
  { v: 'ap-southeast-1', l: 'ap-southeast-1 — Singapur' },
  { v: 'ap-southeast-2', l: 'ap-southeast-2 — Sídney' },
  { v: 'ap-northeast-1', l: 'ap-northeast-1 — Tokio' },
  { v: 'sa-east-1',      l: 'sa-east-1 — São Paulo' },
]

// Step-by-step AWS migration checklist
const AWS_STEPS = [
  {
    id: 'verify',
    title: 'Verificar dominio o email en SES',
    desc: 'En AWS Console → SES → Identidades → "Crear identidad". Para producción usá el dominio completo (recomendado); para pruebas podés verificar solo el email.',
    link: 'https://console.aws.amazon.com/ses/home',
    tag: 'AWS Console',
  },
  {
    id: 'sandbox',
    title: 'Salir del modo sandbox (producción)',
    desc: 'Por defecto SES solo permite enviar a emails verificados. Para enviar a cualquier destinatario: SES → Account Dashboard → "Request production access". Lleva 1-2 días hábiles.',
    link: 'https://console.aws.amazon.com/ses/home#/account',
    tag: 'Solo producción',
  },
  {
    id: 'iam',
    title: 'Crear usuario IAM con permisos SES',
    desc: 'IAM → Usuarios → Crear usuario → Adjuntar política. La política mínima necesaria:',
    code: `{
  "Effect": "Allow",
  "Action": [
    "ses:SendEmail",
    "ses:SendRawEmail"
  ],
  "Resource": "*"
}`,
    link: 'https://console.aws.amazon.com/iam/home',
    tag: 'IAM',
  },
  {
    id: 'keys',
    title: 'Obtener Access Key ID y Secret Key',
    desc: 'En el usuario IAM recién creado → "Credenciales de seguridad" → "Crear clave de acceso". Guardá los dos valores — el Secret solo se muestra una vez.',
    tag: 'IAM',
  },
  {
    id: 'configset',
    title: '(Opcional) Crear Configuration Set para tracking',
    desc: 'Solo si querés tracking de entregas, rebotes y aperturas. SES → Configuration Sets → Crear uno → Event Destinations → asociar al SNS Topic (ver paso 6).',
    tag: 'Tracking',
    optional: true,
  },
  {
    id: 'sns',
    title: '(Opcional) Configurar SNS Webhook para eventos',
    desc: 'SNS → Topics → Crear topic estándar → Suscripción tipo HTTPS. El sistema confirma la suscripción automáticamente. Después, en SES → el Configuration Set → Event Destinations → asociar este topic y activar eventos: Delivery, Bounce, Complaint, Open.',
    tag: 'Tracking',
    optional: true,
  },
]

export default function CorreoPage() {
  const [provider,     setProvider]     = useState<Provider>('SMTP')
  const [saving,       setSaving]       = useState(false)
  const [testing,      setTesting]      = useState(false)
  const [testResult,   setTestResult]   = useState<{ ok: boolean; error?: string } | null>(null)
  const [showPass,     setShowPass]     = useState(false)
  const [hasPassword,  setHasPassword]  = useState(false)
  const [hasSecretKey, setHasSecretKey] = useState(false)
  const [copied,       setCopied]       = useState(false)
  const [expanded,     setExpanded]     = useState<string | null>(null)
  const [checked,      setChecked]      = useState<Record<string, boolean>>({})
  const [webhookUrl,   setWebhookUrl]   = useState('/api/webhooks/ses')

  const smtpForm = useForm<SmtpData>({
    resolver: zodResolver(smtpSchema),
    defaultValues: { smtpHost: '', smtpPort: 587, smtpUser: '', smtpPass: '', smtpFrom: '' },
  })

  const sesForm = useForm<SesData>({
    resolver: zodResolver(sesSchema),
    defaultValues: { sesRegion: 'us-east-1', sesAccessKeyId: '', sesSecretKey: '', sesFrom: '', sesConfigSet: '' },
  })

  useEffect(() => {
    setWebhookUrl(`${window.location.origin}/api/webhooks/ses`)
  }, [])

  useEffect(() => {
    fetch('/api/settings/email')
      .then(r => r.json())
      .then(({ data }) => {
        if (!data) return
        const p: Provider = data.smtpProvider === 'SES' ? 'SES' : 'SMTP'
        setProvider(p)
        setHasPassword(data.hasPassword)
        setHasSecretKey(data.hasSecretKey)
        smtpForm.setValue('smtpHost', data.smtpHost || '')
        smtpForm.setValue('smtpPort', data.smtpPort || 587)
        smtpForm.setValue('smtpUser', data.smtpUser || '')
        smtpForm.setValue('smtpFrom', data.smtpFrom || '')
        sesForm.setValue('sesRegion',      data.sesRegion      || 'us-east-1')
        sesForm.setValue('sesAccessKeyId', data.sesAccessKeyId || '')
        sesForm.setValue('sesFrom',        data.sesFrom        || '')
        sesForm.setValue('sesConfigSet',   data.sesConfigSet   || '')
      })
  }, [])

  const copyWebhook = async () => {
    try {
      await navigator.clipboard.writeText(webhookUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('No se pudo copiar al portapapeles')
    }
  }

  const toggleCheck = (id: string) =>
    setChecked(prev => ({ ...prev, [id]: !prev[id] }))

  const toggleExpand = (id: string) =>
    setExpanded(prev => prev === id ? null : id)

  const handleTest = async () => {
    setTesting(true); setTestResult(null)
    try {
      let body: Record<string, unknown> = { test: true, smtpProvider: provider }
      if (provider === 'SES') {
        body = { ...body, ...sesForm.getValues() }
      } else {
        const d = smtpForm.getValues()
        if (!d.smtpPass && !hasPassword) {
          toast.error('Ingresá la contraseña para probar')
          setTesting(false); return
        }
        body = { ...body, ...d }
      }
      const res  = await fetch('/api/settings/email', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const json = await res.json()
      setTestResult({ ok: json.ok, error: json.error })
      if (json.ok) toast.success('¡Conexión exitosa!')
      else toast.error('Error: ' + json.error)
    } catch { toast.error('Error al probar') }
    finally { setTesting(false) }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      let body: Record<string, unknown> = { smtpProvider: provider }
      if (provider === 'SES') {
        const valid = await sesForm.trigger()
        if (!valid) { setSaving(false); return }
        body = { ...body, ...sesForm.getValues() }
      } else {
        const valid = await smtpForm.trigger()
        if (!valid) { setSaving(false); return }
        body = { ...body, ...smtpForm.getValues() }
      }
      const res  = await fetch('/api/settings/email', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error); return }
      toast.success('Configuración guardada')
      if (provider === 'SES' && sesForm.getValues('sesSecretKey')) setHasSecretKey(true)
      if (provider === 'SMTP' && smtpForm.getValues('smtpPass')) setHasPassword(true)
    } catch { toast.error('Error al guardar') }
    finally { setSaving(false) }
  }

  const checkedCount  = AWS_STEPS.filter(s => checked[s.id]).length
  const requiredCount = AWS_STEPS.filter(s => !s.optional).length

  return (
    <div className="space-y-6 max-w-2xl">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl gradient-bg flex items-center justify-center">
          <Mail size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">Configuración de Email</h1>
          <p className="text-sm text-[var(--color-text-muted)]">
            Proveedor activo:{' '}
            <span className={`font-semibold ${provider === 'SES' ? 'text-orange-400' : 'text-blue-400'}`}>
              {provider === 'SES' ? '⚡ Amazon SES' : '📧 SMTP / Brevo'}
            </span>
          </p>
        </div>
      </div>

      {/* Provider toggle */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Proveedor de envío</CardTitle>
            <CardDescription>Elegí cómo enviar los emails del sistema</CardDescription>
          </div>
        </CardHeader>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => { setProvider('SMTP'); setTestResult(null); setShowPass(false) }}
            className={`flex items-center gap-3 p-4 rounded-xl border transition-all text-left ${
              provider === 'SMTP'
                ? 'border-blue-500 bg-blue-500/10'
                : 'border-[var(--color-border)] hover:border-blue-500/50'
            }`}
          >
            <Server size={20} className={provider === 'SMTP' ? 'text-blue-400' : 'text-[var(--color-text-subtle)]'} />
            <div>
              <p className={`text-sm font-semibold ${provider === 'SMTP' ? 'text-blue-400' : 'text-[var(--color-text)]'}`}>SMTP / Brevo</p>
              <p className="text-xs text-[var(--color-text-muted)]">Gmail, Brevo, SendGrid</p>
            </div>
            {provider === 'SMTP' && <CheckCircle size={14} className="ml-auto text-blue-400 shrink-0" />}
          </button>
          <button
            type="button"
            onClick={() => { setProvider('SES'); setTestResult(null); setShowPass(false) }}
            className={`flex items-center gap-3 p-4 rounded-xl border transition-all text-left ${
              provider === 'SES'
                ? 'border-orange-400 bg-orange-500/10'
                : 'border-[var(--color-border)] hover:border-orange-400/50'
            }`}
          >
            <Zap size={20} className={provider === 'SES' ? 'text-orange-400' : 'text-[var(--color-text-subtle)]'} />
            <div>
              <p className={`text-sm font-semibold ${provider === 'SES' ? 'text-orange-400' : 'text-[var(--color-text)]'}`}>Amazon SES</p>
              <p className="text-xs text-[var(--color-text-muted)]">Alta entregabilidad + tracking</p>
            </div>
            {provider === 'SES' && <CheckCircle size={14} className="ml-auto text-orange-400 shrink-0" />}
          </button>
        </div>
      </Card>

      {/* ─── AMAZON SES ─────────────────────────────── */}
      {provider === 'SES' && (
        <>
          {/* Migration checklist */}
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Checklist de configuración AWS</CardTitle>
                <CardDescription>
                  Seguí estos pasos en orden. Tildá cada uno a medida que avanzás.
                  <span className={`ml-2 font-semibold ${checkedCount >= requiredCount ? 'text-emerald-400' : 'text-[var(--color-text-muted)]'}`}>
                    {checkedCount}/{AWS_STEPS.length} completados
                  </span>
                </CardDescription>
              </div>
            </CardHeader>

            {/* Progress bar */}
            <div className="w-full h-1.5 rounded-full mb-4 overflow-hidden" style={{ background: 'var(--color-border)' }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${(checkedCount / AWS_STEPS.length) * 100}%`,
                  background: checkedCount >= requiredCount ? '#10b981' : '#f97316',
                }}
              />
            </div>

            <div className="space-y-2">
              {AWS_STEPS.map((step, idx) => (
                <div key={step.id}
                  className={`rounded-xl border transition-all overflow-hidden ${
                    checked[step.id]
                      ? 'border-emerald-500/30 bg-emerald-500/5'
                      : 'border-[var(--color-border)]'
                  }`}
                >
                  {/* Step header */}
                  <div className="flex items-center gap-3 p-3">
                    {/* Checkbox */}
                    <button
                      type="button"
                      onClick={() => toggleCheck(step.id)}
                      className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${
                        checked[step.id]
                          ? 'border-emerald-500 bg-emerald-500'
                          : 'border-[var(--color-border-strong)] hover:border-emerald-500/60'
                      }`}
                    >
                      {checked[step.id] && <Check size={11} className="text-white" />}
                    </button>

                    {/* Step number */}
                    <span className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 ${
                      checked[step.id] ? 'bg-emerald-500/20 text-emerald-400' : 'bg-[var(--color-surface-raised)] text-[var(--color-text-subtle)]'
                    }`}>
                      {idx + 1}
                    </span>

                    {/* Title */}
                    <span className={`flex-1 text-sm font-medium ${checked[step.id] ? 'line-through text-[var(--color-text-subtle)]' : 'text-[var(--color-text)]'}`}>
                      {step.title}
                    </span>

                    {/* Optional tag */}
                    {step.optional && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[var(--color-surface-raised)] text-[var(--color-text-subtle)] shrink-0">
                        opcional
                      </span>
                    )}

                    {/* Expand toggle */}
                    <button
                      type="button"
                      onClick={() => toggleExpand(step.id)}
                      className="p-1 text-[var(--color-text-subtle)] hover:text-[var(--color-text)] transition-colors"
                    >
                      {expanded === step.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                  </div>

                  {/* Expanded detail */}
                  {expanded === step.id && (
                    <div className="px-4 pb-3 space-y-2" style={{ borderTop: '1px solid var(--color-border)' }}>
                      <p className="text-xs text-[var(--color-text-muted)] leading-relaxed pt-2">{step.desc}</p>
                      {step.code && (
                        <pre className="text-[11px] font-mono text-slate-300 bg-slate-900/60 rounded-lg px-3 py-2 overflow-x-auto leading-relaxed">
                          {step.code}
                        </pre>
                      )}
                      {step.link && (
                        <a
                          href={step.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-primary)] hover:underline"
                        >
                          Ir a {step.tag} <ExternalLink size={11} />
                        </a>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>

          {/* SES credentials form */}
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Credenciales Amazon SES</CardTitle>
                <CardDescription>Completá con los datos del usuario IAM que creaste</CardDescription>
              </div>
            </CardHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-[var(--color-text)] mb-1 block">Región AWS</label>
                <select
                  {...sesForm.register('sesRegion')}
                  className="w-full px-3 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all"
                >
                  {SES_REGIONS.map(r => <option key={r.v} value={r.v}>{r.l}</option>)}
                </select>
              </div>

              <Input
                label="Access Key ID"
                placeholder="AKIA..."
                error={sesForm.formState.errors.sesAccessKeyId?.message}
                {...sesForm.register('sesAccessKeyId')}
              />

              <Input
                label={hasSecretKey ? 'Secret Access Key (dejar vacío para mantener)' : 'Secret Access Key'}
                type={showPass ? 'text' : 'password'}
                placeholder={hasSecretKey ? '••••••••••••' : 'tu-secret-key-de-aws'}
                rightIcon={
                  <button type="button" onClick={() => setShowPass(!showPass)}
                    className="text-[var(--color-text-subtle)] hover:text-[var(--color-text)] transition-colors">
                    {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                }
                {...sesForm.register('sesSecretKey')}
              />

              <Input
                label="Email remitente (verificado en SES)"
                type="email"
                placeholder="noreply@tudominio.com"
                error={sesForm.formState.errors.sesFrom?.message}
                {...sesForm.register('sesFrom')}
              />

              <Input
                label="Configuration Set (opcional — para tracking)"
                placeholder="justcrm-tracking"
                {...sesForm.register('sesConfigSet')}
              />
            </div>
          </Card>

          {/* Webhook URL */}
          <Card>
            <CardHeader>
              <div>
                <CardTitle>URL del Webhook SNS</CardTitle>
                <CardDescription>
                  Usá esta URL cuando crees la suscripción en SNS (paso 6 del checklist)
                </CardDescription>
              </div>
            </CardHeader>
            <div className="flex items-center gap-2 rounded-xl px-3 py-2.5" style={{ background: 'var(--color-surface-raised)' }}>
              <code className="flex-1 text-xs text-[var(--color-text)] font-mono break-all">{webhookUrl}</code>
              <button type="button" onClick={copyWebhook}
                className="shrink-0 p-1.5 rounded-lg hover:bg-[var(--color-surface-overlay)] text-[var(--color-text-subtle)] hover:text-[var(--color-primary)] transition-all">
                {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
              </button>
            </div>
            <div className="mt-3 p-3 rounded-xl bg-amber-500/5 border border-amber-500/20">
              <p className="text-xs text-amber-300 font-medium mb-1">⚠ Antes de guardar</p>
              <p className="text-xs text-amber-200/70">
                Para activar el tracking de rebotes, aperturas y spam, ejecutá en la terminal del servidor:
              </p>
              <code className="block text-xs font-mono text-amber-300 bg-amber-900/30 rounded px-2 py-1 mt-1">
                npx prisma migrate dev --name ses-tracking
              </code>
            </div>
          </Card>
        </>
      )}

      {/* ─── SMTP / BREVO ───────────────────────────── */}
      {provider === 'SMTP' && (
        <>
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Proveedor SMTP</CardTitle>
                <CardDescription>Seleccioná para auto-completar</CardDescription>
              </div>
            </CardHeader>
            <div className="flex flex-wrap gap-2">
              {SMTP_PROVIDERS.map(p => (
                <button key={p.label} type="button"
                  onClick={() => { smtpForm.setValue('smtpHost', p.host); smtpForm.setValue('smtpPort', p.port) }}
                  className={`px-3 py-2 rounded-xl border text-sm transition-all ${
                    smtpForm.watch('smtpHost') === p.host
                      ? 'border-blue-500 text-blue-400 bg-blue-500/10'
                      : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-blue-500/50'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {SMTP_PROVIDERS.find(p => p.host === smtpForm.watch('smtpHost'))?.note && (
              <div className="mt-3 flex items-start gap-2 text-xs text-amber-300 bg-amber-500/10 px-3 py-2 rounded-xl">
                <Info size={12} className="mt-0.5 shrink-0" />
                {SMTP_PROVIDERS.find(p => p.host === smtpForm.watch('smtpHost'))?.note}
              </div>
            )}
          </Card>

          {smtpForm.watch('smtpHost') === 'smtp-relay.brevo.com' && (
            <div className="surface rounded-2xl p-4 border-l-4 border-violet-500 bg-violet-500/5">
              <div className="flex gap-3">
                <Info size={15} className="text-violet-400 mt-0.5 shrink-0" />
                <div className="text-sm text-violet-300 space-y-1">
                  <p className="font-medium">Brevo: usá API Key para evitar bloqueos de IP</p>
                  <p>En Brevo → <strong>Configuración → API Keys</strong> → crear nueva clave → pegar la clave <code className="bg-violet-500/20 px-1 rounded">xkeysib-...</code> en el campo <strong>Contraseña</strong> abajo.</p>
                </div>
              </div>
            </div>
          )}

          <form autoComplete="off">
            <Card>
              <CardHeader><div><CardTitle>Datos del Servidor SMTP</CardTitle></div></CardHeader>
              <div className="space-y-4">
                <input type="text"     name="fake-user" style={{ display: 'none' }} readOnly autoComplete="username" />
                <input type="password" name="fake-pass" style={{ display: 'none' }} readOnly autoComplete="new-password" />

                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <Input label="Host SMTP" placeholder="smtp.gmail.com"
                      error={smtpForm.formState.errors.smtpHost?.message}
                      autoComplete="off" {...smtpForm.register('smtpHost')} />
                  </div>
                  <Input label="Puerto" type="number" placeholder="587"
                    error={smtpForm.formState.errors.smtpPort?.message}
                    autoComplete="off" {...smtpForm.register('smtpPort')} />
                </div>

                <Input label="Email / Usuario SMTP" type="text" placeholder="usuario@dominio.com"
                  error={smtpForm.formState.errors.smtpUser?.message}
                  autoComplete="off" {...smtpForm.register('smtpUser')} />

                <Input
                  label={hasPassword ? 'Contraseña / API Key (vacío = mantener)' : 'Contraseña / API Key'}
                  type={showPass ? 'text' : 'password'}
                  placeholder={hasPassword ? '••••••••••••' : 'xkeysib-... o contraseña de aplicación'}
                  autoComplete="new-password"
                  rightIcon={
                    <button type="button" onClick={() => setShowPass(!showPass)}
                      className="text-[var(--color-text-subtle)] hover:text-[var(--color-text)] transition-colors">
                      {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  }
                  {...smtpForm.register('smtpPass')}
                />

                <Input label="Nombre del remitente (opcional)" placeholder="Mi Agencia <hola@miagencia.com>"
                  autoComplete="off" {...smtpForm.register('smtpFrom')} />
              </div>
            </Card>
          </form>
        </>
      )}

      {/* Test result */}
      {testResult && (
        <div className={`flex items-center gap-2 p-3 rounded-xl text-sm ${testResult.ok ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
          {testResult.ok
            ? <><CheckCircle size={14} /> Conexión exitosa — el email está configurado correctamente</>
            : <><XCircle size={14} /> Error: {testResult.error}</>}
        </div>
      )}

      <div className="flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={handleTest} loading={testing}>
          Probar conexión
        </Button>
        <Button type="button" onClick={handleSave} loading={saving}>
          Guardar configuración
        </Button>
      </div>
    </div>
  )
}
