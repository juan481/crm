'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  Mail, Download, Search, BarChart3, MessageCircle, FileText, Zap, Calendar, Puzzle,
  Settings, ArrowRight, CheckCircle, BookOpen,
} from 'lucide-react'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/store/auth-store'
import type { PluginDefinition } from '@/types'
import toast from 'react-hot-toast'

const ICON_MAP: Record<string, React.ReactNode> = {
  Mail: <Mail size={20} />, Download: <Download size={20} />, Search: <Search size={20} />,
  BarChart3: <BarChart3 size={20} />, MessageCircle: <MessageCircle size={20} />,
  FileText: <FileText size={20} />, Zap: <Zap size={20} />, Calendar: <Calendar size={20} />,
}

const CATEGORY_LABELS: Record<string, string> = {
  communication: 'Comunicación', analytics: 'Analíticas',
  integration: 'Integración', productivity: 'Productividad',
}
const CATEGORY_COLORS: Record<string, string> = {
  communication: 'info', analytics: 'primary', integration: 'warning', productivity: 'success',
}

const PLUGIN_EFFECTS: Record<string, { text: string; action?: { label: string; href: string } }> = {
  'email-campaigns': { text: 'Habilita el módulo Comunicaciones para enviar campañas de email masivo.', action: { label: 'Ir a Comunicaciones', href: '/comunicaciones' } },
  'export-data': { text: 'Muestra los botones Exportar XLS / CSV en el listado de clientes.', action: { label: 'Ver Clientes', href: '/clientes' } },
  'global-search': { text: 'Activa el buscador de clientes en la barra superior.' },
  'advanced-analytics': { text: 'Agrega la sección "Top Clientes por Ingreso" en el Dashboard.', action: { label: 'Ir al Dashboard', href: '/dashboard' } },
  'whatsapp-integration': { text: 'Muestra el botón WhatsApp en la ficha de cada cliente.', action: { label: 'Ver Clientes', href: '/clientes' } },
  'invoice-automation': { text: 'Permite crear facturas desde la ficha de cada cliente.', action: { label: 'Ir a Facturación', href: '/facturas' } },
  'zapier-webhooks': { text: 'Envía eventos automáticos a tu webhook cuando se crean clientes o se pagan facturas.' },
  'google-calendar': { text: 'Configura la integración con Google Calendar para sincronizar eventos.' },
}

interface PluginWithState extends PluginDefinition {
  enabled: boolean
  config: Record<string, unknown> | null
}

function ConfigModal({ plugin, onClose, onSaved }: { plugin: PluginWithState; onClose: () => void; onSaved: () => void }) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    if (plugin.configSchema) Object.keys(plugin.configSchema).forEach((k) => { init[k] = String((plugin.config as Record<string, unknown>)?.[k] ?? '') })
    return init
  })
  const [saving, setSaving] = useState(false)
  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/plugins', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pluginId: plugin.id, enabled: true, config: values }) })
      if (!res.ok) throw new Error()
      toast.success('Configuración guardada')
      onSaved(); onClose()
    } catch { toast.error('Error al guardar') } finally { setSaving(false) }
  }
  if (!plugin.configSchema) return null
  return (
    <div className="space-y-4">
      {Object.entries(plugin.configSchema).map(([key, field]) => (
        <Input key={key} label={field.label} placeholder={field.label} type={field.type === 'number' ? 'number' : 'text'} value={values[key] ?? ''} onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))} />
      ))}
      <div className="flex justify-end gap-3 pt-2">
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button onClick={handleSave} loading={saving}>Guardar</Button>
      </div>
    </div>
  )
}

export default function PluginsPage() {
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const isSuperAdmin = user?.role === 'SUPER_ADMIN'
  const [configPlugin, setConfigPlugin] = useState<PluginWithState | null>(null)

  const { data, isLoading } = useQuery<PluginWithState[]>({
    queryKey: ['plugins'],
    queryFn: async () => { const res = await fetch('/api/plugins'); const json = await res.json(); return json.data },
    staleTime: 60 * 1000,
  })

  const plugins = data ?? []
  const enabled = plugins.filter((p) => p.enabled).length

  const togglePlugin = async (plugin: PluginWithState) => {
    if (!isSuperAdmin) { toast.error('Solo el Super Admin puede gestionar plugins'); return }
    const newEnabled = !plugin.enabled
    qc.setQueryData<PluginWithState[]>(['plugins'], (old) => old?.map((p) => (p.id === plugin.id ? { ...p, enabled: newEnabled } : p)) ?? [])
    const res = await fetch('/api/plugins', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pluginId: plugin.id, enabled: newEnabled }) })
    const json = await res.json()
    if (!res.ok) { toast.error(json.error); qc.invalidateQueries({ queryKey: ['plugins'] }); return }
    toast.success(newEnabled ? `${plugin.name} activado` : `${plugin.name} desactivado`)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl gradient-bg flex items-center justify-center"><Puzzle size={20} className="text-white" /></div>
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">Plugins & Extensiones</h1>
          <p className="text-sm text-[var(--color-text-muted)]">{enabled} de {plugins.length} plugins activos</p>
        </div>
      </div>

      {!isSuperAdmin && (
        <div className="surface rounded-2xl p-4 border-l-4 border-amber-500 bg-amber-500/5">
          <p className="text-sm text-amber-400">Solo el Super Admin puede activar o desactivar plugins.</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {isLoading ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-56 rounded-2xl" />) : plugins.map((plugin, i) => {
          const effect = PLUGIN_EFFECTS[plugin.id]
          return (
            <motion.div key={plugin.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <Card className={`h-full flex flex-col gap-3 ${plugin.enabled ? 'border-[var(--color-primary)]/40' : ''}`}>
                <div className="flex items-start justify-between">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${plugin.enabled ? 'gradient-bg text-white' : 'bg-[var(--color-surface-raised)] text-[var(--color-text-subtle)]'}`}>
                    {ICON_MAP[plugin.icon] ?? <Puzzle size={20} />}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={CATEGORY_COLORS[plugin.category] as 'success' | 'info' | 'warning' | 'primary' | 'neutral'} size="sm">{CATEGORY_LABELS[plugin.category]}</Badge>
                    <button onClick={() => togglePlugin(plugin)} disabled={!isSuperAdmin}
                      className={`relative rounded-full transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed ${plugin.enabled ? 'gradient-bg' : 'bg-[var(--color-surface-raised)] border border-[var(--color-border-strong)]'}`}
                      style={{ width: 40, height: 22 }}>
                      <div className={`absolute top-[3px] w-4 h-4 rounded-full bg-white shadow-sm transition-all duration-300 ${plugin.enabled ? 'left-[22px]' : 'left-[3px]'}`} />
                    </button>
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-[var(--color-text)] mb-1">{plugin.name}</h3>
                  <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">{plugin.description}</p>
                </div>
                {plugin.enabled && effect && (
                  <div className="flex items-start gap-2 bg-[var(--color-primary-light)] rounded-xl p-3">
                    <CheckCircle size={14} className="text-[var(--color-primary)] mt-0.5 shrink-0" />
                    <p className="text-xs text-[var(--color-primary)] leading-relaxed">{effect.text}</p>
                  </div>
                )}
                <div className="flex items-center justify-between pt-2 border-t border-[var(--color-border)]">
                  <div className="flex items-center gap-2">
                    {plugin.enabled && plugin.requiresConfig && isSuperAdmin && (
                      <button onClick={() => setConfigPlugin(plugin)} className="flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors">
                        <Settings size={12} /> Configurar
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {plugin.enabled && effect?.action && (
                      <Link href={effect.action.href} className="flex items-center gap-1 text-xs text-[var(--color-primary)] hover:underline">
                        {effect.action.label}<ArrowRight size={11} />
                      </Link>
                    )}
                    <Badge variant={plugin.enabled ? 'success' : 'neutral'} size="sm" dot>{plugin.enabled ? 'Activo' : 'Inactivo'}</Badge>
                  </div>
                </div>
              </Card>
            </motion.div>
          )
        })}
      </div>

      <Modal open={!!configPlugin} onClose={() => setConfigPlugin(null)} title={`Configurar: ${configPlugin?.name}`} size="sm">
        {configPlugin && <ConfigModal plugin={configPlugin} onClose={() => setConfigPlugin(null)} onSaved={() => qc.invalidateQueries({ queryKey: ['plugins'] })} />}
      </Modal>
    </div>
  )
}
