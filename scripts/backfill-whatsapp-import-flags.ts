// Backfill one-off: import-abba-whatsapp-history.ts no seteaba
// importedAt/lastReadAt (esos campos no existían todavía cuando corrió la
// primera vez). Corrige los 398 chats ya importados para que:
//   1. Las estadísticas de período dejen de contarlos como actividad real
//      de NISSI (importedAt null = requisito de conversaciones/stats/route.ts).
//   2. Dejen de aparecer como "no leídos" para siempre en el badge del
//      sidebar (lastReadAt seguía null → siempre atrasado respecto a
//      lastInboundAt).
//
// Identificación segura: TODAS las conversaciones importadas tienen el
// mensaje-divisor '── Historial importado' (role='system'), y en la corrida
// real "Conversaciones mergeadas" fue 0 — así que no hay riesgo de marcar
// una conversación real que ya tenía actividad de NISSI antes del import.
//
// Uso:
//   npx tsx scripts/backfill-whatsapp-import-flags.ts          # DRY RUN
//   npx tsx scripts/backfill-whatsapp-import-flags.ts --apply
import { prisma } from '../src/lib/db'

const DIVIDER_PREFIX = '── Historial importado'

async function main() {
  const apply = process.argv.includes('--apply')
  const db = prisma as any

  const conversationIds: { id: string }[] = await db.$queryRaw`
    SELECT DISTINCT c.id FROM "WhatsAppConversation" c
    JOIN "WhatsAppMessage" m ON m."conversationId" = c.id
    WHERE m.role = 'system' AND m.content LIKE ${DIVIDER_PREFIX + '%'}
      AND c."importedAt" IS NULL
  `
  const ids = conversationIds.map((r) => r.id)
  console.log(`Conversaciones importadas sin backfillear: ${ids.length}`)
  if (ids.length === 0) { console.log('Nada para hacer.'); return }

  if (!apply) {
    console.log('\n[DRY RUN] Nada se escribió. Corré con --apply para confirmar.')
    return
  }

  const now = new Date()
  // lastReadAt = lastMessageAt (columna a columna, sin pisar nada de una
  // conversación que después de importada ya tuvo actividad real).
  const convResult = await prisma.$executeRaw`
    UPDATE "WhatsAppConversation"
    SET "importedAt" = ${now}, "lastReadAt" = "lastMessageAt"
    WHERE id = ANY(${ids}) AND "importedAt" IS NULL
  `
  const msgResult = await db.whatsAppMessage.updateMany({
    where: { conversationId: { in: ids }, importedAt: null },
    data: { importedAt: now },
  })
  console.log(`Conversaciones corregidas: ${convResult}`)
  console.log(`Mensajes corregidos: ${msgResult.count}`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
