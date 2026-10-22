import { NextResponse } from 'next/server'
import { getCurrentUserAny } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

// GET /api/usuarios
// Returns internal CRM users (not clients) for dropdowns like ticket assignment.
// Accessible to any authenticated user (unlike /api/settings/users which is admin-only).
export async function GET() {
  try {
    // getCurrentUserAny(): el portal de soporte externo (SUPPORT_EXTERNAL)
    // consume este endpoint para poblar el picker de "Asignado a" de
    // tickets — getCurrentUser() lo excluye (carril lateral). GREMIO sigue
    // bloqueado explícitamente, mismo criterio que el resto de las rutas
    // tocadas en este cambio.
    const payload = await getCurrentUserAny()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (payload.role === 'GREMIO' || payload.role === 'CLIENTE')
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const users = await prisma.user.findMany({
      where: {
        organizationId: payload.orgId,
        status: { not: 'DELETED' },
        // GREMIO/SUPPORT_EXTERNAL son carriles laterales (portales sin
        // acceso al CRM interno) — nunca deben aparecer en pickers de
        // asignación de Tareas/Tickets/RRHH que consumen este endpoint.
        role: { notIn: ['GREMIO', 'SUPPORT_EXTERNAL'] },
      },
      select: {
        id:        true,
        name:      true,
        role:      true,
        avatarUrl: true,
        status:    true,
      },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json({ data: users })
  } catch (error) {
    console.error('[USUARIOS GET]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
