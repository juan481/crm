import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, canAccess, hashPassword } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!canAccess(payload.role, 'ADMIN')) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const users = await prisma.user.findMany({
      where: { organizationId: payload.orgId, status: { not: 'DELETED' } },
      select: {
        id: true, email: true, name: true, role: true, status: true,
        onboardingCompleted: true, forcePasswordChange: true, avatarUrl: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ data: users })
  } catch (error) {
    console.error('[USERS GET]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!canAccess(payload.role, 'ADMIN')) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const { name, email, role, password } = await req.json()
    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Nombre, email y contraseña son requeridos' }, { status: 400 })
    }

    const exists = await prisma.user.findUnique({ where: { email: email.toLowerCase() } })
    if (exists) return NextResponse.json({ error: 'El email ya está registrado' }, { status: 400 })

    // ADMIN cannot create SUPER_ADMIN
    if (role === 'SUPER_ADMIN' && payload.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'No puedes crear un Super Admin' }, { status: 403 })
    }

    const passwordHash = await hashPassword(password)
    const user = await prisma.user.create({
      data: {
        name,
        email: email.toLowerCase(),
        passwordHash,
        role: role || 'SELLER',
        organizationId: payload.orgId,
        forcePasswordChange: true,
      },
      select: { id: true, email: true, name: true, role: true, status: true, createdAt: true },
    })

    return NextResponse.json({ data: user }, { status: 201 })
  } catch (error) {
    console.error('[USERS POST]', error)
    return NextResponse.json({ error: 'Error al crear usuario' }, { status: 500 })
  }
}
