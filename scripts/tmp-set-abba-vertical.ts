// Asignación retroactiva de vertical para Abba Seguridad (ver Fase 0.4 del
// plan) — no cambia nada de lo que Abba ya ve hoy (ningún plugin/nav item
// existente restringe `verticals` todavía), sólo deja el campo consistente
// para cuando empiecen a existir módulos exclusivos de otro rubro.
import { prisma } from '../src/lib/db'

const ABBA_ORG_ID = '4e5924f4-850b-407e-9853-6e22d5eaf54c'

async function main() {
  const before = await (prisma as any).organization.findUnique({
    where: { id: ABBA_ORG_ID },
    select: { name: true, vertical: true },
  })
  console.log('antes:', before)
  if (before?.vertical) {
    console.log('ya tiene vertical seteado, no se toca')
    return
  }
  const after = await (prisma as any).organization.update({
    where: { id: ABBA_ORG_ID },
    data: { vertical: 'seguridad' },
    select: { name: true, vertical: true },
  })
  console.log('después:', after)
}
main().finally(() => prisma.$disconnect())
