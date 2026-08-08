import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

// Lista las organizaciones a las que el usuario logueado puede acceder: la
// suya de origen (User.organizationId) + cualquier OrganizationMembership.
// El switcher en el sidebar sólo se muestra si esto devuelve más de un
// elemento — para el 100% de los usuarios de un solo tenant (todo Abba
// incluido) esta lista siempre tiene largo 1.
export async function GET() {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const user = await prisma.user.findUnique({
      where: { supabaseId: session.user.id },
      select: {
        organization: { select: { id: true, name: true, logoUrl: true } },
        memberships: {
          select: { organization: { select: { id: true, name: true, logoUrl: true } } },
        },
      },
    })
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const all = [user.organization, ...user.memberships.map((m) => m.organization)]
    // Defensivo: no debería poder existir una membership hacia la propia org
    // de origen (nada la crea así hoy), pero si alguna vez pasara, no
    // queremos que el switcher muestre la misma organización dos veces.
    const seen = new Set<string>()
    const orgs = all
      .filter((org) => (seen.has(org.id) ? false : (seen.add(org.id), true)))
      .map((org) => ({ ...org, isActive: org.id === payload.orgId }))

    return NextResponse.json({ data: orgs })
  } catch (error) {
    console.error('[SESSION ORGANIZATIONS GET]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
