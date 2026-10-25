import { prisma } from '../src/lib/db'

// 2026-10-25 — las alertas de costo de origen SYNC sin nota ya estaban
// aplicadas en el producto por el propio sync (ver catalogo-sync.ts); quedaban
// PENDIENTE por error (2174 en Abba). Se pasan a APLICADA (historial), sin
// tocar ningún producto. Las que tienen nota (salto absurdo, NO aplicado)
// quedan pendientes. Uso: npx tsx scripts/tmp-alertas-costo-sync-aplicadas.ts [--apply]
async function main() {
  const apply = process.argv.includes('--apply')
  const where = { origen: 'SYNC', estado: 'PENDIENTE', nota: null }
  const db = prisma as any
  const n = await db.alertaCosto.count({ where })
  console.log(`${n} alertas SYNC pendientes sin nota`)
  if (!apply) { console.log('dry-run — correr con --apply para marcarlas APLICADA'); return }
  const { count } = await db.alertaCosto.updateMany({ where, data: { estado: 'APLICADA', revisadoEn: new Date() } })
  console.log(`${count} marcadas APLICADA`)
  console.log('pendientes que quedan:', await db.alertaCosto.count({ where: { estado: 'PENDIENTE' } }))
}
main().finally(() => prisma.$disconnect())
