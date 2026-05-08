import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    const payload = await getCurrentUser()
    if (!payload) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true, email: true, name: true, role: true, status: true,
        onboardingCompleted: true, forcePasswordChange: true, avatarUrl: true,
        organizationId: true, createdAt: true, updatedAt: true,
      },
    })

    if (!user || user.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Usuario no encontrado o suspendido' }, { status: 401 })
    }

    return NextResponse.json({ data: user })
  } catch (error) {
    console.error('[AUTH/ME]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
