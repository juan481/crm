import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, canAccess } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { sanitizeMoneda, clampDiaVencimiento } from '@/lib/servicios-recurrentes'

export const dynamic = 'force-dynamic'

interface Params { params: { id: string } }

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

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!canAccess(payload.role, 'ADMIN')) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const current = await prisma.servicioRecurrente.findFirst({
      where: { id: params.id, organizationId: payload.orgId },
      select: { id: true, contratoInicio: true, contratoFin: true },
    })
    if (!current) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

    const b = await req.json().catch(() => ({}))
    const data: any = {}

    if ('nombre' in b) {
      const n = str(b.nombre)
      if (!n) return NextResponse.json({ error: 'El nombre no puede quedar vacío' }, { status: 400 })
      data.nombre = n
    }
    if ('modoLicencia' in b) data.modoLicencia = MODOS.includes(b.modoLicencia) ? b.modoLicencia : 'NINGUNA'
    if ('incluyeMonitoreo' in b) data.incluyeMonitoreo = b.incluyeMonitoreo === true
    if ('monto' in b) {
      const m = Number(b.monto)
      if (!Number.isFinite(m) || m < 0) return NextResponse.json({ error: 'El monto no es válido' }, { status: 400 })
      data.monto = m
    }
    if ('moneda' in b) data.moneda = sanitizeMoneda(b.moneda)
    if ('ciclo' in b) data.ciclo = CICLOS.includes(b.ciclo) ? b.ciclo : 'MENSUAL'
    if ('diaVencimiento' in b) data.diaVencimiento = clampDiaVencimiento(b.diaVencimiento)
    if ('estado' in b) data.estado = ESTADOS.includes(b.estado) ? b.estado : 'ACTIVO'
    if ('canalIngreso' in b) data.canalIngreso = str(b.canalIngreso) || 'CRM'
    if ('serial' in b) data.serial = str(b.serial) || null
    if ('version' in b) data.version = str(b.version) || null
    if ('puestos' in b) data.puestos = b.puestos === '' || b.puestos == null ? null : Math.max(0, Math.round(Number(b.puestos) || 0))
    if ('notas' in b) data.notas = str(b.notas) || null
    if ('contratoInicio' in b) data.contratoInicio = parseFecha(b.contratoInicio)
    if ('contratoFin' in b) data.contratoFin = parseFecha(b.contratoFin)

    const inicio = 'contratoInicio' in data ? data.contratoInicio : current.contratoInicio
    const fin = 'contratoFin' in data ? data.contratoFin : current.contratoFin
    if (inicio && fin && new Date(fin) < new Date(inicio)) {
      return NextResponse.json({ error: 'El fin de contrato no puede ser anterior al inicio' }, { status: 400 })
    }

    await prisma.servicioRecurrente.update({ where: { id: params.id }, data })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[SERVICIOS-RECURRENTES PATCH]', error)
    return NextResponse.json({ error: 'Error al guardar' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!canAccess(payload.role, 'ADMIN')) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    // Sólo borra si es de la org. Las facturas ya emitidas quedan (el FK es
    // onDelete: SetNull) — borrar el abono no borra la plata ya facturada.
    const res = await prisma.servicioRecurrente.deleteMany({
      where: { id: params.id, organizationId: payload.orgId },
    })
    if (res.count === 0) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[SERVICIOS-RECURRENTES DELETE]', error)
    return NextResponse.json({ error: 'Error al borrar' }, { status: 500 })
  }
}
