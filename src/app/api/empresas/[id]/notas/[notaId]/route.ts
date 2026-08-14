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

    // Notas de auditoría: una vez guardada, nadie puede borrarla salvo
    // Super Admin — ni siquiera quien la creó, ni un Admin. Antes se permitía
    // al autor o a cualquier Admin+; cambiado a pedido explícito del cliente
    // ("Deudor", "No vender", etc. no deben poder desaparecer). Sin campo
    // `locked` a propósito: es política pura, no hay opt-in por nota.
    if (!canAccess(payload.role, 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Solo Super Admin puede eliminar notas' }, { status: 403 })
    }

    await db.empresaNota.delete({ where: { id: params.notaId } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[EMPRESA NOTA DELETE]', error)
    return NextResponse.json({ error: 'Error al eliminar nota' }, { status: 500 })
  }
}
