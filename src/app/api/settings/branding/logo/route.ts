import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'

export async function POST(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (payload.role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const formData = await req.formData()
    const file = formData.get('logo') as File | null

    if (!file) return NextResponse.json({ error: 'No se recibió archivo' }, { status: 400 })

    const validTypes = ['image/jpeg', 'image/png', 'image/svg+xml', 'image/webp']
    if (!validTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Formato no válido. Use PNG, JPG o SVG' }, { status: 400 })
    }

    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: 'El archivo debe ser menor a 2MB' }, { status: 400 })
    }

    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'png'
    const fileName = `logo-${payload.orgId}-${Date.now()}.${ext}`
    const uploadDir = join(process.cwd(), 'public', 'uploads', 'logos')

    await mkdir(uploadDir, { recursive: true })
    const buffer = Buffer.from(await file.arrayBuffer())
    await writeFile(join(uploadDir, fileName), buffer)

    const logoUrl = `/uploads/logos/${fileName}`

    await prisma.organization.update({
      where: { id: payload.orgId },
      data: { logoUrl },
    })

    return NextResponse.json({ data: { logoUrl } })
  } catch (error) {
    console.error('[LOGO UPLOAD]', error)
    return NextResponse.json({ error: 'Error al subir logo' }, { status: 500 })
  }
}
