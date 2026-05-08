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
  Mail: <Mail size={20} />,
  Download: <Download size={20} />,
  Search: <Search size={20} />,
  BarChart3: <BarChart3 size={20} />,
  MessageCircle: <MessageCircle size={20} />,
  FileText: <FileText size={20} />,
  Zap: <Zap size={20} />,
  Calendar: <Calendar size={20} />,
}

const CATEGORY_LABELS: Record<string, string> = {
  communication: 'Comunicación',
  analytics: 'Analíticas',
  integration: 'Integración',
  productivity: 'Productividad',
}

const CATEGORY_COLORS: Record<string, string> = {
  communication: 'info',
  analytics: 'primary',
  integration: 'warning',
  productivity: 'success',
}

const PLUGIN_EFFECTS: Record<string, { text: string; action?: { label: string; href: string } }> = {
  'email-campaigns': {
    text: 'Habilita el módulo Comunicaciones para enviar campañas de email masivo.',
    action: { label: 'Ir a Comunicaciones', href: '/communications' },
  },
  'export-data': {
    text: 'Muestra los botones Exportar XLS / CSV en el listado de clientes.',
    action: { label: 'Ver Clientes', href: '/clients' },
  },
  'global-search': {
    text: 'Activa el buscador de clientes en la barra superior.',
  },
  'advanced-analytics': {
    text: 'Agrega la sección "Top Clientes por Ingreso" en el Dashboard.',
    action: { label: 'Ir al Dashboard', href: '/dashboard' },
  },
  'whatsapp-integration': {
    text: 'Muestra el botón WhatsApp en la ficha de cada cliente (requiere número de teléfono).',
    action: { label: 'Ver un Cliente', href: '/clients' },
  },
  'invoice-automation': {
    text: 'Permite crear facturas directamente desde la ficha de cada cliente.',
    action: { label: 'Ir a Facturación', href: '/invoices' },
  },
  'zapier-webhooks': {
    text: 'Envía eventos automáticos a tu webhook cuando se crean clientes o se pagan facturas.',
  },
  'google-calendar': {
    text: 'Configura la integración con Google Calendar para sincronizar eventos.',
  },
}

interface GuideStep { title: string; description: string }

const PLUGIN_GUIDES: Record<string, { intro: string; steps: GuideStep[]; action?: { label: string; href: string } }> = {
  'email-campaigns': {
    intro: 'Para enviar campañas de email necesitás configurar tu servidor SMTP. Te guiamos paso a paso:',
    steps: [
      { title: 'Ir a Configuración → Email SMTP', description: 'Accedé desde el menú lateral a la sección "Email SMTP".' },
      { title: 'Elegir tu proveedor', description: 'Seleccioná Gmail, Outlook, SendGrid u otro. El host y puerto se completan automáticamente.' },
      { title: 'Gmail: obtener contraseña de aplicación', description: 'Activá verificación en 2 pasos en tu cuenta Google → buscá "Contraseñas de aplicación" → generá una para "Otra aplicación".' },
      { title: 'SendGrid / Mailgun', description: 'Iniciá sesión en tu cuenta → API Keys → crear clave → pegala como contraseña. El usuario es "apikey".' },
      { title: 'Probar la conexión', description: 'Hacé clic en "Probar conexión" para verificar que los datos sean correctos antes de guardar.' },
      { title: 'Crear una campaña', description: 'Ir a Comunicaciones → Nueva Campaña → elegí destinatarios y enviá.' },
    ],
    action: { label: 'Ir a Email SMTP', href: '/settings/email' },
  },
  'whatsapp-integration': {
    intro: 'Este plugin abre WhatsApp Web o la app móvil con el número del cliente prellenado. No requiere API externa:',
    steps: [
      { title: 'Activar el plugin', description: 'Con el plugin activo, aparece un botón de WhatsApp en la ficha de cada cliente.' },
      { title: 'El cliente necesita teléfono', description: 'Asegurate de que cada cliente tenga el campo "Teléfono" completado en su ficha.' },
      { title: 'Usar el botón', description: 'En la ficha del cliente hacé clic en el botón verde de WhatsApp. Se abre wa.me con el número del cliente.' },
      { title: 'Para WhatsApp Business API (masivo)', description: 'Necesitás una cuenta Meta Business. Ir a business.facebook.com → WhatsApp → crear cuenta → obtener token de acceso y Phone ID.' },
      { title: 'Guardar las credenciales', description: 'Volvé aquí, hacé clic en "Configurar" en el plugin de WhatsApp y pegá el Phone ID y Token de Meta.' },
    ],
    action: { label: 'Ver Clientes', href: '/clients' },
  },
  'zapier-webhooks': {
    intro: 'Conectá tu CRM con +5000 apps via Zapier. Cada vez que se crea un cliente o se paga una factura, Zapier recibe los datos:',
    steps: [
      { title: 'Crear una cuenta en Zapier', description: 'Ir a zapier.com → registrarte o iniciar sesión.' },
      { title: 'Crear un nuevo Zap', description: 'Hacé clic en "Create Zap" → buscar "Webhooks by Zapier" como trigger → seleccionar "Catch Hook".' },
      { title: 'Copiar tu webhook URL', description: 'Zapier te da una URL como https://hooks.zapier.com/hooks/catch/xxxx/yyyy. Copiá esa URL.' },
      { title: 'Pegar la URL aquí', description: 'Volvé al CRM → hacé clic en "Configurar" → pegá la URL en el campo Webhook URL → Guardar.' },
      { title: 'Elegir la acción en Zapier', description: 'De vuelta en Zapier, elegí qué hacer con los datos: enviar email, crear tarea en Trello, agregar a Google Sheets, etc.' },
      { title: 'Activar el Zap', description: 'Publicá el Zap en Zapier y el CRM empezará a enviarle eventos automáticamente.' },
    ],
  },
  'google-calendar': {
    intro: 'Sincronizá recordatorios y reuniones con Google Calendar. Requiere crear credenciales en Google Cloud:',
    steps: [
      { title: 'Crear proyecto en Google Cloud', description: 'Ir a console.cloud.google.com → crear proyecto nuevo.' },
      { title: 'Activar Google Calendar API', description: 'En "APIs & Services" → "Library" → buscar "Google Calendar API" → activar.' },
      { title: 'Crear credenciales OAuth 2.0', description: '"APIs & Services" → "Credentials" → "Create credentials" → "OAuth client ID" → tipo "Web application".' },
      { title: 'Configurar URLs autorizadas', description: 'En Authorized redirect URIs agregá: https://tu-dominio.com/api/integrations/calendar/callback.' },
      { title: 'Copiar Client ID y Client Secret', description: 'Google te muestra las credenciales. Copialas y pegalas en "Configurar" del plugin.' },
      { title: 'Autorizar la cuenta', description: 'Después de guardar las credenciales, hacé clic en "Conectar con Google" para autorizar el acceso a tu calendario.' },
    ],
  },
  'advanced-analytics': {
    intro: 'No requiere configuración adicional. Al activarlo verás:',
    steps: [
      { title: 'Top Clientes por Ingreso', description: 'En el Dashboard aparece una nueva sección con los clientes ordenados por MRR.' },
      { title: 'Datos en tiempo real', description: 'La sección se actualiza automáticamente cada vez que cambia el MRR de un cliente.' },
    ],
    action: { label: 'Ver Dashboard', href: '/dashboard' },
  },
  'export-data': {
    intro: 'No requiere configuración. Al activarlo:',
    steps: [
      { title: 'Botones de exportación', description: 'En el listado de Clientes aparecen botones para exportar a Excel (XLS) y CSV.' },
      { title: 'Datos incluidos', description: 'El export incluye nombre, email, teléfono, estado, MRR y servicio asignado de cada cliente.' },
    ],
    action: { label: 'Ver Clientes', href: '/clients' },
  },
  'global-search': {
    intro: 'No requiere configuración. Al activarlo:',
    steps: [
      { title: 'Barra de búsqueda', description: 'Aparece una barra en el header para buscar clientes por nombre o email.' },
      { title: 'Resultados instantáneos', description: 'Los resultados se muestran en tiempo real mientras escribís, sin necesidad de presionar Enter.' },
    ],
  },
  'invoice-automation': {
    intro: 'No requiere configuración. Al activarlo:',
    steps: [
      { title: 'Botón "Nueva Factura"', description: 'En la ficha de cada cliente aparece un botón para crear facturas directamente.' },
      { title: 'Generación mensual', description: 'En Facturación podés usar "Generar Facturas del Mes" para crear facturas para todos los clientes activos con MRR.' },
    ],
    action: { label: 'Ir a Facturación', href: '/invoices' },
  },
}

interface PluginWithState extends PluginDefinition {
  enabled: boolean
  config: Record<string, unknown> | null
}

interface ConfigModalProps {
  plugin: PluginWithState
  onClose: () => void
  onSaved: () => void
}

function ConfigModal({ plugin, onClose, onSaved }: ConfigModalProps) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    if (plugin.configSchema) {
      Object.keys(plugin.configSchema).forEach((k) => {
        init[k] = String((plugin.config as Record<string, unknown>)?.[k] ?? '')
      })
    }
    return init
  })
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/plugins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pluginId: plugin.id, enabled: true, config: values }),
      })
      if (!res.ok) throw new Error()
      toast.success('Configuración guardada')
      onSaved()
      onClose()
    } catch {
      toast.error('Error al guardar configuración')
    } finally {
      setSaving(false)
    }
  }

  if (!plugin.configSchema) return null

  return (
    <div className="space-y-4">
      {Object.entries(plugin.configSchema).map(([key, field]) => (
        <Input
          key={key}
          label={field.label}
          placeholder={field.type === 'number' ? '0' : field.label}
          type={field.type === 'number' ? 'number' : 'text'}
          value={values[key] ?? ''}
          onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
        />
      ))}
      <div className="flex justify-end gap-3 pt-2">
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button onClick={handleSave} loading={saving}>Guardar</Button>
      </div>
    </div>
  )
}

function GuideModal({ plugin, onClose }: { plugin: PluginWithState; onClose: () => void }) {
  const guide = PLUGIN_GUIDES[plugin.id]
  if (!guide) return null
  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--color-text-muted)]">{guide.intro}</p>
      <ol className="space-y-3">
        {guide.steps.map((step, i) => (
          <li key={i} className="flex gap-3">
            <span className="w-6 h-6 rounded-full gradient-bg text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
              {i + 1}
            </span>
            <div>
              <p className="text-sm font-medium text-[var(--color-text)]">{step.title}</p>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{step.description}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className="flex justify-end gap-3 pt-2 border-t border-[var(--color-border)]">
        {guide.action && (
          <Link href={guide.action.href} onClick={onClose}>
            <Button variant="secondary" rightIcon={<ArrowRight size={14} />}>{guide.action.label}</Button>
          </Link>
        )}
        <Button onClick={onClose}>Entendido</Button>
      </div>
    </div>
  )
}

export default function PluginsPage() {
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const isSuperAdmin = user?.role === 'SUPER_ADMIN'
  const [configPlugin, setConfigPlugin] = useState<PluginWithState | null>(null)
  const [guidePlugin, setGuidePlugin] = useState<PluginWithState | null>(null)

  const { data, isLoading } = useQuery<PluginWithState[]>({
    queryKey: ['plugins'],
    queryFn: async () => {
      const res = await fetch('/api/plugins')
      const json = await res.json()
      return json.data
    },
    staleTime: 60 * 1000,
  })

  const plugins = data ?? []
  const enabled = plugins.filter((p) => p.enabled).length

  const togglePlugin = async (plugin: PluginWithState) => {
    if (!isSuperAdmin) {
      toast.error('Solo el Super Admin puede gestionar plugins')
      return
    }

    const newEnabled = !plugin.enabled

    if (newEnabled && plugin.requiresConfig && !plugin.config) {
      qc.setQueryData<PluginWithState[]>(['plugins'], (old) =>
        old?.map((p) => (p.id === plugin.id ? { ...p, enabled: true } : p)) ?? []
      )
      setConfigPlugin({ ...plugin, enabled: true })
      return
    }

    qc.setQueryData<PluginWithState[]>(['plugins'], (old) =>
      old?.map((p) => (p.id === plugin.id ? { ...p, enabled: newEnabled } : p)) ?? []
    )

    const res = await fetch('/api/plugins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pluginId: plugin.id, enabled: newEnabled }),
    })
    const json = await res.json()

    if (!res.ok) {
      toast.error(json.error)
      qc.invalidateQueries({ queryKey: ['plugins'] })
      return
    }

    const effect = PLUGIN_EFFECTS[plugin.id]
    toast.success(newEnabled
      ? `${plugin.name} activado — ${effect?.text ?? ''}`
      : `${plugin.name} desactivado`
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl gradient-bg flex items-center justify-center">
          <Puzzle size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">Plugins & Extensiones</h1>
          <p className="text-sm text-[var(--color-text-muted)]">
            {enabled} de {plugins.length} plugins activos
          </p>
        </div>
      </div>

      {!isSuperAdmin && (
        <div className="surface rounded-2xl p-4 border-l-4 border-amber-500 bg-amber-500/5">
          <p className="text-sm text-amber-400">
            Solo el Super Admin puede activar o desactivar plugins.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-56 rounded-2xl" />)
          : plugins.map((plugin, i) => {
              const effect = PLUGIN_EFFECTS[plugin.id]
              return (
                <motion.div
                  key={plugin.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <Card className={`h-full flex flex-col gap-3 ${plugin.enabled ? 'border-[var(--color-primary)]/40' : ''}`}>
                    {/* Header row */}
                    <div className="flex items-start justify-between">
                      <div
                        className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                          plugin.enabled
                            ? 'gradient-bg text-white'
                            : 'bg-[var(--color-surface-raised)] text-[var(--color-text-subtle)]'
                        }`}
                      >
                        {ICON_MAP[plugin.icon] ?? <Puzzle size={20} />}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={CATEGORY_COLORS[plugin.category] as 'success' | 'info' | 'warning' | 'primary' | 'neutral'}
                          size="sm"
                        >
                          {CATEGORY_LABELS[plugin.category]}
                        </Badge>
                        <button
                          onClick={() => togglePlugin(plugin)}
                          disabled={!isSuperAdmin}
                          className={`relative rounded-full transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0 ${
                            plugin.enabled ? 'gradient-bg' : 'bg-[var(--color-surface-raised)] border border-[var(--color-border-strong)]'
                          }`}
                          style={{ width: 40, height: 22 }}
                        >
                          <div
                            className={`absolute top-[3px] w-4 h-4 rounded-full bg-white shadow-sm transition-all duration-300 ${
                              plugin.enabled ? 'left-[22px]' : 'left-[3px]'
                            }`}
                          />
                        </button>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1">
                      <h3 className="font-semibold text-[var(--color-text)] mb-1">{plugin.name}</h3>
                      <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                        {plugin.description}
                      </p>
                    </div>

                    {/* Effect info */}
                    {plugin.enabled && effect && (
                      <div className="flex items-start gap-2 bg-[var(--color-primary-light)] rounded-xl p-3">
                        <CheckCircle size={14} className="text-[var(--color-primary)] mt-0.5 shrink-0" />
                        <p className="text-xs text-[var(--color-primary)] leading-relaxed">{effect.text}</p>
                      </div>
                    )}

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-2 border-t border-[var(--color-border)]">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setGuidePlugin(plugin)}
                          className="flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors"
                        >
                          <BookOpen size={12} />
                          Cómo usar
                        </button>
                        {plugin.enabled && plugin.requiresConfig && isSuperAdmin && (
                          <button
                            onClick={() => setConfigPlugin(plugin)}
                            className="flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
                          >
                            <Settings size={12} />
                            Configurar
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {plugin.enabled && effect?.action && (
                          <Link
                            href={effect.action.href}
                            className="flex items-center gap-1 text-xs text-[var(--color-primary)] hover:underline"
                          >
                            {effect.action.label}
                            <ArrowRight size={11} />
                          </Link>
                        )}
                        <Badge variant={plugin.enabled ? 'success' : 'neutral'} size="sm" dot>
                          {plugin.enabled ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              )
            })}
      </div>

      {/* Config modal */}
      <Modal
        open={!!configPlugin}
        onClose={() => setConfigPlugin(null)}
        title={`Configurar: ${configPlugin?.name}`}
        size="sm"
      >
        {configPlugin && (
          <ConfigModal
            plugin={configPlugin}
            onClose={() => setConfigPlugin(null)}
            onSaved={() => qc.invalidateQueries({ queryKey: ['plugins'] })}
          />
        )}
      </Modal>

      {/* Guide modal */}
      <Modal
        open={!!guidePlugin}
        onClose={() => setGuidePlugin(null)}
        title={`¿Cómo usar: ${guidePlugin?.name}?`}
        size="md"
      >
        {guidePlugin && (
          <GuideModal plugin={guidePlugin} onClose={() => setGuidePlugin(null)} />
        )}
      </Modal>
    </div>
  )
}
