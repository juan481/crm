import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, canAccess } from '@/lib/auth'
import { puedeVerGastos } from '@/lib/finance-access'
import { prisma } from '@/lib/db'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET ?? 'uploads'

interface Params { params: { id: string } }

// Borrar un gasto (para corregir uno mal cargado: se borra y se vuelve a
// cargar, la carga es de un renglón). Sólo quien lo cargó, o Admin+.
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!(await puedeVerGastos(payload.orgId, payload.role))) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const db = prisma as any
    const gasto = await db.gasto.findFirst({
      where: { id: params.id, organizationId: payload.orgId },
      select: { id: true, creadoPorId: true, comprobantePath: true },
    })
    if (!gasto) return NextResponse.json({ error: 'Gasto no encontrado' }, { status: 404 })
    if (gasto.creadoPorId !== payload.userId && !canAccess(payload.role, 'ADMIN')) {
      return NextResponse.json({ error: 'Sólo quien lo cargó o un administrador puede borrarlo' }, { status: 403 })
    }

    await db.gasto.delete({ where: { id: gasto.id } })
    if (gasto.comprobantePath) {
      try { await createAdminClient().storage.from(BUCKET).remove([gasto.comprobantePath]) } catch (err) { console.error('[GASTO DELETE] storage', err) }
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[GASTO DELETE]', error)
    return NextResponse.json({ error: 'Error al borrar' }, { status: 500 })
  }
}
