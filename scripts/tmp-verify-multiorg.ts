// Verifica los 5 casos de la resolución de organización activa (Fase 0.6)
// SIN pasar por HTTP/cookies de navegador — reimplementa la misma lógica que
// getCurrentUser() en src/lib/auth.ts sobre datos reales, para poder probar
// el caso "cookie manipulada a mano" sin un navegador real. Es de sólo
// lectura — no crea, actualiza ni borra nada.
import { prisma } from '../src/lib/db'

const db = prisma as any

async function resolve(userId: string, homeOrgId: string, homeRole: string, cookieOrgId: string | null) {
  if (!cookieOrgId || cookieOrgId === homeOrgId) return { orgId: homeOrgId, role: homeRole, via: 'home' }
  const membership = await db.organizationMembership.findUnique({
    where: { userId_organizationId: { userId, organizationId: cookieOrgId } },
    select: { role: true, organization: { select: { suspended: true } } },
  })
  if (!membership || membership.organization.suspended) return { orgId: homeOrgId, role: homeRole, via: 'home (fallback)' }
  return { orgId: cookieOrgId, role: membership.role, via: 'membership' }
}

async function main() {
  // Usamos a Juan (usuario real, home = Abba) como caso de prueba.
  const juan = await db.user.findFirst({ where: { email: 'juancruzrossi1@gmail.com' } })
  if (!juan) { console.log('No está Juan todavía en la DB, no se puede probar con datos reales.'); return }

  const otherOrg = await db.organization.findFirst({ where: { id: { not: juan.organizationId } } })
  const suspendedTestOrg = await db.organization.findFirst({ where: { suspended: true } })

  console.log('Juan → home org:', juan.organizationId)
  console.log()

  console.log('1) Sin cookie:')
  console.log('  ', await resolve(juan.id, juan.organizationId, juan.role, null))

  console.log('2) Cookie = org de origen (no-op):')
  console.log('  ', await resolve(juan.id, juan.organizationId, juan.role, juan.organizationId))

  console.log('3) Cookie = otra org SIN membership (forzada a mano):')
  if (otherOrg) console.log('  ', await resolve(juan.id, juan.organizationId, juan.role, otherOrg.id))
  else console.log('   (no hay otra organización en la DB para probar este caso)')

  console.log('4) Cookie = organización suspendida (con o sin membership):')
  if (suspendedTestOrg) console.log('  ', await resolve(juan.id, juan.organizationId, juan.role, suspendedTestOrg.id))
  else console.log('   (no hay ninguna organización suspendida ahora mismo para probar este caso)')

  const memberships = await db.organizationMembership.findMany({ where: { userId: juan.id } })
  if (memberships.length > 0) {
    console.log('5) Cookie = membership real y válida:')
    console.log('  ', await resolve(juan.id, juan.organizationId, juan.role, memberships[0].organizationId))
  } else {
    console.log('5) Juan todavía no tiene ninguna OrganizationMembership — se prueba después de 0.7.')
  }
}
main().finally(() => prisma.$disconnect())
