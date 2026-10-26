import { sellerOwnerScope, isScopedPipelineRole } from '@/lib/deal-access'
import type { Role } from '@/types'

// Historial de un cliente que vive en OTRO lado que sus propias notas —
// pedido de Abba (Seba, 26/10): "está como cliente, pero lo que se habló no
// aparece en su perfil; si lo saco del pipeline pierdo todo lo que hablé, y
// si dentro de un mes cae de nuevo no sé qué hablamos salvo que revise WA".
// Lo hablado se carga en la Actividad de la OPORTUNIDAD (DealNota: el chat
// de NISSI al derivar + las notas del vendedor), y la ficha del cliente sólo
// leía EmpresaNota. Esto suma, de sólo lectura:
//  - Empresa  → notas de sus oportunidades (por empresaId, o por un contacto
//                suyo cuando la oportunidad todavía no tenía empresa) y de
//                sus contactos.
//  - Contacto → notas de sus oportunidades.
// Un vendedor con pipeline acotado sólo ve las de SUS oportunidades (mismo
// criterio que GET /api/deals).

export interface NotaRelacionada {
  id: string
  tipo: string
  content: string
  estimatedMinutes: number
  metadata: string | null
  createdAt: string
  user: { id: string; name: string; avatarUrl: string | null }
  // De dónde viene — la UI lo muestra y no ofrece borrarla desde acá.
  origen: { tipo: 'oportunidad' | 'contacto'; id: string; label: string }
}

const NOTA_SELECT = {
  id: true, tipo: true, content: true, estimatedMinutes: true, metadata: true, createdAt: true,
  user: { select: { id: true, name: true, avatarUrl: true } },
}

async function scopeDeals(payload: { userId: string; role: Role }) {
  return isScopedPipelineRole(payload.role) ? await sellerOwnerScope(payload.userId) : {}
}

function normalizar(n: any, origen: NotaRelacionada['origen']): NotaRelacionada {
  return { ...n, metadata: n.metadata ?? null, createdAt: n.createdAt.toISOString(), origen }
}

export async function notasRelacionadasDeEmpresa(
  db: any,
  payload: { orgId: string; userId: string; role: Role },
  empresaId: string,
): Promise<NotaRelacionada[]> {
  const ownerScope = await scopeDeals(payload)
  const [deals, contactos] = await Promise.all([
    db.deal.findMany({
      where: {
        organizationId: payload.orgId, ...ownerScope,
        OR: [{ empresaId }, { empresaId: null, contacto: { empresaId } }],
      },
      select: { id: true, title: true, notas: { select: NOTA_SELECT } },
    }),
    db.directorioContacto.findMany({
      where: { organizationId: payload.orgId, empresaId },
      select: { id: true, firstName: true, lastName: true, notas: { select: NOTA_SELECT } },
    }),
  ])
  return [
    ...deals.flatMap((d: any) => d.notas.map((n: any) => normalizar(n, { tipo: 'oportunidad', id: d.id, label: d.title }))),
    ...contactos.flatMap((c: any) => c.notas.map((n: any) => normalizar(n, { tipo: 'contacto', id: c.id, label: `${c.firstName} ${c.lastName}`.trim() }))),
  ]
}

export async function notasRelacionadasDeContacto(
  db: any,
  payload: { orgId: string; userId: string; role: Role },
  contactoId: string,
): Promise<NotaRelacionada[]> {
  const ownerScope = await scopeDeals(payload)
  const deals = await db.deal.findMany({
    where: { organizationId: payload.orgId, contactoId, ...ownerScope },
    select: { id: true, title: true, notas: { select: NOTA_SELECT } },
  })
  return deals.flatMap((d: any) => d.notas.map((n: any) => normalizar(n, { tipo: 'oportunidad', id: d.id, label: d.title })))
}

/** Mezcla las notas propias con las relacionadas, más nuevas primero. */
export function mezclarPorFecha<T extends { createdAt: string }>(...listas: T[][]): T[] {
  return listas.flat().sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}
