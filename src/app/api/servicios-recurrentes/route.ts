import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, canAccess } from '@/lib/auth'
import { prisma } from '@/lib/db'
import {
  montoMensualizado, sanitizeMoneda, clampDiaVencimiento, diasHastaFin,
  CICLO_LABEL, type Ciclo,
} from '@/lib/servicios-recurrentes'
import { argentinaDayStart } from '@/lib/timezone'

export const dynamic = 'force-dynamic'

const CICLOS = ['MENSUAL', 'TRIMESTRAL', 'SEMESTRAL', 'ANUAL', 'UNICO']
const ESTADOS = ['ACTIVO', 'PAUSADO', 'BAJA']
const MODOS = ['SAAS', 'PERPETUA', 'NINGUNA']

function str(v: unknown): string { return typeof v === 'string' ? v.trim() : '' }
function parseFecha(v: unknown): Date | null {
  const s = str(v)
  if (!s) return null
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d
}

export async function GET(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!canAccess(payload.role, 'ADMIN')) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const sp = req.nextUrl.searchParams
    const empresaId = str(sp.get('empresaId'))
    const estado = str(sp.get('estado'))
    const canal = str(sp.get('canal'))
    const moneda = str(sp.get('moneda'))
    const monitoreo = sp.get('monitoreo') // 'true' | 'false' | null
    const q = str(sp.get('q')).toLowerCase()

    const where: any = { organizationId: payload.orgId }
    if (empresaId) where.empresaId = empresaId
    if (ESTADOS.includes(estado)) where.estado = estado
    if (canal) where.canalIngreso = canal
    if (moneda) where.moneda = moneda.toUpperCase()
    if (monitoreo === 'true') where.incluyeMonitoreo = true
    if (monitoreo === 'false') where.incluyeMonitoreo = false

    const rows = await prisma.servicioRecurrente.findMany({
      where,
      orderBy: [{ estado: 'asc' }, { createdAt: 'desc' }],
      select: {
        id: true, nombre: true, modoLicencia: true, incluyeMonitoreo: true,
        monto: true, moneda: true, ciclo: true, diaVencimiento: true,
        contratoInicio: true, contratoFin: true, estado: true, canalIngreso: true,
        serial: true, version: true, puestos: true, notas: true,
        createdAt: true, updatedAt: true,
        empresa: { select: { id: true, name: true, isCliente: true } },
      },
    })

    const hoy = argentinaDayStart()
    const data = rows
      .filter((r) => !q || r.nombre.toLowerCase().includes(q) || r.empresa.name.toLowerCase().includes(q))
      .map((r) => ({
        ...r,
        cicloLabel: CICLO_LABEL[r.ciclo as Ciclo] ?? r.ciclo,
        diasHastaFin: diasHastaFin(r.contratoFin, hoy),
      }))

    // ── KPIs (sobre TODOS los abonos de la org, sin importar los filtros de
    // la tabla, para que el panel de arriba sea estable) ──────────────────
    const todos = await prisma.servicioRecurrente.findMany({
      where: { organizationId: payload.orgId },
      select: { monto: true, ciclo: true, estado: true, moneda: true, incluyeMonitoreo: true, canalIngreso: true, contratoFin: true },
    })
    const activos = todos.filter((t) => t.estado === 'ACTIVO')
    const mrrPorMoneda: Record<string, number> = {}
    for (const a of activos) {
      const m = montoMensualizado(a as any)
      if (m > 0) mrrPorMoneda[a.moneda] = (mrrPorMoneda[a.moneda] ?? 0) + m
    }
    const arrPorMoneda: Record<string, number> = {}
    for (const [cur, v] of Object.entries(mrrPorMoneda)) arrPorMoneda[cur] = v * 12

    const porCanal: Record<string, number> = {}
    for (const a of activos) porCanal[a.canalIngreso] = (porCanal[a.canalIngreso] ?? 0) + 1

    const renov = { d30: 0, d60: 0, d90: 0 }
    for (const a of activos) {
      const d = diasHastaFin(a.contratoFin, hoy)
      if (d === null || d < 0) continue
      if (d <= 30) renov.d30++
      else if (d <= 60) renov.d60++
      else if (d <= 90) renov.d90++
    }

    return NextResponse.json({
      data,
      kpis: {
        total: todos.length,
        activos: activos.length,
        conMonitoreo: activos.filter((a) => a.incluyeMonitoreo).length,
        mrrPorMoneda,
        arrPorMoneda,
        porCanal,
        renovaciones: renov,
      },
    })
  } catch (error) {
    console.error('[SERVICIOS-RECURRENTES GET]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!canAccess(payload.role, 'ADMIN')) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const b = await req.json().catch(() => ({}))

    const empresaId = str(b.empresaId)
    if (!empresaId) return NextResponse.json({ error: 'Falta la empresa' }, { status: 400 })
    const empresa = await prisma.empresa.findFirst({
      where: { id: empresaId, organizationId: payload.orgId },
      select: { id: true },
    })
    if (!empresa) return NextResponse.json({ error: 'Empresa no encontrada' }, { status: 404 })

    const nombre = str(b.nombre)
    if (!nombre) return NextResponse.json({ error: 'Poné un nombre para el servicio' }, { status: 400 })

    const monto = Number(b.monto)
    if (!Number.isFinite(monto) || monto < 0) return NextResponse.json({ error: 'El monto no es válido' }, { status: 400 })

    const contratoInicio = parseFecha(b.contratoInicio)
    const contratoFin = parseFecha(b.contratoFin)
    if (contratoInicio && contratoFin && contratoFin < contratoInicio) {
      return NextResponse.json({ error: 'El fin de contrato no puede ser anterior al inicio' }, { status: 400 })
    }

    const puestos = b.puestos === '' || b.puestos == null ? null : Math.max(0, Math.round(Number(b.puestos) || 0))

    const row = await prisma.servicioRecurrente.create({
      data: {
        organizationId: payload.orgId,
        empresaId,
        nombre,
        modoLicencia: MODOS.includes(b.modoLicencia) ? b.modoLicencia : 'NINGUNA',
        incluyeMonitoreo: b.incluyeMonitoreo === true,
        monto,
        moneda: sanitizeMoneda(b.moneda),
        ciclo: CICLOS.includes(b.ciclo) ? b.ciclo : 'MENSUAL',
        diaVencimiento: clampDiaVencimiento(b.diaVencimiento),
        contratoInicio,
        contratoFin,
        estado: ESTADOS.includes(b.estado) ? b.estado : 'ACTIVO',
        canalIngreso: str(b.canalIngreso) || 'CRM',
        serial: str(b.serial) || null,
        version: str(b.version) || null,
        puestos,
        notas: str(b.notas) || null,
      },
    })

    return NextResponse.json({ data: row }, { status: 201 })
  } catch (error) {
    console.error('[SERVICIOS-RECURRENTES POST]', error)
    return NextResponse.json({ error: 'Error al crear el servicio' }, { status: 500 })
  }
}
