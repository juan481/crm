import { prisma } from '@/lib/db'

// Resuelve (matchea o crea) el DirectorioContacto de la persona detrás de una
// conversación de WhatsApp que NISSI acaba de calificar, para vincularlo al
// registro que se crea al derivar: Deal.contactoId (ventas) o Ticket.contactoId
// (soporte/facturación). La mayoría de los contactos de Abba son consumidor
// final (vivienda, quinta, campo particular) → contacto SIN empresa, igual
// criterio que el import de chats de WhatsApp (scripts/import-abba-leads.ts).
//
// Falla suave: si algo sale mal devuelve null y el Deal/Ticket se crea igual
// sin contacto vinculado (mismo espíritu que el resto del bot).

const digitsOnly = (s: string): string => (s || '').replace(/\D/g, '')

function pickName(
  collected: Record<string, unknown>,
  waName: string | null,
  phoneForFallback: string,
): { firstName: string; lastName: string } {
  const c = (k: string) => (typeof collected[k] === 'string' ? (collected[k] as string).trim() : '')
  let firstName = c('nombre') || c('firstName')
  let lastName = c('apellido') || c('lastName')

  if (!firstName && waName) {
    const parts = waName.trim().split(/\s+/).filter(Boolean)
    firstName = parts[0] ?? ''
    lastName = lastName || parts.slice(1).join(' ')
  }
  if (!firstName) firstName = 'Sin nombre'
  if (!lastName) lastName = `(${phoneForFallback})`
  return { firstName, lastName }
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

    const { firstName, lastName } = pickName(collected, waName, phoneRaw)

    // 2) Match por nombre + apellido (contacto sin empresa).
    if (firstName !== 'Sin nombre') {
      const byName = await db.directorioContacto.findFirst({
        where: {
          organizationId: orgId,
          firstName: { equals: firstName, mode: 'insensitive' },
          lastName: { equals: lastName, mode: 'insensitive' },
        },
        select: { id: true },
      })
      if (byName) return byName.id
    }

    // 3) Crear nuevo.
    const email =
      typeof collected.email === 'string' && collected.email.includes('@')
        ? collected.email.trim().toLowerCase()
        : null
    const localidad =
      ['localidad', 'ciudad', 'zona', 'direccion', 'domicilio']
        .map((k) => (typeof collected[k] === 'string' ? (collected[k] as string).trim() : ''))
        .find(Boolean) || null

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
    return created.id
  } catch (err) {
    console.error('[NISSI] resolveContactoForConversation falló — el registro se crea sin contacto', err)
    return null
  }
}
