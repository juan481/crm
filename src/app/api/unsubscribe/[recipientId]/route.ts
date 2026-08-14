import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { suppressEmail } from '@/lib/suppression'

export const dynamic = 'force-dynamic'

interface Params { params: { recipientId: string } }

// Separado de la página (que sólo LEE, nunca muta) — la baja real sólo pasa
// acá, con un POST explícito disparado por un click del usuario. Antes la
// mutación corría con sólo RENDERIZAR /unsubscribe/[recipientId] (Server
// Component ejecutando suppressEmail en el propio render, sin verbo POST ni
// confirmación) — cualquier sistema que prefetcheara o escaneara el link
// antes de que la persona lo abriera (Safe Links de Outlook, escáneres
// antiphishing de gateway de correo, preview de Slack/WhatsApp) daba de baja
// al destinatario sin que nadie hubiera hecho click nunca.
export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const db = prisma as any
    const recipient = await db.campaignRecipient.findUnique({
      where:  { id: params.recipientId },
      select: { email: true, campaign: { select: { organizationId: true } } },
    })
    if (!recipient) return NextResponse.json({ error: 'Enlace inválido' }, { status: 404 })

    await suppressEmail(recipient.campaign.organizationId, recipient.email)
    return NextResponse.json({ ok: true, email: recipient.email })
  } catch (error) {
    console.error('[UNSUBSCRIBE POST]', error)
    return NextResponse.json({ error: 'Error al procesar la baja' }, { status: 500 })
  }
}
