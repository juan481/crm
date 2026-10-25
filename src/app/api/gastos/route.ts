import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { puedeVerGastos } from '@/lib/finance-access'
import { prisma } from '@/lib/db'
import { createAdminClient } from '@/lib/supabase/admin'
import { argentinaDayKey, argentinaDateKeyToDayStart } from '@/lib/timezone'
import { MEDIOS_PAGO_GASTO, MONEDAS_GASTO } from '@/lib/gastos'

export const dynamic = 'force-dynamic'

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET ?? 'uploads'
const MAX_SIZE = 10 * 1024 * 1024
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']
const MES_RE = /^\d{4}-(0[1-9]|1[0-2])$/
const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/

function str(v: unknown): string { return typeof v === 'string' ? v.trim() : '' }

function rangoMes(mes: string): { gte: Date; lt: Date } {
  const [y, m] = mes.split('-').map(Number)
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`
  return { gte: argentinaDateKeyToDayStart(`${mes}-01`), lt: argentinaDateKeyToDayStart(`${next}-01`) }
}

// GET /api/gastos?mes=YYYY-MM — los gastos del mes (default: el mes en curso
// en Argentina) + totales + la lista de proveedores con lo último que se les
// cargó (para autocompletar categoría/medio de pago en la próxima carga —
// "que después de la primera carga ya quede registrado", pedido de Seba).
export async function GET(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!(await puedeVerGastos(payload.orgId, payload.role))) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const mesParam = str(req.nextUrl.searchParams.get('mes'))
    const mes = MES_RE.test(mesParam) ? mesParam : argentinaDayKey().slice(0, 7)
    const db = prisma as any

    const [gastos, proveedores, ultimos] = await Promise.all([
      db.gasto.findMany({
        where: { organizationId: payload.orgId, fecha: rangoMes(mes) },
        orderBy: [{ fecha: 'desc' }, { createdAt: 'desc' }],
        select: {
          id: true, fecha: true, categoria: true, concepto: true, monto: true, moneda: true, medioPago: true,
          comprobanteUrl: true, createdAt: true, creadoPorId: true,
          proveedor: { select: { id: true, name: true } },
          creadoPor: { select: { name: true } },
        },
      }),
      db.empresa.findMany({
        where: { organizationId: payload.orgId, esProveedor: true },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
        take: 1000,
      }),
      // Último gasto de cada proveedor — de ahí sale el autocompletado.
      db.gasto.findMany({
        where: { organizationId: payload.orgId, proveedorId: { not: null } },
        orderBy: { createdAt: 'desc' },
        distinct: ['proveedorId'],
        select: { proveedorId: true, categoria: true, medioPago: true, moneda: true },
        take: 1000,
      }),
    ])

    const ultimoPorProveedor = new Map(ultimos.map((u: any) => [u.proveedorId, u]))
    const porMoneda: Record<string, number> = {}
    const porCategoria: Record<string, Record<string, number>> = {}
    for (const g of gastos) {
      porMoneda[g.moneda] = (porMoneda[g.moneda] ?? 0) + g.monto
      porCategoria[g.categoria] ??= {}
      porCategoria[g.categoria][g.moneda] = (porCategoria[g.categoria][g.moneda] ?? 0) + g.monto
    }

    return NextResponse.json({
      mes,
      data: gastos.map((g: any) => ({ ...g, fecha: g.fecha.toISOString().slice(0, 10) })),
      totales: { porMoneda, porCategoria },
      proveedores: proveedores.map((p: any) => {
        const u: any = ultimoPorProveedor.get(p.id)
        return { id: p.id, name: p.name, ultimaCategoria: u?.categoria ?? null, ultimoMedioPago: u?.medioPago ?? null, ultimaMoneda: u?.moneda ?? null }
      }),
    })
  } catch (error) {
    console.error('[GASTOS GET]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// POST /api/gastos — multipart (para poder mandar la foto del ticket en el
// mismo envío). Proveedor: proveedorId de uno existente, o proveedorNombre
// tipeado — si no existe se crea como Empresa proveedora (queda en
// /proveedores para la próxima); si existe como empresa pero no estaba
// marcada como proveedor, se la marca.
export async function POST(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!(await puedeVerGastos(payload.orgId, payload.role))) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const fd = await req.formData()
    const fecha = str(fd.get('fecha'))
    const categoria = str(fd.get('categoria'))
    const concepto = str(fd.get('concepto')) || null
    const monto = Number(str(fd.get('monto')).replace(',', '.'))
    const moneda = (MONEDAS_GASTO as readonly string[]).includes(str(fd.get('moneda'))) ? str(fd.get('moneda')) : 'ARS'
    const medioRaw = str(fd.get('medioPago'))
    const medioPago = MEDIOS_PAGO_GASTO.some((m) => m.value === medioRaw) ? medioRaw : null
    const proveedorIdIn = str(fd.get('proveedorId'))
    const proveedorNombre = str(fd.get('proveedorNombre'))
    const file = fd.get('comprobante') as File | null

    if (!FECHA_RE.test(fecha)) return NextResponse.json({ error: 'Fecha inválida' }, { status: 400 })
    if (fecha > argentinaDayKey()) return NextResponse.json({ error: 'La fecha no puede ser futura' }, { status: 400 })
    if (!categoria) return NextResponse.json({ error: 'Elegí una categoría' }, { status: 400 })
    if (!Number.isFinite(monto) || monto <= 0) return NextResponse.json({ error: 'Poné el monto (mayor a 0)' }, { status: 400 })
    if (file && file.size > 0) {
      if (!ALLOWED_TYPES.includes(file.type)) return NextResponse.json({ error: 'El comprobante tiene que ser una foto (JPG/PNG) o un PDF' }, { status: 400 })
      if (file.size > MAX_SIZE) return NextResponse.json({ error: 'El comprobante supera los 10MB' }, { status: 400 })
    }

    const db = prisma as any
    let proveedorId: string | null = null
    if (proveedorIdIn) {
      const p = await db.empresa.findFirst({ where: { id: proveedorIdIn, organizationId: payload.orgId }, select: { id: true, esProveedor: true } })
      if (!p) return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 400 })
      if (!p.esProveedor) await db.empresa.update({ where: { id: p.id }, data: { esProveedor: true } })
      proveedorId = p.id
    } else if (proveedorNombre) {
      const existente = await db.empresa.findFirst({
        where: { organizationId: payload.orgId, name: { equals: proveedorNombre, mode: 'insensitive' } },
        select: { id: true, esProveedor: true },
      })
      if (existente) {
        if (!existente.esProveedor) await db.empresa.update({ where: { id: existente.id }, data: { esProveedor: true } })
        proveedorId = existente.id
      } else {
        const nuevo = await db.empresa.create({ data: { name: proveedorNombre, organizationId: payload.orgId, esProveedor: true }, select: { id: true } })
        proveedorId = nuevo.id
      }
    }

    let comprobanteUrl: string | null = null
    let comprobantePath: string | null = null
    if (file && file.size > 0) {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin'
      comprobantePath = `gastos/${payload.orgId}/${fecha.slice(0, 7)}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const supabase = createAdminClient()
      const { error } = await supabase.storage.from(BUCKET).upload(comprobantePath, Buffer.from(await file.arrayBuffer()), { contentType: file.type })
      if (error) {
        console.error('[GASTOS POST] upload', error)
        return NextResponse.json({ error: `No se pudo subir el comprobante: ${error.message}` }, { status: 500 })
      }
      comprobanteUrl = supabase.storage.from(BUCKET).getPublicUrl(comprobantePath).data.publicUrl
    }

    const gasto = await db.gasto.create({
      data: {
        organizationId: payload.orgId, fecha: argentinaDateKeyToDayStart(fecha), proveedorId,
        categoria, concepto, monto, moneda, medioPago, comprobanteUrl, comprobantePath, creadoPorId: payload.userId,
      },
      select: { id: true },
    })

    return NextResponse.json({ data: gasto, proveedorId }, { status: 201 })
  } catch (error) {
    console.error('[GASTOS POST]', error)
    return NextResponse.json({ error: 'Error al guardar el gasto' }, { status: 500 })
  }
}
