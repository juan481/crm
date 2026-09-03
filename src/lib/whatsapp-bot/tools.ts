import { Type, type FunctionDeclaration } from '@google/genai'
import { prisma } from '@/lib/db'
import { SLA_HOURS } from '@/lib/tickets'
import { fireWebhook } from '@/lib/webhooks'
import { pickAvailableTechnician, findUserByEmail } from '@/lib/whatsapp-bot/technician-picker'
import { resolveBotActorId } from '@/lib/whatsapp-bot/resolve-org'
import { resolveContactoForConversation } from '@/lib/whatsapp-bot/contacto'
import { buildConversationTranscript } from '@/lib/whatsapp-bot/transcript'
import { notifyHuman } from '@/lib/whatsapp-bot/notify'
import { buscarCatalogoParaBot } from '@/lib/catalogo-search'
import type { WhatsAppBotConfig } from '@/lib/whatsapp-bot/config'

// Herramientas que NISSI puede invocar durante la charla. A propósito son
// pocas y de grano grueso (guardar dato, buscar en el catálogo, escalar a
// soporte, escalar a ventas, escalar a administración) — el resto del
// criterio de ruteo (qué preguntar en qué orden, cuándo alcanza para
// escalar) vive en el prompt, no acá: estas funciones sólo ejecutan lo que
// la IA ya decidió, nunca deciden por su cuenta.
//
// Formato: FunctionDeclaration de Gemini (@google/genai). El schema usa
// `Type.*` (subset OpenAPI). Gemini NO soporta `additionalProperties` con
// mapa libre — por eso save_customer_info tiene campos fijos.
export const WHATSAPP_BOT_TOOLS: FunctionDeclaration[] = [
  {
    name: 'save_customer_info',
    description:
      'Guarda o actualiza datos del cliente que se van juntando durante la charla. Llamala cada vez que el cliente te da un dato nuevo, no esperes a tener todo — así no se pierde nada si la charla se corta. Pasá sólo los campos que tengas.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        nombre: { type: Type.STRING, description: 'Nombre de pila del cliente' },
        apellido: { type: Type.STRING, description: 'Apellido del cliente' },
        telefono: { type: Type.STRING, description: 'Teléfono de contacto si es distinto al de WhatsApp' },
        email: { type: Type.STRING, description: 'Mail del cliente' },
        direccion: { type: Type.STRING, description: 'Dirección / domicilio' },
        localidad: { type: Type.STRING, description: 'Localidad, ciudad o zona' },
        horarioContacto: { type: Type.STRING, description: 'Horario en el que lo puede llamar un asesor' },
        tipoConsulta: { type: Type.STRING, description: 'compra / instalación / soporte / facturación / gremio / asesor' },
        detalle: { type: Type.STRING, description: 'Cualquier otra respuesta del filtro de ventas o técnico, o dato relevante que no encaje en los campos de arriba' },
      },
    },
  },
  {
    name: 'buscar_catalogo',
    description:
      'Consultá el catálogo de la empresa para explicarle al cliente qué tipos/líneas de producto hay y confirmar disponibilidad. NO devuelve precios y vos NUNCA cotizás. Usala cuando el cliente pregunta si tenés cierto tipo de equipo, qué diferencia hay entre opciones, o qué le conviene para su caso. Después de orientar, seguí con el filtro de ventas y derivá con create_sales_lead para que un asesor arme el presupuesto.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: { type: Type.STRING, description: 'Palabras clave simples, SIN tildes, ej. "camara giratoria exterior", "alarma app", "kit 4 camaras".' },
        categoria: { type: Type.STRING, description: 'Opcional: línea/categoría para acotar, sin tildes, ej. "camaras IP", "alarmas", "CCTV"' },
      },
      required: ['query'],
    },
  },
  {
    name: 'create_support_ticket',
    description:
      'Crea un ticket de soporte técnico en el CRM y lo asigna a un técnico libre. Usala recién cuando ya hiciste el filtro técnico inicial según el tipo de falla (alarma o cámaras) y tenés el detalle completo — no antes.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING, description: 'Resumen corto del problema, ej: "Alarma no reporta a central"' },
        description: { type: Type.STRING, description: 'Todo el detalle recopilado: qué falla, respuestas del filtro técnico, dirección si la dio, etc.' },
        urgent: { type: Type.BOOLEAN, description: 'true SOLO si es una alarma que no está reportando a la central de monitoreo (regla explícita de Abba) — eso sube la prioridad, todo lo demás queda en prioridad normal.' },
        customerName: { type: Type.STRING },
        customerEmail: { type: Type.STRING, description: 'Opcional, sólo si el cliente lo dio.' },
      },
      required: ['title', 'description'],
    },
  },
  {
    name: 'create_sales_lead',
    description:
      'Registra una oportunidad de venta en el CRM (compra de equipos, instalación nueva, o consulta de gremio/importador) y avisa a Ventas. Usala recién cuando ya hiciste el filtro de ventas correspondiente y tenés los datos para la proforma (nombre, apellido, teléfono, mail, dirección, horario de contacto) — la IA NUNCA cotiza ni da precios, sólo junta el detalle.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        reason: { type: Type.STRING, enum: ['compra', 'instalacion_nueva', 'gremio', 'asesor'], description: '"asesor" si el cliente pidió explícitamente hablar con alguien de ventas sin encajar en los otros casos.' },
        title: { type: Type.STRING, description: 'Resumen corto, ej: "Cámaras para local comercial chico"' },
        summary: { type: Type.STRING, description: 'Todo el detalle para armar la proforma: qué necesita, respuestas del filtro de ventas, nombre y apellido, teléfono, mail, dirección, horario de contacto.' },
        customerName: { type: Type.STRING },
        customerEmail: { type: Type.STRING },
      },
      required: ['reason', 'title', 'summary'],
    },
  },
  {
    name: 'create_billing_ticket',
    description: 'Deriva una consulta de facturación o pagos a Administración, creando un ticket para que Norma (o quien esté a cargo) lo vea.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING },
        description: { type: Type.STRING, description: 'Detalle de la consulta (qué factura, qué pago, qué necesita).' },
        customerName: { type: Type.STRING },
        customerEmail: { type: Type.STRING },
      },
      required: ['title', 'description'],
    },
  },
]

export interface ToolContext {
  orgId: string
  conversationId: string
  customerPhone: string
  botConfig: WhatsAppBotConfig
}

interface ToolResult {
  resultText: string
  // Si esta herramienta cerró la charla del lado humano (se creó
  // Ticket/Deal), el engine deja de mandarle más turnos a la IA sin
  // intervención humana — ver WhatsAppConversation.status.
  handedOff?: { to: string; ticketId?: string; dealId?: string }
}

const HUMAN_WAIT_MESSAGE = 'En minutos un asesor o responsable de área se comunicará con usted.'

// El origen (ej. "Facebook Ads - Kit de Cámaras") se guarda solo, sin que la
// IA tenga que acordarse de mencionarlo — se setea en collectedData.origen
// apenas arranca la conversación (ver engine.ts, sólo si el mensaje trae
// `referral` de un anuncio de WhatsApp) y de acá se prepende a cualquier
// Ticket/Deal que se termine creando, para que el EEVV vea de entrada de
// dónde vino el lead sin depender de que el modelo no se lo olvide.
async function prependOrigin(db: any, conversationId: string, text: string): Promise<string> {
  const conv = await db.whatsAppConversation.findUnique({ where: { id: conversationId }, select: { collectedData: true } })
  const origen = (conv?.collectedData as Record<string, unknown> | null)?.origen
  return typeof origen === 'string' && origen ? `Origen: ${origen}\n\n${text}` : text
}

// Pega el transcript completo de la charla como registro interno del
// Deal/Ticket recién creado — así el humano que lo toma ve todo el contexto
// sin abrir el inbox. Falla suave: el handoff no se rompe si esto falla.
async function attachTranscript(
  db: any,
  target: { dealId: string } | { ticketId: string },
  conversationId: string,
  orgId: string,
  userId: string,
): Promise<void> {
  try {
    const content = await buildConversationTranscript(conversationId)
    if (!content) return
    if ('dealId' in target) {
      await db.dealNota.create({ data: { dealId: target.dealId, organizationId: orgId, userId, tipo: 'CHAT', content } })
    } else {
      await db.ticketMessage.create({ data: { ticketId: target.ticketId, userId, isInternal: true, content } })
    }
  } catch (err) {
    console.error('[NISSI] no se pudo adjuntar el transcript al registro', err)
  }
}

export async function runWhatsAppBotTool(name: string, input: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
  const db = prisma as any

  if (name === 'save_customer_info') {
    // Campos fijos (Gemini no soporta objeto abierto) — se filtran los
    // strings no vacíos y se hace shallow-merge a collectedData.
    const KEYS = ['nombre', 'apellido', 'telefono', 'email', 'direccion', 'localidad', 'horarioContacto', 'tipoConsulta', 'detalle']
    const patch: Record<string, string> = {}
    for (const k of KEYS) {
      const v = input[k]
      if (typeof v === 'string' && v.trim()) patch[k] = v.trim()
    }
    if (Object.keys(patch).length === 0) return { resultText: 'No había datos nuevos para guardar.' }
    const conv = await db.whatsAppConversation.findUnique({ where: { id: ctx.conversationId }, select: { collectedData: true } })
    const merged = { ...(conv?.collectedData as Record<string, unknown> | null ?? {}), ...patch }
    await db.whatsAppConversation.update({ where: { id: ctx.conversationId }, data: { collectedData: merged } })
    return { resultText: 'Datos guardados.' }
  }

  if (name === 'buscar_catalogo') {
    const query = String(input.query ?? '').trim()
    const categoria = typeof input.categoria === 'string' ? input.categoria.trim() : null
    if (!query) return { resultText: 'Falta qué buscar. Preguntale al cliente qué tipo de equipo necesita.' }
    try {
      const results = await buscarCatalogoParaBot(ctx.orgId, { query, categoria })
      if (results.length === 0) {
        return { resultText: `No encontré nada en el catálogo para "${query}". No inventes: ofrecele derivar a un asesor para que lo asesore con más detalle.` }
      }
      const lines = results.map((r) => {
        const bits = [r.nombre]
        if (r.marca) bits.push(`(${r.marca})`)
        if (r.categoria) bits.push(`— ${r.categoria}`)
        if (r.resumen) bits.push(`— ${r.resumen}`)
        return `• ${bits.join(' ')}`
      })
      return {
        resultText:
          `Resultados del catálogo (NUNCA menciones precios — no los tenés):\n${lines.join('\n')}\n\n` +
          `Usá esto para explicar y orientar. Para el presupuesto, seguí el filtro de ventas y derivá con create_sales_lead.`,
      }
    } catch (err) {
      console.error('[NISSI] buscar_catalogo falló', err)
      return { resultText: 'No pude consultar el catálogo ahora. Seguí con el filtro de ventas igual y derivá a un asesor.' }
    }
  }

  if (name === 'create_support_ticket') {
    // `??` no cubre el caso de que el modelo mande un string vacío (""),
    // sólo null/undefined — a diferencia de POST /api/tickets (que rechaza
    // título/descripción vacíos con 400), acá no hay quien devuelva ese
    // error, así que se resuelve con un fallback en vez de crear un ticket
    // en blanco.
    const title = (String(input.title ?? '').trim() || 'Consulta de soporte por WhatsApp')
    const description = (String(input.description ?? '').trim() || 'Sin detalle — revisar la conversación completa en el CRM.')
    const urgent = input.urgent === true
    const priority = urgent ? 'ALTA' : 'MEDIA'
    const customerName = typeof input.customerName === 'string' ? input.customerName.trim() : null
    const customerEmail = typeof input.customerEmail === 'string' ? input.customerEmail.trim() : null

    const [createdById, technician, contactoId] = await Promise.all([
      resolveBotActorId(ctx.orgId),
      pickAvailableTechnician(ctx.orgId),
      resolveContactoForConversation(ctx.orgId, { conversationId: ctx.conversationId, customerPhone: ctx.customerPhone }),
    ])
    if (!createdById) return { resultText: 'No se pudo crear el ticket: no hay ningún administrador cargado en esta organización todavía.' }

    const fullDescription = await prependOrigin(db, ctx.conversationId, `${description}\n\n— Recibido por NISSI (bot de WhatsApp) desde el número ${ctx.customerPhone}.`)

    let ticket: any = null
    for (let attempt = 0; attempt < 5 && !ticket; attempt++) {
      const last = await db.ticket.findFirst({ where: { organizationId: ctx.orgId }, orderBy: { number: 'desc' }, select: { number: true } })
      try {
        ticket = await db.ticket.create({
          data: {
            number: (last?.number ?? 0) + 1,
            title, description: fullDescription, priority, category: 'SOPORTE',
            recipientName: customerName, recipientEmail: customerEmail,
            contactoId: contactoId ?? null,
            assignedToId: technician?.id ?? null,
            createdById, organizationId: ctx.orgId,
            slaDueAt: new Date(Date.now() + SLA_HOURS[priority] * 60 * 60 * 1000),
          },
        })
      } catch (err: any) {
        if (err.code !== 'P2002' || attempt === 4) throw err
      }
    }

    await db.whatsAppConversation.update({
      where: { id: ctx.conversationId },
      data: { status: 'HANDED_OFF', handedOffTo: 'SOPORTE', ticketId: ticket.id },
    })
    await attachTranscript(db, { ticketId: ticket.id }, ctx.conversationId, ctx.orgId, createdById)

    fireWebhook(ctx.orgId, 'ticket.created', { id: ticket.id, number: ticket.number, title: ticket.title, priority, category: 'SOPORTE', source: 'whatsapp-ai-bot' })

    if (technician) {
      notifyHuman({
        orgId: ctx.orgId, toEmail: technician.email, toName: technician.name,
        subject: `Nuevo ticket de soporte por WhatsApp: ${title}`,
        heading: 'Te asignaron un ticket nuevo',
        bodyText: `NISSI (el bot de WhatsApp) creó el ticket #${ticket.number} "${title}"${urgent ? ' — marcado como URGENTE (alarma sin reportar a central)' : ''} y te lo asignó porque estás fichado y con menos carga ahora mismo.\n\n${description}`,
      })
    }
    // Aviso adicional al responsable de Soporte configurado en el panel de
    // NISSI (además del técnico asignado) — para que un referente del área
    // esté al tanto aunque no sea quien lo toma.
    const supportEmail = ctx.botConfig.supportContactEmail
    if (supportEmail && supportEmail !== technician?.email) {
      notifyHuman({
        orgId: ctx.orgId, toEmail: supportEmail, toName: ctx.botConfig.supportContactName,
        subject: `Nuevo ticket de soporte por WhatsApp: ${title}`,
        heading: 'Nuevo ticket de soporte desde WhatsApp',
        bodyText: `NISSI creó el ticket #${ticket.number} "${title}"${urgent ? ' — URGENTE' : ''}${technician ? ` y lo asignó a ${technician.name}` : ' (sin técnico disponible para asignar)'}.\n\n${description}`,
      })
    }

    return {
      resultText: technician
        ? `Ticket #${ticket.number} creado y asignado a ${technician.name}.`
        : `Ticket #${ticket.number} creado, pero no hay ningún técnico disponible para asignar todavía — queda sin asignar en el CRM.`,
      handedOff: { to: 'SOPORTE', ticketId: ticket.id },
    }
  }

  if (name === 'create_sales_lead' || name === 'create_billing_ticket') {
    const isBilling = name === 'create_billing_ticket'
    const title = (String(input.title ?? '').trim() || (isBilling ? 'Consulta de facturación por WhatsApp' : 'Lead de ventas por WhatsApp'))
    const detail = (String((isBilling ? input.description : input.summary) ?? '').trim() || 'Sin detalle — revisar la conversación completa en el CRM.')
    const customerName = typeof input.customerName === 'string' ? input.customerName.trim() : null
    const customerEmail = typeof input.customerEmail === 'string' ? input.customerEmail.trim() : null
    const fullDetail = await prependOrigin(db, ctx.conversationId, `${detail}\n\n— Recibido por NISSI (bot de WhatsApp) desde el número ${ctx.customerPhone}.`)

    const contactEmail = isBilling ? ctx.botConfig.billingContactEmail : ctx.botConfig.salesContactEmail
    const contactUser = await findUserByEmail(ctx.orgId, contactEmail)

    // Alta / match del contacto (persona) con lo que NISSI fue juntando —
    // así el registro entra al CRM como Contacto + Oportunidad/Ticket, no
    // sólo como texto suelto. Falla suave: si no se puede, se crea sin
    // contactoId.
    const contactoId = await resolveContactoForConversation(ctx.orgId, { conversationId: ctx.conversationId, customerPhone: ctx.customerPhone })

    if (isBilling) {
      const createdById = contactUser?.id ?? (await resolveBotActorId(ctx.orgId))
      if (!createdById) return { resultText: 'No se pudo derivar a Administración: no hay ningún administrador cargado en esta organización todavía.' }

      let ticket: any = null
      for (let attempt = 0; attempt < 5 && !ticket; attempt++) {
        const last = await db.ticket.findFirst({ where: { organizationId: ctx.orgId }, orderBy: { number: 'desc' }, select: { number: true } })
        try {
          ticket = await db.ticket.create({
            data: {
              number: (last?.number ?? 0) + 1,
              title, description: fullDetail, priority: 'MEDIA', category: 'FACTURACION',
              recipientName: customerName, recipientEmail: customerEmail,
              contactoId: contactoId ?? null,
              assignedToId: contactUser?.id ?? null,
              createdById, organizationId: ctx.orgId,
              slaDueAt: new Date(Date.now() + SLA_HOURS.MEDIA * 60 * 60 * 1000),
            },
          })
        } catch (err: any) {
          if (err.code !== 'P2002' || attempt === 4) throw err
        }
      }
      await db.whatsAppConversation.update({ where: { id: ctx.conversationId }, data: { status: 'HANDED_OFF', handedOffTo: 'ADMINISTRACION', ticketId: ticket.id } })
      await attachTranscript(db, { ticketId: ticket.id }, ctx.conversationId, ctx.orgId, createdById)
      fireWebhook(ctx.orgId, 'ticket.created', { id: ticket.id, number: ticket.number, title, category: 'FACTURACION', source: 'whatsapp-ai-bot' })

      const notifyTarget = contactUser ?? (contactEmail ? { name: null, email: contactEmail } : null)
      if (notifyTarget) {
        notifyHuman({
          orgId: ctx.orgId, toEmail: notifyTarget.email, toName: notifyTarget.name,
          subject: `Consulta de facturación por WhatsApp: ${title}`,
          heading: 'Nueva consulta de facturación',
          bodyText: `NISSI (el bot de WhatsApp) derivó esta consulta a Administración — quedó como ticket #${ticket.number} en el CRM.\n\n${detail}`,
        })
      }
      return {
        resultText: `Consulta derivada a Administración (ticket #${ticket.number}).${notifyTarget ? '' : ' Nota: no hay un email de Administración configurado en el plugin, no se pudo avisar por mail.'}`,
        handedOff: { to: 'ADMINISTRACION', ticketId: ticket.id },
      }
    }

    // Sales lead → Deal en Pipeline, etapa LEAD.
    const ownerId = contactUser?.id ?? (await resolveBotActorId(ctx.orgId))
    if (!ownerId) return { resultText: 'No se pudo crear la oportunidad: no hay ningún administrador cargado en esta organización todavía.' }

    const reason = typeof input.reason === 'string' ? input.reason.trim() : ''
    const leadReason = ['compra', 'instalacion_nueva', 'gremio', 'asesor'].includes(reason) ? reason : null

    const deal = await db.deal.create({
      data: {
        title, notes: fullDetail, stage: 'LEAD', ownerId, organizationId: ctx.orgId, origen: 'WHATSAPP',
        ...(leadReason ? { leadReason } : {}),
        ...(contactoId ? { contactoId } : {}),
      },
    })
    await db.whatsAppConversation.update({ where: { id: ctx.conversationId }, data: { status: 'HANDED_OFF', handedOffTo: 'VENTAS', dealId: deal.id } })
    await attachTranscript(db, { dealId: deal.id }, ctx.conversationId, ctx.orgId, ownerId)

    const notifyTarget = contactUser ?? (contactEmail ? { name: null, email: contactEmail } : null)
    if (notifyTarget) {
      notifyHuman({
        orgId: ctx.orgId, toEmail: notifyTarget.email, toName: notifyTarget.name,
        subject: `Nuevo lead de ventas por WhatsApp: ${title}`,
        heading: 'Nueva oportunidad desde WhatsApp',
        bodyText: `NISSI (el bot de WhatsApp) juntó los datos de un cliente interesado y lo dejó cargado en el Pipeline como "${title}" — no cotizó nada, queda para que lo tomes vos.\n\n${detail}`,
      })
    }
    return {
      resultText: `Oportunidad cargada en el Pipeline.${notifyTarget ? '' : ' Nota: no hay un email de Ventas configurado en el plugin, no se pudo avisar por mail.'}`,
      handedOff: { to: 'VENTAS', dealId: deal.id },
    }
  }

  return { resultText: `Herramienta desconocida: ${name}` }
}

export { HUMAN_WAIT_MESSAGE }
