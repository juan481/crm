import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, canAccess } from '@/lib/auth'
import { prisma } from '@/lib/db'

interface Params { params: { id: string; notaId: string } }

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const db = prisma as any

    const nota = await db.directorioContactoNota.findFirst({
      where: { id: params.notaId, contactoId: params.id, organizationId: payload.orgId },
      select: { id: true, userId: true },
    })
    if (!nota) return NextResponse.json({ error: 'Nota no encontrada' }, { status: 404 })

    // Notas de auditoría: sólo Super Admin puede borrarlas — ver el mismo
    // cambio y comentario en api/empresas/[id]/notas/[notaId]/route.ts.
    if (!canAccess(payload.role, 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Solo Super Admin puede eliminar notas' }, { status: 403 })
    }

    await db.directorioContactoNota.delete({ where: { id: params.notaId } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[CONTACTO NOTA DELETE]', error)
    return NextResponse.json({ error: 'Error al eliminar nota' }, { status: 500 })
  }
}
