import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

function parseJsonArray(raw: string): string[] {
  try { return JSON.parse(raw) } catch { return [] }
}

export async function GET(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { searchParams } = req.nextUrl
    const search = searchParams.get('search') ?? ''
    const status = searchParams.get('status') ?? ''
    const country = searchParams.get('country') ?? ''
    const serviceType = searchParams.get('serviceType') ?? ''
    const clientType = searchParams.get('clientType') ?? ''
    const assignedSellerId = searchParams.get('assignedSellerId') ?? ''
    const isEnabledParam = searchParams.get('isEnabled')
    const page = Math.max(1, Number(searchParams.get('page') ?? 1))
    const limit = Math.min(100, Number(searchParams.get('limit') ?? 20))
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = { organizationId: payload.orgId }

    if (payload.role === 'SELLER') {
      where.assignedSellerId = payload.userId
    }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
        { company: { contains: search } },
        { phone: { contains: search } },
      ]
    }
    if (status) where.status = status
    if (country) where.country = country
    if (serviceType) where.serviceType = serviceType
    if (clientType) where.clientType = clientType
    if (assignedSellerId) where.assignedSellerId = assignedSellerId
    if (isEnabledParam !== null && isEnabledParam !== '') {
      where.isEnabled = isEnabledParam === 'true'
    }

    const [raw, total] = await Promise.all([
      prisma.client.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true, name: true, email: true, phone: true, company: true,
          country: true, city: true, status: true, clientType: true,
          isEnabled: true, serviceType: true, tags: true, mrr: true,
          contractStart: true, contractEnd: true, assignedSellerId: true,
          createdAt: true, updatedAt: true,
          assignedSeller: { select: { id: true, name: true } },
        },
      }),
      prisma.client.count({ where }),
    ])

    const data = raw.map((c) => ({ ...c, tags: parseJsonArray(c.tags) }))

    return NextResponse.json({ data, total, page, limit, totalPages: Math.ceil(total / limit) })
  } catch (error) {
    console.error('[CLIENTS GET]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await req.json()
    const {
      name, email, phone, company, country, city, address, postalCode, province,
      website, status, clientType, serviceType, mrr, contractStart, contractEnd, tags,
      isEnabled,
      licenseSerial, licenseVersion, maxWorkstations, subscriptionStart, subscriptionEnd,
      licenseHibernated, licenseRepurchased, isActive24x7,
      distributorName, totalInvestment, renewalCount,
      assignedSellerId,
    } = body

    if (!name) return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 })

    const client = await prisma.client.create({
      data: {
        name,
        email: email ? email.toLowerCase().trim() : '',
        phone: phone || null,
        company: company || null,
        country: country || null,
        city: city || null,
        address: address || null,
        postalCode: postalCode || null,
        province: province || null,
        website: website || null,
        status: status || 'ACTIVE',
        clientType: clientType || 'B2B',
        isEnabled: isEnabled !== undefined ? Boolean(isEnabled) : true,
        serviceType: serviceType || null,
        mrr: Number(mrr) || 0,
        contractStart: contractStart ? new Date(contractStart) : null,
        contractEnd: contractEnd ? new Date(contractEnd) : null,
        tags: JSON.stringify(tags ?? []),
        licenseSerial: licenseSerial || null,
        licenseVersion: licenseVersion || null,
        maxWorkstations: maxWorkstations ? Number(maxWorkstations) : null,
        subscriptionStart: subscriptionStart ? new Date(subscriptionStart) : null,
        subscriptionEnd: subscriptionEnd ? new Date(subscriptionEnd) : null,
        licenseHibernated: Boolean(licenseHibernated),
        licenseRepurchased: Boolean(licenseRepurchased),
        isActive24x7: Boolean(isActive24x7),
        distributorName: distributorName || null,
        totalInvestment: totalInvestment ? Number(totalInvestment) : null,
        renewalCount: Number(renewalCount) || 0,
        assignedSellerId: assignedSellerId || null,
        organizationId: payload.orgId,
      },
    })

    try {
      await prisma.activityLog.create({
        data: {
          clientId: client.id,
          userId: payload.userId,
          action: 'CLIENT_CREATED',
          description: `Cliente "${name}" creado`,
        },
      })
    } catch { /* activity log failure never blocks client creation */ }

    return NextResponse.json({ data: { ...client, tags: parseJsonArray(client.tags) } }, { status: 201 })
  } catch (error) {
    console.error('[CLIENTS POST]', error)
    return NextResponse.json({ error: 'Error al crear cliente' }, { status: 500 })
  }
}
