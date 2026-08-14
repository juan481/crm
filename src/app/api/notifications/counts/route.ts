import { NextResponse } from 'next/server'
import { getCurrentUser, canAccess } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { taskInvolvesUser, ticketInvolvesUser } from '@/lib/assignment-scope'

export interface NotificationCounts {
  tasks: number
  tickets: number
  invoices: number
}

export async function GET() {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const now = new Date()
    const { orgId, userId, role } = payload
    const isAdmin = canAccess(role, 'ADMIN')

    const [tasks, tickets, invoices] = await Promise.all([
      // Tareas asignadas a mí O donde soy colaborador, pendientes o en curso.
      prisma.task.count({
        where: {
          organizationId: orgId,
          status: { in: ['PENDIENTE', 'EN_CURSO'] },
          ...taskInvolvesUser(userId),
        },
      }),
      // Open tickets — TECHNICIAN sees only their assigned ones (o donde es colaborador)
      prisma.ticket.count({
        where: {
          organizationId: orgId,
          status: { in: ['ABIERTO', 'EN_PROCESO'] },
          ...(role === 'TECHNICIAN' && ticketInvolvesUser(userId)),
        },
      }),
      // Overdue invoices — only visible to ADMIN+
      isAdmin
        ? prisma.invoice.count({
            where: {
              organizationId: orgId,
              OR: [
                { status: 'OVERDUE' },
                { status: 'PENDING', dueDate: { lt: now } },
              ],
            },
          })
        : Promise.resolve(0),
    ])

    return NextResponse.json(
      { data: { tasks, tickets, invoices } as NotificationCounts },
      { headers: { 'Cache-Control': 's-maxage=30, stale-while-revalidate=60' } },
    )
  } catch (error) {
    console.error('[NOTIFICATION COUNTS]', error)
    return NextResponse.json({ data: { tasks: 0, tickets: 0, invoices: 0 } })
  }
}
