import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { puedeVerServicios } from '@/lib/finance-access'
import { prisma } from '@/lib/db'
import { sanitizeMoneda, sumarMesesDateKey } from '@/lib/servicios-recurrentes'
import { argentinaDayKey, argentinaDateKeyToDayStart } from '@/lib/timezone'

export const dynamic = 'force-dynamic'

function str(v: unknown): string { return typeof v === 'string' ? v.trim() : '' }

const CADA_MESES_VALIDOS = [3, 6, 12]

// ARS se redondea a pesos enteros (nadie cobra $36.207,48 de abono); el
// resto a centavos.
function redondear(monto: number, moneda: string): number {
  return moneda === 'ARS' ? Math.round(monto) : Math.round(monto * 100) / 100
}

// Ajuste de precio en masa — el pedido de Abba: el abono se actualiza
// trimestralmente y el monto tiene que poder cambiarse una sola vez para
// TODOS los clientes que ya tienen ese mismo servicio activo, en vez de
// editar cada ServicioRecurrente uno por uno. Se agrupa por nombre+moneda
// (mismo criterio que el MRR del endpoint GET) y sólo toca los ACTIVO — un
// abono PAUSADO/BAJA no se toca (no está cobrando, no corresponde re-precio).
//
// body.modo (22/10, Seba: "que me deje poner el % del IPC y suba, y a los
// tres meses de nuevo"):
//  - 'porcentaje': cada abono sube su PROPIO monto en ese % (respeta a los
//    clientes que pagan distinto, a diferencia de pisar todos con un monto).
//  - 'monto': todos quedan con el mismo monto (comportamiento original;
//    default si no viene modo, para no romper llamadas viejas).
//  - 'solo_aviso': no toca precios, sólo programa cuándo avisar.
// body.avisoCadaMeses: 3 | 6 | 12 → programa (o corre) el próximo aviso
// (AjusteAbono) a hoy + N meses; 0 → borra el aviso; ausente → no lo toca.
// body.actualizarCatalogo: también actualiza el precio del Servicio del
// catálogo con el mismo nombre+moneda (así los abonos nuevos salen ya con
// el precio ajustado).
export async function POST(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!(await puedeVerServicios(payload.orgId, payload.role))) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const b = await req.json().catch(() => ({}))
    const nombre = str(b.nombre)
    if (!nombre) return NextResponse.json({ error: 'Falta el nombre del servicio' }, { status: 400 })
    const moneda = sanitizeMoneda(b.moneda)
    const modo = b.modo === 'porcentaje' || b.modo === 'solo_aviso' ? b.modo : 'monto'

    const monto = Number(b.monto)
    const porcentaje = Number(b.porcentaje)
    if (modo === 'monto' && (!Number.isFinite(monto) || monto <= 0)) {
      return NextResponse.json({ error: 'El monto no es válido' }, { status: 400 })
    }
    if (modo === 'porcentaje' && (!Number.isFinite(porcentaje) || porcentaje === 0 || porcentaje <= -90 || porcentaje > 300)) {
      return NextResponse.json({ error: 'El porcentaje no es válido (ej: 8,5 para subir un 8,5%)' }, { status: 400 })
    }

    const avisoRaw = b.avisoCadaMeses
    const avisoCadaMeses = avisoRaw === undefined || avisoRaw === null ? null : Number(avisoRaw)
    if (avisoCadaMeses !== null && avisoCadaMeses !== 0 && !CADA_MESES_VALIDOS.includes(avisoCadaMeses)) {
      return NextResponse.json({ error: 'El aviso tiene que ser cada 3, 6 o 12 meses' }, { status: 400 })
    }
    if (modo === 'solo_aviso' && !avisoCadaMeses) {
      return NextResponse.json({ error: 'Elegí cada cuántos meses avisar' }, { status: 400 })
    }

    const where = { organizationId: payload.orgId, nombre, moneda, estado: 'ACTIVO' as const }
    const abonos = await prisma.servicioRecurrente.findMany({ where, select: { id: true, monto: true } })
    if (abonos.length === 0 && modo !== 'solo_aviso') {
      return NextResponse.json({ error: `No hay ningún abono activo llamado "${nombre}" en ${moneda}.` }, { status: 404 })
    }

    const factor = 1 + porcentaje / 100
    const catalogoWhere = { organizationId: payload.orgId, name: { equals: nombre, mode: 'insensitive' as const }, currency: moneda }
    const catalogo = b.actualizarCatalogo === true && modo !== 'solo_aviso'
      ? await prisma.service.findMany({ where: catalogoWhere, select: { id: true, price: true } })
      : []

    const hoyKey = argentinaDayKey()
    const aplicoPrecio = modo !== 'solo_aviso'
    // Si se aplica un ajuste que ya estaba vencido, el próximo se cuenta
    // desde la fecha que TOCABA, no desde hoy — así un trimestral queda
    // anclado (ene/abr/jul/oct) aunque lo apliquen unos días tarde.
    let proximoKey: string | null = null
    if (avisoCadaMeses) {
      const existente = await prisma.ajusteAbono.findUnique({
        where: { organizationId_nombre_moneda: { organizationId: payload.orgId, nombre, moneda } },
        select: { proximoAjuste: true },
      })
      const previo = existente?.proximoAjuste.toISOString().slice(0, 10)
      const base = aplicoPrecio && previo && previo <= hoyKey ? previo : hoyKey
      proximoKey = sumarMesesDateKey(base, avisoCadaMeses)
      while (proximoKey <= hoyKey) proximoKey = sumarMesesDateKey(proximoKey, avisoCadaMeses)
    }

    const ops = [
      ...(modo === 'monto' ? [prisma.servicioRecurrente.updateMany({ where, data: { monto } })] : []),
      ...(modo === 'porcentaje'
        ? abonos.map((a) => prisma.servicioRecurrente.update({ where: { id: a.id }, data: { monto: redondear(a.monto * factor, moneda) } }))
        : []),
      ...catalogo.map((s) => prisma.service.update({
        where: { id: s.id },
        data: { price: modo === 'porcentaje' ? redondear(s.price * factor, moneda) : monto },
      })),
      ...(avisoCadaMeses
        ? [prisma.ajusteAbono.upsert({
            where: { organizationId_nombre_moneda: { organizationId: payload.orgId, nombre, moneda } },
            create: {
              organizationId: payload.orgId, nombre, moneda, cadaMeses: avisoCadaMeses,
              proximoAjuste: argentinaDateKeyToDayStart(proximoKey!),
              ...(aplicoPrecio ? { ultimoAjusteAt: new Date(), ultimoAjustePct: modo === 'porcentaje' ? porcentaje : null } : {}),
            },
            update: {
              cadaMeses: avisoCadaMeses,
              proximoAjuste: argentinaDateKeyToDayStart(proximoKey!),
              ...(aplicoPrecio ? { ultimoAjusteAt: new Date(), ultimoAjustePct: modo === 'porcentaje' ? porcentaje : null } : {}),
            },
          })]
        : []),
      ...(avisoCadaMeses === 0
        ? [prisma.ajusteAbono.deleteMany({ where: { organizationId: payload.orgId, nombre, moneda } })]
        : []),
    ]
    await prisma.$transaction(ops)

    return NextResponse.json({
      ok: true,
      updated: aplicoPrecio ? abonos.length : 0,
      catalogoActualizado: catalogo.length,
      proximoAjuste: proximoKey,
    })
  } catch (error) {
    console.error('[SERVICIOS-RECURRENTES BULK-UPDATE]', error)
    return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 })
  }
}
