'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Mail, CheckCircle, XCircle, Eye, EyeOff, Info } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import toast from 'react-hot-toast'

const schema = z.object({
  smtpHost: z.string().min(1, 'Requerido'),
  smtpPort: z.coerce.number().int().min(1).max(65535),
  smtpUser: z.string().email('Email inválido'),
  smtpPass: z.string().optional(),
  smtpFrom: z.string().optional(),
})
type FormData = z.infer<typeof schema>

const PROVIDERS = [
  { label: 'Gmail', host: 'smtp.gmail.com', port: 587, note: 'Requiere contraseña de aplicación (no tu contraseña de Gmail)' },
  { label: 'Outlook / Hotmail', host: 'smtp-mail.outlook.com', port: 587, note: '' },
  { label: 'Yahoo', host: 'smtp.mail.yahoo.com', port: 587, note: '' },
  { label: 'SendGrid', host: 'smtp.sendgrid.net', port: 587, note: 'Usuario: apikey / Contraseña: tu API Key' },
  { label: 'Mailgun', host: 'smtp.mailgun.org', port: 587, note: '' },
  { label: 'Custom', host: '', port: 587, note: '' },
]

export default function EmailSettingsPage() {
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string } | null>(null)
  const [showPass, setShowPass] = useState(false)
  const [hasPassword, setHasPassword] = useState(false)

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { smtpHost: '', smtpPort: 587, smtpUser: '', smtpPass: '', smtpFrom: '' },
  })

  useEffect(() => {
    fetch('/api/settings/email')
      .then((r) => r.json())
      .then(({ data }) => {
        if (data) {
          setValue('smtpHost', data.smtpHost || '')
          setValue('smtpPort', data.smtpPort || 587)
          setValue('smtpUser', data.smtpUser || '')
          setValue('smtpFrom', data.smtpFrom || '')
          setHasPassword(data.hasPassword)
        }
      })
  }, [setValue])

  const applyProvider = (provider: typeof PROVIDERS[0]) => {
    setValue('smtpHost', provider.host)
    setValue('smtpPort', provider.port)
  }

  const handleTest = async () => {
    const data = watch()
    if (!data.smtpHost || !data.smtpUser || !data.smtpPass) {
      toast.error('Completá host, usuario y contraseña para probar')
      return
    }
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch('/api/settings/email', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, test: true }),
      })
      const json = await res.json()
      setTestResult({ ok: json.ok, error: json.error })
      if (json.ok) toast.success('¡Conexión exitosa! Tu SMTP está funcionando.')
      else toast.error('Error de conexión: ' + json.error)
    } catch {
      toast.error('Error al probar conexión')
    } finally {
      setTesting(false)
    }
  }

  const onSubmit = async (data: FormData) => {
    setSaving(true)
    try {
      const res = await fetch('/api/settings/email', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error); return }
      toast.success('Configuración de email guardada')
      if (data.smtpPass) setHasPassword(true)
    } catch {
      toast.error('Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl gradient-bg flex items-center justify-center">
          <Mail size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">Configuración de Email</h1>
          <p className="text-sm text-[var(--color-text-muted)]">
            Configurá tu servidor SMTP para enviar campañas de email
          </p>
        </div>
      </div>

      {/* How it works */}
      <div className="surface rounded-2xl p-4 border-l-4 border-blue-500 bg-blue-500/5">
        <div className="flex gap-3">
          <Info size={16} className="text-blue-400 mt-0.5 shrink-0" />
          <div className="text-sm text-blue-300 space-y-1">
            <p className="font-medium">¿Cómo funciona?</p>
            <p>El CRM usa tu propio servidor de email para enviar campañas. Esto mantiene las campañas bajo tu dominio y mejora la entregabilidad.</p>
            <p>Para Gmail: activá la verificación en 2 pasos → buscá &quot;Contraseñas de aplicación&quot; en tu cuenta de Google → generá una contraseña para &quot;Otra aplicación&quot;.</p>
          </div>
        </div>
      </div>

      {/* Provider presets */}
      <Card>
        <CardHeader>
          <CardTitle>Proveedor de Email</CardTitle>
          <CardDescription>Seleccioná tu proveedor para auto-completar la configuración</CardDescription>
        </CardHeader>
        <div className="flex flex-wrap gap-2">
          {PROVIDERS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => applyProvider(p)}
              className="px-3 py-2 rounded-xl border border-[var(--color-border)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] text-sm text-[var(--color-text-muted)] transition-all"
            >
              {p.label}
            </button>
          ))}
        </div>
        {PROVIDERS.find((p) => p.host === watch('smtpHost'))?.note && (
          <p className="text-xs text-amber-400 bg-amber-500/10 px-3 py-2 rounded-xl mt-3">
            💡 {PROVIDERS.find((p) => p.host === watch('smtpHost'))?.note}
          </p>
        )}
      </Card>

      {/* SMTP Form */}
      <form onSubmit={handleSubmit(onSubmit)}>
        <Card>
          <CardHeader>
            <CardTitle>Datos del Servidor SMTP</CardTitle>
          </CardHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <Input
                  label="Host SMTP"
                  placeholder="smtp.gmail.com"
                  error={errors.smtpHost?.message}
                  {...register('smtpHost')}
                />
              </div>
              <Input
                label="Puerto"
                type="number"
                placeholder="587"
                error={errors.smtpPort?.message}
                {...register('smtpPort')}
              />
            </div>

            <Input
              label="Email / Usuario"
              type="email"
              placeholder="tu@email.com"
              error={errors.smtpUser?.message}
              {...register('smtpUser')}
            />

            <div className="relative">
              <Input
                label={hasPassword ? 'Contraseña (dejar vacío para mantener la actual)' : 'Contraseña / API Key'}
                type={showPass ? 'text' : 'password'}
                placeholder={hasPassword ? '••••••••••••' : 'Contraseña de aplicación'}
                {...register('smtpPass')}
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
              label="Nombre del remitente (opcional)"
              placeholder="Mi Agencia <hola@miagencia.com>"
              {...register('smtpFrom')}
            />

            {/* Test result */}
            {testResult && (
              <div className={`flex items-center gap-2 p-3 rounded-xl text-sm ${testResult.ok ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                {testResult.ok
                  ? <><CheckCircle size={14} /> Conexión exitosa — el email está configurado correctamente</>
                  : <><XCircle size={14} /> Error: {testResult.error}</>
                }
              </div>
            )}
          </div>
        </Card>

        <div className="flex justify-end gap-3 mt-4">
          <Button type="button" variant="secondary" onClick={handleTest} loading={testing}>
            Probar conexión
          </Button>
          <Button type="submit" loading={saving}>
            Guardar configuración
          </Button>
        </div>
      </form>
    </div>
  )
}
