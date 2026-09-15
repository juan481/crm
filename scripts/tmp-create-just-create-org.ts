// Fase 0.7 del plan — alta real de "Just Create" (con espacio, corregido).
// Mismo camino que el modo `existingUserEmail` de POST /api/admin/organizations
// (0.6): no crea una cuenta Supabase Auth nueva, no toca la fila User de
// Juan ni su acceso a Abba — sólo crea la Organization y una
// OrganizationMembership. `vertical` queda en null a propósito: Juan la
// elige la primera vez que entra a esta organización desde el switcher,
// probando el wizard real de punta a punta.
import { prisma } from '../src/lib/db'

const ADMIN_EMAIL = 'juancruzrossi1@gmail.com'
const ORG_NAME = 'Just Create'
const DOMAIN = 'justcreate.com.ar'

async function main() {
  const db = prisma as any

  const existingOrg = await db.organization.findFirst({ where: { name: ORG_NAME } })
  if (existingOrg) {
    console.log('Ya existe una organización "Just Create", no creo otra:', existingOrg)
    return
  }

  const user = await db.user.findFirst({ where: { email: ADMIN_EMAIL, status: 'ACTIVE' } })
  if (!user) {
    console.log('No hay un usuario activo con ese email, no puedo continuar')
    return
  }

  const org = await db.organization.create({
    data: { name: ORG_NAME, domain: DOMAIN },
    select: { id: true, name: true, domain: true },
  })
  console.log('Organización creada:', org)

  const membership = await db.organizationMembership.create({
    data: { userId: user.id, organizationId: org.id, role: 'SUPER_ADMIN' },
    select: { id: true, userId: true, organizationId: true, role: true },
  })
  console.log('Membership creada:', membership)
  console.log(`\n${user.email} ya puede elegir "${org.name}" desde el switcher del sidebar (aparece porque ahora tiene 2 organizaciones).`)
}
main().finally(() => prisma.$disconnect())
