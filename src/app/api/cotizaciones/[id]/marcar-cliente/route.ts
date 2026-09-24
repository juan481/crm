import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, canAccess } from '@/lib/auth'
import { roleHasModule } from '@/lib/module-access'
import { prisma } from '@/lib/db'
import { marcarClienteAlGanar } from '@/lib/deal-won'

export const dynamic = 'force-dynamic'

// Marcar cliente desde una cotización — pedido de Abba: una cotización de
// consumidor final (sin empresa, ej. "Ramon Escobar") nunca tenía forma de
// llegar a Clientes si no pasaba por un Deal ganado. Reusa el mismo helper
// que dispara al ganar una oportunidad — resuelve el contacto por email si
// la cotización no tiene contactoId propio (Cotizacion no lo guarda,
// se matchea por recipientEmail).
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!canAccess(payload.role, 'SELLER') && !(await roleHasModule(payload.orgId, payload.role, 'cotizaciones')))
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const db = prisma as any
    const cot = await db.cotizacion.findFirst({
      where: {
        id: params.id, organizationId: payload.orgId,
        ...(payload.role === 'SELLER' && { userId: payload.userId }),
      },
      select: { id: true, empresaId: true, recipientEmail: true, recipientName: true, userId: true },
    })
    if (!cot) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

    let contactoId: string | null = null
    if (!cot.empresaId && cot.recipientEmail) {
      const contacto = await db.directorioContacto.findFirst({
        where: { organizationId: payload.orgId, email: { equals: cot.recipientEmail, mode: 'insensitive' } },
        select: { id: true },
      })
      contactoId = contacto?.id ?? null
    }

    if (!cot.empresaId && !contactoId) {
      return NextResponse.json({ error: 'Esta cotización no tiene empresa ni contacto vinculado — no hay a quién marcar como cliente.' }, { status: 400 })
    }

    const cliente = await marcarClienteAlGanar(db, { id: cot.id, empresaId: cot.empresaId, contactoId, ownerId: cot.userId }, payload.orgId)
    if (!cliente) {
      return NextResponse.json({ error: 'No se pudo determinar el cliente (falta un nombre real en el contacto).' }, { status: 400 })
    }

    // Deja la cotización vinculada a la Empresa que se acaba de marcar
    // cliente — igual criterio que marcarClienteAlGanar con un Deal.
    if (!cot.empresaId) {
      await db.cotizacion.update({ where: { id: cot.id }, data: { empresaId: cliente.empresaId } })
    }

    return NextResponse.json({ ok: true, cliente })
  } catch (error) {
    console.error('[COTIZACION MARCAR-CLIENTE]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
