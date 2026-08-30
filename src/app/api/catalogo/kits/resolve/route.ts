import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, canAccess } from '@/lib/auth'
import { resolveComponents, parsePastedCodes, type ComponentInput } from '@/lib/kits'

export const dynamic = 'force-dynamic'

// Previsualiza los componentes de un KIT antes de guardarlo. Acepta:
//   - { text: "…" }        → parsea el texto que devuelve la IA de cotización
//                            (líneas con código + cantidad) y lo matchea.
//   - { components: [...] } → lista explícita { sku | productId, quantity }.
// Devuelve cada componente resuelto (con nombre y precio) o el motivo por el
// que no matcheó, para que la UI muestre en rojo lo que falta cargar al
// catálogo. NO escribe nada.
export async function POST(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!canAccess(payload.role, 'SELLER')) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const body = await req.json() as { text?: string; components?: ComponentInput[] }
    const inputs: ComponentInput[] = body.components?.length
      ? body.components
      : parsePastedCodes(body.text ?? '')

    if (inputs.length === 0) {
      return NextResponse.json({ data: [], resumen: { total: 0, ok: 0, sinMatch: 0 } })
    }

    const resolved = await resolveComponents(payload.orgId, inputs)
    const ok = resolved.filter((r) => !r.error).length

    return NextResponse.json({
      data: resolved.map((r) => ({
        productId: r.productId,
        name: r.name,
        sku: r.sku,
        price: r.price,
        quantity: r.quantity,
        error: r.error,
      })),
      resumen: { total: resolved.length, ok, sinMatch: resolved.length - ok },
    })
  } catch (error) {
    console.error('[KITS RESOLVE]', error)
    return NextResponse.json({ error: 'Error al resolver componentes' }, { status: 500 })
  }
}
