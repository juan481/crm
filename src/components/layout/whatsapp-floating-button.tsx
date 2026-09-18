'use client'

// Acceso rápido a NISSI (WhatsApp) — flotante, visible en cualquier
// pantalla del CRM, sólo para quien realmente puede ver esa bandeja: mismo
// criterio que el ítem "WhatsApp" del sidebar (roles + plugin activo), NO
// se importa canAccess() de @/lib/auth acá a propósito — ese archivo tira
// de next/headers (server-only) y rompería el bundle de un client
// component; se replica la jerarquía mínima que hace falta (SELLER+) con
// una lista estática, igual que ya hace sidebar.tsx con sus `roles: [...]`.
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { MessageCircle } from 'lucide-react'
import { usePlugin } from '@/hooks/use-plugin'
import type { Role } from '@/types'

const ALLOWED_ROLES: Role[] = ['SUPER_ADMIN', 'ADMIN', 'SELLER']

export function WhatsAppFloatingButton({ role }: { role: Role }) {
  const pathname = usePathname()
  const { enabled } = usePlugin('whatsapp-ai-bot')

  if (!ALLOWED_ROLES.includes(role)) return null
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
