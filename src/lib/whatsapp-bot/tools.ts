import type Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/db'
import { SLA_HOURS } from '@/lib/tickets'
import { fireWebhook } from '@/lib/webhooks'
import { pickAvailableTechnician, findUserByEmail } from '@/lib/whatsapp-bot/technician-picker'
import { resolveBotActorId } from '@/lib/whatsapp-bot/resolve-org'
import { notifyHuman } from '@/lib/whatsapp-bot/notify'
import type { WhatsAppBotConfig } from '@/lib/whatsapp-bot/config'

// Herramientas que NISSI puede invocar durante la charla. A propósito son
// pocas y de grano grueso (guardar dato, escalar a soporte, escalar a
// ventas, escalar a administración) — el resto del criterio de ruteo (qué
// preguntar en qué orden, cuándo alcanza para escalar) vive en el prompt,
// no acá: estas funciones sólo ejecutan lo que la IA ya decidió, nunca
// deciden por su cuenta.
export const WHATSAPP_BOT_TOOLS: Anthropic.Tool[] = [
  {
    name: 'save_customer_info',
    description:
      'Guarda o actualiza datos del cliente que se van juntando durante la charla (nombre, teléfono/mail de contacto si es distinto al de WhatsApp, dirección, horario para que lo llamen, y cualquier respuesta a los filtros de ventas/soporte). Llamala cada vez que el cliente te da un dato nuevo, no esperes a tener todo — así no se pierde nada si la charla se corta.',
    input_schema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          description: 'Pares clave/valor con lo que se sabe hasta ahora. Usá claves en español simple, ej: nombre, apellido, telefono, email, direccion, horarioContacto, tipoConsulta, filtroVentas, filtroTecnico.',
          additionalProperties: { type: 'string' },
        },
      },
      required: ['data'],
    },
  },
  {
    name: 'create_support_ticket',
    description:
      'Crea un ticket de soporte técnico en el CRM y lo asigna a un técnico libre. Usala recién cuando ya hiciste el filtro técnico inicial según el tipo de falla (alarma o cámaras) y tenés el detalle completo — no antes.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Resumen corto del problema, ej: "Alarma no reporta a central"' },
        description: { type: 'string', description: 'Todo el detalle recopilado: qué falla, respuestas del filtro técnico, dirección si la dio, etc.' },
        urgent: { type: 'boolean', description: 'true SOLO si es una alarma que no está reportando a la central de monitoreo (regla explícita de Abba) — eso sube la prioridad, todo lo demás queda en prioridad normal.' },
        customerName: { type: 'string' },
        customerEmail: { type: 'string', description: 'Opcional, sólo si el cliente lo dio.' },
      },
      required: ['title', 'description'],
    },
  },
  {
    name: 'create_sales_lead',
    description:
      'Registra una oportunidad de venta en el CRM (compra de equipos, instalación nueva, o consulta de gremio/importador) y avisa a Ventas. Usala recién cuando ya hiciste el filtro de ventas correspondiente y tenés los datos para la proforma (nombre, apellido, teléfono, mail, dirección, horario de contacto) — la IA NUNCA cotiza ni da precios, sólo junta el detalle.',
    input_schema: {
      type: 'object',
      properties: {
        reason: { type: 'string', enum: ['compra', 'instalacion_nueva', 'gremio', 'asesor'], description: '"asesor" si el cliente pidió explícitamente hablar con alguien de ventas sin encajar en los otros casos.' },
        title: { type: 'string', description: 'Resumen corto, ej: "Cámaras para local comercial chico"' },
        summary: { type: 'string', description: 'Todo el detalle para armar la proforma: qué necesita, respuestas del filtro de ventas, nombre y apellido, teléfono, mail, dirección, horario de contacto.' },
        customerName: { type: 'string' },
        customerEmail: { type: 'string' },
      },
      required: ['reason', 'title', 'summary'],
    },
  },
  {
    name: 'create_billing_ticket',
    description: 'Deriva una consulta de facturación o pagos a Administración, creando un ticket para que Norma (o quien esté a cargo) lo vea.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        description: { type: 'string', description: 'Detalle de la consulta (qué factura, qué pago, qué necesita).' },
        customerName: { type: 'string' },
        customerEmail: { type: 'string' },
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

export async function runWhatsAppBotTool(name: string, input: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
  const db = prisma as any

  if (name === 'save_customer_info') {
    const patch = (input.data && typeof input.data === 'object') ? input.data as Record<string, unknown> : {}
    const conv = await db.whatsAppConversation.findUnique({ where: { id: ctx.conversationId }, select: { collectedData: true } })
    const merged = { ...(conv?.collectedData as Record<string, unknown> | null ?? {}), ...patch }
    await db.whatsAppConversation.update({ where: { id: ctx.conversationId }, data: { collectedData: merged } })
    return { resultText: 'Datos guardados.' }
  }

  if (name === 'create_support_ticket') {
    const title = String(input.title ?? 'Consulta de soporte por WhatsApp').trim()
    const description = String(input.description ?? '').trim()
    const urgent = input.urgent === true
    const priority = urgent ? 'ALTA' : 'MEDIA'
    const customerName = typeof input.customerName === 'string' ? input.customerName.trim() : null
    const customerEmail = typeof input.customerEmail === 'string' ? input.customerEmail.trim() : null

    const [createdById, technician] = await Promise.all([
      resolveBotActorId(ctx.orgId),
      pickAvailableTechnician(ctx.orgId),
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

    fireWebhook(ctx.orgId, 'ticket.created', { id: ticket.id, number: ticket.number, title: ticket.title, priority, category: 'SOPORTE', source: 'whatsapp-ai-bot' })

    if (technician) {
      notifyHuman({
        orgId: ctx.orgId, toEmail: technician.email, toName: technician.name,
        subject: `Nuevo ticket de soporte por WhatsApp: ${title}`,
        heading: 'Te asignaron un ticket nuevo',
        bodyText: `NISSI (el bot de WhatsApp) creó el ticket #${ticket.number} "${title}"${urgent ? ' — marcado como URGENTE (alarma sin reportar a central)' : ''} y te lo asignó porque estás fichado y con menos carga ahora mismo.\n\n${description}`,
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
    const title = String(input.title ?? (isBilling ? 'Consulta de facturación por WhatsApp' : 'Lead de ventas por WhatsApp')).trim()
    const detail = String((isBilling ? input.description : input.summary) ?? '').trim()
    const customerName = typeof input.customerName === 'string' ? input.customerName.trim() : null
    const customerEmail = typeof input.customerEmail === 'string' ? input.customerEmail.trim() : null
    const fullDetail = await prependOrigin(db, ctx.conversationId, `${detail}\n\n— Recibido por NISSI (bot de WhatsApp) desde el número ${ctx.customerPhone}.`)

    const contactEmail = isBilling ? ctx.botConfig.billingContactEmail : ctx.botConfig.salesContactEmail
    const contactUser = await findUserByEmail(ctx.orgId, contactEmail)

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

    const deal = await db.deal.create({
      data: { title, notes: fullDetail, stage: 'LEAD', ownerId, organizationId: ctx.orgId },
    })
    await db.whatsAppConversation.update({ where: { id: ctx.conversationId }, data: { status: 'HANDED_OFF', handedOffTo: 'VENTAS', dealId: deal.id } })

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
