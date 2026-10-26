// 2026-10-25 — pasa a Documentos → CVs los CVs que ya llegaron por WhatsApp
// en tickets de RRHH creados antes de que esto fuera automático (pedido de
// Abba). Idempotente (no duplica). Correr desde la carpeta crm/:
//   npx tsx scripts/tmp-backfill-cvs-documentos.ts           → sólo cuenta
//   npx tsx scripts/tmp-backfill-cvs-documentos.ts --apply   → copia y crea los documentos
//
// El .env se carga ANTES de importar nada: cvs-documentos.ts lee el bucket
// de Storage al cargarse y el cliente admin de Supabase necesita la service
// role key — sin esto dependía de que Prisma justo cargara el .env antes.
;(process as any).loadEnvFile?.('.env')

async function main() {
  const { prisma } = await import('../src/lib/db')
  const { guardarCvsDeConversacion } = await import('../src/lib/cvs-documentos')
  try {
    const apply = process.argv.includes('--apply')
    const db = prisma as any
    const tickets = await db.ticket.findMany({
      where: { category: 'RRHH' },
      select: { id: true, number: true, organizationId: true, title: true, description: true, recipientName: true, createdById: true },
      orderBy: { number: 'asc' },
    })
    let total = 0
    for (const t of tickets) {
      // La conversación puede haber perdido el ticketId (se limpia al reabrir)
      // → fallback por el teléfono que NISSI deja en la descripción.
      const phone = /desde el número (\d{8,15})/.exec(t.description ?? '')?.[1]
      const conv = await db.whatsAppConversation.findFirst({
        where: { organizationId: t.organizationId, OR: [{ ticketId: t.id }, ...(phone ? [{ customerPhone: phone }] : [])] },
        select: { id: true, customerName: true },
      })
      if (!conv) continue
      const adjuntos = await db.whatsAppMessage.count({
        where: { conversationId: conv.id, role: 'user', mediaUrl: { not: null }, mediaType: { in: ['document', 'image'] } },
      })
      if (adjuntos === 0) continue
      console.log(`#${t.number} ${t.title} — ${adjuntos} adjunto(s)`)
      total += adjuntos
      if (apply) {
        const n = await guardarCvsDeConversacion(db, {
          orgId: t.organizationId, conversationId: conv.id, uploadedById: t.createdById,
          personName: t.recipientName || conv.customerName || null,
        })
        console.log(`   → ${n} documento(s) nuevo(s) en CVs`)
      }
    }
    console.log(`${tickets.length} tickets de RRHH, ${total} adjuntos${apply ? '' : ' (dry-run, correr con --apply)'}`)
  } finally {
    await prisma.$disconnect()
  }
}
main().catch((err) => { console.error(err); process.exit(1) })
