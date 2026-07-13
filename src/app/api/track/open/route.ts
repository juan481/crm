import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// Transparent 1×1 GIF
const GIF_B64 = 'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
const GIF_BUF = Buffer.from(GIF_B64, 'base64')

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const rid = req.nextUrl.searchParams.get('rid')

  if (rid) {
    try {
      const db = prisma as any
      const rec = await db.campaignRecipient.findFirst({
        where:  { id: rid },
        select: { id: true, campaignId: true, openedAt: true },
      })

      if (rec) {
        const first = !rec.openedAt
        await db.campaignRecipient.update({
          where: { id: rid },
          data:  {
            openedAt:  rec.openedAt ?? new Date(),
            openCount: { increment: 1 },
          },
        })

        if (first) {
          await db.emailCampaign.update({
            where: { id: rec.campaignId },
            data:  { totalOpened: { increment: 1 } },
          })
        }
      }
    } catch { /* silently fail if columns not yet migrated */ }
  }

  return new NextResponse(GIF_BUF, {
    headers: {
      'Content-Type':  'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma':        'no-cache',
    },
  })
}
