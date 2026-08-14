import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, canAccess } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { notifyTaskAssignment } from '@/lib/task-notifications'
import { notifyCollaboratorAdded } from '@/lib/collaborator-notifications'

interface Params { params: { id: string } }

const INCLUDE = {
  assignedTo: { select: { id: true, name: true, avatarUrl: true } },
  createdBy:  { select: { id: true, name: true } },
  client:     { select: { id: true, name: true } },
  empresa:    { select: { id: true, name: true } },
  deal:       { select: { id: true, title: true } },
  ticket:     { select: { id: true, number: true, title: true } },
  collaborators: { select: { user: { select: { id: true, name: true, avatarUrl: true } } } },
}

export async function GET(_: NextRequest, { params }: Params) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const db = prisma as any
    // Same visibility as the list endpoint — a lower role could otherwise
    // read any task in the org by guessing/typing its id, even though the
    // list itself already scopes them to their own. Colaborador cuenta
    // igual que asignado principal (ver assignment-scope.ts).
    const scopeWhere: Record<string, unknown> = { id: params.id, organizationId: payload.orgId }
    if (payload.role === 'TECHNICIAN') {
      scopeWhere.OR = [{ assignedToId: payload.userId }, { collaborators: { some: { userId: payload.userId } } }]
    } else if (['SELLER', 'HR'].includes(payload.role)) {
      scopeWhere.OR = [
        { assignedToId: payload.userId }, { createdById: payload.userId },
        { collaborators: { some: { userId: payload.userId } } },
      ]
    }

    const task = await db.task.findFirst({ where: scopeWhere, include: INCLUDE })
    if (!task) return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 })
    return NextResponse.json({ data: task })
  } catch (error) {
    console.error('[TASK GET]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    // HR solo puede ver tareas, no editarlas
    if (payload.role === 'HR')
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const db = prisma as any
    const scopeWhere: Record<string, unknown> = { id: params.id, organizationId: payload.orgId }
    if (payload.role === 'SELLER') {
      scopeWhere.OR = [
        { assignedToId: payload.userId }, { createdById: payload.userId },
        { collaborators: { some: { userId: payload.userId } } },
      ]
    }
    // select acotado a lo que este handler realmente usa. collaborators
    // siempre viene (barato, es sólo userId) — hace falta tanto para el
    // chequeo de permisos de TECHNICIAN como para diffear qué colaborador
    // es nuevo y avisarle sólo a ese.
    const existing = await db.task.findFirst({
      where: scopeWhere,
      select: { id: true, status: true, assignedToId: true, collaborators: { select: { userId: true } } },
    })
    if (!existing) return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 })
    const existingCollabIds: string[] = existing.collaborators.map((c: { userId: string }) => c.userId)

    const body = await req.json()
    const { status, viewed } = body
    const isTech = payload.role === 'TECHNICIAN'

    // TECHNICIAN solo puede marcar como vista o cambiar estado de sus
    // propias tareas — "propias" ahora incluye ser colaborador, no sólo el
    // asignado principal.
    if (isTech && existing.assignedToId !== payload.userId && !existingCollabIds.includes(payload.userId))
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const { title, description, priority, dueDate, assignedToId, clientId, empresaId, dealId, ticketId, collaboratorIds } = body
    const isCompleting    = status === 'HECHA' && existing.status !== 'HECHA'
    const shouldMarkViewed = viewed === true && payload.userId === existing.assignedToId && !existing.viewedAt
    const isReassigning = !isTech && assignedToId && assignedToId !== existing.assignedToId

    // Colaboradores — reemplazo completo de la lista (semántica simple: lo
    // que mandás es lo que queda), sólo si el body trae la clave. Mismo
    // permiso que assignedToId (!isTech). El asignado efectivo (el nuevo si
    // se está reasignando, si no el actual) nunca queda duplicado como
    // colaborador.
    const effectiveAssignedToId = (!isTech && assignedToId) ? assignedToId : existing.assignedToId
    const newCollabIds: string[] | undefined = (!isTech && Array.isArray(collaboratorIds))
      ? Array.from(new Set(collaboratorIds.filter((id: unknown) => typeof id === 'string' && id !== effectiveAssignedToId)))
      : undefined
    const addedCollabIds = newCollabIds ? newCollabIds.filter((id) => !existingCollabIds.includes(id)) : []

    // Mismo chequeo que ya hace POST /api/tareas — faltaba acá en el PATCH.
    // Son independientes entre sí — van en paralelo (antes eran round-trips
    // secuenciales en cada edición de tarea).
    const needsAssigneeCheck = !isTech && assignedToId && assignedToId !== existing.assignedToId
    const [assignee, client, empresa, deal, ticket, validCollaborators] = await Promise.all([
      needsAssigneeCheck  ? db.user.findFirst({ where: { id: assignedToId, organizationId: payload.orgId }, select: { id: true } }) : null,
      (!isTech && clientId)  ? db.client.findFirst({ where: { id: clientId, organizationId: payload.orgId }, select: { id: true } })  : null,
      (!isTech && empresaId) ? db.empresa.findFirst({ where: { id: empresaId, organizationId: payload.orgId }, select: { id: true } }) : null,
      (!isTech && dealId)    ? db.deal.findFirst({ where: { id: dealId, organizationId: payload.orgId }, select: { id: true } })      : null,
      (!isTech && ticketId)  ? db.ticket.findFirst({ where: { id: ticketId, organizationId: payload.orgId }, select: { id: true } })  : null,
      newCollabIds?.length    ? db.user.findMany({ where: { id: { in: newCollabIds }, organizationId: payload.orgId }, select: { id: true } }) : null,
    ])
    if (needsAssigneeCheck && !assignee)       return NextResponse.json({ error: 'Usuario no encontrado en esta organización' }, { status: 400 })
    if (!isTech && clientId && !client)        return NextResponse.json({ error: 'Cliente no encontrado en esta organización' }, { status: 400 })
    if (!isTech && empresaId && !empresa)      return NextResponse.json({ error: 'Empresa no encontrada en esta organización' }, { status: 400 })
    if (!isTech && dealId && !deal)            return NextResponse.json({ error: 'Oportunidad no encontrada en esta organización' }, { status: 400 })
    if (!isTech && ticketId && !ticket)        return NextResponse.json({ error: 'Ticket no encontrado en esta organización' }, { status: 400 })
    if (newCollabIds?.length && (validCollaborators?.length ?? 0) !== newCollabIds.length) {
      return NextResponse.json({ error: 'Alguno de los colaboradores no pertenece a esta organización' }, { status: 400 })
    }

    const task = await db.task.update({
      where: { id: params.id },
      data: {
        ...((!isTech && title !== undefined)       && { title }),
        ...((!isTech && description !== undefined) && { description: description || null }),
        ...(status !== undefined                   && { status }),
        ...((!isTech && priority)                  && { priority }),
        ...((!isTech && dueDate !== undefined)     && { dueDate: dueDate ? new Date(dueDate) : null }),
        ...((!isTech && assignedToId)              && { assignedToId }),
        ...((!isTech && clientId !== undefined)    && { clientId:  clientId  || null }),
        ...((!isTech && empresaId !== undefined)   && { empresaId: empresaId || null }),
        ...((!isTech && dealId !== undefined)      && { dealId:   dealId   || null }),
        ...((!isTech && ticketId !== undefined)    && { ticketId: ticketId || null }),
        ...(isCompleting                           && { completedAt: new Date() }),
        ...(!isCompleting && status && status !== 'HECHA' && { completedAt: null }),
        ...(shouldMarkViewed                       && { viewedAt: new Date() }),
        ...(newCollabIds !== undefined             && { collaborators: { deleteMany: {}, create: newCollabIds.map((userId) => ({ userId })) } }),
      },
      include: INCLUDE,
    })

    // Email al nuevo asignado — sólo cuando de verdad cambia a otra persona
    // (no cuando se re-guarda la misma), y nunca cuando uno se autoasigna.
    if (isReassigning && assignedToId !== payload.userId) {
      notifyTaskAssignment(task, payload.orgId)
    }
    for (const userId of addedCollabIds) {
      if (userId === payload.userId) continue
      notifyCollaboratorAdded({ userId, orgId: payload.orgId, kind: 'tarea', title: task.title, entityId: task.id })
    }

    return NextResponse.json({ data: task })
  } catch (error) {
    console.error('[TASK PATCH]', error)
    return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, { params }: Params) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!canAccess(payload.role, 'ADMIN'))
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const db = prisma as any
    await db.task.deleteMany({ where: { id: params.id, organizationId: payload.orgId } })
    return NextResponse.json({ message: 'Tarea eliminada' })
  } catch (error) {
    console.error('[TASK DELETE]', error)
    return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 })
  }
}
