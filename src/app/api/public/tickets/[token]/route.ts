import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { SLA_HOURS } from '@/lib/tickets'
import { findEmpresaMatch } from '@/lib/directorio-link'
import { sendEmail, buildEmailHtml, resolveOrgSmtpConfig, isOrgEmailConfigured } from '@/lib/email'

export const dynamic = 'force-dynamic'

interface Params { params: { token: string } }

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
    const org = await db.organization.findFirst({
      where: { publicSupportToken: params.token, suspended: false },
      select: {
        id: true, name: true, crmName: true, primaryColor: true, secondaryColor: true,
        smtpHost: true, smtpPort: true, smtpUser: true, smtpPass: true, smtpFrom: true,
        smtpProvider: true, sesRegion: true, sesAccessKeyId: true, sesSecretKey: true, sesFrom: true, sesConfigSet: true,
      },
    })
    if (!org) return NextResponse.json({ error: 'Link inválido' }, { status: 404 })

    const { name, email, empresa: companyRaw, title, description, attachmentUrl, attachmentName } = await req.json()
    if (!name?.trim())        return NextResponse.json({ error: 'Tu nombre es requerido' },        { status: 400 })
    if (!email?.trim())       return NextResponse.json({ error: 'Tu email es requerido' },          { status: 400 })
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

    // Confirmación al que abrió el ticket — best-effort, no bloquea la
    // creación si la org no tiene correo configurado o el envío falla.
    if (isOrgEmailConfigured(org)) {
      try {
        const orgName = org.name || org.crmName || 'CRM'
        const ticketNumber = String(ticket.number).padStart(4, '0')
        const html = buildEmailHtml(
          `Recibimos tu consulta — ticket #${ticketNumber}`,
          `Hola ${name.trim()},\n\nRecibimos tu consulta "${title.trim()}". Te vamos a responder a este mismo mail apenas la revisemos.`,
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
