import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, canAccess } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const org = await prisma.organization.findUnique({
      where: { id: payload.orgId },
      select: { name: true, logoUrl: true, primaryColor: true, secondaryColor: true, crmName: true },
    })

    return NextResponse.json({ data: org })
  } catch (error) {
    console.error('[BRANDING GET]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    if (!canAccess(payload.role, 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Solo Super Admin puede modificar el branding' }, { status: 403 })
    }

    const { name, logoUrl, primaryColor, secondaryColor, crmName } = await req.json()

    const org = await prisma.organization.update({
      where: { id: payload.orgId },
      data: {
        ...(name && { name }),
        ...(crmName !== undefined && { crmName }),
        ...(logoUrl !== undefined && { logoUrl }),
        ...(primaryColor && { primaryColor }),
        ...(secondaryColor && { secondaryColor }),
      },
      select: { name: true, logoUrl: true, primaryColor: true, secondaryColor: true, crmName: true },
    })

    return NextResponse.json({ data: org, message: 'Branding actualizado' })
  } catch (error) {
    console.error('[BRANDING PATCH]', error)
    return NextResponse.json({ error: 'Error al actualizar branding' }, { status: 500 })
  }
}
