// Backfill one-off: alta obligatoria de Contacto para WhatsAppConversation
// que quedaron sin contactoId ANTES del cambio del 2026-09-23 (ver
// resolveContactoForConversation en src/lib/whatsapp-bot/contacto.ts — ahora
// siempre crea, antes devolvía null si no había nombre real todavía).
//
// Excluye conversaciones de historial importado (importedAt != null) — esas
// ya pasaron por su propio alta en import-abba-leads.ts.
//
// Uso:
//   npx tsx scripts/backfill-contacto-alta.ts          # DRY RUN
//   npx tsx scripts/backfill-contacto-alta.ts --apply
import { prisma } from '../src/lib/db'
import { resolveContactoForConversation } from '../src/lib/whatsapp-bot/contacto'

async function main() {
  const apply = process.argv.includes('--apply')
  const db = prisma as any

  const conversaciones = await db.whatsAppConversation.findMany({
    where: { contactoId: null, importedAt: null },
    select: { id: true, organizationId: true, customerPhone: true, customerName: true },
  })
  console.log(`Conversaciones reales sin contacto: ${conversaciones.length}`)
  if (conversaciones.length === 0) { console.log('Nada para hacer.'); return }

  if (!apply) {
    console.log('\n[DRY RUN] Ejemplo de las primeras 10:')
    for (const c of conversaciones.slice(0, 10)) {
      console.log(`  - ${c.customerPhone} (${c.customerName ?? 'sin nombre de WhatsApp'}) — org ${c.organizationId}`)
    }
    console.log('\nCorré con --apply para crear/vincular los contactos de verdad.')
    return
  }

  let creados = 0
  let fallidos = 0
  for (const c of conversaciones) {
    const contactoId = await resolveContactoForConversation(c.organizationId, {
      conversationId: c.id, customerPhone: c.customerPhone,
    })
    if (contactoId) {
      await db.whatsAppConversation.update({ where: { id: c.id }, data: { contactoId } })
      creados++
    } else {
      fallidos++
      console.warn(`  ! no se pudo resolver contacto para ${c.customerPhone} (conv ${c.id})`)
    }
  }
  console.log(`Listo. Vinculadas/creadas: ${creados}. Fallidas: ${fallidos}.`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
