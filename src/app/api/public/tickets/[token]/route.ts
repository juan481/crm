import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { SLA_HOURS } from '@/lib/tickets'
import { findEmpresaMatch } from '@/lib/directorio-link'
import { sendEmail, buildEmailHtml, resolveOrgSmtpConfig, isOrgEmailConfigured } from '@/lib/email'
import { getClientIp, checkRateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

interface Params { params: { token: string } }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const RATE_LIMIT = { max: 5, windowMinutes: 30 }

// buildEmailHtml() interpola subject/body directo en HTML sin escapar (ver
// src/lib/email.ts) — hoy es aceptable porque todo lo que le llega sale de
// gente ya autenticada (staff/técnicos). Esta ruta es la primera vez que
// texto de alguien totalmente anónimo de internet termina en un email —
// se escapa acá mismo antes de interpolar, sin tocar el helper compartido.
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// GET: datos públicos mínimos para pintar el formulario con la marca de la
// organización (nombre/logo/colores) — nada sensible, pensado para gente
// sin sesión iniciada.
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const db = prisma as any
    const org = await db.organization.findFirst({
      where: { publicSupportToken: params.token, suspended: false },
      select: { name: true, crmName: true, logoUrl: true, primaryColor: true, secondaryColor: true },
    })
    if (!org) return NextResponse.json({ error: 'Link inválido' }, { status: 404 })
    return NextResponse.json({ data: org })
  } catch (error) {
    console.error('[PUBLIC TICKET TOKEN GET]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// POST: crea un Ticket + primer TicketMessage, sin login. Ver Fase 13 del
// plan para la decisión de no tocar Ticket.createdById/TicketMessage.userId
// (siguen no-nulos) — se atribuyen técnicamente al SUPER_ADMIN de la
// organización; la identidad real de quien pide soporte queda en
// recipientEmail/recipientName, que es lo que de verdad importa para el
// seguimiento (mismos campos que ya usa el resto del sistema para
// notificar al cliente).
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const db = prisma as any

    // Rate limit por IP — sin esto, un mismo bot/persona podía crear tickets
    // sin límite. Se registra el intento ANTES de saber si el resto del
    // body es válido, para que reintentar con datos distintos no reinicie
    // el contador. Sin Redis en este proyecto — respaldado en DB, ver
    // src/lib/rate-limit.ts.
    const ip = getClientIp(req)
    const { limited } = await checkRateLimit('ticket_public', ip, RATE_LIMIT)
    if (limited) {
      return NextResponse.json(
        { error: 'Demasiados intentos — probá de nuevo en un rato.' },
        { status: 429 }
      )
    }

    const org = await db.organization.findFirst({
      where: { publicSupportToken: params.token, suspended: false },
      select: {
        id: true, name: true, crmName: true, primaryColor: true, secondaryColor: true,
        smtpHost: true, smtpPort: true, smtpUser: true, smtpPass: true, smtpFrom: true,
        smtpProvider: true, sesRegion: true, sesAccessKeyId: true, sesSecretKey: true, sesFrom: true, sesConfigSet: true,
      },
    })
    if (!org) return NextResponse.json({ error: 'Link inválido' }, { status: 404 })

    const { name, email, empresa: companyRaw, title, description, attachmentUrl, attachmentName, website } = await req.json()

    // Honeypot: campo invisible para humanos (ver soporte/[token]/page.tsx),
    // los bots de formularios genéricos suelen completarlo igual. A
    // propósito NO se responde con un falso éxito acá — el autocompletado
    // agresivo de algunos navegadores a veces llena campos ocultos por
    // error, y que una persona real crea que su consulta se envió cuando en
    // realidad se descartó es peor que el spam que esto evita. Devuelve un
    // error genérico (no delata que se detectó un bot) y no crea nada.
    if (website?.trim()) {
      return NextResponse.json({ error: 'No pudimos procesar tu consulta — probá de nuevo.' }, { status: 400 })
    }

    if (!name?.trim())        return NextResponse.json({ error: 'Tu nombre es requerido' },        { status: 400 })
    if (!email?.trim())       return NextResponse.json({ error: 'Tu email es requerido' },          { status: 400 })
    if (!EMAIL_RE.test(email.trim())) return NextResponse.json({ error: 'Ese email no parece válido' }, { status: 400 })
    if (!title?.trim())       return NextResponse.json({ error: 'El asunto es requerido' },         { status: 400 })
    if (!description?.trim()) return NextResponse.json({ error: 'Contanos el problema o consulta' }, { status: 400 })

    // Atribución técnica: el SUPER_ADMIN más antiguo de la org (siempre
    // existe — es quien completó el alta de la organización).
    const admin = await db.user.findFirst({
      where: { organizationId: org.id, role: 'SUPER_ADMIN', status: 'ACTIVE' },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    })
    if (!admin) return NextResponse.json({ error: 'No se pudo procesar la solicitud' }, { status: 500 })

    // Auto-vincular a una Empresa existente por dominio de email — mismo
    // mecanismo que ya usa la importación del Directorio.
    let empresaId: string | null = null
    const empresas = await db.empresa.findMany({
      where: { organizationId: org.id },
      select: { id: true, name: true, website: true },
    })
    empresaId = findEmpresaMatch(email, companyRaw, empresas)

    let ticket: any = null
    for (let attempt = 0; attempt < 5 && !ticket; attempt++) {
      const last = await db.ticket.findFirst({
        where: { organizationId: org.id },
        orderBy: { number: 'desc' },
        select: { number: true },
      })
      try {
        ticket = await db.ticket.create({
          data: {
            title: title.trim(),
            description: description.trim(),
            priority: 'MEDIA',
            category: 'CONSULTA',
            empresaId,
            recipientEmail: email.trim().toLowerCase(),
            recipientName: name.trim(),
            createdById: admin.id,
            organizationId: org.id,
            slaDueAt: new Date(Date.now() + SLA_HOURS.MEDIA * 60 * 60 * 1000),
            number: (last?.number ?? 0) + 1,
          },
          select: { id: true, number: true },
        })
      } catch (err: any) {
        if (err.code !== 'P2002' || attempt === 4) throw err
      }
    }
    if (!ticket) return NextResponse.json({ error: 'Error al crear el ticket' }, { status: 500 })

    await db.ticketMessage.create({
      data: {
        ticketId: ticket.id,
        content: description.trim(),
        isInternal: false,
        attachmentUrl: attachmentUrl || null,
        attachmentName: attachmentName || null,
        userId: admin.id,
      },
    })

    const orgName = org.name || org.crmName || 'CRM'
    const ticketNumber = String(ticket.number).padStart(4, '0')
    const safeName = escapeHtml(name.trim())
    const safeTitle = escapeHtml(title.trim())

    // Aviso a ADMIN/SUPER_ADMIN — sin esto, un ticket abierto por un
    // cliente por su cuenta sólo se nota si alguien entra a mirar la lista;
    // mismo patrón best-effort que el resto de los emails de esta ruta.
    if (isOrgEmailConfigured(org)) {
      try {
        const staff = await db.user.findMany({
          where: { organizationId: org.id, status: 'ACTIVE', role: { in: ['SUPER_ADMIN', 'ADMIN'] } },
          select: { email: true },
        })
        const staffHtml = buildEmailHtml(
          `Nuevo ticket del formulario público — #${ticketNumber}`,
          `${safeName} (${escapeHtml(email.trim())}) abrió el ticket "${safeTitle}" desde el formulario público.\n\nEntrá al CRM para responder.`,
          orgName,
          org.primaryColor || '#6366f1',
          org.secondaryColor || '#8b5cf6',
        )
        for (const s of staff) {
          if (!s.email) continue
          await sendEmail({
            to: s.email,
            subject: `Nuevo ticket público #${ticketNumber} — ${orgName}`,
            html: staffHtml,
            smtpConfig: resolveOrgSmtpConfig(org),
          })
        }
      } catch (err) {
        console.error('[PUBLIC TICKET] Staff notification failed:', err)
      }
    }

    // Confirmación al que abrió el ticket — best-effort, no bloquea la
    // creación si la org no tiene correo configurado o el envío falla.
    if (isOrgEmailConfigured(org)) {
      try {
        const html = buildEmailHtml(
          `Recibimos tu consulta — ticket #${ticketNumber}`,
          `Hola ${safeName},\n\nRecibimos tu consulta "${safeTitle}". Te vamos a responder a este mismo mail apenas la revisemos.`,
          orgName,
          org.primaryColor || '#6366f1',
          org.secondaryColor || '#8b5cf6',
        )
        await sendEmail({
          to: email.trim(),
          subject: `Recibimos tu consulta — ticket #${ticketNumber} — ${orgName}`,
          html,
          smtpConfig: resolveOrgSmtpConfig(org),
        })
      } catch (err) {
        console.error('[PUBLIC TICKET] Confirmation email failed:', err)
      }
    }

    return NextResponse.json({ data: { number: ticket.number } }, { status: 201 })
  } catch (error) {
    console.error('[PUBLIC TICKET TOKEN POST]', error)
    return NextResponse.json({ error: 'Error al enviar tu consulta' }, { status: 500 })
  }
}
