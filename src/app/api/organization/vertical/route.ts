import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { VERTICALS, isValidVertical } from '@/lib/verticals'

// GET: estado actual — usado por el wizard de onboarding para decidir si
// tiene que mostrar el selector de rubro (sólo si todavía es null), y si
// tiene que mostrar el wizard completo o saltar directo al rubro.
//
// `alreadyOnboarded` se resuelve acá (server-side, contra la DB) y NO desde
// useAuthStore en el cliente a propósito: un usuario multi-organización que
// cambia de organización llega a /onboarding por una recarga dura (ver
// OrgSwitcher), que vacía el store de Zustand — si el wizard confiara en
// `user?.onboardingCompleted` del store ahí, siempre daría `false` en ese
// camino y le volvería a pedir nombre/contraseña a alguien que ya tiene
// cuenta (y, peor, el submit de esa pantalla SÍ cambia la contraseña real).
export async function GET() {
  const payload = await getCurrentUser()
  if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const [org, user] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (prisma.organization as any).findUnique({
      where: { id: payload.orgId },
      select: { vertical: true },
    }),
    prisma.user.findUnique({
      where: { id: payload.userId },
      select: { onboardingCompleted: true },
    }),
  ])

  return NextResponse.json({
    data: {
      vertical: org?.vertical ?? null,
      canSet: payload.role === 'SUPER_ADMIN',
      alreadyOnboarded: user?.onboardingCompleted ?? false,
      options: VERTICALS,
    },
  })
}

// POST: fija el rubro. SUPER_ADMIN-only, y sólo si todavía no se eligió —
// evita que se pise por accidente una vez configurados los módulos/plugins
// alrededor de ese rubro (cambiarlo después es una decisión deliberada, no
// algo para exponer en este mismo endpoint de alta).
export async function POST(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (payload.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Sólo el Super Admin puede elegir el rubro' }, { status: 403 })
    }

    const { vertical } = await req.json()
    if (typeof vertical !== 'string' || !isValidVertical(vertical)) {
      return NextResponse.json({ error: 'Rubro inválido' }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const org = await (prisma.organization as any).findUnique({
      where: { id: payload.orgId },
      select: { vertical: true },
    })
    if (org?.vertical) {
      return NextResponse.json({ error: 'El rubro ya fue configurado para esta organización' }, { status: 409 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma.organization as any).update({
      where: { id: payload.orgId },
      data: { vertical },
    })

    return NextResponse.json({ data: { vertical } })
  } catch (error) {
    console.error('[ORGANIZATION/VERTICAL]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
