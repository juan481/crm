import { NextResponse } from 'next/server'
import { getCurrentUser, canAccess } from '@/lib/auth'
import { prisma } from '@/lib/db'

// Aggregates the distinct set of tags already used anywhere in the org, so
// the tag editor can suggest existing ones instead of everyone inventing
// their own spelling of the same category.
export async function GET() {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!canAccess(payload.role, 'SELLER')) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const docs = await prisma.document.findMany({
      where: { organizationId: payload.orgId, tags: { not: '[]' } },
      select: { tags: true },
    })

    const tagSet = new Set<string>()
    for (const doc of docs) {
      try {
        const parsed = JSON.parse(doc.tags) as string[]
        parsed.forEach((t) => { if (t?.trim()) tagSet.add(t.trim()) })
      } catch { /* skip malformed */ }
    }

    return NextResponse.json({ data: Array.from(tagSet).sort() })
  } catch (error) {
    console.error('[DOC TAGS GET]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
