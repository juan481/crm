import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

// POST /api/empresas/merge
// Body: { primaryId: string, secondaryId: string }
// Merges secondary into primary: copies non-null fields, moves contacts, deletes secondary.
export async function POST(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

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

    // Merge: keep primary value unless null, then fall back to secondary
    const mergedData = {
      activity:     primary.activity     || secondary.activity     || null,
      address:      primary.address      || secondary.address      || null,
      codigoPostal: primary.codigoPostal || secondary.codigoPostal || null,
      city:         primary.city         || secondary.city         || null,
      province:     primary.province     || secondary.province     || null,
      country:      primary.country      || secondary.country      || null,
      website:      primary.website      || secondary.website      || null,
      isCliente:    primary.isCliente    || secondary.isCliente,
      clienteDesde: primary.clienteDesde || secondary.clienteDesde || null,
    }

    // Move contacts from secondary to primary, then update primary, then delete secondary
    const [moved] = await Promise.all([
      db.directorioContacto.updateMany({
        where: { empresaId: secondaryId, organizationId: payload.orgId },
        data:  { empresaId: primaryId },
      }),
    ])

    const updatedEmpresa = await db.empresa.update({
      where: { id: primaryId },
      data:  mergedData,
    })

    await db.empresa.delete({ where: { id: secondaryId } })

    return NextResponse.json({
      data: {
        ...updatedEmpresa,
        clienteDesde: updatedEmpresa.clienteDesde?.toISOString() ?? null,
        createdAt:    updatedEmpresa.createdAt.toISOString(),
        updatedAt:    updatedEmpresa.updatedAt.toISOString(),
      },
      message: `Empresas unificadas. ${moved.count} contacto(s) transferido(s).`,
    })
  } catch (error) {
    console.error('[EMPRESAS MERGE]', error)
    return NextResponse.json({ error: 'Error al unificar empresas' }, { status: 500 })
  }
}
