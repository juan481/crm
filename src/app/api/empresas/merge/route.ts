import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, canAccess } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

// POST /api/empresas/merge
// Body: { primaryId: string, secondaryId: string }
// Merges secondary into primary: copies non-null fields, moves everything
// que cuelga de la secundaria, la borra.
export async function POST(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!canAccess(payload.role, 'ADMIN'))
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const { primaryId, secondaryId } = await req.json()
    if (!primaryId || !secondaryId)
      return NextResponse.json({ error: 'Se requieren primaryId y secondaryId' }, { status: 400 })
    if (primaryId === secondaryId)
      return NextResponse.json({ error: 'Las dos empresas deben ser distintas' }, { status: 400 })

    const db = prisma as any

    const [primary, secondary] = await Promise.all([
      db.empresa.findFirst({ where: { id: primaryId,   organizationId: payload.orgId } }),
      db.empresa.findFirst({ where: { id: secondaryId, organizationId: payload.orgId } }),
    ])

    if (!primary)   return NextResponse.json({ error: 'Empresa principal no encontrada' }, { status: 404 })
    if (!secondary) return NextResponse.json({ error: 'Empresa secundaria no encontrada' }, { status: 404 })

    // Facturación recurrente: monto y moneda viajan juntos (no tiene
    // sentido mezclar el monto de una con la moneda de la otra) — se
    // hereda el par completo de la secundaria sólo si la principal no
    // tiene monto cargado.
    const inheritBilling = (primary.monthlyAmount == null || primary.monthlyAmount === 0) && secondary.monthlyAmount != null

    // Merge: keep primary value unless null, then fall back to secondary
    const mergedData = {
      activity:        primary.activity     || secondary.activity     || null,
      address:         primary.address      || secondary.address      || null,
      codigoPostal:    primary.codigoPostal || secondary.codigoPostal || null,
      city:            primary.city         || secondary.city         || null,
      province:        primary.province     || secondary.province     || null,
      country:         primary.country      || secondary.country      || null,
      website:         primary.website      || secondary.website      || null,
      isCliente:       primary.isCliente    || secondary.isCliente,
      clienteDesde:    primary.clienteDesde || secondary.clienteDesde || null,
      monthlyAmount:   inheritBilling ? secondary.monthlyAmount : primary.monthlyAmount,
      billingCurrency: inheritBilling ? (secondary.billingCurrency || 'USD') : primary.billingCurrency,
      // Bug real encontrado en auditoría: estos 4 campos (agregados en la
      // Fase 6/4 del panel de permisos + ficha fiscal) nunca se sumaron acá
      // — un merge borraba la secundaria sin haber copiado su CUIT/condición
      // de IVA/forma de pago/vendedor asignado a la principal si la
      // principal no los tenía, perdiéndolos sin aviso ni forma de
      // recuperarlos.
      cuit:              primary.cuit              || secondary.cuit              || null,
      condicionIva:      primary.condicionIva      || secondary.condicionIva      || null,
      formaPagoHabitual: primary.formaPagoHabitual || secondary.formaPagoHabitual || null,
      ownerId:           primary.ownerId           || secondary.ownerId           || null,
    }

    // Todo lo que cuelga de la secundaria se reasigna a la principal ANTES
    // de borrarla, en una sola transacción (o se mueve/actualiza/borra
    // todo, o no se hace nada). Esto no era así antes — sólo se movían los
    // contactos. Invoice y EmpresaNota tienen onDelete:Cascade hacia
    // Empresa en el schema (a diferencia de Task/Deal/Ticket/Cotizacion,
    // que son SetNull) — sin este paso, borrar la secundaria borraba en
    // cascada sus facturas reales y su historial de notas, no sólo las
    // "desvinculaba". El resto (Task/Deal/Ticket/Cotizacion) no se perdía,
    // pero quedaba huérfano (sin empresa) en vez de pasar a la principal —
    // también se corrige acá.
    const moveWhere = { empresaId: secondaryId, organizationId: payload.orgId }
    const moveData = { empresaId: primaryId }

    // Resultados por índice explícito, no por posición destructurada — con
    // 9 operaciones en la misma transacción, contar comas a mano para
    // saltear las que no importan es fácil de arruinar (ya me pasó
    // escribiendo esto mismo: contactos y facturas terminaban desalineados
    // un lugar). Así es imposible confundirse.
    const results = await db.$transaction([
      db.directorioContacto.updateMany({ where: moveWhere, data: moveData }), // 0
      db.empresaNota.updateMany({ where: moveWhere, data: moveData }),        // 1
      db.cotizacion.updateMany({ where: moveWhere, data: moveData }),         // 2
      db.deal.updateMany({ where: moveWhere, data: moveData }),               // 3
      db.task.updateMany({ where: moveWhere, data: moveData }),               // 4
      db.ticket.updateMany({ where: moveWhere, data: moveData }),             // 5
      db.invoice.updateMany({ where: moveWhere, data: moveData }),            // 6
      db.empresa.update({ where: { id: primaryId }, data: mergedData }),      // 7
      db.empresa.delete({ where: { id: secondaryId } }),                     // 8
    ])
    const movedContactos = results[0]
    const movedInvoices  = results[6]
    const updatedEmpresa = results[7]

    return NextResponse.json({
      data: {
        ...updatedEmpresa,
        clienteDesde: updatedEmpresa.clienteDesde?.toISOString() ?? null,
        createdAt:    updatedEmpresa.createdAt.toISOString(),
        updatedAt:    updatedEmpresa.updatedAt.toISOString(),
      },
      message: `Empresas unificadas. ${movedContactos.count} contacto(s) y ${movedInvoices.count} factura(s) transferidos.`,
    })
  } catch (error) {
    console.error('[EMPRESAS MERGE]', error)
    return NextResponse.json({ error: 'Error al unificar empresas' }, { status: 500 })
  }
}
