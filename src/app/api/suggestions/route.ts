import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { sendEmail } from '@/lib/email'

export const dynamic = 'force-dynamic'

const SUGGESTIONS_INBOX = 'contacto@justcreate.com.ar'

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
}

// Any logged-in user can send a suggestion — always goes through the agency's
// own global SMTP env vars (not the org's own SES/SMTP config), so this keeps
// working even for an org whose email setup is broken or not configured yet.
export async function POST(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { message } = await req.json() as { message?: string }
    const trimmed = message?.trim() ?? ''
    if (!trimmed) return NextResponse.json({ error: 'Escribí un mensaje' }, { status: 400 })
    if (trimmed.length > 4000) return NextResponse.json({ error: 'El mensaje es demasiado largo' }, { status: 400 })

    const [user, org] = await Promise.all([
      prisma.user.findUnique({ where: { id: payload.userId }, select: { name: true, email: true } }),
      prisma.organization.findUnique({ where: { id: payload.orgId }, select: { name: true } }),
    ])

    const html = `
      <p><strong>De:</strong> ${escapeHtml(user?.name ?? 'Usuario')} (${escapeHtml(user?.email ?? payload.email)})</p>
      <p><strong>Organización:</strong> ${escapeHtml(org?.name ?? payload.orgId)}</p>
      <p><strong>Sugerencia:</strong></p>
      <p>${escapeHtml(trimmed).replace(/\n/g, '<br/>')}</p>
    `

    await sendEmail({
      to:      SUGGESTIONS_INBOX,
      from:    process.env.SMTP_FROM,
      subject: `Sugerencia del CRM — ${org?.name ?? 'organización'}`,
      html,
    })

    return NextResponse.json({ message: 'Sugerencia enviada, ¡gracias!' })
  } catch (error) {
    console.error('[SUGGESTIONS POST]', error)
    return NextResponse.json({ error: 'Error al enviar la sugerencia' }, { status: 500 })
  }
}
