import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'

const MAX_SIZE = 30 * 1024 * 1024 // 30MB
const ALLOWED_TYPES = [
  'image/jpeg', 'image/png',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
]

export async function POST(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const folderId = formData.get('folderId') as string | null
    const clientId = formData.get('clientId') as string | null
    const tagsRaw = formData.get('tags') as string | null
    const tags = tagsRaw ? JSON.parse(tagsRaw) : []

    if (!file) return NextResponse.json({ error: 'No se recibió archivo' }, { status: 400 })
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Formato no permitido. Use JPG, PNG, PDF, DOCX o TXT' }, { status: 400 })
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'El archivo supera el límite de 30MB' }, { status: 400 })
    }

    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin'
    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const uploadDir = join(process.cwd(), 'public', 'uploads', payload.orgId)

    await mkdir(uploadDir, { recursive: true })
    const buffer = Buffer.from(await file.arrayBuffer())
    await writeFile(join(uploadDir, safeName), buffer)

    const url = `/uploads/${payload.orgId}/${safeName}`

    const document = await prisma.document.create({
      data: {
        name: file.name.replace(`.${ext}`, ''),
        originalName: file.name,
        mimeType: file.type,
        size: file.size,
        url,
        folderId: folderId || null,
        clientId: clientId || null,
        organizationId: payload.orgId,
        tags: JSON.stringify(tags),
        uploadedById: payload.userId,
      },
      include: { uploadedBy: { select: { name: true } } },
    })

    if (clientId) {
      await prisma.activityLog.create({
        data: {
          clientId,
          userId: payload.userId,
          action: 'DOCUMENT_UPLOADED',
          description: `Documento "${file.name}" subido`,
        },
      })
    }

    return NextResponse.json({ data: { ...document, tags } }, { status: 201 })
  } catch (error) {
    console.error('[DOC UPLOAD]', error)
    return NextResponse.json({ error: 'Error al subir archivo' }, { status: 500 })
  }
}
