import { prisma } from '@/lib/db'
import type { AuthPayload } from '@/types'

export type DeletableEntityType = 'empresa' | 'contacto'

interface RequestOrDeleteResult {
  // true = ya se borró de verdad (SUPER_ADMIN, resuelve en el momento).
  // false = quedó pendiente de aprobación (ADMIN/ADMINISTRATIVO).
  deleted: boolean
  message: string
}

// Maker-checker de Eliminar (pedido de Abba, Seba 2026-10-02): un
// SUPER_ADMIN resuelve en el momento (es la autoridad — no tiene que
// autoconfirmarse), cualquier otro rol con acceso a Eliminar (hoy sólo
// ADMIN/ADMINISTRATIVO llegan hasta acá, ver canAccess('SELLER') en los
// DELETE de empresas/contactos) deja un pedido pendiente en vez de borrar
// directo. El caller ejecuta el delete real sólo si `deleted` vuelve true.
export async function requestOrDelete(
  payload: AuthPayload,
  entityType: DeletableEntityType,
  entityId: string,
  entityLabel: string,
): Promise<RequestOrDeleteResult> {
  if (payload.role === 'SUPER_ADMIN') {
    return { deleted: true, message: 'Eliminado' }
  }

  await prisma.deletionRequest.create({
    data: {
      organizationId: payload.orgId,
      entityType,
      entityId,
      entityLabel,
      requestedById: payload.userId,
    },
  })

  return {
    deleted: false,
    message: 'Pedido de baja enviado — un Super Admin tiene que confirmarlo antes de que se borre.',
  }
}
