import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, canAccess } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { MODULE_DEFINITIONS, ROLES, roleAtLeast, getModule } from '@/lib/modules'
import { unstable_cache, revalidateTag } from 'next/cache'
import type { Role } from '@/types'

interface ModulePermissionRow {
  id: string
  label: string
  minRole: Role
  // true/false por rol — SUPER_ADMIN siempre true, nunca editable (ver POST).
  roles: Record<Role, boolean>
}

async function fetchModulePermissions(orgId: string): Promise<ModulePermissionRow[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = await (prisma as any).modulePermission.findMany({ where: { organizationId: orgId } })

  return MODULE_DEFINITIONS.map((def) => {
    const rolesMap = {} as Record<Role, boolean>
    for (const role of ROLES) {
      if (role === 'SUPER_ADMIN') { rolesMap[role] = true; continue }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const row = rows.find((r: any) => r.moduleId === def.id && r.role === role)
      rolesMap[role] = row ? row.enabled : def.defaultRoles.includes(role)
    }
    return { id: def.id, label: def.label, minRole: def.minRole, roles: rolesMap }
  })
}

// Cambia rara vez — mismo criterio y mismo TTL que /api/plugins
const getCachedModulePermissions = unstable_cache(
  fetchModulePermissions,
  ['module-permissions'],
  { revalidate: 300, tags: ['module-permissions'] }
)

export async function GET() {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const data = await getCachedModulePermissions(payload.orgId)

    return NextResponse.json(
      { data },
      { headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=3600' } }
    )
  } catch (error) {
    console.error('[MODULE PERMISSIONS GET]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!canAccess(payload.role, 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Solo Super Admin puede gestionar permisos' }, { status: 403 })
    }

    const { moduleId, role, enabled } = await req.json() as { moduleId: string; role: Role; enabled: boolean }

    const def = getModule(moduleId)
    if (!def) return NextResponse.json({ error: 'Módulo no encontrado' }, { status: 404 })
    if (!ROLES.includes(role)) return NextResponse.json({ error: 'Rol inválido' }, { status: 400 })

    // Super Admin nunca es editable — ver un módulo entero es la garantía de
    // que jamás queda un tenant sin nadie que pueda revertir un toggle
    // hecho por error (anti-lockout, no negociable).
    if (role === 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Super Admin no es editable' }, { status: 400 })
    }

    // El panel sólo puede restar dentro de lo que canAccess() ya permite —
    // nunca puede otorgarle a un rol un módulo por debajo de su piso real.
    if (!roleAtLeast(role, def.minRole)) {
      return NextResponse.json({ error: 'Ese rol no tiene acceso a este módulo' }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma as any).modulePermission.upsert({
      where: { organizationId_moduleId_role: { organizationId: payload.orgId, moduleId, role } },
      update: { enabled },
      create: { organizationId: payload.orgId, moduleId, role, enabled },
    })

    revalidateTag('module-permissions')

    return NextResponse.json({ message: enabled ? 'Módulo habilitado' : 'Módulo deshabilitado' })
  } catch (error) {
    console.error('[MODULE PERMISSIONS POST]', error)
    return NextResponse.json({ error: 'Error al actualizar permiso' }, { status: 500 })
  }
}
