import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, canAccess } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
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

    const VALID_ROLES = ['ADMIN', 'SELLER', 'TECHNICIAN', 'HR', 'SUPER_ADMIN']
    if (!VALID_ROLES.includes(role)) {
      return NextResponse.json({ error: 'Rol inválido' }, { status: 400 })
    }
    if (role === 'SUPER_ADMIN' && payload.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'No podés crear un Super Admin' }, { status: 403 })
    }

    // Check duplicate in our DB (ignore DELETED users — they'll be fully removed from Supabase Auth on delete)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const exists = await (prisma.user as any).findFirst({ where: { email: email.toLowerCase(), status: { not: 'DELETED' } } })
    if (exists) return NextResponse.json({ error: 'El email ya está registrado' }, { status: 400 })

    // 1. Create the user in Supabase Auth (admin API — no email verification needed)
    const supabaseAdmin = createAdminClient()
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email.toLowerCase(),
      password,
      email_confirm: true, // auto-confirm, no verification email
    })
    if (authError) {
      return NextResponse.json({ error: `Supabase Auth: ${authError.message}` }, { status: 400 })
    }

    // 2. Create the user record in our DB, linked to the Supabase user
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const user = await (prisma.user as any).create({
      data: {
        supabaseId:         authData.user.id,
        name:               name.trim(),
        email:              email.toLowerCase(),
        role:               role || 'SELLER',
        organizationId:     payload.orgId,
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
