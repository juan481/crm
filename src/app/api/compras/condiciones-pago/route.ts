import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { puedeVerCompras } from '@/lib/stock-access'
import { CONDICIONES_PAGO } from '@/lib/solicitudes-compra'
import type { Role } from '@/types'

export const dynamic = 'force-dynamic'

// Condiciones de pago del pedido a proveedor, editables por organización
// (Seba, 29/10). Organization.condicionesPago vacío = la lista de siempre.
export async function GET() {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!(await puedeVerCompras(payload.orgId, payload.role as Role))) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    const org = await prisma.organization.findUnique({ where: { id: payload.orgId }, select: { condicionesPago: true } })
    const lista = org?.condicionesPago?.length ? org.condicionesPago : CONDICIONES_PAGO
    return NextResponse.json({ data: lista })
  } catch (error) {
    console.error('[CONDICIONES PAGO GET]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// PUT { condiciones: string[] } — reemplaza la lista entera. Los pedidos
// ya cargados no cambian (la condición se guarda como texto en cada uno).
export async function PUT(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!(await puedeVerCompras(payload.orgId, payload.role as Role))) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    const b = await req.json().catch(() => ({}))
    const raw: unknown[] = Array.isArray(b.condiciones) ? b.condiciones : []
    const condiciones: string[] = []
    for (const c of raw) {
      const s = typeof c === 'string' ? c.trim().slice(0, 60) : ''
      if (s && s.toLowerCase() !== 'otra' && !condiciones.some((x) => x.toLowerCase() === s.toLowerCase())) condiciones.push(s)
    }
    if (condiciones.length === 0) return NextResponse.json({ error: 'Dejá al menos una condición' }, { status: 400 })
    await prisma.organization.update({ where: { id: payload.orgId }, data: { condicionesPago: condiciones.slice(0, 30) } })
    return NextResponse.json({ data: condiciones.slice(0, 30) })
  } catch (error) {
    console.error('[CONDICIONES PAGO PUT]', error)
    return NextResponse.json({ error: 'Error al guardar' }, { status: 500 })
  }
}
