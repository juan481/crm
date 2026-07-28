// Grants (or revokes) access to /admin, the cross-tenant platform panel.
// Deliberately not exposed in any in-app UI — only the agency should ever be
// able to set this, and only via direct DB access like this script.
//
// Usage: npx tsx scripts/set-platform-admin.ts <email> <true|false>
import { prisma } from '../src/lib/db'

async function main() {
  const [, , email, flagArg] = process.argv
  if (!email || !flagArg) {
    console.error('Uso: npx tsx scripts/set-platform-admin.ts <email> <true|false>')
    process.exit(1)
  }
  if (flagArg !== 'true' && flagArg !== 'false') {
    console.error('El segundo argumento debe ser "true" o "false"')
    process.exit(1)
  }
  const newValue = flagArg === 'true'

  const db = prisma as any
  const user = await db.user.findUnique({
    where:  { email },
    select: { id: true, name: true, email: true, isPlatformAdmin: true },
  })

  if (!user) {
    console.error(`No se encontró ningún usuario con email "${email}"`)
    process.exit(1)
  }

  console.log(`Usuario: ${user.name} (${user.email})`)
  console.log(`isPlatformAdmin actual: ${user.isPlatformAdmin}`)

  const updated = await db.user.update({
    where:  { id: user.id },
    data:   { isPlatformAdmin: newValue },
    select: { isPlatformAdmin: true },
  })

  console.log(`Nuevo isPlatformAdmin: ${updated.isPlatformAdmin}`)
}

main().finally(() => prisma.$disconnect())
