import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

function parseJsonArray(raw: string): string[] {
  try { return JSON.parse(raw) } catch { return [] }
}

interface Params { params: { id: string } }

export async function GET(_: NextRequest, { params }: Params) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const client = await prisma.client.findFirst({
      where: { id: params.id, organizationId: payload.orgId },
      include: {
        invoices: { orderBy: { createdAt: 'desc' } },
        contacts: { orderBy: { createdAt: 'desc' } },
        activityLogs: {
          orderBy: { createdAt: 'desc' },
          take: 50,
          include: { user: { select: { name: true, avatarUrl: true } } },
        },
        sales: {
          orderBy: { closedAt: 'desc' },
          include: {
            seller: { select: { id: true, name: true } },
            service: { select: { id: true, name: true, currency: true } },
          },
        },
        assignedSeller: { select: { id: true, name: true } },
      },
    })

    if (!client) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
    return NextResponse.json({ data: { ...client, tags: parseJsonArray(client.tags) } })
  } catch (error) {
    console.error('[CLIENT GET]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const existing = await prisma.client.findFirst({
      where: { id: params.id, organizationId: payload.orgId },
    })
    if (!existing) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })

    const body = await req.json()
    const {
      name, email, phone, company, country, city, address, postalCode, province,
      website, status, clientType, isEnabled, serviceType, mrr,
      contractStart, contractEnd, tags,
      licenseSerial, licenseVersion, maxWorkstations, subscriptionStart, subscriptionEnd,
      licenseHibernated, licenseRepurchased, isActive24x7,
      distributorName, totalInvestment, renewalCount,
      assignedSellerId,
    } = body

    const prevStatus = existing.status

    const client = await prisma.client.update({
      where: { id: params.id },
      data: {
        ...(name && { name }),
        ...(email && { email: email.toLowerCase().trim() }),
        phone: phone !== undefined ? phone || null : existing.phone,
        company: company !== undefined ? company || null : existing.company,
        country: country !== undefined ? country || null : existing.country,
        city: city !== undefined ? city || null : existing.city,
        address: address !== undefined ? address || null : existing.address,
        postalCode: postalCode !== undefined ? postalCode || null : existing.postalCode,
        province: province !== undefined ? province || null : existing.province,
        website: website !== undefined ? website || null : existing.website,
        ...(status !== undefined && { status }),
        ...(clientType !== undefined && { clientType }),
        ...(isEnabled !== undefined && { isEnabled: Boolean(isEnabled) }),
        ...(serviceType !== undefined && { serviceType: serviceType || null }),
        ...(mrr !== undefined && { mrr: Number(mrr) }),
        ...(contractStart !== undefined && { contractStart: contractStart ? new Date(contractStart) : null }),
        ...(contractEnd !== undefined && { contractEnd: contractEnd ? new Date(contractEnd) : null }),
        ...(tags !== undefined && { tags: JSON.stringify(tags) }),
        ...(licenseSerial !== undefined && { licenseSerial: licenseSerial || null }),
        ...(licenseVersion !== undefined && { licenseVersion: licenseVersion || null }),
        ...(maxWorkstations !== undefined && { maxWorkstations: maxWorkstations ? Number(maxWorkstations) : null }),
        ...(subscriptionStart !== undefined && { subscriptionStart: subscriptionStart ? new Date(subscriptionStart) : null }),
        ...(subscriptionEnd !== undefined && { subscriptionEnd: subscriptionEnd ? new Date(subscriptionEnd) : null }),
        ...(licenseHibernated !== undefined && { licenseHibernated: Boolean(licenseHibernated) }),
        ...(licenseRepurchased !== undefined && { licenseRepurchased: Boolean(licenseRepurchased) }),
        ...(isActive24x7 !== undefined && { isActive24x7: Boolean(isActive24x7) }),
        ...(distributorName !== undefined && { distributorName: distributorName || null }),
        ...(totalInvestment !== undefined && { totalInvestment: totalInvestment ? Number(totalInvestment) : null }),
        ...(renewalCount !== undefined && { renewalCount: Number(renewalCount) }),
        ...(assignedSellerId !== undefined && { assignedSellerId: assignedSellerId || null }),
      },
    })

    const changes: string[] = []
    if (name && name !== existing.name) changes.push(`Nombre: ${name}`)
    if (status && status !== prevStatus) changes.push(`Estado: ${prevStatus} → ${status}`)
    if (assignedSellerId !== undefined && assignedSellerId !== existing.assignedSellerId) changes.push('Vendedor asignado actualizado')

    if (changes.length > 0) {
      await prisma.activityLog.create({
        data: {
          clientId: params.id,
          userId: payload.userId,
          action: status !== undefined && status !== prevStatus ? 'STATUS_CHANGED' : 'CLIENT_UPDATED',
          description: `Cliente actualizado: ${changes.join(', ')}`,
        },
      })
    }

    return NextResponse.json({ data: { ...client, tags: parseJsonArray(client.tags) } })
  } catch (error) {
    console.error('[CLIENT PATCH]', error)
    return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, { params }: Params) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    if (!['SUPER_ADMIN', 'ADMIN'].includes(payload.role)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    await prisma.client.deleteMany({
      where: { id: params.id, organizationId: payload.orgId },
    })

    return NextResponse.json({ message: 'Cliente eliminado' })
  } catch (error) {
    console.error('[CLIENT DELETE]', error)
    return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 })
  }
}
