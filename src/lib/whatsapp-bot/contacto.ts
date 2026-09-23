import { prisma } from '@/lib/db'
import { resolveBotActorId } from '@/lib/whatsapp-bot/resolve-org'

// Resuelve (matchea o crea) el DirectorioContacto de la persona detrás de una
// conversación de WhatsApp que NISSI acaba de calificar, para vincularlo al
// registro que se crea al derivar: Deal.contactoId (ventas) o Ticket.contactoId
// (soporte/facturación). La mayoría de los contactos de Abba son consumidor
// final (vivienda, quinta, campo particular) → contacto SIN empresa, igual
// criterio que el import de chats de WhatsApp (scripts/import-abba-leads.ts).
//
// ALTA OBLIGATORIA (pedido de Abba, 2026-09-23): todo chat de WhatsApp tiene
// que quedar guardado en Clientes desde el primer contacto, tenga o no
// nombre todavía y termine o no en una oportunidad/ticket — antes esta
// función devolvía null si NISSI no había juntado un nombre real todavía, y
// el Deal/Ticket quedaba "suelto" sin contacto. Ahora SIEMPRE crea (usando
// un nombre provisorio si hace falta, ver fallbackName) — lo único que sigue
// devolviendo null es un error real de DB (falla suave, ver catch).
//
// Falla suave: si algo sale mal devuelve null y el Deal/Ticket se crea igual
// sin contacto vinculado (mismo espíritu que el resto del bot).

const digitsOnly = (s: string): string => (s || '').replace(/\D/g, '')

// Match por teléfono solo (últimos 8 dígitos) — sin crear nada. Se usa apenas
// llega el primer mensaje de un número nuevo, ANTES de que NISSI le pregunte
// nada: si Abba ya tiene este teléfono cargado en el directorio (caso muy
// común, la mayoría son clientes que ya escribieron antes por otro canal),
// el inbox lo muestra con nombre/empresa desde el primer mensaje en vez de
// mostrar el número pelado hasta que alguien lo vincule.
export async function findContactoIdByPhone(
  orgId: string,
  waIdDigits: string,
): Promise<{ contactoId: string; empresaId: string | null } | null> {
  const tail = digitsOnly(waIdDigits).slice(-8)
  if (tail.length < 8) return null
  try {
    const db = prisma as any
    const match = await db.directorioContacto.findFirst({
      where: { organizationId: orgId, phone: { contains: tail } },
      select: { id: true, empresaId: true },
    })
    return match ? { contactoId: match.id, empresaId: match.empresaId ?? null } : null
  } catch (err) {
    console.error('[NISSI] findContactoIdByPhone falló', err)
    return null
  }
}

// ¿Parece un nombre de persona real y no un placeholder / un mail / puro número?
function looksLikeRealName(s: string): boolean {
  const t = (s || '').trim()
  if (t.length < 2) return false
  if (/@|\d{4,}/.test(t)) return false                              // mail, o tira de dígitos
  if (/^(sin nombre|cliente|desconocido|n\/?a|no s[eé])/i.test(t)) return false
  return /[a-zà-ÿ]{2,}/i.test(t)                                    // al menos 2 letras seguidas
}

// Devuelve el nombre real de la persona, o `null` si no hay uno usable.
// null = NO se crea un contacto genérico ("Sin nombre (+549...)") — el Deal
// queda sin contacto vinculado y una persona lo completa (el teléfono ya
// queda en las notas del Deal). Ver comentario en resolveContactoForConversation.
function pickName(
  collected: Record<string, unknown>,
  waName: string | null,
): { firstName: string; lastName: string } | null {
  const c = (k: string) => (typeof collected[k] === 'string' ? (collected[k] as string).trim() : '')

  // 1) Lo que NISSI juntó explícitamente (save_customer_info).
  let firstName = c('nombre') || c('firstName')
  let lastName = c('apellido') || c('lastName')

  // 2) El nombre del perfil de WhatsApp — suele ser el nombre real ("Camila
  //    Preves" pone eso como nombre de WhatsApp). Sólo si NISSI no juntó nada.
  if (!firstName && waName && looksLikeRealName(waName)) {
    const parts = waName.trim().split(/\s+/).filter(Boolean)
    firstName = parts[0] ?? ''
    lastName = lastName || parts.slice(1).join(' ')
  }

  if (!looksLikeRealName(firstName)) return null
  return { firstName: firstName.trim(), lastName: lastName.trim() }
}

// Nombre "de emergencia" cuando todavía no hay uno real — nunca dejamos de
// crear el contacto por esto (ver ALTA OBLIGATORIA arriba). Se puede
// renombrar a mano después; el teléfono completo queda en `phone` para
// buscar/mergear igual. Últimos 4 dígitos (no 8, como el match) sólo para
// diferenciar contactos "Contacto WhatsApp" entre sí a simple vista en una
// lista — la identidad real la da el teléfono completo guardado.
function fallbackName(waName: string | null, phoneDigits: string): { firstName: string; lastName: string } {
  const trimmed = (waName || '').trim()
  if (trimmed) {
    const parts = trimmed.split(/\s+/).filter(Boolean)
    return { firstName: parts[0] ?? 'Contacto WhatsApp', lastName: parts.slice(1).join(' ') }
  }
  const tail = phoneDigits.slice(-4) || phoneDigits
  return { firstName: 'Contacto WhatsApp', lastName: tail }
}

export interface ResolveContactoCtx {
  conversationId: string
  customerPhone: string // wa_id, sólo dígitos (sin "+")
}

export async function resolveContactoForConversation(orgId: string, ctx: ResolveContactoCtx): Promise<string | null> {
  const db = prisma as any
  try {
    const conv = await db.whatsAppConversation.findUnique({
      where: { id: ctx.conversationId },
      select: { collectedData: true, customerName: true },
    })
    const collected = (conv?.collectedData as Record<string, unknown> | null) ?? {}
    const waName: string | null = conv?.customerName ?? null

    const phoneRaw =
      (typeof collected.telefono === 'string' && collected.telefono.trim()) ||
      (typeof collected.phone === 'string' && collected.phone.trim()) ||
      `+${ctx.customerPhone}`
    const phoneDigits = digitsOnly(phoneRaw)

    // 1) Match por teléfono (últimos 8 dígitos — evita falsos negativos por
    //    prefijos/0/15 escritos distinto).
    if (phoneDigits.length >= 8) {
      const tail = phoneDigits.slice(-8)
      const byPhone = await db.directorioContacto.findFirst({
        where: { organizationId: orgId, phone: { contains: tail } },
        select: { id: true },
      })
      if (byPhone) return byPhone.id
    }

    const nombrePersona = pickName(collected, waName)

    // 2) Match por nombre + apellido — SÓLO con un nombre real (si estamos
    // por usar el de emergencia, no matcheamos por nombre: dos personas
    // anónimas distintas no tienen por qué compartir "Contacto WhatsApp").
    if (nombrePersona) {
      const byName = await db.directorioContacto.findFirst({
        where: {
          organizationId: orgId,
          firstName: { equals: nombrePersona.firstName, mode: 'insensitive' },
          lastName: { equals: nombrePersona.lastName, mode: 'insensitive' },
        },
        select: { id: true },
      })
      if (byName) return byName.id
    }

    // 3) Crear nuevo — con nombre real si lo tenemos, o uno provisorio si
    // no (ver ALTA OBLIGATORIA arriba: nunca se deja de crear por esto).
    const { firstName, lastName } = nombrePersona ?? fallbackName(waName, phoneDigits)
    const email =
      typeof collected.email === 'string' && collected.email.includes('@')
        ? collected.email.trim().toLowerCase()
        : null
    const localidad =
      ['localidad', 'ciudad', 'zona', 'direccion', 'domicilio']
        .map((k) => (typeof collected[k] === 'string' ? (collected[k] as string).trim() : ''))
        .find(Boolean) || null
    const origen = typeof collected.origen === 'string' ? collected.origen.trim() : ''

    const created = await db.directorioContacto.create({
      data: {
        organizationId: orgId,
        firstName,
        lastName,
        phone: phoneRaw,
        email,
        companyRaw: localidad,
      },
      select: { id: true },
    })

    // Nota de alta — deja registrado el origen y que fue NISSI quien lo dio
    // de alta, sin depender de que la charla termine en Deal/Ticket (ahí
    // además se adjunta el transcript completo, ver attachTranscript en
    // tools.ts). Falla suave: no bloquea el alta si esto no se puede crear.
    try {
      const actorId = await resolveBotActorId(orgId)
      if (actorId) {
        await db.directorioContactoNota.create({
          data: {
            contactoId: created.id, organizationId: orgId, userId: actorId, tipo: 'NOTA',
            content: `Alta automática desde WhatsApp (NISSI)${origen ? ` — Origen: ${origen}` : ''}.${!nombrePersona ? ' Todavía sin nombre confirmado — revisar y completar.' : ''}`,
          },
        })
      }
    } catch (err) {
      console.error('[NISSI] no se pudo dejar la nota de alta del contacto', err)
    }

    return created.id
  } catch (err) {
    console.error('[NISSI] resolveContactoForConversation falló — el registro se crea sin contacto', err)
    return null
  }
}
