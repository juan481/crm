import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const db = prisma as any
    const campaign = await db.emailCampaign.findFirst({
      where:  { id: params.id, organizationId: payload.orgId },
      include: {
        recipients: {
          select: { id: true, email: true, status: true, sentAt: true, error: true },
          orderBy: { email: 'asc' },
        },
      },
    })

    if (!campaign) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

    return NextResponse.json({ data: campaign })
  } catch (error) {
    console.error('[CAMPAIGN GET ID]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
