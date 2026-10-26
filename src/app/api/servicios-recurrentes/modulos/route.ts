import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { puedeVerServicios } from '@/lib/finance-access'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

// GET /api/servicios-recurrentes/modulos — los módulos/aplicaciones de
// licencias SaaS que ya se cargaron en esta organización, para sugerirlos
// al cargar el próximo (así se escriben siempre igual). Más usados primero.
export async function GET() {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!(await puedeVerServicios(payload.orgId, payload.role))) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const rows = await prisma.servicioRecurrente.findMany({
      where: { organizationId: payload.orgId, NOT: { modulos: { isEmpty: true } } },
      select: { modulos: true },
    })
    const conteo = new Map<string, { nombre: string; n: number }>()
    for (const r of rows) {
      for (const m of r.modulos) {
        const k = m.toLowerCase()
        const prev = conteo.get(k)
        conteo.set(k, { nombre: prev?.nombre ?? m, n: (prev?.n ?? 0) + 1 })
      }
    }
    const data = Array.from(conteo.values()).sort((a, b) => b.n - a.n).map((x) => x.nombre)
    return NextResponse.json({ data })
  } catch (error) {
    console.error('[SERVICIOS-RECURRENTES MODULOS]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
