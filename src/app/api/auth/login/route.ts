import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyPassword, signToken, setAuthCookie } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Email y contraseña son requeridos' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: { organization: true },
    })

    if (!user || user.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Credenciales incorrectas' }, { status: 401 })
    }

    const valid = await verifyPassword(password, user.passwordHash)
    if (!valid) {
      return NextResponse.json({ error: 'Credenciales incorrectas' }, { status: 401 })
    }

    const token = signToken({
      userId: user.id,
      orgId: user.organizationId,
      role: user.role as 'SUPER_ADMIN' | 'ADMIN' | 'SELLER',
      email: user.email,
    })

    setAuthCookie(token)

    const { passwordHash: _, ...safeUser } = user
    return NextResponse.json({ data: safeUser }, { status: 200 })
  } catch (error) {
    console.error('[AUTH/LOGIN]', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
