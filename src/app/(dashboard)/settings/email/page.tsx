'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Mail, CheckCircle, XCircle, Eye, EyeOff, Info, Copy, Check } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import toast from 'react-hot-toast'

type Provider = 'SMTP' | 'SES'

const smtpSchema = z.object({
  smtpHost: z.string().min(1, 'Requerido'),
  smtpPort: z.coerce.number().int().min(1).max(65535),
  smtpUser: z.string().email('Email inválido'),
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
  { label: 'Brevo',             host: 'smtp-relay.brevo.com',   port: 587, note: 'Usá una API Key de Brevo (xkeysib-...) en el campo Contraseña' },
  { label: 'Gmail',             host: 'smtp.gmail.com',          port: 587, note: 'Requiere contraseña de aplicación (no tu contraseña de Gmail)' },
  { label: 'Outlook / Hotmail', host: 'smtp-mail.outlook.com',  port: 587, note: '' },
  { label: 'Yahoo',             host: 'smtp.mail.yahoo.com',     port: 587, note: '' },
  { label: 'SendGrid',          host: 'smtp.sendgrid.net',       port: 587, note: 'Usuario: apikey / Contraseña: tu API Key' },
  { label: 'Mailgun',           host: 'smtp.mailgun.org',        port: 587, note: '' },
  { label: 'Custom',            host: '',                        port: 587, note: '' },
]

const SES_REGIONS = [
  'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
  'eu-west-1', 'eu-west-2', 'eu-central-1',
  'ap-southeast-1', 'ap-southeast-2', 'ap-northeast-1', 'sa-east-1',
]

export default function EmailSettingsPage() {
  const [provider,    setProvider]    = useState<Provider>('SMTP')
  const [saving,      setSaving]      = useState(false)
  const [testing,     setTesting]     = useState(false)
  const [testResult,  setTestResult]  = useState<{ ok: boolean; error?: string } | null>(null)
  const [showPass,    setShowPass]    = useState(false)
  const [hasPassword, setHasPassword] = useState(false)
  const [hasSecretKey, setHasSecretKey] = useState(false)
  const [copied, setCopied] = useState(false)

  const smtpForm = useForm<SmtpData>({
    resolver: zodResolver(smtpSchema),
    defaultValues: { smtpHost: '', smtpPort: 587, smtpUser: '', smtpPass: '', smtpFrom: '' },
  })

  const sesForm = useForm<SesData>({
    resolver: zodResolver(sesSchema),
    defaultValues: { sesRegion: 'us-east-1', sesAccessKeyId: '', sesSecretKey: '', sesFrom: '', sesConfigSet: '' },
  })

  const webhookUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/webhooks/ses`
    : '/api/webhooks/ses'

  useEffect(() => {
    fetch('/api/settings/email')
      .then((r) => r.json())
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

  const copyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      let body: Record<string, unknown> = { test: true, smtpProvider: provider }
      if (provider === 'SES') {
        const d = sesForm.getValues()
        body = { ...body, ...d }
      } else {
        const d = smtpForm.getValues()
        if (!d.smtpPass && !hasPassword) {
          toast.error('Ingresá la contraseña para probar')
          setTesting(false)
          return
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
      if (provider === 'SMTP' && smtpForm.getValues('smtpPass')) setHasPassword(true)
      if (provider === 'SES'  && sesForm.getValues('sesSecretKey'))  setHasSecretKey(true)
    } catch { toast.error('Error al guardar') }
    finally { setSaving(false) }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl gradient-bg flex items-center justify-center">
          <Mail size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">Configuración de Email</h1>
          <p className="text-sm text-[var(--color-text-muted)]">Servidor para campañas y cotizaciones</p>
        </div>
      </div>

      {/* Provider selector */}
      <Card>
        <CardHeader>
          <CardTitle>Proveedor</CardTitle>
          <CardDescription>Elegí cómo enviar los emails</CardDescription>
        </CardHeader>
        <div className="flex gap-3">
          {(['SMTP', 'SES'] as Provider[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => { setProvider(p); setTestResult(null) }}
              className={`flex-1 py-3 px-4 rounded-xl border text-sm font-medium transition-all ${
                provider === p
                  ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                  : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-primary)]/50'
              }`}
            >
              {p === 'SES' ? '⚡ Amazon SES' : '📧 SMTP / Brevo'}
            </button>
          ))}
        </div>
      </Card>

      {/* SES form */}
      {provider === 'SES' && (
        <>
          <div className="surface rounded-2xl p-4 border-l-4 border-orange-400 bg-orange-500/5">
            <div className="flex gap-3">
              <Info size={16} className="text-orange-400 mt-0.5 shrink-0" />
              <div className="text-sm text-orange-300 space-y-1">
                <p className="font-medium">Amazon SES — alta entregabilidad + tracking</p>
                <p>Requiere cuenta AWS con SES activo y un dominio o email verificado. Para el tracking de rebotes y aperturas, configurá el webhook SNS (ver más abajo).</p>
              </div>
            </div>
          </div>

          <Card>
            <CardHeader><CardTitle>Credenciales Amazon SES</CardTitle></CardHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-[var(--color-text)] mb-1 block">Región AWS</label>
                <select
                  {...sesForm.register('sesRegion')}
                  className="w-full px-3 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                >
                  {SES_REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>

              <Input
                label="Access Key ID"
                placeholder="AKIA..."
                error={sesForm.formState.errors.sesAccessKeyId?.message}
                {...sesForm.register('sesAccessKeyId')}
              />

              <div className="relative">
                <Input
                  label={hasSecretKey ? 'Secret Access Key (dejar vacío para mantener)' : 'Secret Access Key'}
                  type={showPass ? 'text' : 'password'}
                  placeholder={hasSecretKey ? '••••••••••••' : 'Secret key de AWS'}
                  error={sesForm.formState.errors.sesSecretKey?.message}
                  {...sesForm.register('sesSecretKey')}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 bottom-3 text-[var(--color-text-subtle)] hover:text-[var(--color-text)]"
                >
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>

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
                hint="Nombre del configuration set en SES para recibir eventos de bounce/open/entrega"
                {...sesForm.register('sesConfigSet')}
              />
            </div>
          </Card>

          {/* SNS Webhook info */}
          <Card>
            <CardHeader>
              <CardTitle>Webhook SNS (tracking de eventos)</CardTitle>
              <CardDescription>Configurá este endpoint en AWS SNS para recibir notificaciones de entrega, rebotes y spam</CardDescription>
            </CardHeader>
            <div className="space-y-3">
              <div className="flex items-center gap-2 bg-[var(--color-surface-raised)] rounded-xl px-3 py-2.5">
                <code className="flex-1 text-xs text-[var(--color-text)] font-mono break-all">{webhookUrl}</code>
                <button
                  type="button"
                  onClick={copyWebhook}
                  className="shrink-0 p-1.5 rounded-lg hover:bg-[var(--color-surface-overlay)] text-[var(--color-text-subtle)] hover:text-[var(--color-primary)] transition-all"
                >
                  {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                </button>
              </div>
              <div className="text-xs text-[var(--color-text-muted)] space-y-1">
                <p className="font-medium text-[var(--color-text-subtle)]">Pasos en AWS:</p>
                <p>1. Creá un <strong>SNS Topic</strong> (tipo Standard)</p>
                <p>2. En el topic, creá una <strong>Suscripción</strong> con protocolo HTTPS y la URL de arriba</p>
                <p>3. El sistema confirmará la suscripción automáticamente</p>
                <p>4. En SES → Configuration Sets → el tuyo → Event destinations → asociá el topic SNS</p>
                <p>5. Activá los eventos: <strong>Delivery, Bounce, Complaint, Open</strong></p>
              </div>
            </div>
          </Card>
        </>
      )}

      {/* SMTP form */}
      {provider === 'SMTP' && (
        <>
          <div className="surface rounded-2xl p-4 border-l-4 border-blue-500 bg-blue-500/5">
            <div className="flex gap-3">
              <Info size={16} className="text-blue-400 mt-0.5 shrink-0" />
              <div className="text-sm text-blue-300 space-y-1">
                <p className="font-medium">¿Cómo funciona?</p>
                <p>El CRM usa tu propio servidor de email para enviar campañas. Para Gmail: activá la verificación en 2 pasos → buscá &quot;Contraseñas de aplicación&quot;.</p>
              </div>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Proveedor SMTP</CardTitle>
              <CardDescription>Seleccioná para auto-completar</CardDescription>
            </CardHeader>
            <div className="flex flex-wrap gap-2">
              {SMTP_PROVIDERS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => { smtpForm.setValue('smtpHost', p.host); smtpForm.setValue('smtpPort', p.port) }}
                  className="px-3 py-2 rounded-xl border border-[var(--color-border)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] text-sm text-[var(--color-text-muted)] transition-all"
                >
                  {p.label}
                </button>
              ))}
            </div>
            {SMTP_PROVIDERS.find((p) => p.host === smtpForm.watch('smtpHost'))?.note && (
              <p className="text-xs text-amber-400 bg-amber-500/10 px-3 py-2 rounded-xl mt-3">
                💡 {SMTP_PROVIDERS.find((p) => p.host === smtpForm.watch('smtpHost'))?.note}
              </p>
            )}
          </Card>

          {smtpForm.watch('smtpHost') === 'smtp-relay.brevo.com' && (
            <div className="surface rounded-2xl p-4 border-l-4 border-violet-500 bg-violet-500/5">
              <div className="flex gap-3">
                <Info size={16} className="text-violet-400 mt-0.5 shrink-0" />
                <div className="text-sm text-violet-300 space-y-1">
                  <p className="font-medium">Brevo: usá API Key para evitar bloqueos de IP</p>
                  <p>En Brevo → <strong>Configuración → API Keys</strong> → creá una nueva clave. Pegá la clave <code className="bg-violet-500/20 px-1 rounded text-xs">xkeysib-...</code> en el campo <strong>Contraseña</strong>.</p>
                </div>
              </div>
            </div>
          )}

          <form autoComplete="off">
            <Card>
              <CardHeader><CardTitle>Datos del Servidor SMTP</CardTitle></CardHeader>
              <div className="space-y-4">
                <input type="text" name="fake-user" style={{ display: 'none' }} autoComplete="username" readOnly />
                <input type="password" name="fake-pass" style={{ display: 'none' }} autoComplete="new-password" readOnly />

                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <Input label="Host SMTP" placeholder="smtp.gmail.com" error={smtpForm.formState.errors.smtpHost?.message} autoComplete="off" {...smtpForm.register('smtpHost')} />
                  </div>
                  <Input label="Puerto" type="number" placeholder="587" error={smtpForm.formState.errors.smtpPort?.message} autoComplete="off" {...smtpForm.register('smtpPort')} />
                </div>

                <Input label="Email / Usuario SMTP" type="text" placeholder="usuario@dominio.com" error={smtpForm.formState.errors.smtpUser?.message} autoComplete="off" {...smtpForm.register('smtpUser')} />

                <div className="relative">
                  <Input
                    label={hasPassword ? 'Contraseña / API Key (dejar vacío para mantener)' : 'Contraseña / API Key'}
                    type={showPass ? 'text' : 'password'}
                    placeholder={hasPassword ? '••••••••••••' : 'xkeysib-... o contraseña de aplicación'}
                    autoComplete="new-password"
                    {...smtpForm.register('smtpPass')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 bottom-3 text-[var(--color-text-subtle)] hover:text-[var(--color-text)]"
                  >
                    {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>

                <Input label="Nombre del remitente (opcional)" placeholder="Mi Agencia <hola@miagencia.com>" autoComplete="off" {...smtpForm.register('smtpFrom')} />
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
            : <><XCircle size={14} /> Error: {testResult.error}</>
          }
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
