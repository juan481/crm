import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { roleHasModule } from '@/lib/module-access'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; cursoId: string } }) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!(await roleHasModule(payload.orgId, payload.role, 'legajos')))
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const db = prisma as any
    const vigilador = await db.vigilador.findFirst({ where: { id: params.id, organizationId: payload.orgId }, select: { id: true } })
    if (!vigilador) return NextResponse.json({ error: 'Legajo no encontrado' }, { status: 404 })

    const result = await db.vigiladorCurso.deleteMany({ where: { id: params.cursoId, vigiladorId: params.id } })
    if (result.count === 0) return NextResponse.json({ error: 'Curso no encontrado' }, { status: 404 })

    return NextResponse.json({ message: 'Curso eliminado' })
  } catch (error) {
    console.error('[LEGAJO CURSO DELETE]', error)
    return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 })
  }
}
