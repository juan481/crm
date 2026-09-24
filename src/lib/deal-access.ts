import { prisma } from '@/lib/db'

// SELLER sólo ve/edita los deals que le pertenecen, SALVO que tenga
// "verTodoPipeline" prendido (Configuración → Usuarios) — entonces ve/edita
// TODO el Pipeline de la org, igual que un ADMIN. No afecta quién puede
// REASIGNAR el dueño de un deal (eso sigue siendo sólo ADMIN+) — así nada
// queda "perdido" al ampliar la visibilidad. Pedido de Abba, 2026-09-24.
export async function sellerOwnerScope(userId: string): Promise<{ ownerId?: string }> {
  const me = await prisma.user.findUnique({ where: { id: userId }, select: { verTodoPipeline: true } })
  return me?.verTodoPipeline ? {} : { ownerId: userId }
}
