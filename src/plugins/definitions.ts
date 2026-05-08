import type { PluginDefinition } from '@/types'

export const PLUGIN_DEFINITIONS: PluginDefinition[] = [
  {
    id: 'email-campaigns',
    name: 'Campañas de Email',
    description: 'Envía emails individuales y masivos directamente desde el CRM. Includes plantillas, seguimiento de apertura y reportes.',
    icon: 'Mail',
    category: 'communication',
    version: '1.0.0',
    author: 'CRM Core',
    requiresConfig: true,
    configSchema: {
      smtpHost: { type: 'string', label: 'SMTP Host', required: true },
      smtpPort: { type: 'number', label: 'SMTP Port', required: true },
    },
  },
  {
    id: 'export-data',
    name: 'Exportación de Datos',
    description: 'Exporta clientes, facturas y reportes en formatos XLS y CSV con un solo click desde cualquier listado.',
    icon: 'Download',
    category: 'productivity',
    version: '1.0.0',
    author: 'CRM Core',
    requiresConfig: false,
  },
  {
    id: 'global-search',
    name: 'Búsqueda Global',
    description: 'Buscador predictivo que encuentra clientes, facturas y notas en tiempo real desde cualquier pantalla.',
    icon: 'Search',
    category: 'productivity',
    version: '1.0.0',
    author: 'CRM Core',
    requiresConfig: false,
  },
  {
    id: 'advanced-analytics',
    name: 'Analíticas Avanzadas',
    description: 'Reportes detallados de MRR, churn, LTV, y cohortes de clientes con gráficos interactivos.',
    icon: 'BarChart3',
    category: 'analytics',
    version: '1.0.0',
    author: 'CRM Core',
    requiresConfig: false,
  },
  {
    id: 'whatsapp-integration',
    name: 'WhatsApp Business',
    description: 'Envía mensajes de WhatsApp directamente desde la ficha del cliente vía WhatsApp Business API.',
    icon: 'MessageCircle',
    category: 'communication',
    version: '1.0.0',
    author: 'CRM Core',
    requiresConfig: true,
    configSchema: {
      apiToken: { type: 'string', label: 'WhatsApp API Token', required: true },
      phoneNumberId: { type: 'string', label: 'Phone Number ID', required: true },
    },
  },
  {
    id: 'invoice-automation',
    name: 'Facturación Automática',
    description: 'Genera y envía facturas automáticamente en función de los contratos recurrentes de los clientes.',
    icon: 'FileText',
    category: 'productivity',
    version: '1.0.0',
    author: 'CRM Core',
    requiresConfig: false,
  },
  {
    id: 'zapier-webhooks',
    name: 'Zapier / Webhooks',
    description: 'Conecta el CRM con más de 5000 aplicaciones vía Zapier o webhooks personalizados.',
    icon: 'Zap',
    category: 'integration',
    version: '1.0.0',
    author: 'CRM Core',
    requiresConfig: true,
    configSchema: {
      webhookUrl: { type: 'string', label: 'Webhook URL', required: false },
    },
  },
  {
    id: 'google-calendar',
    name: 'Google Calendar',
    description: 'Sincroniza reuniones y tareas del CRM con Google Calendar automáticamente.',
    icon: 'Calendar',
    category: 'integration',
    version: '1.0.0',
    author: 'CRM Core',
    requiresConfig: true,
    configSchema: {
      clientId: { type: 'string', label: 'Google Client ID', required: true },
    },
  },
]

export function getPlugin(id: string): PluginDefinition | undefined {
  return PLUGIN_DEFINITIONS.find((p) => p.id === id)
}
