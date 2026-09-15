// Alta real de la organización JustCreate (Fase 0.6 del plan) — mismo camino
// que el endpoint POST /api/admin/organizations que se acaba de construir en
// 0.5 (Supabase Auth admin.createUser + fila Organization/User), corrido acá
// directo porque no hay servidor dev levantado para pegarle por HTTP.
//
// A propósito deja `vertical` en null: así Juan pasa por el wizard real de
// onboarding (0.2/0.3) en su primer login, en vez de que se lo precargue un
// script — es la prueba end-to-end de la feature que se acaba de construir.
import { prisma } from '../src/lib/db'
import { createAdminClient } from '../src/lib/supabase/admin'

const ADMIN_EMAIL = 'juancruzrossi1@gmail.com'
const ADMIN_NAME = 'Juan Cruz Rossi'
const ORG_NAME = 'JustCreate'
const DOMAIN = 'justcreate.com.ar'

function randomPassword() {
  return Math.random().toString(36).slice(-6) + Math.random().toString(36).slice(-6).toUpperCase() + '!7'
}

async function main() {
  const db = prisma as any

  const existingUser = await db.user.findFirst({ where: { email: ADMIN_EMAIL, status: { not: 'DELETED' } } })
  if (existingUser) {
    console.log('Ya existe un usuario con ese email, no creo nada:', existingUser)
    return
  }
  const existingOrg = await db.organization.findFirst({ where: { name: ORG_NAME } })
  if (existingOrg) {
    console.log('Ya existe una organización JustCreate, no creo otra:', existingOrg)
    return
  }

  const org = await db.organization.create({
    data: { name: ORG_NAME, domain: DOMAIN },
    select: { id: true, name: true },
  })
  console.log('Organización creada:', org)

  const password = randomPassword()
  const supabaseAdmin = createAdminClient()
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password,
    email_confirm: true,
  })
  if (authError) {
    console.error('Error creando el usuario en Supabase Auth, hago rollback de la org:', authError.message)
    await db.organization.delete({ where: { id: org.id } })
    return
  }

  const user = await db.user.create({
    data: {
      supabaseId: authData.user.id,
      name: ADMIN_NAME,
      email: ADMIN_EMAIL,
      role: 'SUPER_ADMIN',
      organizationId: org.id,
      forcePasswordChange: true,
      isPlatformAdmin: true,
    },
    select: { id: true, email: true, name: true, role: true, isPlatformAdmin: true },
  })
  console.log('Usuario creado:', user)
  console.log('CONTRASEÑA INICIAL (comunicar por un canal seguro, se pide cambiarla al entrar):', password)
}

main().finally(() => prisma.$disconnect())
