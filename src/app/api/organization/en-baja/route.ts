import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, canAccess } from '@/lib/auth'
import { prisma } from '@/lib/db'

// "Empresa en baja" — ver comentario en Organization.enBaja (schema.prisma).
// GET: cualquier usuario interno logueado puede leer la bandera (la necesita
// el panel de Objetivos para decidir si le muestra el agregado general a un
// vendedor no-admin). PATCH: sólo ADMIN+ la cambia.
export async function GET() {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const org = await (prisma.organization as any).findUnique({
      where: { id: payload.orgId },
      select: { enBaja: true },
    })
    return NextResponse.json({ data: { enBaja: org?.enBaja ?? false } })
  } catch (error) {
    console.error('[ORGANIZATION/EN-BAJA GET]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!canAccess(payload.role, 'ADMIN'))
      return NextResponse.json({ error: 'Sólo un admin puede cambiar esto' }, { status: 403 })

    const { enBaja } = await req.json()
    if (typeof enBaja !== 'boolean') return NextResponse.json({ error: 'Valor inválido' }, { status: 400 })

    await (prisma.organization as any).update({
      where: { id: payload.orgId },
      data: { enBaja },
    })
    return NextResponse.json({ data: { enBaja } })
  } catch (error) {
    console.error('[ORGANIZATION/EN-BAJA PATCH]', error)
    return NextResponse.json({ error: 'Error al guardar' }, { status: 500 })
  }
}
