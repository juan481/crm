// Bases de contactos (listas / origen: "Expo Rosario 2026", "Exposeg"…).
// Helpers compartidos por las rutas de bases, los dos importadores de Excel
// (Contactos y Empresas → directorio) y el armador de campañas. Ver modelos
// ContactoBase / ContactoBaseMiembro en prisma/schema.prisma.
import { prisma } from '@/lib/db'
import { canAccess } from '@/lib/auth'
import { roleHasModule } from '@/lib/module-access'
import type { Role } from '@/types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any

export const BASE_NAME_MAX = 80

/** Mismo criterio de acceso que el módulo Contactos (SELLER+ o el módulo prendido en Permisos). */
export async function canUseBases(orgId: string, role: Role): Promise<boolean> {
  return canAccess(role, 'SELLER') || (await roleHasModule(orgId, role, 'contactos'))
}

export function cleanBaseName(raw: unknown): string {
  return String(raw ?? '').normalize('NFC').replace(/\s+/g, ' ').trim().slice(0, BASE_NAME_MAX)
}

/** Devuelve la base si pertenece a la organización (o null). Nunca confiar en un baseId del cliente sin esto. */
export async function findOrgBase(orgId: string, baseId: unknown): Promise<{ id: string; name: string } | null> {
  if (typeof baseId !== 'string' || !baseId) return null
  return db.contactoBase.findFirst({ where: { id: baseId, organizationId: orgId }, select: { id: true, name: true } })
}

/**
 * Crea la base o devuelve la existente con el mismo nombre (sin distinguir
 * mayúsculas) — "crear una base nueva en el momento" al importar no tiene que
 * fallar si alguien ya la había creado con ese nombre.
 */
export async function findOrCreateBase(orgId: string, name: string, description?: string | null) {
  const existing = await db.contactoBase.findFirst({
    where: { organizationId: orgId, name: { equals: name, mode: 'insensitive' } },
    select: { id: true, name: true, description: true },
  })
  if (existing) return { base: existing, created: false }
  try {
    const base = await db.contactoBase.create({
      data: { organizationId: orgId, name, description: description?.trim() || null },
      select: { id: true, name: true, description: true },
    })
    return { base, created: true }
  } catch (err: unknown) {
    // Carrera con otro request creando el mismo nombre exacto (@@unique).
    if ((err as { code?: string })?.code === 'P2002') {
      const base = await db.contactoBase.findFirst({
        where: { organizationId: orgId, name: { equals: name, mode: 'insensitive' } },
        select: { id: true, name: true, description: true },
      })
      if (base) return { base, created: false }
    }
    throw err
  }
}

/** Agrega contactos a una base (idempotente). Devuelve cuántas filas nuevas se crearon. */
export async function addContactosToBase(baseId: string, contactoIds: string[]): Promise<number> {
  const ids = Array.from(new Set(contactoIds.filter(Boolean)))
  if (ids.length === 0) return 0
  let added = 0
  for (let i = 0; i < ids.length; i += 1000) {
    const chunk = ids.slice(i, i + 1000)
    const res = await db.contactoBaseMiembro.createMany({
      data: chunk.map((contactoId) => ({ baseId, contactoId })),
      skipDuplicates: true,
    })
    added += res.count
  }
  return added
}

/** Conteos por base: total de contactos y cuántos tienen email (los que sirven para una campaña). */
export async function listBasesWithCounts(orgId: string) {
  const rows = await prisma.$queryRaw<{ id: string; name: string; description: string | null; createdAt: Date; total: bigint; conEmail: bigint }[]>`
    SELECT b.id, b.name, b.description, b."createdAt",
      COUNT(m."contactoId") AS total,
      COUNT(m."contactoId") FILTER (WHERE COALESCE(TRIM(c.email), '') <> '') AS "conEmail"
    FROM "ContactoBase" b
    LEFT JOIN "ContactoBaseMiembro" m ON m."baseId" = b.id
    LEFT JOIN "DirectorioContacto" c ON c.id = m."contactoId"
    WHERE b."organizationId" = ${orgId}
    GROUP BY b.id
    ORDER BY b."createdAt" DESC
  `
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    createdAt: r.createdAt.toISOString(),
    total: Number(r.total),
    conEmail: Number(r.conEmail),
  }))
}
