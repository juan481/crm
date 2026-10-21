export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { getCurrentUserFull } from '@/lib/auth'
import { SoporteExternoShell } from '@/components/soporte-externo/soporte-externo-shell'

// /soporte-externo/* — segmento de ruta real (NO route group), separado del
// árbol (dashboard)/ a propósito, mismo criterio arquitectónico que
// /gremio/* (ver comentario en src/app/gremio/layout.tsx): portal chico y
// autenticado por sesión real de Supabase (getCurrentUserFull(), no un
// token) para un externo que gestiona tickets de soporte sin ver nada más
// del CRM interno.
export default async function SoporteExternoLayout({ children }: { children: React.ReactNode }) {
  const session = await getCurrentUserFull()
  if (!session) redirect('/login')

  const { payload, user, org } = session!

  // Guard simétrico al de (dashboard)/layout.tsx (que redirige SUPPORT_EXTERNAL
  // acá) — evita que un SELLER/ADMIN navegue manualmente a /soporte-externo.
  if (payload.role !== 'SUPPORT_EXTERNAL') redirect('/dashboard')

  if (user.forcePasswordChange) redirect('/cambiar-contrasena')

  return (
    <SoporteExternoShell
      userName={user.name}
      branding={{
        crmName:        org.crmName,
        logoUrl:        org.logoUrl,
        primaryColor:   org.primaryColor,
        secondaryColor: org.secondaryColor,
      }}
    >
      {children}
    </SoporteExternoShell>
  )
}
