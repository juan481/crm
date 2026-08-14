import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, canAccess } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { relinkContactos } from '@/lib/directorio-link'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!canAccess(payload.role, 'SELLER')) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const db = prisma as any
    const empresa = await db.empresa.findFirst({
      where: { id: params.id, organizationId: payload.orgId },
      include: {
        owner: { select: { id: true, name: true } },
        contactos: {
          orderBy: { lastName: 'asc' },
          select: {
            id: true, firstName: true, lastName: true, companyRaw: true,
            role: true, email: true, phone: true, empresaId: true,
            createdAt: true, updatedAt: true,
          },
        },
      },
    })

    if (!empresa) return NextResponse.json({ error: 'Empresa no encontrada' }, { status: 404 })

    return NextResponse.json({
      data: {
        ...empresa,
        clienteDesde: empresa.clienteDesde?.toISOString() ?? null,
        createdAt:    empresa.createdAt.toISOString(),
        updatedAt:    empresa.updatedAt.toISOString(),
        contactos:    empresa.contactos.map((c: any) => ({
          ...c,
          createdAt: c.createdAt.toISOString(),
          updatedAt: c.updatedAt.toISOString(),
        })),
      },
    })
  } catch (error) {
    console.error('[EMPRESA GET]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!canAccess(payload.role, 'SELLER')) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const body = await req.json()
    const {
      name, activity, address, codigoPostal, city, province, country, website,
      isCliente, monthlyAmount, billingCurrency,
      cuit, condicionIva, formaPagoHabitual, ownerId,
    } = body

    if (!name?.trim()) return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 })

    const db = prisma as any
    const exists = await db.empresa.findFirst({ where: { id: params.id, organizationId: payload.orgId }, select: { id: true, isCliente: true } })
    if (!exists) return NextResponse.json({ error: 'Empresa no encontrada' }, { status: 404 })

    // Sólo se tocan los campos que vienen en el body — antes cualquier campo
    // ausente (ej. codigoPostal, que el form de edición nunca mandaba) se
    // pisaba con null en cada guardado, perdiendo silenciosamente datos que
    // sí estaban cargados (típicamente por la importación de Excel). Mismo
    // criterio que ya usaban isCliente/monthlyAmount más abajo, extendido al
    // resto de los campos. Para borrar un campo a propósito, se sigue
    // pudiendo mandar '' explícito.
    const updateData: Record<string, unknown> = { name: name.trim() }
    if (activity     !== undefined) updateData.activity     = activity?.trim()     || null
    if (address      !== undefined) updateData.address      = address?.trim()      || null
    if (codigoPostal !== undefined) updateData.codigoPostal = codigoPostal?.trim() || null
    if (city         !== undefined) updateData.city         = city?.trim()         || null
    if (province     !== undefined) updateData.province     = province?.trim()     || null
    if (country      !== undefined) updateData.country      = country?.trim()      || null
    if (website      !== undefined) updateData.website      = website?.trim()      || null

    // Toggle cliente status — registra fecha si se activa
    if (typeof isCliente === 'boolean') {
      updateData.isCliente    = isCliente
      updateData.clienteDesde = isCliente && !exists.isCliente ? new Date() : (isCliente ? undefined : null)
    }

    if (monthlyAmount !== undefined)  updateData.monthlyAmount  = monthlyAmount === null || monthlyAmount === '' ? null : Number(monthlyAmount)
    if (billingCurrency !== undefined) updateData.billingCurrency = billingCurrency || 'USD'

    if (cuit              !== undefined) updateData.cuit              = cuit?.trim()              || null
    if (condicionIva      !== undefined) updateData.condicionIva      = condicionIva?.trim()       || null
    if (formaPagoHabitual !== undefined) updateData.formaPagoHabitual = formaPagoHabitual?.trim()  || null

    // Asignar/reasignar cartera es cosa de ADMIN+ — un SELLER no se
    // auto-asigna ni le saca clientes a otro vendedor. Re-validar que el id
    // recibido sea un usuario DE ESTA organización antes de guardarlo — ver
    // el mismo comentario en api/empresas/route.ts (POST). Sin esto, un
    // ownerId de otra organización pasado a mano por la API directa quedaría
    // guardado y su nombre se filtraría en la ficha de esta empresa.
    if (ownerId !== undefined && canAccess(payload.role, 'ADMIN')) {
      if (ownerId?.trim()) {
        const owner = await db.user.findFirst({ where: { id: ownerId.trim(), organizationId: payload.orgId }, select: { id: true } })
        updateData.ownerId = owner?.id ?? null
      } else {
        updateData.ownerId = null
      }
    }

    const empresa = await db.empresa.update({ where: { id: params.id }, data: updateData })

    // When empresa is newly marked as cliente, link any matching unlinked contacts
    if (isCliente === true && !exists.isCliente) {
      await relinkContactos(db, params.id, empresa.name, payload.orgId, empresa.website)
    }

    return NextResponse.json({
      data: {
        ...empresa,
        clienteDesde: empresa.clienteDesde?.toISOString() ?? null,
        createdAt:    empresa.createdAt.toISOString(),
        updatedAt:    empresa.updatedAt.toISOString(),
      }
    })
  } catch (error) {
    console.error('[EMPRESA PUT]', error)
    return NextResponse.json({ error: 'Error al actualizar empresa' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!canAccess(payload.role, 'SELLER')) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const db = prisma as any
    const exists = await db.empresa.findFirst({ where: { id: params.id, organizationId: payload.orgId }, select: { id: true } })
    if (!exists) return NextResponse.json({ error: 'Empresa no encontrada' }, { status: 404 })

    await db.empresa.delete({ where: { id: params.id } })
    return NextResponse.json({ message: 'Empresa eliminada' })
  } catch (error) {
    console.error('[EMPRESA DELETE]', error)
    return NextResponse.json({ error: 'Error al eliminar empresa' }, { status: 500 })
  }
}
