import { prisma } from '@/lib/db'
import { argentinaDayStart, dateOnlyArgentina } from '@/lib/timezone'
import { abonoFacturaEsteMes, clampDiaVencimiento } from '@/lib/servicios-recurrentes'

// Facturación recurrente por abono (ServicioRecurrente). Lo usan el cron
// invoice-automation y el botón manual de /servicios. Es idempotente por sí
// mismo: no crea una factura si ya existe una de ese abono en el mes calendario
// en curso — así no depende del CronRun ni se duplica si se lo dispara a mano.

export interface BillAbonosItem {
  abonoId: string
  empresa: string
  concepto: string
  amount: number
  currency: string
}

export interface BillAbonosResult {
  /** Facturas realmente creadas (0 en dry run). */
  created: number
  /** Detalle de lo facturado (o de lo que se facturaría, en dry run). */
  items: BillAbonosItem[]
  skippedYaFacturado: number
  skippedEmpresaNoCliente: number
}

export async function billAbonosForOrg(
  orgId: string,
  opts: { dryRun?: boolean; now?: Date } = {},
): Promise<BillAbonosResult> {
  const now = opts.now ?? new Date()
  const argToday = argentinaDayStart(now)
  const y = argToday.getUTCFullYear()
  const mIdx = argToday.getUTCMonth()
  const startOfMonth = new Date(Date.UTC(y, mIdx, 1))
  const endOfMonth = new Date(Date.UTC(y, mIdx + 1, 1))
  const monthLabel = now.toLocaleString('es', {
    month: 'long', year: 'numeric', timeZone: 'America/Argentina/Buenos_Aires',
  })

  const result: BillAbonosResult = {
    created: 0, items: [], skippedYaFacturado: 0, skippedEmpresaNoCliente: 0,
  }

  const abonos = await prisma.servicioRecurrente.findMany({
    where: { organizationId: orgId, estado: 'ACTIVO', monto: { gt: 0 }, ciclo: { not: 'UNICO' } },
    select: {
      id: true, nombre: true, monto: true, moneda: true, ciclo: true, estado: true,
      diaVencimiento: true, contratoInicio: true, contratoFin: true, createdAt: true, subStatus: true,
      empresa: { select: { id: true, name: true, isCliente: true } },
    },
  })

  const due = abonos.filter((a) =>
    // Débito automático (Pagos & Portal, Fase 4): si el abono tiene una
    // suscripción externa ACTIVA, lo cobra el proveedor (Whop/MP) por su cuenta
    // cada ciclo y la factura se crea ya PAID vía webhook — este cron no lo
    // toca. Filtro en JS (no en el where) a propósito: `subStatus` es null en
    // todo abono anterior a Fase 4, y así no dependemos de cómo Prisma maneja
    // `{ not }` sobre nulls.
    a.subStatus !== 'ACTIVO' && abonoFacturaEsteMes(a as any, argToday),
  )
  if (due.length === 0) return result

  const existing = await prisma.invoice.findMany({
    where: {
      servicioRecurrenteId: { in: due.map((a) => a.id) },
      createdAt: { gte: startOfMonth, lt: endOfMonth },
    },
    select: { servicioRecurrenteId: true },
  })
  const yaFacturado = new Set(existing.map((i) => i.servicioRecurrenteId))

  const toCreate: {
    empresaId: string; organizationId: string; servicioRecurrenteId: string
    amount: number; currency: string; description: string; dueDate: Date; status: 'PENDING'
  }[] = []

  for (const a of due) {
    if (yaFacturado.has(a.id)) { result.skippedYaFacturado++; continue }
    if (!a.empresa?.isCliente) { result.skippedEmpresaNoCliente++; continue }

    const dueDate = dateOnlyArgentina(y, mIdx + 1, clampDiaVencimiento(a.diaVencimiento))
    const concepto = `${a.nombre} — ${monthLabel}`
    toCreate.push({
      empresaId: a.empresa.id,
      organizationId: orgId,
      servicioRecurrenteId: a.id,
      amount: a.monto,
      currency: a.moneda || 'USD',
      description: concepto,
      dueDate,
      status: 'PENDING',
    })
    result.items.push({
      abonoId: a.id, empresa: a.empresa.name, concepto, amount: a.monto, currency: a.moneda || 'USD',
    })
  }

  if (!opts.dryRun && toCreate.length > 0) {
    const res = await prisma.invoice.createMany({ data: toCreate })
    result.created = res.count
  }
  return result
}

// IDs de empresas con al menos un abono vigente (estado != BAJA) — el flujo
// viejo por Empresa.monthlyAmount tiene que saltearlas para no facturar dos
// veces. Un abono PAUSADO igual "toma el control" del cliente (no se factura
// nada, pero tampoco cae al monto plano); uno de BAJA es historia y no cuenta.
export async function empresasConAbono(orgId: string): Promise<Set<string>> {
  const rows = await prisma.servicioRecurrente.findMany({
    where: { organizationId: orgId, estado: { not: 'BAJA' } },
    select: { empresaId: true },
  })
  return new Set(rows.map((r) => r.empresaId))
}
