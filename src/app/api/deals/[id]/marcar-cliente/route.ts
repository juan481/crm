import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, canAccess } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { sellerOwnerScope } from '@/lib/deal-access'
import { marcarClienteAlGanar } from '@/lib/deal-won'

interface Params { params: { id: string } }

// Marcar cliente A MANO, sin esperar a "Ganado" — pedido de Abba: a veces
// ya saben que alguien es cliente (o quieren cargarlo así) antes de cerrar
// la venta puntual que están viendo en el Pipeline. Reusa el mismo helper
// que dispara solo al ganar (marcarClienteAlGanar) — misma lógica de
// empresa/contacto/consumidor final, mismo resultado.
export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!canAccess(payload.role, 'SELLER'))
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const ownerScope = payload.role === 'SELLER' ? await sellerOwnerScope(payload.userId) : {}
    const deal = await prisma.deal.findFirst({
      where: { id: params.id, organizationId: payload.orgId, ...ownerScope },
      select: { id: true, empresaId: true, contactoId: true, ownerId: true },
    })
    if (!deal) return NextResponse.json({ error: 'Deal no encontrado' }, { status: 404 })

    if (!deal.empresaId && !deal.contactoId) {
      return NextResponse.json({ error: 'Esta oportunidad no tiene empresa ni contacto vinculado — no hay a quién marcar como cliente.' }, { status: 400 })
    }

    const db = prisma as any
    const cliente = await marcarClienteAlGanar(db, deal, payload.orgId)
    if (!cliente) {
      return NextResponse.json({ error: 'No se pudo determinar el cliente (falta un nombre real en el contacto).' }, { status: 400 })
    }

    return NextResponse.json({ ok: true, cliente })
  } catch (error) {
    console.error('[DEAL MARCAR-CLIENTE]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
