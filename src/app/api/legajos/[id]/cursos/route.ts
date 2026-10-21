import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { roleHasModule } from '@/lib/module-access'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

interface Params { params: { id: string } }

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!(await roleHasModule(payload.orgId, payload.role, 'legajos')))
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const db = prisma as any
    const vigilador = await db.vigilador.findFirst({ where: { id: params.id, organizationId: payload.orgId }, select: { id: true } })
    if (!vigilador) return NextResponse.json({ error: 'Legajo no encontrado' }, { status: 404 })

    const { nombre, fecha } = await req.json()
    if (!nombre?.trim()) return NextResponse.json({ error: 'El nombre del curso es requerido' }, { status: 400 })

    const curso = await db.vigiladorCurso.create({
      data: { vigiladorId: params.id, nombre: nombre.trim(), fecha: fecha ? new Date(fecha) : null },
    })

    return NextResponse.json({ data: curso }, { status: 201 })
  } catch (error) {
    console.error('[LEGAJO CURSOS POST]', error)
    return NextResponse.json({ error: 'Error al guardar el curso' }, { status: 500 })
  }
}
