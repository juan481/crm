// Importador one-off de los leads sueltos de WhatsApp de Abba Seguridad.
//
// El cliente exportó todas sus conversaciones de WhatsApp y las hizo
// analizar en un Excel (hoja "CRM_Leads", 67 filas). Este script las carga
// al CRM como: DirectorioContacto (persona) + Deal (Pipeline) + DealNota
// tipo CHAT con la transcripción completa. Sólo crea Empresa cuando el
// NOMBRE del lead es claramente un negocio (Ferretería, Agencia…); el
// consumidor final (vivienda, quinta, campo particular) y los negocios
// cuyo "contacto" es una persona van SIN empresa — ver Deal.contactoId.
//
// Idempotente: cada Deal lleva un tag [abba-chat-import:<ID>] en las notas
// y origen='IMPORT_WHATSAPP_CHATS'. Se puede correr las veces que haga falta.
//
// Uso:
//   npx tsx scripts/import-abba-leads.ts                 # DRY RUN (no escribe)
//   npx tsx scripts/import-abba-leads.ts --apply         # escribe de verdad
//   npx tsx scripts/import-abba-leads.ts --apply --file="D:/ruta/al.xlsx" --org="Abba Seguridad" --owner-email="sebastianpierini11@gmail.com"
import { readFileSync } from 'fs'
import * as XLSX from 'xlsx'
import { prisma } from '../src/lib/db'

const DEFAULT_FILE = 'D:/JustCreate/Clientes/Abba/ABBA_CRM_Chats_Analisis_2026-08-28.xlsx'
const DEFAULT_ORG = 'Abba Seguridad'
const DEFAULT_OWNER_EMAIL = 'sebastianpierini11@gmail.com'
const SHEET = 'CRM_Leads'
const IMPORT_ORIGEN = 'IMPORT_WHATSAPP_CHATS'

// "Etapa funnel" del Excel → DealStage del CRM. La probabilidad y el offset
// de cierre estimado siguen el mismo criterio que el tablero de Pipeline
// (src/app/(dashboard)/pipeline). `closeInDays` es una fecha de cierre
// tentativa (hoy + N días) para que el Forecast tenga algo que proyectar de
// entrada — se marca en las notas como "ajustar", Seba la corrige.
const STAGE_MAP: Record<string, { stage: string; prob: number; closeInDays: number }> = {
  'Sin calificar / Sin respuesta': { stage: 'LEAD', prob: 10, closeInDays: 75 },
  'Oportunidad activa': { stage: 'CONTACTADO', prob: 25, closeInDays: 45 },
  'Propuesta / Evaluación': { stage: 'PROPUESTA', prob: 50, closeInDays: 21 },
  'Negociación': { stage: 'NEGOCIACION', prob: 75, closeInDays: 10 },
  'Cliente / Ganado': { stage: 'GANADO', prob: 100, closeInDays: 0 },
  'Perdido / Postergado': { stage: 'PERDIDO', prob: 0, closeInDays: 0 },
}

// Palabras que delatan que el NOMBRE del lead es un negocio, no una persona
// (ej. "Ferretería Don Joaquín", "Agencia BAIC"). Sólo estos crean Empresa.
const BUSINESS_NAME_RE = /\b(ferreter|agencia|kiosco|almac[eé]n|panader|farmacia|hotel|instituto|colegio|escuela|club|cooperativa|coop\.|s\.?a\.?|s\.?r\.?l\.?|constructora|inmobiliaria|distribuidora|corral[oó]n|taller|consorcio|barrio|country|complejo|comercio|boutique|estudio|clínica|clinica|sanatorio|mutual|municipalidad|ministerio)\b/i

interface LeadRow {
  ID: number
  'Fecha inicio': number | string
  'Fecha fin': number | string
  Nombre: string
  Apellido: string
  'Teléfono': string
  Localidad: string
  Origen: string
  'Origen normalizado': string
  'Tipo cliente': string
  'Categoría servicio': string
  Necesidad: string
  Estado: string
  'Etapa funnel': string
  Responsable: string
  'Sebastián involucrado': string
  Resumen: string
  'Chat completo': string
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
    filePath: kv.get('file') ?? DEFAULT_FILE,
    orgName: kv.get('org') ?? DEFAULT_ORG,
    ownerEmail: kv.get('owner-email') ?? DEFAULT_OWNER_EMAIL,
  }
}

/** Serial de fecha de Excel (base 1899-12-30) → Date. */
function excelSerialToDate(serial: number | string): Date | null {
  const n = typeof serial === 'number' ? serial : Number(serial)
  if (!Number.isFinite(n) || n <= 0) return null
  return new Date(Math.round((n - 25569) * 86400 * 1000))
}

/** Primer monto en pesos plausible (>= $50.000) que aparezca en el texto. */
function extractAmount(...texts: string[]): number | null {
  const joined = texts.filter(Boolean).join('  ')
  const re = /\$\s?([\d]{1,3}(?:[.\s]\d{3})+(?:,\d+)?)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(joined))) {
    const raw = m[1].replace(/[.\s]/g, '').replace(',', '.')
    const val = Number(raw)
    if (Number.isFinite(val) && val >= 50_000 && val <= 50_000_000) return Math.round(val)
  }
  return null
}

const cleanStr = (v: unknown): string => (v ?? '').toString().trim()

function splitName(full: string): { firstName: string; lastName: string } {
  const parts = full.split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { firstName: 'Sin nombre', lastName: '(s/d)' }
  if (parts.length === 1) return { firstName: parts[0], lastName: '(sin apellido)' }
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') }
}

const contactoKey = (fn: string, ln: string, empresaId: string | null) =>
  `${fn.toLowerCase()}|${ln.toLowerCase()}|${empresaId ?? ''}`

async function main() {
  const { apply, filePath, orgName, ownerEmail } = parseArgs(process.argv.slice(2))
  const db = prisma as any

  const org = await prisma.organization.findFirst({ where: { name: orgName } })
  if (!org) { console.error(`✗ No existe la organización "${orgName}"`); process.exit(1) }

  const owner = await prisma.user.findFirst({ where: { organizationId: org.id, email: ownerEmail } })
  if (!owner) { console.error(`✗ No existe el usuario ${ownerEmail} en ${orgName}`); process.exit(1) }

  console.log(`Organización:  ${org.name} (${org.id})`)
  console.log(`Owner deals:   ${owner.name} <${owner.email}>`)
  console.log(`Archivo:       ${filePath}`)
  console.log(apply ? '\n*** MODO --apply: escribe en la base ***\n' : '\n[DRY RUN] no se escribe nada — usá --apply para confirmar\n')

  const wb = XLSX.read(readFileSync(filePath), { type: 'buffer' })
  const rows = XLSX.utils.sheet_to_json<LeadRow>(wb.Sheets[SHEET], { defval: '' })
  console.log(`Hoja "${SHEET}": ${rows.length} filas`)

  // ── Precarga (1 query cada una, en vez de 3×67) ──────────────────────
  const [empresas, contactos, importedDeals] = await Promise.all([
    db.empresa.findMany({ where: { organizationId: org.id }, select: { id: true, name: true } }),
    db.directorioContacto.findMany({
      where: { organizationId: org.id },
      select: { id: true, firstName: true, lastName: true, empresaId: true, phone: true },
    }),
    db.deal.findMany({
      where: { organizationId: org.id, origen: IMPORT_ORIGEN },
      select: { notes: true },
    }),
  ])
  const empresaByLower = new Map<string, string>(empresas.map((e: any) => [e.name.toLowerCase(), e.id]))
  const contactoByKey = new Map<string, { id: string; phone: string | null }>()
  for (const c of contactos) contactoByKey.set(contactoKey(c.firstName, c.lastName, c.empresaId), { id: c.id, phone: c.phone })
  const alreadyImported = new Set<number>()
  for (const d of importedDeals) {
    const m = /\[abba-chat-import:(\d+)\]/.exec(d.notes ?? '')
    if (m) alreadyImported.add(Number(m[1]))
  }
  console.log(`Precarga: ${empresas.length} empresas, ${contactos.length} contactos, ${alreadyImported.size} ya importados\n`)

  let created = 0, skipped = 0, empresasCreadas = 0, empresasMatch = 0, contactosCreados = 0, contactosReusados = 0
  const perStage: Record<string, number> = {}

  for (const row of rows) {
    const id = Number(row.ID)
    const nombre = cleanStr(row.Nombre)
    const apellido = cleanStr(row.Apellido)
    const telefono = cleanStr(row['Teléfono'])
    const localidad = cleanStr(row.Localidad)
    const tipoCliente = cleanStr(row['Tipo cliente'])
    const categoria = cleanStr(row['Categoría servicio']) || 'Consulta'
    const necesidad = cleanStr(row.Necesidad)
    const estado = cleanStr(row.Estado)
    const etapa = cleanStr(row['Etapa funnel'])
    const responsable = cleanStr(row.Responsable)
    const origenNorm = cleanStr(row['Origen normalizado']) || cleanStr(row.Origen) || 'No informado'
    const resumen = cleanStr(row.Resumen)
    const chat = cleanStr(row['Chat completo'])
    const fechaInicio = excelSerialToDate(row['Fecha inicio'])
    const fechaFin = excelSerialToDate(row['Fecha fin'])

    if (alreadyImported.has(id)) { skipped++; console.log(`  · #${id} — ya importado, skip`); continue }

    const importTag = `[abba-chat-import:${id}]`
    const fullName = [nombre, apellido].filter(Boolean).join(' ').trim()
    const displayName = fullName || (telefono ? `Sin nombre (${telefono})` : `Lead #${id}`)
    const { stage, prob, closeInDays } = STAGE_MAP[etapa] ?? { stage: 'LEAD', prob: 10, closeInDays: 75 }
    perStage[stage] = (perStage[stage] ?? 0) + 1
    const amount = extractAmount(resumen, necesidad, chat)
    const expectedCloseDate = stage === 'GANADO' || stage === 'PERDIDO'
      ? null
      : new Date(Date.now() + closeInDays * 86400 * 1000)
    const nameIsBusiness = BUSINESS_NAME_RE.test(fullName)

    // ── Empresa: SÓLO si el nombre del lead es claramente un negocio
    //    ("Ferretería Don Joaquín", "Agencia BAIC"). Para todo lo demás no
    //    se fuerza empresa — el "Tipo cliente" (Peluquería, Comercio…) queda
    //    como etiqueta en companyRaw del contacto y Seba lo promueve a
    //    Empresa a mano si quiere. Nada de matchear por menciones en el
    //    texto: "domo"/"Hikvision"/"Dahua" son tipos y marcas, no clientes. ─
    let empresaId: string | null = null
    let empresaName: string | null = null
    if (nameIsBusiness) {
      empresaName = fullName
      const hit = empresaByLower.get(empresaName.toLowerCase())
      if (hit) { empresaId = hit; empresasMatch++ }
      else {
        empresasCreadas++
        if (apply) {
          const emp = await db.empresa.create({
            data: { organizationId: org.id, name: empresaName, activity: tipoCliente || null, city: localidad || null, ownerId: owner.id },
            select: { id: true },
          })
          empresaId = emp.id
          empresaByLower.set(empresaName.toLowerCase(), emp.id)
        }
      }
    }

    // ── Contacto: persona detrás del lead. Para un lead 100% negocio
    //    (nombre = Ferretería…) no se inventa persona: va Empresa sola. ────
    let contactoId: string | null = null
    if (!nameIsBusiness) {
      const { firstName, lastName } = fullName
        ? splitName(fullName)
        : { firstName: 'Sin nombre', lastName: telefono ? `(${telefono})` : `#${id}` }
      const key = contactoKey(firstName, lastName, empresaId)
      const dupe = contactoByKey.get(key)
      if (dupe) {
        contactoId = dupe.id
        contactosReusados++
        if (apply && !dupe.phone && telefono) await db.directorioContacto.update({ where: { id: dupe.id }, data: { phone: telefono } })
      } else {
        contactosCreados++
        const companyRaw = empresaName
          ?? (tipoCliente ? `${tipoCliente}${localidad ? ` — ${localidad}` : ''}` : (localidad || null))
        if (apply) {
          const c = await db.directorioContacto.create({
            data: { organizationId: org.id, firstName, lastName, phone: telefono || null, companyRaw, empresaId: empresaId ?? undefined },
            select: { id: true },
          })
          contactoId = c.id
          contactoByKey.set(key, { id: c.id, phone: telefono || null })
        }
      }
    }

    // ── Deal ─────────────────────────────────────────────────────────────
    const notes = [
      importTag,
      `Origen: ${origenNorm}`,
      `Localidad: ${localidad || 'no informada'}`,
      `Tipo de cliente: ${tipoCliente || 'no informado'}`,
      `Categoría: ${categoria}`,
      necesidad && `Necesidad: ${necesidad}`,
      `Estado al importar: ${estado || '—'}`,
      responsable && `Responsable original: ${responsable}`,
      amount && `Monto estimado del chat (confirmar): $${amount.toLocaleString('es-AR')}`,
      expectedCloseDate && `Fecha de cierre estimada automática por etapa (ajustar): ${expectedCloseDate.toLocaleDateString('es-AR')}`,
      resumen && `\nResumen:\n${resumen}`,
    ].filter(Boolean).join('\n')

    if (apply) {
      const deal = await db.deal.create({
        data: {
          organizationId: org.id,
          title: `${categoria} — ${displayName}`,
          amount: amount ?? 0,
          currency: 'ARS',
          probability: prob,
          stage,
          notes,
          origen: IMPORT_ORIGEN,
          ownerId: owner.id,
          empresaId: empresaId ?? undefined,
          contactoId: contactoId ?? undefined,
          expectedCloseDate: expectedCloseDate ?? undefined,
          ...(fechaInicio ? { createdAt: fechaInicio } : {}),
          ...(stage === 'GANADO' || stage === 'PERDIDO' ? { closedAt: fechaFin ?? new Date() } : {}),
        },
        select: { id: true },
      })
      // updatedAt es @updatedAt → no se puede setear vía Prisma; se ajusta
      // por SQL para que el "días sin actividad" del Pipeline sea real
      // (estos leads vienen fríos — esa es justo la señal para Seba).
      if (fechaFin) await prisma.$executeRaw`UPDATE "Deal" SET "updatedAt" = ${fechaFin} WHERE id = ${deal.id}`
      if (chat) {
        await db.dealNota.create({
          data: {
            dealId: deal.id, organizationId: org.id, userId: owner.id, tipo: 'CHAT',
            content: chat.length > 20000 ? chat.slice(0, 20000) + '\n…(truncado)' : chat,
          },
        })
      }
    }

    created++
    console.log(
      `  ✓ #${String(id).padStart(2)} ${displayName.padEnd(34)} → ${stage.padEnd(11)}` +
      `${empresaName ? ` [${empresaId ? 'Empresa' : 'Empresa NUEVA'}: ${empresaName}]` : ' [sin empresa]'}` +
      `${amount ? `  $${amount.toLocaleString('es-AR')}` : ''}`,
    )
  }

  console.log('\n── Reporte ────────────────────────────────────────────')
  console.log(`Filas:                    ${rows.length}`)
  console.log(`Deals ${apply ? 'creados' : 'a crear'}:           ${created}`)
  console.log(`Ya existían (skip):       ${skipped}`)
  console.log(`Empresas ${apply ? 'creadas' : 'a crear'}:         ${empresasCreadas}`)
  console.log(`Empresas matcheadas:      ${empresasMatch}`)
  console.log(`Contactos ${apply ? 'creados' : 'a crear'}:        ${contactosCreados}`)
  console.log(`Contactos reusados:       ${contactosReusados}`)
  console.log(`Por etapa:                ${JSON.stringify(perStage)}`)
  if (!apply) console.log('\n[DRY RUN] Nada se escribió. Corré con --apply para confirmar.')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
