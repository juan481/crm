import { NextResponse } from 'next/server'
import { getCurrentUser, canAccess } from '@/lib/auth'
import { prisma } from '@/lib/db'

interface Params { params: { id: string } }

// Walks the supersedesId chain back from the given document to its root,
// returning the full version history (newest first).
export async function GET(_: Request, { params }: Params) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!canAccess(payload.role, 'SELLER')) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const chain: Array<{ id: string; originalName: string; version: number; url: string; createdAt: Date; uploadedBy: { name: string } | null }> = []
    let cursorId: string | null = params.id

    for (let i = 0; i < 50 && cursorId; i++) {
      const doc: any = await prisma.document.findFirst({
        where: { id: cursorId, organizationId: payload.orgId },
        select: {
          id: true, originalName: true, version: true, url: true, createdAt: true, supersedesId: true,
          uploadedBy: { select: { name: true } },
        },
      })
      if (!doc) break
      chain.push(doc)
      cursorId = doc.supersedesId
    }

    return NextResponse.json({ data: chain })
  } catch (error) {
    console.error('[DOC VERSIONS GET]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
