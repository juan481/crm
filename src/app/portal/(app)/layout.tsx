export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { getCurrentUserFull } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { PortalShell } from '@/components/portal/portal-shell'

// /portal/* — Portal de Clientes (Pagos & Portal). Segmento de ruta real (NO
// route group), separado del árbol (dashboard)/ y de gremio/. Mismo
// precedente que gremio/layout.tsx: autenticado por sesión real de Supabase
// (magic link), guard explícito de rol, shell propio sin nada del CRM interno.
//
// La pantalla de ingreso (/portal/login) y el callback de auth NO pasan por
// acá — son públicos en middleware. Todo lo demás bajo /portal exige sesión
// CLIENTE con una Empresa asignada.
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await getCurrentUserFull()
  if (!session) redirect('/portal/login')

  const { payload, user } = session

  // Guard simétrico al de (dashboard)/layout.tsx (que redirige CLIENTE acá).
  if (payload.role !== 'CLIENTE') redirect('/dashboard')

  // Un CLIENTE sin empresaId es un estado roto — no se le sirve el portal.
  if (!user.empresaId) redirect('/portal/login')

  const empresa = await prisma.empresa.findFirst({
    where: { id: user.empresaId, organizationId: payload.orgId },
    select: { name: true },
  })
  if (!empresa) redirect('/portal/login')

  const org = session.org

  return (
    <PortalShell
      userName={user.name}
      empresaName={empresa.name}
      branding={{
        crmName: org.crmName,
        logoUrl: org.logoUrl,
        primaryColor: org.primaryColor,
        secondaryColor: org.secondaryColor,
      }}
    >
      {children}
    </PortalShell>
  )
}
