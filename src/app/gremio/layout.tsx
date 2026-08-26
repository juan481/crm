export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { getCurrentUserFull } from '@/lib/auth'
import { GremioShell } from '@/components/gremio/gremio-shell'

// /gremio/* — segmento de ruta real (NO route group), separado del árbol
// (dashboard)/ a propósito: portal mobile-first completamente distinto para
// el rol GREMIO (Módulo 3), sin Sidebar/AppHeader/MobileQuickBar del CRM
// interno. Mismo precedente arquitectónico que /soporte/[token] (página
// pública fuera del dashboard, su propio layout full-page con tokens
// var(--color-*)), pero autenticado por sesión real de Supabase en vez de
// un token de URL — por eso usa getCurrentUserFull() igual que
// (dashboard)/layout.tsx, no un token.
export default async function GremioLayout({ children }: { children: React.ReactNode }) {
  const session = await getCurrentUserFull()
  if (!session) redirect('/login')

  const { payload, user, org } = session!

  // Guard simétrico al de (dashboard)/layout.tsx (que redirige GREMIO acá) —
  // evita que un SELLER/ADMIN navegue manualmente a /gremio.
  if (payload.role !== 'GREMIO') redirect('/dashboard')

  // Mismo chequeo de seguridad que (dashboard)/layout.tsx, replicado acá
  // porque el guard de arriba en ESE layout redirige a GREMIO antes de
  // llegar a esa validación — una cuenta Gremio recién creada por un ADMIN
  // (contraseña temporal) debe cambiarla antes de operar el portal.
  if (user.forcePasswordChange) redirect('/cambiar-contrasena')

  return (
    <GremioShell
      userName={user.name}
      branding={{
        crmName:        org.crmName,
        logoUrl:        org.logoUrl,
        primaryColor:   org.primaryColor,
        secondaryColor: org.secondaryColor,
      }}
    >
      {children}
    </GremioShell>
  )
}
