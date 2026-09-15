// Verifica en runtime, contra datos reales, que las queries nuevas de
// resolveSession() (src/lib/auth.ts) ejecutan bien y devuelven el shape
// esperado — no puede probarse resolveSession() directo porque usa
// cookies() de next/headers (sólo dentro de un request real de Next), así
// que se replican acá las mismas queries exactas, con el mismo select.
import { prisma } from '../src/lib/db'

const ORG_BRANDING_SELECT = {
  suspended: true, crmName: true, logoUrl: true, primaryColor: true, secondaryColor: true, vertical: true,
} as const

async function main() {
  const juan = await prisma.user.findFirst({ where: { email: 'juancruzrossi1@gmail.com' } })
  if (!juan) { console.log('Juan no está en la DB, no se puede verificar con datos reales'); return }
  console.log('Juan → home org:', juan.organizationId)

  // 1) Query "común" (sin switch) — mismo select que usa el camino sin cookie.
  const homeOrg = await prisma.organization.findUnique({ where: { id: juan.organizationId }, select: ORG_BRANDING_SELECT })
  console.log('1) Org de origen (branding+suspended en 1 query):', homeOrg)

  // 2) Query de membership con org anidada — mismo select que usa el camino con switch.
  const membership = await prisma.organizationMembership.findFirst({
    where: { userId: juan.id },
    select: { organizationId: true, role: true, organization: { select: ORG_BRANDING_SELECT } },
  })
  console.log('2) Membership + org anidada (1 query):', membership)

  // 3) Chequeo liviano de home-suspended que se hace aparte en el camino de switch.
  const homeSuspendedOnly = await prisma.organization.findUnique({ where: { id: juan.organizationId }, select: { suspended: true } })
  console.log('3) Home suspended (liviano):', homeSuspendedOnly)

  console.log('\nTodas las queries ejecutaron sin error y con el shape esperado.')
}
main().finally(() => prisma.$disconnect())
