import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { sendEmail, buildEmailHtml, resolveOrgSmtpConfig, isOrgEmailConfigured } from '@/lib/email'

interface Params { params: { id: string } }

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!['SUPER_ADMIN', 'ADMIN', 'SELLER'].includes(payload.role)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const { contactIds, subject, body: messageBody } = await req.json() as {
      contactIds: string[]
      subject:    string
      body:       string
    }

    if (!contactIds?.length) return NextResponse.json({ error: 'Seleccioná al menos un contacto' }, { status: 400 })
    if (!subject?.trim())    return NextResponse.json({ error: 'El asunto es requerido' }, { status: 400 })
    if (!messageBody?.trim()) return NextResponse.json({ error: 'El mensaje es requerido' }, { status: 400 })

    const db = prisma as any

    // Verify empresa belongs to org
    const empresa = await db.empresa.findFirst({
      where: { id: params.id, organizationId: payload.orgId },
      select: { id: true, name: true },
    })
    if (!empresa) return NextResponse.json({ error: 'Empresa no encontrada' }, { status: 404 })

    // Get the contacts ensuring they belong to this empresa
    const contacts = await db.directorioContacto.findMany({
      where: {
        id:         { in: contactIds },
        empresaId:  params.id,
        organizationId: payload.orgId,
      },
      select: { id: true, firstName: true, lastName: true, email: true },
    })
    if (!contacts.length) return NextResponse.json({ error: 'No se encontraron contactos válidos' }, { status: 400 })

    const validContacts = (contacts as Array<{ id: string; firstName: string; lastName: string; email: string | null }>)
      .filter(c => c.email)

    if (!validContacts.length) return NextResponse.json({ error: 'Los contactos seleccionados no tienen email' }, { status: 400 })

    // Fetch org email config (SMTP or SES, whichever the org has selected)
    const org = await prisma.organization.findUnique({
      where: { id: payload.orgId },
      select: {
        name: true, crmName: true, primaryColor: true, secondaryColor: true,
        smtpHost: true, smtpPort: true, smtpUser: true, smtpPass: true, smtpFrom: true,
        smtpProvider: true, sesRegion: true, sesAccessKeyId: true, sesSecretKey: true, sesFrom: true, sesConfigSet: true,
      },
    })

    const orgName      = org?.name || org?.crmName || 'CRM Pro'
    const primaryColor = org?.primaryColor || '#6366f1'
    const secondaryColor = org?.secondaryColor || '#8b5cf6'

    const smtpConfig = resolveOrgSmtpConfig(org)

    // Fail fast if there's no way to send (no org config and no global fallback configured)
    if (!isOrgEmailConfigured(org) && !process.env.BREVO_API_KEY && !process.env.SMTP_HOST) {
      return NextResponse.json({
        error: 'No hay configuración de email. Configurá el correo en Configuración → Correo antes de enviar.',
      }, { status: 422 })
    }

    const agent = await prisma.user.findUnique({ where: { id: payload.userId }, select: { name: true } })
    const agentName = agent?.name || 'El equipo'

    // Send email to each contact
    const failed: string[] = []
    const sent:   string[] = []

    for (const c of validContacts) {
      try {
        const personalizedBody = messageBody.replace(/\{nombre\}/gi, c.firstName)
        const html = buildEmailHtml(subject, personalizedBody, orgName, primaryColor, secondaryColor)
        await sendEmail({ to: c.email!, subject, html, smtpConfig })
        sent.push(`${c.firstName} ${c.lastName}`)
      } catch (err) {
        console.error(`[SEND-EMAIL] failed for ${c.email}:`, err)
        failed.push(`${c.firstName} ${c.lastName}`)
      }
    }

    // Create EmpresaNota for the activity
    if (sent.length > 0) {
      await db.empresaNota.create({
        data: {
          empresaId:      params.id,
          organizationId: payload.orgId,
          userId:         payload.userId,
          tipo:           'ENVIO_COTIZACION',
          content:        `Email "${subject}" enviado por ${agentName} a: ${sent.join(', ')}.${failed.length > 0 ? ` Fallaron: ${failed.join(', ')}.` : ''}`,
        },
      })
    }

    return NextResponse.json({ sent: sent.length, failed, sentNames: sent })
  } catch (error) {
    console.error('[SEND-EMAIL EMPRESA]', error)
    return NextResponse.json({ error: 'Error al enviar el email' }, { status: 500 })
  }
}
