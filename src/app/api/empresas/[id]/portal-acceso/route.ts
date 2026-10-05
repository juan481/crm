import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendPortalMagicLink } from '@/lib/portal-magic-link'

export const dynamic = 'force-dynamic'

interface Params { params: { id: string } }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const ABONADO_RE = /^[0-9]{3,10}$/
// Dominio inexistente a propósito — estos emails NUNCA se mandan a nadie,
// son sólo el identificador interno que Supabase Auth necesita por diseño.
// El cliente real sólo conoce su número de abonado.
const ABONADO_EMAIL_DOMAIN = 'abonado.portal.internal'

// Gestión de usuarios del PORTAL DE CLIENTES para una Empresa.
// GET: lista los usuarios de portal (role CLIENTE) de esta empresa.
// POST: da acceso al portal — dos modos (body.mode):
//       'email' (default): crea usuario Supabase sin contraseña + fila User
//       CLIENTE, y le manda el link de ingreso.
//       'abonado': para clientes sin email real (pedido de Abba/Smart
//       Panic, 2026-10-05) — crea el usuario con número de abonado +
//       contraseña elegida por el admin (ej. el DNI del cliente), sin mandar
//       ningún mail. El cliente entra en /portal/login con esos dos datos.
// PATCH { userId }: reenvía el enlace (usuarios con email) o resetea la
//       contraseña (body.newPassword — usuarios de abonado, que no tienen
//       mail para "olvidé mi contraseña").
// DELETE ?userId=: revoca el acceso (status DELETED + borra el usuario de Supabase Auth).
// Sólo SUPER_ADMIN / ADMIN.

// Genera un número de abonado de 5 dígitos sin usar, reintentando ante
// colisiones (es único a nivel de TODA la base, no por organización — ver
// comentario en schema.prisma). El espacio (90000 números) alcanza de sobra
// para el volumen esperado (decenas/cientos de cuentas).
async function generateNumeroAbonado(): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const candidate = String(10000 + Math.floor(Math.random() * 90000))
    const taken = await prisma.user.findUnique({ where: { numeroAbonado: candidate }, select: { id: true } })
    if (!taken) return candidate
  }
  throw new Error('No se pudo generar un número de abonado único')
}

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
    select: { id: true, name: true, email: true, numeroAbonado: true, status: true, createdAt: true },
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
  const mode = body?.mode === 'abonado' ? 'abonado' : 'email'

  if (mode === 'abonado') return createAbonadoAccess(req, params.id, payload, body)
  return createEmailAccess(req, params.id, payload, body)
}

async function createEmailAccess(req: NextRequest, empresaId: string, payload: { orgId: string }, body: any) {
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  const name = typeof body?.name === 'string' && body.name.trim() ? body.name.trim() : email.split('@')[0]
  if (!EMAIL_RE.test(email)) return NextResponse.json({ error: 'Email inválido' }, { status: 400 })

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true, empresaId: true, organizationId: true, status: true, supabaseId: true },
  })

  // DELETE no borra la fila (deja status=DELETED para no perder el
  // historial de notas/tickets ligados a ese userId) — si es la MISMA
  // empresa/org y estaba revocado, esto es un "volver a dar acceso", no un
  // conflicto: reactivamos la fila en vez de rechazar.
  const reactivating = !!existing
    && existing.role === 'CLIENTE'
    && existing.empresaId === empresaId
    && existing.organizationId === payload.orgId
    && existing.status !== 'ACTIVE'

  if (existing && !reactivating) {
    if (existing.role === 'CLIENTE' && existing.empresaId === empresaId && existing.organizationId === payload.orgId && existing.status === 'ACTIVE') {
      return NextResponse.json({ error: 'Ese email ya tiene acceso al portal de esta empresa' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Ese email ya está en uso por otro usuario del sistema. Usá otro.' }, { status: 409 })
  }

  const supabaseAdmin = createAdminClient()

  // Si estamos reactivando, nos aseguramos de que no quede un usuario de
  // Supabase Auth viejo colgado (el DELETE ya intentó borrarlo, esto es
  // sólo defensivo) antes de crear uno nuevo.
  if (reactivating && existing?.supabaseId) {
    try { await supabaseAdmin.auth.admin.deleteUser(existing.supabaseId) } catch { /* puede ya no existir */ }
  }

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    email_confirm: true, // sin contraseña: entra siempre por magic link (o la configura después en "Mi cuenta")
  })
  if (authError || !authData.user) {
    console.error('[PORTAL ACCESO] createUser falló:', authError?.message)
    return NextResponse.json({ error: 'No se pudo crear el usuario' }, { status: 502 })
  }

  let user
  try {
    user = reactivating
      ? await prisma.user.update({
          where: { id: existing!.id },
          data: {
            supabaseId: authData.user.id,
            name,
            status: 'ACTIVE',
            onboardingCompleted: true,
            organizationId: payload.orgId,
            empresaId,
          },
          select: { id: true, name: true, email: true },
        })
      : await prisma.user.create({
          data: {
            supabaseId: authData.user.id,
            email,
            name,
            role: 'CLIENTE',
            status: 'ACTIVE',
            onboardingCompleted: true,
            organizationId: payload.orgId,
            empresaId,
          },
          select: { id: true, name: true, email: true },
        })
  } catch (err) {
    // rollback del usuario de Supabase si falla la fila local
    try { await supabaseAdmin.auth.admin.deleteUser(authData.user.id) } catch { /* ignore */ }
    console.error('[PORTAL ACCESO] user.create/update falló:', err)
    return NextResponse.json({ error: 'No se pudo crear el usuario' }, { status: 500 })
  }

  // Le mandamos el enlace de acceso directo (branded, desde el correo de la
  // org — NO el mail genérico de Supabase). Un clic y adentro.
  //
  // Bug real (reporte de Abba, 2026-10-02): sendPortalMagicLink devuelve
  // { ok: false, error } en la mayoría de sus fallas (no tira excepción) —
  // acá nunca se miraba ese resultado, así que si el envío fallaba (mail
  // corporativo rechazado, SMTP/SES con problema puntual con ese dominio,
  // etc.) el admin igual veía "Acceso creado — se le mandó el link" como si
  // hubiera salido bien. El usuario SÍ quedó creado (eso no depende del
  // mail) — lo que avisamos ahora es específicamente que el envío falló,
  // para que el admin comparta el link a mano o reintente con "Reenviar".
  let emailWarning: string | null = null
  try {
    const result = await sendPortalMagicLink(email, req)
    if (!result.ok) emailWarning = result.error ?? 'No se pudo enviar el mail'
  } catch (err) {
    console.error('[PORTAL ACCESO] envío del enlace falló:', err)
    emailWarning = 'No se pudo enviar el mail'
  }

  return NextResponse.json({ data: user, emailWarning }, { status: 201 })
}

async function createAbonadoAccess(_req: NextRequest, empresaId: string, payload: { orgId: string }, body: any) {
  const name = typeof body?.name === 'string' && body.name.trim() ? body.name.trim() : ''
  const password = typeof body?.password === 'string' ? body.password : ''
  let numeroAbonado = typeof body?.numeroAbonado === 'string' ? body.numeroAbonado.trim() : ''

  if (!name) return NextResponse.json({ error: 'Falta el nombre del cliente' }, { status: 400 })
  if (password.length < 4) return NextResponse.json({ error: 'La contraseña debe tener al menos 4 caracteres' }, { status: 400 })
  if (numeroAbonado && !ABONADO_RE.test(numeroAbonado)) {
    return NextResponse.json({ error: 'El número de abonado debe ser numérico (3 a 10 dígitos)' }, { status: 400 })
  }

  // DELETE no borra la fila ni libera numeroAbonado (deja status=DELETED
  // para no perder historial) — igual que en el modo email, si el número
  // pedido es el de una fila revocada DE ESTA MISMA empresa/org, es "volver
  // a dar acceso", no un conflicto. Sin este chequeo, un número de abonado
  // dado de baja quedaba inutilizable para siempre (bug real encontrado al
  // revisar antes de pushear).
  let existing: { id: string; role: string; empresaId: string | null; organizationId: string; status: string } | null = null
  if (numeroAbonado) {
    existing = await prisma.user.findUnique({
      where: { numeroAbonado },
      select: { id: true, role: true, empresaId: true, organizationId: true, status: true },
    })
  } else {
    numeroAbonado = await generateNumeroAbonado()
  }

  const reactivating = !!existing
    && existing.role === 'CLIENTE'
    && existing.empresaId === empresaId
    && existing.organizationId === payload.orgId
    && existing.status !== 'ACTIVE'

  if (existing && !reactivating) {
    return NextResponse.json({ error: 'Ese número de abonado ya está en uso' }, { status: 409 })
  }

  // Email sintético determinístico — nunca se manda nada acá, es sólo el
  // identificador interno que pide Supabase Auth.
  const email = `abonado.${numeroAbonado}@${ABONADO_EMAIL_DOMAIN}`

  const supabaseAdmin = createAdminClient()

  // Si estamos reactivando, limpiamos cualquier usuario de Supabase Auth
  // viejo colgado antes de crear uno nuevo — mismo criterio que el modo email.
  if (reactivating) {
    const old = await prisma.user.findUnique({ where: { id: existing!.id }, select: { supabaseId: true } })
    if (old?.supabaseId) {
      try { await supabaseAdmin.auth.admin.deleteUser(old.supabaseId) } catch { /* puede ya no existir */ }
    }
  }

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (authError || !authData.user) {
    console.error('[PORTAL ACCESO] createUser (abonado) falló:', authError?.message)
    return NextResponse.json({ error: 'No se pudo crear el usuario' }, { status: 502 })
  }

  let user
  try {
    user = reactivating
      ? await prisma.user.update({
          where: { id: existing!.id },
          data: {
            supabaseId: authData.user.id,
            name,
            status: 'ACTIVE',
            onboardingCompleted: true,
            organizationId: payload.orgId,
            empresaId,
          },
          select: { id: true, name: true, email: true, numeroAbonado: true },
        })
      : await prisma.user.create({
          data: {
            supabaseId: authData.user.id,
            email,
            numeroAbonado,
            name,
            role: 'CLIENTE',
            status: 'ACTIVE',
            onboardingCompleted: true,
            organizationId: payload.orgId,
            empresaId,
          },
          select: { id: true, name: true, email: true, numeroAbonado: true },
        })
  } catch (err) {
    try { await supabaseAdmin.auth.admin.deleteUser(authData.user.id) } catch { /* ignore */ }
    console.error('[PORTAL ACCESO] user.create/update (abonado) falló:', err)
    return NextResponse.json({ error: 'No se pudo crear el usuario' }, { status: 500 })
  }

  // Sin mail que mandar — el acceso queda usable de una con número de
  // abonado + la contraseña que acaba de elegir el admin.
  return NextResponse.json({ data: user }, { status: 201 })
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const payload = await getCurrentUser()
  if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (!['SUPER_ADMIN', 'ADMIN'].includes(payload.role)) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

  const empresa = await guard(payload.orgId, params.id)
  if (!empresa) return NextResponse.json({ error: 'Empresa no encontrada' }, { status: 404 })

  const body = await req.json().catch(() => null)
  const userId = typeof body?.userId === 'string' ? body.userId : ''
  const newPassword = typeof body?.newPassword === 'string' ? body.newPassword : ''
  if (!userId) return NextResponse.json({ error: 'Falta userId' }, { status: 400 })

  const target = await prisma.user.findFirst({
    where: { id: userId, organizationId: payload.orgId, empresaId: params.id, role: 'CLIENTE', status: 'ACTIVE' },
    select: { email: true, supabaseId: true, numeroAbonado: true },
  })
  if (!target) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

  // Resetear contraseña a mano — para usuarios de número de abonado (sin
  // mail real, no tienen "olvidé mi contraseña") y también disponible para
  // los de email si alguna vez hace falta destrabar a alguien sin esperar
  // el flujo de recuperación. Pedido de Abba/Seba, 2026-10-05.
  if (newPassword) {
    if (newPassword.length < 4) return NextResponse.json({ error: 'La contraseña debe tener al menos 4 caracteres' }, { status: 400 })
    if (!target.supabaseId) return NextResponse.json({ error: 'Este usuario no tiene cuenta de acceso asociada' }, { status: 409 })
    const { error } = await createAdminClient().auth.admin.updateUserById(target.supabaseId, { password: newPassword })
    if (error) {
      console.error('[PORTAL ACCESO] reset de contraseña falló:', error.message)
      return NextResponse.json({ error: 'No se pudo cambiar la contraseña' }, { status: 502 })
    }
    return NextResponse.json({ ok: true })
  }

  if (target.numeroAbonado) {
    return NextResponse.json({ error: 'Este usuario entra con número de abonado, no tiene enlace por mail — usá "Resetear contraseña".' }, { status: 400 })
  }

  const result = await sendPortalMagicLink(target.email, req)
  if (!result.ok) return NextResponse.json({ error: result.error ?? 'No se pudo enviar el mail' }, { status: 502 })

  return NextResponse.json({ ok: true })
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
