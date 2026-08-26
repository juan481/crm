import { prisma } from '@/lib/db'

// Movida acá desde src/lib/whatsapp-bot/technician-picker.ts (donde nació
// para resolver el email de contacto de Ventas/Administración del bot
// NISSI) — es genérica, sin nada de WhatsApp, y ahora la usa también el
// Módulo 3 (portal Gremio) para resolver a quién asignar un Pedido por
// email de configuración (ej. Sebastian Pierini). technician-picker.ts
// reexporta desde acá para no romper su import existente.
//
// Si Abba cargó un email de contacto puntual en la config de un plugin, se
// busca el User de esa organización con ese email para poder asignarle el
// recurso como owner o notificarlo por su nombre real; si no matchea ningún
// usuario cargado en el CRM (ej. todavía no tiene cuenta), se devuelve null
// y el caller cae al fallback (no bloquea la operación).
export async function findUserByEmail(orgId: string, email: string | null): Promise<{ id: string; name: string; email: string } | null> {
  if (!email) return null
  const db = prisma as any
  return db.user.findFirst({
    where: { organizationId: orgId, email: email.toLowerCase(), status: { not: 'DELETED' } },
    select: { id: true, name: true, email: true },
  })
}
