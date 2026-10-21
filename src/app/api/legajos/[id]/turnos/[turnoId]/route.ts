import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { roleHasModule } from '@/lib/module-access'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; turnoId: string } }) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!(await roleHasModule(payload.orgId, payload.role, 'legajos')))
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const db = prisma as any
    const result = await db.vigiladorTurno.deleteMany({
      where: { id: params.turnoId, vigiladorId: params.id, organizationId: payload.orgId },
    })
    if (result.count === 0) return NextResponse.json({ error: 'Turno no encontrado' }, { status: 404 })

    return NextResponse.json({ message: 'Turno eliminado' })
  } catch (error) {
    console.error('[LEGAJO TURNO DELETE]', error)
    return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 })
  }
}
