'use client'

import { useState, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion } from 'framer-motion'
import { Upload, Palette, Save, Eye, RotateCcw, Shield } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useThemeStore } from '@/store/theme-store'
import toast from 'react-hot-toast'

const schema = z.object({
  crmName: z.string().min(2, 'Mínimo 2 caracteres').max(40),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Color inválido'),
  secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Color inválido'),
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

export default function BrandingPage() {
  const { crmName, primaryColor, secondaryColor, logoUrl, loadBranding, applyTheme } = useThemeStore()
  const [saving, setSaving] = useState(false)
  const [previewPrimary, setPreviewPrimary] = useState(primaryColor)
  const [previewSecondary, setPreviewSecondary] = useState(secondaryColor)

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { crmName, primaryColor, secondaryColor },
  })

  const applyPreset = (primary: string, secondary: string) => {
    setValue('primaryColor', primary)
    setValue('secondaryColor', secondary)
    setPreviewPrimary(primary)
    setPreviewSecondary(secondary)
    applyTheme(primary, secondary)
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

      loadBranding({
        crmName: data.crmName,
        primaryColor: data.primaryColor,
        secondaryColor: data.secondaryColor,
        logoUrl,
      })
      toast.success('Branding actualizado correctamente')
    } catch {
      toast.error('Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl gradient-bg flex items-center justify-center">
          <Shield size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">Marca Blanca</h1>
          <p className="text-sm text-[var(--color-text-muted)]">
            Personaliza el branding del CRM para tu organización
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* CRM Name */}
        <Card>
          <CardHeader>
            <CardTitle>Identidad</CardTitle>
            <CardDescription>Nombre y logo del CRM</CardDescription>
          </CardHeader>
          <div className="space-y-4">
            <Input
              label="Nombre del CRM"
              placeholder="Mi CRM"
              error={errors.crmName?.message}
              {...register('crmName')}
            />

            {/* Logo placeholder */}
            <div>
              <label className="text-sm font-medium text-[var(--color-text-muted)] block mb-1.5">
                Logo
              </label>
              <div className="border-2 border-dashed border-[var(--color-border-strong)] rounded-2xl p-8 flex flex-col items-center gap-3 hover:border-[var(--color-primary)] transition-colors cursor-pointer">
                {logoUrl ? (
                  <img src={logoUrl} alt="Logo" className="h-12 object-contain" />
                ) : (
                  <div className="w-12 h-12 rounded-xl gradient-bg flex items-center justify-center text-white font-bold text-xl">
                    {crmName.charAt(0)}
                  </div>
                )}
                <div className="text-center">
                  <p className="text-sm font-medium text-[var(--color-text)]">Subir logo</p>
                  <p className="text-xs text-[var(--color-text-subtle)]">PNG, SVG o JPG — Máx 2MB</p>
                </div>
                <Button variant="secondary" size="sm" type="button" leftIcon={<Upload size={14} />}>
                  Seleccionar archivo
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {/* Colors */}
        <Card>
          <CardHeader>
            <CardTitle>Paleta de Colores</CardTitle>
            <CardDescription>Los cambios se aplican en tiempo real a toda la interfaz</CardDescription>
          </CardHeader>

          {/* Presets */}
          <div className="mb-5">
            <p className="text-xs font-semibold text-[var(--color-text-subtle)] uppercase tracking-wider mb-3">
              Paletas predefinidas
            </p>
            <div className="flex flex-wrap gap-2">
              {PRESET_PALETTES.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => applyPreset(preset.primary, preset.secondary)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[var(--color-border)] hover:border-[var(--color-border-strong)] transition-all text-sm text-[var(--color-text-muted)]"
                >
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
              <Input
                label="Color Primario"
                type="color"
                className="h-11 cursor-pointer"
                error={errors.primaryColor?.message}
                {...register('primaryColor', {
                  onChange: (e) => {
                    setPreviewPrimary(e.target.value)
                    applyTheme(e.target.value, previewSecondary)
                  },
                })}
              />
              <p className="text-xs text-[var(--color-text-subtle)] mt-1">
                Botones, links, acentos principales
              </p>
            </div>
            <div>
              <Input
                label="Color Secundario"
                type="color"
                className="h-11 cursor-pointer"
                error={errors.secondaryColor?.message}
                {...register('secondaryColor', {
                  onChange: (e) => {
                    setPreviewSecondary(e.target.value)
                    applyTheme(previewPrimary, e.target.value)
                  },
                })}
              />
              <p className="text-xs text-[var(--color-text-subtle)] mt-1">
                Gradientes y elementos secundarios
              </p>
            </div>
          </div>

          {/* Preview */}
          <div className="mt-5 p-4 surface-raised rounded-2xl">
            <p className="text-xs font-semibold text-[var(--color-text-subtle)] uppercase tracking-wider mb-3">
              Vista Previa
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="px-4 py-2 rounded-xl text-sm font-medium text-white"
                style={{ background: `linear-gradient(135deg, ${previewPrimary}, ${previewSecondary})` }}
              >
                Botón Principal
              </button>
              <button
                type="button"
                className="px-4 py-2 rounded-xl text-sm font-medium border"
                style={{ borderColor: previewPrimary, color: previewPrimary }}
              >
                Botón Outline
              </button>
              <span
                className="px-3 py-1 rounded-full text-xs font-medium"
                style={{ background: `${previewPrimary}22`, color: previewPrimary }}
              >
                Badge
              </span>
            </div>
          </div>
        </Card>

        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="ghost"
            leftIcon={<RotateCcw size={14} />}
            onClick={() => applyPreset('#6366f1', '#8b5cf6')}
          >
            Restaurar predeterminado
          </Button>
          <Button type="submit" loading={saving} leftIcon={<Save size={15} />}>
            Guardar Cambios
          </Button>
        </div>
      </form>
    </div>
  )
}
