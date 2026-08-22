import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { computeTopActions } from '@/lib/quick-actions'

export const dynamic = 'force-dynamic'

// Devuelve hasta 4 actionKeys ya ordenados y listos para renderizar — el
// cliente (mobile-quick-bar.tsx) sólo tiene que mapear cada key a su
// ícono/label/href, nunca recalcula el ranking él mismo.
export async function GET() {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const db = prisma as any
    const usage = await db.quickActionUsage.findMany({
      where: { userId: payload.userId, organizationId: payload.orgId },
      select: { actionKey: true, count: true, lastUsedAt: true },
    })

    const data = computeTopActions(payload.role, usage)
    return NextResponse.json({ data })
  } catch (error) {
    console.error('[QUICK ACTIONS TOP]', error)
    return NextResponse.json({ data: [] })
  }
}
