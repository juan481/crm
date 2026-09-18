'use client'

// Acceso rápido a NISSI (WhatsApp) — flotante, visible en cualquier
// pantalla del CRM, sólo para quien realmente puede ver esa bandeja.
// useModuleAccess ya resuelve TODO el criterio real (SUPER_ADMIN siempre,
// el resto según lo que el panel de Permisos tenga guardado para su rol,
// con fallback al default del módulo si no hay fila) — no hace falta
// replicar la jerarquía de roles ni el chequeo de plugin acá a mano.
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { MessageCircle } from 'lucide-react'
import { usePlugin } from '@/hooks/use-plugin'
import { useModuleAccess } from '@/hooks/use-module-access'

export function WhatsAppFloatingButton() {
  const pathname = usePathname()
  const { enabled } = usePlugin('whatsapp-ai-bot')
  const hasAccess = useModuleAccess('conversaciones')

  if (hasAccess !== true) return null // false o "todavía no resolvió" → no mostrar
  if (!enabled) return null
  if (pathname.startsWith('/conversaciones')) return null // ya estás ahí

  return (
    <Link
      href="/conversaciones"
      title="Ir a WhatsApp (NISSI)"
      className="hidden lg:flex fixed bottom-6 right-6 z-30 w-12 h-12 rounded-full items-center justify-center shadow-lg transition-transform hover:scale-105"
      style={{ background: '#25D366', color: '#fff' }}
    >
      <MessageCircle size={22} strokeWidth={2.25} />
    </Link>
  )
}
