import { NextRequest, NextResponse } from 'next/server'
import { getPlatformAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const admin = await getPlatformAdmin()
    if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const db = prisma as any
    const orgs = await db.organization.findMany({
      select: {
        id: true, name: true, domain: true, crmName: true, vertical: true,
        suspended: true, suspendedAt: true, createdAt: true,
        _count: { select: { users: true } },
      },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json({ data: orgs })
  } catch (error) {
    console.error('[ADMIN ORGANIZATIONS GET]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// Alta de una organización nueva (tenant). Dos modos:
//  - Usuario nuevo (default): crea cuenta Supabase Auth + fila User, mismo
//    mecanismo que /api/settings/users.
//  - `existingUserEmail`: el primer SUPER_ADMIN ya tiene login en el sistema
//    (ej. alguien de la agencia con acceso a otra organización) — no se toca
//    su fila User ni se crea una cuenta Auth nueva, sólo se suma una
//    OrganizationMembership. Así un mismo login puede operar más de una
//    organización sin duplicar cuentas — ver Fase 0.6 del plan.
// Reusable para cualquier cliente nuevo de la agencia, no sólo para Just Create.
export async function POST(req: NextRequest) {
  try {
    const admin = await getPlatformAdmin()
    if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { orgName, domain, existingUserEmail, adminName, adminEmail, adminPassword } = await req.json()
    if (!orgName?.trim()) {
      return NextResponse.json({ error: 'orgName es requerido' }, { status: 400 })
    }

    const db = prisma as any

    if (domain?.trim()) {
      const existingDomain = await db.organization.findUnique({ where: { domain: domain.trim() } })
      if (existingDomain) return NextResponse.json({ error: 'Ese dominio ya está en uso' }, { status: 400 })
    }

    // ── Modo "usuario ya existe": sólo suma OrganizationMembership ──────────
    if (existingUserEmail?.trim()) {
      const email = existingUserEmail.trim().toLowerCase()
      const user = await db.user.findFirst({ where: { email, status: 'ACTIVE' } })
      if (!user) return NextResponse.json({ error: 'No hay un usuario activo con ese email' }, { status: 404 })

      const org = await db.organization.create({
        data: { name: orgName.trim(), domain: domain?.trim() || null },
        select: { id: true, name: true },
      })

      await db.organizationMembership.create({
        data: { userId: user.id, organizationId: org.id, role: 'SUPER_ADMIN' },
      })

      return NextResponse.json(
        { data: { organization: org, user: { id: user.id, email: user.email, name: user.name } } },
        { status: 201 }
      )
    }

    // ── Modo "usuario nuevo": crea cuenta Supabase Auth + User ───────────────
    if (!adminName?.trim() || !adminEmail?.trim() || !adminPassword) {
      return NextResponse.json(
        { error: 'adminName, adminEmail y adminPassword son requeridos (o existingUserEmail)' },
        { status: 400 }
      )
    }
    if (adminPassword.length < 8) {
      return NextResponse.json({ error: 'La contraseña debe tener al menos 8 caracteres' }, { status: 400 })
    }

    const email = adminEmail.trim().toLowerCase()
    const existingUser = await db.user.findFirst({ where: { email, status: { not: 'DELETED' } } })
    if (existingUser) return NextResponse.json({ error: 'Ese email ya está registrado' }, { status: 400 })

    const org = await db.organization.create({
      data: { name: orgName.trim(), domain: domain?.trim() || null },
      select: { id: true, name: true },
    })

    const supabaseAdmin = createAdminClient()
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: adminPassword,
      email_confirm: true,
    })
    if (authError) {
      // La org ya se creó — no la dejamos huérfana sin usuario si Supabase falla.
      await db.organization.delete({ where: { id: org.id } })
      return NextResponse.json({ error: `Supabase Auth: ${authError.message}` }, { status: 400 })
    }

    const user = await db.user.create({
      data: {
        supabaseId: authData.user.id,
        name: adminName.trim(),
        email,
        role: 'SUPER_ADMIN',
        organizationId: org.id,
        forcePasswordChange: true,
      },
      select: { id: true, email: true, name: true, role: true },
    })

    return NextResponse.json({ data: { organization: org, user } }, { status: 201 })
  } catch (error) {
    console.error('[ADMIN ORGANIZATIONS POST]', error)
    return NextResponse.json({ error: 'Error al crear la organización' }, { status: 500 })
  }
}
