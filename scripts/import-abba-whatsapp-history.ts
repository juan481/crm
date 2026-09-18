// Importador one-off del historial viejo de WhatsApp Business de Abba
// Seguridad — 513 chats exportados a JSON (uno por conversación) antes de
// migrar a NISSI. Carga cada chat como WhatsAppConversation + WhatsAppMessage
// (mismo modelo que usa NISSI), CLOSED, con un mensaje-divisor 'system' al
// final que marca "acá termina el historial importado, de acá en más habló
// NISSI". Sólo texto — los adjuntos quedan como referencia ("[envió una
// imagen]"), no se suben archivos.
//
// Se excluyen a propósito:
//   - El grupo interno "ABBA IT" (@g.us) — no es historial de un cliente.
//   - Archivos vacíos ([]).
//   - Chats donde nunca se pudo recuperar el teléfono real del cliente (el
//     export sólo trae el nombre guardado y mensajes salientes — WhatsApp no
//     vuelve a exponer el número si el cliente nunca contestó). Estos NO se
//     inventan ni se fuerza un match por nombre — quedan listados en un
//     reporte aparte para revisión manual (ver Chats viejos → Contactos
//     asignables manualmente en el inbox).
//
// Idempotente por archivo: si la conversación ya tiene el mensaje-divisor
// ('── Historial importado'), se saltea. Si el cliente YA le escribió a
// NISSI (existe WhatsAppConversation con ese teléfono), el historial se
// mergea ANTES de sus mensajes reales — no se pisa nada de lo que ya pasó
// con NISSI (status, contactoId si ya estaba, lastInboundAt, etc.).
//
// Uso:
//   npx tsx scripts/import-abba-whatsapp-history.ts                 # DRY RUN
//   npx tsx scripts/import-abba-whatsapp-history.ts --apply
//   npx tsx scripts/import-abba-whatsapp-history.ts --apply --dir="D:/ruta" --org="Abba Seguridad"
import { readFileSync, readdirSync, writeFileSync } from 'fs'
import path from 'path'
import { prisma } from '../src/lib/db'
import { getPluginConfig } from '../src/lib/plugins'
import { findContactoIdByPhone } from '../src/lib/whatsapp-bot/contacto'

const DEFAULT_DIR = 'D:/JustCreate/Clientes/Claude Proyectos/crm/Chats viejos'
const DEFAULT_ORG = 'Abba Seguridad'
// El historial viejo puede tener huecos de días/semanas entre un mensaje y
// su respuesta (nadie respondió en el momento) — a diferencia del chat en
// vivo, donde WhatsApp ya no deja mandar texto libre pasadas 24hs (ver
// WINDOW_MS en reply/route.ts), así que responseTimeMs ahí nunca supera ese
// techo. Acá si no se capa, un hueco real desborda el Int32 de Postgres
// (ocurrió con un gap de ~25 días). Mismo techo que esa ventana: pasado ese
// punto no es un "tiempo de respuesta" real, es simplemente que se retomó
// la charla otro día — se guarda null en vez de un número engañoso.
const MAX_RESPONSE_MS = 24 * 60 * 60 * 1000
const DIVIDER_PREFIX = '── Historial importado'
const DIVIDER_TEXT = `${DIVIDER_PREFIX} de WhatsApp Business · a partir de acá, NISSI ──`

interface RawMsg {
  'Message Id': string
  'Message Type': string
  'Message Time': string
  'Formatted Name': string
  'Display Name': string
  Message: string
  Caption: string
  Phone: string
  'File Name': string
}

function parseArgs(argv: string[]) {
  const kv = new Map<string, string>()
  for (const a of argv) {
    if (a.startsWith('--') && a.includes('=')) {
      const [k, ...rest] = a.slice(2).split('=')
      kv.set(k, rest.join('='))
    }
  }
  return {
    apply: argv.includes('--apply'),
    dir: kv.get('dir') ?? DEFAULT_DIR,
    orgName: kv.get('org') ?? DEFAULT_ORG,
  }
}

const digitsOnly = (s: string): string => (s || '').replace(/\D/g, '')

const MEDIA_LABEL: Record<string, string> = {
  image: '[envió una imagen]',
  video: '[envió un video]',
  document: '[envió un archivo]',
  ptt: '[envió un audio]',
  audio: '[envió un audio]',
  sticker: '[envió un sticker]',
  vcard: '[envió una tarjeta de contacto]',
  poll_creation: '[creó una encuesta]',
}

function messageContent(m: RawMsg): string {
  if (m['Message Type'] === 'chat') return (m.Message || '').trim() || '(mensaje vacío)'
  // OJO: en este export, "Caption" de un mensaje multimedia NO es un texto
  // de caption — es el archivo entero codificado en base64 (verificado: de
  // 389 mensajes con Caption no vacío en los 513 chats, los 389 son blobs
  // base64, ninguno un texto real). Se ignora a propósito; usar ese campo
  // como si fuera texto es el bug que mostraba la imagen entera en el chat.
  return MEDIA_LABEL[m['Message Type']] ?? '[envió un adjunto]'
}

// Nombre "de fantasía" que WhatsApp usa cuando exporta un chat sin contacto
// resuelto (LID sin número visible) — no sirve como filename-fallback.
function looksLikePlaceholderPhone(label: string): boolean {
  return /\(555\)/.test(label)
}

function classifyFilename(filename: string): { kind: 'group' | 'phone' | 'name'; label: string } {
  const m = filename.match(/^whatsapp_(.+)_(\d+)\.json$/)
  const label = m ? m[1] : filename
  if (label.endsWith('@g.us')) return { kind: 'group', label }
  if (/^\+?[\d\s()+-]{6,}$/.test(label) && !looksLikePlaceholderPhone(label)) return { kind: 'phone', label }
  return { kind: 'name', label }
}

async function main() {
  const { apply, dir, orgName } = parseArgs(process.argv.slice(2))
  const db = prisma as any

  const org = await prisma.organization.findFirst({ where: { name: orgName } })
  if (!org) { console.error(`✗ No existe la organización "${orgName}"`); process.exit(1) }

  const botConfig = await getPluginConfig(org.id, 'whatsapp-ai-bot')
  const phoneNumberId = typeof botConfig?.phoneNumberId === 'string' ? botConfig.phoneNumberId.trim() : ''
  if (!phoneNumberId) {
    console.error(`✗ La org "${orgName}" no tiene phoneNumberId configurado en el plugin whatsapp-ai-bot (Plugins → NISSI). Hace falta para asociar el historial al número real.`)
    process.exit(1)
  }

  console.log(`Organización:   ${org.name} (${org.id})`)
  console.log(`phoneNumberId:  ${phoneNumberId}`)
  console.log(`Carpeta:        ${dir}`)
  console.log(apply ? '\n*** MODO --apply: escribe en la base ***\n' : '\n[DRY RUN] no se escribe nada — usá --apply para confirmar\n')

  const files = readdirSync(dir).filter((f) => f.endsWith('.json'))
  console.log(`Archivos encontrados: ${files.length}\n`)

  let groupSkipped = 0, emptySkipped = 0, alreadyImported = 0
  let created = 0, merged = 0, sinTelefono = 0
  let totalMsgImported = 0
  const sinTelefonoReport: { file: string; label: string; messages: number; lastMessage: string }[] = []

  for (const file of files) {
    const { kind, label } = classifyFilename(file)
    if (kind === 'group') { groupSkipped++; console.log(`  · [grupo, se excluye] ${file}`); continue }

    let raw: RawMsg[]
    try {
      raw = JSON.parse(readFileSync(path.join(dir, file), 'utf8'))
    } catch {
      console.warn(`  ! No se pudo parsear ${file}, se saltea`)
      continue
    }
    if (!Array.isArray(raw) || raw.length === 0) { emptySkipped++; continue }

    // Grupo disfrazado de contacto: el nombre del archivo puede ser un
    // nombre guardado normal ("ABBA IT") aunque el chat sea en realidad un
    // grupo interno — WhatsApp lo delata con "@g.us" en el Message Id de
    // CADA mensaje (a diferencia de un 1:1, que nunca lo tiene). Sin este
    // chequeo, "ABBA IT" (2859 mensajes del equipo) se hubiera importado
    // como si fuera un cliente, con el teléfono de cualquiera de los
    // participantes que haya escrito primero.
    if (raw.some((m) => (m['Message Id'] || '').includes('@g.us'))) {
      groupSkipped++
      console.log(`  · [grupo interno, se excluye] ${file}`)
      continue
    }

    // Ascendente por fecha — el resto del script asume orden cronológico.
    const msgs = [...raw].sort((a, b) => new Date(a['Message Time']).getTime() - new Date(b['Message Time']).getTime())

    // ── Resolver el teléfono real del cliente ──────────────────────────
    let customerPhoneDigits: string | null = null
    if (kind === 'phone') {
      customerPhoneDigits = digitsOnly(label)
    } else {
      const firstInbound = msgs.find((m) => !m['Message Id'].startsWith('true_') && m.Phone)
      if (firstInbound) customerPhoneDigits = digitsOnly(firstInbound.Phone)
    }
    if (!customerPhoneDigits || customerPhoneDigits.length < 8) {
      sinTelefono++
      sinTelefonoReport.push({
        file, label, messages: msgs.length,
        lastMessage: msgs[msgs.length - 1]?.['Message Time'] ?? '',
      })
      continue
    }

    // ── Nombre a mostrar: el "Display Name" de un mensaje entrante (nombre
    //    guardado en el teléfono de Abba) es más confiable que el filename. ─
    const firstInboundWithName = msgs.find((m) => !m['Message Id'].startsWith('true_') && m['Display Name'])
    const customerName = firstInboundWithName?.['Display Name'] || (kind === 'name' ? label : null)

    const existingConv = await db.whatsAppConversation.findUnique({
      where: { organizationId_customerPhone: { organizationId: org.id, customerPhone: customerPhoneDigits } },
    })

    if (existingConv) {
      const already = await db.whatsAppMessage.findFirst({
        where: { conversationId: existingConv.id, role: 'system', content: { startsWith: DIVIDER_PREFIX } },
        select: { id: true },
      })
      if (already) { alreadyImported++; continue }
    }

    // ── Reconstruir mensajes + responseTimeMs/answeredAt (mismo criterio
    //    que persistAndSendOutbound en engine.ts: cuando sale una respuesta,
    //    TODOS los entrantes todavía sin responder quedan contestados en ese
    //    momento — un solo pase ascendente sobre el historial ya ordenado). ─
    type Row = { role: string; content: string; createdAt: Date; responseTimeMs: number | null; answeredAt: Date | null }
    const rows: Row[] = []
    let lastInboundAt: Date | null = null
    let pendingInboundRows: Row[] = []
    for (const m of msgs) {
      const createdAt = new Date(m['Message Time'])
      const content = messageContent(m)
      if (m['Message Id'].startsWith('true_')) {
        const gapMs = lastInboundAt ? createdAt.getTime() - lastInboundAt.getTime() : null
        const responseTimeMs = gapMs != null && gapMs <= MAX_RESPONSE_MS ? gapMs : null
        for (const p of pendingInboundRows) p.answeredAt = createdAt
        pendingInboundRows = []
        rows.push({ role: 'assistant', content, createdAt, responseTimeMs, answeredAt: null })
      } else {
        lastInboundAt = createdAt
        const row: Row = { role: 'user', content, createdAt, responseTimeMs: null, answeredAt: null }
        pendingInboundRows.push(row)
        rows.push(row)
      }
    }
    const lastMsgAt = rows[rows.length - 1].createdAt
    const dividerAt = new Date(lastMsgAt.getTime() + 1000)

    if (!apply) {
      if (existingConv) merged++; else created++
      totalMsgImported += rows.length
      continue
    }

    // Fuera de la transacción a propósito — es sólo una lectura, y no tiene
    // sentido tener la transacción abierta mientras se resuelve el match.
    const match = existingConv ? null : await findContactoIdByPhone(org.id, customerPhoneDigits)

    await prisma.$transaction(async (tx) => {
      const txdb = tx as any
      let conversationId: string

      if (existingConv) {
        conversationId = existingConv.id
        merged++
      } else {
        const conv = await txdb.whatsAppConversation.create({
          data: {
            organizationId: org.id, phoneNumberId, customerPhone: customerPhoneDigits,
            customerName: customerName || null, status: 'CLOSED',
            lastMessageAt: lastMsgAt, lastInboundAt,
            contactoId: match?.contactoId ?? null, empresaId: match?.empresaId ?? null,
            createdAt: rows[0].createdAt,
          },
          select: { id: true },
        })
        conversationId = conv.id
        created++
      }

      await txdb.whatsAppMessage.createMany({
        data: rows.map((r) => ({
          conversationId, organizationId: org.id, role: r.role, content: r.content, createdAt: r.createdAt,
          processedAt: r.role === 'user' ? r.createdAt : null,
          answeredAt: r.answeredAt,
          responseTimeMs: r.responseTimeMs,
        })),
      })
      await txdb.whatsAppMessage.create({
        data: { conversationId, organizationId: org.id, role: 'system', content: DIVIDER_TEXT, createdAt: dividerAt },
      })
    })

    totalMsgImported += rows.length
    console.log(`  ✓ ${(customerName || customerPhoneDigits).padEnd(30)} ${existingConv ? '[merge]' : '[nuevo]'} ${rows.length} mensajes`)
  }

  console.log('\n── Reporte ────────────────────────────────────────────')
  console.log(`Archivos totales:              ${files.length}`)
  console.log(`Grupo interno excluido:        ${groupSkipped}`)
  console.log(`Vacíos:                        ${emptySkipped}`)
  console.log(`Ya importados (skip):          ${alreadyImported}`)
  console.log(`Conversaciones ${apply ? 'creadas' : 'a crear'}:          ${created}`)
  console.log(`Conversaciones ${apply ? 'mergeadas' : 'a mergear'}:        ${merged}`)
  console.log(`Sin teléfono recuperable:      ${sinTelefono}`)
  console.log(`Mensajes ${apply ? 'importados' : 'a importar'}:            ${totalMsgImported}`)

  if (sinTelefonoReport.length) {
    const outPath = path.join(process.cwd(), 'scripts', 'whatsapp-import-sin-telefono.json')
    writeFileSync(outPath, JSON.stringify(sinTelefonoReport, null, 2), 'utf8')
    console.log(`\n${sinTelefonoReport.length} chats sin teléfono recuperable — listado en ${outPath} para revisión manual.`)
  }
  if (!apply) console.log('\n[DRY RUN] Nada se escribió. Corré con --apply para confirmar.')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
