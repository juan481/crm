import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

// Devuelve el token del formulario público de soporte de la organización
// activa — lo arma el cliente con window.location.origin + /soporte/{token}
// (ver botón "Copiar link" en Tickets). Cualquier rol autenticado puede
// leerlo, no es sensible (es el mismo link que se comparte externamente).
export async function GET() {
  const payload = await getCurrentUser()
  if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const db = prisma as any
  let org = await db.organization.findUnique({
    where: { id: payload.orgId },
    select: { publicSupportToken: true },
  })

  // Orgs creadas antes de la Fase 13 pueden no tenerlo todavía (nullable a
  // propósito, ver schema.prisma) — se genera acá mismo, una sola vez.
  if (!org?.publicSupportToken) {
    const { randomUUID } = await import('crypto')
    org = await db.organization.update({
      where: { id: payload.orgId },
      data: { publicSupportToken: randomUUID() },
      select: { publicSupportToken: true },
    })
  }

  return NextResponse.json({ data: { token: org.publicSupportToken } })
}
