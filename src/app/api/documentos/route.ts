import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

function parseJsonArray(raw: string): string[] {
  try { return JSON.parse(raw) } catch { return [] }
}

export async function GET(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { searchParams } = req.nextUrl
    const folderId = searchParams.get('folderId') ?? null
    const clientId = searchParams.get('clientId') ?? null

    const [folders, documents] = await Promise.all([
      prisma.folder.findMany({
        where: {
          organizationId: payload.orgId,
          parentId: folderId,
          ...(clientId && { clientId }),
        },
        include: { _count: { select: { documents: true, children: true } } },
        orderBy: { name: 'asc' },
      }),
      prisma.document.findMany({
        where: {
          organizationId: payload.orgId,
          folderId,
          ...(clientId && { clientId }),
        },
        include: { uploadedBy: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
      }),
    ])

    const docsWithTags = documents.map((d) => ({ ...d, tags: parseJsonArray(d.tags) }))

    return NextResponse.json({ data: { folders, documents: docsWithTags } })
  } catch (error) {
    console.error('[DOCS GET]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { name, parentId, clientId } = await req.json()
    if (!name?.trim()) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 })

    const folder = await prisma.folder.create({
      data: {
        name: name.trim(),
        parentId: parentId || null,
        clientId: clientId || null,
        organizationId: payload.orgId,
      },
      include: { _count: { select: { documents: true, children: true } } },
    })

    return NextResponse.json({ data: folder }, { status: 201 })
  } catch (error) {
    console.error('[FOLDER POST]', error)
    return NextResponse.json({ error: 'Error al crear carpeta' }, { status: 500 })
  }
}
