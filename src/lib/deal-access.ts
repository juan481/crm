import { prisma } from '@/lib/db'

// SELLER (y, desde el 2026-10-01, un TECHNICIAN al que le habilitaron el
// módulo Pipeline — pedido de Abba/Seba: deriva clientes a IT para que
// vendan) sólo ve/edita los deals que le pertenecen, SALVO que tenga
// "verTodoPipeline" prendido (Configuración → Usuarios) — entonces ve/edita
// TODO el Pipeline de la org, igual que un ADMIN. No afecta quién puede
// REASIGNAR el dueño de un deal (eso sigue siendo sólo ADMIN+) — así nada
// queda "perdido" al ampliar la visibilidad. Pedido de Abba, 2026-09-24.
export async function sellerOwnerScope(userId: string): Promise<{ ownerId?: string }> {
  const me = await prisma.user.findUnique({ where: { id: userId }, select: { verTodoPipeline: true } })
  return me?.verTodoPipeline ? {} : { ownerId: userId }
}

// Roles que operan el Pipeline "acotados a lo suyo" por default — el scope de
// sellerOwnerScope() aplica a ambos por igual (ver arriba).
export function isScopedPipelineRole(role: string): boolean {
  return role === 'SELLER' || role === 'TECHNICIAN'
}
