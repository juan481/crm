'use client'

import { useRef, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Upload, Save, RotateCcw, Shield, X, Receipt, Clock } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useThemeStore } from '@/store/theme-store'
import { useAuthStore } from '@/store/auth-store'
import toast from 'react-hot-toast'

const schema = z.object({
  crmName: z.string().min(2, 'Mínimo 2 caracteres').max(40),
  name: z.string().min(2, 'Mínimo 2 caracteres').max(60),
  quoteValidityDays: z.coerce.number().int().min(1, 'Mínimo 1 día').max(365, 'Máximo 365 días'),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Color inválido'),
  secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Color inválido'),
  billingAddress: z.string().optional(),
  billingEmail: z.string().optional(),
  billingPhone: z.string().optional(),
  billingTaxId: z.string().optional(),
  paymentInstructions: z.string().optional(),
})
type FormData = z.infer<typeof schema>

const PRESET_PALETTES = [
  { name: 'Indigo', primary: '#6366f1', secondary: '#8b5cf6' },
  { name: 'Blue', primary: '#3b82f6', secondary: '#6366f1' },
  { name: 'Emerald', primary: '#10b981', secondary: '#3b82f6' },
  { name: 'Rose', primary: '#f43f5e', secondary: '#ec4899' },
  { name: 'Amber', primary: '#f59e0b', secondary: '#ef4444' },
  { name: 'Cyan', primary: '#06b6d4', secondary: '#3b82f6' },
]

export default function MarcaPage() {
  const router = useRouter()
  const { user } = useAuthStore()
  const { crmName, primaryColor, secondaryColor, logoUrl, loadBranding, applyTheme } = useThemeStore()

  const [saving, setSaving] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [previewPrimary, setPreviewPrimary] = useState(primaryColor)
  const [previewSecondary, setPreviewSecondary] = useState(secondaryColor)
  const [loadingBilling, setLoadingBilling] = useState(true)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (user && user.role !== 'SUPER_ADMIN') router.replace('/dashboard')
  }, [user, router])

  const { register, handleSubmit, setValue, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { crmName, primaryColor, secondaryColor, name: '', quoteValidityDays: 30 },
  })

  useEffect(() => {
    fetch('/api/settings/branding')
      .then((r) => r.json())
      .then(({ data }) => {
        if (!data) return
        reset({
          crmName: data.crmName ?? crmName,
          name: data.name ?? '',
          quoteValidityDays: data.quoteValidityDays ?? 30,
          primaryColor: data.primaryColor ?? primaryColor,
          secondaryColor: data.secondaryColor ?? secondaryColor,
          billingAddress: data.billingAddress ?? '',
          billingEmail: data.billingEmail ?? '',
          billingPhone: data.billingPhone ?? '',
          billingTaxId: data.billingTaxId ?? '',
          paymentInstructions: data.paymentInstructions ?? '',
        })
      })
      .catch(() => {})
      .finally(() => setLoadingBilling(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!user || user.role !== 'SUPER_ADMIN') return null

  const applyPreset = (primary: string, secondary: string) => {
    setValue('primaryColor', primary)
    setValue('secondaryColor', secondary)
    setPreviewPrimary(primary)
    setPreviewSecondary(secondary)
    applyTheme(primary, secondary)
  }

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { toast.error('El archivo debe ser menor a 2MB'); return }

    setUploadingLogo(true)
    try {
      const fd = new FormData()
      fd.append('logo', file)
      const res = await fetch('/api/settings/branding/logo', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'Error al subir logo'); return }
      loadBranding({ crmName, primaryColor, secondaryColor, logoUrl: json.data.logoUrl })
      toast.success('Logo actualizado correctamente')
    } catch {
      toast.error('Error al subir el logo')
    } finally {
      setUploadingLogo(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleRemoveLogo = async () => {
    try {
      const res = await fetch('/api/settings/branding', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logoUrl: null }),
      })
      if (!res.ok) throw new Error()
      loadBranding({ crmName, primaryColor, secondaryColor, logoUrl: null })
      toast.success('Logo eliminado')
    } catch { toast.error('Error al eliminar logo') }
  }

  const onSubmit = async (data: FormData) => {
    setSaving(true)
    try {
      const res = await fetch('/api/settings/branding', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error); return }
      loadBranding({ crmName: data.crmName, primaryColor: data.primaryColor, secondaryColor: data.secondaryColor, logoUrl })
      toast.success('Configuración guardada correctamente')
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
          <Shield size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">Marca y Configuración</h1>
          <p className="text-sm text-[var(--color-text-muted)]">Logo, colores y datos de facturación</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Identidad */}
        <Card>
          <CardHeader>
            <CardTitle>Identidad</CardTitle>
            <CardDescription>Nombre y logo del CRM</CardDescription>
          </CardHeader>
          <div className="space-y-4">
            <div>
              <Input label="Nombre de la marca / empresa" placeholder="Mi Empresa S.A." error={errors.name?.message} {...register('name')} />
              <p className="text-xs mt-1" style={{ color: 'var(--color-text-subtle)' }}>
                Este es el que ven tus clientes: aparece en cotizaciones, facturas y emails enviados.
              </p>
            </div>
            <div>
              <Input label="Nombre del CRM" placeholder="Mi CRM" error={errors.crmName?.message} {...register('crmName')} />
              <p className="text-xs mt-1" style={{ color: 'var(--color-text-subtle)' }}>
                Uso interno: el nombre que ve tu equipo dentro de esta plataforma (menú, título de pestaña).
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-[var(--color-text-muted)] block mb-1.5">Logo</label>
              <input ref={fileInputRef} type="file" className="hidden" accept="image/png,image/jpeg,image/svg+xml" onChange={handleLogoChange} />
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-[var(--color-border-strong)] rounded-2xl p-8 flex flex-col items-center gap-3 hover:border-[var(--color-primary)] transition-colors cursor-pointer"
              >
                {logoUrl ? (
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={logoUrl} alt="Logo" className="h-12 object-contain" />
                    <button type="button" onClick={(e) => { e.stopPropagation(); handleRemoveLogo() }}
                      className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white">
                      <X size={10} />
                    </button>
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded-xl gradient-bg flex items-center justify-center text-white font-bold text-xl">
                    {crmName.charAt(0)}
                  </div>
                )}
                <div className="text-center">
                  <p className="text-sm font-medium text-[var(--color-text)]">{uploadingLogo ? 'Subiendo...' : 'Clic para subir logo'}</p>
                  <p className="text-xs text-[var(--color-text-subtle)]">PNG, SVG o JPG — Máx 2MB</p>
                </div>
                <Button variant="secondary" size="sm" type="button" leftIcon={<Upload size={14} />} loading={uploadingLogo}
                  onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click() }}>
                  Seleccionar archivo
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {/* Colores */}
        <Card>
          <CardHeader>
            <CardTitle>Paleta de Colores</CardTitle>
            <CardDescription>Los cambios se aplican en tiempo real a toda la interfaz</CardDescription>
          </CardHeader>
          <div className="mb-5">
            <p className="text-xs font-semibold text-[var(--color-text-subtle)] uppercase tracking-wider mb-3">Paletas predefinidas</p>
            <div className="flex flex-wrap gap-2">
              {PRESET_PALETTES.map((preset) => (
                <button key={preset.name} type="button" onClick={() => applyPreset(preset.primary, preset.secondary)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[var(--color-border)] hover:border-[var(--color-border-strong)] transition-all text-sm text-[var(--color-text-muted)]">
                  <div className="flex gap-1">
                    <div className="w-4 h-4 rounded-full" style={{ background: preset.primary }} />
                    <div className="w-4 h-4 rounded-full" style={{ background: preset.secondary }} />
                  </div>
                  {preset.name}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Input label="Color Primario" type="color" className="h-11 cursor-pointer" error={errors.primaryColor?.message}
                {...register('primaryColor', { onChange: (e) => { setPreviewPrimary(e.target.value); applyTheme(e.target.value, previewSecondary) } })} />
              <p className="text-xs text-[var(--color-text-subtle)] mt-1">Botones, links, acentos principales</p>
            </div>
            <div>
              <Input label="Color Secundario" type="color" className="h-11 cursor-pointer" error={errors.secondaryColor?.message}
                {...register('secondaryColor', { onChange: (e) => { setPreviewSecondary(e.target.value); applyTheme(previewPrimary, e.target.value) } })} />
              <p className="text-xs text-[var(--color-text-subtle)] mt-1">Gradientes y elementos secundarios</p>
            </div>
          </div>
          <div className="mt-5 p-4 surface-raised rounded-2xl">
            <p className="text-xs font-semibold text-[var(--color-text-subtle)] uppercase tracking-wider mb-3">Vista Previa</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="px-4 py-2 rounded-xl text-sm font-medium text-white" style={{ background: `linear-gradient(135deg, ${previewPrimary}, ${previewSecondary})` }}>Botón Principal</button>
              <button type="button" className="px-4 py-2 rounded-xl text-sm font-medium border" style={{ borderColor: previewPrimary, color: previewPrimary }}>Botón Outline</button>
              <span className="px-3 py-1 rounded-full text-xs font-medium" style={{ background: `${previewPrimary}22`, color: previewPrimary }}>Badge</span>
            </div>
          </div>
        </Card>

        {/* Cotizador */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock size={16} />
              Cotizador
            </CardTitle>
            <CardDescription>Validez por defecto de las cotizaciones que emite tu equipo</CardDescription>
          </CardHeader>
          <div>
            <Input
              label="Validez de la cotización (días)"
              type="number" min={1} max={365}
              className="max-w-[10rem]"
              error={errors.quoteValidityDays?.message}
              {...register('quoteValidityDays')}
            />
            <p className="text-xs mt-1" style={{ color: 'var(--color-text-subtle)' }}>
              Se usa como valor inicial al crear una cotización nueva (ej: &quot;Válida por 30 días&quot;). Se puede ajustar caso por caso desde el cotizador.
            </p>
          </div>
        </Card>

        {/* Datos de Facturación */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt size={16} />
              Datos de Facturación
            </CardTitle>
            <CardDescription>Estos datos aparecen en las facturas generadas</CardDescription>
          </CardHeader>
          {loadingBilling ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 rounded-xl" />)}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input label="Email de facturación" type="email" placeholder="facturacion@empresa.com" error={errors.billingEmail?.message} {...register('billingEmail')} />
                <Input label="Teléfono" placeholder="+54 11 0000-0000" {...register('billingPhone')} />
              </div>
              <Input label="Dirección fiscal" placeholder="Av. San Martín 1234, Buenos Aires" {...register('billingAddress')} />
              <Input label="CUIT / RUT / Tax ID" placeholder="30-00000000-0" {...register('billingTaxId')} />
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
                  Instrucciones de pago
                </label>
                <textarea
                  {...register('paymentInstructions')}
                  rows={3}
                  placeholder="Ej: Transferencia bancaria al CBU 0000000000000000000000, titular: Empresa S.A."
                  className="w-full rounded-xl px-3 py-2.5 text-sm resize-none outline-none transition-all"
                  style={{
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text)',
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--color-primary)' }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)' }}
                />
              </div>
            </div>
          )}
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" leftIcon={<RotateCcw size={14} />} onClick={() => applyPreset('#6366f1', '#8b5cf6')}>
            Restaurar colores
          </Button>
          <Button type="submit" loading={saving} leftIcon={<Save size={15} />}>Guardar Cambios</Button>
        </div>
      </form>
    </div>
  )
}
