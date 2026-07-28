import { NextRequest, NextResponse } from 'next/server'
import { getPlatformAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await getPlatformAdmin()
    if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { suspended } = await req.json() as { suspended?: boolean }
    if (typeof suspended !== 'boolean') {
      return NextResponse.json({ error: 'Falta el campo suspended' }, { status: 400 })
    }

    const db = prisma as any
    const existing = await db.organization.findUnique({ where: { id: params.id }, select: { id: true } })
    if (!existing) return NextResponse.json({ error: 'Organización no encontrada' }, { status: 404 })

    const org = await db.organization.update({
      where:  { id: params.id },
      data:   { suspended, suspendedAt: suspended ? new Date() : null },
      select: { id: true, suspended: true, suspendedAt: true },
    })

    return NextResponse.json({ data: org })
  } catch (error) {
    console.error('[ADMIN ORGANIZATION PATCH]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
