// Fix one-off: import-abba-whatsapp-history.ts usaba el campo "Caption" del
// export como si fuera un texto de caption — en este export ES el archivo
// completo en base64 (ver el comentario en messageContent() de ese script).
// Esto dejó mensajes de tipo "[envió una imagen] <base64 gigante>" en vez de
// sólo "[envió una imagen]". Corta el sufijo base64 de los que ya se
// importaron mal. Idempotente: una vez corregido, el WHERE ya no matchea.
//
// Uso:
//   npx tsx scripts/fix-whatsapp-media-caption-leak.ts          # DRY RUN
//   npx tsx scripts/fix-whatsapp-media-caption-leak.ts --apply
import { prisma } from '../src/lib/db'

const LABEL_PATTERN =
  String.raw`^(\[envió (una imagen|un video|un archivo|un audio|un sticker|una tarjeta de contacto)\]|\[creó una encuesta\]|\[envió un adjunto\]) [A-Za-z0-9+/=]{50,}$`

async function main() {
  const apply = process.argv.includes('--apply')

  const affected = await prisma.$queryRawUnsafe<{ id: string; content: string }[]>(
    `SELECT id, content FROM "WhatsAppMessage" WHERE content ~ $1`,
    LABEL_PATTERN,
  )
  console.log(`Mensajes con el base64 pegado: ${affected.length}`)
  if (affected.length) {
    console.log('Ejemplo:', affected[0].content.slice(0, 60) + '…')
  }

  if (!apply) {
    console.log('\n[DRY RUN] Nada se escribió. Corré con --apply para confirmar.')
    return
  }

  const result = await prisma.$executeRawUnsafe(
    `UPDATE "WhatsAppMessage" SET content = regexp_replace(content, $1, '\\1') WHERE content ~ $1`,
    LABEL_PATTERN,
  )
  console.log(`Corregidos: ${result}`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
