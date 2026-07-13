import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, canAccess } from '@/lib/auth'
import { prisma } from '@/lib/db'

interface Params { params: { id: string; notaId: string } }

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const db = prisma as any

    const nota = await db.empresaNota.findFirst({
      where: { id: params.notaId, empresaId: params.id, organizationId: payload.orgId },
      select: { id: true, userId: true },
    })
    if (!nota) return NextResponse.json({ error: 'Nota no encontrada' }, { status: 404 })

    if (nota.userId !== payload.userId && !canAccess(payload.role, 'ADMIN')) {
      return NextResponse.json({ error: 'Solo podés eliminar tus propias notas' }, { status: 403 })
    }

    await db.empresaNota.delete({ where: { id: params.notaId } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[EMPRESA NOTA DELETE]', error)
    return NextResponse.json({ error: 'Error al eliminar nota' }, { status: 500 })
  }
}
