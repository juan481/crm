import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendPortalMagicLink } from '@/lib/portal-magic-link'

export const dynamic = 'force-dynamic'

interface Params { params: { id: string } }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Gestión de usuarios del PORTAL DE CLIENTES para una Empresa.
// GET: lista los usuarios de portal (role CLIENTE) de esta empresa.
// POST: da acceso al portal a un email (crea usuario Supabase sin contraseña +
//       fila User CLIENTE atada a esta empresa, y le manda el link de ingreso).
// DELETE ?userId=: revoca el acceso (status DELETED + borra el usuario de Supabase Auth).
// Sólo SUPER_ADMIN / ADMIN.

async function guard(orgId: string, empresaId: string) {
  return prisma.empresa.findFirst({ where: { id: empresaId, organizationId: orgId }, select: { id: true, name: true } })
}

export async function GET(_req: NextRequest, { params }: Params) {
  const payload = await getCurrentUser()
  if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (!['SUPER_ADMIN', 'ADMIN'].includes(payload.role)) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

  const empresa = await guard(payload.orgId, params.id)
  if (!empresa) return NextResponse.json({ error: 'Empresa no encontrada' }, { status: 404 })

  const users = await prisma.user.findMany({
    where: { organizationId: payload.orgId, empresaId: params.id, role: 'CLIENTE', status: { not: 'DELETED' } },
    select: { id: true, name: true, email: true, status: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json({ data: users })
}

export async function POST(req: NextRequest, { params }: Params) {
  const payload = await getCurrentUser()
  if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (!['SUPER_ADMIN', 'ADMIN'].includes(payload.role)) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

  const empresa = await guard(payload.orgId, params.id)
  if (!empresa) return NextResponse.json({ error: 'Empresa no encontrada' }, { status: 404 })

  const body = await req.json().catch(() => null)
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  const name = typeof body?.name === 'string' && body.name.trim() ? body.name.trim() : email.split('@')[0]
  if (!EMAIL_RE.test(email)) return NextResponse.json({ error: 'Email inválido' }, { status: 400 })

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true, role: true, empresaId: true, organizationId: true, status: true } })
  if (existing) {
    // Ya es CLIENTE de esta misma empresa y activo → nada que hacer.
    if (existing.role === 'CLIENTE' && existing.empresaId === params.id && existing.organizationId === payload.orgId && existing.status === 'ACTIVE') {
      return NextResponse.json({ error: 'Ese email ya tiene acceso al portal de esta empresa' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Ese email ya está en uso por otro usuario del sistema. Usá otro.' }, { status: 409 })
  }

  const supabaseAdmin = createAdminClient()
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    email_confirm: true, // sin contraseña: entra siempre por magic link
  })
  if (authError || !authData.user) {
    console.error('[PORTAL ACCESO] createUser falló:', authError?.message)
    return NextResponse.json({ error: 'No se pudo crear el usuario' }, { status: 502 })
  }

  let user
  try {
    user = await prisma.user.create({
      data: {
        supabaseId: authData.user.id,
        email,
        name,
        role: 'CLIENTE',
        status: 'ACTIVE',
        onboardingCompleted: true,
        organizationId: payload.orgId,
        empresaId: params.id,
      },
      select: { id: true, name: true, email: true },
    })
  } catch (err) {
    // rollback del usuario de Supabase si falla la fila local
    try { await supabaseAdmin.auth.admin.deleteUser(authData.user.id) } catch { /* ignore */ }
    console.error('[PORTAL ACCESO] user.create falló:', err)
    return NextResponse.json({ error: 'No se pudo crear el usuario' }, { status: 500 })
  }

  // Le mandamos el enlace de acceso directo (branded, desde el correo de la
  // org — NO el mail genérico de Supabase). Un clic y adentro.
  try {
    await sendPortalMagicLink(email, req)
  } catch (err) {
    console.error('[PORTAL ACCESO] envío del enlace falló:', err)
  }

  return NextResponse.json({ data: user }, { status: 201 })
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const payload = await getCurrentUser()
  if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (!['SUPER_ADMIN', 'ADMIN'].includes(payload.role)) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

  const userId = req.nextUrl.searchParams.get('userId')
  if (!userId) return NextResponse.json({ error: 'Falta userId' }, { status: 400 })

  const target = await prisma.user.findFirst({
    where: { id: userId, organizationId: payload.orgId, empresaId: params.id, role: 'CLIENTE' },
    select: { id: true, supabaseId: true },
  })
  if (!target) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

  await prisma.user.update({ where: { id: target.id }, data: { status: 'DELETED' } })
  if (target.supabaseId) {
    try { await createAdminClient().auth.admin.deleteUser(target.supabaseId) } catch (err) { console.error('[PORTAL ACCESO] deleteUser falló:', err) }
  }

  return NextResponse.json({ ok: true })
}
