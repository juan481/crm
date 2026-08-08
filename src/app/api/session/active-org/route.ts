import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'
import { ACTIVE_ORG_COOKIE } from '@/lib/auth'

// Cambia la organización activa de la sesión. Sólo acepta la organización de
// origen del usuario o una a la que tenga OrganizationMembership real — se
// revalida acá mismo, con el userId que sale de la sesión autenticada, antes
// de tocar la cookie. getCurrentUser() vuelve a revalidar esto en cada
// request de todas formas — este chequeo es sólo para no setear una cookie
// inútil (o peor, confusa) si el pedido no es legítimo.
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { organizationId } = await req.json()
    if (typeof organizationId !== 'string' || !organizationId) {
      return NextResponse.json({ error: 'organizationId requerido' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { supabaseId: session.user.id },
      select: { id: true, organizationId: true, status: true },
    })
    if (!user || user.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const isHome = organizationId === user.organizationId
    if (!isHome) {
      const membership = await prisma.organizationMembership.findUnique({
        where: { userId_organizationId: { userId: user.id, organizationId } },
        select: { organization: { select: { suspended: true } } },
      })
      if (!membership || membership.organization.suspended) {
        return NextResponse.json({ error: 'No tenés acceso a esa organización' }, { status: 403 })
      }
    }

    const cookieStore = await cookies()
    cookieStore.set(ACTIVE_ORG_COOKIE, organizationId, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 días
    })

    return NextResponse.json({ data: { organizationId } })
  } catch (error) {
    console.error('[SESSION ACTIVE-ORG POST]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
